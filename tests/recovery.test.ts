import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/storage';
import type { UserRecord } from '../server/records';
import { Agent, freshStore, signUp } from './helpers';

beforeEach(freshStore);

async function register(agent = new Agent()) {
  const creds = { email: `sam-${Math.random().toString(36).slice(2, 7)}@example.com`, password: 'correct horse battery', displayName: 'Sam' };
  const res = await agent.post('/api/auth/register', creds);
  expect(res.status).toBe(201);
  return { agent, creds, user: res.data.user, code: res.data.recoveryCode as string };
}

describe('recovery codes', () => {
  it('gives a new account a code once and stores only its hash', async () => {
    const { agent, user, code } = await register();
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}(-[2-9A-HJKMNP-Z]{4}){4}$/);
    expect(user.recoveryCodeCreatedAt).toBeTruthy();

    const me = await agent.get('/api/auth/me');
    expect(JSON.stringify(me.data)).not.toContain(code);
    expect(me.data.user).not.toHaveProperty('recoveryCodeHash');

    const stored = (await db('users').get<UserRecord>(user.id))!.value;
    expect(JSON.stringify(stored)).not.toContain(code);
    expect(stored.recoveryCodeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('resets the password with the code, signs out everywhere and replaces the code', async () => {
    const { agent: oldDevice, creds, code } = await register();
    const helper = new Agent('203.0.113.50');

    // Typed in lowercase without dashes still works.
    const res = await helper.post('/api/auth/recover', {
      email: creds.email.toUpperCase(),
      code: code.toLowerCase().replace(/-/g, ' '),
      password: 'a brand new password',
    });
    expect(res.status).toBe(200);
    expect(res.data.user.email).toBe(creds.email);
    expect(res.data.recoveryCode).toMatch(/^[2-9A-Z-]{24}$/);
    expect(res.data.recoveryCode).not.toBe(code);

    expect((await helper.get('/api/auth/me')).data.user?.email).toBe(creds.email);
    expect((await oldDevice.get('/api/auth/me')).data.user).toBeNull();

    const login = (password: string) => new Agent().post('/api/auth/login', { email: creds.email, password });
    expect((await login(creds.password)).status).toBe(401);
    expect((await login('a brand new password')).status).toBe(200);

    // The old code is used up; the new one works.
    const reuse = await new Agent('203.0.113.51').post('/api/auth/recover', { email: creds.email, code, password: 'yet another password' });
    expect(reuse.status).toBe(400);
    const next = await new Agent('203.0.113.52').post('/api/auth/recover', { email: creds.email, code: res.data.recoveryCode, password: 'yet another password' });
    expect(next.status).toBe(200);
  });

  it('gives the same answer for a wrong code and an unknown email', async () => {
    const { creds, code } = await register();
    const wrong = await new Agent('203.0.113.60').post('/api/auth/recover', {
      email: creds.email,
      code: 'AAAA-BBBB-CCCC-DDDD-EEEE',
      password: 'a brand new password',
    });
    const unknown = await new Agent('203.0.113.61').post('/api/auth/recover', {
      email: 'nobody@example.com',
      code,
      password: 'a brand new password',
    });
    expect(wrong.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(wrong.data).toEqual(unknown.data);
    expect(wrong.data.error.fields.code).toMatch(/don’t match/);
    expect((await new Agent().post('/api/auth/login', creds)).status).toBe(200);
  });

  it('limits guessing per account even across addresses', async () => {
    const { creds } = await register();
    let last = 0;
    for (let i = 0; i < 11; i++) {
      const res = await new Agent(`198.51.100.${i + 1}`).post('/api/auth/recover', {
        email: creds.email,
        code: 'AAAA-BBBB-CCCC-DDDD-EEEE',
        password: 'a brand new password',
      });
      last = res.status;
    }
    expect(last).toBe(429);
  });

  it('can be replaced from Settings with the password, which retires the old code', async () => {
    const { agent, creds, code } = await register();
    expect((await agent.post('/api/account/recovery-code', { password: 'not my password' })).status).toBe(400);
    expect((await new Agent().post('/api/account/recovery-code', { password: creds.password })).status).toBe(401);

    const res = await agent.post('/api/account/recovery-code', { password: creds.password });
    expect(res.status).toBe(200);
    expect(res.data.recoveryCode).not.toBe(code);
    expect(res.data.user.recoveryCodeCreatedAt).toBeTruthy();
    // Replacing the code doesn't sign anyone out.
    expect((await agent.get('/api/auth/me')).data.user).not.toBeNull();

    const old = await new Agent('203.0.113.70').post('/api/auth/recover', { email: creds.email, code, password: 'a brand new password' });
    expect(old.status).toBe(400);
    const fresh = await new Agent('203.0.113.71').post('/api/auth/recover', {
      email: creds.email,
      code: res.data.recoveryCode,
      password: 'a brand new password',
    });
    expect(fresh.status).toBe(200);
  });

  it('lets accounts made before recovery codes create one, and refuses recovery until then', async () => {
    const { agent, user, creds } = await signUp();
    await db('users').set(user.id, { ...(await db('users').get<UserRecord>(user.id))!.value, recoveryCodeHash: undefined, recoveryCodeCreatedAt: undefined });
    expect((await agent.get('/api/auth/me')).data.user.recoveryCodeCreatedAt).toBeNull();

    const blocked = await new Agent('203.0.113.80').post('/api/auth/recover', { email: creds.email, code: 'AAAA-BBBB-CCCC-DDDD-EEEE', password: 'a brand new password' });
    expect(blocked.status).toBe(400);

    const res = await agent.post('/api/account/recovery-code', { password: creds.password });
    expect(res.status).toBe(200);
    const ok = await new Agent('203.0.113.81').post('/api/auth/recover', { email: creds.email, code: res.data.recoveryCode, password: 'a brand new password' });
    expect(ok.status).toBe(200);
  });

  it('tells the app whether email reset is available', async () => {
    const res = await new Agent().get('/api/auth/options');
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ emailReset: false });
  });
});
