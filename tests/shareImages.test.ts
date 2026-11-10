import { beforeEach, describe, expect, it } from 'vitest';
import { brand } from '../src/config/brand';
import { injectMeta, pageMeta } from '../shared/shareMeta';
import { handleOgRequest } from '../server/og';
import { loadImage } from '../server/og/images';
import { plainText } from '../server/og/render';
import { Agent, createItem, createList, freshStore, signUp } from './helpers';

beforeEach(freshStore);

const ORIGIN = 'https://wishful.test';
const PNG_1PX = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));

async function og(path: string) {
  const res = await handleOgRequest(new Request(ORIGIN + path));
  return { status: res.status, type: res.headers.get('content-type'), bytes: new Uint8Array(await res.arrayBuffer()) };
}

const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Page metadata as the edge function builds it: public API, no cookies. */
function meta(path: string) {
  const visitor = new Agent();
  return pageMeta(path, ORIGIN, brand, async (apiPath) => {
    const res = await visitor.get(apiPath);
    return res.status === 200 ? res.data : null;
  });
}

describe('share images', () => {
  it('draws a card for a shared list and the brand card for anything a visitor cannot open', { timeout: 30_000 }, async () => {
    const { agent } = await signUp(new Agent(), { displayName: 'Olivia Test' });
    const list = await createList(agent, { title: 'Christmas 2027 🎄' });
    await createItem(agent, { wishlistIds: [list.id] });
    const friendsOnly = await createList(agent, { title: 'Secret plans', visibility: 'friends' });

    const site = await og('/og/site.png');
    expect(site.status).toBe(200);
    expect(site.type).toBe('image/png');
    expect(isPng(site.bytes)).toBe(true);

    const card = await og(`/og/list/${list.shareToken}.png`);
    expect(card.status).toBe(200);
    expect(isPng(card.bytes)).toBe(true);
    expect(same(card.bytes, site.bytes)).toBe(false);

    for (const token of [friendsOnly.shareToken, 'not-a-real-token-at-all-xxxxxxxx']) {
      const fallback = await og(`/og/list/${token}.png`);
      expect(fallback.status).toBe(200);
      expect(same(fallback.bytes, site.bytes)).toBe(true);
    }

    await agent.patch(`/api/wishlists/${list.id}`, { visibility: 'private' });
    expect(same((await og(`/og/list/${list.shareToken}.png`)).bytes, site.bytes)).toBe(true);

    expect((await og('/og/whatever.png')).status).toBe(404);
  });

  it('only draws public profiles', { timeout: 30_000 }, async () => {
    const { agent, user } = await signUp();
    const site = await og('/og/site.png');
    expect(same((await og(`/og/profile/${user.username}.png`)).bytes, site.bytes)).toBe(true);
    await agent.patch('/api/account/profile', { profileVisibility: 'public' });
    const card = await og(`/og/profile/${user.username}.png`);
    expect(isPng(card.bytes)).toBe(true);
    expect(same(card.bytes, site.bytes)).toBe(false);
  });

  it('reads uploaded images from storage and refuses internal addresses', async () => {
    const { agent } = await signUp();
    const upload = await agent.request('POST', '/api/images', PNG_1PX, { 'content-type': 'image/png' });
    expect(upload.status).toBe(201);
    expect(await loadImage(upload.data.url, 1000)).toMatch(/^data:image\/png;base64,/);
    expect(await loadImage('/api/images/doesnotexist123', 1000)).toBeNull();
    expect(await loadImage('http://127.0.0.1/secret.png', 1000)).toBeNull();
    expect(await loadImage('http://169.254.169.254/latest/meta-data', 1000)).toBeNull();
    expect(await loadImage('file:///etc/passwd', 1000)).toBeNull();
  });

  it('drops emoji the bundled fonts cannot draw', () => {
    expect(plainText('Christmas 2027 🎄', 60)).toBe('Christmas 2027');
    expect(plainText('A very long title that keeps going', 12)).toBe('A very long…');
  });
});

describe('link preview tags', () => {
  it('describes a shared list with its own image', async () => {
    const { agent } = await signUp(new Agent(), { displayName: 'Olivia Test' });
    const list = await createList(agent, { title: 'Christmas 2027' });
    await createItem(agent, { wishlistIds: [list.id] });
    const m = await meta(`/s/${list.shareToken}`);
    expect(m.title).toBe('Christmas 2027 · Wishful');
    expect(m.shareTitle).toBe('Christmas 2027 — Olivia’s wishlist');
    expect(m.description).toContain('1 item on Olivia’s wishlist');
    expect(m.image).toMatch(new RegExp(`^${ORIGIN}/og/list/${list.shareToken}\\.png\\?v=\\w+$`));

    await agent.patch(`/api/wishlists/${list.id}`, { title: 'Holidays' });
    expect((await meta(`/s/${list.shareToken}`)).image).not.toBe(m.image);
  });

  it('gives friends-only and private lists a generic preview', async () => {
    const { agent } = await signUp();
    const list = await createList(agent, { title: 'Secret plans', visibility: 'friends' });
    const m = await meta(`/s/${list.shareToken}`);
    expect(JSON.stringify(m)).not.toContain('Secret plans');
    expect(m.image).toBe(`${ORIGIN}/og/site.png`);
  });

  it('uses the brand card for other pages and escapes what it writes', async () => {
    expect((await meta('/')).image).toBe(`${ORIGIN}/og/site.png`);
    expect((await meta('/extension')).title).toBe('Browser extension · Wishful');

    const html = '<html><head><meta name="description" content="old" /><title>Old</title></head><body></body></html>';
    const out = injectMeta(html, { ...(await meta('/')), title: 'A <b>"bold"</b> list', shareTitle: '</title><script>x</script>' }, 'Wishful');
    expect(out).toContain('<title>A &lt;b&gt;&quot;bold&quot;&lt;/b&gt; list</title>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('content="old"');
    expect(out).toContain('property="og:image" content="https://wishful.test/og/site.png"');
    expect(out).toContain('name="twitter:card" content="summary_large_image"');
  });
});
