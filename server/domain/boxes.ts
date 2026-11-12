import { randomBytes } from 'node:crypto';
import {
  boxCodeFromBytes,
  isBoxCode,
  normalizeBoxCode,
  type BoxDetail,
  type BoxLine,
  type BoxSummary,
  type PublicBoxView,
  type PublicItem,
} from '../../shared/types';
import { BOX_COLORS, defaultBoxCoverArt } from '../../shared/constants';
import { MAX_BOX_ITEMS, type BoxCreateInput, type BoxUpdateInput } from '../../shared/schemas';
import { atomicUpdate, atomicUpdateExisting, db, getMany } from '../storage';
import { HttpError, conflict, notFound } from '../http';
import type { BoxCodeRecord, BoxRecord, ItemRecord, UserRecord } from '../records';
import { getUserIndex, updateUserIndex } from '../services/auth';
import { toPublicItem } from '../serialize';
import { newId, now, nowIso } from '../util';

export const MAX_BOXES = 1000;
const SCAN_NOTE_INTERVAL_MS = 10 * 60_000;
const CODE_NOT_FOUND = 'This code doesn’t match a box. It may have been replaced with a new label.';

export async function getBox(id: string): Promise<BoxRecord | null> {
  return (await db('boxes').get<BoxRecord>(id))?.value ?? null;
}

export function mutateBox(id: string, mutate: (b: BoxRecord) => void): Promise<BoxRecord> {
  return atomicUpdate<BoxRecord>(db('boxes'), id, (current) => {
    if (!current) throw notFound('Box not found.');
    mutate(current);
    current.updatedAt = nowIso();
    return current;
  });
}

/** Boxes are private to their owner: anyone else gets the same 404 as a box that doesn't exist. */
export async function requireOwnBox(id: string, user: UserRecord): Promise<BoxRecord> {
  const box = await getBox(id);
  if (!box || box.ownerId !== user.id) throw notFound('Box not found.');
  return box;
}

async function createCode(boxId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = boxCodeFromBytes(randomBytes(12));
    const record: BoxCodeRecord = { boxId, createdAt: nowIso(), revokedAt: null };
    if ((await db('box-codes').set(code, record, { onlyIfNew: true })).modified) return code;
  }
  throw new HttpError(503, 'The server is busy, please try again.', 'conflict_retry');
}

async function revokeCode(code: string): Promise<void> {
  await atomicUpdateExisting<BoxCodeRecord>(db('box-codes'), code, (c) => ({ ...c, revokedAt: c.revokedAt ?? nowIso() }));
}

/** Keep the ids of lines that were sent back, give new lines fresh ones. */
function cleanLines(lines: NonNullable<BoxCreateInput['lines']>): BoxLine[] {
  const seen = new Set<string>();
  return lines.map((l) => {
    const id = l.id && !seen.has(l.id) ? l.id : newId();
    seen.add(id);
    return { id, text: l.text, quantity: l.quantity };
  });
}

export async function listOwnedBoxes(userId: string): Promise<BoxRecord[]> {
  const idx = await getUserIndex(userId);
  const boxes = await getMany<BoxRecord>(db('boxes'), idx.boxIds);
  return boxes.filter((b) => b.ownerId === userId);
}

export async function createBox(owner: UserRecord, input: BoxCreateInput): Promise<BoxRecord> {
  const existing = await listOwnedBoxes(owner.id);
  if (existing.length >= MAX_BOXES) throw conflict(`You can have up to ${MAX_BOXES} boxes.`);
  const material = input.material ?? 'cardboard';
  const id = newId();
  const stamp = nowIso();
  const box: BoxRecord = {
    id,
    ownerId: owner.id,
    name: input.name,
    number: input.number !== undefined ? input.number : existing.reduce((n, b) => Math.max(n, b.number ?? 0), 0) + 1,
    color: input.color ?? BOX_COLORS[0].value,
    material,
    size: input.size ?? null,
    location: input.location ?? '',
    room: input.room ?? '',
    fragile: input.fragile ?? false,
    notes: input.notes ?? '',
    coverArt: input.coverArt ?? defaultBoxCoverArt(material),
    itemIds: [],
    lines: cleanLines(input.lines ?? []),
    code: await createCode(id),
    access: input.access ?? 'link',
    showPrices: input.showPrices ?? false,
    archivedAt: null,
    lastScannedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db('boxes').set(id, box, { onlyIfNew: true });
  await updateUserIndex(owner.id, (idx) => {
    idx.boxIds.push(id);
  });
  return box;
}

export function updateBox(box: BoxRecord, input: BoxUpdateInput): Promise<BoxRecord> {
  return mutateBox(box.id, (b) => {
    if (input.name !== undefined) b.name = input.name;
    if (input.number !== undefined) b.number = input.number;
    if (input.color !== undefined) b.color = input.color;
    if (input.material !== undefined) b.material = input.material;
    if (input.size !== undefined) b.size = input.size;
    if (input.location !== undefined) b.location = input.location;
    if (input.room !== undefined) b.room = input.room;
    if (input.fragile !== undefined) b.fragile = input.fragile;
    if (input.notes !== undefined) b.notes = input.notes;
    if (input.coverArt !== undefined) b.coverArt = input.coverArt;
    if (input.access !== undefined) b.access = input.access;
    if (input.showPrices !== undefined) b.showPrices = input.showPrices;
    if (input.lines !== undefined) b.lines = cleanLines(input.lines);
    if (input.archived !== undefined) b.archivedAt = input.archived ? (b.archivedAt ?? nowIso()) : null;
  });
}

/** A new code for the box; the old one (and any label printed with it) stops working. */
export async function regenerateBoxCode(box: BoxRecord): Promise<BoxRecord> {
  const code = await createCode(box.id);
  const updated = await mutateBox(box.id, (b) => {
    b.code = code;
  });
  await revokeCode(box.code);
  return updated;
}

/** Items still packed in the box. `item.boxId` decides, so a half-finished move never shows a thing in two boxes. */
async function packedItems(box: BoxRecord): Promise<ItemRecord[]> {
  const items = await getMany<ItemRecord>(db('items'), box.itemIds);
  return items.filter((i) => i.boxId === box.id && i.ownerId === box.ownerId);
}

export async function deleteBox(box: BoxRecord): Promise<void> {
  await revokeCode(box.code);
  const items = await packedItems(box);
  await Promise.all(
    items.map((i) => atomicUpdateExisting<ItemRecord>(db('items'), i.id, (cur) => (cur.boxId === box.id ? { ...cur, boxId: null } : cur))),
  );
  await updateUserIndex(box.ownerId, (idx) => {
    idx.boxIds = idx.boxIds.filter((id) => id !== box.id);
  });
  await db('boxes').delete(box.id);
}

/** Everything a deleted account had in boxes. Items are deleted separately. */
export async function deleteAllBoxes(userId: string): Promise<void> {
  for (const box of await listOwnedBoxes(userId)) {
    await revokeCode(box.code);
    await db('boxes').delete(box.id);
  }
}

export async function summarizeBoxes(boxes: BoxRecord[]): Promise<BoxSummary[]> {
  const previewIds = boxes.flatMap((b) => b.itemIds.slice(0, 4));
  const items = await getMany<ItemRecord>(db('items'), [...new Set(previewIds)]);
  const images = new Map(items.map((i) => [i.id, i.imageUrl]));
  return boxes.map(({ itemIds, lines, notes: _notes, ...rest }) => ({
    ...rest,
    archivedAt: rest.archivedAt ?? null,
    itemCount: itemIds.length,
    lineCount: lines.length,
    lineTexts: lines.map((l) => l.text),
    previewImages: itemIds
      .map((id) => images.get(id))
      .filter((u): u is string => Boolean(u))
      .slice(0, 4),
  }));
}

export async function boxDetail(box: BoxRecord): Promise<BoxDetail> {
  return { box: { ...box, archivedAt: box.archivedAt ?? null }, items: await packedItems(box) };
}

/**
 * Pack items into a box, or take them out of their box (`boxId: null`). A thing
 * is only in one box, so packing it somewhere new takes it out of the old box.
 */
export async function packItems(user: UserRecord, itemIds: string[], boxId: string | null): Promise<void> {
  const target = boxId ? await requireOwnBox(boxId, user) : null;
  const ids = [...new Set(itemIds)];
  const items = await getMany<ItemRecord>(db('items'), ids);
  if (items.length !== ids.length || items.some((i) => i.ownerId !== user.id)) throw notFound('Item not found.');
  const moving = items.filter((i) => (i.boxId ?? null) !== boxId);
  if (!moving.length) return;

  if (target) {
    await mutateBox(target.id, (b) => {
      const incoming = moving.map((i) => i.id).filter((id) => !b.itemIds.includes(id));
      if (b.itemIds.length + incoming.length > MAX_BOX_ITEMS) throw conflict(`A box can hold up to ${MAX_BOX_ITEMS} items.`);
      b.itemIds = [...incoming, ...b.itemIds];
    });
  }
  const leaving = new Map<string, Set<string>>();
  for (const item of moving) {
    if (!item.boxId) continue;
    if (!leaving.has(item.boxId)) leaving.set(item.boxId, new Set());
    leaving.get(item.boxId)!.add(item.id);
  }
  for (const [fromId, gone] of leaving) {
    await atomicUpdateExisting<BoxRecord>(db('boxes'), fromId, (b) => ({
      ...b,
      itemIds: b.itemIds.filter((id) => !gone.has(id)),
      updatedAt: nowIso(),
    }));
  }
  await Promise.all(moving.map((i) => atomicUpdateExisting<ItemRecord>(db('items'), i.id, (cur) => ({ ...cur, boxId }))));
}

/** A deleted item leaves its box. */
export async function unpackDeletedItem(item: ItemRecord): Promise<void> {
  if (!item.boxId) return;
  await atomicUpdateExisting<BoxRecord>(db('boxes'), item.boxId, (b) => ({ ...b, itemIds: b.itemIds.filter((id) => id !== item.id) }));
}

// ── Scanning a box's code ─────────────────────────────────────────────────

export async function resolveBoxCode(raw: string): Promise<BoxRecord> {
  const code = normalizeBoxCode(raw);
  if (!isBoxCode(code)) throw notFound(CODE_NOT_FOUND);
  const record = (await db('box-codes').get<BoxCodeRecord>(code))?.value;
  if (!record || record.revokedAt) throw notFound(CODE_NOT_FOUND);
  const box = await getBox(record.boxId);
  if (!box || box.code !== code) throw notFound(CODE_NOT_FOUND);
  if (box.archivedAt) throw notFound('This box is archived, so its label is paused.');
  return box;
}

/** Prices and what's in someone's reviews stay with the owner unless they choose to show prices. */
function forScanner(item: ItemRecord, showPrices: boolean): PublicItem {
  const p = toPublicItem(item);
  const owned = p.owned ? { ...p.owned, rating: null, review: '' } : p.owned;
  if (showPrices) return { ...p, owned };
  const { suggestedAmount: _amount, budget: _budget, ...metadata } = p.metadata;
  return { ...p, owned, price: null, metadata };
}

/**
 * What a scan shows. Anyone holding the code sees the contents of a `link` box;
 * an `owner` box only opens for its owner. Where it's kept and private notes
 * are never shown to anyone but the owner.
 */
export async function buildPublicBoxView(box: BoxRecord, viewer: UserRecord | null): Promise<PublicBoxView> {
  const isOwner = viewer?.id === box.ownerId;
  if (!isOwner && box.access === 'owner') {
    throw new HttpError(
      403,
      viewer ? 'Only the owner of this box can see what’s inside.' : 'Sign in to see what’s in this box. Only its owner can open it.',
      'box_private',
    );
  }
  const items = await packedItems(box);
  return {
    box: {
      id: isOwner ? box.id : null,
      name: box.name,
      number: box.number,
      color: box.color,
      material: box.material,
      size: box.size,
      room: box.room,
      fragile: box.fragile,
      coverArt: box.coverArt,
      showPrices: box.showPrices,
      code: box.code,
      updatedAt: box.updatedAt,
      location: isOwner ? box.location : null,
    },
    items: items.map((i) => (isOwner ? toPublicItem(i) : forScanner(i, box.showPrices))),
    lines: box.lines,
    viewer: { isOwner },
  };
}

/** Remember when the box was last opened by its code, at most every few minutes. */
export async function noteScan(box: BoxRecord): Promise<void> {
  if (box.lastScannedAt && now().getTime() - new Date(box.lastScannedAt).getTime() < SCAN_NOTE_INTERVAL_MS) return;
  await atomicUpdateExisting<BoxRecord>(db('boxes'), box.id, (b) => ({ ...b, lastScannedAt: nowIso() }));
}
