import type { AccessRole, ListPerson, ListTask, PublicUser, WishlistSummary } from '../../shared/types';
import {
  COLLECTION_SETTINGS,
  DEFAULT_PREFERENCES,
  ACCENT_COLORS,
  TASK_LIST_SETTINGS,
  defaultCoverArt,
  isCollection,
  isTaskList,
  listRowCount,
} from '../../shared/constants';
import type { TaskCreateInput, TaskUpdateInput, WishlistCreateInput } from '../../shared/schemas';
import { atomicUpdate, atomicUpdateExisting, db, getMany } from '../storage';
import { badRequest, conflict, forbidden, notFound } from '../http';
import type { ItemRecord, ShareRecord, UserRecord, WishlistRecord } from '../records';
import { getUserIndex, updateUserIndex } from '../services/auth';
import { deletedUser, toPublicUser } from '../serialize';
import { newId, newToken, nowIso } from '../util';

export const MAX_ENTRIES_PER_LIST = 1000;
export const MAX_TASKS_PER_LIST = 1000;

export async function getWishlist(id: string): Promise<WishlistRecord | null> {
  const res = await db('wishlists').get<WishlistRecord>(id);
  return res?.value ?? null;
}

export function mutateWishlist(id: string, mutate: (w: WishlistRecord) => void): Promise<WishlistRecord> {
  return atomicUpdate<WishlistRecord>(db('wishlists'), id, (current) => {
    if (!current) throw notFound('Wishlist not found.');
    mutate(current);
    current.updatedAt = nowIso();
    return current;
  });
}

/**
 * Authorization for logged-in access to a wishlist. Derived only from the
 * stored wishlist document and the session user — never from client input.
 */
export function accessRole(wishlist: WishlistRecord, userId: string | null | undefined): AccessRole | null {
  if (!userId) return null;
  if (wishlist.ownerId === userId) return 'owner';
  const collab = wishlist.collaborators.find((c) => c.userId === userId);
  return collab ? collab.role : null;
}

const RANK: Record<AccessRole, number> = { viewer: 0, editor: 1, owner: 2 };

/**
 * Load a wishlist and assert the user has at least `min` access. Users with no
 * access get a 404 (not 403) so private lists can't be probed for existence.
 */
export async function requireWishlistAccess(
  id: string,
  user: UserRecord,
  min: AccessRole,
): Promise<{ wishlist: WishlistRecord; role: AccessRole }> {
  const wishlist = await getWishlist(id);
  const role = wishlist ? accessRole(wishlist, user.id) : null;
  if (!wishlist || !role) throw notFound('Wishlist not found.');
  if (RANK[role] < RANK[min]) throw forbidden(min === 'owner' ? 'Only the owner can do that.' : 'You can only view this wishlist.');
  return { wishlist, role };
}

export async function getUsers(ids: string[]): Promise<Map<string, PublicUser>> {
  const unique = [...new Set(ids)];
  const users = await getMany<UserRecord>(db('users'), unique);
  const map = new Map<string, PublicUser>(users.map((u) => [u.id, toPublicUser(u)]));
  for (const id of unique) if (!map.has(id)) map.set(id, deletedUser(id));
  return map;
}

/** Whether this signed-in user is one of the people a list is made for. */
export const isListRecipient = (list: WishlistRecord, userId: string | null | undefined): boolean =>
  Boolean(userId) && (list.recipients ?? []).some((r) => r.userId === userId);

/** Someone who leaves a list made for them is no longer linked to it; it's still for them by name. */
export function unlinkRecipient(draft: WishlistRecord, userId: string): void {
  if (draft.recipients) draft.recipients = draft.recipients.map((r) => (r.userId === userId ? { ...r, userId: null } : r));
}

/** Who each list is made for, with photos filled in from a linked friend or My Circle when the list has none. Lists made for their owner map to an empty array. When `includeOwner` is set, the owner leads the group. */
export async function resolveRecipients(lists: WishlistRecord[]): Promise<Map<string, ListPerson[]>> {
  const linked = lists.flatMap((l) => (l.recipients ?? []).map((r) => r.userId)).filter((id): id is string => Boolean(id));
  const ownerIds = lists.filter((l) => l.includeOwner && (l.recipients?.length ?? 0) > 0).map((l) => l.ownerId);
  const users = linked.length || ownerIds.length ? await getUsers([...linked, ...ownerIds]) : new Map<string, PublicUser>();

  // My Circle photos: lists store a snapshot at create/edit time; fall back to the live circle entry when empty.
  const circleOwnerIds = [
    ...new Set(
      lists
        .filter((l) => (l.recipients ?? []).some((r) => r.circlePersonId && !r.avatarUrl))
        .map((l) => l.ownerId),
    ),
  ];
  const circleByOwner = new Map<string, Map<string, string | null>>();
  if (circleOwnerIds.length) {
    await Promise.all(
      circleOwnerIds.map(async (ownerId) => {
        const res = await db('circle').get<{ people: Array<{ id: string; avatarUrl: string | null }> }>(ownerId);
        const map = new Map<string, string | null>();
        for (const p of res?.value?.people ?? []) map.set(p.id, p.avatarUrl);
        circleByOwner.set(ownerId, map);
      }),
    );
  }

  const people = new Map<string, ListPerson[]>();
  for (const l of lists) {
    const circle = circleByOwner.get(l.ownerId);
    const others = (l.recipients ?? []).map((r) => {
      const linked = r.userId ? users.get(r.userId) : undefined;
      const fromCircle = r.circlePersonId ? circle?.get(r.circlePersonId) : undefined;
      return {
        name: r.name,
        avatarUrl: r.avatarUrl ?? linked?.avatarUrl ?? fromCircle ?? null,
        userId: r.userId,
        username: linked?.username ?? null,
      };
    });
    if (l.includeOwner && others.length) {
      const owner = users.get(l.ownerId);
      const full = owner?.displayName ?? 'Someone';
      const given = full.trim().split(/\s+/)[0] || full;
      people.set(l.id, [
        { name: given, avatarUrl: owner?.avatarUrl ?? null, userId: l.ownerId, username: owner?.username ?? null },
        ...others,
      ]);
    } else {
      people.set(l.id, others);
    }
  }
  return people;
}

export async function resolveListRecipients(list: WishlistRecord): Promise<ListPerson[]> {
  return (await resolveRecipients([list])).get(list.id) ?? [];
}

/** The people a list is for, without account ids — usernames stay so visitors can open public profiles. */
export const publicPeople = (people: ListPerson[]) =>
  people.map(({ name, avatarUrl, username }) => ({ name, avatarUrl, username: username ?? null }));

async function createShare(wishlistId: string): Promise<string> {
  const token = newToken();
  const record: ShareRecord = { wishlistId, createdAt: nowIso(), revokedAt: null };
  await db('shares').set(token, record, { onlyIfNew: true });
  return token;
}

export async function revokeShare(token: string | null): Promise<void> {
  if (!token) return;
  await atomicUpdateExisting<ShareRecord>(db('shares'), token, (s) => ({ ...s, revokedAt: s.revokedAt ?? nowIso() }));
}

/** Collections have no gifting: keep their gift-only fields neutral whatever the input said. */
export function applyCollectionRules(w: WishlistRecord): void {
  if (!isCollection(w)) return;
  w.surpriseMode = false;
  w.occasion = '';
  w.eventDate = null;
  w.cashFund = null;
  w.settings = { ...COLLECTION_SETTINGS, showReviews: w.settings?.showReviews ?? true };
  for (const e of w.entries) {
    e.groupGift = false;
    e.groupGiftNote = '';
  }
}

/** Standard / checklist / todo: text rows only, no gifting or catalog entries. */
export function applyTaskListRules(w: WishlistRecord): void {
  if (!isTaskList(w)) return;
  w.surpriseMode = false;
  w.occasion = '';
  w.eventDate = null;
  w.cashFund = null;
  w.recipients = undefined;
  w.includeOwner = undefined;
  w.settings = { ...TASK_LIST_SETTINGS, showReviews: w.settings?.showReviews ?? true };
  w.entries = [];
  if (!w.tasks) w.tasks = [];
  if (w.kind === 'list') {
    for (const t of w.tasks) {
      t.done = false;
      t.completedAt = null;
    }
  }
}

export async function createWishlist(owner: UserRecord, input: WishlistCreateInput): Promise<WishlistRecord> {
  const prefs = { ...DEFAULT_PREFERENCES, ...owner.preferences };
  const id = newId();
  const shareToken = await createShare(id);
  const stamp = nowIso();
  const kind = input.kind ?? 'wishlist';
  const wishlist: WishlistRecord = {
    id,
    ownerId: owner.id,
    kind,
    title: input.title,
    description: input.description ?? '',
    coverImage: input.coverImage ?? null,
    coverArt: input.coverArt !== undefined ? input.coverArt : input.coverImage ? null : defaultCoverArt(kind),
    pageBackdrop: input.pageBackdrop !== undefined ? input.pageBackdrop : 'match',
    pageColors: input.pageColors !== undefined ? input.pageColors : null,
    accentColor: input.accentColor ?? ACCENT_COLORS[0].value,
    visibility: input.visibility ?? prefs.defaultVisibility,
    occasion: input.occasion ?? '',
    eventDate: input.eventDate ?? null,
    shareToken,
    surpriseMode: input.surpriseMode ?? prefs.defaultSurpriseMode,
    settings: { ...DEFAULT_PREFERENCES.defaultSettings, ...prefs.defaultSettings, ...input.settings },
    archivedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    entries: [],
    tasks: isTaskList({ kind }) ? [] : undefined,
    collaborators: [],
    pendingInvites: [],
  };
  applyCollectionRules(wishlist);
  applyTaskListRules(wishlist);
  await db('wishlists').set(id, wishlist, { onlyIfNew: true });
  await updateUserIndex(owner.id, (idx) => {
    idx.wishlistIds.unshift(id);
  });
  return wishlist;
}

export async function addTask(wishlistId: string, userId: string, input: TaskCreateInput): Promise<ListTask> {
  const stamp = nowIso();
  const task: ListTask = {
    id: newId(),
    text: input.text,
    done: false,
    completedAt: null,
    addedBy: userId,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await mutateWishlist(wishlistId, (w) => {
    if (!isTaskList(w)) throw badRequest('Only lists, checklists, and to-dos use text rows.');
    if (!w.tasks) w.tasks = [];
    if (w.tasks.length >= MAX_TASKS_PER_LIST) throw badRequest(`This list can hold up to ${MAX_TASKS_PER_LIST} rows.`);
    w.tasks.push(task);
  });
  return task;
}

export async function updateTask(wishlistId: string, taskId: string, input: TaskUpdateInput): Promise<ListTask> {
  let updated: ListTask | null = null;
  await mutateWishlist(wishlistId, (w) => {
    if (!isTaskList(w)) throw badRequest('Only lists, checklists, and to-dos use text rows.');
    const task = (w.tasks ?? []).find((t) => t.id === taskId);
    if (!task) throw notFound('That row is no longer on this list.');
    if (input.text !== undefined) task.text = input.text;
    if (input.done !== undefined) {
      if (w.kind === 'list') throw badRequest('Regular lists don’t have checkboxes.');
      task.done = input.done;
      task.completedAt = input.done ? nowIso() : null;
    }
    task.updatedAt = nowIso();
    updated = { ...task };
  });
  return updated!;
}

export async function removeTask(wishlistId: string, taskId: string): Promise<void> {
  await mutateWishlist(wishlistId, (w) => {
    if (!isTaskList(w)) throw badRequest('Only lists, checklists, and to-dos use text rows.');
    const next = (w.tasks ?? []).filter((t) => t.id !== taskId);
    if (next.length === (w.tasks ?? []).length) throw notFound('That row is no longer on this list.');
    w.tasks = next;
  });
}

export async function regenerateShareToken(wishlist: WishlistRecord): Promise<WishlistRecord> {
  const token = await createShare(wishlist.id);
  const previous = wishlist.shareToken;
  const updated = await mutateWishlist(wishlist.id, (w) => {
    w.shareToken = token;
  });
  await revokeShare(previous);
  return updated;
}

export async function disableShareLink(wishlist: WishlistRecord): Promise<WishlistRecord> {
  const updated = await mutateWishlist(wishlist.id, (w) => {
    w.shareToken = null;
  });
  await revokeShare(wishlist.shareToken);
  return updated;
}

/** Remove `wishlistId` from `item.wishlistIds` for the given items. */
export async function unlinkItems(itemIds: string[], wishlistId: string): Promise<void> {
  await Promise.all(
    [...new Set(itemIds)].map((itemId) =>
      atomicUpdateExisting<ItemRecord>(db('items'), itemId, (item) => ({
        ...item,
        wishlistIds: item.wishlistIds.filter((w) => w !== wishlistId),
      })),
    ),
  );
}

export async function linkItems(itemIds: string[], wishlistId: string): Promise<void> {
  await Promise.all(
    [...new Set(itemIds)].map((itemId) =>
      atomicUpdateExisting<ItemRecord>(db('items'), itemId, (item) => {
        if (!item.wishlistIds.includes(wishlistId)) item.wishlistIds.push(wishlistId);
        return item;
      }),
    ),
  );
}

export async function deleteWishlist(wishlist: WishlistRecord): Promise<void> {
  await revokeShare(wishlist.shareToken);
  await unlinkItems(
    wishlist.entries.map((e) => e.itemId),
    wishlist.id,
  );
  await Promise.all(
    wishlist.collaborators.map((c) =>
      updateUserIndex(c.userId, (idx) => {
        idx.sharedWishlistIds = idx.sharedWishlistIds.filter((id) => id !== wishlist.id);
      }).catch(() => undefined),
    ),
  );
  await updateUserIndex(wishlist.ownerId, (idx) => {
    idx.wishlistIds = idx.wishlistIds.filter((id) => id !== wishlist.id);
  });
  await db('claims').delete(wishlist.id);
  await db('wishlists').delete(wishlist.id);
}

export async function duplicateWishlist(source: WishlistRecord, owner: UserRecord): Promise<WishlistRecord> {
  const copy = await createWishlist(owner, {
    kind: source.kind ?? 'wishlist',
    title: `${source.title} (copy)`.slice(0, 120),
    description: source.description,
    coverImage: source.coverImage,
    coverArt: source.coverArt ?? null,
    pageBackdrop: source.pageBackdrop ?? 'match',
    pageColors: source.pageColors ?? null,
    accentColor: source.accentColor,
    visibility: 'private',
    occasion: source.occasion,
    eventDate: source.eventDate,
    surpriseMode: source.surpriseMode,
    settings: source.settings,
  });
  const stamp = nowIso();
  const updated = await mutateWishlist(copy.id, (w) => {
    if (isTaskList(source)) {
      w.tasks = (source.tasks ?? []).map((t) => ({
        ...t,
        id: newId(),
        done: source.kind === 'list' ? false : t.done,
        completedAt: source.kind === 'list' ? null : t.completedAt,
        createdAt: stamp,
        updatedAt: stamp,
      }));
      w.entries = [];
    } else {
      w.entries = source.entries.map((e) => ({ ...e, id: newId(), createdAt: stamp, updatedAt: stamp }));
      // Still for the same people, but not shared with them until the owner links it again.
      if (source.recipients?.length) {
        w.recipients = source.recipients.map((r) => ({ ...r, userId: null }));
        if (source.includeOwner) w.includeOwner = true;
      }
    }
  });
  if (!isTaskList(updated)) {
    await linkItems(
      updated.entries.map((e) => e.itemId),
      updated.id,
    );
  }
  // Place the copy directly after the original.
  await updateUserIndex(owner.id, (idx) => {
    idx.wishlistIds = idx.wishlistIds.filter((id) => id !== copy.id);
    const at = idx.wishlistIds.indexOf(source.id);
    idx.wishlistIds.splice(at < 0 ? 0 : at + 1, 0, copy.id);
  });
  return updated;
}

export async function summarize(lists: WishlistRecord[], viewerId: string): Promise<WishlistSummary[]> {
  const owners = await getUsers(lists.map((l) => l.ownerId));
  const recipients = await resolveRecipients(lists);
  const previewIds = lists.flatMap((l) => l.entries.slice(0, 6).map((e) => e.itemId));
  const items = await getMany<ItemRecord>(db('items'), [...new Set(previewIds)]);
  const images = new Map(items.map((i) => [i.id, i.imageUrl]));
  return lists.map((l) => ({
    id: l.id,
    ownerId: l.ownerId,
    kind: l.kind ?? 'wishlist',
    title: l.title,
    description: l.description,
    coverImage: l.coverImage,
    coverArt: l.coverArt ?? null,
    pageBackdrop: l.pageBackdrop ?? null,
    pageColors: l.pageColors ?? null,
    accentColor: l.accentColor,
    visibility: l.visibility,
    occasion: l.occasion,
    eventDate: l.eventDate,
    shareToken: accessRole(l, viewerId) === 'owner' ? l.shareToken : l.visibility === 'private' ? null : l.shareToken,
    surpriseMode: l.surpriseMode,
    archivedAt: l.archivedAt,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    itemCount: listRowCount(l),
    collaboratorCount: l.collaborators.length,
    role: accessRole(l, viewerId) ?? 'viewer',
    owner: owners.get(l.ownerId)!,
    recipients: recipients.get(l.id) ?? [],
    link: l.link ?? null,
    previewImages: l.entries
      .slice(0, 6)
      .map((e) => images.get(e.itemId))
      .filter((u): u is string => Boolean(u))
      .slice(0, 4),
  }));
}

export async function listOwnedWishlists(userId: string): Promise<WishlistRecord[]> {
  const idx = await getUserIndex(userId);
  const lists = await getMany<WishlistRecord>(db('wishlists'), idx.wishlistIds);
  return lists.filter((l) => l.ownerId === userId);
}

export async function listSharedWishlists(userId: string): Promise<WishlistRecord[]> {
  const idx = await getUserIndex(userId);
  const lists = await getMany<WishlistRecord>(db('wishlists'), idx.sharedWishlistIds);
  return lists.filter((l) => l.collaborators.some((c) => c.userId === userId));
}

export async function reorderOwnedWishlists(userId: string, ids: string[]): Promise<void> {
  await updateUserIndex(userId, (idx) => {
    const current = new Set(idx.wishlistIds);
    if (ids.length !== current.size || !ids.every((id) => current.has(id))) {
      throw conflict('Your wishlists changed — refresh and try again.', 'stale_order');
    }
    idx.wishlistIds = ids;
  });
}
