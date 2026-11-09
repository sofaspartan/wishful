import { beforeEach, describe, expect, it } from 'vitest';
import { Agent, createList, freshStore, signUp } from './helpers';

beforeEach(freshStore);

const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

async function connect(agent: Agent): Promise<string> {
  const res = await agent.request('POST', '/api/extension/connect', {}, { 'user-agent': CHROME_MAC });
  expect(res.status).toBe(201);
  expect(res.data.token).toMatch(/^wfx_/);
  return res.data.token;
}

/** A client with no cookies that authenticates only with the extension token. */
function extension(token: string) {
  const agent = new Agent();
  const auth = { authorization: `Bearer ${token}` };
  return {
    get: (path: string) => agent.request('GET', path, undefined, auth),
    post: (path: string, body: unknown = {}) => agent.request('POST', path, body, auth),
  };
}

describe('browser extension', () => {
  it('connects only from a signed-in session', async () => {
    expect((await new Agent().post('/api/extension/connect')).status).toBe(401);
    const { agent } = await signUp();
    await connect(agent);
    const list = await agent.get('/api/extension/connections');
    expect(list.data.connections).toHaveLength(1);
    expect(list.data.connections[0]).toMatchObject({ label: 'Chrome on macOS', lastUsedAt: null });
    expect(JSON.stringify(list.data)).not.toContain('wfx_');
  });

  it('reads the user and their lists, then saves the page to chosen lists', async () => {
    const { agent } = await signUp(undefined, { displayName: 'Mia Rose' });
    const wishlist = await createList(agent, { title: 'Birthday 2027' });
    const collection = await createList(agent, { title: 'Vinyl', kind: 'collection' });
    const ext = extension(await connect(agent));

    const session = await ext.get('/api/extension/session');
    expect(session.status).toBe(200);
    expect(session.data.user.displayName).toBe('Mia Rose');
    expect(session.data.lists.map((l: any) => [l.title, l.kind])).toEqual(
      expect.arrayContaining([
        ['Birthday 2027', 'wishlist'],
        ['Vinyl', 'collection'],
      ]),
    );

    const saved = await ext.post('/api/extension/items', {
      title: 'Turntable',
      externalUrl: 'https://shop.example.com/turntable',
      imageUrl: 'https://shop.example.com/turntable.jpg',
      price: 249,
      currency: 'USD',
      wishlistIds: [wishlist.id, collection.id],
    });
    expect(saved.status).toBe(201);
    expect(saved.data.url).toMatch(new RegExp(`/app/lists/${wishlist.id}$`));

    const item = (await agent.get(`/api/items/${saved.data.item.id}`)).data.item;
    expect(item).toMatchObject({ title: 'Turntable', type: 'product', price: 249 });
    expect(item.owned).not.toBeNull();
    expect((await agent.get(`/api/wishlists/${wishlist.id}`)).data.wishlist.entries).toHaveLength(1);

    const touched = await agent.get('/api/extension/connections');
    expect(touched.data.connections[0].lastUsedAt).not.toBeNull();
  });

  it("can't save to someone else's list", async () => {
    const { agent } = await signUp();
    const other = await signUp();
    const theirs = await createList(other.agent);
    const ext = extension(await connect(agent));
    const res = await ext.post('/api/extension/items', { title: 'Sneakers', wishlistIds: [theirs.id] });
    expect(res.status).toBe(400);
  });

  it('is limited to the extension routes and still needs the CSRF header', async () => {
    const { agent } = await signUp();
    const token = await connect(agent);
    const ext = extension(token);
    expect((await ext.get('/api/wishlists')).status).toBe(401);
    expect((await ext.get('/api/items')).status).toBe(401);
    expect((await ext.post('/api/auth/change-password', { currentPassword: 'x', newPassword: 'y'.repeat(12) })).status).toBe(401);

    const res = await new Agent().request('POST', '/api/extension/items', { title: 'x' }, { authorization: `Bearer ${token}`, 'x-requested-with': '' });
    expect(res.status).toBe(403);
  });

  it('rejects malformed and forged tokens', async () => {
    const { agent, user } = await signUp();
    await connect(agent);
    expect((await extension('nonsense').get('/api/extension/session')).status).toBe(401);
    const forged = `wfx_${user.id}.${'A'.repeat(43)}`;
    expect((await extension(forged).get('/api/extension/session')).status).toBe(401);
  });

  it('stops working when disconnected from Settings or from the extension', async () => {
    const { agent } = await signUp();
    const first = extension(await connect(agent));
    const second = extension(await connect(agent));

    const [newest, older] = (await agent.get('/api/extension/connections')).data.connections;
    expect((await agent.del(`/api/extension/connections/${older.id}`)).status).toBe(200);
    expect((await first.get('/api/extension/session')).status).toBe(401);
    expect((await second.get('/api/extension/session')).status).toBe(200);

    expect((await second.post('/api/extension/disconnect')).status).toBe(200);
    expect((await second.get('/api/extension/session')).status).toBe(401);
    expect((await agent.get('/api/extension/connections')).data.connections).toHaveLength(0);
    expect((await agent.del(`/api/extension/connections/${newest.id}`)).status).toBe(404);
  });

  it('is disconnected by a password change', async () => {
    const { agent, creds } = await signUp();
    const ext = extension(await connect(agent));
    const changed = await agent.post('/api/auth/change-password', { currentPassword: creds.password, newPassword: 'a brand new passphrase' });
    expect(changed.status).toBe(200);
    expect((await ext.get('/api/extension/session')).status).toBe(401);
  });
});
