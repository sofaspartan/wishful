import { createContext, useContext } from 'react';
import type { ListKind, Wishlist } from '../../shared/types';

export type AddItemMode = 'link' | 'idea' | 'upload' | 'bulk';

export interface AddItemOptions {
  mode?: AddItemMode;
  /** Pre-select (and, for shared lists, lock) a destination wishlist. */
  wishlistId?: string;
  lockedToWishlist?: boolean;
}

export interface CreateListOptions {
  kind?: ListKind;
  onCreated?: (w: Wishlist) => void;
}

export interface AppActions {
  openAddItem: (opts?: AddItemOptions) => void;
  openCreateWishlist: (opts?: CreateListOptions) => void;
  openSearch: () => void;
}

export const AppActionsContext = createContext<AppActions | null>(null);

export function useAppActions(): AppActions {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error('useAppActions must be used within AppLayout');
  return ctx;
}
