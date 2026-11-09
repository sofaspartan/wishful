import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Item, Priority, PublicItem } from '../../shared/types';
import { ACQUIRED_VIA_LABELS, CONDITION_LABELS, ITEM_TYPE_LABELS } from '../../shared/constants';
import { formatDate, formatPrice, hostname } from '../lib/format';
import { Modal } from './ui/Modal';
import { ItemImage, ItemTypeIcon, PriorityBadge } from './ItemVisuals';
import { effectivePrice } from './ItemForm';

interface Props {
  item: Item | PublicItem | null;
  onClose: () => void;
  priority?: Priority | null;
  /** Note for gift-givers from the wishlist entry. */
  entryNote?: string;
  /** Rendered below the details (claim box, owner info…). */
  children?: ReactNode;
  footer?: ReactNode;
  badges?: ReactNode;
}

export function ItemFacts({ item }: { item: Item | PublicItem }) {
  const m = item.metadata;
  const rows: Array<[string, ReactNode]> = [];
  if (item.brand) rows.push(['Brand', item.brand]);
  if (item.retailer) rows.push(['From', item.retailer]);
  if (m.model) rows.push(['Model', m.model]);
  if (m.variant) rows.push(['Variant', m.variant]);
  if (m.size) rows.push(['Size', m.size]);
  if (m.color) rows.push(['Colour', m.color]);
  if (m.venue) rows.push(['Venue', m.venue]);
  if (m.location) rows.push(['Location', m.location]);
  if (m.timeframe) rows.push(['When', m.timeframe]);
  if (item.type === 'gift_card' && m.suggestedAmount != null) rows.push(['Suggested amount', formatPrice(m.suggestedAmount, item.currency)]);
  if (item.type === 'idea' && m.budget != null) rows.push(['Budget', `~${formatPrice(m.budget, item.currency)}`]);
  if (m.instructions) rows.push(['How to give', m.instructions]);
  if (item.category) rows.push(['Category', item.category]);
  if (!rows.length) return null;
  return (
    <dl className="detail-facts">
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function OwnershipFacts({ item }: { item: Item | PublicItem }) {
  const o = item.owned;
  if (!o) return null;
  const paid = 'pricePaid' in o ? o.pricePaid : null;
  const rows: Array<[string, string]> = [];
  if (o.acquiredOn) rows.push(['Got it', formatDate(o.acquiredOn)]);
  if (o.acquiredVia) rows.push(['How', ACQUIRED_VIA_LABELS[o.acquiredVia]]);
  if (o.condition) rows.push(['Condition', CONDITION_LABELS[o.condition]]);
  if (o.quantity > 1) rows.push(['How many', String(o.quantity)]);
  if (paid != null) rows.push(['Paid', formatPrice(paid, item.currency)]);
  return (
    <div className="card owned-box">
      <div className="section-label" style={{ marginBottom: rows.length ? 6 : 0 }}>
        Owned
      </div>
      {rows.length > 0 && (
        <dl className="detail-facts">
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function ItemDetailModal({ item, onClose, priority, entryNote, children, footer, badges }: Props) {
  if (!item) return null;
  const amount = effectivePrice(item);
  const price = formatPrice(amount, item.currency);
  const notes = 'notes' in item ? item.notes : '';
  const link = item.externalUrl || item.metadata.bookingUrl || null;

  return (
    <Modal open onClose={onClose} title={item.title} size="lg" footer={footer}>
      <div className="detail-grid">
        <div className="detail-media">
          <ItemImage src={item.imageUrl} type={item.type} alt={item.title} iconSize={40} />
        </div>
        <div className="stack">
          <div className="row-wrap">
            <span className="badge badge-outline">
              <ItemTypeIcon type={item.type} size={12} /> {ITEM_TYPE_LABELS[item.type]}
            </span>
            {priority && <PriorityBadge priority={priority} />}
            {badges}
          </div>
          {price && (
            <div className="display" style={{ fontSize: 'var(--text-2xl)' }}>
              {item.type === 'idea' ? '~' : ''}
              {price}
            </div>
          )}
          {link && (
            <a className="btn btn-primary" href={link} target="_blank" rel="noopener noreferrer nofollow" style={{ alignSelf: 'flex-start' }}>
              <ExternalLink size={16} aria-hidden /> {item.type === 'experience' && !item.externalUrl ? 'Booking page' : `View on ${hostname(link) || 'site'}`}
            </a>
          )}
          {entryNote && <div className="owner-note">{entryNote}</div>}
          {item.description && (
            <p className="text-sm" style={{ whiteSpace: 'pre-line', color: 'var(--ink-2)' }}>
              {item.description}
            </p>
          )}
          <ItemFacts item={item} />
          <OwnershipFacts item={item} />
          {item.tags.length > 0 && (
            <div className="row-wrap">
              {item.tags.map((t) => (
                <span key={t} className="tag">
                  #{t}
                </span>
              ))}
            </div>
          )}
          {notes && (
            <div className="card" style={{ padding: 'var(--s-3) var(--s-4)', background: 'var(--surface-2)' }}>
              <div className="section-label" style={{ marginBottom: 4 }}>
                Private notes
              </div>
              <p className="text-sm" style={{ whiteSpace: 'pre-line' }}>
                {notes}
              </p>
            </div>
          )}
          {children}
        </div>
      </div>
    </Modal>
  );
}
