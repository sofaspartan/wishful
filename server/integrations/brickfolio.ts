/**
 * Brickfolio sync: the user's Google Sheet stays the source of truth. Wishful
 * reads the same published CSV tabs Brickfolio reads, plus Brickfolio's
 * catalog (sets.csv) and photo manifest, and mirrors them into one collection
 * ("full_sets") and one wishlist ("wishlist") matched by set number.
 *
 * Safety: nothing is changed unless both tabs download and parse cleanly, and
 * a sync never empties everything because of an empty download.
 */
import type { BrickfolioStatus, ItemSource, SyncResult } from '../../shared/types';
import { DEFAULT_PREFERENCES } from '../../shared/constants';
import { atomicUpdate, atomicUpdateExisting, db } from '../storage';
import { conflict, notFound, HttpError } from '../http';
import type { BrickfolioLinkRecord, CatalogCacheRecord, CatalogSet, IntegrationsDoc, ItemRecord, UserRecord, WishlistRecord } from '../records';
import { safeFetchBytes, UnsafeUrlError } from '../services/safeFetch';
import { updateUserIndex } from '../services/auth';
import { rateLimit } from '../services/rateLimit';
import { newId, now, nowIso, sha256 } from '../util';
import { createWishlist, getWishlist, linkItems, listOwnedWishlists, mutateWishlist, unlinkItems, MAX_ENTRIES_PER_LIST } from '../domain/wishlists';
import { deleteItem, listOwnedItems, mergeOwnership, newEntry } from '../domain/items';
import { clearEntryActivity } from '../domain/claims';
import { integrationsAllowed } from './access';
import { SyncError, bricksetCatalogSet, buildDesired, parseSheet, pickCatalogSets, type DesiredSet, type DesiredState, type ImageManifest } from './brickfolioData';

const STALE_MS = 15 * 60_000;
const LOCK_MS = 2 * 60_000;
const FETCH_HEADERS = {
  'user-agent': 'WishfulSync/1.0',
  accept: 'text/csv,application/json;q=0.9,*/*;q=0.5',
  'accept-encoding': 'gzip, deflate, br',
};

export interface BrickfolioConnectInput {
  siteUrl: string;
  fullSetsCsvUrl: string;
  wishlistCsvUrl: string;
}

export function requireIntegrationAccess(user: UserRecord): void {
  // A 404 keeps the feature invisible to everyone else.
  if (!integrationsAllowed(user.email)) throw notFound('Not found.');
}

export async function getBrickfolioLink(userId: string): Promise<BrickfolioLinkRecord | null> {
  return (await db('integrations').get<IntegrationsDoc>(userId))?.value.brickfolio ?? null;
}

export function toStatus(rec: BrickfolioLinkRecord | null): BrickfolioStatus {
  return {
    connected: Boolean(rec),
    siteUrl: rec?.siteUrl ?? '',
    fullSetsCsvUrl: rec?.fullSetsCsvUrl ?? '',
    wishlistCsvUrl: rec?.wishlistCsvUrl ?? '',
    collectionId: rec?.collectionId ?? null,
    wishlistId: rec?.wishlistId ?? null,
    lastSyncAt: rec?.lastSyncAt ?? null,
    lastSuccessAt: rec?.lastSuccessAt ?? null,
    lastError: rec?.lastError ?? null,
    lastResult: rec?.lastResult ?? null,
  };
}

export async function connectBrickfolio(user: UserRecord, input: BrickfolioConnectInput): Promise<{ status: BrickfolioStatus; changed: boolean }> {
  requireIntegrationAccess(user);
  const siteUrl = new URL(input.siteUrl).origin;
  await atomicUpdate<IntegrationsDoc>(db('integrations'), user.id, (doc) => {
    const current = doc?.brickfolio;
    return {
      ...(doc ?? {}),
      brickfolio: {
        siteUrl,
        fullSetsCsvUrl: input.fullSetsCsvUrl,
        wishlistCsvUrl: input.wishlistCsvUrl,
        collectionId: current?.collectionId ?? null,
        wishlistId: current?.wishlistId ?? null,
        connectedAt: current?.connectedAt ?? nowIso(),
        lastSyncAt: current?.lastSyncAt ?? null,
        lastSuccessAt: current?.lastSuccessAt ?? null,
        lastError: null,
        lastResult: current?.lastResult ?? null,
        syncLockUntil: current?.syncLockUntil ?? null,
      },
    };
  });
  return syncBrickfolio(user);
}

/** Stop syncing. The lists and sets stay, as ordinary editable items. */
export async function disconnectBrickfolio(user: UserRecord): Promise<void> {
  requireIntegrationAccess(user);
  await atomicUpdate<IntegrationsDoc>(db('integrations'), user.id, (doc) => {
    const { brickfolio: _b, ...rest } = doc ?? {};
    return rest;
  });
  for (const item of await listOwnedItems(user.id)) {
    if (item.source?.provider !== 'brickfolio') continue;
    await atomicUpdateExisting<ItemRecord>(db('items'), item.id, (current) => ({ ...current, source: null }));
  }
  for (const list of await listOwnedWishlists(user.id)) {
    if (list.link?.provider !== 'brickfolio') continue;
    await mutateWishlist(list.id, (w) => {
      w.link = null;
    });
  }
}

/**
 * Pull the sheet and mirror it. With `ifStale`, does nothing when the last
 * sync was recent or another sync is running (used when a linked list opens).
 */
export async function syncBrickfolio(user: UserRecord, opts: { ifStale?: boolean; skipRateLimit?: boolean } = {}): Promise<{ status: BrickfolioStatus; changed: boolean }> {
  requireIntegrationAccess(user);
  const existing = await getBrickfolioLink(user.id);
  if (!existing) throw notFound('Brickfolio isn’t connected.');
  if (opts.ifStale && existing.lastSyncAt && now().getTime() - Date.parse(existing.lastSyncAt) < STALE_MS) {
    return { status: toStatus(existing), changed: false };
  }

  let rec: BrickfolioLinkRecord;
  try {
    rec = await acquireLock(user.id);
  } catch (err) {
    if (opts.ifStale && err instanceof HttpError && err.code === 'sync_running') return { status: toStatus(existing), changed: false };
    throw err;
  }
  if (!opts.skipRateLimit) {
    try {
      await rateLimit('integrationSync', user.id);
    } catch (err) {
      await finish(user.id, {});
      throw err;
    }
  }

  try {
    const desired = await download(rec, user.preferences?.currency ?? DEFAULT_PREFERENCES.currency);
    const outcome = await apply(user, rec, desired);
    const changed = outcome.result.added + outcome.result.updated + outcome.result.removed + outcome.result.moved > 0;
    const stamp = nowIso();
    const saved = await finish(user.id, {
      collectionId: outcome.collectionId,
      wishlistId: outcome.wishlistId,
      lastSyncAt: stamp,
      lastSuccessAt: stamp,
      lastError: null,
      lastResult: outcome.result,
    });
    return { status: toStatus(saved), changed };
  } catch (err) {
    const message = err instanceof SyncError ? err.message : 'Something went wrong while syncing. Nothing else was changed; try again in a few minutes.';
    if (!(err instanceof SyncError)) console.error('[brickfolio] sync failed', err);
    const saved = await finish(user.id, { lastSyncAt: nowIso(), lastError: message });
    return { status: toStatus(saved), changed: false };
  }
}

async function acquireLock(userId: string): Promise<BrickfolioLinkRecord> {
  const t = now().getTime();
  const doc = await atomicUpdate<IntegrationsDoc>(db('integrations'), userId, (current) => {
    const b = current?.brickfolio;
    if (!current || !b) throw notFound('Brickfolio isn’t connected.');
    if (b.syncLockUntil && Date.parse(b.syncLockUntil) > t) throw conflict('A sync is already running. Try again in a moment.', 'sync_running');
    b.syncLockUntil = new Date(t + LOCK_MS).toISOString();
    return current;
  });
  return doc.brickfolio!;
}

async function finish(userId: string, patch: Partial<BrickfolioLinkRecord>): Promise<BrickfolioLinkRecord | null> {
  const doc = await atomicUpdate<IntegrationsDoc>(db('integrations'), userId, (current) => {
    // Disconnected while syncing: leave it disconnected.
    if (!current?.brickfolio) return current ?? {};
    current.brickfolio = { ...current.brickfolio, ...patch, syncLockUntil: null };
    return current;
  });
  return doc.brickfolio ?? null;
}

// ── Downloading ─────────────────────────────────────────────────────────────

async function fetchFile(url: string, what: string, maxBytes: number, headers: Record<string, string> = {}) {
  try {
    return await safeFetchBytes(url, { timeoutMs: 12_000, maxBytes, maxRedirects: 5, headers: { ...FETCH_HEADERS, ...headers } });
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw new SyncError(`The ${what} link isn’t allowed: ${err.message}`);
    if (err instanceof Error && err.message === 'Response too large') throw new SyncError(`The ${what} file is larger than expected, so nothing was changed.`);
    throw new SyncError(`Couldn’t download the ${what}. The site may be down; nothing was changed.`);
  }
}

const text = (body: Buffer) => new TextDecoder('utf-8').decode(body);

async function fetchSheet(url: string, tab: string): Promise<string> {
  const res = await fetchFile(url, `${tab} tab`, 5_000_000);
  if (res.status !== 200) throw new SyncError(`The ${tab} tab link answered with an error (${res.status}). Check that the sheet is still published to the web.`);
  return text(res.body);
}

async function fetchManifest(siteUrl: string): Promise<ImageManifest> {
  const load = async (path: string): Promise<ImageManifest> => {
    const res = await fetchFile(new URL(path, siteUrl).toString(), 'Brickfolio photo list', 2_000_000);
    if (res.status === 404) return {};
    if (res.status !== 200) throw new SyncError(`Brickfolio’s photo list answered with an error (${res.status}); nothing was changed.`);
    try {
      const parsed: unknown = JSON.parse(text(res.body));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ImageManifest) : {};
    } catch {
      throw new SyncError('Brickfolio’s photo list isn’t valid JSON; nothing was changed.');
    }
  };
  const [manifest, overrides] = await Promise.all([load('/set-images.json'), load('/set-images-overrides.json')]);
  return { ...manifest, ...overrides };
}

const BRICKSET_LOOKUPS_PER_SYNC = 10;
const BRICKSET_RETRY_MS = 24 * 60 * 60_000;

/**
 * Catalog rows for the sheet's sets. Re-downloads the ~3 MB catalog only when
 * it changed or new sets appear; sets it lacks (new releases, promos) are looked
 * up through Brickfolio's Brickset proxy, as Brickfolio itself does.
 */
async function loadCatalog(siteUrl: string, wanted: string[]): Promise<Record<string, CatalogSet>> {
  const url = new URL('/sets.csv', siteUrl).toString();
  const key = sha256(url);
  const cached = (await db('integration-cache').get<CatalogCacheRecord>(key))?.value ?? null;
  const covered = Boolean(cached) && wanted.every((k) => k in cached!.sets || cached!.missing.includes(k));
  const conditional: Record<string, string> = {};
  if (covered && cached?.etag) conditional['if-none-match'] = cached.etag;
  if (covered && cached?.lastModified) conditional['if-modified-since'] = cached.lastModified;

  const res = await fetchFile(url, 'Brickfolio set catalog (sets.csv)', 20_000_000, conditional);
  let record: CatalogCacheRecord;
  let dirty = false;
  if (res.status === 304 && cached) {
    record = { ...cached, extra: { ...cached.extra }, unknownCheckedAt: { ...cached.unknownCheckedAt } };
  } else if (res.status === 200) {
    const sets = pickCatalogSets(text(res.body), new Set(wanted));
    const header = (name: string) => {
      const v = res.headers[name];
      return typeof v === 'string' ? v : null;
    };
    record = {
      etag: header('etag'),
      lastModified: header('last-modified'),
      sets,
      missing: wanted.filter((k) => !(k in sets)),
      extra: { ...cached?.extra },
      unknownCheckedAt: { ...cached?.unknownCheckedAt },
    };
    dirty = true;
  } else {
    throw new SyncError(`Brickfolio’s sets.csv answered with an error (${res.status}); nothing was changed.`);
  }

  const extra = record.extra!;
  const checked = record.unknownCheckedAt!;
  const t = now().getTime();
  const lookups = wanted
    .filter((k) => !(k in record.sets) && !(k in extra))
    .filter((k) => !checked[k] || t - Date.parse(checked[k]) > BRICKSET_RETRY_MS)
    .slice(0, BRICKSET_LOOKUPS_PER_SYNC);
  for (const k of lookups) {
    const found = await lookUpBrickset(siteUrl, k);
    if (found) {
      extra[k] = found;
      delete checked[k];
    } else checked[k] = new Date(t).toISOString();
    dirty = true;
  }
  if (dirty) await db('integration-cache').set(key, record);
  return { ...extra, ...record.sets };
}

/** One set from Brickset through Brickfolio's proxy (which holds the API key). Null if unknown or unreachable. */
async function lookUpBrickset(siteUrl: string, setKey: string): Promise<CatalogSet | null> {
  const setNumber = setKey.includes('-') ? setKey : `${setKey}-1`;
  const url = new URL('/api/brickset/getSets', siteUrl);
  url.searchParams.set('userHash', '');
  url.searchParams.set('params', JSON.stringify({ setNumber }));
  try {
    const res = await safeFetchBytes(url.toString(), { timeoutMs: 8_000, maxBytes: 500_000, maxRedirects: 3, headers: { ...FETCH_HEADERS, accept: 'application/json' } });
    if (res.status !== 200) return null;
    return bricksetCatalogSet(JSON.parse(text(res.body)));
  } catch {
    return null;
  }
}

async function download(rec: BrickfolioLinkRecord, currency: string): Promise<DesiredState> {
  const [fullCsv, wishCsv, manifest] = await Promise.all([
    fetchSheet(rec.fullSetsCsvUrl, 'full_sets'),
    fetchSheet(rec.wishlistCsvUrl, 'wishlist'),
    fetchManifest(rec.siteUrl),
  ]);
  const full = parseSheet(fullCsv, 'full_sets');
  const wish = parseSheet(wishCsv, 'wishlist');
  const wanted = [...new Set([...full, ...wish].map((r) => r.setNum))];
  const catalog = wanted.length ? await loadCatalog(rec.siteUrl, wanted) : {};
  return buildDesired(full, wish, catalog, manifest, rec.siteUrl, currency);
}

// ── Applying ────────────────────────────────────────────────────────────────

type Tab = 'full_sets' | 'wishlist';

async function ensureList(user: UserRecord, id: string | null, tab: Tab): Promise<WishlistRecord> {
  const current = id ? await getWishlist(id) : null;
  if (current && current.ownerId === user.id) {
    if (current.link?.provider === 'brickfolio' && current.link.tab === tab) return current;
    return mutateWishlist(current.id, (w) => {
      w.link = { provider: 'brickfolio', tab };
    });
  }
  const created = await createWishlist(user, {
    title: tab === 'full_sets' ? 'LEGO Collection' : 'LEGO Wishlist',
    description: 'Synced from my Brickfolio sheet.',
    kind: tab === 'full_sets' ? 'collection' : 'wishlist',
    visibility: 'private',
    accentColor: '#b8862d',
    coverArt: { icon: 'brick', backdrop: tab === 'full_sets' ? 'blush' : 'sky' },
  });
  return mutateWishlist(created.id, (w) => {
    w.link = { provider: 'brickfolio', tab };
  });
}

/** The synced fields of an item, for change detection. */
function snapshot(item: ItemRecord) {
  return JSON.stringify([
    item.title,
    item.description,
    item.imageUrl,
    item.externalUrl,
    item.retailer,
    item.brand,
    item.price,
    item.currency,
    item.category,
    item.tags,
    item.metadata.model ?? '',
    item.source?.gallery ?? [],
    item.owned ? [item.owned.quantity, item.owned.rating ?? null, item.owned.review ?? ''] : null,
  ]);
}

function withSynced(current: ItemRecord, d: DesiredSet, stamp: string): ItemRecord {
  const f = d.fields;
  const source: ItemSource = { provider: 'brickfolio', key: d.key, gallery: f.gallery, syncedAt: stamp };
  let owned = current.owned ?? null;
  if (d.owned) {
    const base = mergeOwnership(current.owned, {});
    // A set that just arrived from the wishlist tab was got today.
    const acquiredOn = current.owned ? base.acquiredOn : current.createdAt === stamp ? null : stamp.slice(0, 10);
    owned = { ...base, acquiredOn, quantity: d.owned.quantity, rating: d.owned.rating, review: d.owned.review };
  } else {
    owned = null;
  }
  return {
    ...current,
    type: 'product',
    title: f.title,
    description: f.description,
    imageUrl: f.imageUrl,
    externalUrl: f.externalUrl,
    retailer: f.retailer,
    brand: f.brand,
    price: f.price,
    currency: f.currency,
    category: f.category,
    tags: f.tags,
    metadata: { ...current.metadata, model: f.model },
    owned,
    source,
  };
}

function blankItem(user: UserRecord, stamp: string): ItemRecord {
  return {
    id: newId(),
    ownerId: user.id,
    type: 'product',
    title: '',
    description: '',
    imageUrl: null,
    externalUrl: null,
    retailer: '',
    brand: '',
    price: null,
    currency: user.preferences?.currency ?? DEFAULT_PREFERENCES.currency,
    category: '',
    tags: [],
    notes: '',
    metadata: {},
    owned: null,
    wishlistIds: [],
    createdBy: user.id,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

async function apply(user: UserRecord, rec: BrickfolioLinkRecord, desired: DesiredState): Promise<{ result: SyncResult; collectionId: string; wishlistId: string }> {
  const stamp = nowIso();
  const synced = (await listOwnedItems(user.id)).filter((i) => i.source?.provider === 'brickfolio');
  const byKey = new Map(synced.map((i) => [i.source!.key, i]));
  if (desired.sets.size === 0 && synced.length > 0) {
    throw new SyncError('Both sheet tabs came back empty, so nothing was changed. If you really cleared them, disconnect Brickfolio in Settings instead.');
  }
  if (desired.collection.length > MAX_ENTRIES_PER_LIST || desired.wishlist.length > MAX_ENTRIES_PER_LIST) {
    throw new SyncError(`A list can hold up to ${MAX_ENTRIES_PER_LIST} items, so the sheet is too big to sync.`);
  }

  const collection = await ensureList(user, rec.collectionId, 'full_sets');
  const wishlist = await ensureList(user, rec.wishlistId, 'wishlist');
  const result: SyncResult = { added: 0, updated: 0, removed: 0, moved: 0, notInCatalog: [] };

  // Sets no longer on either tab.
  for (const [key, item] of byKey) {
    if (desired.sets.has(key)) continue;
    await deleteItem(item);
    byKey.delete(key);
    result.removed++;
  }

  // New and changed sets.
  const idFor = new Map<string, string>();
  const created: ItemRecord[] = [];
  for (const d of desired.sets.values()) {
    if (!d.inCatalog) result.notInCatalog.push(d.key);
    const current = byKey.get(d.key);
    if (!current) {
      const lists = [...(d.owned ? [collection.id] : []), ...(d.inWishlist ? [wishlist.id] : [])];
      const item = { ...withSynced(blankItem(user, stamp), d, stamp), wishlistIds: lists };
      created.push(item);
      idFor.set(d.key, item.id);
      continue;
    }
    idFor.set(d.key, current.id);
    const next = withSynced(current, d, stamp);
    if (snapshot(next) === snapshot(current)) continue;
    if (!current.owned && next.owned && wishlist.entries.some((e) => e.itemId === current.id)) result.moved++;
    else result.updated++;
    await atomicUpdateExisting<ItemRecord>(db('items'), current.id, (fresh) => ({ ...withSynced(fresh, d, stamp), updatedAt: stamp }));
  }
  await Promise.all(created.map((item) => db('items').set(item.id, item, { onlyIfNew: true })));
  if (created.length) {
    await updateUserIndex(user.id, (idx) => {
      idx.itemIds.unshift(...created.map((i) => i.id));
    });
  }
  result.added = created.length;

  // List membership, mirroring each tab. Entries for unsynced items are left alone.
  const syncedIds = new Set(idFor.values());
  const createdIds = new Set(created.map((i) => i.id));
  for (const [list, keys] of [
    [collection, desired.collection],
    [wishlist, desired.wishlist],
  ] as const) {
    const want = keys.map((k) => idFor.get(k)!).filter(Boolean);
    const wantSet = new Set(want);
    let removedEntries: string[] = [];
    let leaving: string[] = [];
    let joining: string[] = [];
    await mutateWishlist(list.id, (w) => {
      // May run more than once if the list changed underneath us.
      removedEntries = [];
      leaving = [];
      const present = new Set<string>();
      w.entries = w.entries.filter((e) => {
        if (syncedIds.has(e.itemId) && !wantSet.has(e.itemId)) {
          removedEntries.push(e.id);
          leaving.push(e.itemId);
          return false;
        }
        present.add(e.itemId);
        return true;
      });
      const fresh = want.filter((id) => !present.has(id));
      w.entries.unshift(...fresh.map((id) => newEntry(id, user.id)));
      joining = fresh.filter((id) => !createdIds.has(id));
    });
    await clearEntryActivity(list.id, removedEntries);
    if (leaving.length) await unlinkItems(leaving, list.id);
    if (joining.length) await linkItems(joining, list.id);
  }

  return { result, collectionId: collection.id, wishlistId: wishlist.id };
}

/** Hourly: every connected account that's still allowed. */
export async function syncAllBrickfolio(): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  for (const userId of await db('integrations').list()) {
    const doc = (await db('integrations').get<IntegrationsDoc>(userId))?.value;
    if (!doc?.brickfolio) continue;
    const user = (await db('users').get<UserRecord>(userId))?.value;
    if (!user || !integrationsAllowed(user.email)) continue;
    try {
      const { status } = await syncBrickfolio(user, { skipRateLimit: true });
      if (status.lastError) failed++;
      else synced++;
    } catch (err) {
      failed++;
      console.error('[brickfolio] scheduled sync failed', err);
    }
  }
  return { synced, failed };
}
