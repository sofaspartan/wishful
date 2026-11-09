import { beforeEach, describe, expect, it } from 'vitest';
import { Agent, freshStore, signUp } from './helpers';

beforeEach(freshStore);

describe('authentication', () => {
  it('registers, keeps a session, logs out and logs back in', async () => {
    const { agent, user, creds } = await signUp();
    expect(user.email).toBe(creds.email);
    expect(user).not.toHaveProperty('passwordHash');

    const me = await agent.get('/api/auth/me');
    expect(me.data.user.id).toBe(user.id);

    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).data.user).toBeNull();

    const login = await agent.post('/api/auth/login', { email: creds.email.toUpperCase(), password: creds.password });
    expect(login.status).toBe(200);
    expect((await agent.get('/api/auth/me')).data.user.id).toBe(user.id);
  });

  it('sets a secure, HttpOnly, SameSite cookie', async () => {
    const agent = new Agent();
    const res = await agent.post('/api/auth/register', { email: 'a@example.com', password: 'password123', displayName: 'A' });
    const cookie = res.headers.getSetCookie()[0];
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('rejects duplicate emails and usernames', async () => {
    const { creds } = await signUp(new Agent(), { username: 'taken_name' });
    const dupEmail = await new Agent().post('/api/auth/register', { ...creds, username: 'other_name' });
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.data.error.fields.email).toBeTruthy();
    const dupUser = await new Agent().post('/api/auth/register', { email: 'new@example.com', password: 'password123', displayName: 'X', username: 'taken_name' });
    expect(dupUser.status).toBe(409);
    expect(dupUser.data.error.fields.username).toBeTruthy();
  });

  it('validates registration input', async () => {
    const res = await new Agent().post('/api/auth/register', { email: 'not-an-email', password: 'short', displayName: '' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.data.error.fields)).toEqual(expect.arrayContaining(['email', 'password', 'displayName']));
  });

  it('gives the same error for unknown email and wrong password', async () => {
    const { creds } = await signUp();
    const wrong = await new Agent().post('/api/auth/login', { email: creds.email, password: 'nope-nope-nope' });
    const unknown = await new Agent().post('/api/auth/login', { email: 'ghost@example.com', password: 'nope-nope-nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.data.error.message).toBe(unknown.data.error.message);
  });

  it('rate-limits repeated login attempts', async () => {
    const { creds } = await signUp();
    const agent = new Agent('198.51.100.7');
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await agent.post('/api/auth/login', { email: creds.email, password: 'wrong-password' })).status;
    expect(last).toBe(429);
  });

  it('protects private routes', async () => {
    const anon = new Agent();
    expect((await anon.get('/api/wishlists')).status).toBe(401);
    expect((await anon.get('/api/items')).status).toBe(401);
    expect((await anon.post('/api/items', { title: 'x' })).status).toBe(401);
  });

  it('requires the CSRF header on state-changing requests', async () => {
    const { agent } = await signUp();
    const res = await agent.request('POST', '/api/wishlists', { title: 'x' }, { 'x-requested-with': '' });
    expect(res.status).toBe(403);
  });

  it('changing the password signs out other sessions', async () => {
    const { agent, creds } = await signUp();
    const other = new Agent();
    await other.post('/api/auth/login', { email: creds.email, password: creds.password });
    expect((await other.get('/api/auth/me')).data.user).not.toBeNull();

    // Sessions are ordered by timestamp; ensure a distinct millisecond.
    await new Promise((r) => setTimeout(r, 5));
    const change = await agent.post('/api/auth/change-password', { currentPassword: creds.password, newPassword: 'brand new password' });
    expect(change.status).toBe(200);
    expect((await agent.get('/api/auth/me')).data.user).not.toBeNull();
    expect((await other.get('/api/auth/me')).data.user).toBeNull();

    const bad = await agent.post('/api/auth/change-password', { currentPassword: 'wrong', newPassword: 'another password' });
    expect(bad.status).toBe(400);
  });

  it('resets a forgotten password with a single-use token', async () => {
    const { creds } = await signUp();
    const anon = new Agent();
    const forgot = await anon.post('/api/auth/forgot', { email: creds.email });
    expect(forgot.status).toBe(200);
    const token = new URL(forgot.data.devResetUrl).searchParams.get('token')!;

    // Unknown emails get the same response shape (no enumeration).
    const unknown = await anon.post('/api/auth/forgot', { email: 'nobody@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.data.devResetUrl).toBeUndefined();

    const reset = await anon.post('/api/auth/reset', { token, password: 'my new password' });
    expect(reset.status).toBe(200);
    expect((await anon.post('/api/auth/reset', { token, password: 'again again' })).status).toBe(400);
    const login = await new Agent().post('/api/auth/login', { email: creds.email, password: 'my new password' });
    expect(login.status).toBe(200);
  });

  it('updates the profile and enforces unique usernames', async () => {
    const { agent } = await signUp(new Agent(), { username: 'first_user' });
    await signUp(new Agent(), { username: 'second_user' });
    const ok = await agent.patch('/api/account/profile', { displayName: 'Renamed', username: 'brand_new', bio: 'Hi!' });
    expect(ok.status).toBe(200);
    expect(ok.data.user.username).toBe('brand_new');
    const clash = await agent.patch('/api/account/profile', { username: 'second_user' });
    expect(clash.status).toBe(409);
    // The old username is released for others.
    const reuse = await new Agent().post('/api/auth/register', { email: 'z@example.com', password: 'password123', displayName: 'Z', username: 'first_user' });
    expect(reuse.status).toBe(201);
  });

  it('updates preferences', async () => {
    const { agent } = await signUp();
    const res = await agent.patch('/api/account/preferences', {
      defaultVisibility: 'private',
      notifications: { emailSharing: false },
      defaultSettings: { reservationDays: 7 },
    });
    expect(res.data.user.preferences.defaultVisibility).toBe('private');
    expect(res.data.user.preferences.notifications.emailSharing).toBe(false);
    expect(res.data.user.preferences.notifications.emailOccasionReminders).toBe(true);
    expect(res.data.user.preferences.defaultSettings.reservationDays).toBe(7);
  });

  it('deletes the account and everything it owns', async () => {
    const { agent, creds } = await signUp();
    const list = await agent.post('/api/wishlists', { title: 'Gone soon', visibility: 'unlisted' });
    const token = list.data.wishlist.shareToken;
    expect((await new Agent().get(`/api/public/lists/${token}`)).status).toBe(200);

    expect((await agent.del('/api/account', { password: 'wrong' })).status).toBe(400);
    expect((await agent.del('/api/account', { password: creds.password })).status).toBe(200);
    expect((await agent.get('/api/auth/me')).data.user).toBeNull();
    expect((await new Agent().get(`/api/public/lists/${token}`)).status).toBe(404);
    expect((await new Agent().post('/api/auth/login', { email: creds.email, password: creds.password })).status).toBe(401);
    // Email can be reused.
    expect((await new Agent().post('/api/auth/register', creds)).status).toBe(201);
  });
});
