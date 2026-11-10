import { friendRequestSchema, idSchema, peopleSearchSchema } from '../../shared/schemas';
import { db } from '../storage';
import { json, notFound, readJson, type Router } from '../http';
import type { UserRecord } from '../records';
import { requireUser } from '../services/auth';
import { notify } from '../services/notifications';
import { sendEmail } from '../services/email';
import { rateLimit } from '../services/rateLimit';
import { toSelfUser } from '../serialize';
import { appUrl } from '../util';
import { acceptFriendRequest, friendProfile, friendsOverview, removeFriendship, searchPeople, sendFriendRequest } from '../domain/friends';
import { BRAND_NAME } from '../brand';

const FRIENDS_LINK = '/app/friends';

async function findByUsername(username: string): Promise<UserRecord | null> {
  const idx = await db('username-index').get<{ userId: string }>(username);
  return idx ? ((await db('users').get<UserRecord>(idx.value.userId))?.value ?? null) : null;
}

function parseUserId(raw: string): string {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) throw notFound('That person could not be found.');
  return parsed.data;
}

async function notifyRequest(from: UserRecord, to: UserRecord, req: Request) {
  await notify(to.id, 'friend_request', `${from.displayName} (@${from.username}) sent you a friend request.`, FRIENDS_LINK);
  if (toSelfUser(to).preferences.notifications.emailSharing) {
    await sendEmail({
      to: to.email,
      subject: `${from.displayName} wants to be friends on ${BRAND_NAME}`,
      paragraphs: [
        `${from.displayName} (@${from.username}) sent you a friend request.`,
        'Friends can browse the wishlists you choose to share with them, so gift ideas are always easy to find.',
      ],
      action: { label: 'See friend request', url: `${appUrl(req)}${FRIENDS_LINK}` },
    });
  }
}

const notifyAccepted = (accepter: UserRecord, requesterId: string) =>
  notify(requesterId, 'friend_accepted', `${accepter.displayName} accepted your friend request.`, `${FRIENDS_LINK}/${accepter.id}`);

export function registerFriendRoutes(router: Router) {
  router.get('/api/friends', async (ctx) => {
    const user = await requireUser(ctx);
    return json(await friendsOverview(user.id));
  });

  router.get('/api/friends/search', async (ctx) => {
    const user = await requireUser(ctx);
    const url = new URL(ctx.req.url);
    const parsed = peopleSearchSchema.safeParse({ q: url.searchParams.get('q') ?? '' });
    if (!parsed.success) return json({ people: [] });
    return json({ people: await searchPeople(user.id, parsed.data.q) });
  });

  router.post('/api/friends/requests', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('friend', user.id);
    const { username } = await readJson(ctx.req, friendRequestSchema);
    const target = await findByUsername(username);
    if (!target) throw notFound('No one has that username. Check the spelling and try again.');
    const outcome = await sendFriendRequest(user, target);
    if (outcome === 'requested') await notifyRequest(user, target, ctx.req);
    if (outcome === 'accepted') await notifyAccepted(user, target.id);
    return json({ status: outcome, overview: await friendsOverview(user.id) }, outcome === 'requested' ? 201 : 200);
  });

  router.post('/api/friends/requests/:userId/accept', async (ctx) => {
    const user = await requireUser(ctx);
    const requesterId = parseUserId(ctx.params.userId);
    await acceptFriendRequest(user, requesterId);
    await notifyAccepted(user, requesterId);
    return json(await friendsOverview(user.id));
  });

  /** Decline an incoming request or cancel an outgoing one. */
  router.delete('/api/friends/requests/:userId', async (ctx) => {
    const user = await requireUser(ctx);
    await removeFriendship(user.id, parseUserId(ctx.params.userId), 'pending');
    return json(await friendsOverview(user.id));
  });

  router.get('/api/friends/:userId', async (ctx) => {
    const user = await requireUser(ctx);
    return json(await friendProfile(user.id, parseUserId(ctx.params.userId)));
  });

  router.delete('/api/friends/:userId', async (ctx) => {
    const user = await requireUser(ctx);
    await removeFriendship(user.id, parseUserId(ctx.params.userId), 'accepted');
    return json(await friendsOverview(user.id));
  });
}
