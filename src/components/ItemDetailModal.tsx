import { useEffect, useState, type ReactNode } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import type { AlreadyHaveChip, Item, Priority, PublicItem } from '../../shared/types';
import { ACQUIRED_VIA_LABELS, CONDITION_LABELS, ITEM_TYPE_LABELS } from '../../shared/constants';
import { formatDate, formatPrice, hostname } from '../lib/format';
import { AlreadyHaveChips } from './AlreadyHaveChips';
import { FEATURE_ILLUSTRATIONS } from './ItemIllustrations';
import { menuArt } from './menuArt';
import { Modal } from './ui/Modal';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';
import { ItemImage, ItemTypeIcon, PriorityBadge, Stars } from './ItemVisuals';
import { effectivePrice } from './ItemForm';

interface Props {
  item: Item | PublicItem | null;
  onClose: () => void;
  priority?: Priority | null;
  /** Note for gift-givers from the wishlist entry. */
  entryNote?: string;
  /** Set-mates this wish already owns (per wishlist entry, not the whole list). */
  alreadyHave?: AlreadyHaveChip[];
  /** Rendered below the details (claim box, owner info…). */
  children?: ReactNode;
  /** Illustrated menu items for the ⋯ actions sheet (Edit, Lists, Got it…). */
  actions?: ReactNode;
  badges?: ReactNode;
}

function sourceKicker(item: Item | PublicItem): string {
  if (item.type === 'experience') return item.metadata.venue || item.metadata.location || '';
  return item.retailer || item.brand || '';
}

export function ItemFacts({ item, hideSource }: { item: Item | PublicItem; hideSource?: boolean }) {
  const m = item.metadata;
  const rows: Array<[string, ReactNode]> = [];
  if (item.brand && !(hideSource && item.brand === sourceKicker(item))) rows.push(['Brand', item.brand]);
  if (item.retailer && !(hideSource && item.retailer === sourceKicker(item))) rows.push(['From', item.retailer]);
  if (m.barcode) rows.push(['Barcode', m.barcode]);
  if (m.model) rows.push(['Model', m.model]);
  if (m.variant) rows.push(['Variant', m.variant]);
  if (m.size) rows.push(['Size', m.size]);
  if (m.color) rows.push(['Colour', m.color]);
  if (m.venue && !(hideSource && item.type === 'experience')) rows.push(['Venue', m.venue]);
  if (m.location && !(hideSource && item.type === 'experience' && !m.venue)) rows.push(['Location', m.location]);
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
    <div className="detail-section detail-owned">
      <div className="section-label">Owned</div>
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
        <div className="detail-owned-review">
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

export function ItemDetailModal({ item, onClose, priority, entryNote, alreadyHave, children, actions, badges }: Props) {
  if (!item) return null;
  const amount = effectivePrice(item);
  const price = formatPrice(amount, item.currency);
  const notes = 'notes' in item ? item.notes : '';
  const link = item.externalUrl || item.metadata.bookingUrl || null;
  const linkLabel = item.type === 'experience' && !item.externalUrl ? 'Booking page' : `View on ${hostname(link ?? '') || 'site'}`;
  const showMenu = Boolean(link || actions);
  const kicker = sourceKicker(item);

  return (
    <Modal open onClose={onClose} title={item.title} size="lg" bare className="item-detail-modal">
      <div className="item-detail">
        <div className="item-detail-chrome">
          {showMenu && (
            <Menu
              label="Item actions"
              icon={<MoreHorizontal size={18} aria-hidden />}
              buttonClassName="btn btn-ghost btn-icon btn-sm item-detail-menu-btn"
              className="card-actions-menu item-detail-actions-menu"
              align="right"
            >
              {link && (
                <MenuItem
                  icon={menuArt(FEATURE_ILLUSTRATIONS.share)}
                  onSelect={() => window.open(link, '_blank', 'noopener,noreferrer')}
                >
                  {linkLabel}
                </MenuItem>
              )}
              {link && actions ? <MenuSeparator /> : null}
              {actions}
            </Menu>
          )}
          <button type="button" className="btn btn-ghost btn-icon btn-sm item-detail-close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="detail-grid">
          <DetailMedia item={item} />
          <div className="detail-panel">
            <div className="detail-panel-scroll">
              <header className="detail-hero">
                <h2 className="detail-title display">{item.title}</h2>
                <div className="detail-hero-row">
                  <div className="detail-hero-meta">
                    {kicker ? <span className="detail-kicker">{kicker}</span> : null}
                    <span className="badge badge-outline">
                      <ItemTypeIcon type={item.type} size={12} /> {ITEM_TYPE_LABELS[item.type]}
                    </span>
                    {priority && <PriorityBadge priority={priority} />}
                    {badges}
                  </div>
                  {price && (
                    <div className="detail-price display">
                      {item.type === 'idea' ? '~' : ''}
                      {price}
                    </div>
                  )}
                </div>
              </header>

              <div className="detail-body">
                {entryNote && <div className="owner-note">{entryNote}</div>}
                {alreadyHave && alreadyHave.length > 0 && <AlreadyHaveChips items={alreadyHave} />}
                {item.description && <p className="detail-description">{item.description}</p>}
                <ItemFacts item={item} hideSource />
                <OwnershipFacts item={item} />
                {item.tags.length > 0 && (
                  <div className="detail-tags">
                    {item.tags.map((t) => (
                      <span key={t} className="tag">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                {notes && (
                  <div className="detail-section">
                    <div className="section-label">Private notes</div>
                    <p className="detail-notes">{notes}</p>
                  </div>
                )}
                {children ? <div className="detail-extras">{children}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
