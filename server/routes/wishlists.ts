import type { AccessRole, Item, Wishlist, WishlistDetail } from '../../shared/types';
import {
  collaboratorInviteSchema,
  collaboratorUpdateSchema,
  emailSchema,
  entryCreateSchema,
  entryUpdateSchema,
  moveEntrySchema,
  orderSchema,
  wishlistCreateSchema,
  wishlistUpdateSchema,
} from '../../shared/schemas';
import { atomicUpdate, db, getMany } from '../storage';
import { badRequest, conflict, json, notFound, readJson, type Router } from '../http';
import type { InviteRecord, ItemRecord, UserRecord, WishlistRecord } from '../records';
import { requireUser, updateUserIndex } from '../services/auth';
import { notify } from '../services/notifications';
import { sendEmail } from '../services/email';
import { rateLimit } from '../services/rateLimit';
import { toSelfUser } from '../serialize';
import { appUrl, nowIso, sha256 } from '../util';
import { isCollection } from '../../shared/constants';
import {
  applyCollectionRules,
  createWishlist,
  deleteWishlist,
  disableShareLink,
  duplicateWishlist,
  getUsers,
  listOwnedWishlists,
  listSharedWishlists,
  mutateWishlist,
  regenerateShareToken,
  reorderOwnedWishlists,
  requireWishlistAccess,
  summarize,
} from '../domain/wishlists';
import { addEntry, getItem, noteCollaboratorEdit, removeEntry, syncedItemConflict } from '../domain/items';
import { getClaimsDoc, ownerClaimViews, ownerClearClaim } from '../domain/claims';
import { BRAND_NAME } from '../brand';

/** Serialize a wishlist for an in-app viewer according to their role. */
function toWishlistDto(w: WishlistRecord, role: AccessRole): Wishlist {
  const { editNotices: _e, reminderSentFor: _r, ...rest } = w;
  return {
    ...rest,
    kind: w.kind ?? 'wishlist',
    shareToken: role === 'owner' || w.visibility !== 'private' ? w.shareToken : null,
    pendingInvites: role === 'owner' ? w.pendingInvites : [],
  };
}

async function buildDetail(w: WishlistRecord, role: AccessRole): Promise<WishlistDetail> {
  const items = await getMany<ItemRecord>(
    db('items'),
    w.entries.map((e) => e.itemId),
  );
  const users = await getUsers([w.ownerId, ...w.collaborators.map((c) => c.userId)]);
  const itemMap: Record<string, Item> = {};
  for (const item of items) {
    // Personal notes and what was paid are visible to the owner and editors, not viewers.
    itemMap[item.id] = role === 'viewer' ? { ...item, notes: '', owned: item.owned ? { ...item.owned, pricePaid: null } : (item.owned ?? null) } : item;
  }
  // Gift activity: only owner/editors, only outside Surprise Mode (enforced in ownerClaimViews).
  const activity = role === 'viewer' ? null : ownerClaimViews(w, await getClaimsDoc(w.id));
  const dto = toWishlistDto(w, role);
  dto.collaborators = w.collaborators.map((c) => ({ ...c, user: users.get(c.userId) }));
  return {
    wishlist: dto,
    items: itemMap,
    role,
    owner: users.get(w.ownerId)!,
    claims: activity?.claims ?? null,
    pledges: activity?.pledges ?? null,
  };
}

/** A synced set stays on its linked list until its row leaves the sheet. */
async function assertNotSyncedEntry(w: WishlistRecord, entryId: string): Promise<void> {
  if (!w.link) return;
  const entry = w.entries.find((e) => e.id === entryId);
  const item = entry ? await getItem(entry.itemId) : null;
  if (item?.source) throw syncedItemConflict(item);
}

async function addCollaborator(w: WishlistRecord, target: UserRecord, role: 'viewer' | 'editor', inviter: UserRecord) {
  const isNew = !w.collaborators.some((c) => c.userId === target.id);
  await mutateWishlist(w.id, (draft) => {
    const existing = draft.collaborators.find((c) => c.userId === target.id);
    if (existing) existing.role = role;
    else draft.collaborators.push({ userId: target.id, role, addedAt: nowIso() });
  });
  await updateUserIndex(target.id, (idx) => {
    if (!idx.sharedWishlistIds.includes(w.id)) idx.sharedWishlistIds.unshift(w.id);
  });
  if (!isNew) return;
  const link = `/app/lists/${w.id}`;
  await notify(target.id, 'shared_with_you', `${inviter.displayName} shared “${w.title}” with you.`, link);
  if (toSelfUser(target).preferences.notifications.emailSharing) {
    await sendEmail({
      to: target.email,
      subject: `${inviter.displayName} shared a wishlist with you`,
      paragraphs: [
        `${inviter.displayName} added you as ${role === 'editor' ? 'an editor' : 'a viewer'} on “${w.title}”.`,
        role === 'editor' ? 'You can add, edit and organise items on this list.' : 'You can view this list any time.',
      ],
      action: { label: 'Open wishlist', url: `${appUrl()}${link}` },
    });
  }
}

export function registerWishlistRoutes(router: Router) {
  router.get('/api/wishlists', async (ctx) => {
    const user = await requireUser(ctx);
    const lists = await listOwnedWishlists(user.id);
    return json({ wishlists: await summarize(lists, user.id) });
  });

  router.post('/api/wishlists', async (ctx) => {
    const user = await requireUser(ctx);
    const input = await readJson(ctx.req, wishlistCreateSchema);
    const w = await createWishlist(user, input);
    return json({ wishlist: toWishlistDto(w, 'owner') }, 201);
  });

  router.put('/api/wishlists/order', async (ctx) => {
    const user = await requireUser(ctx);
    const { ids } = await readJson(ctx.req, orderSchema);
    await reorderOwnedWishlists(user.id, ids);
    return json({ ok: true });
  });

  router.get('/api/shared', async (ctx) => {
    const user = await requireUser(ctx);
    const lists = await listSharedWishlists(user.id);
    return json({ wishlists: await summarize(lists, user.id) });
  });

  router.get('/api/wishlists/:id', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist, role } = await requireWishlistAccess(ctx.params.id, user, 'viewer');
    return json(await buildDetail(wishlist, role));
  });

  router.patch('/api/wishlists/:id', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'owner');
    const input = await readJson(ctx.req, wishlistUpdateSchema);
    let updated = await mutateWishlist(wishlist.id, (w) => {
      if (input.title !== undefined) w.title = input.title;
      if (input.description !== undefined) w.description = input.description;
      if (input.coverImage !== undefined) w.coverImage = input.coverImage;
      if (input.coverArt !== undefined) w.coverArt = input.coverArt;
      if (input.accentColor !== undefined) w.accentColor = input.accentColor;
      if (input.visibility !== undefined) w.visibility = input.visibility;
      if (input.occasion !== undefined) w.occasion = input.occasion;
      if (input.eventDate !== undefined) {
        if (input.eventDate !== w.eventDate) w.reminderSentFor = null;
        w.eventDate = input.eventDate;
      }
      if (input.surpriseMode !== undefined) w.surpriseMode = input.surpriseMode;
      if (input.settings) w.settings = { ...w.settings, ...input.settings };
      if (input.archived !== undefined) w.archivedAt = input.archived ? (w.archivedAt ?? nowIso()) : null;
      applyCollectionRules(w);
    });
    // A list that becomes shareable needs a link.
    if (updated.visibility !== 'private' && !updated.shareToken) updated = await regenerateShareToken(updated);
    return json(await buildDetail(updated, 'owner'));
  });

  router.delete('/api/wishlists/:id', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'owner');
    await deleteWishlist(wishlist);
    return json({ ok: true });
  });

  router.post('/api/wishlists/:id/duplicate', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'owner');
    const copy = await duplicateWishlist(wishlist, user);
    return json({ wishlist: toWishlistDto(copy, 'owner') }, 201);
  });

  router.post('/api/wishlists/:id/share/regenerate', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'owner');
    const updated = await regenerateShareToken(wishlist);
    return json({ shareToken: updated.shareToken });
  });

  router.post('/api/wishlists/:id/share/revoke', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'owner');
    await disableShareLink(wishlist);
    return json({ shareToken: null });
  });

  // ── Entries (wishlist ↔ item relationship) ────────────────────────────────

  router.post('/api/wishlists/:id/entries', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'editor');
    const input = await readJson(ctx.req, entryCreateSchema);
    const item = await getItem(input.itemId);
    if (!item || item.ownerId !== wishlist.ownerId) throw notFound('Item not found.');
    if (wishlist.link && item.source && !wishlist.entries.some((e) => e.itemId === item.id)) throw syncedItemConflict(item);
    await addEntry(wishlist.id, item, user.id, input);
    await noteCollaboratorEdit(wishlist, user);
    return json({ ok: true }, 201);
  });

  router.put('/api/wishlists/:id/entries/order', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'editor');
    const { ids } = await readJson(ctx.req, orderSchema);
    await mutateWishlist(wishlist.id, (w) => {
      const byId = new Map(w.entries.map((e) => [e.id, e]));
      if (ids.length !== byId.size || !ids.every((id) => byId.has(id))) {
        throw conflict('This list changed while you were reordering — refresh and try again.', 'stale_order');
      }
      w.entries = ids.map((id) => byId.get(id)!);
    });
    await noteCollaboratorEdit(wishlist, user);
    return json({ ok: true });
  });

  router.patch('/api/wishlists/:id/entries/:entryId', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'editor');
    const input = await readJson(ctx.req, entryUpdateSchema);
    if (input.groupGift && isCollection(wishlist)) throw badRequest('Collections don’t have group gifts.');
    await mutateWishlist(wishlist.id, (w) => {
      const entry = w.entries.find((e) => e.id === ctx.params.entryId);
      if (!entry) throw notFound('That item is no longer on this list.');
      if (input.priority !== undefined) entry.priority = input.priority;
      if (input.customNotes !== undefined) entry.customNotes = input.customNotes;
      if (input.groupGift !== undefined) entry.groupGift = input.groupGift;
      if (input.groupGiftNote !== undefined) entry.groupGiftNote = input.groupGiftNote;
      entry.updatedAt = nowIso();
    });
    await noteCollaboratorEdit(wishlist, user);
    return json({ ok: true });
  });

  router.delete('/api/wishlists/:id/entries/:entryId', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'editor');
    await assertNotSyncedEntry(wishlist, ctx.params.entryId);
    await removeEntry(wishlist.id, ctx.params.entryId);
    await noteCollaboratorEdit(wishlist, user);
    return json({ ok: true });
  });

  router.post('/api/wishlists/:id/entries/:entryId/move', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'editor');
    const { toWishlistId } = await readJson(ctx.req, moveEntrySchema);
    if (toWishlistId === wishlist.id) throw badRequest('Choose a different wishlist.');
    const { wishlist: target } = await requireWishlistAccess(toWishlistId, user, 'editor');
    if (target.ownerId !== wishlist.ownerId) throw badRequest('Items can only move between lists with the same owner.');
    const entry = wishlist.entries.find((e) => e.id === ctx.params.entryId);
    if (!entry) throw notFound('That item is no longer on this list.');
    const item = await getItem(entry.itemId);
    if (!item) throw notFound('Item not found.');
    if (item.source && (wishlist.link || target.link)) throw syncedItemConflict(item);
    await addEntry(target.id, item, user.id, { priority: entry.priority, customNotes: entry.customNotes });
    await removeEntry(wishlist.id, entry.id);
    await noteCollaboratorEdit(wishlist, user);
    return json({ ok: true });
  });

  router.post('/api/wishlists/:id/entries/:entryId/clear-claim', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'editor');
    await ownerClearClaim(wishlist, ctx.params.entryId);
    return json({ ok: true });
  });

  // ── Collaborators ─────────────────────────────────────────────────────────

  router.post('/api/wishlists/:id/collaborators', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'owner');
    await rateLimit('invite', user.id);
    const { identifier, role } = await readJson(ctx.req, collaboratorInviteSchema);
    const isEmail = identifier.includes('@');
    let targetId: string | null = null;
    let email: string | null = null;
    if (isEmail) {
      const parsed = emailSchema.safeParse(identifier);
      if (!parsed.success) throw badRequest('Enter a valid email address.', { identifier: 'Enter a valid email address.' });
      email = parsed.data;
      targetId = (await db('email-index').get<{ userId: string }>(sha256(email)))?.value.userId ?? null;
    } else {
      targetId = (await db('username-index').get<{ userId: string }>(identifier.toLowerCase().replace(/^@/, '')))?.value.userId ?? null;
      if (!targetId) throw notFound('No one with that username was found.');
    }
    if (targetId === user.id) throw badRequest("You already own this list.", { identifier: 'You already own this list.' });

    if (targetId) {
      const target = (await db('users').get<UserRecord>(targetId))?.value;
      if (!target) throw notFound('No one with that username was found.');
      await addCollaborator(wishlist, target, role, user);
    } else if (email) {
      // No account yet: keep a pending invite that is applied when they register.
      const inviteEmail = email;
      await mutateWishlist(wishlist.id, (w) => {
        w.pendingInvites = w.pendingInvites.filter((p) => p.email !== inviteEmail);
        w.pendingInvites.push({ email: inviteEmail, role, createdAt: nowIso() });
      });
      await atomicUpdate<InviteRecord>(db('invites'), sha256(inviteEmail), (doc) => {
        const invites = (doc?.invites ?? []).filter((i) => i.wishlistId !== wishlist.id);
        invites.push({ wishlistId: wishlist.id, role, invitedBy: user.id, createdAt: nowIso() });
        return { invites };
      });
      await sendEmail({
        to: inviteEmail,
        subject: `${user.displayName} invited you to a wishlist on ${BRAND_NAME}`,
        paragraphs: [
          `${user.displayName} would like you to collaborate on “${wishlist.title}”.`,
          `Create a free ${BRAND_NAME} account with this email address and the list will appear under “Shared with me”.`,
        ],
        action: { label: 'Create your account', url: `${appUrl(ctx.req)}/register?email=${encodeURIComponent(inviteEmail)}` },
      });
    }
    const fresh = await requireWishlistAccess(wishlist.id, user, 'owner');
    return json(await buildDetail(fresh.wishlist, 'owner'));
  });

  router.patch('/api/wishlists/:id/collaborators/:userId', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'owner');
    const { role } = await readJson(ctx.req, collaboratorUpdateSchema);
    const updated = await mutateWishlist(wishlist.id, (w) => {
      const c = w.collaborators.find((x) => x.userId === ctx.params.userId);
      if (!c) throw notFound('Collaborator not found.');
      c.role = role;
    });
    return json(await buildDetail(updated, 'owner'));
  });

  router.delete('/api/wishlists/:id/collaborators/:userId', async (ctx) => {
    const user = await requireUser(ctx);
    const targetId = ctx.params.userId;
    // Owners can remove anyone; collaborators can only remove themselves (leave).
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, targetId === user.id ? 'viewer' : 'owner');
    if (targetId === wishlist.ownerId) throw badRequest('The owner cannot be removed.');
    await mutateWishlist(wishlist.id, (w) => {
      w.collaborators = w.collaborators.filter((c) => c.userId !== targetId);
    });
    await updateUserIndex(targetId, (idx) => {
      idx.sharedWishlistIds = idx.sharedWishlistIds.filter((id) => id !== wishlist.id);
    });
    return json({ ok: true });
  });

  router.delete('/api/wishlists/:id/invites/:email', async (ctx) => {
    const user = await requireUser(ctx);
    const { wishlist } = await requireWishlistAccess(ctx.params.id, user, 'owner');
    const email = ctx.params.email.toLowerCase();
    const updated = await mutateWishlist(wishlist.id, (w) => {
      w.pendingInvites = w.pendingInvites.filter((p) => p.email !== email);
    });
    const key = sha256(email);
    const doc = await db('invites').get<InviteRecord>(key);
    if (doc) {
      const invites = doc.value.invites.filter((i) => i.wishlistId !== wishlist.id);
      if (invites.length) await db('invites').set(key, { invites });
      else await db('invites').delete(key);
    }
    return json(await buildDetail(updated, 'owner'));
  });
}
