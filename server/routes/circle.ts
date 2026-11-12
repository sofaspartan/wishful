import { circleCreateSchema, circleLinkSchema, circleUpdateSchema, idSchema } from '../../shared/schemas';
import {
  createCirclePerson,
  deleteCirclePerson,
  linkCirclePerson,
  listCircle,
  unlinkCirclePerson,
  updateCirclePerson,
} from '../domain/circle';
import { badRequest, json, notFound, readJson, type Router } from '../http';
import type { UserRecord } from '../records';
import { toSelfUser } from '../serialize';
import { requireUser } from '../services/auth';
import { sendEmail } from '../services/email';
import { notify } from '../services/notifications';
import { rateLimit } from '../services/rateLimit';
import { db } from '../storage';
import { appUrl } from '../util';
import { BRAND_NAME } from '../brand';

const FRIENDS_LINK = '/app/friends';

async function findByUsername(username: string): Promise<UserRecord | null> {
  const idx = await db('username-index').get<{ userId: string }>(username);
  return idx ? ((await db('users').get<UserRecord>(idx.value.userId))?.value ?? null) : null;
}

function parsePersonId(raw: string): string {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) throw notFound('That person isn’t in My Circle.');
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

export function registerCircleRoutes(router: Router) {
  router.get('/api/circle', async (ctx) => {
    const user = await requireUser(ctx);
    return json({ people: await listCircle(user.id) });
  });

  router.post('/api/circle', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('circle', user.id);
    const input = await readJson(ctx.req, circleCreateSchema);
    const person = await createCirclePerson(user.id, input);
    return json({ person }, 201);
  });

  router.patch('/api/circle/:id', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('circle', user.id);
    const input = await readJson(ctx.req, circleUpdateSchema);
    if (Object.keys(input).length === 0) throw badRequest('Nothing to update.');
    const person = await updateCirclePerson(user.id, parsePersonId(ctx.params.id), input);
    return json({ person });
  });

  router.delete('/api/circle/:id', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('circle', user.id);
    await deleteCirclePerson(user.id, parsePersonId(ctx.params.id));
    return json({ ok: true });
  });

  router.post('/api/circle/:id/link', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('friend', user.id);
    const personId = parsePersonId(ctx.params.id);
    const input = await readJson(ctx.req, circleLinkSchema);
    let target: UserRecord | null = null;
    if (input.userId) {
      target = (await db('users').get<UserRecord>(input.userId))?.value ?? null;
      if (!target) throw notFound('That account could not be found.');
    } else if (input.username) {
      target = await findByUsername(input.username);
      if (!target) throw notFound('No one has that username. Check the spelling and try again.');
    } else {
      throw badRequest('Choose someone to link.');
    }

    const result = await linkCirclePerson(user, personId, target);
    if (result.friendStatus === 'requested') await notifyRequest(user, target, ctx.req);
    if (result.friendStatus === 'accepted') await notifyAccepted(user, target.id);
    return json(result);
  });

  router.post('/api/circle/:id/unlink', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('circle', user.id);
    const person = await unlinkCirclePerson(user.id, parsePersonId(ctx.params.id));
    return json({ person });
  });
}
