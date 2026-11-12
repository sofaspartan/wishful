import { useEffect, useState, type ReactNode } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { Item, Priority, PublicItem } from '../../shared/types';
import { ACQUIRED_VIA_LABELS, CONDITION_LABELS, ITEM_TYPE_LABELS } from '../../shared/constants';
import { formatDate, formatPrice, hostname } from '../lib/format';
import { Modal } from './ui/Modal';
import { ItemImage, ItemTypeIcon, PriorityBadge, Stars } from './ItemVisuals';
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
      {(o.rating || o.review) && (
        <div style={{ marginTop: rows.length ? 'var(--s-3)' : 6 }}>
          {o.rating ? <Stars value={o.rating} size={16} /> : null}
          {o.review && <p className="review-text">{o.review}</p>}
        </div>
      )}
    </div>
  );
}

/** Main photo plus thumbnails of the other photos (synced sets bring their own). */
function DetailMedia({ item }: { item: Item | PublicItem }) {
  const photos = [...(item.imageUrl ? [item.imageUrl] : []), ...(item.source?.gallery ?? [])];
  const [shown, setShown] = useState(0);
  useEffect(() => setShown(0), [item.id]);
  return (
    <div className="detail-media-wrap">
      <div className="detail-media">
        <ItemImage src={photos[shown] ?? item.imageUrl} type={item.type} alt={item.title} iconSize={40} />
      </div>
      {photos.length > 1 && (
        <div className="detail-thumbs" role="group" aria-label="Photos">
          {photos.map((src, i) => (
            <button key={src} type="button" className="detail-thumb" aria-pressed={i === shown} aria-label={`Photo ${i + 1}`} onClick={() => setShown(i)}>
              <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
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
    <Modal open onClose={onClose} title={item.title} size="lg" bare className="item-detail-modal">
      <div className="item-detail">
        <button type="button" className="btn btn-ghost btn-icon btn-sm item-detail-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden />
        </button>
        <div className="detail-grid">
          <DetailMedia item={item} />
          <div className="detail-panel">
            <div className="detail-panel-scroll stack">
              <h2 className="detail-title display">{item.title}</h2>
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
            {footer ? <div className="detail-actions">{footer}</div> : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
