/**
 * Domain types shared between the API (server/) and the web client (src/).
 * These describe the *API contract* — server-only fields such as password
 * hashes or claim token hashes never appear here.
 */

export const ITEM_TYPES = ['product', 'experience', 'idea', 'gift_card', 'custom'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const PRIORITIES = ['must_have', 'really_want', 'interested'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** `priority`: must-haves and really-wants first, in their own sections. `custom`: exactly the dragged order. */
export const ITEM_ORDERS = ['priority', 'custom'] as const;
export type ItemOrder = (typeof ITEM_ORDERS)[number];

export const VISIBILITIES = ['private', 'friends', 'unlisted', 'public'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const COLLABORATOR_ROLES = ['viewer', 'editor'] as const;
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];
export type AccessRole = 'owner' | CollaboratorRole;

export type ClaimStatus = 'available' | 'reserved' | 'purchased';

/** Wishlists hold things you want (and support gifting); collections chronicle things you already have. */
export const LIST_KINDS = ['wishlist', 'collection'] as const;
export type ListKind = (typeof LIST_KINDS)[number];

/** Illustrated cover graphics: a hand-drawn icon on a decorative backdrop, an alternative to a cover photo. */
export const COVER_ICONS = [
  'wishlist',
  'collection',
  'sparkles',
  'chest',
  'tree',
  'snowflake',
  'holly',
  'snowman',
  'ornament',
  'candy-cane',
  'pumpkin',
  'leaf',
  'sun',
  'flower',
  'umbrella',
  'ice-cream',
  'watermelon',
  'acorn',
  'heart',
  'cake',
  'balloon',
  'grad-cap',
  'ring',
  'house',
  'star',
  'suitcase',
  'gift',
  'bag',
  'camera',
  'headphones',
  'sneaker',
  'watch',
  'sweater',
  'plant',
  'book',
  'mug',
  'record',
  'brick',
  'idea',
  'plane',
] as const;
export type CoverIcon = (typeof COVER_ICONS)[number];

export const COVER_BACKDROPS = [
  'sky',
  'blush',
  'mint',
  'lilac',
  'sunset',
  'night',
  'snow',
  'confetti',
  'spring',
  'summer',
  'autumn',
  'hearts',
] as const;
export type CoverBackdrop = (typeof COVER_BACKDROPS)[number];

export const COVER_FRAME_SHAPES = ['none', 'rounded', 'circle', 'cloud'] as const;
export type CoverFrameShape = (typeof COVER_FRAME_SHAPES)[number];
export const COVER_FRAME_FILLS = ['solid', 'glass'] as const;
export type CoverFrameFill = (typeof COVER_FRAME_FILLS)[number];

/** How the icon sits in the list header's avatar slot. */
export interface CoverFrame {
  shape: CoverFrameShape;
  fill: CoverFrameFill;
  /** #rrggbb */
  color: string;
}

export interface CoverArt {
  icon: CoverIcon;
  backdrop: CoverBackdrop;
  /** Missing on older lists: a frosted white rounded tile. */
  frame?: CoverFrame;
}

export const ACQUIRED_VIA = ['bought', 'gift', 'other'] as const;
export type AcquiredVia = (typeof ACQUIRED_VIA)[number];

export const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'worn'] as const;
export type Condition = (typeof CONDITIONS)[number];

/** Details about an item its owner already has. */
export interface ItemOwnership {
  /** ISO date (YYYY-MM-DD) */
  acquiredOn: string | null;
  acquiredVia: AcquiredVia | null;
  /** Private: only the owner and editors see what was paid. */
  pricePaid: number | null;
  condition: Condition | null;
  quantity: number;
  /** 1–5 stars. Absent on items saved before reviews existed. */
  rating?: number | null;
  review?: string;
}

export type PublicOwnership = Omit<ItemOwnership, 'pricePaid'>;

export interface WishlistSettings {
  /** Visitors may reserve items. */
  allowClaims: boolean;
  /** Visitors may mark items as purchased. */
  allowMarkPurchased: boolean;
  /** Reserved items stay visible to visitors (otherwise hidden from the list). */
  showReserved: boolean;
  /** Purchased items stay visible to visitors (otherwise hidden from the list). */
  showPurchased: boolean;
  /** Visitors may attach a message to claims and group-gift pledges. */
  allowMessages: boolean;
  /** Item priorities are shown — on the list itself and on the shared page. */
  showPriorities: boolean;
  /** How items are arranged, for the owner and visitors alike. Missing on older lists: `priority`. */
  itemOrder?: ItemOrder;
  /** Days before an un-purchased reservation lapses. 0 = never. */
  reservationDays: number;
  /** Collections: ratings and reviews appear on the shared page. Missing: shown. */
  showReviews?: boolean;
}

export interface NotificationPreferences {
  emailSharing: boolean;
  emailCollaboratorEdits: boolean;
  emailOccasionReminders: boolean;
  /** Future-ready: stored but price tracking is not implemented yet. */
  priceAlerts: boolean;
}

export interface UserPreferences {
  defaultVisibility: Visibility;
  defaultSurpriseMode: boolean;
  defaultSettings: WishlistSettings;
  notifications: NotificationPreferences;
  currency: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface SelfUser extends PublicUser {
  email: string;
  bio: string;
  publicProfile: boolean;
  preferences: UserPreferences;
  /** When the current recovery code was made; null if the account has none yet. */
  recoveryCodeCreatedAt: string | null;
  /** Site integrations this account may connect (enabled per account on the server). */
  integrations: { brickfolio: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface ItemMetadata {
  // product
  size?: string;
  color?: string;
  model?: string;
  variant?: string;
  // experience
  location?: string;
  venue?: string;
  timeframe?: string;
  bookingUrl?: string;
  // gift card / contribution
  suggestedAmount?: number;
  instructions?: string;
  // idea
  budget?: number;
}

export interface Item {
  id: string;
  ownerId: string;
  type: ItemType;
  title: string;
  description: string;
  imageUrl: string | null;
  externalUrl: string | null;
  retailer: string;
  brand: string;
  price: number | null;
  currency: string;
  category: string;
  tags: string[];
  /** Private notes — never exposed on shared pages. */
  notes: string;
  metadata: ItemMetadata;
  /** Set once the owner has it (adding to a collection does this). Absent on items saved before collections existed. */
  owned?: ItemOwnership | null;
  /** Kept in sync from another site; the synced fields are edited there, not here. */
  source?: ItemSource | null;
  /** Wishlists (owned by `ownerId`) that contain this item. */
  wishlistIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const SYNC_PROVIDERS = ['brickfolio'] as const;
export type SyncProvider = (typeof SYNC_PROVIDERS)[number];

export interface ItemSource {
  provider: SyncProvider;
  /** The item's id at the source, e.g. a LEGO set number. */
  key: string;
  /** More photos from the source, besides `imageUrl`. */
  gallery: string[];
  syncedAt: string;
}

/** A list mirrored from one tab of a synced source. */
export interface ListLink {
  provider: SyncProvider;
  tab: 'full_sets' | 'wishlist';
}

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  /** Moved from the wishlist tab to the collection tab ("got it"). */
  moved: number;
  /** Set numbers Brickfolio's catalog doesn't know yet (shown with basic details). */
  notInCatalog: string[];
}

/** The Brickfolio connection as shown in Settings. */
export interface BrickfolioStatus {
  connected: boolean;
  siteUrl: string;
  fullSetsCsvUrl: string;
  wishlistCsvUrl: string;
  collectionId: string | null;
  wishlistId: string | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastResult: SyncResult | null;
}

/** The per-wishlist relationship for an item ("wishlist item"). */
export interface WishlistEntry {
  id: string;
  itemId: string;
  priority: Priority | null;
  /** Note shown to gift-givers on this wishlist (e.g. "size M please"). */
  customNotes: string;
  groupGift: boolean;
  groupGiftNote: string;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Collaborator {
  userId: string;
  role: CollaboratorRole;
  addedAt: string;
  user?: PublicUser;
}

export interface PendingInvite {
  email: string;
  role: CollaboratorRole;
  createdAt: string;
}

export interface Wishlist {
  id: string;
  ownerId: string;
  /** Fixed at creation. Collections have no gifting (claims, pledges, Surprise Mode, event dates). */
  kind: ListKind;
  title: string;
  description: string;
  coverImage: string | null;
  /** Shown when there's no cover photo. Missing on lists created before cover graphics existed. */
  coverArt?: CoverArt | null;
  accentColor: string;
  visibility: Visibility;
  occasion: string;
  /** ISO date (YYYY-MM-DD) */
  eventDate: string | null;
  shareToken: string | null;
  surpriseMode: boolean;
  settings: WishlistSettings;
  archivedAt: string | null;
  /** Mirrored from a synced source (e.g. a Brickfolio sheet tab). */
  link?: ListLink | null;
  createdAt: string;
  updatedAt: string;
  entries: WishlistEntry[];
  collaborators: Collaborator[];
  pendingInvites: PendingInvite[];
}

export interface WishlistSummary {
  id: string;
  ownerId: string;
  kind: ListKind;
  title: string;
  description: string;
  coverImage: string | null;
  coverArt: CoverArt | null;
  accentColor: string;
  visibility: Visibility;
  occasion: string;
  eventDate: string | null;
  shareToken: string | null;
  surpriseMode: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  collaboratorCount: number;
  role: AccessRole;
  owner: PublicUser;
  link: ListLink | null;
  /** Up to four item image URLs for card mosaics. */
  previewImages: string[];
}

/** Claim information visible to the owner/collaborators (only outside Surprise Mode). */
export interface OwnerClaimView {
  entryId: string;
  status: Exclude<ClaimStatus, 'available'>;
  claimantName: string;
  message: string;
  reservedAt: string;
  expiresAt: string | null;
  purchasedAt: string | null;
}

export interface OwnerPledgeView {
  entryId: string;
  name: string;
  message: string;
  role: PledgeRole;
  createdAt: string;
}

export interface WishlistDetail {
  wishlist: Wishlist;
  items: Record<string, Item>;
  role: AccessRole;
  owner: PublicUser;
  /** `null` when gift activity is hidden from this viewer (Surprise Mode). */
  claims: OwnerClaimView[] | null;
  pledges: OwnerPledgeView[] | null;
}

export type PledgeRole = 'coordinator' | 'contributor';

export interface PublicPledge {
  id: string;
  name: string;
  message: string;
  role: PledgeRole;
  createdAt: string;
}

export interface PublicClaim {
  id: string;
  name: string;
  message: string;
  reservedAt: string;
  expiresAt: string | null;
  purchasedAt: string | null;
}

export type PublicItem = Omit<Item, 'notes' | 'ownerId' | 'wishlistIds' | 'createdBy' | 'owned'> & { owned?: PublicOwnership | null };

export interface PublicEntry {
  id: string;
  priority: Priority | null;
  customNotes: string;
  groupGift: boolean;
  groupGiftNote: string;
  item: PublicItem;
  /** `null` when claim state is hidden from this viewer. */
  status: ClaimStatus | null;
  claim: PublicClaim | null;
  pledges: PublicPledge[];
}

export interface PublicWishlistView {
  wishlist: {
    id: string;
    kind: ListKind;
    title: string;
    description: string;
    coverImage: string | null;
    coverArt: CoverArt | null;
    accentColor: string;
    occasion: string;
    eventDate: string | null;
    visibility: Visibility;
    surpriseMode: boolean;
    settings: WishlistSettings;
    updatedAt: string;
  };
  owner: PublicUser & { bio: string };
  entries: PublicEntry[];
  viewer: {
    /** The signed-in viewer owns (or edits) this list. */
    isOwner: boolean;
    /** Claim state has been withheld from this viewer. */
    claimsHidden: boolean;
  };
}

export interface PublicProfileView {
  user: PublicUser & { bio: string };
  wishlists: Array<{
    kind: ListKind;
    title: string;
    description: string;
    coverImage: string | null;
    coverArt: CoverArt | null;
    accentColor: string;
    occasion: string;
    eventDate: string | null;
    shareToken: string;
    itemCount: number;
    updatedAt: string;
  }>;
}

export interface FriendSummary {
  user: PublicUser;
  since: string;
}

export interface FriendRequestView {
  user: PublicUser;
  createdAt: string;
}

export interface FriendsOverview {
  friends: FriendSummary[];
  incoming: FriendRequestView[];
  outgoing: FriendRequestView[];
}

export interface FriendWishlistCard {
  id: string;
  kind: ListKind;
  title: string;
  description: string;
  coverImage: string | null;
  coverArt: CoverArt | null;
  accentColor: string;
  occasion: string;
  eventDate: string | null;
  visibility: Visibility;
  shareToken: string;
  itemCount: number;
  updatedAt: string;
}

export interface FriendProfileView {
  user: PublicUser & { bio: string };
  since: string;
  wishlists: FriendWishlistCard[];
}

export type NotificationType =
  | 'shared_with_you'
  | 'collaborator_edit'
  | 'occasion_upcoming'
  | 'price_drop'
  | 'item_changed'
  | 'friend_request'
  | 'friend_accepted';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface UrlMetadata {
  extracted: boolean;
  url: string;
  title: string;
  description: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  retailer: string;
  brand: string;
  /** Present when extraction failed or was partial. */
  message?: string;
  /** The store refused or ignored our request (bot protection), as opposed to a page with no details. */
  blocked?: boolean;
}

/** A browser extension connected to the signed-in account, as listed in Settings. */
export interface ExtensionConnection {
  id: string;
  /** e.g. "Chrome on macOS", derived from the browser that approved the connection. */
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** What the browser extension may read: who is connected and which lists it can save to. */
export interface ExtensionSession {
  user: { displayName: string; username: string; avatarUrl: string | null; currency: string };
  lists: Array<Pick<Wishlist, 'id' | 'kind' | 'title' | 'coverImage' | 'accentColor'> & { coverArt: CoverArt | null }>;
}

export interface ApiErrorBody {
  error: { message: string; code: string; fields?: Record<string, string> };
}
