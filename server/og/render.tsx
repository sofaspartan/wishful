/**
 * Social share images (Open Graph, 1200×630), laid out with satori and
 * rasterized to PNG with resvg. Everything here is drawn from data a logged-out
 * visitor could already see on the page being shared.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ComponentType, CSSProperties, ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { CalendarDays, Gift, Library } from 'lucide-react';
import type { CoverArt, CoverBackdrop, ListKind } from '../../shared/types';
import { COVER_ICON_ART, DEFAULT_COVER_FRAME, suggestCoverArt } from '../../src/components/CoverArt';
import { ILLUSTRATED_ITEMS } from '../../src/components/ItemIllustrations';
import { brand, taglineParts } from '../../src/config/brand';
import { formatDate, initials, possessive } from '../../src/lib/format';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// ── Fonts ─────────────────────────────────────────────────────────────────

const FONT_FILES = [
  { name: 'Inter', weight: 400, file: 'inter-latin-400-normal.woff' },
  { name: 'Inter', weight: 600, file: 'inter-latin-600-normal.woff' },
  { name: 'Inter', weight: 700, file: 'inter-latin-700-normal.woff' },
  { name: 'Fraunces', weight: 600, file: 'fraunces-latin-600-normal.woff' },
] as const;

async function readFont(file: string): Promise<Buffer> {
  const roots = [process.env.LAMBDA_TASK_ROOT, process.cwd()].filter((r): r is string => Boolean(r));
  for (const root of roots) {
    try {
      return await readFile(path.join(root, 'server', 'og', 'fonts', file));
    } catch {
      /* try the next root */
    }
  }
  throw new Error(`Share-image font missing: ${file}`);
}

let fontsLoading: ReturnType<typeof loadFonts> | null = null;
async function loadFonts() {
  return Promise.all(FONT_FILES.map(async (f) => ({ name: f.name, weight: f.weight, style: 'normal' as const, data: await readFont(f.file) })));
}

export async function renderPng(node: ReactNode): Promise<Uint8Array> {
  fontsLoading ??= loadFonts().catch((err) => {
    fontsLoading = null;
    throw err;
  });
  const svg = await satori(node, { width: OG_WIDTH, height: OG_HEIGHT, fonts: await fontsLoading });
  return new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng();
}

// ── Colours and artwork ───────────────────────────────────────────────────

const INK = '#161616';
const INK_2 = '#3d3d3d';
const ACCENT = brand.colors.accent;

/** `color-mix(in srgb, a p, b)` for #rrggbb colours. */
function mix(a: string, b: string, p: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) * p + ch(b, i) * (1 - p)).toString(16).padStart(2, '0')).join('')}`;
}

/** The light-theme cover backdrops from layout.css. */
const BACKDROPS: Record<CoverBackdrop, [string, string]> = {
  sky: [mix(ACCENT, '#ffffff', 0.24), mix(ACCENT, '#ffffff', 0.09)],
  blush: [mix('#e8745b', '#ffffff', 0.28), mix('#e8745b', '#ffffff', 0.1)],
  mint: [mix('#5f9e6e', '#ffffff', 0.28), mix('#5f9e6e', '#ffffff', 0.1)],
  lilac: [mix('#7c6cf0', '#ffffff', 0.24), mix('#7c6cf0', '#ffffff', 0.08)],
  sunset: ['#f9c9b4', '#fbe0ea'],
  spring: ['#d9efce', '#fdeef3'],
  summer: ['#6fc3ee', '#c9edfb'],
  autumn: ['#f9cf9f', '#fdeedb'],
  snow: ['#1f4fa8', '#4f86d8'],
  night: ['#1d2b5a', '#344a8c'],
  confetti: ['#fff4dc', '#fdebe6'],
  hearts: ['#f9c6d2', '#fdeef2'],
};
const DARK_BACKDROPS = new Set<CoverBackdrop>(['night', 'snow']);

const svgUri = (markup: string) => `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`;

const artCache = new Map<ReactElement, string>();
/** One of the app's 48×48 illustrations as an image source. */
function artSrc(art: ReactElement): string {
  let src = artCache.get(art);
  if (!src) {
    src = svgUri(renderToStaticMarkup(art).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"'));
    artCache.set(art, src);
  }
  return src;
}

function lucideSrc(Icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>, color: string): string {
  return svgUri(renderToStaticMarkup(<Icon color={color} size={24} strokeWidth={2.2} />).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
}

const LOGO_MARK = svgUri(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M11 2.5c.55 4.3 2.7 6.45 7 7-4.3.55-6.45 2.7-7 7-.55-4.3-2.7-6.45-7-7 4.3-.55 6.45-2.7 7-7Z" fill="#fff"/><circle cx="18.5" cy="18.5" r="2" fill="#fff"/></svg>',
);

/** Deterministic pseudo-random numbers so a card looks the same every time it's drawn. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Clouds along the bottom plus the backdrop's own sprinkles, drawn as one full-card SVG. */
function decorSrc(backdrop: CoverBackdrop): string {
  const dark = DARK_BACKDROPS.has(backdrop);
  const rand = seeded(backdrop.length * 97 + backdrop.charCodeAt(0));
  const parts: string[] = [];
  if (dark) {
    for (let i = 0; i < 26; i++) {
      parts.push(`<circle cx="${(rand() * OG_WIDTH).toFixed(0)}" cy="${(rand() * 470).toFixed(0)}" r="${(1.5 + rand() * 2.2).toFixed(1)}" fill="#fff" opacity="${(0.45 + rand() * 0.5).toFixed(2)}"/>`);
    }
    for (const [x, y, r] of [[560, 70, 11], [1110, 210, 9], [1150, 440, 8], [690, 548, 7]]) {
      parts.push(`<path d="M${x} ${y - r}C${x + r * 0.15} ${y - r * 0.15} ${x + r * 0.15} ${y - r * 0.15} ${x + r} ${y}C${x + r * 0.15} ${y + r * 0.15} ${x + r * 0.15} ${y + r * 0.15} ${x} ${y + r}C${x - r * 0.15} ${y + r * 0.15} ${x - r * 0.15} ${y + r * 0.15} ${x - r} ${y}C${x - r * 0.15} ${y - r * 0.15} ${x - r * 0.15} ${y - r * 0.15} ${x} ${y - r}Z" fill="#fff" opacity=".85"/>`);
    }
  }
  if (backdrop === 'confetti') {
    const colors = ['#e8745b', '#f2c14e', '#4fa3a5', '#7c6cf0', '#5b7bb5', '#e86a92'];
    for (let i = 0; i < 34; i++) {
      const x = rand() * OG_WIDTH;
      const y = rand() * OG_HEIGHT;
      parts.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(10 + rand() * 8).toFixed(0)}" height="6" rx="2" fill="${colors[i % colors.length]}" opacity=".75" transform="rotate(${(rand() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`);
    }
  }
  if (backdrop === 'hearts') {
    for (let i = 0; i < 14; i++) {
      const x = rand() * OG_WIDTH;
      const y = rand() * 480;
      const s = 0.7 + rand() * 0.8;
      parts.push(`<path transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${s.toFixed(2)})" d="M0 6C-4-2-14 1-12 8c1 5 8 9 12 12 4-3 11-7 12-12 2-7-8-10-12-2Z" fill="#e86a92" opacity=".35"/>`);
    }
  }
  if (backdrop !== 'confetti') {
    // Opacity goes on each layer as a whole so overlapping puffs don't show seams.
    const puffs = (baseY: number, step: number, rMin: number, rMax: number, opacity: number, offset: number) => {
      const out: string[] = [];
      for (let x = -40 + offset; x < OG_WIDTH + 80; x += step) {
        out.push(`<circle cx="${x}" cy="${baseY}" r="${(rMin + rand() * (rMax - rMin)).toFixed(0)}"/>`);
      }
      out.push(`<rect x="0" y="${baseY}" width="${OG_WIDTH}" height="${OG_HEIGHT - baseY}"/>`);
      return `<g fill="#fff" opacity="${opacity}">${out.join('')}</g>`;
    };
    parts.push(puffs(OG_HEIGHT - 8, 96, 30, 44, dark ? 0.1 : 0.55, 34));
    parts.push(puffs(OG_HEIGHT + 10, 86, 24, 34, dark ? 0.14 : 1, 0));
  }
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">${parts.join('')}</svg>`);
}

/** Share images can't show emoji or other scripts the bundled fonts lack; drop pictographs rather than draw boxes. */
export function plainText(text: string, max: number): string {
  const clean = text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function titleSize(title: string): number {
  if (title.length <= 14) return 86;
  if (title.length <= 22) return 74;
  if (title.length <= 34) return 62;
  return 52;
}

// ── Building blocks ───────────────────────────────────────────────────────

function Card({ background, backdrop, children }: { background: string; backdrop: CoverBackdrop | null; children: ReactNode }) {
  return (
    <div style={{ width: OG_WIDTH, height: OG_HEIGHT, display: 'flex', position: 'relative', background, fontFamily: 'Inter', color: INK }}>
      {backdrop && <img src={decorSrc(backdrop)} width={OG_WIDTH} height={OG_HEIGHT} style={{ position: 'absolute', left: 0, top: 0 }} />}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flexGrow: 1, padding: '50px 64px 38px' }}>{children}</div>
    </div>
  );
}

function Logo({ dark }: { dark: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 50, height: 50, borderRadius: 14, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={LOGO_MARK} width={31} height={31} />
      </div>
      <span style={{ fontFamily: 'Fraunces', fontWeight: 600, fontSize: 38, letterSpacing: -0.5, color: dark ? '#fff' : INK }}>{brand.name}</span>
    </div>
  );
}

function Pill({ dark, icon, children, strong }: { dark: boolean; icon?: string; children: ReactNode; strong?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: icon ? '10px 20px 10px 16px' : '10px 20px',
        borderRadius: 999,
        background: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)',
        border: `2px solid ${dark ? 'rgba(255,255,255,0.24)' : 'rgba(22,22,22,0.07)'}`,
        fontSize: 24,
        fontWeight: strong ? 700 : 600,
        color: dark ? '#fff' : INK_2,
      }}
    >
      {icon && <img src={icon} width={24} height={24} />}
      <span>{children}</span>
    </div>
  );
}

function Avatar({ name, src, size }: { name: string; src: string | null; size: number }) {
  const ring: CSSProperties = { border: `${Math.max(3, size / 22)}px solid #fff`, boxShadow: '0 8px 22px rgba(20,30,60,0.18)' };
  if (src) return <img src={src} width={size} height={size} style={{ borderRadius: size / 2, objectFit: 'cover', ...ring }} />;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: mix(ACCENT, '#ffffff', 0.2),
        color: brand.colors.accentInk,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 700,
        ...ring,
      }}
    >
      {initials(name) || '?'}
    </div>
  );
}

/** The list's icon in its frame, or its cover photo — as on the list page. */
function IconTile({ art, photo, size, style }: { art: CoverArt; photo: string | null; size: number; style?: CSSProperties }) {
  const frame = art.frame ?? DEFAULT_COVER_FRAME;
  const radius = frame.shape === 'circle' ? size / 2 : size * 0.26;
  const shadow = '0 22px 46px rgba(20,30,60,0.22)';
  if (photo) {
    return <img src={photo} width={size} height={size} style={{ borderRadius: radius, objectFit: 'cover', border: '5px solid #fff', boxShadow: shadow, ...style }} />;
  }
  const framed = frame.shape !== 'none';
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
        ...(framed && frame.fill === 'solid' ? { background: frame.color, boxShadow: shadow } : {}),
        ...(framed && frame.fill !== 'solid' ? { background: 'rgba(255,255,255,0.62)', border: '4px solid rgba(255,255,255,0.9)', boxShadow: shadow } : {}),
        ...style,
      }}
    >
      <img src={artSrc(COVER_ICON_ART[art.icon] ?? COVER_ICON_ART.gift)} width={size * 0.68} height={size * 0.68} />
    </div>
  );
}

const FAN: Record<number, Array<{ left: number; top: number; size: number; rotate: number }>> = {
  1: [{ left: 70, top: 40, size: 320, rotate: -4 }],
  2: [
    { left: 10, top: 90, size: 260, rotate: -8 },
    { left: 170, top: 30, size: 260, rotate: 6 },
  ],
  3: [
    { left: 0, top: 150, size: 230, rotate: -10 },
    { left: 210, top: 150, size: 230, rotate: 9 },
    { left: 100, top: 10, size: 240, rotate: -2 },
  ],
};

/** Up to three photos as white cards fanned out on the table. */
function PhotoFan({ srcs }: { srcs: string[] }) {
  const slots = FAN[srcs.length] ?? FAN[3];
  return (
    <>
      {srcs.slice(0, 3).map((src, i) => {
        const s = slots[i];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              display: 'flex',
              padding: 12,
              background: '#fff',
              borderRadius: 30,
              boxShadow: '0 26px 54px rgba(20,30,60,0.24)',
              transform: `rotate(${s.rotate}deg)`,
            }}
          >
            <img src={src} width={s.size - 24} height={s.size - 24} style={{ objectFit: 'cover', borderRadius: 20 }} />
          </div>
        );
      })}
    </>
  );
}

// ── Cards ─────────────────────────────────────────────────────────────────

export interface ListCardData {
  title: string;
  kind: ListKind;
  ownerName: string;
  ownerAvatar: string | null;
  coverArt: CoverArt | null;
  coverPhoto: string | null;
  occasion: string;
  eventDate: string | null;
  itemCount: number;
  thumbs: string[];
  canReserve: boolean;
  host: string;
}

export function ListCard(d: ListCardData) {
  const collection = d.kind === 'collection';
  const art = d.coverArt ?? suggestCoverArt(d.occasion, d.kind);
  const backdrop = d.coverPhoto ? 'sky' : art.backdrop;
  const dark = DARK_BACKDROPS.has(backdrop);
  const [top, bottom] = BACKDROPS[backdrop] ?? BACKDROPS.sky;
  const title = plainText(d.title, 64) || (collection ? 'A collection' : 'A wishlist');
  const chipInk = dark ? '#ffffff' : INK_2;
  const date = d.eventDate ? formatDate(d.eventDate, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const occasion = plainText(d.occasion, 28);
  const count = `${d.itemCount} ${collection ? (d.itemCount === 1 ? 'thing' : 'things') : d.itemCount === 1 ? 'item' : 'items'}`;
  const footer = collection ? `Browse the collection on ${brand.name}` : d.canReserve ? 'Reserve a gift so nobody doubles up' : `See the list on ${brand.name}`;

  return (
    <Card background={`linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`} backdrop={backdrop}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo dark={dark} />
        <Pill dark={dark} icon={lucideSrc(collection ? Library : Gift, chipInk)}>
          {collection ? 'Collection' : 'Wishlist'}
        </Pill>
      </div>

      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 36 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 24, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              alignSelf: 'flex-start',
              padding: '6px 22px 6px 6px',
              borderRadius: 999,
              background: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.85)',
              border: `2px solid ${dark ? 'rgba(255,255,255,0.24)' : 'rgba(22,22,22,0.07)'}`,
            }}
          >
            <Avatar name={d.ownerName} src={d.ownerAvatar} size={52} />
            <span style={{ fontSize: 27, fontWeight: 600, color: dark ? '#fff' : INK }}>
              {plainText(possessive(d.ownerName), 30)} {collection ? 'collection' : 'wishlist'}
            </span>
          </div>
          <div style={{ display: 'flex', fontFamily: 'Fraunces', fontWeight: 600, fontSize: titleSize(title), lineHeight: 1.04, letterSpacing: -1, color: dark ? '#fff' : INK }}>
            {title}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {(date || occasion) && (
              <Pill dark={dark} icon={lucideSrc(CalendarDays, chipInk)}>
                {[occasion, date].filter(Boolean).join(' · ')}
              </Pill>
            )}
            <Pill dark={dark}>{count}</Pill>
          </div>
        </div>

        <div style={{ display: 'flex', position: 'relative', width: 450, height: 430, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
          {d.thumbs.length > 0 ? (
            <>
              <PhotoFan srcs={d.thumbs} />
              <IconTile art={art} photo={d.coverPhoto} size={124} style={{ position: 'absolute', left: -14, top: d.thumbs.length === 3 ? 0 : 296 }} />
            </>
          ) : (
            <IconTile art={art} photo={d.coverPhoto} size={300} />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 600, color: dark ? 'rgba(255,255,255,0.85)' : INK_2 }}>
        <span>{footer}</span>
        <span>{d.host}</span>
      </div>
    </Card>
  );
}

export interface ProfileCardData {
  name: string;
  username: string;
  avatar: string | null;
  bio: string;
  lists: Array<{ title: string; kind: ListKind; coverArt: CoverArt | null; coverPhoto: string | null; occasion: string }>;
  host: string;
}

function MiniList({ list, style }: { list: ProfileCardData['lists'][number]; style: CSSProperties }) {
  const art = list.coverArt ?? suggestCoverArt(list.occasion, list.kind);
  const [top, bottom] = BACKDROPS[art.backdrop] ?? BACKDROPS.sky;
  return (
    <div
      style={{
        position: 'absolute',
        width: 240,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 12,
        background: '#fff',
        borderRadius: 30,
        boxShadow: '0 26px 54px rgba(20,30,60,0.22)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 170, borderRadius: 20, background: `linear-gradient(180deg, ${top}, ${bottom})` }}>
        {list.coverPhoto ? (
          <img src={list.coverPhoto} width={216} height={170} style={{ objectFit: 'cover', borderRadius: 20 }} />
        ) : (
          <img src={artSrc(COVER_ICON_ART[art.icon] ?? COVER_ICON_ART.gift)} width={112} height={112} />
        )}
      </div>
      <span style={{ fontSize: 22, fontWeight: 600, padding: '0 6px 4px', color: INK }}>{plainText(list.title, 20)}</span>
    </div>
  );
}

export function ProfileCard(d: ProfileCardData) {
  const [top, bottom] = BACKDROPS.sky;
  const lists = d.lists.slice(0, 3);
  const spots: CSSProperties[] = [
    { left: 0, top: 120, transform: 'rotate(-9deg)' },
    { left: 200, top: 130, transform: 'rotate(8deg)' },
    { left: 100, top: 0, transform: 'rotate(-2deg)' },
  ];
  const listCount = d.lists.length;
  return (
    <Card background={`linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`} backdrop="sky">
      <Logo dark={false} />
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 36 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 22, minWidth: 0 }}>
          <Avatar name={d.name} src={d.avatar} size={132} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: 'Fraunces', fontWeight: 600, fontSize: titleSize(d.name) - 4, lineHeight: 1.05, letterSpacing: -1 }}>{plainText(d.name, 40)}</span>
            <span style={{ fontSize: 26, fontWeight: 600, color: INK_2 }}>@{d.username}</span>
          </div>
          {d.bio && <span style={{ fontSize: 25, lineHeight: 1.35, color: INK_2, maxWidth: 560 }}>{plainText(d.bio, 110)}</span>}
          <div style={{ display: 'flex' }}>
            <Pill dark={false} icon={lucideSrc(Gift, INK_2)}>
              {listCount ? `${listCount} public ${listCount === 1 ? 'list' : 'lists'}` : `On ${brand.name}`}
            </Pill>
          </div>
        </div>
        <div style={{ display: 'flex', position: 'relative', width: 450, height: 430, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
          {lists.length ? (
            lists.map((l, i) => <MiniList key={i} list={l} style={lists.length === 1 ? { left: 105, top: 60, transform: 'rotate(-4deg)' } : spots[i]} />)
          ) : (
            <IconTile art={suggestCoverArt('', 'wishlist')} photo={null} size={300} />
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 22, fontWeight: 600, color: INK_2 }}>
        <span>{d.host}</span>
      </div>
    </Card>
  );
}

/** The brand card for the landing page and anything without its own. */
export function SiteCard({ host }: { host: string }) {
  const [top, bottom] = BACKDROPS.sky;
  const picks = [ILLUSTRATED_ITEMS[0], ILLUSTRATED_ITEMS[2], ILLUSTRATED_ITEMS[5]];
  const spots: CSSProperties[] = [
    { left: 0, top: 150, transform: 'rotate(-9deg)' },
    { left: 215, top: 160, transform: 'rotate(8deg)' },
    { left: 105, top: 0, transform: 'rotate(-2deg)' },
  ];
  const tiles = ['#eef3fd', '#fdf1ec', '#eef7ef'];
  return (
    <Card background={`linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`} backdrop="sky">
      <Logo dark={false} />
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 36 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 26 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Fraunces', fontWeight: 600, fontSize: 60, lineHeight: 1.06, letterSpacing: -1.2 }}>
            <span>{taglineParts[0].trim()}</span>
            <span style={{ color: ACCENT }}>{taglineParts[1]}</span>
          </div>
          <span style={{ fontSize: 27, lineHeight: 1.4, color: INK_2, maxWidth: 560 }}>{brand.description}</span>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', padding: '16px 30px', borderRadius: 999, background: INK, color: '#fff', fontSize: 25, fontWeight: 600 }}>
              Start your wishlist — it’s free
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', position: 'relative', width: 450, height: 440, flexShrink: 0 }}>
          {picks.map((item, i) => (
            <div
              key={item.name}
              style={{
                position: 'absolute',
                width: 240,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: 12,
                background: '#fff',
                borderRadius: 30,
                boxShadow: '0 26px 54px rgba(20,30,60,0.2)',
                ...spots[i],
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 168, borderRadius: 20, background: tiles[i], marginBottom: 6 }}>
                <img src={artSrc(item.art)} width={118} height={118} />
              </div>
              <span style={{ fontSize: 21, fontWeight: 600, padding: '0 6px' }}>{item.name}</span>
              <span style={{ fontSize: 20, color: INK_2, padding: '0 6px 4px' }}>{item.price}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 22, fontWeight: 600, color: INK_2 }}>
        <span>{host}</span>
      </div>
    </Card>
  );
}
