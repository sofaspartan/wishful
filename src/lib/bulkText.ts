import { LIMITS } from '../../shared/constants';
import { isHttpUrl } from '../../shared/schemas';

export type BulkLine = { url: string; title?: undefined } | { url?: undefined; title: string };

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const TRAILING = /[.,;:!?)\]}>]+$/;
const BULLET = /^\s*(?:[-*•·]|\d{1,3}[.)])\s+/;

/** Split pasted text into links and plain item names (one per line; several links per line are fine). */
export function parseBulkText(text: string): BulkLine[] {
  const out: BulkLine[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(BULLET, '').trim();
    if (!line) continue;
    const urls = (line.match(URL_RE) ?? [])
      .map((u) => u.replace(TRAILING, ''))
      .map((u) => (/^www\./i.test(u) ? `https://${u}` : u))
      .filter(isHttpUrl);
    if (urls.length) {
      for (const url of urls) {
        if (seen.has(url)) continue;
        seen.add(url);
        out.push({ url });
      }
    } else {
      out.push({ title: line.slice(0, LIMITS.title) });
    }
  }
  return out;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const GENERIC_SEGMENT = /^(dp|gp|p|pd|product|products|item|items|itm|ip|shop|store|buy|s|en|us|en-us|catalog|detail|details)$/i;

/** A readable stand-in name for a link we couldn't read, e.g. ".../cozy-wool-sweater/123" → "Cozy wool sweater". */
export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split('/').filter(Boolean).reverse();
    for (const seg of segments) {
      if (GENERIC_SEGMENT.test(seg)) continue;
      const words = decodeURIComponent(seg)
        .replace(/\.(html?|php|aspx?)$/i, '')
        .split(/[-_+\s]+/)
        .filter((w) => /[a-z]/i.test(w) && !(/\d/.test(w) && w.length > 5));
      if (words.join('').length >= 4) {
        const text = words.join(' ').toLowerCase();
        return (text.charAt(0).toUpperCase() + text.slice(1)).slice(0, LIMITS.title);
      }
    }
    return `Item from ${hostOf(url)}`;
  } catch {
    return 'New item';
  }
}
