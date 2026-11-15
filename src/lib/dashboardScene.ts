import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_GRADIENT,
  DEFAULT_SOLID_COLOR,
  coverPaint,
  isDarkCover,
  type CoverBackdrop,
} from '../../shared/types';

/** Soft washes that predate illustrated dashboard looks. */
export const CLASSIC_DASHBOARD_SCENES = ['plain', 'sky', 'blush', 'kraft'] as const;
export type ClassicDashboardScene = (typeof CLASSIC_DASHBOARD_SCENES)[number];

/** Illustrated scenes shared with list page backgrounds (same order as cover pickers). */
export const DASHBOARD_SCENE_BACKDROPS = [
  'sky',
  'blush',
  'mint',
  'lilac',
  'sunset',
  'spring',
  'summer',
  'autumn',
  'snow',
  'night',
  'confetti',
  'hearts',
  'shamrock',
  'spooky',
  'harvest',
  'hanukkah',
] as const satisfies readonly CoverBackdrop[];
export type DashboardSceneBackdrop = (typeof DASHBOARD_SCENE_BACKDROPS)[number];

export type DashboardLook =
  | { mode: 'classic'; scene: ClassicDashboardScene }
  | { mode: 'scene'; backdrop: DashboardSceneBackdrop }
  | { mode: 'solid'; color: string }
  | { mode: 'gradient'; colors: [string, string] };

/** @deprecated Prefer `DashboardLook` — kept for older imports. */
export type DashboardScene = ClassicDashboardScene;
/** @deprecated Prefer `CLASSIC_DASHBOARD_SCENES`. */
export const DASHBOARD_SCENES = CLASSIC_DASHBOARD_SCENES;

const LEGACY_SCENES: Record<string, ClassicDashboardScene> = {
  balloons: 'sky',
  meadow: 'blush',
  sunset: 'kraft',
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

function parseLook(raw: string | null): DashboardLook | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DashboardLook;
    if (parsed?.mode === 'classic' && (CLASSIC_DASHBOARD_SCENES as readonly string[]).includes(parsed.scene)) return parsed;
    if (parsed?.mode === 'scene' && isSceneBackdrop(parsed.backdrop)) return parsed;
    if (parsed?.mode === 'solid' && typeof parsed.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.color)) return parsed;
    if (
      parsed?.mode === 'gradient' &&
      Array.isArray(parsed.colors) &&
      parsed.colors.length === 2 &&
      parsed.colors.every((c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))
    ) {
      return { mode: 'gradient', colors: [parsed.colors[0], parsed.colors[1]] };
    }
  } catch {
    /* legacy plain string */
  }
  if ((CLASSIC_DASHBOARD_SCENES as readonly string[]).includes(raw)) {
    return { mode: 'classic', scene: raw as ClassicDashboardScene };
  }
  const migrated = LEGACY_SCENES[raw];
  if (migrated) return { mode: 'classic', scene: migrated };
  if (isSceneBackdrop(raw)) return { mode: 'scene', backdrop: raw };
  return null;
}

function readStoredLook(): DashboardLook {
  try {
    const fromLook = parseLook(localStorage.getItem(LOOK_KEY));
    if (fromLook) return fromLook;
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
  if (a.mode === 'solid' && b.mode === 'solid') return a.color.toLowerCase() === b.color.toLowerCase();
  if (a.mode === 'gradient' && b.mode === 'gradient') {
    return a.colors[0].toLowerCase() === b.colors[0].toLowerCase() && a.colors[1].toLowerCase() === b.colors[1].toLowerCase();
  }
  return false;
}

export function dashboardLookIsDark(look: DashboardLook): boolean {
  if (look.mode === 'classic') return false;
  if (look.mode === 'scene') return isDarkCover({ backdrop: look.backdrop });
  if (look.mode === 'solid') return isDarkCover({ backdrop: 'solid', colors: [look.color] });
  return isDarkCover({ backdrop: 'gradient', colors: look.colors });
}

/** Classes + CSS vars so portaled UI (modals) can match the signed-in dashboard look. */
export function dashboardLookSurface(look: DashboardLook): {
  className: string;
  style: Record<string, string> | undefined;
  soft: boolean;
} {
  const soft = look.mode === 'classic';
  const paint = look.mode === 'solid' || look.mode === 'gradient';
  const softTints = soft ? CLASSIC_DASHBOARD_TINTS[look.scene] : null;
  const className = [
    'dashboard-themed',
    soft && 'dashboard-soft',
    paint && 'dashboard-themed-paint',
    look.mode === 'scene' && `page-bg-${look.backdrop}`,
    !soft && dashboardLookIsDark(look) && 'dashboard-themed-dark',
  ]
    .filter(Boolean)
    .join(' ');

  let style: Record<string, string> | undefined;
  if (soft && softTints) {
    style = { '--page-tint': softTints.tint, '--page-tint-2': softTints.tint2 };
  } else if (look.mode === 'solid') {
    style = {
      '--page-tint': look.color,
      '--page-tint-2': look.color,
      '--page-paint': look.color,
    };
  } else if (look.mode === 'gradient') {
    style = {
      '--page-tint': look.colors[0],
      '--page-tint-2': look.colors[1],
      '--page-paint': coverPaint({ backdrop: 'gradient', colors: look.colors }) ?? look.colors[0],
    };
  }

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

export const DEFAULT_DASHBOARD_SOLID = DEFAULT_SOLID_COLOR;
export const DEFAULT_DASHBOARD_GRADIENT = DEFAULT_GRADIENT;

export type { CoverBackdrop };
