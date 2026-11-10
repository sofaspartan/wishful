import { brickfolioConnectSchema } from '../../shared/schemas';
import { json, readJson, type Router } from '../http';
import { requireUser } from '../services/auth';
import { connectBrickfolio, disconnectBrickfolio, getBrickfolioLink, requireIntegrationAccess, syncBrickfolio, toStatus } from '../integrations/brickfolio';

export function registerIntegrationRoutes(router: Router) {
  router.get('/api/integrations/brickfolio', async (ctx) => {
    const user = await requireUser(ctx);
    requireIntegrationAccess(user);
    return json({ status: toStatus(await getBrickfolioLink(user.id)), changed: false });
  });

  router.put('/api/integrations/brickfolio', async (ctx) => {
    const user = await requireUser(ctx);
    requireIntegrationAccess(user);
    const input = await readJson(ctx.req, brickfolioConnectSchema);
    return json(await connectBrickfolio(user, input));
  });

  router.post('/api/integrations/brickfolio/sync', async (ctx) => {
    const user = await requireUser(ctx);
    return json(await syncBrickfolio(user, { ifStale: ctx.url.searchParams.get('ifStale') === '1' }));
  });

  router.delete('/api/integrations/brickfolio', async (ctx) => {
    const user = await requireUser(ctx);
    await disconnectBrickfolio(user);
    return json({ status: toStatus(null), changed: true });
  });
}
