import { useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { coverPaint } from '../../shared/types';
import {
  CLASSIC_DASHBOARD_HINTS,
  CLASSIC_DASHBOARD_LABELS,
  CLASSIC_DASHBOARD_SCENES,
  DASHBOARD_SCENE_BACKDROPS,
  DEFAULT_DASHBOARD_GRADIENT,
  DEFAULT_DASHBOARD_SOLID,
  useDashboardLook,
  type ClassicDashboardScene,
  type DashboardLook,
  type DashboardSceneBackdrop,
} from '../lib/dashboardScene';
import {
  COVER_BACKDROP_LABELS,
  COVER_GRADIENTS,
  COVER_SOLID_COLORS,
  CoverArt,
} from './CoverArt';
import { ColorField } from './CoverArtPicker';
import { Popover } from './ui/Popover';
import { Segmented } from './ui/misc';

type PickerTab = 'soft' | 'scene' | 'solid' | 'gradient';

const TABS: Array<{ value: PickerTab; label: string }> = [
  { value: 'soft', label: 'Soft' },
  { value: 'scene', label: 'Scenes' },
  { value: 'solid', label: 'Color' },
  { value: 'gradient', label: 'Gradient' },
];

const sameColor = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();

function tabOf(look: DashboardLook): PickerTab {
  if (look.mode === 'classic') return 'soft';
  return look.mode;
}

function SelectedCheck({ label }: { label: string }) {
  return (
    <span className="scene-picker-check" aria-label={`${label} selected`}>
      <Check size={12} strokeWidth={3} aria-hidden />
    </span>
  );
}

/** Top-bar paint palette — soft washes, illustrated scenes, colours, or gradients. */
export function DashboardScenePicker() {
  const [look, setLook] = useDashboardLook();
  const activeTab = tabOf(look);
  const [tab, setTab] = useState<PickerTab>(() => activeTab);
  const [lastScene, setLastScene] = useState<DashboardSceneBackdrop>(look.mode === 'scene' ? look.backdrop : 'sky');
  const [lastSolid, setLastSolid] = useState(look.mode === 'solid' ? look.color : DEFAULT_DASHBOARD_SOLID);
  const [lastGradient, setLastGradient] = useState<[string, string]>(
    look.mode === 'gradient' ? look.colors : DEFAULT_DASHBOARD_GRADIENT,
  );

  const pick = (next: DashboardLook, close: () => void) => {
    setLook(next);
    setTab(tabOf(next));
    if (next.mode === 'scene') setLastScene(next.backdrop);
    if (next.mode === 'solid') setLastSolid(next.color);
    if (next.mode === 'gradient') setLastGradient(next.colors);
    close();
  };

  const solidColor = look.mode === 'solid' ? look.color : lastSolid;
  const [gradFrom, gradTo] = look.mode === 'gradient' ? look.colors : lastGradient;

  const tabOptions = TABS.map((t) => ({
    value: t.value,
    title: activeTab === t.value ? `${t.label} (current look)` : t.label,
    label: (
      <span className="scene-picker-tab-label">
        {t.label}
        {activeTab === t.value && <SelectedCheck label={t.label} />}
      </span>
    ),
  }));

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
            <span className="muted text-xs">
              {tab === 'soft'
                ? 'Soft washes behind Home and your lists'
                : 'Same fun scenes and paints as list page backgrounds'}
            </span>
            <Segmented<PickerTab> label="Dashboard look style" value={tab} onChange={setTab} options={tabOptions} />
          </div>

          {tab === 'soft' && (
            <div className="scene-picker-grid" role="listbox" aria-label="Soft dashboard backgrounds">
              {CLASSIC_DASHBOARD_SCENES.map((id) => {
                const active = look.mode === 'classic' && look.scene === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`scene-swatch scene-swatch-${id}${active ? ' is-active' : ''}`}
                    onClick={() => pick({ mode: 'classic', scene: id as ClassicDashboardScene }, close)}
                  >
                    <span className="scene-swatch-preview" aria-hidden>
                      <span className={`scene-mini scene-mini-${id}`} />
                      {active && <SelectedCheck label={CLASSIC_DASHBOARD_LABELS[id]} />}
                    </span>
                    <span className="scene-swatch-label">{CLASSIC_DASHBOARD_LABELS[id]}</span>
                    <span className="scene-swatch-hint">{CLASSIC_DASHBOARD_HINTS[id]}</span>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'scene' && (
            <div className="scene-picker-scenes cover-backdrops" role="radiogroup" aria-label="Illustrated dashboard scenes">
              {DASHBOARD_SCENE_BACKDROPS.map((b) => {
                const active = look.mode === 'scene' && look.backdrop === b;
                return (
                  <button
                    key={b}
                    type="button"
                    role="radio"
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
          )}

          {tab === 'solid' && (
            <div className="scene-picker-paints">
              <div className="cover-paints" role="radiogroup" aria-label="Dashboard colour">
                {COVER_SOLID_COLORS.map((c) => {
                  const active = look.mode === 'solid' && sameColor(look.color, c.color);
                  return (
                    <button
                      key={c.color}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={c.label}
                      title={c.label}
                      className="cover-paint-swatch"
                      style={{ background: c.color }}
                      onClick={() => pick({ mode: 'solid', color: c.color }, close)}
                    >
                      {active && <SelectedCheck label={c.label} />}
                    </button>
                  );
                })}
              </div>
              <div className="cover-paint-customs">
                <ColorField
                  label="Custom"
                  value={solidColor}
                  onChange={(color) => {
                    setLastSolid(color);
                    setLook({ mode: 'solid', color });
                    setTab('solid');
                  }}
                />
              </div>
            </div>
          )}

          {tab === 'gradient' && (
            <div className="scene-picker-paints">
              <div className="cover-paints" role="radiogroup" aria-label="Dashboard gradient">
                {COVER_GRADIENTS.map((g) => {
                  const active =
                    look.mode === 'gradient' &&
                    sameColor(look.colors[0], g.colors[0]) &&
                    sameColor(look.colors[1], g.colors[1]);
                  return (
                    <button
                      key={g.label}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={g.label}
                      title={g.label}
                      className="cover-paint-swatch"
                      style={{ background: coverPaint({ backdrop: 'gradient', colors: g.colors }) ?? undefined }}
                      onClick={() => pick({ mode: 'gradient', colors: g.colors }, close)}
                    >
                      {active && <SelectedCheck label={g.label} />}
                    </button>
                  );
                })}
              </div>
              <div className="cover-paint-customs">
                <ColorField
                  label="From"
                  value={gradFrom}
                  onChange={(c) => {
                    const next: [string, string] = [c, gradTo];
                    setLastGradient(next);
                    setLook({ mode: 'gradient', colors: next });
                    setTab('gradient');
                  }}
                />
                <ColorField
                  label="To"
                  value={gradTo}
                  onChange={(c) => {
                    const next: [string, string] = [gradFrom, c];
                    setLastGradient(next);
                    setLook({ mode: 'gradient', colors: next });
                    setTab('gradient');
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </Popover>
  );
}

export type { DashboardLook };
