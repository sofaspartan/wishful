import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

let clockOffsetMs = 0;

/** Current time. Tests can shift it with `advanceClock` to exercise expiry. */
export const now = () => new Date(Date.now() + clockOffsetMs);
export const nowIso = () => now().toISOString();
export const advanceClock = (ms: number) => {
  clockOffsetMs += ms;
};
export const resetClock = () => {
  clockOffsetMs = 0;
};

/** URL-safe random identifier (default 96 bits). */
export const newId = (bytes = 12) => randomBytes(bytes).toString('base64url');

/** High-entropy secret token (256 bits) for sessions, share links and claims. */
export const newToken = () => randomBytes(32).toString('base64url');

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function appUrl(req?: Request): string {
  const configured = process.env.APP_URL || process.env.URL;
  if (configured) return configured.replace(/\/$/, '');
  if (req) return new URL(req.url).origin;
  return 'http://localhost:5173';
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Drop keys whose value is undefined, null or an empty string. */
export function compact<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
