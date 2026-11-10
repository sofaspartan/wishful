import type { FriendProfileView, FriendsOverview, Visibility } from '../../shared/types';
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
      if (exists) ids.unshift(other);
      return { ids };
    });
  await Promise.all([apply(a, b), apply(b, a)]);
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
  const records = await getMany<FriendshipRecord>(
    db('friendships'),
    ids.map((id) => pairKey(userId, id)),
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
    const user = users.get(otherOf(r));
    if (!user) continue;
    if (r.status === 'accepted') overview.friends.push({ user, since: r.acceptedAt ?? r.createdAt });
    else if (r.requesterId === userId) overview.outgoing.push({ user, createdAt: r.createdAt });
    else overview.incoming.push({ user, createdAt: r.createdAt });
  }
  overview.friends.sort((a, b) => a.user.displayName.localeCompare(b.user.displayName));
  overview.incoming.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  overview.outgoing.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return overview;
}

/** A friend's profile: the lists they've chosen to show friends, and the ones other people made for them. Non-friends get a 404. */
export async function friendProfile(viewerId: string, friendId: string): Promise<FriendProfileView> {
  const rel = await getFriendship(viewerId, friendId);
  const friend = rel?.status === 'accepted' ? (await db('users').get<UserRecord>(friendId))?.value : null;
  if (!rel || !friend) throw notFound("You can only see the lists of people you're friends with.");
  const madeFor = (await listSharedWishlists(friend.id)).filter((w) => isListRecipient(w, friend.id));
  const lists = [...(await listOwnedWishlists(friend.id)), ...madeFor].filter((w) => FRIEND_VISIBLE.has(w.visibility) && !w.archivedAt && w.shareToken);
  const [recipients, makers] = await Promise.all([resolveRecipients(lists), getUsers(madeFor.map((w) => w.ownerId))]);
  return {
    user: { ...toPublicUser(friend), bio: friend.bio },
    since: rel.acceptedAt ?? rel.createdAt,
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

/** Account deletion: drop every friendship and request involving this user. */
export async function deleteAllFriendships(userId: string): Promise<void> {
  for (const other of await friendIds(userId)) {
    await db('friendships').delete(pairKey(userId, other));
    await syncIndexes(userId, other).catch(() => undefined);
  }
  await db('friend-index').delete(userId);
}
