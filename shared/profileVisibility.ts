import type { ProfileVisibility } from './types';
import { isDiscoverableProfile } from './constants';

/** Resolve visibility for a stored user, including accounts that still have the old boolean. */
export function profileVisibilityOf(user: { profileVisibility?: ProfileVisibility; publicProfile?: boolean }): ProfileVisibility {
  if (user.profileVisibility === 'public' || user.profileVisibility === 'friends' || user.profileVisibility === 'private') {
    return user.profileVisibility;
  }
  return user.publicProfile ? 'public' : 'private';
}

export { isDiscoverableProfile };
