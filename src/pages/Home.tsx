import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import type { Item, WishlistSummary } from '../../shared/types';
import { joinNames } from '../../shared/constants';
import { useItems, useMe, useNotifications, useSharedWishlists, useWishlists } from '../lib/queries';
import { countdownLabel, formatDate, formatPrice, greeting, parseDateOnly, relativeTime } from '../lib/format';
import { useLocalPref } from '../lib/prefs';
import { useCaptureHub } from '../lib/layoutMode';
import { useAppActions } from '../components/appActions';
import { ItemImage } from '../components/ItemVisuals';
import { effectivePrice } from '../components/ItemForm';
import { CloudBank } from '../components/Cloud';
import { COVER_ICON_ART } from '../components/CoverArt';
import { FEATURE_ILLUSTRATIONS } from '../components/ItemIllustrations';
import { SkyArt } from '../components/SkyArt';
import { WishlistCard, WishlistListThumb } from '../components/WishlistCard';
import { CARD_LIST_VIEWS, ViewToggle, type CardListView } from '../components/ViewToggle';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';

const LIST_ROWS = 4;
const HOME_LISTS_VIEW_KEY = 'wishful.pref.home.listsView';

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function hasStoredListsView(): boolean {
  try {
    return localStorage.getItem(HOME_LISTS_VIEW_KEY) != null;
  } catch {
    return false;
  }
}

export default function Home() {
  const { data: me } = useMe();
  const { data: lists, isLoading: listsLoading } = useWishlists();
  const { data: shared = [] } = useSharedWishlists();
  const { data: itemsData, isLoading: itemsLoading } = useItems();
  const { data: notifications = [] } = useNotifications();
  const { openAddItem, openCreateWishlist, openCreateBox } = useAppActions();
  const navigate = useNavigate();
  const captureHub = useCaptureHub();
  const [listsViewPref, setListsViewPref] = useLocalPref<CardListView>('home.listsView', 'grid', CARD_LIST_VIEWS);
  /* Mobile hub defaults to list until the user picks — track that in React so tapping
     Card isn’t a no-op when the stored pref is still the unused grid fallback. */
  const [useHubListDefault, setUseHubListDefault] = useState(() => captureHub && !hasStoredListsView());
  const listsView: CardListView = useHubListDefault ? 'list' : listsViewPref;
  const setListsView = (v: CardListView) => {
    setUseHubListDefault(false);
    setListsViewPref(v);
  };
  const active = useMemo(() => (lists ?? []).filter((w) => !w.archivedAt), [lists]);
  const wishlists = active.filter((w) => w.kind !== 'collection');
  const collections = active.filter((w) => w.kind === 'collection');
  const items = useMemo(() => itemsData?.items ?? [], [itemsData]);
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

  const newCollection = () => openCreateWishlist({ kind: 'collection' });

  const listSections = (
    <>
      <ListTile
        title="Wishlists"
        icon={FEATURE_ILLUSTRATIONS.surprise}
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
        title="Collections"
        icon={FEATURE_ILLUSTRATIONS.collection}
        lists={collections}
        loading={listsLoading}
        view={listsView}
        onViewChange={setListsView}
        empty={
          <EmptyState
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
    </>
  );

  if (captureHub) {
    return (
      <div className="page">
        <div className="home-hub">
          <StartWishHero firstName={firstName} skyClassName="tile-sky-scene home-hub-sky-scene" />

          <div className="home-hub-ctas">
            <div className="home-hub-secondary">
              <button type="button" className="home-hub-cta home-hub-cta-compact" onClick={() => openCreateWishlist()}>
                <span className="art-icon" aria-hidden>
                  {FEATURE_ILLUSTRATIONS.lists}
                </span>
                <span className="home-hub-cta-compact-label">
                  <strong className="home-hub-cta-compact-title">
                    <span>New</span>
                    <span>wishlist</span>
                  </strong>
                  <ArrowRight size={16} className="home-hub-cta-arrow" aria-hidden />
                </span>
              </button>
              <button type="button" className="home-hub-cta home-hub-cta-compact" onClick={newCollection}>
                <span className="art-icon" aria-hidden>
                  {FEATURE_ILLUSTRATIONS.collection}
                </span>
                <span className="home-hub-cta-compact-label">
                  <strong className="home-hub-cta-compact-title">
                    <span>New</span>
                    <span>collection</span>
                  </strong>
                  <ArrowRight size={16} className="home-hub-cta-arrow" aria-hidden />
                </span>
              </button>
              <button type="button" className="home-hub-cta home-hub-cta-compact" onClick={() => openCreateBox()}>
                <span className="art-icon" aria-hidden>
                  {FEATURE_ILLUSTRATIONS.boxes}
                </span>
                <span className="home-hub-cta-compact-label">
                  <strong className="home-hub-cta-compact-title">
                    <span>New</span>
                    <span>box</span>
                  </strong>
                  <ArrowRight size={16} className="home-hub-cta-arrow" aria-hidden />
                </span>
              </button>
            </div>
          </div>

          <div className="home-hub-lists bento">{listSections}</div>
        </div>
        <div style={{ height: 'var(--s-12)' }} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="bento">
        <StartWishHero firstName={firstName} className="span-4" skyClassName="tile-sky-scene" />

        <section className="tile span-4 tile-flush quick-actions-tile">
          <div className="tile-header">
            <span className="tile-header-icon" aria-hidden>
              {FEATURE_ILLUSTRATIONS.idea}
            </span>
            <h2 className="tile-title">Quick actions</h2>
          </div>
          <div className="quick-actions-body">
            <div className="quick-actions-grid">
              <QuickAction art={FEATURE_ILLUSTRATIONS.lists} title="New wishlist" hint="Gifts and wants" onClick={() => openCreateWishlist()} />
              <QuickAction art={FEATURE_ILLUSTRATIONS.collection} title="New collection" hint="Things you already have" onClick={newCollection} />
              <QuickAction art={FEATURE_ILLUSTRATIONS.boxes} title="New box" hint="Pack and label storage" onClick={() => openCreateBox()} />
            </div>
            <div className="quick-actions-grid">
              <QuickAction art={FEATURE_ILLUSTRATIONS.barcode} title="Scan a barcode" hint="In a store aisle" onClick={() => openAddItem({ mode: 'barcode' })} />
              <QuickAction art={FEATURE_ILLUSTRATIONS.idea} title="Write an idea" hint="Experiences, wishes" onClick={() => openAddItem({ mode: 'idea' })} />
              <QuickAction art={FEATURE_ILLUSTRATIONS.share} title="Gift ideas" hint="Browse curated catalogs" onClick={() => navigate('/app/gifts')} />
            </div>
          </div>
        </section>

        {listSections}

        <section className="tile span-2 tile-flush">
          <TileHeader title="Upcoming" icon={COVER_ICON_ART.heart} />
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
            <TileNote icon={COVER_ICON_ART.heart}>Add a date to a wishlist and it will show up here with a countdown.</TileNote>
          )}
        </section>

        <section className="tile span-2 tile-flush">
          <TileHeader title="Recent activity" icon={FEATURE_ILLUSTRATIONS.bell} />
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
            <TileNote icon={FEATURE_ILLUSTRATIONS.bell}>Lists shared with you, collaborator edits and reminders will appear here.</TileNote>
          )}
        </section>

        {!isNew && (
          <section className="tile span-4">
            <TileHeader title="Recently added" icon={COVER_ICON_ART.sparkles} to="/app/items" linkLabel="Items" inline />
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

function StartWishHero({
  firstName,
  className,
  skyClassName = 'tile-sky-scene',
}: {
  firstName: string;
  className?: string;
  skyClassName?: string;
}) {
  const { openAddItem } = useAppActions();
  return (
    <section className={['home-hub-hero', 'tile', 'tile-sky', className].filter(Boolean).join(' ')}>
      <SkyArt scene="hello" className={skyClassName} />
      <div className="tile-sky-copy home-hub-hero-copy">
        <p className="home-hub-hero-greeting">
          {greeting()}
          {firstName && (
            <>
              , <span className="tile-sky-name">{firstName}</span>
            </>
          )}
        </p>
        <div className="home-hub-hero-actions">
          <h1 className="display home-hub-hero-prompt">Start a wish</h1>
          <button type="button" className="home-hub-hero-cta" onClick={() => openAddItem({ mode: 'link' })}>
            <span className="art-icon" aria-hidden>
              {FEATURE_ILLUSTRATIONS.store}
            </span>
            <span className="home-hub-hero-cta-copy">
              <strong>Via URL</strong>
              <span>Paste a product URL</span>
            </span>
            <ArrowRight size={18} className="home-hub-cta-arrow" aria-hidden />
          </button>
          <button type="button" className="home-hub-hero-cta" onClick={() => openAddItem({ mode: 'upload' })}>
            <span className="art-icon" aria-hidden>
              {FEATURE_ILLUSTRATIONS.camera}
            </span>
            <span className="home-hub-hero-cta-copy">
              <strong>Via Photo</strong>
              <span>Camera, scan, or upload</span>
            </span>
            <ArrowRight size={18} className="home-hub-cta-arrow" aria-hidden />
          </button>
          <button type="button" className="home-hub-hero-cta" onClick={() => openAddItem({ mode: 'listScan' })}>
            <span className="art-icon" aria-hidden>
              {FEATURE_ILLUSTRATIONS.tasks}
            </span>
            <span className="home-hub-hero-cta-copy">
              <strong>Via Written List</strong>
              <span>Photo a list — each line becomes an item</span>
            </span>
            <ArrowRight size={18} className="home-hub-cta-arrow" aria-hidden />
          </button>
        </div>
      </div>
      <CloudBank className="tile-sky-bank" />
    </section>
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
  const hasLists = lists.length > 0;
  return (
    <section className={`tile span-2 tile-flush tile-list-sky${tone ? ` tile-${tone}` : ''}`}>
      <div className="tile-header">
        {icon && (
          <span className="tile-header-icon" aria-hidden>
            {icon}
          </span>
        )}
        <h2 className="tile-title">{title}</h2>
        {hasLists && (
          <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
            <ViewToggle value={view} onChange={onViewChange} />
          </div>
        )}
      </div>
      <div className="tile-list-body">
        {loading ? (
          <div className="tile-rows">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="tile-row" aria-hidden>
                <div className="skeleton mini-cover" />
                <div className="skeleton" style={{ height: 14, width: '50%' }} />
              </div>
            ))}
          </div>
        ) : hasLists ? (
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
      </div>
      {hasLists && (
        <div className="tile-list-footer">
          <Link to="/app/lists" className="btn btn-sm">
            {lists.length > LIST_ROWS ? `View all ${lists.length}` : 'View all'} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}

function QuickAction({ art, title, hint, onClick }: { art: ReactElement; title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" className="quick-action" onClick={onClick}>
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
