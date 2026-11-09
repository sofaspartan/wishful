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
  COLLABORATOR_ROLES,
  CONDITIONS,
  COVER_BACKDROPS,
  COVER_FRAME_FILLS,
  COVER_FRAME_SHAPES,
  COVER_ICONS,
  ITEM_TYPES,
  LIST_KINDS,
  PRIORITIES,
  VISIBILITIES,
} from './types';
import { LIMITS } from './constants';

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
export const itemTypeSchema = z.enum(ITEM_TYPES);
export const collaboratorRoleSchema = z.enum(COLLABORATOR_ROLES);
export const listKindSchema = z.enum(LIST_KINDS);
export const coverFrameSchema = z.object({ shape: z.enum(COVER_FRAME_SHAPES), fill: z.enum(COVER_FRAME_FILLS), color: colorSchema }).strict();
export const coverArtSchema = z.object({ icon: z.enum(COVER_ICONS), backdrop: z.enum(COVER_BACKDROPS), frame: coverFrameSchema.optional() }).strict();

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

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm').max(200),
});

// ── Account ─────────────────────────────────────────────────────────────────

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema.optional(),
  username: usernameSchema.optional(),
  bio: z.string().trim().max(LIMITS.bio).optional(),
  avatarUrl: optionalImageUrlSchema.optional(),
  publicProfile: z.boolean().optional(),
});

export const wishlistSettingsSchema = z.object({
  allowClaims: z.boolean(),
  allowMarkPurchased: z.boolean(),
  showReserved: z.boolean(),
  showPurchased: z.boolean(),
  allowMessages: z.boolean(),
  showPriorities: z.boolean(),
  reservationDays: z.number().int().min(0).max(365),
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

/** Flatten a ZodError into `{ "field.path": "message" }`. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
