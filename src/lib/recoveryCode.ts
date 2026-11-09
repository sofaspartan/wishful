import { useSyncExternalStore } from 'react';

export interface IssuedRecoveryCode {
  code: string;
  email: string;
  reason: 'new-account' | 'created' | 'recovered' | 'replaced';
}

// Memory only: a recovery code is never written to localStorage or the URL.
let issued: IssuedRecoveryCode | null = null;
const listeners = new Set<() => void>();

function set(value: IssuedRecoveryCode | null) {
  issued = value;
  listeners.forEach((l) => l());
}

export const showRecoveryCode = (value: IssuedRecoveryCode) => set(value);
export const dismissRecoveryCode = () => set(null);

export function useIssuedRecoveryCode() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => issued,
  );
}
