import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, FileText, Palette, QrCode, Shapes } from 'lucide-react';
import {
  BOX_MATERIALS,
  BOX_SIZES,
  type Box,
  type BoxAccess,
  type BoxDetail,
  type BoxMaterial,
  type BoxSize,
  type CoverArt,
} from '../../shared/types';
import { BOX_COLORS, BOX_MATERIAL_LABELS, BOX_SIZE_LABELS, SUGGESTED_ROOMS, defaultBoxCoverArt } from '../../shared/constants';
import { boxCreateSchema, zodFieldErrors } from '../../shared/schemas';
import { useBoxes, useInvalidate } from '../lib/queries';
import { errorMessage, fieldErrors, patch, post } from '../lib/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, FormError } from './ui/Field';
import { Segmented } from './ui/misc';
import { useToast } from './ui/Toast';
import { ColorField, CoverArtPicker, CoverHeaderPreview } from './CoverArtPicker';
import { BoxCardPreview } from './BoxVisuals';
import { EditorLayout, PreviewBlock, firstInvalidTab, hasFieldError } from './ui/EditorLayout';

type Tab = 'details' | 'look' | 'icon' | 'label';

const TAB_FIELDS: Record<Tab, readonly string[]> = {
  details: ['name', 'number', 'material', 'size', 'location', 'notes'],
  look: ['color', 'coverArt'],
  icon: [],
  label: ['room', 'fragile', 'access', 'showPrices'],
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (box: Box) => void;
  /** When provided, edits this box instead of making a new one. */
  box?: Box;
}

const ACCESS_OPTIONS: Array<{ value: BoxAccess; title: string; description: string }> = [
  { value: 'link', title: 'Anyone who scans the code', description: 'No sign-in needed. Prices, notes and where it’s kept stay hidden.' },
  { value: 'owner', title: 'Only me', description: 'Scanning asks you to sign in first.' },
];

/** Make or edit a box: what it's called and looks like, where it lives, and who can see inside by scanning its label. */
export function BoxFormModal({ open, onClose, onSaved, box }: Props) {
  const invalidate = useInvalidate();
  const toast = useToast();
  const { data: boxes } = useBoxes(open);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [color, setColor] = useState<string>(BOX_COLORS[0].value);
  const [material, setMaterial] = useState<BoxMaterial>('cardboard');
  const [size, setSize] = useState<BoxSize | 'none'>('none');
  const [location, setLocation] = useState('');
  const [room, setRoom] = useState('');
  const [fragile, setFragile] = useState(false);
  const [notes, setNotes] = useState('');
  const [coverArt, setCoverArt] = useState<CoverArt>(defaultBoxCoverArt('cardboard'));
  const [artTouched, setArtTouched] = useState(false);
  const [access, setAccess] = useState<BoxAccess>('link');
  const [showPrices, setShowPrices] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState<Tab>('details');
  const latest = useRef(box);
  latest.current = box;

  // Only reset when the modal opens: a background refetch mid-edit must not wipe changes or jump the form.
  useEffect(() => {
    if (!open) return;
    const box = latest.current;
    setTab('details');
    setName(box?.name ?? '');
    setNumber(box?.number ? String(box.number) : '');
    setColor(box?.color ?? BOX_COLORS[0].value);
    setMaterial(box?.material ?? 'cardboard');
    setSize(box?.size ?? 'none');
    setLocation(box?.location ?? '');
    setRoom(box?.room ?? '');
    setFragile(box?.fragile ?? false);
    setNotes(box?.notes ?? '');
    setCoverArt(box?.coverArt ?? defaultBoxCoverArt('cardboard'));
    setArtTouched(Boolean(box));
    setAccess(box?.access ?? 'link');
    setShowPrices(box?.showPrices ?? false);
    setErrors({});
    setFormError(null);
  }, [open, box?.id]);

  const nextNumber = useMemo(() => (boxes ?? []).reduce((n, b) => Math.max(n, b.number ?? 0), 0) + 1, [boxes]);
  const knownLocations = useMemo(() => [...new Set((boxes ?? []).map((b) => b.location).filter(Boolean))], [boxes]);
  const knownRooms = useMemo(() => [...new Set([...SUGGESTED_ROOMS, ...(boxes ?? []).map((b) => b.room).filter(Boolean)])], [boxes]);

  const pickArt = (art: CoverArt) => {
    setArtTouched(true);
    setCoverArt(art);
  };

  const pickMaterial = (m: BoxMaterial) => {
    setMaterial(m);
    if (!artTouched) setCoverArt({ ...coverArt, icon: defaultBoxCoverArt(m).icon });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const typedNumber = number.trim() ? Number(number) : null;
    const body = {
      name,
      number: box || typedNumber !== null ? typedNumber : undefined,
      color,
      material,
      size: size === 'none' ? null : size,
      location,
      room,
      fragile,
      notes,
      coverArt,
      access,
      showPrices,
    };
    const showErrors = (next: Record<string, string>) => {
      setErrors(next);
      const bad = firstInvalidTab(TAB_FIELDS, next);
      if (bad) setTab(bad);
    };
    const parsed = boxCreateSchema.safeParse(body);
    if (!parsed.success) return showErrors(zodFieldErrors(parsed.error));
    setSaving(true);
    setFormError(null);
    try {
      const saved = box ? await patch<BoxDetail>(`/api/boxes/${box.id}`, body) : await post<BoxDetail>('/api/boxes', body);
      invalidate([]);
      toast.success(box ? 'Box updated' : `Made “${saved.box.name}”`);
      onSaved(saved.box);
    } catch (err) {
      showErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const enteredNumber = Number.parseInt(number, 10);
  const previewNumber = enteredNumber > 0 ? enteredNumber : box ? null : nextNumber;

  const details = (
    <>
      <div className="form-grid box-form-name">
        <Field label="Name" error={errors.name}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Winter clothes" maxLength={80} required />
        </Field>
        <Field label="Box number" optional error={errors.number}>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={box ? '' : String(nextNumber)}
          />
        </Field>
      </div>

      <div className="form-grid cols-2">
        <Field label="Kind of box">
          <select className="select" value={material} onChange={(e) => pickMaterial(e.target.value as BoxMaterial)}>
            {BOX_MATERIALS.map((m) => (
              <option key={m} value={m}>
                {BOX_MATERIAL_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Where it’s kept" optional error={errors.location} hint="Only you see this.">
          <input
            className="input"
            list="box-locations"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Garage, shelf 2"
            maxLength={80}
          />
        </Field>
      </div>
      <datalist id="box-locations">
        {knownLocations.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>

      <div className="field">
        <span className="field-label">Size</span>
        <Segmented<BoxSize | 'none'>
          label="Box size"
          value={size}
          onChange={setSize}
          options={[{ value: 'none', label: 'Any' }, ...BOX_SIZES.map((s) => ({ value: s, label: s === 'xl' ? 'XL' : BOX_SIZE_LABELS[s] }))]}
        />
      </div>

      <Field label="Notes" optional error={errors.notes} hint="Only you see these.">
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Packed in March. Key is in the kitchen drawer."
        />
      </Field>
    </>
  );

  const look = (
    <>
      <div className="field">
        <span className="field-label" id="box-color-label">
          Box colour
        </span>
        <div className="swatches" role="radiogroup" aria-labelledby="box-color-label">
          {BOX_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={color.toLowerCase() === c.value}
              aria-label={c.name}
              title={c.name}
              className="swatch box-swatch"
              style={{ background: c.value }}
              onClick={() => setColor(c.value)}
            >
              {color.toLowerCase() === c.value && <Check size={14} />}
            </button>
          ))}
          <ColorField label="Other" value={color} onChange={setColor} />
        </div>
      </div>

      <div className="field">
        <span className="field-label">Label art</span>
        <span className="field-hint">Pick the picture itself on the Icon tab.</span>
        <CoverArtPicker value={coverArt} onChange={pickArt} title={name} placeholder="Your box" preview={false} part="style" />
      </div>
    </>
  );

  const label = (
    <>
      <fieldset className="box-form-moving">
        <legend className="field-label">Moving</legend>
        <div className="form-grid cols-2">
          <Field label="Room it goes to" optional error={errors.room} hint="Printed large on the label.">
            <input className="input" list="box-rooms" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Kitchen" maxLength={40} />
          </Field>
          <label className="check box-form-fragile">
            <input type="checkbox" checked={fragile} onChange={(e) => setFragile(e.target.checked)} />
            <span>
              <strong style={{ fontWeight: 550 }}>Fragile</strong>
              <span className="muted text-sm" style={{ display: 'block' }}>
                Adds a fragile warning to the label.
              </span>
            </span>
          </label>
        </div>
        <datalist id="box-rooms">
          {knownRooms.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </fieldset>

      <div className="field">
        <span className="field-label" id="box-access-label">
          Who can see inside by scanning
        </span>
        <div className="check-list" role="radiogroup" aria-labelledby="box-access-label">
          {ACCESS_OPTIONS.map((o) => (
            <label key={o.value} className="check">
              <input type="radio" name="box-access" checked={access === o.value} onChange={() => setAccess(o.value)} />
              <span>
                <strong style={{ fontWeight: 550 }}>{o.title}</strong>
                <span className="muted text-sm" style={{ display: 'block' }}>
                  {o.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
      {access === 'link' && (
        <label className="check" style={{ alignSelf: 'flex-start' }}>
          <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} />
          <span>
            <strong style={{ fontWeight: 550 }}>Show prices when scanned</strong>
            <span className="muted text-sm" style={{ display: 'block' }}>
              Off by default, so a label never tells a stranger what the contents are worth.
            </span>
          </span>
        </label>
      )}
    </>
  );

  const preview = (
    <>
      <PreviewBlock caption="Card" className="editor-preview-card">
        <BoxCardPreview
          box={{ name, number: previewNumber, color, coverArt, fragile, access, location, room }}
          things={box ? box.itemIds.length + box.lines.length : 0}
          placeholder="Your box"
        />
      </PreviewBlock>
      <PreviewBlock caption="Box page" className="editor-preview-page">
        <CoverHeaderPreview art={coverArt} title={name} placeholder="Your box" />
      </PreviewBlock>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      className="editor-modal"
      bodyClassName="editor-body"
      title={box ? 'Edit box' : 'New box'}
      subtitle={box ? undefined : 'Fill it with things you have, print its QR label, and scan it any time to see what’s inside.'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="box-form" loading={saving}>
            {box ? 'Save changes' : 'Make box'}
          </Button>
        </>
      }
    >
      <form id="box-form" className="editor-form" onSubmit={submit} noValidate>
        <EditorLayout<Tab>
          label="Box settings"
          active={tab}
          onTabChange={setTab}
          previewTabs={['look', 'icon']}
          preview={preview}
          alert={<FormError message={formError} />}
          tabs={[
            {
              id: 'details',
              label: 'Details',
              icon: <FileText size={16} aria-hidden />,
              invalid: hasFieldError(TAB_FIELDS.details, errors),
              content: details,
            },
            { id: 'look', label: 'Look', icon: <Palette size={16} aria-hidden />, invalid: hasFieldError(TAB_FIELDS.look, errors), content: look },
            {
              id: 'icon',
              label: 'Icon',
              icon: <Shapes size={16} aria-hidden />,
              content: <CoverArtPicker value={coverArt} onChange={pickArt} preview={false} part="icon" />,
            },
            {
              id: 'label',
              label: 'Label',
              icon: <QrCode size={16} aria-hidden />,
              invalid: hasFieldError(TAB_FIELDS.label, errors),
              content: label,
            },
          ]}
        />
      </form>
    </Modal>
  );
}
