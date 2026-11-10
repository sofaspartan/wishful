import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Search, SearchX } from 'lucide-react';
import type { CoverArt as CoverArtValue, Item, WishlistSummary } from '../../shared/types';
import { ITEM_TYPE_LABELS, joinNames } from '../../shared/constants';
import { useItems, useSharedWishlists, useWishlists } from '../lib/queries';
import { formatPrice } from '../lib/format';
import { Modal } from './ui/Modal';
import { Segmented } from './ui/misc';
import { ItemTypeIcon } from './ItemVisuals';
import { CoverArt } from './CoverArt';

type Scope = 'all' | 'lists' | 'items';

interface Result {
  key: string;
  kind: 'list' | 'item';
  title: string;
  subtitle: string;
  image: string | null;
  art?: CoverArtValue | null;
  href: string;
  icon: ReactNode;
}

function itemHaystack(i: Item): string {
  const m = i.metadata;
  return [i.title, i.description, i.category, i.retailer, i.brand, ...i.tags, m.location, m.venue, m.model, m.color, ITEM_TYPE_LABELS[i.type]]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function listHaystack(w: WishlistSummary): string {
  return [w.title, w.description, w.occasion, w.owner.displayName, ...w.recipients.map((r) => r.name)].join(' ').toLowerCase();
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

/**
 * Global search over the user's own wishlists, lists shared with them, and
 * their saved items. Runs on already-cached data so results are instant.
 */
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { data: lists = [] } = useWishlists(open);
  const { data: shared = [] } = useSharedWishlists(open);
  const { data: itemsData } = useItems(open);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const match = (hay: string) => terms.every((t) => hay.includes(t));
    const allLists = [...lists, ...shared];
    const out: Result[] = [];
    if (scope !== 'items') {
      for (const w of allLists) {
        if (q && !match(listHaystack(w))) continue;
        out.push({
          key: `l-${w.id}`,
          kind: 'list',
          title: w.title,
          subtitle: [w.recipients.length ? `For ${joinNames(w.recipients.map((r) => r.name))}` : w.role !== 'owner' ? `${w.owner.displayName}’s list` : null, `${w.itemCount} item${w.itemCount === 1 ? '' : 's'}`, w.archivedAt ? 'Archived' : null]
            .filter(Boolean)
            .join(' · '),
          image: w.coverImage ?? (w.coverArt ? null : w.previewImages[0]) ?? null,
          art: w.coverImage ? null : w.coverArt,
          href: `/app/lists/${w.id}`,
          icon: <List size={16} />,
        });
        if (!q && out.length >= 5) break;
      }
    }
    if (scope !== 'lists') {
      const items = itemsData?.items ?? [];
      let count = 0;
      for (const i of items) {
        if (q && !match(itemHaystack(i))) continue;
        out.push({
          key: `i-${i.id}`,
          kind: 'item',
          title: i.title,
          subtitle: [ITEM_TYPE_LABELS[i.type], i.retailer || i.brand || i.metadata.location, formatPrice(i.price, i.currency)].filter(Boolean).join(' · '),
          image: i.imageUrl,
          href: i.wishlistIds[0] ? `/app/lists/${i.wishlistIds[0]}?item=${i.id}` : `/app/items?item=${i.id}`,
          icon: <ItemTypeIcon type={i.type} size={16} />,
        });
        if (++count >= (q ? 30 : 6)) break;
      }
    }
    return out;
  }, [query, scope, lists, shared, itemsData]);

  useEffect(() => setActive(0), [query, scope]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (r: Result) => {
    onClose();
    navigate(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  const listResults = results.filter((r) => r.kind === 'list');
  const itemResults = results.filter((r) => r.kind === 'item');
  let index = -1;
  const renderGroup = (label: string, group: Result[]) =>
    group.length > 0 && (
      <div role="group" aria-label={label}>
        <div className="palette-group section-label">{label}</div>
        {group.map((r) => {
          index++;
          const i = index;
          return (
            <button
              key={r.key}
              type="button"
              role="option"
              data-index={i}
              aria-selected={i === active}
              className="palette-item"
              onMouseMove={() => setActive(i)}
              onClick={() => go(r)}
            >
              <span className="palette-thumb">{r.image ? <img src={r.image} alt="" referrerPolicy="no-referrer" loading="lazy" /> : r.art ? <CoverArt art={r.art} size="sm" /> : r.icon}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="truncate" style={{ display: 'block', fontWeight: 550 }}>
                  <Highlight text={r.title} query={query.trim()} />
                </span>
                <span className="truncate muted text-xs" style={{ display: 'block' }}>
                  {r.subtitle}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );

  return (
    <Modal open={open} onClose={onClose} title="Search" bare className="palette">
      <div className="palette-input">
        <Search size={20} className="faint" aria-hidden />
        <input
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search lists, items, stores, tags…"
          aria-label="Search"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          autoComplete="off"
        />
        <kbd className="hide-xs">Esc</kbd>
      </div>
      <div style={{ padding: '10px 16px 0' }}>
        <Segmented
          label="Search scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'All' },
            { value: 'lists', label: 'Wishlists' },
            { value: 'items', label: 'Items' },
          ]}
        />
      </div>
      <div className="palette-results" id="palette-results" role="listbox" ref={listRef} aria-label="Results">
        {results.length === 0 ? (
          <div className="stack-sm" style={{ alignItems: 'center', padding: '40px 16px', textAlign: 'center' }}>
            <SearchX size={22} className="faint" aria-hidden />
            <p className="muted">{query ? `Nothing matches “${query}”.` : 'Nothing here yet — add your first item to get started.'}</p>
          </div>
        ) : (
          <>
            {!query && <div className="palette-group faint text-xs">Recent</div>}
            {renderGroup('Wishlists', listResults)}
            {renderGroup('Items', itemResults)}
          </>
        )}
      </div>
    </Modal>
  );
}
