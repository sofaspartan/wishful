import { useState } from 'react';
import { AlertCircle, FileSpreadsheet } from 'lucide-react';
import { formatPrice } from '../lib/format';
import { CSV_FIELDS, CSV_FIELD_LABELS, CSV_MAX_ROWS, readCsv, type CsvField, type CsvFile, type ImportPlan } from '../lib/csvImport';
import { FormNote } from './ui/Field';
import { Stars } from './ItemVisuals';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** "Import a CSV file" button; reads the file in the browser. */
export function CsvPicker({ onLoaded }: { onLoaded: (file: CsvFile, name: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    if (f.size > MAX_FILE_BYTES) return setError('That file is larger than 5 MB. Split it into smaller files.');
    const file = readCsv(await f.text());
    if (!file.headers.length || !file.rows.length) return setError('That file has no rows to import. The first row should name the columns.');
    onLoaded(file, f.name);
  };
  return (
    <div className="stack" style={{ gap: 'var(--s-2)' }}>
      <label className="btn" style={{ alignSelf: 'flex-start', cursor: 'pointer' }}>
        <FileSpreadsheet size={16} aria-hidden /> Import a CSV file
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
          className="sr-only"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      <span className="field-hint">
        From a spreadsheet, Goodreads, Discogs, another wishlist site… The first row should name the columns. Up to {CSV_MAX_ROWS} rows at a time.
      </span>
      {error && (
        <FormNote icon={<AlertCircle size={16} aria-hidden />}>
          <p>{error}</p>
        </FormNote>
      )}
    </div>
  );
}

/** Match each column to an item field, with a sample value and a preview of the result. */
export function CsvMapping({
  file,
  fileName,
  mapping,
  onMapping,
  plan,
  currency,
}: {
  file: CsvFile;
  fileName: string;
  mapping: Array<CsvField | null>;
  onMapping: (next: Array<CsvField | null>) => void;
  plan: ImportPlan;
  currency: string;
}) {
  const sample = (i: number) => file.rows.find((r) => (r[i] ?? '').trim())?.[i]?.trim() ?? '';
  const setField = (i: number, field: CsvField | null) =>
    onMapping(mapping.map((f, j) => (j === i ? field : field && f === field ? null : f)));
  const hasName = mapping.includes('title') || mapping.includes('url');

  return (
    <div className="stack">
      <div>
        <span className="field-label">
          <FileSpreadsheet size={15} aria-hidden style={{ verticalAlign: '-2px' }} /> {fileName}
        </span>
        <p className="muted text-sm">
          {file.rows.length} row{file.rows.length === 1 ? '' : 's'}. Check what each column holds; columns set to “Skip” aren’t imported.
        </p>
      </div>
      <div className="csv-mapping" role="table" aria-label="Columns">
        {file.headers.map((h, i) => (
          <div className="csv-mapping-row" role="row" key={i}>
            <div className="csv-mapping-col" role="cell">
              <strong className="truncate">{h || `Column ${i + 1}`}</strong>
              <span className="faint text-xs truncate">{sample(i) || '—'}</span>
            </div>
            <div role="cell">
              <select
                className="select"
                aria-label={`What “${h || `Column ${i + 1}`}” holds`}
                value={mapping[i] ?? ''}
                onChange={(e) => setField(i, (e.target.value || null) as CsvField | null)}
              >
                <option value="">Skip</option>
                {CSV_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {CSV_FIELD_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      {!hasName && (
        <FormNote icon={<AlertCircle size={16} aria-hidden />}>
          <p>Choose which column holds each item’s name (or its link).</p>
        </FormNote>
      )}
      {hasName && (
        <div className="stack" style={{ gap: 'var(--s-2)' }}>
          <span className="field-label">
            Preview{' '}
            <span className="field-optional">
              {plan.rows.length} item{plan.rows.length === 1 ? '' : 's'} ready
              {plan.skipped > 0 ? ` · ${plan.skipped} row${plan.skipped === 1 ? '' : 's'} without a name skipped` : ''}
            </span>
          </span>
          <ul className="csv-preview">
            {plan.rows.slice(0, 4).map((r, i) => {
              const item = r.input;
              const facts = [
                item.price != null ? formatPrice(item.price, item.currency ?? currency) : '',
                item.brand,
                item.category,
                item.owned?.quantity && item.owned.quantity > 1 ? `×${item.owned.quantity}` : '',
                item.owned?.acquiredOn ? `got ${item.owned.acquiredOn}` : '',
              ].filter(Boolean);
              return (
                <li key={i}>
                  <span className="truncate">
                    <strong>{item.title}</strong>
                    {facts.length > 0 && <span className="muted"> · {facts.join(' · ')}</span>}
                  </span>
                  {item.owned?.rating ? <Stars value={item.owned.rating} size={12} /> : null}
                </li>
              );
            })}
            {plan.rows.length > 4 && <li className="faint">…and {plan.rows.length - 4} more</li>}
          </ul>
        </div>
      )}
      {file.extraRows > 0 && (
        <FormNote icon={<AlertCircle size={16} aria-hidden />}>
          <p>
            Only the first {CSV_MAX_ROWS} rows are imported. Import the other {file.extraRows} from a second file.
          </p>
        </FormNote>
      )}
    </div>
  );
}
