import type {
  AcquiredVia,
  BoxMaterial,
  BoxSize,
  Condition,
  CoverArt,
  CoverIcon,
  ItemType,
  ListKind,
  Priority,
  UserPreferences,
  ProfileVisibility,
  Visibility,
  WishlistSettings,
} from './types';

/** Lists saved before collections existed have no `kind`; they are wishlists. */
export const isCollection = (list: { kind?: ListKind }): boolean => list.kind === 'collection';

export const LIST_KIND_LABELS: Record<ListKind, string> = {
  wishlist: 'Wishlist',
  collection: 'Collection',
};

export const ACQUIRED_VIA_LABELS: Record<AcquiredVia, string> = {
  bought: 'Bought it',
  gift: 'Gift',
  other: 'Other',
};

export const CONDITION_LABELS: Record<Condition, string> = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  worn: 'Well loved',
};

/** Gift features don't apply to collections; these settings are forced on them. */
export const COLLECTION_SETTINGS: WishlistSettings = {
  allowClaims: false,
  allowMarkPurchased: false,
  showReserved: true,
  showPurchased: true,
  allowMessages: false,
  showPriorities: false,
  itemOrder: 'custom',
  reservationDays: 0,
};

export const DEFAULT_WISHLIST_SETTINGS: WishlistSettings = {
  allowClaims: true,
  allowMarkPurchased: true,
  showReserved: true,
  showPurchased: true,
  allowMessages: true,
  showPriorities: true,
  itemOrder: 'priority',
  reservationDays: 30,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultVisibility: 'unlisted',
  defaultSurpriseMode: true,
  defaultSettings: DEFAULT_WISHLIST_SETTINGS,
  notifications: {
    emailSharing: true,
    emailCollaboratorEdits: false,
    emailOccasionReminders: true,
    priceAlerts: false,
  },
  currency: 'USD',
};

export const RESERVATION_DAY_OPTIONS = [0, 7, 14, 30, 60, 90] as const;

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  product: 'Product',
  experience: 'Experience',
  idea: 'Idea',
  gift_card: 'Gift card / Contribution',
  custom: 'Custom',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  must_have: 'Must have',
  really_want: 'Really want',
  interested: 'Interested',
};

export const PRIORITY_RANK: Record<Priority, number> = {
  must_have: 0,
  really_want: 1,
  interested: 2,
};

/** The three ways a wishlist can present priorities — two settings shown as one choice. */
export type PriorityLayout = 'grouped' | 'ordered' | 'hidden';

export const PRIORITY_LAYOUTS: Array<{ value: PriorityLayout; label: string; description: string }> = [
  { value: 'grouped', label: 'Group by priority', description: 'Must haves and really wants come first, in their own sections.' },
  { value: 'ordered', label: 'My order', description: 'Items stay exactly where you drag them, with their priority badges.' },
  { value: 'hidden', label: 'Hide priorities', description: 'Your order, and no priorities shown — to you or visitors.' },
];

export function priorityLayout(settings: Pick<WishlistSettings, 'showPriorities' | 'itemOrder'>): PriorityLayout {
  if (!settings.showPriorities) return 'hidden';
  return (settings.itemOrder ?? 'priority') === 'priority' ? 'grouped' : 'ordered';
}

export function priorityLayoutSettings(layout: PriorityLayout): Pick<WishlistSettings, 'showPriorities' | 'itemOrder'> {
  return { showPriorities: layout !== 'hidden', itemOrder: layout === 'grouped' ? 'priority' : 'custom' };
}

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  private: 'Private',
  friends: 'Friends',
  unlisted: 'Unlisted',
  public: 'Public',
};

export const VISIBILITY_DESCRIPTIONS: Record<Visibility, string> = {
  private: 'Only you and collaborators can see it.',
  friends: 'Your friends can browse it from your profile. The link only works for them.',
  unlisted: 'Anyone with the link can view it. It isn’t listed anywhere.',
  public: 'Shown on your public profile and to your friends.',
};

export const PROFILE_VISIBILITY_LABELS: Record<ProfileVisibility, string> = {
  public: 'Public',
  friends: 'Friends',
  private: 'Private',
};

export const PROFILE_VISIBILITY_DESCRIPTIONS: Record<ProfileVisibility, string> = {
  public: 'Anyone can find you and see your public lists on your profile.',
  friends: 'People can find you in search. Only friends see the lists you share with them.',
  private: 'You won’t appear in search. Visitors to your profile won’t see any lists.',
};

/** Profiles that show up when someone searches for people on Friends. */
export const isDiscoverableProfile = (v: ProfileVisibility): boolean => v === 'public' || v === 'friends';

/** Accent colours offered for wishlists. Values must be valid `#rrggbb`. */
export const ACCENT_COLORS = [
  { name: 'Terracotta', value: '#c0583a' },
  { name: 'Rose', value: '#c2577a' },
  { name: 'Plum', value: '#7a4f8f' },
  { name: 'Ocean', value: '#2f6f9f' },
  { name: 'Teal', value: '#2c7a72' },
  { name: 'Sage', value: '#5f7f55' },
  { name: 'Ochre', value: '#b8862d' },
  { name: 'Slate', value: '#4f5866' },
] as const;

export const SUGGESTED_CATEGORIES = [
  'Technology',
  'Home',
  'Travel',
  'Entertainment',
  'Books',
  'Toys',
  'Clothing',
  'Beauty',
  'Food & Drink',
  'Sports',
  'Hobbies',
  'Experiences',
] as const;

export const SUGGESTED_OCCASIONS = [
  'Birthday',
  'Christmas',
  'Wedding',
  'Baby shower',
  'Anniversary',
  'Graduation',
  'Housewarming',
  'Holiday',
] as const;

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'INR', 'MXN', 'BRL', 'ZAR', 'SGD'] as const;

export const LIMITS = {
  title: 200,
  description: 5000,
  notes: 5000,
  shortText: 120,
  tags: 20,
  tagLength: 32,
  url: 2048,
  wishlistTitle: 120,
  bio: 500,
  location: 80,
  message: 500,
  review: 3000,
  imageBytes: 5 * 1024 * 1024,
  /** Items per bulk add. */
  bulkItems: 25,
  /** People one list can be made for. */
  recipients: 6,
  /** Saved people and pets in My Circle. */
  circlePeople: 100,
  /** Short note on a My Circle entry. */
  circleNote: 200,
} as const;

/** "Ava", "Ava & Leo", "Ava, Leo & Mia". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** First word of a display name — used for bylines and “made by”, not for account identity. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/**
 * Who to show under “For …”. Empty means the list is just the owner's (no line).
 * When `includeOwner` is set, the owner leads the group alongside the other people (first name only).
 */
export function peopleForList(
  recipients: Array<{ name: string; avatarUrl: string | null; userId?: string | null }>,
  includeOwner: boolean | undefined,
  owner: { displayName: string; avatarUrl: string | null; id?: string },
): Array<{ name: string; avatarUrl: string | null; userId: string | null }> {
  if (!recipients.length) return [];
  const others = recipients.map((r) => ({ name: r.name, avatarUrl: r.avatarUrl, userId: r.userId ?? null }));
  if (!includeOwner) return others;
  return [{ name: firstName(owner.displayName) || owner.displayName, avatarUrl: owner.avatarUrl, userId: owner.id ?? null }, ...others];
}

/** "Ava’s", "Ava & Leo’s", "Chris’". */
export function possessiveNames(names: string[]): string {
  const joined = joinNames(names);
  return joined.endsWith('s') ? `${joined}’` : `${joined}’s`;
}

/** The cover graphic a new list starts with when none is chosen. */
export function defaultCoverArt(kind: ListKind): CoverArt {
  const frame = { shape: 'rounded', fill: 'glass', color: '#ffffff' } as const;
  return kind === 'collection' ? { icon: 'collection', backdrop: 'blush', frame } : { icon: 'gift', backdrop: 'sky', frame };
}

// ── Boxes ───────────────────────────────────────────────────────────────────

export const BOX_MATERIAL_LABELS: Record<BoxMaterial, string> = {
  cardboard: 'Cardboard box',
  plastic: 'Plastic tote',
  clear: 'Clear bin',
  wood: 'Wooden crate',
  metal: 'Metal case',
  fabric: 'Fabric bin',
  basket: 'Basket',
  archive: 'Archive box',
  drawer: 'Drawer',
  suitcase: 'Suitcase',
  duffel: 'Duffel bag',
  backpack: 'Backpack',
  purse: 'Purse',
  other: 'Other',
};

export const BOX_SIZE_LABELS: Record<BoxSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xl: 'Extra large',
};

/** Colours real boxes and bins come in. Values must be valid `#rrggbb`. */
export const BOX_COLORS = [
  { name: 'Kraft', value: '#c8a27a' },
  { name: 'Black', value: '#2f3440' },
  { name: 'Gray', value: '#9aa3ad' },
  { name: 'White', value: '#eef0f2' },
  { name: 'Red', value: '#e0533d' },
  { name: 'Orange', value: '#f08a3c' },
  { name: 'Yellow', value: '#f2c14e' },
  { name: 'Green', value: '#4f9e68' },
  { name: 'Teal', value: '#4fa3a5' },
  { name: 'Blue', value: '#5b8fd6' },
  { name: 'Purple', value: '#7c6cf0' },
  { name: 'Pink', value: '#f19bb0' },
] as const;

export const SUGGESTED_ROOMS = ['Kitchen', 'Living room', 'Bedroom', 'Bathroom', 'Office', 'Kids’ room', 'Garage', 'Basement', 'Attic', 'Storage'] as const;

/** Cover icon drawn for each kind of box. */
export const BOX_MATERIAL_ICONS: Record<BoxMaterial, CoverIcon> = {
  cardboard: 'box',
  plastic: 'tote',
  clear: 'clear-tub',
  wood: 'crate',
  metal: 'metal-case',
  fabric: 'fabric-bin',
  basket: 'basket',
  archive: 'archive-box',
  drawer: 'drawers',
  suitcase: 'suitcase',
  duffel: 'duffel',
  backpack: 'backpack',
  purse: 'handbag',
  other: 'box',
};

/** The cover graphic a new box starts with: a drawing of its material on a soft sky. */
export function defaultBoxCoverArt(material: BoxMaterial): CoverArt {
  return { icon: BOX_MATERIAL_ICONS[material], backdrop: 'sky', frame: { shape: 'rounded', fill: 'glass', color: '#ffffff' } };
}
