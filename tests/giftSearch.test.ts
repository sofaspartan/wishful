import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bestBuyCriteria, ebayProducts, etsyProducts, interleave, shopifyProducts } from '../server/services/giftSearch';
import { amazonSearchUrl } from '../shared/giftIdeas';
import { Agent, freshStore, signUp } from './helpers';

const KEYS = {
  SHOPIFY_CATALOG: '',
  SHOPIFY_CATALOG_CLIENT_ID: 'shop-id',
  SHOPIFY_CATALOG_CLIENT_SECRET: 'shop-secret',
  EBAY_CLIENT_ID: 'ebay-id',
  EBAY_CLIENT_SECRET: 'ebay-secret',
  BESTBUY_API_KEY: 'bby-key',
  ETSY_API_KEY: 'etsy-key',
  ETSY_SHARED_SECRET: 'etsy-secret',
};

const EBAY_SEARCH = {
  total: 100,
  itemSummaries: [
    {
      itemId: 'v1|111|0',
      title: 'LEGO Icons Bonsai Tree 10281',
      image: { imageUrl: 'https://i.ebayimg.com/images/g/abc/s-l225.jpg' },
      price: { value: '44.99', currency: 'USD' },
      itemWebUrl: 'https://www.ebay.com/itm/111',
      seller: { username: 'brickshop' },
    },
    { itemId: 'v1|222|0', title: 'Sneaky', itemWebUrl: 'javascript:alert(1)' },
  ],
};

const BESTBUY_SEARCH = {
  currentPage: 1,
  totalPages: 1,
  products: [
    {
      sku: 6501234,
      name: 'LEGO - Star Wars Millennium Falcon 75375',
      salePrice: 84.99,
      largeFrontImage: 'https://pisces.bbystatic.com/image2/falcon.jpg',
      url: 'https://api.bestbuy.com/click/-/6501234/pdp',
      manufacturer: 'LEGO',
      customerReviewAverage: 4.8,
      customerReviewCount: 1520,
    },
  ],
};

const ETSY_ACTIVE = {
  count: 30,
  results: [
    { listing_id: 901, title: 'Custom LEGO &amp; Minifigure Display Frame', url: 'https://www.etsy.com/listing/901/frame', price: { amount: 2850, divisor: 100, currency_code: 'USD' } },
  ],
};

const ETSY_BATCH = { results: [{ listing_id: 901, images: [{ url_570xN: 'https://i.etsystatic.com/901/il_570xN.jpg' }] }] };

const SHOPIFY_PRODUCT = {
  id: 'gid://shopify/p/abc123',
  title: 'LEGO Icons Autumn Cottage Garden 11372',
  media: [{ type: 'image', url: 'https://cdn.shopify.com/s/files/cottage.jpg' }],
  price_range: { min: { amount: 11999, currency: 'USD' } },
  variants: [
    { url: 'https://shop.example/products/old?variant=1', price: { amount: 12999, currency: 'USD' }, availability: { available: false } },
    {
      url: 'https://shop.example/products/cottage?variant=2&_gsid=g1&utm_source=shopify&utm_medium=catalog',
      price: { amount: 11999, currency: 'USD' },
      seller: { name: 'Barnes &amp; Noble' },
      availability: { available: true },
    },
  ],
  rating: { value: 9, scale_max: 10, count: 42 },
};

const shopifySearch = (cursor: string | null, products: unknown[] = [SHOPIFY_PRODUCT]) => ({
  jsonrpc: '2.0',
  id: 1,
  result: { structuredContent: { products, pagination: cursor ? { has_next_page: true, cursor } : { has_next_page: false } } },
});

function storeApis(overrides: Partial<Record<'shopify' | 'ebay' | 'bestbuy' | 'etsy', () => Response>> = {}) {
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === 'api.shopify.com') return json({ access_token: 'shop-token' });
    if (url.hostname === 'catalog.shopify.com') {
      if (overrides.shopify) return overrides.shopify();
      const cursor = JSON.parse(String(init?.body)).params.arguments.catalog.pagination.cursor;
      if (cursor) return json(shopifySearch(null, [{ ...SHOPIFY_PRODUCT, id: 'gid://shopify/p/page2' }]));
      const euro = { ...SHOPIFY_PRODUCT, id: 'gid://shopify/p/eur', variants: [{ url: 'https://shop.example.be/p', price: { amount: 5299, currency: 'EUR' } }] };
      return json(shopifySearch('next-1', [SHOPIFY_PRODUCT, euro]));
    }
    if (url.hostname === 'api.ebay.com' && url.pathname.endsWith('/oauth2/token')) return json({ access_token: 'token-1', expires_in: 7200 });
    if (url.hostname === 'api.ebay.com') return overrides.ebay?.() ?? json(EBAY_SEARCH);
    if (url.hostname === 'api.bestbuy.com') return overrides.bestbuy?.() ?? json(BESTBUY_SEARCH);
    if (url.hostname === 'openapi.etsy.com') {
      if (overrides.etsy) return overrides.etsy();
      return json(url.pathname.endsWith('/batch') ? ETSY_BATCH : ETSY_ACTIVE);
    }
    throw new Error(`unexpected fetch ${url} ${init?.method ?? 'GET'}`);
  });
}

beforeEach(() => {
  freshStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('reading store results', () => {
  it('keeps only safe links, decodes titles, upsizes eBay photos and converts Etsy prices', () => {
    const ebay = ebayProducts(EBAY_SEARCH.itemSummaries);
    expect(ebay).toHaveLength(1);
    expect(ebay[0]).toMatchObject({ id: 'ebay:v1|111|0', price: 44.99, seller: 'brickshop', imageUrl: 'https://i.ebayimg.com/images/g/abc/s-l500.jpg' });

    const [etsy] = etsyProducts(ETSY_ACTIVE.results, new Map([[901, 'https://i.etsystatic.com/901/il_570xN.jpg']]));
    expect(etsy).toMatchObject({ title: 'Custom LEGO & Minifigure Display Frame', price: 28.5, currency: 'USD', imageUrl: 'https://i.etsystatic.com/901/il_570xN.jpg' });
  });

  it('reads Shopify catalog products: an in-stock variant, prices in cents, ratings out of 5, links left intact', () => {
    const [p, ...rest] = shopifyProducts([SHOPIFY_PRODUCT, { id: 'gid://shopify/p/bad', title: 'Sneaky', variants: [{ url: 'javascript:alert(1)' }] }]);
    expect(rest).toHaveLength(0);
    expect(p).toEqual({
      id: 'shopify:gid://shopify/p/abc123',
      store: 'shopify',
      title: 'LEGO Icons Autumn Cottage Garden 11372',
      url: 'https://shop.example/products/cottage?variant=2&_gsid=g1&utm_source=shopify&utm_medium=catalog',
      imageUrl: 'https://cdn.shopify.com/s/files/cottage.jpg',
      price: 119.99,
      currency: 'USD',
      seller: 'Barnes & Noble',
      rating: 4.5,
      reviewCount: 42,
    });
    const [yen] = shopifyProducts([{ ...SHOPIFY_PRODUCT, variants: [{ url: 'https://shop.example/p', price: { amount: 1500, currency: 'JPY' } }] }]);
    expect(yen.price).toBe(1500);
  });

  it('builds Best Buy searches from plain words only', () => {
    expect(bestBuyCriteria('LEGO star wars', 50)).toBe('search=lego&search=star&search=wars&onlineAvailability=true&salePrice%3C=50');
    expect(bestBuyCriteria('lego)&(apiKey=x|')).toBe('search=lego&search=apikey&search=x&onlineAvailability=true');
    expect(bestBuyCriteria('!!!')).toBeNull();
  });

  it('mixes stores one by one', () => {
    expect(interleave([['e1', 'e2', 'e3'], ['b1'], ['t1', 't2']])).toEqual(['e1', 'b1', 't1', 'e2', 't2', 'e3']);
  });

  it('links to Amazon search with an optional price cap and tag', () => {
    expect(amazonSearchUrl('lego sets', 25, 'me-20')).toBe('https://www.amazon.com/s?k=lego+sets&rh=p_36%3A-2500&tag=me-20');
  });
});

describe('the gift search endpoint', () => {
  it('needs a signed-in user and a valid search', async () => {
    expect((await new Agent().get('/api/gifts/search?q=lego')).status).toBe(401);
    const { agent } = await signUp();
    expect((await agent.get('/api/gifts/search?q=')).status).toBe(400);
    expect((await agent.get('/api/gifts/search?q=lego&maxPrice=33')).status).toBe(400);
    expect((await agent.get('/api/gifts/search?q=lego&store=amazon')).status).toBe(400);
    expect((await agent.get('/api/gifts/search?q=lego&page=9')).status).toBe(400);
  });

  it('searches Shopify without any keys, and only links to Amazon when Shopify is off', async () => {
    const fetchMock = storeApis();
    vi.stubGlobal('fetch', fetchMock);
    for (const name of Object.keys(KEYS)) vi.stubEnv(name, '');
    const { agent } = await signUp();
    const res = await agent.get('/api/gifts/search?q=LEGO');
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ stores: ['shopify'], hasMore: true, amazonUrl: 'https://www.amazon.com/s?k=LEGO' });
    expect(res.data.products.map((p: { id: string }) => p.id)).toEqual(['shopify:gid://shopify/p/abc123']);
    const [[input, init]] = fetchMock.mock.calls;
    expect(String(input)).toBe('https://catalog.shopify.com/api/ucp/mcp');
    expect(new Headers(init?.headers).get('authorization')).toBeNull();
    const body = JSON.parse(String(init?.body));
    expect(body.params.arguments.meta['ucp-agent'].profile).toMatch(/^https:\/\/shopify\.dev\//);
    expect(body.params.arguments.catalog.filters.price).toBeUndefined();

    vi.stubEnv('SHOPIFY_CATALOG', 'off');
    fetchMock.mockClear();
    const off = await agent.get('/api/gifts/search?q=LEGO');
    expect(off.data).toMatchObject({ stores: [], products: [], hasMore: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pages through Shopify with the cursor from the previous page', async () => {
    const fetchMock = storeApis();
    vi.stubGlobal('fetch', fetchMock);
    for (const name of Object.keys(KEYS)) vi.stubEnv(name, '');
    const { agent } = await signUp();
    const cursors = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).params.arguments.catalog.pagination.cursor ?? null);

    await agent.get('/api/gifts/search?q=lego');
    const page2 = await agent.get('/api/gifts/search?q=lego&page=2');
    expect(page2.data.products.map((p: { id: string }) => p.id)).toEqual(['shopify:gid://shopify/p/page2']);
    expect(page2.data.hasMore).toBe(false);
    expect(cursors()).toEqual([null, 'next-1']);

    // Page 3 has no cursor to start from, so Shopify isn't asked again.
    fetchMock.mockClear();
    const page3 = await agent.get('/api/gifts/search?q=lego&page=3');
    expect(page3.data.products).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    // Without page 1 cached, page 2 fetches it first to find the cursor.
    fetchMock.mockClear();
    await agent.get('/api/gifts/search?q=lego%20sets&page=2');
    expect(cursors()).toEqual([null, 'next-1']);
  });

  it('searches every store with its keys, mixes the results and caches each store', async () => {
    const fetchMock = storeApis();
    vi.stubGlobal('fetch', fetchMock);
    for (const [name, value] of Object.entries(KEYS)) vi.stubEnv(name, value);
    const { agent } = await signUp();

    const res = await agent.get('/api/gifts/search?q=LEGO%20%20Gifts&maxPrice=100');
    expect(res.status).toBe(200);
    expect(res.data.query).toBe('lego gifts');
    expect(res.data.stores).toEqual(['shopify', 'ebay', 'bestbuy', 'etsy']);
    expect(res.data.products.map((p: { id: string }) => p.id)).toEqual(['shopify:gid://shopify/p/abc123', 'ebay:v1|111|0', 'bestbuy:6501234', 'etsy:901']);
    expect(res.data.hasMore).toBe(true);

    const calls = fetchMock.mock.calls.map(([input, init]) => ({ url: new URL(String(input)), headers: new Headers(init?.headers), body: init?.body }));
    const shopify = calls.find((c) => c.url.hostname === 'catalog.shopify.com')!;
    expect(shopify.headers.get('authorization')).toBe('Bearer shop-token');
    expect(JSON.parse(String(shopify.body)).params.arguments.catalog.filters.price).toEqual({ max: 10000 });
    const ebay = calls.find((c) => c.url.pathname.endsWith('/item_summary/search'))!;
    expect(ebay.headers.get('authorization')).toBe('Bearer token-1');
    expect(ebay.url.searchParams.get('filter')).toContain('price:[..100]');
    const bestBuy = calls.find((c) => c.url.hostname === 'api.bestbuy.com')!;
    expect(bestBuy.url.pathname).toBe('/v1/products(search=lego&search=gifts&onlineAvailability=true&salePrice%3C=100)');
    const etsy = calls.find((c) => c.url.pathname.endsWith('/listings/active'))!;
    expect(etsy.headers.get('x-api-key')).toBe('etsy-key:etsy-secret');
    expect(etsy.url.searchParams.get('max_price')).toBe('100');

    fetchMock.mockClear();
    const again = await agent.get('/api/gifts/search?q=lego%20gifts&maxPrice=100');
    expect(again.data.products).toHaveLength(4);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still answers when one store fails, and doesn't cache the failure", async () => {
    const fetchMock = storeApis({
      bestbuy: () => new Response('{"error":"over quota"}', { status: 403 }),
      // JSON-RPC errors can arrive with a 200.
      shopify: () => new Response('{"jsonrpc":"2.0","id":1,"error":{"code":-32000,"message":"busy"}}', { status: 200 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const [name, value] of Object.entries(KEYS)) vi.stubEnv(name, value);
    const { agent } = await signUp();

    const res = await agent.get('/api/gifts/search?q=lego');
    expect(res.status).toBe(200);
    expect(res.data.results).toEqual([
      { store: 'shopify', ok: false, count: 0 },
      { store: 'ebay', ok: true, count: 1 },
      { store: 'bestbuy', ok: false, count: 0 },
      { store: 'etsy', ok: true, count: 1 },
    ]);
    expect(JSON.stringify(res.data)).not.toContain('bby-key');

    fetchMock.mockClear();
    await agent.get('/api/gifts/search?q=lego');
    const hosts = fetchMock.mock.calls.map(([input]) => new URL(String(input)).hostname).filter((h) => h !== 'api.shopify.com');
    expect(hosts.sort()).toEqual(['api.bestbuy.com', 'catalog.shopify.com']);
  });

  it('searches just one store when asked', async () => {
    const fetchMock = storeApis();
    vi.stubGlobal('fetch', fetchMock);
    for (const [name, value] of Object.entries(KEYS)) vi.stubEnv(name, value);
    const { agent } = await signUp();
    const res = await agent.get('/api/gifts/search?q=frame&store=etsy');
    expect(res.data.products.map((p: { store: string }) => p.store)).toEqual(['etsy']);
    expect(new Set(fetchMock.mock.calls.map(([input]) => new URL(String(input)).hostname))).toEqual(new Set(['openapi.etsy.com']));
  });
});
