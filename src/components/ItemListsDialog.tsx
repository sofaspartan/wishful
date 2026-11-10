import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Item } from '../../shared/types';
import { useInvalidate, useWishlists } from '../lib/queries';
import { errorMessage, put } from '../lib/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { useAppActions } from './appActions';

/** Choose which of your wishlists an item belongs to (add to several / move between). */
export function ItemListsDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const { data: lists = [] } = useWishlists(Boolean(item));
  const invalidate = useInvalidate();
  const toast = useToast();
  const { openCreateWishlist } = useAppActions();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) setSelected(item.wishlistIds);
  }, [item]);

  if (!item) return null;
  const visible = lists.filter((l) => !l.archivedAt || item.wishlistIds.includes(l.id));

  const save = async () => {
    setSaving(true);
    try {
      await put(`/api/items/${item.id}/wishlists`, { wishlistIds: selected });
      invalidate([...new Set([...item.wishlistIds, ...selected])]);
      toast.success(selected.length ? `On ${selected.length} list${selected.length === 1 ? '' : 's'}` : 'Kept in Saved Items only');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Lists"
      subtitle={`Choose where “${item.title}” appears.`}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="stack">
        {visible.length ? (
          <div className="check-list" role="group" aria-label="Lists">
            {visible.map((w) => (
              <label key={w.id} className="check" title={item.source && w.link ? 'Follows your Brickfolio sheet' : undefined}>
                <input
                  type="checkbox"
                  checked={selected.includes(w.id)}
                  disabled={Boolean(item.source && w.link)}
                  onChange={() => setSelected((s) => (s.includes(w.id) ? s.filter((x) => x !== w.id) : [...s, w.id]))}
                />
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
          <p className="muted">You don't have any lists yet.</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus size={15} />}
          style={{ alignSelf: 'flex-start' }}
          onClick={() => openCreateWishlist({ onCreated: (w) => setSelected((s) => [...s, w.id]) })}
        >
          New wishlist
        </Button>
      </div>
    </Modal>
  );
}
