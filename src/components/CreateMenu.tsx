import type { ReactNode } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useAppActions } from './appActions';
import { FEATURE_ILLUSTRATIONS } from './ItemIllustrations';
import { buttonClass } from './ui/Button';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';

type Props = {
  /** Primary “Add” on list pages, sidebar “Add”, or the mobile bottom FAB. */
  variant?: 'new' | 'add' | 'fab';
  /** Stretch to the sidebar width. */
  block?: boolean;
  align?: 'left' | 'right' | 'center';
};

function tabArt(art: ReactNode) {
  return (
    <span className="art-icon art-icon-tab" aria-hidden>
      {art}
    </span>
  );
}

/** Dropdown to create a wishlist, collection or box — and optionally add an item first. */
export function CreateMenu({ variant = 'new', block, align }: Props) {
  const { openAddItem, openCreateWishlist, openCreateBox } = useAppActions();
  const fab = variant === 'fab';
  const add = variant === 'add' || fab;

  return (
    <Menu
      label="Add"
      align={align ?? (fab ? 'center' : add ? 'left' : 'right')}
      className={fab ? 'bottom-add-menu' : undefined}
      buttonClassName={fab ? 'bottom-add' : buttonClass({ variant: 'primary', block })}
      buttonContent={
        fab ? (
          <span>
            <Plus size={22} aria-hidden />
          </span>
        ) : (
          <>
            <Plus size={17} aria-hidden />
            <span>Add</span>
            <ChevronDown size={15} aria-hidden style={{ marginLeft: 2, opacity: 0.85 }} />
          </>
        )
      }
    >
      <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.store)} onSelect={() => openAddItem()}>
        Add item
      </MenuItem>
      <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.barcode)} onSelect={() => openAddItem({ mode: 'barcode' })}>
        Scan barcode
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.lists)} onSelect={() => openCreateWishlist()}>
        New wishlist
      </MenuItem>
      <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.collection)} onSelect={() => openCreateWishlist({ kind: 'collection' })}>
        New collection
      </MenuItem>
      <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.tasks)} onSelect={() => openCreateWishlist({ kind: 'list' })}>
        New list / checklist
      </MenuItem>
      <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.boxes)} onSelect={() => openCreateBox()}>
        New box
      </MenuItem>
    </Menu>
  );
}
