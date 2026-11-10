/**
 * Gift activity: reservations ("claims"), purchases and group-gift pledges.
 *
 * Concurrency model
 * -----------------
 * All activity for one wishlist lives in a single `claims/{wishlistId}`
 * document. Every mutation goes through `atomicUpdate`, which writes with an
 * ETag precondition (`onlyIfMatch` / `onlyIfNew`). If two visitors try to
 * reserve the same item at the same moment, both read the same version but
 * only one conditional write can succeed; the loser re-reads, sees the fresh
 * reservation and receives a 409. There is no window in which two exclusive
 * reservations can coexist.
 *
 * Privacy model (Surprise Mode)
 * -----------------------------
 * Surprise Mode keeps gift activity from one side of a list (`surprisedSide`):
 * the owner and editors on their own list, or only the people a list is made
 * for. Each claim/pledge records whether Surprise Mode was on when it was made
 * (`surprise`) and which side it was kept from (`surpriseFor`). That side
 * only ever sees records where Surprise Mode is currently off AND the record
 * wasn't kept from them — so turning Surprise Mode off, or changing who the
 * list is for, can't retroactively reveal earlier gifts. These checks run
 * server-side; hidden claim data never reaches that side's browser.
 *
 * Claimants authenticate follow-up actions (release, mark purchased) with a
 * random bearer token returned once at claim time; only its SHA-256 is stored.
 */
import type { OwnerClaimView, OwnerPledgeView } from '../../shared/types';
import { isCollection } from '../../shared/constants';
import type { z } from 'zod';
import type { claimSchema, pledgeSchema } from '../../shared/schemas';
import { atomicUpdate, atomicUpdateExisting, db } from '../storage';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../http';
import type { ClaimRecord, ClaimsDoc, GiftSide, PledgeRecord, WishlistRecord } from '../records';
import { newId, newToken, now, nowIso, safeEqual, sha256 } from '../util';
import { accessRole, isListRecipient } from './wishlists';

const emptyDoc = (wishlistId: string): ClaimsDoc => ({ wishlistId, claims: {}, pledges: {} });

/** Who Surprise Mode keeps gift activity from: the people a list is made for, or on your own list, you and your editors. */
export const surprisedSide = (wishlist: WishlistRecord): GiftSide => (wishlist.recipients?.length ? 'recipient' : 'owner');

/** Which side of a list a signed-in user is on. Everyone else (visitors, viewer-collaborators) is null and sees the visitor view. */
export function giftSide(wishlist: WishlistRecord, userId: string | null | undefined): GiftSide | null {
  if (!userId) return null;
  if (isListRecipient(wishlist, userId)) return 'recipient';
  const role = accessRole(wishlist, userId);
  return role === 'owner' || role === 'editor' ? 'owner' : null;
}

/** Surprise Mode is hiding all gift activity from this side right now. */
export const activityHidden = (wishlist: WishlistRecord, side: GiftSide): boolean => wishlist.surpriseMode && surprisedSide(wishlist) === side;

/** A claim or pledge this side may never see. */
export const giftHidden = (wishlist: WishlistRecord, gift: Pick<ClaimRecord, 'surprise' | 'surpriseFor'>, side: GiftSide): boolean =>
  activityHidden(wishlist, side) || (gift.surprise && (gift.surpriseFor ?? 'owner') === side);

export async function getClaimsDoc(wishlistId: string): Promise<ClaimsDoc> {
  const res = await db('claims').get<ClaimsDoc>(wishlistId);
  return res?.value ?? emptyDoc(wishlistId);
}

/** A claim is active unless it's a reservation whose expiry has passed. */
export function activeClaim(claim: ClaimRecord | undefined, at: Date = now()): ClaimRecord | null {
  if (!claim) return null;
  if (claim.status === 'reserved' && claim.expiresAt && new Date(claim.expiresAt) <= at) return null;
  return claim;
}

export async function clearEntryActivity(wishlistId: string, entryIds: string[]): Promise<void> {
  if (!entryIds.length) return;
  await atomicUpdateExisting<ClaimsDoc>(db('claims'), wishlistId, (doc) => {
    for (const id of entryIds) {
      delete doc.claims[id];
      delete doc.pledges[id];
    }
    return doc;
  });
}

function findEntry(wishlist: WishlistRecord, entryId: string) {
  const entry = wishlist.entries.find((e) => e.id === entryId);
  if (!entry) throw notFound('That item is no longer on this list.');
  return entry;
}

/** Collections show things the owner already has; nothing on them can be reserved or chipped in for. */
function assertGiftable(wishlist: WishlistRecord): void {
  if (isCollection(wishlist)) throw new HttpError(403, 'This is a collection of things the owner already has — there’s nothing to reserve.', 'collection');
}

export async function claimEntry(
  wishlist: WishlistRecord,
  entryId: string,
  input: z.infer<typeof claimSchema>,
): Promise<{ claimToken: string; claim: ClaimRecord }> {
  assertGiftable(wishlist);
  const entry = findEntry(wishlist, entryId);
  if (!wishlist.settings.allowClaims) throw forbidden('The owner has turned off reservations for this list.');
  if (entry.groupGift) throw badRequest('This is a group gift — join the group instead of reserving it.');
  if (input.markPurchased && !wishlist.settings.allowMarkPurchased) {
    throw forbidden('The owner has turned off purchase tracking for this list.');
  }

  const claimToken = newToken();
  const at = now();
  const stamp = at.toISOString();
  const days = wishlist.settings.reservationDays;
  const claim: ClaimRecord = {
    id: newId(),
    entryId,
    status: input.markPurchased ? 'purchased' : 'reserved',
    claimantName: input.name ?? '',
    claimantContact: input.contact ?? '',
    message: wishlist.settings.allowMessages ? (input.message ?? '') : '',
    tokenHash: sha256(claimToken),
    surprise: wishlist.surpriseMode,
    surpriseFor: surprisedSide(wishlist),
    reservedAt: stamp,
    expiresAt: input.markPurchased || days === 0 ? null : new Date(at.getTime() + days * 86_400_000).toISOString(),
    purchasedAt: input.markPurchased ? stamp : null,
    createdAt: stamp,
    updatedAt: stamp,
  };

  // Atomic check-and-set (see module comment).
  await atomicUpdate<ClaimsDoc>(db('claims'), wishlist.id, (current) => {
    const doc = current ?? emptyDoc(wishlist.id);
    const existing = activeClaim(doc.claims[entryId], at);
    if (existing) {
      throw conflict(
        existing.status === 'purchased' ? 'This item has already been purchased.' : 'Someone is already getting this item.',
        'already_claimed',
      );
    }
    doc.claims[entryId] = claim;
    return doc;
  });
  return { claimToken, claim };
}

/** Verify a claimant's bearer token and apply `mutate` to their claim atomically. */
async function withClaimToken(
  wishlistId: string,
  entryId: string,
  claimToken: string,
  mutate: (doc: ClaimsDoc, claim: ClaimRecord) => void,
): Promise<ClaimsDoc> {
  const tokenHash = sha256(claimToken);
  const doc = await atomicUpdateExisting<ClaimsDoc>(db('claims'), wishlistId, (d) => {
    const claim = activeClaim(d.claims[entryId]);
    if (!claim || !safeEqual(claim.tokenHash, tokenHash)) {
      throw notFound('We couldn’t find your reservation. It may have expired or been released.');
    }
    mutate(d, claim);
    return d;
  });
  if (!doc) throw notFound('We couldn’t find your reservation. It may have expired or been released.');
  return doc;
}

export async function releaseClaim(wishlist: WishlistRecord, entryId: string, claimToken: string): Promise<void> {
  await withClaimToken(wishlist.id, entryId, claimToken, (doc) => {
    delete doc.claims[entryId];
  });
}

export async function purchaseClaim(wishlist: WishlistRecord, entryId: string, claimToken: string): Promise<ClaimRecord> {
  if (!wishlist.settings.allowMarkPurchased) throw forbidden('The owner has turned off purchase tracking for this list.');
  const doc = await withClaimToken(wishlist.id, entryId, claimToken, (d, claim) => {
    const stamp = nowIso();
    d.claims[entryId] = { ...claim, status: 'purchased', purchasedAt: stamp, expiresAt: null, updatedAt: stamp };
  });
  return doc.claims[entryId];
}

/** Owner/editor manual reset — only for claims they are allowed to see. */
export async function ownerClearClaim(wishlist: WishlistRecord, entryId: string, side: GiftSide): Promise<void> {
  if (activityHidden(wishlist, side)) throw forbidden('Turn off Surprise Mode to manage reservations.');
  const doc = await atomicUpdateExisting<ClaimsDoc>(db('claims'), wishlist.id, (d) => {
    const claim = activeClaim(d.claims[entryId]);
    if (!claim || giftHidden(wishlist, claim, side)) throw notFound('There is no reservation you can manage on this item.');
    delete d.claims[entryId];
    return d;
  });
  if (!doc) throw notFound('There is no reservation you can manage on this item.');
}

// ── Group gifts ─────────────────────────────────────────────────────────────

export async function addPledge(
  wishlist: WishlistRecord,
  entryId: string,
  input: z.infer<typeof pledgeSchema>,
): Promise<{ pledgeToken: string; pledge: PledgeRecord }> {
  assertGiftable(wishlist);
  const entry = findEntry(wishlist, entryId);
  if (!entry.groupGift) throw badRequest('This item is not a group gift.');
  if (!wishlist.settings.allowClaims) throw forbidden('The owner has turned off gift coordination for this list.');
  const pledgeToken = newToken();
  let pledge: PledgeRecord | null = null;
  await atomicUpdate<ClaimsDoc>(db('claims'), wishlist.id, (current) => {
    const doc = current ?? emptyDoc(wishlist.id);
    if (activeClaim(doc.claims[entryId])?.status === 'purchased') throw conflict('This group gift has already been purchased.');
    const list = doc.pledges[entryId] ?? [];
    if (list.length >= 100) throw conflict('This group gift has reached its participant limit.');
    const hasCoordinator = list.some((p) => p.role === 'coordinator');
    pledge = {
      id: newId(),
      entryId,
      name: input.name,
      contact: input.contact ?? '',
      message: wishlist.settings.allowMessages ? (input.message ?? '') : '',
      role: input.coordinator && !hasCoordinator ? 'coordinator' : 'contributor',
      tokenHash: sha256(pledgeToken),
      surprise: wishlist.surpriseMode,
      surpriseFor: surprisedSide(wishlist),
      amount: null,
      createdAt: nowIso(),
    };
    doc.pledges[entryId] = [...list, pledge];
    return doc;
  });
  return { pledgeToken, pledge: pledge! };
}

export async function withdrawPledge(wishlist: WishlistRecord, entryId: string, pledgeToken: string): Promise<void> {
  const tokenHash = sha256(pledgeToken);
  const doc = await atomicUpdateExisting<ClaimsDoc>(db('claims'), wishlist.id, (d) => {
    const list = d.pledges[entryId] ?? [];
    const idx = list.findIndex((p) => safeEqual(p.tokenHash, tokenHash));
    if (idx < 0) throw notFound('We couldn’t find your pledge.');
    list.splice(idx, 1);
    d.pledges[entryId] = list;
    return d;
  });
  if (!doc) throw notFound('We couldn’t find your pledge.');
}

/** The group-gift coordinator marks the gift as bought. */
export async function coordinatorPurchase(wishlist: WishlistRecord, entryId: string, pledgeToken: string): Promise<void> {
  findEntry(wishlist, entryId);
  const tokenHash = sha256(pledgeToken);
  const doc = await atomicUpdateExisting<ClaimsDoc>(db('claims'), wishlist.id, (d) => {
    const pledge = (d.pledges[entryId] ?? []).find((p) => safeEqual(p.tokenHash, tokenHash));
    if (!pledge || pledge.role !== 'coordinator') throw forbidden('Only the group coordinator can mark this as purchased.');
    const stamp = nowIso();
    d.claims[entryId] = {
      id: newId(),
      entryId,
      status: 'purchased',
      claimantName: pledge.name,
      claimantContact: pledge.contact,
      message: '',
      tokenHash,
      surprise: wishlist.surpriseMode,
      surpriseFor: surprisedSide(wishlist),
      reservedAt: stamp,
      expiresAt: null,
      purchasedAt: stamp,
      createdAt: stamp,
      updatedAt: stamp,
    };
    return d;
  });
  if (!doc) throw forbidden('Only the group coordinator can mark this as purchased.');
}

// ── Owner-facing views (Surprise Mode enforced here) ────────────────────────

/** Gift activity for one side of the list; null when Surprise Mode is hiding all of it from them. */
export function ownerClaimViews(
  wishlist: WishlistRecord,
  doc: ClaimsDoc,
  side: GiftSide,
): { claims: OwnerClaimView[]; pledges: OwnerPledgeView[] } | null {
  if (activityHidden(wishlist, side)) return null;
  const entryIds = new Set(wishlist.entries.map((e) => e.id));
  const at = now();
  const claims: OwnerClaimView[] = [];
  for (const raw of Object.values(doc.claims)) {
    const c = activeClaim(raw, at);
    if (!c || giftHidden(wishlist, c, side) || !entryIds.has(c.entryId)) continue;
    claims.push({
      entryId: c.entryId,
      status: c.status,
      claimantName: c.claimantName,
      message: c.message,
      reservedAt: c.reservedAt,
      expiresAt: c.expiresAt,
      purchasedAt: c.purchasedAt,
    });
  }
  const pledges: OwnerPledgeView[] = [];
  for (const [entryId, list] of Object.entries(doc.pledges)) {
    if (!entryIds.has(entryId)) continue;
    for (const p of list) {
      if (giftHidden(wishlist, p, side)) continue;
      pledges.push({ entryId, name: p.name, message: p.message, role: p.role, createdAt: p.createdAt });
    }
  }
  return { claims, pledges };
}
