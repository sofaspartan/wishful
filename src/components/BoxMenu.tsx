import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Printer, Trash2 } from 'lucide-react';
import type { BoxSummary } from '../../shared/types';
import { useInvalidate } from '../lib/queries';
import { del, errorMessage, patch } from '../lib/api';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';
import { useConfirm } from './ui/misc';
import { useToast } from './ui/Toast';

type BoxRef = Pick<BoxSummary, 'id' | 'name' | 'archivedAt'>;

/** Shared owner actions for a box (archive, delete…). */
export function useBoxActions() {
  const invalidate = useInvalidate();
  const toast = useToast();
  const confirm = useConfirm();

  return {
    setArchived: async (box: BoxRef, archived: boolean) => {
      try {
        await patch(`/api/boxes/${box.id}`, { archived });
        invalidate([]);
        toast.success(archived ? `Archived “${box.name}”` : `Restored “${box.name}”`);
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    remove: async (box: BoxRef, after?: () => void) => {
      const ok = await confirm({
        title: `Delete “${box.name}”?`,
        message: 'The box and its QR label stop working. Packed items stay in Saved Items, unpacked.',
        confirmLabel: 'Delete box',
        danger: true,
      });
      if (!ok) return;
      try {
        await del(`/api/boxes/${box.id}`);
        invalidate([]);
        toast.success('Box deleted');
        after?.();
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
  };
}

export function BoxCardMenu({ box }: { box: BoxSummary }) {
  const navigate = useNavigate();
  const actions = useBoxActions();
  return (
    <Menu label={`Actions for ${box.name}`} icon={<MoreHorizontal size={18} />} buttonClassName="btn btn-icon btn-sm card-menu-btn">
      <MenuItem icon={<Pencil size={16} />} onSelect={() => navigate(`/app/boxes/${box.id}?edit=1`)}>
        Edit details
      </MenuItem>
      {!box.archivedAt && (
        <MenuItem icon={<Printer size={16} />} onSelect={() => navigate(`/app/boxes/labels?ids=${box.id}`)}>
          Print label
        </MenuItem>
      )}
      {box.archivedAt ? (
        <MenuItem icon={<ArchiveRestore size={16} />} onSelect={() => actions.setArchived(box, false)}>
          Restore
        </MenuItem>
      ) : (
        <MenuItem icon={<Archive size={16} />} onSelect={() => actions.setArchived(box, true)}>
          Archive
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem icon={<Trash2 size={16} />} danger onSelect={() => actions.remove(box)}>
        Delete
      </MenuItem>
    </Menu>
  );
}
