import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Copy, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react';
import type { Wishlist, WishlistSummary } from '../../shared/types';
import { useInvalidate } from '../lib/queries';
import { del, errorMessage, patch, post } from '../lib/api';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';
import { useConfirm } from './ui/misc';
import { useToast } from './ui/Toast';

/** Shared owner actions for a wishlist (duplicate, archive, delete…). */
export function useWishlistActions() {
  const invalidate = useInvalidate();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  return {
    duplicate: async (w: Pick<WishlistSummary, 'id' | 'title'>) => {
      try {
        const { wishlist } = await post<{ wishlist: Wishlist }>(`/api/wishlists/${w.id}/duplicate`);
        invalidate([]);
        toast.success(`Created “${wishlist.title}”`, { label: 'Open', onClick: () => navigate(`/app/lists/${wishlist.id}`) });
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    setArchived: async (w: Pick<WishlistSummary, 'id' | 'title'>, archived: boolean) => {
      try {
        await patch(`/api/wishlists/${w.id}`, { archived });
        invalidate([w.id]);
        toast.success(archived ? `Archived “${w.title}”` : `Restored “${w.title}”`);
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    remove: async (w: Pick<WishlistSummary, 'id' | 'title'>, after?: () => void) => {
      const ok = await confirm({
        title: `Delete “${w.title}”?`,
        message: 'The list, its sharing link and any reservations will be removed. Items stay in Saved Items.',
        confirmLabel: 'Delete list',
        danger: true,
      });
      if (!ok) return;
      try {
        await del(`/api/wishlists/${w.id}`);
        invalidate([]);
        toast.success('List deleted');
        after?.();
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
  };
}

export function WishlistCardMenu({ wishlist: w }: { wishlist: WishlistSummary }) {
  const navigate = useNavigate();
  const actions = useWishlistActions();
  if (w.role !== 'owner') return null;
  return (
    <Menu label={`Actions for ${w.title}`} icon={<MoreHorizontal size={18} />} buttonClassName="btn btn-icon btn-sm card-menu-btn">
      <MenuItem icon={<Pencil size={16} />} onSelect={() => navigate(`/app/lists/${w.id}?edit=1`)}>
        Edit details
      </MenuItem>
      {!w.archivedAt && (
        <MenuItem icon={<Share2 size={16} />} onSelect={() => navigate(`/app/lists/${w.id}?share=1`)}>
          Share
        </MenuItem>
      )}
      <MenuItem icon={<Copy size={16} />} onSelect={() => actions.duplicate(w)}>
        Duplicate
      </MenuItem>
      {w.archivedAt ? (
        <MenuItem icon={<ArchiveRestore size={16} />} onSelect={() => actions.setArchived(w, false)}>
          Restore
        </MenuItem>
      ) : (
        <MenuItem icon={<Archive size={16} />} onSelect={() => actions.setArchived(w, true)}>
          Archive
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem icon={<Trash2 size={16} />} danger onSelect={() => actions.remove(w)}>
        Delete
      </MenuItem>
    </Menu>
  );
}
