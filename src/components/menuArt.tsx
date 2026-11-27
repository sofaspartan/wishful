import type { ReactNode } from 'react';
import { FEATURE_ILLUSTRATIONS } from './ItemIllustrations';

/** Illustrated icon chip used in Add / card action menus. */
export function menuArt(art: ReactNode) {
  return (
    <span className="art-icon art-icon-tab" aria-hidden>
      {art}
    </span>
  );
}

/** Delete / remove chip — illustrated trash in a soft danger tile. */
export function menuDeleteArt() {
  return (
    <span className="art-icon art-icon-tab menu-art-danger" aria-hidden>
      {FEATURE_ILLUSTRATIONS.trash}
    </span>
  );
}

/** “Got it!” chip — party popper. */
export function menuPartyArt() {
  return menuArt(FEATURE_ILLUSTRATIONS.party);
}
