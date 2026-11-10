import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import type { Item } from '../../shared/types';
import { useInvalidate, useWishlists } from '../lib/queries';
import { errorMessage, fieldErrors, post } from '../lib/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, FormError } from './ui/Field';
import { useToast } from './ui/Toast';
import { OwnershipFields, ownershipDraft, ownershipErrors, ownershipToInput, todayDateOnly, validateOwnership, type OwnershipDraft } from './OwnershipFields';

interface Props {
  item: Item | null;
  /** The wishlist it's being checked off from, offered for removal. */
  fromWishlist?: { id: string; title: string };
  onClose: () => void;
}

const NEW = '__new__';

/** Mark a wished-for item as owned and file it in a collection. */
export function GotItDialog({ item, fromWishlist, onClose }: Props) {
  const open = Boolean(item);
  const { data: lists = [] } = useWishlists(open);
  const collections = lists.filter((l) => l.kind === 'collection' && !l.archivedAt);
  const invalidate = useInvalidate();
  const toast = useToast();
  const navigate = useNavigate();
  const [picked, setPicked] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [remove, setRemove] = useState(true);
  const [owned, setOwned] = useState<OwnershipDraft>(() => ownershipDraft(null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setOwned(ownershipDraft(item.owned, { acquiredOn: todayDateOnly() }));
    setPicked('');
    setRemove(true);
    setNewTitle('');
    setErrors({});
    setFormError(null);
  }, [item]);

  if (!item) return null;

  const target = picked || collections[0]?.id || NEW;
  const creating = target === NEW;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clientErrors = validateOwnership(owned);
    if (creating && !newTitle.trim()) clientErrors.newCollectionTitle = 'Give it a name';
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;
    setSaving(true);
    setFormError(null);
    try {
      const { collectionId } = await post<{ item: Item; collectionId: string }>(`/api/items/${item.id}/got-it`, {
        ...(creating ? { newCollectionTitle: newTitle.trim() } : { collectionId: target }),
        removeFromWishlistId: fromWishlist && remove ? fromWishlist.id : undefined,
        owned: ownershipToInput(owned),
      });
      invalidate([...item.wishlistIds, collectionId]);
      const name = creating ? newTitle.trim() : (collections.find((c) => c.id === target)?.title ?? 'your collection');
      toast.success(`Added “${item.title}” to ${name}`, { label: 'View', onClick: () => navigate(`/app/lists/${collectionId}`) });
      onClose();
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors({ ...ownershipErrors(fields), ...(fields.newCollectionTitle ? { newCollectionTitle: fields.newCollectionTitle } : {}) });
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="row" style={{ gap: 8 }}>
          <PartyPopper size={20} aria-hidden /> Got it!
        </span>
      }
      subtitle={`Move “${item.title}” into a collection of things you have.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="got-it-form" loading={saving}>
            Add to collection
          </Button>
        </>
      }
    >
      <form id="got-it-form" className="stack" onSubmit={submit} noValidate>
        <FormError message={formError} />
        <div className="field">
          <span className="field-label" id="got-it-target">
            Collection
          </span>
          <div className="check-list" role="radiogroup" aria-labelledby="got-it-target">
            {collections.map((c) => (
              <label key={c.id} className="check">
                <input type="radio" name="got-it-target" checked={target === c.id} onChange={() => setPicked(c.id)} />
                <span className="swatch-dot" style={{ background: c.accentColor }} aria-hidden />
                <span className="truncate" style={{ flex: 1 }}>
                  {c.title}
                </span>
                <span className="faint text-xs">
                  {c.itemCount} item{c.itemCount === 1 ? '' : 's'}
                </span>
              </label>
            ))}
            <label className="check">
              <input type="radio" name="got-it-target" checked={creating} onChange={() => setPicked(NEW)} />
              <span style={{ flex: 1 }}>{collections.length ? 'A new collection' : 'Start a new collection'}</span>
            </label>
          </div>
        </div>
        {creating && (
          <Field label="Collection name" error={errors.newCollectionTitle} hint="It starts out private — you can share it later.">
            <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Things I love" maxLength={120} data-autofocus />
          </Field>
        )}
        {fromWishlist && (
          <label className="check" style={{ alignSelf: 'flex-start' }}>
            <input type="checkbox" checked={remove} onChange={(e) => setRemove(e.target.checked)} />
            <span>Take it off “{fromWishlist.title}”</span>
          </label>
        )}
        <hr className="divider" />
        <OwnershipFields draft={owned} onChange={(p) => setOwned((o) => ({ ...o, ...p }))} errors={errors} currency={item.currency} showReview={false} />
      </form>
    </Modal>
  );
}
