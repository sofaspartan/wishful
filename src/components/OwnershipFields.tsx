import { ACQUIRED_VIA, CONDITIONS, type AcquiredVia, type Condition, type ItemOwnership } from '../../shared/types';
import { ACQUIRED_VIA_LABELS, CONDITION_LABELS } from '../../shared/constants';
import type { OwnershipInput } from '../../shared/schemas';
import { Field } from './ui/Field';

export interface OwnershipDraft {
  acquiredOn: string;
  acquiredVia: AcquiredVia | '';
  pricePaid: string;
  condition: Condition | '';
  quantity: string;
}

export function todayDateOnly(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ownershipDraft(owned: ItemOwnership | null | undefined, defaults: Partial<OwnershipDraft> = {}): OwnershipDraft {
  return {
    acquiredOn: owned?.acquiredOn ?? '',
    acquiredVia: owned?.acquiredVia ?? '',
    pricePaid: owned?.pricePaid != null ? String(owned.pricePaid) : '',
    condition: owned?.condition ?? '',
    quantity: String(owned?.quantity ?? 1),
    ...(owned ? {} : defaults),
  };
}

const amount = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[^0-9.]/g, '')));

export function ownershipToInput(d: OwnershipDraft): OwnershipInput {
  return {
    acquiredOn: d.acquiredOn || null,
    acquiredVia: d.acquiredVia || null,
    pricePaid: amount(d.pricePaid),
    condition: d.condition || null,
    quantity: Number(d.quantity),
  };
}

export function validateOwnership(d: OwnershipDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const paid = amount(d.pricePaid);
  if (paid !== null && (!Number.isFinite(paid) || paid < 0)) errors.pricePaid = 'Enter a valid amount';
  const qty = Number(d.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 9999) errors.quantity = 'Use a whole number from 1';
  return errors;
}

/** Server field errors arrive as "owned.quantity"; pull out just the ownership ones. */
export function ownershipErrors(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) if (k.startsWith('owned.')) out[k.slice(6)] = v;
  return out;
}

interface Props {
  draft: OwnershipDraft;
  onChange: (patch: Partial<OwnershipDraft>) => void;
  errors?: Record<string, string>;
  currency: string;
  /** What was paid is only collected where the viewer is allowed to see it. */
  showPricePaid?: boolean;
}

export function OwnershipFields({ draft, onChange, errors = {}, currency, showPricePaid = true }: Props) {
  return (
    <div className="stack">
      <div className="form-grid cols-2">
        <Field label="Got it on" optional error={errors.acquiredOn}>
          <input className="input" type="date" value={draft.acquiredOn} max={todayDateOnly()} onChange={(e) => onChange({ acquiredOn: e.target.value })} />
        </Field>
        <div className="field">
          <span className="field-label" id="acquired-via-label">
            How you got it <span className="field-optional">Optional</span>
          </span>
          <div className="segmented full" role="radiogroup" aria-labelledby="acquired-via-label">
            {ACQUIRED_VIA.map((via) => (
              <button
                key={via}
                type="button"
                role="radio"
                aria-checked={draft.acquiredVia === via}
                aria-pressed={draft.acquiredVia === via}
                onClick={() => onChange({ acquiredVia: draft.acquiredVia === via ? '' : via })}
              >
                {ACQUIRED_VIA_LABELS[via]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={`form-grid ${showPricePaid ? 'cols-3' : 'cols-2'}`}>
        {showPricePaid && (
          <Field label={`Price paid (${currency})`} optional error={errors.pricePaid} hint="Only you and editors see this.">
            <input className="input" inputMode="decimal" value={draft.pricePaid} onChange={(e) => onChange({ pricePaid: e.target.value })} placeholder="0.00" />
          </Field>
        )}
        <Field label="Condition" optional error={errors.condition}>
          <select className="select" value={draft.condition} onChange={(e) => onChange({ condition: e.target.value as Condition | '' })}>
            <option value="">—</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="How many" error={errors.quantity}>
          <input className="input" type="number" min={1} max={9999} step={1} value={draft.quantity} onChange={(e) => onChange({ quantity: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
