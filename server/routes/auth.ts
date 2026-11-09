import {
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  newRecoveryCodeSchema,
  preferencesUpdateSchema,
  profileUpdateSchema,
  recoverAccountSchema,
  registerSchema,
  resetPasswordSchema,
} from '../../shared/schemas';
import { DEFAULT_PREFERENCES } from '../../shared/constants';
import { atomicUpdate, atomicUpdateExisting, db, images, isLocalDev } from '../storage';
import { HttpError, badRequest, json, readJson, unauthorized, type Router } from '../http';
import type { InviteRecord, ResetRecord, UserRecord } from '../records';
import {
  createSession,
  destroySession,
  getCurrentUser,
  getDummyHash,
  getUserIndex,
  hashPassword,
  requireUser,
  updateUserIndex,
  verifyPassword,
} from '../services/auth';
import { rateLimit } from '../services/rateLimit';
import { deleteExtensionTokens } from '../services/extensionTokens';
import { emailConfigured, sendEmail } from '../services/email';
import { hashRecoveryCode, newRecoveryCode, recoveryCodeMatches } from '../services/recoveryCode';
import { notify } from '../services/notifications';
import { toSelfUser } from '../serialize';
import { appUrl, newId, newToken, now, nowIso, sha256 } from '../util';
import { deleteWishlist, getWishlist, listOwnedWishlists, mutateWishlist } from '../domain/wishlists';
import { listOwnedItems } from '../domain/items';
import { deleteAllFriendships } from '../domain/friends';
import { BRAND_NAME } from '../brand';

const RESET_TTL_MS = 60 * 60 * 1000;

function slugifyUsername(displayName: string, email: string): string {
  const base = (displayName || email.split('@')[0])
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
  return base.length >= 3 ? base : `${base || 'user'}${'_'.repeat(Math.max(0, 3 - (base || 'user').length))}`;
}

/** Reserve a username atomically (unique index via `onlyIfNew`). */
async function reserveUsername(username: string, userId: string): Promise<boolean> {
  const res = await db('username-index').set(username, { userId }, { onlyIfNew: true });
  return res.modified;
}

async function reserveGeneratedUsername(displayName: string, email: string, userId: string): Promise<string> {
  const base = slugifyUsername(displayName, email);
  if (await reserveUsername(base, userId)) return base;
  for (let i = 0; i < 8; i++) {
    const candidate = `${base.slice(0, 24)}_${Math.floor(1000 + Math.random() * 9000)}`;
    if (await reserveUsername(candidate, userId)) return candidate;
  }
  const fallback = `user_${newId(6).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  if (await reserveUsername(fallback, userId)) return fallback;
  throw new HttpError(503, 'Could not create your account right now. Please try again.');
}

/** Turn invitations sent to this email before the account existed into collaborations. */
async function applyPendingInvites(user: UserRecord): Promise<void> {
  const key = sha256(user.email);
  const res = await db('invites').get<InviteRecord>(key);
  if (!res) return;
  for (const invite of res.value.invites) {
    try {
      const w = await getWishlist(invite.wishlistId);
      if (!w || !w.pendingInvites.some((p) => p.email === user.email)) continue;
      await mutateWishlist(w.id, (draft) => {
        draft.pendingInvites = draft.pendingInvites.filter((p) => p.email !== user.email);
        if (!draft.collaborators.some((c) => c.userId === user.id)) {
          draft.collaborators.push({ userId: user.id, role: invite.role, addedAt: nowIso() });
        }
      });
      await updateUserIndex(user.id, (idx) => {
        if (!idx.sharedWishlistIds.includes(w.id)) idx.sharedWishlistIds.unshift(w.id);
      });
      await notify(user.id, 'shared_with_you', `You were invited to collaborate on “${w.title}”.`, `/app/lists/${w.id}`);
    } catch (err) {
      console.error('[invites] failed to apply', err);
    }
  }
  await db('invites').delete(key);
}

export function registerAuthRoutes(router: Router) {
  router.get('/api/auth/me', async (ctx) => {
    const user = await getCurrentUser(ctx);
    return json({ user: user ? toSelfUser(user) : null });
  });

  router.post('/api/auth/register', async (ctx) => {
    await rateLimit('register', ctx.ip);
    const input = await readJson(ctx.req, registerSchema);
    const userId = newId();

    let username: string;
    if (input.username) {
      if (!(await reserveUsername(input.username, userId))) {
        throw new HttpError(409, 'That username is already taken.', 'username_taken', { username: 'That username is already taken.' });
      }
      username = input.username;
    } else {
      username = await reserveGeneratedUsername(input.displayName, input.email, userId);
    }

    const emailRes = await db('email-index').set(sha256(input.email), { userId }, { onlyIfNew: true });
    if (!emailRes.modified) {
      await db('username-index').delete(username);
      throw new HttpError(409, 'An account with that email already exists.', 'email_taken', {
        email: 'An account with that email already exists. Try signing in.',
      });
    }

    const stamp = nowIso();
    const recoveryCode = newRecoveryCode();
    const user: UserRecord = {
      id: userId,
      email: input.email,
      username,
      displayName: input.displayName,
      avatarUrl: null,
      bio: '',
      publicProfile: false,
      preferences: DEFAULT_PREFERENCES,
      passwordHash: await hashPassword(input.password),
      sessionsValidAfter: new Date(0).toISOString(),
      recoveryCodeHash: hashRecoveryCode(recoveryCode),
      recoveryCodeCreatedAt: stamp,
      createdAt: stamp,
      updatedAt: stamp,
    };
    await db('users').set(userId, user, { onlyIfNew: true });
    await applyPendingInvites(user);
    await createSession(ctx, userId);
    // The only time this code is ever sent; just its hash is stored.
    return json({ user: toSelfUser(user), recoveryCode }, 201);
  });

  router.get('/api/auth/options', async () => json({ emailReset: emailConfigured() }));

  router.post('/api/auth/login', async (ctx) => {
    const input = await readJson(ctx.req, loginSchema);
    await rateLimit('login', `${ctx.ip}|${input.email}`);
    const idx = await db('email-index').get<{ userId: string }>(sha256(input.email));
    const user = idx ? (await db('users').get<UserRecord>(idx.value.userId))?.value : null;
    // Always run a hash comparison so response time doesn't reveal whether the email exists.
    const ok = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !ok) throw unauthorized('Incorrect email or password.');
    await createSession(ctx, user.id);
    return json({ user: toSelfUser(user) });
  });

  router.post('/api/auth/logout', async (ctx) => {
    await destroySession(ctx);
    return json({ ok: true });
  });

  router.post('/api/auth/forgot', async (ctx) => {
    await rateLimit('forgot', ctx.ip);
    const { email } = await readJson(ctx.req, forgotPasswordSchema);
    const idx = await db('email-index').get<{ userId: string }>(sha256(email));
    let devResetUrl: string | undefined;
    if (idx) {
      const token = newToken();
      const record: ResetRecord = { userId: idx.value.userId, expiresAt: new Date(now().getTime() + RESET_TTL_MS).toISOString() };
      await db('resets').set(sha256(token), record);
      const url = `${appUrl(ctx.req)}/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: email,
        subject: `Reset your ${BRAND_NAME} password`,
        paragraphs: [
          'We received a request to reset your password.',
          'This link expires in one hour. If you did not request it, you can safely ignore this email.',
        ],
        action: { label: 'Choose a new password', url },
      });
      if (isLocalDev() && !emailConfigured()) devResetUrl = url;
    }
    // Same response whether or not the account exists (prevents email enumeration).
    return json({ ok: true, ...(devResetUrl ? { devResetUrl } : {}) });
  });

  router.post('/api/auth/reset', async (ctx) => {
    const input = await readJson(ctx.req, resetPasswordSchema);
    const key = sha256(input.token);
    const res = await db('resets').get<ResetRecord>(key);
    if (!res || new Date(res.value.expiresAt) <= now()) {
      throw badRequest('This reset link is invalid or has expired. Please request a new one.');
    }
    const passwordHash = await hashPassword(input.password);
    const user = await atomicUpdateExisting<UserRecord>(db('users'), res.value.userId, (u) => ({
      ...u,
      passwordHash,
      sessionsValidAfter: nowIso(),
      updatedAt: nowIso(),
    }));
    await db('resets').delete(key);
    if (!user) throw badRequest('This reset link is invalid or has expired.');
    await createSession(ctx, user.id);
    return json({ user: toSelfUser(user) });
  });

  router.post('/api/auth/recover', async (ctx) => {
    const input = await readJson(ctx.req, recoverAccountSchema);
    await rateLimit('recover', ctx.ip);
    await rateLimit('recover', `email|${input.email}`);
    const mismatch = () =>
      new HttpError(400, 'That email and recovery code don’t match.', 'bad_recovery_code', { code: 'That email and recovery code don’t match.' });
    const idx = await db('email-index').get<{ userId: string }>(sha256(input.email));
    const found = idx ? (await db('users').get<UserRecord>(idx.value.userId))?.value : null;
    if (!found || !recoveryCodeMatches(input.code, found.recoveryCodeHash)) throw mismatch();

    const passwordHash = await hashPassword(input.password);
    const recoveryCode = newRecoveryCode();
    // Re-checked inside the write so a code can't be used twice concurrently.
    const user = await atomicUpdateExisting<UserRecord>(db('users'), found.id, (u) => {
      if (!recoveryCodeMatches(input.code, u.recoveryCodeHash)) throw mismatch();
      const stamp = nowIso();
      return {
        ...u,
        passwordHash,
        sessionsValidAfter: stamp,
        recoveryCodeHash: hashRecoveryCode(recoveryCode),
        recoveryCodeCreatedAt: stamp,
        updatedAt: stamp,
      };
    });
    if (!user) throw mismatch();
    await createSession(ctx, user.id);
    return json({ user: toSelfUser(user), recoveryCode });
  });

  router.post('/api/account/recovery-code', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('recoveryCode', user.id);
    const { password } = await readJson(ctx.req, newRecoveryCodeSchema);
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(400, 'Incorrect password.', 'bad_password', { password: 'Incorrect password.' });
    }
    const recoveryCode = newRecoveryCode();
    const updated = await atomicUpdate<UserRecord>(db('users'), user.id, (u) => {
      if (!u) throw unauthorized();
      const stamp = nowIso();
      return { ...u, recoveryCodeHash: hashRecoveryCode(recoveryCode), recoveryCodeCreatedAt: stamp, updatedAt: stamp };
    });
    return json({ user: toSelfUser(updated), recoveryCode });
  });

  router.post('/api/auth/change-password', async (ctx) => {
    const user = await requireUser(ctx);
    const input = await readJson(ctx.req, changePasswordSchema);
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new HttpError(400, 'Your current password is incorrect.', 'bad_password', {
        currentPassword: 'Your current password is incorrect.',
      });
    }
    const passwordHash = await hashPassword(input.newPassword);
    // Signs out every other device; this device gets a fresh session below.
    await atomicUpdate<UserRecord>(db('users'), user.id, (u) => {
      if (!u) throw unauthorized();
      return { ...u, passwordHash, sessionsValidAfter: nowIso(), updatedAt: nowIso() };
    });
    await createSession(ctx, user.id);
    return json({ ok: true });
  });

  // ── Account ───────────────────────────────────────────────────────────────

  router.patch('/api/account/profile', async (ctx) => {
    const user = await requireUser(ctx);
    const input = await readJson(ctx.req, profileUpdateSchema);
    const oldUsername = user.username;
    if (input.username && input.username !== oldUsername) {
      if (!(await reserveUsername(input.username, user.id))) {
        throw new HttpError(409, 'That username is already taken.', 'username_taken', { username: 'That username is already taken.' });
      }
    }
    const updated = await atomicUpdate<UserRecord>(db('users'), user.id, (u) => {
      if (!u) throw unauthorized();
      return {
        ...u,
        displayName: input.displayName ?? u.displayName,
        username: input.username ?? u.username,
        bio: input.bio ?? u.bio,
        avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : u.avatarUrl,
        publicProfile: input.publicProfile ?? u.publicProfile,
        updatedAt: nowIso(),
      };
    });
    if (input.username && input.username !== oldUsername) await db('username-index').delete(oldUsername);
    return json({ user: toSelfUser(updated) });
  });

  router.patch('/api/account/preferences', async (ctx) => {
    const user = await requireUser(ctx);
    const input = await readJson(ctx.req, preferencesUpdateSchema);
    const updated = await atomicUpdate<UserRecord>(db('users'), user.id, (u) => {
      if (!u) throw unauthorized();
      const current = toSelfUser(u).preferences;
      return {
        ...u,
        preferences: {
          ...current,
          ...(input.defaultVisibility !== undefined && { defaultVisibility: input.defaultVisibility }),
          ...(input.defaultSurpriseMode !== undefined && { defaultSurpriseMode: input.defaultSurpriseMode }),
          ...(input.currency !== undefined && { currency: input.currency }),
          defaultSettings: { ...current.defaultSettings, ...input.defaultSettings },
          notifications: { ...current.notifications, ...input.notifications },
        },
        updatedAt: nowIso(),
      };
    });
    return json({ user: toSelfUser(updated) });
  });

  router.delete('/api/account', async (ctx) => {
    const user = await requireUser(ctx);
    const { password } = await readJson(ctx.req, deleteAccountSchema);
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(400, 'Incorrect password.', 'bad_password', { password: 'Incorrect password.' });
    }
    await deleteAccount(user);
    await destroySession(ctx);
    return json({ ok: true });
  });
}

/** Permanently remove a user and everything they own. */
export async function deleteAccount(user: UserRecord): Promise<void> {
  const idx = await getUserIndex(user.id);
  for (const w of await listOwnedWishlists(user.id)) await deleteWishlist(w);
  for (const item of await listOwnedItems(user.id)) await db('items').delete(item.id);
  for (const wid of idx.sharedWishlistIds) {
    const w = await getWishlist(wid);
    if (w?.collaborators.some((c) => c.userId === user.id)) {
      await mutateWishlist(wid, (draft) => {
        draft.collaborators = draft.collaborators.filter((c) => c.userId !== user.id);
      }).catch(() => undefined);
    }
  }
  await deleteAllFriendships(user.id);
  await Promise.all(idx.imageIds.map((id) => images().delete(id)));
  if (user.avatarUrl?.startsWith('/api/images/')) await images().delete(user.avatarUrl.split('/').pop()!);
  await db('notifications').delete(user.id);
  await deleteExtensionTokens(user.id);
  await db('user-index').delete(user.id);
  await db('email-index').delete(sha256(user.email));
  await db('username-index').delete(user.username);
  await db('users').delete(user.id);
}