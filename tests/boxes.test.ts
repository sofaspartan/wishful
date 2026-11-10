import { beforeEach, describe, expect, it } from 'vitest';
import { formatBoxCode, isBoxCode, normalizeBoxCode } from '../shared/types';
import { Agent, createItem, createList, freshStore, signUp } from './helpers';

beforeEach(freshStore);

async function createBox(agent: Agent, body: Record<string, unknown> = {}) {
  const res = await agent.post('/api/boxes', { name: 'Winter clothes', ...body });
  if (res.status !== 201) throw new Error(`create box failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.box;
}

describe('box codes', () => {
  it('are tidied the way people type them', () => {
    expect(normalizeBoxCode('7k3q-m9xp-a2cd')).toBe('7K3QM9XPA2CD');
    expect(normalizeBoxCode(' 7K3Q M9XP A2CD ')).toBe('7K3QM9XPA2CD');
    expect(normalizeBoxCode('OIL0')).toBe('0110');
    expect(isBoxCode('7K3QM9XPA2CD')).toBe(true);
    expect(isBoxCode('7K3QM9XPA2C')).toBe(false);
    expect(isBoxCode('7K3QM9XPA2CU')).toBe(false);
    expect(formatBoxCode('7K3QM9XPA2CD')).toBe('7K3Q-M9XP-A2CD');
  });
});

describe('boxes', () => {
  it('are numbered, get a code and sensible defaults, and can be edited', async () => {
    const { agent } = await signUp();
    const first = await createBox(agent);
    expect(first).toMatchObject({ number: 1, material: 'cardboard', access: 'link', showPrices: false, fragile: false, itemIds: [], lines: [] });
    expect(isBoxCode(first.code)).toBe(true);
    expect(first.coverArt.icon).toBe('box');

    const second = await createBox(agent, {
      name: 'Kitchen',
      material: 'plastic',
      room: 'Kitchen',
      fragile: true,
      lines: [{ text: 'Plates', quantity: 12 }],
    });
    expect(second.number).toBe(2);
    expect(second.coverArt.icon).toBe('tote');
    expect(second.lines).toEqual([{ id: expect.any(String), text: 'Plates', quantity: 12 }]);

    const edited = await agent.patch(`/api/boxes/${second.id}`, {
      location: 'Garage, shelf 2',
      color: '#5b8fd6',
      lines: [
        { id: second.lines[0].id, text: 'Plates', quantity: 10 },
        { text: 'Mugs', quantity: 4 },
      ],
    });
    expect(edited.status).toBe(200);
    expect(edited.data.box.location).toBe('Garage, shelf 2');
    expect(edited.data.box.lines.map((l: { id: string }) => l.id)[0]).toBe(second.lines[0].id);
    expect(edited.data.box.lines[1]).toMatchObject({ text: 'Mugs', quantity: 4 });

    const list = await agent.get('/api/boxes');
    expect(list.data.boxes.map((b: { name: string }) => b.name)).toEqual(['Winter clothes', 'Kitchen']);
    expect(list.data.boxes[1]).toMatchObject({ itemCount: 0, lineCount: 2 });
    expect(list.data.boxes[1].notes).toBeUndefined();
  });

  it('reject bad input', async () => {
    const { agent } = await signUp();
    expect((await agent.post('/api/boxes', { name: '' })).status).toBe(400);
    expect((await agent.post('/api/boxes', { name: 'A', color: 'red' })).status).toBe(400);
    expect((await agent.post('/api/boxes', { name: 'A', material: 'glass' })).status).toBe(400);
    expect((await agent.post('/api/boxes', { name: 'A', lines: [{ text: '', quantity: 1 }] })).status).toBe(400);
    expect((await agent.post('/api/boxes', { name: 'A', lines: [{ text: 'x', quantity: 0 }] })).status).toBe(400);
  });

  it('are private to their owner', async () => {
    const { agent } = await signUp();
    const { agent: other } = await signUp(new Agent('203.0.113.20'));
    const box = await createBox(agent);
    const item = await createItem(agent);
    expect((await other.get(`/api/boxes/${box.id}`)).status).toBe(404);
    expect((await other.patch(`/api/boxes/${box.id}`, { name: 'Mine now' })).status).toBe(404);
    expect((await other.del(`/api/boxes/${box.id}`)).status).toBe(404);
    expect((await other.post(`/api/boxes/${box.id}/code`)).status).toBe(404);
    expect((await other.get('/api/boxes')).data.boxes).toEqual([]);

    // Nobody can pack someone else's items, or pack into someone else's box.
    const theirItem = await createItem(other);
    expect((await other.post('/api/boxes/pack', { itemIds: [item.id], boxId: null })).status).toBe(404);
    expect((await other.post('/api/boxes/pack', { itemIds: [theirItem.id], boxId: box.id })).status).toBe(404);
    expect((await agent.post('/api/boxes/pack', { itemIds: [theirItem.id], boxId: box.id })).status).toBe(404);
  });

  it('hold each thing in only one box at a time', async () => {
    const { agent } = await signUp();
    const a = await createBox(agent, { name: 'A' });
    const b = await createBox(agent, { name: 'B' });
    const one = await createItem(agent, { title: 'Lamp' });
    const two = await createItem(agent, { title: 'Rug' });

    expect((await agent.post('/api/boxes/pack', { itemIds: [one.id, two.id], boxId: a.id })).status).toBe(200);
    let detail = await agent.get(`/api/boxes/${a.id}`);
    expect(detail.data.items.map((i: { title: string }) => i.title).sort()).toEqual(['Lamp', 'Rug']);
    expect((await agent.get(`/api/items/${one.id}`)).data.item.boxId).toBe(a.id);

    await agent.post('/api/boxes/pack', { itemIds: [one.id], boxId: b.id });
    detail = await agent.get(`/api/boxes/${a.id}`);
    expect(detail.data.items.map((i: { title: string }) => i.title)).toEqual(['Rug']);
    expect((await agent.get(`/api/boxes/${b.id}`)).data.items.map((i: { title: string }) => i.title)).toEqual(['Lamp']);

    await agent.post('/api/boxes/pack', { itemIds: [two.id], boxId: null });
    expect((await agent.get(`/api/boxes/${a.id}`)).data.items).toEqual([]);
    expect((await agent.get(`/api/items/${two.id}`)).data.item.boxId).toBeNull();
  });

  it('let go of deleted items, and deleting a box leaves its items unpacked', async () => {
    const { agent } = await signUp();
    const box = await createBox(agent);
    const keep = await createItem(agent, { title: 'Keep' });
    const gone = await createItem(agent, { title: 'Gone' });
    await agent.post('/api/boxes/pack', { itemIds: [keep.id, gone.id], boxId: box.id });
    await agent.del(`/api/items/${gone.id}`);
    expect((await agent.get(`/api/boxes/${box.id}`)).data.box.itemIds).toEqual([keep.id]);

    const { code } = box;
    expect((await agent.del(`/api/boxes/${box.id}`)).status).toBe(200);
    expect((await agent.get(`/api/items/${keep.id}`)).data.item.boxId).toBeNull();
    expect((await new Agent().get(`/api/public/boxes/${code}`)).status).toBe(404);
  });
});

describe('scanning a box', () => {
  it('shows what is inside to anyone with the code, without prices, notes or where it is kept', async () => {
    const { agent } = await signUp();
    const collection = await createList(agent, { kind: 'collection' });
    const box = await createBox(agent, {
      location: 'Storage unit 14',
      notes: 'Spare key under the mat',
      room: 'Office',
      lines: [{ text: 'Winter blankets', quantity: 3 }],
    });
    const item = await createItem(agent, {
      title: 'Camera',
      price: 899,
      notes: 'Serial 12345',
      wishlistIds: [collection.id],
      owned: { pricePaid: 750, rating: 5, review: 'Love it' },
    });
    await agent.post('/api/boxes/pack', { itemIds: [item.id], boxId: box.id });

    const visitor = new Agent('198.51.100.7');
    const res = await visitor.get(`/api/public/boxes/${formatBoxCode(box.code).toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(res.data.viewer.isOwner).toBe(false);
    expect(res.data.box).toMatchObject({ id: null, name: 'Winter clothes', room: 'Office', location: null });
    expect(res.data.box.notes).toBeUndefined();
    expect(res.data.lines).toEqual([expect.objectContaining({ text: 'Winter blankets', quantity: 3 })]);
    const [seen] = res.data.items;
    expect(seen.title).toBe('Camera');
    expect(seen.price).toBeNull();
    expect(seen.notes).toBeUndefined();
    expect(seen.boxId).toBeUndefined();
    expect(seen.wishlistIds).toBeUndefined();
    expect(seen.owned.pricePaid).toBeUndefined();
    expect(seen.owned.review).toBe('');
    expect(JSON.stringify(res.data)).not.toContain('Spare key');
    expect(JSON.stringify(res.data)).not.toContain('Storage unit 14');

    // The owner can choose to show prices.
    await agent.patch(`/api/boxes/${box.id}`, { showPrices: true });
    expect((await visitor.get(`/api/public/boxes/${box.code}`)).data.items[0].price).toBe(899);

    // The owner, signed in, sees everything and gets a way back to the box.
    const own = await agent.get(`/api/public/boxes/${box.code}`);
    expect(own.data.viewer.isOwner).toBe(true);
    expect(own.data.box).toMatchObject({ id: box.id, location: 'Storage unit 14' });
    expect((await agent.get(`/api/boxes/${box.id}`)).data.box.lastScannedAt).not.toBeNull();
  });

  it('keeps owner-only boxes closed to everyone else', async () => {
    const { agent } = await signUp();
    const box = await createBox(agent, { access: 'owner' });
    const anon = await new Agent('198.51.100.8').get(`/api/public/boxes/${box.code}`);
    expect(anon.status).toBe(403);
    expect(anon.data.error.code).toBe('box_private');
    const { agent: other } = await signUp(new Agent('198.51.100.9'));
    expect((await other.get(`/api/public/boxes/${box.code}`)).status).toBe(403);
    expect((await agent.get(`/api/public/boxes/${box.code}`)).status).toBe(200);
  });

  it('stops working with the old code once a new one is made', async () => {
    const { agent } = await signUp();
    const box = await createBox(agent);
    const fresh = await agent.post(`/api/boxes/${box.id}/code`);
    expect(fresh.data.box.code).not.toBe(box.code);
    const visitor = new Agent('198.51.100.10');
    expect((await visitor.get(`/api/public/boxes/${box.code}`)).status).toBe(404);
    expect((await visitor.get(`/api/public/boxes/${fresh.data.box.code}`)).status).toBe(200);
    expect((await visitor.get('/api/public/boxes/not-a-code')).status).toBe(404);
  });
});
