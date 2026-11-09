import path from 'node:path';
import { createFsDriver } from './fs';
import { createMemoryDriver } from './memory';
import { createNetlifyDriver } from './netlify';
import type { JsonStore, StorageDriver } from './types';
import { HttpError } from '../http';

export type { JsonStore, StorageDriver } from './types';

let driver: StorageDriver | null = null;

function detectDriver(): StorageDriver {
  const explicit = process.env.STORAGE_DRIVER?.trim();
  const onNetlify = Boolean(
    globalThis.netlifyBlobsContext || process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY || process.env.SITE_ID,
  );
  const choice = explicit || (onNetlify ? 'netlify' : 'fs');
  switch (choice) {
    case 'netlify':
      return createNetlifyDriver();
    case 'memory':
      return createMemoryDriver();
    case 'fs':
      return createFsDriver(path.resolve(process.env.DATA_DIR || '.data'));
    default:
      throw new Error(`Unknown STORAGE_DRIVER "${choice}"`);
  }
}

export function getDriver(): StorageDriver {
  if (!driver) driver = detectDriver();
  return driver;
}

/** Test hook: swap the active driver (e.g. a fresh in-memory store per test). */
export function setDriver(next: StorageDriver | null) {
  driver = next;
}

export const isLocalDev = () => getDriver().name !== 'netlify';

/**
 * Logical collections. Each is a separate Netlify Blobs store so data is easy
 * to inspect in the Netlify UI.
 *
 *   users          users/{userId}                 → UserRecord
 *   email-index    {sha256(email)}                → { userId }      (unique)
 *   username-index {username}                     → { userId }      (unique)
 *   sessions       {sha256(token)}                → SessionRecord
 *   user-index     {userId}                       → owned wishlist/item ids, shared list ids
 *   wishlists      {wishlistId}                   → WishlistRecord (entries + collaborators embedded)
 *   items          {itemId}                       → ItemRecord
 *   claims         {wishlistId}                   → ClaimsDoc (all claims + pledges for a list)
 *   shares         {shareToken}                   → ShareRecord
 *   resets         {sha256(token)}                → password reset record
 *   invites        {sha256(email)}                → pending collaborator invites
 *   notifications  {userId}                       → { items: Notification[] }
 *   ratelimits     {bucket}:{key}:{window}        → { count, expiresAt }
 *   friendships    {userIdA}.{userIdB} (sorted)   → FriendshipRecord (pending request or friends)
 *   friend-index   {userId}                       → { ids } of everyone with a friendship record
 */
export const COLLECTIONS = [
  'users',
  'email-index',
  'username-index',
  'sessions',
  'user-index',
  'wishlists',
  'items',
  'claims',
  'shares',
  'resets',
  'invites',
  'notifications',
  'ratelimits',
  'friendships',
  'friend-index',
] as const;
export type Collection = (typeof COLLECTIONS)[number];

export const db = (collection: Collection): JsonStore => getDriver().json(collection);
export const images = () => getDriver().binary('images');

/**
 * Optimistic-concurrency read-modify-write.
 *
 * Reads the document with its ETag, applies `mutate`, then writes back with
 * `onlyIfMatch` (or `onlyIfNew` when the document didn't exist). If another
 * writer got there first the write reports `modified: false` and we retry on
 * fresh data. `mutate` must be a pure function of its input (it can run more
 * than once) and may throw an HttpError to abort without writing.
 */
export async function atomicUpdate<T>(
  store: JsonStore,
  key: string,
  mutate: (current: T | null) => T,
  maxAttempts = 10,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const current = await store.get<T>(key);
    const draft = current ? (structuredClone(current.value) as T) : null;
    const next = mutate(draft);
    const res = await store.set(key, next, current ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
    if (res.modified) return next;
    await new Promise((r) => setTimeout(r, Math.random() * 25 * (attempt + 1)));
  }
  throw new HttpError(503, 'The server is busy, please try again.', 'conflict_retry');
}

/** Like `atomicUpdate`, but resolves to `null` (without writing) when the key doesn't exist. */
export async function atomicUpdateExisting<T>(
  store: JsonStore,
  key: string,
  mutate: (current: T) => T,
  maxAttempts = 10,
): Promise<T | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const current = await store.get<T>(key);
    if (!current) return null;
    const next = mutate(structuredClone(current.value) as T);
    const res = await store.set(key, next, { onlyIfMatch: current.etag });
    if (res.modified) return next;
    await new Promise((r) => setTimeout(r, Math.random() * 25 * (attempt + 1)));
  }
  throw new HttpError(503, 'The server is busy, please try again.', 'conflict_retry');
}

/** Fetch many keys in parallel with bounded concurrency; missing keys are skipped. */
export async function getMany<T>(store: JsonStore, keys: string[], concurrency = 24): Promise<T[]> {
  const results: (T | null)[] = new Array(keys.length).fill(null);
  let index = 0;
  const worker = async () => {
    while (index < keys.length) {
      const i = index++;
      const res = await store.get<T>(keys[i]);
      results[i] = res ? res.value : null;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, keys.length) }, worker));
  return results.filter((r): r is Awaited<T> => r !== null) as T[];
}
