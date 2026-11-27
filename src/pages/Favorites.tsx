import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MoreHorizontal, Search, Filter } from 'lucide-react';
import type { FavoriteCard, FavoriteTargetType } from '../../shared/types';
import { useFavorites } from '../lib/queries';
import { WishlistCard } from '../components/WishlistCard';
import { BoxCard } from '../components/BoxVisuals';
import { ItemCard } from '../components/ItemCard';
import { FavoriteMenuItem } from '../components/FavoriteToggle';
import { PageSky } from '../components/PageSky';
import { SkyArt } from '../components/SkyArt';
import { Avatar, EmptyState, PageLoader } from '../components/ui/misc';
import { Menu } from '../components/ui/Menu';
import { Popover } from '../components/ui/Popover';
import { Button } from '../components/ui/Button';
import { CARD_LIST_VIEWS, ViewToggle, type CardListView } from '../components/ViewToggle';
import { useLocalPref } from '../lib/prefs';

type TypeFilter = 'all' | FavoriteTargetType;
type Sort = 'newest' | 'name';

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: 'All types',
  wishlist: 'Lists',
  item: 'Items',
  box: 'Boxes',
  user: 'Friends',
  circle_person: 'My Circle',
};

function cardAlive(c: FavoriteCard): boolean {
  return Boolean(c.wishlist || c.item || c.box || c.user || c.circlePerson);
}

function cardName(c: FavoriteCard): string {
  return (
    c.wishlist?.title ??
    c.item?.title ??
    c.box?.name ??
    c.user?.displayName ??
    c.circlePerson?.name ??
    ''
  );
}

function FavoritesMenu({ card }: { card: FavoriteCard }) {
  const { entry } = card;
  const name = cardName(card);
  return (
    <Menu
      label={`Actions for ${name || 'favorite'}`}
      icon={<MoreHorizontal size={18} />}
      buttonClassName="btn btn-icon btn-sm card-menu-btn"
      className="card-actions-menu"
    >
      <FavoriteMenuItem targetType={entry.targetType} targetId={entry.targetId} name={name} />
    </Menu>
  );
}

export default function Favorites() {
  const { data: favorites, isLoading } = useFavorites();
  const navigate = useNavigate();
  const [type, setType] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [query, setQuery] = useState('');
  const [view, setView] = useLocalPref<CardListView>('favorites.view', 'grid', CARD_LIST_VIEWS);

  const alive = useMemo(() => (favorites ?? []).filter(cardAlive), [favorites]);

  const typeOptions = useMemo(() => {
    const present = new Set(alive.map((c) => c.entry.targetType));
    return (Object.keys(TYPE_LABELS) as TypeFilter[]).filter((id) => id === 'all' || present.has(id as FavoriteTargetType));
  }, [alive]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = alive.filter((c) => {
      if (type !== 'all' && c.entry.targetType !== type) return false;
      if (!q) return true;
      const hay = [
        cardName(c),
        c.user?.username,
        c.circlePerson?.username,
        c.circlePerson?.displayName,
        c.box?.location,
        c.wishlist?.occasion,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
    if (sort === 'name') {
      return [...rows].sort((a, b) => cardName(a).localeCompare(cardName(b), undefined, { sensitivity: 'base' }));
    }
    return rows;
  }, [alive, type, query, sort]);

  const filtersActive = Boolean(query) || type !== 'all';
  const panelFiltersActive = type !== 'all' || sort !== 'newest';
  const clearFilters = () => {
    setQuery('');
    setType('all');
    setSort('newest');
  };

  const filterControls = (
    <>
      <select className="select" value={type} onChange={(e) => setType(e.target.value as TypeFilter)} aria-label="Filter by type">
        {typeOptions.map((id) => (
          <option key={id} value={id}>
            {TYPE_LABELS[id]}
          </option>
        ))}
      </select>
      <label className="row text-sm muted toolbar-sort">
        <span className="hide-xs">Sort</span>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort favorites">
          <option value="newest">Newest</option>
          <option value="name">Name</option>
        </select>
      </label>
    </>
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="page">
      <PageSky
        eyebrow="Favorites"
        title="Favorites"
        subtitle="Star lists, items, boxes, friends, and people in My Circle — everything you want close at hand."
        art={<SkyArt scene="items" />}
      />

      <div className="toolbar toolbar-items">
        <div className="toolbar-search-cluster">
          <div className="input-group toolbar-items-search">
            <Search size={16} aria-hidden />
            <input
              className="input"
              type="search"
              placeholder="Search favorites"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search favorites"
            />
          </div>
          <Popover
            label={panelFiltersActive ? 'Filters (active)' : 'Filters'}
            align="start"
            buttonClassName={`btn toolbar-filters-btn${panelFiltersActive ? ' is-active' : ''}`}
            buttonContent={
              <>
                <Filter size={18} aria-hidden />
                {panelFiltersActive && <span className="toolbar-filters-dot" aria-hidden />}
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
        </div>
        <div className="toolbar-items-actions">
          {type !== 'all' && <span className="toolbar-filter-chip">{TYPE_LABELS[type]}</span>}
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {!alive.length ? (
        <EmptyState art={<SkyArt scene="favorites" />} title="Nothing favorited yet">
          Open any list, item, box, friend, or My Circle person and choose Add to Favorites.
        </EmptyState>
      ) : !filtered.length ? (
        <EmptyState
          icon={<Search size={22} />}
          title="No matching favorites"
          action={filtersActive ? <Button onClick={clearFilters}>Clear filters</Button> : undefined}
        >
          Try a different search or filter.
        </EmptyState>
      ) : (
        <>
          {filtersActive && (
            <p className="text-sm muted" style={{ marginBottom: 'var(--s-3)' }}>
              {filtered.length} of {alive.length} favorites ·{' '}
              <button type="button" className="link-button" onClick={clearFilters}>
                Clear filters
              </button>
            </p>
          )}
          <div className={view === 'grid' ? 'grid-wishlists' : 'list-wishlists'}>
            {filtered.map((card) => {
              if (card.wishlist) {
                return <WishlistCard key={card.entry.id} wishlist={card.wishlist} view={view} menu={<FavoritesMenu card={card} />} />;
              }
              if (card.box) {
                return <BoxCard key={card.entry.id} box={card.box} view={view} menu={<FavoritesMenu card={card} />} />;
              }
              if (card.item) {
                return (
                  <ItemCard
                    key={card.entry.id}
                    item={card.item}
                    view={view}
                    owned={card.item.owned}
                    menu={<FavoritesMenu card={card} />}
                    onOpen={() => navigate(`/app/items?item=${card.item!.id}`)}
                  />
                );
              }
              if (card.user) {
                const u = card.user;
                return (
                  <article key={card.entry.id} className="friend-card">
                    <Link to={`/app/friends/${u.id}`} className="item-card-hit" aria-label={`Open ${u.displayName}`} />
                    <div className="friend-card-body" style={{ position: 'relative', zIndex: 1 }}>
                      <Avatar name={u.displayName} src={u.avatarUrl} size={56} />
                      <strong className="truncate">{u.displayName}</strong>
                      <span className="text-sm muted truncate">@{u.username}</span>
                    </div>
                    <div className="wl-card-menu" style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                      <FavoritesMenu card={card} />
                    </div>
                  </article>
                );
              }
              if (card.circlePerson) {
                const p = card.circlePerson;
                const to = p.userId ? `/app/friends/${p.userId}` : '/app/friends';
                return (
                  <article key={card.entry.id} className="friend-card circle-card">
                    <Link to={to} className="item-card-hit" aria-label={`Open ${p.name}`} />
                    <div className="friend-card-body" style={{ position: 'relative', zIndex: 1 }}>
                      <Avatar name={p.name} src={p.avatarUrl} size={56} />
                      <strong className="truncate">{p.name}</strong>
                      <span className="text-sm muted truncate">{p.kind === 'pet' ? 'Pet' : p.username ? `@${p.username}` : 'My Circle'}</span>
                    </div>
                    <div className="wl-card-menu" style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                      <FavoritesMenu card={card} />
                    </div>
                  </article>
                );
              }
              return null;
            })}
          </div>
        </>
      )}
    </div>
  );
}
