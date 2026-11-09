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
  LayoutGrid,
  ListChecks,
  ListPlus,
  LogOut,
  MoreHorizontal,
  PartyPopper,
  Pencil,
  Plus,
  Rows3,
  Search,
  Settings2,
  Share2,
  Trash2,
  Undo2,
  Users,
} from 'lucide-react';
import type { Item, OwnerClaimView, OwnerPledgeView, Priority, WishlistDetail as Detail, WishlistEntry } from '../../shared/types';
import { PRIORITY_LABELS, PRIORITY_RANK } from '../../shared/constants';
import { keys, useMe, useWishlist, useInvalidate } from '../lib/queries';
import { ApiError, del, errorMessage, post, put } from '../lib/api';
import { countdownLabel, formatDate, relativeTime } from '../lib/format';
import { shareUrl, useLocalPref } from '../lib/prefs';
import { useAppActions } from '../components/appActions';
import { ItemCard } from '../components/ItemCard';
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
import { WishlistFormModal } from '../components/WishlistFormModal';
import { CollaboratorsDialog, EntrySettingsDialog, GiftSettingsDialog, MoveEntryDialog, ShareDialog } from '../components/WishlistDialogs';
import { useWishlistActions } from '../components/WishlistMenu';
import { DragHandle, SortableList } from '../components/Sortable';
import { Menu, MenuItem, MenuSeparator } from '../components/ui/Menu';
import { Button } from '../components/ui/Button';
import { Avatar, EmptyState, PageLoader, useConfirm } from '../components/ui/misc';
import { useToast } from '../components/ui/Toast';

const SORTS = ['custom', 'priority', 'acquired', 'price_asc', 'price_desc', 'newest', 'name'] as const;
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
  const collection = w.kind === 'collection';

  const [view, setView] = useLocalPref('detail.view', 'grid', VIEWS);
  const [sort, setSort] = useLocalPref<Sort>('detail.sort', 'custom', SORTS);
  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [order, setOrder] = useState<string[] | null>(null);

  const [editingList, setEditingList] = useState(params.get('edit') === '1');
  const [sharing, setSharing] = useState(params.get('share') === '1');
  const [giftSettings, setGiftSettings] = useState(false);
  const [collaborators, setCollaborators] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [listsFor, setListsFor] = useState<Item | null>(null);
  const [entrySettings, setEntrySettings] = useState<WishlistEntry | null>(null);
  const [moving, setMoving] = useState<WishlistEntry | null>(null);
  const [gotIt, setGotIt] = useState<Item | null>(null);

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

  const effectiveSort: Sort = collection ? (sort === 'priority' ? 'custom' : sort) : sort === 'acquired' ? 'custom' : sort;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (priorityFilter !== 'all' && r.entry.priority !== priorityFilter) return false;
      if (!q) return true;
      const i = r.item;
      return [i.title, i.description, i.retailer, i.brand, i.category, i.tags.join(' '), i.metadata.location ?? '', i.metadata.venue ?? ''].some((s) => s.toLowerCase().includes(q));
    });
    if (effectiveSort !== 'custom') {
      list = [...list];
      const price = (r: Row) => effectivePrice(r.item);
      if (effectiveSort === 'priority') list.sort((a, b) => (a.entry.priority ? PRIORITY_RANK[a.entry.priority] : 9) - (b.entry.priority ? PRIORITY_RANK[b.entry.priority] : 9));
      if (effectiveSort === 'acquired') list.sort((a, b) => (b.item.owned?.acquiredOn ?? '').localeCompare(a.item.owned?.acquiredOn ?? ''));
      if (effectiveSort === 'price_asc') list.sort((a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity));
      if (effectiveSort === 'price_desc') list.sort((a, b) => (price(b) ?? -1) - (price(a) ?? -1));
      if (effectiveSort === 'newest') list.sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt));
      if (effectiveSort === 'name') list.sort((a, b) => a.item.title.localeCompare(b.item.title));
    }
    return list;
  }, [rows, query, priorityFilter, effectiveSort]);

  const canDrag = canEdit && effectiveSort === 'custom' && !query.trim() && priorityFilter === 'all' && rows.length > 1 && !w.archivedAt;
  const orderedIds = order ?? rows.map((r) => r.entry.id);

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
      navigate('/app/shared');
      toast.success('You left the wishlist');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const addItem = () => openAddItem({ wishlistId: w.id, lockedToWishlist: !isOwner });
  const addSeveral = () => openAddItem({ mode: 'bulk', wishlistId: w.id, lockedToWishlist: !isOwner });

  const statusBadge = (r: Row) => {
    if (collection) return null;
    if (!r.claim) return r.entry.groupGift && r.pledges.length ? <span className="badge badge-info">{r.pledges.length} chipping in</span> : null;
    const name = r.claim.claimantName || 'Someone';
    return r.claim.status === 'purchased' ? <span className="badge badge-success">Bought by {name}</span> : <span className="badge badge-warning">Reserved by {name}</span>;
  };

  const itemMenu = (r: Row) =>
    canEdit ? (
      <Menu label={`Actions for ${r.item.title}`} icon={<MoreHorizontal size={18} />} buttonClassName="btn btn-icon btn-sm">
        <MenuItem icon={<Pencil size={16} />} onSelect={() => setEditingItem(r.item)}>
          Edit item
        </MenuItem>
        {isOwner && !collection && (
          <MenuItem icon={<PartyPopper size={16} />} onSelect={() => setGotIt(r.item)}>
            Got it!
          </MenuItem>
        )}
        {!collection && (
          <MenuItem icon={<Settings2 size={16} />} onSelect={() => setEntrySettings(r.entry)}>
            Priority, note & group gift
          </MenuItem>
        )}
        <MenuItem icon={<ArrowLeft size={16} style={{ transform: 'scaleX(-1)' }} />} onSelect={() => setMoving(r.entry)}>
          Move to another list
        </MenuItem>
        {isOwner && (
          <MenuItem icon={<ListChecks size={16} />} onSelect={() => setListsFor(r.item)}>
            Add to other lists
          </MenuItem>
        )}
        {r.claim && (
          <MenuItem icon={<Undo2 size={16} />} onSelect={() => clearClaim(r)}>
            Clear reservation
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem icon={<Trash2 size={16} />} danger onSelect={() => removeEntry(r)}>
          Remove from list
        </MenuItem>
      </Menu>
    ) : null;

  const renderCard = (r: Row, dragHandle?: ReactNode) => (
    <ItemCard
      item={r.item}
      priority={collection ? null : r.entry.priority}
      owned={collection ? r.item.owned : null}
      status={statusBadge(r)}
      dimmed={r.claim?.status === 'purchased'}
      groupGift={r.entry.groupGift}
      onOpen={() => setOpenItem(r.item.id)}
      menu={itemMenu(r)}
      dragHandle={dragHandle}
      view={view}
    />
  );

  const days = countdownLabel(w.eventDate);

  return (
    <div className="page">
      <Link to={isOwner ? '/app/lists' : '/app/shared'} className="section-link" style={{ marginLeft: 0, marginBottom: 'var(--s-3)' }}>
        <ArrowLeft size={14} /> {isOwner ? 'My Lists' : 'Shared With Me'}
      </Link>

      <header
        className={['wl-hero', !w.coverImage && (w.coverArt?.backdrop === 'night' || w.coverArt?.backdrop === 'snow') && 'wl-hero-dark'].filter(Boolean).join(' ')}
        style={{ ['--wl-accent' as string]: w.accentColor }}
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
          <div className="row-wrap">
            {isOwner ? <VisibilityBadge visibility={w.visibility} outline /> : <span className="badge badge-outline">{detail.role === 'editor' ? 'You can edit' : 'View only'}</span>}
            {collection && <CollectionBadge outline />}
            {w.surpriseMode && (
              <span className="badge badge-accent">
                <Gift aria-hidden /> Surprise Mode
              </span>
            )}
            {w.archivedAt && <span className="badge">Archived</span>}
          </div>
          <h1 className="wl-hero-title display">{w.title}</h1>
          {w.description && (
            <p className="muted" style={{ maxWidth: 680, whiteSpace: 'pre-line' }}>
              {w.description}
            </p>
          )}
          <div className="row-wrap text-sm muted" style={{ gap: 'var(--s-4)' }}>
            {!isOwner && (
              <span className="row" style={{ gap: 6 }}>
                <Avatar name={detail.owner.displayName} src={detail.owner.avatarUrl} size={22} /> {detail.owner.displayName}
              </span>
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
              <Button variant="primary" icon={<Plus size={17} />} onClick={addItem}>
                Add item
              </Button>
            )}
            {canEdit && !w.archivedAt && (
              <Button icon={<ListPlus size={16} />} onClick={addSeveral} className="hide-xs">
                Add several
              </Button>
            )}
            {isOwner && !w.archivedAt && (
              <Button icon={<Share2 size={16} />} onClick={() => setSharing(true)}>
                Share
              </Button>
            )}
            {isOwner && !collection && (
              <Button icon={<Gift size={16} />} onClick={() => setGiftSettings(true)}>
                <span className="hide-xs">Gift settings</span>
                <span className="show-xs">Gifts</span>
              </Button>
            )}
            {(isOwner || w.collaborators.length > 0) && (
              <Button icon={<Users size={16} />} onClick={() => setCollaborators(true)} className="hide-xs">
                Collaborators
              </Button>
            )}
            {!isOwner && w.shareToken && w.visibility !== 'private' && (
              <a className="btn" href={shareUrl(w.shareToken)} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden /> Shared page
              </a>
            )}
            {isOwner ? (
              <Menu label="More list actions" icon={<MoreHorizontal size={18} />} buttonClassName="btn btn-icon">
                <MenuItem icon={<Pencil size={16} />} onSelect={() => setEditingList(true)}>
                  Edit details
                </MenuItem>
                <MenuItem icon={<Users size={16} />} onSelect={() => setCollaborators(true)}>
                  Collaborators
                </MenuItem>
                {w.shareToken && w.visibility !== 'private' && (
                  <MenuItem icon={<ExternalLink size={16} />} onSelect={() => window.open(shareUrl(w.shareToken!), '_blank', 'noopener')}>
                    Open shared page
                  </MenuItem>
                )}
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
              <Button variant="ghost" icon={<LogOut size={16} />} onClick={leave}>
                Leave
              </Button>
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
      {canEdit && !claimsVisible && w.surpriseMode && rows.length > 0 && (
        <div className="notice notice-accent">
          <Gift size={18} aria-hidden />
          <div>
            <strong>Surprise Mode is on.</strong> Reservations and purchases are hidden from {isOwner ? 'you' : 'the owner and editors'} so gifts stay a surprise.
          </div>
        </div>
      )}
      {canEdit && claimsVisible && !w.surpriseMode && !collection && rows.length > 0 && (
        <div className="notice">
          <Gift size={18} aria-hidden />
          <div>Surprise Mode is off — you can see what's been reserved. Gifts reserved while Surprise Mode was on stay hidden.</div>
        </div>
      )}

      {collection && rows.length > 0 && <CollectionStats items={rows.map((r) => r.item)} privateValues={canEdit} />}

      {rows.length > 0 && (
        <div className="toolbar">
          <div className="input-group">
            <Search size={16} aria-hidden />
            <input className="input" type="search" placeholder="Search this list" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search this list" />
          </div>
          {!collection && (
            <select className="select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as Priority | 'all')} aria-label="Filter by priority">
              <option value="all">All priorities</option>
              {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          )}
          <select className="select" value={effectiveSort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort items">
            <option value="custom">Custom order</option>
            {collection ? <option value="acquired">Recently acquired</option> : <option value="priority">Priority</option>}
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="newest">Recently added</option>
            <option value="name">Name</option>
          </select>
          <div className="segmented" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')} title="Grid view">
              <LayoutGrid size={16} aria-hidden />
              <span className="sr-only">Grid view</span>
            </button>
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} title="List view">
              <Rows3 size={16} aria-hidden />
              <span className="sr-only">List view</span>
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          tone={collection ? 'blush' : undefined}
          art={<SkyArt scene={collection ? 'collection' : 'wishlist'} />}
          title={collection ? 'Nothing in this collection yet' : 'This list is empty'}
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
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search size={22} />} title="No matching items">
          Try a different search or filter.
        </EmptyState>
      ) : canDrag ? (
        <SortableList
          ids={orderedIds}
          layout={view === 'grid' ? 'grid' : 'list'}
          className={view === 'grid' ? 'grid-items' : 'list-items'}
          onReorder={reorder}
          renderItem={(eid, handle) => {
            const r = rowById.get(eid);
            return r ? renderCard(r, <DragHandle handle={handle} label={`Reorder ${r.item.title}`} />) : null;
          }}
        />
      ) : (
        <div className={view === 'grid' ? 'grid-items' : 'list-items'}>
          {filtered.map((r) => (
            <div key={r.entry.id} style={{ minWidth: 0 }}>
              {renderCard(r)}
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 'var(--s-12)' }} />

      <ItemDetailModal
        item={openRow?.item ?? null}
        onClose={() => setOpenItem(null)}
        priority={collection ? null : openRow?.entry.priority}
        entryNote={collection ? undefined : openRow?.entry.customNotes}
        badges={openRow ? statusBadge(openRow) : null}
        footer={
          openRow && canEdit ? (
            <>
              {isOwner && !collection && (
                <Button
                  icon={<PartyPopper size={16} />}
                  onClick={() => {
                    setGotIt(openRow.item);
                    setOpenItem(null);
                  }}
                >
                  Got it!
                </Button>
              )}
              {!collection && (
                <Button
                  onClick={() => {
                    setEntrySettings(openRow.entry);
                  }}
                >
                  List settings
                </Button>
              )}
              <Button
                variant="primary"
                icon={<Pencil size={16} />}
                onClick={() => {
                  setEditingItem(openRow.item);
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

      <EditItemModal item={editingItem} onClose={() => setEditingItem(null)} isOwner={isOwner} inCollection={collection} />
      {isOwner && !collection && <GotItDialog item={gotIt} fromWishlist={{ id: w.id, title: w.title }} onClose={() => setGotIt(null)} />}
      <ItemListsDialog item={listsFor} onClose={() => setListsFor(null)} />
      <EntrySettingsDialog wishlistId={w.id} entry={entrySettings} itemTitle={entrySettings ? (detail.items[entrySettings.itemId]?.title ?? '') : ''} onClose={() => setEntrySettings(null)} />
      <MoveEntryDialog detail={detail} entry={moving} onClose={() => setMoving(null)} />
      {isOwner && (
        <>
          <WishlistFormModal open={editingList} onClose={() => setEditingList(false)} onSaved={() => setEditingList(false)} wishlist={w} />
          <ShareDialog open={sharing} onClose={() => setSharing(false)} wishlist={w} ownerName={detail.owner.displayName} />
          <GiftSettingsDialog open={giftSettings} onClose={() => setGiftSettings(false)} wishlist={w} />
        </>
      )}
      <CollaboratorsDialog open={collaborators} onClose={() => setCollaborators(false)} detail={detail} />
    </div>
  );
}
