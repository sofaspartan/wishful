/**
 * Persisted document shapes. These may contain server-only secrets (password
 * hashes, claim token hashes) and must be mapped through the serializers in
 * `server/serialize.ts` before being returned to any client.
 */
import type {
  Box,
  CircleKind,
  ClaimStatus,
  CoverArt,
  Item,
  ListKind,
  PaymentMethod,
  PaymentProvider,
  PledgeRole,
  ProfileVisibility,
  SyncResult,
  UserPreferences,
  Wishlist,
} from '../shared/types';

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  /** Current account visibility. Older accounts may only have legacy `publicProfile`. */
  profileVisibility?: ProfileVisibility;
  /** @deprecated Prefer `profileVisibility`. Kept so existing blobs still load. */
  publicProfile?: boolean;
  profileCoverArt?: CoverArt | null;
  location?: string;
  birthYear?: number | null;
  /** Venmo / Cash App / PayPal.Me handles for wishlist cash funds. */
  paymentMethods?: PaymentMethod[];
  preferences: UserPreferences;
  passwordHash: string;
  /** Sessions issued before this instant are invalid (password change / reset). */
  sessionsValidAfter: string;
  /** SHA-256 of the account recovery code (see services/recoveryCode). Absent for accounts created before recovery codes. */
  recoveryCodeHash?: string;
  recoveryCodeCreatedAt?: string;
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
  /** Storage boxes, in the user's display order. */
  boxIds: string[];
}

export type ItemRecord = Item;

export type BoxRecord = Box;

/** A box's printed code. Old codes stay as revoked records so they never resolve again. */
export interface BoxCodeRecord {
  boxId: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface WishlistRecord extends Omit<Wishlist, 'kind'> {
  /** Absent on lists created before collections existed (they are wishlists); test with `isCollection`. */
  kind?: ListKind;
  /** userId → ISO time of last "collaborator edited" notification (throttling). */
  editNotices?: Record<string, string>;
  /** eventDate for which an occasion reminder has already been sent. */
  reminderSentFor?: string | null;
}

/** The two sides of a list that can be kept from seeing gift activity: whoever manages it (owner and editors), and the person it's made for. */
export type GiftSide = 'owner' | 'recipient';

export interface ClaimRecord {
  id: string;
  entryId: string;
  status: Exclude<ClaimStatus, 'available'>;
  claimantName: string;
  claimantContact: string;
  message: string;
  /** SHA-256 of the bearer token given to the claimant. Never returned. */
  tokenHash: string;
  /** Surprise Mode at the time of claiming; if true the person it was kept from (`surpriseFor`) may never see this claim. */
  surprise: boolean;
  /** Who the surprise was kept from: the owner's side, or the person the list was made for. Missing: the owner's side. */
  surpriseFor?: GiftSide;
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
  surpriseFor?: GiftSide;
  /** Reserved for future payment contributions. */
  amount: number | null;
  createdAt: string;
}

/** Honor-system cash contribution toward a list's cash fund (paid off-site via Venmo/Cash App/PayPal). */
export interface ContributionRecord {
  id: string;
  amountCents: number;
  name: string;
  message: string;
  provider: PaymentProvider;
  tokenHash: string;
  surprise: boolean;
  surpriseFor?: GiftSide;
  createdAt: string;
}

/** All gift activity for one wishlist, updated atomically via ETags. */
export interface ClaimsDoc {
  wishlistId: string;
  claims: Record<string, ClaimRecord>;
  pledges: Record<string, PledgeRecord[]>;
  /** List-level cash fund contributions (absent on older docs). */
  contributions?: ContributionRecord[];
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

/** One saved person or pet in the owner's My Circle book. */
export interface CirclePersonRecord {
  id: string;
  name: string;
  avatarUrl: string | null;
  kind: CircleKind;
  note: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Private My Circle book for one account (`circle/{userId}`). */
export interface CircleDoc {
  people: CirclePersonRecord[];
}

/** One connected browser extension. The bearer token is `wfx_{userId}.{secret}`; only SHA-256 of the secret is kept. */
export interface ExtensionTokenRecord {
  id: string;
  secretHash: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ExtensionTokensDoc {
  tokens: ExtensionTokenRecord[];
}

/** What every connected site keeps about its syncs. */
export interface SyncLinkState {
  collectionId: string | null;
  wishlistId: string | null;
  connectedAt: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastResult: SyncResult | null;
  /** Another sync holds the lock until this time. */
  syncLockUntil: string | null;
}

export interface BrickfolioLinkRecord extends SyncLinkState {
  /** Origin of the Brickfolio site, e.g. https://example.netlify.app */
  siteUrl: string;
  /** "Publish to web" CSV links for the two sheet tabs. */
  fullSetsCsvUrl: string;
  wishlistCsvUrl: string;
}

export interface PlayshelfLinkRecord extends SyncLinkState {
  /** Playshelf profile id (stays the same if the username changes). */
  profileId: string;
  username: string;
}

/** A user's connected sites. */
export interface IntegrationsDoc {
  brickfolio?: BrickfolioLinkRecord;
  playshelf?: PlayshelfLinkRecord;
}

/** Just the catalog rows a user's sheet needs, revalidated against the catalog file's ETag. */
export interface CatalogCacheRecord {
  etag: string | null;
  lastModified: string | null;
  sets: Record<string, CatalogSet>;
  /** Looked up and not in the catalog. */
  missing: string[];
  /** Sets the catalog lacks, found through Brickfolio's Brickset proxy. */
  extra?: Record<string, CatalogSet>;
  /** When Brickset last didn't know a set (retried after a day). */
  unknownCheckedAt?: Record<string, string>;
}

export interface CatalogSet {
  setNum: string;
  name: string;
  year: number | null;
  pieces: number | null;
  imageUrl: string | null;
}
