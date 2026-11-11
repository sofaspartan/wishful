import { LayoutGrid, Rows3 } from 'lucide-react';

export type CardListView = 'grid' | 'list';

/** Compact segmented control to switch between card and list layouts. */
export function ViewToggle({ value, onChange, labels = 'card' }: { value: CardListView; onChange: (v: CardListView) => void; labels?: 'card' | 'grid' }) {
  const gridLabel = labels === 'card' ? 'Card view' : 'Grid view';
  return (
    <div className="segmented" role="group" aria-label="View">
      <button type="button" aria-pressed={value === 'grid'} onClick={() => onChange('grid')} title={gridLabel}>
        <LayoutGrid size={16} aria-hidden />
        <span className="sr-only">{gridLabel}</span>
      </button>
      <button type="button" aria-pressed={value === 'list'} onClick={() => onChange('list')} title="List view">
        <Rows3 size={16} aria-hidden />
        <span className="sr-only">List view</span>
      </button>
    </div>
  );
}

export const CARD_LIST_VIEWS = ['grid', 'list'] as const;
