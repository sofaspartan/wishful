import { beforeEach, describe, expect, it } from 'vitest';
import { Agent, createList, freshStore, signUp } from './helpers';

beforeEach(freshStore);

describe('My Circle', () => {
  it('creates, lists, updates and deletes people and pets', async () => {
    const { agent } = await signUp();
    const created = await agent.post('/api/circle', { name: 'Ava', kind: 'person', note: 'Sister' });
    expect(created.status).toBe(201);
    expect(created.data.person).toMatchObject({ name: 'Ava', kind: 'person', note: 'Sister', userId: null });

    const pet = await agent.post('/api/circle', { name: 'Mochi', kind: 'pet' });
    expect(pet.status).toBe(201);
    expect(pet.data.person.kind).toBe('pet');

    const list = await agent.get('/api/circle');
    expect(list.status).toBe(200);
    expect(list.data.people.map((p: { name: string }) => p.name).sort()).toEqual(['Ava', 'Mochi']);

    const updated = await agent.patch(`/api/circle/${created.data.person.id}`, { name: 'Ava Rose' });
    expect(updated.status).toBe(200);
    expect(updated.data.person.name).toBe('Ava Rose');

    expect((await agent.del(`/api/circle/${pet.data.person.id}`)).status).toBe(200);
    expect((await agent.get('/api/circle')).data.people).toHaveLength(1);
  });

  it('saves new list recipients into My Circle when asked', async () => {
    const { agent } = await signUp();
    const created = await createList(agent, {
      title: 'For Leo',
      recipients: [{ name: 'Leo', saveToCircle: true, circleKind: 'person' }],
    });
    expect(created.recipients).toHaveLength(1);

    const circle = await agent.get('/api/circle');
    expect(circle.data.people).toHaveLength(1);
    expect(circle.data.people[0].name).toBe('Leo');

    const detail = await agent.get(`/api/wishlists/${created.id}`);
    expect(detail.data.wishlist.recipients[0].circlePersonId).toBe(circle.data.people[0].id);
  });

  it('links a circle person: friend request + collaborator on matching lists', async () => {
    const mia = await signUp(undefined, { username: 'mia', displayName: 'Mia' });
    const sam = await signUp(undefined, { username: 'sam', displayName: 'Sam' });

    const circle = await mia.agent.post('/api/circle', { name: 'Sam', kind: 'person' });
    const personId = circle.data.person.id;

    const list = await createList(mia.agent, {
      title: 'Sam’s birthday',
      recipients: [{ name: 'Sam', circlePersonId: personId }],
    });

    const linked = await mia.agent.post(`/api/circle/${personId}/link`, { username: 'sam' });
    expect(linked.status).toBe(200);
    expect(linked.data.friendStatus).toBe('requested');
    expect(linked.data.listsUpdated).toBe(1);
    expect(linked.data.person.userId).toBe(sam.user.id);

    const samFriends = await sam.agent.get('/api/friends');
    expect(samFriends.data.incoming.map((r: { user: { username: string } }) => r.user.username)).toEqual(['mia']);

    const detail = await mia.agent.get(`/api/wishlists/${list.id}`);
    expect(detail.data.wishlist.recipients[0].userId).toBe(sam.user.id);
    expect(detail.data.wishlist.collaborators.some((c: { userId: string }) => c.userId === sam.user.id)).toBe(true);

    await sam.agent.post(`/api/friends/requests/${mia.user.id}/accept`);
    const shared = await sam.agent.get('/api/shared');
    expect(shared.data.wishlists.some((w: { id: string }) => w.id === list.id)).toBe(true);
  });

  it('can pick an existing circle person when creating a list, and rejects pets for linking', async () => {
    const { agent } = await signUp();
    const pet = await agent.post('/api/circle', { name: 'Mochi', kind: 'pet' });
    await agent.post('/api/circle', { name: 'Ava', kind: 'person' });

    const list = await createList(agent, {
      title: 'Mochi’s toys',
      recipients: [{ name: 'Mochi', circlePersonId: pet.data.person.id }],
    });
    expect(list.recipients[0].circlePersonId).toBe(pet.data.person.id);

    await signUp(undefined, { username: 'sam' });
    const linkPet = await agent.post(`/api/circle/${pet.data.person.id}/link`, { username: 'sam' });
    expect(linkPet.status).toBe(400);
    expect(linkPet.data.error.message).toMatch(/pet/i);
  });

  it('shows My Circle photos on lists and public pages even when the list snapshot has none', async () => {
    const { agent } = await signUp();
    const photo = 'https://cdn.example.com/ava.jpg';
    const circle = await agent.post('/api/circle', { name: 'Ava', kind: 'person', avatarUrl: photo });
    const personId = circle.data.person.id;

    // Client sends no avatarUrl — server copies from My Circle onto the stored recipient.
    const list = await createList(agent, {
      title: 'Ava turns 6',
      recipients: [{ name: 'Ava', circlePersonId: personId }],
    });
    expect(list.recipients[0].avatarUrl).toBe(photo);

    const bare = await createList(agent, {
      title: 'Ava Christmas',
      recipients: [{ name: 'Ava', circlePersonId: personId }],
    });

    // Person listed before they had a photo — later My Circle photo should appear everywhere.
    const noPhoto = await agent.post('/api/circle', { name: 'Leo', kind: 'person' });
    const leoList = await createList(agent, {
      title: 'Leo turns 4',
      recipients: [{ name: 'Leo', circlePersonId: noPhoto.data.person.id }],
    });
    expect(leoList.recipients[0].avatarUrl).toBeNull();

    const leoPhoto = 'https://cdn.example.com/leo.jpg';
    expect((await agent.patch(`/api/circle/${noPhoto.data.person.id}`, { avatarUrl: leoPhoto })).status).toBe(200);

    const summaries = await agent.get('/api/wishlists');
    const leoSummary = summaries.data.wishlists.find((w: { id: string }) => w.id === leoList.id);
    expect(leoSummary.recipients[0].avatarUrl).toBe(leoPhoto);

    const detail = await agent.get(`/api/wishlists/${leoList.id}`);
    expect(detail.data.recipients[0].avatarUrl).toBe(leoPhoto);

    const pub = await agent.get(`/api/public/lists/${leoList.shareToken}`);
    expect(pub.data.recipients[0].avatarUrl).toBe(leoPhoto);

    const avaPub = await agent.get(`/api/public/lists/${bare.shareToken}`);
    expect(avaPub.data.recipients[0].avatarUrl).toBe(photo);
  });

  it('requires auth for My Circle', async () => {
    expect((await new Agent().get('/api/circle')).status).toBe(401);
    expect((await new Agent().post('/api/circle', { name: 'Ava' })).status).toBe(401);
  });
});
