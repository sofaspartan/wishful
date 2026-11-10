import { useEffect, useMemo, useState } from 'react';
import { Archive, Library, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { WishlistSummary } from '../../shared/types';
import { keys, useWishlists } from '../lib/queries';
import { errorMessage, put } from '../lib/api';
import { useLocalPref } from '../lib/prefs';
import { useAppActions } from '../components/appActions';
import { WishlistCard, WishlistCardSkeleton } from '../components/WishlistCard';
import { WishlistCardMenu } from '../components/WishlistMenu';
import { DragHandle, SortableList } from '../components/Sortable';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';
import { SkyArt } from '../components/SkyArt';
import { ListsSwitch } from '../components/ListsSwitch';
import { useToast } from '../components/ui/Toast';

const SORTS = ['custom', 'updated', 'date', 'name'] as const;
type Sort = (typeof SORTS)[number];
const KIND_FILTERS = ['all', 'wishlist', 'collection'] as const;
type KindFilter = (typeof KIND_FILTERS)[number];

function sortLists(lists: WishlistSummary[], sort: Sort): WishlistSummary[] {
  if (sort === 'custom') return lists;
  const copy = [...lists];
  if (sort === 'updated') copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (sort === 'name') copy.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'date') copy.sort((a, b) => (a.eventDate ?? '9999').localeCompare(b.eventDate ?? '9999'));
  return copy;
}

export default function Wishlists() {
  const { data: lists, isLoading } = useWishlists();
  const { openCreateWishlist } = useAppActions();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [sort, setSort] = useLocalPref<Sort>('lists.sort', 'custom', SORTS);
  const [kind, setKind] = useLocalPref<KindFilter>('lists.kind', 'all', KIND_FILTERS);
  const [order, setOrder] = useState<string[] | null>(null);

  useEffect(() => setOrder(null), [lists]);

  const all = useMemo(() => lists ?? [], [lists]);
  const active = all.filter((w) => !w.archivedAt);
  const archived = all.filter((w) => w.archivedAt);
  const byId = useMemo(() => new Map(all.map((w) => [w.id, w])), [all]);

  const ofKind = (w: WishlistSummary) => kind === 'all' || w.kind === kind;
  const shown = (tab === 'active' ? active : archived).filter(ofKind);
  const sorted = sortLists(shown, sort);
  const activeIds = order ?? active.map((w) => w.id);
  // Reordering works on the full list, so it's only offered when nothing is filtered out.
  const canDrag = tab === 'active' && sort === 'custom' && kind === 'all' && active.length > 1;
  const collectionsOnly = kind === 'collection';

  const reorder = async (ids: string[]) => {
    setOrder(ids);
    const full = [...ids, ...archived.map((w) => w.id)];
    qc.setQueryData<WishlistSummary[]>(keys.wishlists, (prev) => (prev ? full.map((id) => prev.find((w) => w.id === id)!).filter(Boolean) : prev));
    try {
      await put('/api/wishlists/order', { ids: full });
    } catch (err) {
      toast.error(errorMessage(err));
      void qc.invalidateQueries({ queryKey: keys.wishlists });
    }
  };

  return (
    <div className="page">
      <ListsSwitch />
      <div className="page-header">
        <div>
          <h1 className="page-title display">My Lists</h1>
          <p className="page-subtitle">Wishlists for the things you want, collections for the things you already have.</p>
        </div>
        <div className="page-actions">
          <Button icon={<Library size={16} />} onClick={() => openCreateWishlist({ kind: 'collection' })}>
            New collection
          </Button>
          <Button variant="primary" icon={<Plus size={17} />} onClick={() => openCreateWishlist()}>
            New wishlist
          </Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="List status" style={{ borderBottom: 0 }}>
          <button type="button" role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')}>
            Active <span className="faint">{active.filter(ofKind).length}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'archived'} onClick={() => setTab('archived')}>
            Archived <span className="faint">{archived.filter(ofKind).length}</span>
          </button>
        </div>
        <div className="segmented" role="group" aria-label="Show">
          {KIND_FILTERS.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === 'all' ? 'All' : k === 'wishlist' ? 'Wishlists' : 'Collections'}
            </button>
          ))}
        </div>
        <label className="row text-sm muted" style={{ gap: 8, marginLeft: 'auto' }}>
          <span className="hide-xs">Sort</span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort lists">
            <option value="custom">Custom order</option>
            <option value="updated">Recently updated</option>
            <option value="date">Upcoming date</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="grid-lists">
          {Array.from({ length: 3 }, (_, i) => (
            <WishlistCardSkeleton key={i} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        tab === 'active' ? (
          collectionsOnly ? (
            <EmptyState
              tone="blush"
              art={<SkyArt scene="collection" />}
              title="No collections yet"
              action={
                <Button variant="primary" icon={<Plus size={16} />} onClick={() => openCreateWishlist({ kind: 'collection' })}>
                  Start a collection
                </Button>
              }
            >
              Keep a record of what you already have — vinyl, sneakers, books, plants. When you get something from a wishlist, tap “Got it” to move it here.
            </EmptyState>
          ) : (
            <EmptyState
              art={<SkyArt scene="wishlist" />}
              title="No wishlists yet"
              action={
                <Button variant="primary" icon={<Plus size={16} />} onClick={() => openCreateWishlist()}>
                  Create a wishlist
                </Button>
              }
            >
              Make one for a birthday, the holidays, a new home or just things you love.
            </EmptyState>
          )
        ) : (
          <EmptyState icon={<Archive size={22} />} title="Nothing archived">
            Archive lists you're done with — they stay safe here and you can restore them any time.
          </EmptyState>
        )
      ) : canDrag ? (
        <SortableList
          ids={activeIds}
          layout="grid"
          className="grid-lists"
          onReorder={reorder}
          renderItem={(id, handle) => {
            const w = byId.get(id);
            if (!w) return null;
            return <WishlistCard wishlist={w} menu={<WishlistCardMenu wishlist={w} />} dragHandle={<DragHandle handle={handle} label={`Reorder ${w.title}`} />} />;
          }}
        />
      ) : (
        <div className="grid-lists">
          {sorted.map((w) => (
            <WishlistCard key={w.id} wishlist={w} menu={<WishlistCardMenu wishlist={w} />} />
          ))}
        </div>
      )}
      {canDrag && <p className="faint text-xs" style={{ marginTop: 'var(--s-4)' }}>Tip: drag the handle on a card to change the order.</p>}
      <div style={{ height: 'var(--s-12)' }} />
    </div>
  );
}
