import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Archive, ArrowRight, MapPin, Plus, Printer, Search, Share2 } from 'lucide-react';
import type { BoxSummary } from '../../shared/types';
import { useBoxes, useItems } from '../lib/queries';
import { useLocalPref } from '../lib/prefs';
import { BoxCard, boxDisplayName } from '../components/BoxVisuals';
import { BoxCardMenu } from '../components/BoxMenu';
import { CreateMenu } from '../components/CreateMenu';
import { ListsSwitch } from '../components/ListsSwitch';
import { WishlistCardSkeleton } from '../components/WishlistCard';
import { CARD_LIST_VIEWS, ViewToggle, type CardListView } from '../components/ViewToggle';
import { ItemImage } from '../components/ItemVisuals';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';
import { PageSky } from '../components/PageSky';
import { SkyArt } from '../components/SkyArt';
import { useAppActions } from '../components/appActions';

const SORTS = ['number', 'name', 'updated', 'location'] as const;
type Sort = (typeof SORTS)[number];
type StatusTab = 'active' | 'archived' | 'shared';

function sortBoxes(boxes: BoxSummary[], sort: Sort): BoxSummary[] {
  const copy = [...boxes];
  if (sort === 'number') copy.sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.name.localeCompare(b.name));
  if (sort === 'name') copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'updated') copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (sort === 'location') copy.sort((a, b) => (a.location || '\uffff').localeCompare(b.location || '\uffff') || (a.number ?? 0) - (b.number ?? 0));
  return copy;
}

function statusFromParams(value: string | null): StatusTab {
  if (value === 'archived' || value === 'shared') return value;
  return 'active';
}

export default function Boxes() {
  const { data: boxes, isLoading } = useBoxes();
  const [params, setParams] = useSearchParams();
  const tab = statusFromParams(params.get('status'));
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const { data: itemData } = useItems(Boolean(q) && tab === 'active');
  const [sort, setSort] = useLocalPref<Sort>('boxes.sort', 'number', SORTS);
  const [view, setView] = useLocalPref<CardListView>('boxes.view', 'grid', CARD_LIST_VIEWS);
  const navigate = useNavigate();
  const { openCreateBox } = useAppActions();

  const setTab = (next: StatusTab) => {
    const updated = new URLSearchParams(params);
    if (next === 'active') updated.delete('status');
    else updated.set('status', next);
    setParams(updated, { replace: true });
    setQuery('');
  };

  const all = useMemo(() => (boxes ?? []).map((b) => ({ ...b, archivedAt: b.archivedAt ?? null })), [boxes]);
  const active = all.filter((b) => !b.archivedAt);
  const archived = all.filter((b) => b.archivedAt);
  const byId = useMemo(() => new Map(all.map((b) => [b.id, b])), [all]);

  const pool = tab === 'archived' ? archived : active;

  // "Where is my…?": packed items by name, and boxes by name, number, place or room.
  const foundItems =
    tab === 'active' && q
      ? (itemData?.items ?? []).filter(
          (i) =>
            i.boxId &&
            byId.has(i.boxId) &&
            !byId.get(i.boxId)!.archivedAt &&
            [i.title, i.brand, i.category, i.tags.join(' ')].some((s) => s.toLowerCase().includes(q)),
        )
      : [];
  const foundBoxes = q
    ? pool.filter((b) => [b.name, b.location, b.room, b.number ? `box ${b.number}` : '', ...b.lineTexts].some((s) => s.toLowerCase().includes(q)))
    : pool;
  const shown = sortBoxes(foundBoxes, sort);

  return (
    <div className="page">
      <ListsSwitch />
      <PageSky
        eyebrow="Boxes"
        title="Your boxes"
        subtitle="Pack things into boxes, stick on a QR label, and scan it to see what’s inside without opening it."
        art={<SkyArt scene="boxes" />}
        tone="kraft"
      >
        <div className="page-sky-actions">
          {active.length > 0 && tab === 'active' && (
            <Link to="/app/boxes/labels" className="btn">
              <Printer size={16} aria-hidden /> Print labels
            </Link>
          )}
          <CreateMenu />
        </div>
      </PageSky>

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Box status">
          <button type="button" role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')}>
            Active <span className="faint">{active.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'archived'} onClick={() => setTab('archived')}>
            Archived <span className="faint">{archived.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'shared'} onClick={() => setTab('shared')}>
            Shared <span className="faint">0</span>
          </button>
        </div>
        <div className="row" style={{ gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {tab !== 'shared' && (
            <label className="row text-sm muted" style={{ gap: 8 }}>
              <span className="hide-xs">Sort</span>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort boxes">
                <option value="number">Box number</option>
                <option value="name">Name</option>
                <option value="location">Where it’s kept</option>
                <option value="updated">Recently updated</option>
              </select>
            </label>
          )}
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {tab !== 'shared' && pool.length > 0 && (
        <div className="toolbar" style={{ marginTop: 0 }}>
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
        </div>
      )}

      {tab === 'shared' ? (
        <EmptyState icon={<Share2 size={22} />} title="Nothing shared with you">
          Boxes stay on your account. Share what’s inside with a QR label — anyone who scans it can see the contents (when the box allows).
        </EmptyState>
      ) : (
        <>
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
          ) : pool.length === 0 ? (
            tab === 'active' ? (
              <EmptyState
                tone="kraft"
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
            ) : (
              <EmptyState icon={<Archive size={22} />} title="Nothing archived">
                Archive boxes you’re done with — they stay safe here, and their QR labels pause until you restore them.
              </EmptyState>
            )
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
                  <BoxCard key={b.id} box={b} view={view} menu={<BoxCardMenu box={b} />} />
                ))}
              </div>
            </>
          )}
        </>
      )}
      <div style={{ height: 'var(--s-12)' }} />
    </div>
  );
}
