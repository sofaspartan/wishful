/**
 * Reading a whole list from another site, given its link: Amazon wish lists (one page
 * of 10 items per call, continued with `next`), or any page that describes its
 * products with JSON-LD. Fetches go through `safeFetch`, so the SSRF protections apply.
 */
import { decodeEntities, parseAttributes, retailerFromUrl } from '../../shared/metadata';
import { importCandidates, type ListImportResult, type RawListItem } from '../../shared/listImport';
import { BROWSER_HEADERS, safeFetch, UnsafeUrlError, type SafeFetchResult } from './safeFetch';
import { looksBlocked } from './metadata';
import { BRAND_NAME } from '../brand';

const BUDGET_MS = 8500;
const MAX_JSONLD_ITEMS = 500;

const clean = (s: string | undefined) => decodeEntities((s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

export const isAmazonHost = (host: string) => /(^|\.)amazon\.(com|ca|com\.mx|com\.br|co\.uk|de|fr|it|es|nl|se|pl|com\.be|ie|in|co\.jp|com\.au|sg|ae|sa|eg|com\.tr)$/i.test(host);

/** Amazon serves its small product photos as `…._SS135_.jpg`; dropping the size code gives the full image. */
const fullSizeAmazonImage = (src: string) => src.replace(/\._[A-Z0-9,_-]+_\.(jpe?g|png|webp)$/i, '.$1');

/** One Amazon wish list page (the list itself or a "more items" page): items, list name and the next page. */
export function parseAmazonList(html: string, pageUrl: string): { listName: string; items: RawListItem[]; next: string | null } {
  const origin = new URL(pageUrl).origin;
  const starts = [...html.matchAll(/<li\b[^>]*\bdata-itemid="([^"]+)"[^>]*>/gi)];
  const items: RawListItem[] = starts.flatMap((m, i) => {
    const id = m[1];
    const chunk = html.slice(m.index, starts[i + 1]?.index ?? html.length);
    const byId = (prefix: string) => {
      const at = chunk.indexOf(`id="${prefix}${id}"`);
      if (at < 0) return null;
      const open = chunk.lastIndexOf('<', at);
      const close = chunk.indexOf('>', at);
      const end = chunk.indexOf('</', close);
      return { attrs: parseAttributes(chunk.slice(open, close + 1)), text: clean(chunk.slice(close + 1, end < 0 ? close + 1 : end)) };
    };
    // List view names the item in `#itemName_…`; grid view only in the photo link's title and the image's alt text.
    const name = byId('itemName_');
    const imgTag = /<img\b[^>]*\bsrc="https:\/\/[^"]+\/images\/I\/[^"]+"[^>]*>/i.exec(chunk)?.[0];
    const imgAttrs = imgTag ? parseAttributes(imgTag) : {};
    const titledLink = /<a\b[^>]*\btitle="[^"]+"[^>]*>/i.exec(chunk)?.[0];
    const linkAttrs = name?.attrs ?? (titledLink ? parseAttributes(titledLink) : {});
    const title = clean(name?.attrs.title) || name?.text || clean(linkAttrs.title) || clean(imgAttrs.alt);
    if (!title) return [];
    const liAttrs = parseAttributes(m[0]);
    const asin =
      /ASIN:([A-Z0-9]{10})/i.exec(decodeEntities(liAttrs['data-reposition-action-params'] ?? ''))?.[1] ??
      /^[A-Z0-9]{10}$/i.exec(liAttrs['data-csa-c-item-id'] ?? '')?.[0] ??
      /\/dp\/([A-Z0-9]{10})/i.exec(linkAttrs.href ?? '')?.[1];
    const href = linkAttrs.href ? decodeEntities(linkAttrs.href) : '';
    const img = imgAttrs.src ?? '';
    const dataPrice = Number.parseFloat(liAttrs['data-price'] ?? '');
    const requested = Number.parseInt(byId('itemRequested_')?.text ?? '', 10);
    return [
      {
        title: title.slice(0, 300),
        url: asin ? `${origin}/dp/${asin.toUpperCase()}` : href ? new URL(href, origin).href : '',
        image: img ? fullSizeAmazonImage(decodeEntities(img)) : '',
        priceText: clean(/class="a-offscreen">([^<]*)</.exec(chunk)?.[1]),
        price: Number.isFinite(dataPrice) && dataPrice > 0 ? dataPrice : null,
        priority: byId('itemPriority_')?.text.toLowerCase() ?? '',
        note: byId('itemComment_')?.text ?? '',
        quantity: Number.isInteger(requested) && requested > 0 ? requested : null,
      },
    ];
  });
  const listName = clean(/id="profile-list-name"[^>]*>([\s\S]*?)<\//.exec(html)?.[1]).slice(0, 80);
  const more = /<input\b[^>]*name="showMoreUrl"[^>]*>/i.exec(html)?.[0];
  const nextRaw = more ? decodeEntities(parseAttributes(more).value ?? '') : '';
  return { listName, items, next: nextRaw && !html.includes('id="endOfListMarker"') ? amazonNextPage(nextRaw, pageUrl) : null };
}

/** Only Amazon's own "more items" address on the same site is followed. */
export function amazonNextPage(next: string, pageUrl: string): string | null {
  try {
    const base = new URL(pageUrl);
    const u = new URL(next, base.origin);
    if (u.origin !== base.origin || !isAmazonHost(u.hostname) || u.pathname !== '/hz/wishlist/slv/items') return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Products listed in JSON-LD (`ItemList`, `Product`, `@graph`), which many stores add to list and category pages. */
export function parseJsonLdList(html: string, pageUrl: string): RawListItem[] {
  const out: RawListItem[] = [];
  const toUrl = (raw: unknown) => {
    try {
      const u = new URL(String(raw ?? ''), pageUrl);
      return /^https?:$/.test(u.protocol) ? u.href : '';
    } catch {
      return '';
    }
  };
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 6 || out.length >= MAX_JSONLD_ITEMS) return;
    if (Array.isArray(node)) return node.forEach((n) => visit(n, depth + 1));
    const o = node as Record<string, unknown>;
    const type = String(o['@type'] ?? '');
    if (/ItemList/.test(type)) return visit(o.itemListElement, depth + 1);
    if (/ListItem/.test(type) && o.item) return visit(o.item, depth + 1);
    if (/Product/.test(type) || (/ListItem/.test(type) && o.url)) {
      const url = toUrl(o.url);
      const title = clean(String(o.name ?? ''));
      if (!url || !title) return;
      const offers = (Array.isArray(o.offers) ? o.offers[0] : o.offers) as Record<string, unknown> | undefined;
      const img = Array.isArray(o.image) ? o.image[0] : o.image;
      const priceValue = offers?.price ?? offers?.lowPrice;
      const price = typeof priceValue === 'number' ? priceValue : Number.parseFloat(String(priceValue ?? ''));
      out.push({
        title: title.slice(0, 300),
        url,
        image: toUrl(typeof img === 'string' ? img : (img as Record<string, unknown> | undefined)?.url),
        priceText: offers?.priceCurrency ? `${String(offers.priceCurrency)} ${String(priceValue ?? '')}` : '',
        price: Number.isFinite(price) && price > 0 ? price : null,
        priority: '',
        note: '',
        quantity: null,
      });
      return;
    }
    if (o['@graph']) visit(o['@graph'], depth + 1);
  };
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1].trim()), 0);
    } catch {
      /* Malformed JSON-LD is common; skip it. */
    }
  }
  return out;
}

/** Browser-like headers first (Amazon answers plain requests with a bot check), then our usual ones. */
async function fetchList(url: string): Promise<SafeFetchResult | { error: unknown }> {
  const deadline = Date.now() + BUDGET_MS;
  let last: SafeFetchResult | { error: unknown } = { error: new Error('No response') };
  for (const headers of [BROWSER_HEADERS, undefined]) {
    const timeoutMs = deadline - Date.now();
    if (timeoutMs < 1500) break;
    try {
      const res = await safeFetch(url, { timeoutMs, maxBytes: 3_000_000, headers });
      if (res.status < 400 && !looksBlocked(res)) return res;
      last = res;
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw error;
      last = { error };
    }
  }
  return last;
}

const siteName = (url: string) => {
  const host = new URL(url).hostname;
  return isAmazonHost(host) ? 'Amazon' : retailerFromUrl(url) || host.replace(/^www\./, '');
};

/** Read one page of the list at `url`; pass the previous result's `url` and `next` to read the rest. */
export async function importList(url: string, next?: string): Promise<ListImportResult> {
  const target = next ? amazonNextPage(next, url) : url;
  if (!target) throw new UnsafeUrlError('That page of the list could not be loaded.');
  const site = siteName(url);
  const empty = (message: string, extra: Partial<ListImportResult> = {}): ListImportResult => ({ url, site, listName: '', items: [], next: null, message, ...extra });
  const extension = `On a computer, the ${BRAND_NAME} browser extension can import it straight from the page.`;

  const res = await fetchList(target);
  if ('error' in res) return empty(`${site} didn't respond. Try again in a moment.`);
  if (looksBlocked(res)) return empty(`${site} doesn't let other websites read its lists. ${extension}`, { blocked: true });
  if (res.status === 404 || res.status === 410) return empty("That list doesn't seem to exist. Check the link and try again.");
  if (res.status >= 400) return empty(`${site} responded with an error (${res.status}). Try again in a moment.`);

  const landed = res.url;
  const amazon = isAmazonHost(new URL(landed).hostname);
  if (amazon && /\/ap\/signin|\/ax\/claim/.test(new URL(landed).pathname)) {
    return empty("That Amazon list is private. In Amazon, open the list's ⋯ menu → Manage list, set Privacy to Public or Shared, then paste the link again.");
  }
  if (amazon && /data-itemid=/i.test(res.body)) {
    const page = parseAmazonList(res.body, landed);
    return { url: next ? url : landed, site, listName: page.listName, items: importCandidates({ url: landed, items: page.items }), next: page.next };
  }
  if (next) return { url, site, listName: '', items: [], next: null };

  const items = importCandidates({ url: landed, items: parseJsonLdList(res.body, landed) });
  const title = clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(res.body)?.[1]).split(/\s[|–—:-]\s/)[0].slice(0, 80);
  if (items.length) return { url: landed, site: siteName(landed), listName: title, items, next: null };
  if (amazon) {
    return empty(
      /\/hz\/wishlist\//.test(new URL(landed).pathname)
        ? "We couldn't find any items. If the list isn't empty, make sure it's set to Public or Shared in Amazon's list settings."
        : `That doesn't look like an Amazon wish list. Open the list on Amazon and copy its link (it has /hz/wishlist/ in it). Amazon registries load their items in the browser, so for those: ${extension}`,
    );
  }
  return empty(`We couldn't find a list of items on that page. ${extension}`);
}
