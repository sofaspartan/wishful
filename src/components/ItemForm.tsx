import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Item, ItemMetadata, ItemType } from '../../shared/types';
import { CURRENCIES, ITEM_TYPE_LABELS, SUGGESTED_CATEGORIES } from '../../shared/constants';
import { Field } from './ui/Field';
import { ImagePicker } from './ImagePicker';
import { FEATURE_ILLUSTRATIONS } from './ItemIllustrations';

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
  barcode: string;
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
    barcode: '',
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
    barcode: m.barcode ?? '',
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
  if (t === 'product' || t === 'custom') {
    Object.assign(metadata, {
      size: d.size,
      color: d.color,
      model: d.model,
      variant: d.variant,
      barcode: d.barcode.trim() || undefined,
    });
  }
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

const TYPE_BLURBS: Record<ItemType, string> = {
  product: 'A specific thing to buy — headphones, a book, cookware…',
  experience: 'An outing or activity — dinner, a class, a trip day…',
  idea: 'A direction, not a SKU — “something cosy for reading”…',
  gift_card: 'Store credit, a gift card, or a cash contribution…',
  custom: 'Anything that doesn’t fit the others.',
};

type CoreTab = 'details' | 'notes';

export type ItemFormExtraTab = {
  id: string;
  label: string;
  invalid?: boolean;
  panel: ReactNode;
  icon?: ReactNode;
  /** Insert before this core tab id (default: append at end). */
  before?: CoreTab;
};

const CORE_TAB_ICONS: Record<CoreTab, ReactNode> = {
  details: FEATURE_ILLUSTRATIONS.store,
  notes: FEATURE_ILLUSTRATIONS.idea,
};

const DETAILS_KEYS = [
  'title',
  'price',
  'externalUrl',
  'description',
  'imageUrl',
  'category',
  'tags',
  'retailer',
  'brand',
  'size',
  'color',
  'model',
  'variant',
  'barcode',
  'location',
  'venue',
  'timeframe',
  'bookingUrl',
  'instructions',
] as const;
const NOTES_KEYS = ['notes'] as const;
const ADVANCED_KEYS = [
  'category',
  'tags',
  'retailer',
  'brand',
  'size',
  'color',
  'model',
  'variant',
  'barcode',
  'location',
  'venue',
  'timeframe',
  'bookingUrl',
  'instructions',
] as const;

function coreTabHasError(tab: CoreTab, errors: Record<string, string>): boolean {
  const keys = tab === 'details' ? DETAILS_KEYS : NOTES_KEYS;
  return keys.some((k) => Boolean(errors[k]));
}

function scrollFormToTop(root: HTMLElement | null) {
  const body = root?.closest('.modal-body') as HTMLElement | null;
  if (!body) return;
  body.scrollTo({ top: 0, behavior: 'smooth' });
}

function hasAdvancedValues(draft: ItemDraft): boolean {
  return ADVANCED_KEYS.some((k) => Boolean(draft[k]?.trim()));
}

function typeLabel(type: ItemType): string {
  if (type === 'gift_card') return 'Gift card';
  if (type === 'custom') return 'Something else';
  return ITEM_TYPE_LABELS[type];
}

const TYPE_ICONS: Record<ItemType, ReactNode> = {
  product: FEATURE_ILLUSTRATIONS.store,
  experience: FEATURE_ILLUSTRATIONS.tickets,
  idea: FEATURE_ILLUSTRATIONS.idea,
  gift_card: FEATURE_ILLUSTRATIONS.giftCard,
  custom: FEATURE_ILLUSTRATIONS.barcode,
};

function TypeArt({ type }: { type: ItemType }) {
  return (
    <span className="item-type-art" aria-hidden>
      {TYPE_ICONS[type]}
    </span>
  );
}

function TypePicker({
  value,
  onChange,
  id,
  className,
}: {
  value: ItemType;
  onChange: (type: ItemType) => void;
  id: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={['item-type-field', className].filter(Boolean).join(' ')} ref={root}>
      <span className="item-type-inline-label" id={`${id}-label`}>
        What is it?
      </span>
      <button
        type="button"
        id={id}
        className="item-type-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        title={TYPE_BLURBS[value]}
        onClick={() => setOpen((v) => !v)}
      >
        <TypeArt type={value} />
        <strong className="item-type-trigger-label">{typeLabel(value)}</strong>
        <ChevronDown size={16} aria-hidden className={`item-type-chevron${open ? ' is-open' : ''}`} />
      </button>
      <span id={`${id}-hint`} className="sr-only">
        {TYPE_BLURBS[value]}
      </span>
      {open && (
        <ul className="item-type-menu" role="listbox" aria-labelledby={`${id}-label`}>
          {TYPES.map((type) => {
            const selected = type === value;
            return (
              <li key={type} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`item-type-option${selected ? ' is-selected' : ''}`}
                  onClick={() => {
                    onChange(type);
                    setOpen(false);
                  }}
                >
                  <TypeArt type={type} />
                  <span className="item-type-option-text">
                    <strong>{typeLabel(type)}</strong>
                    <span className="muted text-sm">{TYPE_BLURBS[type]}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface Props {
  draft: ItemDraft;
  onChange: (patch: Partial<ItemDraft>) => void;
  errors: Record<string, string>;
  onUploadingChange?: (v: boolean) => void;
  hideImage?: boolean;
  /** Extra tabs (e.g. Lists, Owned in Edit). Use `before` to place among core tabs. */
  extraTabs?: ItemFormExtraTab[];
  /** Extra content at the end of the Details panel. */
  detailsExtra?: ReactNode;
  /** Controlled tab id (core or extra). */
  tab?: string;
  onTabChange?: (tab: string) => void;
  /** Extra class on the type picker (e.g. hide-xs when type is chosen elsewhere). */
  typePickerClassName?: string;
}

export function ItemFormFields({
  draft,
  onChange,
  errors,
  onUploadingChange,
  hideImage,
  extraTabs = [],
  detailsExtra,
  tab: controlledTab,
  onTabChange,
  typePickerClassName,
}: Props) {
  const t = draft.type;
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const amountLabel = t === 'idea' ? 'Estimated budget' : t === 'gift_card' ? 'Suggested amount' : t === 'experience' ? 'Estimated cost' : 'Price';
  const set = (key: keyof ItemDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange({ [key]: e.target.value } as Partial<ItemDraft>);

  const coreTabs = useMemo(
    (): { id: CoreTab; label: string }[] => [
      { id: 'details', label: 'Details' },
      { id: 'notes', label: 'Notes' },
    ],
    [],
  );

  const tabs = useMemo(() => {
    const list: { id: string; label: string; invalid?: boolean; icon?: ReactNode }[] = coreTabs.map((t) => ({
      ...t,
      icon: CORE_TAB_ICONS[t.id],
    }));
    for (const extra of extraTabs) {
      const entry = { id: extra.id, label: extra.label, invalid: extra.invalid, icon: extra.icon };
      if (extra.before) {
        const i = list.findIndex((x) => x.id === extra.before);
        if (i >= 0) {
          list.splice(i, 0, entry);
          continue;
        }
      }
      list.push(entry);
    }
    return list;
  }, [coreTabs, extraTabs]);

  const [internalTab, setInternalTab] = useState('details');
  const rawTab = controlledTab === 'basics' || controlledTab === 'organize' ? 'details' : (controlledTab ?? internalTab);
  const tab = rawTab;
  const prevTab = useRef(tab);
  const [advancedOpen, setAdvancedOpen] = useState(() => hasAdvancedValues(draft));

  useEffect(() => {
    if (ADVANCED_KEYS.some((k) => Boolean(errors[k])) || hasAdvancedValues(draft)) setAdvancedOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open for errors / existing values, don't fight user toggle
  }, [errors]);

  const selectTab = (next: string) => {
    const normalized = next === 'basics' || next === 'organize' ? 'details' : next;
    onTabChange?.(normalized);
    if (controlledTab === undefined) setInternalTab(normalized);
  };

  useEffect(() => {
    if (prevTab.current === tab) return;
    prevTab.current = tab;
    requestAnimationFrame(() => scrollFormToTop(rootRef.current));
  }, [tab]);

  useEffect(() => {
    if (!tabs.some((x) => x.id === tab)) selectTab('details');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when tab set becomes invalid
  }, [tab, tabs]);

  useEffect(() => {
    if (!Object.keys(errors).length) return;
    if (tab === 'details' || tab === 'notes') {
      if (coreTabHasError(tab, errors)) return;
    }
    const order: CoreTab[] = ['details', 'notes'];
    const hit = order.find((id) => coreTabHasError(id, errors));
    if (hit) selectTab(hit);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: errors identity from parent save
  }, [errors]);

  return (
    <div className="stack item-form" ref={rootRef}>
      <TypePicker
        id={`${uid}-type`}
        value={t}
        onChange={(type) => onChange({ type })}
        className={typePickerClassName}
      />
      <nav className="segmented lists-switch item-form-switch" role="tablist" aria-label="Item sections">
        {tabs.map((x) => {
          const selected = tab === x.id;
          const invalid = 'invalid' in x && x.invalid ? true : coreTabs.some((c) => c.id === x.id) && coreTabHasError(x.id as CoreTab, errors);
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              id={`${uid}-tab-${x.id}`}
              aria-selected={selected}
              aria-current={selected ? 'page' : undefined}
              aria-controls={`${uid}-panel-${x.id}`}
              onClick={() => selectTab(x.id)}
            >
              {x.icon && (
                <span className="art-icon art-icon-tab" aria-hidden>
                  {x.icon}
                </span>
              )}
              {x.label}
              {invalid && <span className="editor-tab-alert" role="img" aria-label="Needs attention" />}
            </button>
          );
        })}
      </nav>

      {tab === 'details' && (
        <div className="stack" role="tabpanel" id={`${uid}-panel-details`} aria-labelledby={`${uid}-tab-details`}>
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

          <details
            className="disclosure"
            open={advancedOpen}
            onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
          >
            <summary>
              <ChevronRight size={16} aria-hidden /> Advanced
            </summary>
            <div className="stack" style={{ marginTop: 8 }}>
              <div className="form-grid cols-2">
                <Field label="Category" optional error={errors.category}>
                  <input className="input" list={`${uid}-categories`} value={draft.category} onChange={set('category')} maxLength={50} placeholder="Technology" />
                </Field>
                <Field label="Tags" optional error={errors.tags} hint="Separate with commas">
                  <input className="input" value={draft.tags} onChange={set('tags')} placeholder="gaming, cosy" />
                </Field>
              </div>
              <datalist id={`${uid}-categories`}>
                {SUGGESTED_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              {(t === 'product' || t === 'custom') && (
                <div className="form-grid cols-2">
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
                  <Field label="Barcode" optional error={errors.barcode} hint="UPC / EAN from an in-store scan">
                    <input className="input" inputMode="numeric" value={draft.barcode} onChange={set('barcode')} placeholder="012345678905" maxLength={14} />
                  </Field>
                </div>
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
            </div>
          </details>
          {detailsExtra}
        </div>
      )}

      {tab === 'notes' && (
        <div className="stack" role="tabpanel" id={`${uid}-panel-notes`} aria-labelledby={`${uid}-tab-notes`}>
          <Field label="Private notes" optional error={errors.notes} hint="Only you (and editors) can see these — never shown on shared links.">
            <textarea className="textarea" rows={4} value={draft.notes} onChange={set('notes')} maxLength={5000} />
          </Field>
        </div>
      )}

      {extraTabs.map(
        (x) =>
          tab === x.id && (
            <div key={x.id} className="stack" role="tabpanel" id={`${uid}-panel-${x.id}`} aria-labelledby={`${uid}-tab-${x.id}`}>
              {x.panel}
            </div>
          ),
      )}
    </div>
  );
}
