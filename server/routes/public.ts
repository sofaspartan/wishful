/**
 * Anonymous visitor endpoints. Authorization here is capability-based:
 *  - the share token in the URL grants *read* access to one non-private list
 *    (friends-only lists additionally require a signed-in friend);
 *  - a claim/pledge token (returned once, stored hashed) grants follow-up
 *    actions on that single claim/pledge.
 * Visitors never need an account, and no endpoint here can modify list
 * content or reveal owner-private data.
 */
import { claimSchema, claimTokenSchema, contributionSchema, contributionTokenSchema, pledgeSchema, pledgeTokenSchema } from '../../shared/schemas';
import { forbidden, json, notFound, readJson, type RequestContext, type Router } from '../http';
import type { UserRecord, WishlistRecord } from '../records';
import { db } from '../storage';
import { getCurrentUser } from '../services/auth';
import { rateLimit } from '../services/rateLimit';
import { assertCanOpen, buildPublicProfile, buildPublicView, resolveShareToken } from '../domain/publicView';
import {
  addContribution,
  addPledge,
  claimEntry,
  coordinatorPurchase,
  giftSide,
  purchaseClaim,
  releaseClaim,
  withdrawContribution,
  withdrawPledge,
} from '../domain/claims';

/**
 * Starting a reservation or pledge requires being allowed to open the list.
 * Follow-up actions (release, purchase, withdraw) are authorized by the
 * claim/pledge token instead, so a giver can still tidy up after an unfriend.
 */
async function visitorList(ctx: RequestContext): Promise<WishlistRecord> {
  const wishlist = await resolveShareToken(ctx.params.token);
  const viewer = await getCurrentUser(ctx);
  await assertCanOpen(wishlist, viewer);
  const side = giftSide(wishlist, viewer?.id);
  if (side === 'recipient') throw forbidden("This list is for you — you can't reserve or chip in for your own gifts.");
  if (side === 'owner') throw forbidden("You can't reserve or pledge on a list you manage — that would spoil the surprise.");
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

  router.post('/api/public/lists/:token/contributions', async (ctx) => {
    await rateLimit('claim', ctx.ip);
    const wishlist = await visitorList(ctx);
    const owner = (await db('users').get<UserRecord>(wishlist.ownerId))?.value;
    if (!owner) throw notFound('This wishlist link is invalid or has been turned off.');
    const input = await readJson(ctx.req, contributionSchema);
    const { contributionToken, contribution } = await addContribution(wishlist, owner, input);
    return json(
      {
        contributionToken,
        contributionId: contribution.id,
        amountCents: contribution.amountCents,
        provider: contribution.provider,
        createdAt: contribution.createdAt,
      },
      201,
    );
  });

  router.post('/api/public/lists/:token/contributions/withdraw', async (ctx) => {
    await rateLimit('claim', ctx.ip);
    const wishlist = await resolveShareToken(ctx.params.token);
    const { contributionToken } = await readJson(ctx.req, contributionTokenSchema);
    await withdrawContribution(wishlist, contributionToken);
    return json({ ok: true });
  });

  router.get('/api/public/users/:username', async (ctx) => {
    const viewer = await getCurrentUser(ctx);
    return json(await buildPublicProfile(ctx.params.username, viewer));
  });
}
