import { beforeEach, describe, expect, it } from 'vitest';
import { priorityLayout, priorityLayoutSettings } from '../shared/constants';
import { groupByPriority, mergeSectionOrder } from '../src/lib/priority';
import { Agent, createList, freshStore, signUp } from './helpers';

beforeEach(freshStore);

describe('priority layout', () => {
  it('maps the three choices onto the two settings and back', () => {
    for (const layout of ['grouped', 'ordered', 'hidden'] as const) expect(priorityLayout(priorityLayoutSettings(layout))).toBe(layout);
    // Lists saved before the setting existed are grouped.
    expect(priorityLayout({ showPriorities: true })).toBe('grouped');
    expect(priorityLayout({ showPriorities: false, itemOrder: 'priority' })).toBe('hidden');
  });

  it('groups must haves, then really wants, then the rest, each in list order', () => {
    const rows = [
      { id: 'a', p: null },
      { id: 'b', p: 'really_want' },
      { id: 'c', p: 'must_have' },
      { id: 'd', p: 'interested' },
      { id: 'e', p: 'must_have' },
    ] as const;
    const sections = groupByPriority([...rows], (r) => r.p);
    expect(sections.map((s) => [s.key, s.rows.map((r) => r.id)])).toEqual([
      ['must_have', ['c', 'e']],
      ['really_want', ['b']],
      ['rest', ['a', 'd']],
    ]);
    expect(groupByPriority([{ p: null }], (r) => r.p).map((s) => s.key)).toEqual(['rest']);
  });

  it('puts a reordered section back without moving anything else', () => {
    expect(mergeSectionOrder(['a', 'b', 'c', 'd', 'e'], ['e', 'c'])).toEqual(['a', 'b', 'e', 'd', 'c']);
  });

  it('saves the arrangement on the list and validates it', async () => {
    const { agent } = await signUp();
    const list = await createList(agent);
    expect(list.settings.itemOrder).toBe('priority');

    const res = await agent.patch(`/api/wishlists/${list.id}`, { settings: { itemOrder: 'custom' } });
    expect(res.status).toBe(200);
    expect(res.data.wishlist.settings).toMatchObject({ itemOrder: 'custom', showPriorities: true });
    expect((await agent.patch(`/api/wishlists/${list.id}`, { settings: { itemOrder: 'random' } })).status).toBe(400);

    const collection = await createList(agent, { kind: 'collection' });
    expect(collection.settings.itemOrder).toBe('custom');
  });

  it('only the owner can change it', async () => {
    const { agent } = await signUp();
    const list = await createList(agent);
    const other = new Agent();
    expect((await other.patch(`/api/wishlists/${list.id}`, { settings: { itemOrder: 'custom' } })).status).toBe(401);
  });
});
