/**
 * What every site sync shares: a per-site lock and status on the user's
 * integrations doc, and mirroring the source's items into linked lists
 * (add, update, remove, "moved to the collection", list membership).
 *
 * Only items and entries that came from the source are touched; anything the
 * user added to a linked list by hand is left alone.
 */
import { DEFAULT_PREFERENCES } from '../../shared/constants';
import type { WishlistCreateInput } from '../../shared/schemas';
import { SYNC_PROVIDER_NAMES, type ItemSource, type ListLink, type Priority, type SyncProvider, type SyncResult } from '../../shared/types';
import { atomicUpdate, atomicUpdateExisting, db } from '../storage';
import { conflict, notFound, HttpError } from '../http';
import type { IntegrationsDoc, ItemRecord, SyncLinkState, UserRecord, WishlistRecord } from '../records';
import { updateUserIndex } from '../services/auth';
import { rateLimit } from '../services/rateLimit';
import { newId, now, nowIso } from '../util';
import { createWishlist, getWishlist, linkItems, listOwnedWishlists, mutateWishlist, unlinkItems, MAX_ENTRIES_PER_LIST } from '../domain/wishlists';
import { deleteItem, listOwnedItems, mergeOwnership, newEntry } from '../domain/items';
import { clearEntryActivity } from '../domain/claims';
import { integrationsAllowed } from './access';
import { SyncError, type DesiredItem } from './syncTypes';

const STALE_MS = 15 * 60_000;
const LOCK_MS = 2 * 60_000;

export type LinkOf<P extends SyncProvider> = NonNullable<IntegrationsDoc[P]>;
type LinkMap = Partial<Record<SyncProvider, SyncLinkState>>;

export function requireIntegrationAccess(user: UserRecord): void {
  // A 404 keeps the feature invisible to everyone else.
  if (!integrationsAllowed(user.email)) throw notFound('Not found.');
}

export async function getLink<P extends SyncProvider>(userId: string, provider: P): Promise<LinkOf<P> | null> {
  return ((await db('integrations').get<IntegrationsDoc>(userId))?.value[provider] as LinkOf<P> | undefined) ?? null;
}

/** Create or replace a site's connection details, keeping its lists and sync history. */
export async function saveLink<P extends SyncProvider>(userId: string, provider: P, details: Omit<LinkOf<P>, keyof SyncLinkState>): Promise<void> {
  await atomicUpdate<IntegrationsDoc>(db('integrations'), userId, (doc) => {
    const links = (doc ?? {}) as LinkMap;
    const current = links[provider];
    const state: SyncLinkState = {
      collectionId: current?.collectionId ?? null,
      wishlistId: current?.wishlistId ?? null,
      connectedAt: current?.connectedAt ?? nowIso(),
      lastSyncAt: current?.lastSyncAt ?? null,
      lastSuccessAt: current?.lastSuccessAt ?? null,
      lastError: null,
      lastResult: current?.lastResult ?? null,
      syncLockUntil: current?.syncLockUntil ?? null,
    };
    return { ...links, [provider]: { ...state, ...details } } as IntegrationsDoc;
  });
}

async function acquireLock<P extends SyncProvider>(userId: string, provider: P): Promise<LinkOf<P>> {
  const t = now().getTime();
  const doc = await atomicUpdate<IntegrationsDoc>(db('integrations'), userId, (current) => {
    const link = (current as LinkMap | null)?.[provider];
    if (!current || !link) throw notFound(`${SYNC_PROVIDER_NAMES[provider]} isn’t connected.`);
    if (link.syncLockUntil && Date.parse(link.syncLockUntil) > t) throw conflict('A sync is already running. Try again in a moment.', 'sync_running');
    link.syncLockUntil = new Date(t + LOCK_MS).toISOString();
    return current;
  });
  return doc[provider] as LinkOf<P>;
}

async function finish<P extends SyncProvider>(userId: string, provider: P, patch: Partial<SyncLinkState>): Promise<LinkOf<P> | null> {
  const doc = await atomicUpdate<IntegrationsDoc>(db('integrations'), userId, (current) => {
    const links = current as LinkMap | null;
    // Disconnected while syncing: leave it disconnected.
    if (!links?.[provider]) return current ?? {};
    links[provider] = { ...links[provider]!, ...patch, syncLockUntil: null };
    return current!;
  });
  return (doc[provider] as LinkOf<P> | undefined) ?? null;
}

export interface SyncOptions {
  /** Do nothing when the last sync was recent or another is running (used when a linked list opens). */
  ifStale?: boolean;
  skipRateLimit?: boolean;
}

/**
 * Lock, rate-limit, run `work`, record the outcome. Problems the user can fix
 * (`SyncError`) come back as `lastError`; nothing is changed when `work` throws.
 */
export async function runSync<P extends SyncProvider>(
  user: UserRecord,
  provider: P,
  opts: SyncOptions,
  work: (link: LinkOf<P>) => Promise<{ result: SyncResult; collectionId: string | null; wishlistId: string | null }>,
): Promise<{ link: LinkOf<P> | null; changed: boolean }> {
  requireIntegrationAccess(user);
  const name = SYNC_PROVIDER_NAMES[provider];
  const existing = await getLink(user.id, provider);
  if (!existing) throw notFound(`${name} isn’t connected.`);
  if (opts.ifStale && existing.lastSyncAt && now().getTime() - Date.parse(existing.lastSyncAt) < STALE_MS) {
    return { link: existing, changed: false };
  }

  let link: LinkOf<P>;
  try {
    link = await acquireLock(user.id, provider);
  } catch (err) {
    if (opts.ifStale && err instanceof HttpError && err.code === 'sync_running') return { link: existing, changed: false };
    throw err;
  }
  if (!opts.skipRateLimit) {
    try {
      await rateLimit('integrationSync', user.id);
    } catch (err) {
      await finish(user.id, provider, {});
      throw err;
    }
  }

  try {
    const outcome = await work(link);
    const r = outcome.result;
    const stamp = nowIso();
    const saved = await finish(user.id, provider, {
      collectionId: outcome.collectionId,
      wishlistId: outcome.wishlistId,
      lastSyncAt: stamp,
      lastSuccessAt: stamp,
      lastError: null,
      lastResult: r,
    });
    return { link: saved, changed: r.added + r.updated + r.removed + r.moved > 0 };
  } catch (err) {
    const message = err instanceof SyncError ? err.message : 'Something went wrong while syncing. Nothing else was changed; try again in a few minutes.';
    if (!(err instanceof SyncError)) console.error(`[${provider}] sync failed`, err);
    const saved = await finish(user.id, provider, { lastSyncAt: nowIso(), lastError: message });
    return { link: saved, changed: false };
  }
}

/** Stop syncing a site. Its lists and items stay, as ordinary editable ones. */
export async function disconnectProvider(user: UserRecord, provider: SyncProvider): Promise<void> {
  requireIntegrationAccess(user);
  await atomicUpdate<IntegrationsDoc>(db('integrations'), user.id, (doc) => {
    const { [provider]: _gone, ...rest } = (doc ?? {}) as LinkMap;
    return rest as IntegrationsDoc;
  });
  for (const item of await listOwnedItems(user.id)) {
    if (item.source?.provider !== provider) continue;
    await atomicUpdateExisting<ItemRecord>(db('items'), item.id, (current) => ({ ...current, source: null }));
  }
  for (const list of await listOwnedWishlists(user.id)) {
    if (list.link?.provider !== provider) continue;
    await mutateWishlist(list.id, (w) => {
      w.link = null;
    });
  }
}

/** Hourly: every account connected to this site that's still allowed. */
export async function syncEveryone(provider: SyncProvider, sync: (user: UserRecord) => Promise<{ lastError: string | null }>): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  for (const userId of await db('integrations').list()) {
    const doc = (await db('integrations').get<IntegrationsDoc>(userId))?.value;
    if (!doc?.[provider]) continue;
    const user = (await db('users').get<UserRecord>(userId))?.value;
    if (!user || !integrationsAllowed(user.email)) continue;
    try {
      const { lastError } = await sync(user);
      if (lastError) failed++;
      else synced++;
    } catch (err) {
      failed++;
      console.error(`[${provider}] scheduled sync failed`, err);
    }
  }
  return { synced, failed };
}

// ── Mirroring ───────────────────────────────────────────────────────────────

export interface MirrorList {
  tab: ListLink['tab'];
  /** The list's id from the last sync. */
  id: string | null;
  /** Item keys, top of the list first. */
  keys: string[];
  /** Used when the list has to be made (again). */
  create: WishlistCreateInput;
  /** Don't make the list until the source has something for it. */
  lazy?: boolean;
  /** Priority per key, kept up to date on the entry. */
  priorities?: Map<string, Priority | null>;
  /** Gift-giver note for entries the sync adds. */
  notes?: Map<string, string>;
}

async function ensureList(user: UserRecord, provider: SyncProvider, spec: MirrorList): Promise<WishlistRecord | null> {
  const current = spec.id ? await getWishlist(spec.id) : null;
  if (current && current.ownerId === user.id) {
    if (current.link?.provider === provider && current.link.tab === spec.tab) return current;
    return mutateWishlist(current.id, (w) => {
      w.link = { provider, tab: spec.tab };
    });
  }
  if (spec.lazy && spec.keys.length === 0) return null;
  const created = await createWishlist(user, spec.create);
  return mutateWishlist(created.id, (w) => {
    w.link = { provider, tab: spec.tab };
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

function withSynced(current: ItemRecord, d: DesiredItem, provider: SyncProvider, stamp: string): ItemRecord {
  const f = d.fields;
  const source: ItemSource = { provider, key: d.key, gallery: f.gallery, syncedAt: stamp };
  let owned = current.owned ?? null;
  if (d.owned) {
    const base = mergeOwnership(current.owned, {});
    // Something that just arrived from the wishlist side was got today.
    const acquiredOn = current.owned ? base.acquiredOn : current.createdAt === stamp ? null : stamp.slice(0, 10);
    owned = { ...base, acquiredOn, quantity: d.owned.quantity, rating: d.owned.rating, review: d.owned.review };
  } else {
    owned = null;
  }
  const metadata = { ...current.metadata };
  if (f.model) metadata.model = f.model;
  else delete metadata.model;
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
    metadata,
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

/**
 * Make the user's synced items and linked lists match `items` and `lists`.
 * Refuses (changing nothing) when the source came back empty but items were
 * synced before, or a list would overflow.
 */
export async function applyMirror(
  user: UserRecord,
  provider: SyncProvider,
  items: Map<string, DesiredItem>,
  lists: MirrorList[],
  emptyMessage: string,
): Promise<{ result: SyncResult; listIds: Array<string | null> }> {
  const stamp = nowIso();
  const synced = (await listOwnedItems(user.id)).filter((i) => i.source?.provider === provider);
  const byKey = new Map(synced.map((i) => [i.source!.key, i]));
  if (items.size === 0 && synced.length > 0) throw new SyncError(emptyMessage);
  if (lists.some((l) => l.keys.length > MAX_ENTRIES_PER_LIST)) {
    throw new SyncError(`A list can hold up to ${MAX_ENTRIES_PER_LIST} items, so there’s too much to sync.`);
  }

  const targets: Array<{ spec: MirrorList; list: WishlistRecord | null }> = [];
  for (const spec of lists) targets.push({ spec, list: await ensureList(user, provider, spec) });
  const result: SyncResult = { added: 0, updated: 0, removed: 0, moved: 0, notInCatalog: [] };

  // Gone from the source.
  for (const [key, item] of byKey) {
    if (items.has(key)) continue;
    await deleteItem(item);
    byKey.delete(key);
    result.removed++;
  }

  // New and changed.
  const idFor = new Map<string, string>();
  const created: ItemRecord[] = [];
  for (const d of items.values()) {
    const current = byKey.get(d.key);
    if (!current) {
      const listIds = targets.filter((t) => t.list && t.spec.keys.includes(d.key)).map((t) => t.list!.id);
      const item = { ...withSynced(blankItem(user, stamp), d, provider, stamp), wishlistIds: listIds };
      created.push(item);
      idFor.set(d.key, item.id);
      continue;
    }
    idFor.set(d.key, current.id);
    const next = withSynced(current, d, provider, stamp);
    if (snapshot(next) === snapshot(current)) continue;
    if (!current.owned && next.owned) result.moved++;
    else result.updated++;
    await atomicUpdateExisting<ItemRecord>(db('items'), current.id, (fresh) => ({ ...withSynced(fresh, d, provider, stamp), updatedAt: stamp }));
  }
  await Promise.all(created.map((item) => db('items').set(item.id, item, { onlyIfNew: true })));
  if (created.length) {
    await updateUserIndex(user.id, (idx) => {
      idx.itemIds.unshift(...created.map((i) => i.id));
    });
  }
  result.added = created.length;

  // List membership.
  const syncedIds = new Set(idFor.values());
  const createdIds = new Set(created.map((i) => i.id));
  for (const { spec, list } of targets) {
    if (!list) continue;
    const keyOf = new Map(spec.keys.map((k) => [idFor.get(k)!, k]));
    const want = spec.keys.map((k) => idFor.get(k)!).filter(Boolean);
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
      if (spec.priorities) {
        for (const e of w.entries) {
          const key = keyOf.get(e.itemId);
          if (key === undefined) continue;
          const priority = spec.priorities.get(key) ?? null;
          if (e.priority !== priority) {
            e.priority = priority;
            e.updatedAt = stamp;
          }
        }
      }
      const fresh = want.filter((id) => !present.has(id));
      w.entries.unshift(
        ...fresh.map((id) => {
          const key = keyOf.get(id)!;
          return newEntry(id, user.id, spec.priorities?.get(key) ?? null, spec.notes?.get(key) ?? '');
        }),
      );
      joining = fresh.filter((id) => !createdIds.has(id));
    });
    await clearEntryActivity(list.id, removedEntries);
    if (leaving.length) await unlinkItems(leaving, list.id);
    if (joining.length) await linkItems(joining, list.id);
  }

  return { result, listIds: targets.map((t) => t.list?.id ?? null) };
}
