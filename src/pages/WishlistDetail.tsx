import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarDays,
  Copy,
  ExternalLink,
  EyeOff,
  Gift,
  ListChecks,
  ListPlus,
  LogOut,
  MoreHorizontal,
  Package,
  PartyPopper,
  ChevronDown,
  Pencil,
  Plus,
  RefreshCw,
  ScanBarcode,
  Search,
  Settings2,
  Share2,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Users,
  Wallet,
} from 'lucide-react';
import { isDarkCover, type Item, type OwnerClaimView, type OwnerPledgeView, type Priority, type WishlistDetail as Detail, type WishlistEntry } from '../../shared/types';
import {
  PRIORITY_LABELS,
  PRIORITY_LAYOUTS,
  isTaskList,
  joinNames,
  possessiveNames,
  priorityLayout,
  priorityLayoutSettings,
  type PriorityLayout,
} from '../../shared/constants';
import { TaskListDetail } from '../components/TaskListDetail';
import { keys, useMe, useStaleSync, useWishlist, useInvalidate } from '../lib/queries';
import { linkedListNote, syncSourceName } from '../lib/syncSource';
import { ApiError, del, errorMessage, patch, post, put } from '../lib/api';
import { mergeSectionOrder } from '../lib/priority';
import { PrioritySections } from '../components/PrioritySections';
import { countdownLabel, firstName, formatDate, relativeTime } from '../lib/format';
import { shareUrl, useLocalPref } from '../lib/prefs';
import { useAppActions } from '../components/appActions';
import { ItemCard } from '../components/ItemCard';
import { ListForLine } from '../components/WishlistCard';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { EditItemModal } from '../components/EditItemModal';
import { ItemListsDialog } from '../components/ItemListsDialog';
import { effectivePrice } from '../components/ItemForm';
import { CollectionBadge, VisibilityBadge } from '../components/ItemVisuals';
import { CollectionStats } from '../components/CollectionStats';
import { GotItDialog } from '../components/GotItDialog';
import { SkyArt } from '../components/SkyArt';
import { CoverArt, CoverAvatar, suggestCoverArt } from '../components/CoverArt';
import { CloudBank } from '../components/Cloud';
import { ThemedPage } from '../components/PageTheme';
import { FavoriteMenuItem } from '../components/FavoriteToggle';
import { WishlistFormModal } from '../components/WishlistFormModal';
import { CashFundDisplay } from '../components/CashFund';
import { CashFundDialog, CollaboratorsDialog, EntrySettingsDialog, GiftSettingsDialog, MoveEntryDialog, ShareDialog } from '../components/WishlistDialogs';
import { filterPaymentMethods } from '../../shared/paymentLinks';
import { useWishlistActions } from '../components/WishlistMenu';
import { DragHandle, SortableList } from '../components/Sortable';
import { Menu, MenuItem, MenuSeparator } from '../components/ui/Menu';
import { BoxChip, useBoxMap } from '../components/BoxVisuals';
import { PutInBoxDialog } from '../components/BoxDialogs';
import { Button, buttonClass } from '../components/ui/Button';
import { Popover } from '../components/ui/Popover';
import { Avatar, EmptyState, PageLoader, useConfirm } from '../components/ui/misc';
import { useToast } from '../components/ui/Toast';
import { ViewToggle } from '../components/ViewToggle';

const SORTS = ['custom', 'priority', 'acquired', 'rating', 'price_asc', 'price_desc', 'newest', 'name'] as const;
type Sort = (typeof SORTS)[number];
const VIEWS = ['grid', 'list'] as const;

interface Row {
  entry: WishlistEntry;
  item: Item;
  claim: OwnerClaimView | null;
  pledges: OwnerPledgeView[];
}

export default function WishlistDetailPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useWishlist(id);

  if (isLoading) return <PageLoader />;
  if (error || !data) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 403);
    return (
      <div className="page">
        <EmptyState
          icon={<EyeOff size={22} />}
          title={notFound ? 'List not found' : "Couldn't load this list"}
          action={
            <Link to="/app/lists" className="btn">
              Back to my lists
            </Link>
          }
        >
          {notFound ? "It may have been deleted, or you don't have access to it." : errorMessage(error)}
        </EmptyState>
      </div>
    );
  }
  return <WishlistView detail={data} />;
}

function WishlistView({ detail }: { detail: Detail }) {
  const w = detail.wishlist;
  if (isTaskList(w)) return <TaskListDetail detail={detail} />;

  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const toast = useToast();
  const confirm = useConfirm();
  const listActions = useWishlistActions();
  const { openAddItem } = useAppActions();
  const [params, setParams] = useSearchParams();

  const isOwner = detail.role === 'owner';
  const canEdit = detail.role !== 'viewer';
  const claimsVisible = detail.claims !== null;
  // Display people may include the owner when includeOwner; linked recipients are the stored "someone else" people.
  const people = detail.recipients;
  const others = w.recipients ?? [];
  const isRecipient = others.some((p) => p.userId && p.userId === me?.id);
  const linkedNames = joinNames(others.filter((p) => p.userId).map((p) => p.name));
  const collection = w.kind === 'collection';
  const synced = (item: Item) => Boolean(w.link && item.source);
  useStaleSync(isOwner ? w.link : null);

  const [view, setView] = useLocalPref('detail.view', 'grid', VIEWS);
  const [sort, setSort] = useLocalPref<Sort>('detail.sort', 'custom', SORTS);
  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [order, setOrder] = useState<string[] | null>(null);

  const [editingList, setEditingList] = useState(params.get('edit') === '1');
  const [sharing, setSharing] = useState(params.get('share') === '1');
  const [giftSettings, setGiftSettings] = useState(false);
  const [cashFundOpen, setCashFundOpen] = useState(false);
  const [collaborators, setCollaborators] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingEntry, setEditingEntry] = useState<WishlistEntry | null>(null);
  const [listsFor, setListsFor] = useState<Item | null>(null);
  const [entrySettings, setEntrySettings] = useState<WishlistEntry | null>(null);
  const [moving, setMoving] = useState<WishlistEntry | null>(null);
  const [gotIt, setGotIt] = useState<Item | null>(null);
  const [boxFor, setBoxFor] = useState<Item | null>(null);
  const boxById = useBoxMap(isOwner);
  const boxOf = (item: Item) => (isOwner && item.boxId ? boxById.get(item.boxId) : undefined);

  const openItemId = params.get('item');

  useEffect(() => {
    if (params.has('edit') || params.has('share')) {
      const next = new URLSearchParams(params);
      next.delete('edit');
      next.delete('share');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => setOrder(null), [detail]);

  const rows: Row[] = useMemo(() => {
    const claims = new Map((detail.claims ?? []).map((c) => [c.entryId, c]));
    return w.entries
      .map((entry) => ({
        entry,
        item: detail.items[entry.itemId],
        claim: claims.get(entry.id) ?? null,
        pledges: (detail.pledges ?? []).filter((p) => p.entryId === entry.id),
      }))
      .filter((r) => Boolean(r.item));
  }, [detail, w.entries]);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.entry.id, r])), [rows]);

  // "Priority" used to be a personal sort; grouping by priority is now a setting of the list itself.
  const effectiveSort: Sort = sort === 'priority' || ((sort === 'acquired' || sort === 'rating') && !collection) ? 'custom' : sort;
  const layout: PriorityLayout = collection ? 'hidden' : priorityLayout(w.settings);
  const showPriority = layout !== 'hidden';
  const grouped = layout === 'grouped' && effectiveSort === 'custom';
  const activeFilter = showPriority ? priorityFilter : 'all';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (activeFilter !== 'all' && r.entry.priority !== activeFilter) return false;
      if (!q) return true;
      const i = r.item;
      return [i.title, i.description, i.retailer, i.brand, i.category, i.tags.join(' '), i.metadata.location ?? '', i.metadata.venue ?? ''].some((s) => s.toLowerCase().includes(q));
    });
    if (effectiveSort !== 'custom') {
      list = [...list];
      const price = (r: Row) => effectivePrice(r.item);
      if (effectiveSort === 'acquired') list.sort((a, b) => (b.item.owned?.acquiredOn ?? '').localeCompare(a.item.owned?.acquiredOn ?? ''));
      if (effectiveSort === 'rating') list.sort((a, b) => (b.item.owned?.rating ?? 0) - (a.item.owned?.rating ?? 0));
      if (effectiveSort === 'price_asc') list.sort((a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity));
      if (effectiveSort === 'price_desc') list.sort((a, b) => (price(b) ?? -1) - (price(a) ?? -1));
      if (effectiveSort === 'newest') list.sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt));
      if (effectiveSort === 'name') list.sort((a, b) => a.item.title.localeCompare(b.item.title));
    }
    return list;
  }, [rows, query, activeFilter, effectiveSort]);

  // On wishlists, owned items stay in a separate "Got it" section (owner/editor view).
  const splitGotIt = !collection;
  const activeFiltered = splitGotIt ? filtered.filter((r) => !r.item.owned) : filtered;
  const gotItFiltered = splitGotIt ? filtered.filter((r) => Boolean(r.item.owned)) : [];

  const canDrag =
    canEdit && effectiveSort === 'custom' && !query.trim() && activeFilter === 'all' && activeFiltered.length > 1 && !w.archivedAt;
  const orderedIds = order ?? rows.map((r) => r.entry.id);
  const displayRows = canDrag
    ? orderedIds.map((eid) => rowById.get(eid)).filter((r): r is Row => r != null && (!splitGotIt || !r.item.owned))
    : activeFiltered;

  const setLayout = async (next: PriorityLayout) => {
    const change = priorityLayoutSettings(next);
    qc.setQueryData<Detail>(keys.wishlist(w.id), (prev) => (prev ? { ...prev, wishlist: { ...prev.wishlist, settings: { ...prev.wishlist.settings, ...change } } } : prev));
    try {
      await patch(`/api/wishlists/${w.id}`, { settings: change });
      invalidate([w.id]);
    } catch (err) {
      toast.error(errorMessage(err));
      invalidate([w.id]);
    }
  };

  const openRow = openItemId ? rows.find((r) => r.item.id === openItemId) : undefined;
  const setOpenItem = (itemId: string | null) => {
    const next = new URLSearchParams(params);
    if (itemId) next.set('item', itemId);
    else next.delete('item');
    setParams(next, { replace: !itemId });
  };

  const reorder = async (ids: string[]) => {
    setOrder(ids);
    try {
      await put(`/api/wishlists/${w.id}/entries/order`, { ids });
      qc.setQueryData<Detail>(keys.wishlist(w.id), (prev) =>
        prev ? { ...prev, wishlist: { ...prev.wishlist, entries: ids.map((eid) => prev.wishlist.entries.find((e) => e.id === eid)!).filter(Boolean) } } : prev,
      );
    } catch (err) {
      setOrder(null);
      toast.error(errorMessage(err));
      invalidate([w.id]);
    }
  };

  const removeEntry = async (r: Row) => {
    const ok = await confirm({
      title: 'Remove from this list?',
      message: `“${r.item.title}” will stay in ${isOwner ? 'your' : "the owner's"} Saved Items and on any other lists.`,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await del(`/api/wishlists/${w.id}/entries/${r.entry.id}`);
      invalidate([w.id]);
      toast.success('Removed from list');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const clearOwned = async (r: Row) => {
    const ok = await confirm({
      title: 'Mark as still wanting?',
      message: `“${r.item.title}” will leave the Got it section and show as something you still want. Collections it belongs to are unchanged.`,
      confirmLabel: 'Still want it',
    });
    if (!ok) return;
    try {
      await patch(`/api/items/${r.item.id}`, { owned: null });
      invalidate([w.id, ...r.item.wishlistIds]);
      toast.success('Moved back to your wishes');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const clearClaim = async (r: Row) => {
    const ok = await confirm({
      title: 'Clear this reservation?',
      message: `${r.claim?.claimantName || 'Someone'} reserved “${r.item.title}”. Clearing it makes the item available again on your shared page.`,
      confirmLabel: 'Clear reservation',
      danger: true,
    });
    if (!ok) return;
    try {
      await post(`/api/wishlists/${w.id}/entries/${r.entry.id}/clear-claim`);
      invalidate([w.id]);
      toast.success('Reservation cleared');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const leave = async () => {
    if (!me) return;
    const ok = await confirm({ title: `Leave “${w.title}”?`, message: 'You will lose access until the owner invites you again.', confirmLabel: 'Leave', danger: true });
    if (!ok) return;
    try {
      await del(`/api/wishlists/${w.id}/collaborators/${me.id}`);
      invalidate([]);
      navigate('/app/lists?status=shared');
      toast.success('You left the wishlist');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const addItem = () => openAddItem({ wishlistId: w.id, lockedToWishlist: !isOwner });
  const addSeveral = () => openAddItem({ mode: 'bulk', wishlistId: w.id, lockedToWishlist: !isOwner });
  const scanBarcode = () => openAddItem({ mode: 'barcode', wishlistId: w.id, lockedToWishlist: !isOwner });

  const statusBadge = (r: Row) => {
    if (collection) return null;
    if (!r.claim) return r.entry.groupGift && r.pledges.length ? <span className="badge badge-info">{r.pledges.length} chipping in</span> : null;
    const name = r.claim.claimantName || 'Someone';
    return r.claim.status === 'purchased' ? <span className="badge badge-success">Bought by {name}</span> : <span className="badge badge-warning">Reserved by {name}</span>;
  };

  const itemMenu = (r: Row) =>
    canEdit ? (
      <Menu label={`Actions for ${r.item.title}`} icon={<MoreHorizontal size={18} />} buttonClassName="btn btn-icon btn-sm">
        {isOwner && <FavoriteMenuItem targetType="item" targetId={r.item.id} name={r.item.title} />}
        <MenuItem
          icon={<Pencil size={16} />}
          onSelect={() => {
            setEditingItem(r.item);
            setEditingEntry(collection ? null : r.entry);
          }}
        >
          Edit item
        </MenuItem>
        {isOwner && !collection && !synced(r.item) && !r.item.owned && (
          <MenuItem icon={<PartyPopper size={16} />} onSelect={() => setGotIt(r.item)}>
            Got it!
          </MenuItem>
        )}
        {isOwner && !collection && r.item.owned && !synced(r.item) && (
          <MenuItem icon={<PartyPopper size={16} />} onSelect={() => setGotIt(r.item)}>
            File in a collection…
          </MenuItem>
        )}
        {isOwner && !collection && r.item.owned && (
          <MenuItem icon={<Undo2 size={16} />} onSelect={() => clearOwned(r)}>
            Still want it
          </MenuItem>
        )}
        {!collection && (
          <MenuItem icon={<Settings2 size={16} />} onSelect={() => setEntrySettings(r.entry)}>
            Priority, note & already own
          </MenuItem>
        )}
        {!synced(r.item) && (
          <MenuItem icon={<ArrowLeft size={16} style={{ transform: 'scaleX(-1)' }} />} onSelect={() => setMoving(r.entry)}>
            Move to another list
          </MenuItem>
        )}
        {isOwner && (
          <MenuItem icon={<ListChecks size={16} />} onSelect={() => setListsFor(r.item)}>
            Add to other lists
          </MenuItem>
        )}
        {isOwner && (
          <MenuItem icon={<Package size={16} />} onSelect={() => setBoxFor(r.item)}>
            {r.item.boxId ? 'Move to another box…' : 'Put in a box…'}
          </MenuItem>
        )}
        {r.claim && (
          <MenuItem icon={<Undo2 size={16} />} onSelect={() => clearClaim(r)}>
            Clear reservation
          </MenuItem>
        )}
        {!synced(r.item) && (
          <>
            <MenuSeparator />
            <MenuItem icon={<Trash2 size={16} />} danger onSelect={() => removeEntry(r)}>
              Remove from list
            </MenuItem>
          </>
        )}
      </Menu>
    ) : null;

  const alreadyHaveFor = (r: Row) => {
    if (collection) return undefined;
    const ids = r.entry.alreadyHaveItemIds ?? [];
    if (!ids.length) return undefined;
    return ids
      .map((id) => detail.items[id])
      .filter((i): i is NonNullable<typeof i> => i != null)
      .map((i) => ({ id: i.id, title: i.title, imageUrl: i.imageUrl }));
  };

  const renderCard = (r: Row, dragHandle?: ReactNode, opts?: { showOwned?: boolean }) => (
    <ItemCard
      item={r.item}
      priority={showPriority && !opts?.showOwned ? r.entry.priority : null}
      owned={collection || opts?.showOwned ? r.item.owned : null}
      status={opts?.showOwned ? <span className="badge badge-success">Got it</span> : statusBadge(r)}
      dimmed={r.claim?.status === 'purchased'}
      groupGift={r.entry.groupGift}
      alreadyHave={opts?.showOwned ? undefined : alreadyHaveFor(r)}
      onOpen={() => setOpenItem(r.item.id)}
      menu={itemMenu(r)}
      dragHandle={dragHandle}
      view={view}
      footer={boxOf(r.item) ? <BoxChip box={boxOf(r.item)!} /> : undefined}
    />
  );

  const renderGotItSection = (listClass: string, hasContentAbove: boolean) => {
    if (!gotItFiltered.length) return null;
    return (
      <section className="got-it-section" style={{ marginTop: hasContentAbove ? 'var(--s-8)' : 0 }}>
        <header className="section-header" style={{ marginBottom: 'var(--s-3)' }}>
          <h2 className="section-title" style={{ fontSize: '1.05rem' }}>
            Got it
          </h2>
          <p className="muted text-sm" style={{ margin: 0 }}>
            Things you already have — hidden from your shared gift page.
          </p>
        </header>
        <div className={listClass}>
          {gotItFiltered.map((r) => (
            <div key={r.entry.id} style={{ minWidth: 0 }}>
              {renderCard(r, undefined, { showOwned: true })}
            </div>
          ))}
        </div>
      </section>
    );
  };

  const days = countdownLabel(w.eventDate);

  return (
    <ThemedPage className="page" pageBackdrop={w.pageBackdrop} pageColors={w.pageColors} coverArt={w.coverArt} accentColor={w.accentColor}>
      <Link to={isOwner ? '/app/lists' : '/app/lists?status=shared'} className="section-link" style={{ marginLeft: 0, marginBottom: 'var(--s-3)' }}>
        <ArrowLeft size={14} /> {isOwner ? 'My Lists' : 'Shared'}
      </Link>

      <header
        className={['wl-hero', !w.coverImage && isDarkCover(w.coverArt) && 'wl-hero-dark'].filter(Boolean).join(' ')}
      >
        <div className="wl-hero-bg" aria-hidden>
          {!w.coverImage && w.coverArt ? (
            <CoverArt art={w.coverArt} showIcon={false} />
          ) : (
            <div className="wl-hero-tint">
              <CloudBank className="wl-hero-bank" />
            </div>
          )}
        </div>
        <div className="wl-hero-body">
          <CoverAvatar
            className="wl-hero-avatar"
            icon={(w.coverArt ?? suggestCoverArt(w.occasion, w.kind)).icon}
            frame={w.coverArt?.frame}
            photo={w.coverImage}
          />
          <div className="wl-hero-main">
          {(isOwner || (w.shareToken && w.visibility !== 'private')) && (
            <div className="wl-hero-top">
              {w.shareToken && w.visibility !== 'private' && (
                <a
                  className={buttonClass({ size: 'sm', iconOnly: true })}
                  href={shareUrl(w.shareToken)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-tooltip="Open shared page"
                  aria-label="Open shared page"
                >
                  <ExternalLink size={15} aria-hidden />
                </a>
              )}
              {isOwner && !w.archivedAt && (
                <Button
                  size="sm"
                  iconOnly
                  icon={<Share2 size={15} />}
                  onClick={() => setSharing(true)}
                  data-tooltip="Share"
                  aria-label="Share"
                />
              )}
            </div>
          )}
          <h1 className="wl-hero-title display">{w.title}</h1>
          {w.description && (
            <p className="muted" style={{ maxWidth: 680, whiteSpace: 'pre-line' }}>
              {w.description}
            </p>
          )}
          <div className="row-wrap">
            {isOwner ? <VisibilityBadge visibility={w.visibility} outline /> : <span className="badge badge-outline">{detail.role === 'editor' ? 'You can edit' : 'View only'}</span>}
            {collection && <CollectionBadge outline />}
            {w.link && (
              <span className="badge badge-outline">
                <RefreshCw aria-hidden /> Synced from {syncSourceName(w.link.provider)}
              </span>
            )}
            {w.surpriseMode && (!people.length || linkedNames) && (
              <span className="badge badge-accent">
                <Gift aria-hidden /> {people.length && !isRecipient ? `Surprise for ${linkedNames}` : 'Surprise Mode: On'}
              </span>
            )}
            {w.archivedAt && <span className="badge">Archived</span>}
          </div>
          <div className="row-wrap text-sm muted" style={{ gap: 'var(--s-4)' }}>
            {(people.length > 0 || !isOwner) && (
              <ListForLine people={people} meId={me?.id} maker={isOwner ? null : detail.owner} avatarSize={22} />
            )}
            {w.eventDate && (
              <span className="row" style={{ gap: 6 }}>
                <CalendarDays size={15} aria-hidden />
                {w.occasion ? `${w.occasion} · ` : ''}
                {formatDate(w.eventDate)}
                {days && days !== 'Passed' && <strong style={{ color: 'var(--accent-ink)' }}>· {days}</strong>}
              </span>
            )}
            {!w.eventDate && w.occasion && <span>{w.occasion}</span>}
            <span>
              {rows.length} item{rows.length === 1 ? '' : 's'}
            </span>
            {w.collaborators.length > 0 && (
              <button type="button" className="row link-button" style={{ gap: 6 }} onClick={() => setCollaborators(true)}>
                <Users size={15} aria-hidden /> {w.collaborators.length} collaborator{w.collaborators.length === 1 ? '' : 's'}
              </button>
            )}
            <span>Updated {relativeTime(w.updatedAt)}</span>
          </div>

          <div className="wl-hero-actions">
            {canEdit && !w.archivedAt && (
              <Menu
                label="Add to list"
                align="left"
                buttonClassName={buttonClass({ variant: 'primary' })}
                buttonContent={
                  <>
                    <Plus size={17} aria-hidden />
                    <span>Add</span>
                    <ChevronDown size={15} aria-hidden style={{ marginLeft: 2, opacity: 0.85 }} />
                  </>
                }
              >
                <MenuItem icon={<Plus size={16} />} onSelect={addItem}>
                  Add item
                </MenuItem>
                <MenuItem icon={<ScanBarcode size={16} />} onSelect={scanBarcode}>
                  Scan barcode
                </MenuItem>
                <MenuItem icon={<ListPlus size={16} />} onSelect={addSeveral}>
                  Add several
                </MenuItem>
                {isOwner && !collection && (
                  <MenuItem icon={<Wallet size={16} />} onSelect={() => setCashFundOpen(true)}>
                    {w.cashFund ? 'Edit cash fund' : 'Cash fund'}
                  </MenuItem>
                )}
              </Menu>
            )}
            {isOwner && (
              <Button icon={<Pencil size={16} />} onClick={() => setEditingList(true)}>
                Edit
              </Button>
            )}
            {isOwner ? (
              <Menu label="More list actions" icon={<MoreHorizontal size={18} />} buttonClassName="btn btn-icon">
                <FavoriteMenuItem targetType="wishlist" targetId={w.id} name={w.title} />
                {!collection && (
                  <MenuItem icon={<Gift size={16} />} onSelect={() => setGiftSettings(true)}>
                    Gift settings
                  </MenuItem>
                )}
                <MenuItem icon={<Users size={16} />} onSelect={() => setCollaborators(true)}>
                  Collaborators
                </MenuItem>
                <MenuItem icon={<Copy size={16} />} onSelect={() => listActions.duplicate(w)}>
                  Duplicate
                </MenuItem>
                {w.archivedAt ? (
                  <MenuItem icon={<ArchiveRestore size={16} />} onSelect={() => listActions.setArchived(w, false)}>
                    Restore
                  </MenuItem>
                ) : (
                  <MenuItem icon={<Archive size={16} />} onSelect={() => listActions.setArchived(w, true)}>
                    Archive
                  </MenuItem>
                )}
                <MenuSeparator />
                <MenuItem icon={<Trash2 size={16} />} danger onSelect={() => listActions.remove(w, () => navigate('/app/lists', { replace: true }))}>
                  Delete {collection ? 'collection' : 'wishlist'}
                </MenuItem>
              </Menu>
            ) : (
              <Menu label="List actions" icon={<MoreHorizontal size={18} />} buttonClassName="btn btn-icon">
                <FavoriteMenuItem targetType="wishlist" targetId={w.id} name={w.title} />
                <MenuItem icon={<LogOut size={16} />} onSelect={leave}>
                  Leave
                </MenuItem>
              </Menu>
            )}
          </div>
          </div>
        </div>
      </header>

      {w.archivedAt && (
        <div className="notice">
          <Archive size={18} aria-hidden />
          <div style={{ flex: 1 }}>This {collection ? 'collection' : 'wishlist'} is archived. Its sharing link is paused and it's hidden from your dashboard.</div>
          {isOwner && (
            <Button size="sm" onClick={() => listActions.setArchived(w, false)}>
              Restore
            </Button>
          )}
        </div>
      )}
      {isOwner && w.link && (
        <div className="notice">
          <RefreshCw size={18} aria-hidden />
          <div style={{ flex: 1 }}>{linkedListNote(w.link)}</div>
          <Link to={`/app/settings?tab=${w.link.provider}`} className="btn btn-sm">
            Sync settings
          </Link>
        </div>
      )}
      {isRecipient && !claimsVisible && rows.length > 0 && (
        <div className="notice notice-accent">
          <Gift size={18} aria-hidden />
          <div>
            <strong>It’s a surprise!</strong> {firstName(detail.owner.displayName)} is keeping who reserved or bought what hidden from you.
          </div>
        </div>
      )}
      {collection && rows.length > 0 && <CollectionStats items={rows.map((r) => r.item)} privateValues={canEdit} />}

      {(() => {
        const fund = w.cashFund;
        if (collection || !fund) return null;
        const methods = filterPaymentMethods(detail.paymentMethods ?? [], fund.providers);
        const viewFund = {
          title: fund.title,
          note: fund.note,
          goalCents: fund.goalCents,
          raisedCents: detail.raisedCents,
          paymentMethods: methods,
          icon: fund.icon ?? 'cash',
        };
        if (fund.displayMode === 'banner') {
          return (
            <CashFundDisplay
              fund={viewFund}
              mode="banner"
              className="cash-fund-owner"
              onEdit={isOwner ? () => setCashFundOpen(true) : undefined}
            />
          );
        }
        return null;
      })()}

      {rows.length > 0 && (() => {
        const filtersActive =
          (showPriority && priorityFilter !== 'all') ||
          effectiveSort !== 'custom' ||
          (isOwner && !collection && layout !== 'grouped');
        const filterControls = (
          <>
            {isOwner && !collection && (
              <select
                className="select"
                value={layout}
                onChange={(e) => void setLayout(e.target.value as PriorityLayout)}
                aria-label="Arrange items"
                title="How this list is arranged — for you and everyone you share it with"
              >
                {PRIORITY_LAYOUTS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            )}
            {showPriority && (
              <select className="select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')} aria-label="Filter by priority">
                <option value="all">All priorities</option>
                {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            )}
            <label className="row text-sm muted toolbar-sort">
              <span>Sort</span>
              <select className="select" value={effectiveSort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort items">
                <option value="custom">{collection ? 'Custom order' : 'List order'}</option>
                {collection && <option value="acquired">Recently acquired</option>}
                {collection && <option value="rating">Top rated</option>}
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="newest">Recently added</option>
                <option value="name">Name</option>
              </select>
            </label>
          </>
        );
        return (
          <div className="toolbar toolbar-items">
            <div className="input-group toolbar-items-search">
              <Search size={16} aria-hidden />
              <input className="input" type="search" placeholder="Search this list" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search this list" />
            </div>
            <div className="toolbar-items-mobile-actions">
              <Popover
                label={filtersActive ? 'Filters (active)' : 'Filters'}
                align="end"
                buttonClassName={`btn toolbar-filters-btn${filtersActive ? ' is-active' : ''}`}
                buttonContent={
                  <>
                    <SlidersHorizontal size={18} aria-hidden />
                    <span>Filters</span>
                    {filtersActive && <span className="toolbar-filters-dot" aria-hidden />}
                  </>
                }
                className="toolbar-filters-panel"
              >
                {() => (
                  <div className="toolbar-filters-stack">
                    <strong className="toolbar-filters-title">Filters &amp; sort</strong>
                    {filterControls}
                  </div>
                )}
              </Popover>
              <ViewToggle value={view} onChange={setView} labels="grid" />
            </div>
          </div>
        );
      })()}

      {(() => {
        const fund = !collection && w.cashFund?.displayMode === 'card' ? w.cashFund : null;
        const cashFundCard = fund ? (
          <CashFundDisplay
            fund={{
              title: fund.title,
              note: fund.note,
              goalCents: fund.goalCents,
              raisedCents: detail.raisedCents,
              paymentMethods: filterPaymentMethods(detail.paymentMethods ?? [], fund.providers),
              icon: fund.icon ?? 'cash',
            }}
            mode="card"
            onEdit={isOwner ? () => setCashFundOpen(true) : undefined}
          />
        ) : null;
        const itemsClass = view === 'grid' ? 'grid-items' : 'list-items';
        const activeIds = displayRows.map((r) => r.entry.id);
        const hasActive = displayRows.length > 0 || Boolean(cashFundCard);

        if (rows.length === 0) {
          return (
            <>
              {cashFundCard ? <div className="grid-items">{cashFundCard}</div> : null}
              <EmptyState
                art={<SkyArt scene={collection ? 'collection' : 'wishlist'} />}
                title={collection ? 'Nothing in this collection yet' : cashFundCard ? 'No items yet' : 'This list is empty'}
                action={
                  canEdit && !w.archivedAt ? (
                    <div className="row-wrap" style={{ justifyContent: 'center' }}>
                      <Button variant="primary" icon={<Plus size={16} />} onClick={addItem}>
                        Add the first item
                      </Button>
                      <Button icon={<ListPlus size={16} />} onClick={addSeveral}>
                        Paste several links
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                {!canEdit
                  ? 'Nothing has been added yet.'
                  : collection
                    ? 'Add things you already have — paste a link, upload a photo, or tap “Got it!” on a wishlist item to move it here.'
                    : 'Paste a link from any store, add an experience, or jot down an idea.'}
              </EmptyState>
            </>
          );
        }

        if (filtered.length === 0) {
          return (
            <EmptyState icon={<Search size={22} />} title="No matching items">
              Try a different search or filter.
            </EmptyState>
          );
        }

        if (!hasActive && gotItFiltered.length) {
          return <>{renderGotItSection(itemsClass, false)}</>;
        }

        if (grouped) {
          return (
            <>
              {cashFundCard ? <div className={itemsClass} style={{ marginBottom: 'var(--s-4)' }}>{cashFundCard}</div> : null}
              <PrioritySections
                rows={displayRows}
                idOf={(r) => r.entry.id}
                priorityOf={(r) => r.entry.priority}
                view={view}
                renderCard={renderCard}
                onReorderSection={canDrag ? (ids) => reorder(mergeSectionOrder(orderedIds, ids)) : undefined}
                dragLabel={(r) => `Reorder ${r.item.title}`}
              />
              {renderGotItSection(itemsClass, true)}
            </>
          );
        }

        if (canDrag) {
          return (
            <>
              <SortableList
                ids={activeIds}
                layout={view === 'grid' ? 'grid' : 'list'}
                className={itemsClass}
                leading={cashFundCard}
                onReorder={(ids) => {
                  const gotItIds = orderedIds.filter((id) => {
                    const r = rowById.get(id);
                    return r?.item.owned;
                  });
                  void reorder([...ids, ...gotItIds]);
                }}
                renderItem={(eid, handle) => {
                  const r = rowById.get(eid);
                  return r ? renderCard(r, <DragHandle handle={handle} label={`Reorder ${r.item.title}`} />) : null;
                }}
              />
              {renderGotItSection(itemsClass, true)}
            </>
          );
        }

        return (
          <>
            <div className={itemsClass}>
              {cashFundCard}
              {displayRows.map((r) => (
                <div key={r.entry.id} style={{ minWidth: 0 }}>
                  {renderCard(r)}
                </div>
              ))}
            </div>
            {renderGotItSection(itemsClass, hasActive)}
          </>
        );
      })()}
      <div style={{ height: 'var(--s-12)' }} />

      <ItemDetailModal
        item={openRow?.item ?? null}
        onClose={() => setOpenItem(null)}
        priority={showPriority ? openRow?.entry.priority : null}
        entryNote={collection ? undefined : openRow?.entry.customNotes}
        alreadyHave={openRow && !collection ? alreadyHaveFor(openRow) : undefined}
        badges={openRow ? statusBadge(openRow) : null}
        footer={
          openRow && canEdit ? (
            <>
              {isOwner && !collection && !synced(openRow.item) && (
                <Button
                  icon={<PartyPopper size={16} />}
                  onClick={() => {
                    setGotIt(openRow.item);
                    setOpenItem(null);
                  }}
                >
                  {openRow.item.owned ? 'File in a collection…' : 'Got it!'}
                </Button>
              )}
              {!collection && (
                <Button
                  onClick={() => {
                    setEntrySettings(openRow.entry);
                  }}
                >
                  This wish…
                </Button>
              )}
              <Button
                variant="primary"
                icon={<Pencil size={16} />}
                onClick={() => {
                  setEditingItem(openRow.item);
                  setEditingEntry(collection ? null : openRow.entry);
                  setOpenItem(null);
                }}
              >
                Edit item
              </Button>
            </>
          ) : undefined
        }
      >
        {openRow?.entry.groupGift && (
          <div className="claim-box">
            <strong className="row" style={{ gap: 6 }}>
              <Users size={16} aria-hidden /> Group gift
            </strong>
            {openRow.entry.groupGiftNote && <p className="text-sm muted">{openRow.entry.groupGiftNote}</p>}
            {claimsVisible ? (
              openRow.pledges.length ? (
                <div className="pledge-list">
                  {openRow.pledges.map((p, i) => (
                    <div className="pledge" key={i}>
                      <Avatar name={p.name} size={26} />
                      <div>
                        <strong>{p.name}</strong> {p.role === 'coordinator' && <span className="badge">Coordinator</span>}
                        {p.message && <p className="muted">{p.message}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm muted">Nobody has joined yet.</p>
              )
            ) : (
              <p className="text-sm muted">Who's chipping in is hidden while Surprise Mode is on.</p>
            )}
          </div>
        )}
        {openRow?.claim && (
          <div className="claim-box">
            <strong>{openRow.claim.status === 'purchased' ? 'Purchased' : 'Reserved'} by {openRow.claim.claimantName || 'someone'}</strong>
            {openRow.claim.message && <p className="text-sm">“{openRow.claim.message}”</p>}
            <p className="text-xs muted">
              {openRow.claim.status === 'purchased' && openRow.claim.purchasedAt ? `Bought ${relativeTime(openRow.claim.purchasedAt)}` : `Reserved ${relativeTime(openRow.claim.reservedAt)}`}
              {openRow.claim.status === 'reserved' && openRow.claim.expiresAt ? ` · expires ${formatDate(openRow.claim.expiresAt)}` : ''}
            </p>
          </div>
        )}
      </ItemDetailModal>

      <EditItemModal
        item={editingItem}
        onClose={() => {
          setEditingItem(null);
          setEditingEntry(null);
        }}
        isOwner={isOwner}
        inCollection={collection}
        wishlistContext={!collection && editingEntry ? { wishlistId: w.id, entry: editingEntry } : null}
      />
      {isOwner && !collection && <GotItDialog item={gotIt} fromWishlist={{ id: w.id, title: w.title }} onClose={() => setGotIt(null)} />}
      {isOwner && (
        <PutInBoxDialog itemIds={boxFor ? [boxFor.id] : []} currentBoxId={boxFor?.boxId ?? null} title={boxFor?.title ?? ''} open={Boolean(boxFor)} onClose={() => setBoxFor(null)} />
      )}
      <ItemListsDialog item={listsFor} onClose={() => setListsFor(null)} />
      <EntrySettingsDialog wishlistId={w.id} entry={entrySettings} itemTitle={entrySettings ? (detail.items[entrySettings.itemId]?.title ?? '') : ''} onClose={() => setEntrySettings(null)} />
      <MoveEntryDialog detail={detail} entry={moving} onClose={() => setMoving(null)} />
      {isOwner && (
        <>
          <WishlistFormModal open={editingList} onClose={() => setEditingList(false)} onSaved={() => setEditingList(false)} wishlist={w} />
          <ShareDialog open={sharing} onClose={() => setSharing(false)} wishlist={w} whose={possessiveNames(people.length ? people.map((p) => p.name) : [firstName(detail.owner.displayName)])} />
          <GiftSettingsDialog open={giftSettings} onClose={() => setGiftSettings(false)} wishlist={w} />
          <CashFundDialog
            open={cashFundOpen}
            onClose={() => setCashFundOpen(false)}
            wishlist={w}
            paymentMethods={detail.paymentMethods ?? []}
            raisedCents={detail.raisedCents}
          />
        </>
      )}
      <CollaboratorsDialog open={collaborators} onClose={() => setCollaborators(false)} detail={detail} />
    </ThemedPage>
  );
}
