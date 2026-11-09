import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Copy, Gift, HandHeart, Info, Link2Off, PartyPopper, Pencil, ShoppingBag, UserRoundPlus, Users } from 'lucide-react';
import type { PublicEntry, PublicWishlistView } from '../../shared/types';
import { PRIORITY_RANK } from '../../shared/constants';
import { keys, useMe, usePublicList } from '../lib/queries';
import { ApiError, errorMessage, post } from '../lib/api';
import { countdownLabel, formatDate, possessive, relativeTime } from '../lib/format';
import { forgetClaim, getStoredClaim, importManageParam, manageLink, saveClaim, type StoredClaim } from '../lib/claimTokens';
import { recordVisit } from '../lib/visited';
import { brand } from '../config/brand';
import { Logo } from '../components/Logo';
import { ItemCard, ItemCardSkeleton } from '../components/ItemCard';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { CollectionBadge, StatusBadge } from '../components/ItemVisuals';
import { CoverArt } from '../components/CoverArt';
import { CollectionStats } from '../components/CollectionStats';
import { Button } from '../components/ui/Button';
import { Field, FormError } from '../components/ui/Field';
import { Avatar, EmptyState } from '../components/ui/misc';
import { useToast } from '../components/ui/Toast';
import { ThemeToggle } from '../components/ThemeToggle';

type Filter = 'all' | 'available' | 'mine';
type Sort = 'order' | 'priority' | 'acquired' | 'price_asc' | 'price_desc';

interface Mine {
  claim: StoredClaim | null;
  pledge: StoredClaim | null;
}

function mineFor(token: string, e: PublicEntry): Mine {
  const c = getStoredClaim(token, e.id, 'claim');
  const p = getStoredClaim(token, e.id, 'pledge');
  return {
    claim: c && e.claim && e.claim.id === c.refId ? c : null,
    pledge: p && e.pledges.some((x) => x.id === p.refId) ? p : null,
  };
}

export default function PublicWishlist() {
  const { token = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, isLoading, error } = usePublicList(token);
  const toast = useToast();

  useEffect(() => {
    const manage = params.get('manage');
    if (!manage) return;
    if (importManageParam(token, manage)) toast.success('Your reservation is now linked to this device.');
    const next = new URLSearchParams(params);
    next.delete('manage');
    setParams(next, { replace: true });
  }, [params, setParams, token, toast]);

  useEffect(() => {
    if (!data) return;
    document.title = `${data.wishlist.title} · ${brand.name}`;
    if (!data.viewer.isOwner) {
      recordVisit({ token, title: data.wishlist.title, ownerName: data.owner.displayName, accentColor: data.wishlist.accentColor, eventDate: data.wishlist.eventDate });
    }
    // Drop locally stored tokens whose reservation has expired or been released.
    if (!data.viewer.isOwner) {
      for (const e of data.entries) {
        const c = getStoredClaim(token, e.id, 'claim');
        if (c && e.status !== null && e.claim?.id !== c.refId) forgetClaim(token, e.id, 'claim');
        const p = getStoredClaim(token, e.id, 'pledge');
        if (p && !e.pledges.some((x) => x.id === p.refId)) forgetClaim(token, e.id, 'pledge');
      }
    }
  }, [data, token]);

  if (isLoading) {
    return (
      <div className="public-shell">
        <PublicHeader />
        <div className="public-content">
          <div className="grid-items">
            {Array.from({ length: 6 }, (_, i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error instanceof ApiError && error.code === 'friends_only') {
    return (
      <div className="public-shell">
        <PublicHeader />
        <div className="public-content">
          <FriendsOnly token={token} message={error.message} ownerUsername={error.fields.owner} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <div className="public-shell">
        <PublicHeader />
        <div className="public-content">
          <EmptyState
            icon={<Link2Off size={22} />}
            title={gone ? 'This wishlist isn’t available' : 'Something went wrong'}
            action={
              <Link to="/" className="btn">
                Go to {brand.name}
              </Link>
            }
          >
            {gone ? 'The link may be mistyped, or the owner has made the list private or turned off its sharing link.' : errorMessage(error)}
          </EmptyState>
        </div>
      </div>
    );
  }

  return <PublicListView view={data} token={token} />;
}

function FriendsOnly({ token, message, ownerUsername }: { token: string; message: string; ownerUsername?: string }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = encodeURIComponent(`/s/${token}`);

  const sendRequest = async () => {
    if (!ownerUsername) return;
    setBusy(true);
    try {
      const res = await post<{ status: string }>('/api/friends/requests', { username: ownerUsername });
      void qc.invalidateQueries({ queryKey: keys.friends });
      if (res.status === 'accepted') void qc.invalidateQueries({ queryKey: keys.publicList(token) });
      else setSent(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <EmptyState
      icon={<Users size={22} />}
      title="This wishlist is just for friends"
      action={
        !me ? (
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Link to={`/login?next=${next}`} className="btn btn-primary">
              Sign in
            </Link>
            <Link to={`/register?next=${next}`} className="btn">
              Create an account
            </Link>
          </div>
        ) : ownerUsername && !sent ? (
          <Button variant="primary" icon={<UserRoundPlus size={16} />} loading={busy} onClick={sendRequest}>
            Send @{ownerUsername} a friend request
          </Button>
        ) : (
          <Link to="/app/friends" className="btn">
            Go to Friends
          </Link>
        )
      }
    >
      {sent ? 'Request sent! You’ll be able to open this list once they accept.' : message}
    </EmptyState>
  );
}

function PublicHeader() {
  const { data: me } = useMe();
  return (
    <header className="public-header">
      <Logo to="/" size={28} />
      <div className="spacer" />
      {me ? (
        <Link to="/app" className="btn btn-sm">
          My {brand.name}
        </Link>
      ) : (
        <Link to="/register" className="btn btn-sm">
          <span className="hide-xs">Create your own wishlist</span>
          <span className="show-xs">Sign up free</span>
        </Link>
      )}
      <ThemeToggle />
    </header>
  );
}

function PublicListView({ view, token }: { view: PublicWishlistView; token: string }) {
  const { wishlist: w, owner, entries, viewer } = view;
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('order');
  const [tick, setTick] = useState(0);
  const refreshMine = () => setTick((t) => t + 1);

  // `tick` forces a re-read of tokens from localStorage after a claim changes.
  const mine = useMemo(() => new Map(entries.map((e) => [e.id, mineFor(token, e)])), [entries, token, tick]);
  const myCount = [...mine.values()].filter((m) => m.claim || m.pledge).length;

  const shown = useMemo(() => {
    let list = entries.filter((e) => {
      if (filter === 'available') return e.status === 'available';
      if (filter === 'mine') {
        const m = mine.get(e.id);
        return Boolean(m?.claim || m?.pledge);
      }
      return true;
    });
    if (sort !== 'order') {
      list = [...list];
      const price = (e: PublicEntry) => e.item.price ?? e.item.metadata.suggestedAmount ?? e.item.metadata.budget ?? null;
      if (sort === 'priority') list.sort((a, b) => (a.priority ? PRIORITY_RANK[a.priority] : 9) - (b.priority ? PRIORITY_RANK[b.priority] : 9));
      if (sort === 'acquired') list.sort((a, b) => (b.item.owned?.acquiredOn ?? '').localeCompare(a.item.owned?.acquiredOn ?? ''));
      if (sort === 'price_asc') list.sort((a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity));
      if (sort === 'price_desc') list.sort((a, b) => (price(b) ?? -1) - (price(a) ?? -1));
    }
    return list;
  }, [entries, filter, sort, mine]);

  const openId = params.get('item');
  const openEntry = openId ? entries.find((e) => e.id === openId) ?? null : null;
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('item', id);
    else next.delete('item');
    setParams(next, { replace: !id });
  };

  const days = countdownLabel(w.eventDate);
  const firstName = owner.displayName.split(' ')[0];
  const collection = w.kind === 'collection';
  const canClaim = !collection && w.settings.allowClaims && !viewer.isOwner;
  const thingCount = collection ? entries.reduce((n, e) => n + (e.item.owned?.quantity ?? 1), 0) : entries.length;

  const badge = (e: PublicEntry) => {
    const m = mine.get(e.id);
    if (e.groupGift && e.status === 'available' && e.pledges.length > 0) {
      return (
        <span className="badge badge-info">
          <Users aria-hidden /> {m?.pledge ? "You're in" : `${e.pledges.length} chipping in`}
        </span>
      );
    }
    if (!e.status || e.status === 'available') return null;
    return <StatusBadge status={e.status} mine={Boolean(m?.claim) || (e.status === 'purchased' && m?.pledge?.role === 'coordinator')} />;
  };

  return (
    <div className="public-shell" style={{ ['--wl-accent' as string]: w.accentColor }}>
      <PublicHeader />

      {viewer.isOwner && (
        <div className="public-hero" style={{ marginBottom: 'var(--s-4)' }}>
          <div className="notice notice-accent" style={{ marginBottom: 0 }}>
            <Info size={18} aria-hidden />
            <div style={{ flex: 1 }}>
              <strong>This is your shared page.</strong> It's what friends and family see.{' '}
              {collection
                ? 'What you paid stays private.'
                : viewer.claimsHidden
                  ? 'Surprise Mode is on, so reservations are hidden from you here too.'
                  : 'Reservation details are visible to you because Surprise Mode is off.'}
            </div>
            <Link to={`/app/lists/${w.id}`} className="btn btn-sm">
              <Pencil size={14} aria-hidden /> Edit list
            </Link>
          </div>
        </div>
      )}

      <section className="public-hero">
        <div className="public-cover">
          {w.coverImage ? <img src={w.coverImage} alt="" referrerPolicy="no-referrer" /> : w.coverArt ? <CoverArt art={w.coverArt} /> : <div className="wl-cover-tint" />}
        </div>
        <div className="public-intro">
          <Avatar name={owner.displayName} src={owner.avatarUrl} size={80} />
          <p className="muted text-sm">
            {possessive(owner.displayName)} {collection ? 'collection' : 'wishlist'}
          </p>
          <h1 className="public-title display">{w.title}</h1>
          {w.description && (
            <p className="muted" style={{ maxWidth: 560, whiteSpace: 'pre-line' }}>
              {w.description}
            </p>
          )}
          <div className="public-meta">
            {w.eventDate && (
              <span className="badge badge-outline">
                <CalendarDays aria-hidden /> {w.occasion ? `${w.occasion} · ` : ''}
                {formatDate(w.eventDate, { month: 'long', day: 'numeric', year: 'numeric' })}
                {days && days !== 'Passed' && !/\d{4}/.test(days) ? ` · ${days}` : ''}
              </span>
            )}
            {!w.eventDate && w.occasion && <span className="badge badge-outline">{w.occasion}</span>}
            {collection && <CollectionBadge outline />}
            <span className="badge badge-outline">
              <Gift aria-hidden /> {thingCount} {collection ? (thingCount === 1 ? 'thing' : 'things') : thingCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
      </section>

      <main id="main" className="public-content">
        {canClaim && entries.length > 0 && (
          <div className="how-it-works">
            <HandHeart size={20} aria-hidden style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div>
              <strong>Planning to give something?</strong> Open an item and reserve it so nobody else buys the same thing. No account needed
              {w.surpriseMode ? ` — and ${firstName} won't see who reserved what.` : '.'}
            </div>
          </div>
        )}

        {collection && entries.length > 0 && <CollectionStats items={entries.map((e) => e.item)} />}

        {entries.length > 0 && (
          <div className="toolbar">
            {!collection && (
              <div className="filter-row" style={{ marginBottom: 0 }} role="group" aria-label="Filter">
                <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                  All
                </button>
                {entries.some((e) => e.status !== null) && (
                  <button type="button" className="chip" aria-pressed={filter === 'available'} onClick={() => setFilter('available')}>
                    Available
                  </button>
                )}
                {myCount > 0 && (
                  <button type="button" className="chip" aria-pressed={filter === 'mine'} onClick={() => setFilter('mine')}>
                    My gifts <span style={{ opacity: 0.6 }}>{myCount}</span>
                  </button>
                )}
              </div>
            )}
            <div className="spacer" />
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
              <option value="order">{possessive(owner.displayName)} order</option>
              {w.settings.showPriorities && !collection && <option value="priority">Most wanted first</option>}
              {collection && <option value="acquired">Recently acquired</option>}
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </div>
        )}

        {entries.length === 0 ? (
          <EmptyState icon={<Gift size={22} />} title="Nothing here yet">
            {firstName} hasn't added anything to this list yet. Check back soon!
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState icon={<Gift size={22} />} title="Nothing to show">
            No items match this filter.
          </EmptyState>
        ) : (
          <div className="grid-items">
            {shown.map((e) => (
              <ItemCard
                key={e.id}
                item={e.item}
                priority={collection ? null : e.priority}
                owned={collection ? e.item.owned : null}
                status={badge(e)}
                dimmed={e.status === 'purchased' || (e.status === 'reserved' && !mine.get(e.id)?.claim)}
                groupGift={e.groupGift}
                onOpen={() => setOpen(e.id)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="public-footer">
        <Logo to="/" size={22} />
        <p style={{ marginTop: 8 }}>
          {brand.tagline}{' '}
          <Link to="/register" style={{ textDecoration: 'underline' }}>
            Make your own wishlist
          </Link>
        </p>
      </footer>

      {openEntry && (
        <ItemDetailModal
          item={openEntry.item}
          onClose={() => setOpen(null)}
          priority={collection ? null : openEntry.priority}
          entryNote={collection ? undefined : openEntry.customNotes}
          badges={badge(openEntry)}
        >
          {!collection && <GiftBox entry={openEntry} view={view} token={token} mine={mine.get(openEntry.id) ?? { claim: null, pledge: null }} onChange={refreshMine} />}
        </ItemDetailModal>
      )}
    </div>
  );
}

// ── Reservation / group gift box ────────────────────────────────────────────

function GiftBox({ entry, view, token, mine, onChange }: { entry: PublicEntry; view: PublicWishlistView; token: string; mine: Mine; onChange: () => void }) {
  const { wishlist: w, viewer, owner } = view;
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstName = owner.displayName.split(' ')[0];
  const base = `/api/public/lists/${token}/entries/${entry.id}`;

  const refresh = () => {
    onChange();
    return qc.invalidateQueries({ queryKey: keys.publicList(token) });
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiError && (err.status === 409 || err.status === 404)) void refresh();
    } finally {
      setBusy(null);
    }
  };

  if (viewer.isOwner) {
    return (
      <div className="claim-box">
        <p className="text-sm muted">
          {viewer.claimsHidden
            ? 'Visitors can reserve this item here. Surprise Mode keeps who reserved it hidden from you.'
            : entry.claim
              ? `${entry.status === 'purchased' ? 'Purchased' : 'Reserved'} by ${entry.claim.name || 'someone'} ${relativeTime(entry.claim.reservedAt)}.`
              : 'Visitors can reserve this item here.'}
        </p>
      </div>
    );
  }

  if (!w.settings.allowClaims) {
    return (
      <div className="claim-box">
        <p className="text-sm muted">{firstName} isn't tracking reservations on this list — coordinate with others directly.</p>
      </div>
    );
  }

  if (entry.groupGift) return <GroupGiftBox entry={entry} view={view} token={token} mine={mine} run={run} busy={busy} error={error} />;

  // Mine
  if (mine.claim) {
    const claimToken = mine.claim.token;
    const purchased = entry.status === 'purchased';
    return (
      <div className="claim-box">
        <strong className="row" style={{ gap: 8 }}>
          {purchased ? <PartyPopper size={18} aria-hidden /> : <Check size={18} aria-hidden />}
          {purchased ? 'You bought this — thank you!' : 'You reserved this'}
        </strong>
        {!purchased && entry.claim?.expiresAt && <p className="text-sm muted">Your reservation lasts until {formatDate(entry.claim.expiresAt)}. Mark it purchased once you've bought it.</p>}
        <FormError message={error} />
        <div className="row-wrap">
          {!purchased && w.settings.allowMarkPurchased && (
            <Button
              variant="primary"
              icon={<ShoppingBag size={16} />}
              loading={busy === 'purchase'}
              onClick={() =>
                run('purchase', async () => {
                  await post(`${base}/purchase`, { claimToken });
                  toast.success('Marked as purchased');
                })
              }
            >
              I bought it
            </Button>
          )}
          <Button
            variant="ghost"
            loading={busy === 'release'}
            onClick={() =>
              run('release', async () => {
                await post(`${base}/release`, { claimToken });
                forgetClaim(token, entry.id, 'claim');
                toast.success(purchased ? 'Purchase undone — the item is available again' : 'Reservation released');
              })
            }
          >
            {purchased ? 'Undo' : 'Release reservation'}
          </Button>
        </div>
        <ManageLink token={token} entryId={entry.id} claim={mine.claim} />
      </div>
    );
  }

  if (entry.status === 'reserved' || entry.status === 'purchased') {
    return (
      <div className="claim-box">
        <strong>{entry.status === 'purchased' ? 'Already purchased' : 'Already reserved'}</strong>
        <p className="text-sm muted">
          {entry.claim?.name ? `${entry.claim.name} ${entry.status === 'purchased' ? 'bought' : 'is getting'} this` : `Someone ${entry.status === 'purchased' ? 'bought' : 'is getting'} this`}. Pick something else to make {firstName}'s day.
        </p>
        {entry.claim?.message && <p className="text-sm">“{entry.claim.message}”</p>}
      </div>
    );
  }

  return <ReserveForm entry={entry} view={view} token={token} run={run} busy={busy} error={error} />;
}

function ReserveForm({
  entry,
  view,
  token,
  run,
  busy,
  error,
}: {
  entry: PublicEntry;
  view: PublicWishlistView;
  token: string;
  run: (key: string, fn: () => Promise<void>) => Promise<void>;
  busy: string | null;
  error: string | null;
}) {
  const { wishlist: w, owner } = view;
  const toast = useToast();
  const [name, setName] = useState(() => localStorage.getItem('wishful.visitorName') ?? '');
  const [message, setMessage] = useState('');
  const firstName = owner.displayName.split(' ')[0];

  const submit = (markPurchased: boolean) => (e?: FormEvent) => {
    e?.preventDefault();
    void run(markPurchased ? 'buy' : 'reserve', async () => {
      const res = await post<{ claimToken: string; claimId: string; status: string; expiresAt: string | null }>(`/api/public/lists/${token}/entries/${entry.id}/claim`, {
        name: name.trim() || undefined,
        message: message.trim() || undefined,
        markPurchased,
      });
      try {
        if (name.trim()) localStorage.setItem('wishful.visitorName', name.trim());
      } catch {
        /* ignore */
      }
      saveClaim(token, entry.id, { kind: 'claim', token: res.claimToken, refId: res.claimId, title: entry.item.title, createdAt: new Date().toISOString() });
      toast.success(markPurchased ? 'Marked as purchased — thank you!' : 'Reserved! Nobody else can claim it now.');
    });
  };

  return (
    <form className="claim-box" onSubmit={submit(false)}>
      <strong>Getting this for {firstName}?</strong>
      <p className="text-sm muted" style={{ marginTop: -6 }}>
        Reserve it so nobody else buys the same thing{w.surpriseMode ? `. ${firstName} won't see who reserved it` : ''}.
        {w.settings.reservationDays > 0 ? ` Reservations last ${w.settings.reservationDays} days.` : ''}
      </p>
      <FormError message={error} />
      <Field label="Your name" optional hint={w.surpriseMode ? 'Shown to other gift-givers so you can coordinate.' : `Shown to other gift-givers and to ${firstName}.`}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
      </Field>
      {w.settings.allowMessages && (
        <Field label="Message" optional>
          <textarea className="textarea" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
        </Field>
      )}
      <div className="row-wrap">
        <Button type="submit" variant="primary" icon={<Gift size={16} />} loading={busy === 'reserve'} disabled={Boolean(busy)}>
          Reserve this gift
        </Button>
        {w.settings.allowMarkPurchased && (
          <Button icon={<ShoppingBag size={16} />} loading={busy === 'buy'} disabled={Boolean(busy)} onClick={() => submit(true)()}>
            I already bought it
          </Button>
        )}
      </div>
    </form>
  );
}

function GroupGiftBox({
  entry,
  view,
  token,
  mine,
  run,
  busy,
  error,
}: {
  entry: PublicEntry;
  view: PublicWishlistView;
  token: string;
  mine: Mine;
  run: (key: string, fn: () => Promise<void>) => Promise<void>;
  busy: string | null;
  error: string | null;
}) {
  const { wishlist: w } = view;
  const toast = useToast();
  const [name, setName] = useState(() => localStorage.getItem('wishful.visitorName') ?? '');
  const [message, setMessage] = useState('');
  const hasCoordinator = entry.pledges.some((p) => p.role === 'coordinator');
  const [coordinator, setCoordinator] = useState(false);
  const base = `/api/public/lists/${token}/entries/${entry.id}`;
  const purchased = entry.status === 'purchased';

  const join = (e: FormEvent) => {
    e.preventDefault();
    void run('join', async () => {
      const res = await post<{ pledgeToken: string; pledgeId: string; role: 'coordinator' | 'contributor' }>(`${base}/pledges`, {
        name: name.trim(),
        message: message.trim() || undefined,
        coordinator: coordinator && !hasCoordinator,
      });
      try {
        localStorage.setItem('wishful.visitorName', name.trim());
      } catch {
        /* ignore */
      }
      saveClaim(token, entry.id, { kind: 'pledge', token: res.pledgeToken, refId: res.pledgeId, role: res.role, title: entry.item.title, createdAt: new Date().toISOString() });
      toast.success(res.role === 'coordinator' ? "You're coordinating this group gift" : "You've joined the group gift");
    });
  };

  return (
    <div className="claim-box">
      <strong className="row" style={{ gap: 8 }}>
        <Users size={18} aria-hidden /> Group gift
      </strong>
      {entry.groupGiftNote && <p className="text-sm">{entry.groupGiftNote}</p>}
      <p className="text-sm muted" style={{ marginTop: -4 }}>
        Several people can chip in together. The coordinator buys the gift and sorts out contributions with the group directly — no payments happen on {brand.name}.
      </p>

      {entry.pledges.length > 0 && (
        <div className="pledge-list">
          {entry.pledges.map((p) => (
            <div className="pledge" key={p.id}>
              <Avatar name={p.name} size={26} />
              <div style={{ minWidth: 0 }}>
                <strong>{p.name}</strong>
                {p.id === mine.pledge?.refId && <span className="muted"> (you)</span>}{' '}
                {p.role === 'coordinator' && <span className="badge badge-accent">Coordinator</span>}
                {p.message && <p className="muted">{p.message}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <FormError message={error} />

      {purchased ? (
        <>
          <p className="text-sm">
            <strong>This group gift has been purchased.</strong>
          </p>
          {mine.pledge?.role === 'coordinator' && (
            <Button
              variant="ghost"
              loading={busy === 'undo'}
              onClick={() =>
                run('undo', async () => {
                  await post(`${base}/release`, { claimToken: mine.pledge!.token });
                  toast.success('Purchase undone');
                })
              }
            >
              Undo purchase
            </Button>
          )}
        </>
      ) : mine.pledge ? (
        <>
          <p className="text-sm">{mine.pledge.role === 'coordinator' ? "You're coordinating — mark it purchased once it's bought." : "You're in! The coordinator will be in touch."}</p>
          <div className="row-wrap">
            {mine.pledge.role === 'coordinator' && (
              <Button
                variant="primary"
                icon={<ShoppingBag size={16} />}
                loading={busy === 'gp'}
                onClick={() =>
                  run('gp', async () => {
                    await post(`${base}/group-purchased`, { pledgeToken: mine.pledge!.token });
                    toast.success('Marked as purchased');
                  })
                }
              >
                Mark as purchased
              </Button>
            )}
            <Button
              variant="ghost"
              loading={busy === 'withdraw'}
              onClick={() =>
                run('withdraw', async () => {
                  await post(`${base}/pledges/withdraw`, { pledgeToken: mine.pledge!.token });
                  forgetClaim(token, entry.id, 'pledge');
                  toast.success('You left the group gift');
                })
              }
            >
              Leave group
            </Button>
          </div>
          <ManageLink token={token} entryId={entry.id} claim={mine.pledge} />
        </>
      ) : (
        <form className="stack-sm" onSubmit={join}>
          <Field label="Your name" hint="Shown to others in the group.">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoComplete="name" />
          </Field>
          {w.settings.allowMessages && (
            <Field label="Message" optional>
              <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} placeholder="Count me in for $20" />
            </Field>
          )}
          {!hasCoordinator && (
            <label className="check">
              <input type="checkbox" checked={coordinator} onChange={(e) => setCoordinator(e.target.checked)} />
              <span>I'll coordinate — buy the gift and collect contributions</span>
            </label>
          )}
          <Button type="submit" variant="primary" icon={<HandHeart size={16} />} loading={busy === 'join'} disabled={!name.trim()} style={{ alignSelf: 'flex-start' }}>
            Join group gift
          </Button>
        </form>
      )}
    </div>
  );
}

function ManageLink({ token, entryId, claim }: { token: string; entryId: string; claim: StoredClaim }) {
  const [copied, setCopied] = useState(false);
  const link = manageLink(token, entryId, claim);
  return (
    <details className="disclosure">
      <summary className="text-sm">Manage from another device</summary>
      <div className="stack-sm" style={{ marginTop: 8 }}>
        <p className="text-xs muted">This page remembers your {claim.kind === 'claim' ? 'reservation' : 'spot'} on this device. Keep this private link to manage it elsewhere.</p>
        <div className="row">
          <input className="input" readOnly value={link} aria-label="Private manage link" onFocus={(e) => e.target.select()} style={{ fontSize: 12 }} />
          <Button
            size="sm"
            icon={copied ? <Check size={14} /> : <Copy size={14} />}
            onClick={() => {
              void navigator.clipboard?.writeText(link).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
    </details>
  );
}
