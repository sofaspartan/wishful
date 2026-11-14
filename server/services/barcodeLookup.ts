import { canonicalBarcode, isValidBarcode, type BarcodeProduct } from '../../shared/barcode';

const UA = 'WishfulWishlist/0.1 (+https://wishful.app; barcode lookup)';

function emptyResult(barcode: string, message: string): BarcodeProduct {
  return {
    barcode,
    title: '',
    brand: null,
    imageUrl: null,
    description: null,
    category: null,
    url: null,
    retailer: null,
    price: null,
    currency: null,
    source: 'none',
    found: false,
    message,
  };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        accept: 'application/json',
        'user-agent': UA,
        ...(init?.headers || {}),
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function pickImage(candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c;
  }
  return null;
}

/** Open Food Facts — strong coverage for grocery / pantry / drugstore food. */
async function fromOpenFoodFacts(barcode: string): Promise<BarcodeProduct | null> {
  const data = (await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`)) as {
    status?: number;
    product?: Record<string, unknown>;
  } | null;
  if (!data || data.status !== 1 || !data.product) return null;
  const p = data.product;
  const title =
    String(p.product_name || p.product_name_en || p.generic_name || '').trim() ||
    String(p.brands || '').trim();
  if (!title) return null;
  const brands = String(p.brands || '').split(',')[0]?.trim() || null;
  const quantity = String(p.quantity || '').trim();
  return {
    barcode,
    title: quantity ? `${title} (${quantity})` : title,
    brand: brands,
    imageUrl: pickImage([
      p.image_front_url as string,
      p.image_url as string,
      p.image_small_url as string,
    ]),
    description: String(p.generic_name || p.ingredients_text || '').trim() || null,
    category: String(p.categories_tags && Array.isArray(p.categories_tags) ? (p.categories_tags as string[])[0] : '')
      .replace(/^en:/, '')
      .replace(/-/g, ' ')
      .trim() || null,
    url: `https://world.openfoodfacts.org/product/${barcode}`,
    retailer: null,
    price: null,
    currency: null,
    source: 'openfoodfacts',
    found: true,
  };
}

/** Open Products Facts — household / general merchandise (closer to Target/Walmart non-food). */
async function fromOpenProductsFacts(barcode: string): Promise<BarcodeProduct | null> {
  const data = (await fetchJson(`https://world.openproductsfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`)) as {
    status?: number;
    product?: Record<string, unknown>;
  } | null;
  if (!data || data.status !== 1 || !data.product) return null;
  const p = data.product;
  const title = String(p.product_name || p.product_name_en || p.generic_name || '').trim();
  if (!title) return null;
  const brands = String(p.brands || '').split(',')[0]?.trim() || null;
  return {
    barcode,
    title,
    brand: brands,
    imageUrl: pickImage([p.image_front_url as string, p.image_url as string]),
    description: String(p.generic_name || '').trim() || null,
    category: null,
    url: `https://world.openproductsfacts.org/product/${barcode}`,
    retailer: null,
    price: null,
    currency: null,
    source: 'openproductsfacts',
    found: true,
  };
}

/** UPCitemdb trial — broad retail catalog; rate-limited, best-effort. */
async function fromUpcItemDb(barcode: string): Promise<BarcodeProduct | null> {
  const data = (await fetchJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`)) as {
    code?: string;
    items?: Array<Record<string, unknown>>;
  } | null;
  if (!data || data.code !== 'OK' || !data.items?.length) return null;
  const item = data.items[0];
  const title = String(item.title || '').trim();
  if (!title) return null;
  const offers = Array.isArray(item.offers) ? (item.offers as Array<Record<string, unknown>>) : [];
  const offer = offers.find((o) => typeof o.link === 'string' && o.link) || offers[0];
  const priceRaw = offer && typeof offer.price === 'number' ? offer.price : null;
  return {
    barcode,
    title,
    brand: String(item.brand || '').trim() || null,
    imageUrl: pickImage([
      Array.isArray(item.images) ? (item.images[0] as string) : null,
      item.image as string,
    ]),
    description: String(item.description || '').trim() || null,
    category: String(item.category || '').trim() || null,
    url: offer && typeof offer.link === 'string' ? String(offer.link) : null,
    retailer: offer && typeof offer.merchant === 'string' ? String(offer.merchant) : null,
    price: priceRaw !== null && Number.isFinite(priceRaw) ? priceRaw : null,
    currency: 'USD',
    source: 'upcitemdb',
    found: true,
  };
}

/** Short in-memory cache so re-scans in the same aisle don’t hit every catalog again. */
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: BarcodeProduct }>();

/**
 * Resolve a retail barcode to product details for in-store wishlist adds
 * (Walmart / Target aisle scanning). Tries open catalogs first, then a
 * broader trial retail lookup.
 */
export async function lookupBarcode(raw: string): Promise<BarcodeProduct> {
  if (!isValidBarcode(raw)) {
    return emptyResult(normalizeSafe(raw), 'That doesn’t look like a product barcode. Use the digits under the bars (UPC or EAN).');
  }
  const barcode = canonicalBarcode(raw);
  const cached = cache.get(barcode);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const padded = barcode.length === 12 ? `0${barcode}` : null;
  const [off, opf] = await Promise.all([fromOpenFoodFacts(barcode), fromOpenProductsFacts(barcode)]);
  if (off) return remember(barcode, off);
  if (opf) return remember(barcode, opf);

  if (padded) {
    const [off13, opf13] = await Promise.all([fromOpenFoodFacts(padded), fromOpenProductsFacts(padded)]);
    if (off13) return remember(barcode, { ...off13, barcode });
    if (opf13) return remember(barcode, { ...opf13, barcode });
  }

  const upc = await fromUpcItemDb(barcode);
  if (upc) return remember(barcode, upc);

  return remember(
    barcode,
    emptyResult(barcode, 'No product match yet — save the barcode and fill in the name (common for store brands).'),
  );
}

function remember(barcode: string, value: BarcodeProduct): BarcodeProduct {
  cache.set(barcode, { at: Date.now(), value });
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return value;
}

function normalizeSafe(raw: string): string {
  return String(raw || '').replace(/[\s\-]/g, '').trim();
}
