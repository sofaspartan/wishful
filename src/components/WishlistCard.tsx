import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ExternalLink, Package, Users } from 'lucide-react';
import type { CoverArt as CoverArtValue, ListPerson, PublicUser, WishlistSummary } from '../../shared/types';
import { countdownLabel, daysUntil, formatDate, relativeTime } from '../lib/format';
import { useMe } from '../lib/queries';
import { CollectionBadge, VisibilityBadge } from './ItemVisuals';
import { CoverArt } from './CoverArt';
import { firstName, joinNames } from '../../shared/constants';
import { Avatar, AvatarStack } from './ui/misc';
import { Popover } from './ui/Popover';
import { MenuLabel } from './ui/Menu';

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

/** Compact list-row mark — same treatment as the home dashboard rows. */
export function WishlistListThumb({
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
  const art = !coverImage ? coverArt : null;
  const image = coverImage ?? (art ? null : previewImages[0]) ?? null;
  return (
    <span className="mini-cover" style={{ background: image || art ? 'var(--surface-sunken)' : accentColor }} aria-hidden>
      {image ? (
        <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : art ? (
        <CoverArt art={art} size="sm" />
      ) : (
        title.trim()[0]?.toUpperCase() ?? '•'
      )}
    </span>
  );
}

type ListPeople = Array<Pick<ListPerson, 'name' | 'avatarUrl'> & { userId?: string | null; username?: string | null }>;
type Maker = Pick<PublicUser, 'displayName' | 'avatarUrl'> & { username?: string | null; id?: string };

/** "For you & Leo", "For Ava, Leo & Mia": `meId` turns the signed-in user into "you". */
export function forNames(people: ListPeople, meId?: string | null): string {
  const isMe = (p: ListPeople[number]) => Boolean(meId && p.userId === meId);
  return joinNames([...people.filter(isMe).map(() => 'you'), ...people.filter((p) => !isMe(p)).map((p) => p.name)]);
}

function makerLabel(maker: Maker): string {
  return firstName(maker.displayName) || maker.displayName;
}

/** Rows for the people popover: maker first, then everyone the list is for (skipping the maker if they’re already in that group). */
export function ListPeopleLinks({
  maker,
  people,
  meId,
  close,
}: {
  maker?: Maker | null;
  people: ListPeople;
  meId?: string | null;
  close: () => void;
}) {
  const forPeople = people.filter((p) => {
    if (maker?.id && p.userId && p.userId === maker.id) return false;
    if (maker?.username && p.username && p.username === maker.username) return false;
    return true;
  });
  return (
    <>
      {maker && (
        <>
          <MenuLabel>Made by</MenuLabel>
          <PersonProfileRow name={makerLabel(maker)} avatarUrl={maker.avatarUrl} username={maker.username || null} close={close} />
        </>
      )}
      {forPeople.length > 0 && (
        <>
          <MenuLabel>For</MenuLabel>
          {forPeople.map((p, i) => (
            <PersonProfileRow
              key={`${p.userId ?? p.username ?? p.name}-${i}`}
              name={meId && p.userId === meId ? 'You' : p.name}
              avatarUrl={p.avatarUrl}
              username={p.username}
              close={close}
            />
          ))}
        </>
      )}
    </>
  );
}

function PersonProfileRow({
  name,
  avatarUrl,
  username,
  close,
}: {
  name: string;
  avatarUrl?: string | null;
  username?: string | null;
  close: () => void;
}) {
  const body = (
    <>
      <Avatar name={name} src={avatarUrl} size={28} />
      <span className="list-people-row-text">
        <strong className="truncate">{name}</strong>
        {username ? <span className="muted text-xs truncate">@{username}</span> : <span className="muted text-xs">Not on Wishful</span>}
      </span>
      {username && <ExternalLink size={14} aria-hidden className="list-people-row-go" />}
    </>
  );
  if (!username) {
    return <div className="list-people-row is-static">{body}</div>;
  }
  return (
    <Link to={`/u/${username}`} className="list-people-row" onClick={close}>
      {body}
    </Link>
  );
}

/** "For Ava & Leo · by Jo" — click to open profile links for the maker and anyone on the platform. */
export function ListForLine({
  people,
  meId,
  maker,
  by,
  interactive = true,
  className,
  avatarSize = 18,
}: {
  people: ListPeople;
  meId?: string | null;
  /** The person who made the list (shown as “by …” and linked when they have a username). */
  maker?: Maker | null;
  /** @deprecated Prefer `maker`. */
  by?: string | null;
  /** False for non-interactive previews. */
  interactive?: boolean;
  className?: string;
  avatarSize?: number;
}) {
  const resolvedMaker: Maker | null = maker ?? (by ? { displayName: by, username: null, avatarUrl: null } : null);
  const byline = resolvedMaker ? makerLabel(resolvedMaker) : null;
  const forText = people.length ? forNames(people, meId) : null;
  if (!forText && !byline) return null;

  const faces = people.length ? people : resolvedMaker ? [{ name: resolvedMaker.displayName, avatarUrl: resolvedMaker.avatarUrl }] : [];
  const summary = (
    <>
      <AvatarStack people={faces} size={avatarSize} />
      <span className="truncate">
        {forText ? (
          <>
            For {forText}
            {byline && ` · by ${byline}`}
          </>
        ) : (
          <>by {byline}</>
        )}
      </span>
    </>
  );

  if (!interactive) {
    return <p className={['wl-for text-sm muted', className].filter(Boolean).join(' ')}>{summary}</p>;
  }

  return (
    <Popover
      label="People on this list"
      buttonClassName={['wl-for wl-for-btn text-sm muted', className].filter(Boolean).join(' ')}
      buttonContent={summary}
      className="list-people-menu"
    >
      {(close) => <ListPeopleLinks maker={resolvedMaker} people={people} meId={meId} close={close} />}
    </Popover>
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
        {recipients.length > 0 && <ListForLine people={recipients} interactive={false} />}
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
  /** Card (default) or compact list row. */
  view?: 'grid' | 'list';
  /** Override the open link (e.g. public share URL). */
  to?: string;
}

export function WishlistCard({ wishlist: w, menu, dragHandle, showOwner, view = 'grid', to }: Props) {
  const { data: me } = useMe();
  const days = daysUntil(w.eventDate);
  const href = to ?? `/app/lists/${w.id}`;
  const metaBits = (
    <>
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
    </>
  );

  if (view === 'list') {
    return (
      <article className="item-row wl-row" aria-label={w.title}>
        <Link to={href} className="item-card-hit" aria-label={`Open ${w.title}`} />
        {dragHandle && <div style={{ position: 'relative', zIndex: 2 }}>{dragHandle}</div>}
        <WishlistListThumb
          title={w.title}
          coverImage={w.coverImage}
          coverArt={w.coverArt}
          accentColor={w.accentColor}
          previewImages={w.previewImages}
        />
        <div className="item-row-main">
          <strong className="truncate">{w.title}</strong>
          <span className="row text-sm muted" style={{ gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
            {w.kind === 'collection' && <CollectionBadge />}
            {w.role !== 'owner' && <span className="badge">{w.role === 'editor' ? 'Editor' : 'Viewer'}</span>}
            {w.archivedAt && <span className="badge">Archived</span>}
            {metaBits}
          </span>
        </div>
        <div className="item-row-side" style={{ position: 'relative', zIndex: 2 }}>
          <span className="muted text-xs hide-xs">Updated {relativeTime(w.updatedAt)}</span>
          {menu}
        </div>
      </article>
    );
  }

  return (
    <article className="wl-card" aria-label={w.title}>
      <Link to={href} className="wl-card-link" aria-label={`Open ${w.title}`} />
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
          <ListForLine people={w.recipients} meId={me?.id} maker={w.role !== 'owner' ? w.owner : null} />
        ) : (
          showOwner && <ListForLine people={[]} maker={w.owner} />
        )}
        {w.description && <p className="wl-desc clamp-2">{w.description}</p>}
        <div className="wl-meta">
          {metaBits}
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
