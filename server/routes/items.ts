import { gotItSchema, itemBulkCreateSchema, itemCreateSchema, itemMembershipSchema, itemUpdateSchema } from '../../shared/schemas';
import { PRIORITY_RANK } from '../../shared/constants';
import type { Priority } from '../../shared/types';
import { listOwnedWishlists } from '../domain/wishlists';
import { forbidden, json, notFound, readJson, type Router } from '../http';
import { requireUser } from '../services/auth';
import { canEditItem, createItem, createItems, deleteItem, getItem, listOwnedItems, markGotIt, requireEditableItem, setMemberships, updateItem } from '../domain/items';

export function registerItemRoutes(router: Router) {
  router.get('/api/items', async (ctx) => {
    const user = await requireUser(ctx);
    const [items, lists] = await Promise.all([listOwnedItems(user.id), listOwnedWishlists(user.id)]);
    // Highest priority each item has on any of the user's lists (for filtering).
    const priorities: Record<string, Priority> = {};
    for (const list of lists) {
      for (const entry of list.entries) {
        if (!entry.priority) continue;
        const current = priorities[entry.itemId];
        if (!current || PRIORITY_RANK[entry.priority] < PRIORITY_RANK[current]) priorities[entry.itemId] = entry.priority;
      }
    }
    return json({ items, priorities });
  });

  router.post('/api/items', async (ctx) => {
    const user = await requireUser(ctx);
    const input = await readJson(ctx.req, itemCreateSchema);
    const item = await createItem(user, input);
    return json({ item }, 201);
  });

  router.post('/api/items/bulk', async (ctx) => {
    const user = await requireUser(ctx);
    const input = await readJson(ctx.req, itemBulkCreateSchema);
    const items = await createItems(user, input);
    return json({ items }, 201);
  });

  router.get('/api/items/:id', async (ctx) => {
    const user = await requireUser(ctx);
    const item = await requireEditableItem(ctx.params.id, user);
    return json({ item });
  });

  router.patch('/api/items/:id', async (ctx) => {
    const user = await requireUser(ctx);
    const item = await requireEditableItem(ctx.params.id, user);
    const input = await readJson(ctx.req, itemUpdateSchema);
    return json({ item: await updateItem(item, input, user) });
  });

  router.delete('/api/items/:id', async (ctx) => {
    const user = await requireUser(ctx);
    const item = await getItem(ctx.params.id);
    if (!item) throw notFound('Item not found.');
    if (item.ownerId !== user.id) {
      if (await canEditItem(item, user)) throw forbidden('Only the owner can delete this item. Remove it from the list instead.');
      throw notFound('Item not found.');
    }
    await deleteItem(item);
    return json({ ok: true });
  });

  router.post('/api/items/:id/got-it', async (ctx) => {
    const user = await requireUser(ctx);
    const item = await getItem(ctx.params.id);
    if (!item || item.ownerId !== user.id) throw notFound('Item not found.');
    const input = await readJson(ctx.req, gotItSchema);
    return json(await markGotIt(item, user, input));
  });

  router.put('/api/items/:id/wishlists', async (ctx) => {
    const user = await requireUser(ctx);
    const item = await getItem(ctx.params.id);
    if (!item || item.ownerId !== user.id) throw notFound('Item not found.');
    const { wishlistIds } = await readJson(ctx.req, itemMembershipSchema);
    return json({ item: await setMemberships(item, user, wishlistIds) });
  });
}
