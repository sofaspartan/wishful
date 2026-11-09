import type { Priority } from '../../shared/types';

export type PrioritySectionKey = 'must_have' | 'really_want' | 'rest';

export interface PrioritySection<T> {
  key: PrioritySectionKey;
  rows: T[];
}

export const isTopPriority = (p: Priority | null | undefined): p is 'must_have' | 'really_want' => p === 'must_have' || p === 'really_want';

/** Must haves, then really wants, then everything else — each keeping the list's own order. Empty sections are dropped. */
export function groupByPriority<T>(rows: T[], priorityOf: (row: T) => Priority | null | undefined): PrioritySection<T>[] {
  const buckets: Record<PrioritySectionKey, T[]> = { must_have: [], really_want: [], rest: [] };
  for (const row of rows) {
    const p = priorityOf(row);
    buckets[isTopPriority(p) ? p : 'rest'].push(row);
  }
  return (['must_have', 'really_want', 'rest'] as const).map((key) => ({ key, rows: buckets[key] })).filter((s) => s.rows.length > 0);
}

/** Put a reordered section back into the full order, leaving every other item in its place. */
export function mergeSectionOrder(all: string[], section: string[]): string[] {
  const inSection = new Set(section);
  let next = 0;
  return all.map((id) => (inSection.has(id) ? section[next++] : id));
}
