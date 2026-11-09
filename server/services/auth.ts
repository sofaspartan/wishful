import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { atomicUpdate, db } from '../storage';
import { parseCookies, serializeCookie, unauthorized, type RequestContext } from '../http';
import type { SessionRecord, UserIndex, UserRecord } from '../records';
import { newToken, now, nowIso, sha256 } from '../util';

export const SESSION_COOKIE = 'wishful_session';
const SESSION_TTL_DAYS = 30;
/** Refresh the cookie/expiry when less than this much lifetime remains. */
const SESSION_REFRESH_DAYS = 23;

// ── Passwords (scrypt, per-user random salt) ────────────────────────────────

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 64 * 1024 * 1024,
  });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Pre-computed hash used to keep login timing uniform for unknown emails. */
let dummyHash: Promise<string> | null = null;
export const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password-for-timing'));

// ── Sessions ────────────────────────────────────────────────────────────────

const isSecure = (req: Request) => new URL(req.url).protocol === 'https:';

export async function createSession(ctx: RequestContext, userId: string): Promise<void> {
  const token = newToken();
  const created = now();
  const record: SessionRecord = {
    userId,
    createdAt: created.toISOString(),
    expiresAt: new Date(created.getTime() + SESSION_TTL_DAYS * 86_400_000).toISOString(),
  };
  await db('sessions').set(sha256(token), record);
  ctx.responseHeaders.append(
    'set-cookie',
    serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_DAYS * 86_400, secure: isSecure(ctx.req) }),
  );
}

export async function destroySession(ctx: RequestContext): Promise<void> {
  const token = parseCookies(ctx.req)[SESSION_COOKIE];
  if (token) await db('sessions').delete(sha256(token));
  ctx.responseHeaders.append('set-cookie', serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure: isSecure(ctx.req) }));
}

const userCache = new WeakMap<Request, Promise<UserRecord | null>>();

async function resolveUser(ctx: RequestContext): Promise<UserRecord | null> {
  const token = parseCookies(ctx.req)[SESSION_COOKIE];
  if (!token || token.length > 200) return null;
  const key = sha256(token);
  const session = await db('sessions').get<SessionRecord>(key);
  if (!session) return null;
  const s = session.value;
  const current = now();
  if (new Date(s.expiresAt) <= current) {
    await db('sessions').delete(key);
    return null;
  }
  const user = await db('users').get<UserRecord>(s.userId);
  if (!user) return null;
  // Sessions created before a password change/reset are no longer valid.
  if (new Date(s.createdAt) < new Date(user.value.sessionsValidAfter)) return null;

  // Sliding expiration: extend active sessions periodically.
  const remainingDays = (new Date(s.expiresAt).getTime() - current.getTime()) / 86_400_000;
  if (remainingDays < SESSION_REFRESH_DAYS) {
    const expiresAt = new Date(current.getTime() + SESSION_TTL_DAYS * 86_400_000).toISOString();
    await db('sessions').set(key, { ...s, expiresAt });
    ctx.responseHeaders.append(
      'set-cookie',
      serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_DAYS * 86_400, secure: isSecure(ctx.req) }),
    );
  }
  return user.value;
}

/** The signed-in user for this request, or null. Resolved once per request. */
export function getCurrentUser(ctx: RequestContext): Promise<UserRecord | null> {
  let p = userCache.get(ctx.req);
  if (!p) {
    p = resolveUser(ctx);
    userCache.set(ctx.req, p);
  }
  return p;
}

export async function requireUser(ctx: RequestContext): Promise<UserRecord> {
  const user = await getCurrentUser(ctx);
  if (!user) throw unauthorized();
  return user;
}

// ── User index helpers ──────────────────────────────────────────────────────

export const emptyIndex = (): UserIndex => ({ wishlistIds: [], itemIds: [], sharedWishlistIds: [], imageIds: [] });

export async function getUserIndex(userId: string): Promise<UserIndex> {
  const res = await db('user-index').get<UserIndex>(userId);
  return { ...emptyIndex(), ...(res?.value ?? {}) };
}

export function updateUserIndex(userId: string, mutate: (index: UserIndex) => void): Promise<UserIndex> {
  return atomicUpdate<UserIndex>(db('user-index'), userId, (current) => {
    const index = { ...emptyIndex(), ...(current ?? {}) };
    mutate(index);
    return index;
  });
}

export async function invalidateOtherSessions(userId: string): Promise<void> {
  await atomicUpdate<UserRecord>(db('users'), userId, (u) => {
    if (!u) throw unauthorized();
    return { ...u, sessionsValidAfter: nowIso(), updatedAt: nowIso() };
  });
}
