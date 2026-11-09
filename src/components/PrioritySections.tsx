import type { ReactNode } from 'react';
import type { Priority } from '../../shared/types';
import { PRIORITY_LABELS } from '../../shared/constants';
import { groupByPriority, type PrioritySectionKey } from '../lib/priority';
import { PRIORITY_ICONS } from './ItemVisuals';
import { DragHandle, SortableList } from './Sortable';

interface Props<T> {
  /** In display order; each section keeps it. */
  rows: T[];
  idOf: (row: T) => string;
  priorityOf: (row: T) => Priority | null | undefined;
  view: 'grid' | 'list';
  renderCard: (row: T, dragHandle?: ReactNode) => ReactNode;
  /** When set, items can be dragged within their section; receives that section's new order. */
  onReorderSection?: (ids: string[]) => void;
  dragLabel?: (row: T) => string;
}

const TITLES: Record<PrioritySectionKey, string> = {
  must_have: PRIORITY_LABELS.must_have,
  really_want: PRIORITY_LABELS.really_want,
  rest: 'Everything else',
};

/** Must haves and really wants in their own highlighted sections, ahead of everything else. */
export function PrioritySections<T>({ rows, idOf, priorityOf, view, renderCard, onReorderSection, dragLabel }: Props<T>) {
  const sections = groupByPriority(rows, priorityOf);
  const className = view === 'grid' ? 'grid-items' : 'list-items';
  return (
    <div className="prio-sections">
      {sections.map((s) => {
        const Icon = s.key === 'rest' ? null : PRIORITY_ICONS[s.key];
        const byId = new Map(s.rows.map((r) => [idOf(r), r]));
        const showHeader = s.key !== 'rest' || sections.length > 1;
        return (
          <section key={s.key} className={`prio-section prio-section-${s.key}`} aria-label={TITLES[s.key]}>
            {showHeader && (
              <h2 className="prio-section-title">
                {Icon && (
                  <span className="prio-section-icon" aria-hidden>
                    <Icon />
                  </span>
                )}
                {TITLES[s.key]}
                <span className="prio-section-count">{s.rows.length}</span>
              </h2>
            )}
            {onReorderSection && s.rows.length > 1 ? (
              <SortableList
                ids={s.rows.map(idOf)}
                layout={view}
                className={className}
                onReorder={onReorderSection}
                renderItem={(id, handle) => {
                  const row = byId.get(id);
                  return row ? renderCard(row, <DragHandle handle={handle} label={dragLabel?.(row) ?? 'Reorder'} />) : null;
                }}
              />
            ) : (
              <div className={className}>
                {s.rows.map((r) => (
                  <div key={idOf(r)} style={{ minWidth: 0 }}>
                    {renderCard(r)}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
