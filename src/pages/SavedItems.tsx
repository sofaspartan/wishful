import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ListChecks, MoreHorizontal, Package, PartyPopper, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Item, Priority } from '../../shared/types';
import { PRIORITY_LABELS, PRIORITY_RANK } from '../../shared/constants';
import { useItems, useWishlists, useInvalidate } from '../lib/queries';
import { del, errorMessage } from '../lib/api';
import { useLocalPref } from '../lib/prefs';
import { useAppActions } from '../components/appActions';
import { ItemCard, ItemCardSkeleton } from '../components/ItemCard';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { EditItemModal } from '../components/EditItemModal';
import { ItemListsDialog } from '../components/ItemListsDialog';
import { GotItDialog } from '../components/GotItDialog';
import { BoxChip, useBoxMap } from '../components/BoxVisuals';
import { PutInBoxDialog } from '../components/BoxDialogs';
import { PageSky } from '../components/PageSky';
import { SkyArt } from '../components/SkyArt';
import { effectivePrice } from '../components/ItemForm';
import { CARD_LIST_VIEWS, ViewToggle, type CardListView } from '../components/ViewToggle';
import { Menu, MenuItem, MenuSeparator } from '../components/ui/Menu';
import { Button } from '../components/ui/Button';
import { EmptyState, useConfirm } from '../components/ui/misc';
import { useToast } from '../components/ui/Toast';

const SORTS = ['newest', 'oldest', 'priority', 'price_asc', 'price_desc', 'name'] as const;
type Sort = (typeof SORTS)[number];
type ListFilter = 'all' | 'unlisted' | 'listed' | 'owned' | 'wanted' | string;
const RESERVED_FILTERS = ['all', 'unlisted', 'listed', 'owned', 'wanted', 'boxed', 'unboxed'];

export default function SavedItems() {
  const { data, isLoading } = useItems();
  const { data: lists = [] } = useWishlists();
  const { openAddItem } = useAppActions();
  const invalidate = useInvalidate();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();

  const [view, setView] = useLocalPref<CardListView>('items.view', 'grid', CARD_LIST_VIEWS);
  const [sort, setSort] = useLocalPref<Sort>('items.sort', 'newest', SORTS);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [editing, setEditing] = useState<Item | null>(null);
  const [listsFor, setListsFor] = useState<Item | null>(null);
  const [gotIt, setGotIt] = useState<Item | null>(null);
  const [boxFor, setBoxFor] = useState<Item | null>(null);
  const boxById = useBoxMap();
  const boxOf = (item: Item) => (item.boxId ? boxById.get(item.boxId) : undefined);

  const items = useMemo(() => data?.items ?? [], [data]);
  const priorities = useMemo(() => data?.priorities ?? {}, [data]);
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((i) => {
      if (category !== 'all' && i.category !== category) return false;
      if (priority !== 'all' && priorities[i.id] !== priority) return false;
      if (listFilter === 'unlisted' && i.wishlistIds.length > 0) return false;
      if (listFilter === 'listed' && i.wishlistIds.length === 0) return false;
      if (listFilter === 'owned' && !i.owned) return false;
      if (listFilter === 'wanted' && i.owned) return false;
      if (listFilter === 'boxed' && !i.boxId) return false;
      if (listFilter === 'unboxed' && i.boxId) return false;
      if (!RESERVED_FILTERS.includes(listFilter) && !i.wishlistIds.includes(listFilter)) return false;
      if (!q) return true;
      return [i.title, i.description, i.retailer, i.brand, i.category, i.tags.join(' '), i.notes, i.metadata.location ?? '', i.metadata.venue ?? ''].some((s) =>
        s.toLowerCase().includes(q),
      );
    });
    const price = (i: Item) => effectivePrice(i);
    const sorters: Record<Sort, (a: Item, b: Item) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
      priority: (a, b) => (priorities[a.id] ? PRIORITY_RANK[priorities[a.id]] : 9) - (priorities[b.id] ? PRIORITY_RANK[priorities[b.id]] : 9),
      price_asc: (a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity),
      price_desc: (a, b) => (price(b) ?? -1) - (price(a) ?? -1),
      name: (a, b) => a.title.localeCompare(b.title),
    };
    return list.sort(sorters[sort]);
  }, [items, query, category, priority, listFilter, sort, priorities]);

  const openId = params.get('item');
  const openItem = openId ? items.find((i) => i.id === openId) ?? null : null;
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('item', id);
    else next.delete('item');
    setParams(next, { replace: !id });
  };

  const remove = async (item: Item) => {
    const ok = await confirm({
      title: 'Delete this item?',
      message: item.wishlistIds.length
        ? `“${item.title}” will be removed from ${item.wishlistIds.length} list${item.wishlistIds.length === 1 ? '' : 's'} too, along with any reservations.`
        : `“${item.title}” will be permanently deleted.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await del(`/api/items/${item.id}`);
      invalidate(item.wishlistIds);
      toast.success('Item deleted');
      if (openId === item.id) setOpen(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const filtersActive = query || category !== 'all' || priority !== 'all' || listFilter !== 'all';
  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setPriority('all');
    setListFilter('all');
  };

  const menu = (item: Item) => (
    <Menu label={`Actions for ${item.title}`} icon={<MoreHorizontal size={18} />} buttonClassName="btn btn-icon btn-sm">
      <MenuItem icon={<Pencil size={16} />} onSelect={() => setEditing(item)}>
        Edit
      </MenuItem>
      {!item.owned && !item.source && (
        <MenuItem icon={<PartyPopper size={16} />} onSelect={() => setGotIt(item)}>
          Got it!
        </MenuItem>
      )}
      <MenuItem icon={<ListChecks size={16} />} onSelect={() => setListsFor(item)}>
        Lists…
      </MenuItem>
      <MenuItem icon={<Package size={16} />} onSelect={() => setBoxFor(item)}>
        {item.boxId ? 'Move to another box…' : 'Put in a box…'}
      </MenuItem>
      {!item.source && (
        <>
          <MenuSeparator />
          <MenuItem icon={<Trash2 size={16} />} danger onSelect={() => remove(item)}>
            Delete
          </MenuItem>
        </>
      )}
    </Menu>
  );

  const soleWishlist = (item: Item) => {
    const wishlists = item.wishlistIds.map((id) => listById.get(id)).filter((l) => l && l.kind !== 'collection');
    return wishlists.length === 1 ? { id: wishlists[0]!.id, title: wishlists[0]!.title } : undefined;
  };

  const onListsLine = (item: Item) => {
    const names = item.wishlistIds.map((id) => listById.get(id)?.title).filter(Boolean);
    return names.length ? (
      <span className="text-xs faint truncate" style={{ position: 'relative', zIndex: 0 }}>
        On {names.length === 1 ? names[0] : `${names.length} lists`}
      </span>
    ) : (
      <span className="text-xs faint">Not on a list</span>
    );
  };

  return (
    <div className="page">
      <PageSky
        eyebrow="Items"
        title="Saved Items"
        subtitle="Everything you’ve saved — things you want and things you have, on a list or not. Edit once, updated everywhere."
        art={<SkyArt scene="items" />}
      >
        <div className="page-sky-actions">
          <Button variant="primary" icon={<Plus size={17} />} onClick={() => openAddItem()}>
            Add item
          </Button>
        </div>
      </PageSky>

      <div className="toolbar">
        <div className="input-group" style={{ flex: '1 1 220px', maxWidth: 360 }}>
          <Search size={16} aria-hidden />
          <input
            className="input"
            type="search"
            placeholder="Search saved items"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search saved items"
          />
        </div>
        <div className="row" style={{ gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <select className="select" value={listFilter} onChange={(e) => setListFilter(e.target.value)} aria-label="Filter by list">
            <option value="all">All items</option>
            <option value="wanted">Things I want</option>
            <option value="owned">Things I have</option>
            <option value="unlisted">Not on any list</option>
            <option value="listed">On a list</option>
            {boxById.size > 0 && (
              <>
                <option value="boxed">Packed in a box</option>
                <option value="unboxed">Not in a box</option>
              </>
            )}
            {lists.length > 0 && (
              <optgroup label="On list">
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {categories.length > 0 && (
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority | 'all')} aria-label="Filter by priority">
            <option value="all">Any priority</option>
            {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <label className="row text-sm muted" style={{ gap: 8 }}>
            <span className="hide-xs">Sort</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort items">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="priority">Priority</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name">Name</option>
            </select>
          </label>
          <ViewToggle value={view} onChange={setView} labels="grid" />
        </div>
      </div>

      {isLoading ? (
        <div className={view === 'grid' ? 'grid-items' : 'list-items'}>
          {Array.from({ length: 6 }, (_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          art={<SkyArt scene="items" />}
          title="Nothing saved yet"
          action={
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => openAddItem()}>
              Add your first item
            </Button>
          }
        >
          Save things you love from any store, experiences you'd like to have, or ideas — and organise them into wishlists later.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search size={22} />} title="No matching items" action={filtersActive ? <Button onClick={clearFilters}>Clear filters</Button> : undefined}>
          Try a different search or filter.
        </EmptyState>
      ) : (
        <>
          {filtersActive && (
            <p className="text-sm muted" style={{ marginBottom: 'var(--s-3)' }}>
              {filtered.length} of {items.length} items ·{' '}
              <button type="button" className="link-button" onClick={clearFilters}>
                Clear filters
              </button>
            </p>
          )}
          <div className={view === 'grid' ? 'grid-items' : 'list-items'}>
            {filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                view={view}
                priority={priorities[item.id]}
                status={
                  item.owned ? (
                    <span className="badge badge-collection">
                      <Check aria-hidden /> Have it
                    </span>
                  ) : null
                }
                onOpen={() => setOpen(item.id)}
                menu={menu(item)}
                footer={
                  <>
                    {onListsLine(item)}
                    {boxOf(item) && <BoxChip box={boxOf(item)!} />}
                  </>
                }
              />
            ))}
          </div>
        </>
      )}
      <div style={{ height: 'var(--s-12)' }} />

      <ItemDetailModal
        item={openItem}
        onClose={() => setOpen(null)}
        priority={openItem ? priorities[openItem.id] : null}
        footer={
          openItem ? (
            <>
              {!openItem.owned && !openItem.source && (
                <Button
                  icon={<PartyPopper size={16} />}
                  onClick={() => {
                    setGotIt(openItem);
                    setOpen(null);
                  }}
                >
                  Got it!
                </Button>
              )}
              <Button icon={<ListChecks size={16} />} onClick={() => setListsFor(openItem)}>
                Lists
              </Button>
              <Button
                variant="primary"
                icon={<Pencil size={16} />}
                onClick={() => {
                  setEditing(openItem);
                  setOpen(null);
                }}
              >
                Edit
              </Button>
            </>
          ) : undefined
        }
      >
        {openItem && (
          <div className="stack-sm">
            <span className="section-label">On lists</span>
            {openItem.wishlistIds.length ? (
              <div className="row-wrap">
                {openItem.wishlistIds.map((id) => {
                  const l = listById.get(id);
                  return l ? (
                    <Link key={id} to={`/app/lists/${id}?item=${openItem.id}`} className="chip">
                      <span className="swatch-dot" style={{ background: l.accentColor }} aria-hidden /> {l.title}
                    </Link>
                  ) : null;
                })}
              </div>
            ) : (
              <p className="text-sm muted">Not on any list yet.</p>
            )}
            {boxOf(openItem) && (
              <>
                <span className="section-label" style={{ marginTop: 'var(--s-2)' }}>
                  Packed in
                </span>
                <div className="row-wrap">
                  <BoxChip box={boxOf(openItem)!} />
                </div>
              </>
            )}
          </div>
        )}
      </ItemDetailModal>
      <EditItemModal item={editing} onClose={() => setEditing(null)} isOwner />
      <ItemListsDialog item={listsFor} onClose={() => setListsFor(null)} />
      <GotItDialog item={gotIt} fromWishlist={gotIt ? soleWishlist(gotIt) : undefined} onClose={() => setGotIt(null)} />
      <PutInBoxDialog itemIds={boxFor ? [boxFor.id] : []} currentBoxId={boxFor?.boxId ?? null} title={boxFor?.title ?? ''} open={Boolean(boxFor)} onClose={() => setBoxFor(null)} />
    </div>
  );
}
