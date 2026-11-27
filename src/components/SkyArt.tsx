import type { CSSProperties, ReactElement } from 'react';
import { Cloud } from './Cloud';
import { FEATURE_ILLUSTRATIONS, ILLUSTRATED_ITEMS } from './ItemIllustrations';
import { COVER_ILLUSTRATIONS } from './CoverIllustrations';

export type SkyScene =
  | 'hello'
  | 'wishlist'
  | 'collection'
  | 'items'
  | 'search'
  | 'friends'
  | 'invite'
  | 'shared'
  | 'invites'
  | 'gifts'
  | 'boxes'
  | 'favorites';

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
    [F.surprise, 62, 20, 14],
    [camera, 34, -4, 40],
    [headphones, 34, 68, 8],
  ],
  collection: [
    [F.collection, 62, 20, 14],
    [plant, 34, -4, 40],
    [book, 34, 68, 8],
  ],
  items: [
    [F.store, 62, 20, 14],
    [sneaker, 34, -4, 8],
    [watch, 34, 68, 40],
  ],
  search: [
    [F.lists, 62, 20, 14],
    [mug, 34, -4, 40],
    [book, 34, 68, 8],
  ],
  friends: [
    [F.together, 62, 20, 14],
    [F.surprise, 34, -4, 8],
    [mug, 34, 68, 40],
  ],
  invite: [
    [F.phone, 62, 20, 14],
    [F.share, 34, -4, 40],
    [plant, 34, 68, 8],
  ],
  shared: [
    [F.share, 62, 20, 14],
    [F.lists, 34, -4, 40],
    [headphones, 34, 68, 8],
  ],
  invites: [
    [F.surprise, 62, 20, 14],
    [sweater, 34, -4, 8],
    [book, 34, 68, 40],
  ],
  gifts: [
    [F.surprise, 62, 20, 14],
    [headphones, 34, -4, 40],
    [sneaker, 34, 68, 8],
  ],
  boxes: [
    [COVER_ILLUSTRATIONS.box, 62, 20, 14],
    [COVER_ILLUSTRATIONS.tote, 34, -4, 8],
    [mug, 34, 68, 40],
  ],
  favorites: [
    [COVER_ILLUSTRATIONS.star, 62, 20, 14],
    [COVER_ILLUSTRATIONS.heart, 34, -4, 8],
    [F.surprise, 34, 68, 40],
  ],
};

const SPARKS: Array<[number, number, number]> = [
  [18, 74, 0],
  [86, 14, -0.9],
];

/** Soft silhouette clouds behind the illustrated ones — own positions, not shadow copies. */
const SILHOUETTES: Array<[number, number, number]> = [
  [42, -10, 8],
  [36, 58, -12],
  [40, 72, 42],
  [34, 4, 56],
];

/** Decorative scene of illustrated things floating in thought clouds, for empty states and the dashboard. */
export function SkyArt({ scene, className }: { scene: SkyScene; className?: string }) {
  return (
    <div className={['sky-art', `sky-art-${scene}`, className].filter(Boolean).join(' ')} aria-hidden>
      <div className="sky-art-sils">
        {SILHOUETTES.map(([w, left, top], i) => (
          <span
            key={i}
            className="sky-thought sky-thought-sil"
            style={{ width: `${w}%`, left: `${left}%`, top: `${top}%`, animationDelay: `${-i * 1.7 - 0.4}s` } as CSSProperties}
          >
            <Cloud className="thought-cloud" />
          </span>
        ))}
      </div>
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
