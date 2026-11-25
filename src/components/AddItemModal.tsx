import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronDown, Globe, ImagePlus, Plus, ScanBarcode, Sparkles, Wand2 } from 'lucide-react';
import type { BarcodeProduct } from '../../shared/barcode';
import type { Item, ItemType, Priority, UrlMetadata, WishlistSummary } from '../../shared/types';
import { PRIORITY_LABELS } from '../../shared/constants';
import { isHttpUrl } from '../../shared/schemas';
import { useMe, useSharedWishlists, useWishlists, useInvalidate } from '../lib/queries';
import { api, errorMessage, fieldErrors, get, post } from '../lib/api';
import { brand } from '../config/brand';
import { prepareImage, uploadImage } from '../lib/images';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { FormError, FormNote } from './ui/Field';
import { Segmented } from './ui/misc';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';
import { useToast } from './ui/Toast';
import { BarcodeScanner } from './BarcodeScanner';
import { CameraCapture } from './CameraCapture';
import { ItemImage } from './ItemVisuals';
import { ItemFormFields, draftToInput, emptyDraft, mapItemErrors, validateDraft, type ItemDraft } from './ItemForm';
import type { AddItemMode, AddItemOptions } from './appActions';
import { BulkPaste, BulkReview, bulkRowErrors, bulkRowToInput, useBulkRows } from './BulkAdd';
import { CsvMapping, CsvPicker } from './CsvImport';
import { WebsiteImportForm, WebsiteImportReview, websiteListFile, type WebsiteList } from './WebsiteImport';
import { buildImport, CSV_FIELDS, guessMapping, importBatches, limitRows, type CsvField, type CsvFile } from '../lib/csvImport';
import { applyPreset, defaultFilter, detectPreset, presetCounts, type CsvPreset } from '../lib/csvPresets';
import type { Wishlist } from '../../shared/types';
import { FEATURE_ILLUSTRATIONS } from './ItemIllustrations';
import { formatPrice } from '../lib/format';

const ADD_MODES: { value: AddItemMode; label: string; icon: ReactNode }[] = [
  { value: 'link', label: 'Link', icon: FEATURE_ILLUSTRATIONS.store },
  { value: 'barcode', label: 'Scan', icon: FEATURE_ILLUSTRATIONS.barcode },
  { value: 'idea', label: 'Idea', icon: FEATURE_ILLUSTRATIONS.idea },
  { value: 'upload', label: 'Photo', icon: FEATURE_ILLUSTRATIONS.camera },
  { value: 'bulk', label: 'Several', icon: FEATURE_ILLUSTRATIONS.lists },
];

const CAPTURE_MODES: AddItemMode[] = ['upload', 'barcode'];
const MORE_MODES: AddItemMode[] = ['idea', 'bulk'];
const MORE_ENTRY_TYPES: { type: ItemType; label: string; icon: ReactNode }[] = [
  { type: 'product', label: 'Product', icon: FEATURE_ILLUSTRATIONS.store },
  { type: 'experience', label: 'Experience', icon: FEATURE_ILLUSTRATIONS.tickets },
  { type: 'idea', label: 'Idea', icon: FEATURE_ILLUSTRATIONS.idea },
  { type: 'gift_card', label: 'Gift card', icon: FEATURE_ILLUSTRATIONS.giftCard },
  { type: 'custom', label: 'Something else', icon: FEATURE_ILLUSTRATIONS.barcode },
];
type CaptureTab = 'photo' | 'barcode' | 'lens';

function entryTypeLabel(type: ItemType): string {
  return MORE_ENTRY_TYPES.find((t) => t.type === type)?.label ?? 'Idea';
}

function AddModeSwitch({
  mode,
  itemType,
  onChange,
  onSelectType,
}: {
  mode: AddItemMode;
  itemType: ItemType;
  onChange: (m: AddItemMode) => void;
  onSelectType: (type: ItemType) => void;
}) {
  const captureOn = CAPTURE_MODES.includes(mode);
  const moreOn = MORE_MODES.includes(mode);
  const moreLabel = mode === 'bulk' ? 'Several' : mode === 'idea' ? entryTypeLabel(itemType) : 'More';

  return (
    <>
      <div className="hide-xs">
        <Segmented
          label="How do you want to add it?"
          value={mode}
          onChange={onChange}
          role="tablist"
          className="lists-switch item-form-switch add-mode-switch"
          options={ADD_MODES.map((m) => ({
            value: m.value,
            label: m.label,
            icon: (
              <span className="art-icon art-icon-tab" aria-hidden>
                {m.icon}
              </span>
            ),
          }))}
        />
      </div>

      <div className="show-xs add-mode-mobile">
        <nav className="segmented lists-switch item-form-switch add-mode-mobile-tabs" role="tablist" aria-label="How do you want to add it?">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'link'}
            aria-current={mode === 'link' ? 'page' : undefined}
            onClick={() => onChange('link')}
          >
            <span className="art-icon art-icon-tab" aria-hidden>
              {FEATURE_ILLUSTRATIONS.store}
            </span>
            Link
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={captureOn}
            aria-current={captureOn ? 'page' : undefined}
            onClick={() => onChange(captureOn ? mode : 'upload')}
          >
            <span className="art-icon art-icon-tab" aria-hidden>
              {FEATURE_ILLUSTRATIONS.camera}
            </span>
            Photo
          </button>
        </nav>
        <Menu
          label="More ways to add"
          align="right"
          className="add-mode-more-menu"
          buttonClassName={['add-mode-more-btn', moreOn && 'is-active'].filter(Boolean).join(' ')}
          buttonContent={
            <>
              <span className="add-mode-more-label">{moreLabel}</span>
              <ChevronDown size={14} aria-hidden />
            </>
          }
        >
          {MORE_ENTRY_TYPES.map((t) => (
            <MenuItem
              key={t.type}
              icon={<span className="art-icon art-icon-tab">{t.icon}</span>}
              onSelect={() => onSelectType(t.type)}
            >
              {t.label}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem
            icon={<span className="art-icon art-icon-tab">{FEATURE_ILLUSTRATIONS.lists}</span>}
            onSelect={() => onChange('bulk')}
          >
            Several
          </MenuItem>
        </Menu>
      </div>
    </>
  );
}

type VisionCandidate = {
  url: string;
  score: number;
  metadata: UrlMetadata | null;
};

const BARCODE_SOURCE_LABELS: Record<string, string> = {
  openfoodfacts: 'Open Food Facts',
  openproductsfacts: 'Open Products Facts',
  upcitemdb: 'product catalog',
};

interface Props {
  options: AddItemOptions | null;
  onClose: () => void;
  onCreateWishlist: (opts: { onCreated?: (w: Wishlist) => void }) => void;
}

type Step = 'start' | 'details' | 'photo-matches' | 'review' | 'csv' | 'website' | 'website-review';

/**
 * The Add Item workflow: paste a link (with automatic detail extraction),
 * jot down an idea, or upload a photo — then choose destination wishlists.
 * Extraction failures never block saving; the user can always fill in details.
 */
export function AddItemModal({ options, onClose, onCreateWishlist }: Props) {
  const open = Boolean(options);
  const { data: me } = useMe();
  const { data: ownLists = [] } = useWishlists(open);
  const { data: sharedLists = [] } = useSharedWishlists(open && Boolean(options?.lockedToWishlist));
  const invalidate = useInvalidate();
  const toast = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AddItemMode>('link');
  const [captureTab, setCaptureTab] = useState<CaptureTab>('photo');
  const [step, setStep] = useState<Step>('start');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const [extractHelp, setExtractHelp] = useState({ blocked: false, noPhoto: false });
  const [draft, setDraft] = useState<ItemDraft>(() => emptyDraft());
  const [selected, setSelected] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority | 'none'>('none');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [visionCandidates, setVisionCandidates] = useState<VisionCandidate[]>([]);
  const [visionMessage, setVisionMessage] = useState<string | null>(null);
  const [barcodeMiss, setBarcodeMiss] = useState(false);
  const fetchSeq = useRef(0);
  const barcodeBusy = useRef(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({});
  const bulk = useBulkRows();
  const [csv, setCsv] = useState<{
    file: CsvFile;
    name: string;
    mapping: Array<CsvField | null>;
    preset: CsvPreset | null;
    filter: string | null;
    manual: boolean;
  } | null>(null);
  const [csvDone, setCsvDone] = useState<number | null>(null);
  const [web, setWeb] = useState<{ list: WebsiteList; excluded: Set<string> } | null>(null);

  const currency = me?.preferences.currency ?? 'USD';

  useEffect(() => {
    if (!options) return;
    const m = options.mode ?? 'link';
    const product = options.product;
    const seedUrl = (product?.url ?? options.url ?? '').trim();
    setMode(product ? 'link' : m);
    setCaptureTab(m === 'barcode' ? 'barcode' : 'photo');
    setStep(m === 'idea' || product ? 'details' : 'start');
    setUrl(seedUrl);
    setUrlError(null);
    setExtractNote(null);
    setExtractHelp({ blocked: false, noPhoto: false });
    const blank = emptyDraft(
      currency,
      m === 'idea' ? 'idea' : m === 'link' || m === 'barcode' || product || seedUrl ? 'product' : 'custom',
    );
    setDraft(
      product
        ? {
            ...blank,
            title: product.title,
            externalUrl: product.url,
            imageUrl: product.imageUrl,
            price: product.price !== null ? String(product.price) : '',
            currency: product.currency || blank.currency,
            retailer: product.retailer,
            brand: product.brand ?? '',
          }
        : seedUrl
          ? { ...blank, externalUrl: seedUrl }
          : blank,
    );
    setSelected(options.wishlistId ? [options.wishlistId] : []);
    setPriority('none');
    setErrors({});
    setFormError(null);
    setVisionCandidates([]);
    setVisionMessage(null);
    setBarcodeMiss(false);
    setBulkText('');
    setBulkErrors({});
    bulk.reset();
    setCsv(null);
    setCsvDone(null);
    setWeb(null);
  }, [options, currency, bulk.reset]);

  useEffect(() => {
    if (!options?.url || options.product) return;
    const seed = options.url.trim();
    if (!isHttpUrl(seed)) return;
    const t = window.setTimeout(() => {
      void fetchDetails(seed);
    }, 0);
    return () => window.clearTimeout(t);
    // Intentionally only when options identity changes (modal open with a URL).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchDetails reads latest setters
  }, [options]);

  const destinations = useMemo(() => {
    if (options?.lockedToWishlist && options.wishlistId) {
      const w = [...sharedLists, ...ownLists].find((l) => l.id === options.wishlistId);
      return w ? [w] : [];
    }
    return ownLists.filter((w) => !w.archivedAt);
  }, [options, ownLists, sharedLists]);

  const switchMode = (m: AddItemMode) => {
    setMode(m);
    setErrors({});
    setFormError(null);
    setExtractNote(null);
    setExtractHelp({ blocked: false, noPhoto: false });
    setBarcodeMiss(false);
    if (m === 'idea') {
      setDraft((d) => ({ ...d, type: d.type === 'product' || d.type === 'custom' ? 'idea' : d.type }));
      setStep('details');
    } else {
      setStep('start');
      if (m === 'link' || m === 'barcode' || m === 'upload') setDraft((d) => ({ ...d, type: d.type === 'idea' ? 'product' : d.type }));
      if (m === 'upload') setCaptureTab('photo');
      if (m === 'barcode') setCaptureTab('barcode');
    }
  };

  const selectEntryType = (type: ItemType) => {
    setMode('idea');
    setErrors({});
    setFormError(null);
    setExtractNote(null);
    setExtractHelp({ blocked: false, noPhoto: false });
    setBarcodeMiss(false);
    setDraft((d) => ({ ...d, type }));
    setStep('details');
  };

  const switchCaptureTab = (tab: CaptureTab) => {
    setCaptureTab(tab);
    setBarcodeMiss(false);
    setFormError(null);
    setExtractNote(null);
    setMode(tab === 'barcode' ? 'barcode' : 'upload');
  };

  const lookupFromBarcode = useCallback(async (code: string) => {
    if (barcodeBusy.current) return;
    barcodeBusy.current = true;
    setFetching(true);
    setFormError(null);
    setBarcodeMiss(false);
    try {
      const product = await get<BarcodeProduct>(`/api/barcode/${encodeURIComponent(code)}`);
      setDraft((d) => ({
        ...d,
        type: 'product',
        title: product.title || d.title,
        description: product.description || d.description,
        imageUrl: product.imageUrl || d.imageUrl,
        externalUrl: product.url || d.externalUrl,
        retailer: product.retailer || d.retailer,
        brand: product.brand || d.brand,
        price: product.price != null ? String(product.price) : d.price,
        currency: product.currency || d.currency,
        category: product.category || d.category,
        barcode: product.barcode || code,
      }));
      if (product.found) {
        setExtractNote(`Found via ${BARCODE_SOURCE_LABELS[product.source] ?? product.source}. Check the details, then save.`);
        setExtractHelp({ blocked: false, noPhoto: !product.imageUrl });
        setStep('details');
      } else {
        setBarcodeMiss(true);
        setExtractNote(product.message ?? 'No catalog match for that barcode.');
        setExtractHelp({ blocked: false, noPhoto: true });
      }
    } catch (err) {
      setDraft((d) => ({ ...d, type: 'product', barcode: code }));
      setBarcodeMiss(true);
      setExtractNote(`${errorMessage(err)} You can still name it, or try a photo.`);
      setExtractHelp({ blocked: false, noPhoto: true });
    } finally {
      barcodeBusy.current = false;
      setFetching(false);
    }
  }, []);

  const applyVisionMeta = (meta: UrlMetadata, imageUrl: string | null) => {
    setDraft((d) => ({
      ...d,
      type: d.type === 'idea' || d.type === 'custom' ? 'product' : d.type,
      title: meta.title || d.title,
      description: meta.description || d.description,
      imageUrl: meta.imageUrl || imageUrl || d.imageUrl,
      externalUrl: meta.url || d.externalUrl,
      retailer: meta.retailer || d.retailer,
      brand: meta.brand || d.brand,
      price: meta.price != null ? String(meta.price) : d.price,
      currency: meta.currency || d.currency,
    }));
  };

  /** Camera tab: keep the photo and continue to details (no Vision). */
  const attachPhoto = async (file: File) => {
    setFetching(true);
    setFormError(null);
    setVisionCandidates([]);
    setVisionMessage(null);
    try {
      const imageUrl = await uploadImage(file);
      setDraft((d) => ({ ...d, imageUrl, type: d.type === 'idea' ? 'product' : d.type }));
      setExtractNote(null);
      setExtractHelp({ blocked: false, noPhoto: false });
      setStep('details');
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setFetching(false);
    }
  };

  /** Lens tab: Google Cloud Vision Web Detection → match shortlist. */
  const identifyFromPhoto = async (file: File) => {
    setFetching(true);
    setFormError(null);
    setVisionCandidates([]);
    setVisionMessage(null);
    try {
      const [imageUrl, blob] = await Promise.all([uploadImage(file), prepareImage(file)]);
      setDraft((d) => ({ ...d, imageUrl, type: d.type === 'idea' ? 'product' : d.type }));
      const result = await api<{
        configured: boolean;
        candidates: VisionCandidate[];
        message?: string;
        suggestedTitle?: string;
      }>('/api/vision/product', {
        method: 'POST',
        raw: blob,
        contentType: blob.type || 'image/jpeg',
      });
      if (result.suggestedTitle) {
        setDraft((d) => ({ ...d, title: d.title.trim() ? d.title : result.suggestedTitle! }));
      }
      const usable = result.candidates.filter((c) => c.metadata && (c.metadata.title || c.metadata.extracted));
      if (usable.length) {
        setVisionCandidates(usable);
        setVisionMessage(result.message ?? null);
        setStep('photo-matches');
      } else {
        setExtractNote(result.message ?? 'Couldn’t identify a product — check the photo and fill in the details.');
        setExtractHelp({ blocked: false, noPhoto: false });
        setStep('details');
      }
    } catch (err) {
      setExtractNote(`${errorMessage(err)} You can still save the photo and fill in the details.`);
      setExtractHelp({ blocked: false, noPhoto: false });
      setStep('details');
    } finally {
      setFetching(false);
    }
  };

  const onCaptureFile = (file: File) => {
    void (captureTab === 'lens' ? identifyFromPhoto(file) : attachPhoto(file));
  };

  const fetchDetails = async (raw = url) => {
    const target = raw.trim();
    if (!isHttpUrl(target)) {
      setUrlError('Paste a full link starting with https://');
      return;
    }
    setUrlError(null);
    setFetching(true);
    const seq = ++fetchSeq.current;
    try {
      const meta = await post<UrlMetadata>('/api/metadata', { url: target });
      if (seq !== fetchSeq.current) return;
      setDraft((d) => ({
        ...d,
        type: d.type === 'idea' || d.type === 'custom' ? 'product' : d.type,
        title: meta.title || d.title,
        description: meta.description || d.description,
        imageUrl: meta.imageUrl || d.imageUrl,
        externalUrl: target,
        retailer: meta.retailer || d.retailer,
        brand: meta.brand || d.brand,
        price: meta.price !== null ? String(meta.price) : d.price,
        currency: meta.currency || d.currency,
      }));
      setExtractNote(meta.message ?? (meta.extracted ? null : "We couldn't read that page. Fill in the details below."));
      setExtractHelp({ blocked: Boolean(meta.blocked), noPhoto: !meta.imageUrl });
      setStep('details');
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      const fields = fieldErrors(err);
      if (fields.url) {
        setUrlError(fields.url);
      } else {
        // Network/rate-limit issues: still let the user continue manually.
        setDraft((d) => ({ ...d, externalUrl: target }));
        setExtractNote(`${errorMessage(err)} You can add the details yourself.`);
        setExtractHelp({ blocked: false, noPhoto: false });
        setStep('details');
      }
    } finally {
      if (seq === fetchSeq.current) setFetching(false);
    }
  };

  const skipToManual = () => {
    if (url.trim()) setDraft((d) => ({ ...d, externalUrl: url.trim() }));
    setExtractNote(null);
    setStep('details');
  };

  const toggleList = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const addNewList = () =>
    onCreateWishlist({
      onCreated: (w) => {
        setSelected((s) => [...s, w.id]);
        invalidate([]);
      },
    });

  const bulkFetching = bulk.rows.filter((r) => r.status === 'loading').length;

  const chosenLists = destinations.filter((w) => selected.includes(w.id));
  const intoCollection = chosenLists.some((w) => w.kind === 'collection');
  const csvSource = useMemo(() => {
    if (!csv) return null;
    const source = csv.preset && !csv.manual ? applyPreset(csv.file, csv.preset, csv.filter) : { file: csv.file, mapping: csv.mapping };
    return { ...source, file: limitRows(source.file) };
  }, [csv]);
  const csvCounts = useMemo(() => (csv?.preset ? presetCounts(csv.file, csv.preset) : {}), [csv?.file, csv?.preset]);
  const csvPlan = useMemo(() => (csvSource ? buildImport(csvSource.file, csvSource.mapping, { intoCollection }) : null), [csvSource, intoCollection]);
  const webPlan = useMemo(() => (web ? buildImport(websiteListFile(web.list, web.excluded), [...CSV_FIELDS], { intoCollection }) : null), [web, intoCollection]);
  const importPlan = step === 'website-review' ? webPlan : csvPlan;

  const saveCsv = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!importPlan?.rows.length) return;
    const batches = importBatches(importPlan.rows, priority === 'none' ? null : priority);
    const total = importPlan.rows.length;
    let done = 0;
    setSaving(true);
    setFormError(null);
    setCsvDone(0);
    try {
      for (const batch of batches) {
        await post('/api/items/bulk', { items: batch.items, wishlistIds: selected, priority: batch.priority });
        done += batch.items.length;
        setCsvDone(done);
      }
      invalidate(selected);
      const what = `${total} item${total === 1 ? '' : 's'}`;
      const target = selected[0];
      toast.success(
        chosenLists.length ? `Imported ${what} to ${chosenLists.length === 1 ? `“${chosenLists[0].title}”` : `${chosenLists.length} lists`}` : `Imported ${what} to Saved Items`,
        { label: 'View', onClick: () => navigate(target ? `/app/lists/${target}` : '/app/items') },
      );
      onClose();
    } catch (err) {
      if (done > 0) invalidate(selected);
      const rest = step === 'website-review' ? 'Untick the items already imported before trying the rest.' : 'Remove the imported rows from the file before trying the rest.';
      setFormError(done > 0 ? `Imported ${done} of ${total}, then stopped: ${errorMessage(err)} ${rest}` : errorMessage(err));
    } finally {
      setSaving(false);
      setCsvDone(null);
    }
  };

  const saveBulk = async (e?: FormEvent) => {
    e?.preventDefault();
    const rowErrors = bulkRowErrors(bulk.rows);
    setBulkErrors(rowErrors);
    if (Object.keys(rowErrors).length) {
      setFormError('Please check the highlighted items.');
      return;
    }
    const chosen = destinations.filter((w) => selected.includes(w.id));
    const namedType: ItemType = chosen.some((w) => w.kind === 'collection') ? 'custom' : 'idea';
    setSaving(true);
    setFormError(null);
    try {
      const { items } = await post<{ items: Item[] }>('/api/items/bulk', {
        items: bulk.rows.map((r) => bulkRowToInput(r, namedType)),
        wishlistIds: selected,
        priority: priority === 'none' ? null : priority,
      });
      invalidate(selected);
      const what = `${items.length} item${items.length === 1 ? '' : 's'}`;
      const target = selected[0];
      toast.success(
        chosen.length ? `Added ${what} to ${chosen.length === 1 ? `“${chosen[0].title}”` : `${chosen.length} lists`}` : `Saved ${what} to Saved Items`,
        { label: 'View', onClick: () => navigate(target ? `/app/lists/${target}` : '/app/items') },
      );
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    const clientErrors = validateDraft(draft);
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      setFormError('Please check the highlighted fields.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { item } = await post<{ item: Item }>('/api/items', {
        ...draftToInput(draft),
        wishlistIds: selected,
        priority: priority === 'none' ? null : priority,
      });
      invalidate(selected);
      const names = destinations.filter((w) => selected.includes(w.id)).map((w) => w.title);
      const target = selected[0];
      toast.success(
        names.length ? `Added to ${names.length === 1 ? `“${names[0]}”` : `${names.length} lists`}` : 'Saved to Saved Items',
        { label: 'View', onClick: () => navigate(target ? `/app/lists/${target}` : `/app/items?item=${item.id}`) },
      );
      onClose();
    } catch (err) {
      setErrors(mapItemErrors(fieldErrors(err)));
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const footer =
    step === 'csv' || step === 'website-review' ? (
      <>
        <Button
          variant="ghost"
          icon={<ArrowLeft size={16} />}
          onClick={() => setStep(step === 'website-review' ? 'website' : 'start')}
          className="hide-xs"
          style={{ marginRight: 'auto' }}
          disabled={saving}
        >
          Back
        </Button>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" form="csv-import-form" loading={saving} disabled={!importPlan?.rows.length}>
          {csvDone !== null ? `Importing ${csvDone} of ${importPlan?.rows.length ?? 0}…` : `Import ${importPlan?.rows.length ?? 0} item${importPlan?.rows.length === 1 ? '' : 's'}`}
        </Button>
      </>
    ) : step === 'website' ? (
      <>
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => setStep('start')} style={{ marginRight: 'auto' }}>
          Back
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </>
    ) : step === 'review' ? (
      <>
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => setStep('start')} className="hide-xs" style={{ marginRight: 'auto' }}>
          Back
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="bulk-add-form" loading={saving} disabled={bulkFetching > 0 || bulk.rows.length === 0}>
          {bulkFetching > 0
            ? `Fetching ${bulk.rows.length - bulkFetching + 1} of ${bulk.rows.length}…`
            : `Add ${bulk.rows.length} item${bulk.rows.length === 1 ? '' : 's'}`}
        </Button>
      </>
    ) : step === 'details' ? (
      <>
        {mode !== 'idea' && (
          <Button
            variant="ghost"
            icon={<ArrowLeft size={16} />}
            onClick={() => setStep(visionCandidates.length ? 'photo-matches' : 'start')}
            className="hide-xs"
            style={{ marginRight: 'auto' }}
          >
            Back
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="add-item-form" loading={saving} disabled={uploading}>
          Save item
        </Button>
      </>
    ) : step === 'photo-matches' ? (
      <>
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => setStep('start')} style={{ marginRight: 'auto' }}>
          Back
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </>
    ) : step === 'start' && (mode === 'barcode' || mode === 'upload') && fetching ? (
      <>
        <Button onClick={onClose} disabled>
          Cancel
        </Button>
        <Button variant="primary" loading>
          Looking up…
        </Button>
      </>
    ) : step === 'start' && mode === 'link' ? (
      <div className="add-item-footer">
        <Button
          variant="primary"
          type="submit"
          form="add-link-form"
          className="add-item-footer-fetch"
          loading={fetching}
          icon={<Wand2 size={16} />}
        >
          {fetching ? 'Fetching…' : 'Fetch'}
        </Button>
        <button type="button" className="add-item-footer-manual" onClick={skipToManual} disabled={fetching}>
          Enter details manually
          <ArrowRight size={14} aria-hidden />
        </button>
      </div>
    ) : undefined;

  const captureFullscreen = open && step === 'start';
  const websiteFlow = step === 'website' || step === 'website-review';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={websiteFlow ? 'Import from a website' : 'Add an item'}
      subtitle={websiteFlow ? 'Bring a whole wish list over from another site.' : undefined}
      icon={websiteFlow ? FEATURE_ILLUSTRATIONS.share : undefined}
      footer={footer}
      size="lg"
      className={[captureFullscreen && 'modal-capture', !websiteFlow && 'modal-add-simple'].filter(Boolean).join(' ') || undefined}
    >
      <div className="stack">
        {(step === 'start' || (step === 'details' && mode === 'idea')) && (
          <AddModeSwitch mode={mode} itemType={draft.type} onChange={switchMode} onSelectType={selectEntryType} />
        )}

        {step === 'start' && (mode === 'barcode' || mode === 'upload') && (
          <div className="capture-stage">
            <div className="capture-stage-main capture-shell">
              <FormError message={formError} />
              {fetching ? (
                <FormNote
                  icon={
                    captureTab === 'barcode' ? (
                      <ScanBarcode size={16} aria-hidden />
                    ) : captureTab === 'lens' ? (
                      <Sparkles size={16} aria-hidden />
                    ) : (
                      <ImagePlus size={16} aria-hidden />
                    )
                  }
                >
                  {captureTab === 'barcode'
                    ? 'Looking up that barcode…'
                    : captureTab === 'lens'
                      ? 'Searching with Lens…'
                      : 'Saving your photo…'}
                </FormNote>
              ) : barcodeMiss ? (
                <>
                  <FormNote icon={<Sparkles size={16} aria-hidden />}>{extractNote}</FormNote>
                  <div className="row-wrap" style={{ gap: 8 }}>
                    <Button
                      variant="primary"
                      icon={<ImagePlus size={16} />}
                      onClick={() => switchCaptureTab('photo')}
                    >
                      Try a photo
                    </Button>
                    <Button
                      onClick={() => {
                        setBarcodeMiss(false);
                        setStep('details');
                      }}
                    >
                      Enter details
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setBarcodeMiss(false);
                        setExtractNote(null);
                      }}
                    >
                      Scan again
                    </Button>
                  </div>
                </>
              ) : captureTab === 'barcode' ? (
                <BarcodeScanner active={open && step === 'start' && captureTab === 'barcode'} onDetected={(code) => void lookupFromBarcode(code)} />
              ) : (
                <CameraCapture
                  active={open && step === 'start' && (captureTab === 'photo' || captureTab === 'lens')}
                  disabled={fetching || uploading}
                  variant={captureTab === 'lens' ? 'lens' : 'camera'}
                  onCapture={onCaptureFile}
                  onUpload={onCaptureFile}
                />
              )}
            </div>
            {!fetching && !barcodeMiss && (
              <div className="capture-stage-actions">
                <nav className="segmented lists-switch item-form-switch capture-stage-tabs" role="tablist" aria-label="Capture method">
                  {(
                    [
                      { id: 'photo' as const, label: 'Camera', icon: FEATURE_ILLUSTRATIONS.camera },
                      { id: 'barcode' as const, label: 'Scan', icon: FEATURE_ILLUSTRATIONS.barcode },
                      { id: 'lens' as const, label: 'Lens', icon: FEATURE_ILLUSTRATIONS.lens },
                    ] as const
                  ).map((tab) => {
                    const selected = captureTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-current={selected ? 'page' : undefined}
                        onClick={() => switchCaptureTab(tab.id)}
                      >
                        <span className="art-icon art-icon-tab" aria-hidden>
                          {tab.icon}
                        </span>
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
                <button
                  type="button"
                  className="capture-continue-link"
                  onClick={() => setStep('details')}
                  disabled={uploading}
                >
                  {captureTab === 'lens' ? 'Continue without search' : 'Continue without image'}
                  <ArrowRight size={14} aria-hidden />
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'start' && mode === 'link' && (
          <form
            id="add-link-form"
            className="stack add-link-shell"
            onSubmit={(e) => {
              e.preventDefault();
              void fetchDetails();
            }}
          >
            <div className="add-link-hero" aria-hidden>
              <span className="add-link-hero-icon">{FEATURE_ILLUSTRATIONS.surprise}</span>
              <p className="display add-link-hero-title">Add an item</p>
              <p className="add-link-hero-sub">Anything you want — products, experiences, ideas.</p>
            </div>
            <div className="field add-link-field">
              <label className="field-label" htmlFor="add-link-url">
                Product or page URL
              </label>
              <input
                id="add-link-url"
                className="input add-link-input"
                type="url"
                inputMode="url"
                autoComplete="off"
                autoFocus
                aria-invalid={urlError ? true : undefined}
                placeholder="https://"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text').trim();
                  if (isHttpUrl(pasted)) {
                    e.preventDefault();
                    setUrl(pasted);
                    void fetchDetails(pasted);
                  }
                }}
              />
              {urlError ? (
                <span className="field-error" role="alert">
                  {urlError}
                </span>
              ) : null}
            </div>
          </form>
        )}

        {step === 'start' && mode === 'bulk' && (
          <>
            <BulkPaste
              text={bulkText}
              onChange={setBulkText}
              onSubmit={(lines) => {
                setBulkErrors({});
                setFormError(null);
                bulk.start(lines);
                setStep('review');
              }}
            />
            <div className="or-divider" role="separator">
              <span>or</span>
            </div>
            <CsvPicker
              onLoaded={(file, name) => {
                const preset = detectPreset(file.headers);
                setCsv({
                  file,
                  name,
                  mapping: guessMapping(file.headers),
                  preset,
                  filter: preset ? defaultFilter(file, preset) : null,
                  manual: false,
                });
                setFormError(null);
                setStep('csv');
              }}
              aside={
                <Button icon={<Globe size={16} />} onClick={() => setStep('website')}>
                  Import from site
                </Button>
              }
            />
          </>
        )}

        {step === 'website' && (
          <WebsiteImportForm
            onFound={(list) => {
              setWeb({ list, excluded: new Set() });
              setFormError(null);
              setStep('website-review');
            }}
          />
        )}

        {step === 'website-review' && web && webPlan && (
          <form id="csv-import-form" className="stack" onSubmit={saveCsv} noValidate>
            <FormError message={formError} />
            <WebsiteImportReview list={web.list} excluded={web.excluded} onExcluded={(excluded) => setWeb((w) => (w ? { ...w, excluded } : w))} currency={currency} />
            <hr className="divider" />
            <Destinations
              options={options}
              destinations={destinations}
              selected={selected}
              onToggle={toggleList}
              onAddList={addNewList}
              priority={priority}
              onPriority={setPriority}
              hintNone="Not on a list? They'll be kept in Saved Items."
              hintSome={
                webPlan.rows.some((r) => r.priority)
                  ? 'Every item goes on each list you pick. Items without a priority get the one below.'
                  : 'Every item goes on each list you pick.'
              }
            />
          </form>
        )}

        {step === 'csv' && csv && csvSource && csvPlan && (
          <form id="csv-import-form" className="stack" onSubmit={saveCsv} noValidate>
            <FormError message={formError} />
            <CsvMapping
              file={csvSource.file}
              fileName={csv.name}
              mapping={csvSource.mapping}
              onMapping={(mapping) => setCsv((c) => (c ? { ...c, mapping } : c))}
              plan={csvPlan}
              currency={currency}
              preset={
                csv.preset && {
                  preset: csv.preset,
                  filter: csv.filter,
                  counts: csvCounts,
                  manual: csv.manual,
                  onFilter: (filter) => setCsv((c) => (c ? { ...c, filter } : c)),
                  onManual: (manual) => setCsv((c) => (c ? { ...c, manual } : c)),
                }
              }
            />
            <hr className="divider" />
            <Destinations
              options={options}
              destinations={destinations}
              selected={selected}
              onToggle={toggleList}
              onAddList={addNewList}
              priority={priority}
              onPriority={setPriority}
              hintNone="Not on a list? They'll be kept in Saved Items."
              hintSome={
                csvPlan.rows.some((r) => r.priority)
                  ? 'Every item goes on each list you pick. Rows without a priority get the one below.'
                  : 'Every item goes on each list you pick. On a collection, everything is marked as yours.'
              }
            />
          </form>
        )}

        {step === 'review' && (
          <form id="bulk-add-form" className="stack" onSubmit={saveBulk} noValidate>
            <FormError message={formError} />
            <BulkReview
              rows={bulk.rows}
              errors={bulkErrors}
              onChange={(key, patch) => {
                bulk.setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
                setBulkErrors(({ [key]: _, ...rest }) => rest);
              }}
              onRemove={(key) => bulk.setRows((rs) => rs.filter((r) => r.key !== key))}
            />
            {bulk.rows.length === 0 && <p className="muted text-sm">Nothing left to add. Go back to paste more.</p>}
            <hr className="divider" />
            <Destinations
              options={options}
              destinations={destinations}
              selected={selected}
              onToggle={toggleList}
              onAddList={addNewList}
              priority={priority}
              onPriority={setPriority}
              hintNone="Not on a list? They'll be kept in Saved Items."
              hintSome="Every item goes on each list you pick."
            />
          </form>
        )}

        {step === 'photo-matches' && (
          <div className="stack">
            <FormError message={formError} />
            {visionMessage && <FormNote>{visionMessage}</FormNote>}
            <p className="muted text-sm" style={{ margin: 0 }}>
              Lens found these matches — pick one, or keep your photo and enter details yourself.
            </p>
            <div className="vision-matches">
              {visionCandidates.map((c) => {
                const meta = c.metadata!;
                const price = formatPrice(meta.price, meta.currency || draft.currency);
                return (
                  <button
                    key={c.url}
                    type="button"
                    className="vision-match"
                    onClick={() => {
                      applyVisionMeta(meta, draft.imageUrl);
                      setExtractNote('Matched from your photo. Check the details, then save.');
                      setExtractHelp({ blocked: false, noPhoto: !meta.imageUrl && !draft.imageUrl });
                      setStep('details');
                    }}
                  >
                    <span className="vision-match-thumb" aria-hidden>
                      <ItemImage src={meta.imageUrl || draft.imageUrl} type="product" iconSize={18} />
                    </span>
                    <span className="vision-match-body">
                      <strong className="clamp-2">{meta.title || meta.url}</strong>
                      <span className="muted text-xs truncate">
                        {[meta.retailer, price].filter(Boolean).join(' · ') || meta.url}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setExtractNote('Keeping your photo — add a name and any other details.');
                setStep('details');
              }}
              style={{ alignSelf: 'flex-start' }}
            >
              Use photo only
            </Button>
          </div>
        )}

        {step === 'details' && (
          <form id="add-item-form" className="stack" onSubmit={save} noValidate>
            {extractNote && (
              <FormNote>
                <p>{extractNote}</p>
                {extractHelp.noPhoto && !draft.imageUrl && (
                  <p className="text-sm muted">
                    For the photo, right-click it on the store's page, choose <b>Copy Image Address</b>, then paste it under <b>Use an image link instead</b>.
                  </p>
                )}
                {extractHelp.blocked && (
                  <p className="text-sm muted">
                    On a computer, the{' '}
                    <a href="/extension" target="_blank" rel="noreferrer">
                      {brand.name} browser extension
                    </a>{' '}
                    saves from stores like this in one click.
                  </p>
                )}
              </FormNote>
            )}
            <FormError message={formError} />
            <ItemFormFields
              draft={draft}
              onChange={(p) => setDraft((d) => ({ ...d, ...p }))}
              errors={errors}
              onUploadingChange={setUploading}
              typePickerClassName="hide-xs"
            />

            <hr className="divider" />

            <Destinations
              options={options}
              destinations={destinations}
              selected={selected}
              onToggle={toggleList}
              onAddList={addNewList}
              priority={priority}
              onPriority={setPriority}
              hintNone="Not on a list? No problem — it will be kept in Saved Items."
              hintSome="The same item can live on several lists; edit it once and it updates everywhere."
            />
          </form>
        )}
      </div>
    </Modal>
  );
}

function Destinations({
  options,
  destinations,
  selected,
  onToggle,
  onAddList,
  priority,
  onPriority,
  hintNone,
  hintSome,
}: {
  options: AddItemOptions | null;
  destinations: WishlistSummary[];
  selected: string[];
  onToggle: (id: string) => void;
  onAddList: () => void;
  priority: Priority | 'none';
  onPriority: (p: Priority | 'none') => void;
  hintNone: string;
  hintSome: string;
}) {
  return (
    <>
      <div className="field">
        <div className="row">
          <span className="field-label" id="dest-label">
            {options?.lockedToWishlist ? 'Adding to' : 'Add to lists'}
          </span>
          <div className="spacer" />
          {!options?.lockedToWishlist && (
            <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={onAddList}>
              New wishlist
            </Button>
          )}
        </div>
        {destinations.length > 0 ? (
          <div className="check-list" role="group" aria-labelledby="dest-label">
            {destinations.map((w) => (
              <label key={w.id} className="check">
                <input type="checkbox" checked={selected.includes(w.id)} onChange={() => onToggle(w.id)} disabled={options?.lockedToWishlist} />
                <span className="swatch-dot" style={{ background: w.accentColor }} aria-hidden />
                <span className="truncate" style={{ flex: 1 }}>
                  {w.title}
                </span>
                {w.kind === 'collection' && <span className="faint text-xs">Collection ·</span>}
                <span className="faint text-xs">{w.itemCount}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="muted text-sm">You don't have any lists yet. Create one, or just keep things in Saved Items.</p>
        )}
        <span className="field-hint">{selected.length === 0 ? hintNone : hintSome}</span>
      </div>

      {selected.length > 0 && (
        <div className="field">
          <span className="field-label">Priority</span>
          <Segmented
            label="Priority"
            value={priority}
            onChange={onPriority}
            options={[
              { value: 'none', label: 'None' },
              { value: 'must_have', label: PRIORITY_LABELS.must_have },
              { value: 'really_want', label: PRIORITY_LABELS.really_want },
              { value: 'interested', label: PRIORITY_LABELS.interested },
            ]}
          />
        </div>
      )}
    </>
  );
}
