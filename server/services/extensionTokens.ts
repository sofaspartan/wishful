import { atomicUpdate, atomicUpdateExisting, db } from '../storage';
import { unauthorized, type RequestContext } from '../http';
import type { ExtensionTokenRecord, ExtensionTokensDoc, UserRecord } from '../records';
import type { ExtensionConnection } from '../../shared/types';
import { newId, newToken, now, nowIso, safeEqual, sha256 } from '../util';

const PREFIX = 'wfx_';
const MAX_TOKENS = 10;
/** `lastUsedAt` is only rewritten when older than this, so saving items doesn't add a write per request. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const TOKEN_RE = /^wfx_([A-Za-z0-9_-]{6,64})\.([A-Za-z0-9_-]{43})$/;

const store = () => db('extension-tokens');

const toConnection = (t: ExtensionTokenRecord): ExtensionConnection => ({
  id: t.id,
  label: t.label,
  createdAt: t.createdAt,
  lastUsedAt: t.lastUsedAt,
});

/** Tokens issued before a password change or reset stop working, like sessions. */
const stillValid = (t: ExtensionTokenRecord, user: UserRecord) => new Date(t.createdAt) >= new Date(user.sessionsValidAfter);

/** "Chrome on macOS" style label for the Settings list. Never used for authorization. */
export function browserLabel(userAgent: string | null): string {
  const ua = userAgent ?? '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua)
      ? 'macOS'
      : /CrOS/.test(ua)
        ? 'ChromeOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return os ? `${browser} on ${os}` : browser;
}

/** Issue a new token. The plain token is returned once and never stored. Oldest connections beyond the limit are dropped. */
export async function createExtensionToken(user: UserRecord, label: string): Promise<{ token: string; connection: ExtensionConnection }> {
  const secret = newToken();
  const record: ExtensionTokenRecord = { id: newId(), secretHash: sha256(secret), label, createdAt: nowIso(), lastUsedAt: null };
  await atomicUpdate<ExtensionTokensDoc>(store(), user.id, (doc) => {
    const kept = (doc?.tokens ?? []).filter((t) => stillValid(t, user));
    return { tokens: [record, ...kept].slice(0, MAX_TOKENS) };
  });
  return { token: `${PREFIX}${user.id}.${secret}`, connection: toConnection(record) };
}

export async function listExtensionConnections(user: UserRecord): Promise<ExtensionConnection[]> {
  const doc = (await store().get<ExtensionTokensDoc>(user.id))?.value;
  return (doc?.tokens ?? []).filter((t) => stillValid(t, user)).map(toConnection);
}

/** Returns false when there was no such connection. */
export async function revokeExtensionToken(userId: string, id: string): Promise<boolean> {
  let found = false;
  await atomicUpdateExisting<ExtensionTokensDoc>(store(), userId, (doc) => {
    found = doc.tokens.some((t) => t.id === id);
    return { tokens: doc.tokens.filter((t) => t.id !== id) };
  });
  return found;
}

export const deleteExtensionTokens = (userId: string) => store().delete(userId);

/**
 * The user behind an extension's `Authorization: Bearer` token. Only the
 * `/api/extension/*` routes call this — every other route authenticates with
 * the session cookie alone, so a token can't be used for anything else.
 */
export async function requireExtensionUser(ctx: RequestContext): Promise<{ user: UserRecord; tokenId: string }> {
  const header = ctx.req.headers.get('authorization') ?? '';
  const match = TOKEN_RE.exec(header.replace(/^Bearer\s+/i, '').trim());
  if (!match) throw unauthorized('Connect the extension to your account first.');
  const [, userId, secret] = match;
  const [userRes, docRes] = await Promise.all([db('users').get<UserRecord>(userId), store().get<ExtensionTokensDoc>(userId)]);
  const hash = sha256(secret);
  const token = docRes?.value.tokens.find((t) => safeEqual(t.secretHash, hash));
  const user = userRes?.value;
  if (!user || !token || !stillValid(token, user)) throw unauthorized('This extension was disconnected. Connect it again to keep saving.');

  const current = now();
  if (!token.lastUsedAt || current.getTime() - new Date(token.lastUsedAt).getTime() > TOUCH_INTERVAL_MS) {
    await atomicUpdateExisting<ExtensionTokensDoc>(store(), userId, (doc) => ({
      tokens: doc.tokens.map((t) => (t.id === token.id ? { ...t, lastUsedAt: current.toISOString() } : t)),
    })).catch(() => undefined);
  }
  return { user, tokenId: token.id };
}
