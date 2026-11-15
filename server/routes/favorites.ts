import { favoriteCreateSchema, favoriteRemoveSchema, idSchema } from '../../shared/schemas';
import { addFavorite, favoriteIndex, listFavorites, removeFavorite } from '../domain/favorites';
import { json, notFound, readJson, type Router } from '../http';
import { requireUser } from '../services/auth';
import { rateLimit } from '../services/rateLimit';

function parseId(raw: string): string {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) throw notFound('Favorite not found.');
  return parsed.data;
}

export function registerFavoriteRoutes(router: Router) {
  router.get('/api/favorites', async (ctx) => {
    const user = await requireUser(ctx);
    return json({ favorites: await listFavorites(user) });
  });

  router.get('/api/favorites/index', async (ctx) => {
    const user = await requireUser(ctx);
    return json({ favorites: await favoriteIndex(user.id) });
  });

  router.post('/api/favorites', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('favorites', user.id);
    const input = await readJson(ctx.req, favoriteCreateSchema);
    const favorite = await addFavorite(user, input);
    return json({ favorite }, 201);
  });

  router.delete('/api/favorites/:id', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('favorites', user.id);
    await removeFavorite(user.id, { id: parseId(ctx.params.id) });
    return json({ ok: true });
  });

  router.delete('/api/favorites', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('favorites', user.id);
    const input = await readJson(ctx.req, favoriteRemoveSchema);
    await removeFavorite(user.id, input);
    return json({ ok: true });
  });
}
