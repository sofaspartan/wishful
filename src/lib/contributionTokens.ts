/**
 * Device-local tokens for cash contributions (honor-system, paid off-site).
 * Mirror of claimTokens but keyed per share token + contribution id.
 */
const STORAGE_KEY = 'wishful.contributions.v1';

export interface StoredContribution {
  token: string;
  contributionId: string;
  amountCents: number;
  provider: string;
  title: string;
  createdAt: string;
}

type Store = Record<string, StoredContribution[]>;

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
    /* ignore */
  }
}

export function getStoredContributions(shareToken: string): StoredContribution[] {
  return read()[shareToken] ?? [];
}

export function saveContribution(shareToken: string, contribution: StoredContribution) {
  const store = read();
  const list = store[shareToken] ?? [];
  store[shareToken] = [...list.filter((c) => c.contributionId !== contribution.contributionId), contribution];
  write(store);
}

export function forgetContribution(shareToken: string, contributionId: string) {
  const store = read();
  store[shareToken] = (store[shareToken] ?? []).filter((c) => c.contributionId !== contributionId);
  write(store);
}
