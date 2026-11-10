/**
 * Reading a Playshelf library: rows of its `game_library` and `wishlist`
 * tables (game details come from RAWG, inside `game_data`) turned into
 * Wishful items. Pure functions, no I/O.
 */
import { LIMITS } from '../../shared/constants';
import type { Priority } from '../../shared/types';
import { SyncError, type DesiredItem } from './syncTypes';

export interface PlayshelfRow {
  /** RAWG game id, or the row id when a row has none. */
  key: string;
  rawgId: string | null;
  title: string;
  platform: string;
  genres: string[];
  released: string | null;
  metacritic: number | null;
  about: string;
  image: string | null;
  screenshots: string[];
  addedAt: string;
  // Library rows
  status: string;
  rating: number | null;
  review: string;
  pinned: boolean;
  // Wishlist rows
  priority: Priority | null;
  notes: string;
}

const STATUS_TAGS: Record<string, string> = { playing: 'Playing', completed: 'Completed', backlog: 'Backlog', dropped: 'Dropped' };
const PRIORITIES: Record<string, Priority> = { high: 'must_have', medium: 'really_want', low: 'interested' };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === 'string' && v.trim() !== 'null' ? v.trim() : typeof v === 'number' ? String(v) : '');
/** RAWG lists come as `[{ name }]`, `[{ platform: { name } }]` or plain strings. */
const names = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : str(obj(x).name) || str(obj(obj(x).platform).name))).filter(Boolean) : [];

const httpsUrl = (v: unknown): string | null => {
  const s = str(v);
  return /^https:\/\/[^\s]+$/i.test(s) && s.length <= LIMITS.url ? s : null;
};

/** RAWG serves resized copies under /media/resize/<width>/-/…; full-size photos are several MB. */
export function rawgSized(url: string, width: 640 | 1280): string {
  const m = /^https:\/\/media\.rawg\.io\/media\/(?!resize\/|crop\/)(.+)$/.exec(url);
  return m ? `https://media.rawg.io/media/resize/${width}/-/${m[1]}` : url;
}

/** One table row, or null when it has no usable name. */
export function parseRow(raw: unknown): PlayshelfRow | null {
  const r = obj(raw);
  const g = obj(r.game_data);
  const title = str(g.title) || str(g.name);
  if (!title) return null;
  const rawgId = /^\d+$/.test(str(r.game_id)) ? str(r.game_id) : /^\d+$/.test(str(g.id)) ? str(g.id) : null;
  const rowId = str(r.id);
  if (!rawgId && !rowId) return null;
  const image = httpsUrl(g.cover_image) ?? httpsUrl(g.background_image) ?? httpsUrl(g.image);
  const shots = [...(Array.isArray(g.short_screenshots) ? g.short_screenshots : []), ...(Array.isArray(g.screenshots) ? g.screenshots : [])]
    .map((s) => httpsUrl(obj(s).image))
    .filter((u): u is string => Boolean(u));
  const rating = typeof r.rating === 'number' && Number.isFinite(r.rating) ? Math.round(Math.min(5, r.rating)) : null;
  const metacritic = typeof g.metacritic === 'number' && g.metacritic > 0 ? g.metacritic : null;
  return {
    key: rawgId ?? `row:${rowId}`,
    rawgId,
    title: title.slice(0, LIMITS.title),
    platform: str(g.selected_platform) || str(r.platform) || names(g.platforms)[0] || '',
    genres: names(g.genres),
    released: /^\d{4}/.test(str(g.released)) ? str(g.released) : null,
    metacritic,
    about: str(g.description_raw) || str(g.description).replace(/<[^>]+>/g, ''),
    image,
    screenshots: [...new Set(shots)].filter((u) => u !== image),
    addedAt: str(r.added_at) || str(r.created_at) || str(r.updated_at),
    status: str(r.status).toLowerCase(),
    rating: rating !== null && rating >= 1 ? rating : null,
    review: str(r.notes).slice(0, LIMITS.review),
    pinned: r.is_pinned === true,
    priority: PRIORITIES[str(r.priority).toLowerCase()] ?? null,
    notes: str(r.notes),
  };
}

/** The rows of one table, newest first. Anything that isn't a list of rows is refused. */
export function parseRows(body: unknown, what: string): PlayshelfRow[] {
  if (!Array.isArray(body)) throw new SyncError(`Playshelf sent something unexpected for your ${what}, so nothing was changed.`);
  return body
    .map(parseRow)
    .filter((r): r is PlayshelfRow => Boolean(r))
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

/** First paragraphs of the RAWG blurb, cut at a sentence. */
function shorten(about: string, max = 1200): string {
  const text = about.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  return (end > max / 2 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`).trim();
}

function tagsFor(row: PlayshelfRow, extraPlatforms: string[], owned: boolean): string[] {
  const tags = [
    ...(owned && STATUS_TAGS[row.status] ? [STATUS_TAGS[row.status]] : []),
    ...(owned && row.pinned ? ['Favorite'] : []),
    ...extraPlatforms,
    ...row.genres,
  ]
    .map((t) => t.slice(0, LIMITS.tagLength).trim())
    .filter(Boolean);
  return [...new Set(tags)].slice(0, LIMITS.tags);
}

function itemFor(row: PlayshelfRow, currency: string, owned: { quantity: number; platforms: string[] } | null): DesiredItem {
  const facts = [row.released ? `Released ${row.released.slice(0, 4)}` : '', row.metacritic ? `Metacritic ${row.metacritic}` : ''].filter(Boolean).join(' · ');
  const extraPlatforms = (owned?.platforms ?? []).filter((p) => p !== row.platform);
  return {
    key: row.key,
    owned: owned ? { quantity: owned.quantity, rating: row.rating, review: row.review } : null,
    fields: {
      title: row.title,
      description: [facts, shorten(row.about)].filter(Boolean).join('\n\n').slice(0, LIMITS.description),
      imageUrl: row.image ? rawgSized(row.image, 640) : null,
      gallery: row.screenshots.slice(0, 8).map((u) => rawgSized(u, 1280)),
      externalUrl: row.rawgId ? `https://rawg.io/games/${row.rawgId}` : '',
      retailer: '',
      brand: '',
      price: null,
      currency,
      category: row.platform.slice(0, 50),
      tags: tagsFor(row, extraPlatforms, Boolean(owned)),
      model: '',
    },
  };
}

export interface PlayshelfDesired {
  items: Map<string, DesiredItem>;
  /** Keys per list, newest first. */
  library: string[];
  wishlist: string[];
  priorities: Map<string, Priority | null>;
  notes: Map<string, string>;
}

/**
 * Library games are owned (one item per game; owning it on two platforms makes
 * it ×2 with both platforms shown). Wishlist games that are also in the
 * library stay on the wishlist too, as on Playshelf.
 */
export function buildPlayshelfDesired(library: PlayshelfRow[], wishlist: PlayshelfRow[], currency: string): PlayshelfDesired {
  const items = new Map<string, DesiredItem>();
  const copies = new Map<string, PlayshelfRow[]>();
  for (const row of library) copies.set(row.key, [...(copies.get(row.key) ?? []), row]);
  for (const [key, rows] of copies) {
    const platforms = [...new Set(rows.map((r) => r.platform).filter(Boolean))];
    items.set(key, itemFor(rows[0], currency, { quantity: Math.min(rows.length, 9999), platforms }));
  }
  const priorities = new Map<string, Priority | null>();
  const notes = new Map<string, string>();
  const wishKeys: string[] = [];
  for (const row of wishlist) {
    if (priorities.has(row.key)) continue;
    wishKeys.push(row.key);
    priorities.set(row.key, row.priority);
    if (row.notes) notes.set(row.key, row.notes.slice(0, LIMITS.message));
    if (!items.has(row.key)) items.set(row.key, itemFor(row, currency, null));
  }
  return { items, library: [...copies.keys()], wishlist: wishKeys, priorities, notes };
}
