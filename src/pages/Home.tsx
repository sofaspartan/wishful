import { useMemo, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, CalendarHeart, Gift, Library, Plus, Sparkles, Wand2, Zap } from 'lucide-react';
import type { Item, WishlistSummary } from '../../shared/types';
import { joinNames } from '../../shared/constants';
import { isHttpUrl } from '../../shared/schemas';
import { useItems, useMe, useNotifications, useSharedWishlists, useWishlists } from '../lib/queries';
import { countdownLabel, formatDate, formatPrice, greeting, parseDateOnly, relativeTime } from '../lib/format';
import { useLocalPref } from '../lib/prefs';
import { useCaptureHub } from '../lib/layoutMode';
import { useAppActions } from '../components/appActions';
import { ItemImage } from '../components/ItemVisuals';
import { effectivePrice } from '../components/ItemForm';
import { CloudBank } from '../components/Cloud';
import { FEATURE_ILLUSTRATIONS } from '../components/ItemIllustrations';
import { SkyArt } from '../components/SkyArt';
import { WishlistCard, WishlistListThumb } from '../components/WishlistCard';
import { CARD_LIST_VIEWS, ViewToggle, type CardListView } from '../components/ViewToggle';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';

const LIST_ROWS = 4;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function hasStoredListsView(): boolean {
  try {
    return localStorage.getItem('wishful.pref.home.listsView') != null;
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
  const [listsViewPref, setListsView] = useLocalPref<CardListView>('home.listsView', 'grid', CARD_LIST_VIEWS);
  const listsView: CardListView = captureHub && !hasStoredListsView() ? 'list' : listsViewPref;
  const [hubLink, setHubLink] = useState('');

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

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const newCollection = () => openCreateWishlist({ kind: 'collection' });

  const listSections = (
    <>
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
    </>
  );

  if (captureHub) {
    return (
      <div className="page">
        <div className="home-hub">
          <section className="home-hub-hero tile tile-sky">
            <SkyArt scene="hello" className="tile-sky-scene home-hub-sky-scene" />
            <div className="tile-sky-copy home-hub-hero-copy">
              <p className="tile-sky-date">{today}</p>
              <h1 className="display">
                {greeting()}
                {firstName && (
                  <>
                    , <span className="tile-sky-name">{firstName}</span>
                  </>
                )}
              </h1>
              <form
                className="home-hub-hero-form"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  const next = hubLink.trim();
                  if (!next) {
                    openAddItem({ mode: 'link' });
                    return;
                  }
                  openAddItem({ mode: 'link', url: next });
                  setHubLink('');
                }}
              >
                <label className="home-hub-hero-label" htmlFor="home-hub-link">
                  Add something you want
                </label>
                <div className="home-hub-hero-field">
                  <input
                    id="home-hub-link"
                    className="input"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    enterKeyHint="go"
                    placeholder="Paste a product link…"
                    value={hubLink}
                    onChange={(e) => setHubLink(e.target.value)}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text').trim();
                      if (isHttpUrl(pasted)) {
                        e.preventDefault();
                        setHubLink('');
                        openAddItem({ mode: 'link', url: pasted });
                      }
                    }}
                  />
                  <Button type="submit" variant="primary" icon={<Wand2 size={16} aria-hidden />}>
                    Add
                  </Button>
                </div>
                <button type="button" className="home-hub-hero-more" onClick={() => openAddItem()}>
                  More options
                  <ArrowRight size={14} aria-hidden />
                </button>
              </form>
            </div>
            <CloudBank className="tile-sky-bank" />
          </section>

          <div className="home-hub-ctas">
            <button type="button" className="home-hub-cta home-hub-cta-lg" onClick={() => openAddItem({ mode: 'barcode' })}>
              <span className="art-icon" aria-hidden>
                {FEATURE_ILLUSTRATIONS.barcode}
              </span>
              <span className="home-hub-cta-copy">
                <strong>Scan barcode</strong>
                <span>In a store aisle</span>
              </span>
              <ArrowRight size={20} className="home-hub-cta-arrow" aria-hidden />
            </button>
            <div className="home-hub-secondary">
              <button type="button" className="home-hub-cta home-hub-cta-compact" onClick={() => openCreateWishlist()}>
                <span className="art-icon" aria-hidden>
                  {FEATURE_ILLUSTRATIONS.lists}
                </span>
                <span className="home-hub-cta-compact-label">
                  <strong>New wishlist</strong>
                  <ArrowRight size={16} className="home-hub-cta-arrow" aria-hidden />
                </span>
              </button>
              <button type="button" className="home-hub-cta home-hub-cta-compact" onClick={newCollection}>
                <span className="art-icon" aria-hidden>
                  {FEATURE_ILLUSTRATIONS.collection}
                </span>
                <span className="home-hub-cta-compact-label">
                  <strong>New collection</strong>
                  <ArrowRight size={16} className="home-hub-cta-arrow" aria-hidden />
                </span>
              </button>
              <button type="button" className="home-hub-cta home-hub-cta-compact" onClick={() => openCreateBox()}>
                <span className="art-icon" aria-hidden>
                  {FEATURE_ILLUSTRATIONS.boxes}
                </span>
                <span className="home-hub-cta-compact-label">
                  <strong>New box</strong>
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
            <div className="tile-sky-add">
              <label className="tile-sky-add-label" htmlFor="home-sky-link">
                Add something you want
              </label>
              <form
                className="tile-sky-add-form"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  const next = hubLink.trim();
                  if (!next) {
                    openAddItem({ mode: 'link' });
                    return;
                  }
                  openAddItem({ mode: 'link', url: next });
                  setHubLink('');
                }}
              >
                <input
                  id="home-sky-link"
                  className="input"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  enterKeyHint="go"
                  placeholder="Paste a product link…"
                  value={hubLink}
                  onChange={(e) => setHubLink(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text').trim();
                    if (isHttpUrl(pasted)) {
                      e.preventDefault();
                      setHubLink('');
                      openAddItem({ mode: 'link', url: pasted });
                    }
                  }}
                />
                <Button type="submit" variant="primary" size="sm" icon={<Wand2 size={15} aria-hidden />}>
                  Add
                </Button>
              </form>
              <button type="button" className="tile-sky-add-more" onClick={() => openAddItem()}>
                More options
                <ArrowRight size={14} aria-hidden />
              </button>
            </div>
          </div>
          <CloudBank className="tile-sky-bank" />
        </section>

        <section className="tile span-4 tile-flush quick-actions-tile">
          <div className="tile-header">
            <span className="tile-header-icon" aria-hidden>
              <Zap size={14} />
            </span>
            <h2 className="tile-title">Quick actions</h2>
          </div>
          <div className="quick-actions-body">
            <div className="quick-actions-grid">
              <QuickAction art={FEATURE_ILLUSTRATIONS.lists} title="New wishlist" hint="Gifts and wants" onClick={() => openCreateWishlist()} />
              <QuickAction art={FEATURE_ILLUSTRATIONS.collection} title="New collection" hint="Things you already have" onClick={newCollection} tone="blush" />
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
      <CloudBank className="tile-list-bank" />
    </section>
  );
}

function QuickAction({ art, title, hint, onClick, tone }: { art: ReactElement; title: string; hint: string; onClick: () => void; tone?: 'blush' }) {
  return (
    <button type="button" className={`quick-action${tone ? ` quick-action-blush` : ''}`} onClick={onClick}>
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
