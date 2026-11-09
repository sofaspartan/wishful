/** Extension-local storage: the connection token, a one-time connect state and the last lists used. */
const TOKEN = 'token';
const PENDING = 'pendingConnect';
const LAST_LISTS = 'lastListIds';
const CONNECT_TTL_MS = 30 * 60 * 1000;

interface PendingConnect {
  state: string;
  expiresAt: number;
}

export async function getToken(): Promise<string | null> {
  const v = (await chrome.storage.local.get(TOKEN))[TOKEN];
  return typeof v === 'string' ? v : null;
}

export const saveToken = (token: string) => chrome.storage.local.set({ [TOKEN]: token });
export const clearToken = () => chrome.storage.local.remove(TOKEN);

/** A fresh random state the connect page must echo back with the token. */
export async function startConnect(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const state = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const pending: PendingConnect = { state, expiresAt: Date.now() + CONNECT_TTL_MS };
  await chrome.storage.local.set({ [PENDING]: pending });
  return state;
}

/** True (and consumed) only when `state` matches the unexpired one from `startConnect`. */
export async function takePendingState(state: string): Promise<boolean> {
  const pending = (await chrome.storage.local.get(PENDING))[PENDING] as PendingConnect | undefined;
  if (!pending || pending.expiresAt < Date.now() || pending.state !== state) return false;
  await chrome.storage.local.remove(PENDING);
  return true;
}

export async function getLastLists(): Promise<string[]> {
  const v = (await chrome.storage.local.get(LAST_LISTS))[LAST_LISTS];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export const setLastLists = (ids: string[]) => chrome.storage.local.set({ [LAST_LISTS]: ids });
