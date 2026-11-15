import { beforeEach, describe, expect, it } from 'vitest';
import { createItem, createList, freshStore, signUp } from './helpers';

beforeEach(freshStore);

describe('Favorites', () => {
  it('stars a list, item, and box and lists them on Favorites', async () => {
    const { agent } = await signUp();
    const list = await createList(agent, { title: 'Birthday' });
    const item = await createItem(agent, { wishlistIds: [list.id] });
    const box = await agent.post('/api/boxes', { name: 'Garage', coverArt: { icon: 'box', backdrop: 'sky' } });
    expect(box.status).toBe(201);

    expect((await agent.post('/api/favorites', { targetType: 'wishlist', targetId: list.id })).status).toBe(201);
    expect((await agent.post('/api/favorites', { targetType: 'item', targetId: item.id })).status).toBe(201);
    expect((await agent.post('/api/favorites', { targetType: 'box', targetId: box.data.box.id })).status).toBe(201);

    // Idempotent — starring again keeps a single entry.
    expect((await agent.post('/api/favorites', { targetType: 'wishlist', targetId: list.id })).status).toBe(201);

    const page = await agent.get('/api/favorites');
    expect(page.status).toBe(200);
    expect(page.data.favorites).toHaveLength(3);
    expect(page.data.favorites.map((f: { entry: { targetType: string } }) => f.entry.targetType).sort()).toEqual([
      'box',
      'item',
      'wishlist',
    ]);
    expect(page.data.favorites.find((f: { wishlist: { title: string } | null }) => f.wishlist)?.wishlist.title).toBe('Birthday');

    const index = await agent.get('/api/favorites/index');
    expect(index.data.favorites).toHaveLength(3);

    const favId = page.data.favorites.find((f: { entry: { targetType: string } }) => f.entry.targetType === 'item').entry.id;
    expect((await agent.del(`/api/favorites/${favId}`)).status).toBe(200);
    expect((await agent.get('/api/favorites')).data.favorites).toHaveLength(2);
  });

  it('rejects starring someone else’s item', async () => {
    const a = await signUp(undefined, { username: 'ava' });
    const b = await signUp(undefined, { username: 'leo' });
    const item = await createItem(a.agent);
    const refused = await b.agent.post('/api/favorites', { targetType: 'item', targetId: item.id });
    expect(refused.status).toBe(404);
  });
});
