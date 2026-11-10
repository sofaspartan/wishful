/**
 * Ready-made column mappings for exports from popular sites. Each preset recognises a
 * file by its headers, can narrow the rows (a Goodreads shelf, BoardGameGeek "owned"),
 * and turns a row into the importer's own fields, which `buildImport` then validates.
 */
import { CSV_FIELDS, type CsvField, type CsvFile } from './csvImport';

/** A cell by its header name, any case. */
export type RowReader = (header: string) => string;
type Fields = Partial<Record<CsvField, string>>;

export interface PresetFilter {
  id: string;
  label: string;
  test: (get: RowReader) => boolean;
  /** These rows are things the person has, so a collection suits them. */
  owned?: boolean;
}

export interface CsvPreset {
  id: string;
  name: string;
  /** What kind of file it is: "library export". */
  what: string;
  /** Where to find the export, shown as help. */
  howTo: string;
  filterLabel?: string;
  filters?: PresetFilter[];
  /** Everything in the file is owned (a collection export). */
  owned?: boolean;
  detect: (has: (header: string) => boolean) => boolean;
  /** Item fields for one row, or null to skip it. */
  row: (get: RowReader, filter: string | null) => Fields | null;
}

const isbnOf = (raw: string) => {
  const s = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  return s.length === 13 || s.length === 10 ? s : '';
};
/** Open Library cover; `default=false` makes missing covers fail so the app shows its placeholder. */
const coverFor = (isbn: string) => (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : '');
const htmlToText = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
const positive = (s: string) => (Number.parseFloat(s) > 0 ? s : '');
const withYear = (name: string, year: string) => (year && !name.includes(`(${year})`) ? `${name} (${year})` : name);
const shelf = (get: RowReader, column: string) => get(column).toLowerCase();

const DISCOGS_CONDITION: Array<[RegExp, string]> = [
  [/^mint|\(m\)/i, 'new'],
  [/near mint|\(nm/i, 'like_new'],
  [/very good|\(vg/i, 'good'],
  [/good|\(g/i, 'fair'],
  [/fair|poor|\(f\)|\(p\)/i, 'worn'],
];
const discogsCondition = (s: string) => (s ? (DISCOGS_CONDITION.find(([re]) => re.test(s))?.[1] ?? '') : '');
const discogsCategory = (format: string) =>
  /vinyl|\blp\b|\b7"|\b12"|\bep\b/i.test(format) ? 'Vinyl' : /\bcd\b/i.test(format) ? 'CDs' : /cass/i.test(format) ? 'Cassettes' : 'Music';
const discogsRow = (get: RowReader, owned: boolean): Fields => ({
  title: get('Title'),
  brand: get('Artist').replace(/\s\(\d+\)$/, ''),
  url: get('release_id') ? `https://www.discogs.com/release/${get('release_id')}` : '',
  model: get('Catalog#'),
  category: discogsCategory(get('Format')),
  description: [get('Format'), get('Label'), get('Released')].filter(Boolean).join(' · '),
  rating: owned ? positive(get('Rating')) : '',
  notes: get('Collection Notes') || get('Notes'),
  ...(owned ? { acquiredOn: get('Date Added'), condition: discogsCondition(get('Collection Media Condition')) } : {}),
});

const BGG_PRIORITY: Record<string, string> = { '1': 'must have', '2': 'really want', '3': 'interested', '4': 'interested' };

export const CSV_PRESETS: CsvPreset[] = [
  {
    id: 'goodreads',
    name: 'Goodreads',
    what: 'library export',
    howTo: 'Goodreads → My Books → Import and export → Export library.',
    filterLabel: 'Which shelf?',
    filters: [
      { id: 'to-read', label: 'Want to read', test: (g) => shelf(g, 'Exclusive Shelf') === 'to-read' },
      { id: 'read', label: 'Read', test: (g) => shelf(g, 'Exclusive Shelf') === 'read', owned: true },
      { id: 'currently-reading', label: 'Currently reading', test: (g) => shelf(g, 'Exclusive Shelf') === 'currently-reading' },
      { id: 'all', label: 'Everything', test: () => true },
    ],
    detect: (has) => has('Book Id') && has('Exclusive Shelf'),
    row: (get) => {
      const isbn = isbnOf(get('ISBN13')) || isbnOf(get('ISBN'));
      const read = shelf(get, 'Exclusive Shelf') === 'read';
      const exclusive = new Set(['to-read', 'read', 'currently-reading']);
      return {
        title: get('Title'),
        brand: get('Author'),
        url: get('Book Id') ? `https://www.goodreads.com/book/show/${get('Book Id')}` : '',
        imageUrl: coverFor(isbn),
        model: isbn,
        category: 'Books',
        description: [get('Binding'), get('Publisher'), get('Original Publication Year') || get('Year Published')].filter(Boolean).join(' · '),
        tags: get('Bookshelves')
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t && !exclusive.has(t))
          .join(','),
        rating: positive(get('My Rating')),
        review: htmlToText(get('My Review')),
        notes: get('Private Notes'),
        quantity: positive(get('Owned Copies')),
        acquiredOn: read ? get('Date Read') : '',
      };
    },
  },
  {
    id: 'storygraph',
    name: 'The StoryGraph',
    what: 'library export',
    howTo: 'The StoryGraph → Manage account → Export StoryGraph library.',
    filterLabel: 'Which books?',
    filters: [
      { id: 'to-read', label: 'To read', test: (g) => shelf(g, 'Read Status') === 'to-read' },
      { id: 'read', label: 'Read', test: (g) => shelf(g, 'Read Status') === 'read', owned: true },
      { id: 'currently-reading', label: 'Currently reading', test: (g) => shelf(g, 'Read Status') === 'currently-reading' },
      { id: 'all', label: 'Everything', test: () => true },
    ],
    detect: (has) => has('Read Status') && has('Star Rating'),
    row: (get) => {
      const isbn = isbnOf(get('ISBN/UID'));
      return {
        title: get('Title'),
        brand: get('Authors'),
        imageUrl: coverFor(isbn),
        model: isbn,
        category: 'Books',
        description: get('Format'),
        tags: get('Tags'),
        rating: positive(get('Star Rating')),
        review: htmlToText(get('Review')),
        quantity: /^(yes|true)$/i.test(get('Owned?')) ? '1' : '',
        acquiredOn: shelf(get, 'Read Status') === 'read' ? get('Last Date Read') : '',
      };
    },
  },
  {
    id: 'discogs-collection',
    name: 'Discogs',
    what: 'collection export',
    howTo: 'Discogs → Collection → Export → Download.',
    owned: true,
    detect: (has) => has('release_id') && (has('CollectionFolder') || has('Collection Media Condition')),
    row: (get) => discogsRow(get, true),
  },
  {
    id: 'discogs-wantlist',
    name: 'Discogs',
    what: 'wantlist export',
    howTo: 'Discogs → Wantlist → Export → Download.',
    detect: (has) => has('release_id') && !has('CollectionFolder') && !has('Collection Media Condition'),
    row: (get) => discogsRow(get, false),
  },
  {
    id: 'letterboxd',
    name: 'Letterboxd',
    what: 'export',
    howTo: 'Letterboxd → Settings → Data → Export your data, then unzip it and pick watchlist.csv, watched.csv, ratings.csv, diary.csv or reviews.csv.',
    detect: (has) => has('Letterboxd URI'),
    row: (get) => ({
      title: withYear(get('Name'), get('Year')),
      url: get('Letterboxd URI'),
      category: 'Movies',
      rating: positive(get('Rating')),
      review: htmlToText(get('Review')),
      tags: get('Tags'),
      acquiredOn: get('Watched Date'),
    }),
  },
  {
    id: 'imdb',
    name: 'IMDb',
    what: 'list export',
    howTo: 'IMDb → Your watchlist or ratings → ⋮ → Export.',
    detect: (has) => has('Const') && has('Title Type'),
    row: (get) => {
      const type = get('Title Type').toLowerCase();
      return {
        title: withYear(get('Title'), get('Year')),
        url: get('URL') || (get('Const') ? `https://www.imdb.com/title/${get('Const')}/` : ''),
        brand: get('Directors'),
        category: /tv|series|episode/.test(type) ? 'TV' : /game/.test(type) ? 'Video games' : 'Movies',
        tags: get('Genres'),
        description: get('Description'),
        rating: get('Your Rating') ? `${get('Your Rating')}/10` : '',
      };
    },
  },
  {
    id: 'bgg',
    name: 'BoardGameGeek',
    what: 'collection export',
    howTo: 'BoardGameGeek → your Collection → Export (CSV).',
    filterLabel: 'Which games?',
    filters: [
      { id: 'own', label: 'Owned', test: (g) => g('own') === '1', owned: true },
      { id: 'wishlist', label: 'Wishlist', test: (g) => g('wishlist') === '1' },
      { id: 'wanttobuy', label: 'Want to buy', test: (g) => g('wanttobuy') === '1' },
      { id: 'prevowned', label: 'Previously owned', test: (g) => g('prevowned') === '1' },
      { id: 'all', label: 'Everything', test: () => true },
    ],
    detect: (has) => has('objectname') && has('objectid'),
    row: (get, filter) => {
      const owned = filter === 'own' || (filter === 'all' && get('own') === '1');
      const players = get('minplayers') && get('maxplayers') ? `${get('minplayers')}–${get('maxplayers')} players` : '';
      return {
        title: get('objectname'),
        url: get('objectid') ? `https://boardgamegeek.com/boardgame/${get('objectid')}` : '',
        category: /expansion/i.test(get('itemtype')) ? 'Board game expansions' : 'Board games',
        description: [get('yearpublished'), players, get('playingtime') ? `${get('playingtime')} min` : ''].filter((s) => s && s !== '0').join(' · '),
        notes: [get('privatecomment'), get('wishlistcomment')].filter(Boolean).join('\n'),
        priority: owned ? '' : (BGG_PRIORITY[get('wishlistpriority')] ?? ''),
        ...(owned
          ? {
              rating: positive(get('rating')) ? `${get('rating')}/10` : '',
              review: get('comment'),
              pricePaid: positive(get('pricepaid')),
              currency: get('pp_currency'),
              acquiredOn: get('acquisitiondate'),
              quantity: positive(get('quantity')),
              condition: get('conditiontext'),
            }
          : {}),
      };
    },
  },
  {
    id: 'amazon-orders',
    name: 'Amazon',
    what: 'order history',
    howTo: 'Amazon → Account → Request your data → Your Orders. Pick Retail.OrderHistory.1.csv from the download.',
    owned: true,
    detect: (has) => (has('ASIN') || has('ASIN/ISBN')) && has('Order Date') && (has('Product Name') || has('Title')),
    row: (get) => {
      if (/cancel/i.test(get('Order Status'))) return null;
      const asin = (get('ASIN') || get('ASIN/ISBN')).trim();
      const site = /^amazon\.[a-z.]+$/i.test(get('Website')) ? get('Website').toLowerCase() : 'amazon.com';
      return {
        title: get('Product Name') || get('Title'),
        url: /^[A-Z0-9]{10}$/i.test(asin) ? `https://www.${site}/dp/${asin.toUpperCase()}` : '',
        retailer: 'Amazon',
        category: get('Category'),
        pricePaid: get('Unit Price') || get('Purchase Price Per Unit'),
        currency: get('Currency'),
        acquiredOn: get('Order Date'),
        quantity: get('Quantity'),
        condition: get('Product Condition') || get('Condition'),
      };
    },
  },
];

const headerIndex = (headers: string[]) => {
  const index = new Map<string, number>();
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase();
    if (key && !index.has(key)) index.set(key, i);
  });
  return index;
};

const reader = (index: Map<string, number>, row: string[]): RowReader => (h) => {
  const i = index.get(h.toLowerCase());
  return i === undefined ? '' : (row[i] ?? '').trim();
};

export function detectPreset(headers: string[]): CsvPreset | null {
  const index = headerIndex(headers);
  return CSV_PRESETS.find((p) => p.detect((h) => index.has(h.toLowerCase()))) ?? null;
}

export const presetById = (id: string) => CSV_PRESETS.find((p) => p.id === id) ?? null;

/** Rows matching each filter, for labels like "Read (180)". */
export function presetCounts(file: CsvFile, preset: CsvPreset): Record<string, number> {
  const index = headerIndex(file.headers);
  const counts: Record<string, number> = {};
  for (const f of preset.filters ?? []) counts[f.id] = file.rows.filter((r) => f.test(reader(index, r))).length;
  return counts;
}

/** The first filter that has any rows. */
export function defaultFilter(file: CsvFile, preset: CsvPreset): string | null {
  if (!preset.filters?.length) return null;
  const counts = presetCounts(file, preset);
  return preset.filters.find((f) => counts[f.id] > 0)?.id ?? preset.filters[0].id;
}

/** The file rewritten into the importer's own columns, ready for `buildImport`. */
export function applyPreset(file: CsvFile, preset: CsvPreset, filter: string | null): { file: CsvFile; mapping: CsvField[] } {
  const index = headerIndex(file.headers);
  const test = preset.filters?.find((f) => f.id === filter)?.test ?? (() => true);
  const rows: string[][] = [];
  for (const raw of file.rows) {
    const get = reader(index, raw);
    if (!test(get)) continue;
    const fields = preset.row(get, filter);
    if (fields) rows.push(CSV_FIELDS.map((f) => fields[f] ?? ''));
  }
  return { file: { headers: [...CSV_FIELDS], rows, extraRows: 0 }, mapping: [...CSV_FIELDS] };
}
