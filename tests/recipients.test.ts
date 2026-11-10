import { beforeEach, describe, expect, it } from 'vitest';
import { Agent, createItem, createList, freshStore, signUp } from './helpers';

beforeEach(freshStore);

async function befriend(a: Agent, b: Agent, bUsername: string, aId: string) {
  expect((await a.post('/api/friends/requests', { username: bUsername })).status).toBe(201);
  expect((await b.post(`/api/friends/requests/${aId}/accept`)).status).toBe(200);
}

async function family() {
  const mum = await signUp(undefined, { username: 'mum', displayName: 'Jo Parent' });
  const kid = await signUp(undefined, { username: 'kid', displayName: 'Ava Parent' });
  return { mum, kid };
}

async function withItem(agent: Agent, list: { id: string }) {
  const item = await createItem(agent, { wishlistIds: [list.id] });
  const detail = await agent.get(`/api/wishlists/${list.id}`);
  return detail.data.wishlist.entries.find((e: any) => e.itemId === item.id).id as string;
}

describe('lists made for someone else', () => {
  it('shows the person instead of the owner, and the owner still sees reservations in Surprise Mode', async () => {
    const { mum } = await family();
    const list = await createList(mum.agent, { title: 'Ava turns 6', surpriseMode: true, recipients: [{ name: 'Ava' }] });
    expect(list.recipients).toEqual([{ name: 'Ava', avatarUrl: null, userId: null }]);
    const entryId = await withItem(mum.agent, list);

    const summaries = await mum.agent.get('/api/wishlists');
    expect(summaries.data.wishlists[0].recipients).toEqual([{ name: 'Ava', avatarUrl: null, userId: null, username: null }]);

    const claim = await new Agent('198.51.100.7').post(`/api/public/lists/${list.shareToken}/entries/${entryId}/claim`, { name: 'Grandma' });
    expect(claim.status).toBe(201);

    const detail = await mum.agent.get(`/api/wishlists/${list.id}`);
    expect(detail.data.recipients.map((r: any) => r.name)).toEqual(['Ava']);
    expect(detail.data.claims.map((c: any) => c.claimantName)).toEqual(['Grandma']);

    const page = await mum.agent.get(`/api/public/lists/${list.shareToken}`);
    expect(page.data.recipients).toEqual([{ name: 'Ava', avatarUrl: null, username: null }]);
    expect(page.data.entries[0].status).toBe('reserved');
    expect(page.data.viewer.claimsHidden).toBe(false);

    const anon = await new Agent().get(`/api/public/lists/${list.shareToken}`);
    expect(anon.data.recipients).toEqual([{ name: 'Ava', avatarUrl: null, username: null }]);
    expect(JSON.stringify(anon.data.recipients)).not.toContain('userId');
  });

  it('only links friends, and shares the list with them', async () => {
    const { mum, kid } = await family();
    const refused = await mum.agent.post('/api/wishlists', { title: 'Ava turns 6', recipients: [{ name: 'Ava', userId: kid.user.id }] });
    expect(refused.status).toBe(400);
    expect((await mum.agent.get('/api/wishlists')).data.wishlists).toHaveLength(0);
    expect((await mum.agent.post('/api/wishlists', { title: 'Mine', recipients: [{ name: 'Me', userId: mum.user.id }] })).status).toBe(400);

    await befriend(mum.agent, kid.agent, 'kid', mum.user.id);
    const list = await createList(mum.agent, { title: 'Ava turns 6', recipients: [{ name: 'Ava', userId: kid.user.id }] });
    expect(list.recipients[0].userId).toBe(kid.user.id);
    expect(list.collaborators).toEqual([expect.objectContaining({ userId: kid.user.id, role: 'viewer' })]);

    const shared = await kid.agent.get('/api/shared');
    expect(shared.data.wishlists.map((w: any) => w.title)).toEqual(['Ava turns 6']);
    expect(shared.data.wishlists[0].recipients[0].userId).toBe(kid.user.id);
    expect(shared.data.wishlists[0].recipients[0].username).toBe('kid');
    const notes = await kid.agent.get('/api/notifications');
    expect(notes.data.notifications[0].message).toContain('made “Ava turns 6” for you');

    const editable = await mum.agent.patch(`/api/wishlists/${list.id}`, { recipients: [{ name: 'Ava', userId: kid.user.id, canEdit: true }] });
    expect(editable.data.wishlist.collaborators[0].role).toBe('editor');
    expect((await kid.agent.get(`/api/wishlists/${list.id}`)).data.role).toBe('editor');
  });

  it('keeps reservations from the person it is for while Surprise Mode is on', async () => {
    const { mum, kid } = await family();
    await befriend(mum.agent, kid.agent, 'kid', mum.user.id);
    const list = await createList(mum.agent, {
      title: 'Ava turns 6',
      surpriseMode: true,
      recipients: [{ name: 'Ava', userId: kid.user.id, canEdit: true }],
    });
    const entryId = await withItem(mum.agent, list);
    const guest = new Agent('198.51.100.7');
    expect((await guest.post(`/api/public/lists/${list.shareToken}/entries/${entryId}/claim`, { name: 'Grandma' })).status).toBe(201);

    const kidDetail = await kid.agent.get(`/api/wishlists/${list.id}`);
    expect(kidDetail.data.claims).toBeNull();
    const kidPage = await kid.agent.get(`/api/public/lists/${list.shareToken}`);
    expect(kidPage.data.viewer).toEqual({ isOwner: true, isRecipient: true, claimsHidden: true });
    expect(kidPage.data.entries[0].status).toBeNull();
    expect(kidPage.data.entries[0].claim).toBeNull();
    expect(JSON.stringify(kidPage.data)).not.toContain('Grandma');
    expect((await kid.agent.post(`/api/wishlists/${list.id}/entries/${entryId}/clear-claim`)).status).toBe(403);
    expect((await kid.agent.post(`/api/public/lists/${list.shareToken}/entries/${entryId}/claim`, {})).status).toBe(403);

    // Full sight: new reservations show, ones made during the surprise never do.
    await mum.agent.patch(`/api/wishlists/${list.id}`, { surpriseMode: false });
    expect((await kid.agent.get(`/api/wishlists/${list.id}`)).data.claims).toEqual([]);
    const second = await withItem(mum.agent, list);
    expect((await guest.post(`/api/public/lists/${list.shareToken}/entries/${second}/claim`, { name: 'Uncle Raj' })).status).toBe(201);
    const after = await kid.agent.get(`/api/wishlists/${list.id}`);
    expect(after.data.claims.map((c: any) => c.claimantName)).toEqual(['Uncle Raj']);

    // The owner saw both all along.
    const mumDetail = await mum.agent.get(`/api/wishlists/${list.id}`);
    expect(mumDetail.data.claims.map((c: any) => c.claimantName).sort()).toEqual(['Grandma', 'Uncle Raj']);
  });

  it('never reveals gifts kept from the owner when their own list is handed to someone else', async () => {
    const { mum } = await family();
    const list = await createList(mum.agent, { title: 'My birthday', surpriseMode: true });
    const entryId = await withItem(mum.agent, list);
    expect((await new Agent('198.51.100.7').post(`/api/public/lists/${list.shareToken}/entries/${entryId}/claim`, { name: 'Partner' })).status).toBe(
      201,
    );

    await mum.agent.patch(`/api/wishlists/${list.id}`, { recipients: [{ name: 'Ava' }] });
    const detail = await mum.agent.get(`/api/wishlists/${list.id}`);
    expect(detail.data.claims).toEqual([]);
    const page = await mum.agent.get(`/api/public/lists/${list.shareToken}`);
    expect(page.data.entries[0].status).toBeNull();
    expect(JSON.stringify(page.data)).not.toContain('Partner');
  });

  it('unlinking or leaving takes the list away but keeps who it is for', async () => {
    const { mum, kid } = await family();
    await befriend(mum.agent, kid.agent, 'kid', mum.user.id);
    const list = await createList(mum.agent, { title: 'Ava turns 6', recipients: [{ name: 'Ava', userId: kid.user.id }] });

    await mum.agent.patch(`/api/wishlists/${list.id}`, { recipients: [{ name: 'Ava', userId: null }] });
    expect((await kid.agent.get(`/api/wishlists/${list.id}`)).status).toBe(404);
    expect((await kid.agent.get('/api/shared')).data.wishlists).toEqual([]);

    await mum.agent.patch(`/api/wishlists/${list.id}`, { recipients: [{ name: 'Ava', userId: kid.user.id }] });
    expect((await kid.agent.get(`/api/wishlists/${list.id}`)).status).toBe(200);
    expect((await kid.agent.del(`/api/wishlists/${list.id}/collaborators/${kid.user.id}`)).status).toBe(200);
    const detail = await mum.agent.get(`/api/wishlists/${list.id}`);
    expect(detail.data.wishlist.recipients).toEqual([{ name: 'Ava', avatarUrl: null, userId: null }]);
    expect(detail.data.wishlist.collaborators).toEqual([]);

    const mine = await mum.agent.patch(`/api/wishlists/${list.id}`, { recipients: [] });
    expect(mine.data.recipients).toEqual([]);
  });

  it('lets friends of the person it is for open a friends-only list, and shows it on their profile', async () => {
    const { mum, kid } = await family();
    const pal = await signUp(undefined, { username: 'pal', displayName: 'Pal Friend' });
    await befriend(mum.agent, kid.agent, 'kid', mum.user.id);
    await befriend(pal.agent, kid.agent, 'kid', pal.user.id);
    const list = await createList(mum.agent, { title: 'Ava turns 6', visibility: 'friends', recipients: [{ name: 'Ava', userId: kid.user.id }] });

    expect((await pal.agent.get(`/api/public/lists/${list.shareToken}`)).status).toBe(200);
    const profile = await pal.agent.get(`/api/friends/${kid.user.id}`);
    expect(profile.data.wishlists).toEqual([
      expect.objectContaining({
        title: 'Ava turns 6',
        recipients: [{ name: 'Ava', avatarUrl: null, username: 'kid' }],
        madeBy: expect.objectContaining({ username: 'mum' }),
      }),
    ]);

    const stranger = await signUp(undefined, { username: 'stranger' });
    expect((await stranger.agent.get(`/api/public/lists/${list.shareToken}`)).status).toBe(403);
  });
});

describe('lists made for me and someone else', () => {
  it('shows the owner alongside the other people, and still keeps Surprise Mode from linked recipients', async () => {
    const { mum, kid } = await family();
    await befriend(mum.agent, kid.agent, 'kid', mum.user.id);
    const list = await createList(mum.agent, {
      title: 'Family trip',
      includeOwner: true,
      surpriseMode: true,
      recipients: [{ name: 'Ava', userId: kid.user.id }, { name: 'Baby Mia' }],
    });
    expect(list.includeOwner).toBe(true);
    expect(list.recipients.map((r: any) => r.name)).toEqual(['Ava', 'Baby Mia']);

    const summaries = await mum.agent.get('/api/wishlists');
    expect(summaries.data.wishlists[0].recipients.map((r: any) => r.name)).toEqual(['Jo', 'Ava', 'Baby Mia']);
    expect(summaries.data.wishlists[0].recipients[0].userId).toBe(mum.user.id);

    const detail = await mum.agent.get(`/api/wishlists/${list.id}`);
    expect(detail.data.wishlist.includeOwner).toBe(true);
    expect(detail.data.wishlist.recipients.map((r: any) => r.name)).toEqual(['Ava', 'Baby Mia']);
    expect(detail.data.recipients.map((r: any) => r.name)).toEqual(['Jo', 'Ava', 'Baby Mia']);
    expect(detail.data.claims).toEqual([]);

    const entryId = await withItem(mum.agent, list);
    expect((await new Agent('198.51.100.7').post(`/api/public/lists/${list.shareToken}/entries/${entryId}/claim`, { name: 'Grandma' })).status).toBe(
      201,
    );
    expect((await mum.agent.get(`/api/wishlists/${list.id}`)).data.claims.map((c: any) => c.claimantName)).toEqual(['Grandma']);
    expect((await kid.agent.get(`/api/wishlists/${list.id}`)).data.claims).toBeNull();

    const anon = await new Agent().get(`/api/public/lists/${list.shareToken}`);
    expect(anon.data.recipients).toEqual([
      { name: 'Jo', avatarUrl: null, username: 'mum' },
      { name: 'Ava', avatarUrl: null, username: 'kid' },
      { name: 'Baby Mia', avatarUrl: null, username: null },
    ]);

    const mine = await mum.agent.patch(`/api/wishlists/${list.id}`, { recipients: [], includeOwner: false });
    expect(mine.data.wishlist.includeOwner).toBe(false);
    expect(mine.data.recipients).toEqual([]);
  });

  it('ignores includeOwner when there is nobody else on the list', async () => {
    const { mum } = await family();
    const list = await createList(mum.agent, { title: 'Just me', includeOwner: true, recipients: [] });
    expect(list.includeOwner).toBe(false);
    expect((await mum.agent.get('/api/wishlists')).data.wishlists[0].recipients).toEqual([]);
  });
});

describe('lists made for several people', () => {
  async function siblings() {
    const { mum, kid } = await family();
    const sib = await signUp(undefined, { username: 'sib', displayName: 'Leo Parent' });
    await befriend(mum.agent, kid.agent, 'kid', mum.user.id);
    await befriend(mum.agent, sib.agent, 'sib', mum.user.id);
    return { mum, kid, sib };
  }

  it('shares a joint list with every linked person and keeps the surprise from all of them', async () => {
    const { mum, kid, sib } = await siblings();
    const list = await createList(mum.agent, {
      title: 'Ava & Leo’s Christmas',
      surpriseMode: true,
      recipients: [{ name: 'Ava', userId: kid.user.id }, { name: 'Leo', userId: sib.user.id, canEdit: true }, { name: 'Baby Mia' }],
    });
    expect(list.recipients.map((r: any) => r.name)).toEqual(['Ava', 'Leo', 'Baby Mia']);
    expect(list.collaborators).toEqual([
      expect.objectContaining({ userId: kid.user.id, role: 'viewer' }),
      expect.objectContaining({ userId: sib.user.id, role: 'editor' }),
    ]);
    for (const agent of [kid.agent, sib.agent]) {
      expect((await agent.get('/api/shared')).data.wishlists.map((w: any) => w.title)).toEqual(['Ava & Leo’s Christmas']);
    }

    const entryId = await withItem(mum.agent, list);
    expect((await new Agent('198.51.100.7').post(`/api/public/lists/${list.shareToken}/entries/${entryId}/claim`, { name: 'Grandma' })).status).toBe(
      201,
    );
    for (const agent of [kid.agent, sib.agent]) {
      expect((await agent.get(`/api/wishlists/${list.id}`)).data.claims).toBeNull();
      const page = await agent.get(`/api/public/lists/${list.shareToken}`);
      expect(page.data.viewer).toEqual({ isOwner: true, isRecipient: true, claimsHidden: true });
      expect(JSON.stringify(page.data)).not.toContain('Grandma');
    }
    expect((await mum.agent.get(`/api/wishlists/${list.id}`)).data.claims.map((c: any) => c.claimantName)).toEqual(['Grandma']);

    const anon = await new Agent().get(`/api/public/lists/${list.shareToken}`);
    expect(anon.data.recipients).toEqual([
      { name: 'Ava', avatarUrl: null, username: 'kid' },
      { name: 'Leo', avatarUrl: null, username: 'sib' },
      { name: 'Baby Mia', avatarUrl: null, username: null },
    ]);
  });

  it('takes the list away from only the person removed, or the one who leaves', async () => {
    const { mum, kid, sib } = await siblings();
    const both = [
      { name: 'Ava', userId: kid.user.id },
      { name: 'Leo', userId: sib.user.id },
    ];
    const list = await createList(mum.agent, { title: 'Trip', recipients: both });

    const updated = await mum.agent.patch(`/api/wishlists/${list.id}`, { recipients: [both[1]] });
    expect(updated.data.recipients.map((r: any) => r.name)).toEqual(['Leo']);
    expect((await kid.agent.get(`/api/wishlists/${list.id}`)).status).toBe(404);
    expect((await sib.agent.get(`/api/wishlists/${list.id}`)).status).toBe(200);

    await mum.agent.patch(`/api/wishlists/${list.id}`, { recipients: both });
    expect((await sib.agent.del(`/api/wishlists/${list.id}/collaborators/${sib.user.id}`)).status).toBe(200);
    const detail = await mum.agent.get(`/api/wishlists/${list.id}`);
    expect(detail.data.wishlist.recipients).toEqual([
      { name: 'Ava', avatarUrl: null, userId: kid.user.id },
      { name: 'Leo', avatarUrl: null, userId: null },
    ]);
    expect(detail.data.wishlist.collaborators.map((c: any) => c.userId)).toEqual([kid.user.id]);
  });

  it('opens a friends-only joint list to friends of any linked person', async () => {
    const { mum, kid, sib } = await siblings();
    const palOfLeo = await signUp(undefined, { username: 'pal', displayName: 'Pal Friend' });
    await befriend(palOfLeo.agent, sib.agent, 'sib', palOfLeo.user.id);
    const list = await createList(mum.agent, {
      title: 'Trip',
      visibility: 'friends',
      recipients: [
        { name: 'Ava', userId: kid.user.id },
        { name: 'Leo', userId: sib.user.id },
      ],
    });
    expect((await palOfLeo.agent.get(`/api/public/lists/${list.shareToken}`)).status).toBe(200);
    const profile = await palOfLeo.agent.get(`/api/friends/${sib.user.id}`);
    expect(profile.data.wishlists.map((w: any) => w.recipients.map((r: any) => r.name))).toEqual([['Ava', 'Leo']]);
  });

  it('refuses the same friend twice, non-friends, and more than six people', async () => {
    const { mum, kid } = await siblings();
    const stranger = await signUp(undefined, { username: 'stranger' });
    const twice = await mum.agent.post('/api/wishlists', {
      title: 'Trip',
      recipients: [
        { name: 'Ava', userId: kid.user.id },
        { name: 'Ava again', userId: kid.user.id },
      ],
    });
    expect(twice.status).toBe(400);
    expect(twice.data.error.fields['recipients.1.userId']).toBeTruthy();

    const notFriend = await mum.agent.post('/api/wishlists', {
      title: 'Trip',
      recipients: [
        { name: 'Ava', userId: kid.user.id },
        { name: 'Stranger', userId: stranger.user.id },
      ],
    });
    expect(notFriend.status).toBe(400);
    expect(notFriend.data.error.fields['recipients.1.userId']).toBeTruthy();
    expect((await kid.agent.get('/api/shared')).data.wishlists).toEqual([]);

    const crowd = Array.from({ length: 7 }, (_, i) => ({ name: `Kid ${i + 1}` }));
    expect((await mum.agent.post('/api/wishlists', { title: 'Class party', recipients: crowd })).status).toBe(400);
    expect((await mum.agent.post('/api/wishlists', { title: 'Class party', recipients: crowd.slice(0, 6) })).status).toBe(201);
  });
});
