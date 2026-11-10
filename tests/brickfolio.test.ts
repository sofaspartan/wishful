import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCsv } from '../shared/csv';
import { buildDesired, listingImage, parseSheet, pickCatalogSets, sheetRating, SyncError } from '../server/integrations/brickfolioData';
import { advanceClock } from '../server/util';
import { Agent, createItem, createList, freshStore, signUp } from './helpers';

const SITE = 'https://bricks.example';
const FULL = 'https://docs.google.com/spreadsheets/d/e/x/pub?gid=1&single=true&output=csv';
const WISH = 'https://docs.google.com/spreadsheets/d/e/x/pub?gid=2&single=true&output=csv';

/** What each URL answers in the current test. */
const files = new Map<string, { status: number; body: string; headers?: Record<string, string> }>();
const requested: Array<{ url: string; headers: Record<string, string> }> = [];

vi.mock('../server/services/safeFetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/services/safeFetch')>();
  return {
    ...actual,
    safeFetchBytes: vi.fn(async (url: string, options: { headers?: Record<string, string> } = {}) => {
      requested.push({ url, headers: options.headers ?? {} });
      const file = files.get(url);
      if (!file) return { url, status: 404, contentType: 'text/plain', body: Buffer.from('not found'), headers: {} };
      return { url, status: file.status, contentType: 'text/csv', body: Buffer.from(file.body), headers: file.headers ?? {} };
    }),
  };
});

const CATALOG = [
  'set_num,name,year,theme_id,num_parts,img_url',
  '10497-1,Galaxy Explorer,2022,1,1254,https://cdn.rebrickable.com/media/sets/10497-1.jpg',
  '31379-1,Botanical Bird,2025,1,780,https://cdn.rebrickable.com/media/sets/31379-1.jpg',
  '31379-2,Botanical Bird (variant),2025,1,780,https://cdn.rebrickable.com/media/sets/31379-2.jpg',
  '76989-1,Horizon Forbidden West,2022,1,1222,https://cdn.rebrickable.com/media/sets/76989-1.jpg',
].join('\n');

function serveSheets(full: string, wish: string) {
  files.set(FULL, { status: 200, body: full });
  files.set(WISH, { status: 200, body: wish });
}

const FULL_HEADER = 'set_num,theme,quantity,name_override,pieces_override,price,currency,lego_star_rating,lego_review,favorite_set,favorite_part';
const WISH_HEADER = 'set_num,theme,quantity,name_override,pieces_override,price';

async function owner() {
  const { agent, user } = await signUp(new Agent(), { email: 'builder@example.com' });
  return { agent, user };
}

beforeEach(() => {
  freshStore();
  files.clear();
  requested.length = 0;
  process.env.INTEGRATION_ALLOWED_EMAILS = 'someone@else.com, Builder@Example.com';
  files.set(`${SITE}/sets.csv`, { status: 200, body: CATALOG, headers: { etag: '"v1"' } });
  files.set(`${SITE}/set-images.json`, {
    status: 200,
    body: JSON.stringify({ '10497': ['set images/10497_alt1.png', 'set images/10497_Box1.png', 'set images/10497_close_shot.png'], '76989': ['set images/76989.png'] }),
  });
});

afterEach(() => {
  delete process.env.INTEGRATION_ALLOWED_EMAILS;
});

describe('csv parsing', () => {
  it('handles quotes, escaped quotes, newlines inside cells, CRLF and a BOM', () => {
    const rows = parseCsv('\uFEFFa,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n\r\n1,2,3');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'line1\nline2'],
      ['1', '2', '3'],
    ]);
  });

  it('detects semicolon and tab separated files', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a\tb\n1\t2')[1]).toEqual(['1', '2']);
  });
});

describe('brickfolio data', () => {
  it('reads a sheet tab, deduping set numbers and rejecting web pages', () => {
    const rows = parseSheet(`${FULL_HEADER}\n10497,Icons,2,,,"$99.99",usd,4.6,Great build,Yes,The cockpit\n10497,Icons,1\n,blank row\n`, 'full_sets');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ setNum: '10497', quantity: 2, price: 99.99, currency: 'USD', rating: 5, review: 'Great build', favorite: true, favoritePart: 'The cockpit' });
    expect(() => parseSheet('<!DOCTYPE html><html>', 'wishlist')).toThrow(SyncError);
    expect(() => parseSheet('name,price\nx,1', 'wishlist')).toThrow(/set_num/);
  });

  it('turns Brickfolio ratings into whole stars, treating 0 as unrated', () => {
    expect(sheetRating('0')).toBeNull();
    expect(sheetRating('')).toBeNull();
    expect(sheetRating('3.4')).toBe(3);
    expect(sheetRating('9')).toBe(5);
  });

  it('matches base set numbers to the -1 variant first and exact variants only exactly', () => {
    const sets = pickCatalogSets(CATALOG, new Set(['31379', '10497-1', '99999']));
    expect(sets['31379'].setNum).toBe('31379-1');
    expect(sets['10497-1'].name).toBe('Galaxy Explorer');
    expect(sets['99999']).toBeUndefined();
  });

  it('picks photos the way Brickfolio does', () => {
    const cat = 'https://cdn.rebrickable.com/a.jpg';
    expect(listingImage(cat, ['set images/1_alt1.png', 'set images/1_Box1.png'])).toBe('set images/1_Box1.png');
    expect(listingImage(cat, ['set images/1_alt1.png', 'set images/1.png'])).toBe(cat);
    expect(listingImage(null, ['set images/1_alt1.png', 'set images/1_close_shot.png', 'set images/1.png'])).toBe('set images/1.png');
    expect(listingImage(null, ['set images/1_alt2.png'])).toBe('set images/1_alt2.png');
    // The rules look at file names, not the site's domain.
    expect(listingImage(cat, ['set images/7.png'])).toBe(cat);
  });

  it('builds items from both tabs with photos, links and descriptions', () => {
    const full = parseSheet(`${FULL_HEADER}\n10497,Icons,1,,,,,,,,The engines`, 'full_sets');
    const wish = parseSheet(`${WISH_HEADER}\n76989,Horizon,1,My Tallneck,,149.99`, 'wishlist');
    const catalog = pickCatalogSets(CATALOG, new Set(['10497', '76989']));
    const manifest = { '10497': ['set images/10497_alt1.png', 'set images/10497_Box1.png'], '76989': 'set images/76989 front.png' };
    const d = buildDesired(full, wish, catalog, manifest, SITE, 'CAD');

    const owned = d.sets.get('10497')!;
    expect(owned.fields).toMatchObject({
      title: 'Galaxy Explorer',
      description: '1,254 pieces · Released 2022\n\nFavorite part: The engines',
      imageUrl: `${SITE}/set%20images/10497_Box1.png`,
      externalUrl: 'https://brickset.com/sets/10497-1',
      brand: 'LEGO',
      category: 'Icons',
      currency: 'CAD',
      model: '10497',
    });
    expect(owned.fields.gallery).toEqual([`${SITE}/set%20images/10497_alt1.png`, 'https://cdn.rebrickable.com/media/sets/10497-1.jpg']);
    expect(owned.owned).toEqual({ quantity: 1, rating: null, review: '' });

    const wanted = d.sets.get('76989')!;
    expect(wanted.owned).toBeNull();
    expect(wanted.fields.title).toBe('My Tallneck');
    expect(wanted.fields.price).toBe(149.99);
    expect(wanted.fields.externalUrl).toBe('https://www.lego.com/en-us/search?q=76989');
    expect(wanted.fields.imageUrl).toBe('https://cdn.rebrickable.com/media/sets/76989-1.jpg');
    expect(d.collection).toEqual(['10497']);
    expect(d.wishlist).toEqual(['76989']);
  });
});

describe('brickfolio sync', () => {
  const connect = (agent: Agent) => agent.put('/api/integrations/brickfolio', { siteUrl: `${SITE}/library`, fullSetsCsvUrl: FULL, wishlistCsvUrl: WISH });

  it('is invisible to accounts that are not on the allow list', async () => {
    const { agent, user } = await signUp();
    expect(user.integrations).toEqual({ brickfolio: false });
    expect((await agent.get('/api/integrations/brickfolio')).status).toBe(404);
    expect((await connect(agent)).status).toBe(404);
    expect((await agent.post('/api/integrations/brickfolio/sync')).status).toBe(404);
  });

  it('only accepts https links', async () => {
    const { agent, user } = await owner();
    expect(user.integrations).toEqual({ brickfolio: true });
    const res = await agent.put('/api/integrations/brickfolio', { siteUrl: 'http://bricks.example', fullSetsCsvUrl: FULL, wishlistCsvUrl: WISH });
    expect(res.status).toBe(400);
  });

  it('mirrors both tabs into a collection and a wishlist, then follows the sheet', async () => {
    const { agent } = await owner();
    serveSheets(`${FULL_HEADER}\n10497,Icons,1,,,,,4,Loved it,yes,`, `${WISH_HEADER}\n76989,Horizon,1,,,149.99\n31379,Botanicals,1,,,59.99`);
    const res = await connect(agent);
    expect(res.status).toBe(200);
    const status = res.data.status;
    expect(status).toMatchObject({ connected: true, siteUrl: SITE, lastError: null, lastResult: { added: 3, updated: 0, removed: 0, moved: 0 } });

    const coll = (await agent.get(`/api/wishlists/${status.collectionId}`)).data;
    expect(coll.wishlist).toMatchObject({ title: 'LEGO Collection', kind: 'collection', visibility: 'private', link: { provider: 'brickfolio', tab: 'full_sets' } });
    expect(coll.wishlist.entries).toHaveLength(1);
    const galaxy = coll.items[coll.wishlist.entries[0].itemId];
    expect(galaxy).toMatchObject({ title: 'Galaxy Explorer', tags: ['Favorite'], owned: { quantity: 1, rating: 4, review: 'Loved it' }, source: { provider: 'brickfolio', key: '10497' } });

    const wish = (await agent.get(`/api/wishlists/${status.wishlistId}`)).data;
    expect(wish.wishlist.entries).toHaveLength(2);
    const tallneck = Object.values<any>(wish.items).find((i) => i.source.key === '76989');

    // Nothing changed: nothing is rewritten.
    const again = await agent.post('/api/integrations/brickfolio/sync');
    expect(again.data).toMatchObject({ changed: false, status: { lastResult: { added: 0, updated: 0, removed: 0, moved: 0 } } });

    // Bought the Tallneck, dropped the bird, re-rated the Galaxy Explorer.
    serveSheets(`${FULL_HEADER}\n10497,Icons,1,,,,,5,Loved it,yes,\n76989,Horizon,1,,,149.99`, `${WISH_HEADER}\n`);
    const third = await agent.post('/api/integrations/brickfolio/sync');
    expect(third.data.changed).toBe(true);
    expect(third.data.status.lastResult).toMatchObject({ added: 0, updated: 1, removed: 1, moved: 1 });
    expect((await agent.get(`/api/wishlists/${status.wishlistId}`)).data.wishlist.entries).toHaveLength(0);
    const moved = (await agent.get(`/api/items/${tallneck.id}`)).data.item;
    expect(moved.owned.acquiredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(moved.wishlistIds).toEqual([status.collectionId]);
  });

  it('keeps Wishful-only details but protects what comes from the sheet', async () => {
    const { agent } = await owner();
    serveSheets(`${FULL_HEADER}\n10497,Icons,1,,,,,4,,,`, `${WISH_HEADER}\n76989,Horizon,1`);
    const { status } = (await connect(agent)).data;
    const coll = (await agent.get(`/api/wishlists/${status.collectionId}`)).data;
    const item = coll.items[coll.wishlist.entries[0].itemId];

    const edited = await agent.patch(`/api/items/${item.id}`, { title: 'Renamed', notes: 'On the shelf', owned: { rating: 1, condition: 'like_new', pricePaid: 80 } });
    expect(edited.status).toBe(200);
    expect(edited.data.item).toMatchObject({ title: 'Galaxy Explorer', notes: 'On the shelf', owned: { rating: 4, condition: 'like_new', pricePaid: 80 } });

    expect((await agent.del(`/api/items/${item.id}`)).status).toBe(409);
    expect((await agent.put(`/api/items/${item.id}/wishlists`, { wishlistIds: [] })).status).toBe(409);
    expect((await agent.del(`/api/wishlists/${status.collectionId}/entries/${coll.wishlist.entries[0].id}`)).status).toBe(409);

    const wish = (await agent.get(`/api/wishlists/${status.wishlistId}`)).data;
    const wanted = wish.items[wish.wishlist.entries[0].itemId];
    expect((await agent.post(`/api/items/${wanted.id}/got-it`, { collectionId: status.collectionId, removeFromWishlistId: status.wishlistId, owned: {} })).status).toBe(409);

    // Ordinary items on a linked list are still fully editable.
    const own = await createItem(agent, { wishlistIds: [status.wishlistId] });
    expect((await agent.del(`/api/items/${own.id}`)).status).toBe(200);

    // The sync keeps the Wishful-only details.
    serveSheets(`${FULL_HEADER}\n10497,Icons,2,,,,,4,,,`, `${WISH_HEADER}\n76989,Horizon,1`);
    await agent.post('/api/integrations/brickfolio/sync');
    const after = (await agent.get(`/api/items/${item.id}`)).data.item;
    expect(after).toMatchObject({ notes: 'On the shelf', owned: { quantity: 2, condition: 'like_new', pricePaid: 80 } });
  });

  it('changes nothing when a download fails or both tabs come back empty', async () => {
    const { agent } = await owner();
    serveSheets(`${FULL_HEADER}\n10497`, `${WISH_HEADER}\n76989`);
    const { status } = (await connect(agent)).data;

    files.set(FULL, { status: 200, body: '<html><body>Sign in</body></html>' });
    const broken = await agent.post('/api/integrations/brickfolio/sync');
    expect(broken.data.changed).toBe(false);
    expect(broken.data.status.lastError).toMatch(/web page instead of CSV/);

    serveSheets(`${FULL_HEADER}\n`, `${WISH_HEADER}\n`);
    const empty = await agent.post('/api/integrations/brickfolio/sync');
    expect(empty.data.status.lastError).toMatch(/came back empty/);

    files.delete(`${SITE}/sets.csv`);
    serveSheets(`${FULL_HEADER}\n10497`, `${WISH_HEADER}\n`);
    const noCatalog = await agent.post('/api/integrations/brickfolio/sync');
    expect(noCatalog.data.status.lastError).toMatch(/sets\.csv/);

    expect((await agent.get(`/api/wishlists/${status.collectionId}`)).data.wishlist.entries).toHaveLength(1);
    expect((await agent.get(`/api/wishlists/${status.wishlistId}`)).data.wishlist.entries).toHaveLength(1);
  });

  it('asks for the catalog conditionally once it has every set, and skips fresh syncs', async () => {
    const { agent } = await owner();
    serveSheets(`${FULL_HEADER}\n10497`, `${WISH_HEADER}\n`);
    await connect(agent);
    requested.length = 0;

    const skipped = await agent.post('/api/integrations/brickfolio/sync?ifStale=1');
    expect(skipped.data.changed).toBe(false);
    expect(requested).toHaveLength(0);

    advanceClock(16 * 60_000);
    files.set(`${SITE}/sets.csv`, { status: 304, body: '' });
    const stale = await agent.post('/api/integrations/brickfolio/sync?ifStale=1');
    expect(stale.data.status.lastError).toBeNull();
    expect(requested.find((r) => r.url.endsWith('/sets.csv'))!.headers['if-none-match']).toBe('"v1"');
  });

  it('looks up sets the catalog lacks through Brickfolio’s Brickset proxy, once', async () => {
    const lookup = (setNumber: string) => {
      const u = new URL('/api/brickset/getSets', SITE);
      u.searchParams.set('userHash', '');
      u.searchParams.set('params', JSON.stringify({ setNumber }));
      return u.toString();
    };
    files.set(lookup('40899-1'), {
      status: 200,
      body: JSON.stringify({
        status: 'success',
        sets: [{ number: '40899', numberVariant: 1, name: 'Astro Bot', year: 2026, pieces: 276, image: { imageURL: 'https://images.brickset.com/sets/images/40899-1.jpg' } }],
      }),
    });
    files.set(lookup('55555-1'), { status: 200, body: JSON.stringify({ status: 'success', matches: 0, sets: [] }) });
    const { agent } = await owner();
    serveSheets(`${FULL_HEADER}\n40899\n55555`, `${WISH_HEADER}\n`);
    const { status } = (await connect(agent)).data;
    expect(status.lastResult.notInCatalog).toEqual(['55555']);
    const coll = (await agent.get(`/api/wishlists/${status.collectionId}`)).data;
    const astro = Object.values<any>(coll.items).find((i) => i.source.key === '40899');
    expect(astro).toMatchObject({ title: 'Astro Bot', description: '276 pieces · Released 2026', imageUrl: 'https://images.brickset.com/sets/images/40899-1.jpg' });

    requested.length = 0;
    await agent.post('/api/integrations/brickfolio/sync');
    expect(requested.filter((r) => r.url.includes('/api/brickset/'))).toHaveLength(0);
    advanceClock(25 * 60 * 60_000);
    await agent.post('/api/integrations/brickfolio/sync');
    expect(requested.filter((r) => r.url.includes('/api/brickset/')).map((r) => r.url)).toEqual([lookup('55555-1')]);
  });

  it('lets go of the sets on disconnect, leaving them as ordinary items', async () => {
    const { agent } = await owner();
    serveSheets(`${FULL_HEADER}\n10497`, `${WISH_HEADER}\n`);
    const { status } = (await connect(agent)).data;
    expect((await agent.del('/api/integrations/brickfolio')).status).toBe(200);

    const coll = (await agent.get(`/api/wishlists/${status.collectionId}`)).data;
    expect(coll.wishlist.link).toBeNull();
    const item = coll.items[coll.wishlist.entries[0].itemId];
    expect(item.source).toBeNull();
    expect((await agent.del(`/api/items/${item.id}`)).status).toBe(200);
  });

  it('does not touch lists the user made', async () => {
    const { agent } = await owner();
    const mine = await createList(agent, { title: 'Mine' });
    await createItem(agent, { wishlistIds: [mine.id] });
    serveSheets(`${FULL_HEADER}\n10497`, `${WISH_HEADER}\n`);
    await connect(agent);
    expect((await agent.get(`/api/wishlists/${mine.id}`)).data.wishlist.entries).toHaveLength(1);
  });
});
