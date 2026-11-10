/** Shapes shared by every site sync (no I/O here, so the data readers stay pure). */

/** A problem worth showing the user as-is (bad link, private library, missing column…). */
export class SyncError extends Error {}

/** The item fields a source owns; everything else stays editable in Wishful. */
export interface SyncedFields {
  title: string;
  description: string;
  imageUrl: string | null;
  gallery: string[];
  externalUrl: string;
  retailer: string;
  brand: string;
  price: number | null;
  currency: string;
  category: string;
  tags: string[];
  /** Model / set number; empty leaves none. */
  model: string;
}

export interface DesiredItem {
  /** The item's id at the source. */
  key: string;
  fields: SyncedFields;
  /** Present when the source says the user has it. */
  owned: { quantity: number; rating: number | null; review: string } | null;
}
