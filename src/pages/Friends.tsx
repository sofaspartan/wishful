import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Copy, Eye, Inbox, Search, Send, UserRoundPlus, Users, X } from 'lucide-react';
import type { FriendsOverview, PeopleSearchHit, ProfileVisibility, SelfUser } from '../../shared/types';
import { PROFILE_VISIBILITY_LABELS, isDiscoverableProfile } from '../../shared/constants';
import { keys, useFriends, useMe } from '../lib/queries';
import { del, errorMessage, fieldErrors, get, post } from '../lib/api';
import { formatDate, relativeTime } from '../lib/format';
import { Button } from '../components/ui/Button';
import { Avatar, EmptyState, PageLoader } from '../components/ui/misc';
import { useToast } from '../components/ui/Toast';
import { Cloud } from '../components/Cloud';
import { PageSky } from '../components/PageSky';
import { SkyArt } from '../components/SkyArt';

type RequestResult = { status: 'requested' | 'already_requested' | 'accepted'; overview: FriendsOverview };
type Tab = 'search' | 'friends';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'search', label: 'Search' },
  { id: 'friends', label: 'Your friends' },
];

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
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'friends' ? 'friends' : 'search';
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PeopleSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

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
      setTab('friends');
    } catch (err) {
      setError(fieldErrors(err).username ?? errorMessage(err));
    } finally {
      setSending(false);
    }
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

  return (
    <div className="page">
      <PageSky
        eyebrow="Friends"
        title="Your people"
        subtitle="Find people on Wishful, send a friend request, and browse the lists they share with you."
        art={<SkyArt scene="friends" />}
      >
        {me && (
          <div className="sky-handle">
            <span>Your username</span>
            <code>@{me.username}</code>
            <button type="button" className="sky-handle-copy" onClick={copyUsername}>
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </PageSky>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Friends sections" style={{ borderBottom: 0 }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === 'friends' && data && data.friends.length > 0 && <span className="faint">{data.friends.length}</span>}
              {t.id === 'friends' && incoming > 0 && <span className="nav-badge">{incoming}</span>}
            </button>
          ))}
        </div>
      </div>

      {tab === 'search' ? (
        <section className="section" aria-label="Search for people">
          <div className="people-search stack" style={{ gap: 'var(--s-6)' }}>
            <div className="stack" style={{ gap: 'var(--s-3)' }}>
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
              <p className="field-hint">
                Public and friends profiles show up here. Private accounts won’t appear — use their exact handle below if you know it.
              </p>
            </div>

            <form className="sky-form" onSubmit={sendByHandle} style={{ margin: 0 }}>
              <span className="field-label">Or add by handle</span>
              <div className="sky-form-row">
                <span className="sky-form-at" aria-hidden>
                  @
                </span>
                <input
                  className="input"
                  placeholder="username"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  aria-label="Friend's username"
                  aria-invalid={error ? true : undefined}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <Button type="submit" variant="primary" icon={<UserRoundPlus size={16} />} loading={sending} disabled={handle.trim().replace(/^@/, '').length < 3}>
                  Add
                </Button>
              </div>
              {error && <span className="field-error">{error}</span>}
            </form>

            {searching && <p className="muted text-sm">Searching…</p>}

            {displayed && !searching && (
              displayed.length ? (
                <div className="list-items list-items-sky">
                  {displayed.map((hit) => (
                    <PersonRow key={hit.user.id} hit={hit} busy={busy} onAdd={() => requestFromSearch(hit)} onAccept={() => act(`accept:${hit.user.id}`, () => post(`/api/friends/requests/${hit.user.id}/accept`), `You and ${hit.user.displayName} are now friends`)} />
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

          <section className="section">
            <div className="section-header">
              <span className="tile-header-icon" aria-hidden>
                <Users size={14} />
              </span>
              <h2 className="section-title">Your friends</h2>
              {data.friends.length > 0 && <span className="muted text-sm">{data.friends.length}</span>}
            </div>
            {data.friends.length ? (
              <div className="friend-grid">
                {data.friends.map(({ user, since }) => (
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
            ) : (
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
            )}
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
    </div>
  );
}

function PersonRow({
  hit,
  busy,
  onAdd,
  onAccept,
}: {
  hit: PeopleSearchHit;
  busy: string | null;
  onAdd: () => void;
  onAccept: () => void;
}) {
  const { user, relationship, profileVisibility } = hit;
  return (
    <div className={['item-row', relationship === 'self' && 'people-row-me'].filter(Boolean).join(' ')}>
      <Link to={`/u/${user.username}`} className="item-row-avatar-link" aria-label={`Open @${user.username}`}>
        <Avatar name={user.displayName} src={user.avatarUrl} size={40} />
      </Link>
      <div className="item-row-main">
        <strong className="truncate">
          {relationship === 'self' ? 'Me' : user.displayName}
          {relationship === 'self' && <span className="people-me-badge">You</span>}
        </strong>
        <span className="muted text-xs truncate">
          @{user.username} · {PROFILE_VISIBILITY_LABELS[profileVisibility as ProfileVisibility]}
          {relationship === 'self' ? ' · how others find you' : ''}
        </span>
      </div>
      <div className="item-row-side">
        {relationship === 'self' ? (
          <Link to={`/u/${user.username}`} className="btn btn-sm">
            View profile
          </Link>
        ) : relationship === 'friends' ? (
          <Link to={`/app/friends/${user.id}`} className="btn btn-sm">
            Friends
          </Link>
        ) : relationship === 'outgoing' ? (
          <span className="badge badge-outline">Request sent</span>
        ) : relationship === 'incoming' ? (
          <Button size="sm" variant="primary" icon={<Check size={14} />} loading={busy === `accept:${user.id}`} onClick={onAccept}>
            Accept
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon={<UserRoundPlus size={14} />} loading={busy === `search:${user.id}`} onClick={onAdd}>
            Add
          </Button>
        )}
      </div>
    </div>
  );
}
