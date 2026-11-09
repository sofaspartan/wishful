import { ChevronRight } from 'lucide-react';
import type { Item, ItemMetadata, ItemType } from '../../shared/types';
import { CURRENCIES, ITEM_TYPE_LABELS, SUGGESTED_CATEGORIES } from '../../shared/constants';
import { Field } from './ui/Field';
import { ImagePicker } from './ImagePicker';
import { ItemTypeIcon } from './ItemVisuals';

export interface ItemDraft {
  type: ItemType;
  title: string;
  description: string;
  imageUrl: string | null;
  externalUrl: string;
  retailer: string;
  brand: string;
  price: string;
  currency: string;
  category: string;
  tags: string;
  notes: string;
  size: string;
  color: string;
  model: string;
  variant: string;
  location: string;
  venue: string;
  timeframe: string;
  bookingUrl: string;
  instructions: string;
}

export function emptyDraft(currency = 'USD', type: ItemType = 'custom'): ItemDraft {
  return {
    type,
    title: '',
    description: '',
    imageUrl: null,
    externalUrl: '',
    retailer: '',
    brand: '',
    price: '',
    currency,
    category: '',
    tags: '',
    notes: '',
    size: '',
    color: '',
    model: '',
    variant: '',
    location: '',
    venue: '',
    timeframe: '',
    bookingUrl: '',
    instructions: '',
  };
}

/** The "amount" shown for an item: price, or a gift card's suggested amount, or an idea's budget. */
export function effectivePrice(item: Pick<Item, 'price' | 'metadata'>): number | null {
  return item.price ?? item.metadata.suggestedAmount ?? item.metadata.budget ?? null;
}

export function draftFromItem(item: Item): ItemDraft {
  const m = item.metadata;
  const amount = effectivePrice(item);
  return {
    type: item.type,
    title: item.title,
    description: item.description,
    imageUrl: item.imageUrl,
    externalUrl: item.externalUrl ?? '',
    retailer: item.retailer,
    brand: item.brand,
    price: amount !== null ? String(amount) : '',
    currency: item.currency,
    category: item.category,
    tags: item.tags.join(', '),
    notes: item.notes,
    size: m.size ?? '',
    color: m.color ?? '',
    model: m.model ?? '',
    variant: m.variant ?? '',
    location: m.location ?? '',
    venue: m.venue ?? '',
    timeframe: m.timeframe ?? '',
    bookingUrl: m.bookingUrl ?? '',
    instructions: m.instructions ?? '',
  };
}

export function parseAmount(v: string): number | null {
  const cleaned = v.replace(/[^\d.,]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/** Convert the form draft into an API payload. Type-specific fields are only sent for their type. */
export function draftToInput(d: ItemDraft) {
  const amount = parseAmount(d.price);
  const metadata: ItemMetadata = {};
  const t = d.type;
  if (t === 'product' || t === 'custom') Object.assign(metadata, { size: d.size, color: d.color, model: d.model, variant: d.variant });
  if (t === 'experience') Object.assign(metadata, { location: d.location, venue: d.venue, timeframe: d.timeframe, bookingUrl: d.bookingUrl || null });
  if (t === 'gift_card') Object.assign(metadata, { instructions: d.instructions, suggestedAmount: amount });
  if (t === 'idea') Object.assign(metadata, { budget: amount });
  return {
    type: d.type,
    title: d.title,
    description: d.description,
    imageUrl: d.imageUrl,
    externalUrl: d.externalUrl.trim() || null,
    retailer: d.retailer,
    brand: d.brand,
    price: t === 'idea' || t === 'gift_card' ? null : amount,
    currency: d.currency,
    category: d.category,
    tags: d.tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    notes: d.notes,
    metadata,
  };
}

/** Instant client-side checks; the server re-validates everything. */
export function validateDraft(d: ItemDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!d.title.trim()) errors.title = 'Give it a title';
  const amount = parseAmount(d.price);
  if (amount !== null && (Number.isNaN(amount) || amount < 0)) errors.price = 'Enter a valid amount';
  for (const key of ['externalUrl', 'bookingUrl'] as const) {
    const v = d[key].trim();
    if (v && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(v)) errors[key] = 'Enter a full link starting with https://';
  }
  return errors;
}

/** Map server field errors (e.g. "metadata.bookingUrl") onto draft field names. */
export function mapItemErrors(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    const key = k.replace(/^metadata\./, '');
    out[key === 'suggestedAmount' || key === 'budget' ? 'price' : key.split('.')[0]] = v;
  }
  return out;
}

const TYPES: ItemType[] = ['product', 'experience', 'idea', 'gift_card', 'custom'];

interface Props {
  draft: ItemDraft;
  onChange: (patch: Partial<ItemDraft>) => void;
  errors: Record<string, string>;
  onUploadingChange?: (v: boolean) => void;
  hideImage?: boolean;
  autoFocusTitle?: boolean;
}

export function ItemFormFields({ draft, onChange, errors, onUploadingChange, hideImage, autoFocusTitle }: Props) {
  const t = draft.type;
  const amountLabel = t === 'idea' ? 'Estimated budget' : t === 'gift_card' ? 'Suggested amount' : t === 'experience' ? 'Estimated cost' : 'Price';
  const set = (key: keyof ItemDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange({ [key]: e.target.value } as Partial<ItemDraft>);

  return (
    <div className="stack">
      <div className="field">
        <span className="field-label" id="item-type-label">
          What is it? <span className="field-optional">Optional</span>
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="item-type-label">
          {TYPES.map((type) => (
            <button key={type} type="button" role="radio" aria-checked={t === type} aria-pressed={t === type} onClick={() => onChange({ type })}>
              <ItemTypeIcon type={type} size={15} />
              {type === 'gift_card' ? 'Gift card' : ITEM_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {!hideImage && (
        <div className="field">
          <span className="field-label">
            Image <span className="field-optional">Optional</span>
          </span>
          <ImagePicker value={draft.imageUrl} onChange={(imageUrl) => onChange({ imageUrl })} onUploadingChange={onUploadingChange} compact />
        </div>
      )}

      <Field label={t === 'experience' ? 'What do you want to do?' : t === 'idea' ? 'Idea' : t === 'gift_card' ? 'Gift card or fund' : 'Name'} error={errors.title}>
        <input
          className="input"
          value={draft.title}
          onChange={set('title')}
          maxLength={200}
          placeholder={
            t === 'experience' ? 'Hot air balloon ride' : t === 'idea' ? 'A cosy reading nook' : t === 'gift_card' ? 'Travel fund for Japan' : 'Noise-cancelling headphones'
          }
          data-autofocus={autoFocusTitle || undefined}
        />
      </Field>

      <div className="form-grid cols-2">
        <Field label={amountLabel} optional error={errors.price}>
          <div className="input-prefix">
            <select className="select" value={draft.currency} onChange={set('currency')} aria-label="Currency">
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input className="input" inputMode="decimal" value={draft.price} onChange={set('price')} placeholder="0.00" aria-label={amountLabel} />
          </div>
        </Field>
        <Field label={t === 'experience' ? 'Website' : 'Link'} optional error={errors.externalUrl}>
          <input className="input" type="url" inputMode="url" value={draft.externalUrl} onChange={set('externalUrl')} placeholder="https://" />
        </Field>
      </div>

      <Field label="Description" optional error={errors.description}>
        <textarea className="textarea" rows={3} value={draft.description} onChange={set('description')} maxLength={5000} placeholder="Anything that helps describe it" />
      </Field>

      {(t === 'product' || t === 'custom') && (
        <details className="disclosure" open={t === 'product' || Boolean(draft.retailer || draft.brand || draft.size || draft.color || draft.model)}>
          <summary>
            <ChevronRight size={16} aria-hidden /> Product details
          </summary>
          <div className="form-grid cols-2" style={{ marginTop: 8 }}>
            <Field label="Store" optional error={errors.retailer}>
              <input className="input" value={draft.retailer} onChange={set('retailer')} placeholder="Retailer" maxLength={120} />
            </Field>
            <Field label="Brand" optional error={errors.brand}>
              <input className="input" value={draft.brand} onChange={set('brand')} maxLength={120} />
            </Field>
            <Field label="Size" optional error={errors.size}>
              <input className="input" value={draft.size} onChange={set('size')} placeholder="M, 10, 32×30…" maxLength={120} />
            </Field>
            <Field label="Colour" optional error={errors.color}>
              <input className="input" value={draft.color} onChange={set('color')} maxLength={120} />
            </Field>
            <Field label="Model" optional error={errors.model}>
              <input className="input" value={draft.model} onChange={set('model')} maxLength={120} />
            </Field>
            <Field label="Variation" optional error={errors.variant}>
              <input className="input" value={draft.variant} onChange={set('variant')} placeholder="Edition, material…" maxLength={120} />
            </Field>
          </div>
        </details>
      )}

      {t === 'experience' && (
        <div className="form-grid cols-2">
          <Field label="Location" optional error={errors.location}>
            <input className="input" value={draft.location} onChange={set('location')} placeholder="City or area" maxLength={120} />
          </Field>
          <Field label="Venue" optional error={errors.venue}>
            <input className="input" value={draft.venue} onChange={set('venue')} maxLength={120} />
          </Field>
          <Field label="Date or timeframe" optional error={errors.timeframe}>
            <input className="input" value={draft.timeframe} onChange={set('timeframe')} placeholder="Spring 2027, any weekend…" maxLength={120} />
          </Field>
          <Field label="Booking link" optional error={errors.bookingUrl}>
            <input className="input" type="url" inputMode="url" value={draft.bookingUrl} onChange={set('bookingUrl')} placeholder="https://" />
          </Field>
        </div>
      )}

      {t === 'gift_card' && (
        <div className="form-grid cols-2">
          <Field label="Store or service" optional error={errors.retailer}>
            <input className="input" value={draft.retailer} onChange={set('retailer')} placeholder="Any bookshop, Airbnb…" maxLength={120} />
          </Field>
          <Field label="Instructions for givers" optional error={errors.instructions} className="span-2">
            <textarea className="textarea" rows={2} value={draft.instructions} onChange={set('instructions')} maxLength={1000} placeholder="Any amount helps — e-gift cards are perfect." />
          </Field>
        </div>
      )}

      <details className="disclosure" open={Boolean(draft.category || draft.tags || draft.notes)}>
        <summary>
          <ChevronRight size={16} aria-hidden /> Category, tags & private notes
        </summary>
        <div className="stack" style={{ marginTop: 8 }}>
          <div className="form-grid cols-2">
            <Field label="Category" optional error={errors.category}>
              <input className="input" list="category-options" value={draft.category} onChange={set('category')} maxLength={50} placeholder="Technology" />
            </Field>
            <Field label="Tags" optional error={errors.tags} hint="Separate with commas">
              <input className="input" value={draft.tags} onChange={set('tags')} placeholder="gaming, cosy" />
            </Field>
          </div>
          <datalist id="category-options">
            {SUGGESTED_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Field label="Private notes" optional error={errors.notes} hint="Only you (and editors) can see these — never shown on shared links.">
            <textarea className="textarea" rows={2} value={draft.notes} onChange={set('notes')} maxLength={5000} />
          </Field>
        </div>
      </details>
    </div>
  );
}
