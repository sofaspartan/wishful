/**
 * Persisted document shapes. These may contain server-only secrets (password
 * hashes, claim token hashes) and must be mapped through the serializers in
 * `server/serialize.ts` before being returned to any client.
 */
import type { ClaimStatus, Item, ListKind, PledgeRole, UserPreferences, Wishlist } from '../shared/types';

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  publicProfile: boolean;
  preferences: UserPreferences;
  passwordHash: string;
  /** Sessions issued before this instant are invalid (password change / reset). */
  sessionsValidAfter: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface UserIndex {
  /** Owned wishlists, in the user's chosen display order. */
  wishlistIds: string[];
  /** Owned items (the user's Saved Items library). */
  itemIds: string[];
  /** Wishlists owned by others where this user is a collaborator. */
  sharedWishlistIds: string[];
  /** Uploaded image ids, so they can be removed with the account. */
  imageIds: string[];
}

export type ItemRecord = Item;

export interface WishlistRecord extends Omit<Wishlist, 'kind'> {
  /** Absent on lists created before collections existed (they are wishlists); test with `isCollection`. */
  kind?: ListKind;
  /** userId → ISO time of last "collaborator edited" notification (throttling). */
  editNotices?: Record<string, string>;
  /** eventDate for which an occasion reminder has already been sent. */
  reminderSentFor?: string | null;
}

export interface ClaimRecord {
  id: string;
  entryId: string;
  status: Exclude<ClaimStatus, 'available'>;
  claimantName: string;
  claimantContact: string;
  message: string;
  /** SHA-256 of the bearer token given to the claimant. Never returned. */
  tokenHash: string;
  /** Surprise Mode at the time of claiming; if true the owner may never see this claim. */
  surprise: boolean;
  reservedAt: string;
  expiresAt: string | null;
  purchasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PledgeRecord {
  id: string;
  entryId: string;
  name: string;
  contact: string;
  message: string;
  role: PledgeRole;
  tokenHash: string;
  surprise: boolean;
  /** Reserved for future payment contributions. */
  amount: number | null;
  createdAt: string;
}

/** All gift activity for one wishlist, updated atomically via ETags. */
export interface ClaimsDoc {
  wishlistId: string;
  claims: Record<string, ClaimRecord>;
  pledges: Record<string, PledgeRecord[]>;
}

export interface ShareRecord {
  wishlistId: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface ResetRecord {
  userId: string;
  expiresAt: string;
}

export interface InviteRecord {
  invites: Array<{ wishlistId: string; role: 'viewer' | 'editor'; invitedBy: string; createdAt: string }>;
}

/**
 * One record per pair of users (key: both ids sorted, joined by "."). This is
 * the single source of truth for friendship checks.
 */
export interface FriendshipRecord {
  users: [string, string];
  requesterId: string;
  status: 'pending' | 'accepted';
  createdAt: string;
  acceptedAt: string | null;
}

/** Ids of everyone a user has a friendship record with, for listing only. */
export interface FriendIndex {
  ids: string[];
}
