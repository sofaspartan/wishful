import { ChevronDown, Library, List, Package, Plus } from 'lucide-react';
import { useAppActions } from './appActions';
import { buttonClass } from './ui/Button';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';

type Props = {
  /** Primary “New” on list pages, sidebar “Add”, or the mobile bottom FAB. */
  variant?: 'new' | 'add' | 'fab';
  /** Stretch to the sidebar width. */
  block?: boolean;
  align?: 'left' | 'right' | 'center';
};

/** Dropdown to create a wishlist, collection or box — and optionally add an item first. */
export function CreateMenu({ variant = 'new', block, align }: Props) {
  const { openAddItem, openCreateWishlist, openCreateBox } = useAppActions();
  const add = variant === 'add' || variant === 'fab';
  const fab = variant === 'fab';

  return (
    <Menu
      label={fab ? 'Add' : add ? 'Add' : 'Create new'}
      align={align ?? (fab ? 'center' : add ? 'left' : 'right')}
      buttonClassName={fab ? 'bottom-add' : buttonClass({ variant: 'primary', block })}
      buttonContent={
        fab ? (
          <span>
            <Plus size={22} aria-hidden />
          </span>
        ) : (
          <>
            <Plus size={17} aria-hidden />
            <span>{add ? 'Add' : 'New'}</span>
            <ChevronDown size={15} aria-hidden style={{ marginLeft: 2, opacity: 0.85 }} />
          </>
        )
      }
    >
      {add && (
        <>
          <MenuItem icon={<Plus size={16} />} onSelect={() => openAddItem()}>
            Add item
          </MenuItem>
          <MenuSeparator />
        </>
      )}
      <MenuItem icon={<List size={16} />} onSelect={() => openCreateWishlist()}>
        New wishlist
      </MenuItem>
      <MenuItem icon={<Library size={16} />} onSelect={() => openCreateWishlist({ kind: 'collection' })}>
        New collection
      </MenuItem>
      <MenuItem icon={<Package size={16} />} onSelect={() => openCreateBox()}>
        New box
      </MenuItem>
    </Menu>
  );
}
