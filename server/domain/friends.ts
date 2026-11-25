import type { FriendProfileView, FriendsOverview, PeopleSearchHit, Visibility } from '../../shared/types';
import { isDiscoverableProfile } from '../../shared/constants';
import { profileVisibilityOf } from '../../shared/profileVisibility';
import { atomicUpdate, db, getMany } from '../storage';
import { badRequest, conflict, notFound } from '../http';
import type { FriendIndex, FriendshipRecord, UserRecord } from '../records';
import { toPublicUser } from '../serialize';
import { nowIso } from '../util';
import { getUsers, isListRecipient, listOwnedWishlists, listSharedWishlists, publicPeople, resolveRecipients } from './wishlists';

/** Friends + pending requests (either direction) a single user can have on record. */
export const MAX_FRIEND_RECORDS = 1000;

/** Lists a friend can browse. Unlisted lists stay link-only, even for friends. */
const FRIEND_VISIBLE: ReadonlySet<Visibility> = new Set(['friends', 'public']);

export const pairKey = (a: string, b: string) => (a < b ? `${a}.${b}` : `${b}.${a}`);

export async function getFriendship(a: string, b: string): Promise<FriendshipRecord | null> {
  if (a === b) return null;
  const res = await db('friendships').get<FriendshipRecord>(pairKey(a, b));
  return res?.value ?? null;
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  return (await getFriendship(a, b))?.status === 'accepted';
}

async function friendIds(userId: string): Promise<string[]> {
  return (await db('friend-index').get<FriendIndex>(userId))?.value.ids ?? [];
}

/**
 * Bring both users' listing indexes in line with the pair record as it exists
 * right now. Re-reading the record (rather than trusting the caller) means the
 * last writer always leaves the indexes consistent, even under races.
 */
async function syncIndexes(a: string, b: string): Promise<void> {
  const exists = (await getFriendship(a, b)) !== null;
  const apply = (self: string, other: string) =>
    atomicUpdate<FriendIndex>(db('friend-index'), self, (current) => {
      const ids = (current?.ids ?? []).filter((id) => id !== other);
      const notes = { ...(current?.notes ?? {}) };
      if (exists) ids.unshift(other);
      else delete notes[other];
      return { ids, notes: Object.keys(notes).length ? notes : undefined };
    });
  await Promise.all([apply(a, b), apply(b, a)]);
}

async function friendIndex(userId: string): Promise<FriendIndex> {
  return (await db('friend-index').get<FriendIndex>(userId))?.value ?? { ids: [] };
}

/** Circle note wins when the friend is linked in My Circle; otherwise the friendship note. */
async function resolveFriendNote(ownerId: string, friendId: string): Promise<{ note: string; circlePersonId: string | null }> {
  const circle = (await db('circle').get<{ people: { id: string; userId: string | null; note: string }[] }>(ownerId))?.value;
  const linked = circle?.people.find((p) => p.userId === friendId);
  if (linked) return { note: linked.note ?? '', circlePersonId: linked.id };
  const idx = await friendIndex(ownerId);
  return { note: idx.notes?.[friendId] ?? '', circlePersonId: null };
}

export type RequestOutcome = 'requested' | 'already_requested' | 'accepted';

/**
 * Send a friend request. If the other person already asked us, this accepts
 * their request instead of creating a second one.
 */
export async function sendFriendRequest(from: UserRecord, to: UserRecord): Promise<RequestOutcome> {
  if (from.id === to.id) throw badRequest("You can't add yourself as a friend.");
  const existing = await getFriendship(from.id, to.id);
  if (!existing) {
    const [mine, theirs] = await Promise.all([friendIds(from.id), friendIds(to.id)]);
    if (mine.length >= MAX_FRIEND_RECORDS) throw conflict("You've reached the friend limit.", 'friend_limit');
    if (theirs.length >= MAX_FRIEND_RECORDS) throw conflict("This person can't accept new friends right now.", 'friend_limit');
  }

  let outcome: RequestOutcome = 'requested';
  await atomicUpdate<FriendshipRecord>(db('friendships'), pairKey(from.id, to.id), (current) => {
    if (!current) {
      outcome = 'requested';
      return {
        users: [from.id, to.id].sort() as [string, string],
        requesterId: from.id,
        status: 'pending',
        createdAt: nowIso(),
        acceptedAt: null,
      };
    }
    if (current.status === 'accepted') throw conflict("You're already friends.", 'already_friends');
    if (current.requesterId === from.id) {
      outcome = 'already_requested';
      return current;
    }
    outcome = 'accepted';
    return { ...current, status: 'accepted', acceptedAt: nowIso() };
  });
  await syncIndexes(from.id, to.id);
  return outcome;
}

/** Accept a pending request that `requesterId` sent to `user`. */
export async function acceptFriendRequest(user: UserRecord, requesterId: string): Promise<void> {
  if (!(await getFriendship(user.id, requesterId))) throw notFound('That friend request no longer exists.');
  await atomicUpdate<FriendshipRecord>(db('friendships'), pairKey(user.id, requesterId), (current) => {
    if (!current || current.status !== 'pending' || current.requesterId !== requesterId) {
      throw notFound('That friend request no longer exists.');
    }
    return { ...current, status: 'accepted', acceptedAt: nowIso() };
  });
  await syncIndexes(user.id, requesterId);
}

/**
 * Remove the relationship between two users. `expect` keeps the endpoints
 * honest: declining/cancelling only touches pending requests, unfriending only
 * touches accepted friendships.
 */
export async function removeFriendship(userId: string, otherId: string, expect: 'pending' | 'accepted'): Promise<void> {
  const current = await getFriendship(userId, otherId);
  if (!current || current.status !== expect) {
    throw notFound(expect === 'pending' ? 'That friend request no longer exists.' : "You aren't friends with this person.");
  }
  await db('friendships').delete(pairKey(userId, otherId));
  await syncIndexes(userId, otherId);
}

export async function friendsOverview(userId: string): Promise<FriendsOverview> {
  const ids = await friendIds(userId);
  const [records, idx, circle] = await Promise.all([
    getMany<FriendshipRecord>(
      db('friendships'),
      ids.map((id) => pairKey(userId, id)),
    ),
    friendIndex(userId),
    db('circle').get<{ people: { id: string; userId: string | null; note: string }[] }>(userId),
  ]);
  const circleByUser = new Map(
    (circle?.value.people ?? []).filter((p) => p.userId).map((p) => [p.userId!, p.note ?? ''] as const),
  );
  const otherOf = (r: FriendshipRecord) => (r.users[0] === userId ? r.users[1] : r.users[0]);
  const users = new Map(
    (
      await getMany<UserRecord>(
        db('users'),
        records.map((r) => otherOf(r)),
      )
    ).map((u) => [u.id, toPublicUser(u)]),
  );

  const overview: FriendsOverview = { friends: [], incoming: [], outgoing: [] };
  for (const r of records) {
    const otherId = otherOf(r);
    const user = users.get(otherId);
    if (!user) continue;
    if (r.status === 'accepted') {
      const note = circleByUser.has(otherId) ? (circleByUser.get(otherId) ?? '') : (idx.notes?.[otherId] ?? '');
      overview.friends.push({ user, since: r.acceptedAt ?? r.createdAt, note });
    } else if (r.requesterId === userId) overview.outgoing.push({ user, createdAt: r.createdAt });
    else overview.incoming.push({ user, createdAt: r.createdAt });
  }
  overview.friends.sort((a, b) => a.user.displayName.localeCompare(b.user.displayName));
  overview.incoming.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  overview.outgoing.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return overview;
}

const SEARCH_LIMIT = 12;
const SEARCH_SCAN = 80;

/**
 * Find people by username prefix (and a few display-name matches among those).
 * Private profiles never appear; public and friends profiles do.
 */
export async function searchPeople(viewerId: string, rawQuery: string): Promise<PeopleSearchHit[]> {
  const q = rawQuery.trim().toLowerCase().replace(/^@/, '');
  if (q.length < 2) return [];

  const keys = (await db('username-index').list(q)).slice(0, SEARCH_SCAN);
  if (!keys.length) return [];

  const indexHits = await Promise.all(keys.map((username) => db('username-index').get<{ userId: string }>(username)));
  const userIds = [...new Set(indexHits.map((h) => h?.value.userId).filter((id): id is string => Boolean(id)))];
  const users = await getMany<UserRecord>(db('users'), userIds);
  const overview = await friendsOverview(viewerId);
  const friendIds = new Set(overview.friends.map((f) => f.user.id));
  const outgoing = new Set(overview.outgoing.map((f) => f.user.id));
  const incoming = new Set(overview.incoming.map((f) => f.user.id));

  const hits: PeopleSearchHit[] = [];
  for (const u of users) {
    const visibility = profileVisibilityOf(u);
    if (!isDiscoverableProfile(visibility)) continue;
    const usernameHit = u.username.toLowerCase().startsWith(q);
    const nameHit = u.displayName.toLowerCase().includes(q);
    if (!usernameHit && !nameHit) continue;
    const isSelf = u.id === viewerId;
    hits.push({
      user: toPublicUser(u),
      profileVisibility: visibility,
      relationship: isSelf
        ? 'self'
        : friendIds.has(u.id)
          ? 'friends'
          : outgoing.has(u.id)
            ? 'outgoing'
            : incoming.has(u.id)
              ? 'incoming'
              : 'none',
    });
    if (hits.length >= SEARCH_LIMIT) break;
  }

  hits.sort((a, b) => {
    if (a.relationship === 'self') return -1;
    if (b.relationship === 'self') return 1;
    const aExact = a.user.username === q ? 0 : a.user.username.startsWith(q) ? 1 : 2;
    const bExact = b.user.username === q ? 0 : b.user.username.startsWith(q) ? 1 : 2;
    if (aExact !== bExact) return aExact - bExact;
    return a.user.displayName.localeCompare(b.user.displayName);
  });
  return hits;
}

/** A friend's profile: the lists they've chosen to show friends, and the ones other people made for them. Non-friends get a 404. */
export async function friendProfile(viewerId: string, friendId: string): Promise<FriendProfileView> {
  const rel = await getFriendship(viewerId, friendId);
  const friend = rel?.status === 'accepted' ? (await db('users').get<UserRecord>(friendId))?.value : null;
  if (!rel || !friend) throw notFound("You can only see the lists of people you're friends with.");
  const madeFor = (await listSharedWishlists(friend.id)).filter((w) => isListRecipient(w, friend.id));
  const lists = [...(await listOwnedWishlists(friend.id)), ...madeFor].filter((w) => FRIEND_VISIBLE.has(w.visibility) && !w.archivedAt && w.shareToken);
  const [recipients, makers, noteInfo] = await Promise.all([
    resolveRecipients(lists),
    getUsers(madeFor.map((w) => w.ownerId)),
    resolveFriendNote(viewerId, friendId),
  ]);
  return {
    user: { ...toPublicUser(friend), bio: friend.bio },
    since: rel.acceptedAt ?? rel.createdAt,
    note: noteInfo.note,
    circlePersonId: noteInfo.circlePersonId,
    wishlists: lists.map((w) => ({
      id: w.id,
      kind: w.kind ?? 'wishlist',
      title: w.title,
      description: w.description,
      coverImage: w.coverImage,
      coverArt: w.coverArt ?? null,
      accentColor: w.accentColor,
      occasion: w.occasion,
      eventDate: w.eventDate,
      visibility: w.visibility,
      shareToken: w.shareToken!,
      itemCount: w.entries.length,
      updatedAt: w.updatedAt,
      recipients: publicPeople(recipients.get(w.id) ?? []),
      madeBy: w.ownerId === friend.id ? null : (makers.get(w.ownerId) ?? null),
    })),
  };
}

/**
 * Save a private reminder about a friend. When they're linked in My Circle,
 * the Circle note is the source of truth; otherwise the note lives on the
 * owner's friend index (never visible to the friend).
 */
export async function setFriendNote(ownerId: string, friendId: string, note: string): Promise<FriendProfileView> {
  if (!(await areFriends(ownerId, friendId))) {
    throw notFound("You aren't friends with this person.");
  }
  const linked = await resolveFriendNote(ownerId, friendId);
  if (linked.circlePersonId) {
    const { updateCirclePerson } = await import('./circle');
    await updateCirclePerson(ownerId, linked.circlePersonId, { note });
  } else {
    await atomicUpdate<FriendIndex>(db('friend-index'), ownerId, (current) => {
      const ids = current?.ids ?? [];
      if (!ids.includes(friendId)) throw notFound("You aren't friends with this person.");
      const notes = { ...(current?.notes ?? {}) };
      const trimmed = note.trim();
      if (trimmed) notes[friendId] = trimmed;
      else delete notes[friendId];
      return { ids, notes: Object.keys(notes).length ? notes : undefined };
    });
  }
  return friendProfile(ownerId, friendId);
}

/** Account deletion: drop every friendship and request involving this user. */
export async function deleteAllFriendships(userId: string): Promise<void> {
  for (const other of await friendIds(userId)) {
    await db('friendships').delete(pairKey(userId, other));
    await syncIndexes(userId, other).catch(() => undefined);
  }
  await db('friend-index').delete(userId);
}
