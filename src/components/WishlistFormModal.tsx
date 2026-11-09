import { useEffect, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { VISIBILITIES, type CoverArt, type ListKind, type Visibility, type Wishlist } from '../../shared/types';
import { ACCENT_COLORS, SUGGESTED_OCCASIONS, VISIBILITY_DESCRIPTIONS, VISIBILITY_LABELS } from '../../shared/constants';
import { wishlistCreateSchema, zodFieldErrors } from '../../shared/schemas';
import { useMe, useInvalidate } from '../lib/queries';
import { errorMessage, fieldErrors, patch, post } from '../lib/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, FormError } from './ui/Field';
import { ImagePicker } from './ImagePicker';
import { CoverArtPicker } from './CoverArtPicker';
import { suggestCoverArt } from './CoverArt';
import { Segmented } from './ui/misc';
import { useToast } from './ui/Toast';

type CoverMode = 'none' | 'graphic' | 'photo';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (w: Wishlist) => void;
  /** When provided, edits this wishlist instead of creating a new one. */
  wishlist?: Wishlist;
  /** What to create (ignored when editing; a list's kind can't change). */
  kind?: ListKind;
}

/** Create or edit list details (name, description, cover, colour, occasion, visibility). Collections skip occasion and date. */
export function WishlistFormModal({ open, onClose, onSaved, wishlist, kind: createKind = 'wishlist' }: Props) {
  const kind = wishlist?.kind ?? createKind;
  const collection = kind === 'collection';
  const noun = collection ? 'collection' : 'wishlist';
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverArt, setCoverArt] = useState<CoverArt | null>(null);
  const [coverMode, setCoverMode] = useState<CoverMode>('none');
  const [artTouched, setArtTouched] = useState(false);
  const [accentColor, setAccentColor] = useState<string>(ACCENT_COLORS[0].value);
  const [occasion, setOccasion] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('unlisted');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(wishlist?.title ?? '');
    setDescription(wishlist?.description ?? '');
    setCoverImage(wishlist?.coverImage ?? null);
    setCoverArt(wishlist ? (wishlist.coverArt ?? null) : suggestCoverArt('', kind));
    setCoverMode(wishlist ? (wishlist.coverImage ? 'photo' : wishlist.coverArt ? 'graphic' : 'none') : 'graphic');
    setArtTouched(!!wishlist);
    setAccentColor(wishlist?.accentColor ?? ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)].value);
    setOccasion(wishlist?.occasion ?? '');
    setEventDate(wishlist?.eventDate ?? '');
    setVisibility(wishlist?.visibility ?? me?.preferences.defaultVisibility ?? 'unlisted');
    setErrors({});
    setFormError(null);
  }, [open, wishlist, me, kind]);

  useEffect(() => {
    if (!wishlist && !artTouched) setCoverArt(suggestCoverArt(occasion, kind));
  }, [occasion, artTouched, kind, wishlist]);

  const pickArt = (art: CoverArt) => {
    setArtTouched(true);
    setCoverArt(art);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cover = {
      coverImage: coverMode === 'photo' ? coverImage : null,
      coverArt: coverMode === 'graphic' ? coverArt : null,
    };
    const body = collection
      ? { title, description, ...cover, accentColor, visibility }
      : { title, description, ...cover, accentColor, occasion, eventDate: eventDate || null, visibility };
    const parsed = wishlistCreateSchema.safeParse(body);
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));
    setSaving(true);
    setFormError(null);
    try {
      const saved = wishlist
        ? (await patch<{ wishlist: Wishlist }>(`/api/wishlists/${wishlist.id}`, body)).wishlist
        : (await post<{ wishlist: Wishlist }>('/api/wishlists', { ...body, kind })).wishlist;
      invalidate(wishlist ? [wishlist.id] : []);
      toast.success(wishlist ? `${collection ? 'Collection' : 'Wishlist'} updated` : `Created “${saved.title}”`);
      onSaved(saved);
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={wishlist ? `Edit ${noun}` : `New ${noun}`}
      subtitle={
        wishlist
          ? undefined
          : collection
            ? 'Records, sneakers, books, plants — keep a record of the things you already have.'
            : 'A birthday, a holiday, a dream home — or just things you love.'
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="wishlist-form" loading={saving} disabled={uploading}>
            {wishlist ? 'Save changes' : `Create ${noun}`}
          </Button>
        </>
      }
    >
      <form id="wishlist-form" className="stack" onSubmit={submit} noValidate>
        <FormError message={formError} />
        <Field label="Name" error={errors.title}>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={collection ? 'Vinyl records' : 'Birthday 2027'}
            maxLength={120}
            data-autofocus
            required
          />
        </Field>
        <Field label="Description" optional error={errors.description}>
          <textarea
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A few words for the people you share it with"
            rows={2}
            maxLength={2000}
          />
        </Field>
        {!collection && (
          <div className="form-grid cols-2">
            <Field label="Occasion" optional error={errors.occasion}>
              <input
                className="input"
                list="occasion-options"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="Birthday"
                maxLength={60}
              />
            </Field>
            <Field label="Event date" optional error={errors.eventDate} hint="We'll remind you a week before.">
              <input className="input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </Field>
          </div>
        )}
        <datalist id="occasion-options">
          {SUGGESTED_OCCASIONS.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <div className="field">
          <span className="field-label" id="accent-label">
            Colour
          </span>
          <div className="swatches" role="radiogroup" aria-labelledby="accent-label">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={accentColor === c.value}
                aria-label={c.name}
                className="swatch"
                style={{ background: c.value }}
                onClick={() => setAccentColor(c.value)}
              >
                {accentColor === c.value && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">
            Cover <span className="field-optional">Optional</span>
          </span>
          <Segmented<CoverMode>
            label="Cover style"
            value={coverMode}
            onChange={(mode) => {
              setCoverMode(mode);
              if (mode === 'graphic' && !coverArt) setCoverArt(suggestCoverArt(occasion, kind));
            }}
            options={[
              { value: 'none', label: 'None' },
              { value: 'graphic', label: 'Graphic' },
              { value: 'photo', label: 'Photo' },
            ]}
          />
          {coverMode === 'graphic' && coverArt && <CoverArtPicker value={coverArt} onChange={pickArt} title={title} />}
          {coverMode === 'photo' && <ImagePicker value={coverImage} onChange={setCoverImage} onUploadingChange={setUploading} label="Add a cover image" compact />}
        </div>
        <div className="field">
          <span className="field-label" id="visibility-label">
            Who can see it
          </span>
          <div className="check-list" role="radiogroup" aria-labelledby="visibility-label">
            {VISIBILITIES.map((v) => (
              <label key={v} className="check">
                <input type="radio" name="visibility" checked={visibility === v} onChange={() => setVisibility(v)} />
                <span>
                  <strong style={{ fontWeight: 550 }}>{VISIBILITY_LABELS[v]}</strong>
                  <span className="muted text-sm" style={{ display: 'block' }}>
                    {VISIBILITY_DESCRIPTIONS[v]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
