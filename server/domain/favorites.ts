import { LIMITS } from '../../shared/constants';
import type { CirclePerson, FavoriteCard, FavoriteEntry, FavoriteTargetType, Item, PublicUser } from '../../shared/types';
import { badRequest, conflict, forbidden, notFound } from '../http';
import type { BoxRecord, CircleDoc, FavoriteRecord, FavoritesDoc, ItemRecord, UserRecord, WishlistRecord } from '../records';
import { toPublicUser } from '../serialize';
import { atomicUpdate, db, getMany } from '../storage';
import { newId, nowIso } from '../util';
import { summarizeBoxes } from './boxes';
import { areFriends } from './friends';
import { accessRole, getWishlist, summarize } from './wishlists';

const emptyDoc = (): FavoritesDoc => ({ entries: [] });

async function readDoc(userId: string): Promise<FavoritesDoc> {
  return (await db('favorites').get<FavoritesDoc>(userId))?.value ?? emptyDoc();
}

function toEntry(record: FavoriteRecord): FavoriteEntry {
  return { id: record.id, targetType: record.targetType, targetId: record.targetId, createdAt: record.createdAt };
}

async function assertCanFavorite(user: UserRecord, targetType: FavoriteTargetType, targetId: string): Promise<void> {
  if (targetType === 'wishlist') {
    const list = await getWishlist(targetId);
    if (!list || list.archivedAt) throw notFound('List not found.');
    if (accessRole(list, user.id)) return;
    if (list.visibility === 'public') return;
    if (list.visibility === 'friends' && (await areFriends(user.id, list.ownerId))) return;
    throw forbidden('You can’t favorite that list.');
  }
  if (targetType === 'item') {
    const item = (await db('items').get<ItemRecord>(targetId))?.value;
    if (!item || item.ownerId !== user.id) throw notFound('Item not found.');
    return;
  }
  if (targetType === 'box') {
    const box = (await db('boxes').get<BoxRecord>(targetId))?.value;
    if (!box || box.ownerId !== user.id) throw notFound('Box not found.');
    return;
  }
  if (targetType === 'user') {
    if (targetId === user.id) throw badRequest('You can’t favorite yourself.');
    const target = (await db('users').get<UserRecord>(targetId))?.value;
    if (!target) throw notFound('Person not found.');
    if (!(await areFriends(user.id, targetId))) throw forbidden('You can only favorite friends.');
    return;
  }
  if (targetType === 'circle_person') {
    const circle = (await db('circle').get<CircleDoc>(user.id))?.value;
    if (!circle?.people.some((p) => p.id === targetId)) throw notFound('That person isn’t in My Circle.');
    return;
  }
  throw badRequest('Unknown favorite type.');
}

async function hydrate(user: UserRecord, entries: FavoriteRecord[]): Promise<FavoriteCard[]> {
  const byType = (t: FavoriteTargetType) => entries.filter((e) => e.targetType === t).map((e) => e.targetId);

  const wishlistIds = byType('wishlist');
  const itemIds = byType('item');
  const boxIds = byType('box');
  const userIds = byType('user');
  const circleIds = new Set(byType('circle_person'));

  const [wishlistDocs, itemDocs, boxDocs, userDocs, circleDoc] = await Promise.all([
    wishlistIds.length ? getMany<WishlistRecord>(db('wishlists'), wishlistIds) : Promise.resolve([] as WishlistRecord[]),
    itemIds.length ? getMany<ItemRecord>(db('items'), itemIds) : Promise.resolve([] as ItemRecord[]),
    boxIds.length ? getMany<BoxRecord>(db('boxes'), boxIds) : Promise.resolve([] as BoxRecord[]),
    userIds.length ? getMany<UserRecord>(db('users'), userIds) : Promise.resolve([] as UserRecord[]),
    circleIds.size ? db('circle').get<CircleDoc>(user.id) : Promise.resolve(null),
  ]);

  const accessibleLists: WishlistRecord[] = [];
  for (const w of wishlistDocs) {
    if (w.archivedAt) continue;
    if (accessRole(w, user.id) || w.visibility === 'public' || (w.visibility === 'friends' && (await areFriends(user.id, w.ownerId)))) {
      accessibleLists.push(w);
    }
  }
  const listCards = accessibleLists.length ? await summarize(accessibleLists, user.id) : [];
  const listById = new Map(listCards.map((w) => [w.id, w]));

  const items = itemDocs.filter((i) => i.ownerId === user.id);
  const itemById = new Map(items.map((i) => [i.id, i as Item]));

  const ownedBoxes = boxDocs.filter((b) => b.ownerId === user.id);
  const boxCards = ownedBoxes.length ? await summarizeBoxes(ownedBoxes) : [];
  const boxById = new Map(boxCards.map((b) => [b.id, b]));

  const users = new Map<string, PublicUser>();
  for (const u of userDocs) {
    if (u.id !== user.id && (await areFriends(user.id, u.id))) users.set(u.id, toPublicUser(u));
  }

  const circlePeople = new Map<string, CirclePerson>();
  for (const p of circleDoc?.value?.people ?? []) {
    if (!circleIds.has(p.id)) continue;
    let linked: PublicUser | undefined;
    if (p.userId) {
      const u = (await db('users').get<UserRecord>(p.userId))?.value;
      if (u) linked = toPublicUser(u);
    }
    circlePeople.set(p.id, {
      id: p.id,
      name: p.name,
      avatarUrl: p.avatarUrl,
      kind: p.kind,
      note: p.note,
      userId: p.userId,
      username: linked?.username ?? null,
      displayName: linked?.displayName ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  }

  return entries.map((entry) => ({
    entry: toEntry(entry),
    wishlist: entry.targetType === 'wishlist' ? listById.get(entry.targetId) ?? null : null,
    item: entry.targetType === 'item' ? itemById.get(entry.targetId) ?? null : null,
    box: entry.targetType === 'box' ? boxById.get(entry.targetId) ?? null : null,
    user: entry.targetType === 'user' ? users.get(entry.targetId) ?? null : null,
    circlePerson: entry.targetType === 'circle_person' ? circlePeople.get(entry.targetId) ?? null : null,
  }));
}

export async function listFavorites(user: UserRecord): Promise<FavoriteCard[]> {
  const doc = await readDoc(user.id);
  const newestFirst = [...doc.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return hydrate(user, newestFirst);
}

/** Ids currently favorited, for menu stars without hydrating cards. */
export async function favoriteIndex(userId: string): Promise<Array<{ targetType: FavoriteTargetType; targetId: string; id: string }>> {
  const doc = await readDoc(userId);
  return doc.entries.map((e) => ({ targetType: e.targetType, targetId: e.targetId, id: e.id }));
}

export async function addFavorite(
  user: UserRecord,
  input: { targetType: FavoriteTargetType; targetId: string },
): Promise<FavoriteCard> {
  await assertCanFavorite(user, input.targetType, input.targetId);
  let entryId: string | null = null;

  await atomicUpdate<FavoritesDoc>(db('favorites'), user.id, (current) => {
    const entries = current?.entries ?? [];
    const found = entries.find((e) => e.targetType === input.targetType && e.targetId === input.targetId);
    if (found) {
      entryId = found.id;
      return { entries };
    }
    if (entries.length >= LIMITS.favorites) {
      throw conflict(`Favorites can hold up to ${LIMITS.favorites} things.`, 'favorites_limit');
    }
    const created: FavoriteRecord = {
      id: newId(),
      targetType: input.targetType,
      targetId: input.targetId,
      createdAt: nowIso(),
    };
    entryId = created.id;
    return { entries: [created, ...entries] };
  });

  if (!entryId) throw notFound('Favorite not found.');
  const cards = await listFavorites(user);
  const card = cards.find((c) => c.entry.id === entryId);
  if (!card) throw notFound('Favorite not found.');
  return card;
}

export async function removeFavorite(
  userId: string,
  input: { targetType: FavoriteTargetType; targetId: string } | { id: string },
): Promise<void> {
  await atomicUpdate<FavoritesDoc>(db('favorites'), userId, (current) => {
    const entries = current?.entries ?? [];
    const next =
      'id' in input
        ? entries.filter((e) => e.id !== input.id)
        : entries.filter((e) => !(e.targetType === input.targetType && e.targetId === input.targetId));
    if (next.length === entries.length) throw notFound('That isn’t in Favorites.');
    return { entries: next };
  });
}

export async function deleteFavorites(userId: string): Promise<void> {
  await db('favorites').delete(userId);
}
