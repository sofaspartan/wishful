import { useEffect, useState } from 'react';
import { useLocalPref } from './prefs';

export const LAYOUT_MODES = ['responsive', 'mobile'] as const;
export type LayoutMode = (typeof LAYOUT_MODES)[number];

export const LAYOUT_MODE_LABELS: Record<LayoutMode, string> = {
  responsive: 'Responsive',
  mobile: 'Mobile app layout',
};

/** Persisted shell preference: responsive (breakpoint sidebar) vs always bottom-nav. */
export function useLayoutMode(): [LayoutMode, (v: LayoutMode) => void] {
  return useLocalPref<LayoutMode>('layout.mode', 'responsive', LAYOUT_MODES);
}

/** True below the desktop sidebar breakpoint (same as bottom-nav shell). */
export function useNarrowShell(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : true,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return narrow;
}

/** Capture-hub Home when mobile layout is forced or the viewport already uses the phone shell. */
export function useCaptureHub(): boolean {
  const [layoutMode] = useLayoutMode();
  const narrow = useNarrowShell();
  return layoutMode === 'mobile' || narrow;
}

/** True when the app is running from an installed home-screen shortcut. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(display-mode: standalone)').matches;
  const ios = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(mq || ios);
}

/** Apply display-mode on <html> for minor standalone chrome tweaks. */
export function useStandaloneDisplayAttr() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.dataset.displayMode = isStandaloneDisplay() ? 'standalone' : 'browser';
    };
    apply();
    const mq = window.matchMedia?.('(display-mode: standalone)');
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, []);
}
