/**
 * Accounts that have signed in on this device, so a list's owner who opens their
 * own share link while signed out isn't shown gift activity by accident. A
 * spoiler guard only: guests can see that activity anyway, so nothing here is
 * a security boundary.
 */
const STORAGE_KEY = 'wishful.deviceAccounts.v1';
const MAX = 10;

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberDeviceAccount(userId: string) {
  const ids = read();
  if (ids[0] === userId) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([userId, ...ids.filter((id) => id !== userId)].slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function signedInOnThisDevice(userId: string): boolean {
  return read().includes(userId);
}
