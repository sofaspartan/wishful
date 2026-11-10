/**
 * Reading Brickfolio's data the way the Brickfolio site does: the two Google
 * Sheet tabs (full_sets, wishlist), its copy of the Rebrickable catalog
 * (sets.csv) and its photo manifest (set-images.json). Pure functions, no I/O.
 */
import { parseCsv } from '../../shared/csv';
import { LIMITS } from '../../shared/constants';
import { isHttpUrl } from '../../shared/schemas';
import type { CatalogSet } from '../records';
import { SyncError, type DesiredItem, type SyncedFields } from './syncTypes';

export { SyncError };
export type { SyncedFields };

export interface SheetRow {
  setNum: string;
  theme: string;
  quantity: number;
  nameOverride: string;
  piecesOverride: number | null;
  price: number | null;
  currency: string | null;
  rating: number | null;
  review: string;
  favorite: boolean;
  favoritePart: string;
}

const amount = (raw: string): number | null => {
  const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

/** Brickfolio allows 0–5 with decimals; Wishful keeps whole stars from 1. */
export function sheetRating(raw: string): number | null {
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  const stars = Math.round(Math.max(0, Math.min(5, n)));
  return stars >= 1 ? stars : null;
}

const yes = (raw: string) => ['yes', 'y', 'true', '1'].includes(raw.trim().toLowerCase());

export function parseSheet(csv: string, tab: string): SheetRow[] {
  if (/^\s*</.test(csv)) {
    throw new SyncError(`The ${tab} link returned a web page instead of CSV. In Google Sheets, use File → Share → Publish to web, pick the ${tab} tab and choose CSV.`);
  }
  const [header, ...rows] = parseCsv(csv, ',');
  const keys = (header ?? []).map((h) => h.trim().toLowerCase());
  const col = (name: string) => keys.indexOf(name);
  const setNumIdx = col('set_num');
  if (setNumIdx < 0) throw new SyncError(`The ${tab} tab has no set_num column, so nothing was changed.`);
  const cell = (row: string[], name: string) => {
    const i = col(name);
    return i < 0 ? '' : (row[i] ?? '').trim();
  };

  const out: SheetRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const setNum = (row[setNumIdx] ?? '').trim();
    if (!setNum || seen.has(setNum)) continue;
    seen.add(setNum);
    const qty = Number.parseInt(cell(row, 'quantity'), 10);
    const pieces = Number.parseInt(cell(row, 'pieces_override'), 10);
    const currency = cell(row, 'currency').toUpperCase();
    out.push({
      setNum,
      theme: cell(row, 'theme'),
      quantity: Number.isInteger(qty) && qty >= 1 ? Math.min(qty, 9999) : 1,
      nameOverride: cell(row, 'name_override'),
      piecesOverride: Number.isInteger(pieces) && pieces > 0 ? pieces : null,
      price: amount(cell(row, 'price')),
      currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
      rating: sheetRating(cell(row, 'lego_star_rating')),
      review: cell(row, 'lego_review'),
      favorite: yes(cell(row, 'favorite_set')),
      favoritePart: cell(row, 'favorite_part'),
    });
  }
  return out;
}

/** Base set number: "31379-1" → "31379". Brickfolio keys its sheet and photos by this. */
export const baseNum = (setNum: string) => setNum.split('-')[0];

/**
 * Pick catalog rows for the wanted sheet keys. A key like "31379" matches
 * "31379-1" first, then any other "31379-n"; a key with a variant ("10696-2")
 * only matches exactly.
 */
export function pickCatalogSets(csv: string, wanted: Set<string>): Record<string, CatalogSet> {
  const [header, ...rows] = parseCsv(csv, ',');
  const keys = (header ?? []).map((h) => h.trim().toLowerCase());
  const idx = {
    setNum: keys.indexOf('set_num'),
    name: keys.indexOf('name'),
    year: keys.indexOf('year'),
    parts: keys.indexOf('num_parts'),
    img: keys.indexOf('img_url'),
  };
  if (idx.setNum < 0 || idx.name < 0) throw new SyncError("Brickfolio's sets.csv doesn't look like the set catalog it used to be, so nothing was changed.");

  const best = new Map<string, { rank: number; set: CatalogSet }>();
  for (const row of rows) {
    const setNum = (row[idx.setNum] ?? '').trim();
    if (!setNum) continue;
    const base = baseNum(setNum);
    let key: string;
    let rank: number;
    if (wanted.has(setNum)) {
      key = setNum;
      rank = 0;
    } else if (wanted.has(base)) {
      key = base;
      rank = setNum === `${base}-1` ? 1 : 2;
    } else continue;
    const current = best.get(key);
    if (current && current.rank <= rank) continue;
    const year = Number.parseInt(row[idx.year] ?? '', 10);
    const parts = Number.parseInt(row[idx.parts] ?? '', 10);
    const img = (row[idx.img] ?? '').trim();
    best.set(key, {
      rank,
      set: {
        setNum,
        name: (row[idx.name] ?? '').trim(),
        year: Number.isInteger(year) && year > 0 ? year : null,
        pieces: Number.isInteger(parts) && parts > 0 ? parts : null,
        imageUrl: isHttpUrl(img) ? img : null,
      },
    });
  }
  return Object.fromEntries([...best].map(([k, v]) => [k, v.set]));
}

/** A Brickset `getSets` response (via Brickfolio's proxy) as a catalog row, or null when it has no match. */
export function bricksetCatalogSet(json: unknown): CatalogSet | null {
  const data = json as { status?: string; sets?: Array<Record<string, unknown>> } | null;
  const set = data?.status === 'success' ? data.sets?.[0] : undefined;
  if (!set || typeof set.number !== 'string' || typeof set.name !== 'string') return null;
  const variant = Number.isInteger(set.numberVariant) ? (set.numberVariant as number) : 1;
  const image = (set.image as { imageURL?: unknown } | undefined)?.imageURL;
  return {
    setNum: `${set.number}-${variant}`,
    name: set.name.trim(),
    year: Number.isInteger(set.year) && (set.year as number) > 0 ? (set.year as number) : null,
    pieces: Number.isInteger(set.pieces) && (set.pieces as number) > 0 ? (set.pieces as number) : null,
    imageUrl: typeof image === 'string' && isHttpUrl(image) ? image : null,
  };
}

// ── Photos: the same rules as Brickfolio's set-modal.js `listingImage` ──────

/** Packaging shots: boxprod / box / boxart / _Box1 / prod. */
export const isBoxSrc = (s: string) =>
  /boxprod/i.test(s) || /(?:^|[/_-])box(?:prod|art)?(?:[/_.-]|$)/i.test(s) || /_Box\d/i.test(s) || /(?:^|[/_-])prod(?:[/_.-]|$)/i.test(s);
/** Alternate / lifestyle / close-up shots. */
export const isAltOrBuildSrc = (s: string) => /(?:^|[/_-])alt\d*(?:[/_.-]|$)/i.test(s) || /close_shot/i.test(s);
/** Cropped home-slider heroes, never a primary image. */
export const isSlideHeroSrc = (s: string) => /close_shot/i.test(s);

/** Own box photo → catalog image → own non-alternate photo → whatever is left. */
export function listingImage(catalogImage: string | null, local: string[]): string | null {
  const box = local.find(isBoxSrc);
  if (box) return box;
  if (catalogImage) return catalogImage;
  return local.find((s) => !isAltOrBuildSrc(s) && !isSlideHeroSrc(s)) ?? local[0] ?? null;
}

export type ImageManifest = Record<string, string | string[]>;

export function manifestPhotos(manifest: ImageManifest, key: string): string[] {
  const entry = manifest[baseNum(key)];
  return (Array.isArray(entry) ? entry : entry ? [entry] : []).filter((s): s is string => typeof s === 'string' && s.length > 0);
}

/** A site-relative photo path ("set images/123_alt1.png") as an absolute, encoded URL. */
export function siteAsset(siteUrl: string, path: string): string | null {
  if (isHttpUrl(path)) return path;
  try {
    const encoded = path
      .replace(/^\/+/, '')
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    const url = new URL(encoded, `${siteUrl.replace(/\/+$/, '')}/`).toString();
    return url.length <= LIMITS.url ? url : null;
  } catch {
    return null;
  }
}

// ── What each synced item should look like ──────────────────────────────────

export interface DesiredSet extends DesiredItem {
  /** `owned` is present when the set is on the full_sets tab. */
  inWishlist: boolean;
  inCatalog: boolean;
}

export interface DesiredState {
  sets: Map<string, DesiredSet>;
  /** Keys in sheet order, per tab. */
  collection: string[];
  wishlist: string[];
}

function describe(pieces: number | null, year: number | null, favoritePart: string): string {
  const facts = [pieces ? `${pieces.toLocaleString('en-US')} pieces` : '', year ? `Released ${year}` : ''].filter(Boolean).join(' · ');
  const parts = [facts, favoritePart ? `Favorite part: ${favoritePart}` : ''].filter(Boolean);
  return parts.join('\n\n').slice(0, LIMITS.description);
}

export function buildDesired(
  full: SheetRow[],
  wish: SheetRow[],
  catalog: Record<string, CatalogSet>,
  manifest: ImageManifest,
  siteUrl: string,
  defaultCurrency: string,
): DesiredState {
  const sets = new Map<string, DesiredSet>();
  const wishKeys = new Set(wish.map((r) => r.setNum));

  const build = (row: SheetRow, owned: boolean): DesiredSet => {
    const cat = catalog[row.setNum] ?? null;
    const local = manifestPhotos(manifest, row.setNum);
    const chosen = listingImage(cat?.imageUrl ?? null, local);
    const primary = chosen && chosen !== cat?.imageUrl ? siteAsset(siteUrl, chosen) : chosen;
    const gallery = [
      ...new Set([
        ...local
          .filter((p) => !isSlideHeroSrc(p))
          .map((p) => siteAsset(siteUrl, p))
          .filter((u): u is string => Boolean(u)),
        ...(cat?.imageUrl ? [cat.imageUrl] : []),
      ]),
    ]
      .filter((u) => u !== primary)
      .slice(0, 12);
    const catalogNum = cat?.setNum ?? (row.setNum.includes('-') ? row.setNum : `${row.setNum}-1`);
    const inWishlist = wishKeys.has(row.setNum);
    return {
      key: row.setNum,
      inCatalog: Boolean(cat),
      inWishlist,
      owned: owned ? { quantity: row.quantity, rating: row.rating, review: row.review.slice(0, LIMITS.review) } : null,
      fields: {
        title: (row.nameOverride || cat?.name || `LEGO set ${row.setNum}`).slice(0, LIMITS.title),
        description: describe(row.piecesOverride ?? cat?.pieces ?? null, cat?.year ?? null, owned ? row.favoritePart : ''),
        imageUrl: primary,
        gallery,
        externalUrl: inWishlist && !owned ? `https://www.lego.com/en-us/search?q=${encodeURIComponent(baseNum(row.setNum))}` : `https://brickset.com/sets/${encodeURIComponent(catalogNum)}`,
        retailer: inWishlist && !owned ? 'LEGO' : '',
        brand: 'LEGO',
        price: row.price,
        currency: row.currency ?? defaultCurrency,
        category: row.theme.slice(0, 50),
        tags: owned && row.favorite ? ['Favorite'] : [],
        model: row.setNum.slice(0, LIMITS.shortText),
      },
    };
  };

  for (const row of full) sets.set(row.setNum, build(row, true));
  for (const row of wish) if (!sets.has(row.setNum)) sets.set(row.setNum, build(row, false));
  return { sets, collection: full.map((r) => r.setNum), wishlist: wish.map((r) => r.setNum) };
}
