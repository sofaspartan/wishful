import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/storage';
import type { WishlistRecord } from '../server/records';
import { Agent, createItem, createList, freshStore, signUp } from './helpers';

beforeEach(freshStore);

describe('collections', () => {
  it('are created without gift features, and stay that way', async () => {
    const { agent } = await signUp();
    const c = await createList(agent, { title: 'Vinyl', kind: 'collection', surpriseMode: true, eventDate: '2027-01-01', occasion: 'Birthday', settings: { allowClaims: true } });
    expect(c.kind).toBe('collection');
    expect(c.surpriseMode).toBe(false);
    expect(c.eventDate).toBeNull();
    expect(c.occasion).toBe('');
    expect(c.settings.allowClaims).toBe(false);

    const patched = await agent.patch(`/api/wishlists/${c.id}`, { surpriseMode: true, settings: { allowClaims: true }, eventDate: '2027-05-05' });
    expect(patched.status).toBe(200);
    expect(patched.data.wishlist.surpriseMode).toBe(false);
    expect(patched.data.wishlist.settings.allowClaims).toBe(false);
    expect(patched.data.wishlist.eventDate).toBeNull();

    const lists = await agent.get('/api/wishlists');
    expect(lists.data.wishlists[0].kind).toBe('collection');
  });

  it('mark items as owned when they are added, and reject group gifts', async () => {
    const { agent } = await signUp();
    const c = await createList(agent, { kind: 'collection' });
    const item = await createItem(agent, { wishlistIds: [c.id] });
    expect(item.owned).toEqual({ acquiredOn: null, acquiredVia: null, pricePaid: null, condition: null, quantity: 1, rating: null, review: '' });

    const detail = await agent.get(`/api/wishlists/${c.id}`);
    const entryId = detail.data.wishlist.entries[0].id;
    expect((await agent.patch(`/api/wishlists/${c.id}/entries/${entryId}`, { groupGift: true })).status).toBe(400);

    const edited = await agent.patch(`/api/items/${item.id}`, { owned: { condition: 'like_new', quantity: 3, pricePaid: 18 } });
    expect(edited.data.item.owned).toMatchObject({ condition: 'like_new', quantity: 3, pricePaid: 18, acquiredOn: null });
    expect((await agent.patch(`/api/items/${item.id}`, { owned: { quantity: 0 } })).status).toBe(400);
  });

  it('cannot be reserved or pledged on, and never show claim state or what was paid', async () => {
    const { agent } = await signUp();
    const c = await createList(agent, { kind: 'collection', visibility: 'unlisted' });
    await createItem(agent, { wishlistIds: [c.id], owned: { pricePaid: 450, condition: 'good', acquiredOn: '2024-03-02' } });
    const detail = await agent.get(`/api/wishlists/${c.id}`);
    const entryId = detail.data.wishlist.entries[0].id;

    const visitor = new Agent('198.51.100.7');
    const view = await visitor.get(`/api/public/lists/${c.shareToken}`);
    expect(view.status).toBe(200);
    expect(view.data.wishlist.kind).toBe('collection');
    expect(view.data.entries[0].status).toBeNull();
    expect(view.data.entries[0].item.owned).toEqual({ acquiredOn: '2024-03-02', acquiredVia: null, condition: 'good', quantity: 1, rating: null, review: '' });
    expect(JSON.stringify(view.data)).not.toContain('pricePaid');

    const claim = await visitor.post(`/api/public/lists/${c.shareToken}/entries/${entryId}/claim`, { name: 'Ana' });
    expect(claim.status).toBe(403);
    expect(claim.data.error.code).toBe('collection');
    const pledge = await visitor.post(`/api/public/lists/${c.shareToken}/entries/${entryId}/pledges`, { name: 'Ana' });
    expect(pledge.status).toBe(403);
  });

  it('hide what was paid from viewer collaborators but not editors', async () => {
    const owner = await signUp();
    const viewer = await signUp(undefined, { username: 'vic_viewer' });
    const editor = await signUp(undefined, { username: 'ed_editor' });
    const c = await createList(owner.agent, { kind: 'collection', visibility: 'private' });
    const item = await createItem(owner.agent, { wishlistIds: [c.id], owned: { pricePaid: 99 } });
    await owner.agent.post(`/api/wishlists/${c.id}/collaborators`, { identifier: 'vic_viewer', role: 'viewer' });
    await owner.agent.post(`/api/wishlists/${c.id}/collaborators`, { identifier: 'ed_editor', role: 'editor' });

    const asViewer = await viewer.agent.get(`/api/wishlists/${c.id}`);
    expect(asViewer.data.items[item.id].owned.pricePaid).toBeNull();
    const asEditor = await editor.agent.get(`/api/wishlists/${c.id}`);
    expect(asEditor.data.items[item.id].owned.pricePaid).toBe(99);
  });
});

describe('got it', () => {
  it('files a wished-for item in a collection and takes it off the wishlist', async () => {
    const { agent } = await signUp();
    const wish = await createList(agent, { title: 'Birthday' });
    const shelf = await createList(agent, { title: 'Cameras', kind: 'collection' });
    const item = await createItem(agent, { wishlistIds: [wish.id], price: 129 });

    const res = await agent.post(`/api/items/${item.id}/got-it`, {
      collectionId: shelf.id,
      removeFromWishlistId: wish.id,
      owned: { acquiredOn: '2026-11-01', acquiredVia: 'gift', pricePaid: null, condition: 'new' },
    });
    expect(res.status).toBe(200);
    expect(res.data.collectionId).toBe(shelf.id);
    expect(res.data.item.owned).toMatchObject({ acquiredVia: 'gift', condition: 'new', quantity: 1 });
    expect(res.data.item.wishlistIds).toEqual([shelf.id]);
    expect((await agent.get(`/api/wishlists/${wish.id}`)).data.wishlist.entries).toHaveLength(0);
    expect((await agent.get(`/api/wishlists/${shelf.id}`)).data.wishlist.entries).toHaveLength(1);
  });

  it('can start a new private collection, and only accepts the owner’s own collections', async () => {
    const owner = await signUp();
    const other = await signUp();
    const wish = await createList(owner.agent);
    const item = await createItem(owner.agent, { wishlistIds: [wish.id] });

    expect((await owner.agent.post(`/api/items/${item.id}/got-it`, { collectionId: wish.id, owned: {} })).status).toBe(400);
    expect((await owner.agent.post(`/api/items/${item.id}/got-it`, { owned: {} })).status).toBe(400);
    const theirs = await createList(other.agent, { kind: 'collection' });
    expect((await owner.agent.post(`/api/items/${item.id}/got-it`, { collectionId: theirs.id, owned: {} })).status).toBe(404);
    expect((await other.agent.post(`/api/items/${item.id}/got-it`, { newCollectionTitle: 'Mine now', owned: {} })).status).toBe(404);

    const res = await owner.agent.post(`/api/items/${item.id}/got-it`, { newCollectionTitle: 'Things I have', owned: { quantity: 2 } });
    expect(res.status).toBe(200);
    const created = (await owner.agent.get(`/api/wishlists/${res.data.collectionId}`)).data.wishlist;
    expect(created).toMatchObject({ title: 'Things I have', kind: 'collection', visibility: 'private' });
    // Without removeFromWishlistId the item stays on its wishlist too.
    expect(res.data.item.wishlistIds.sort()).toEqual([wish.id, res.data.collectionId].sort());
  });
});

describe('lists saved before collections existed', () => {
  it('are treated as wishlists', async () => {
    const { agent } = await signUp();
    const w = await createList(agent);
    const store = db('wishlists');
    const stored = (await store.get<WishlistRecord>(w.id))!.value;
    delete stored.kind;
    await store.set(w.id, stored);

    expect((await agent.get('/api/wishlists')).data.wishlists[0].kind).toBe('wishlist');
    expect((await agent.get(`/api/wishlists/${w.id}`)).data.wishlist.kind).toBe('wishlist');
    const item = await createItem(agent, { wishlistIds: [w.id] });
    expect(item.owned).toBeNull();
    const detail = await agent.get(`/api/wishlists/${w.id}`);
    const claim = await new Agent('198.51.100.9').post(`/api/public/lists/${w.shareToken}/entries/${detail.data.wishlist.entries[0].id}/claim`, { name: 'Bo' });
    expect(claim.status).toBe(201);
  });
});
