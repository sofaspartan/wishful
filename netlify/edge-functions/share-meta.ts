import { brand } from '../../src/config/brand.ts';
import { injectMeta, pageMeta } from '../../shared/shareMeta.ts';

/**
 * Writes page-specific titles, descriptions and share images into the SPA's
 * HTML so link previews (iMessage, Slack, WhatsApp, social sites) show the
 * right card. Data comes from the public API without the visitor's cookies.
 */
export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const response = await context.next();
  if (request.method !== 'GET' || !(response.headers.get('content-type') ?? '').includes('text/html')) return response;

  const url = new URL(request.url);
  const getJson = async (apiPath: string) => {
    try {
      const res = await fetch(new URL(apiPath, url.origin), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(2500) });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  };

  try {
    const meta = await pageMeta(url.pathname, url.origin, brand, getJson);
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(injectMeta(await response.text(), meta, brand.name), { status: response.status, headers });
  } catch {
    return response;
  }
};

export const config = {
  path: '/*',
  excludedPath: ['/api/*', '/og/*', '/assets/*', '/downloads/*', '/favicon.svg', '/theme-init.js'],
};
