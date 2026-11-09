import type { Item, PublicItem } from '../../shared/types';
import { formatPrice } from '../lib/format';
import { effectivePrice } from './ItemForm';

/** Each item's value: what was paid (if visible), otherwise the listed price for every copy. */
function itemValue(item: Item | PublicItem): number | null {
  const qty = item.owned?.quantity ?? 1;
  const paid = item.owned && 'pricePaid' in item.owned ? item.owned.pricePaid : null;
  if (paid != null) return paid;
  const price = effectivePrice(item);
  return price != null ? price * qty : null;
}

export function collectionStats(items: Array<Item | PublicItem>) {
  const thisYear = String(new Date().getFullYear());
  const byCurrency = new Map<string, number>();
  let count = 0;
  let newThisYear = 0;
  let gifts = 0;
  for (const item of items) {
    const qty = item.owned?.quantity ?? 1;
    count += qty;
    if ((item.owned?.acquiredOn ?? item.createdAt).startsWith(thisYear)) newThisYear += qty;
    if (item.owned?.acquiredVia === 'gift') gifts += qty;
    const value = itemValue(item);
    if (value != null) byCurrency.set(item.currency, (byCurrency.get(item.currency) ?? 0) + value);
  }
  const [currency, total] = [...byCurrency.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return { count, newThisYear, gifts, currency, total, otherCurrencies: Math.max(byCurrency.size - 1, 0) };
}

export function CollectionStats({ items, privateValues }: { items: Array<Item | PublicItem>; privateValues?: boolean }) {
  const s = collectionStats(items);
  return (
    <dl className="collection-stats" aria-label="Collection stats">
      <div>
        <dt>Things</dt>
        <dd className="display">{s.count}</dd>
      </div>
      {s.currency && (
        <div title={privateValues ? 'What you paid, or the listed price where you didn’t say' : 'Based on listed prices'}>
          <dt>{privateValues ? 'Total value' : 'Est. value'}</dt>
          <dd className="display">
            {formatPrice(Math.round(s.total), s.currency)}
            {s.otherCurrencies > 0 && <span className="collection-stats-more"> + {s.otherCurrencies === 1 ? 'another currency' : `${s.otherCurrencies} currencies`}</span>}
          </dd>
        </div>
      )}
      <div>
        <dt>New this year</dt>
        <dd className="display">{s.newThisYear}</dd>
      </div>
      <div>
        <dt>Gifts</dt>
        <dd className="display">{s.gifts}</dd>
      </div>
    </dl>
  );
}
