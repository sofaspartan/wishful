import { useMemo, useState } from 'react';
import { LIMITS } from '../../shared/constants';
import type { Item } from '../../shared/types';
import { useItems } from '../lib/queries';
import { ItemImage } from './ItemVisuals';

/** Pick owned set-mates for one wishlist entry (series/books/collectibles). */
export function AlreadyHavePicker({
  excludeItemId,
  value,
  onChange,
}: {
  excludeItemId: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: itemsData } = useItems(true);
  const [query, setQuery] = useState('');

  const ownedChoices = useMemo(() => {
    if (!itemsData?.items) return [];
    const q = query.trim().toLowerCase();
    return itemsData.items
      .filter((i) => i.id !== excludeItemId && i.owned)
      .filter((i) => !q || i.title.toLowerCase().includes(q) || (i.brand ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [excludeItemId, itemsData, query]);

  const selectedOwned = useMemo(() => {
    if (!itemsData?.items || !value.length) return [] as Item[];
    const byId = new Map(itemsData.items.map((i) => [i.id, i]));
    return value.map((id) => byId.get(id)).filter((i): i is Item => i != null);
  }, [itemsData, value]);

  const pickerRows = useMemo(() => {
    const selected = new Set(value);
    const rest = ownedChoices.filter((i) => !selected.has(i.id));
    return [...selectedOwned, ...rest].slice(0, 40);
  }, [ownedChoices, selectedOwned, value]);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else if (value.length < LIMITS.alreadyHaveItems) onChange([...value, id]);
  };

  return (
    <div className="field">
      <span className="field-label">
        Already own in this set <span className="faint text-xs">({value.length}/{LIMITS.alreadyHaveItems})</span>
      </span>
      <p className="field-hint" style={{ marginTop: 0 }}>
        For a series or set (books, games, collectibles): tick ones you already have so nobody buys a duplicate for this wish.
      </p>
      <input
        className="input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search what you own"
        aria-label="Search owned items for this set"
        style={{ marginBottom: 8 }}
      />
      <div className="check-list already-have-picker" role="group" aria-label="Already own in this set">
        {pickerRows.length === 0 ? (
          <p className="muted text-sm" style={{ margin: '4px 0' }}>
            {query.trim()
              ? 'No owned items match.'
              : 'Mark other books/items as Got it (or keep them in a collection), then link them here for this wish.'}
          </p>
        ) : (
          pickerRows.map((item) => {
            const checked = value.includes(item.id);
            const atCap = !checked && value.length >= LIMITS.alreadyHaveItems;
            return (
              <label key={item.id} className={`check${atCap ? ' is-disabled' : ''}`}>
                <input type="checkbox" checked={checked} disabled={atCap} onChange={() => toggle(item.id)} />
                <span className="already-have-picker-thumb" aria-hidden>
                  <ItemImage src={item.imageUrl} type={item.type} iconSize={14} />
                </span>
                <span className="truncate" style={{ flex: 1 }}>
                  {item.title}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
