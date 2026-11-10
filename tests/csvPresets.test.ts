import { describe, expect, it } from 'vitest';
import { buildImport, limitRows, readCsv } from '../src/lib/csvImport';
import { applyPreset, defaultFilter, detectPreset, presetCounts } from '../src/lib/csvPresets';

const plan = (text: string, filter?: string | null, intoCollection = false) => {
  const file = readCsv(text);
  const preset = detectPreset(file.headers);
  if (!preset) throw new Error('not recognised');
  const chosen = filter === undefined ? defaultFilter(file, preset) : filter;
  const source = applyPreset(file, preset, chosen);
  return { preset, counts: presetCounts(file, preset), rows: buildImport(limitRows(source.file), source.mapping, { intoCollection }).rows };
};

const GOODREADS = [
  'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies',
  '2767052,"The Hunger Games (The Hunger Games, #1)",Suzanne Collins,"Collins, Suzanne",,"=""0439023483""","=""9780439023481""",4,4.31,Scholastic Press,Hardcover,374,2008,2008,2023/05/14,2023/01/02,"ya, favourites","ya (#3), favourites (#1)",read,Gripping.<br/>Loved it &amp; cried.,,Lent to Sam,1,1',
  '5907,The Hobbit,J.R.R. Tolkien,"Tolkien, J.R.R.",,"=""""","=""""",0,4.28,Houghton Mifflin,Paperback,366,2002,1937,,2024/02/10,"to-read, fantasy","to-read (#4), fantasy (#2)",to-read,,,,0,0',
].join('\n');

describe('CSV presets', () => {
  it('recognises each export by its columns', () => {
    const id = (headers: string) => detectPreset(readCsv(`${headers}\nx`).headers)?.id ?? null;
    expect(id(GOODREADS.split('\n')[0])).toBe('goodreads');
    expect(id('Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Star Rating,Review,Tags,Owned?')).toBe('storygraph');
    expect(id('Catalog#,Artist,Title,Label,Format,Rating,Released,release_id,CollectionFolder,Date Added,Collection Media Condition,Collection Sleeve Condition,Collection Notes')).toBe('discogs-collection');
    expect(id('Catalog#,Artist,Title,Label,Format,Rating,Released,release_id,Notes')).toBe('discogs-wantlist');
    expect(id('Date,Name,Year,Letterboxd URI')).toBe('letterboxd');
    expect(id('Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres')).toBe('imdb');
    expect(id('objectname,objectid,rating,own,wishlist,wishlistpriority,wanttobuy,prevowned')).toBe('bgg');
    expect(id('Website,Order ID,Order Date,Currency,Unit Price,ASIN,Quantity,Order Status,Product Name')).toBe('amazon-orders');
    expect(id('Name,Price,Link')).toBeNull();
  });

  it('Goodreads: picks a shelf, keeps ratings and reviews, adds covers', () => {
    const toRead = plan(GOODREADS);
    expect(toRead.counts).toMatchObject({ 'to-read': 1, read: 1, 'currently-reading': 0, all: 2 });
    expect(toRead.rows).toHaveLength(1);
    expect(toRead.rows[0].input).toMatchObject({
      title: 'The Hobbit',
      brand: 'J.R.R. Tolkien',
      externalUrl: 'https://www.goodreads.com/book/show/5907',
      imageUrl: null,
      category: 'Books',
      tags: ['fantasy'],
    });
    expect(toRead.rows[0].input.owned).toBeUndefined();

    const [book] = plan(GOODREADS, 'read', true).rows;
    expect(book.input).toMatchObject({
      title: 'The Hunger Games (The Hunger Games, #1)',
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780439023481-L.jpg?default=false',
      metadata: { model: '9780439023481' },
      tags: ['ya', 'favourites'],
      notes: 'Lent to Sam',
      owned: { rating: 4, review: 'Gripping.\nLoved it & cried.', acquiredOn: '2023-05-14', quantity: 1 },
    });
  });

  it('BoardGameGeek: owned games keep what was paid, wishlist games get a priority', () => {
    const text = [
      'objectname,objectid,rating,own,wishlist,wishlistpriority,wanttobuy,prevowned,comment,privatecomment,pricepaid,pp_currency,acquisitiondate,quantity,itemtype,yearpublished,minplayers,maxplayers,playingtime,wishlistcomment',
      'Wingspan,266192,9,1,0,,0,0,Lovely,Bought at con,55,USD,2022-03-04,1,standalone,2019,1,5,70,',
      'Ark Nova,342942,0,0,1,1,0,0,,,0,,,0,standalone,2021,1,4,150,Birthday?',
    ].join('\n');
    const owned = plan(text, 'own', true);
    expect(owned.counts).toMatchObject({ own: 1, wishlist: 1, all: 2 });
    expect(owned.rows[0].input).toMatchObject({
      title: 'Wingspan',
      externalUrl: 'https://boardgamegeek.com/boardgame/266192',
      category: 'Board games',
      currency: 'USD',
      notes: 'Bought at con',
      owned: { rating: 5, review: 'Lovely', pricePaid: 55, acquiredOn: '2022-03-04', quantity: 1 },
    });
    const wish = plan(text, 'wishlist');
    expect(wish.rows).toHaveLength(1);
    expect(wish.rows[0].priority).toBe('must_have');
    expect(wish.rows[0].input).toMatchObject({ title: 'Ark Nova', notes: 'Birthday?', description: '2021 · 1–4 players · 150 min' });
    expect(wish.rows[0].input.owned).toBeUndefined();
  });

  it('Discogs: artist, catalogue number, format and grading', () => {
    const [rec] = plan(
      'Catalog#,Artist,Title,Label,Format,Rating,Released,release_id,CollectionFolder,Date Added,Collection Media Condition,Collection Sleeve Condition,Collection Notes\n' +
        'SHVL 804,Pink Floyd (2),The Dark Side Of The Moon,Harvest,"LP, Album, Gat",5,1973,1873013,Uncategorized,2021-06-01 10:22:33,Near Mint (NM or M-),Very Good Plus (VG+),First press',
      null,
      true,
    ).rows;
    expect(rec.input).toMatchObject({
      title: 'The Dark Side Of The Moon',
      brand: 'Pink Floyd',
      externalUrl: 'https://www.discogs.com/release/1873013',
      category: 'Vinyl',
      metadata: { model: 'SHVL 804' },
      notes: 'First press',
      owned: { rating: 5, acquiredOn: '2021-06-01', condition: 'like_new' },
    });
  });

  it('Letterboxd and IMDb: films with their year and the right scale', () => {
    const [film] = plan('Date,Name,Year,Letterboxd URI,Rating\n2024-01-03,Paddington 2,2017,https://boxd.it/aB1c,4.5').rows;
    expect(film.input).toMatchObject({ title: 'Paddington 2 (2017)', externalUrl: 'https://boxd.it/aB1c', category: 'Movies', owned: { rating: 5 } });

    const [show] = plan(
      'Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated\n' +
        '1,tt0903747,2024-01-01,2024-01-01,,Breaking Bad,Breaking Bad,https://www.imdb.com/title/tt0903747/,TV Series,9.5,49,2008,"Crime, Drama",2000000,2008-01-20,,8,2024-02-02',
    ).rows;
    expect(show.input).toMatchObject({ title: 'Breaking Bad (2008)', category: 'TV', tags: ['Crime', 'Drama'], owned: { rating: 4 } });
  });

  it('Amazon order history: skips cancelled orders and keeps the price paid', () => {
    const { rows } = plan(
      'Website,Order ID,Order Date,Currency,Unit Price,ASIN,Product Condition,Quantity,Order Status,Product Name\n' +
        'Amazon.co.uk,203-1,2023-11-20T09:15:00Z,GBP,24.99,B0BSHF7WHW,New,2,Closed,Kindle Paperwhite\n' +
        'Amazon.co.uk,203-2,2023-11-21T09:15:00Z,GBP,5.00,B000000000,New,1,Cancelled,Phone case',
      null,
      true,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].input).toMatchObject({
      title: 'Kindle Paperwhite',
      externalUrl: 'https://www.amazon.co.uk/dp/B0BSHF7WHW',
      retailer: 'Amazon',
      currency: 'GBP',
      owned: { pricePaid: 24.99, quantity: 2, acquiredOn: '2023-11-20', condition: 'new' },
    });
  });

  it('filters before the 500-row limit, so a big library keeps its whole shelf', () => {
    const header = GOODREADS.split('\n')[0];
    const row = (i: number, shelf: string) => `${i},Book ${i},A,,,,,0,,,,,,,,,${shelf},,${shelf},,,,0,0`;
    const lines = [header, ...Array.from({ length: 600 }, (_, i) => row(i + 1, 'read')), ...Array.from({ length: 40 }, (_, i) => row(i + 1000, 'to-read'))];
    expect(plan(lines.join('\n'), 'to-read').rows).toHaveLength(40);
    expect(plan(lines.join('\n'), 'read').rows).toHaveLength(500);
  });
});
