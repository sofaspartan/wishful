import type { ApiErrorBody } from '../../shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Thin fetch wrapper for the Wishful API. Always sends the CSRF header the
 * server requires on mutations, and normalises errors into `ApiError`.
 */
export async function api<T>(path: string, options: { method?: Method; body?: unknown; raw?: Blob; contentType?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'x-requested-with': 'wishful' };
  let body: BodyInit | undefined;
  if (options.raw) {
    body = options.raw;
    headers['content-type'] = options.contentType ?? options.raw.type;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['content-type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(path, { method: options.method ?? 'GET', headers, body, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.", 'network');
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, err?.message ?? 'Something went wrong. Please try again.', err?.code ?? 'error', err?.fields ?? {});
  }
  return data as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export const put = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'PUT', body });
export const patch = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'PATCH', body });
export const del = <T>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body });

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

export function fieldErrors(err: unknown): Record<string, string> {
  return err instanceof ApiError ? err.fields : {};
}
