import { useMemo, useState, type ReactNode } from 'react';
import { Circle, Cloud, Search, Sparkles, Square, X } from 'lucide-react';
import { isDarkBackdrop, type CoverArt as CoverArtValue, type CoverFrame, type CoverFrameFill, type CoverFrameShape, type CoverIcon } from '../../shared/types';
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
  searchCoverIcons,
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
  const dark = isDarkBackdrop(value.backdrop);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const q = query.trim();
  const results = useMemo(() => (q ? searchCoverIcons(q) : null), [q]);
  const shownGroups = category ? COVER_ICON_GROUPS.filter((g) => g.label === category) : COVER_ICON_GROUPS;

  const iconGrid = (icons: readonly CoverIcon[], label: string) => (
    <div className="cover-icons" role="radiogroup" aria-label={label}>
      {icons.map((icon) => (
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
  );

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

        <div className="cover-picker-group cover-icon-finder">
          <label className="cover-picker-label" htmlFor="cover-icon-search">
            Icon
          </label>
          <div className="input-group cover-icon-search">
            <Search size={16} aria-hidden />
            <input
              id="cover-icon-search"
              className="input"
              type="search"
              autoComplete="off"
              placeholder="Search icons, like “halloween”, “dog” or “baby”"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
                if (e.key === 'Escape' && query) {
                  e.preventDefault();
                  e.stopPropagation();
                  setQuery('');
                }
              }}
            />
            {query && (
              <button type="button" className="btn btn-ghost btn-icon btn-sm cover-icon-search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
          {!results && (
            <div className="cover-icon-chips" role="group" aria-label="Icon categories">
              {[null, ...COVER_ICON_GROUPS.map((g) => g.label)].map((label) => (
                <button key={label ?? 'all'} type="button" className="chip" aria-pressed={category === label} onClick={() => setCategory(label)}>
                  {label ?? 'All'}
                </button>
              ))}
            </div>
          )}
        </div>

        {results ? (
          <div className="cover-picker-group">
            <span className="cover-picker-label" role="status">
              {results.length ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : 'No matches'}
            </span>
            {results.length ? (
              iconGrid(results, 'Matching icons')
            ) : (
              <p className="cover-icon-empty">Nothing matches “{q}”. Try a holiday, an occasion or a hobby.</p>
            )}
          </div>
        ) : (
          shownGroups.map((g) => (
            <div key={g.label} className="cover-picker-group">
              <span className="cover-picker-label">{g.label}</span>
              {iconGrid(g.icons, g.label)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
