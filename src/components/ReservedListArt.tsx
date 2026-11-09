import { Check } from 'lucide-react';
import { FEATURE_ILLUSTRATIONS, ILLUSTRATED_ITEMS } from './ItemIllustrations';

const ROWS = [ILLUSTRATED_ITEMS[0], ILLUSTRATED_ITEMS[2], ILLUSTRATED_ITEMS[6]];

/** Decorative: a shared list whose items get reserved one by one, and a duplicate attempt that gets turned away. */
export function ReservedListArt() {
  return (
    <div className="band-art" aria-hidden>
      <span className="band-float band-float-gift">{FEATURE_ILLUSTRATIONS.surprise}</span>
      <span className="band-float band-float-item">{ILLUSTRATED_ITEMS[3].art}</span>
      <div className="band-list">
        <div className="band-list-head">
          <span className="band-list-dot" />
          <strong>Mia’s birthday</strong>
          <span className="band-list-count">{ROWS.length} items</span>
        </div>
        {ROWS.map((item, i) => (
          <div className="band-row" key={item.name}>
            <span className="band-thumb">{item.art}</span>
            <span className="band-name">{item.name}</span>
            <span className="band-pill" style={{ ['--i' as string]: i }}>
              <Check size={12} strokeWidth={3} /> Reserved
            </span>
          </div>
        ))}
        <div className="band-nudge">
          <span className="band-nudge-thumb">{ROWS[0].art}</span>
          Already reserved — pick another!
        </div>
      </div>
    </div>
  );
}
