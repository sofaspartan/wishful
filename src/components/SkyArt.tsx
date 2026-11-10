import type { CSSProperties, ReactElement } from 'react';
import { Cloud } from './Cloud';
import { FEATURE_ILLUSTRATIONS, ILLUSTRATED_ITEMS } from './ItemIllustrations';
import { COVER_ILLUSTRATIONS } from './CoverIllustrations';

export type SkyScene = 'hello' | 'wishlist' | 'collection' | 'items' | 'search' | 'friends' | 'invite' | 'shared' | 'invites' | 'gifts' | 'boxes';

const [camera, sweater, headphones, sneaker, watch, plant, book, mug] = ILLUSTRATED_ITEMS.map((i) => i.art);
const F = FEATURE_ILLUSTRATIONS;

/** [art, width %, left %, top %] — the first entry is the large centre cloud. */
const SCENES: Record<SkyScene, Array<[ReactElement, number, number, number]>> = {
  hello: [
    [F.surprise, 46, 28, 18],
    [F.collection, 30, 0, 0],
    [headphones, 28, 72, 4],
    [plant, 24, 6, 62],
    [camera, 26, 72, 64],
  ],
  wishlist: [
    [F.surprise, 52, 24, 16],
    [camera, 30, 0, 0],
    [headphones, 30, 70, 44],
  ],
  collection: [
    [F.collection, 52, 24, 16],
    [plant, 30, 0, 44],
    [book, 30, 70, 0],
  ],
  items: [
    [F.store, 52, 24, 16],
    [sneaker, 30, 0, 2],
    [watch, 30, 70, 44],
  ],
  search: [
    [F.lists, 52, 24, 16],
    [mug, 30, 0, 44],
    [book, 30, 70, 2],
  ],
  friends: [
    [F.together, 52, 24, 16],
    [F.surprise, 30, 0, 2],
    [mug, 30, 70, 44],
  ],
  invite: [
    [F.phone, 52, 24, 16],
    [F.share, 30, 0, 44],
    [plant, 30, 70, 2],
  ],
  shared: [
    [F.share, 52, 24, 16],
    [F.lists, 30, 0, 44],
    [headphones, 30, 70, 2],
  ],
  invites: [
    [F.surprise, 52, 24, 16],
    [sweater, 30, 0, 2],
    [book, 30, 70, 44],
  ],
  gifts: [
    [F.surprise, 52, 24, 16],
    [headphones, 30, 0, 44],
    [sneaker, 30, 70, 2],
  ],
  boxes: [
    [COVER_ILLUSTRATIONS.box, 52, 24, 16],
    [COVER_ILLUSTRATIONS.tote, 30, 0, 2],
    [mug, 30, 70, 44],
  ],
};

const SPARKS: Array<[number, number, number]> = [
  [18, 74, 0],
  [86, 14, -0.9],
];

/** Decorative scene of illustrated things floating in thought clouds, for empty states and the dashboard. */
export function SkyArt({ scene, className }: { scene: SkyScene; className?: string }) {
  return (
    <div className={['sky-art', `sky-art-${scene}`, className].filter(Boolean).join(' ')} aria-hidden>
      {SCENES[scene].map(([art, w, left, top], i) => (
        <span
          key={i}
          className={`sky-thought${i === 0 ? ' sky-thought-main' : ''}`}
          style={{ width: `${w}%`, left: `${left}%`, top: `${top}%`, animationDelay: `${-i * 1.3}s` } as CSSProperties}
        >
          <Cloud className="thought-cloud" />
          <span className="thought-art">{art}</span>
        </span>
      ))}
      {SPARKS.map(([left, top, delay], i) => (
        <svg key={i} className="sky-spark" viewBox="0 0 12 12" style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}>
          <path d="M6 0l1.4 4.6L12 6l-4.6 1.4L6 12 4.6 7.4 0 6l4.6-1.4z" />
        </svg>
      ))}
    </div>
  );
}
