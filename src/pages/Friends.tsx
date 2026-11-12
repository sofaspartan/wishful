import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Copy, Eye, Inbox, Plus, Search, Send, UserRound, UserRoundPlus, Users, X } from 'lucide-react';
import type { FriendsOverview, PeopleSearchHit, ProfileVisibility, SelfUser } from '../../shared/types';
import { PROFILE_VISIBILITY_LABELS, isDiscoverableProfile } from '../../shared/constants';
import { keys, useCircle, useFriends, useMe } from '../lib/queries';
import { del, errorMessage, fieldErrors, get, post } from '../lib/api';
import { formatDate, relativeTime } from '../lib/format';
import { useLocalPref } from '../lib/prefs';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Avatar, EmptyState, PageLoader } from '../components/ui/misc';
import { useToast } from '../components/ui/Toast';
import { Cloud } from '../components/Cloud';
import { PageSky } from '../components/PageSky';
import { SkyArt } from '../components/SkyArt';
import { MyCirclePanel } from '../components/MyCirclePanel';
import { CARD_LIST_VIEWS, ViewToggle, type CardListView } from '../components/ViewToggle';

type RequestResult = { status: 'requested' | 'already_requested' | 'accepted'; overview: FriendsOverview };
type Tab = 'search' | 'friends' | 'circle';
type PeopleView = CardListView;

const TABS: Array<{ id: Tab; label: string; icon: typeof Search }> = [
  { id: 'search', label: 'Search', icon: Search },
  { id: 'friends', label: 'Your friends', icon: Users },
  { id: 'circle', label: 'My Circle', icon: UserRound },
];

const TAB_SKY: Record<Tab, { eyebrow: string; title: string; subtitle: string; scene: 'friends' | 'search' | 'invite' }> = {
  search: {
    eyebrow: 'Search',
    title: 'Find people',
    subtitle: 'Search Wishful by username, send a friend request, or add someone manually with their exact handle.',
    scene: 'search',
  },
  friends: {
    eyebrow: 'Friends',
    title: 'Your friends',
    subtitle: 'Accept requests, browse friends, and open the lists they share with you.',
    scene: 'friends',
  },
  circle: {
    eyebrow: 'Circle',
    title: 'My Circle',
    subtitle: 'Save household, family, friends, and pets — even if they aren’t on Wishful — then reuse them on lists.',
    scene: 'invite',
  },
};
function selfHit(me: SelfUser): PeopleSearchHit | null {
  const visibility = me.profileVisibility;
  if (!isDiscoverableProfile(visibility)) return null;
  return {
    user: { id: me.id, username: me.username, displayName: me.displayName, avatarUrl: me.avatarUrl },
    profileVisibility: visibility,
    relationship: 'self',
  };
}

export default function Friends() {
  const { data: me } = useMe();
  const { data, isLoading } = useFriends();
  const { data: circle, isLoading: circleLoading } = useCircle();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab: Tab = rawTab === 'friends' || rawTab === 'circle' ? rawTab : 'search';
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PeopleSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [circleAddTick, setCircleAddTick] = useState(0);
  const [friendsQuery, setFriendsQuery] = useState('');
  const [peopleView, setPeopleView] = useLocalPref<PeopleView>('friends.searchView', 'grid', CARD_LIST_VIEWS);
  const [friendsView, setFriendsView] = useLocalPref<PeopleView>('friends.friendsView', 'grid', CARD_LIST_VIEWS);

  const setTab = (next: Tab) => setParams(next === 'search' ? {} : { tab: next }, { replace: true });

  const apply = (overview: FriendsOverview) => {
    qc.setQueryData(keys.friends, overview);
    void qc.invalidateQueries({ queryKey: ['friend'] });
  };

  const mine = useMemo(() => (me ? selfHit(me) : null), [me]);

  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(() => {
      void get<{ people: PeopleSearchHit[] }>(`/api/friends/search?q=${encodeURIComponent(q)}`)
        .then((res) => {
          if (!cancelled) setResults(res.people);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  const displayed = useMemo(() => {
    const q = query.trim().replace(/^@/, '');
    if (q.length >= 2) return results;
    return mine ? [mine] : [];
  }, [query, results, mine]);

  const sendByHandle = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await post<RequestResult>('/api/friends/requests', { username: handle });
      apply(res.overview);
      const name = `@${handle.trim().replace(/^@/, '').toLowerCase()}`;
      if (res.status === 'accepted') toast.success(`You and ${name} are now friends`);
      else if (res.status === 'already_requested') toast.info(`You've already sent ${name} a request`);
      else toast.success(`Friend request sent to ${name}`);
      setHandle('');
      setManualOpen(false);
      setTab('friends');
    } catch (err) {
      setError(fieldErrors(err).username ?? errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const closeManual = () => {
    setManualOpen(false);
    setError(null);
    setHandle('');
  };

  const requestFromSearch = async (hit: PeopleSearchHit) => {
    setBusy(`search:${hit.user.id}`);
    try {
      const res = await post<RequestResult>('/api/friends/requests', { username: hit.user.username });
      apply(res.overview);
      if (res.status === 'accepted') toast.success(`You and @${hit.user.username} are now friends`);
      else if (res.status === 'already_requested') toast.info(`You've already sent @${hit.user.username} a request`);
      else toast.success(`Friend request sent to @${hit.user.username}`);
      setResults((prev) =>
        prev?.map((p) =>
          p.user.id === hit.user.id ? { ...p, relationship: res.status === 'accepted' ? 'friends' : 'outgoing' } : p,
        ) ?? null,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const act = async (key: string, fn: () => Promise<FriendsOverview>, success: string) => {
    setBusy(key);
    try {
      apply(await fn());
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const copyUsername = async () => {
    if (!me) return;
    try {
      await navigator.clipboard.writeText(me.username);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — select your username and copy it manually.');
    }
  };

  const incoming = data?.incoming.length ?? 0;
  const sky = TAB_SKY[tab];

  return (
    <div className="page">
      <nav className="segmented lists-switch friends-switch" aria-label="Friends sections">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <Icon size={15} aria-hidden />
              {t.label}
              {t.id === 'friends' && incoming > 0 && <span className="nav-badge">{incoming}</span>}
              {t.id === 'friends' && !incoming && data && data.friends.length > 0 && <span className="faint">{data.friends.length}</span>}
              {t.id === 'circle' && circle && circle.length > 0 && <span className="faint">{circle.length}</span>}
            </button>
          );
        })}
      </nav>

      <PageSky eyebrow={sky.eyebrow} title={sky.title} subtitle={sky.subtitle} art={<SkyArt scene={sky.scene} />}>
        {me && tab === 'search' && (
          <div className="sky-handle">
            <span>Your username</span>
            <code>@{me.username}</code>
            <button type="button" className="sky-handle-copy" onClick={copyUsername}>
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        <div className="page-sky-actions">
          {tab === 'search' && (
            <Button
              type="button"
              variant="primary"
              icon={<UserRoundPlus size={16} />}
              onClick={() => {
                setError(null);
                setManualOpen(true);
              }}
            >
              Add manually
            </Button>
          )}
          {tab === 'friends' && (
            <Button type="button" variant="primary" icon={<Search size={16} />} onClick={() => setTab('search')}>
              Find people
            </Button>
          )}
          {tab === 'circle' && (
            <Button type="button" variant="primary" icon={<Plus size={16} />} onClick={() => setCircleAddTick((n) => n + 1)}>
              Add
            </Button>
          )}
        </div>
      </PageSky>

      {tab === 'circle' ? (
        <MyCirclePanel people={circle} loading={circleLoading} friends={data?.friends ?? []} openAddTick={circleAddTick} />
      ) : tab === 'search' ? (
        <section className="section" aria-label="Search for people">
          <div className="people-search stack" style={{ gap: 'var(--s-6)' }}>
            <div className="stack" style={{ gap: 'var(--s-3)' }}>
              <div className="people-search-bar">
                <div className="input-group">
                  <Search size={16} aria-hidden className="people-search-icon" />
                  <input
                    className="input"
                    placeholder="Search by username"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search for people"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <ViewToggle value={peopleView} onChange={setPeopleView} />
              </div>
              <p className="field-hint">
                Public and friends profiles show up here. Private accounts won’t appear in search — use Add manually if you know their handle.
              </p>
              {(searching || displayed) && (
                <p className="muted text-sm">
                  {searching
                    ? 'Searching…'
                    : `${displayed!.length} ${displayed!.length === 1 ? 'person' : 'people'}`}
                </p>
              )}
            </div>

            {displayed && !searching && (
              displayed.length ? (
                <div className={peopleView === 'grid' ? 'friend-grid' : 'list-items list-items-sky'}>
                  {displayed.map((hit) => (
                    <PersonResult
                      key={hit.user.id}
                      hit={hit}
                      view={peopleView}
                      busy={busy}
                      onAdd={() => requestFromSearch(hit)}
                      onAccept={() =>
                        act(
                          `accept:${hit.user.id}`,
                          () => post(`/api/friends/requests/${hit.user.id}/accept`),
                          `You and ${hit.user.displayName} are now friends`,
                        )
                      }
                    />
                  ))}
                </div>
              ) : query.trim().replace(/^@/, '').length >= 2 ? (
                <p className="muted text-sm">No discoverable profiles match “{query.trim()}”.</p>
              ) : me && !isDiscoverableProfile(me.profileVisibility) ? (
                <EmptyState
                  icon={<Search size={22} />}
                  title="You’re not discoverable yet"
                  action={
                    <Link to="/app/settings?tab=profile" className="btn btn-sm">
                      Profile visibility
                    </Link>
                  }
                >
                  Set your profile to Public or Friends in Settings to appear in search — and to preview how others will see you here.
                </EmptyState>
              ) : null
            )}
          </div>
        </section>
      ) : isLoading || !data ? (
        <PageLoader />
      ) : (
        <>
          {data.incoming.length > 0 && (
            <section className="section">
              <div className="section-header">
                <span className="tile-header-icon" aria-hidden>
                  <Inbox size={14} />
                </span>
                <h2 className="section-title">Friend requests</h2>
                <span className="nav-badge" style={{ marginLeft: 0 }}>
                  {data.incoming.length}
                </span>
              </div>
              <div className="list-items list-items-sky">
                {data.incoming.map(({ user, createdAt }) => (
                  <div className="item-row" key={user.id}>
                    <Avatar name={user.displayName} src={user.avatarUrl} size={40} />
                    <div className="item-row-main">
                      <strong className="truncate">{user.displayName}</strong>
                      <span className="muted text-xs truncate">
                        @{user.username} · {relativeTime(createdAt)}
                      </span>
                    </div>
                    <div className="item-row-side">
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<Check size={14} />}
                        loading={busy === `accept:${user.id}`}
                        onClick={() => act(`accept:${user.id}`, () => post(`/api/friends/requests/${user.id}/accept`), `You and ${user.displayName} are now friends`)}
                      >
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" loading={busy === `decline:${user.id}`} onClick={() => act(`decline:${user.id}`, () => del(`/api/friends/requests/${user.id}`), 'Request declined')}>
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="section" aria-label="Your friends">
            <div className="toolbar" style={{ marginTop: 0, marginBottom: 'var(--s-4)' }}>
              <div className="input-group" style={{ flex: '1 1 220px', maxWidth: 360 }}>
                <Search size={16} aria-hidden />
                <input
                  className="input"
                  type="search"
                  placeholder="Search friends"
                  value={friendsQuery}
                  onChange={(e) => setFriendsQuery(e.target.value)}
                  aria-label="Search friends"
                />
              </div>
              <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
                <ViewToggle value={friendsView} onChange={setFriendsView} />
              </div>
            </div>
            {(() => {
              const fq = friendsQuery.trim().toLowerCase().replace(/^@/, '');
              const friendsShown = fq
                ? data.friends.filter(
                    ({ user }) => user.displayName.toLowerCase().includes(fq) || user.username.toLowerCase().includes(fq),
                  )
                : data.friends;
              if (!data.friends.length) {
                return (
                  <EmptyState
                    art={<SkyArt scene="invite" />}
                    title="No friends yet"
                    action={
                      <Button variant="primary" onClick={() => setTab('search')}>
                        Find people
                      </Button>
                    }
                  >
                    Head to Search to find people, or add someone with their @username. Once they accept, their shared lists show up here.
                  </EmptyState>
                );
              }
              if (!friendsShown.length) {
                return (
                  <EmptyState icon={<Search size={22} />} title="No matching friends">
                    Nobody matches “{friendsQuery.trim()}”.
                  </EmptyState>
                );
              }
              if (friendsView === 'list') {
                return (
                  <div className="list-items list-items-sky">
                    {friendsShown.map(({ user, since }) => (
                      <div className="item-row" key={user.id}>
                        <Link to={`/app/friends/${user.id}`} className="item-card-hit" aria-label={`See ${user.displayName}'s wishlists`} />
                        <Avatar name={user.displayName} src={user.avatarUrl} size={40} />
                        <div className="item-row-main">
                          <strong className="truncate">{user.displayName}</strong>
                          <span className="muted text-xs truncate">
                            @{user.username} · Friends since {formatDate(since, { month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="item-row-side">
                          <span className="muted text-sm row" style={{ gap: 4 }}>
                            See their lists <ChevronRight size={14} aria-hidden />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div className="friend-grid">
                  {friendsShown.map(({ user, since }) => (
                    <article className="friend-card" key={user.id}>
                      <Link to={`/app/friends/${user.id}`} className="item-card-hit" aria-label={`See ${user.displayName}'s wishlists`} />
                      <div className="friend-card-sky" aria-hidden>
                        <Cloud className="friend-card-cloud friend-card-cloud-1" />
                        <Cloud className="friend-card-cloud friend-card-cloud-2" />
                      </div>
                      <Avatar name={user.displayName} src={user.avatarUrl} size={64} />
                      <div className="friend-card-body">
                        <strong className="truncate">{user.displayName}</strong>
                        <span className="muted text-xs truncate">@{user.username}</span>
                        <span className="friend-card-since">Friends since {formatDate(since, { month: 'short', year: 'numeric' })}</span>
                      </div>
                      <span className="friend-card-cta">
                        See their lists <ChevronRight size={14} aria-hidden />
                      </span>
                    </article>
                  ))}
                </div>
              );
            })()}
          </section>

          {data.outgoing.length > 0 && (
            <section className="section">
              <div className="section-header">
                <span className="tile-header-icon" aria-hidden>
                  <Send size={13} />
                </span>
                <h2 className="section-title">Sent requests</h2>
              </div>
              <div className="list-items">
                {data.outgoing.map(({ user, createdAt }) => (
                  <div className="item-row" key={user.id}>
                    <Avatar name={user.displayName} src={user.avatarUrl} size={36} />
                    <div className="item-row-main">
                      <strong className="truncate">{user.displayName}</strong>
                      <span className="muted text-xs truncate">
                        @{user.username} · sent {relativeTime(createdAt)}
                      </span>
                    </div>
                    <div className="item-row-side">
                      <Button size="sm" variant="ghost" icon={<X size={14} />} loading={busy === `cancel:${user.id}`} onClick={() => act(`cancel:${user.id}`, () => del(`/api/friends/requests/${user.id}`), 'Request cancelled')}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <aside className="sky-note">
            <span className="tile-note-icon" aria-hidden>
              <Eye size={18} />
            </span>
            <div>
              <strong>What friends can see</strong>
              <p>
                Friends can browse your lists set to <strong>Friends</strong> or <strong>Public</strong>. Your profile visibility in Settings controls who can find you in search.
              </p>
            </div>
            <Link to="/app/settings?tab=profile" className="section-link">
              Profile visibility <ChevronRight size={14} />
            </Link>
          </aside>
        </>
      )}
      <div style={{ height: 'var(--s-12)' }} />

      <Modal
        open={manualOpen}
        onClose={closeManual}
        title="Add by username"
        subtitle="Works for private accounts too — enter their exact Wishful handle."
        size="sm"
        footer={
          <>
            <Button type="button" onClick={closeManual}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="friends-manual-add"
              variant="primary"
              icon={<UserRoundPlus size={16} />}
              loading={sending}
              disabled={handle.trim().replace(/^@/, '').length < 3}
            >
              Send request
            </Button>
          </>
        }
      >
        <form id="friends-manual-add" className="stack" onSubmit={sendByHandle}>
          <label className="field">
            <span className="field-label">Username</span>
            <div className="input-group">
              <span className="sky-form-at" aria-hidden>
                @
              </span>
              <input
                className="input"
                placeholder="username"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                aria-invalid={error ? true : undefined}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                data-autofocus
              />
            </div>
            {error && <span className="field-error">{error}</span>}
          </label>
        </form>
      </Modal>
    </div>
  );
}

function PersonAction({
  hit,
  busy,
  onAdd,
  onAccept,
  compact,
}: {
  hit: PeopleSearchHit;
  busy: string | null;
  onAdd: () => void;
  onAccept: () => void;
  compact?: boolean;
}) {
  const { user, relationship } = hit;
  if (relationship === 'self') {
    return (
      <Link to={`/u/${user.username}`} className={`btn btn-sm${compact ? '' : ' btn-primary'}`}>
        View profile
      </Link>
    );
  }
  if (relationship === 'friends') {
    return (
      <Link to={`/app/friends/${user.id}`} className="btn btn-sm">
        Friends
      </Link>
    );
  }
  if (relationship === 'outgoing') {
    return <span className="badge badge-outline">Request sent</span>;
  }
  if (relationship === 'incoming') {
    return (
      <Button size="sm" variant="primary" icon={<Check size={14} />} loading={busy === `accept:${user.id}`} onClick={onAccept}>
        Accept
      </Button>
    );
  }
  return (
    <Button size="sm" variant="primary" icon={<UserRoundPlus size={14} />} loading={busy === `search:${user.id}`} onClick={onAdd}>
      Add
    </Button>
  );
}

function PersonResult({
  hit,
  view,
  busy,
  onAdd,
  onAccept,
}: {
  hit: PeopleSearchHit;
  view: PeopleView;
  busy: string | null;
  onAdd: () => void;
  onAccept: () => void;
}) {
  const { user, relationship, profileVisibility } = hit;
  const title = relationship === 'self' ? 'Me' : user.displayName;
  const meta = (
    <>
      @{user.username} · {PROFILE_VISIBILITY_LABELS[profileVisibility as ProfileVisibility]}
      {relationship === 'self' ? ' · how others find you' : ''}
    </>
  );

  if (view === 'list') {
    return (
      <div className={['item-row', relationship === 'self' && 'people-row-me'].filter(Boolean).join(' ')}>
        <Link to={`/u/${user.username}`} className="item-row-avatar-link" aria-label={`Open @${user.username}`}>
          <Avatar name={user.displayName} src={user.avatarUrl} size={40} />
        </Link>
        <div className="item-row-main">
          <strong className="truncate">
            {title}
            {relationship === 'self' && <span className="people-me-badge">You</span>}
          </strong>
          <span className="muted text-xs truncate">{meta}</span>
        </div>
        <div className="item-row-side">
          <PersonAction hit={hit} busy={busy} onAdd={onAdd} onAccept={onAccept} compact />
        </div>
      </div>
    );
  }

  return (
    <article className={['friend-card', 'people-card', relationship === 'self' && 'people-card-me'].filter(Boolean).join(' ')}>
      <div className="friend-card-sky" aria-hidden>
        <Cloud className="friend-card-cloud friend-card-cloud-1" />
        <Cloud className="friend-card-cloud friend-card-cloud-2" />
      </div>
      <Link to={`/u/${user.username}`} className="people-card-avatar" aria-label={`Open @${user.username}`}>
        <Avatar name={user.displayName} src={user.avatarUrl} size={64} />
      </Link>
      <div className="friend-card-body">
        <strong className="truncate">
          {title}
          {relationship === 'self' && <span className="people-me-badge">You</span>}
        </strong>
        <span className="muted text-xs truncate">@{user.username}</span>
        <span className="friend-card-since">{PROFILE_VISIBILITY_LABELS[profileVisibility as ProfileVisibility]}{relationship === 'self' ? ' · how others find you' : ''}</span>
      </div>
      <div className="people-card-action">
        <PersonAction hit={hit} busy={busy} onAdd={onAdd} onAccept={onAccept} />
      </div>
    </article>
  );
}
