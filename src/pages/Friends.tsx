import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Copy, Eye, Inbox, Send, UserRoundPlus, Users, X } from 'lucide-react';
import type { FriendsOverview } from '../../shared/types';
import { keys, useFriends, useMe } from '../lib/queries';
import { del, errorMessage, fieldErrors, post } from '../lib/api';
import { formatDate, relativeTime } from '../lib/format';
import { Button } from '../components/ui/Button';
import { Avatar, EmptyState, PageLoader } from '../components/ui/misc';
import { useToast } from '../components/ui/Toast';
import { Cloud } from '../components/Cloud';
import { PageSky } from '../components/PageSky';
import { SkyArt } from '../components/SkyArt';

type RequestResult = { status: 'requested' | 'already_requested' | 'accepted'; overview: FriendsOverview };

export default function Friends() {
  const { data: me } = useMe();
  const { data, isLoading } = useFriends();
  const qc = useQueryClient();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const apply = (overview: FriendsOverview) => {
    qc.setQueryData(keys.friends, overview);
    void qc.invalidateQueries({ queryKey: ['friend'] });
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await post<RequestResult>('/api/friends/requests', { username });
      apply(res.overview);
      const handle = `@${username.trim().replace(/^@/, '').toLowerCase()}`;
      if (res.status === 'accepted') toast.success(`You and ${handle} are now friends`);
      else if (res.status === 'already_requested') toast.info(`You've already sent ${handle} a request`);
      else toast.success(`Friend request sent to ${handle}`);
      setUsername('');
    } catch (err) {
      setError(fieldErrors(err).username ?? errorMessage(err));
    } finally {
      setSending(false);
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

  return (
    <div className="page">
      <PageSky
        eyebrow="Friends"
        title="Your people"
        subtitle="Browse the wishlists your friends share with you, and choose which of yours they can see."
        art={<SkyArt scene="friends" />}
      >
        <form className="sky-form" onSubmit={send}>
          <div className="sky-form-row">
            <span className="sky-form-at" aria-hidden>
              @
            </span>
            <input
              className="input"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-label="Friend's username"
              aria-invalid={error ? true : undefined}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <Button type="submit" variant="primary" icon={<UserRoundPlus size={16} />} loading={sending} disabled={username.trim().replace(/^@/, '').length < 3}>
              <span className="hide-xs">Send request</span>
              <span className="show-xs">Add</span>
            </Button>
          </div>
          {error && <span className="field-error">{error}</span>}
        </form>
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

      {isLoading || !data ? (
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
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busy === `decline:${user.id}`}
                        onClick={() => act(`decline:${user.id}`, () => del(`/api/friends/requests/${user.id}`), 'Request declined')}
                      >
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
              <EmptyState art={<SkyArt scene="invite" />} title="No friends yet">
                Send a request with someone's username above. Once they accept, you'll be able to browse each other's wishlists here.
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
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<X size={14} />}
                        loading={busy === `cancel:${user.id}`}
                        onClick={() => act(`cancel:${user.id}`, () => del(`/api/friends/requests/${user.id}`), 'Request cancelled')}
                      >
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
                Friends can browse your lists set to <strong>Friends</strong> or <strong>Public</strong>, and reserve gifts on them. Private and Unlisted lists never show up, and
                Surprise Mode still keeps reservations hidden from you.
              </p>
            </div>
            <Link to="/app/lists" className="section-link">
              Choose list visibility <ChevronRight size={14} />
            </Link>
          </aside>
        </>
      )}
      <div style={{ height: 'var(--s-12)' }} />
    </div>
  );
}
