/**
 * Shared links opened on this device, so gift-givers can find lists again from
 * "Shared With Me". A convenience cache only; nothing here grants access.
 */
const STORAGE_KEY = 'wishful.visited.v1';
const MAX = 30;

export interface VisitedList {
  token: string;
  title: string;
  ownerName: string;
  accentColor: string;
  eventDate: string | null;
  visitedAt: string;
}

function read(): VisitedList[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(v) ? (v as VisitedList[]) : [];
  } catch {
    return [];
  }
}

function write(list: VisitedList[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function recordVisit(v: Omit<VisitedList, 'visitedAt'>) {
  write([{ ...v, visitedAt: new Date().toISOString() }, ...read().filter((x) => x.token !== v.token)]);
}

export function listVisits(): VisitedList[] {
  return read();
}

export function forgetVisit(token: string) {
  write(read().filter((x) => x.token !== token));
}
