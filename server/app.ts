import { Router, errorResponse, json, type RequestContext } from './http';
import { registerAuthRoutes } from './routes/auth';
import { registerWishlistRoutes } from './routes/wishlists';
import { registerItemRoutes } from './routes/items';
import { registerPublicRoutes } from './routes/public';
import { registerMiscRoutes } from './routes/misc';
import { registerFriendRoutes } from './routes/friends';
import { registerExtensionRoutes } from './routes/extension';

const router = new Router();
registerAuthRoutes(router);
registerWishlistRoutes(router);
registerItemRoutes(router);
registerPublicRoutes(router);
registerMiscRoutes(router);
registerFriendRoutes(router);
registerExtensionRoutes(router);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'wishful';

function clientIp(req: Request, hint?: string): string {
  return (
    hint ||
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/**
 * Single entry point for every `/api/*` request — used by the Netlify
 * Function in production and by the Vite middleware in development.
 */
export async function handleRequest(req: Request, opts: { ip?: string } = {}): Promise<Response> {
  const url = new URL(req.url);
  const ctx: RequestContext = { req, url, params: {}, ip: clientIp(req, opts.ip), responseHeaders: new Headers() };
  let res: Response;
  try {
    // CSRF defence: state-changing requests must carry a custom header. Browsers
    // won't send custom headers cross-origin without a CORS preflight, which
    // this API never approves. Session cookies are also SameSite=Lax.
    if (!SAFE_METHODS.has(req.method) && req.headers.get(CSRF_HEADER) !== CSRF_VALUE) {
      res = json({ error: { message: 'Missing request header.', code: 'csrf' } }, 403);
    } else {
      const match = router.match(req.method, url.pathname);
      if (match === null) res = json({ error: { message: 'Not found.', code: 'not_found' } }, 404);
      else if (match === 'method') res = json({ error: { message: 'Method not allowed.', code: 'method' } }, 405);
      else {
        ctx.params = match.params;
        res = await match.handler(ctx);
      }
    }
  } catch (err) {
    res = errorResponse(err);
  }
  if ([...ctx.responseHeaders.keys()].length === 0) return res;
  const headers = new Headers(res.headers);
  ctx.responseHeaders.forEach((value, key) => headers.append(key, value));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
