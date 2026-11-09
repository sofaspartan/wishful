/**
 * Visitors don't have accounts, so the secret tokens that let them release a
 * reservation (or withdraw a group-gift pledge) are kept on their device.
 * This is a convenience cache only — the server stores just a hash and is the
 * source of truth for whether a claim is still active.
 */
const STORAGE_KEY = 'wishful.claims.v1';

export interface StoredClaim {
  kind: 'claim' | 'pledge';
  token: string;
  /** claimId (for claims) or pledgeId (for pledges) — used to recognise "mine". */
  refId: string;
  role?: 'coordinator' | 'contributor';
  title: string;
  createdAt: string;
}

type Store = Record<string, StoredClaim>;

const keyFor = (shareToken: string, entryId: string, kind: StoredClaim['kind']) => `${shareToken}:${entryId}:${kind}`;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage full or disabled — the visitor can still use the manage link */
  }
}

export function getStoredClaim(shareToken: string, entryId: string, kind: StoredClaim['kind']): StoredClaim | null {
  return read()[keyFor(shareToken, entryId, kind)] ?? null;
}

export function saveClaim(shareToken: string, entryId: string, claim: StoredClaim) {
  const store = read();
  store[keyFor(shareToken, entryId, claim.kind)] = claim;
  write(store);
}

export function forgetClaim(shareToken: string, entryId: string, kind: StoredClaim['kind']) {
  const store = read();
  delete store[keyFor(shareToken, entryId, kind)];
  write(store);
}

/** A link that restores a claim token on another device: ?manage=<entryId>.<kind>.<refId>.<token> */
export function manageLink(shareToken: string, entryId: string, claim: StoredClaim): string {
  const payload = [entryId, claim.kind, claim.refId, claim.token].join('.');
  return `${window.location.origin}/s/${shareToken}?manage=${encodeURIComponent(payload)}`;
}

export function importManageParam(shareToken: string, param: string | null, title = ''): boolean {
  if (!param) return false;
  const [entryId, kind, refId, token] = param.split('.');
  if (!entryId || (kind !== 'claim' && kind !== 'pledge') || !refId || !token) return false;
  saveClaim(shareToken, entryId, { kind, token, refId, title, createdAt: new Date().toISOString() });
  return true;
}
