import type { z } from 'zod';
import { zodFieldErrors } from '../shared/schemas';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new HttpError(400, message, 'bad_request', fields);
export const unauthorized = (message = 'Please sign in to continue.') => new HttpError(401, message, 'unauthorized');
export const forbidden = (message = "You don't have permission to do that.") => new HttpError(403, message, 'forbidden');
/** Used for both "doesn't exist" and "exists but you can't see it" to avoid leaking existence. */
export const notFound = (message = 'Not found.') => new HttpError(404, message, 'not_found');
export const conflict = (message: string, code = 'conflict') => new HttpError(409, message, code);

const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(BASE_HEADERS);
  new Headers(headers).forEach((v, k) => h.append(k, v));
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return json({ error: { message: err.message, code: err.code, fields: err.fields } }, err.status);
  }
  console.error('[api] unhandled error', err);
  return json({ error: { message: 'Something went wrong on our side. Please try again.', code: 'internal' } }, 500);
}

const MAX_JSON_BYTES = 256 * 1024;

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) throw new HttpError(413, 'Request is too large.', 'too_large');
  let raw: unknown = {};
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw badRequest('Request body must be valid JSON.');
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = zodFieldErrors(parsed.error);
    throw badRequest(Object.values(fields)[0] ?? 'Please check the highlighted fields.', fields);
  }
  return parsed.data;
}

// ── Cookies ─────────────────────────────────────────────────────────────────

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get('cookie');
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

export function serializeCookie(
  name: string,
  value: string,
  opts: { maxAge?: number; secure: boolean; httpOnly?: boolean },
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join('; ');
}

// ── Routing ─────────────────────────────────────────────────────────────────

export interface RequestContext {
  req: Request;
  url: URL;
  params: Record<string, string>;
  ip: string;
  /** Response headers to merge in (e.g. Set-Cookie from session refresh). */
  responseHeaders: Headers;
}

export type Handler = (ctx: RequestContext) => Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler) {
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' +
        path.replace(/\/:([A-Za-z]+)/g, (_, key) => {
          keys.push(key);
          return '/([^/]+)';
        }) +
        '/?$',
    );
    this.routes.push({ method, pattern, keys, handler });
    return this;
  }

  get = (p: string, h: Handler) => this.add('GET', p, h);
  post = (p: string, h: Handler) => this.add('POST', p, h);
  put = (p: string, h: Handler) => this.add('PUT', p, h);
  patch = (p: string, h: Handler) => this.add('PATCH', p, h);
  delete = (p: string, h: Handler) => this.add('DELETE', p, h);

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | 'method' | null {
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.pattern.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1]);
      });
      return { handler: route.handler, params };
    }
    return pathMatched ? 'method' : null;
  }
}
