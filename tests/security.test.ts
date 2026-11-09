import { beforeEach, describe, expect, it } from 'vitest';
import { assertSafeUrl, isBlockedAddress, UnsafeUrlError } from '../server/services/safeFetch';
import { extractMetadata, retailerFromUrl } from '../server/services/metadata';
import { sniffImageType } from '../server/routes/misc';
import { Agent, createList, freshStore, signUp } from './helpers';
import { runDailyJobs } from '../server/jobs';
import { advanceClock } from '../server/util';

beforeEach(freshStore);

describe('SSRF protection', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '64:ff9b::a00:1',
  ])('blocks %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111'])('allows public address %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });

  it.each([
    'file:///etc/passwd',
    'ftp://example.com/x',
    'http://localhost/admin',
    'http://foo.localhost/',
    'http://printer.local/',
    'http://metadata.google.internal/',
    'http://intranet/',
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://user:pass@example.com/',
    'http://example.com:22/',
    'gopher://example.com/',
  ])('rejects %s', (url) => {
    expect(() => assertSafeUrl(url)).toThrow(UnsafeUrlError);
  });

  it('accepts ordinary shop links', () => {
    expect(assertSafeUrl('https://www.example.com/products/123?ref=x').hostname).toBe('www.example.com');
  });

  it('the metadata endpoint refuses internal addresses', async () => {
    const { agent } = await signUp();
    const res = await agent.post('/api/metadata', { url: 'http://127.0.0.1:80/' });
    expect(res.status).toBe(400);
    expect((await new Agent().post('/api/metadata', { url: 'https://example.com' })).status).toBe(401);
  });
});

describe('metadata extraction', () => {
  it('reads JSON-LD product data', () => {
    const html = `<html><head><title>Ignore me</title>
      <meta property="og:site_name" content="Acme Store">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList"},{"@type":"Product","name":"Acme Kettle &amp; Stand","description":"Boils water.","image":["/img/kettle.jpg"],"brand":{"@type":"Brand","name":"Acme"},"offers":{"@type":"Offer","price":"49.95","priceCurrency":"usd"}}]}</script>
      </head><body></body></html>`;
    const meta = extractMetadata(html, 'https://shop.example.com/p/kettle');
    expect(meta).toMatchObject({
      title: 'Acme Kettle & Stand',
      description: 'Boils water.',
      imageUrl: 'https://shop.example.com/img/kettle.jpg',
      price: 49.95,
      currency: 'USD',
      brand: 'Acme',
      retailer: 'Acme Store',
    });
  });

  it('falls back to Open Graph and meta tags', () => {
    const html = `<head>
      <meta content="Cozy Blanket" property="og:title" />
      <meta name="description" content="Very warm">
      <meta property="og:image" content="https://cdn.example.com/b.jpg">
      <meta property="product:price:amount" content="1.299,00">
      <meta property="product:price:currency" content="EUR">
      </head>`;
    const meta = extractMetadata(html, 'https://www.blankets.co.uk/cozy');
    expect(meta).toMatchObject({ title: 'Cozy Blanket', description: 'Very warm', imageUrl: 'https://cdn.example.com/b.jpg', price: 1299, currency: 'EUR' });
    expect(meta.retailer).toBe('Blankets');
    expect(retailerFromUrl('https://www.amazon.com/dp/1')).toBe('Amazon');
  });

  it('ignores javascript: image URLs', () => {
    const meta = extractMetadata('<meta property="og:image" content="javascript:alert(1)"><title>T</title>', 'https://example.com');
    expect(meta.imageUrl).toBeNull();
    expect(meta.title).toBe('T');
  });
});

describe('image uploads', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

  it('sniffs real image types and rejects SVG/HTML', () => {
    expect(sniffImageType(png)).toBe('image/png');
    expect(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode('<html><script>alert(1)</script></html>'))).toBeNull();
  });

  it('stores and serves an uploaded image', async () => {
    const { agent } = await signUp();
    const up = await agent.request('POST', '/api/images', png, { 'content-type': 'image/png' });
    expect(up.status).toBe(201);
    const served = await new Agent().get(up.data.url);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/png');
    expect(served.headers.get('x-content-type-options')).toBe('nosniff');

    const svg = await agent.request('POST', '/api/images', new TextEncoder().encode('<svg onload="alert(1)"></svg>'), { 'content-type': 'image/svg+xml' });
    expect(svg.status).toBe(400);
    expect((await new Agent().request('POST', '/api/images', png)).status).toBe(401);
  });
});

describe('daily jobs', () => {
  it('sends a single occasion reminder and sweeps expired sessions', async () => {
    const { agent } = await signUp();
    const inFiveDays = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await createList(agent, { title: 'Party', occasion: 'Birthday', eventDate: inFiveDays });
    await createList(agent, { title: 'Far away', eventDate: '2099-01-01' });

    expect((await runDailyJobs()).reminders).toBe(1);
    expect((await runDailyJobs()).reminders).toBe(0);
    const notes = await agent.get('/api/notifications');
    expect(notes.data.notifications.filter((n: any) => n.type === 'occasion_upcoming')).toHaveLength(1);

    const read = await agent.post('/api/notifications/read', { all: true });
    expect(read.data.notifications.every((n: any) => n.readAt)).toBe(true);

    advanceClock(40 * 86_400_000);
    const swept = await runDailyJobs();
    expect(swept.swept).toBeGreaterThan(0);
    expect((await agent.get('/api/auth/me')).data.user).toBeNull();
  });
});
