import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Gift, Lock, MapPin, Pencil, UserRoundPlus, UserX, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PROFILE_VISIBILITY_LABELS } from '../../shared/constants';
import { coverColors, coverPaint, isDarkCover, isPlainBackdrop, type SelfUser } from '../../shared/types';
import { keys, useMe, usePublicProfile } from '../lib/queries';
import { countdownLabel, firstName } from '../lib/format';
import { useLocalPref } from '../lib/prefs';
import { brand } from '../config/brand';
import { errorMessage, post } from '../lib/api';
import { Logo } from '../components/Logo';
import { CoverArt } from '../components/CoverArt';
import { EditProfileModal } from '../components/EditProfileModal';
import { ListForLine, WishlistCover, WishlistListThumb } from '../components/WishlistCard';
import { CollectionBadge } from '../components/ItemVisuals';
import { CARD_LIST_VIEWS, ViewToggle, type CardListView } from '../components/ViewToggle';
import { SiteFooter } from '../components/SiteFooter';
import { Avatar, EmptyState, PageLoader } from '../components/ui/misc';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ThemeToggle';
import { useToast } from '../components/ui/Toast';

export default function PublicProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = usePublicProfile(username);
  const { data: me } = useMe();
  const toast = useToast();
  const qc = useQueryClient();
  const [friending, setFriending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [listsView, setListsView] = useLocalPref<CardListView>('public.profileListsView', 'grid', CARD_LIST_VIEWS);

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

  const onProfileSaved = (user: SelfUser) => {
    const previous = data?.user.username;
    qc.setQueryData(keys.me, user);
    void qc.invalidateQueries({ queryKey: keys.profile(user.username) });
    if (previous && previous !== user.username) {
      void qc.removeQueries({ queryKey: keys.profile(previous) });
      navigate(`/u/${user.username}`, { replace: true });
    }
  };

  const cover = data?.user.profileCoverArt ?? null;
  const dark = cover ? isDarkCover(cover) : false;
  const pageStyle: CSSProperties | undefined =
    cover && isPlainBackdrop(cover.backdrop)
      ? ({ ['--profile-tint' as string]: coverPaint(cover) ?? coverColors(cover)[0] } as CSSProperties)
      : undefined;
  const metaBits = data
    ? [
        data.user.age != null ? `${data.user.age}` : null,
        data.user.location || null,
      ].filter(Boolean)
    : [];

  return (
    <div
      className={['public-shell', cover && 'public-shell-styled', dark && 'public-shell-styled-dark'].filter(Boolean).join(' ')}
      style={pageStyle}
    >
      {cover && (
        <div className="profile-page-sky" aria-hidden>
          <CoverArt art={cover} showIcon={false} />
        </div>
      )}
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
            <section className={['profile-hero', cover && 'profile-hero-panel'].filter(Boolean).join(' ')} aria-label={`${data.user.displayName}'s profile`}>
              <div className="profile-hero-body">
                <Avatar name={data.user.displayName} src={data.user.avatarUrl} size={cover ? 88 : 80} />
                <div className="profile-hero-main">
                  <h1 className="public-title display">{data.user.displayName}</h1>
                  <p className="muted">@{data.user.username}</p>
                  {metaBits.length > 0 && (
                    <p className="profile-hero-meta muted">
                      {data.user.age != null && <span>{data.user.age}</span>}
                      {data.user.age != null && data.user.location && <span aria-hidden> · </span>}
                      {data.user.location && (
                        <span className="profile-hero-location">
                          <MapPin size={13} aria-hidden /> {data.user.location}
                        </span>
                      )}
                    </p>
                  )}
                  {data.user.bio && <p className="profile-hero-bio muted">{data.user.bio}</p>}
                  <div className="row-wrap profile-hero-actions">
                    <span className="badge badge-outline">{PROFILE_VISIBILITY_LABELS[data.profileVisibility]} profile</span>
                    {data.viewer.isSelf && me && (
                      <Button size="sm" variant="primary" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
                        Edit profile
                      </Button>
                    )}
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
              </div>
            </section>

            {data.viewer.canSeeLists ? (
              data.wishlists.length ? (
                <div className="stack" style={{ gap: 'var(--s-3)' }}>
                  <div className="people-results-toolbar">
                    <span className="muted text-sm">
                      {data.wishlists.length} {data.wishlists.length === 1 ? 'list' : 'lists'}
                    </span>
                    <ViewToggle value={listsView} onChange={setListsView} />
                  </div>
                  <div className={listsView === 'grid' ? 'grid-lists' : 'list-items'}>
                    {data.wishlists.map((w) =>
                      listsView === 'list' ? (
                        <article key={w.shareToken} className="item-row wl-row" aria-label={w.title}>
                          <Link to={`/s/${w.shareToken}`} className="item-card-hit" aria-label={`Open ${w.title}`} />
                          <WishlistListThumb title={w.title} coverImage={w.coverImage} coverArt={w.coverArt} accentColor={w.accentColor} />
                          <div className="item-row-main">
                            <strong className="truncate">{w.title}</strong>
                            <span className="row text-sm muted" style={{ gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
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
                            </span>
                          </div>
                        </article>
                      ) : (
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
                      ),
                    )}
                  </div>
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
      <SiteFooter coverArt={cover} />
      {me && editing && <EditProfileModal open={editing} me={me} onClose={() => setEditing(false)} onSaved={onProfileSaved} />}
    </div>
  );
}
