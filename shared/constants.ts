import type { AcquiredVia, Condition, CoverArt, ItemType, ListKind, Priority, UserPreferences, Visibility, WishlistSettings } from './types';

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
  message: 500,
  review: 3000,
  imageBytes: 5 * 1024 * 1024,
  /** Items per bulk add. */
  bulkItems: 25,
} as const;

/** The cover graphic a new list starts with when none is chosen. */
export function defaultCoverArt(kind: ListKind): CoverArt {
  const frame = { shape: 'rounded', fill: 'glass', color: '#ffffff' } as const;
  return kind === 'collection' ? { icon: 'collection', backdrop: 'blush', frame } : { icon: 'gift', backdrop: 'sky', frame };
}
