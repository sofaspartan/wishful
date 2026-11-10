import { beforeEach, describe, expect, it } from 'vitest';
import { buildImport, guessMapping, importBatches, parseCondition, parseDate, parseMoney, parsePriority, parseRating, readCsv, limitRows } from '../src/lib/csvImport';
import { createList, freshStore, signUp } from './helpers';

describe('csv import', () => {
  it('guesses columns from common header names, using each field once', () => {
    expect(guessMapping(['Product Name', 'Link', 'Price ($)', 'Image URL', 'Qty', 'My Rating', 'Date Purchased', 'Comments', 'Price', 'Mystery'])).toEqual([
      'title',
      'url',
      'price',
      'imageUrl',
      'quantity',
      'rating',
      'acquiredOn',
      'notes',
      null,
      null,
    ]);
    expect(guessMapping(['set_num', 'theme', 'quantity', 'lego_star_rating', 'lego_review'])).toEqual(['model', 'category', 'quantity', 'rating', 'review']);
  });

  it('reads amounts, ratings, dates, priorities and conditions written many ways', () => {
    expect(parseMoney('$1,299.00')).toBe(1299);
    expect(parseMoney('1.299,50 €')).toBe(1299.5);
    expect(parseMoney('free?')).toBeNull();
    expect(parseRating('4.5/5')).toBe(5);
    expect(parseRating('8/10')).toBe(4);
    expect(parseRating('85')).toBe(4);
    expect(parseRating('0')).toBeNull();
    expect(parseDate('2024-03-02')).toBe('2024-03-02');
    expect(parseDate('March 2, 2024')).toBe('2024-03-02');
    expect(parseDate('2999-01-01')).toBeNull();
    expect(parseDate('someday')).toBeNull();
    expect(parsePriority('Must have')).toBe('must_have');
    expect(parsePriority('Really want')).toBe('really_want');
    expect(parsePriority('low')).toBe('interested');
    expect(parsePriority('')).toBeNull();
    expect(parseCondition('Like New')).toBe('like_new');
    expect(parseCondition('sealed')).toBe('new');
    expect(parseCondition('Used - good')).toBe('good');
  });

  it('builds clean item inputs, skipping rows with no name or link', () => {
    const file = readCsv(
      [
        'Name,Link,Price,Image,Tags,Rating,Review,Qty,Priority',
        '"Desk lamp, brass",https://shop.example.com/lamp,$45,https://img.example.com/l.jpg,"home; #office",,,,high',
        ',https://shop.example.com/products/wool-sweater,20,javascript:alert(1),,,,,',
        ',,,,,,,,',
        'Old camera,not a link,,,,4,Still works,2,',
      ].join('\n'),
    );
    const plan = buildImport(file, guessMapping(file.headers), { intoCollection: false });
    expect(plan.skipped).toBe(0);
    expect(plan.rows).toHaveLength(3);
    expect(plan.rows[0]).toMatchObject({
      priority: 'must_have',
      input: { type: 'product', title: 'Desk lamp, brass', externalUrl: 'https://shop.example.com/lamp', price: 45, imageUrl: 'https://img.example.com/l.jpg', tags: ['home', 'office'] },
    });
    expect(plan.rows[0].input.owned).toBeUndefined();
    expect(plan.rows[1].input).toMatchObject({ title: 'Wool sweater', imageUrl: null });
    expect(plan.rows[2].input).toMatchObject({ type: 'idea', externalUrl: null, owned: { rating: 4, review: 'Still works', quantity: 2 } });

    const shelf = buildImport(file, guessMapping(file.headers), { intoCollection: true });
    expect(shelf.rows[0].input.owned).toEqual({});
    expect(shelf.rows[2].input.type).toBe('custom');

    const priced = readCsv('Name,Price\nBoard game,39\nPottery class,');
    expect(buildImport(priced, guessMapping(priced.headers), { intoCollection: false }).rows.map((r) => r.input.type)).toEqual(['product', 'idea']);
  });

  it('caps a file at 500 rows and batches by priority', () => {
    const lines = ['name,priority', ...Array.from({ length: 520 }, (_, i) => `Thing ${i},${i % 2 ? 'high' : ''}`)];
    const file = limitRows(readCsv(lines.join('\n')));
    expect(file.rows).toHaveLength(500);
    expect(file.extraRows).toBe(20);
    const batches = importBatches(buildImport(file, guessMapping(file.headers), { intoCollection: false }).rows, 'interested');
    expect(batches.every((b) => b.items.length <= 25)).toBe(true);
    expect(batches.filter((b) => b.priority === 'must_have').reduce((n, b) => n + b.items.length, 0)).toBe(250);
    expect(batches.filter((b) => b.priority === 'interested').reduce((n, b) => n + b.items.length, 0)).toBe(250);
  });
});

describe('importing through the API', () => {
  beforeEach(freshStore);

  it('accepts what the importer builds, including ratings and reviews into a collection', async () => {
    const { agent } = await signUp();
    const shelf = await createList(agent, { kind: 'collection' });
    const file = readCsv('Title,Rating,Review,Date acquired,Condition,Price paid\nSpirited Away (Blu-ray),5,A comfort film,2023-12-25,like new,19.99\nPlain row,,,,,');
    const plan = buildImport(file, guessMapping(file.headers), { intoCollection: true });
    const [batch] = importBatches(plan.rows, null);
    const res = await agent.post('/api/items/bulk', { items: batch.items, wishlistIds: [shelf.id], priority: batch.priority });
    expect(res.status).toBe(201);
    expect(res.data.items[0].owned).toMatchObject({ rating: 5, review: 'A comfort film', acquiredOn: '2023-12-25', condition: 'like_new', pricePaid: 19.99, quantity: 1 });
    expect(res.data.items[1].owned).toMatchObject({ rating: null, review: '', quantity: 1 });
  });

  it('hides ratings and reviews on a shared collection when the owner turns them off', async () => {
    const { agent } = await signUp();
    const shelf = await createList(agent, { kind: 'collection', visibility: 'unlisted' });
    await agent.post('/api/items', { title: 'Catan', wishlistIds: [shelf.id], owned: { rating: 4, review: 'Great with 4 players' } });
    const visitor = (await import('./helpers')).Agent;
    const anon = new visitor('198.51.100.20');
    expect((await anon.get(`/api/public/lists/${shelf.shareToken}`)).data.entries[0].item.owned).toMatchObject({ rating: 4, review: 'Great with 4 players' });
    expect((await agent.post('/api/items', { title: 'Bad', owned: { rating: 6 } })).status).toBe(400);

    await agent.patch(`/api/wishlists/${shelf.id}`, { settings: { showReviews: false } });
    const hidden = (await anon.get(`/api/public/lists/${shelf.shareToken}`)).data.entries[0].item.owned;
    expect(hidden).toMatchObject({ rating: null, review: '' });
  });
});
