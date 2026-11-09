import type { ReactNode } from 'react';
import { Circle, Cloud, Sparkles, Square } from 'lucide-react';
import type { CoverArt as CoverArtValue, CoverFrame, CoverFrameFill, CoverFrameShape } from '../../shared/types';
import {
  COVER_BACKDROP_LABELS,
  COVER_BACKDROP_ORDER,
  COVER_FRAME_COLORS,
  COVER_ICON_ART,
  COVER_ICON_GROUPS,
  COVER_ICON_LABELS,
  CoverArt,
  CoverAvatar,
  DEFAULT_COVER_FRAME,
} from './CoverArt';
import { Segmented } from './ui/misc';

const SHAPES: Array<{ value: CoverFrameShape; label: string; icon: ReactNode }> = [
  { value: 'none', label: 'Floating', icon: <Sparkles size={14} /> },
  { value: 'rounded', label: 'Rounded', icon: <Square size={14} /> },
  { value: 'circle', label: 'Circle', icon: <Circle size={14} /> },
  { value: 'cloud', label: 'Cloud', icon: <Cloud size={14} /> },
];
const FILLS: Array<{ value: CoverFrameFill; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'glass', label: 'See-through' },
];

/** Choose an illustrated icon, a backdrop and the icon's frame for a list cover, with a live preview of the list header. */
export function CoverArtPicker({ value, onChange, title }: { value: CoverArtValue; onChange: (v: CoverArtValue) => void; title?: string }) {
  const frame = value.frame ?? DEFAULT_COVER_FRAME;
  const setFrame = (patch: Partial<CoverFrame>) => onChange({ ...value, frame: { ...frame, ...patch } });
  const dark = value.backdrop === 'night' || value.backdrop === 'snow';

  return (
    <div className="cover-picker">
      <div className={`cover-picker-preview${dark ? ' is-dark' : ''}`}>
        <CoverArt art={value} showIcon={false} />
        <div className="cover-preview-hero">
          <CoverAvatar className="cover-preview-avatar" icon={value.icon} frame={frame} />
          <div className="cover-preview-text">
            <span className="cover-preview-title">{title?.trim() || 'Your list'}</span>
            <span className="cover-preview-line" />
            <span className="cover-preview-line short" />
          </div>
        </div>
      </div>
      <div className="cover-picker-controls">
        <div className="cover-picker-group">
          <span className="cover-picker-label" id="cover-backdrop-label">
            Background
          </span>
          <div className="cover-backdrops" role="radiogroup" aria-labelledby="cover-backdrop-label">
            {COVER_BACKDROP_ORDER.map((b) => (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={value.backdrop === b}
                className="cover-backdrop-option"
                onClick={() => onChange({ ...value, backdrop: b })}
              >
                <span className="cover-backdrop-thumb">
                  <CoverArt art={{ ...value, backdrop: b }} showIcon={false} />
                </span>
                <span className="cover-backdrop-name">{COVER_BACKDROP_LABELS[b]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="cover-picker-group">
          <span className="cover-picker-label">Icon frame</span>
          <div className="cover-frame-controls">
            <Segmented label="Frame shape" value={frame.shape} onChange={(shape) => setFrame({ shape })} options={SHAPES} />
            {frame.shape !== 'none' && <Segmented label="Frame fill" value={frame.fill} onChange={(fill) => setFrame({ fill })} options={FILLS} />}
          </div>
          {frame.shape !== 'none' && (
            <div className="cover-frame-colors" role="radiogroup" aria-label="Frame colour">
              {COVER_FRAME_COLORS.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  role="radio"
                  aria-checked={frame.color === c.color}
                  aria-label={c.label}
                  title={c.label}
                  className="cover-frame-swatch"
                  style={{ background: c.color }}
                  onClick={() => setFrame({ color: c.color })}
                />
              ))}
            </div>
          )}
        </div>

        {COVER_ICON_GROUPS.map((g) => (
          <div key={g.label} className="cover-picker-group">
            <span className="cover-picker-label">{g.label}</span>
            <div className="cover-icons" role="radiogroup" aria-label={g.label}>
              {g.icons.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  role="radio"
                  aria-checked={value.icon === icon}
                  aria-label={COVER_ICON_LABELS[icon]}
                  title={COVER_ICON_LABELS[icon]}
                  className="cover-icon-option"
                  onClick={() => onChange({ ...value, icon })}
                >
                  {COVER_ICON_ART[icon]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
