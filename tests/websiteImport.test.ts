import { beforeEach, describe, expect, it } from 'vitest';
import { amazonNextPage, isAmazonHost, parseAmazonList, parseJsonLdList } from '../server/services/listImport';
import { importCandidates } from '../shared/listImport';
import { buildImport, CSV_FIELDS } from '../src/lib/csvImport';
import { websiteListFile, type WebsiteList } from '../src/components/WebsiteImport';
import { Agent, freshStore, signUp } from './helpers';

beforeEach(freshStore);

// Trimmed from real Amazon pages: list view (#itemName_…) and grid view (title only on the photo link).
const AMAZON_LIST = `
<span id="profile-list-name" class="a-size-medium a-text-bold" role="heading">Hunter&#39;s Classroom Wish List</span>
<ul id="g-items">
<li data-id="3LZC2W3KPCCNW" data-itemId="IA1" data-price="10.02" data-reposition-action-params="{&quot;listType&quot;:&quot;WishList&quot;,&quot;itemExternalId&quot;:&quot;ASIN:B00006IBYW|ATVPDKIKX0DER&quot;}" class="a-spacing-none g-item-sortable"><span class="a-list-item">
  <div id="itemImage_IA1"><a class="a-link-normal" title="Avery Index Tabs" href="/dp/B00006IBYW/?coliid=IA1"><img alt="Avery Index Tabs" src="https://m.media-amazon.com/images/I/412xYFBNB2L._SS135_.jpg" height="135" width="135"/></a></div>
  <h2 class="a-size-base"><a id="itemName_IA1" class="a-link-normal" title="Avery Index Tabs, 80 Tabs &amp; Labels" href="/dp/B00006IBYW/?coliid=IA1&amp;colid=3LZC2W3KPCCNW">
    Avery Index Tabs, 80 Tabs &amp; Labels</a></h2>
  <span class="a-price"><span class="a-offscreen">$10.02</span></span>
  <span id="itemComment_IA1" class="g-comment-quote a-text-quote">
    For interactive notebooks tabs
  </span>
  <span id="itemPriority_IA1" class="a-hidden">
    2
  </span>
  <span id="itemRequested_IA1">
    2
  </span>
</span></li>
<li data-id="3LZC2W3KPCCNW" data-itemId="IA2" data-price="-Infinity" data-reposition-action-params="{&quot;itemExternalId&quot;:&quot;ASIN:B0CFXVDXXW|ATVPDKIKX0DER&quot;}"><span class="a-list-item">
  <img alt="Whiteboard Calendar" src="https://m.media-amazon.com/images/G/01/x-locale/communities/wishlist/no_image_2x._CB485924800_SS135_.png"/>
  <a id="itemName_IA2" class="a-link-normal" title="Whiteboard Calendar" href="/dp/B0CFXVDXXW/?coliid=IA2">Whiteboard Calendar</a>
  <span id="itemPriority_IA2" class="a-hidden"> 0 </span>
  <span id="itemRequested_IA2"> 1 </span>
</span></li>
<li id="item_IA3" data-csa-c-item-id="B0GHCRPGZX" data-csa-c-item-type="asin" data-id="3LZC2W3KPCCNW" data-itemId="IA3" class="g-item-sortable">
  <span id="itemComment_IA3"></span><span id="itemPriority_IA3">-1</span><span id="itemRequested_IA3">1</span>
  <a aria-label="Zbar Protein Variety Pack" class="a-link-normal wl-image-overlay" title="Zbar Protein Variety Pack" href="/dp/B0GHCRPGZX/?coliid=IA3"></a>
  <img alt="Zbar Protein Variety Pack" src="https://m.media-amazon.com/images/I/410P1E8e1DL._SS220_.jpg" class="wl-img-size-adjust"/>
  <span class="a-price a-text-price"><span class="a-offscreen">$24.99</span><span aria-hidden="true">$24.99</span></span>
</li>
</ul>
<input type="hidden" name="showMoreUrl" value="/hz/wishlist/slv/items?filter=unpurchased&amp;paginationToken=ESHV2_AAAA&amp;itemsLayout=LIST&amp;type=wishlist&amp;lid=3LZC2W3KPCCNW" class="showMoreUrl"/>
`;

describe('Amazon wish lists', () => {
  it('reads list-view and grid-view items, the list name and the next page', () => {
    const page = parseAmazonList(AMAZON_LIST, 'https://www.amazon.com/hz/wishlist/ls/3LZC2W3KPCCNW?ref_=wl_share');
    expect(page.listName).toBe("Hunter's Classroom Wish List");
    expect(page.next).toBe('https://www.amazon.com/hz/wishlist/slv/items?filter=unpurchased&paginationToken=ESHV2_AAAA&itemsLayout=LIST&type=wishlist&lid=3LZC2W3KPCCNW');

    const items = importCandidates({ url: 'https://www.amazon.com/hz/wishlist/ls/3LZC2W3KPCCNW', items: page.items });
    expect(items).toEqual([
      {
        key: 'https://www.amazon.com/dp/B00006IBYW',
        title: 'Avery Index Tabs, 80 Tabs & Labels',
        url: 'https://www.amazon.com/dp/B00006IBYW',
        imageUrl: 'https://m.media-amazon.com/images/I/412xYFBNB2L.jpg',
        price: 10.02,
        currency: 'USD',
        priority: 'must_have',
        notes: 'For interactive notebooks tabs · Wants 2',
      },
      // Unavailable: no price, and Amazon's "no image" placeholder isn't kept.
      expect.objectContaining({ title: 'Whiteboard Calendar', url: 'https://www.amazon.com/dp/B0CFXVDXXW', imageUrl: null, price: null, priority: null, notes: '' }),
      expect.objectContaining({
        title: 'Zbar Protein Variety Pack',
        url: 'https://www.amazon.com/dp/B0GHCRPGZX',
        imageUrl: 'https://m.media-amazon.com/images/I/410P1E8e1DL.jpg',
        price: 24.99,
        priority: 'interested',
      }),
    ]);
  });

  it('uses the local site for links and currency', () => {
    const page = parseAmazonList(AMAZON_LIST, 'https://www.amazon.co.uk/hz/wishlist/ls/3LZC2W3KPCCNW');
    const [first] = importCandidates({ url: 'https://www.amazon.co.uk/hz/wishlist/ls/3LZC2W3KPCCNW', items: page.items });
    expect(first.url).toBe('https://www.amazon.co.uk/dp/B00006IBYW');
  });

  it('stops at the end of the list', () => {
    expect(parseAmazonList(`${AMAZON_LIST}<div id="endOfListMarker"></div>`, 'https://www.amazon.com/hz/wishlist/ls/X').next).toBeNull();
  });

  it('only follows Amazon\'s own "more items" address on the same site', () => {
    const list = 'https://www.amazon.com/hz/wishlist/ls/X';
    expect(amazonNextPage('/hz/wishlist/slv/items?paginationToken=abc', list)).toBe('https://www.amazon.com/hz/wishlist/slv/items?paginationToken=abc');
    expect(amazonNextPage('https://evil.example/hz/wishlist/slv/items', list)).toBeNull();
    expect(amazonNextPage('//169.254.169.254/hz/wishlist/slv/items', list)).toBeNull();
    expect(amazonNextPage('https://www.amazon.co.uk/hz/wishlist/slv/items', list)).toBeNull();
    expect(amazonNextPage('/gp/your-account', list)).toBeNull();
    expect(amazonNextPage('/hz/wishlist/slv/items', 'https://evil.example/list')).toBeNull();
    expect(isAmazonHost('www.amazon.de')).toBe(true);
    expect(isAmazonHost('amazon.com.evil.example')).toBe(false);
  });
});

describe('other sites', () => {
  it('reads products listed in JSON-LD', () => {
    const html = `<script type="application/ld+json">{"@type":"ItemList","itemListElement":[
      {"@type":"ListItem","position":1,"item":{"@type":"Product","name":"Linen Apron","url":"/listing/1","image":["https://img.example/a.jpg"],"offers":{"price":"57.89","priceCurrency":"EUR"}}},
      {"@type":"ListItem","position":2,"item":{"@type":"Product","name":"Wool Socks","url":"https://shop.example/listing/2"}}
    ]}</script><script type="application/ld+json">{not json</script>`;
    const items = importCandidates({ url: 'https://shop.example/favorites', items: parseJsonLdList(html, 'https://shop.example/favorites') });
    expect(items).toEqual([
      expect.objectContaining({ title: 'Linen Apron', url: 'https://shop.example/listing/1', imageUrl: 'https://img.example/a.jpg', price: 57.89, currency: 'EUR' }),
      expect.objectContaining({ title: 'Wool Socks', url: 'https://shop.example/listing/2', price: null }),
    ]);
  });
});

describe('importing the found items', () => {
  const list: WebsiteList = {
    url: 'https://www.amazon.com/hz/wishlist/ls/X',
    site: 'Amazon',
    listName: 'Birthday',
    partial: false,
    items: [
      { key: 'a', title: 'Kettle', url: 'https://www.amazon.com/dp/B000000001', imageUrl: 'https://m.media-amazon.com/images/I/k.jpg', price: 39.99, currency: 'USD', priority: 'must_have', notes: 'Black · Wants 2' },
      { key: 'b', title: 'Toaster', url: 'https://www.target.com/p/toaster', imageUrl: null, price: null, currency: null, priority: null, notes: '' },
      { key: 'c', title: 'Lamp', url: null, imageUrl: null, price: null, currency: null, priority: null, notes: '' },
    ],
  };

  it('becomes products with the store, priority and notes, leaving out unticked items', () => {
    const plan = buildImport(websiteListFile(list, new Set(['c'])), [...CSV_FIELDS], { intoCollection: false });
    expect(plan.rows).toHaveLength(2);
    expect(plan.rows[0]).toEqual({
      priority: 'must_have',
      input: expect.objectContaining({
        type: 'product',
        title: 'Kettle',
        externalUrl: 'https://www.amazon.com/dp/B000000001',
        imageUrl: 'https://m.media-amazon.com/images/I/k.jpg',
        price: 39.99,
        currency: 'USD',
        retailer: 'Amazon',
        notes: 'Black · Wants 2',
      }),
    });
    // "Wants 2" is a note, not a count of ones already owned.
    expect(plan.rows[0].input.owned).toBeUndefined();
    expect(plan.rows[1].input).toMatchObject({ retailer: '', externalUrl: 'https://www.target.com/p/toaster' });
  });
});

describe('the import endpoint', () => {
  it('needs a signed-in user and refuses internal addresses and foreign next pages', async () => {
    expect((await new Agent().post('/api/import/list', { url: 'https://www.amazon.com/hz/wishlist/ls/X' })).status).toBe(401);
    const { agent } = await signUp();
    expect((await agent.post('/api/import/list', { url: 'http://127.0.0.1/' })).status).toBe(400);
    expect((await agent.post('/api/import/list', { url: 'http://169.254.169.254/latest/meta-data/' })).status).toBe(400);
    expect((await agent.post('/api/import/list', { url: 'https://www.amazon.com/hz/wishlist/ls/X', next: 'http://127.0.0.1/hz/wishlist/slv/items' })).status).toBe(400);
    expect((await agent.post('/api/import/list', { url: 'not a link' })).status).toBe(400);
  });
});
