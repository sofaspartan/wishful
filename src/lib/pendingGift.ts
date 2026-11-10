import { isHttpUrl } from '../../shared/schemas';
import type { AddItemOptions } from '../components/appActions';

export type GiftDraft = NonNullable<AddItemOptions['product']>;

/** A product a signed-out visitor chose on Gift ideas, kept in this tab until they've logged in. */
const KEY = 'wishful.pendingGift';
const MAX_AGE_MS = 60 * 60 * 1000;

export function savePendingGift(product: GiftDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ product, savedAt: Date.now() }));
  } catch {
    // Storage blocked: they'll just pick the product again after logging in.
  }
}

/** Returns the saved product once, then forgets it. */
export function takePendingGift(): GiftDraft | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const { product: p, savedAt } = JSON.parse(raw) as { product?: Partial<GiftDraft>; savedAt?: number };
    if (!p || typeof savedAt !== 'number' || Date.now() - savedAt > MAX_AGE_MS) return null;
    if (typeof p.title !== 'string' || !p.title.trim() || typeof p.url !== 'string' || !isHttpUrl(p.url)) return null;
    return {
      title: p.title.slice(0, 200),
      url: p.url,
      imageUrl: typeof p.imageUrl === 'string' && isHttpUrl(p.imageUrl) ? p.imageUrl : null,
      price: typeof p.price === 'number' && Number.isFinite(p.price) ? p.price : null,
      currency: typeof p.currency === 'string' ? p.currency.slice(0, 3) : null,
      retailer: typeof p.retailer === 'string' ? p.retailer.slice(0, 100) : '',
      brand: typeof p.brand === 'string' ? p.brand.slice(0, 100) : undefined,
    };
  } catch {
    return null;
  }
}
