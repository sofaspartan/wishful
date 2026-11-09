import type { UrlMetadata } from './types';

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  trade: '™',
  reg: '®',
  copy: '©',
  euro: '€',
  pound: '£',
  yen: '¥',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const clean = (v: unknown, max = 500): string =>
  typeof v === 'string' ? decodeEntities(v).replace(/\s+/g, ' ').trim().slice(0, max) : '';

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  return attrs;
}

export function parsePrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
  if (typeof value !== 'string') return null;
  let s = value.replace(/[^\d.,]/g, '');
  if (!s) return null;
  // "1.234,56" (EU) vs "1,234.56" (US)
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = /,\d{2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

type Json = Record<string, unknown>;

function findProduct(node: unknown, depth = 0): Json | null {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findProduct(n, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  const obj = node as Json;
  const type = obj['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === 'string' && /^(Product|ProductGroup|IndividualProduct)$/i.test(t))) return obj;
  if (obj['@graph']) return findProduct(obj['@graph'], depth + 1);
  if (obj.mainEntity) return findProduct(obj.mainEntity, depth + 1);
  return null;
}

function imageFrom(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return imageFrom(value[0]);
  if (typeof value === 'object') {
    const o = value as Json;
    return imageFrom(o.url ?? o.contentUrl);
  }
  return null;
}

function offerFrom(value: unknown): { price: number | null; currency: string | null } {
  const offers = Array.isArray(value) ? value : value ? [value] : [];
  for (const raw of offers) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Json;
    const price = parsePrice(o.price ?? o.lowPrice ?? (o.priceSpecification as Json | undefined)?.price);
    const currency =
      (o.priceCurrency as string) ?? ((o.priceSpecification as Json | undefined)?.priceCurrency as string) ?? null;
    if (price !== null) return { price, currency: typeof currency === 'string' ? currency.toUpperCase().slice(0, 3) : null };
    if (o.offers) return offerFrom(o.offers);
  }
  return { price: null, currency: null };
}

function absolutize(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const u = new URL(decodeEntities(value.trim()), base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function retailerFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\d?\./, '').replace(/^m\./, '');
    const labels = host.split('.');
    // Handle second-level registries such as .co.uk / .com.au
    const sld = labels.length >= 3 && /^(co|com|org|net|gov|ac|edu|ne|or)$/.test(labels[labels.length - 2]);
    const name = (sld ? labels[labels.length - 3] : labels[labels.length - 2]) || host;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return '';
  }
}

/** Extract product/page metadata from HTML via JSON-LD, Open Graph and standard meta tags. */
export function extractMetadata(html: string, pageUrl: string): Omit<UrlMetadata, 'extracted' | 'message'> {
  const head = html.slice(0, 600_000);
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = parseAttributes(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content !== undefined && meta[key] === undefined) meta[key] = a.content;
  }
  // itemprop="price" may also be on non-meta elements with a content attribute
  for (const m of head.matchAll(/<[a-z]+\b[^>]*itemprop=["'](price|pricecurrency)["'][^>]*>/gi)) {
    const a = parseAttributes(m[0]);
    if (a.content && meta[m[1].toLowerCase()] === undefined) meta[m[1].toLowerCase()] = a.content;
  }

  let product: Json | null = null;
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      product = findProduct(JSON.parse(m[1].trim()));
      if (product) break;
    } catch {
      /* ignore malformed JSON-LD */
    }
  }

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const offer = product ? offerFrom(product.offers) : { price: null, currency: null };
  const brandRaw = product?.brand;
  const brand =
    typeof brandRaw === 'string' ? brandRaw : brandRaw && typeof brandRaw === 'object' ? (brandRaw as Json).name : undefined;

  const title = clean(product?.name, 200) || clean(meta['og:title'], 200) || clean(meta['twitter:title'], 200) || clean(titleTag, 200);
  const description =
    clean(product?.description, 1000) ||
    clean(meta['og:description'], 1000) ||
    clean(meta['description'], 1000) ||
    clean(meta['twitter:description'], 1000);
  const image = absolutize(
    imageFrom(product?.image) || meta['og:image:secure_url'] || meta['og:image'] || meta['twitter:image'] || meta['twitter:image:src'] || null,
    pageUrl,
  );
  const price =
    offer.price ??
    parsePrice(meta['product:price:amount'] ?? meta['og:price:amount'] ?? meta['price'] ?? meta['twitter:data1'] ?? null);
  const currencyRaw = offer.currency ?? meta['product:price:currency'] ?? meta['og:price:currency'] ?? meta['pricecurrency'] ?? null;
  const currency = currencyRaw && /^[A-Za-z]{3}$/.test(currencyRaw.trim()) ? currencyRaw.trim().toUpperCase() : null;

  return {
    url: pageUrl,
    title,
    description,
    imageUrl: image,
    price,
    currency,
    retailer: clean(meta['og:site_name'], 100) || retailerFromUrl(pageUrl),
    brand: clean(brand, 100) || clean(meta['product:brand'], 100) || clean(meta['og:brand'], 100),
  };
}
