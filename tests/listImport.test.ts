import { describe, expect, it } from 'vitest';
import { importCandidates, sameSite, sitePriority, type ListScan, type RawListItem } from '../extension/src/listScrape';

const raw = (over: Partial<RawListItem>): RawListItem => ({
  title: 'Item',
  url: '',
  image: '',
  priceText: '',
  price: null,
  priority: '',
  note: '',
  quantity: null,
  ...over,
});

const scan = (url: string, items: RawListItem[]): ListScan => ({ url, site: 'Store', listName: 'List', isListPage: true, items, truncated: false });

describe('extension list import', () => {
  it("maps Amazon's numeric priorities and other sites' words", () => {
    expect(['2', '1', '0', '-1', '-2'].map(sitePriority)).toEqual(['must_have', 'really_want', null, 'interested', 'interested']);
    expect(['Highest', 'high', 'medium', 'lowest', ''].map(sitePriority)).toEqual(['must_have', 'really_want', null, 'interested', null]);
  });

  it('reads prices and currencies, and drops duplicates and nameless rows', () => {
    const items = importCandidates(
      scan('https://www.amazon.co.uk/hz/wishlist/ls/ABC', [
        raw({ title: 'Kettle', url: 'https://www.amazon.co.uk/dp/B000000001', price: 39.99, priceText: '£39.99', priority: '2', note: 'Black please', quantity: 2 }),
        raw({ title: 'Kettle again', url: 'https://www.amazon.co.uk/dp/B000000001' }),
        raw({ title: '  ', url: 'https://www.amazon.co.uk/dp/B000000002' }),
        raw({ title: 'Toaster', url: 'https://www.amazon.co.uk/dp/B000000003', priceText: '1.299,50 €' }),
        raw({ title: 'Lamp', url: 'https://www.amazon.co.uk/dp/B000000004', priceText: '$25.00' }),
      ]),
    );
    expect(items.map((i) => i.title)).toEqual(['Kettle', 'Toaster', 'Lamp']);
    expect(items[0]).toMatchObject({ price: 39.99, currency: 'GBP', priority: 'must_have', notes: 'Black please · Wants 2' });
    expect(items[1]).toMatchObject({ price: 1299.5, currency: 'EUR' });
    // "$" on a .co.uk site: trust the domain.
    expect(items[2]).toMatchObject({ price: 25, currency: 'GBP' });
  });

  it("only keeps http links and images that fit, and names the store only for the page's own site", () => {
    const [item] = importCandidates(scan('https://www.etsy.com/favorites', [raw({ url: 'javascript:alert(1)', image: `https://x.test/${'a'.repeat(3000)}.jpg` })]));
    expect(item).toMatchObject({ url: null, imageUrl: null });
    expect(sameSite('https://www.etsy.com/listing/1', 'https://etsy.com/favorites')).toBe(true);
    expect(sameSite('https://www.amazon.com/dp/B0', 'https://www.babylist.com/list/x')).toBe(false);
    expect(sameSite(null, 'https://www.babylist.com/list/x')).toBe(true);
  });
});
