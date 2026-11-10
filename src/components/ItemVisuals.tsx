import { useState } from 'react';
import { CheckCircle2, Gift, Globe, Heart, Library, Lightbulb, Link2, Lock, Package, Sparkles, Star, Ticket, Clock, Users } from 'lucide-react';
import type { ClaimStatus, ItemType, PublicOwnership, Priority, Visibility } from '../../shared/types';
import { CONDITION_LABELS, PRIORITY_LABELS, VISIBILITY_LABELS } from '../../shared/constants';
import { formatDate } from '../lib/format';

export function ItemTypeIcon({ type, size = 18 }: { type: ItemType; size?: number }) {
  const Icon = { product: Package, experience: Ticket, idea: Lightbulb, gift_card: Gift, custom: Sparkles }[type] ?? Sparkles;
  return <Icon size={size} aria-hidden />;
}

/** Image with graceful fallback to a type-tinted placeholder (remote images can 404 or block hotlinking). */
export function ItemImage({ src, type, alt = '', iconSize = 28, cover }: { src: string | null; type: ItemType; alt?: string; iconSize?: number; cover?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="item-placeholder" data-type={type}>
        <ItemTypeIcon type={type} size={iconSize} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={cover ? { objectFit: 'cover', padding: 0 } : undefined}
    />
  );
}

export function PriorityLabel({ priority }: { priority: Priority | null | undefined }) {
  if (!priority) return null;
  return <span className={`priority priority-${priority}`}>{PRIORITY_LABELS[priority]}</span>;
}

export const PRIORITY_ICONS = { must_have: Star, really_want: Heart } as const;

/** The stand-out pill for must haves and really wants; plain "Interested" keeps the quiet label. */
export function PriorityBadge({ priority }: { priority: Priority | null | undefined }) {
  if (priority !== 'must_have' && priority !== 'really_want') return <PriorityLabel priority={priority} />;
  const Icon = PRIORITY_ICONS[priority];
  return (
    <span className={`prio-badge prio-badge-${priority}`}>
      <Icon aria-hidden />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function VisibilityBadge({ visibility, outline }: { visibility: Visibility; outline?: boolean }) {
  const Icon = { private: Lock, friends: Users, unlisted: Link2, public: Globe }[visibility];
  return (
    <span className={`badge${outline ? ' badge-outline' : ''}`}>
      <Icon aria-hidden />
      {VISIBILITY_LABELS[visibility]}
    </span>
  );
}

export function CollectionBadge({ outline }: { outline?: boolean }) {
  return (
    <span className={`badge badge-collection${outline ? ' badge-outline' : ''}`}>
      <Library aria-hidden />
      Collection
    </span>
  );
}

/** Short human facts about an owned item, e.g. ["Since Mar 2025", "Gift", "Like new", "×3"]. */
export function ownershipFacts(owned: PublicOwnership): string[] {
  const facts: string[] = [];
  if (owned.acquiredOn) facts.push(`Since ${formatDate(owned.acquiredOn, { month: 'short', year: 'numeric' })}`);
  if (owned.acquiredVia && owned.acquiredVia !== 'other') facts.push(owned.acquiredVia === 'gift' ? 'Gift' : 'Bought');
  if (owned.condition) facts.push(CONDITION_LABELS[owned.condition]);
  if (owned.quantity > 1) facts.push(`×${owned.quantity}`);
  return facts;
}

export function OwnedLine({ owned }: { owned: PublicOwnership }) {
  const facts = ownershipFacts(owned);
  if (facts.length === 0 && !owned.rating) return null;
  return (
    <span className="owned-line">
      {owned.rating ? <Stars value={owned.rating} size={12} /> : null}
      {facts.length > 0 && <span className="truncate">{facts.join(' · ')}</span>}
    </span>
  );
}

/** Read-only star rating, e.g. 4 of 5 filled. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="stars" role="img" aria-label={`${filled} out of 5 stars`} style={{ ['--star-size' as string]: `${size}px` }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={n <= filled ? 'star-on' : 'star-off'} />
      ))}
    </span>
  );
}

export function StatusBadge({ status, mine }: { status: ClaimStatus | null; mine?: boolean }) {
  if (!status || status === 'available') return null;
  if (status === 'purchased')
    return (
      <span className="badge badge-success">
        <CheckCircle2 aria-hidden />
        {mine ? 'You bought this' : 'Purchased'}
      </span>
    );
  return (
    <span className="badge badge-warning">
      <Clock aria-hidden />
      {mine ? 'You reserved this' : 'Reserved'}
    </span>
  );
}
