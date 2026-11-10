import { beforeEach, describe, expect, it } from 'vitest';
import { Agent, createItem, createList, freshStore, signUp } from './helpers';

beforeEach(freshStore);

async function befriend(a: Agent, b: Agent, bUsername: string, aId: string) {
  expect((await a.post('/api/friends/requests', { username: bUsername })).status).toBe(201);
  expect((await b.post(`/api/friends/requests/${aId}/accept`)).status).toBe(200);
}

async function pair() {
  const mia = await signUp(undefined, { username: 'mia', displayName: 'Mia Rose' });
  const sam = await signUp(undefined, { username: 'sam', displayName: 'Sam Lee' });
  return { mia, sam };
}

describe('friend requests', () => {
  it('sends, lists and accepts a request, notifying both sides', async () => {
    const { mia, sam } = await pair();
    const sent = await mia.agent.post('/api/friends/requests', { username: '@Sam' });
    expect(sent.status).toBe(201);
    expect(sent.data.status).toBe('requested');
    expect(sent.data.overview.outgoing.map((r: any) => r.user.username)).toEqual(['sam']);

    const samView = await sam.agent.get('/api/friends');
    expect(samView.data.incoming.map((r: any) => r.user.username)).toEqual(['mia']);
    expect(JSON.stringify(samView.data)).not.toContain('@example.com');
    const samNotes = await sam.agent.get('/api/notifications');
    expect(samNotes.data.notifications[0].type).toBe('friend_request');

    const accepted = await sam.agent.post(`/api/friends/requests/${mia.user.id}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.data.friends.map((f: any) => f.user.username)).toEqual(['mia']);
    expect(accepted.data.incoming).toEqual([]);

    const miaView = await mia.agent.get('/api/friends');
    expect(miaView.data.friends.map((f: any) => f.user.username)).toEqual(['sam']);
    expect(miaView.data.outgoing).toEqual([]);
    const miaNotes = await mia.agent.get('/api/notifications');
    expect(miaNotes.data.notifications[0].type).toBe('friend_accepted');
  });

  it('auto-accepts when both people ask, and handles duplicates, self and unknown users', async () => {
    const { mia, sam } = await pair();
    expect((await mia.agent.post('/api/friends/requests', { username: 'sam' })).status).toBe(201);
    const again = await mia.agent.post('/api/friends/requests', { username: 'sam' });
    expect(again.status).toBe(200);
    expect(again.data.status).toBe('already_requested');

    const mutual = await sam.agent.post('/api/friends/requests', { username: 'mia' });
    expect(mutual.data.status).toBe('accepted');
    expect(mutual.data.overview.friends).toHaveLength(1);

    expect((await mia.agent.post('/api/friends/requests', { username: 'sam' })).status).toBe(409);
    expect((await mia.agent.post('/api/friends/requests', { username: 'mia' })).status).toBe(400);
    expect((await mia.agent.post('/api/friends/requests', { username: 'nobody_here' })).status).toBe(404);
    expect((await mia.agent.post('/api/friends/requests', { username: 'no' })).status).toBe(400);
    expect((await new Agent().post('/api/friends/requests', { username: 'sam' })).status).toBe(401);
  });

  it('lets the recipient decline and the sender cancel, but nobody else', async () => {
    const { mia, sam } = await pair();
    const eve = await signUp(undefined, { username: 'eve' });
    await mia.agent.post('/api/friends/requests', { username: 'sam' });

    // The sender can't accept their own request; outsiders can't touch it.
    expect((await mia.agent.post(`/api/friends/requests/${sam.user.id}/accept`)).status).toBe(404);
    expect((await eve.agent.post(`/api/friends/requests/${mia.user.id}/accept`)).status).toBe(404);
    expect((await eve.agent.del(`/api/friends/requests/${mia.user.id}`)).status).toBe(404);

    const declined = await sam.agent.del(`/api/friends/requests/${mia.user.id}`);
    expect(declined.status).toBe(200);
    expect(declined.data.incoming).toEqual([]);
    expect((await mia.agent.get('/api/friends')).data.outgoing).toEqual([]);

    await mia.agent.post('/api/friends/requests', { username: 'sam' });
    expect((await mia.agent.del(`/api/friends/requests/${sam.user.id}`)).status).toBe(200);
    expect((await sam.agent.get('/api/friends')).data.incoming).toEqual([]);
  });

  it('unfriends from either side, and request endpoints cannot remove a friendship', async () => {
    const { mia, sam } = await pair();
    await befriend(mia.agent, sam.agent, 'sam', mia.user.id);
    expect((await mia.agent.del(`/api/friends/requests/${sam.user.id}`)).status).toBe(404);
    expect((await mia.agent.get('/api/friends')).data.friends).toHaveLength(1);

    expect((await sam.agent.del(`/api/friends/${mia.user.id}`)).status).toBe(200);
    expect((await mia.agent.get('/api/friends')).data.friends).toEqual([]);
    expect((await mia.agent.get(`/api/friends/${sam.user.id}`)).status).toBe(404);
    expect((await sam.agent.del(`/api/friends/${mia.user.id}`)).status).toBe(404);
  });
});

describe('browsing a friend’s wishlists', () => {
  it('shows only Friends and Public lists, and only to accepted friends', async () => {
    const { mia, sam } = await pair();
    await createList(mia.agent, { title: 'Friends list', visibility: 'friends' });
    await createList(mia.agent, { title: 'Public list', visibility: 'public' });
    await createList(mia.agent, { title: 'Unlisted list', visibility: 'unlisted' });
    await createList(mia.agent, { title: 'Private list', visibility: 'private' });
    const archived = await createList(mia.agent, { title: 'Old list', visibility: 'friends' });
    await mia.agent.patch(`/api/wishlists/${archived.id}`, { archived: true });

    // Not friends yet, and a pending request isn't enough.
    expect((await sam.agent.get(`/api/friends/${mia.user.id}`)).status).toBe(404);
    await sam.agent.post('/api/friends/requests', { username: 'mia' });
    expect((await sam.agent.get(`/api/friends/${mia.user.id}`)).status).toBe(404);

    await mia.agent.post(`/api/friends/requests/${sam.user.id}/accept`);
    const profile = await sam.agent.get(`/api/friends/${mia.user.id}`);
    expect(profile.status).toBe(200);
    expect(profile.data.wishlists.map((w: any) => w.title).sort()).toEqual(['Friends list', 'Public list']);
    expect(profile.data.wishlists.every((w: any) => typeof w.shareToken === 'string')).toBe(true);
    expect(JSON.stringify(profile.data)).not.toContain('@example.com');
    expect(profile.data.wishlists[0]).not.toHaveProperty('collaborators');

    expect((await sam.agent.get('/api/friends/not-a-valid-id!')).status).toBe(404);
  });
});

describe('friends-only share links', () => {
  async function setup() {
    const { mia, sam } = await pair();
    const list = await createList(mia.agent, { title: 'Birthday', visibility: 'friends', surpriseMode: true });
    await createItem(mia.agent, { wishlistIds: [list.id] });
    const detail = await mia.agent.get(`/api/wishlists/${list.id}`);
    return { mia, sam, list, token: list.shareToken as string, entryId: detail.data.wishlist.entries[0].id as string };
  }

  it('requires a signed-in friend to view or reserve', async () => {
    const { mia, sam, token, entryId } = await setup();
    expect(token).toBeTruthy();

    const anon = await new Agent().get(`/api/public/lists/${token}`);
    expect(anon.status).toBe(403);
    expect(anon.data.error.code).toBe('friends_only');
    expect(anon.data.error.fields).toBeUndefined();
    expect(JSON.stringify(anon.data)).not.toContain('Birthday');
    expect((await new Agent().post(`/api/public/lists/${token}/entries/${entryId}/claim`, {})).status).toBe(403);

    const stranger = await sam.agent.get(`/api/public/lists/${token}`);
    expect(stranger.status).toBe(403);
    expect(stranger.data.error.fields.owner).toBe('mia');
    expect((await sam.agent.post(`/api/public/lists/${token}/entries/${entryId}/claim`, {})).status).toBe(403);

    await befriend(sam.agent, mia.agent, 'mia', sam.user.id);
    const friendView = await sam.agent.get(`/api/public/lists/${token}`);
    expect(friendView.status).toBe(200);
    expect(friendView.data.wishlist.title).toBe('Birthday');
    const claim = await sam.agent.post(`/api/public/lists/${token}/entries/${entryId}/claim`, { name: 'Sam' });
    expect(claim.status).toBe(201);

    // Surprise Mode still hides the reservation from the owner.
    const ownerView = await mia.agent.get(`/api/public/lists/${token}`);
    expect(ownerView.status).toBe(200);
    expect(ownerView.data.entries[0].status).toBeNull();
    expect(ownerView.data.entries[0].claim).toBeNull();
    const ownerDetail = await mia.agent.get(`/api/wishlists/${ownerView.data.wishlist.id}`);
    expect(ownerDetail.data.claims).toBeNull();

    // After unfriending, viewing stops but the giver can still release with their claim token.
    await mia.agent.del(`/api/friends/${sam.user.id}`);
    expect((await sam.agent.get(`/api/public/lists/${token}`)).status).toBe(403);
    const release = await sam.agent.post(`/api/public/lists/${token}/entries/${entryId}/release`, { claimToken: claim.data.claimToken });
    expect(release.status).toBe(200);
  });

  it('lets collaborators open it without being friends', async () => {
    const { mia, sam, list, token } = await setup();
    await mia.agent.post(`/api/wishlists/${list.id}/collaborators`, { identifier: 'sam', role: 'viewer' });
    expect((await sam.agent.get(`/api/public/lists/${token}`)).status).toBe(200);
  });

  it('switching visibility to Friends locks out anonymous visitors immediately', async () => {
    const { mia } = await pair();
    const list = await createList(mia.agent, { visibility: 'unlisted' });
    const visitor = new Agent();
    expect((await visitor.get(`/api/public/lists/${list.shareToken}`)).status).toBe(200);
    await mia.agent.patch(`/api/wishlists/${list.id}`, { visibility: 'friends' });
    expect((await visitor.get(`/api/public/lists/${list.shareToken}`)).status).toBe(403);
  });
});

describe('account deletion', () => {
  it('removes every friendship and request involving the deleted user', async () => {
    const { mia, sam } = await pair();
    const eve = await signUp(undefined, { username: 'eve' });
    await befriend(mia.agent, sam.agent, 'sam', mia.user.id);
    await eve.agent.post('/api/friends/requests', { username: 'sam' });

    expect((await sam.agent.del('/api/account', { password: sam.creds.password })).status).toBe(200);
    expect((await mia.agent.get('/api/friends')).data.friends).toEqual([]);
    expect((await eve.agent.get('/api/friends')).data.outgoing).toEqual([]);
    expect((await mia.agent.get(`/api/friends/${sam.user.id}`)).status).toBe(404);
  });
});

describe('profile visibility and people search', () => {
  it('defaults to private: visitable without lists, and hidden from search', async () => {
    const { mia, sam } = await pair();
    await createList(mia.agent, { title: 'Public list', visibility: 'public' });
    const page = await sam.agent.get('/api/public/users/mia');
    expect(page.status).toBe(200);
    expect(page.data.profileVisibility).toBe('private');
    expect(page.data.wishlists).toEqual([]);
    expect(page.data.viewer.canSeeLists).toBe(false);

    expect((await sam.agent.get('/api/friends/search?q=mia')).data.people).toEqual([]);
  });

  it('lets friends find friends-visibility profiles and see shared lists there', async () => {
    const { mia, sam } = await pair();
    await mia.agent.patch('/api/account/profile', { profileVisibility: 'friends' });
    await createList(mia.agent, { title: 'Friends list', visibility: 'friends' });
    await createList(mia.agent, { title: 'Public list', visibility: 'public' });

    const found = await sam.agent.get('/api/friends/search?q=mi');
    expect(found.data.people.map((p: any) => p.user.username)).toEqual(['mia']);
    expect(found.data.people[0].relationship).toBe('none');

    const before = await sam.agent.get('/api/public/users/mia');
    expect(before.data.wishlists).toEqual([]);
    expect(before.data.viewer.canSeeLists).toBe(false);

    await befriend(sam.agent, mia.agent, 'mia', sam.user.id);
    const after = await sam.agent.get('/api/public/users/mia');
    expect(after.data.viewer).toMatchObject({ isFriend: true, canSeeLists: true });
    expect(after.data.wishlists.map((w: any) => w.title).sort()).toEqual(['Friends list', 'Public list']);

    const searchAgain = await sam.agent.get('/api/friends/search?q=mia');
    expect(searchAgain.data.people[0].relationship).toBe('friends');
  });

  it('shows public profiles to anyone and keeps private accounts out of search', async () => {
    const { mia, sam } = await pair();
    await mia.agent.patch('/api/account/profile', { profileVisibility: 'public' });
    await createList(mia.agent, { title: 'Public list', visibility: 'public' });
    await createList(mia.agent, { title: 'Friends list', visibility: 'friends' });

    const anon = await new Agent().get('/api/public/users/mia');
    expect(anon.data.wishlists.map((w: any) => w.title)).toEqual(['Public list']);
    expect(anon.data.viewer.canSeeLists).toBe(true);

    await befriend(sam.agent, mia.agent, 'mia', sam.user.id);
    const friend = await sam.agent.get('/api/public/users/mia');
    expect(friend.data.wishlists.map((w: any) => w.title).sort()).toEqual(['Friends list', 'Public list']);

    await mia.agent.patch('/api/account/profile', { profileVisibility: 'private' });
    expect((await sam.agent.get('/api/friends/search?q=mia')).data.people).toEqual([]);
    // Exact username friend requests still work when you already know the handle.
    const eve = await signUp(undefined, { username: 'eve' });
    expect((await eve.agent.post('/api/friends/requests', { username: 'mia' })).status).toBe(201);
  });
});
