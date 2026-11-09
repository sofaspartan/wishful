import type { UrlMetadata } from '../../shared/types';
import { extractMetadata, retailerFromUrl } from '../../shared/metadata';
import { BROWSER_HEADERS, safeFetch, UnsafeUrlError, type SafeFetchResult } from './safeFetch';

export { decodeEntities, extractMetadata, retailerFromUrl } from '../../shared/metadata';

const BLOCK_TITLE =
  /access denied|just a moment|attention required|robot check|are you a (robot|human)|captcha|pardon our interruption|security check|verify (you are|you're) (a )?human|request (was )?(blocked|rejected)|bot (detection|protection)|unusual traffic|(site|system) maintenance|we['’]re working on it/i;
const BLOCK_MARKERS = /_cf_chl_opt|cf-browser-verification|captcha-delivery\.com|px-captcha|_Incapsula_Resource|validateCaptcha|ak-challenge|bm-verify|sec-if-cpt-container|kpsdk|istlWasHere/i;

/** Bot-protection services (Akamai, Cloudflare, DataDome, PerimeterX, F5…) answer with a challenge or error page instead of the product. */
export function looksBlocked(res: Pick<SafeFetchResult, 'status' | 'body'>): boolean {
  if ([401, 403, 405, 429, 503].includes(res.status)) return true;
  // Some challenge pages are large obfuscated scripts, but they announce themselves at the top.
  if (res.body.length > 60_000) return BLOCK_MARKERS.test(res.body.slice(0, 4000));
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(res.body)?.[1] ?? '';
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(res.body)?.[1] ?? '';
  return BLOCK_TITLE.test(title) || BLOCK_TITLE.test(h1) || BLOCK_MARKERS.test(res.body);
}

const NOT_FOUND_TITLE = /^(?:(?:page|product|item) )?not found\b|^404\b|\b404 error\b|page (?:can['’]?t|cannot|could not) be found|no longer available/i;

/** Stores send links to products they no longer sell to their home page or a search page. */
export function redirectedAway(requested: string, landed: string): boolean {
  try {
    const from = new URL(requested);
    const to = new URL(landed);
    const offPage = (u: URL) => u.pathname.replace(/\/(index\.html?)?$/, '') === '' || /\/(search|s)(\/|$)|[?&](q|keyword|search)=/i.test(u.pathname + u.search);
    return from.pathname !== to.pathname && offPage(to) && !offPage(from);
  } catch {
    return false;
  }
}

type Attempt = { res: SafeFetchResult } | { error: unknown };

/** Everything for one preview, kept under Netlify's 10-second function limit. */
const BUDGET_MS = 9000;

/** A result worth returning straight away: a real page, a refused URL, or a genuine "not found". */
const final = (a: Attempt): boolean =>
  'res' in a ? [404, 410].includes(a.res.status) || (a.res.status < 400 && !looksBlocked(a.res)) : a.error instanceof UnsafeUrlError;

/**
 * Fetch with our usual headers, and if that is blocked, fails or is slow, also try
 * headers that look like a regular Chrome visit — some stores only accept one or
 * the other. The first good answer wins; both share one deadline.
 */
function fetchPage(url: string, timeoutMs: number): Promise<Attempt> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const results: Attempt[] = [];
    let pending = 0;
    let retried = false;
    let done = false;
    const finish = (a: Attempt) => {
      done = true;
      clearTimeout(timer);
      resolve(a);
    };
    const settle = (a: Attempt) => {
      if (done) return;
      pending--;
      results.push(a);
      if (final(a)) return finish(a);
      if (!retried) return retry();
      // Prefer a response (so a block page can be reported as such) over a network error.
      if (pending === 0) finish(results.find((r) => 'res' in r) ?? a);
    };
    const start = (headers?: Record<string, string>) => {
      pending++;
      safeFetch(url, { timeoutMs: Math.max(1000, deadline - Date.now()), maxBytes: 3_000_000, headers }).then(
        (res) => settle({ res }),
        (error: unknown) => settle({ error }),
      );
    };
    const retry = () => {
      if (retried || done) return;
      retried = true;
      start(BROWSER_HEADERS);
    };
    const timer = setTimeout(retry, 2500);
    start();
  });
}

interface StoreDetails {
  title: string;
  brand: string;
  price: number | null;
  imageUrl: string | null;
}

/**
 * Shopify stores all serve `/products/<handle>.js` with the exact price (in cents)
 * and photos — used when a Shopify page's own markup leaves them out.
 */
async function shopifyDetails(pageUrl: string, html: string, timeoutMs: number): Promise<StoreDetails | null> {
  if (timeoutMs < 800 || !/cdn\.shopify\.com|Shopify\.shop\s*=/.test(html)) return null;
  const page = new URL(pageUrl);
  const path = /^(.*\/products\/[^/?#.]+)/.exec(page.pathname)?.[1];
  if (!path) return null;
  try {
    const res = await safeFetch(`${page.origin}${path}.js`, { timeoutMs, maxBytes: 1_000_000 });
    if (res.status !== 200 || !/json|javascript/i.test(res.contentType)) return null;
    const product = JSON.parse(res.body) as {
      title?: unknown;
      vendor?: unknown;
      price?: unknown;
      featured_image?: unknown;
      variants?: Array<{ id?: unknown; price?: unknown; featured_image?: { src?: unknown } | null }>;
    };
    const variantId = page.searchParams.get('variant');
    const variant = product.variants?.find((v) => String(v.id) === variantId) ?? product.variants?.[0];
    const cents = typeof variant?.price === 'number' ? variant.price : product.price;
    const image = variant?.featured_image?.src ?? product.featured_image;
    return {
      title: typeof product.title === 'string' ? product.title : '',
      brand: typeof product.vendor === 'string' ? product.vendor : '',
      price: typeof cents === 'number' && cents >= 0 ? cents / 100 : null,
      imageUrl: typeof image === 'string' ? new URL(image, pageUrl).toString() : null,
    };
  } catch {
    return null;
  }
}

/** Fetch a URL and extract metadata. Never throws for remote failures — returns `extracted: false`. */
export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  const fallback: UrlMetadata = {
    extracted: false,
    url,
    title: '',
    description: '',
    imageUrl: null,
    price: null,
    currency: null,
    retailer: retailerFromUrl(url),
    brand: '',
  };
  const started = Date.now();
  const site = new URL(url).hostname.replace(/^www\./, '');
  const attempt = await fetchPage(url, BUDGET_MS - 1000);
  if ('error' in attempt) {
    if (attempt.error instanceof UnsafeUrlError) throw attempt.error;
    return { ...fallback, blocked: true, message: `${site} didn't respond to our preview, so add the details below.` };
  }
  const res = attempt.res;
  if (looksBlocked(res)) {
    return { ...fallback, blocked: true, message: `${site} blocks previews from other websites, so we couldn't read the details. Add them below.` };
  }
  const pageTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(res.body.slice(0, 200_000))?.[1] ?? '';
  if (res.status === 404 || res.status === 410 || redirectedAway(url, res.url) || NOT_FOUND_TITLE.test(pageTitle.trim())) {
    return { ...fallback, message: "That page doesn't seem to exist any more. Check the link, or fill in the details yourself." };
  }
  if (res.status >= 400) {
    return { ...fallback, message: `The site responded with an error (${res.status}). You can fill in the details yourself.` };
  }
  if (!/html|xml/i.test(res.contentType)) {
    return { ...fallback, message: "That link isn't a web page we can read. Add the details manually." };
  }
  const data = extractMetadata(res.body, res.url);
  if (data.price === null || !data.imageUrl) {
    const shop = await shopifyDetails(res.url, res.body, BUDGET_MS - (Date.now() - started));
    if (shop) {
      data.title ||= shop.title;
      data.brand ||= shop.brand;
      data.price ??= shop.price;
      data.imageUrl ||= shop.imageUrl;
    }
  }
  const extracted = Boolean(data.title || data.imageUrl);
  const missing = [!data.imageUrl && 'photo', data.price === null && 'price'].filter(Boolean);
  return {
    ...data,
    extracted,
    message: !extracted
      ? "We couldn't read details from that page. You can fill them in below."
      : missing.length
        ? `We couldn't find the ${missing.join(' or ')} on that page — add ${missing.length > 1 ? 'them' : 'it'} below if you like.`
        : undefined,
  };
}
