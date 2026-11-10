import { SYNC_PROVIDER_NAMES, type ListLink, type SyncProvider } from '../../shared/types';

export const syncSourceName = (provider: SyncProvider) => SYNC_PROVIDER_NAMES[provider];

/** Where synced things are edited: "your Brickfolio sheet", "your Playshelf library". */
export const syncSourcePlace = (provider: SyncProvider) => (provider === 'playshelf' ? 'your Playshelf library' : 'your Brickfolio sheet');

/** What a linked list follows, for the owner's notice on the list. */
export function linkedListNote(link: ListLink): string {
  if (link.provider === 'playshelf') {
    return link.tab === 'wishlist'
      ? 'This list mirrors your Playshelf wishlist. Add or remove games on Playshelf (adding one to your library moves it to your game collection); your notes and purchase details stay here.'
      : 'This list mirrors your Playshelf library. Add, remove or edit games on Playshelf; your notes and purchase details stay here.';
  }
  return `This list mirrors the ${link.tab} tab of your Brickfolio sheet. Add, remove or ${link.tab === 'wishlist' ? 'move sets to full_sets' : 'edit sets'} in the sheet; your notes and purchase details stay here.`;
}
