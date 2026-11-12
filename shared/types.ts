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

/** Who can find your profile and see lists on it. Independent of each list’s own visibility. */
export const PROFILE_VISIBILITIES = ['public', 'friends', 'private'] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

export const COLLABORATOR_ROLES = ['viewer', 'editor'] as const;
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];
export type AccessRole = 'owner' | CollaboratorRole;

export type ClaimStatus = 'available' | 'reserved' | 'purchased';

/** Wishlists hold things you want (and support gifting); collections chronicle things you already have. */
export const LIST_KINDS = ['wishlist', 'collection'] as const;
export type ListKind = (typeof LIST_KINDS)[number];

/** Peer-to-peer apps that support amount-prefilled pay links (no processor on Wishful). */
export const PAYMENT_PROVIDERS = ['venmo', 'cashapp', 'paypal'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const CASH_FUND_DISPLAY_MODES = ['banner', 'card'] as const;
export type CashFundDisplayMode = (typeof CASH_FUND_DISPLAY_MODES)[number];

/** Owner's Venmo / Cash App / PayPal.Me handle for cash funds. */
export interface PaymentMethod {
  provider: PaymentProvider;
  /** Username or cashtag without leading @ or $. */
  handle: string;
}

/** Optional cash contribution fund on a wishlist (one per list). */
export interface CashFund {
  title: string;
  note: string;
  /** Fundraising goal in cents; null = open amount, no progress target. */
  goalCents: number | null;
  displayMode: CashFundDisplayMode;
  /** Which of the owner's methods to offer; null means all configured methods. */
  providers: PaymentProvider[] | null;
  /** Avatar icon; defaults to cash dollar when missing. */
  icon?: CoverIcon | null;
}

export interface PublicContribution {
  id: string;
  amountCents: number;
  name: string;
  message: string;
  provider: PaymentProvider;
  createdAt: string;
}

export interface OwnerContributionView {
  id: string;
  amountCents: number;
  name: string;
  message: string;
  provider: PaymentProvider;
  createdAt: string;
}

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
  'controller',
  'jack-o-lantern',
  'ghost',
  'witch-hat',
  'bat',
  'candy-corn',
  'shamrock',
  'pot-of-gold',
  'leprechaun-hat',
  'rainbow',
  'love-letter',
  'chocolates',
  'rose',
  'turkey',
  'pie',
  'cornucopia',
  'menorah',
  'dreidel',
  'star-of-david',
  'blocks',
  'robot',
  'teddy',
  'duck',
  'train',
  'rocking-horse',
  'dinosaur',
  'rocket',
  'easter-egg',
  'bunny',
  'chick',
  'basket',
  'fireworks',
  'party-hat',
  'champagne',
  'flag',
  'diya',
  'paper-lantern',
  'red-envelope',
  'crescent',
  'fanous',
  'bouquet',
  'necktie',
  'grill',
  'baby-bottle',
  'rattle',
  'stroller',
  'onesie',
  'backpack',
  'pencil',
  'apple',
  'crayons',
  'palette',
  'guitar',
  'yarn',
  'tent',
  'fishing-rod',
  'soccer-ball',
  'basketball',
  'baseball',
  'paw',
  'bone',
  'fishbowl',
  'toy-mouse',
  'whisk',
  'chef-hat',
  'watering-can',
  'candle',
  'lipstick',
  'perfume',
  'handbag',
  'laptop',
  'phone',
  'tablet',
  'kite',
  'doll',
  'toy-car',
  'puzzle',
  'idea',
  'plane',
  'box',
  'tote',
  'clear-tub',
  'crate',
  'metal-case',
  'fabric-bin',
  'drawers',
  'archive-box',
  'duffel',
  'cash',
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
  'spooky',
  'shamrock',
  'hanukkah',
  'harvest',
  'solid',
  'gradient',
] as const;
export type CoverBackdrop = (typeof COVER_BACKDROPS)[number];

/** Backdrops painted in the list owner's own colours (`CoverArt.colors`) instead of an illustrated scene. */
export const PLAIN_COVER_BACKDROPS = ['solid', 'gradient'] as const;
export type PlainCoverBackdrop = (typeof PLAIN_COVER_BACKDROPS)[number];
export const isPlainBackdrop = (b: CoverBackdrop | null | undefined): b is PlainCoverBackdrop => b === 'solid' || b === 'gradient';

/** Backdrops dark enough to need light text and a glow behind floating icons. */
export const DARK_COVER_BACKDROPS: readonly CoverBackdrop[] = ['night', 'snow', 'spooky', 'hanukkah'];
export const isDarkBackdrop = (b: CoverBackdrop | null | undefined): boolean => Boolean(b && DARK_COVER_BACKDROPS.includes(b));

export const DEFAULT_SOLID_COLOR = '#d6e4fb';
export const DEFAULT_GRADIENT: [string, string] = ['#fbd5cb', '#d6e4fb'];

/** The colours a plain cover is painted with, falling back to the defaults. */
export function coverColors(art: Pick<CoverArt, 'backdrop' | 'colors'>): [string, string] {
  if (art.backdrop === 'solid') {
    const c = art.colors?.[0] ?? DEFAULT_SOLID_COLOR;
    return [c, c];
  }
  return [art.colors?.[0] ?? DEFAULT_GRADIENT[0], art.colors?.[1] ?? DEFAULT_GRADIENT[1]];
}

/** CSS background for a plain cover, or null for illustrated scenes. */
export function coverPaint(art: Pick<CoverArt, 'backdrop' | 'colors'>): string | null {
  if (!isPlainBackdrop(art.backdrop)) return null;
  const [a, b] = coverColors(art);
  return art.backdrop === 'solid' ? a : `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/** WCAG relative luminance of a #rrggbb colour, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Whether text on this cover should be white: dark scenes, or plain colours past the point where white reads better than ink. */
export function isDarkCover(art: Pick<CoverArt, 'backdrop' | 'colors'> | null | undefined): boolean {
  if (!art) return false;
  if (!isPlainBackdrop(art.backdrop)) return isDarkBackdrop(art.backdrop);
  const [a, b] = coverColors(art);
  return (luminance(a) + luminance(b)) / 2 < 0.2;
}

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
  /** #rrggbb; one for `solid`, two (start and end) for `gradient`, absent for scenes. */
  colors?: string[];
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
  /** Who can find this profile and see lists on `/u/:username`. */
  profileVisibility: ProfileVisibility;
  /** Cover graphic behind the public profile header. */
  profileCoverArt: CoverArt | null;
  /** City or region shown on the profile when non-empty. */
  location: string;
  /** Birth year used to show age on the profile; `null` hides age. */
  birthYear: number | null;
  /** Venmo / Cash App / PayPal.Me handles for cash funds on wishlists. */
  paymentMethods: PaymentMethod[];
  preferences: UserPreferences;
  /** When the current recovery code was made; null if the account has none yet. */
  recoveryCodeCreatedAt: string | null;
  /** Site integrations this account may connect (enabled per account on the server). */
  integrations: { brickfolio: boolean; playshelf: boolean };
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
  /** The storage box it's packed in; a thing is only ever in one box. */
  boxId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const SYNC_PROVIDERS = ['brickfolio', 'playshelf'] as const;
export type SyncProvider = (typeof SYNC_PROVIDERS)[number];
export const SYNC_PROVIDER_NAMES: Record<SyncProvider, string> = { brickfolio: 'Brickfolio', playshelf: 'Playshelf' };

export interface ItemSource {
  provider: SyncProvider;
  /** The item's id at the source, e.g. a LEGO set number. */
  key: string;
  /** More photos from the source, besides `imageUrl`. */
  gallery: string[];
  syncedAt: string;
}

/** A list mirrored from one part of a synced source: a Brickfolio sheet tab, the Playshelf library or wishlist. */
export interface ListLink {
  provider: SyncProvider;
  tab: 'full_sets' | 'wishlist' | 'library';
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

/** The Playshelf connection as shown in Settings. */
export interface PlayshelfStatus {
  /** The server has the Playshelf database address and public key. */
  configured: boolean;
  connected: boolean;
  username: string;
  /** Link to the Playshelf profile, when the site address is configured. */
  profileUrl: string | null;
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

/** Someone a list is made for (a child, a partner), shown in place of the owner. */
export interface ListRecipient {
  name: string;
  /** A photo, mainly for people without an account; a linked friend's own photo is used when this is empty. */
  avatarUrl: string | null;
  /** The friend's account the list is shared with. They're also on `collaborators` while linked. */
  userId: string | null;
  /** Optional My Circle entry this recipient was picked from or saved as. */
  circlePersonId?: string | null;
}

/** Saved people and pets in My Circle — reusable across lists. */
export const CIRCLE_KINDS = ['person', 'pet'] as const;
export type CircleKind = (typeof CIRCLE_KINDS)[number];

export interface CirclePerson {
  id: string;
  name: string;
  avatarUrl: string | null;
  kind: CircleKind;
  note: string;
  /** Linked Wishful account, when associated. */
  userId: string | null;
  /** Present when `userId` is set — for profile links. */
  username?: string | null;
  /** Present when `userId` is set. */
  displayName?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Who a list is for, as shown to viewers. */
export interface ListPerson {
  name: string;
  avatarUrl: string | null;
  /** Only for the owner and the people the list is shared with. */
  userId: string | null;
  /** When linked to an account — used for `/u/:username` profile links. */
  username?: string | null;
}

export interface Wishlist {
  id: string;
  ownerId: string;
  /** Made for someone else, or for several people together (siblings, a couple, a group trip). Surprise Mode then hides gift activity from them instead of from the owner. */
  recipients?: ListRecipient[];
  /** When true (and recipients is non-empty), the owner is also someone the list is for — shown alongside the recipients. */
  includeOwner?: boolean;
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
  /** Cash contribution fund; null/undefined when off. Collections never have one. */
  cashFund?: CashFund | null;
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
  /** Empty on lists made for their owner. */
  recipients: ListPerson[];
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
  recipients: ListPerson[];
  /** `null` when gift activity is hidden from this viewer (Surprise Mode). */
  claims: OwnerClaimView[] | null;
  pledges: OwnerPledgeView[] | null;
  /** Cash contributions; `null` when Surprise Mode hides them from this viewer. */
  contributions: OwnerContributionView[] | null;
  /** Sum of visible contributions in cents; `null` when hidden. */
  raisedCents: number | null;
  /** Owner's payment methods (for cash fund setup / preview). Empty for non-owners. */
  paymentMethods: PaymentMethod[];
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

export type PublicItem = Omit<Item, 'notes' | 'ownerId' | 'wishlistIds' | 'boxId' | 'createdBy' | 'owned'> & { owned?: PublicOwnership | null };

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

export interface PublicCashFundView {
  title: string;
  note: string;
  goalCents: number | null;
  displayMode: CashFundDisplayMode;
  icon: CoverIcon;
  paymentMethods: PaymentMethod[];
  /** `null` when Surprise Mode hides contribution totals from this viewer. */
  raisedCents: number | null;
  contributions: PublicContribution[] | null;
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
  recipients: Array<Omit<ListPerson, 'userId'>>;
  entries: PublicEntry[];
  /** Present when the list has a cash fund and the owner has at least one pay link. */
  cashFund: PublicCashFundView | null;
  viewer: {
    /** The signed-in viewer owns (or edits) this list, or it's made for them. */
    isOwner: boolean;
    /** The list is made for the signed-in viewer (alone or with others). */
    isRecipient: boolean;
    /** Claim state has been withheld from this viewer. */
    claimsHidden: boolean;
  };
}

export interface PublicProfileView {
  user: PublicUser & {
    bio: string;
    location: string;
    /** Computed age when the person chose to share a birth year; otherwise null. */
    age: number | null;
    profileCoverArt: CoverArt | null;
  };
  profileVisibility: ProfileVisibility;
  viewer: {
    isSelf: boolean;
    isFriend: boolean;
    /** Lists are included for this viewer under the profile’s visibility rules. */
    canSeeLists: boolean;
  };
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
    recipients: Omit<ListPerson, 'userId'>[];
  }>;
}

/** A person found via Friends → search (discoverable profiles only). */
export interface PeopleSearchHit {
  user: PublicUser;
  profileVisibility: ProfileVisibility;
  relationship: 'self' | 'none' | 'friends' | 'outgoing' | 'incoming';
}

// ── Storage boxes ───────────────────────────────────────────────────────────

export const BOX_MATERIALS = [
  'cardboard',
  'plastic',
  'clear',
  'wood',
  'metal',
  'fabric',
  'basket',
  'archive',
  'drawer',
  'suitcase',
  'duffel',
  'backpack',
  'purse',
  'other',
] as const;
export type BoxMaterial = (typeof BOX_MATERIALS)[number];

export const BOX_SIZES = ['small', 'medium', 'large', 'xl'] as const;
export type BoxSize = (typeof BOX_SIZES)[number];

/** `link`: anyone who scans the code sees what's inside. `owner`: only the owner, signed in. */
export const BOX_ACCESS = ['link', 'owner'] as const;
export type BoxAccess = (typeof BOX_ACCESS)[number];

/** Something in a box that isn't worth a full item, like "3 winter blankets". */
export interface BoxLine {
  id: string;
  text: string;
  quantity: number;
}

export interface Box {
  id: string;
  ownerId: string;
  name: string;
  /** "Box 3"; filled in with the next free number when a box is made. */
  number: number | null;
  /** #rrggbb, the colour of the box itself. */
  color: string;
  material: BoxMaterial;
  size: BoxSize | null;
  /** Where it's kept, e.g. "Garage, shelf 2". Never shown to people who scan the code. */
  location: string;
  /** Moving: the room it's going to, printed large on the label. */
  room: string;
  fragile: boolean;
  /** Private notes, never shown to people who scan the code. */
  notes: string;
  coverArt: CoverArt;
  /** Items packed in it, most recently added first. `item.boxId` is the source of truth. */
  itemIds: string[];
  lines: BoxLine[];
  /** 12 characters of Crockford base32: the QR link is `/b/{code}`, printed as XXXX-XXXX-XXXX. */
  code: string;
  access: BoxAccess;
  /** Prices are hidden from people who scan the code unless this is on. */
  showPrices: boolean;
  /** When set, the box is archived — hidden from Active and its QR link is paused. */
  archivedAt: string | null;
  lastScannedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoxSummary extends Omit<Box, 'itemIds' | 'lines' | 'notes'> {
  itemCount: number;
  lineCount: number;
  /** For "Where is my…?" search across the box list. */
  lineTexts: string[];
  previewImages: string[];
}

export interface BoxDetail {
  box: Box;
  /** The items in the box, in `box.itemIds` order. */
  items: Item[];
}

/** What someone sees when they scan a box's code. */
export interface PublicBoxView {
  box: Pick<Box, 'name' | 'number' | 'color' | 'material' | 'size' | 'room' | 'fragile' | 'coverArt' | 'showPrices' | 'code' | 'updatedAt'> & {
    /** Only for the owner. */
    id: string | null;
    location: string | null;
  };
  items: PublicItem[];
  lines: BoxLine[];
  viewer: { isOwner: boolean };
}

const BOX_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const BOX_CODE_LENGTH = 12;

/** Tidy a typed or scanned box code: case, dashes and spaces, and the letters people mix up with digits. */
export function normalizeBoxCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
}

export const isBoxCode = (code: string): boolean => code.length === BOX_CODE_LENGTH && [...code].every((c) => BOX_CODE_ALPHABET.includes(c));

/** XXXX-XXXX-XXXX */
export const formatBoxCode = (code: string): string => code.replace(/(.{4})(?=.)/g, '$1-');

export function boxCodeFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, BOX_CODE_LENGTH), (b) => BOX_CODE_ALPHABET[b & 31]).join('');
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
  recipients: Omit<ListPerson, 'userId'>[];
  /** Set on lists someone else made for this friend. */
  madeBy: PublicUser | null;
}

export interface FriendProfileView {
  user: PublicUser & { bio: string };
  since: string;
  wishlists: FriendWishlistCard[];
}

export type NotificationType =
  'shared_with_you' | 'collaborator_edit' | 'occasion_upcoming' | 'price_drop' | 'item_changed' | 'friend_request' | 'friend_accepted';

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
