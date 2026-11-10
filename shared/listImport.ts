/**
 * Turning a list scraped from another site (an Amazon wish list, a store's favourites)
 * into item candidates. Shared by the browser extension, which reads the page the
 * user has open, and the server, which fetches a pasted list link.
 */
import { currencyFromPriceText, parsePrice } from './metadata';
import { CURRENCIES, LIMITS } from './constants';
import type { Priority } from './types';

export interface RawListItem {
  title: string;
  url: string;
  image: string;
  priceText: string;
  /** A numeric price the site exposes directly (Amazon's `data-price`). */
  price: number | null;
  /** The site's own priority: words ("highest") or Amazon's -2 (lowest) to 2 (highest). */
  priority: string;
  note: string;
  quantity: number | null;
}

export interface ListScan {
  url: string;
  site: string;
  listName: string;
  /** The address looks like a wishlist, registry, favourites or saved-items page. */
  isListPage: boolean;
  items: RawListItem[];
  truncated: boolean;
}

export interface ImportCandidate {
  key: string;
  title: string;
  url: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  priority: Priority | null;
  notes: string;
}

/** One page of a list read by the server; `next` continues it (Amazon sends lists 10 items at a time). */
export interface ListImportResult {
  /** Where the link ended up after redirects; send it back with `next`. */
  url: string;
  site: string;
  listName: string;
  items: ImportCandidate[];
  next: string | null;
  /** Why nothing (or not everything) could be read. */
  message?: string;
  /** The site refused the request (bot protection), so the extension is the way in. */
  blocked?: boolean;
}

const DOMAIN_CURRENCY: Array<[RegExp, string]> = [
  [/\.(co\.uk|uk)$/, 'GBP'],
  [/\.ca$/, 'CAD'],
  [/\.(com\.)?au$/, 'AUD'],
  [/\.(de|fr|it|es|nl|ie|be|at|fi|pt)$/, 'EUR'],
  [/\.(co\.)?jp$/, 'JPY'],
  [/\.in$/, 'INR'],
  [/\.(com\.)?mx$/, 'MXN'],
  [/\.(co\.)?nz$/, 'NZD'],
  [/\.se$/, 'SEK'],
  [/\.com$/, 'USD'],
];

const known = (c: string | null | undefined) => (c && (CURRENCIES as readonly string[]).includes(c) ? c : null);
const fits = (url: string) => url.length <= LIMITS.url && /^https?:\/\//.test(url);

export function sitePriority(words: string): Priority | null {
  const s = words.trim().toLowerCase();
  if (/^-?\d$/.test(s)) {
    const n = Number(s);
    return n >= 2 ? 'must_have' : n === 1 ? 'really_want' : n < 0 ? 'interested' : null;
  }
  if (/highest|must/.test(s)) return 'must_have';
  if (/^high/.test(s)) return 'really_want';
  if (/low/.test(s)) return 'interested';
  return null;
}

/** What gets shown and saved, from the raw page scan. */
export function importCandidates(scan: Pick<ListScan, 'url' | 'items'>): ImportCandidate[] {
  const host = (() => {
    try {
      return new URL(scan.url).hostname;
    } catch {
      return '';
    }
  })();
  const domainCurrency = DOMAIN_CURRENCY.find(([re]) => re.test(host))?.[1] ?? null;
  const seen = new Set<string>();
  return scan.items.flatMap((i) => {
    const key = i.url || i.title;
    if (!i.title.trim() || seen.has(key)) return [];
    seen.add(key);
    const price = i.price ?? (i.priceText ? parsePrice(i.priceText) : null);
    const fromText = i.priceText ? currencyFromPriceText(i.priceText) : null;
    const dollar = /\$/.test(i.priceText);
    const currency = known(fromText) ?? (dollar || !i.priceText ? known(domainCurrency) : null);
    return {
      key,
      title: i.title.trim().slice(0, LIMITS.title),
      url: i.url && fits(i.url) ? i.url : null,
      imageUrl: i.image && fits(i.image) ? i.image : null,
      price: price !== null && price > 0 && price <= 1_000_000_000 ? price : null,
      currency,
      priority: sitePriority(i.priority),
      notes: [i.note, i.quantity && i.quantity > 1 ? `Wants ${i.quantity}` : ''].filter(Boolean).join(' · ').slice(0, LIMITS.notes),
    };
  });
}

/** Items on the page's own site get its name as the store; registries link out to other stores. */
export function sameSite(itemUrl: string | null, pageUrl: string): boolean {
  if (!itemUrl) return true;
  try {
    const base = (h: string) => h.replace(/^www\./, '').split('.').slice(-2).join('.');
    return base(new URL(itemUrl).hostname) === base(new URL(pageUrl).hostname);
  } catch {
    return false;
  }
}
