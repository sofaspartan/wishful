import { useEffect, useMemo, useState } from 'react';
import { Check, ImageOff, LoaderCircle, Plus } from 'lucide-react';
import type { ExtensionSession, ListKind, Priority } from '../../../shared/types';
import { CURRENCIES, LIMITS } from '../../../shared/constants';
import { ApiError, api } from '../api';
import { clearToken } from '../storage';
import { importCandidates, sameSite, scanList, type ImportCandidate, type ListScan } from '../listScrape';
import { ListThumb } from './ListThumb';

type List = ExtensionSession['lists'][number];

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
};

/** Batches for the bulk endpoint: one priority per request, at most 25 items each. */
function batches(items: ImportCandidate[]): Array<{ priority: Priority | null; items: ImportCandidate[] }> {
  const groups = new Map<Priority | 'none', ImportCandidate[]>();
  for (const i of items) groups.set(i.priority ?? 'none', [...(groups.get(i.priority ?? 'none') ?? []), i]);
  const out: Array<{ priority: Priority | null; items: ImportCandidate[] }> = [];
  for (const [p, list] of groups) {
    for (let n = 0; n < list.length; n += LIMITS.bulkItems) out.push({ priority: p === 'none' ? null : p, items: list.slice(n, n + LIMITS.bulkItems) });
  }
  return out;
}

export function ListImport({
  session,
  tabId,
  initialScan,
  onListCreated,
  onDone,
  onUnauthorized,
}: {
  session: ExtensionSession;
  tabId: number;
  initialScan: ListScan;
  onListCreated: (list: List) => void;
  onDone: (count: number, url: string, listNames: string[]) => void;
  onUnauthorized: (notice: string) => void;
}) {
  const [scan, setScan] = useState(initialScan);
  const [scanning, setScanning] = useState(true);
  const candidates = useMemo(() => importCandidates(scan), [scan]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const suggestedName = `${scan.site}${scan.listName ? `: ${scan.listName}` : ' list'}`.slice(0, LIMITS.wishlistTitle);
  const [newList, setNewList] = useState(true);
  // Follows the scanned list's name until the user types their own.
  const [typedTitle, setTypedTitle] = useState<string | null>(null);
  const newTitle = typedTitle ?? suggestedName;
  const [newKind, setNewKind] = useState<ListKind>('wishlist');
  const [selected, setSelected] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The quick scan only saw what's on screen; load the rest of the list the way a visitor would.
  useEffect(() => {
    let cancelled = false;
    chrome.scripting
      .executeScript({ target: { tabId }, func: scanList, args: [true] })
      .then(([res]) => {
        if (!cancelled && res?.result) {
          const full = res.result as ListScan;
          if (full.items.length >= initialScan.items.length) setScan(full);
        }
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setScanning(false));
    return () => {
      cancelled = true;
    };
  }, [tabId, initialScan.items.length]);

  const picked = candidates.filter((c) => !skipped.has(c.key));
  const allPicked = picked.length === candidates.length;
  const toggleItem = (key: string) =>
    setSkipped((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleList = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const fallbackCurrency = (CURRENCIES as readonly string[]).includes(session.user.currency) ? session.user.currency : 'USD';

  const run = async () => {
    if (picked.length === 0) return setError('Pick at least one item.');
    if (newList && !newTitle.trim()) return setError('Name the new list.');
    setError(null);
    setProgress({ done: 0, total: picked.length });
    let done = 0;
    let url = '';
    let ids = [...selected];
    const names = session.lists.filter((l) => selected.includes(l.id)).map((l) => l.title);
    try {
      if (newList) {
        const { list } = await api<{ list: List }>('/api/extension/lists', { method: 'POST', body: { title: newTitle.trim(), kind: newKind } });
        onListCreated(list);
        ids = [list.id, ...ids];
        names.unshift(list.title);
      }
      for (const batch of batches(picked)) {
        const res = await api<{ count: number; url: string }>('/api/extension/items/bulk', {
          method: 'POST',
          body: {
            priority: batch.priority,
            wishlistIds: ids,
            items: batch.items.map((c) => ({
              title: c.title,
              externalUrl: c.url,
              imageUrl: c.imageUrl && !brokenImages.has(c.imageUrl) ? c.imageUrl : null,
              price: c.price,
              currency: c.currency ?? fallbackCurrency,
              retailer: sameSite(c.url, scan.url) ? scan.site.slice(0, LIMITS.shortText) : '',
              notes: c.notes,
            })),
          },
        });
        done += res.count;
        url = res.url;
        setProgress({ done, total: picked.length });
      }
      onDone(done, url, names);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearToken();
        return onUnauthorized(err.message);
      }
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(done > 0 ? `Imported ${done} of ${picked.length}, then stopped: ${message}` : message);
      setProgress(null);
    }
  };

  const wishlists = session.lists.filter((l) => l.kind === 'wishlist');
  const collections = session.lists.filter((l) => l.kind === 'collection');
  const listGroup = (label: string, lists: List[]) =>
    lists.length > 0 && (
      <div className="list-group">
        <span className="list-group-label">{label}</span>
        {lists.map((l) => {
          const on = selected.includes(l.id);
          return (
            <label key={l.id} className={`list-row${on ? ' is-on' : ''}`}>
              <input type="checkbox" checked={on} onChange={() => toggleList(l.id)} />
              <ListThumb list={l} />
              <span className="list-name">{l.title}</span>
              <span className="list-check" aria-hidden>
                {on && <Check size={13} strokeWidth={3} />}
              </span>
            </label>
          );
        })}
      </div>
    );

  const busy = progress !== null;
  const destinations = (newList ? 1 : 0) + selected.length;

  return (
    <div className="save-form">
      <div className="save-scroll">
        <div className="import-head">
          <div>
            <span className="product-retailer">{scan.site}</span>
            <h1 className="import-title">{scan.listName || 'Items on this page'}</h1>
            <p className="popup-muted small">
              {scanning ? (
                <>
                  <LoaderCircle className="spin inline-spin" size={13} aria-hidden /> Found {candidates.length} so far, loading the rest of the list…
                </>
              ) : (
                <>
                  {candidates.length} {candidates.length === 1 ? 'item' : 'items'} found
                  {scan.truncated && ' (the first 500)'}
                </>
              )}
            </p>
          </div>
          <button type="button" className="popup-text-btn" onClick={() => setSkipped(allPicked ? new Set(candidates.map((c) => c.key)) : new Set())}>
            {allPicked ? 'Select none' : 'Select all'}
          </button>
        </div>

        <ul className="import-items" aria-label="Items to import">
          {candidates.map((c) => {
            const on = !skipped.has(c.key);
            const image = c.imageUrl && !brokenImages.has(c.imageUrl) ? c.imageUrl : null;
            return (
              <li key={c.key}>
                <label className={`import-item${on ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleItem(c.key)} />
                  <span className="import-thumb">
                    {image ? (
                      <img src={image} alt="" loading="lazy" onError={() => setBrokenImages((s) => new Set(s).add(image))} />
                    ) : (
                      <ImageOff size={14} aria-hidden />
                    )}
                  </span>
                  <span className="import-text">
                    <span className="import-name">{c.title}</span>
                    {c.price !== null && <span className="import-price">{money(c.price, c.currency ?? fallbackCurrency)}</span>}
                  </span>
                  <span className="list-check" aria-hidden>
                    {on && <Check size={13} strokeWidth={3} />}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="lists">
          <span className="field-label">Add to</span>
          <label className={`list-row${newList ? ' is-on' : ''}`}>
            <input type="checkbox" checked={newList} onChange={() => setNewList((v) => !v)} />
            <span className="thumb new-list-thumb" aria-hidden>
              <Plus size={16} />
            </span>
            <span className="list-name">New list</span>
            <span className="list-check" aria-hidden>
              {newList && <Check size={13} strokeWidth={3} />}
            </span>
          </label>
          {newList && (
            <div className="new-list-fields">
              <input
                className="input"
                aria-label="New list name"
                value={newTitle}
                maxLength={LIMITS.wishlistTitle}
                onChange={(e) => setTypedTitle(e.target.value)}
              />
              <select className="input" aria-label="Kind of list" value={newKind} onChange={(e) => setNewKind(e.target.value as ListKind)}>
                <option value="wishlist">Wishlist</option>
                <option value="collection">Collection</option>
              </select>
            </div>
          )}
          {listGroup('Wishlists', wishlists)}
          {listGroup('Collections', collections)}
          {destinations === 0 && <p className="popup-muted small">Nothing picked: the items will go to your Saved Items.</p>}
        </div>
      </div>

      <div className="save-bar">
        {error && (
          <p className="popup-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn btn-primary btn-wide" disabled={busy || picked.length === 0} onClick={() => void run()}>
          {busy ? (
            <>
              <LoaderCircle className="spin" size={17} aria-hidden /> Importing {progress.done} of {progress.total}…
            </>
          ) : (
            `Import ${picked.length} ${picked.length === 1 ? 'item' : 'items'}`
          )}
        </button>
      </div>
    </div>
  );
}
