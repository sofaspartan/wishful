import { decodeEntities } from '../../shared/metadata';
import { isHttpUrl } from '../../shared/schemas';
import {
  GIFT_MAX_PAGE,
  GIFT_PAGE_SIZE,
  GIFT_STORES,
  amazonSearchUrl,
  normalizeGiftQuery,
  type GiftProduct,
  type GiftSearchResponse,
  type GiftStore,
} from '../../shared/giftIdeas';
import { db } from '../storage';
import { now, sha256 } from '../util';

/**
 * Product search across store APIs (eBay Browse, Best Buy Products, Etsy Open
 * API). Each store switches on when its keys are set; the hosts are fixed, so
 * these calls don't go through `safeFetch`. Pages are cached per store so
 * category chips and repeat searches don't spend the stores' daily quotas.
 */

const TIMEOUT_MS = 6000;
const CACHE_MS = 6 * 60 * 60 * 1000;

export interface GiftSearchInput {
  q: string;
  maxPrice?: number;
  store?: GiftStore;
  page: number;
}

interface StoreQuery {
  q: string;
  maxPrice?: number;
  page: number;
}

interface StorePage {
  products: GiftProduct[];
  hasMore: boolean;
}

interface CacheRecord extends StorePage {
  expiresAt: string;
}

const env = (name: string) => process.env[name]?.trim() || '';

export function enabledGiftStores(): GiftStore[] {
  return GIFT_STORES.filter((store) => {
    if (store === 'ebay') return Boolean(env('EBAY_CLIENT_ID') && env('EBAY_CLIENT_SECRET'));
    if (store === 'bestbuy') return Boolean(env('BESTBUY_API_KEY'));
    return Boolean(env('ETSY_API_KEY') && env('ETSY_SHARED_SECRET'));
  });
}

class StoreError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { accept: 'application/json', ...init.headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    // Only the host is logged: Best Buy's key travels in the query string.
    const body = await res.text().catch(() => '');
    throw new StoreError(`${new URL(url).hostname} answered ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as T;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Links and photos from the stores end up in `href`/`src`, so anything but http(s) is dropped. */
const link = (v: unknown): string | null => (typeof v === 'string' && isHttpUrl(v) ? v : null);

const text = (v: unknown): string => (typeof v === 'string' ? decodeEntities(v).replace(/\s+/g, ' ').trim() : '');

// ── eBay ────────────────────────────────────────────────────────────────

let ebayToken: { value: string; expiresAt: number } | null = null;

async function ebayAccessToken(): Promise<string> {
  if (ebayToken && ebayToken.expiresAt > Date.now() + 60_000) return ebayToken.value;
  const basic = Buffer.from(`${env('EBAY_CLIENT_ID')}:${env('EBAY_CLIENT_SECRET')}`).toString('base64');
  const data = await getJson<{ access_token?: string; expires_in?: number }>('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }).toString(),
  });
  if (!data.access_token) throw new StoreError('eBay returned no access token', 500);
  ebayToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000 };
  return ebayToken.value;
}

interface EbayItem {
  itemId?: string;
  title?: string;
  image?: { imageUrl?: string };
  thumbnailImages?: Array<{ imageUrl?: string }>;
  price?: { value?: string; currency?: string };
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
  seller?: { username?: string };
}

export function ebayProducts(items: EbayItem[] = []): GiftProduct[] {
  return items.flatMap((item) => {
    const url = link(item.itemAffiliateWebUrl) ?? link(item.itemWebUrl);
    const title = text(item.title);
    if (!item.itemId || !url || !title) return [];
    // eBay hands out 225px thumbnails; the same photo comes in larger sizes.
    const image = link(item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl)?.replace(/\/s-l\d+\./, '/s-l500.') ?? null;
    return [
      {
        id: `ebay:${item.itemId}`,
        store: 'ebay' as const,
        title,
        url,
        imageUrl: image,
        price: num(item.price?.value),
        currency: item.price?.currency ?? null,
        seller: item.seller?.username ?? null,
        rating: null,
        reviewCount: null,
      },
    ];
  });
}

async function searchEbay({ q, maxPrice, page }: StoreQuery): Promise<StorePage> {
  const filter = ['buyingOptions:{FIXED_PRICE}', 'conditions:{NEW}', ...(maxPrice ? [`price:[..${maxPrice}]`, 'priceCurrency:USD'] : [])].join(',');
  const params = new URLSearchParams({ q, filter, limit: String(GIFT_PAGE_SIZE), offset: String((page - 1) * GIFT_PAGE_SIZE) });
  const campaign = env('EBAY_CAMPAIGN_ID');
  let data: { itemSummaries?: EbayItem[]; total?: number };
  try {
    data = await getJson(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
      headers: {
        authorization: `Bearer ${await ebayAccessToken()}`,
        'x-ebay-c-marketplace-id': 'EBAY_US',
        ...(campaign ? { 'x-ebay-c-enduserctx': `affiliateCampaignId=${campaign}` } : {}),
      },
    });
  } catch (err) {
    if (err instanceof StoreError && err.status === 401) ebayToken = null;
    throw err;
  }
  return { products: ebayProducts(data.itemSummaries), hasMore: (data.total ?? 0) > page * GIFT_PAGE_SIZE };
}

// ── Best Buy ────────────────────────────────────────────────────────────

interface BestBuyProduct {
  sku?: number;
  name?: string;
  salePrice?: number;
  image?: string;
  largeFrontImage?: string;
  url?: string;
  manufacturer?: string;
  customerReviewAverage?: number;
  customerReviewCount?: number;
}

export function bestBuyProducts(items: BestBuyProduct[] = []): GiftProduct[] {
  return items.flatMap((p) => {
    const url = link(p.url);
    const title = text(p.name);
    if (!p.sku || !url || !title) return [];
    return [
      {
        id: `bestbuy:${p.sku}`,
        store: 'bestbuy' as const,
        title,
        url,
        imageUrl: link(p.largeFrontImage) ?? link(p.image),
        price: num(p.salePrice),
        currency: 'USD',
        seller: p.manufacturer ? text(p.manufacturer) : null,
        rating: num(p.customerReviewAverage),
        reviewCount: num(p.customerReviewCount),
      },
    ];
  });
}

/** Best Buy's search goes in the path: `products(search=lego&search=star&salePrice<=25)`. Only letters and digits get in. */
export function bestBuyCriteria(q: string, maxPrice?: number): string | null {
  const words = (q.toLowerCase().match(/[a-z0-9]+/g) ?? []).slice(0, 8);
  if (!words.length) return null;
  return [...words.map((w) => `search=${w}`), 'onlineAvailability=true', ...(maxPrice ? [`salePrice%3C=${maxPrice}`] : [])].join('&');
}

async function searchBestBuy({ q, maxPrice, page }: StoreQuery): Promise<StorePage> {
  const criteria = bestBuyCriteria(q, maxPrice);
  if (!criteria) return { products: [], hasMore: false };
  const params = new URLSearchParams({
    apiKey: env('BESTBUY_API_KEY'),
    format: 'json',
    pageSize: String(GIFT_PAGE_SIZE),
    page: String(page),
    sort: 'customerReviewCount.dsc',
    show: 'sku,name,salePrice,image,largeFrontImage,url,manufacturer,customerReviewAverage,customerReviewCount',
  });
  const data = await getJson<{ products?: BestBuyProduct[]; currentPage?: number; totalPages?: number }>(`https://api.bestbuy.com/v1/products(${criteria})?${params}`);
  return { products: bestBuyProducts(data.products), hasMore: (data.currentPage ?? page) < (data.totalPages ?? 0) };
}

// ── Etsy ────────────────────────────────────────────────────────────────

interface EtsyListing {
  listing_id?: number;
  title?: string;
  url?: string;
  price?: { amount?: number; divisor?: number; currency_code?: string };
  images?: Array<{ url_570xN?: string; url_fullxfull?: string }>;
}

export function etsyProducts(listings: EtsyListing[] = [], images = new Map<number, string>()): GiftProduct[] {
  return listings.flatMap((l) => {
    const url = link(l.url);
    const title = text(l.title);
    if (!l.listing_id || !url || !title) return [];
    const amount = num(l.price?.amount);
    const divisor = num(l.price?.divisor) || 1;
    return [
      {
        id: `etsy:${l.listing_id}`,
        store: 'etsy' as const,
        title,
        url,
        imageUrl: link(images.get(l.listing_id)),
        price: amount === null ? null : Math.round((amount / divisor) * 100) / 100,
        currency: l.price?.currency_code ?? null,
        seller: null,
        rating: null,
        reviewCount: null,
      },
    ];
  });
}

async function searchEtsy({ q, maxPrice, page }: StoreQuery): Promise<StorePage> {
  const headers = { 'x-api-key': `${env('ETSY_API_KEY')}:${env('ETSY_SHARED_SECRET')}` };
  const params = new URLSearchParams({ keywords: q, sort_on: 'score', limit: String(GIFT_PAGE_SIZE), offset: String((page - 1) * GIFT_PAGE_SIZE) });
  if (maxPrice) params.set('max_price', String(maxPrice));
  const data = await getJson<{ count?: number; results?: EtsyListing[] }>(`https://openapi.etsy.com/v3/application/listings/active?${params}`, { headers });
  const listings = data.results ?? [];
  // Search results come without photos; one batch call fetches them for the whole page.
  const images = new Map<number, string>();
  const ids = listings.map((l) => l.listing_id).filter((id): id is number => Number.isInteger(id));
  if (ids.length) {
    try {
      const batch = await getJson<{ results?: EtsyListing[] }>(`https://openapi.etsy.com/v3/application/listings/batch?listing_ids=${ids.join(',')}&includes=Images`, { headers });
      for (const l of batch.results ?? []) {
        const image = l.images?.[0];
        const src = image?.url_570xN || image?.url_fullxfull;
        if (l.listing_id && src) images.set(l.listing_id, src);
      }
    } catch (err) {
      console.warn('[gifts] etsy photos failed', err);
    }
  }
  return { products: etsyProducts(listings, images), hasMore: (data.count ?? 0) > page * GIFT_PAGE_SIZE };
}

// ── Search ──────────────────────────────────────────────────────────────

const SEARCHERS: Record<GiftStore, (query: StoreQuery) => Promise<StorePage>> = {
  ebay: searchEbay,
  bestbuy: searchBestBuy,
  etsy: searchEtsy,
};

async function storePage(store: GiftStore, query: StoreQuery): Promise<StorePage> {
  const key = sha256(`${store}|${query.q}|${query.maxPrice ?? ''}|${query.page}`);
  const cached = (await db('gift-cache').get<CacheRecord>(key))?.value;
  if (cached && new Date(cached.expiresAt).getTime() > now().getTime()) return { products: cached.products, hasMore: cached.hasMore };
  const page = await SEARCHERS[store](query);
  const record: CacheRecord = { ...page, expiresAt: new Date(now().getTime() + CACHE_MS).toISOString() };
  await db('gift-cache')
    .set(key, record)
    .catch((err) => console.warn('[gifts] cache write failed', err));
  return page;
}

/** One from each store in turn, so a page isn't all eBay followed by all Etsy. */
export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

export async function searchGifts(input: GiftSearchInput): Promise<GiftSearchResponse> {
  const q = normalizeGiftQuery(input.q);
  const stores = enabledGiftStores();
  const wanted = input.store ? stores.filter((s) => s === input.store) : stores;
  const pages = await Promise.all(
    wanted.map(async (store) => {
      try {
        return { store, page: await storePage(store, { q, maxPrice: input.maxPrice, page: input.page }) };
      } catch (err) {
        console.warn(`[gifts] ${store} search failed`, err);
        return { store, page: null };
      }
    }),
  );
  return {
    query: q,
    page: input.page,
    products: interleave(pages.map((p) => p.page?.products ?? [])),
    stores,
    results: pages.map((p) => ({ store: p.store, ok: Boolean(p.page), count: p.page?.products.length ?? 0 })),
    hasMore: input.page < GIFT_MAX_PAGE && pages.some((p) => p.page?.hasMore),
    amazonUrl: amazonSearchUrl(input.q.trim().replace(/\s+/g, ' '), input.maxPrice, env('AMAZON_ASSOCIATE_TAG') || undefined),
  };
}
