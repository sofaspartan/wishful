import { Palette } from 'lucide-react';
import { DASHBOARD_SCENE_HINTS, DASHBOARD_SCENE_LABELS, DASHBOARD_SCENES, useDashboardScene, type DashboardScene } from '../lib/dashboardScene';
import { useTheme } from '../lib/theme';
import { Popover } from './ui/Popover';

/** Top-bar paint palette — pick a soft gradient wash; night looks follow dark mode. */
export function DashboardScenePicker() {
  const [scene, setScene] = useDashboardScene();
  const theme = useTheme();

  return (
    <Popover
      label="Dashboard look"
      buttonClassName="btn btn-ghost btn-icon"
      buttonContent={<Palette size={19} aria-hidden />}
      className="scene-picker-panel"
    >
      {(close) => (
        <>
          <div className="scene-picker-head">
            <strong>Dashboard look</strong>
            <span className="muted text-xs">{theme === 'dark' ? 'Night versions while dark mode is on' : 'Day looks — switch to dark mode for night'}</span>
          </div>
          <div className="scene-picker-grid" role="listbox" aria-label="Dashboard backgrounds">
            {DASHBOARD_SCENES.map((id) => (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={scene === id}
                className={`scene-swatch scene-swatch-${id}${scene === id ? ' is-active' : ''}`}
                onClick={() => {
                  setScene(id);
                  close();
                }}
              >
                <span className="scene-swatch-preview" aria-hidden>
                  <span className={`scene-mini scene-mini-${id}${theme === 'dark' ? ' is-night' : ''}`} />
                </span>
                <span className="scene-swatch-label">{DASHBOARD_SCENE_LABELS[id]}</span>
                <span className="scene-swatch-hint">{DASHBOARD_SCENE_HINTS[id]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Popover>
  );
}

export type { DashboardScene };
