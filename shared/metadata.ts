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
  if (types.some((t) => typeof t === 'string' && /^(Product|ProductGroup|IndividualProduct|ProductModel|Book)$/i.test(t))) return obj;
  if (obj['@graph']) return findProduct(obj['@graph'], depth + 1);
  if (obj.mainEntity) return findProduct(obj.mainEntity, depth + 1);
  return null;
}

/** JSON-LD as stores actually ship it: wrapped in comments or CDATA, or with raw newlines inside strings. */
function parseJsonLd(raw: string): unknown {
  const text = raw
    .trim()
    .replace(/^<!--|-->$/g, '')
    .replace(/^\/\*\s*<!\[CDATA\[\s*\*\/|\/\*\s*\]\]>\s*\*\/$/g, '')
    .trim();
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(text.replace(/[\u0000-\u001f]+/g, ' '));
    } catch {
      return null;
    }
  }
}

/** A ProductGroup's variants — sites like Nike put the price and photos on these rather than the group. */
function variants(product: Json): Json[] {
  const v = product.hasVariant;
  return (Array.isArray(v) ? v : v ? [v] : []).filter((x): x is Json => Boolean(x) && typeof x === 'object');
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

/** "Linen throw – Maison Lin" → "Linen throw": page titles usually end with the store's name. */
export function withoutSiteName(title: string): string {
  const parts = title.split(/\s+[|–—-]\s+/);
  return parts.length > 1 && parts[0].length >= 3 ? title.slice(0, title.lastIndexOf(parts[parts.length - 1])).replace(/\s+[|–—-]\s+$/, '') : title;
}

const textOf = (html: string): string => clean(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' '), 400);

const SYMBOL_CURRENCY: Record<string, string> = { '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR' };
const PRICE_TEXT = /(?:[$€£¥₹]\s?\d[\d.,]*|\b(?:USD|EUR|GBP|CAD|AUD)\s?\d[\d.,]*|\d[\d.,]*\s?€)/;
// Strike-through, per-unit and "you save" amounts sit next to the real price in the same markup.
const NOT_THE_PRICE =
  /\b(?:was|old|list)\b|was-?price|price-?was|old-?price|list-?price|strike|line-?through|original|compare|regular|before|msrp|rrp|save|saving|discount|per-?unit|unit-?price|range|filter|slider|shipping|delivery|installment|monthly|klarna|afterpay/i;

/** Currency for a visible price string, e.g. "£40" → GBP. "$" is left unknown (USD, CAD, AUD…). */
export function currencyFromPriceText(text: string): string | null {
  const code = /\b(USD|EUR|GBP|CAD|AUD)\b/.exec(text)?.[1];
  const symbol = Object.keys(SYMBOL_CURRENCY).find((s) => text.includes(s));
  return code ?? (symbol ? SYMBOL_CURRENCY[symbol] : null);
}

/**
 * The price shown next to the product name, for pages without structured price
 * data: the first price-labelled element after the page's <h1>.
 */
function visiblePrice(html: string): string | null {
  const h1 = html.search(/<h1\b/i);
  const region = html.slice(Math.max(0, h1), Math.max(0, h1) + 120_000);
  const re = /<[a-z][a-z0-9]*\b[^>]*\b(?:class|id|data-testid|data-test|data-qa|data-automation-id)=["'][^"']*price[^"']*["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  let checked = 0;
  while ((m = re.exec(region)) && checked++ < 80) {
    if (NOT_THE_PRICE.test(m[0].replace(/\sstyle=("[^"]*"|'[^']*')/i, ''))) continue;
    // Tags removed without spaces: stores split prices across elements ("$" "249" "." "99").
    const text = clean(region.slice(m.index + m[0].length, m.index + m[0].length + 500).replace(/<[^>]*>/g, ''), 80);
    const found = PRICE_TEXT.exec(text.slice(0, 60))?.[0];
    if (found && (parsePrice(found) ?? 0) > 0) return found;
  }
  return null;
}

/** Image hints beyond Open Graph: microdata, <link rel="image_src">, Amazon's main photo, preloaded hero images. */
function fallbackImage(html: string): string | null {
  for (const m of html.matchAll(/<(?:link|meta|img)\b[^>]*>/gi)) {
    const a = parseAttributes(m[0]);
    if (a.rel?.toLowerCase() === 'image_src' && a.href) return a.href;
    if (a.itemprop?.toLowerCase() === 'image') {
      const src = a.content || a.src || a.href || a['data-src'];
      if (src && !src.startsWith('data:')) return src;
    }
    if (a['data-old-hires']) return a['data-old-hires'];
    if (a['data-a-dynamic-image']) {
      try {
        const first = Object.keys(JSON.parse(decodeEntities(a['data-a-dynamic-image'])))[0];
        if (first) return first;
      } catch {
        /* not JSON */
      }
    }
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = parseAttributes(m[0]);
    if (a.rel?.toLowerCase() === 'preload' && a.as === 'image' && a.fetchpriority?.toLowerCase() === 'high' && a.href) return a.href;
  }
  return null;
}

/** Extract product/page metadata from HTML via JSON-LD, Open Graph, meta tags, microdata and the visible page. */
export function extractMetadata(html: string, pageUrl: string): Omit<UrlMetadata, 'extracted' | 'message'> {
  const head = html.slice(0, 600_000);
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = parseAttributes(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content !== undefined && meta[key] === undefined) meta[key] = a.content;
  }
  // itemprop="price" may also be on other elements, with the amount in a content attribute or as text
  for (const m of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*itemprop=["'](price|pricecurrency)["'][^>]*>([^<]{0,40})/gi)) {
    const key = m[2].toLowerCase();
    const text = m[3].trim();
    const looksRight = key === 'price' ? PRICE_TEXT.test(text) || /^\d[\d.,]*$/.test(text) : /^[A-Za-z]{3}$/.test(text);
    const value = parseAttributes(m[0]).content || (looksRight ? text : '');
    if (value && meta[key] === undefined) meta[key] = value;
  }

  let product: Json | null = null;
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    product = findProduct(parseJsonLd(m[1]));
    if (product) break;
  }
  const productVariants = product ? variants(product) : [];

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  let offer = product ? offerFrom(product.offers) : { price: null, currency: null };
  for (const v of productVariants) {
    if (offer.price !== null) break;
    offer = offerFrom(v.offers);
  }
  const brandRaw = product?.brand;
  const brand =
    typeof brandRaw === 'string' ? brandRaw : brandRaw && typeof brandRaw === 'object' ? (brandRaw as Json).name : undefined;

  const h1Text = h1 ? textOf(h1).slice(0, 200) : '';
  const title =
    clean(product?.name, 200) ||
    clean(meta['og:title'], 200) ||
    clean(meta['twitter:title'], 200) ||
    (h1Text.length >= 3 ? h1Text : '') ||
    withoutSiteName(clean(titleTag, 200));
  const description =
    clean(product?.description, 1000) ||
    clean(meta['og:description'], 1000) ||
    clean(meta['description'], 1000) ||
    clean(meta['twitter:description'], 1000);
  const image = absolutize(
    imageFrom(product?.image) ||
      productVariants.map((v) => imageFrom(v.image)).find(Boolean) ||
      meta['og:image:secure_url'] ||
      meta['og:image'] ||
      meta['twitter:image'] ||
      meta['twitter:image:src'] ||
      fallbackImage(html),
    pageUrl,
  );
  const structuredPrice = offer.price !== null || Boolean(meta['product:price:amount'] || meta['og:price:amount'] || meta['price']);
  const sellsSomething = /add[ _-]?to[ _-]?(cart|bag|basket)|buy[ _-]?now|og:type["']?\s+content=["']product/i.test(html);
  const shownPrice = !structuredPrice && sellsSomething ? visiblePrice(html) : null;
  const price =
    offer.price ??
    parsePrice(meta['product:price:amount'] ?? meta['og:price:amount'] ?? meta['price'] ?? shownPrice ?? meta['twitter:data1'] ?? null);
  const currencyRaw =
    offer.currency ??
    meta['product:price:currency'] ??
    meta['og:price:currency'] ??
    meta['pricecurrency'] ??
    (shownPrice ? currencyFromPriceText(shownPrice) : null) ??
    (meta['price'] ? currencyFromPriceText(meta['price']) : null);
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
