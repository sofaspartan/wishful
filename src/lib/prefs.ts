import { useCallback, useState } from 'react';

/** Small interface preferences (view mode etc.) persisted in localStorage. Never user data. */
export function useLocalPref<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (v: T) => void] {
  const storageKey = `wishful.pref.${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(storageKey) as T | null;
      return v && allowed.includes(v) ? v : fallback;
    } catch {
      return fallback;
    }
  });
  const update = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(storageKey, v);
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );
  return [value, update];
}

export const shareUrl = (token: string) => `${window.location.origin}/s/${token}`;
export const boxUrl = (code: string) => `${window.location.origin}/b/${code}`;
