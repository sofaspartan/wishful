import { useEffect, useState, type FormEvent } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import type { Item } from '../../shared/types';
import { useInvalidate, useWishlists } from '../lib/queries';
import { syncSourcePlace } from '../lib/syncSource';
import { del, errorMessage, fieldErrors, patch, put } from '../lib/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, FormError } from './ui/Field';
import { useConfirm } from './ui/misc';
import { useToast } from './ui/Toast';
import { ItemFormFields, draftFromItem, draftToInput, mapItemErrors, validateDraft, type ItemDraft } from './ItemForm';
import { OwnershipFields, ownershipDraft, ownershipErrors, ownershipToInput, todayDateOnly, validateOwnership, type OwnershipDraft } from './OwnershipFields';

interface Props {
  item: Item | null;
  onClose: () => void;
  /** Owner can change list memberships and delete; editors can only edit details. */
  isOwner: boolean;
  /** Opened from a collection, so ownership details are always shown. */
  inCollection?: boolean;
}

export function EditItemModal({ item, onClose, isOwner, inCollection: openedInCollection }: Props) {
  const open = Boolean(item);
  const { data: lists = [] } = useWishlists(open && isOwner);
  const invalidate = useInvalidate();
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [memberships, setMemberships] = useState<string[]>([]);
  const [hasIt, setHasIt] = useState(false);
  const [owned, setOwned] = useState<OwnershipDraft>(() => ownershipDraft(null));
  const [ownedErrors, setOwnedErrors] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!item) return;
    setDraft(draftFromItem(item));
    setMemberships(item.wishlistIds);
    setHasIt(Boolean(item.owned));
    setOwned(ownershipDraft(item.owned, { acquiredOn: todayDateOnly() }));
    setOwnedErrors({});
    setErrors({});
    setFormError(null);
  }, [item]);

  if (!item || !draft) return null;

  const synced = Boolean(item.source);
  const collectionIds = new Set(lists.filter((l) => l.kind === 'collection').map((l) => l.id));
  const inCollection = synced ? Boolean(item.owned) : Boolean(openedInCollection) || memberships.some((id) => collectionIds.has(id));
  const tracksOwnership = synced ? Boolean(item.owned) : hasIt || inCollection;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const clientErrors = synced ? {} : validateDraft(draft);
    const clientOwnedErrors = tracksOwnership ? validateOwnership(owned) : {};
    setErrors(clientErrors);
    setOwnedErrors(clientOwnedErrors);
    if (Object.keys(clientErrors).length || Object.keys(clientOwnedErrors).length) return;
    setSaving(true);
    setFormError(null);
    try {
      await patch(
        `/api/items/${item.id}`,
        synced
          ? { notes: draft.notes, owned: tracksOwnership ? ownershipToInput(owned) : undefined }
          : { ...draftToInput(draft), owned: tracksOwnership ? ownershipToInput(owned) : item.owned ? null : undefined },
      );
      const changed = isOwner && (memberships.length !== item.wishlistIds.length || memberships.some((m) => !item.wishlistIds.includes(m)));
      if (changed) await put(`/api/items/${item.id}/wishlists`, { wishlistIds: memberships });
      invalidate([...new Set([...item.wishlistIds, ...memberships])]);
      toast.success('Item updated');
      onClose();
    } catch (err) {
      setErrors(mapItemErrors(fieldErrors(err)));
      setOwnedErrors(ownershipErrors(fieldErrors(err)));
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this item?',
      message:
        item.wishlistIds.length > 0
          ? `“${item.title}” will be removed from ${item.wishlistIds.length} list${item.wishlistIds.length === 1 ? '' : 's'} and your saved items. Any reservations on it will be lost.`
          : `“${item.title}” will be permanently removed from your saved items.`,
      confirmLabel: 'Delete item',
      danger: true,
    });
    if (!ok) return;
    try {
      await del(`/api/items/${item.id}`);
      invalidate(item.wishlistIds);
      toast.success('Item deleted');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const ownLists = lists.filter((l) => !l.archivedAt || item.wishlistIds.includes(l.id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit item"
      size="lg"
      footer={
        <>
          {isOwner && !synced && (
            <Button variant="danger-ghost" icon={<Trash2 size={16} />} onClick={remove} style={{ marginRight: 'auto' }}>
              <span className="hide-xs">Delete</span>
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="edit-item-form" loading={saving} disabled={uploading}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-item-form" className="stack" onSubmit={save} noValidate>
        <FormError message={formError} />
        {synced ? (
          <>
            <div className="notice" style={{ marginBottom: 0 }}>
              <RefreshCw size={16} aria-hidden />
              <div>
                <strong>{item.title}</strong> comes from {syncSourcePlace(item.source!.provider)}.{' '}
                {item.source!.provider === 'playshelf'
                  ? 'Its name, cover, platform, tags, rating and review update from Playshelf, so change those there.'
                  : 'Its name, photos, price, theme, quantity, rating and review update from the sheet, so change those there.'}
              </div>
            </div>
            <Field label="Private notes" optional error={errors.notes} hint="Only you (and editors) can see these — never shown on shared links.">
              <textarea className="textarea" rows={2} value={draft.notes} onChange={(e) => setDraft((d) => (d ? { ...d, notes: e.target.value } : d))} maxLength={5000} />
            </Field>
          </>
        ) : (
          <ItemFormFields draft={draft} onChange={(p) => setDraft((d) => (d ? { ...d, ...p } : d))} errors={errors} onUploadingChange={setUploading} />
        )}
        {(!synced || tracksOwnership) && <hr className="divider" />}
        <div className="field">
          {synced ? (
            tracksOwnership && <span className="field-label">About yours</span>
          ) : inCollection ? (
            <span className="field-label">About yours</span>
          ) : (
            <label className="check" style={{ alignSelf: 'flex-start' }}>
              <input type="checkbox" checked={hasIt} onChange={(e) => setHasIt(e.target.checked)} />
              <span>I already have this</span>
            </label>
          )}
          {tracksOwnership && (
            <OwnershipFields
              draft={owned}
              onChange={(p) => setOwned((o) => ({ ...o, ...p }))}
              errors={ownedErrors}
              currency={draft.currency}
              showReview={!synced}
              lockQuantity={synced}
            />
          )}
        </div>
        {isOwner && ownLists.length > 0 && (
          <>
            <hr className="divider" />
            <div className="field">
              <span className="field-label" id="memberships-label">
                On these lists
              </span>
              <div className="check-list" role="group" aria-labelledby="memberships-label">
                {ownLists.map((w) => (
                  <label key={w.id} className="check" title={synced && w.link ? `Follows ${syncSourcePlace(w.link.provider)}` : undefined}>
                    <input
                      type="checkbox"
                      checked={memberships.includes(w.id)}
                      disabled={synced && Boolean(w.link)}
                      onChange={() => setMemberships((m) => (m.includes(w.id) ? m.filter((x) => x !== w.id) : [...m, w.id]))}
                    />
                    <span className="swatch-dot" style={{ background: w.accentColor }} aria-hidden />
                    <span className="truncate" style={{ flex: 1 }}>
                      {w.title}
                    </span>
                    {w.kind === 'collection' && <span className="faint text-xs">Collection</span>}
                  </label>
                ))}
              </div>
              <span className="field-hint">Changes to the details above apply everywhere this item appears.</span>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
