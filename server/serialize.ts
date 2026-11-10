import type { ItemOwnership, PublicItem, PublicOwnership, PublicUser, SelfUser } from '../shared/types';
import { DEFAULT_PREFERENCES } from '../shared/constants';
import type { ItemRecord, UserRecord } from './records';
import { integrationsAllowed } from './integrations/access';

export function toPublicUser(u: UserRecord): PublicUser {
  return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl };
}

export function toSelfUser(u: UserRecord): SelfUser {
  return {
    ...toPublicUser(u),
    email: u.email,
    bio: u.bio,
    publicProfile: u.publicProfile,
    preferences: {
      ...DEFAULT_PREFERENCES,
      ...u.preferences,
      defaultSettings: { ...DEFAULT_PREFERENCES.defaultSettings, ...u.preferences?.defaultSettings },
      notifications: { ...DEFAULT_PREFERENCES.notifications, ...u.preferences?.notifications },
    },
    recoveryCodeCreatedAt: u.recoveryCodeCreatedAt ?? null,
    integrations: { brickfolio: integrationsAllowed(u.email), playshelf: integrationsAllowed(u.email) },
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export const deletedUser = (id: string): PublicUser => ({
  id,
  username: 'deleted',
  displayName: 'Deleted user',
  avatarUrl: null,
});

/** What was paid for an owned item is private to the owner and editors. */
export function withoutPricePaid(owned: ItemOwnership | null | undefined): PublicOwnership | null {
  if (!owned) return null;
  const { pricePaid: _pricePaid, ...rest } = owned;
  return rest;
}

/** Strip private fields (personal notes, price paid, owner/membership ids) for anonymous viewers. */
export function toPublicItem(item: ItemRecord): PublicItem {
  const { notes: _notes, ownerId: _ownerId, wishlistIds: _wishlistIds, createdBy: _createdBy, owned, ...rest } = item;
  return { ...rest, owned: withoutPricePaid(owned) };
}
