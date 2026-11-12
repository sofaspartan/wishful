import { useCallback, useEffect, useState } from 'react';

type PrefListener = (value: string) => void;
const prefListeners = new Map<string, Set<PrefListener>>();

function notifyPref(storageKey: string, value: string) {
  const set = prefListeners.get(storageKey);
  if (!set) return;
  for (const listener of set) listener(value);
}

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

  useEffect(() => {
    const listener: PrefListener = (next) => {
      if (allowed.includes(next as T)) setValue(next as T);
    };
    let set = prefListeners.get(storageKey);
    if (!set) {
      set = new Set();
      prefListeners.set(storageKey, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) prefListeners.delete(storageKey);
    };
  }, [storageKey, allowed]);

  const update = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(storageKey, v);
      } catch {
        /* ignore */
      }
      notifyPref(storageKey, v);
    },
    [storageKey],
  );
  return [value, update];
}

export const shareUrl = (token: string) => `${window.location.origin}/s/${token}`;
export const boxUrl = (code: string) => `${window.location.origin}/b/${code}`;
