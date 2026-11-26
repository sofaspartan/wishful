import { useCallback, useEffect, useState } from 'react';
import { isDarkCover, type CoverBackdrop } from '../../shared/types';

/** Soft washes that predate illustrated dashboard looks. */
export const CLASSIC_DASHBOARD_SCENES = ['plain', 'sky', 'blush', 'kraft'] as const;
export type ClassicDashboardScene = (typeof CLASSIC_DASHBOARD_SCENES)[number];

/** Illustrated soft scenes — sky family only (no seasonal / paint looks). */
export const DASHBOARD_SCENE_BACKDROPS = ['sky', 'blush', 'mint', 'lilac'] as const satisfies readonly CoverBackdrop[];
export type DashboardSceneBackdrop = (typeof DASHBOARD_SCENE_BACKDROPS)[number];

export type DashboardLook =
  | { mode: 'classic'; scene: ClassicDashboardScene }
  | { mode: 'scene'; backdrop: DashboardSceneBackdrop };

/** @deprecated Prefer `DashboardLook` — kept for older imports. */
export type DashboardScene = ClassicDashboardScene;
/** @deprecated Prefer `CLASSIC_DASHBOARD_SCENES`. */
export const DASHBOARD_SCENES = CLASSIC_DASHBOARD_SCENES;

const LEGACY_SCENES: Record<string, ClassicDashboardScene> = {
  balloons: 'sky',
  meadow: 'blush',
  sunset: 'kraft',
};

/** Former illustrated scenes remapped into the soft sky family. */
const LEGACY_BACKDROPS: Record<string, DashboardSceneBackdrop> = {
  sunset: 'blush',
  spring: 'mint',
  summer: 'sky',
  autumn: 'blush',
  snow: 'sky',
  night: 'lilac',
  confetti: 'blush',
  hearts: 'blush',
  shamrock: 'mint',
  spooky: 'lilac',
  harvest: 'blush',
  hanukkah: 'sky',
};

const LOOK_KEY = 'wishful.pref.dashboard.look';
const LEGACY_SCENE_KEY = 'wishful.pref.dashboard.scene';

type PrefListener = (value: DashboardLook) => void;
const lookListeners = new Set<PrefListener>();

export const CLASSIC_DASHBOARD_LABELS: Record<ClassicDashboardScene, string> = {
  plain: 'Calm',
  sky: 'Sky',
  blush: 'Blush',
  kraft: 'Kraft',
};

export const CLASSIC_DASHBOARD_HINTS: Record<ClassicDashboardScene, string> = {
  plain: 'Soft neutral gray',
  sky: 'Blue wash like list heroes',
  blush: 'Coral wash like collections',
  kraft: 'Warm tan like boxes',
};

/** Hex stops Soft classics feed into `--page-tint` / chrome (matches token hues). */
export const CLASSIC_DASHBOARD_TINTS: Record<ClassicDashboardScene, { tint: string; tint2: string }> = {
  plain: { tint: '#9aa3b5', tint2: '#b7becc' },
  sky: { tint: '#2f6fdc', tint2: '#5b8ee6' },
  blush: { tint: '#e8745b', tint2: '#f08d75' },
  kraft: { tint: '#b88958', tint2: '#c99a6b' },
};

/** @deprecated */
export const DASHBOARD_SCENE_LABELS = CLASSIC_DASHBOARD_LABELS;
/** @deprecated */
export const DASHBOARD_SCENE_HINTS = CLASSIC_DASHBOARD_HINTS;

function isSceneBackdrop(v: string): v is DashboardSceneBackdrop {
  return (DASHBOARD_SCENE_BACKDROPS as readonly string[]).includes(v);
}

function migrateBackdrop(v: string): DashboardSceneBackdrop | null {
  if (isSceneBackdrop(v)) return v;
  return LEGACY_BACKDROPS[v] ?? null;
}

function parseLook(raw: string | null): DashboardLook | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { mode?: string; scene?: string; backdrop?: string };
    if (parsed?.mode === 'classic' && parsed.scene && (CLASSIC_DASHBOARD_SCENES as readonly string[]).includes(parsed.scene)) {
      return { mode: 'classic', scene: parsed.scene as ClassicDashboardScene };
    }
    if (parsed?.mode === 'scene' && typeof parsed.backdrop === 'string') {
      const backdrop = migrateBackdrop(parsed.backdrop);
      if (backdrop) return { mode: 'scene', backdrop };
    }
    // Dropped solid / gradient looks → calm soft.
    if (parsed?.mode === 'solid' || parsed?.mode === 'gradient') {
      return { mode: 'classic', scene: 'plain' };
    }
  } catch {
    /* legacy plain string */
  }
  if ((CLASSIC_DASHBOARD_SCENES as readonly string[]).includes(raw)) {
    return { mode: 'classic', scene: raw as ClassicDashboardScene };
  }
  const migrated = LEGACY_SCENES[raw];
  if (migrated) return { mode: 'classic', scene: migrated };
  const backdrop = migrateBackdrop(raw);
  if (backdrop) return { mode: 'scene', backdrop };
  return null;
}

function readStoredLook(): DashboardLook {
  try {
    const raw = localStorage.getItem(LOOK_KEY);
    const fromLook = parseLook(raw);
    if (fromLook) {
      // Persist migrations (dropped solid/gradient / retired scenes).
      if (raw && JSON.stringify(fromLook) !== raw) localStorage.setItem(LOOK_KEY, JSON.stringify(fromLook));
      return fromLook;
    }
    const fromLegacy = parseLook(localStorage.getItem(LEGACY_SCENE_KEY));
    if (fromLegacy) {
      localStorage.setItem(LOOK_KEY, JSON.stringify(fromLegacy));
      return fromLegacy;
    }
  } catch {
    /* ignore */
  }
  return { mode: 'classic', scene: 'plain' };
}

function writeLook(look: DashboardLook) {
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify(look));
    // Keep classic scene key in sync for anything still reading the old pref.
    if (look.mode === 'classic') localStorage.setItem(LEGACY_SCENE_KEY, look.scene);
  } catch {
    /* ignore */
  }
  for (const listener of lookListeners) listener(look);
}

export function looksEqual(a: DashboardLook, b: DashboardLook): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === 'classic' && b.mode === 'classic') return a.scene === b.scene;
  if (a.mode === 'scene' && b.mode === 'scene') return a.backdrop === b.backdrop;
  return false;
}

export function dashboardLookIsDark(look: DashboardLook): boolean {
  if (look.mode === 'classic') return false;
  return isDarkCover({ backdrop: look.backdrop });
}

/** Classes + CSS vars so portaled UI (modals) can match the signed-in dashboard look. */
export function dashboardLookSurface(look: DashboardLook): {
  className: string;
  style: Record<string, string> | undefined;
  soft: boolean;
} {
  const soft = look.mode === 'classic';
  const softTints = soft ? CLASSIC_DASHBOARD_TINTS[look.scene] : null;
  const className = [
    'dashboard-themed',
    soft && 'dashboard-soft',
    look.mode === 'scene' && `page-bg-${look.backdrop}`,
    !soft && dashboardLookIsDark(look) && 'dashboard-themed-dark',
  ]
    .filter(Boolean)
    .join(' ');

  const style =
    soft && softTints
      ? { '--page-tint': softTints.tint, '--page-tint-2': softTints.tint2 }
      : undefined;

  return { className, style, soft };
}

export function useDashboardLook(): [DashboardLook, (v: DashboardLook) => void] {
  const [look, setLookState] = useState<DashboardLook>(() =>
    typeof window !== 'undefined' ? readStoredLook() : { mode: 'classic', scene: 'plain' },
  );

  useEffect(() => {
    const listener: PrefListener = (next) => setLookState(next);
    lookListeners.add(listener);
    return () => {
      lookListeners.delete(listener);
    };
  }, []);

  const setLook = useCallback((v: DashboardLook) => {
    setLookState(v);
    writeLook(v);
  }, []);

  return [look, setLook];
}

/** Classic soft-wash setter for callers that still speak in scene ids. */
export function useDashboardScene(): [ClassicDashboardScene, (v: ClassicDashboardScene) => void] {
  const [look, setLook] = useDashboardLook();
  const scene: ClassicDashboardScene = look.mode === 'classic' ? look.scene : 'plain';
  const setScene = useCallback(
    (v: ClassicDashboardScene) => setLook({ mode: 'classic', scene: v }),
    [setLook],
  );
  return [scene, setScene];
}

export type { CoverBackdrop };
