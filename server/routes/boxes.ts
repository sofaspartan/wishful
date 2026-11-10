import { boxCreateSchema, boxItemsSchema, boxUpdateSchema } from '../../shared/schemas';
import { json, readJson, type Router } from '../http';
import { getCurrentUser, requireUser } from '../services/auth';
import { rateLimit } from '../services/rateLimit';
import {
  boxDetail,
  buildPublicBoxView,
  createBox,
  deleteBox,
  listOwnedBoxes,
  noteScan,
  packItems,
  regenerateBoxCode,
  requireOwnBox,
  resolveBoxCode,
  summarizeBoxes,
  updateBox,
} from '../domain/boxes';

/**
 * Storage boxes belong to one person; there are no collaborators. The printed
 * code is a capability for reading one box (see `/api/public/boxes/:code`).
 */
export function registerBoxRoutes(router: Router) {
  router.get('/api/boxes', async (ctx) => {
    const user = await requireUser(ctx);
    return json({ boxes: await summarizeBoxes(await listOwnedBoxes(user.id)) });
  });

  router.post('/api/boxes', async (ctx) => {
    const user = await requireUser(ctx);
    const input = await readJson(ctx.req, boxCreateSchema);
    return json(await boxDetail(await createBox(user, input)), 201);
  });

  router.post('/api/boxes/pack', async (ctx) => {
    const user = await requireUser(ctx);
    const { itemIds, boxId } = await readJson(ctx.req, boxItemsSchema);
    await packItems(user, itemIds, boxId);
    return json({ ok: true });
  });

  router.get('/api/boxes/:id', async (ctx) => {
    const user = await requireUser(ctx);
    return json(await boxDetail(await requireOwnBox(ctx.params.id, user)));
  });

  router.patch('/api/boxes/:id', async (ctx) => {
    const user = await requireUser(ctx);
    const box = await requireOwnBox(ctx.params.id, user);
    const input = await readJson(ctx.req, boxUpdateSchema);
    return json(await boxDetail(await updateBox(box, input)));
  });

  router.delete('/api/boxes/:id', async (ctx) => {
    const user = await requireUser(ctx);
    await deleteBox(await requireOwnBox(ctx.params.id, user));
    return json({ ok: true });
  });

  router.post('/api/boxes/:id/code', async (ctx) => {
    const user = await requireUser(ctx);
    const box = await requireOwnBox(ctx.params.id, user);
    return json(await boxDetail(await regenerateBoxCode(box)));
  });

  router.get('/api/public/boxes/:code', async (ctx) => {
    await rateLimit('boxScan', ctx.ip);
    const box = await resolveBoxCode(ctx.params.code);
    const view = await buildPublicBoxView(box, await getCurrentUser(ctx));
    await noteScan(box);
    return json(view);
  });
}
