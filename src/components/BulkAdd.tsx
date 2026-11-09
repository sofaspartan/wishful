import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, Lightbulb, Link2, ListPlus, X } from 'lucide-react';
import type { ItemType, UrlMetadata } from '../../shared/types';
import { LIMITS } from '../../shared/constants';
import { isHttpUrl } from '../../shared/schemas';
import { errorMessage, post } from '../lib/api';
import { Button } from './ui/Button';
import { Field, FormNote } from './ui/Field';
import { Spinner } from './ui/misc';
import { ItemImage } from './ItemVisuals';
import { parseAmount } from './ItemForm';
import { hostOf, parseBulkText, titleFromUrl, type BulkLine } from '../lib/bulkText';

export interface BulkRow {
  key: string;
  url: string | null;
  status: 'loading' | 'ready' | 'partial' | 'named';
  title: string;
  price: string;
  imageUrl: string | null;
  retailer: string;
  brand: string;
  description: string;
  currency: string | null;
  note: string | null;
}

const FETCH_CONCURRENCY = 3;

function toRow(line: BulkLine, i: number): BulkRow {
  const base = { key: `${Date.now()}-${i}`, price: '', imageUrl: null, brand: '', description: '', currency: null, note: null };
  return line.url
    ? { ...base, url: line.url, status: 'loading', title: titleFromUrl(line.url), retailer: hostOf(line.url) }
    : { ...base, url: null, status: 'named', title: line.title ?? '', retailer: '' };
}

function applyMeta(row: BulkRow, meta: UrlMetadata): BulkRow {
  return {
    ...row,
    status: meta.extracted ? 'ready' : 'partial',
    title: meta.title?.trim() ? meta.title.trim().slice(0, LIMITS.title) : row.title,
    description: meta.description ?? '',
    imageUrl: meta.imageUrl && isHttpUrl(meta.imageUrl) ? meta.imageUrl : null,
    retailer: meta.retailer || row.retailer,
    brand: meta.brand ?? '',
    price: meta.price !== null ? String(meta.price) : row.price,
    currency: meta.currency,
    note: meta.extracted ? null : "Couldn't read this page. Check the name.",
  };
}

/** Rows under review, with link details fetched a few at a time. */
export function useBulkRows() {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const run = useRef(0);

  const start = useCallback((lines: BulkLine[]) => {
    const id = ++run.current;
    const initial = lines.map(toRow);
    setRows(initial);
    const queue = initial.filter((r) => r.url);
    let next = 0;
    const worker = async () => {
      while (next < queue.length && run.current === id) {
        const row = queue[next++];
        let patch: (r: BulkRow) => BulkRow;
        try {
          const meta = await post<UrlMetadata>('/api/metadata', { url: row.url });
          patch = (r) => applyMeta(r, meta);
        } catch (err) {
          patch = (r) => ({ ...r, status: 'partial', note: errorMessage(err) });
        }
        if (run.current !== id) return;
        setRows((rs) => rs.map((r) => (r.key === row.key ? patch(r) : r)));
      }
    };
    for (let i = 0; i < FETCH_CONCURRENCY; i++) void worker();
  }, []);

  const reset = useCallback(() => {
    run.current++;
    setRows([]);
  }, []);

  useEffect(() => () => void run.current++, []);

  return { rows, setRows, start, reset };
}

export function bulkRowErrors(rows: BulkRow[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const r of rows) {
    if (!r.title.trim()) errors[r.key] = 'Give it a name';
    else if (Number.isNaN(parseAmount(r.price))) errors[r.key] = 'Enter a price like 24.99';
  }
  return errors;
}

export function bulkRowToInput(r: BulkRow, namedType: ItemType) {
  const price = parseAmount(r.price);
  return {
    type: r.url ? ('product' as const) : namedType,
    title: r.title.trim().slice(0, LIMITS.title),
    description: r.description.slice(0, LIMITS.description),
    imageUrl: r.imageUrl,
    externalUrl: r.url,
    retailer: r.retailer.slice(0, LIMITS.shortText),
    brand: r.brand.slice(0, LIMITS.shortText),
    price: r.url ? price : null,
    ...(r.currency && /^[A-Z]{3}$/i.test(r.currency) ? { currency: r.currency } : {}),
  };
}

const PLACEHOLDER = `https://www.example.com/cozy-wool-sweater
https://shop.example.com/products/desk-lamp
Pottery class for two`;

export function BulkPaste({ text, onChange, onSubmit }: { text: string; onChange: (t: string) => void; onSubmit: (lines: BulkLine[]) => void }) {
  const lines = useMemo(() => parseBulkText(text), [text]);
  const links = lines.filter((l) => l.url).length;
  const named = lines.length - links;
  const count = Math.min(lines.length, LIMITS.bulkItems);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (lines.length) onSubmit(lines.slice(0, LIMITS.bulkItems));
  };
  return (
    <form className="stack" onSubmit={submit}>
      <Field label="Links or item names" hint="One per line. Links get their name, picture and price filled in; plain lines become items you can flesh out later.">
        <textarea className="input bulk-textarea" rows={8} value={text} placeholder={PLACEHOLDER} data-autofocus spellCheck={false} onChange={(e) => onChange(e.target.value)} />
      </Field>
      {lines.length > 0 && (
        <div className="bulk-summary" aria-live="polite">
          {links > 0 && (
            <span className="badge badge-info">
              <Link2 size={13} aria-hidden /> {links} link{links === 1 ? '' : 's'}
            </span>
          )}
          {named > 0 && (
            <span className="badge">
              <Lightbulb size={13} aria-hidden /> {named} named item{named === 1 ? '' : 's'}
            </span>
          )}
        </div>
      )}
      {lines.length > LIMITS.bulkItems && (
        <FormNote icon={<AlertCircle size={16} aria-hidden />}>
          You can add up to {LIMITS.bulkItems} at a time. The first {LIMITS.bulkItems} will be added, so paste the rest in another batch.
        </FormNote>
      )}
      <div className="row-wrap">
        <Button variant="primary" type="submit" disabled={!lines.length} icon={<ListPlus size={16} />}>
          {count ? `Review ${count} item${count === 1 ? '' : 's'}` : 'Review items'}
        </Button>
      </div>
    </form>
  );
}

export function BulkReview({
  rows,
  errors,
  onChange,
  onRemove,
}: {
  rows: BulkRow[];
  errors: Record<string, string>;
  onChange: (key: string, patch: Partial<BulkRow>) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <ul className="bulk-rows" aria-label="Items to add">
      {rows.map((r) => {
        const error = errors[r.key];
        return (
          <li key={r.key} className={`bulk-row${error ? ' has-error' : ''}`}>
            <div className="bulk-thumb">
              {r.status === 'loading' ? <Spinner size={18} label="Fetching details" /> : <ItemImage src={r.imageUrl} type={r.url ? 'product' : 'idea'} iconSize={20} cover />}
            </div>
            <div className="bulk-main">
              <input
                className="input bulk-title"
                aria-label="Item name"
                aria-invalid={error ? true : undefined}
                value={r.title}
                disabled={r.status === 'loading'}
                maxLength={LIMITS.title}
                onChange={(e) => onChange(r.key, { title: e.target.value })}
              />
              <span className={`bulk-meta${error || r.note ? ' bulk-meta-warn' : ''}`}>
                {r.url ? <Link2 size={12} aria-hidden /> : <Lightbulb size={12} aria-hidden />}
                <span className="truncate">{error ?? (r.status === 'loading' ? `Fetching details from ${hostOf(r.url ?? '')}…` : (r.note ?? (r.url ? r.retailer || hostOf(r.url) : 'Named item')))}</span>
              </span>
            </div>
            {r.url && (
              <input
                className="input bulk-price"
                aria-label={`Price for ${r.title}`}
                placeholder="Price"
                inputMode="decimal"
                value={r.price}
                disabled={r.status === 'loading'}
                onChange={(e) => onChange(r.key, { price: e.target.value })}
              />
            )}
            <Button variant="ghost" size="sm" iconOnly icon={<X size={16} />} aria-label={`Remove ${r.title}`} onClick={() => onRemove(r.key)} />
          </li>
        );
      })}
    </ul>
  );
}
