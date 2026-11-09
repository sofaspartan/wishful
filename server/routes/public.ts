/**
 * Anonymous visitor endpoints. Authorization here is capability-based:
 *  - the share token in the URL grants *read* access to one non-private list
 *    (friends-only lists additionally require a signed-in friend);
 *  - a claim/pledge token (returned once, stored hashed) grants follow-up
 *    actions on that single claim/pledge.
 * Visitors never need an account, and no endpoint here can modify list
 * content or reveal owner-private data.
 */
import type { PublicProfileView } from '../../shared/types';
import { claimSchema, claimTokenSchema, pledgeSchema, pledgeTokenSchema } from '../../shared/schemas';
import { db, getMany } from '../storage';
import { forbidden, json, notFound, readJson, type RequestContext, type Router } from '../http';
import type { UserRecord, WishlistRecord } from '../records';
import { getCurrentUser, getUserIndex } from '../services/auth';
import { rateLimit } from '../services/rateLimit';
import { assertCanOpen, buildPublicView, resolveShareToken } from '../domain/publicView';
import { accessRole } from '../domain/wishlists';
import { addPledge, claimEntry, coordinatorPurchase, purchaseClaim, releaseClaim, withdrawPledge } from '../domain/claims';

/**
 * Starting a reservation or pledge requires being allowed to open the list.
 * Follow-up actions (release, purchase, withdraw) are authorized by the
 * claim/pledge token instead, so a giver can still tidy up after an unfriend.
 */
async function visitorList(ctx: RequestContext): Promise<WishlistRecord> {
  const wishlist = await resolveShareToken(ctx.params.token);
  const viewer = await getCurrentUser(ctx);
  await assertCanOpen(wishlist, viewer);
  const role = accessRole(wishlist, viewer?.id);
  if (role === 'owner' || role === 'editor') {
    throw forbidden("You can't reserve or pledge on a list you manage — that would spoil the surprise.");
  }
  return wishlist;
}

export function registerPublicRoutes(router: Router) {
  router.get('/api/public/lists/:token', async (ctx) => {
    const wishlist = await resolveShareToken(ctx.params.token);
    const viewer = await getCurrentUser(ctx);
    await assertCanOpen(wishlist, viewer);
    return json(await buildPublicView(wishlist, viewer));
  });

  router.post('/api/public/lists/:token/entries/:entryId/claim', async (ctx) => {
    await rateLimit('claim', ctx.ip);
    const wishlist = await visitorList(ctx);
    const input = await readJson(ctx.req, claimSchema);
    const { claimToken, claim } = await claimEntry(wishlist, ctx.params.entryId, input);
    return json({ claimToken, claimId: claim.id, status: claim.status, expiresAt: claim.expiresAt }, 201);
  });

  router.post('/api/public/lists/:token/entries/:entryId/release', async (ctx) => {
    await rateLimit('claim', ctx.ip);
    const wishlist = await resolveShareToken(ctx.params.token);
    const { claimToken } = await readJson(ctx.req, claimTokenSchema);
    await releaseClaim(wishlist, ctx.params.entryId, claimToken);
    return json({ ok: true });
  });

  router.post('/api/public/lists/:token/entries/:entryId/purchase', async (ctx) => {
    await rateLimit('claim', ctx.ip);
    const wishlist = await resolveShareToken(ctx.params.token);
    const { claimToken } = await readJson(ctx.req, claimTokenSchema);
    const claim = await purchaseClaim(wishlist, ctx.params.entryId, claimToken);
    return json({ status: claim.status, purchasedAt: claim.purchasedAt });
  });

  router.post('/api/public/lists/:token/entries/:entryId/pledges', async (ctx) => {
    await rateLimit('claim', ctx.ip);
    const wishlist = await visitorList(ctx);
    const input = await readJson(ctx.req, pledgeSchema);
    const { pledgeToken, pledge } = await addPledge(wishlist, ctx.params.entryId, input);
    return json({ pledgeToken, pledgeId: pledge.id, role: pledge.role }, 201);
  });

  router.post('/api/public/lists/:token/entries/:entryId/pledges/withdraw', async (ctx) => {
    await rateLimit('claim', ctx.ip);
    const wishlist = await resolveShareToken(ctx.params.token);
    const { pledgeToken } = await readJson(ctx.req, pledgeTokenSchema);
    await withdrawPledge(wishlist, ctx.params.entryId, pledgeToken);
    return json({ ok: true });
  });

  router.post('/api/public/lists/:token/entries/:entryId/group-purchased', async (ctx) => {
    await rateLimit('claim', ctx.ip);
    const wishlist = await resolveShareToken(ctx.params.token);
    const { pledgeToken } = await readJson(ctx.req, pledgeTokenSchema);
    await coordinatorPurchase(wishlist, ctx.params.entryId, pledgeToken);
    return json({ ok: true });
  });

  router.get('/api/public/users/:username', async (ctx) => {
    const username = ctx.params.username.toLowerCase();
    const idx = await db('username-index').get<{ userId: string }>(username);
    const user = idx ? (await db('users').get<UserRecord>(idx.value.userId))?.value : null;
    if (!user || !user.publicProfile) throw notFound('This profile is private or does not exist.');
    const index = await getUserIndex(user.id);
    const lists = await getMany<WishlistRecord>(db('wishlists'), index.wishlistIds);
    // Only explicitly *public* lists are listed. Unlisted/private never appear here.
    const view: PublicProfileView = {
      user: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, bio: user.bio },
      wishlists: lists
        .filter((w) => w.ownerId === user.id && w.visibility === 'public' && !w.archivedAt && w.shareToken)
        .map((w) => ({
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
        })),
    };
    return json(view);
  });
}
