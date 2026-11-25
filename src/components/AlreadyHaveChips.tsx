import type { AlreadyHaveChip } from '../../shared/types';
import { ItemImage } from './ItemVisuals';

/** Compact “already owns these in the set” row on a single wishlist item. */
export function AlreadyHaveChips({ items }: { items: AlreadyHaveChip[] }) {
  if (!items.length) return null;
  return (
    <div className="already-have" aria-label="Already owns in this set">
      <span className="already-have-label">Already owns</span>
      <ul className="already-have-list">
        {items.map((chip) => (
          <li key={chip.id} className="already-have-chip" title={chip.title}>
            <span className="already-have-thumb" aria-hidden>
              <ItemImage src={chip.imageUrl} type="product" iconSize={12} />
            </span>
            <span className="already-have-title truncate">{chip.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
