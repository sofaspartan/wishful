import type { ProfileVisibility } from './types';
import { isDiscoverableProfile } from './constants';

/** Resolve visibility for a stored user, including accounts that still have the old boolean. */
export function profileVisibilityOf(user: { profileVisibility?: ProfileVisibility; publicProfile?: boolean }): ProfileVisibility {
  if (user.profileVisibility === 'public' || user.profileVisibility === 'friends' || user.profileVisibility === 'private') {
    return user.profileVisibility;
  }
  return user.publicProfile ? 'public' : 'private';
}

/** Age from a birth year, or null when age shouldn’t be shown. */
export function ageFromBirthYear(birthYear: number | null | undefined, at: Date = new Date()): number | null {
  if (birthYear == null || birthYear < 1900 || birthYear > at.getFullYear()) return null;
  const age = at.getFullYear() - birthYear;
  return age >= 5 && age <= 120 ? age : null;
}

export { isDiscoverableProfile };
