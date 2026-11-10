import { currencyFromPriceText, parsePrice } from '../../shared/metadata';
import { CURRENCIES, LIMITS } from '../../shared/constants';
import type { Priority } from '../../shared/types';

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

/**
 * Runs inside the store's page via `chrome.scripting.executeScript`, so it must be
 * completely self-contained: no imports and no references to outer scope.
 *
 * With `deep`, it also loads the rest of the list the way a visitor would: Amazon's
 * "more items" pages, scrolling for lazy-loaded lists, "Show more" buttons, and
 * `rel=next` pages on the same site.
 */
export async function scanList(deep: boolean): Promise<ListScan> {
  const MAX_ITEMS = 500;
  const TIME_BUDGET_MS = 25_000;
  const started = Date.now();
  const outOfTime = () => Date.now() - started > TIME_BUDGET_MS;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const clean = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim();
  const toUrl = (href: string | null | undefined, base: string) => {
    if (!href || /^(javascript|mailto|tel|data):/i.test(href)) return null;
    try {
      const u = new URL(href, base);
      return /^https?:$/.test(u.protocol) ? u : null;
    } catch {
      return null;
    }
  };

  const host = location.hostname.replace(/^www\./, '');
  const SITES: Array<[RegExp, string]> = [
    [/(^|\.)amazon\.[a-z.]+$/, 'Amazon'],
    [/(^|\.)target\.com$/, 'Target'],
    [/(^|\.)walmart\.[a-z.]+$/, 'Walmart'],
    [/(^|\.)etsy\.com$/, 'Etsy'],
    [/(^|\.)bestbuy\.[a-z.]+$/, 'Best Buy'],
    [/(^|\.)ebay\.[a-z.]+$/, 'eBay'],
    [/(^|\.)kohls\.com$/, "Kohl's"],
    [/(^|\.)macys\.com$/, "Macy's"],
    [/(^|\.)wayfair\.[a-z.]+$/, 'Wayfair'],
    [/(^|\.)ikea\.com$/, 'IKEA'],
    [/(^|\.)nordstrom\.com$/, 'Nordstrom'],
    [/(^|\.)homedepot\.com$/, 'The Home Depot'],
    [/(^|\.)lowes\.com$/, "Lowe's"],
    [/(^|\.)costco\.[a-z.]+$/, 'Costco'],
    [/(^|\.)lego\.com$/, 'LEGO'],
    [/(^|\.)sephora\.[a-z.]+$/, 'Sephora'],
    [/(^|\.)ulta\.com$/, 'Ulta'],
    [/(^|\.)rei\.com$/, 'REI'],
    [/(^|\.)crateandbarrel\.com$/, 'Crate & Barrel'],
    [/(^|\.)uncommongoods\.com$/, 'Uncommon Goods'],
    [/(^|\.)barnesandnoble\.com$/, 'Barnes & Noble'],
    [/(^|\.)bookshop\.org$/, 'Bookshop.org'],
    [/(^|\.)myregistry\.com$/, 'MyRegistry'],
    [/(^|\.)zola\.com$/, 'Zola'],
    [/(^|\.)babylist\.com$/, 'Babylist'],
    [/(^|\.)giftster\.com$/, 'Giftster'],
    [/(^|\.)elfster\.com$/, 'Elfster'],
    [/(^|\.)aliexpress\.[a-z.]+$/, 'AliExpress'],
    [/(^|\.)store\.steampowered\.com$/, 'Steam'],
  ];
  const siteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
  const site = SITES.find(([re]) => re.test(host))?.[1] ?? (clean(siteName) || host);
  const isListPage = /wish|registr|gift-?list|\/lists?(\/|$|\?)|favou?rite|saved|watchlist|\/wants?(\/|$)|\/hz\/wishlist/i.test(location.pathname + location.search);

  const PRODUCT_PATHS: RegExp[] = [
    /\/(?:dp|gp\/product|gp\/aw\/d)\/[A-Z0-9]{10}/i, // Amazon
    /\/-\/A-\d{5,}/, // Target
    /\/ip\/(?:[^/]+\/)?\d{5,}/, // Walmart
    /\/site\/.+\/\d{6,8}\.p/, // Best Buy
    /[?&]skuId=\d{5,}/,
    /\/listing\/\d{5,}/, // Etsy
    /\/itm\/(?:[^/]+\/)?\d{9,}/, // eBay
    /\/products?\/[^/?#]+/, // Shopify and many others
    /\/shop\/product\//, // Macy's
    /\/prd-\d+/, // Kohl's
    /\/pdp\//i, // Wayfair and others
    /\/p\/[^/?#]+/, // IKEA, Home Depot, Target
    /\/s\/[^/]+\/\d{6,}/, // Nordstrom
    /\/item\/\d{6,}/, // AliExpress
    /\/app\/\d+/, // Steam
    /[-_/](?:sku|prod|pid|item)[-_]?\d{4,}/i,
    /\/\d{6,}\.html?$/,
    /-p-\d{4,}/i,
  ];
  // Everything else in a product link's query is tracking, which differs between links to the same product.
  const ID_PARAMS = /^(id|pid|sku|skuid|productid|product_id|itemid|item_id|variant|asin|prod_id)$/i;

  const amazonAsin = (u: URL) => /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i.exec(u.pathname)?.[1]?.toUpperCase();
  const productKey = (u: URL): string | null => {
    const asin = /(^|\.)amazon\./.test(u.hostname) ? amazonAsin(u) : undefined;
    if (asin) return `${u.origin}/dp/${asin}`;
    const etsy = /(^|\.)etsy\.com$/.test(u.hostname) ? /\/listing\/(\d+)/.exec(u.pathname)?.[1] : undefined;
    if (etsy) return `${u.origin}/listing/${etsy}`;
    if (!PRODUCT_PATHS.some((re) => re.test(u.pathname + u.search))) return null;
    const out = new URL(u.origin + u.pathname);
    u.searchParams.forEach((v, k) => {
      if (ID_PARAMS.test(k)) out.searchParams.set(k, v);
    });
    return out.href;
  };

  const BAD_IMAGE = /sprite|pixel|spacer|blank|placeholder|transparent|loading|1x1|no[-_]?image|\.svg(\?|$)|data:/i;
  const bigger = (src: string) => src.replace(/\._[A-Z0-9,_\-]+_\.(jpe?g|png|webp)/i, '.$1');
  const imageOf = (img: Element, base: string): string => {
    const srcset = (attr: string | null) => {
      const parts = (attr || '').split(',').map((p) => p.trim().split(/\s+/)[0]).filter(Boolean);
      return parts[parts.length - 1];
    };
    const picture = img.closest('picture');
    const cands = [
      img instanceof HTMLImageElement && img.ownerDocument === document ? img.currentSrc : '',
      img.getAttribute('data-src'),
      img.getAttribute('data-lazy-src'),
      img.getAttribute('data-original'),
      srcset(img.getAttribute('data-srcset')),
      srcset(img.getAttribute('srcset')),
      img.getAttribute('src'),
      picture ? srcset(picture.querySelector('source')?.getAttribute('srcset') ?? null) : '',
    ];
    for (const c of cands) {
      const u = toUrl(c, base);
      if (u && !BAD_IMAGE.test(u.href)) return bigger(u.href);
    }
    return '';
  };

  const PRICE = /(?:[$€£¥₹]\s?\d[\d.,]*|\b(?:USD|EUR|GBP|CAD|AUD)\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|kr|zł))/;
  const NOT_PRICE_TEXT = /\b(was|reg|regular|list|orig|original|compare|before|msrp|rrp|save|off|per|\/mo|month|shipping|delivery)\b/i;
  const NOT_PRICE_ATTR = /strike|line-?through|was-?price|price-?was|old|original|compare|regular|list-?price|msrp|save|discount|unit/i;
  const struck = (el: Element, card: Element) => {
    for (let e: Element | null = el; e && e !== card.parentElement; e = e.parentElement) {
      if (/^(S|DEL|STRIKE)$/.test(e.tagName)) return true;
      if (NOT_PRICE_ATTR.test(`${e.getAttribute('class') || ''} ${e.getAttribute('data-test') || ''} ${e.getAttribute('data-testid') || ''}`)) return true;
      if (e.ownerDocument === document && getComputedStyle(e).textDecorationLine.includes('line-through')) return true;
    }
    return false;
  };
  const priceIn = (card: Element): string => {
    const cands = Array.from(card.querySelectorAll('*'))
      .slice(0, 400)
      .filter((el) => {
        const t = clean(el.textContent);
        return t.length <= 40 && PRICE.test(t) && /\d/.test(t);
      });
    const innermost = cands.filter((el) => !cands.some((other) => other !== el && el.contains(other)));
    for (const el of innermost) {
      const t = clean(el.textContent);
      if (NOT_PRICE_TEXT.test(t) && !/^(now|sale|price|current price)\b/i.test(t)) continue;
      if (struck(el, card)) continue;
      return PRICE.exec(t)?.[0] ?? '';
    }
    return '';
  };

  const JUNK_TITLE =
    /^(add to (cart|bag|basket|list)|buy now|view( details)?|shop now|see (details|options)|quick (view|shop|look)|choose options|remove|move|delete|sponsored|free shipping|in stock|out of stock|sold out|new|sale|best ?seller|\d+(\.\d+)? out of 5.*|\(?\d[\d,]*\)?|\d+ reviews?)$/i;
  const usableTitle = (t: string) => t.length >= 3 && t.length <= 400 && !JUNK_TITLE.test(t) && !(PRICE.test(t) && t.length <= 20);
  // Link text often ends with the price for screen readers: "Grogu Set $79.99 Was $99.99".
  const tidy = (t: string) => clean(t.replace(/\s+(?:(?:current|sale|now|was|reg\.?|price|from)\s*:?\s*)*(?:[$€£¥₹]|USD|EUR|GBP|CAD|AUD)\s?\d[\d.,]*(?:\s.*)?$/i, ''));
  /**
   * Text with a space between elements ("Wool Cruiser" + "Natural Grey"), which textContent runs
   * together. Not innerText: that applies CSS text-transform ("MEN'S WOOL CRUISER").
   */
  const textOf = (el: Element | null | undefined): string => {
    if (!el) return '';
    const parts: string[] = [];
    const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) parts.push(walker.currentNode.nodeValue || '');
    return clean(parts.join(' '));
  };
  const titleIn = (card: Element, anchors: Element[]): string => {
    const options: string[] = [];
    for (const a of anchors) options.push(tidy(clean(a.getAttribute('aria-label'))), clean(a.getAttribute('title')));
    const texts = anchors.map((a) => tidy(textOf(a))).filter(usableTitle);
    texts.sort((x, y) => y.length - x.length);
    if (texts[0] && texts[0].length <= 200) options.push(texts[0]);
    const named = card.querySelector('h2, h3, h4, [data-automation-id*="title" i], [data-testid*="title" i], [itemprop="name"], [class*="title" i], [class*="name" i]');
    options.push(tidy(textOf(named)));
    options.push(clean(card.querySelector('img[alt]')?.getAttribute('alt')));
    if (texts[0]) options.push(texts[0]);
    return options.find(usableTitle)?.slice(0, 300) ?? '';
  };

  const EXCLUDED = 'header, footer, nav, [role="navigation"], [aria-roledescription="carousel"], [class*="carousel" i], [class*="recommend" i], [class*="sponsored" i], [id*="sponsored" i], [class*="recently-viewed" i], #rhf, [data-component-type="sp-sponsored-result"]';

  /** Generic: group product links into cards, then read each card. */
  const extractCards = (root: Document, base: string): RawListItem[] => {
    const scope = root.querySelector('main, [role="main"], #main, #content') ?? root.body;
    if (!scope) return [];
    const linkKeys: Array<[Element, string]> = [];
    for (const a of Array.from(scope.querySelectorAll('a[href]')).slice(0, 4000)) {
      if (a.closest(EXCLUDED)) continue;
      const u = toUrl(a.getAttribute('href'), base);
      const key = u && productKey(u);
      if (key) linkKeys.push([a, key]);
    }
    // Pages without recognisable product links: links with a photo whose card shows a price.
    const loose = linkKeys.length < 2;
    if (loose) {
      for (const a of Array.from(scope.querySelectorAll('a[href]')).slice(0, 4000)) {
        if (a.closest(EXCLUDED) || !a.querySelector('img')) continue;
        const u = toUrl(a.getAttribute('href'), base);
        if (!u || u.pathname.split('/').filter(Boolean).length === 0) continue;
        linkKeys.push([a, u.origin + u.pathname]);
      }
    }

    const keysUnder = new Map<Element, Set<string>>();
    for (const [a, key] of linkKeys) {
      let el: Element | null = a;
      for (let depth = 0; el && depth < 9; depth++, el = el.parentElement) {
        if (el === scope) break;
        const set = keysUnder.get(el) ?? new Set<string>();
        set.add(key);
        keysUnder.set(el, set);
      }
    }
    const cards = new Map<string, { card: Element; anchors: Element[] }>();
    for (const [a, key] of linkKeys) {
      let card: Element = a;
      let el: Element | null = a.parentElement;
      for (let depth = 0; el && depth < 8 && el !== scope; depth++, el = el.parentElement) {
        if ((keysUnder.get(el)?.size ?? 0) !== 1) break;
        card = el;
      }
      const found = cards.get(key);
      if (!found) cards.set(key, { card, anchors: [a] });
      else {
        found.anchors.push(a);
        if (card.contains(found.card)) found.card = card;
      }
    }

    const out: RawListItem[] = [];
    for (const [url, { card, anchors }] of cards) {
      const title = titleIn(card, anchors);
      if (!title) continue;
      const priceText = priceIn(card);
      if (loose && !priceText) continue;
      const imgs = Array.from(card.querySelectorAll('img')).filter((img) => {
        if (img.ownerDocument === document) {
          const r = img.getBoundingClientRect();
          if (r.width && r.width < 40) return false;
        }
        const w = Number(img.getAttribute('width'));
        return !(w && w < 40);
      });
      const image = imgs.map((img) => imageOf(img, base)).find(Boolean) ?? '';
      out.push({ title, url, image, priceText, price: null, priority: '', note: '', quantity: null });
    }
    return out;
  };

  /** JSON-LD ItemList / Product arrays that some stores include for their list pages. */
  const extractJsonLd = (root: Document, base: string): RawListItem[] => {
    const out: RawListItem[] = [];
    const visit = (node: unknown, depth: number) => {
      if (!node || typeof node !== 'object' || depth > 6 || out.length > MAX_ITEMS) return;
      if (Array.isArray(node)) return node.forEach((n) => visit(n, depth + 1));
      const o = node as Record<string, unknown>;
      const type = String(o['@type'] ?? '');
      if (/ItemList/.test(type)) return visit(o.itemListElement, depth + 1);
      if (/ListItem/.test(type) && o.item) return visit(o.item, depth + 1);
      if (/Product/.test(type) || (/ListItem/.test(type) && o.url)) {
        const u = toUrl(String(o.url ?? ''), base);
        const name = clean(String(o.name ?? ''));
        if (!u || !name) return;
        const offers = (Array.isArray(o.offers) ? o.offers[0] : o.offers) as Record<string, unknown> | undefined;
        const img = Array.isArray(o.image) ? o.image[0] : o.image;
        const priceValue = offers?.price ?? offers?.lowPrice;
        const price = typeof priceValue === 'number' ? priceValue : Number.parseFloat(String(priceValue ?? ''));
        out.push({
          title: name.slice(0, 300),
          url: productKey(u) ?? u.href,
          image: toUrl(typeof img === 'string' ? img : String((img as Record<string, unknown> | undefined)?.url ?? ''), base)?.href ?? '',
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
    root.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        visit(JSON.parse(s.textContent || ''), 0);
      } catch {
        /* Malformed JSON-LD is common; skip it. */
      }
    });
    return out;
  };

  /** Amazon wish lists and idea lists: one `li[data-itemid]` per item. */
  const extractAmazon = (root: ParentNode, base: string): RawListItem[] =>
    Array.from(root.querySelectorAll('li[data-itemid]')).flatMap((li) => {
      const id = li.getAttribute('data-itemid') || '';
      const byId = (prefix: string) => (id ? li.querySelector(`#${CSS.escape(prefix + id)}`) : null);
      const link = byId('itemName_') ?? li.querySelector('a[id^="itemName_"], h2 a, h3 a');
      const u = toUrl(link?.getAttribute('href'), base);
      const asin = /ASIN:([A-Z0-9]{10})/i.exec(li.getAttribute('data-reposition-action-params') || '')?.[1] ?? (u ? amazonAsin(u) : undefined);
      const title = clean(link?.getAttribute('title') || link?.textContent);
      if (!title) return [];
      const img = byId('itemImage_')?.querySelector('img') ?? li.querySelector('img');
      const dataPrice = Number.parseFloat(li.getAttribute('data-price') || '');
      const requested = Number.parseInt(clean(byId('itemRequested_')?.textContent), 10);
      return [
        {
          title: title.slice(0, 300),
          url: asin ? `${new URL(base).origin}/dp/${asin.toUpperCase()}` : (u?.href ?? ''),
          image: img ? imageOf(img, base) : '',
          priceText: clean(li.querySelector('.a-price .a-offscreen')?.textContent) || clean(byId('itemPrice_')?.textContent),
          price: Number.isFinite(dataPrice) && dataPrice > 0 ? dataPrice : null,
          priority: clean(byId('itemPriority_')?.textContent).toLowerCase(),
          note: clean(byId('itemComment_')?.textContent),
          quantity: Number.isInteger(requested) && requested > 0 ? requested : null,
        },
      ];
    });

  const items = new Map<string, RawListItem>();
  const add = (list: RawListItem[]) => {
    for (const item of list) {
      const key = item.url || item.title;
      const existing = items.get(key);
      if (!existing) items.set(key, item);
      else {
        for (const k of ['image', 'priceText', 'priority', 'note'] as const) if (!existing[k] && item[k]) existing[k] = item[k];
        if (existing.price === null) existing.price = item.price;
        if (existing.quantity === null) existing.quantity = item.quantity;
      }
    }
  };
  const fetchDoc = async (url: string) => {
    const res = await fetch(url, { credentials: 'include', headers: { accept: 'text/html,*/*' } });
    if (!res.ok) return null;
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  };

  const amazon = /(^|\.)amazon\./.test(host) && document.querySelector('li[data-itemid]') !== null;
  let listName = '';
  if (amazon) {
    listName = clean(document.querySelector('#profile-list-name, #wl-list-info h1, .wl-list-name')?.textContent);
    add(extractAmazon(document, location.href));
    if (deep) {
      // Amazon loads the rest of a list 10 items at a time from `showMoreUrl`.
      const seen = new Set<string>();
      let root: ParentNode = document;
      while (!outOfTime() && items.size < MAX_ITEMS && !root.querySelector('#endOfListMarker')) {
        const next = toUrl(root.querySelector('input[name="showMoreUrl"]')?.getAttribute('value'), location.href);
        if (!next || seen.has(next.href) || next.origin !== location.origin) break;
        seen.add(next.href);
        const doc = await fetchDoc(next.href).catch(() => null);
        if (!doc) break;
        const before = items.size;
        add(extractAmazon(doc, location.href));
        if (items.size === before) break;
        root = doc;
      }
    }
  } else {
    add(extractJsonLd(document, location.href));
    add(extractCards(document, location.href));
    if (deep) {
      const countLinks = () => document.querySelectorAll('a[href]').length;
      const clickLoadMore = () => {
        // Real buttons only: "View all" links usually go to another page.
        const button = Array.from(document.querySelectorAll('button')).find(
          (b) => /^(show|load|see) more( items| results| products)?$/i.test(clean(b.textContent)) && !b.closest('form, nav, header, footer'),
        );
        if (button && !button.disabled && button.type !== 'submit') button.click();
      };
      const startY = window.scrollY;
      let stable = 0;
      let last = countLinks();
      while (!outOfTime() && stable < 2 && items.size < MAX_ITEMS) {
        const scroller = document.scrollingElement ?? document.documentElement;
        for (let y = window.scrollY; y < scroller.scrollHeight - window.innerHeight && !outOfTime(); y += window.innerHeight * 0.85) {
          window.scrollTo(0, y);
          await sleep(150);
        }
        window.scrollTo(0, scroller.scrollHeight);
        clickLoadMore();
        await sleep(1000);
        add(extractCards(document, location.href));
        const now = countLinks();
        stable = now > last ? 0 : stable + 1;
        last = now;
      }
      window.scrollTo(0, startY);

      // Numbered pages on the same site.
      let pageDoc: Document = document;
      let pageUrl = location.href;
      const visited = new Set([location.href]);
      for (let page = 0; page < 10 && !outOfTime() && items.size < MAX_ITEMS; page++) {
        const next = toUrl(pageDoc.querySelector('link[rel="next"], a[rel="next"]')?.getAttribute('href'), pageUrl);
        if (!next || next.origin !== location.origin || visited.has(next.href)) break;
        visited.add(next.href);
        const doc = await fetchDoc(next.href).catch(() => null);
        if (!doc) break;
        const before = items.size;
        add(extractJsonLd(doc, next.href));
        add(extractCards(doc, next.href));
        if (items.size === before) break;
        pageDoc = doc;
        pageUrl = next.href;
      }
    }
  }

  if (!listName) {
    const h1 = clean(document.querySelector('main h1, h1')?.textContent);
    listName = (isListPage && h1.length <= 80 ? h1 : '') || clean(document.title.split(/\s[|–—-]\s/)[0]);
  }
  listName = listName.replace(/^amazon(\.[a-z.]+)?\s*:\s*/i, '').slice(0, 80);

  const all = Array.from(items.values());
  return { url: location.href, site, listName, isListPage, items: all.slice(0, MAX_ITEMS), truncated: all.length > MAX_ITEMS };
}

// ── In the popup ────────────────────────────────────────────────────────────

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

/** What the popup shows and sends, from the raw page scan. */
export function importCandidates(scan: ListScan): ImportCandidate[] {
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
