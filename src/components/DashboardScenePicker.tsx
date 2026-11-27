import { Check } from 'lucide-react';
import {
  CLASSIC_DASHBOARD_LABELS,
  CLASSIC_DASHBOARD_SCENES,
  DASHBOARD_SCENE_BACKDROPS,
  useDashboardLook,
  type ClassicDashboardScene,
  type DashboardLook,
} from '../lib/dashboardScene';
import { COVER_BACKDROP_LABELS, COVER_ICON_ART, CoverArt } from './CoverArt';
import { Popover } from './ui/Popover';

function SelectedCheck({ label }: { label: string }) {
  return (
    <span className="scene-picker-check" aria-label={`${label} selected`}>
      <Check size={12} strokeWidth={3} aria-hidden />
    </span>
  );
}

/** Dashboard look palette — soft washes and sky-family scenes in one list. */
export function DashboardScenePicker({
  open,
  onOpenChange,
  showTrigger = true,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
} = {}) {
  const [look, setLook] = useDashboardLook();

  const pick = (next: DashboardLook, close: () => void) => {
    setLook(next);
    close();
  };

  return (
    <Popover
      label="Dashboard look"
      buttonClassName="btn btn-ghost btn-icon topbar-art-btn"
      showTrigger={showTrigger}
      open={open}
      onOpenChange={onOpenChange}
      buttonContent={
        <span className="art-icon art-icon-tab" aria-hidden>
          {COVER_ICON_ART.palette}
        </span>
      }
      className="scene-picker-panel"
    >
      {(close) => (
        <>
          <div className="scene-picker-head">
            <strong>Dashboard look</strong>
            <span className="muted text-xs">Soft washes or a calm sky scene behind Home and your lists</span>
          </div>

          <div className="scene-picker-list" role="listbox" aria-label="Dashboard looks">
            <p className="scene-picker-section-label">Soft</p>
            <div className="scene-picker-scenes cover-backdrops scene-picker-scenes-compact">
              {CLASSIC_DASHBOARD_SCENES.map((id) => {
                const active = look.mode === 'classic' && look.scene === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    aria-checked={active}
                    className="cover-backdrop-option"
                    onClick={() => pick({ mode: 'classic', scene: id as ClassicDashboardScene }, close)}
                  >
                    <span className="cover-backdrop-thumb">
                      <span className={`scene-mini scene-mini-${id}`} aria-hidden />
                      {active && <SelectedCheck label={CLASSIC_DASHBOARD_LABELS[id]} />}
                    </span>
                    <span className="cover-backdrop-name">{CLASSIC_DASHBOARD_LABELS[id]}</span>
                  </button>
                );
              })}
            </div>

            <p className="scene-picker-section-label">Scenes</p>
            <div className="scene-picker-scenes cover-backdrops scene-picker-scenes-compact">
              {DASHBOARD_SCENE_BACKDROPS.map((b) => {
                const active = look.mode === 'scene' && look.backdrop === b;
                return (
                  <button
                    key={b}
                    type="button"
                    role="option"
                    aria-selected={active}
                    aria-checked={active}
                    className="cover-backdrop-option"
                    onClick={() => pick({ mode: 'scene', backdrop: b }, close)}
                  >
                    <span className="cover-backdrop-thumb">
                      <CoverArt art={{ icon: 'gift', backdrop: b }} showIcon={false} />
                      {active && <SelectedCheck label={COVER_BACKDROP_LABELS[b]} />}
                    </span>
                    <span className="cover-backdrop-name">{COVER_BACKDROP_LABELS[b]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </Popover>
  );
}

export type { DashboardLook };
