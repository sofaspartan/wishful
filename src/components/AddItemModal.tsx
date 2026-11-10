import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, ImagePlus, Lightbulb, Link2, ListPlus, Plus, Sparkles, Wand2 } from 'lucide-react';
import type { Item, ItemType, Priority, UrlMetadata, WishlistSummary } from '../../shared/types';
import { PRIORITY_LABELS } from '../../shared/constants';
import { isHttpUrl } from '../../shared/schemas';
import { useMe, useSharedWishlists, useWishlists, useInvalidate } from '../lib/queries';
import { errorMessage, fieldErrors, post } from '../lib/api';
import { brand } from '../config/brand';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, FormError, FormNote } from './ui/Field';
import { Segmented } from './ui/misc';
import { useToast } from './ui/Toast';
import { ImagePicker } from './ImagePicker';
import { ItemFormFields, draftToInput, emptyDraft, mapItemErrors, validateDraft, type ItemDraft } from './ItemForm';
import type { AddItemMode, AddItemOptions } from './appActions';
import { BulkPaste, BulkReview, bulkRowErrors, bulkRowToInput, useBulkRows } from './BulkAdd';
import { CsvMapping, CsvPicker } from './CsvImport';
import { WebsiteImportForm, WebsiteImportReview, websiteListFile, type WebsiteList } from './WebsiteImport';
import { buildImport, CSV_FIELDS, guessMapping, importBatches, limitRows, type CsvField, type CsvFile } from '../lib/csvImport';
import { applyPreset, defaultFilter, detectPreset, presetCounts, type CsvPreset } from '../lib/csvPresets';
import type { Wishlist } from '../../shared/types';

interface Props {
  options: AddItemOptions | null;
  onClose: () => void;
  onCreateWishlist: (opts: { onCreated?: (w: Wishlist) => void }) => void;
}

type Step = 'start' | 'details' | 'review' | 'csv' | 'website' | 'website-review';

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
  const fetchSeq = useRef(0);
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
    setMode(m);
    setStep(m === 'idea' ? 'details' : 'start');
    setUrl('');
    setUrlError(null);
    setExtractNote(null);
    setDraft(emptyDraft(currency, m === 'idea' ? 'idea' : m === 'link' ? 'product' : 'custom'));
    setSelected(options.wishlistId ? [options.wishlistId] : []);
    setPriority('none');
    setErrors({});
    setFormError(null);
    setBulkText('');
    setBulkErrors({});
    bulk.reset();
    setCsv(null);
    setCsvDone(null);
    setWeb(null);
  }, [options, currency, bulk.reset]);

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
    if (m === 'idea') {
      setDraft((d) => ({ ...d, type: d.type === 'product' || d.type === 'custom' ? 'idea' : d.type }));
      setStep('details');
    } else {
      setStep('start');
      if (m === 'link') setDraft((d) => ({ ...d, type: d.type === 'idea' ? 'product' : d.type }));
    }
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
          <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => setStep('start')} className="hide-xs" style={{ marginRight: 'auto' }}>
            Back
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="add-item-form" loading={saving} disabled={uploading}>
          Save item
        </Button>
      </>
    ) : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 'website' || step === 'website-review' ? 'Import from a website' : 'Add an item'}
      subtitle={step === 'website' || step === 'website-review' ? 'Bring a whole wish list over from another site.' : 'Anything you want — products, experiences, ideas.'}
      footer={footer}
      size="lg"
    >
      <div className="stack">
        <Segmented
          label="How do you want to add it?"
          full
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'link', label: <><span className="hide-xs">Paste a link</span><span className="show-xs">Link</span></>, icon: <Link2 size={15} /> },
            { value: 'idea', label: <><span className="hide-xs">Write an idea</span><span className="show-xs">Idea</span></>, icon: <Lightbulb size={15} /> },
            { value: 'upload', label: <><span className="hide-xs">Upload a photo</span><span className="show-xs">Photo</span></>, icon: <ImagePlus size={15} /> },
            { value: 'bulk', label: <><span className="hide-xs">Add several</span><span className="show-xs">Several</span></>, icon: <ListPlus size={15} /> },
          ]}
        />

        {step === 'start' && mode === 'link' && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void fetchDetails();
            }}
          >
            <Field label="Product or page link" error={urlError ?? undefined} hint="We'll try to grab the name, picture and price for you.">
              <input
                className="input"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://www.example.com/product"
                value={url}
                data-autofocus
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
            </Field>
            <div className="row-wrap">
              <Button variant="primary" type="submit" loading={fetching} icon={<Wand2 size={16} />}>
                {fetching ? 'Fetching details…' : 'Fetch details'}
              </Button>
              <Button variant="ghost" onClick={skipToManual} disabled={fetching}>
                Enter details manually
              </Button>
            </div>
            <FormNote icon={<Sparkles size={16} aria-hidden />}>
              Works with most online stores. Some sites block previews — if that happens you can still save the item and fill in the details yourself.
            </FormNote>
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
                  Import from a website
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

        {step === 'start' && mode === 'upload' && (
          <div className="stack">
            <ImagePicker
              value={draft.imageUrl}
              onUploadingChange={setUploading}
              onChange={(imageUrl) => {
                setDraft((d) => ({ ...d, imageUrl }));
                if (imageUrl) setStep('details');
              }}
              label="Choose a photo"
            />
            <Button variant="ghost" onClick={() => setStep('details')} style={{ alignSelf: 'flex-start' }}>
              Continue without a photo
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
              autoFocusTitle={!draft.title}
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
