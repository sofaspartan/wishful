import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Gift, UserX } from 'lucide-react';
import { useMe, usePublicProfile } from '../lib/queries';
import { countdownLabel } from '../lib/format';
import { brand } from '../config/brand';
import { Logo } from '../components/Logo';
import { ListForLine, WishlistCover } from '../components/WishlistCard';
import { CollectionBadge } from '../components/ItemVisuals';
import { Avatar, EmptyState, PageLoader } from '../components/ui/misc';
import { ThemeToggle } from '../components/ThemeToggle';

export default function PublicProfile() {
  const { username } = useParams();
  const { data, isLoading, error } = usePublicProfile(username);
  const { data: me } = useMe();

  useEffect(() => {
    if (data) document.title = `${data.user.displayName} · ${brand.name}`;
  }, [data]);

  return (
    <div className="public-shell">
      <header className="public-header">
        <Logo to="/" size={28} />
        <div className="spacer" />
        <Link to={me ? '/app' : '/register'} className="btn btn-sm">
          {me ? `My ${brand.name}` : 'Create your own wishlist'}
        </Link>
        <ThemeToggle />
      </header>
      <main id="main" className="public-content" style={{ paddingTop: 'var(--s-6)' }}>
        {isLoading ? (
          <PageLoader />
        ) : error || !data ? (
          <EmptyState icon={<UserX size={22} />} title="Profile not available">
            This profile is private or doesn't exist.
          </EmptyState>
        ) : (
          <>
            <div className="public-intro" style={{ marginTop: 0, marginBottom: 'var(--s-10)' }}>
              <Avatar name={data.user.displayName} src={data.user.avatarUrl} size={80} />
              <h1 className="public-title display">{data.user.displayName}</h1>
              <p className="muted">@{data.user.username}</p>
              {data.user.bio && (
                <p style={{ maxWidth: 520, whiteSpace: 'pre-line' }} className="muted">
                  {data.user.bio}
                </p>
              )}
            </div>
            {data.wishlists.length ? (
              <div className="grid-lists">
                {data.wishlists.map((w) => (
                  <article key={w.shareToken} className="wl-card">
                    <Link to={`/s/${w.shareToken}`} className="wl-card-link" aria-label={`Open ${w.title}`} />
                    <WishlistCover title={w.title} coverImage={w.coverImage} coverArt={w.coverArt} accentColor={w.accentColor} />
                    <div className="wl-body">
                      <h2 className="wl-title truncate">{w.title}</h2>
                      {w.recipients.length > 0 && <ListForLine people={w.recipients} />}
                      {w.description && <p className="wl-desc clamp-2">{w.description}</p>}
                      <div className="wl-meta">
                        {w.kind === 'collection' && <CollectionBadge outline />}
                        <span>
                          <Gift size={13} aria-hidden /> {w.itemCount} item{w.itemCount === 1 ? '' : 's'}
                        </span>
                        {w.eventDate && (
                          <span>
                            <CalendarDays size={13} aria-hidden /> {w.occasion ? `${w.occasion} · ` : ''}
                            {countdownLabel(w.eventDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Gift size={22} />} title="No public lists">
                {data.user.displayName.split(' ')[0]} hasn't published any lists yet.
              </EmptyState>
            )}
          </>
        )}
      </main>
    </div>
  );
}
