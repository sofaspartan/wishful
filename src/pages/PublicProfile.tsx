import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Gift, Lock, UserRoundPlus, UserX, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PROFILE_VISIBILITY_LABELS } from '../../shared/constants';
import { keys, useMe, usePublicProfile } from '../lib/queries';
import { countdownLabel, firstName } from '../lib/format';
import { brand } from '../config/brand';
import { errorMessage, post } from '../lib/api';
import { Logo } from '../components/Logo';
import { ListForLine, WishlistCover } from '../components/WishlistCard';
import { CollectionBadge } from '../components/ItemVisuals';
import { Avatar, EmptyState, PageLoader } from '../components/ui/misc';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ThemeToggle';
import { useToast } from '../components/ui/Toast';

export default function PublicProfile() {
  const { username } = useParams();
  const { data, isLoading, error } = usePublicProfile(username);
  const { data: me } = useMe();
  const toast = useToast();
  const qc = useQueryClient();
  const [friending, setFriending] = useState(false);

  useEffect(() => {
    if (data) document.title = `${data.user.displayName} · ${brand.name}`;
  }, [data]);

  const sendRequest = async () => {
    if (!data) return;
    setFriending(true);
    try {
      await post('/api/friends/requests', { username: data.user.username });
      toast.success(`Friend request sent to @${data.user.username}`);
      void qc.invalidateQueries({ queryKey: keys.friends });
      void qc.invalidateQueries({ queryKey: keys.profile(data.user.username) });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setFriending(false);
    }
  };

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
            This profile doesn’t exist.
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
              <div className="row-wrap" style={{ justifyContent: 'center', marginTop: 'var(--s-4)' }}>
                <span className="badge badge-outline">{PROFILE_VISIBILITY_LABELS[data.profileVisibility]} profile</span>
                {me && !data.viewer.isSelf && data.viewer.isFriend && (
                  <Link to={`/app/friends/${data.user.id}`} className="btn btn-sm">
                    See as a friend
                  </Link>
                )}
                {me && !data.viewer.isSelf && !data.viewer.isFriend && (
                  <Button size="sm" variant="primary" icon={<UserRoundPlus size={15} />} loading={friending} onClick={sendRequest}>
                    Add friend
                  </Button>
                )}
              </div>
            </div>
            {data.viewer.canSeeLists ? (
              data.wishlists.length ? (
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
                <EmptyState icon={<Gift size={22} />} title="No lists here yet">
                  {firstName(data.user.displayName)} hasn’t shared any lists on this profile.
                </EmptyState>
              )
            ) : data.profileVisibility === 'private' ? (
              <EmptyState icon={<Lock size={22} />} title="This profile is private">
                {firstName(data.user.displayName)} keeps their lists off their public profile.
                {me && !data.viewer.isFriend ? ' Send a friend request — if they accept, you may see lists they share with friends.' : null}
              </EmptyState>
            ) : (
              <EmptyState icon={<Users size={22} />} title="Friends only">
                Only {firstName(data.user.displayName)}’s friends can see lists on this profile.
                {me ? (
                  !data.viewer.isFriend && (
                    <>
                      {' '}
                      <Button size="sm" variant="primary" icon={<UserRoundPlus size={15} />} loading={friending} onClick={sendRequest}>
                        Add friend
                      </Button>
                    </>
                  )
                ) : (
                  <>
                    {' '}
                    <Link to="/login">Sign in</Link> to send a friend request.
                  </>
                )}
              </EmptyState>
            )}
          </>
        )}
      </main>
    </div>
  );
}
