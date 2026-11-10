import type { PublicEntry, PublicProfileView, PublicWishlistView, Visibility } from '../../shared/types';
import { isCollection } from '../../shared/constants';
import { profileVisibilityOf } from '../../shared/profileVisibility';
import { db, getMany } from '../storage';
import { HttpError, notFound } from '../http';
import type { ItemRecord, ShareRecord, UserRecord, WishlistRecord } from '../records';
import { toPublicItem } from '../serialize';
import { getUserIndex } from '../services/auth';
import { activeClaim, activityHidden, getClaimsDoc, giftHidden, giftSide } from './claims';
import { areFriends } from './friends';
import { accessRole, getWishlist, publicPeople, resolveListRecipients, resolveRecipients } from './wishlists';

/**
 * Resolve a share token to a wishlist that may be shown anonymously.
 * Private lists, archived lists, revoked tokens and superseded tokens all
 * resolve to the same 404 so nothing can be inferred about them.
 */
export async function resolveShareToken(token: string): Promise<WishlistRecord> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw notFound('This wishlist link is invalid or has been turned off.');
  const share = await db('shares').get<ShareRecord>(token);
  if (!share || share.value.revokedAt) throw notFound('This wishlist link is invalid or has been turned off.');
  const wishlist = await getWishlist(share.value.wishlistId);
  if (!wishlist || wishlist.shareToken !== token || wishlist.visibility === 'private' || wishlist.archivedAt) {
    throw notFound('This wishlist link is invalid or has been turned off.');
  }
  return wishlist;
}

/**
 * Friends-only lists: the share token alone isn't enough, the viewer must be
 * signed in as the owner, a collaborator or an accepted friend of the owner
 * (or of any linked friend the list is made for).
 * Signed-in viewers get the owner's username in `fields.owner` so the page can
 * offer to send a friend request.
 */
export async function assertCanOpen(wishlist: WishlistRecord, viewer: UserRecord | null): Promise<void> {
  if (wishlist.visibility !== 'friends') return;
  if (!viewer) throw new HttpError(403, 'Sign in to see this wishlist. It’s only visible to friends.', 'friends_only');
  if (accessRole(wishlist, viewer.id) || (await areFriends(wishlist.ownerId, viewer.id))) return;
  for (const r of wishlist.recipients ?? []) if (r.userId && (await areFriends(r.userId, viewer.id))) return;
  const owner = (await db('users').get<UserRecord>(wishlist.ownerId))?.value;
  throw new HttpError(
    403,
    `Only ${owner?.displayName ?? 'the owner'}’s friends can see this wishlist.`,
    'friends_only',
    owner ? { owner: owner.username } : undefined,
  );
}

/**
 * Build the anonymous/visitor representation of a wishlist.
 *
 * Two authorization contexts:
 *  - the list's own sides (the owner and editors, or the linked friend it's
 *    made for, identified by session): claim state is withheld from whichever
 *    side Surprise Mode protects, and nothing is filtered out (hiding reserved
 *    items would itself leak claims).
 *  - visitors (anyone else, including viewer-collaborators): see claim state
 *    subject to the owner's visibility settings; never see contact details,
 *    claim tokens, or the owner's private notes.
 */
export async function buildPublicView(wishlist: WishlistRecord, viewer: UserRecord | null): Promise<PublicWishlistView> {
  const ownerRes = await db('users').get<UserRecord>(wishlist.ownerId);
  const owner = ownerRes?.value;
  const recipients = await resolveListRecipients(wishlist);
  const items = await getMany<ItemRecord>(
    db('items'),
    wishlist.entries.map((e) => e.itemId),
  );
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const doc = await getClaimsDoc(wishlist.id);
  const side = giftSide(wishlist, viewer?.id);
  const { settings } = wishlist;
  const collection = isCollection(wishlist);

  const entries: PublicEntry[] = [];
  for (const entry of wishlist.entries) {
    const item = itemMap.get(entry.itemId);
    if (!item) continue;
    if (collection) {
      // No gifting on collections: no claim state, pledges or priorities.
      const publicItem = toPublicItem(item);
      if (settings.showReviews === false && publicItem.owned) publicItem.owned = { ...publicItem.owned, rating: null, review: '' };
      entries.push({ id: entry.id, priority: null, customNotes: entry.customNotes, groupGift: false, groupGiftNote: '', item: publicItem, status: null, claim: null, pledges: [] });
      continue;
    }
    const claim = activeClaim(doc.claims[entry.id]);
    const pledges = doc.pledges[entry.id] ?? [];

    let status: PublicEntry['status'];
    let publicClaim: PublicEntry['claim'] = null;
    let publicPledges: PublicEntry['pledges'] = [];

    if (side) {
      const visible = !activityHidden(wishlist, side) && (!claim || !giftHidden(wishlist, claim, side));
      status = visible ? (claim?.status ?? 'available') : null;
      if (visible && claim) {
        publicClaim = {
          id: claim.id,
          name: claim.claimantName,
          message: claim.message,
          reservedAt: claim.reservedAt,
          expiresAt: claim.expiresAt,
          purchasedAt: claim.purchasedAt,
        };
      }
      if (!activityHidden(wishlist, side)) {
        publicPledges = pledges
          .filter((p) => !giftHidden(wishlist, p, side))
          .map((p) => ({ id: p.id, name: p.name, message: p.message, role: p.role, createdAt: p.createdAt }));
      }
    } else {
      status = claim?.status ?? 'available';
      if (status === 'reserved' && !settings.showReserved) continue;
      if (status === 'purchased' && !settings.showPurchased) continue;
      if (claim) {
        publicClaim = {
          id: claim.id,
          name: claim.claimantName,
          message: settings.allowMessages ? claim.message : '',
          reservedAt: claim.reservedAt,
          expiresAt: claim.expiresAt,
          purchasedAt: claim.purchasedAt,
        };
      }
      publicPledges = pledges.map((p) => ({
        id: p.id,
        name: p.name,
        message: settings.allowMessages ? p.message : '',
        role: p.role,
        createdAt: p.createdAt,
      }));
    }

    entries.push({
      id: entry.id,
      priority: settings.showPriorities || side ? entry.priority : null,
      customNotes: entry.customNotes,
      groupGift: entry.groupGift,
      groupGiftNote: entry.groupGiftNote,
      item: toPublicItem(item),
      status,
      claim: publicClaim,
      pledges: publicPledges,
    });
  }

  return {
    wishlist: {
      id: wishlist.id,
      kind: wishlist.kind ?? 'wishlist',
      title: wishlist.title,
      description: wishlist.description,
      coverImage: wishlist.coverImage,
      coverArt: wishlist.coverArt ?? null,
      accentColor: wishlist.accentColor,
      occasion: wishlist.occasion,
      eventDate: wishlist.eventDate,
      visibility: wishlist.visibility,
      surpriseMode: wishlist.surpriseMode,
      settings,
      updatedAt: wishlist.updatedAt,
    },
    owner: {
      id: wishlist.ownerId,
      username: owner?.username ?? 'deleted',
      displayName: owner?.displayName ?? 'Someone',
      avatarUrl: owner?.avatarUrl ?? null,
      bio: owner?.bio ?? '',
    },
    recipients: publicPeople(recipients),
    entries,
    viewer: { isOwner: side !== null, isRecipient: side === 'recipient', claimsHidden: side !== null && activityHidden(wishlist, side) },
  };
}

/**
 * A user's profile page. Always returns the person when the username exists.
 * Which lists appear depends on their profile visibility and the viewer:
 *  - public: anyone sees public lists
 *  - friends: friends (and the owner) see friends + public lists; others see none
 *  - private: nobody sees lists here (friends still use the in-app friend profile)
 */
export async function buildPublicProfile(rawUsername: string, viewer: UserRecord | null): Promise<PublicProfileView> {
  const username = rawUsername.toLowerCase();
  const idx = await db('username-index').get<{ userId: string }>(username);
  const user = idx ? (await db('users').get<UserRecord>(idx.value.userId))?.value : null;
  if (!user) throw notFound('This profile doesn’t exist.');

  const visibility = profileVisibilityOf(user);
  const isSelf = Boolean(viewer && viewer.id === user.id);
  const isFriend = Boolean(viewer && !isSelf && (await areFriends(viewer.id, user.id)));
  const canSeeLists =
    isSelf || visibility === 'public' || (visibility === 'friends' && isFriend);

  let wishlists: PublicProfileView['wishlists'] = [];
  if (canSeeLists) {
    const index = await getUserIndex(user.id);
    const allowed = new Set<Visibility>(['public']);
    if (isSelf || isFriend) allowed.add('friends');
    const lists = (await getMany<WishlistRecord>(db('wishlists'), index.wishlistIds)).filter(
      (w) => w.ownerId === user.id && allowed.has(w.visibility) && !w.archivedAt && w.shareToken,
    );
    const recipients = await resolveRecipients(lists);
    wishlists = lists.map((w) => ({
      kind: w.kind ?? 'wishlist',
      title: w.title,
      description: w.description,
      coverImage: w.coverImage,
      coverArt: w.coverArt ?? null,
      accentColor: w.accentColor,
      occasion: w.occasion,
      eventDate: w.eventDate,
      shareToken: w.shareToken!,
      itemCount: w.entries.length,
      updatedAt: w.updatedAt,
      recipients: publicPeople(recipients.get(w.id) ?? []),
    }));
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: visibility === 'private' && !isSelf ? '' : user.bio,
    },
    profileVisibility: visibility,
    viewer: { isSelf, isFriend, canSeeLists },
    wishlists,
  };
}
