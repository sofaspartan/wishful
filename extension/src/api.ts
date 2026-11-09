import { getToken } from './storage';

export const SITE_URL = __WISHFUL_URL__;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Calls the extension API with the stored token. Cookies are never sent, so the token is the only credential. */
export async function api<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const token = await getToken();
  if (!token) throw new ApiError(401, 'Connect the extension to your account first.');
  let res: Response;
  try {
    res = await fetch(`${SITE_URL}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'omit',
      headers: {
        authorization: `Bearer ${token}`,
        'x-requested-with': 'wishful',
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Couldn't reach Wishful. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? 'Something went wrong. Please try again.');
  return data as T;
}

/** Absolute URL for site-relative paths such as uploaded cover images. */
export const siteAsset = (url: string) => (url.startsWith('/') ? `${SITE_URL}${url}` : url);
