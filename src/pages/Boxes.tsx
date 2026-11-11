import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Plus, Printer, Search } from 'lucide-react';
import type { BoxSummary } from '../../shared/types';
import { useBoxes, useItems } from '../lib/queries';
import { useLocalPref } from '../lib/prefs';
import { BoxCard, boxDisplayName } from '../components/BoxVisuals';
import { CreateMenu } from '../components/CreateMenu';
import { ListsSwitch } from '../components/ListsSwitch';
import { WishlistCardSkeleton } from '../components/WishlistCard';
import { CARD_LIST_VIEWS, ViewToggle, type CardListView } from '../components/ViewToggle';
import { ItemImage } from '../components/ItemVisuals';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';
import { SkyArt } from '../components/SkyArt';
import { useAppActions } from '../components/appActions';

const SORTS = ['number', 'name', 'updated', 'location'] as const;
type Sort = (typeof SORTS)[number];

function sortBoxes(boxes: BoxSummary[], sort: Sort): BoxSummary[] {
  const copy = [...boxes];
  if (sort === 'number') copy.sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.name.localeCompare(b.name));
  if (sort === 'name') copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'updated') copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (sort === 'location') copy.sort((a, b) => (a.location || '\uffff').localeCompare(b.location || '\uffff') || (a.number ?? 0) - (b.number ?? 0));
  return copy;
}

export default function Boxes() {
  const { data: boxes, isLoading } = useBoxes();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const { data: itemData } = useItems(Boolean(q));
  const [sort, setSort] = useLocalPref<Sort>('boxes.sort', 'number', SORTS);
  const [view, setView] = useLocalPref<CardListView>('boxes.view', 'grid', CARD_LIST_VIEWS);
  const navigate = useNavigate();
  const { openCreateBox } = useAppActions();

  const all = useMemo(() => boxes ?? [], [boxes]);
  const byId = useMemo(() => new Map(all.map((b) => [b.id, b])), [all]);

  // "Where is my…?": packed items by name, and boxes by name, number, place or room.
  const foundItems = q
    ? (itemData?.items ?? []).filter(
        (i) => i.boxId && byId.has(i.boxId) && [i.title, i.brand, i.category, i.tags.join(' ')].some((s) => s.toLowerCase().includes(q)),
      )
    : [];
  const foundBoxes = q
    ? all.filter((b) => [b.name, b.location, b.room, b.number ? `box ${b.number}` : '', ...b.lineTexts].some((s) => s.toLowerCase().includes(q)))
    : all;
  const shown = sortBoxes(foundBoxes, sort);

  return (
    <div className="page">
      <ListsSwitch />
      <div className="page-header">
        <div>
          <h1 className="page-title display">Boxes</h1>
          <p className="page-subtitle">Pack things into boxes, stick on a QR label, and scan it to see what’s inside without opening it.</p>
        </div>
        <div className="page-actions">
          {all.length > 0 && (
            <Link to="/app/boxes/labels" className="btn">
              <Printer size={16} aria-hidden /> Print labels
            </Link>
          )}
          <CreateMenu />
        </div>
      </div>

      {all.length > 0 && (
        <div className="toolbar">
          <div className="input-group" style={{ flex: '1 1 260px' }}>
            <Search size={16} aria-hidden />
            <input
              className="input"
              type="search"
              placeholder="Where is my…?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Find a thing or a box"
            />
          </div>
          <div className="row" style={{ gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <label className="row text-sm muted" style={{ gap: 8 }}>
              <span className="hide-xs">Sort</span>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort boxes">
                <option value="number">Box number</option>
                <option value="name">Name</option>
                <option value="location">Where it’s kept</option>
                <option value="updated">Recently updated</option>
              </select>
            </label>
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
      )}

      {q && foundItems.length > 0 && (
        <section className="section box-finds" aria-label="Things found in boxes">
          <h2 className="section-label">In your boxes</h2>
          <div className="box-find-list">
            {foundItems.slice(0, 20).map((item) => {
              const box = byId.get(item.boxId!)!;
              return (
                <button key={item.id} type="button" className="box-find" onClick={() => navigate(`/app/boxes/${box.id}?item=${item.id}`)}>
                  <span className="pack-thumb">
                    <ItemImage src={item.imageUrl} type={item.type} iconSize={18} />
                  </span>
                  <span className="pack-text">
                    <span className="truncate pack-title">{item.title}</span>
                    <span className="truncate muted text-xs row" style={{ gap: 4 }}>
                      <span className="box-dot" style={{ background: box.color }} aria-hidden />
                      {boxDisplayName(box)}
                      {box.location && (
                        <>
                          {' · '}
                          <MapPin size={11} aria-hidden /> {box.location}
                        </>
                      )}
                    </span>
                  </span>
                  <ArrowRight size={16} className="muted" aria-hidden />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className={view === 'grid' ? 'grid-lists' : 'list-items'}>
          {Array.from({ length: 3 }, (_, i) => (
            <WishlistCardSkeleton key={i} />
          ))}
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          art={<SkyArt scene="boxes" />}
          title="No boxes yet"
          action={
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => openCreateBox()}>
              Make your first box
            </Button>
          }
        >
          Moving house or filling the attic? Make a box, add what’s in it, and print a QR label. Scanning it later shows everything inside.
        </EmptyState>
      ) : shown.length === 0 ? (
        foundItems.length === 0 && (
          <EmptyState icon={<Search size={22} />} title="Nothing found">
            No box or packed thing matches “{query.trim()}”.
          </EmptyState>
        )
      ) : (
        <>
          {q && foundItems.length > 0 && <h2 className="section-label">Boxes</h2>}
          <div className={view === 'grid' ? 'grid-lists' : 'list-items'}>
            {shown.map((b) => (
              <BoxCard key={b.id} box={b} view={view} />
            ))}
          </div>
        </>
      )}
      <div style={{ height: 'var(--s-12)' }} />
    </div>
  );
}
