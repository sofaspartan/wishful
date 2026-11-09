import { handleRequest } from '../server/app';
import { setDriver } from '../server/storage';
import { createMemoryDriver } from '../server/storage/memory';
import { resetClock } from '../server/util';

export function freshStore() {
  setDriver(createMemoryDriver());
  resetClock();
}

export interface ApiResult<T = any> {
  status: number;
  data: T;
  headers: Headers;
}

/** A cookie-jar client that calls the API handler directly (no network). */
export class Agent {
  cookies = new Map<string, string>();
  constructor(public ip = '203.0.113.10') {}

  async request<T = any>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<ApiResult<T>> {
    const headers = new Headers({ 'x-requested-with': 'wishful', ...extraHeaders });
    let payload: BodyInit | undefined;
    if (body instanceof Uint8Array) payload = body as unknown as BodyInit;
    else if (body !== undefined) {
      headers.set('content-type', 'application/json');
      payload = JSON.stringify(body);
    }
    if (this.cookies.size) headers.set('cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    const res = await handleRequest(new Request(`https://wishful.test${path}`, { method, headers, body: payload }), { ip: this.ip });
    for (const cookie of res.headers.getSetCookie()) {
      const [pair, ...attrs] = cookie.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (attrs.some((a) => a.trim() === 'Max-Age=0')) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.arrayBuffer();
    return { status: res.status, data: data as T, headers: res.headers };
  }

  get = <T = any>(path: string) => this.request<T>('GET', path);
  post = <T = any>(path: string, body?: unknown) => this.request<T>('POST', path, body ?? {});
  patch = <T = any>(path: string, body?: unknown) => this.request<T>('PATCH', path, body ?? {});
  put = <T = any>(path: string, body?: unknown) => this.request<T>('PUT', path, body ?? {});
  del = <T = any>(path: string, body?: unknown) => this.request<T>('DELETE', path, body);
}

let counter = 0;

export async function signUp(agent = new Agent(), overrides: Record<string, string> = {}) {
  counter++;
  const creds = {
    email: `user${counter}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    password: 'correct horse battery',
    displayName: `User ${counter}`,
    ...overrides,
  };
  const res = await agent.post('/api/auth/register', creds);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.data)}`);
  return { agent, user: res.data.user, creds };
}

export async function createList(agent: Agent, body: Record<string, unknown> = {}) {
  const res = await agent.post('/api/wishlists', { title: 'Birthday 2027', visibility: 'unlisted', ...body });
  if (res.status !== 201) throw new Error(`create list failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.wishlist;
}

export async function createItem(agent: Agent, body: Record<string, unknown> = {}) {
  const res = await agent.post('/api/items', { title: 'Noise-cancelling headphones', type: 'product', price: 299.99, ...body });
  if (res.status !== 201) throw new Error(`create item failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.item;
}
