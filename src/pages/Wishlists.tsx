import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Archive, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { WishlistSummary } from '../../shared/types';
import { isTaskList } from '../../shared/constants';
import { keys, useSharedWishlists, useWishlists } from '../lib/queries';
import { errorMessage, put } from '../lib/api';
import { useLocalPref } from '../lib/prefs';
import { useAppActions } from '../components/appActions';
import { CreateMenu } from '../components/CreateMenu';
import { SharedListsPanel } from '../components/SharedListsPanel';
import { WishlistCard, WishlistCardSkeleton } from '../components/WishlistCard';
import { WishlistCardMenu } from '../components/WishlistMenu';
import { DragHandle, SortableList } from '../components/Sortable';
import { CARD_LIST_VIEWS, ViewToggle, type CardListView } from '../components/ViewToggle';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';
import { PageSky } from '../components/PageSky';
import { SkyArt } from '../components/SkyArt';
import { ListsSwitch } from '../components/ListsSwitch';
import { Popover } from '../components/ui/Popover';
import { useToast } from '../components/ui/Toast';

const SORTS = ['custom', 'updated', 'date', 'name'] as const;
type Sort = (typeof SORTS)[number];
type KindFilter = 'wishlist' | 'collection' | 'lists';
type StatusTab = 'active' | 'archived' | 'shared';

function kindFromParams(value: string | null): KindFilter {
  if (value === 'collection') return 'collection';
  if (value === 'lists') return 'lists';
  return 'wishlist';
}

function sortLists(lists: WishlistSummary[], sort: Sort): WishlistSummary[] {
  if (sort === 'custom') return lists;
  const copy = [...lists];
  if (sort === 'updated') copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (sort === 'name') copy.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'date') copy.sort((a, b) => (a.eventDate ?? '9999').localeCompare(b.eventDate ?? '9999'));
  return copy;
}

function statusFromParams(value: string | null): StatusTab {
  if (value === 'archived' || value === 'shared') return value;
  return 'active';
}

export default function Wishlists() {
  const { data: lists, isLoading } = useWishlists();
  const { data: shared = [] } = useSharedWishlists();
  const { openCreateWishlist } = useAppActions();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const kind = kindFromParams(params.get('kind'));
  const tab = statusFromParams(params.get('status'));
  const [sort, setSort] = useLocalPref<Sort>('lists.sort', 'custom', SORTS);
  const [view, setView] = useLocalPref<CardListView>('lists.view', 'grid', CARD_LIST_VIEWS);
  const [order, setOrder] = useState<string[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => setOrder(null), [lists, kind]);

  const setTab = (next: StatusTab) => {
    const updated = new URLSearchParams(params);
    if (next === 'active') updated.delete('status');
    else updated.set('status', next);
    setParams(updated, { replace: true });
  };

  const all = useMemo(() => lists ?? [], [lists]);
  const active = all.filter((w) => !w.archivedAt);
  const archived = all.filter((w) => w.archivedAt);
  const byId = useMemo(() => new Map(all.map((w) => [w.id, w])), [all]);

  const ofKind = (w: WishlistSummary) =>
    kind === 'lists' ? isTaskList(w) : kind === 'collection' ? w.kind === 'collection' : w.kind === 'wishlist' || !w.kind;
  const q = query.trim().toLowerCase();
  const matchesQuery = (w: WishlistSummary) =>
    !q || [w.title, w.description, w.occasion, ...(w.recipients?.map((r) => r.name) ?? [])].some((s) => (s ?? '').toLowerCase().includes(q));
  const shown = (tab === 'active' ? active : archived).filter(ofKind).filter(matchesQuery);
  const sorted = sortLists(shown, sort);
  const kindActiveIds = active.filter(ofKind).map((w) => w.id);
  const activeIds = order ?? kindActiveIds;
  const canDrag = tab === 'active' && sort === 'custom' && kindActiveIds.length > 1 && view === 'grid' && !q;
  const collectionsOnly = kind === 'collection';
  const taskListsOnly = kind === 'lists';
  const sharedCount = shared.filter((w) => !w.archivedAt && ofKind(w)).length;
  const panelFiltersActive = tab !== 'active' || sort !== 'custom';

  const statusControls = (
    <div className="segmented view-toggle-tabs" role="tablist" aria-label="List status">
      <button type="button" role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')}>
        Active <span className="faint">{active.filter(ofKind).length}</span>
      </button>
      <button type="button" role="tab" aria-selected={tab === 'archived'} onClick={() => setTab('archived')}>
        Archived <span className="faint">{archived.filter(ofKind).length}</span>
      </button>
      <button type="button" role="tab" aria-selected={tab === 'shared'} onClick={() => setTab('shared')}>
        Shared <span className="faint">{sharedCount}</span>
      </button>
    </div>
  );

  const sortControl =
    tab === 'shared' ? null : (
      <label className="row text-sm muted toolbar-sort">
        <span className="hide-xs">Sort</span>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort lists">
          <option value="custom">Custom order</option>
          <option value="updated">Recently updated</option>
          <option value="date">Upcoming date</option>
          <option value="name">Name</option>
        </select>
      </label>
    );

  const reorder = async (ids: string[]) => {
    setOrder(ids);
    const otherActive = active.filter((w) => !ofKind(w)).map((w) => w.id);
    const full =
      kind === 'wishlist'
        ? [...ids, ...otherActive, ...archived.map((w) => w.id)]
        : [...otherActive, ...ids, ...archived.map((w) => w.id)];
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
      <PageSky
        eyebrow={collectionsOnly ? 'Collections' : taskListsOnly ? 'Lists' : 'Wishlists'}
        title={collectionsOnly ? 'My Collections' : taskListsOnly ? 'My Lists' : 'My Wishlists'}
        subtitle={
          collectionsOnly
            ? 'A record of the things you already have — vinyl, sneakers, books, plants.'
            : taskListsOnly
              ? 'Simple lists, checklists, and to-dos — share them read-only or invite collaborators.'
              : 'Lists for birthdays, holidays, and everything you’re hoping for.'
        }
        art={<SkyArt scene={collectionsOnly ? 'collection' : 'wishlist'} />}
      >
        <div className="page-sky-actions">
          <CreateMenu />
        </div>
      </PageSky>

      <div className="toolbar toolbar-lists">
        <div className="input-group toolbar-lists-search">
          <Search size={16} aria-hidden />
          <input
            className="input"
            type="search"
            placeholder={collectionsOnly ? 'Search collections' : taskListsOnly ? 'Search lists' : 'Search wishlists'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={collectionsOnly ? 'Search collections' : taskListsOnly ? 'Search lists' : 'Search wishlists'}
          />
        </div>
        <div className="toolbar-items-mobile-actions">
          {tab !== 'active' && <span className="toolbar-filter-chip">{tab === 'archived' ? 'Archived' : 'Shared'}</span>}
          <Popover
            label={panelFiltersActive ? 'Filters (active)' : 'Filters'}
            align="end"
            buttonClassName={`btn toolbar-filters-btn${panelFiltersActive ? ' is-active' : ''}`}
            buttonContent={
              <>
                <SlidersHorizontal size={18} aria-hidden />
                <span>Filters</span>
                {panelFiltersActive && <span className="toolbar-filters-dot" aria-hidden />}
              </>
            }
            className="toolbar-filters-panel"
          >
            {() => (
              <div className="toolbar-filters-stack">
                <strong className="toolbar-filters-title">Filters &amp; sort</strong>
                {statusControls}
                {sortControl}
              </div>
            )}
          </Popover>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {tab === 'shared' ? (
        <SharedListsPanel kind={kind} view={view} />
      ) : isLoading ? (
        <div className={view === 'grid' ? 'grid-lists' : 'list-items'}>
          {Array.from({ length: 3 }, (_, i) => (
            <WishlistCardSkeleton key={i} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        q ? (
          <EmptyState icon={<Search size={22} />} title="No matching lists" action={<Button onClick={() => setQuery('')}>Clear search</Button>}>
            Try a different search.
          </EmptyState>
        ) : tab === 'active' ? (
          collectionsOnly ? (
            <EmptyState
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
          ) : taskListsOnly ? (
            <EmptyState
              art={<SkyArt scene="wishlist" />}
              title="No lists yet"
              action={
                <Button variant="primary" icon={<Plus size={16} />} onClick={() => openCreateWishlist({ kind: 'list' })}>
                  Create a list
                </Button>
              }
            >
              Make a simple list, a checklist with boxes, or a to-do list that strikes things out when they’re done.
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
            return <WishlistCard wishlist={w} view={view} menu={<WishlistCardMenu wishlist={w} />} dragHandle={<DragHandle handle={handle} label={`Reorder ${w.title}`} />} />;
          }}
        />
      ) : (
        <div className={view === 'grid' ? 'grid-lists' : 'list-items'}>
          {sorted.map((w) => (
            <WishlistCard key={w.id} wishlist={w} view={view} menu={<WishlistCardMenu wishlist={w} />} />
          ))}
        </div>
      )}
      {canDrag && (
        <p className="faint text-xs" style={{ marginTop: 'var(--s-4)' }}>
          Tip: drag the handle on a card to change the order.
        </p>
      )}
      <div style={{ height: 'var(--s-12)' }} />
    </div>
  );
}
