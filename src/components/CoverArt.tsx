import type { CSSProperties, ReactElement } from 'react';
import type { CoverArt as CoverArtValue, CoverBackdrop, CoverFrame, CoverIcon, ListKind } from '../../shared/types';
import { CloudBank } from './Cloud';
import { FEATURE_ILLUSTRATIONS, ILLUSTRATED_ITEMS } from './ItemIllustrations';
import { COVER_ILLUSTRATIONS as C } from './CoverIllustrations';
import { defaultCoverArt } from '../../shared/constants';

const [camera, sweater, headphones, sneaker, watch, plant, book, mug] = ILLUSTRATED_ITEMS.map((i) => i.art);
const F = FEATURE_ILLUSTRATIONS;

export const COVER_ICON_ART: Record<CoverIcon, ReactElement> = {
  wishlist: C.wishlist,
  collection: F.collection,
  sparkles: C.sparkles,
  chest: C.chest,
  tree: C.tree,
  snowflake: C.snowflake,
  holly: C.holly,
  snowman: C.snowman,
  ornament: C.ornament,
  'candy-cane': C['candy-cane'],
  pumpkin: C.pumpkin,
  leaf: C.leaf,
  sun: C.sun,
  flower: C.flower,
  umbrella: C.umbrella,
  'ice-cream': C['ice-cream'],
  watermelon: C.watermelon,
  acorn: C.acorn,
  heart: C.heart,
  cake: C.cake,
  balloon: C.balloon,
  'grad-cap': C['grad-cap'],
  ring: C.ring,
  house: C.house,
  star: C.star,
  suitcase: C.suitcase,
  gift: F.surprise,
  bag: F.store,
  camera,
  headphones,
  sneaker,
  watch,
  sweater,
  plant,
  book,
  mug,
  record: C.record,
  brick: C.brick,
  controller: C.controller,
  idea: F.idea,
  plane: F.share,
};

export const COVER_ICON_LABELS: Record<CoverIcon, string> = {
  wishlist: 'Wishlist',
  collection: 'Collection (records and books)',
  sparkles: 'Sparkles',
  chest: 'Treasure chest',
  tree: 'Christmas tree',
  snowflake: 'Snowflake',
  holly: 'Holly',
  snowman: 'Snowman',
  ornament: 'Ornament',
  'candy-cane': 'Candy cane',
  pumpkin: 'Pumpkin',
  leaf: 'Autumn leaf',
  sun: 'Sunshine',
  flower: 'Flower',
  umbrella: 'Rain umbrella',
  'ice-cream': 'Ice cream',
  watermelon: 'Watermelon',
  acorn: 'Acorn',
  heart: 'Heart',
  cake: 'Birthday cake',
  balloon: 'Balloons',
  'grad-cap': 'Graduation cap',
  ring: 'Ring',
  house: 'Home',
  star: 'Star',
  suitcase: 'Suitcase',
  gift: 'Gift',
  bag: 'Shopping bag',
  camera: 'Camera',
  headphones: 'Headphones',
  sneaker: 'Sneaker',
  watch: 'Watch',
  sweater: 'Sweater',
  plant: 'Plant',
  book: 'Book',
  mug: 'Mug',
  record: 'Vinyl record',
  brick: 'Building brick',
  controller: 'Game controller',
  idea: 'Lightbulb',
  plane: 'Paper plane',
};

export const COVER_ICON_GROUPS: Array<{ label: string; icons: CoverIcon[] }> = [
  { label: 'Wishlists & collections', icons: ['gift', 'wishlist', 'sparkles', 'star', 'bag', 'collection', 'chest'] },
  { label: 'Winter holidays', icons: ['tree', 'holly', 'snowflake', 'snowman', 'ornament', 'candy-cane'] },
  { label: 'Seasons', icons: ['flower', 'umbrella', 'sun', 'ice-cream', 'watermelon', 'leaf', 'acorn', 'pumpkin', 'heart'] },
  { label: 'Celebrations', icons: ['cake', 'balloon', 'grad-cap', 'ring', 'house', 'suitcase'] },
  { label: 'Things', icons: ['camera', 'headphones', 'sneaker', 'watch', 'sweater', 'plant', 'book', 'mug', 'record', 'brick', 'controller', 'idea', 'plane'] },
];

export const COVER_BACKDROP_LABELS: Record<CoverBackdrop, string> = {
  sky: 'Blue sky',
  blush: 'Blush',
  mint: 'Mint',
  lilac: 'Lilac',
  sunset: 'Sunset',
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  snow: 'Winter',
  night: 'Starry night',
  confetti: 'Confetti',
  hearts: 'Hearts',
};

/** Picker order: cloudy pastels, then the four seasons, then the special ones. */
export const COVER_BACKDROP_ORDER: CoverBackdrop[] = [
  'sky',
  'blush',
  'mint',
  'lilac',
  'sunset',
  'spring',
  'summer',
  'autumn',
  'snow',
  'night',
  'confetti',
  'hearts',
];

const CLOUDY: CoverBackdrop[] = ['sky', 'blush', 'mint', 'lilac', 'sunset'];

export const DEFAULT_COVER_FRAME: CoverFrame = { shape: 'rounded', fill: 'glass', color: '#ffffff' };

export const COVER_FRAME_COLORS: Array<{ color: string; label: string }> = [
  { color: '#ffffff', label: 'White' },
  { color: '#fff4dc', label: 'Cream' },
  { color: '#fbd5cb', label: 'Blush' },
  { color: '#d4ecd9', label: 'Mint' },
  { color: '#d6e4fb', label: 'Sky' },
  { color: '#e3defc', label: 'Lilac' },
  { color: '#f9d976', label: 'Sunshine' },
  { color: '#e8745b', label: 'Coral' },
  { color: '#4fa3a5', label: 'Teal' },
  { color: '#3f6fb5', label: 'Blue' },
  { color: '#1f2f5c', label: 'Navy' },
  { color: '#2f3440', label: 'Charcoal' },
];

function CloudFrame() {
  const puffs = (
    <>
      <circle cx="28" cy="56" r="18" />
      <circle cx="48" cy="36" r="24" />
      <circle cx="72" cy="40" r="20" />
      <circle cx="84" cy="58" r="14" />
      <rect x="16" y="50" width="70" height="24" rx="12" />
    </>
  );
  return (
    <svg className="cover-avatar-cloud" viewBox="6 4 96 76" aria-hidden focusable="false">
      <g>
        <g className="cover-avatar-cloud-edge">{puffs}</g>
        <g fill="var(--frame-color)">{puffs}</g>
      </g>
    </svg>
  );
}

/** The list's icon in its avatar slot: floating, or in a solid or frosted tile, circle or cloud. A cover photo always fills a solid tile. */
export function CoverAvatar({ icon, frame, photo, className }: { icon: CoverIcon; frame?: CoverFrame; photo?: string | null; className?: string }) {
  const f = photo ? { ...DEFAULT_COVER_FRAME, fill: 'solid' as const } : (frame ?? DEFAULT_COVER_FRAME);
  return (
    <div
      className={['cover-avatar', `frame-${f.shape}`, f.shape !== 'none' && `frame-${f.fill}`, className].filter(Boolean).join(' ')}
      style={{ ['--frame-color' as string]: f.color }}
      aria-hidden
    >
      {!photo && f.shape === 'cloud' && <CloudFrame />}
      {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <span className="cover-avatar-art">{COVER_ICON_ART[icon] ?? COVER_ICON_ART.gift}</span>}
    </div>
  );
}

/** A sensible starting graphic for a list, based on its occasion. */
export function suggestCoverArt(occasion: string, kind: ListKind): CoverArtValue {
  const o = occasion.toLowerCase();
  const art = (icon: CoverIcon, backdrop: CoverBackdrop): CoverArtValue => ({ icon, backdrop, frame: DEFAULT_COVER_FRAME });
  if (/christmas|xmas|holiday|hanukkah|winter/.test(o)) return art('tree', 'night');
  if (/birthday|bday/.test(o)) return art('cake', 'confetti');
  if (/wedding|engage|anniversary/.test(o)) return art('ring', 'blush');
  if (/valentine/.test(o)) return art('heart', 'hearts');
  if (/graduat/.test(o)) return art('grad-cap', 'sky');
  if (/house|home|move/.test(o)) return art('house', 'mint');
  if (/halloween|autumn|fall|thanksgiving/.test(o)) return art('pumpkin', 'autumn');
  if (/spring|easter|mother/.test(o)) return art('flower', 'spring');
  if (/summer|beach|pool/.test(o)) return art('ice-cream', 'summer');
  if (/baby|shower/.test(o)) return art('balloon', 'lilac');
  if (/travel|trip|vacation/.test(o)) return art('suitcase', 'sky');
  return defaultCoverArt(kind);
}

/** [x, y, radius] in a 320×180 reference space */
const STARS: Array<[number, number, number]> = [
  [22, 24, 1.6],
  [58, 60, 1.1],
  [96, 18, 1.4],
  [142, 44, 1],
  [186, 16, 1.5],
  [214, 64, 1.1],
  [300, 92, 1.3],
  [36, 104, 1.2],
  [118, 86, 0.9],
  [258, 112, 1],
];
const FLAKES: Array<[number, number, number]> = [
  [18, 20, 3],
  [62, 52, 2.2],
  [104, 14, 2.6],
  [150, 40, 1.8],
  [206, 22, 2.8],
  [246, 58, 2],
  [292, 30, 2.6],
  [40, 92, 2],
  [120, 76, 2.4],
  [272, 96, 2.2],
  [190, 84, 1.6],
];
const CONFETTI: Array<[number, number, number, string]> = [
  [24, 26, 20, '#e8745b'],
  [70, 70, -30, '#4fa3a5'],
  [112, 22, 45, '#f2c14e'],
  [210, 30, -15, '#7c6cf0'],
  [252, 74, 30, '#e8745b'],
  [292, 28, -40, '#5b8fd6'],
  [40, 132, 60, '#f2c14e'],
  [280, 140, 10, '#4fa3a5'],
  [160, 152, -20, '#f19bb0'],
  [92, 150, 35, '#5b8fd6'],
  [232, 150, -50, '#f2c14e'],
];

/** [x, y, size (decor units), rotation, colour] */
const LEAVES: Array<[number, number, number, number, string]> = [
  [30, 40, 13, -30, '#e8745b'],
  [84, 82, 10, 40, '#f2a541'],
  [126, 18, 8, -60, '#c4553d'],
  [212, 22, 9, 20, '#f2c14e'],
  [254, 50, 12, -15, '#e98a3a'],
  [300, 96, 10, 70, '#c4553d'],
  [54, 120, 9, 110, '#f2c14e'],
  [236, 112, 9, -80, '#e8745b'],
];
const BLOSSOMS: Array<[number, number, number, string]> = [
  [32, 40, 11, '#f19bb0'],
  [86, 84, 8, '#fff'],
  [128, 20, 6.5, '#f7c4d2'],
  [214, 24, 7, '#fff'],
  [258, 46, 9, '#fff'],
  [298, 92, 11, '#f19bb0'],
  [56, 120, 7.5, '#f7c4d2'],
  [246, 114, 8, '#f7c4d2'],
];
const HEARTS: Array<[number, number, number, string]> = [
  [34, 42, 12, '#e8745b'],
  [88, 86, 8, '#fff'],
  [128, 20, 6.5, '#f19bb0'],
  [212, 24, 7, '#e8745b'],
  [256, 48, 9, '#fff'],
  [296, 94, 12, '#f19bb0'],
  [58, 122, 8, '#f19bb0'],
  [244, 116, 8, '#fff'],
];
const PETALS = [0, 1, 2, 3, 4].map((k) => {
  const a = ((k * 72 - 90) * Math.PI) / 180;
  return [4.8 * Math.cos(a), 4.8 * Math.sin(a)] as const;
});
const RAYS = Array.from({ length: 12 }, (_, k) => {
  const a = (k * 30 * Math.PI) / 180;
  return `M${(15 * Math.cos(a)).toFixed(2)} ${(15 * Math.sin(a)).toFixed(2)}L${(21 * Math.cos(a)).toFixed(2)} ${(21 * Math.sin(a)).toFixed(2)}`;
}).join('');

function starPoints(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r}L${cx + r * 0.3} ${cy - r * 0.3}L${cx + r} ${cy}L${cx + r * 0.3} ${cy + r * 0.3}L${cx} ${cy + r}L${cx - r * 0.3} ${cy + r * 0.3}L${cx - r} ${cy}L${cx - r * 0.3} ${cy - r * 0.3}Z`;
}

/**
 * Pieces are positioned in percent of the cover but sized in `--u`, 1% of the cover's
 * height or of a 16:9 box fitted to its width, whichever is smaller, so wide banners,
 * small cards and tall phone headers all get the same-looking moon, clouds and sprinkles.
 */
const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({ left: `${x / 3.2}%`, top: `${y / 1.8}%`, ...extra });
const u = (n: number) => `calc(${n} * var(--u))`;
const dot = (r: number) => `calc(${((r * 2) / 1.8).toFixed(2)} * var(--u) + 1px)`;

const CloudPiece = ({ x, y, w, className }: { x: number; y: number; w: number; className: string }) => (
  <svg className={`cover-piece cover-cloud ${className}`} style={at(x, y, { width: u(w) })} viewBox="20 8 176 96" focusable="false">
    <circle cx="52" cy="70" r="30" />
    <circle cx="92" cy="50" r="40" />
    <circle cx="140" cy="60" r="32" />
    <circle cx="172" cy="80" r="22" />
    <rect x="22" y="70" width="172" height="32" rx="16" />
  </svg>
);

const Twinkle = ({ x, y, w, delay }: { x: number; y: number; w: number; delay?: string }) => (
  <svg className="cover-piece cover-star" style={at(x, y, { width: u(w), animationDelay: delay })} viewBox="-5 -5 10 10" focusable="false">
    <path d={starPoints(0, 0, 5)} />
  </svg>
);

function Decor({ backdrop }: { backdrop: CoverBackdrop }) {
  return (
    <div className="cover-decor">
      {backdrop === 'sunset' && <span className="cover-piece cover-sun" style={at(256, 128, { width: u(44) })} />}
      {CLOUDY.includes(backdrop) && (
        <>
          <CloudPiece x={30} y={86} w={44} className="cover-cloud-a" />
          <CloudPiece x={290} y={70} w={34} className="cover-cloud-b" />
        </>
      )}
      {backdrop === 'night' && (
        <>
          <svg className="cover-piece cover-moon" style={at(268, 74, { width: u(24) })} viewBox="-1 1 40 42" focusable="false">
            <path d="M20 2a20 20 0 1 0 18 30 16 16 0 1 1-18-30z" />
          </svg>
          {STARS.map(([x, y, r], i) => (
            <span key={i} className="cover-piece cover-dot cover-star" style={at(x, y, { width: dot(r), animationDelay: `${-i * 0.7}s` })} />
          ))}
          <Twinkle x={70} y={34} w={7} />
          <Twinkle x={214} y={40} w={5.5} delay="-1.4s" />
        </>
      )}
      {backdrop === 'snow' && (
        <div className="cover-flakes">
          {FLAKES.map(([x, y, r], i) => (
            <span key={i} className="cover-piece cover-dot" style={at(x, y, { width: dot(r) })} />
          ))}
        </div>
      )}
      {backdrop === 'autumn' && (
        <div className="cover-flakes">
          {LEAVES.map(([x, y, w, rot, fill], i) => (
            <svg key={i} className="cover-piece" style={at(x, y, { width: u(w), rotate: `${rot}deg` })} viewBox="0 0 20 24" focusable="false">
              <path d="M10 1c7 5 9 12 7 17-1.5 3-4 4.5-7 5-3-.5-5.5-2-7-5C1 13 3 6 10 1z" fill={fill} />
              <path d="M10 5v18" stroke="rgba(0,0,0,.16)" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          ))}
        </div>
      )}
      {backdrop === 'spring' && (
        <div className="cover-flakes">
          {BLOSSOMS.map(([x, y, w, fill], i) => (
            <svg key={i} className="cover-piece" style={at(x, y, { width: u(w) })} viewBox="-10 -10 20 20" focusable="false">
              {PETALS.map(([cx, cy], k) => (
                <circle key={k} cx={cx} cy={cy} r="4.4" fill={fill} />
              ))}
              <circle r="2.6" fill="#f2c14e" />
            </svg>
          ))}
        </div>
      )}
      {backdrop === 'summer' && (
        <>
          <svg className="cover-piece cover-summer-sun" style={at(52, 62, { width: u(40) })} viewBox="-24 -24 48 48" focusable="false">
            <path className="cover-summer-rays" d={RAYS} stroke="#fff3b0" strokeWidth="3" strokeLinecap="round" />
            <circle r="12" fill="#ffd54f" />
            <circle r="12" fill="none" stroke="#fff3b0" strokeWidth="2" opacity=".6" />
          </svg>
          <CloudPiece x={286} y={84} w={32} className="cover-cloud-b" />
          <svg className="cover-piece cover-gull" style={at(236, 34, { width: u(9) })} viewBox="0 0 14 6" focusable="false">
            <path d="M1 5q3-4 6 0q3-4 6 0" />
          </svg>
          <svg className="cover-piece cover-gull" style={at(266, 52, { width: u(6.5) })} viewBox="0 0 14 6" focusable="false">
            <path d="M1 5q3-4 6 0q3-4 6 0" />
          </svg>
        </>
      )}
      {backdrop === 'hearts' && (
        <div className="cover-rise">
          {HEARTS.map(([x, y, w, fill], i) => (
            <svg key={i} className="cover-piece" style={at(x, y, { width: u(w) })} viewBox="0 0 20 18" focusable="false">
              <path d="M10 17.5L2.2 10A4.9 4.9 0 0 1 9.2 3.1l.8.8.8-.8A4.9 4.9 0 0 1 17.8 10z" fill={fill} />
            </svg>
          ))}
        </div>
      )}
      {backdrop === 'confetti' &&
        CONFETTI.map(([x, y, rot, fill], i) => (
          <span
            key={i}
            className={`cover-piece ${i % 3 === 2 ? 'cover-dot' : 'cover-confetti'}`}
            style={at(x, y, { background: fill, rotate: `${rot}deg`, width: u(i % 3 === 2 ? 3.8 : 6.8) })}
          />
        ))}
    </div>
  );
}

/** A list cover drawn as an illustration on a backdrop. `sm` drops the decoration for tiny thumbnails. */
export function CoverArt({
  art,
  size = 'md',
  showIcon = true,
  className,
}: {
  art: CoverArtValue;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}) {
  const showBank = size === 'md' && art.backdrop !== 'confetti';
  return (
    <div className={['cover-art', `cover-bg-${art.backdrop}`, `cover-art-${size}`, className].filter(Boolean).join(' ')} aria-hidden>
      {size === 'md' && <Decor backdrop={art.backdrop} />}
      {showBank && <CloudBank className="cover-bank" />}
      {showIcon &&
        (size === 'md' ? (
          <CoverAvatar className="cover-art-avatar" icon={art.icon} frame={art.frame} />
        ) : (
          <span className="cover-art-icon">{COVER_ICON_ART[art.icon] ?? COVER_ICON_ART.gift}</span>
        ))}
    </div>
  );
}
