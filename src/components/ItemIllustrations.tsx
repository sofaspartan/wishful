import type { ReactElement, ReactNode } from 'react';

export interface IllustratedItem {
  name: string;
  price: string;
  art: ReactElement;
}

const INK = '#2f3440';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden focusable="false">
      {children}
    </svg>
  );
}

const Camera = (
  <Svg>
    <path d="M16 14l2.5-4.5h11L32 14z" fill={INK} />
    <rect x="5" y="14" width="38" height="26" rx="6" fill={INK} />
    <circle cx="24" cy="27" r="9" fill="#eef1f5" />
    <circle cx="24" cy="27" r="5.5" fill="#5b7bb5" />
    <circle cx="22" cy="25" r="1.6" fill="#fff" opacity=".8" />
    <rect x="34" y="17.5" width="5" height="3" rx="1.2" fill="#f2c14e" />
  </Svg>
);

const Sweater = (
  <Svg>
    <path d="M18 7c1.2 2.8 3.4 4 6 4s4.8-1.2 6-4l9 4.5 4 13-6.5 2.2L35 21v19H13V21l-1.5 5.7L5 24.5l4-13z" fill="#e8745b" />
    <path d="M18 7c1.2 2.8 3.4 4 6 4s4.8-1.2 6-4" stroke="#c4553d" strokeWidth="2" strokeLinecap="round" />
    <path d="M13 36h22M6.2 21.6l6 2M41.8 21.6l-6 2" stroke="#c4553d" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const Headphones = (
  <Svg>
    <path d="M10 30v-5a14 14 0 0 1 28 0v5" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    <rect x="6" y="26" width="10" height="15" rx="5" fill="#7c6cf0" />
    <rect x="32" y="26" width="10" height="15" rx="5" fill="#7c6cf0" />
    <rect x="9" y="29" width="4" height="9" rx="2" fill="#a99ff6" />
    <rect x="35" y="29" width="4" height="9" rx="2" fill="#a99ff6" />
  </Svg>
);

const Sneaker = (
  <Svg>
    <path d="M5 34c0-7 2-14 5-17l5 3c1.5 1 3 1 4-.5l1-1.5 6 6c3 3 7 4 11 4.5 4 .5 6 2.5 6 5.5z" fill="#4fa3a5" />
    <rect x="4" y="33" width="41" height="6" rx="3" fill={INK} />
    <path d="M19 25l3-1.5M22 28l3-1.5M25 31l3-1.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const Watch = (
  <Svg>
    <rect x="17" y="4" width="14" height="12" rx="3" fill="#8a6a43" />
    <rect x="17" y="32" width="14" height="12" rx="3" fill="#8a6a43" />
    <circle cx="24" cy="24" r="12" fill={INK} />
    <circle cx="24" cy="24" r="9" fill="#fbf7ef" />
    <path d="M24 18v6l4 2.5" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    <rect x="36" y="22" width="3" height="4" rx="1" fill={INK} />
  </Svg>
);

const Plant = (
  <Svg>
    <path d="M24 30V16" stroke="#3f7d52" strokeWidth="2" strokeLinecap="round" />
    <path d="M24 22c-8 0-12-5-12-11 7 0 12 4 12 11z" fill="#5f9e6e" />
    <path d="M24 19c0-7 5-12 12-12 0 7-5 12-12 12z" fill="#76b584" />
    <path d="M14 29h20l-2.5 13a2 2 0 0 1-2 1.6h-11a2 2 0 0 1-2-1.6z" fill="#d9825b" />
    <rect x="12.5" y="27" width="23" height="5" rx="2" fill="#c46f4a" />
  </Svg>
);

const Book = (
  <Svg>
    <rect x="11" y="6" width="27" height="36" rx="3" fill="#3f6fb5" />
    <rect x="11" y="6" width="5" height="36" rx="2" fill="#335c97" />
    <rect x="20" y="13" width="13" height="3" rx="1.5" fill="#fff" opacity=".85" />
    <rect x="20" y="19" width="9" height="2.5" rx="1.25" fill="#fff" opacity=".55" />
  </Svg>
);

const Mug = (
  <Svg>
    <path d="M16 6c-2 2.5 2 3.5 0 6M23 6c-2 2.5 2 3.5 0 6" stroke="#bdbdbd" strokeWidth="2" strokeLinecap="round" />
    <path d="M31 21h3.5a5.5 5.5 0 0 1 0 11H31" stroke="#d9a62e" strokeWidth="3" />
    <rect x="9" y="17" width="23" height="24" rx="5" fill="#f2c14e" />
  </Svg>
);

/* Things people collect, for the collection scene of the hero animation. */
const Record = (
  <Svg>
    <circle cx="24" cy="24" r="19" fill={INK} />
    <circle cx="24" cy="24" r="14.5" stroke="#4a5162" strokeWidth="1" />
    <circle cx="24" cy="24" r="10.5" stroke="#4a5162" strokeWidth="1" />
    <circle cx="24" cy="24" r="6.5" fill="#e8745b" />
    <circle cx="24" cy="24" r="1.4" fill="#fff" />
    <path d="M12 15a14 14 0 0 1 7-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".25" />
  </Svg>
);

const Controller = (
  <Svg>
    <path d="M14 15h20c5 0 8 4 9 9l1.5 9c.6 3.5-3.6 5.6-6 3l-4.5-5h-20l-4.5 5c-2.4 2.6-6.6.5-6-3L5 24c1-5 4-9 9-9z" fill="#7c6cf0" />
    <path d="M13 21v8M9 25h8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="33" cy="22.5" r="2.2" fill="#f2c14e" />
    <circle cx="37.5" cy="27" r="2.2" fill="#e8745b" />
    <circle cx="28.5" cy="27" r="2.2" fill="#4fa3a5" />
  </Svg>
);

const Bricks = (
  <Svg>
    <rect x="17" y="6" width="5" height="4" rx="1" fill="#f2c14e" />
    <rect x="27" y="6" width="5" height="4" rx="1" fill="#f2c14e" />
    <rect x="14" y="9" width="21" height="11" rx="2" fill="#f2c14e" />
    <rect x="14" y="16" width="21" height="4" rx="1.5" fill="#d9a62e" />
    <rect x="7" y="20" width="6" height="4" rx="1" fill="#e8745b" />
    <rect x="37" y="20" width="6" height="4" rx="1" fill="#e8745b" />
    <rect x="5" y="23" width="39" height="17" rx="2.5" fill="#e8745b" />
    <rect x="5" y="35" width="39" height="5" rx="2" fill="#c4553d" />
  </Svg>
);

/* Things packed in a living-room box, for the box scene of the hero animation. */
const Lamp = (
  <Svg>
    <path d="M15 7h18l5 16H10z" fill="#f2c14e" />
    <path d="M17 13h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" />
    <rect x="22.5" y="23" width="3" height="14" fill={INK} />
    <rect x="14" y="37" width="20" height="5" rx="2.5" fill={INK} />
  </Svg>
);

const Frame = (
  <Svg>
    <rect x="7" y="9" width="34" height="30" rx="3" fill="#8a6a43" />
    <rect x="11" y="13" width="26" height="22" rx="1.5" fill="#cfe3f5" />
    <path d="M11 35l8-9 6 6 4-4 8 7z" fill="#5f9e6e" />
    <circle cx="30" cy="19" r="3" fill="#f2c14e" />
  </Svg>
);

const Blanket = (
  <Svg>
    <rect x="6" y="12" width="36" height="24" rx="5" fill="#4fa3a5" />
    <rect x="6" y="21" width="36" height="6" fill="#3d8688" />
    <path d="M14 12v24M24 12v24M34 12v24" stroke="#fff" strokeWidth="1.4" opacity=".35" />
    <path d="M10 36v4M16 36v4M22 36v4M28 36v4M34 36v4M40 36v4" stroke="#3d8688" strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const Candle = (
  <Svg>
    <path d="M24 4c3 4 4 6.5 4 8.5a4 4 0 0 1-8 0c0-2 1-4.5 4-8.5z" fill="#f2c14e" />
    <path d="M24 9c1.4 2 2 3.2 2 4.2a2 2 0 0 1-4 0c0-1 .6-2.2 2-4.2z" fill="#e8745b" />
    <path d="M24 16.5v3.5" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
    <rect x="15" y="20" width="18" height="23" rx="3" fill="#f3ead8" stroke="#dccfb2" strokeWidth="1.2" />
    <rect x="15" y="20" width="18" height="5" rx="2.5" fill="#e6d9bd" />
  </Svg>
);

const BoardGame = (
  <Svg>
    <rect x="4" y="12" width="31" height="25" rx="3" fill="#3f6fb5" />
    <rect x="8" y="16" width="23" height="17" rx="2" fill="#5b88cc" />
    <path d="M13 24.5h13" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
    <g transform="rotate(12 35.5 33.5)">
      <rect x="28" y="26" width="15" height="15" rx="3.5" fill="#fff" stroke="#d5dae3" strokeWidth="1.2" />
      <circle cx="31.8" cy="29.8" r="1.4" fill={INK} />
      <circle cx="35.5" cy="33.5" r="1.4" fill={INK} />
      <circle cx="39.2" cy="37.2" r="1.4" fill={INK} />
    </g>
  </Svg>
);

/* Feature illustrations: class names hook into the looping animations in layout.css. */
const ShoppingBag = (
  <Svg>
    <path d="M18 20v-6a6 6 0 0 1 12 0v6" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    <rect x="9" y="17" width="28" height="26" rx="4" fill="#e8745b" />
    <rect x="9" y="17" width="28" height="5" rx="2.5" fill="#c4553d" />
    <g className="fa-tag">
      <path d="M29 30h9l3.5 3.5L38 37h-9z" fill="#f2c14e" />
      <circle cx="31.5" cy="33.5" r="1.2" fill="#fff" />
    </g>
  </Svg>
);

const StackedLists = (
  <Svg>
    <rect className="fa-card-back" x="14" y="5" width="24" height="30" rx="4" fill="#f2c14e" />
    <rect className="fa-card-mid" x="11" y="9" width="25" height="31" rx="4" fill="#7c6cf0" />
    <rect x="10" y="12" width="26" height="31" rx="4" fill="#fff" stroke="#e3e6ec" strokeWidth="1.5" />
    <rect x="14" y="17" width="5" height="5" rx="1.5" fill="#e8745b" />
    <rect className="fa-bar" x="21" y="18.2" width="11" height="2.6" rx="1.3" fill="#c9ced8" />
    <rect x="14" y="25" width="5" height="5" rx="1.5" fill="#4fa3a5" />
    <rect className="fa-bar fa-bar-2" x="21" y="26.2" width="9" height="2.6" rx="1.3" fill="#c9ced8" />
    <rect x="14" y="33" width="5" height="5" rx="1.5" fill="#3f6fb5" />
    <rect className="fa-bar fa-bar-3" x="21" y="34.2" width="10" height="2.6" rx="1.3" fill="#c9ced8" />
  </Svg>
);

const GiftBox = (
  <Svg>
    <rect x="8" y="21" width="32" height="21" rx="3" fill="#e8745b" />
    <rect x="21" y="21" width="6" height="21" fill="#f2c14e" />
    <g className="fa-lid">
      <rect x="6" y="15" width="36" height="8" rx="2.5" fill="#c4553d" />
      <rect x="21" y="15" width="6" height="8" fill="#f2c14e" />
      <path d="M24 15c-3-6-11-7-10-2 .6 2.6 5 2.6 10 2zM24 15c3-6 11-7 10-2-.6 2.6-5 2.6-10 2z" fill="#f2c14e" />
    </g>
    <path className="fa-spark" d="M41 4l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="#7c6cf0" />
    <path className="fa-spark fa-spark-2" d="M7 6l.7 1.8 1.8.7-1.8.7L7 11l-.7-1.8-1.8-.7 1.8-.7z" fill="#4fa3a5" />
  </Svg>
);

const PaperPlane = (
  <Svg>
    <g stroke="#9fb3d9" strokeWidth="2.2" strokeLinecap="round">
      <path className="fa-speed" d="M3 31l4.5-4.5" />
      <path className="fa-speed fa-speed-2" d="M6 38.5l7-7" />
      <path className="fa-speed fa-speed-3" d="M12 44l5-5" />
    </g>
    <g className="fa-plane">
      <path d="M5 22L43 7 20 29z" fill="#7d9bd0" />
      <path d="M20 29L43 7l-9 34z" fill="#3f6fb5" />
      <path d="M20 29l2 10 4.5-5.5z" fill="#2f4f86" />
    </g>
  </Svg>
);

const People = (
  <Svg>
    <g className="fa-person-b">
      <circle cx="31" cy="15" r="6" fill="#4fa3a5" />
      <path d="M20 36c0-7 5-12 11-12s11 5 11 12v2H20z" fill="#4fa3a5" />
    </g>
    <g className="fa-person-a">
      <circle cx="18" cy="18" r="7" fill="#7c6cf0" />
      <path d="M5 42c0-8 6-14 13-14s13 6 13 14v1H5z" fill="#7c6cf0" />
    </g>
  </Svg>
);

const Phone = (
  <Svg>
    <rect x="12" y="4" width="22" height="40" rx="5" fill={INK} />
    <rect x="15" y="9" width="16" height="28" rx="2" fill="#eef1f5" />
    <rect x="20" y="40" width="6" height="1.8" rx=".9" fill="#5a6070" />
    <path className="fa-heart" d="M23 28.5l-4.6-4.4a2.9 2.9 0 0 1 4.1-4.1l.5.5.5-.5a2.9 2.9 0 0 1 4.1 4.1z" fill="#e8745b" />
    <g className="fa-plus">
      <circle cx="37" cy="10" r="5.5" fill="#5f9e6e" />
      <path d="M37 7.3v5.4M34.3 10h5.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  </Svg>
);

const Lightbulb = (
  <Svg>
    <g className="fa-rays" stroke="#f2c14e" strokeWidth="2.2" strokeLinecap="round">
      <path d="M24 2.5v3.5M10.9 7.9l2.5 2.5M37.1 7.9l-2.5 2.5M5.5 21h3.5M42.5 21H39" />
    </g>
    <path d="M24 9a12 12 0 0 0-7 21.8c1.2.9 2 2.3 2 3.8V35h10v-.4c0-1.5.8-2.9 2-3.8A12 12 0 0 0 24 9z" fill="#f2c14e" />
    <path d="M18.5 17.5a7 7 0 0 1 5-4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".8" />
    <rect x="18.5" y="35" width="11" height="3.6" rx="1.8" fill={INK} />
    <rect x="20" y="39.6" width="8" height="3.4" rx="1.7" fill={INK} />
  </Svg>
);

/** A record and books on a shelf: collections, and the default collection cover icon. */
const Shelf = (
  <Svg>
    <g className="fa-record">
      <circle cx="16" cy="27" r="12.5" fill={INK} />
      <circle cx="16" cy="27" r="9" stroke="#4a5162" strokeWidth="1" />
      <circle cx="16" cy="27" r="4.6" fill="#e8745b" />
      <circle cx="16" cy="27" r="1" fill="#fff" />
    </g>
    <rect x="24.5" y="13" width="6.5" height="28" rx="1.3" fill="#4fa3a5" />
    <rect x="24.5" y="17" width="6.5" height="2" fill="#f2c14e" />
    <rect x="24.5" y="35" width="6.5" height="2" fill="#f2c14e" />
    <rect x="31.5" y="17.5" width="5.5" height="23.5" rx="1.2" fill="#e8745b" />
    <rect x="31.5" y="21" width="5.5" height="1.6" fill="#fff" opacity=".7" />
    <rect x="37.5" y="21.5" width="5" height="19.5" rx="1.1" fill="#f2c14e" />
    <rect x="37.5" y="35.5" width="5" height="1.6" fill={INK} opacity=".55" />
    <rect x="3" y="40.5" width="42" height="3.2" rx="1.6" fill="#c9a27a" />
  </Svg>
);

/** A packed box with a QR label, scanned by a phone that lists what's inside: boxes. */
const ScannedBox = (
  <Svg>
    <rect x="4" y="21" width="30" height="22" rx="2" fill="#c8a27a" />
    <rect x="2.5" y="16" width="33" height="7" rx="2" fill="#b48a5e" />
    <rect x="16" y="16" width="6" height="12" fill="#e2c093" />
    <rect x="7" y="27" width="11.5" height="11.5" rx="1.4" fill="#fff" />
    <g fill={INK}>
      <rect x="8.6" y="28.6" width="3.4" height="3.4" rx=".6" />
      <rect x="13.5" y="28.6" width="3.4" height="3.4" rx=".6" />
      <rect x="8.6" y="33.5" width="3.4" height="3.4" rx=".6" />
      <rect x="13.6" y="33.6" width="1.4" height="1.4" />
      <rect x="15.5" y="35.5" width="1.4" height="1.4" />
    </g>
    <rect className="fa-scanline" x="7" y="27.4" width="11.5" height="1.3" rx=".65" fill="#e8745b" />
    <path className="fa-beam" d="M30 16.5L18.5 27v11.5L30 29z" fill="#4fa3a5" />
    <g className="fa-scanner">
      <rect x="29" y="7" width="16" height="26" rx="3.5" fill={INK} />
      <rect x="31" y="10" width="12" height="18.5" rx="1.5" fill="#eef1f5" />
      <rect x="32.5" y="12" width="3" height="3" rx=".8" fill="#e8745b" />
      <rect x="36.5" y="12.8" width="5" height="1.4" rx=".7" fill="#c9ced8" />
      <rect x="32.5" y="17" width="3" height="3" rx=".8" fill="#4fa3a5" />
      <rect x="36.5" y="17.8" width="4" height="1.4" rx=".7" fill="#c9ced8" />
      <rect x="32.5" y="22" width="3" height="3" rx=".8" fill="#f2c14e" />
      <rect x="36.5" y="22.8" width="4.5" height="1.4" rx=".7" fill="#c9ced8" />
    </g>
  </Svg>
);

export const FEATURE_ILLUSTRATIONS = {
  store: ShoppingBag,
  lists: StackedLists,
  surprise: GiftBox,
  share: PaperPlane,
  together: People,
  phone: Phone,
  idea: Lightbulb,
  collection: Shelf,
  boxes: ScannedBox,
};

export const ILLUSTRATED_ITEMS: IllustratedItem[] = [
  { name: 'Instant camera', price: '$129', art: Camera },
  { name: 'Merino sweater', price: '$98', art: Sweater },
  { name: 'Wireless headphones', price: '$249', art: Headphones },
  { name: 'Trail running shoes', price: '$140', art: Sneaker },
  { name: 'Field watch', price: '$245', art: Watch },
  { name: 'Fiddle-leaf fig', price: '$45', art: Plant },
  { name: 'Hardcover cookbook', price: '$32', art: Book },
  { name: 'Stoneware mug set', price: '$36', art: Mug },
];

export interface SceneItem {
  name: string;
  /** Shown at the end of the row: a price, a rating or a count. */
  meta: string;
  art: ReactElement;
}

export const COLLECTION_ITEMS: SceneItem[] = [
  { name: 'Rumours on vinyl', meta: '★★★★★', art: Record },
  { name: 'Retro controller', meta: '★★★★☆', art: Controller },
  { name: 'Space shuttle set', meta: '★★★★★', art: Bricks },
  { name: 'Court sneakers', meta: '★★★★☆', art: Sneaker },
  { name: 'Vintage film camera', meta: '★★★★★', art: Camera },
  { name: 'Diver watch', meta: '★★★★☆', art: Watch },
  { name: 'Signed first edition', meta: '★★★★★', art: Book },
  { name: 'Variegated monstera', meta: '★★★★☆', art: Plant },
];

export const BOX_ITEMS: SceneItem[] = [
  { name: 'Table lamp', meta: '×1', art: Lamp },
  { name: 'Picture frames', meta: '×3', art: Frame },
  { name: 'Paperbacks', meta: '×12', art: Book },
  { name: 'Mugs', meta: '×4', art: Mug },
  { name: 'Throw blankets', meta: '×2', art: Blanket },
  { name: 'Candles', meta: '×6', art: Candle },
  { name: 'Board games', meta: '×3', art: BoardGame },
  { name: 'Headphones', meta: '×1', art: Headphones },
];
