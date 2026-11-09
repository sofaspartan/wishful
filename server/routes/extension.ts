import { extensionItemSchema } from '../../shared/schemas';
import { DEFAULT_PREFERENCES } from '../../shared/constants';
import type { ExtensionSession } from '../../shared/types';
import { listOwnedWishlists } from '../domain/wishlists';
import { createItem } from '../domain/items';
import { badRequest, json, notFound, readJson, type Router } from '../http';
import { requireUser } from '../services/auth';
import { rateLimit } from '../services/rateLimit';
import {
  browserLabel,
  createExtensionToken,
  listExtensionConnections,
  requireExtensionUser,
  revokeExtensionToken,
} from '../services/extensionTokens';
import { appUrl } from '../util';

export function registerExtensionRoutes(router: Router) {
  // ── Managed from the website (session cookie) ─────────────────────────────

  router.post('/api/extension/connect', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('extensionConnect', user.id);
    const { token, connection } = await createExtensionToken(user, browserLabel(ctx.req.headers.get('user-agent')));
    return json({ token, connection }, 201);
  });

  router.get('/api/extension/connections', async (ctx) => {
    const user = await requireUser(ctx);
    return json({ connections: await listExtensionConnections(user) });
  });

  router.delete('/api/extension/connections/:id', async (ctx) => {
    const user = await requireUser(ctx);
    if (!(await revokeExtensionToken(user.id, ctx.params.id))) throw notFound('That connection no longer exists.');
    return json({ ok: true });
  });

  // ── Called by the extension (bearer token) ────────────────────────────────

  router.get('/api/extension/session', async (ctx) => {
    const { user } = await requireExtensionUser(ctx);
    const lists = (await listOwnedWishlists(user.id)).filter((w) => !w.archivedAt);
    const body: ExtensionSession = {
      user: {
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
        currency: user.preferences?.currency ?? DEFAULT_PREFERENCES.currency,
      },
      lists: lists.map((w) => ({
        id: w.id,
        kind: w.kind ?? 'wishlist',
        title: w.title,
        coverImage: w.coverImage,
        coverArt: w.coverArt ?? null,
        accentColor: w.accentColor,
      })),
    };
    return json(body);
  });

  router.post('/api/extension/items', async (ctx) => {
    const { user } = await requireExtensionUser(ctx);
    await rateLimit('extensionSave', user.id);
    const input = await readJson(ctx.req, extensionItemSchema);
    const owned = new Set((await listOwnedWishlists(user.id)).map((w) => w.id));
    if (input.wishlistIds?.some((id) => !owned.has(id))) throw badRequest('Choose one of your own lists.');
    const item = await createItem(user, { ...input, type: input.externalUrl ? 'product' : 'custom' });
    const firstList = input.wishlistIds?.[0];
    const url = `${appUrl(ctx.req)}${firstList ? `/app/lists/${firstList}` : '/app/items'}`;
    return json({ item: { id: item.id, title: item.title }, url }, 201);
  });

  router.post('/api/extension/disconnect', async (ctx) => {
    const { user, tokenId } = await requireExtensionUser(ctx);
    await revokeExtensionToken(user.id, tokenId);
    return json({ ok: true });
  });
}
