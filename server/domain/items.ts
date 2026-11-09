import type { ItemMetadata, ItemOwnership, Priority, WishlistEntry } from '../../shared/types';
import type { GotItInput, ItemBulkCreateInput, ItemCreateInput, ItemUpdateInput, OwnershipInput } from '../../shared/schemas';
import { DEFAULT_PREFERENCES, isCollection } from '../../shared/constants';
import { atomicUpdateExisting, db, getMany } from '../storage';
import { badRequest, conflict, forbidden, notFound } from '../http';
import type { ItemRecord, UserRecord, WishlistRecord } from '../records';
import { getUserIndex, updateUserIndex } from '../services/auth';
import { notify } from '../services/notifications';
import { compact, newId, now, nowIso } from '../util';
import {
  MAX_ENTRIES_PER_LIST,
  accessRole,
  createWishlist,
  getWishlist,
  linkItems,
  mutateWishlist,
  requireWishlistAccess,
  unlinkItems,
} from './wishlists';
import { clearEntryActivity } from './claims';

export async function getItem(id: string): Promise<ItemRecord | null> {
  const res = await db('items').get<ItemRecord>(id);
  return res?.value ?? null;
}

function normalizeTags(tags: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags ?? []) {
    const tag = t.trim();
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
  }
  return out;
}

type MetadataInput = { [K in keyof ItemMetadata]?: ItemMetadata[K] | null };
const cleanMetadata = (m: MetadataInput | undefined): ItemMetadata => compact(m ?? {}) as ItemMetadata;

/** Apply a partial ownership update; fields that weren't sent keep their current value. */
export function mergeOwnership(current: ItemOwnership | null | undefined, input: OwnershipInput): ItemOwnership {
  return {
    acquiredOn: input.acquiredOn !== undefined ? input.acquiredOn : (current?.acquiredOn ?? null),
    acquiredVia: input.acquiredVia !== undefined ? input.acquiredVia : (current?.acquiredVia ?? null),
    pricePaid: input.pricePaid !== undefined ? input.pricePaid : (current?.pricePaid ?? null),
    condition: input.condition !== undefined ? input.condition : (current?.condition ?? null),
    quantity: input.quantity ?? current?.quantity ?? 1,
  };
}

/**
 * Item authorization: the item's owner may always edit it. A collaborator may
 * edit it only if they are an *editor* of a wishlist (owned by the item owner)
 * that actually contains the item — checked against the wishlist document,
 * not just the denormalised `item.wishlistIds`.
 */
export async function canEditItem(item: ItemRecord, user: UserRecord): Promise<boolean> {
  if (item.ownerId === user.id) return true;
  for (const wishlistId of item.wishlistIds) {
    const w = await getWishlist(wishlistId);
    if (!w || w.ownerId !== item.ownerId) continue;
    if (accessRole(w, user.id) === 'editor' && w.entries.some((e) => e.itemId === item.id)) return true;
  }
  return false;
}

export async function requireEditableItem(id: string, user: UserRecord): Promise<ItemRecord> {
  const item = await getItem(id);
  if (!item || !(await canEditItem(item, user))) throw notFound('Item not found.');
  return item;
}

const EDIT_NOTICE_INTERVAL_MS = 6 * 3600_000;

/** Tell the owner a collaborator changed their list (throttled; never about claims). */
export async function noteCollaboratorEdit(wishlist: WishlistRecord, editor: UserRecord): Promise<void> {
  if (editor.id === wishlist.ownerId) return;
  const last = wishlist.editNotices?.[editor.id];
  if (last && now().getTime() - new Date(last).getTime() < EDIT_NOTICE_INTERVAL_MS) return;
  await atomicUpdateExisting<WishlistRecord>(db('wishlists'), wishlist.id, (w) => ({
    ...w,
    editNotices: { ...(w.editNotices ?? {}), [editor.id]: nowIso() },
  }));
  await notify(
    wishlist.ownerId,
    'collaborator_edit',
    `${editor.displayName} updated “${wishlist.title}”.`,
    `/app/lists/${wishlist.id}`,
  );
}

function newEntry(itemId: string, userId: string, priority: Priority | null = null, customNotes = ''): WishlistEntry {
  const stamp = nowIso();
  return {
    id: newId(),
    itemId,
    priority,
    customNotes,
    groupGift: false,
    groupGiftNote: '',
    addedBy: userId,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** Add an item to a wishlist (no-op if already present). */
export async function addEntry(
  wishlistId: string,
  item: ItemRecord,
  userId: string,
  opts: { priority?: Priority | null; customNotes?: string } = {},
): Promise<WishlistRecord> {
  const updated = await mutateWishlist(wishlistId, (w) => {
    if (w.ownerId !== item.ownerId) throw badRequest('Items can only be added to lists owned by the same person.');
    if (w.entries.some((e) => e.itemId === item.id)) return;
    if (w.entries.length >= MAX_ENTRIES_PER_LIST) throw conflict(`A list can hold up to ${MAX_ENTRIES_PER_LIST} items.`);
    w.entries.unshift(newEntry(item.id, userId, opts.priority ?? null, opts.customNotes ?? ''));
  });
  await linkItems([item.id], wishlistId);
  // Anything filed in a collection is something the owner has.
  if (isCollection(updated)) {
    await atomicUpdateExisting<ItemRecord>(db('items'), item.id, (current) => (current.owned ? current : { ...current, owned: mergeOwnership(null, {}) }));
  }
  return updated;
}

export async function removeEntry(wishlistId: string, entryId: string): Promise<void> {
  let itemId: string | null = null;
  const updated = await mutateWishlist(wishlistId, (w) => {
    const entry = w.entries.find((e) => e.id === entryId);
    if (!entry) throw notFound('That item is no longer on this list.');
    itemId = entry.itemId;
    w.entries = w.entries.filter((e) => e.id !== entryId);
  });
  if (itemId && !updated.entries.some((e) => e.itemId === itemId)) await unlinkItems([itemId], wishlistId);
  await clearEntryActivity(wishlistId, [entryId]);
}

export async function createItem(user: UserRecord, input: ItemCreateInput): Promise<ItemRecord> {
  const targetIds = [...new Set(input.wishlistIds ?? [])];
  const targets = await Promise.all(targetIds.map((id) => requireWishlistAccess(id, user, 'editor')));
  const owners = new Set(targets.map((t) => t.wishlist.ownerId));
  if (owners.size > 1) throw badRequest('Add items to lists from one owner at a time.');
  // Items added by an editor to someone else's list belong to that list's owner.
  const ownerId = targets[0]?.wishlist.ownerId ?? user.id;

  const stamp = nowIso();
  const item: ItemRecord = {
    id: newId(),
    ownerId,
    type: input.type ?? 'custom',
    title: input.title,
    description: input.description ?? '',
    imageUrl: input.imageUrl ?? null,
    externalUrl: input.externalUrl ?? null,
    retailer: input.retailer ?? '',
    brand: input.brand ?? '',
    price: input.price ?? null,
    currency: input.currency ?? user.preferences?.currency ?? DEFAULT_PREFERENCES.currency,
    category: input.category ?? '',
    tags: normalizeTags(input.tags),
    notes: input.notes ?? '',
    metadata: cleanMetadata(input.metadata),
    owned: input.owned ? mergeOwnership(null, input.owned) : null,
    wishlistIds: [],
    createdBy: user.id,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db('items').set(item.id, item, { onlyIfNew: true });
  await updateUserIndex(ownerId, (idx) => {
    idx.itemIds.unshift(item.id);
  });
  for (const { wishlist } of targets) {
    await addEntry(wishlist.id, item, user.id, { priority: input.priority ?? null });
    await noteCollaboratorEdit(wishlist, user);
  }
  return (await getItem(item.id)) ?? item;
}

/**
 * Create several items at once and file them on the same lists, in the order given.
 * Writes each item once, each list once and the owner's index once.
 */
export async function createItems(user: UserRecord, input: ItemBulkCreateInput): Promise<ItemRecord[]> {
  const targetIds = [...new Set(input.wishlistIds ?? [])];
  const targets = await Promise.all(targetIds.map((id) => requireWishlistAccess(id, user, 'editor')));
  const owners = new Set(targets.map((t) => t.wishlist.ownerId));
  if (owners.size > 1) throw badRequest('Add items to lists from one owner at a time.');
  const ownerId = targets[0]?.wishlist.ownerId ?? user.id;
  for (const { wishlist } of targets) {
    if (wishlist.entries.length + input.items.length > MAX_ENTRIES_PER_LIST) {
      throw conflict(`“${wishlist.title}” can hold up to ${MAX_ENTRIES_PER_LIST} items.`);
    }
  }
  const intoCollection = targets.some((t) => isCollection(t.wishlist));

  const stamp = nowIso();
  const items: ItemRecord[] = input.items.map((i) => ({
    id: newId(),
    ownerId,
    type: i.type ?? 'custom',
    title: i.title,
    description: i.description ?? '',
    imageUrl: i.imageUrl ?? null,
    externalUrl: i.externalUrl ?? null,
    retailer: i.retailer ?? '',
    brand: i.brand ?? '',
    price: i.price ?? null,
    currency: i.currency ?? user.preferences?.currency ?? DEFAULT_PREFERENCES.currency,
    category: i.category ?? '',
    tags: normalizeTags(i.tags),
    notes: i.notes ?? '',
    metadata: cleanMetadata(i.metadata),
    owned: i.owned ? mergeOwnership(null, i.owned) : intoCollection ? mergeOwnership(null, {}) : null,
    wishlistIds: targetIds,
    createdBy: user.id,
    createdAt: stamp,
    updatedAt: stamp,
  }));
  await Promise.all(items.map((item) => db('items').set(item.id, item, { onlyIfNew: true })));
  await updateUserIndex(ownerId, (idx) => {
    idx.itemIds.unshift(...items.map((i) => i.id));
  });
  for (const { wishlist } of targets) {
    await mutateWishlist(wishlist.id, (w) => {
      if (w.ownerId !== ownerId) throw badRequest('Items can only be added to lists owned by the same person.');
      if (w.entries.length + items.length > MAX_ENTRIES_PER_LIST) throw conflict(`A list can hold up to ${MAX_ENTRIES_PER_LIST} items.`);
      w.entries.unshift(...items.map((i) => newEntry(i.id, user.id, input.priority ?? null)));
    });
    await noteCollaboratorEdit(wishlist, user);
  }
  return items;
}

export async function updateItem(item: ItemRecord, input: ItemUpdateInput, user: UserRecord): Promise<ItemRecord> {
  const updated = await atomicUpdateExisting<ItemRecord>(db('items'), item.id, (current) => {
    const next: ItemRecord = { ...current };
    if (input.type !== undefined) next.type = input.type;
    if (input.title !== undefined) next.title = input.title;
    if (input.description !== undefined) next.description = input.description;
    if (input.imageUrl !== undefined) next.imageUrl = input.imageUrl;
    if (input.externalUrl !== undefined) next.externalUrl = input.externalUrl;
    if (input.retailer !== undefined) next.retailer = input.retailer;
    if (input.brand !== undefined) next.brand = input.brand;
    if (input.price !== undefined) next.price = input.price;
    if (input.currency !== undefined) next.currency = input.currency;
    if (input.category !== undefined) next.category = input.category;
    if (input.tags !== undefined) next.tags = normalizeTags(input.tags);
    if (input.notes !== undefined) next.notes = input.notes;
    if (input.metadata !== undefined) next.metadata = cleanMetadata(input.metadata);
    if (input.owned !== undefined) next.owned = input.owned === null ? null : mergeOwnership(current.owned, input.owned);
    next.updatedAt = nowIso();
    return next;
  });
  if (!updated) throw notFound('Item not found.');
  if (user.id !== updated.ownerId) {
    for (const wid of updated.wishlistIds) {
      const w = await getWishlist(wid);
      if (w && accessRole(w, user.id) === 'editor') await noteCollaboratorEdit(w, user);
    }
  }
  return updated;
}

export async function deleteItem(item: ItemRecord): Promise<void> {
  for (const wishlistId of item.wishlistIds) {
    const w = await getWishlist(wishlistId);
    if (!w) continue;
    const removed = w.entries.filter((e) => e.itemId === item.id).map((e) => e.id);
    if (!removed.length) continue;
    await mutateWishlist(wishlistId, (draft) => {
      draft.entries = draft.entries.filter((e) => e.itemId !== item.id);
    });
    await clearEntryActivity(wishlistId, removed);
  }
  await updateUserIndex(item.ownerId, (idx) => {
    idx.itemIds = idx.itemIds.filter((id) => id !== item.id);
  });
  await db('items').delete(item.id);
}

/** Set exactly which of the owner's wishlists contain this item. */
export async function setMemberships(item: ItemRecord, user: UserRecord, wishlistIds: string[]): Promise<ItemRecord> {
  if (item.ownerId !== user.id) throw forbidden('Only the owner can change which lists an item is on.');
  const desired = new Set(wishlistIds);
  for (const id of desired) {
    const w = await getWishlist(id);
    if (!w || w.ownerId !== user.id) throw badRequest('You can only add items to your own wishlists here.');
  }
  const current = new Set(item.wishlistIds);
  for (const id of desired) if (!current.has(id)) await addEntry(id, item, user.id);
  for (const id of current) {
    if (desired.has(id)) continue;
    const w = await getWishlist(id);
    const entry = w?.entries.find((e) => e.itemId === item.id);
    if (entry) await removeEntry(id, entry.id);
    else await unlinkItems([item.id], id);
  }
  const refreshed = await getItem(item.id);
  if (!refreshed) throw notFound('Item not found.');
  return refreshed;
}

/**
 * "Got it": record that the owner now has this item, file it in one of their
 * collections (or a new one) and optionally take it off the wishlist it came
 * from. Everything is checked before anything is changed.
 */
export async function markGotIt(item: ItemRecord, user: UserRecord, input: GotItInput): Promise<{ item: ItemRecord; collectionId: string }> {
  if (item.ownerId !== user.id) throw notFound('Item not found.');
  let leaving: { wishlistId: string; entryId: string } | null = null;
  if (input.removeFromWishlistId) {
    const { wishlist: from } = await requireWishlistAccess(input.removeFromWishlistId, user, 'owner');
    const entry = from.entries.find((e) => e.itemId === item.id);
    if (entry) leaving = { wishlistId: from.id, entryId: entry.id };
  }
  let collectionId: string;
  if (input.collectionId) {
    const { wishlist } = await requireWishlistAccess(input.collectionId, user, 'owner');
    if (!isCollection(wishlist)) throw badRequest('Choose one of your collections.', { collectionId: 'Choose one of your collections.' });
    collectionId = wishlist.id;
  } else {
    collectionId = (await createWishlist(user, { title: input.newCollectionTitle!, kind: 'collection', visibility: 'private' })).id;
  }
  await atomicUpdateExisting<ItemRecord>(db('items'), item.id, (current) => ({ ...current, owned: mergeOwnership(current.owned, input.owned), updatedAt: nowIso() }));
  await addEntry(collectionId, item, user.id);
  if (leaving && leaving.wishlistId !== collectionId) await removeEntry(leaving.wishlistId, leaving.entryId);
  const refreshed = await getItem(item.id);
  if (!refreshed) throw notFound('Item not found.');
  return { item: refreshed, collectionId };
}

export async function listOwnedItems(userId: string): Promise<ItemRecord[]> {
  const idx = await getUserIndex(userId);
  const items = await getMany<ItemRecord>(db('items'), idx.itemIds);
  return items.filter((i) => i.ownerId === userId);
}
