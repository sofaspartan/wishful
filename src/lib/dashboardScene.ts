import { useLocalPref } from './prefs';

/** Soft gradient washes for the signed-in app column (day + night follow light/dark theme). */
export const DASHBOARD_SCENES = ['plain', 'sky', 'blush', 'kraft'] as const;
export type DashboardScene = (typeof DASHBOARD_SCENES)[number];

const LEGACY_SCENES: Record<string, DashboardScene> = {
  balloons: 'sky',
  meadow: 'blush',
  sunset: 'kraft',
};

const STORAGE_KEY = 'wishful.pref.dashboard.scene';

function readInitialScene(): DashboardScene {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'plain';
    if ((DASHBOARD_SCENES as readonly string[]).includes(raw)) return raw as DashboardScene;
    const migrated = LEGACY_SCENES[raw];
    if (migrated) {
      localStorage.setItem(STORAGE_KEY, migrated);
      return migrated;
    }
  } catch {
    /* ignore */
  }
  return 'plain';
}

export const DASHBOARD_SCENE_LABELS: Record<DashboardScene, string> = {
  plain: 'Calm',
  sky: 'Sky',
  blush: 'Blush',
  kraft: 'Kraft',
};

export const DASHBOARD_SCENE_HINTS: Record<DashboardScene, string> = {
  plain: 'Soft neutral gray',
  sky: 'Blue wash like list heroes',
  blush: 'Coral wash like collections',
  kraft: 'Warm tan like boxes',
};

export function useDashboardScene(): [DashboardScene, (v: DashboardScene) => void] {
  // Seed from storage (incl. legacy ids) so useLocalPref starts on the right value.
  if (typeof window !== 'undefined') readInitialScene();
  return useLocalPref<DashboardScene>('dashboard.scene', 'plain', DASHBOARD_SCENES);
}
