/**
 * Input validation schemas shared by the API (authoritative) and the client
 * (for instant feedback). The server always re-validates every request.
 *
 * Update schemas intentionally have no `.default()`s so that PATCH requests
 * only touch the fields that were actually sent.
 */
import { z } from 'zod';
import {
  ACQUIRED_VIA,
  BOX_ACCESS,
  BOX_MATERIALS,
  BOX_SIZES,
  COLLABORATOR_ROLES,
  CONDITIONS,
  COVER_BACKDROPS,
  COVER_FRAME_FILLS,
  COVER_FRAME_SHAPES,
  COVER_ICONS,
  ITEM_ORDERS,
  ITEM_TYPES,
  LIST_KINDS,
  PRIORITIES,
  PROFILE_VISIBILITIES,
  VISIBILITIES,
} from './types';
import { LIMITS } from './constants';
import { GIFT_MAX_PAGE, GIFT_PRICE_CAPS, GIFT_STORES } from './giftIdeas';

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

const LOCAL_IMAGE_RE = /^\/api\/images\/[A-Za-z0-9_-]{8,64}$/;

/** Turn blank strings into `null` so optional URL fields can be cleared. */
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/, 'Invalid id');

export const httpUrlSchema = z
  .string()
  .trim()
  .max(LIMITS.url, 'That link is too long')
  .refine(isHttpUrl, 'Enter a valid link starting with http:// or https://');

export const optionalUrlSchema = z.preprocess(blankToNull, httpUrlSchema.nullable());

export const imageUrlSchema = z
  .string()
  .trim()
  .max(LIMITS.url)
  .refine((v) => LOCAL_IMAGE_RE.test(v) || isHttpUrl(v), 'Enter a valid image link');

export const optionalImageUrlSchema = z.preprocess(blankToNull, imageUrlSchema.nullable());

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(200, 'Password is too long');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, 'Use 3–30 lowercase letters, numbers or underscores');

export const displayNameSchema = z.string().trim().min(1, 'Enter your name').max(60, 'Keep it under 60 characters');

const shortText = z.string().trim().max(LIMITS.shortText, `Keep it under ${LIMITS.shortText} characters`);
const money = z.number().min(0, 'Must be zero or more').max(1_000_000_000).transform((n) => Math.round(n * 100) / 100);
const currencySchema = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code');
const tagSchema = z.string().trim().min(1).max(LIMITS.tagLength);
const dateSchema = z.preprocess(
  blankToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Use a valid date')
    .nullable(),
);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #c0583a');

export const prioritySchema = z.enum(PRIORITIES);
export const visibilitySchema = z.enum(VISIBILITIES);
export const profileVisibilitySchema = z.enum(PROFILE_VISIBILITIES);
export const itemTypeSchema = z.enum(ITEM_TYPES);
export const collaboratorRoleSchema = z.enum(COLLABORATOR_ROLES);
export const listKindSchema = z.enum(LIST_KINDS);
export const coverFrameSchema = z.object({ shape: z.enum(COVER_FRAME_SHAPES), fill: z.enum(COVER_FRAME_FILLS), color: colorSchema }).strict();
export const coverArtSchema = z
  .object({ icon: z.enum(COVER_ICONS), backdrop: z.enum(COVER_BACKDROPS), colors: z.array(colorSchema).min(1).max(2).optional(), frame: coverFrameSchema.optional() })
  .strict()
  .refine((a) => (a.backdrop === 'solid' ? a.colors?.length === 1 : a.backdrop === 'gradient' ? a.colors?.length === 2 : !a.colors), {
    message: 'Pick a colour for this background',
    path: ['colors'],
  });

// ── Auth ────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  username: usernameSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(200),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const recoverAccountSchema = z.object({
  email: emailSchema,
  code: z.string().trim().min(1, 'Enter your recovery code').max(60, 'That doesn’t look like a recovery code'),
  password: passwordSchema,
});

export const newRecoveryCodeSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm').max(200),
});

// ── Account ─────────────────────────────────────────────────────────────────

const currentYear = () => new Date().getFullYear();

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema.optional(),
  username: usernameSchema.optional(),
  bio: z.string().trim().max(LIMITS.bio).optional(),
  avatarUrl: optionalImageUrlSchema.optional(),
  profileVisibility: profileVisibilitySchema.optional(),
  profileCoverArt: coverArtSchema.nullable().optional(),
  location: z.string().trim().max(LIMITS.location, `Keep it under ${LIMITS.location} characters`).optional(),
  birthYear: z
    .number()
    .int()
    .min(1900, 'That year is too far back')
    .max(currentYear() - 5, 'Enter a realistic birth year')
    .nullable()
    .optional(),
});

export const peopleSearchSchema = z.object({
  q: z.string().trim().min(1, 'Type a name or username').max(40),
});

export const wishlistSettingsSchema = z.object({
  allowClaims: z.boolean(),
  allowMarkPurchased: z.boolean(),
  showReserved: z.boolean(),
  showPurchased: z.boolean(),
  allowMessages: z.boolean(),
  showPriorities: z.boolean(),
  itemOrder: z.enum(ITEM_ORDERS).optional(),
  reservationDays: z.number().int().min(0).max(365),
  showReviews: z.boolean().optional(),
});

export const preferencesUpdateSchema = z.object({
  defaultVisibility: visibilitySchema.optional(),
  defaultSurpriseMode: z.boolean().optional(),
  defaultSettings: wishlistSettingsSchema.partial().optional(),
  notifications: z
    .object({
      emailSharing: z.boolean(),
      emailCollaboratorEdits: z.boolean(),
      emailOccasionReminders: z.boolean(),
      priceAlerts: z.boolean(),
    })
    .partial()
    .optional(),
  currency: currencySchema.optional(),
});

// ── Items ───────────────────────────────────────────────────────────────────

export const itemMetadataSchema = z.object({
  size: shortText.optional(),
  color: shortText.optional(),
  model: shortText.optional(),
  variant: shortText.optional(),
  location: shortText.optional(),
  venue: shortText.optional(),
  timeframe: shortText.optional(),
  bookingUrl: optionalUrlSchema.optional(),
  suggestedAmount: money.nullable().optional(),
  instructions: z.string().trim().max(1000).optional(),
  budget: money.nullable().optional(),
});

/** Partial so PATCHes only touch what was sent; missing fields keep their current (or default) values. */
export const ownershipSchema = z.object({
  acquiredOn: dateSchema.optional(),
  acquiredVia: z.enum(ACQUIRED_VIA).nullable().optional(),
  pricePaid: money.nullable().optional(),
  condition: z.enum(CONDITIONS).nullable().optional(),
  quantity: z.number().int('Use a whole number').min(1, 'At least 1').max(9999).optional(),
  rating: z.number().int('Use whole stars').min(1, 'From 1 to 5 stars').max(5, 'From 1 to 5 stars').nullable().optional(),
  review: z.string().trim().max(LIMITS.review, `Keep it under ${LIMITS.review} characters`).optional(),
});

const itemFields = {
  type: itemTypeSchema.optional(),
  title: z.string().trim().min(1, 'Give it a title').max(LIMITS.title),
  description: z.string().trim().max(LIMITS.description).optional(),
  imageUrl: optionalImageUrlSchema.optional(),
  externalUrl: optionalUrlSchema.optional(),
  retailer: shortText.optional(),
  brand: shortText.optional(),
  price: money.nullable().optional(),
  currency: currencySchema.optional(),
  category: z.string().trim().max(50).optional(),
  tags: z.array(tagSchema).max(LIMITS.tags, `Up to ${LIMITS.tags} tags`).optional(),
  notes: z.string().trim().max(LIMITS.notes).optional(),
  metadata: itemMetadataSchema.optional(),
  /** `null` marks the item as not owned. */
  owned: ownershipSchema.nullable().optional(),
};

export const itemCreateSchema = z.object({
  ...itemFields,
  wishlistIds: z.array(idSchema).max(50).optional(),
  priority: prioritySchema.nullable().optional(),
});

/** What the browser extension may send when saving the page it's on. */
export const extensionItemSchema = itemCreateSchema.pick({
  title: true,
  description: true,
  imageUrl: true,
  externalUrl: true,
  retailer: true,
  brand: true,
  price: true,
  currency: true,
  notes: true,
  wishlistIds: true,
});

/** A whole wishlist read from another store's page by the extension, sent in batches. */
export const extensionBulkSchema = z.object({
  items: z
    .array(extensionItemSchema.omit({ wishlistIds: true }))
    .min(1, 'Add at least one item')
    .max(LIMITS.bulkItems, `Add up to ${LIMITS.bulkItems} items at a time`),
  wishlistIds: z.array(idSchema).max(50).optional(),
  priority: prioritySchema.nullable().optional(),
});

export const extensionListSchema = z.object({
  title: z.string().trim().min(1, 'Give it a name').max(LIMITS.wishlistTitle),
  kind: listKindSchema,
});

export const itemBulkCreateSchema = z.object({
  items: z
    .array(z.object(itemFields))
    .min(1, 'Add at least one item')
    .max(LIMITS.bulkItems, `Add up to ${LIMITS.bulkItems} items at a time`),
  wishlistIds: z.array(idSchema).max(50).optional(),
  priority: prioritySchema.nullable().optional(),
});

export const itemUpdateSchema = z.object({ ...itemFields, title: itemFields.title.optional() });

export const itemMembershipSchema = z.object({ wishlistIds: z.array(idSchema).max(100) });

/** "Got it": record ownership and file the item in a collection (existing or new), optionally leaving a wishlist. */
export const gotItSchema = z
  .object({
    collectionId: idSchema.optional(),
    newCollectionTitle: z.string().trim().min(1, 'Name your collection').max(LIMITS.wishlistTitle).optional(),
    removeFromWishlistId: idSchema.optional(),
    owned: ownershipSchema,
  })
  .refine((v) => Boolean(v.collectionId) !== Boolean(v.newCollectionTitle), { message: 'Choose a collection', path: ['collectionId'] });

// ── Wishlists ───────────────────────────────────────────────────────────────

const wishlistFields = {
  title: z.string().trim().min(1, 'Give it a name').max(LIMITS.wishlistTitle),
  description: z.string().trim().max(2000).optional(),
  coverImage: optionalImageUrlSchema.optional(),
  coverArt: coverArtSchema.nullable().optional(),
  accentColor: colorSchema.optional(),
  visibility: visibilitySchema.optional(),
  occasion: z.string().trim().max(60).optional(),
  eventDate: dateSchema.optional(),
  surpriseMode: z.boolean().optional(),
  settings: wishlistSettingsSchema.partial().optional(),
  /** Who it's made for; empty makes it yours again. Each `userId` must be a friend, and `canEdit` sets their access. */
  recipients: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Enter their name').max(60, 'Keep it under 60 characters'),
        avatarUrl: optionalImageUrlSchema.optional(),
        userId: idSchema.nullable().optional(),
        canEdit: z.boolean().optional(),
      }),
    )
    .max(LIMITS.recipients, `A list can be for up to ${LIMITS.recipients} people`)
    .superRefine((people, ctx) => {
      const seen = new Set<string>();
      people.forEach((p, i) => {
        if (!p.userId) return;
        if (seen.has(p.userId)) ctx.addIssue({ code: 'custom', path: [i, 'userId'], message: 'They’re already on this list.' });
        seen.add(p.userId);
      });
    })
    .optional(),
  /** Also show the owner as someone the list is for (needs at least one other person in `recipients`). */
  includeOwner: z.boolean().optional(),
};

export const wishlistCreateSchema = z.object({ ...wishlistFields, kind: listKindSchema.optional() });

export const wishlistUpdateSchema = z.object({
  ...wishlistFields,
  title: wishlistFields.title.optional(),
  archived: z.boolean().optional(),
});

export const orderSchema = z.object({ ids: z.array(idSchema).max(5000) });

export const entryCreateSchema = z.object({
  itemId: idSchema,
  priority: prioritySchema.nullable().optional(),
  customNotes: z.string().trim().max(LIMITS.message).optional(),
});

export const entryUpdateSchema = z.object({
  priority: prioritySchema.nullable().optional(),
  customNotes: z.string().trim().max(LIMITS.message).optional(),
  groupGift: z.boolean().optional(),
  groupGiftNote: z.string().trim().max(LIMITS.message).optional(),
});

export const moveEntrySchema = z.object({ toWishlistId: idSchema });

export const collaboratorInviteSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter an email or username').max(254),
  role: collaboratorRoleSchema,
});

export const collaboratorUpdateSchema = z.object({ role: collaboratorRoleSchema });

// ── Boxes ───────────────────────────────────────────────────────────────────

export const MAX_BOX_ITEMS = 500;
export const MAX_BOX_LINES = 200;

export const boxLineSchema = z.object({
  id: idSchema.optional(),
  text: z.string().trim().min(1, 'Say what it is').max(120, 'Keep it under 120 characters'),
  quantity: z.number().int('Use a whole number').min(1, 'At least 1').max(9999),
});

const boxFields = {
  name: z.string().trim().min(1, 'Give the box a name').max(80, 'Keep it under 80 characters'),
  number: z.number().int('Use a whole number').min(1, 'From 1').max(99999).nullable().optional(),
  color: colorSchema.optional(),
  material: z.enum(BOX_MATERIALS).optional(),
  size: z.enum(BOX_SIZES).nullable().optional(),
  location: z.string().trim().max(80, 'Keep it under 80 characters').optional(),
  room: z.string().trim().max(40, 'Keep it under 40 characters').optional(),
  fragile: z.boolean().optional(),
  notes: z.string().trim().max(LIMITS.notes).optional(),
  coverArt: coverArtSchema.optional(),
  access: z.enum(BOX_ACCESS).optional(),
  showPrices: z.boolean().optional(),
  lines: z.array(boxLineSchema).max(MAX_BOX_LINES, `A box can list up to ${MAX_BOX_LINES} other things`).optional(),
};

export const boxCreateSchema = z.object(boxFields);
export const boxUpdateSchema = z.object({ ...boxFields, name: boxFields.name.optional() });

/** Pack items into a box, or take them out of whatever box they're in (`boxId: null`). */
export const boxItemsSchema = z.object({ itemIds: z.array(idSchema).min(1).max(MAX_BOX_ITEMS), boxId: idSchema.nullable() });

export const friendRequestSchema = z.object({
  username: z.preprocess((v) => (typeof v === 'string' ? v.trim().replace(/^@/, '') : v), usernameSchema),
});

// ── Public (anonymous visitors) ─────────────────────────────────────────────

export const claimSchema = z.object({
  name: z.string().trim().max(60).optional(),
  contact: z.string().trim().max(120).optional(),
  message: z.string().trim().max(LIMITS.message).optional(),
  markPurchased: z.boolean().optional(),
});

export const claimTokenSchema = z.object({ claimToken: z.string().min(20).max(200) });

export const pledgeSchema = z.object({
  name: z.string().trim().min(1, 'Let others know who you are').max(60),
  contact: z.string().trim().max(120).optional(),
  message: z.string().trim().max(LIMITS.message).optional(),
  coordinator: z.boolean().optional(),
});

export const pledgeTokenSchema = z.object({ pledgeToken: z.string().min(20).max(200) });

export const metadataRequestSchema = z.object({ url: httpUrlSchema });

export const listImportRequestSchema = z.object({ url: httpUrlSchema, next: z.string().trim().max(4000).optional() });

/** Query string of GET /api/gifts/search. Price caps are a fixed set so searches share cache entries. */
export const giftSearchSchema = z.object({
  q: z.string().trim().min(1, 'Type something to search for').max(100, 'Keep searches under 100 characters'),
  maxPrice: z.coerce
    .number()
    .refine((v) => (GIFT_PRICE_CAPS as readonly number[]).includes(v), 'Pick one of the price limits')
    .optional(),
  store: z.enum(GIFT_STORES).optional(),
  page: z.coerce.number().int().min(1).max(GIFT_MAX_PAGE).default(1),
});

const httpsUrl = (message: string) => httpUrlSchema.refine((v) => v.startsWith('https://'), message);

export const brickfolioConnectSchema = z.object({
  siteUrl: httpsUrl('Use the https:// address of your Brickfolio site'),
  fullSetsCsvUrl: httpsUrl('Paste the published CSV link for the full_sets tab'),
  wishlistCsvUrl: httpsUrl('Paste the published CSV link for the wishlist tab'),
});

export const playshelfConnectSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Enter your Playshelf username')
    .max(50, 'That’s longer than a Playshelf username')
    .refine((v) => !/[*,()\\%"]/.test(v), 'That doesn’t look like a Playshelf username'),
});

export const notificationsReadSchema = z.object({
  ids: z.array(z.string().max(64)).max(200).optional(),
  all: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ItemCreateInput = z.infer<typeof itemCreateSchema>;
export type ItemBulkCreateInput = z.infer<typeof itemBulkCreateSchema>;
export type ItemUpdateInput = z.infer<typeof itemUpdateSchema>;
export type OwnershipInput = z.infer<typeof ownershipSchema>;
export type GotItInput = z.infer<typeof gotItSchema>;
export type WishlistCreateInput = z.infer<typeof wishlistCreateSchema>;
export type WishlistUpdateInput = z.infer<typeof wishlistUpdateSchema>;
export type BoxCreateInput = z.infer<typeof boxCreateSchema>;
export type BoxUpdateInput = z.infer<typeof boxUpdateSchema>;

/** Flatten a ZodError into `{ "field.path": "message" }`. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
