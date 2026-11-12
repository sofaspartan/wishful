import { LIMITS } from '../../shared/constants';
import type { CircleKind, CirclePerson } from '../../shared/types';
import { HttpError, badRequest, conflict, notFound } from '../http';
import type { CircleDoc, CirclePersonRecord, UserRecord, WishlistRecord } from '../records';
import { toPublicUser } from '../serialize';
import { atomicUpdate, db, getMany } from '../storage';
import { getUserIndex, updateUserIndex } from '../services/auth';
import { newId, nowIso } from '../util';
import { sendFriendRequest, type RequestOutcome } from './friends';
import { listOwnedWishlists, mutateWishlist } from './wishlists';

const emptyDoc = (): CircleDoc => ({ people: [] });

async function readDoc(userId: string): Promise<CircleDoc> {
  return (await db('circle').get<CircleDoc>(userId))?.value ?? emptyDoc();
}

function toView(person: CirclePersonRecord, linked?: { username: string; displayName: string } | null): CirclePerson {
  return {
    id: person.id,
    name: person.name,
    avatarUrl: person.avatarUrl,
    kind: person.kind,
    note: person.note,
    userId: person.userId,
    username: linked?.username ?? null,
    displayName: linked?.displayName ?? null,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  };
}

async function enrich(people: CirclePersonRecord[]): Promise<CirclePerson[]> {
  const ids = people.map((p) => p.userId).filter((id): id is string => Boolean(id));
  const users = ids.length
    ? new Map((await getMany<UserRecord>(db('users'), ids)).map((u) => [u.id, toPublicUser(u)]))
    : new Map();
  return people.map((p) => {
    const linked = p.userId ? users.get(p.userId) : undefined;
    return toView(p, linked ? { username: linked.username, displayName: linked.displayName } : null);
  });
}

export async function listCircle(userId: string): Promise<CirclePerson[]> {
  const doc = await readDoc(userId);
  const views = await enrich(doc.people);
  return views.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function createCirclePerson(
  userId: string,
  input: { name: string; avatarUrl?: string | null; kind?: CircleKind; note?: string },
): Promise<CirclePerson> {
  const stamp = nowIso();
  const person: CirclePersonRecord = {
    id: newId(),
    name: input.name.trim(),
    avatarUrl: input.avatarUrl ?? null,
    kind: input.kind ?? 'person',
    note: input.note?.trim() ?? '',
    userId: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await atomicUpdate<CircleDoc>(db('circle'), userId, (current) => {
    const people = current?.people ?? [];
    if (people.length >= LIMITS.circlePeople) {
      throw conflict(`My Circle can hold up to ${LIMITS.circlePeople} people.`, 'circle_limit');
    }
    return { people: [...people, person] };
  });
  return toView(person);
}

export async function updateCirclePerson(
  userId: string,
  personId: string,
  input: { name?: string; avatarUrl?: string | null; kind?: CircleKind; note?: string },
): Promise<CirclePerson> {
  let updated: CirclePersonRecord | null = null;
  await atomicUpdate<CircleDoc>(db('circle'), userId, (current) => {
    const people = current?.people ?? [];
    const idx = people.findIndex((p) => p.id === personId);
    if (idx < 0) throw notFound('That person isn’t in My Circle.');
    const prev = people[idx];
    updated = {
      ...prev,
      name: input.name !== undefined ? input.name.trim() : prev.name,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : prev.avatarUrl,
      kind: input.kind ?? prev.kind,
      note: input.note !== undefined ? input.note.trim() : prev.note,
      // Pets can’t stay linked to an account.
      userId: (input.kind ?? prev.kind) === 'pet' ? null : prev.userId,
      updatedAt: nowIso(),
    };
    const next = people.slice();
    next[idx] = updated;
    return { people: next };
  });
  if (!updated) throw notFound('That person isn’t in My Circle.');
  const [view] = await enrich([updated]);
  return view;
}

export async function deleteCirclePerson(userId: string, personId: string): Promise<void> {
  await atomicUpdate<CircleDoc>(db('circle'), userId, (current) => {
    const people = current?.people ?? [];
    if (!people.some((p) => p.id === personId)) throw notFound('That person isn’t in My Circle.');
    return { people: people.filter((p) => p.id !== personId) };
  });
}

export async function deleteCircle(userId: string): Promise<void> {
  await db('circle').delete(userId);
}

/**
 * For list create/update: create My Circle entries when `saveToCircle` is set,
 * and validate any `circlePersonId` belongs to the owner. Returns recipients
 * ready to store (with circlePersonId filled in).
 */
export async function resolveRecipientCircleIds(
  ownerId: string,
  input: Array<{
    name: string;
    avatarUrl?: string | null;
    userId?: string | null;
    canEdit?: boolean;
    circlePersonId?: string | null;
    saveToCircle?: boolean;
    circleKind?: CircleKind;
  }>,
): Promise<
  Array<{ name: string; avatarUrl: string | null; userId: string | null; canEdit?: boolean; circlePersonId: string | null }>
> {
  if (!input.length) return [];
  const stamp = nowIso();
  const createdIds: Array<string | null> = input.map(() => null);

  await atomicUpdate<CircleDoc>(db('circle'), ownerId, (current) => {
    const people = [...(current?.people ?? [])];
    const byId = new Map(people.map((p) => [p.id, p]));

    for (const [i, person] of input.entries()) {
      if (person.circlePersonId) {
        if (!byId.has(person.circlePersonId)) {
          throw badRequest('That My Circle person isn’t available.', {
            [`recipients.${i}.circlePersonId`]: 'Pick someone from My Circle.',
          });
        }
        continue;
      }
      if (!person.saveToCircle) continue;
      if (people.length >= LIMITS.circlePeople) {
        throw conflict(`My Circle can hold up to ${LIMITS.circlePeople} people.`, 'circle_limit');
      }
      const record: CirclePersonRecord = {
        id: newId(),
        name: person.name.trim(),
        avatarUrl: person.avatarUrl ?? null,
        kind: person.circleKind ?? 'person',
        note: '',
        userId: null,
        createdAt: stamp,
        updatedAt: stamp,
      };
      people.push(record);
      byId.set(record.id, record);
      createdIds[i] = record.id;
    }
    return { people };
  });

  return input.map((person, i) => ({
    name: person.name,
    avatarUrl: person.avatarUrl ?? null,
    userId: person.userId ?? null,
    canEdit: person.canEdit,
    circlePersonId: person.circlePersonId ?? createdIds[i] ?? null,
  }));
}

export type CircleLinkResult = {
  person: CirclePerson;
  friendStatus: RequestOutcome | 'already_friends';
  listsUpdated: number;
};

/**
 * Attach a Wishful account to a My Circle person: save the link, send a friend
 * request if needed, and share every owned list that already includes them.
 */
export async function linkCirclePerson(owner: UserRecord, personId: string, target: UserRecord): Promise<CircleLinkResult> {
  if (owner.id === target.id) throw badRequest("You can’t link My Circle to yourself.");

  let linked: CirclePersonRecord | null = null;
  await atomicUpdate<CircleDoc>(db('circle'), owner.id, (current) => {
    const people = current?.people ?? [];
    const idx = people.findIndex((p) => p.id === personId);
    if (idx < 0) throw notFound('That person isn’t in My Circle.');
    const prev = people[idx];
    if (prev.kind === 'pet') throw badRequest('Pet profiles can’t be linked to a Wishful account.');
    if (prev.userId && prev.userId !== target.id) {
      throw conflict('They’re already linked to another account. Unlink first.', 'already_linked');
    }
    linked = { ...prev, userId: target.id, updatedAt: nowIso() };
    const next = people.slice();
    next[idx] = linked;
    return { people: next };
  });
  if (!linked) throw notFound('That person isn’t in My Circle.');

  let friendStatus: RequestOutcome | 'already_friends' = 'requested';
  try {
    friendStatus = await sendFriendRequest(owner, target);
  } catch (err) {
    if (err instanceof HttpError && err.code === 'already_friends') friendStatus = 'already_friends';
    else throw err;
  }

  const lists = await listOwnedWishlists(owner.id);
  let listsUpdated = 0;
  for (const w of lists) {
    const match = (w.recipients ?? []).some((r) => r.circlePersonId === personId);
    if (!match) continue;
    await mutateWishlist(w.id, (draft) => {
      draft.recipients = (draft.recipients ?? []).map((r) =>
        r.circlePersonId === personId ? { ...r, userId: target.id, name: r.name || target.displayName } : r,
      );
      const existing = draft.collaborators.find((c) => c.userId === target.id);
      if (existing) return;
      draft.collaborators.push({ userId: target.id, role: 'viewer', addedAt: nowIso() });
    });
    await updateUserIndex(target.id, (idx) => {
      if (!idx.sharedWishlistIds.includes(w.id)) idx.sharedWishlistIds.unshift(w.id);
    });
    listsUpdated += 1;
  }

  const [person] = await enrich([linked]);
  return { person, friendStatus, listsUpdated };
}

export async function unlinkCirclePerson(userId: string, personId: string): Promise<CirclePerson> {
  let updated: CirclePersonRecord | null = null;
  await atomicUpdate<CircleDoc>(db('circle'), userId, (current) => {
    const people = current?.people ?? [];
    const idx = people.findIndex((p) => p.id === personId);
    if (idx < 0) throw notFound('That person isn’t in My Circle.');
    updated = { ...people[idx], userId: null, updatedAt: nowIso() };
    const next = people.slice();
    next[idx] = updated;
    return { people: next };
  });
  if (!updated) throw notFound('That person isn’t in My Circle.');
  return toView(updated);
}

/** True when a wishlist still references this circle person (for UI hints). */
export async function circlePersonListCount(ownerId: string, personId: string): Promise<number> {
  const idx = await getUserIndex(ownerId);
  const lists = await getMany<WishlistRecord>(db('wishlists'), idx.wishlistIds);
  return lists.filter((w) => (w.recipients ?? []).some((r) => r.circlePersonId === personId)).length;
}
