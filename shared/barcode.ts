/** Digits-only retail barcodes (UPC-A / EAN-8 / EAN-13 / GTIN). */
const BARCODE_RE = /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/;

/** Strip spaces, dashes and leading zeros noise from a scanned / typed code. */
export function normalizeBarcode(raw: string): string {
  return String(raw || '').replace(/[\s\-]/g, '').trim();
}

export function isValidBarcode(code: string): boolean {
  const normalized = normalizeBarcode(code);
  if (!BARCODE_RE.test(normalized)) return false;
  // Reject all-zero / trivial codes
  if (/^0+$/.test(normalized)) return false;
  return true;
}

/** Prefer a 12-digit UPC when an EAN-13 is just a leading-zero UPC-A. */
export function canonicalBarcode(code: string): string {
  const normalized = normalizeBarcode(code);
  if (normalized.length === 13 && normalized.startsWith('0') && isValidBarcode(normalized.slice(1))) {
    return normalized.slice(1);
  }
  return normalized;
}

export interface BarcodeProduct {
  barcode: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  description: string | null;
  category: string | null;
  /** Best product page we know about, if any. */
  url: string | null;
  retailer: string | null;
  price: number | null;
  currency: string | null;
  source: string;
  found: boolean;
  message?: string;
}
