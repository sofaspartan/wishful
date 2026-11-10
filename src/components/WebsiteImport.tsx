import { useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Check, Globe, Puzzle, Sparkles, Wand2 } from 'lucide-react';
import { sameSite, type ImportCandidate, type ListImportResult } from '../../shared/listImport';
import { PRIORITY_LABELS } from '../../shared/constants';
import { isHttpUrl } from '../../shared/schemas';
import { CSV_FIELDS, CSV_MAX_ROWS, type CsvFile } from '../lib/csvImport';
import { errorMessage, fieldErrors, post } from '../lib/api';
import { formatPrice } from '../lib/format';
import { brand } from '../config/brand';
import { LogoMark } from './Logo';
import { ILLUSTRATED_ITEMS } from './ItemIllustrations';
import { ItemImage } from './ItemVisuals';
import { Button } from './ui/Button';
import { Field, FormNote } from './ui/Field';

/** A list read from another site, ready to review. */
export interface WebsiteList {
  url: string;
  site: string;
  listName: string;
  items: ImportCandidate[];
  /** Reading stopped before the end (the user stopped it, a page failed, or the import limit). */
  partial: boolean;
}

const MAX_PAGES = 60;

function AmazonMark({ width = 92 }: { width?: number }) {
  return (
    <svg viewBox="0 0 100 34" width={width} role="img" aria-label="Amazon" className="amazon-mark">
      <text x="50" y="19" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="23" letterSpacing="-0.6" fill="currentColor">
        amazon
      </text>
      <path d="M21 24.5c17 7.5 39 7.5 56-0.5" fill="none" stroke="#FF9900" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M71.5 21.6l6.2 2.1-2.9 5.6" fill="none" stroke="#FF9900" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Another site's list flowing into a Wishful list. Decorative. */
function ImportArt() {
  const items = ILLUSTRATED_ITEMS.slice(0, 3);
  return (
    <div className="webimp-art" aria-hidden>
      <div className="webimp-sources">
        <div className="webimp-source is-amazon">
          <AmazonMark />
          <span>Wish lists</span>
        </div>
        <div className="webimp-source is-more">
          <Globe size={18} />
          <span>Other stores</span>
        </div>
      </div>
      <div className="webimp-flow">
        {items.map((it, i) => (
          <span key={it.name} className="webimp-chip" style={{ animationDelay: `${i * 0.9}s` }}>
            {it.art}
          </span>
        ))}
      </div>
      <div className="webimp-list">
        <div className="webimp-list-head">
          <LogoMark size={18} />
          <span>{brand.name}</span>
        </div>
        {items.map((it) => (
          <div key={it.name} className="webimp-row">
            <span className="webimp-thumb">{it.art}</span>
            <span className="webimp-name">
              <strong>{it.name}</strong>
              <span>{it.price}.00</span>
            </span>
            <Check size={13} strokeWidth={3} className="webimp-check" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Paste a list link; reads it page by page (Amazon sends 10 items at a time) and hands back everything found. */
export function WebsiteImportForm({ onFound }: { onFound: (list: WebsiteList) => void }) {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ message: string; blocked: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(0);
  const stopRef = useRef(false);

  const read = async (e?: FormEvent) => {
    e?.preventDefault();
    const target = url.trim();
    if (!isHttpUrl(target)) return setUrlError('Paste a full link starting with https://');
    setUrlError(null);
    setProblem(null);
    setFound(0);
    setLoading(true);
    stopRef.current = false;
    const items = new Map<string, ImportCandidate>();
    const add = (list: ImportCandidate[]) => {
      for (const c of list) if (!items.has(c.key)) items.set(c.key, c);
      setFound(items.size);
    };
    try {
      const first = await post<ListImportResult>('/api/import/list', { url: target });
      add(first.items);
      let next = first.next;
      let partial = false;
      for (let page = 1; next && page < MAX_PAGES && items.size < CSV_MAX_ROWS; page++) {
        if (stopRef.current) break;
        try {
          const more = await post<ListImportResult>('/api/import/list', { url: first.url, next });
          add(more.items);
          next = more.next;
        } catch {
          partial = true;
          break;
        }
      }
      if (!items.size) {
        setProblem({ message: first.message ?? "We couldn't find any items on that page.", blocked: Boolean(first.blocked) });
        return;
      }
      onFound({
        url: first.url,
        site: first.site,
        listName: first.listName,
        items: [...items.values()].slice(0, CSV_MAX_ROWS),
        partial: partial || Boolean(next) || items.size > CSV_MAX_ROWS,
      });
    } catch (err) {
      const fields = fieldErrors(err);
      if (fields.url) setUrlError(fields.url);
      else setProblem({ message: errorMessage(err), blocked: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="stack" onSubmit={read} noValidate>
      <ImportArt />
      <Field label="Wish list link" error={urlError ?? undefined} hint="The list needs to be public or shared, so anyone with the link can see it.">
        <input
          className="input"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://www.amazon.com/hz/wishlist/ls/…"
          value={url}
          data-autofocus
          disabled={loading}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>
      <div className="row-wrap">
        <Button variant="primary" type="submit" loading={loading} icon={<Wand2 size={16} />}>
          {loading ? (found ? `Found ${found} item${found === 1 ? '' : 's'}…` : 'Reading the list…') : 'Find items'}
        </Button>
        {loading && found > 0 && (
          <Button variant="ghost" onClick={() => (stopRef.current = true)}>
            Stop and use these
          </Button>
        )}
      </div>
      {problem && (
        <FormNote icon={<AlertCircle size={16} aria-hidden />}>
          <p>{problem.message}</p>
          {problem.blocked && (
            <p className="text-sm">
              <a href="/extension" target="_blank" rel="noreferrer">
                Get the {brand.name} browser extension
              </a>
            </p>
          )}
        </FormNote>
      )}
      <FormNote icon={<Sparkles size={16} aria-hidden />}>
        <p>
          <strong>Amazon:</strong> open your list, choose <b>Send list to others</b> (or <b>⋯ → Manage list</b> and set Privacy to Public or Shared), and copy the
          link. Items come over with their photos, prices, priorities and your comments.
        </p>
        <p className="text-sm muted">
          <Puzzle size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> Some sites, like Etsy, Target and Walmart, don’t let other websites read their lists.
          On a computer, open the list and use the{' '}
          <a href="/extension" target="_blank" rel="noreferrer">
            {brand.name} browser extension
          </a>{' '}
          to import it.
        </p>
      </FormNote>
    </form>
  );
}

/** The chosen items as importer rows, so they go through the same checks and saving as a CSV file. */
export function websiteListFile(list: WebsiteList, excluded: ReadonlySet<string>): CsvFile {
  const rows = list.items
    .filter((c) => !excluded.has(c.key))
    .map((c) => {
      const cell: Partial<Record<(typeof CSV_FIELDS)[number], string>> = {
        title: c.title,
        url: c.url ?? '',
        price: c.price !== null ? String(c.price) : '',
        currency: c.currency ?? '',
        imageUrl: c.imageUrl ?? '',
        notes: c.notes,
        priority: c.priority ?? '',
        retailer: sameSite(c.url, list.url) ? list.site : '',
      };
      return CSV_FIELDS.map((f) => cell[f] ?? '');
    });
  return { headers: [...CSV_FIELDS], rows, extraRows: 0 };
}

/** What was found, with a tick per item. */
export function WebsiteImportReview({
  list,
  excluded,
  onExcluded,
  currency,
}: {
  list: WebsiteList;
  excluded: ReadonlySet<string>;
  onExcluded: (next: Set<string>) => void;
  currency: string;
}) {
  const chosen = list.items.length - excluded.size;
  const toggle = (key: string) => {
    const next = new Set(excluded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onExcluded(next);
  };
  return (
    <div className="stack">
      <div className="webimp-found">
        <span className="webimp-found-badge">{list.site === 'Amazon' ? <AmazonMark width={64} /> : <Globe size={20} aria-hidden />}</span>
        <div className="webimp-found-copy">
          <strong className="truncate">{list.listName || `${list.site} list`}</strong>
          <span className="muted text-sm">
            {chosen} of {list.items.length} item{list.items.length === 1 ? '' : 's'} selected
          </span>
        </div>
        <button type="button" className="link-button text-sm" onClick={() => onExcluded(chosen === list.items.length ? new Set(list.items.map((c) => c.key)) : new Set())}>
          {chosen === list.items.length ? 'Select none' : 'Select all'}
        </button>
      </div>
      {list.partial && (
        <FormNote icon={<AlertCircle size={16} aria-hidden />}>
          <p>
            {list.items.length >= CSV_MAX_ROWS
              ? `Only the first ${CSV_MAX_ROWS} items can be imported at once.`
              : 'This is part of the list: reading stopped before the end. Import these, then you can add the rest later.'}
          </p>
        </FormNote>
      )}
      <ul className="webimp-items" aria-label="Items found">
        {list.items.map((c) => {
          const on = !excluded.has(c.key);
          const facts = [c.price !== null ? formatPrice(c.price, c.currency ?? currency) : '', c.priority ? PRIORITY_LABELS[c.priority] : '', c.notes].filter(Boolean);
          return (
            <li key={c.key}>
              <label className={`webimp-item${on ? '' : ' is-off'}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(c.key)} />
                <span className="bulk-thumb">
                  <ItemImage src={c.imageUrl} type="product" iconSize={18} cover />
                </span>
                <span className="webimp-item-copy">
                  <span className="webimp-item-title">{c.title}</span>
                  {facts.length > 0 && <span className="faint text-xs truncate">{facts.join(' · ')}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
