import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'wishful.pref.theme';
const THEME_COLORS: Record<Theme, string> = { light: '#f3f3f2', dark: '#0a1129' };
const listeners = new Set<() => void>();

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  listeners.forEach((l) => l());
}

function current(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Light/dark used to be user-toggled; the product now relies on dashboard / page looks only. */
export function setTheme(_theme: Theme) {
  apply('light');
  try {
    localStorage.setItem(STORAGE_KEY, 'light');
  } catch {
    /* ignore */
  }
}

export function initTheme() {
  apply('light');
  try {
    localStorage.setItem(STORAGE_KEY, 'light');
  } catch {
    /* ignore */
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => 'light');
}
