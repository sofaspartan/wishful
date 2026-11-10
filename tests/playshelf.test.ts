import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPlayshelfDesired, parseRow, parseRows, rawgSized } from '../server/integrations/playshelfData';
import { SyncError } from '../server/integrations/syncTypes';
import { Agent, createItem, freshStore, signUp } from './helpers';

const API = 'https://playshelf-db.supabase.co';
const KEY = 'anon-test-key';
const ETHAN = 'ffd8c277-e8ee-46cd-aab6-6dc4f36041b4';

/** A tiny stand-in for Playshelf's Supabase REST API (public rows only, as its row-level security allows). */
const db = {
  profiles: [] as Array<{ id: string; username: string; library_public: boolean }>,
  game_library: [] as Array<Record<string, unknown>>,
  wishlist: [] as Array<Record<string, unknown>>,
};
const failing = new Map<string, number>();
const requested: Array<{ url: string; headers: Record<string, string> }> = [];

function answer(url: string): { status: number; body: unknown } {
  const u = new URL(url);
  const table = u.pathname.replace('/rest/v1/', '');
  if (failing.has(table)) return { status: failing.get(table)!, body: { message: 'nope' } };
  const eq = (name: string) => u.searchParams.get(name)?.replace(/^eq\./, '');
  const visible = (userId: unknown) => db.profiles.some((p) => p.id === userId && p.library_public);
  if (table === 'profiles') {
    const ilike = u.searchParams.get('username')?.replace(/^ilike\./, '').toLowerCase();
    const rows = db.profiles.filter((p) => p.library_public && (ilike === undefined || p.username.toLowerCase() === ilike) && (!eq('id') || p.id === eq('id')));
    return { status: 200, body: rows.map(({ id, username }) => ({ id, username })) };
  }
  if (table === 'game_library') return { status: 200, body: db.game_library.filter((r) => r.user_id === eq('user_id') && visible(r.user_id)) };
  if (table === 'wishlist') return { status: 200, body: db.wishlist.filter((r) => r.user_id === eq('user_id') && visible(r.user_id)) };
  return { status: 404, body: {} };
}

vi.mock('../server/services/safeFetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/services/safeFetch')>();
  return {
    ...actual,
    safeFetchBytes: vi.fn(async (url: string, options: { headers?: Record<string, string> } = {}) => {
      requested.push({ url, headers: options.headers ?? {} });
      const { status, body } = answer(url);
      return { url, status, contentType: 'application/json', body: Buffer.from(JSON.stringify(body)), headers: {} };
    }),
  };
});

let rowId = 0;
function game(id: number, title: string, extra: Record<string, unknown> = {}, data: Record<string, unknown> = {}) {
  rowId += 1;
  return {
    id: `row-${rowId}`,
    user_id: ETHAN,
    game_id: id,
    status: 'backlog',
    rating: null,
    notes: null,
    is_pinned: false,
    platform: 'null',
    added_at: `2026-0${(rowId % 9) + 1}-01T12:00:00Z`,
    game_data: {
      title,
      genres: [{ id: 4, name: 'Action' }, { id: 51, name: 'Indie' }],
      released: '2019-07-30',
      platforms: [{ platform: { id: 7, name: 'Nintendo Switch' } }, { platform: { id: 4, name: 'PC' } }],
      metacritic: 80,
      cover_image: null,
      description_raw: 'A little hiking game.\n\nExplore the park.',
      background_image: `https://media.rawg.io/media/games/abc/${id}.jpg`,
      additional_images: [],
      selected_platform: 'Nintendo Switch',
      short_screenshots: [{ id: 1, image: `https://media.rawg.io/media/games/abc/${id}.jpg` }, { id: 2, image: `https://media.rawg.io/media/screenshots/s/${id}-1.jpg` }],
      ...data,
    },
    ...extra,
  };
}

async function owner() {
  return signUp(new Agent(), { email: 'ethan@example.com' });
}

const connect = (agent: Agent, username = 'ethan') => agent.put('/api/integrations/playshelf', { username });

beforeEach(() => {
  freshStore();
  requested.length = 0;
  failing.clear();
  rowId = 0;
  db.profiles = [
    { id: ETHAN, username: 'Ethan', library_public: true },
    { id: 'someone-private', username: 'Hidden', library_public: false },
  ];
  db.game_library = [];
  db.wishlist = [];
  process.env.INTEGRATION_ALLOWED_EMAILS = 'ethan@example.com';
  process.env.PLAYSHELF_SUPABASE_URL = `${API}/`;
  process.env.PLAYSHELF_SUPABASE_ANON_KEY = KEY;
  process.env.PLAYSHELF_SITE_URL = 'https://playshelf.example';
});

afterEach(() => {
  delete process.env.INTEGRATION_ALLOWED_EMAILS;
  delete process.env.PLAYSHELF_SUPABASE_URL;
  delete process.env.PLAYSHELF_SUPABASE_ANON_KEY;
  delete process.env.PLAYSHELF_SITE_URL;
});

describe('playshelf data', () => {
  it('asks RAWG for resized photos', () => {
    expect(rawgSized('https://media.rawg.io/media/games/abc/1.jpg', 640)).toBe('https://media.rawg.io/media/resize/640/-/games/abc/1.jpg');
    expect(rawgSized('https://media.rawg.io/media/resize/640/-/games/abc/1.jpg', 1280)).toBe('https://media.rawg.io/media/resize/640/-/games/abc/1.jpg');
    expect(rawgSized('https://example.com/a.jpg', 640)).toBe('https://example.com/a.jpg');
  });

  it('reads a library row, treating "null" strings as empty', () => {
    const row = parseRow(game(1, 'A Short Hike', { status: 'completed', rating: 5, notes: 'Lovely', is_pinned: true }))!;
    expect(row).toMatchObject({ key: '1', title: 'A Short Hike', platform: 'Nintendo Switch', genres: ['Action', 'Indie'], status: 'completed', rating: 5, review: 'Lovely', pinned: true });
    expect(row.screenshots).toEqual(['https://media.rawg.io/media/screenshots/s/1-1.jpg']);
    expect(parseRow(game(2, 'x', {}, { selected_platform: null }))!.platform).toBe('Nintendo Switch');
    expect(parseRow({ id: 'r', game_data: {} })).toBeNull();
    expect(() => parseRows({ message: 'error' }, 'library')).toThrow(SyncError);
  });

  it('builds games with platform, tags, links and descriptions, merging copies', () => {
    const library = parseRows(
      [
        game(10, 'Hades', { status: 'playing', rating: 4, notes: 'One more run', is_pinned: true }),
        game(10, 'Hades', { status: 'playing' }, { selected_platform: 'PlayStation 5' }),
      ],
      'library',
    );
    const wishlist = parseRows([game(20, 'Hollow Knight: Silksong', { priority: 'high', notes: 'Any platform is fine' })], 'wishlist');
    const d = buildPlayshelfDesired(library, wishlist, 'USD');

    const hades = d.items.get('10')!;
    expect(hades.owned).toMatchObject({ quantity: 2 });
    expect(hades.fields).toMatchObject({
      title: 'Hades',
      externalUrl: 'https://rawg.io/games/10',
      imageUrl: 'https://media.rawg.io/media/resize/640/-/games/abc/10.jpg',
      description: 'Released 2019 · Metacritic 80\n\nA little hiking game.\n\nExplore the park.',
      currency: 'USD',
    });
    expect(hades.fields.tags).toContain('Playing');
    expect(hades.fields.tags).toEqual(expect.arrayContaining(['Action', 'Indie']));
    expect([hades.fields.category, ...hades.fields.tags]).toEqual(expect.arrayContaining(['Nintendo Switch', 'PlayStation 5']));

    expect(d.items.get('20')!.owned).toBeNull();
    expect(d.items.get('20')!.fields.tags).not.toContain('Backlog');
    expect(d.library).toEqual(['10']);
    expect(d.wishlist).toEqual(['20']);
    expect(d.priorities.get('20')).toBe('must_have');
    expect(d.notes.get('20')).toBe('Any platform is fine');
  });
});

describe('playshelf sync', () => {
  it('is invisible to accounts that are not on the allow list', async () => {
    const { agent, user } = await signUp();
    expect(user.integrations.playshelf).toBe(false);
    expect((await agent.get('/api/integrations/playshelf')).status).toBe(404);
    expect((await connect(agent)).status).toBe(404);
    expect((await agent.post('/api/integrations/playshelf/sync')).status).toBe(404);
  });

  it('says so when the server has no Playshelf settings', async () => {
    delete process.env.PLAYSHELF_SUPABASE_ANON_KEY;
    const { agent } = await owner();
    expect((await agent.get('/api/integrations/playshelf')).data.status).toMatchObject({ configured: false, connected: false });
    const res = await connect(agent);
    expect(res.status).toBe(400);
    expect(requested).toHaveLength(0);
  });

  it('only finds public profiles, by exact username', async () => {
    const { agent } = await owner();
    db.game_library = [game(1, 'A Short Hike')];
    expect((await connect(agent, 'Hidden')).data.error.fields.username).toMatch(/Library Visibility/);
    expect((await connect(agent, 'Eth')).status).toBe(400);
    expect((await agent.put('/api/integrations/playshelf', { username: 'a,b' })).status).toBe(400);
  });

  it('mirrors the library into a game collection, using the anon key', async () => {
    const { agent } = await owner();
    db.game_library = [
      game(1, 'A Short Hike', { status: 'completed', rating: 5, notes: 'Lovely', is_pinned: true }),
      game(2, 'Animal Crossing: New Horizons', { status: 'playing' }),
    ];
    const res = await connect(agent);
    expect(res.status).toBe(200);
    const status = res.data.status;
    expect(status).toMatchObject({ connected: true, username: 'Ethan', profileUrl: 'https://playshelf.example/profile/Ethan', wishlistId: null, lastError: null });
    expect(status.lastResult).toMatchObject({ added: 2, updated: 0, removed: 0, moved: 0 });
    expect(requested.every((r) => r.url.startsWith(`${API}/rest/v1/`) && r.headers.apikey === KEY && r.headers.authorization === `Bearer ${KEY}`)).toBe(true);

    const coll = (await agent.get(`/api/wishlists/${status.collectionId}`)).data;
    expect(coll.wishlist).toMatchObject({ title: 'Video Game Collection', kind: 'collection', visibility: 'private', coverArt: { icon: 'controller' }, link: { provider: 'playshelf', tab: 'library' } });
    const hike = Object.values<any>(coll.items).find((i) => i.source.key === '1');
    expect(hike).toMatchObject({ title: 'A Short Hike', category: 'Nintendo Switch', owned: { quantity: 1, rating: 5, review: 'Lovely' } });
    expect(hike.tags).toEqual(expect.arrayContaining(['Completed', 'Favorite']));

    const again = await agent.post('/api/integrations/playshelf/sync');
    expect(again.data).toMatchObject({ changed: false, status: { lastResult: { added: 0, updated: 0, removed: 0, moved: 0 } } });
  });

  it('creates the game wishlist once there is something on it, and follows moves and removals', async () => {
    const { agent } = await owner();
    db.game_library = [game(1, 'A Short Hike'), game(2, 'Celeste')];
    const { status } = (await connect(agent)).data;
    expect(status.wishlistId).toBeNull();

    db.wishlist = [game(3, 'Hades', { priority: 'high', notes: 'The Switch version' }), game(4, 'Tunic', { priority: 'low' })];
    const second = (await agent.post('/api/integrations/playshelf/sync')).data.status;
    expect(second.wishlistId).toBeTruthy();
    const wish = (await agent.get(`/api/wishlists/${second.wishlistId}`)).data;
    expect(wish.wishlist).toMatchObject({ title: 'Video Game Wishlist', kind: 'wishlist', link: { provider: 'playshelf', tab: 'wishlist' } });
    const hadesEntry = wish.wishlist.entries.find((e: any) => wish.items[e.itemId].source.key === '3');
    expect(hadesEntry).toMatchObject({ priority: 'must_have', customNotes: 'The Switch version' });
    const hades = wish.items[hadesEntry.itemId];

    // Bought Hades, dropped Celeste and Tunic.
    db.game_library = [game(1, 'A Short Hike'), game(3, 'Hades', { status: 'playing' })];
    db.wishlist = [];
    const third = (await agent.post('/api/integrations/playshelf/sync')).data;
    expect(third.status.lastResult).toMatchObject({ added: 0, removed: 2, moved: 1 });
    const moved = (await agent.get(`/api/items/${hades.id}`)).data.item;
    expect(moved.wishlistIds).toEqual([status.collectionId]);
    expect(moved.owned.acquiredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await agent.get(`/api/wishlists/${second.wishlistId}`)).data.wishlist.entries).toHaveLength(0);
  });

  it('protects synced games but keeps Wishful-only details', async () => {
    const { agent } = await owner();
    db.game_library = [game(1, 'A Short Hike', { rating: 5 })];
    const { status } = (await connect(agent)).data;
    const coll = (await agent.get(`/api/wishlists/${status.collectionId}`)).data;
    const item = coll.items[coll.wishlist.entries[0].itemId];

    const edited = await agent.patch(`/api/items/${item.id}`, { title: 'Renamed', notes: 'Physical copy', owned: { rating: 1, pricePaid: 20 } });
    expect(edited.data.item).toMatchObject({ title: 'A Short Hike', notes: 'Physical copy', owned: { rating: 5, pricePaid: 20 } });
    const removed = await agent.del(`/api/items/${item.id}`);
    expect(removed.status).toBe(409);
    expect(removed.data.error.message).toMatch(/Playshelf/);

    const own = await createItem(agent, { wishlistIds: [status.collectionId] });
    expect((await agent.del(`/api/items/${own.id}`)).status).toBe(200);

    await agent.post('/api/integrations/playshelf/sync');
    expect((await agent.get(`/api/items/${item.id}`)).data.item).toMatchObject({ notes: 'Physical copy', owned: { pricePaid: 20 } });
  });

  it('changes nothing when Playshelf fails, comes back empty or the library goes private', async () => {
    const { agent } = await owner();
    db.game_library = [game(1, 'A Short Hike')];
    const { status } = (await connect(agent)).data;

    failing.set('game_library', 500);
    const broken = (await agent.post('/api/integrations/playshelf/sync')).data;
    expect(broken.changed).toBe(false);
    expect(broken.status.lastError).toMatch(/error \(500\)/);
    failing.clear();

    failing.set('wishlist', 401);
    expect((await agent.post('/api/integrations/playshelf/sync')).data.status.lastError).toMatch(/ANON_KEY/);
    failing.clear();

    db.game_library = [];
    expect((await agent.post('/api/integrations/playshelf/sync')).data.status.lastError).toMatch(/came back empty/);

    db.game_library = [game(1, 'A Short Hike')];
    db.profiles[0].library_public = false;
    expect((await agent.post('/api/integrations/playshelf/sync')).data.status.lastError).toMatch(/isn’t public/);

    expect((await agent.get(`/api/wishlists/${status.collectionId}`)).data.wishlist.entries).toHaveLength(1);

    db.profiles[0].library_public = true;
    expect((await agent.post('/api/integrations/playshelf/sync')).data.status.lastError).toBeNull();
  });

  it('lets go of the games on disconnect, leaving them as ordinary items', async () => {
    const { agent } = await owner();
    db.game_library = [game(1, 'A Short Hike')];
    const { status } = (await connect(agent)).data;
    const res = await agent.del('/api/integrations/playshelf');
    expect(res.status).toBe(200);
    expect(res.data.status.connected).toBe(false);

    const coll = (await agent.get(`/api/wishlists/${status.collectionId}`)).data;
    expect(coll.wishlist.link).toBeNull();
    const item = coll.items[coll.wishlist.entries[0].itemId];
    expect(item.source).toBeNull();
    expect((await agent.del(`/api/items/${item.id}`)).status).toBe(200);
  });

  it('runs alongside Brickfolio without mixing them up', async () => {
    const { agent } = await owner();
    db.game_library = [game(1, 'A Short Hike')];
    await connect(agent);
    const brick = (await agent.get('/api/integrations/brickfolio')).data.status;
    expect(brick.connected).toBe(false);
  });
});
