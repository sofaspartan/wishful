import type { ReactNode } from 'react';
import { Users } from 'lucide-react';
import type { Item, Priority, PublicItem, PublicOwnership } from '../../shared/types';
import { formatPrice } from '../lib/format';
import { ItemImage, OwnedLine, PriorityLabel } from './ItemVisuals';
import { effectivePrice } from './ItemForm';

type AnyItem = Item | PublicItem;

interface Props {
  item: AnyItem;
  priority?: Priority | null;
  /** Badge rendered over the image (e.g. reservation status). */
  status?: ReactNode;
  dimmed?: boolean;
  groupGift?: boolean;
  onOpen?: () => void;
  menu?: ReactNode;
  dragHandle?: ReactNode;
  footer?: ReactNode;
  view?: 'grid' | 'list';
  /** Show "since / gift / condition / ×n" details for an owned item. */
  owned?: PublicOwnership | null;
}

function sourceLine(item: AnyItem): string {
  if (item.type === 'experience') return item.metadata.venue || item.metadata.location || 'Experience';
  return item.retailer || item.brand || (item.type === 'idea' ? 'Idea' : item.type === 'gift_card' ? 'Gift card' : '');
}

export function ItemCard({ item, priority, status, dimmed, groupGift, onOpen, menu, dragHandle, footer, view = 'grid', owned }: Props) {
  const amount = effectivePrice(item);
  const price = formatPrice(amount, item.currency);
  const amountPrefix = item.type === 'idea' && amount !== null ? '~' : '';
  const source = sourceLine(item);

  if (view === 'list') {
    return (
      <div className="item-row">
        {onOpen && <button type="button" className="item-card-hit" onClick={onOpen} aria-label={`Open ${item.title}`} />}
        {dragHandle && <div style={{ position: 'relative', zIndex: 2 }}>{dragHandle}</div>}
        <div className="item-row-thumb">
          <ItemImage src={item.imageUrl} type={item.type} iconSize={20} />
        </div>
        <div className="item-row-main">
          <span className="item-title truncate">{item.title}</span>
          <span className="row text-sm muted" style={{ gap: 8, minWidth: 0 }}>
            {source && <span className="truncate">{source}</span>}
            {priority && <PriorityLabel priority={priority} />}
            {owned && <OwnedLine owned={owned} />}
          </span>
        </div>
        <div className="item-row-side">
          {status}
          {price && (
            <span className="item-price">
              {amountPrefix}
              {price}
            </span>
          )}
          {menu}
        </div>
      </div>
    );
  }

  return (
    <article className={`item-card${dimmed ? ' is-claimed' : ''}`}>
      {onOpen && <button type="button" className="item-card-hit" onClick={onOpen} aria-label={`Open ${item.title}`} />}
      <div className="item-media">
        <ItemImage src={item.imageUrl} type={item.type} />
        {status && <div className="item-status">{status}</div>}
        {groupGift && (
          <div className="item-overlay-tl">
            <span className="badge badge-info">
              <Users aria-hidden /> Group gift
            </span>
          </div>
        )}
        {(menu || dragHandle) && (
          <div className="item-overlay-tr">
            {dragHandle}
            {menu}
          </div>
        )}
      </div>
      <div className="item-body">
        {source && <span className="item-source truncate">{source}</span>}
        <h3 className="item-title clamp-2">{item.title}</h3>
        <div className="item-foot">
          {price && (
            <span className="item-price">
              {amountPrefix}
              {price}
            </span>
          )}
          {priority && <PriorityLabel priority={priority} />}
        </div>
        {owned && <OwnedLine owned={owned} />}
        {footer}
      </div>
    </article>
  );
}

export function ItemCardSkeleton() {
  return (
    <div className="item-card" aria-hidden>
      <div className="skeleton" style={{ aspectRatio: '1', borderRadius: 0 }} />
      <div className="item-body">
        <div className="skeleton" style={{ height: 10, width: '40%' }} />
        <div className="skeleton" style={{ height: 14, width: '85%' }} />
        <div className="skeleton" style={{ height: 14, width: '30%', marginTop: 8 }} />
      </div>
    </div>
  );
}
