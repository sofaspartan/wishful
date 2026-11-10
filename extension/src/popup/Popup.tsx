import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, ExternalLink, ImageOff, LoaderCircle, StickyNote } from 'lucide-react';
import type { ExtensionSession } from '../../../shared/types';
import { CURRENCIES, LIMITS } from '../../../shared/constants';
import { parsePrice } from '../../../shared/metadata';
import { brand } from '../../../src/config/brand';
import { COVER_ICON_ART } from '../../../src/components/CoverArt';
import { LogoMark } from '../../../src/components/Logo';
import { ApiError, SITE_URL, api } from '../api';
import { clearToken, getLastLists, getToken, setLastLists, startConnect } from '../storage';
import { readDetails, snapshotPage, type PageDetails, type PageSnapshot } from '../scrape';
import { scanList, type ListScan } from '../listScrape';
import { ListImport } from './ListImport';
import { ListThumb } from './ListThumb';

type List = ExtensionSession['lists'][number];

interface ActiveTab {
  tabId: number;
  page: PageDetails;
  /** Products found on the page without scrolling, for offering a whole-list import. */
  scan: ListScan | null;
}

type View =
  | { kind: 'loading' }
  | { kind: 'connect'; notice?: string }
  | { kind: 'unsupported'; session: ExtensionSession }
  | { kind: 'form'; session: ExtensionSession; tab: ActiveTab; selected: string[] }
  | { kind: 'saved'; title: string; url: string; listNames: string[]; count?: number }
  | { kind: 'error'; message: string };

const short = (s: string, max: number) => s.trim().slice(0, max);
const fits = (url: string) => url.length <= LIMITS.url && /^https?:\/\//.test(url);

async function readActiveTab(): Promise<ActiveTab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url) || tab.url.startsWith(SITE_URL)) return null;
  const tabId = tab.id;
  const fallback: PageDetails = { url: tab.url, title: tab.title ?? '', description: '', retailer: '', brand: '', price: null, currency: null, images: [] };
  // Some pages (browser stores, PDFs) can't be read; fall back to the tab's own title and address.
  const [page, scan] = await Promise.all([
    chrome.scripting
      .executeScript({ target: { tabId }, func: snapshotPage })
      .then(([res]) => (res?.result ? readDetails(res.result as PageSnapshot) : fallback))
      .catch(() => fallback),
    chrome.scripting
      .executeScript({ target: { tabId }, func: scanList, args: [false] })
      .then(([res]) => (res?.result as ListScan | undefined) ?? null)
      .catch(() => null),
  ]);
  return { tabId, page, scan };
}

/** A list page with anything on it, or any page showing several products. */
const offersList = (scan: ListScan | null): scan is ListScan => Boolean(scan && scan.items.length >= (scan.isListPage ? 1 : 3));

export function Popup() {
  const [view, setView] = useState<View>({ kind: 'loading' });

  const load = async () => {
    setView({ kind: 'loading' });
    if (!(await getToken())) return setView({ kind: 'connect' });
    try {
      const [session, tab, last] = await Promise.all([api<ExtensionSession>('/api/extension/session'), readActiveTab(), getLastLists()]);
      if (!tab) return setView({ kind: 'unsupported', session });
      const ids = new Set(session.lists.map((l) => l.id));
      const remembered = last.filter((id) => ids.has(id));
      const firstWishlist = session.lists.find((l) => l.kind === 'wishlist');
      setView({ kind: 'form', session, tab, selected: remembered.length ? remembered : firstWishlist ? [firstWishlist.id] : [] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearToken();
        return setView({ kind: 'connect', notice: err.message });
      }
      setView({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const disconnect = async () => {
    await api('/api/extension/disconnect', { method: 'POST' }).catch(() => undefined);
    await clearToken();
    setView({ kind: 'connect' });
  };

  const session = view.kind === 'form' || view.kind === 'unsupported' ? view.session : null;

  return (
    <div className="popup">
      <header className="popup-header">
        <LogoMark size={26} />
        <span className="popup-brand">{brand.name}</span>
        <span className="popup-spacer" />
        <a className="popup-link" href={`${SITE_URL}/app`} target="_blank" rel="noreferrer">
          Open {brand.name} <ExternalLink size={13} aria-hidden />
        </a>
      </header>

      {view.kind === 'loading' && (
        <div className="popup-center">
          <LoaderCircle className="spin" size={22} aria-label="Loading" />
        </div>
      )}
      {view.kind === 'connect' && <ConnectView notice={view.notice} />}
      {view.kind === 'error' && (
        <div className="popup-center popup-stack">
          <p className="popup-muted">{view.message}</p>
          <button type="button" className="btn" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
      {view.kind === 'unsupported' && (
        <div className="popup-center popup-stack">
          <h1 className="popup-title">Open a product page</h1>
          <p className="popup-muted">Go to something you love in any online store, then click the {brand.name} icon to save it.</p>
        </div>
      )}
      {view.kind === 'form' && (
        <PageForms
          key={view.tab.page.url}
          session={view.session}
          tab={view.tab}
          initialSelected={view.selected}
          onListCreated={(list) => setView({ ...view, session: { ...view.session, lists: [list, ...view.session.lists] } })}
          onSaved={(title, url, listNames, count) => setView({ kind: 'saved', title, url, listNames, count })}
          onUnauthorized={(notice) => setView({ kind: 'connect', notice })}
        />
      )}
      {view.kind === 'saved' && (
        <div className="popup-center popup-stack">
          <span className="saved-check" aria-hidden>
            <Check size={28} strokeWidth={2.6} />
          </span>
          <h1 className="popup-title">{view.count !== undefined ? 'Imported!' : 'Saved!'}</h1>
          <p className="popup-muted">
            <strong>{view.title}</strong> {view.count !== undefined && view.count !== 1 ? 'were' : 'was'} added to{' '}
            {view.listNames.length ? new Intl.ListFormat(undefined, { type: 'conjunction' }).format(view.listNames) : 'your Saved Items'}.
          </p>
          <div className="popup-row">
            <a className="btn btn-primary" href={view.url} target="_blank" rel="noreferrer">
              View in {brand.name}
            </a>
            <button type="button" className="btn" onClick={() => window.close()}>
              Done
            </button>
          </div>
        </div>
      )}

      {session && (
        <footer className="popup-footer">
          <span>
            Signed in as <strong>{session.user.displayName}</strong>
          </span>
          <button type="button" className="popup-text-btn" onClick={() => void disconnect()}>
            Disconnect
          </button>
        </footer>
      )}
    </div>
  );
}

function ConnectView({ notice }: { notice?: string }) {
  const connect = async () => {
    const state = await startConnect();
    await chrome.tabs.create({ url: `${SITE_URL}/extension/connect?state=${encodeURIComponent(state)}` });
    window.close();
  };
  return (
    <div className="popup-center popup-stack connect-view">
      <div className="connect-art" aria-hidden>
        <span className="connect-art-cloud" />
        <span className="connect-art-gift">{COVER_ICON_ART.gift}</span>
      </div>
      <h1 className="popup-title">Save from any store</h1>
      <p className="popup-muted">Connect to your {brand.name} account to add products to your wishlists and collections in one click.</p>
      {notice && <p className="popup-notice">{notice}</p>}
      <button type="button" className="btn btn-primary btn-wide" onClick={() => void connect()}>
        Connect to {brand.name}
      </button>
      <p className="popup-fine">You’ll approve the connection on {new URL(SITE_URL).host}.</p>
    </div>
  );
}

/** The single-item form, plus a switch to the whole-list import when the page shows several products. */
function PageForms({
  session,
  tab,
  initialSelected,
  onListCreated,
  onSaved,
  onUnauthorized,
}: {
  session: ExtensionSession;
  tab: ActiveTab;
  initialSelected: string[];
  onListCreated: (list: List) => void;
  onSaved: (title: string, url: string, listNames: string[], count?: number) => void;
  onUnauthorized: (notice: string) => void;
}) {
  const scan = offersList(tab.scan) ? tab.scan : null;
  const [mode, setMode] = useState<'item' | 'list'>(scan?.isListPage ? 'list' : 'item');

  return (
    <>
      {scan && (
        <div className="mode-switch" role="tablist" aria-label="What to save">
          <button type="button" role="tab" aria-selected={mode === 'item'} className={mode === 'item' ? 'is-on' : ''} onClick={() => setMode('item')}>
            This page
          </button>
          <button type="button" role="tab" aria-selected={mode === 'list'} className={mode === 'list' ? 'is-on' : ''} onClick={() => setMode('list')}>
            {scan.isListPage ? 'Whole list' : `All items here · ${scan.items.length}`}
          </button>
        </div>
      )}
      {mode === 'list' && scan ? (
        <ListImport
          session={session}
          tabId={tab.tabId}
          initialScan={scan}
          onListCreated={onListCreated}
          onDone={(count, url, listNames) => onSaved(`${count} ${count === 1 ? 'item' : 'items'}`, url, listNames, count)}
          onUnauthorized={onUnauthorized}
        />
      ) : (
        <SaveForm session={session} page={tab.page} initialSelected={initialSelected} onSaved={onSaved} onUnauthorized={onUnauthorized} />
      )}
    </>
  );
}

function SaveForm({
  session,
  page,
  initialSelected,
  onSaved,
  onUnauthorized,
}: {
  session: ExtensionSession;
  page: PageDetails;
  initialSelected: string[];
  onSaved: (title: string, url: string, listNames: string[]) => void;
  onUnauthorized: (notice: string) => void;
}) {
  const images = useMemo(() => page.images.filter(fits), [page.images]);
  const [imageIndex, setImageIndex] = useState(0);
  const [title, setTitle] = useState(short(page.title, LIMITS.title));
  const [price, setPrice] = useState(page.price !== null ? String(page.price) : '');
  const knownCurrency = (c: string | null) => (c && (CURRENCIES as readonly string[]).includes(c) ? c : null);
  const [currency, setCurrency] = useState(knownCurrency(page.currency) ?? knownCurrency(session.user.currency) ?? 'USD');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const wishlists = session.lists.filter((l) => l.kind === 'wishlist');
  const collections = session.lists.filter((l) => l.kind === 'collection');
  const image = images[imageIndex];
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Give it a name.');
    const parsedPrice = price.trim() ? parsePrice(price) : null;
    if (price.trim() && parsedPrice === null) return setError('Enter a price like 49.99, or leave it blank.');
    setSaving(true);
    setError(null);
    let externalUrl = page.url.split('#')[0];
    if (!fits(externalUrl)) externalUrl = new URL(page.url).origin + new URL(page.url).pathname;
    try {
      const res = await api<{ item: { id: string; title: string }; url: string }>('/api/extension/items', {
        method: 'POST',
        body: {
          title: short(title, LIMITS.title),
          externalUrl: fits(externalUrl) ? externalUrl : null,
          imageUrl: image && !brokenImages.has(image) ? image : null,
          price: parsedPrice,
          currency,
          retailer: short(page.retailer, LIMITS.shortText),
          brand: short(page.brand, LIMITS.shortText),
          description: short(page.description, LIMITS.description),
          notes: short(notes, LIMITS.notes),
          wishlistIds: selected,
        },
      });
      await setLastLists(selected);
      const names = session.lists.filter((l) => selected.includes(l.id)).map((l) => l.title);
      onSaved(res.item.title, res.url, names);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearToken();
        return onUnauthorized(err.message);
      }
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSaving(false);
    }
  };

  const listGroup = (label: string, lists: List[]) =>
    lists.length > 0 && (
      <div className="list-group">
        <span className="list-group-label">{label}</span>
        {lists.map((l) => {
          const on = selected.includes(l.id);
          return (
            <label key={l.id} className={`list-row${on ? ' is-on' : ''}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(l.id)} />
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

  return (
    <form className="save-form" onSubmit={save} noValidate>
      <div className="save-scroll">
        <div className="product">
          <div className="product-image">
            {image && !brokenImages.has(image) ? (
              <img src={image} alt="" onError={() => setBrokenImages((s) => new Set(s).add(image))} />
            ) : (
              <span className="product-noimage">
                <ImageOff size={22} aria-hidden />
                No photo found
              </span>
            )}
            {images.length > 1 && (
              <div className="image-nav">
                <button type="button" aria-label="Previous photo" onClick={() => setImageIndex((i) => (i - 1 + images.length) % images.length)}>
                  <ChevronLeft size={15} />
                </button>
                <span>
                  {imageIndex + 1} / {images.length}
                </span>
                <button type="button" aria-label="Next photo" onClick={() => setImageIndex((i) => (i + 1) % images.length)}>
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
          <div className="product-fields">
            {page.retailer && <span className="product-retailer">{page.retailer}</span>}
            <label className="field">
              <span className="field-label">Name</span>
              <textarea className="input" rows={3} value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <div className="field">
              <label className="field-label" htmlFor="price">
                Price
              </label>
              <span className="price-row">
                <input id="price" className="input" inputMode="decimal" placeholder="Optional" value={price} onChange={(e) => setPrice(e.target.value)} />
                <select className="input" aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </span>
            </div>
          </div>
        </div>

        {showNotes ? (
          <label className="field">
            <span className="field-label">Note</span>
            <textarea
              className="input"
              rows={2}
              value={notes}
              maxLength={LIMITS.notes}
              placeholder="Size, colour, why you want it…"
              onChange={(e) => setNotes(e.target.value)}
              autoFocus
            />
          </label>
        ) : (
          <button type="button" className="popup-text-btn add-note" onClick={() => setShowNotes(true)}>
            <StickyNote size={14} aria-hidden /> Add a note
          </button>
        )}

        <div className="lists">
          <span className="field-label">Add to</span>
          {session.lists.length === 0 ? (
            <p className="popup-muted small">You don’t have any lists yet — this will go to your Saved Items.</p>
          ) : (
            <>
              {listGroup('Wishlists', wishlists)}
              {listGroup('Collections', collections)}
            </>
          )}
        </div>
      </div>

      <div className="save-bar">
        {error && (
          <p className="popup-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-wide" disabled={saving}>
          {saving ? (
            <LoaderCircle className="spin" size={17} aria-label="Saving" />
          ) : selected.length === 0 ? (
            'Save to Saved Items'
          ) : selected.length === 1 ? (
            `Save to ${session.lists.find((l) => l.id === selected[0])?.title ?? 'list'}`
          ) : (
            `Save to ${selected.length} lists`
          )}
        </button>
      </div>
    </form>
  );
}
