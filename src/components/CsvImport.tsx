import { useState } from 'react';
import { AlertCircle, BadgeCheck, FileSpreadsheet } from 'lucide-react';
import { formatPrice } from '../lib/format';
import { CSV_FIELDS, CSV_FIELD_LABELS, CSV_MAX_ROWS, readCsv, type CsvField, type CsvFile, type ImportPlan } from '../lib/csvImport';
import { CSV_PRESETS, type CsvPreset } from '../lib/csvPresets';
import { FormNote } from './ui/Field';
import { Stars } from './ItemVisuals';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PRESET_SITES = (() => {
  const names = [...new Set(CSV_PRESETS.map((p) => p.name))];
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
})();

export interface PresetChoice {
  preset: CsvPreset;
  filter: string | null;
  counts: Record<string, number>;
  /** Matching the columns by hand instead. */
  manual: boolean;
  onFilter: (id: string) => void;
  onManual: (manual: boolean) => void;
}

/** A recognised export: columns are matched already, so only the rows to bring over are asked. */
function PresetCard({ choice, rows }: { choice: PresetChoice; rows: number }) {
  const { preset, filter, counts } = choice;
  const owned = preset.owned || preset.filters?.find((f) => f.id === filter)?.owned;
  return (
    <div className="csv-preset">
      <div className="csv-preset-head">
        <BadgeCheck size={18} aria-hidden />
        <div>
          <strong>
            {preset.name} {preset.what}
          </strong>
          <span className="muted text-sm">Recognised, so the columns are matched for you.</span>
        </div>
      </div>
      {preset.filters && (
        <label className="csv-preset-filter">
          <span className="field-label">{preset.filterLabel ?? 'Which rows?'}</span>
          <select className="select" value={filter ?? ''} onChange={(e) => choice.onFilter(e.target.value)}>
            {preset.filters.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} ({counts[f.id] ?? 0})
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="muted text-sm">
        {rows === 0
          ? 'Nothing to bring over from this file.'
          : owned
            ? 'These are things you have, so a collection is a good home for them. Ratings, reviews and dates come along.'
            : 'These are things you want, so a wishlist is a good home for them.'}
      </p>
      <button type="button" className="link-button text-sm" onClick={() => choice.onManual(true)}>
        Match the columns myself instead
      </button>
    </div>
  );
}

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
        From any spreadsheet (the first row should name the columns), or an export from {PRESET_SITES}. Up to {CSV_MAX_ROWS} items at a time.
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
  preset,
}: {
  file: CsvFile;
  fileName: string;
  mapping: Array<CsvField | null>;
  onMapping: (next: Array<CsvField | null>) => void;
  plan: ImportPlan;
  currency: string;
  preset?: PresetChoice | null;
}) {
  const sample = (i: number) => file.rows.find((r) => (r[i] ?? '').trim())?.[i]?.trim() ?? '';
  const setField = (i: number, field: CsvField | null) =>
    onMapping(mapping.map((f, j) => (j === i ? field : field && f === field ? null : f)));
  const hasName = mapping.includes('title') || mapping.includes('url');
  const usingPreset = Boolean(preset && !preset.manual);

  return (
    <div className="stack">
      <div>
        <span className="field-label">
          <FileSpreadsheet size={15} aria-hidden style={{ verticalAlign: '-2px' }} /> {fileName}
        </span>
        {!usingPreset && (
          <p className="muted text-sm">
            {file.rows.length} row{file.rows.length === 1 ? '' : 's'}. Check what each column holds; columns set to “Skip” aren’t imported.
            {preset && (
              <>
                {' '}
                <button type="button" className="link-button" onClick={() => preset.onManual(false)}>
                  Use the {preset.preset.name} settings
                </button>
              </>
            )}
          </p>
        )}
      </div>
      {preset && usingPreset ? (
        <PresetCard choice={preset} rows={file.rows.length} />
      ) : (
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
      )}
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
