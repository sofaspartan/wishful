/**
 * Playshelf sync: Playshelf stays the source of truth. Wishful reads the same
 * Supabase tables the Playshelf site reads in the browser (with its public
 * anon key, so only libraries set to public are visible) and mirrors the
 * library into a "Video Game Collection" and the wishlist into a
 * "Video Game Wishlist", matched by RAWG game id.
 *
 * Safety: nothing is changed unless every table downloads and parses, and an
 * empty download never empties lists that were synced before.
 */
import type { PlayshelfStatus } from '../../shared/types';
import type { WishlistCreateInput } from '../../shared/schemas';
import { DEFAULT_PREFERENCES } from '../../shared/constants';
import { badRequest } from '../http';
import type { PlayshelfLinkRecord, UserRecord } from '../records';
import { safeFetchBytes, UnsafeUrlError } from '../services/safeFetch';
import { applyMirror, disconnectProvider, getLink, requireIntegrationAccess, runSync, saveLink, syncEveryone, type SyncOptions } from './mirror';
import { buildPlayshelfDesired, parseRows } from './playshelfData';
import { SyncError } from './syncTypes';

interface PlayshelfConfig {
  /** Supabase project origin, e.g. https://abcd.supabase.co */
  api: string;
  /** The project's public anon key (the same one Playshelf's pages use). */
  key: string;
  /** Playshelf site origin, for profile links. */
  site: string | null;
}

const httpsOrigin = (raw: string | undefined): string | null => {
  try {
    const u = new URL((raw ?? '').trim());
    return u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
};

function config(): PlayshelfConfig | null {
  const api = httpsOrigin(process.env.PLAYSHELF_SUPABASE_URL);
  const key = (process.env.PLAYSHELF_SUPABASE_ANON_KEY ?? '').trim();
  return api && key ? { api, key, site: httpsOrigin(process.env.PLAYSHELF_SITE_URL) } : null;
}

export function getPlayshelfLink(userId: string): Promise<PlayshelfLinkRecord | null> {
  return getLink(userId, 'playshelf');
}

export function toPlayshelfStatus(rec: PlayshelfLinkRecord | null): PlayshelfStatus {
  const site = config()?.site ?? null;
  return {
    configured: Boolean(config()),
    connected: Boolean(rec),
    username: rec?.username ?? '',
    profileUrl: rec && site ? `${site}/profile/${encodeURIComponent(rec.username)}` : null,
    collectionId: rec?.collectionId ?? null,
    wishlistId: rec?.wishlistId ?? null,
    lastSyncAt: rec?.lastSyncAt ?? null,
    lastSuccessAt: rec?.lastSuccessAt ?? null,
    lastError: rec?.lastError ?? null,
    lastResult: rec?.lastResult ?? null,
  };
}

/** One PostgREST query against Playshelf's database. */
async function query(path: string, what: string): Promise<unknown> {
  const c = config();
  if (!c) throw new SyncError('Playshelf isn’t set up on this server yet (PLAYSHELF_SUPABASE_URL and PLAYSHELF_SUPABASE_ANON_KEY), so nothing was changed.');
  let res;
  try {
    res = await safeFetchBytes(`${c.api}/rest/v1/${path}`, {
      timeoutMs: 12_000,
      maxBytes: 8_000_000,
      maxRedirects: 2,
      headers: {
        'user-agent': 'WishfulSync/1.0',
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate, br',
        apikey: c.key,
        authorization: `Bearer ${c.key}`,
      },
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw new SyncError(`The Playshelf database address isn’t allowed: ${err.message}`);
    if (err instanceof Error && err.message === 'Response too large') throw new SyncError(`Your Playshelf ${what} is larger than expected, so nothing was changed.`);
    throw new SyncError('Couldn’t reach Playshelf. It may be down; nothing was changed.');
  }
  if (res.status === 401 || res.status === 403) throw new SyncError('Playshelf turned the request away. Check the PLAYSHELF_SUPABASE_ANON_KEY setting; nothing was changed.');
  if (res.status !== 200) throw new SyncError(`Playshelf answered with an error (${res.status}) while reading your ${what}; nothing was changed.`);
  try {
    return JSON.parse(new TextDecoder('utf-8').decode(res.body));
  } catch {
    throw new SyncError(`Playshelf sent something unexpected for your ${what}, so nothing was changed.`);
  }
}

interface Profile {
  id: string;
  username: string;
}

const profiles = (body: unknown): Profile[] =>
  Array.isArray(body)
    ? body
        .map((p) => p as Record<string, unknown>)
        .filter((p) => typeof p.id === 'string' && typeof p.username === 'string')
        .map((p) => ({ id: p.id as string, username: p.username as string }))
    : [];

/** Public profiles only: Playshelf's own rules hide private ones from the anon key. */
async function findProfile(username: string): Promise<Profile | null> {
  const body = await query(`profiles?select=id,username&username=ilike.${encodeURIComponent(username)}&limit=20`, 'profile');
  return profiles(body).find((p) => p.username.toLowerCase() === username.toLowerCase()) ?? null;
}

export async function connectPlayshelf(user: UserRecord, input: { username: string }): Promise<{ status: PlayshelfStatus; changed: boolean }> {
  requireIntegrationAccess(user);
  if (!config()) throw badRequest('Playshelf isn’t set up on this server yet. Add PLAYSHELF_SUPABASE_URL and PLAYSHELF_SUPABASE_ANON_KEY to the site’s environment variables.');
  let profile: Profile | null;
  try {
    profile = await findProfile(input.username);
  } catch (err) {
    if (err instanceof SyncError) throw badRequest(err.message);
    throw err;
  }
  if (!profile) {
    const message = 'No public Playshelf profile has that username. Check the spelling, and that Library Visibility is set to public on your Playshelf profile.';
    throw badRequest(message, { username: message });
  }
  await saveLink(user.id, 'playshelf', { profileId: profile.id, username: profile.username });
  return syncPlayshelf(user);
}

export function disconnectPlayshelf(user: UserRecord): Promise<void> {
  return disconnectProvider(user, 'playshelf');
}

const listArt = (tab: 'library' | 'wishlist'): WishlistCreateInput => ({
  title: tab === 'library' ? 'Video Game Collection' : 'Video Game Wishlist',
  description: `Synced from my Playshelf ${tab}.`,
  kind: tab === 'library' ? 'collection' : 'wishlist',
  visibility: 'private',
  accentColor: '#7a4f8f',
  coverArt: { icon: 'controller', backdrop: tab === 'library' ? 'night' : 'lilac' },
});

/**
 * Pull the library and wishlist and mirror them. With `ifStale`, does nothing
 * when the last sync was recent or another sync is running.
 */
export async function syncPlayshelf(user: UserRecord, opts: SyncOptions = {}): Promise<{ status: PlayshelfStatus; changed: boolean }> {
  const { link, changed } = await runSync(user, 'playshelf', opts, async (rec) => {
    const id = encodeURIComponent(rec.profileId);
    const [profileBody, libraryBody, wishlistBody] = await Promise.all([
      query(`profiles?select=id,username&id=eq.${id}`, 'profile'),
      query(`game_library?select=*&user_id=eq.${id}&limit=2000`, 'library'),
      query(`wishlist?select=*&user_id=eq.${id}&limit=2000`, 'wishlist'),
    ]);
    const profile = profiles(profileBody)[0];
    if (!profile) {
      throw new SyncError('Your Playshelf library isn’t public any more (or the account is gone), so nothing was changed. Set Library Visibility back to public on your Playshelf profile, or disconnect it here.');
    }
    if (profile.username !== rec.username) await saveLink(user.id, 'playshelf', { profileId: rec.profileId, username: profile.username });

    const desired = buildPlayshelfDesired(parseRows(libraryBody, 'library'), parseRows(wishlistBody, 'wishlist'), user.preferences?.currency ?? DEFAULT_PREFERENCES.currency);
    const { result, listIds } = await applyMirror(
      user,
      'playshelf',
      desired.items,
      [
        { tab: 'library', id: rec.collectionId, keys: desired.library, create: listArt('library') },
        { tab: 'wishlist', id: rec.wishlistId, keys: desired.wishlist, create: listArt('wishlist'), lazy: true, priorities: desired.priorities, notes: desired.notes },
      ],
      'Your Playshelf library and wishlist both came back empty, so nothing was changed. If you really cleared them, disconnect Playshelf in Settings instead.',
    );
    return { result, collectionId: listIds[0], wishlistId: listIds[1] };
  });
  return { status: toPlayshelfStatus(link), changed };
}

/** Hourly: every connected account that's still allowed. */
export function syncAllPlayshelf(): Promise<{ synced: number; failed: number }> {
  if (!config()) return Promise.resolve({ synced: 0, failed: 0 });
  return syncEveryone('playshelf', async (user) => (await syncPlayshelf(user, { skipRateLimit: true })).status);
}
