import { beforeEach, describe, expect, it } from 'vitest';
import { Agent, createItem, createList, freshStore, signUp } from './helpers';
import { advanceClock } from '../server/util';

beforeEach(freshStore);

async function setup(listBody: Record<string, unknown> = {}) {
  const { agent: owner, user } = await signUp();
  const list = await createList(owner, { visibility: 'unlisted', surpriseMode: true, ...listBody });
  const item = await createItem(owner, { wishlistIds: [list.id], notes: 'secret owner note', priority: 'must_have' });
  const detail = await owner.get(`/api/wishlists/${list.id}`);
  const entryId: string = detail.data.wishlist.entries[0].id;
  return { owner, user, list, item, entryId, token: list.shareToken as string };
}

describe('public wishlist access', () => {
  it('lets a visitor open an unlisted wishlist without an account', async () => {
    const { token, item } = await setup();
    const visitor = new Agent();
    const res = await visitor.get(`/api/public/lists/${token}`);
    expect(res.status).toBe(200);
    expect(res.data.wishlist.title).toBe('Birthday 2027');
    expect(res.data.entries).toHaveLength(1);
    expect(res.data.entries[0].item.title).toBe(item.title);
    expect(res.data.entries[0].status).toBe('available');
    // Private fields never leak.
    expect(res.data.entries[0].item).not.toHaveProperty('notes');
    expect(res.data.entries[0].item).not.toHaveProperty('ownerId');
    expect(JSON.stringify(res.data)).not.toContain('secret owner note');
    expect(JSON.stringify(res.data)).not.toContain('@example.com');
  });

  it('returns 404 for unknown, private, archived and revoked links', async () => {
    const { owner, list, token } = await setup();
    const visitor = new Agent();
    expect((await visitor.get('/api/public/lists/not-a-real-token-at-all-xxxxxxxx')).status).toBe(404);

    await owner.patch(`/api/wishlists/${list.id}`, { archived: true });
    expect((await visitor.get(`/api/public/lists/${token}`)).status).toBe(404);
    await owner.patch(`/api/wishlists/${list.id}`, { archived: false });

    await owner.patch(`/api/wishlists/${list.id}`, { visibility: 'private' });
    expect((await visitor.get(`/api/public/lists/${token}`)).status).toBe(404);
    await owner.patch(`/api/wishlists/${list.id}`, { visibility: 'unlisted' });
    expect((await visitor.get(`/api/public/lists/${token}`)).status).toBe(200);
  });

  it('stops working when the link is revoked or regenerated', async () => {
    const { owner, list, token, entryId } = await setup();
    const visitor = new Agent();
    const regen = await owner.post(`/api/wishlists/${list.id}/share/regenerate`);
    const newToken = regen.data.shareToken;
    expect(newToken).not.toBe(token);
    expect((await visitor.get(`/api/public/lists/${token}`)).status).toBe(404);
    expect((await visitor.post(`/api/public/lists/${token}/entries/${entryId}/claim`, {})).status).toBe(404);
    expect((await visitor.get(`/api/public/lists/${newToken}`)).status).toBe(200);

    await owner.post(`/api/wishlists/${list.id}/share/revoke`);
    expect((await visitor.get(`/api/public/lists/${newToken}`)).status).toBe(404);
    const detail = await owner.get(`/api/wishlists/${list.id}`);
    expect(detail.data.wishlist.shareToken).toBeNull();
  });

  it('public profiles list only public wishlists', async () => {
    const { agent: owner } = await signUp(new Agent(), { username: 'pat' });
    await createList(owner, { title: 'Public one', visibility: 'public' });
    await createList(owner, { title: 'Unlisted one', visibility: 'unlisted' });
    await createList(owner, { title: 'Private one', visibility: 'private' });
    const visitor = new Agent();
    expect((await visitor.get('/api/public/users/pat')).status).toBe(404);
    await owner.patch('/api/account/profile', { publicProfile: true });
    const profile = await visitor.get('/api/public/users/pat');
    expect(profile.status).toBe(200);
    expect(profile.data.wishlists.map((w: any) => w.title)).toEqual(['Public one']);
    expect(JSON.stringify(profile.data)).not.toContain('@example.com');
  });
});

describe('claiming and reservations', () => {
  it('lets a visitor reserve an item without an account and blocks others', async () => {
    const { token, entryId } = await setup();
    const alice = new Agent('198.51.100.1');
    const bob = new Agent('198.51.100.2');
    const claim = await alice.post(`/api/public/lists/${token}/entries/${entryId}/claim`, { name: 'Aunt Alice', message: 'Got it!' });
    expect(claim.status).toBe(201);
    expect(claim.data.claimToken).toHaveLength(43);
    expect(claim.data.status).toBe('reserved');

    const view = await bob.get(`/api/public/lists/${token}`);
    expect(view.data.entries[0].status).toBe('reserved');
    expect(view.data.entries[0].claim.name).toBe('Aunt Alice');
    expect(JSON.stringify(view.data)).not.toContain(claim.data.claimToken);

    const second = await bob.post(`/api/public/lists/${token}/entries/${entryId}/claim`, { name: 'Bob' });
    expect(second.status).toBe(409);
  });

  it('never lets two visitors reserve the same item at the same time', async () => {
    const { token, entryId } = await setup();
    const attempts = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        new Agent(`198.51.100.${i + 10}`).post(`/api/public/lists/${token}/entries/${entryId}/claim`, { name: `Visitor ${i}` }),
      ),
    );
    const statuses = attempts.map((a) => a.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(11);
    const winner = attempts.find((a) => a.status === 201)!;
    const view = await new Agent().get(`/api/public/lists/${token}`);
    expect(view.data.entries[0].claim.id).toBe(winner.data.claimId);
  });

  it('releases a reservation only with the right claim token', async () => {
    const { token, entryId } = await setup();
    const visitor = new Agent();
    const claim = await visitor.post(`/api/public/lists/${token}/entries/${entryId}/claim`, {});
    const wrong = await new Agent().post(`/api/public/lists/${token}/entries/${entryId}/release`, { claimToken: 'x'.repeat(43) });
    expect(wrong.status).toBe(404);
    const ok = await visitor.post(`/api/public/lists/${token}/entries/${entryId}/release`, { claimToken: claim.data.claimToken });
    expect(ok.status).toBe(200);
    expect((await visitor.get(`/api/public/lists/${token}`)).data.entries[0].status).toBe('available');
    expect((await new Agent().post(`/api/public/lists/${token}/entries/${entryId}/claim`, {})).status).toBe(201);
  });

  it('marks a reservation as purchased, and supports buying outright', async () => {
    const { owner, list, token, entryId } = await setup();
    const visitor = new Agent();
    const claim = await visitor.post(`/api/public/lists/${token}/entries/${entryId}/claim`, {});
    const bought = await visitor.post(`/api/public/lists/${token}/entries/${entryId}/purchase`, { claimToken: claim.data.claimToken });
    expect(bought.data.status).toBe('purchased');
    expect((await visitor.get(`/api/public/lists/${token}`)).data.entries[0].status).toBe('purchased');

    const item2 = await createItem(owner, { title: 'Second', wishlistIds: [list.id] });
    const entry2 = (await owner.get(`/api/wishlists/${list.id}`)).data.wishlist.entries.find((e: any) => e.itemId === item2.id).id;
    const direct = await visitor.post(`/api/public/lists/${token}/entries/${entry2}/claim`, { markPurchased: true });
    expect(direct.data.status).toBe('purchased');
    expect(direct.data.expiresAt).toBeNull();
  });

  it('expired reservations become available again', async () => {
    const { token, entryId } = await setup({ settings: { reservationDays: 7 } });
    const first = await new Agent().post(`/api/public/lists/${token}/entries/${entryId}/claim`, { name: 'Forgetful' });
    expect(first.data.expiresAt).toBeTruthy();
    advanceClock(6 * 86_400_000);
    expect((await new Agent().get(`/api/public/lists/${token}`)).data.entries[0].status).toBe('reserved');
    advanceClock(2 * 86_400_000);
    expect((await new Agent().get(`/api/public/lists/${token}`)).data.entries[0].status).toBe('available');
    const second = await new Agent().post(`/api/public/lists/${token}/entries/${entryId}/claim`, { name: 'Reliable' });
    expect(second.status).toBe(201);
    // The stale claimant can no longer act on it.
    const stale = await new Agent().post(`/api/public/lists/${token}/entries/${entryId}/release`, { claimToken: first.data.claimToken });
    expect(stale.status).toBe(404);
  });

  it('respects owner settings for claims and visibility', async () => {
    const { owner, list, token, entryId } = await setup({ settings: { showReserved: false } });
    const visitor = new Agent();
    await visitor.post(`/api/public/lists/${token}/entries/${entryId}/claim`, {});
    expect((await visitor.get(`/api/public/lists/${token}`)).data.entries).toHaveLength(0);

    await owner.patch(`/api/wishlists/${list.id}`, { settings: { allowClaims: false, showPriorities: false } });
    const item2 = await createItem(owner, { title: 'Second', wishlistIds: [list.id], priority: 'must_have' });
    const view = await visitor.get(`/api/public/lists/${token}`);
    const e2 = view.data.entries.find((e: any) => e.item.id === item2.id);
    expect(e2.priority).toBeNull();
    expect((await visitor.post(`/api/public/lists/${token}/entries/${e2.id}/claim`, {})).status).toBe(403);
  });

  it("owners can't claim their own items", async () => {
    const { owner, token, entryId } = await setup();
    expect((await owner.post(`/api/public/lists/${token}/entries/${entryId}/claim`, {})).status).toBe(403);
  });
});

describe('surprise mode', () => {
  it('hides claim identities and status from the owner at the API level', async () => {
    const { owner, list, token, entryId } = await setup({ surpriseMode: true });
    await new Agent().post(`/api/public/lists/${token}/entries/${entryId}/claim`, { name: 'Secret Santa', message: 'Shh' });

    const detail = await owner.get(`/api/wishlists/${list.id}`);
    expect(detail.data.claims).toBeNull();
    expect(detail.data.pledges).toBeNull();
    expect(JSON.stringify(detail.data)).not.toContain('Secret Santa');

    // Even via the public endpoint while signed in as the owner.
    const pub = await owner.get(`/api/public/lists/${token}`);
    expect(pub.data.viewer).toEqual({ isOwner: true, isRecipient: false, claimsHidden: true });
    expect(pub.data.entries[0].status).toBeNull();
    expect(pub.data.entries[0].claim).toBeNull();
    expect(JSON.stringify(pub.data)).not.toContain('Secret Santa');

    // No notification reveals the claim.
    const notes = await owner.get('/api/notifications');
    expect(JSON.stringify(notes.data)).not.toContain('Secret Santa');

    // Owner can still manage the list.
    expect((await owner.patch(`/api/wishlists/${list.id}`, { title: 'Still mine' })).status).toBe(200);
    expect((await owner.post('/api/items', { title: 'Another', wishlistIds: [list.id] })).status).toBe(201);
    // ...but cannot clear a reservation they cannot see.
    expect((await owner.post(`/api/wishlists/${list.id}/entries/${entryId}/clear-claim`)).status).toBe(403);
  });

  it('turning Surprise Mode off never reveals claims made while it was on', async () => {
    const { owner, list, token, entryId } = await setup({ surpriseMode: true });
    await new Agent().post(`/api/public/lists/${token}/entries/${entryId}/claim`, { name: 'Secret Santa' });
    await owner.patch(`/api/wishlists/${list.id}`, { surpriseMode: false });

    const detail = await owner.get(`/api/wishlists/${list.id}`);
    expect(detail.data.claims).toEqual([]);
    expect(JSON.stringify(detail.data)).not.toContain('Secret Santa');
    const pub = await owner.get(`/api/public/lists/${token}`);
    expect(pub.data.entries[0].status).toBeNull();

    // Claims made with Surprise Mode off are visible to the owner.
    const item2 = await createItem(owner, { title: 'Visible', wishlistIds: [list.id] });
    const entry2 = (await owner.get(`/api/wishlists/${list.id}`)).data.wishlist.entries.find((e: any) => e.itemId === item2.id).id;
    await new Agent().post(`/api/public/lists/${token}/entries/${entry2}/claim`, { name: 'Open Olivia' });
    const after = await owner.get(`/api/wishlists/${list.id}`);
    expect(after.data.claims).toEqual([expect.objectContaining({ entryId: entry2, claimantName: 'Open Olivia', status: 'reserved' })]);
    // And can be cleared by the owner.
    expect((await owner.post(`/api/wishlists/${list.id}/entries/${entry2}/clear-claim`)).status).toBe(200);
  });

  it('editors are treated as owner-side; viewer collaborators as visitors', async () => {
    const { owner, list, token, entryId } = await setup({ surpriseMode: true });
    const { agent: editor } = await signUp(new Agent(), { username: 'eddy' });
    const { agent: viewer } = await signUp(new Agent(), { username: 'vivi' });
    await owner.post(`/api/wishlists/${list.id}/collaborators`, { identifier: 'eddy', role: 'editor' });
    await owner.post(`/api/wishlists/${list.id}/collaborators`, { identifier: 'vivi', role: 'viewer' });
    await new Agent().post(`/api/public/lists/${token}/entries/${entryId}/claim`, { name: 'Hidden' });
    expect((await editor.get(`/api/public/lists/${token}`)).data.entries[0].status).toBeNull();
    expect((await editor.get(`/api/wishlists/${list.id}`)).data.claims).toBeNull();
    expect((await viewer.get(`/api/public/lists/${token}`)).data.entries[0].status).toBe('reserved');
  });
});

describe('group gifts', () => {
  it('lets visitors coordinate a group gift', async () => {
    const { owner, list, token, entryId } = await setup({ surpriseMode: true });
    await owner.patch(`/api/wishlists/${list.id}/entries/${entryId}`, { groupGift: true, groupGiftNote: 'Let’s pool together' });
    const visitor = new Agent();
    expect((await visitor.post(`/api/public/lists/${token}/entries/${entryId}/claim`, {})).status).toBe(400);

    const coord = await visitor.post(`/api/public/lists/${token}/entries/${entryId}/pledges`, {
      name: 'Coordinator Casey',
      contact: 'casey@example.org',
      coordinator: true,
    });
    expect(coord.data.role).toBe('coordinator');
    const second = await new Agent().post(`/api/public/lists/${token}/entries/${entryId}/pledges`, { name: 'Dana', coordinator: true });
    expect(second.data.role).toBe('contributor');
    expect((await new Agent().post(`/api/public/lists/${token}/entries/${entryId}/pledges`, {})).status).toBe(400);

    const view = await visitor.get(`/api/public/lists/${token}`);
    expect(view.data.entries[0].groupGift).toBe(true);
    expect(view.data.entries[0].pledges.map((p: any) => p.name)).toEqual(['Coordinator Casey', 'Dana']);

    // Hidden from the owner in Surprise Mode
    expect((await owner.get(`/api/wishlists/${list.id}`)).data.pledges).toBeNull();
    expect((await owner.get(`/api/public/lists/${token}`)).data.entries[0].pledges).toEqual([]);

    // Only the coordinator can mark it purchased
    expect((await visitor.post(`/api/public/lists/${token}/entries/${entryId}/group-purchased`, { pledgeToken: second.data.pledgeToken })).status).toBe(403);
    expect((await visitor.post(`/api/public/lists/${token}/entries/${entryId}/group-purchased`, { pledgeToken: coord.data.pledgeToken })).status).toBe(200);
    expect((await visitor.get(`/api/public/lists/${token}`)).data.entries[0].status).toBe('purchased');

    // Withdraw a pledge
    expect((await visitor.post(`/api/public/lists/${token}/entries/${entryId}/pledges/withdraw`, { pledgeToken: second.data.pledgeToken })).status).toBe(200);
    expect((await visitor.get(`/api/public/lists/${token}`)).data.entries[0].pledges).toHaveLength(1);
  });
});
