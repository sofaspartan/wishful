import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Package, Users } from 'lucide-react';
import type { CoverArt as CoverArtValue, ListPerson, WishlistSummary } from '../../shared/types';
import { countdownLabel, daysUntil, formatDate, relativeTime } from '../lib/format';
import { useMe } from '../lib/queries';
import { CollectionBadge, VisibilityBadge } from './ItemVisuals';
import { CoverArt } from './CoverArt';
import { joinNames } from '../../shared/constants';
import { AvatarStack } from './ui/misc';

export function WishlistCover({
  title,
  coverImage,
  coverArt,
  accentColor,
  previewImages = [],
}: {
  title: string;
  coverImage: string | null;
  coverArt?: CoverArtValue | null;
  accentColor: string;
  previewImages?: string[];
}) {
  const images = previewImages.slice(0, 4);
  return (
    <div className="wl-cover" style={{ ['--wl-accent' as string]: accentColor }}>
      {coverImage ? (
        <img src={coverImage} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : coverArt ? (
        <CoverArt art={coverArt} />
      ) : images.length > 0 ? (
        <div className="wl-mosaic" data-count={Math.max(images.length, 1)}>
          {images.map((src, i) => (
            <img key={i} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" style={images.length === 1 ? { objectFit: 'contain' } : undefined} />
          ))}
        </div>
      ) : (
        <>
          <div className="wl-cover-tint" />
          <span className="wl-cover-initial" aria-hidden>
            {title.trim()[0]?.toUpperCase() ?? '✦'}
          </span>
        </>
      )}
    </div>
  );
}

type ListPeople = Array<Pick<ListPerson, 'name' | 'avatarUrl'> & { userId?: string | null }>;

/** "For you & Leo", "For Ava, Leo & Mia": `meId` turns the signed-in user into "you". */
export function forNames(people: ListPeople, meId?: string | null): string {
  const isMe = (p: ListPeople[number]) => Boolean(meId && p.userId === meId);
  return joinNames([...people.filter(isMe).map(() => 'you'), ...people.filter((p) => !isMe(p)).map((p) => p.name)]);
}

/** "For Ava & Leo · by Jo" under the title of a list made for other people. */
export function ListForLine({ people, meId, by }: { people: ListPeople; meId?: string | null; by?: string | null }) {
  return (
    <p className="wl-for text-sm muted">
      <AvatarStack people={people} size={18} />
      <span className="truncate">
        For {forNames(people, meId)}
        {by && ` · by ${by}`}
      </span>
    </p>
  );
}

type PreviewFields = Pick<WishlistSummary, 'kind' | 'title' | 'description' | 'coverImage' | 'coverArt' | 'accentColor' | 'visibility' | 'occasion' | 'eventDate'>;

/** A non-interactive card showing how a list will look while it's being edited. */
export function ListCardPreview({
  list,
  recipients,
  itemCount,
  placeholder,
}: {
  list: PreviewFields;
  recipients: ListPeople;
  itemCount?: number;
  placeholder: string;
}) {
  const title = list.title.trim() || placeholder;
  return (
    <div className="wl-card wl-card-preview" aria-hidden>
      <div style={{ position: 'relative' }}>
        <WishlistCover title={title} coverImage={list.coverImage} coverArt={list.coverArt} accentColor={list.accentColor} />
        <div className="wl-card-badges">
          <VisibilityBadge visibility={list.visibility} />
          {list.kind === 'collection' && <CollectionBadge />}
        </div>
      </div>
      <div className="wl-body">
        <h3 className="wl-title truncate">{title}</h3>
        {recipients.length > 0 && <ListForLine people={recipients} />}
        {list.description.trim() && <p className="wl-desc clamp-2">{list.description}</p>}
        <div className="wl-meta">
          <span>
            <Package size={13} aria-hidden /> {itemCount ?? 0} item{itemCount === 1 ? '' : 's'}
          </span>
          {list.eventDate && (
            <span>
              <CalendarDays size={13} aria-hidden /> {list.occasion ? `${list.occasion} · ` : ''}
              {countdownLabel(list.eventDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  wishlist: WishlistSummary;
  menu?: ReactNode;
  dragHandle?: ReactNode;
  showOwner?: boolean;
}

export function WishlistCard({ wishlist: w, menu, dragHandle, showOwner }: Props) {
  const { data: me } = useMe();
  const days = daysUntil(w.eventDate);
  return (
    <article className="wl-card" aria-label={w.title}>
      <Link to={`/app/lists/${w.id}`} className="wl-card-link" aria-label={`Open ${w.title}`} />
      <div style={{ position: 'relative' }}>
        <WishlistCover title={w.title} coverImage={w.coverImage} coverArt={w.coverArt} accentColor={w.accentColor} previewImages={w.previewImages} />
        <div className="wl-card-badges">
          {w.role === 'owner' ? <VisibilityBadge visibility={w.visibility} /> : <span className="badge">{w.role === 'editor' ? 'Editor' : 'Viewer'}</span>}
          {w.kind === 'collection' && <CollectionBadge />}
          {w.archivedAt && <span className="badge">Archived</span>}
        </div>
        {(menu || dragHandle) && (
          <div className="wl-card-menu row" style={{ gap: 4 }}>
            {dragHandle}
            {menu}
          </div>
        )}
      </div>
      <div className="wl-body">
        <h3 className="wl-title truncate">{w.title}</h3>
        {w.recipients.length > 0 ? (
          <ListForLine people={w.recipients} meId={me?.id} by={w.role !== 'owner' ? w.owner.displayName : null} />
        ) : (
          showOwner && <p className="text-sm muted">by {w.owner.displayName}</p>
        )}
        {w.description && <p className="wl-desc clamp-2">{w.description}</p>}
        <div className="wl-meta">
          <span>
            <Package size={13} aria-hidden /> {w.itemCount} item{w.itemCount === 1 ? '' : 's'}
          </span>
          {w.eventDate && (
            <span title={formatDate(w.eventDate)} style={days !== null && days >= 0 && days <= 14 ? { color: 'var(--accent-ink)', fontWeight: 600 } : undefined}>
              <CalendarDays size={13} aria-hidden /> {w.occasion ? `${w.occasion} · ` : ''}
              {countdownLabel(w.eventDate)}
            </span>
          )}
          {w.collaboratorCount > 0 && w.role === 'owner' && (
            <span>
              <Users size={13} aria-hidden /> {w.collaboratorCount}
            </span>
          )}
          <span style={{ marginLeft: 'auto' }}>Updated {relativeTime(w.updatedAt)}</span>
        </div>
      </div>
    </article>
  );
}

export function WishlistCardSkeleton() {
  return (
    <div className="wl-card" aria-hidden>
      <div className="skeleton" style={{ aspectRatio: '16/9', borderRadius: 0 }} />
      <div className="wl-body">
        <div className="skeleton" style={{ height: 16, width: '60%' }} />
        <div className="skeleton" style={{ height: 12, width: '85%' }} />
        <div className="skeleton" style={{ height: 12, width: '40%', marginTop: 12 }} />
      </div>
    </div>
  );
}
