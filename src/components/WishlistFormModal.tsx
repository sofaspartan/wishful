import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, FileText, Palette, Shapes, Users } from 'lucide-react';
import { VISIBILITIES, type CoverArt, type ListKind, type Visibility, type Wishlist } from '../../shared/types';
import { ACCENT_COLORS, SUGGESTED_OCCASIONS, VISIBILITY_DESCRIPTIONS, VISIBILITY_LABELS, peopleForList, possessiveNames } from '../../shared/constants';
import { wishlistCreateSchema, zodFieldErrors } from '../../shared/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { keys, useCircle, useFriends, useMe, useInvalidate } from '../lib/queries';
import { errorMessage, fieldErrors, patch, post } from '../lib/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, FormError } from './ui/Field';
import { ImagePicker } from './ImagePicker';
import { CoverArtPicker, CoverHeaderPreview } from './CoverArtPicker';
import { suggestCoverArt } from './CoverArt';
import { ListCardPreview } from './WishlistCard';
import { EditorLayout, PreviewBlock, firstInvalidTab, hasFieldError } from './ui/EditorLayout';
import { Segmented } from './ui/misc';
import { useToast } from './ui/Toast';
import { RecipientFields, linkedRecipients, newRecipientDraft, type RecipientDraft } from './RecipientFields';

type CoverMode = 'none' | 'graphic' | 'photo';
type ForWhom = 'me' | 'someone' | 'both';
type Tab = 'details' | 'look' | 'icon' | 'sharing';

const TAB_FIELDS: Record<Tab, readonly string[]> = {
  details: ['title', 'description', 'occasion', 'eventDate'],
  look: ['accentColor', 'coverImage', 'coverArt'],
  icon: [],
  sharing: ['recipients', 'visibility', 'settings', 'surpriseMode'],
};

function recipientDrafts(wishlist: Wishlist | undefined): RecipientDraft[] {
  const people = wishlist?.recipients ?? [];
  if (!people.length) return [newRecipientDraft()];
  return people.map((r) =>
    newRecipientDraft({
      name: r.name,
      avatarUrl: r.avatarUrl,
      userId: r.userId,
      circlePersonId: r.circlePersonId ?? null,
      saveToCircle: false,
      canEdit: wishlist!.collaborators.some((c) => c.userId === r.userId && c.role === 'editor'),
    }),
  );
}

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
  const { data: friendsOverview } = useFriends(open);
  const { data: circle = [] } = useCircle(open);
  const invalidate = useInvalidate();
  const qc = useQueryClient();
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
  const [showReviews, setShowReviews] = useState(true);
  const [forWhom, setForWhom] = useState<ForWhom>('me');
  const [recipients, setRecipients] = useState<RecipientDraft[]>(() => [newRecipientDraft()]);
  const [surprise, setSurprise] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [tab, setTab] = useState<Tab>('details');
  const latest = useRef({ wishlist, me, kind });
  latest.current = { wishlist, me, kind };

  // Only reset when the modal opens: a background refetch mid-edit must not wipe changes or jump the form.
  useEffect(() => {
    if (!open) return;
    const { wishlist, me, kind } = latest.current;
    setTab('details');
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
    setShowReviews(wishlist?.settings.showReviews ?? true);
    setForWhom(wishlist?.recipients?.length ? (wishlist.includeOwner ? 'both' : 'someone') : 'me');
    setRecipients(recipientDrafts(wishlist));
    setSurprise(wishlist?.recipients?.length ? wishlist.surpriseMode : true);
    setErrors({});
    setFormError(null);
  }, [open, wishlist?.id]);

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
    const forOthers = forWhom === 'someone' || forWhom === 'both';
    const who =
      forOthers || wishlist?.recipients?.length || wishlist?.includeOwner
        ? {
            recipients: forOthers
              ? recipients.map(({ name, avatarUrl, userId, canEdit, circlePersonId, saveToCircle, circleKind }) => ({
                  name,
                  avatarUrl,
                  userId,
                  canEdit,
                  circlePersonId,
                  saveToCircle: !circlePersonId && saveToCircle,
                  circleKind: !circlePersonId && saveToCircle ? circleKind : undefined,
                }))
              : [],
            includeOwner: forWhom === 'both',
            // Only linked friends can be kept from seeing reservations; otherwise leave Surprise Mode as it is.
            ...(forOthers && linkedRecipients(recipients).length && !collection ? { surpriseMode: surprise } : {}),
          }
        : {};
    const body = collection
      ? { title, description, ...cover, accentColor, visibility, settings: { showReviews }, ...who }
      : { title, description, ...cover, accentColor, occasion, eventDate: eventDate || null, visibility, ...who };
    const showErrors = (next: Record<string, string>) => {
      setErrors(next);
      const bad = firstInvalidTab(TAB_FIELDS, next);
      if (bad) setTab(bad);
    };
    const parsed = wishlistCreateSchema.safeParse(body);
    if (!parsed.success) return showErrors(zodFieldErrors(parsed.error));
    setSaving(true);
    setFormError(null);
    try {
      const saved = wishlist
        ? (await patch<{ wishlist: Wishlist }>(`/api/wishlists/${wishlist.id}`, body)).wishlist
        : (await post<{ wishlist: Wishlist }>('/api/wishlists', { ...body, kind })).wishlist;
      invalidate(wishlist ? [wishlist.id] : []);
      if (forOthers && recipients.some((p) => !p.circlePersonId && p.saveToCircle)) {
        void qc.invalidateQueries({ queryKey: keys.circle });
      }
      toast.success(wishlist ? `${collection ? 'Collection' : 'Wishlist'} updated` : `Created “${saved.title}”`);
      onSaved(saved);
    } catch (err) {
      showErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const friends = friendsOverview?.friends ?? [];
  const linked = linkedRecipients(recipients);
  const otherPreview = recipients
    .filter((p) => p.name.trim())
    .map((p) => ({ name: p.name.trim(), avatarUrl: p.avatarUrl ?? friends.find((f) => f.user.id === p.userId)?.user.avatarUrl ?? null, userId: p.userId }));
  const previewRecipients =
    forWhom === 'someone' || forWhom === 'both'
      ? peopleForList(otherPreview, forWhom === 'both', me ?? { displayName: 'You', avatarUrl: null, id: undefined })
      : [];
  const placeholder = collection ? 'Your collection' : 'Your wishlist';

  const details = (
    <>
      <Field label="Name" error={errors.title}>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={collection ? 'Vinyl records' : 'Birthday 2027'}
          maxLength={120}
          required
        />
      </Field>
      <Field label="Description" optional error={errors.description}>
        <textarea
          className="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A few words for the people you share it with"
          rows={3}
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
          <datalist id="occasion-options">
            {SUGGESTED_OCCASIONS.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>
      )}
    </>
  );

  const look = (
    <>
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
            if (mode !== 'graphic' && tab === 'icon') setTab('look');
          }}
          options={[
            { value: 'none', label: 'None' },
            { value: 'graphic', label: 'Graphic' },
            { value: 'photo', label: 'Photo' },
          ]}
        />
        {coverMode === 'none' && <span className="field-hint">The card uses your colour and the first letter of the name.</span>}
        {coverMode === 'graphic' && <span className="field-hint">Pick the picture itself on the Icon tab.</span>}
        {coverMode === 'graphic' && coverArt && <CoverArtPicker value={coverArt} onChange={pickArt} title={title} preview={false} part="style" />}
        {coverMode === 'photo' && <ImagePicker value={coverImage} onChange={setCoverImage} onUploadingChange={setUploading} label="Add a cover image" compact />}
      </div>
    </>
  );

  const sharing = (
    <>
      <div className="field">
        <span className="field-label">Who’s it for?</span>
        <Segmented<ForWhom>
          label="Who it's for"
          full
          value={forWhom}
          onChange={setForWhom}
          options={[
            { value: 'me', label: 'Me' },
            { value: 'someone', label: 'Someone else' },
            { value: 'both', label: 'Me + someone' },
          ]}
        />
        {forWhom === 'me' ? (
          <span className="field-hint">
            Making a {noun} for someone else, or for you and others together? Choose Someone else or Me + someone and add their names.
          </span>
        ) : (
          <>
            {forWhom === 'both' && (
              <span className="field-hint">You’ll be included, plus anyone you add below — one person or several.</span>
            )}
            <RecipientFields
              value={recipients}
              onChange={setRecipients}
              friends={friends}
              circle={circle}
              surprise={collection ? undefined : { value: surprise, onChange: setSurprise }}
              noun={noun}
              errors={errors}
              onUploadingChange={setUploading}
            />
          </>
        )}
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
        {visibility === 'friends' && forWhom !== 'me' && linked.length > 0 && (
          <span className="field-hint">
            Your friends and {linked.some((p) => p.name.trim()) ? possessiveNames(linked.map((p) => p.name)) : 'their'} friends can see it.
          </span>
        )}
      </div>
      {collection && (
        <label className="check" style={{ alignSelf: 'flex-start' }}>
          <input type="checkbox" checked={showReviews} onChange={(e) => setShowReviews(e.target.checked)} />
          <span>
            <strong style={{ fontWeight: 550 }}>Show my ratings and reviews</strong>
            <span className="muted text-sm" style={{ display: 'block' }}>
              People you share this collection with can see your stars and what you wrote.
            </span>
          </span>
        </label>
      )}
    </>
  );

  const preview = (
    <>
      <PreviewBlock caption="Card" className="editor-preview-card">
        <ListCardPreview
          list={{
            kind,
            title,
            description,
            coverImage: coverMode === 'photo' ? coverImage : null,
            coverArt: coverMode === 'graphic' ? coverArt : null,
            accentColor,
            visibility,
            occasion: collection ? '' : occasion,
            eventDate: collection ? null : eventDate || null,
          }}
          recipients={previewRecipients}
          itemCount={wishlist?.entries.length}
          placeholder={placeholder}
        />
      </PreviewBlock>
      {coverMode === 'graphic' && coverArt && (
        <PreviewBlock caption={`${collection ? 'Collection' : 'Wishlist'} page`} className="editor-preview-page">
          <CoverHeaderPreview art={coverArt} title={title} placeholder={placeholder} />
        </PreviewBlock>
      )}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      className="editor-modal"
      bodyClassName="editor-body"
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
      <form id="wishlist-form" className="editor-form" onSubmit={submit} noValidate>
        <EditorLayout<Tab>
          label={`${collection ? 'Collection' : 'Wishlist'} settings`}
          active={tab}
          onTabChange={setTab}
          previewTabs={['look', 'icon']}
          preview={preview}
          alert={<FormError message={formError} />}
          tabs={[
            { id: 'details', label: 'Details', icon: <FileText size={16} aria-hidden />, invalid: hasFieldError(TAB_FIELDS.details, errors), content: details },
            { id: 'look', label: 'Look', icon: <Palette size={16} aria-hidden />, invalid: hasFieldError(TAB_FIELDS.look, errors), content: look },
            ...(coverMode === 'graphic' && coverArt
              ? [{ id: 'icon' as const, label: 'Icon', icon: <Shapes size={16} aria-hidden />, content: <CoverArtPicker value={coverArt} onChange={pickArt} preview={false} part="icon" /> }]
              : []),
            { id: 'sharing', label: 'Sharing', icon: <Users size={16} aria-hidden />, invalid: hasFieldError(TAB_FIELDS.sharing, errors), content: sharing },
          ]}
        />
      </form>
    </Modal>
  );
}
