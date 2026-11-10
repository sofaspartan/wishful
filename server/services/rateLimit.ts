import { HttpError } from '../http';
import { atomicUpdate, db } from '../storage';
import { now, sha256 } from '../util';

interface Bucket {
  count: number;
  expiresAt: string;
}

export const RATE_LIMITS = {
  login: { limit: 10, windowSec: 15 * 60 },
  register: { limit: 10, windowSec: 60 * 60 },
  forgot: { limit: 5, windowSec: 60 * 60 },
  recover: { limit: 10, windowSec: 60 * 60 },
  recoveryCode: { limit: 10, windowSec: 60 * 60 },
  claim: { limit: 40, windowSec: 10 * 60 },
  metadata: { limit: 150, windowSec: 60 * 60 },
  /** One request per page of 10 items, so a full 500-item list is 50. */
  listImport: { limit: 200, windowSec: 60 * 60 },
  upload: { limit: 100, windowSec: 60 * 60 },
  invite: { limit: 30, windowSec: 60 * 60 },
  friend: { limit: 40, windowSec: 60 * 60 },
  extensionConnect: { limit: 20, windowSec: 60 * 60 },
  extensionSave: { limit: 300, windowSec: 60 * 60 },
  extensionImport: { limit: 120, windowSec: 60 * 60 },
  integrationSync: { limit: 30, windowSec: 60 * 60 },
} as const;

/**
 * Fixed-window rate limiter backed by the `ratelimits` store. Keys are hashed
 * so IPs/emails are not stored in plain text. Expired buckets are swept by the
 * scheduled maintenance job.
 */
export async function rateLimit(bucket: keyof typeof RATE_LIMITS, key: string): Promise<void> {
  if (process.env.RATE_LIMIT_DISABLED === '1') return;
  const { limit, windowSec } = RATE_LIMITS[bucket];
  const windowMs = windowSec * 1000;
  const t = now().getTime();
  const windowStart = Math.floor(t / windowMs) * windowMs;
  const id = `${bucket}:${sha256(key).slice(0, 32)}:${windowStart}`;
  const result = await atomicUpdate<Bucket>(db('ratelimits'), id, (current) => ({
    count: (current?.count ?? 0) + 1,
    expiresAt: new Date(windowStart + windowMs).toISOString(),
  }));
  if (result.count > limit) {
    const retryAfter = Math.ceil((windowStart + windowMs - t) / 1000);
    throw new HttpError(429, `Too many attempts. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`, 'rate_limited');
  }
}
