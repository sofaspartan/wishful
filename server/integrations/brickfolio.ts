/**
 * Brickfolio sync: the user's Google Sheet stays the source of truth. Wishful
 * reads the same published CSV tabs Brickfolio reads, plus Brickfolio's
 * catalog (sets.csv) and photo manifest, and mirrors them into one collection
 * ("full_sets") and one wishlist ("wishlist") matched by set number.
 *
 * Safety: nothing is changed unless both tabs download and parse cleanly, and
 * a sync never empties everything because of an empty download.
 */
import type { BrickfolioStatus } from '../../shared/types';
import { DEFAULT_PREFERENCES } from '../../shared/constants';
import { db } from '../storage';
import type { BrickfolioLinkRecord, CatalogCacheRecord, CatalogSet, UserRecord } from '../records';
import { safeFetchBytes, UnsafeUrlError } from '../services/safeFetch';
import { now, sha256 } from '../util';
import { SyncError, bricksetCatalogSet, buildDesired, parseSheet, pickCatalogSets, type DesiredState, type ImageManifest } from './brickfolioData';
import { applyMirror, disconnectProvider, getLink, requireIntegrationAccess, runSync, saveLink, syncEveryone, type SyncOptions } from './mirror';

export { requireIntegrationAccess };

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

export function getBrickfolioLink(userId: string): Promise<BrickfolioLinkRecord | null> {
  return getLink(userId, 'brickfolio');
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
  await saveLink(user.id, 'brickfolio', {
    siteUrl: new URL(input.siteUrl).origin,
    fullSetsCsvUrl: input.fullSetsCsvUrl,
    wishlistCsvUrl: input.wishlistCsvUrl,
  });
  return syncBrickfolio(user);
}

/** Stop syncing. The lists and sets stay, as ordinary editable items. */
export function disconnectBrickfolio(user: UserRecord): Promise<void> {
  return disconnectProvider(user, 'brickfolio');
}

/**
 * Pull the sheet and mirror it. With `ifStale`, does nothing when the last
 * sync was recent or another sync is running (used when a linked list opens).
 */
export async function syncBrickfolio(user: UserRecord, opts: SyncOptions = {}): Promise<{ status: BrickfolioStatus; changed: boolean }> {
  const { link, changed } = await runSync(user, 'brickfolio', opts, async (rec) => {
    const desired = await download(rec, user.preferences?.currency ?? DEFAULT_PREFERENCES.currency);
    return apply(user, rec, desired);
  });
  return { status: toStatus(link), changed };
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

const listArt = (tab: 'full_sets' | 'wishlist') => ({
  title: tab === 'full_sets' ? 'LEGO Collection' : 'LEGO Wishlist',
  description: 'Synced from my Brickfolio sheet.',
  kind: tab === 'full_sets' ? ('collection' as const) : ('wishlist' as const),
  visibility: 'private' as const,
  accentColor: '#b8862d',
  coverArt: { icon: 'brick' as const, backdrop: tab === 'full_sets' ? ('blush' as const) : ('sky' as const) },
});

async function apply(user: UserRecord, rec: BrickfolioLinkRecord, desired: DesiredState) {
  const { result, listIds } = await applyMirror(
    user,
    'brickfolio',
    desired.sets,
    [
      { tab: 'full_sets', id: rec.collectionId, keys: desired.collection, create: listArt('full_sets') },
      { tab: 'wishlist', id: rec.wishlistId, keys: desired.wishlist, create: listArt('wishlist') },
    ],
    'Both sheet tabs came back empty, so nothing was changed. If you really cleared them, disconnect Brickfolio in Settings instead.',
  );
  for (const d of desired.sets.values()) if (!d.inCatalog) result.notInCatalog.push(d.key);
  return { result, collectionId: listIds[0], wishlistId: listIds[1] };
}

/** Hourly: every connected account that's still allowed. */
export function syncAllBrickfolio(): Promise<{ synced: number; failed: number }> {
  return syncEveryone('brickfolio', async (user) => (await syncBrickfolio(user, { skipRateLimit: true })).status);
}
