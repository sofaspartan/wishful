import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Check, PartyPopper, RefreshCw, Trash2, Undo2, X } from 'lucide-react';
import type { Item, WishlistEntry } from '../../shared/types';
import { useInvalidate, useWishlists } from '../lib/queries';
import { syncSourcePlace } from '../lib/syncSource';
import { del, errorMessage, fieldErrors, patch, put } from '../lib/api';
import { AlreadyHavePicker } from './AlreadyHavePicker';
import { FEATURE_ILLUSTRATIONS } from './ItemIllustrations';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, FormError } from './ui/Field';
import { useConfirm } from './ui/misc';
import { useToast } from './ui/Toast';
import { ItemFormFields, draftFromItem, draftToInput, mapItemErrors, validateDraft, type ItemDraft, type ItemFormExtraTab } from './ItemForm';
import { OwnershipFields, ownershipDraft, ownershipErrors, ownershipToInput, todayDateOnly, validateOwnership, type OwnershipDraft } from './OwnershipFields';

interface Props {
  item: Item | null;
  onClose: () => void;
  /** Owner can change list memberships and delete; editors can only edit details. */
  isOwner: boolean;
  /** Opened from a collection, so ownership details are always shown. */
  inCollection?: boolean;
  /**
   * When editing from a wishlist (not a collection), set-mates are stored on this
   * entry so gifters don’t buy duplicates in a series/set for this wish only.
   */
  wishlistContext?: { wishlistId: string; entry: WishlistEntry } | null;
}

export function EditItemModal({ item, onClose, isOwner, inCollection: openedInCollection, wishlistContext = null }: Props) {
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
  const [alreadyHave, setAlreadyHave] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('details');

  useEffect(() => {
    if (!item) return;
    setDraft(draftFromItem(item));
    setMemberships(item.wishlistIds);
    setHasIt(Boolean(item.owned));
    setOwned(ownershipDraft(item.owned, { acquiredOn: todayDateOnly() }));
    setAlreadyHave(wishlistContext?.entry.alreadyHaveItemIds ?? []);
    setOwnedErrors({});
    setErrors({});
    setFormError(null);
    setTab('details');
  }, [item, wishlistContext]);

  const synced = Boolean(item?.source);
  const collectionIds = useMemo(() => new Set(lists.filter((l) => l.kind === 'collection').map((l) => l.id)), [lists]);
  const inCollection = item
    ? synced
      ? Boolean(item.owned)
      : Boolean(openedInCollection) || memberships.some((id) => collectionIds.has(id))
    : Boolean(openedInCollection);
  const tracksOwnership = synced ? Boolean(item?.owned) : hasIt || inCollection;
  const ownLists = useMemo(
    () => (item ? lists.filter((l) => !l.archivedAt || item.wishlistIds.includes(l.id)) : []),
    [item, lists],
  );
  const showGotIt = Boolean(item) && isOwner && !synced && !inCollection;

  const showOwnedTab = !synced && (hasIt || inCollection);

  const extraTabs = useMemo((): ItemFormExtraTab[] => {
    if (!item || !draft || synced) return [];
    const tabs: ItemFormExtraTab[] = [];
    if (isOwner && ownLists.length > 0) {
      tabs.push({
        id: 'lists',
        label: 'Lists',
        icon: FEATURE_ILLUSTRATIONS.lists,
        before: 'notes',
        panel: (
          <div className="field">
            <span className="field-label" id="memberships-label">
              On these lists
            </span>
            <div className="check-list" role="group" aria-labelledby="memberships-label">
              {ownLists.map((w) => (
                <label key={w.id} className="check" title={w.link ? `Follows ${syncSourcePlace(w.link.provider)}` : undefined}>
                  <input
                    type="checkbox"
                    checked={memberships.includes(w.id)}
                    disabled={Boolean(w.link)}
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
            <span className="field-hint">Changes to the details apply everywhere this item appears.</span>
          </div>
        ),
      });
    }
    if (showOwnedTab) {
      tabs.push({
        id: 'owned',
        label: 'Owned',
        icon: FEATURE_ILLUSTRATIONS.collection,
        invalid: Object.keys(ownedErrors).length > 0,
        panel: (
          <div className="stack">
            <p className="field-hint" style={{ margin: 0 }}>
              Optional details for your records — when you got it, condition, rating, and review.
            </p>
            <OwnershipFields
              draft={owned}
              onChange={(p) => setOwned((o) => ({ ...o, ...p }))}
              errors={ownedErrors}
              currency={draft.currency}
              showReview
            />
          </div>
        ),
      });
    }
    return tabs;
  }, [draft, isOwner, item, memberships, ownLists, owned, ownedErrors, showOwnedTab, synced]);

  const detailsExtra = useMemo((): ReactNode => {
    if (!item || !wishlistContext) return null;
    return (
      <>
        <hr className="divider" />
        <AlreadyHavePicker excludeItemId={item.id} value={alreadyHave} onChange={setAlreadyHave} />
      </>
    );
  }, [alreadyHave, item, wishlistContext]);

  if (!item || !draft) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const clientErrors = synced ? {} : validateDraft(draft);
    const clientOwnedErrors = tracksOwnership ? validateOwnership(owned) : {};
    setErrors(clientErrors);
    setOwnedErrors(clientOwnedErrors);
    if (Object.keys(clientErrors).length || Object.keys(clientOwnedErrors).length) {
      if (Object.keys(clientOwnedErrors).length) setTab('owned');
      return;
    }
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
      if (wishlistContext) {
        const prev = wishlistContext.entry.alreadyHaveItemIds ?? [];
        const same = prev.length === alreadyHave.length && prev.every((id, i) => id === alreadyHave[i]);
        if (!same) {
          await patch(`/api/wishlists/${wishlistContext.wishlistId}/entries/${wishlistContext.entry.id}`, {
            alreadyHaveItemIds: alreadyHave,
          });
        }
      }
      invalidate([...new Set([...item.wishlistIds, ...memberships, ...(wishlistContext ? [wishlistContext.wishlistId] : [])])]);
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

  const markGotIt = () => {
    setHasIt(true);
    setOwned((o) => (o.acquiredOn ? o : { ...o, acquiredOn: todayDateOnly() }));
    setTab('owned');
  };

  const clearGotIt = () => {
    setHasIt(false);
    setTab((current) => (current === 'owned' ? 'details' : current));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit item"
      size="lg"
      footer={
        <div className="edit-item-footer">
          <Button
            variant="primary"
            type="submit"
            form="edit-item-form"
            loading={saving}
            disabled={uploading}
            icon={<Check size={16} />}
            className="edit-item-footer-save"
          >
            Save
          </Button>
          <div className="edit-item-footer-secondary">
            {isOwner && !synced && (
              <Button variant="danger-outline" icon={<Trash2 size={16} />} onClick={remove} aria-label="Delete" className="modal-footer-delete">
                <span className="hide-xs">Delete</span>
              </Button>
            )}
            {showGotIt &&
              (hasIt ? (
                <Button icon={<Undo2 size={16} />} onClick={clearGotIt} disabled={saving}>
                  Still want it
                </Button>
              ) : (
                <Button icon={<PartyPopper size={16} />} onClick={markGotIt} disabled={saving}>
                  Got it!
                </Button>
              ))}
            <Button icon={<X size={16} />} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
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
            {tracksOwnership && (
              <OwnershipFields
                draft={owned}
                onChange={(p) => setOwned((o) => ({ ...o, ...p }))}
                errors={ownedErrors}
                currency={draft.currency}
                showReview={false}
                lockQuantity
              />
            )}
            {isOwner && ownLists.length > 0 && (
              <div className="field">
                <span className="field-label" id="memberships-label-synced">
                  On these lists
                </span>
                <div className="check-list" role="group" aria-labelledby="memberships-label-synced">
                  {ownLists.map((w) => (
                    <label key={w.id} className="check" title={w.link ? `Follows ${syncSourcePlace(w.link.provider)}` : undefined}>
                      <input
                        type="checkbox"
                        checked={memberships.includes(w.id)}
                        disabled={Boolean(w.link)}
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
              </div>
            )}
          </>
        ) : (
          <ItemFormFields
            draft={draft}
            onChange={(p) => setDraft((d) => (d ? { ...d, ...p } : d))}
            errors={errors}
            onUploadingChange={setUploading}
            extraTabs={extraTabs}
            detailsExtra={detailsExtra}
            tab={tab}
            onTabChange={setTab}
          />
        )}
      </form>
    </Modal>
  );
}
