import { extractMetadata, parsePrice } from '../../shared/metadata';

export interface PageSnapshot {
  url: string;
  title: string;
  /** The page's <head>, JSON-LD blocks and price microdata tags — everything `extractMetadata` reads. */
  html: string;
  /** Large visible images, biggest first. */
  images: string[];
  /** A visible price string such as "$49.99", for pages without structured data. */
  priceText: string;
}

/**
 * Runs inside the product page via `chrome.scripting.executeScript`, so it must
 * be completely self-contained: no imports and no references to outer scope.
 */
export function snapshotPage(): PageSnapshot {
  const parts: string[] = [document.head ? document.head.outerHTML : ''];
  document.querySelectorAll('body script[type="application/ld+json"]').forEach((s) => parts.push(s.outerHTML));
  document.querySelectorAll('body [itemprop="price"], body [itemprop="priceCurrency"], body meta[property]').forEach((el) => {
    parts.push((el.cloneNode(false) as Element).outerHTML);
  });

  const seen = new Set<string>();
  const images: string[] = [];
  Array.from(document.images)
    .filter((img) => img.naturalWidth >= 160 && img.naturalHeight >= 160 && /^https?:/.test(img.currentSrc || img.src))
    .map((img) => {
      const r = img.getBoundingClientRect();
      return { src: img.currentSrc || img.src, area: r.width * r.height, top: r.top + window.scrollY };
    })
    .filter((x) => x.area >= 160 * 160 && x.top < 2400)
    .sort((a, b) => b.area - a.area)
    .forEach((x) => {
      if (images.length < 8 && !seen.has(x.src)) {
        seen.add(x.src);
        images.push(x.src);
      }
    });

  let priceText = '';
  const candidates = document.querySelectorAll('[itemprop="price"], [class*="price" i], [id*="price" i], [data-testid*="price" i]');
  for (const el of Array.from(candidates).slice(0, 200)) {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length > 24 || !/[$€£¥₹]|\b(USD|EUR|GBP|CAD|AUD)\b/.test(text) || !/\d/.test(text)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.top + window.scrollY > 2000) continue;
    priceText = text;
    break;
  }

  return { url: location.href, title: document.title, html: parts.join('\n').slice(0, 800_000), images, priceText };
}

const SYMBOL_CURRENCY: Record<string, string> = { '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR' };

export interface PageDetails {
  url: string;
  title: string;
  description: string;
  retailer: string;
  brand: string;
  price: number | null;
  currency: string | null;
  images: string[];
}

/** "Linen throw – Maison Lin" → "Linen throw": page titles usually end with the store's name. */
function withoutSiteName(title: string): string {
  const parts = title.split(/\s+[|–—-]\s+/);
  return parts.length > 1 && parts[0].length >= 3 ? title.slice(0, title.lastIndexOf(parts[parts.length - 1])).replace(/\s+[|–—-]\s+$/, '') : title;
}

/** Combines structured metadata with what's visible on the page. */
export function readDetails(snap: PageSnapshot): PageDetails {
  const meta = extractMetadata(snap.html, snap.url);
  const fromTitleTag = !meta.title || meta.title === snap.title.replace(/\s+/g, ' ').trim();
  let { price, currency } = meta;
  if (price === null && snap.priceText) {
    price = parsePrice(snap.priceText);
    const symbol = Object.keys(SYMBOL_CURRENCY).find((s) => snap.priceText.includes(s));
    const code = /\b(USD|EUR|GBP|CAD|AUD)\b/.exec(snap.priceText)?.[1];
    currency = code ?? (symbol ? SYMBOL_CURRENCY[symbol] : null);
  }
  const images = [...new Set([meta.imageUrl, ...snap.images].filter((x): x is string => Boolean(x)))].slice(0, 8);
  return {
    url: meta.url,
    title: fromTitleTag ? withoutSiteName(meta.title || snap.title) : meta.title,
    description: meta.description,
    retailer: meta.retailer,
    brand: meta.brand,
    price,
    currency,
    images,
  };
}
