import { useMemo, type ReactElement, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, CalendarHeart, Gift, Library, LifeBuoy, Plus, Sparkles } from 'lucide-react';
import type { Item, WishlistSummary } from '../../shared/types';
import { joinNames } from '../../shared/constants';
import { useItems, useMe, useNotifications, useSharedWishlists, useWishlists } from '../lib/queries';
import { countdownLabel, daysUntil, formatDate, formatPrice, greeting, parseDateOnly, relativeTime } from '../lib/format';
import { useLocalPref } from '../lib/prefs';
import { useAppActions } from '../components/appActions';
import { ItemImage } from '../components/ItemVisuals';
import { effectivePrice } from '../components/ItemForm';
import { CloudBank } from '../components/Cloud';
import { FEATURE_ILLUSTRATIONS, ILLUSTRATED_ITEMS } from '../components/ItemIllustrations';
import { SkyArt } from '../components/SkyArt';
import { WishlistCard, WishlistListThumb } from '../components/WishlistCard';
import { CARD_LIST_VIEWS, ViewToggle, type CardListView } from '../components/ViewToggle';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';

const LIST_ROWS = 4;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export default function Home() {
  const { data: me } = useMe();
  const { data: lists, isLoading: listsLoading } = useWishlists();
  const { data: shared = [] } = useSharedWishlists();
  const { data: itemsData, isLoading: itemsLoading } = useItems();
  const { data: notifications = [] } = useNotifications();
  const { openAddItem, openCreateWishlist } = useAppActions();
  const navigate = useNavigate();
  const [listsView, setListsView] = useLocalPref<CardListView>('home.listsView', 'grid', CARD_LIST_VIEWS);

  const active = useMemo(() => (lists ?? []).filter((w) => !w.archivedAt), [lists]);
  const wishlists = active.filter((w) => w.kind !== 'collection');
  const collections = active.filter((w) => w.kind === 'collection');
  const items = useMemo(() => itemsData?.items ?? [], [itemsData]);
  const ownedCount = items.filter((i) => i.owned).length;
  const recentItems = useMemo(() => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6), [items]);
  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [...active, ...shared.filter((w) => !w.archivedAt)]
      .filter((w) => w.eventDate && parseDateOnly(w.eventDate) >= today)
      .sort((a, b) => a.eventDate!.localeCompare(b.eventDate!))
      .slice(0, 4);
  }, [active, shared]);

  const firstName = me?.displayName.split(' ')[0] ?? '';
  const loading = listsLoading || itemsLoading;
  const isNew = !loading && active.length === 0 && items.length === 0;
  const next = upcoming[0];
  const lead = isNew
    ? 'Start with something you’re wishing for — or something you already love.'
    : next && (daysUntil(next.eventDate) ?? 99) < 60
      ? `${next.title} is ${countdownLabel(next.eventDate).toLowerCase()}.`
      : 'Here’s what’s happening with your wishlists and collections.';

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const newCollection = () => openCreateWishlist({ kind: 'collection' });

  return (
    <div className="page">
      <div className="bento">
        <section className="tile tile-sky span-4">
          <SkyArt scene="hello" className="tile-sky-scene" />
          <div className="tile-sky-copy">
            <p className="tile-sky-date">{today}</p>
            <h1 className="display">
              {greeting()}
              {firstName && (
                <>
                  , <span className="tile-sky-name">{firstName}</span>
                </>
              )}
            </h1>
            <p className="tile-sky-lead">{lead}</p>
            {!isNew && (
              <div className="sky-stats">
                <Link to="/app/lists" className="sky-stat">
                  <strong>{loading ? '–' : wishlists.length}</strong> {wishlists.length === 1 ? 'wishlist' : 'wishlists'}
                </Link>
                <Link to="/app/lists" className="sky-stat">
                  <strong>{loading ? '–' : collections.length}</strong> {collections.length === 1 ? 'collection' : 'collections'}
                </Link>
                <Link to="/app/items" className="sky-stat">
                  <strong>{loading ? '–' : items.length}</strong> saved
                  {ownedCount > 0 && <span className="sky-stat-sub">· {ownedCount} you have</span>}
                </Link>
              </div>
            )}
            <div className="tile-sky-actions">
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => openAddItem()}>
                Add item
              </Button>
              <Button icon={<Gift size={16} />} onClick={() => openCreateWishlist()}>
                New wishlist
              </Button>
              <Button icon={<Library size={16} />} onClick={newCollection} className="hide-xs">
                New collection
              </Button>
            </div>
          </div>
          <CloudBank className="tile-sky-bank" />
        </section>

        {me && !me.recoveryCodeCreatedAt && (
          <section className="tile span-4 recovery-nudge">
            <span className="tile-header-icon" aria-hidden>
              <LifeBuoy size={15} />
            </span>
            <div className="recovery-nudge-copy">
              <strong>Set up a recovery code</strong>
              <span className="muted text-sm">It’s how you get back into your account if you ever forget your password.</span>
            </div>
            <Link to="/app/settings?tab=account" className="btn btn-sm">
              Set it up
            </Link>
          </section>
        )}

        <QuickAction art={FEATURE_ILLUSTRATIONS.store} title="Paste a link" hint="From any online store" onClick={() => openAddItem({ mode: 'link' })} />
        <QuickAction art={FEATURE_ILLUSTRATIONS.idea} title="Write an idea" hint="Experiences, wishes" onClick={() => openAddItem({ mode: 'idea' })} />
        <QuickAction art={ILLUSTRATED_ITEMS[0].art} title="Upload a photo" hint="Snap it, save it" onClick={() => openAddItem({ mode: 'upload' })} />
        <QuickAction art={FEATURE_ILLUSTRATIONS.collection} title="Start a collection" hint="Things you already have" onClick={newCollection} tone="blush" />

        <ListTile
          title="Wishlists"
          icon={<Gift size={15} />}
          lists={wishlists}
          loading={listsLoading}
          view={listsView}
          onViewChange={setListsView}
          empty={
            <EmptyState
              art={<SkyArt scene="wishlist" />}
              title="No wishlists yet"
              action={
                <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => openCreateWishlist()}>
                  New wishlist
                </Button>
              }
            >
              Birthdays, holidays, a new home — start one for whatever’s next.
            </EmptyState>
          }
        />
        <ListTile
          tone="blush"
          title="Collections"
          icon={<Library size={15} />}
          lists={collections}
          loading={listsLoading}
          view={listsView}
          onViewChange={setListsView}
          empty={
            <EmptyState
              tone="blush"
              art={<SkyArt scene="collection" />}
              title="No collections yet"
              action={
                <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={newCollection}>
                  Start a collection
                </Button>
              }
            >
              Keep track of what you already have — records, sneakers, books, plants.
            </EmptyState>
          }
        />

        <section className="tile span-2 tile-flush">
          <TileHeader title="Upcoming" icon={<CalendarHeart size={15} />} />
          {upcoming.length ? (
            <div className="tile-rows">
              {upcoming.map((w) => {
                const d = parseDateOnly(w.eventDate!);
                return (
                  <Link key={w.id} to={`/app/lists/${w.id}`} className="tile-row">
                    <span className="date-tile" aria-hidden>
                      <small>{d.toLocaleDateString(undefined, { month: 'short' })}</small>
                      <strong>{d.getDate()}</strong>
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <strong className="truncate" style={{ display: 'block', fontWeight: 600 }}>
                        {w.title}
                      </strong>
                      <span className="muted text-sm">
                        {w.recipients.length ? `For ${joinNames(w.recipients.map((r) => r.name))} · ` : w.role !== 'owner' ? `${w.owner.displayName.split(' ')[0]} · ` : ''}
                        {w.occasion || formatDate(w.eventDate)}
                      </span>
                    </span>
                    <span className="badge badge-accent">{countdownLabel(w.eventDate)}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <TileNote icon={<CalendarHeart size={17} />}>Add a date to a wishlist and it will show up here with a countdown.</TileNote>
          )}
        </section>

        <section className="tile span-2 tile-flush">
          <TileHeader title="Recent activity" icon={<Bell size={15} />} />
          {notifications.length ? (
            <div className="tile-rows">
              {notifications.slice(0, 4).map((n) =>
                n.link ? (
                  <Link key={n.id} to={n.link} className="tile-row">
                    <ActivityText message={n.message} at={n.createdAt} unread={!n.readAt} />
                  </Link>
                ) : (
                  <div key={n.id} className="tile-row">
                    <ActivityText message={n.message} at={n.createdAt} unread={!n.readAt} />
                  </div>
                ),
              )}
            </div>
          ) : (
            <TileNote icon={<Bell size={17} />}>Lists shared with you, collaborator edits and reminders will appear here.</TileNote>
          )}
        </section>

        {!isNew && (
          <section className="tile span-4">
            <TileHeader title="Recently added" icon={<Sparkles size={15} />} to="/app/items" linkLabel="Saved items" inline />
            {itemsLoading ? (
              <div className="mini-items">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="skeleton" style={{ aspectRatio: '1', borderRadius: 'var(--radius)' }} aria-hidden />
                ))}
              </div>
            ) : recentItems.length ? (
              <div className="mini-items">
                {recentItems.map((item) => (
                  <MiniItem key={item.id} item={item} onOpen={() => navigate(`/app/items?item=${item.id}`)} />
                ))}
              </div>
            ) : (
              <p className="muted text-sm">Nothing saved yet.</p>
            )}
          </section>
        )}
      </div>
      <div style={{ height: 'var(--s-12)' }} />
    </div>
  );
}

function TileHeader({ title, icon, to, linkLabel, inline }: { title: string; icon?: ReactNode; to?: string; linkLabel?: string; inline?: boolean }) {
  return (
    <div className={`tile-header${inline ? ' inline' : ''}`}>
      {icon && (
        <span className="tile-header-icon" aria-hidden>
          {icon}
        </span>
      )}
      <h2 className="tile-title">{title}</h2>
      {to && (
        <Link to={to} className="section-link">
          {linkLabel} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

function TileNote({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="tile-note">
      <span className="tile-note-icon" aria-hidden>
        {icon}
      </span>
      <span>{children}</span>
    </div>
  );
}

function ListTile({
  title,
  icon,
  lists,
  loading,
  empty,
  tone,
  view,
  onViewChange,
}: {
  title: string;
  icon: ReactNode;
  lists: WishlistSummary[];
  loading: boolean;
  empty: ReactNode;
  tone?: 'blush';
  view: CardListView;
  onViewChange: (v: CardListView) => void;
}) {
  const shown = lists.slice(0, LIST_ROWS);
  return (
    <section className={`tile span-2 tile-flush${tone ? ` tile-${tone}` : ''}`}>
      <div className="tile-header">
        {icon && (
          <span className="tile-header-icon" aria-hidden>
            {icon}
          </span>
        )}
        <h2 className="tile-title">{title}</h2>
        <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
          {lists.length > 0 && <ViewToggle value={view} onChange={onViewChange} />}
          {lists.length > 0 && (
            <Link to="/app/lists" className="section-link">
              {lists.length > LIST_ROWS ? `All ${lists.length}` : 'View all'} <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
      {loading ? (
        <div className="tile-rows">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="tile-row" aria-hidden>
              <div className="skeleton mini-cover" />
              <div className="skeleton" style={{ height: 14, width: '50%' }} />
            </div>
          ))}
        </div>
      ) : lists.length ? (
        view === 'grid' ? (
          <div className="home-list-grid">
            {shown.map((w) => (
              <WishlistCard key={w.id} wishlist={w} />
            ))}
          </div>
        ) : (
          <div className="tile-rows">
            {shown.map((w) => (
              <WishlistRow key={w.id} wishlist={w} />
            ))}
          </div>
        )
      ) : (
        empty
      )}
    </section>
  );
}

function QuickAction({ art, title, hint, onClick, tone }: { art: ReactElement; title: string; hint: string; onClick: () => void; tone?: 'blush' }) {
  return (
    <button type="button" className={`tile quick-action${tone ? ` tile-${tone}` : ''}`} onClick={onClick}>
      <span className="art-icon" aria-hidden>
        {art}
      </span>
      <span style={{ minWidth: 0 }}>
        <strong>{title}</strong>
        <span>{hint}</span>
      </span>
    </button>
  );
}

function WishlistRow({ wishlist: w }: { wishlist: WishlistSummary }) {
  return (
    <Link to={`/app/lists/${w.id}`} className="tile-row">
      <WishlistListThumb
        title={w.title}
        coverImage={w.coverImage}
        coverArt={w.coverArt}
        accentColor={w.accentColor}
        previewImages={w.previewImages}
      />
      <span style={{ minWidth: 0, flex: 1 }}>
        <strong className="truncate" style={{ display: 'block', fontWeight: 600 }}>
          {w.title}
        </strong>
        <span className="muted text-sm">
          {plural(w.itemCount, w.kind === 'collection' ? 'thing' : 'item')}
          {w.eventDate ? ` · ${countdownLabel(w.eventDate)}` : ''}
        </span>
      </span>
      <ArrowRight size={15} className="faint" aria-hidden />
    </Link>
  );
}

function MiniItem({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const amount = effectivePrice(item);
  const price = formatPrice(amount, item.currency);
  return (
    <button type="button" className="mini-item" onClick={onOpen} aria-label={`Open ${item.title}`}>
      <span className="mini-item-media">
        <ItemImage src={item.imageUrl} type={item.type} iconSize={22} />
      </span>
      <span className="mini-item-title truncate">{item.title}</span>
      {price && <span className="mini-item-price">{price}</span>}
    </button>
  );
}

function ActivityText({ message, at, unread }: { message: string; at: string; unread: boolean }) {
  return (
    <>
      <span className="notif-bullet" data-unread={unread || undefined} aria-hidden />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="text-sm" style={{ display: 'block' }}>
          {message}
        </span>
        <span className="faint text-xs">{relativeTime(at)}</span>
      </span>
    </>
  );
}
