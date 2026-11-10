import type { CoverIcon } from './types';

export const GIFT_STORES = ['ebay', 'bestbuy', 'etsy'] as const;
export type GiftStore = (typeof GIFT_STORES)[number];

export const GIFT_STORE_LABELS: Record<GiftStore, string> = {
  ebay: 'eBay',
  bestbuy: 'Best Buy',
  etsy: 'Etsy',
};

export interface GiftProduct {
  /** `${store}:${the store's own id}` */
  id: string;
  store: GiftStore;
  title: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  /** Shop or seller name, when the store has one (eBay sellers, Etsy shops, brands). */
  seller: string | null;
  rating: number | null;
  reviewCount: number | null;
}

export interface GiftStoreStatus {
  store: GiftStore;
  ok: boolean;
  count: number;
}

export interface GiftSearchResponse {
  query: string;
  page: number;
  products: GiftProduct[];
  /** Stores switched on for this site; empty when no keys are set. */
  stores: GiftStore[];
  results: GiftStoreStatus[];
  hasMore: boolean;
  amazonUrl: string;
}

export const GIFT_PRICE_CAPS = [25, 50, 100, 250] as const;
export const GIFT_PAGE_SIZE = 24;
export const GIFT_MAX_PAGE = 5;

export interface GiftCategory {
  id: string;
  label: string;
  icon: CoverIcon;
  query: string;
  maxPrice?: number;
}

export const GIFT_CATEGORIES: GiftCategory[] = [
  { id: 'popular', label: 'Popular', icon: 'gift', query: 'gift ideas' },
  { id: 'birthday', label: 'Birthday', icon: 'cake', query: 'birthday gift' },
  { id: 'christmas', label: 'Christmas', icon: 'tree', query: 'christmas gift' },
  { id: 'under-25', label: 'Under $25', icon: 'red-envelope', query: 'gift', maxPrice: 25 },
  { id: 'for-her', label: 'For her', icon: 'perfume', query: 'gifts for her' },
  { id: 'for-him', label: 'For him', icon: 'necktie', query: 'gifts for him' },
  { id: 'kids', label: 'Kids', icon: 'teddy', query: 'kids toys' },
  { id: 'teens', label: 'Teens', icon: 'headphones', query: 'gifts for teens' },
  { id: 'baby', label: 'Baby', icon: 'rattle', query: 'baby gift' },
  { id: 'personalized', label: 'Personalized', icon: 'love-letter', query: 'personalized gift' },
  { id: 'tech', label: 'Tech', icon: 'laptop', query: 'tech gadgets' },
  { id: 'gaming', label: 'Gaming', icon: 'controller', query: 'video games' },
  { id: 'lego', label: 'LEGO', icon: 'brick', query: 'lego' },
  { id: 'books', label: 'Books', icon: 'book', query: 'books' },
  { id: 'home', label: 'Home', icon: 'candle', query: 'home decor gift' },
  { id: 'kitchen', label: 'Kitchen', icon: 'whisk', query: 'kitchen gadgets' },
  { id: 'beauty', label: 'Beauty', icon: 'lipstick', query: 'skincare gift set' },
  { id: 'outdoors', label: 'Outdoors', icon: 'tent', query: 'camping gear' },
  { id: 'sports', label: 'Sports', icon: 'basketball', query: 'sports gifts' },
  { id: 'music', label: 'Music', icon: 'guitar', query: 'music gifts' },
  { id: 'crafts', label: 'Crafts', icon: 'yarn', query: 'craft kit' },
  { id: 'pets', label: 'Pets', icon: 'paw', query: 'dog toys' },
  { id: 'housewarming', label: 'Housewarming', icon: 'house', query: 'housewarming gift' },
  { id: 'wedding', label: 'Wedding', icon: 'ring', query: 'wedding gift' },
  { id: 'anniversary', label: 'Anniversary', icon: 'heart', query: 'anniversary gift' },
];

/** Lower-case, single-spaced, so "LEGO  sets" and "lego sets" share a cache entry. */
export function normalizeGiftQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Amazon's own search results page; `p_36` is its price filter, in cents. */
export function amazonSearchUrl(query: string, maxPrice?: number, tag?: string): string {
  const url = new URL('https://www.amazon.com/s');
  url.searchParams.set('k', query);
  if (maxPrice) url.searchParams.set('rh', `p_36:-${maxPrice * 100}`);
  if (tag) url.searchParams.set('tag', tag);
  return url.toString();
}
