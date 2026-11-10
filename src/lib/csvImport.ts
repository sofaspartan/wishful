/**
 * Turning a spreadsheet export (CSV) into items: guess which column is which,
 * then build validated item inputs. Nothing here talks to the server.
 */
import { parseCsv } from '../../shared/csv';
import { LIMITS } from '../../shared/constants';
import { isHttpUrl, type ItemBulkCreateInput, type OwnershipInput } from '../../shared/schemas';
import { CONDITIONS, type Condition, type ItemType, type Priority } from '../../shared/types';
import { titleFromUrl } from './bulkText';

export const CSV_MAX_ROWS = 500;

export const CSV_FIELDS = [
  'title',
  'url',
  'price',
  'currency',
  'imageUrl',
  'description',
  'brand',
  'retailer',
  'category',
  'tags',
  'notes',
  'model',
  'priority',
  'quantity',
  'acquiredOn',
  'pricePaid',
  'condition',
  'rating',
  'review',
] as const;
export type CsvField = (typeof CSV_FIELDS)[number];

export const CSV_FIELD_LABELS: Record<CsvField, string> = {
  title: 'Name',
  url: 'Link',
  price: 'Price',
  currency: 'Currency',
  imageUrl: 'Image link',
  description: 'Description',
  brand: 'Brand',
  retailer: 'Store',
  category: 'Category',
  tags: 'Tags',
  notes: 'Private notes',
  model: 'Model / set number',
  priority: 'Priority',
  quantity: 'How many',
  acquiredOn: 'Got it on',
  pricePaid: 'Price paid',
  condition: 'Condition',
  rating: 'Rating',
  review: 'Review',
};

/** Ownership columns: when any has a value, the item is marked as owned. */
const OWNERSHIP_FIELDS: CsvField[] = ['quantity', 'acquiredOn', 'pricePaid', 'condition', 'rating', 'review'];

const SYNONYMS: Record<CsvField, string[]> = {
  title: ['title', 'name', 'item', 'item name', 'product', 'product name', 'set name', 'game', 'book', 'album'],
  url: ['url', 'link', 'product url', 'product link', 'website', 'web link', 'href', 'store link'],
  price: ['price', 'cost', 'amount', 'msrp', 'retail price', 'list price', 'value'],
  currency: ['currency', 'currency code'],
  imageUrl: ['image', 'image url', 'image link', 'img', 'img url', 'img_url', 'photo', 'picture', 'thumbnail', 'cover', 'cover image'],
  description: ['description', 'details', 'desc', 'summary'],
  brand: ['brand', 'maker', 'manufacturer', 'publisher', 'author', 'artist'],
  retailer: ['retailer', 'store', 'shop', 'seller', 'where', 'vendor'],
  category: ['category', 'theme', 'genre', 'type', 'platform', 'department'],
  tags: ['tags', 'tag', 'labels', 'label'],
  notes: ['notes', 'note', 'comments', 'comment', 'private notes'],
  model: ['model', 'sku', 'set number', 'set_num', 'set num', 'set', 'model number', 'part number', 'isbn', 'upc'],
  priority: ['priority', 'importance', 'want level'],
  quantity: ['quantity', 'qty', 'count', 'copies', 'how many'],
  acquiredOn: ['acquired', 'acquired on', 'date acquired', 'acquired date', 'purchase date', 'purchased', 'purchased on', 'date purchased', 'got it on', 'date bought', 'bought on'],
  pricePaid: ['price paid', 'paid', 'purchase price', 'amount paid', 'cost paid'],
  condition: ['condition', 'state'],
  rating: ['rating', 'stars', 'star rating', 'my rating', 'score', 'lego_star_rating'],
  review: ['review', 'my review', 'thoughts', 'lego_review'],
};

const normalize = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Column index → field, guessed from the header names. Each field is used once. */
export function guessMapping(headers: string[]): Array<CsvField | null> {
  const used = new Set<CsvField>();
  const keys = headers.map(normalize);
  const out: Array<CsvField | null> = headers.map(() => null);
  // Exact names first, then names that contain a synonym ("Product Name (EN)").
  for (const pass of ['exact', 'contains'] as const) {
    keys.forEach((k, i) => {
      if (out[i] || !k) return;
      const field = CSV_FIELDS.find(
        (f) => !used.has(f) && SYNONYMS[f].some((s) => (pass === 'exact' ? k === normalize(s) : normalize(s).length > 3 && k.includes(normalize(s)))),
      );
      if (field) {
        out[i] = field;
        used.add(field);
      }
    });
  }
  return out;
}

export interface CsvFile {
  headers: string[];
  rows: string[][];
  /** Rows past CSV_MAX_ROWS that won't be imported. */
  extraRows: number;
}

export function readCsv(text: string): CsvFile {
  const [header = [], ...rows] = parseCsv(text);
  return { headers: header.map((h) => h.trim()), rows: rows.slice(0, CSV_MAX_ROWS), extraRows: Math.max(rows.length - CSV_MAX_ROWS, 0) };
}

const clip = (s: string, n: number) => s.trim().slice(0, n);

export function parseMoney(raw: string): number | null {
  const s = raw.replace(/[^\d.,]/g, '');
  if (!s) return null;
  // "1.299,00" (comma decimals) vs "1,299.00".
  const commaDecimal = /,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s);
  const cleaned = commaDecimal ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000_000 ? Math.round(n * 100) / 100 : null;
}

/** 1–5 stars; 10- and 100-point scores are scaled down. */
export function parseRating(raw: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+))?/.exec(raw);
  if (!m) return null;
  let n = Number.parseFloat(m[1]);
  const scale = m[2] ? Number.parseInt(m[2], 10) : n > 10 ? 100 : n > 5 ? 10 : 5;
  if (scale > 0 && scale !== 5) n = (n / scale) * 5;
  const stars = Math.round(Math.min(5, n));
  return stars >= 1 ? stars : null;
}

/** ISO dates as-is; anything else the browser can read ("3/2/2024", "March 2, 2024"). Future dates are dropped. */
export function parseDate(raw: string, today = new Date()): string | null {
  const s = raw.trim();
  if (!s) return null;
  let iso: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) iso = s.slice(0, 10);
  else {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) {
      const d = new Date(t);
      iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  if (!iso || Number.isNaN(Date.parse(iso))) return null;
  const limit = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return iso <= limit ? iso : null;
}

export function parsePriority(raw: string): Priority | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/must|high|top|^1$|^a$|★★★|\*\*\*|need/.test(s)) return 'must_have';
  if (/really|medium|med|^2$|^b$|★★|\*\*|want/.test(s)) return 'really_want';
  if (/interest|low|nice|maybe|^3$|^c$|★|\*/.test(s)) return 'interested';
  return null;
}

const CONDITION_WORDS: Array<[RegExp, Condition]> = [
  [/like.?new|mint|excellent|near/i, 'like_new'],
  [/^new|sealed|nib|nisb|unopened/i, 'new'],
  [/good|very good|vg/i, 'good'],
  [/fair|ok|acceptable/i, 'fair'],
  [/worn|poor|loved|used/i, 'worn'],
];

export function parseCondition(raw: string): Condition | null {
  const s = raw.trim();
  if (!s) return null;
  const direct = CONDITIONS.find((c) => c === s.toLowerCase().replace(/\s+/g, '_'));
  return direct ?? CONDITION_WORDS.find(([re]) => re.test(s))?.[1] ?? null;
}

type ItemInput = ItemBulkCreateInput['items'][number];

export interface ImportRow {
  input: ItemInput;
  priority: Priority | null;
}

export interface ImportPlan {
  rows: ImportRow[];
  /** Rows with neither a name nor a link. */
  skipped: number;
}

/**
 * Item inputs for every usable row. `intoCollection` marks everything owned
 * (and names plain rows "custom" rather than "idea"), like adding to a collection does.
 */
export function buildImport(file: CsvFile, mapping: Array<CsvField | null>, opts: { intoCollection: boolean }): ImportPlan {
  const colOf = new Map<CsvField, number>();
  mapping.forEach((f, i) => {
    if (f && !colOf.has(f)) colOf.set(f, i);
  });
  const rows: ImportRow[] = [];
  let skipped = 0;

  for (const raw of file.rows) {
    const get = (f: CsvField) => {
      const i = colOf.get(f);
      return i === undefined ? '' : (raw[i] ?? '').trim();
    };
    const url = isHttpUrl(get('url')) && get('url').length <= LIMITS.url ? get('url') : null;
    const title = clip(get('title') || (url ? titleFromUrl(url) : ''), LIMITS.title);
    if (!title) {
      skipped++;
      continue;
    }
    const image = get('imageUrl');
    const currency = get('currency').toUpperCase();
    const tags = [
      ...new Set(
        get('tags')
          .split(/[,;|]/)
          .map((t) => clip(t.trim().replace(/^#/, ''), LIMITS.tagLength))
          .filter(Boolean),
      ),
    ].slice(0, LIMITS.tags);

    const owned: OwnershipInput = {};
    const qty = Number.parseInt(get('quantity'), 10);
    if (Number.isInteger(qty) && qty >= 1) owned.quantity = Math.min(qty, 9999);
    const acquiredOn = parseDate(get('acquiredOn'));
    if (acquiredOn) owned.acquiredOn = acquiredOn;
    const paid = parseMoney(get('pricePaid'));
    if (paid !== null) owned.pricePaid = paid;
    const condition = parseCondition(get('condition'));
    if (condition) owned.condition = condition;
    const rating = parseRating(get('rating'));
    if (rating) owned.rating = rating;
    const review = clip(get('review'), LIMITS.review);
    if (review) owned.review = review;
    const hasOwnership = OWNERSHIP_FIELDS.some((f) => get(f) !== '') && Object.keys(owned).length > 0;

    const price = parseMoney(get('price'));
    const imageUrl = isHttpUrl(image) && image.length <= LIMITS.url ? image : null;
    const brand = clip(get('brand'), LIMITS.shortText);
    const looksLikeProduct = Boolean(url || imageUrl || brand) || price !== null;
    const type: ItemType = looksLikeProduct ? 'product' : opts.intoCollection ? 'custom' : 'idea';
    const model = clip(get('model'), LIMITS.shortText);
    rows.push({
      priority: parsePriority(get('priority')),
      input: {
        type,
        title,
        description: clip(get('description'), LIMITS.description),
        imageUrl,
        externalUrl: url,
        retailer: clip(get('retailer'), LIMITS.shortText),
        brand,
        price,
        ...(/^[A-Z]{3}$/.test(currency) ? { currency } : {}),
        category: clip(get('category'), 50),
        tags,
        notes: clip(get('notes'), LIMITS.notes),
        ...(model ? { metadata: { model } } : {}),
        ...(hasOwnership || opts.intoCollection ? { owned } : {}),
      },
    });
  }
  return { rows, skipped };
}

/** Batches for the bulk endpoint: same priority per request, at most `size` items each. */
export function importBatches(rows: ImportRow[], fallback: Priority | null, size: number = LIMITS.bulkItems): Array<{ priority: Priority | null; items: ItemInput[] }> {
  const groups = new Map<Priority | 'none', ItemInput[]>();
  for (const r of rows) {
    const p = r.priority ?? fallback ?? 'none';
    groups.set(p, [...(groups.get(p) ?? []), r.input]);
  }
  const out: Array<{ priority: Priority | null; items: ItemInput[] }> = [];
  for (const [p, items] of groups) {
    for (let i = 0; i < items.length; i += size) out.push({ priority: p === 'none' ? null : p, items: items.slice(i, i + size) });
  }
  return out;
}
