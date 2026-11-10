import { useMemo, useState, type ReactNode } from 'react';
import { Circle, Cloud, Search, Sparkles, Square, X } from 'lucide-react';
import {
  DEFAULT_GRADIENT,
  DEFAULT_SOLID_COLOR,
  coverColors,
  coverPaint,
  isDarkCover,
  isPlainBackdrop,
  type CoverArt as CoverArtValue,
  type CoverBackdrop,
  type CoverFrame,
  type CoverFrameFill,
  type CoverFrameShape,
  type CoverIcon,
} from '../../shared/types';
import {
  COVER_BACKDROP_LABELS,
  COVER_BACKDROP_ORDER,
  COVER_FRAME_COLORS,
  COVER_GRADIENTS,
  COVER_SOLID_COLORS,
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

type BackgroundStyle = 'scene' | 'solid' | 'gradient';
const BACKGROUND_STYLES: Array<{ value: BackgroundStyle; label: string }> = [
  { value: 'scene', label: 'Scenes' },
  { value: 'solid', label: 'Color' },
  { value: 'gradient', label: 'Gradient' },
];

const sameColor = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();

/** A small mock of a list or box page header with this cover graphic behind it. */
export function CoverHeaderPreview({ art, title, placeholder = 'Your list' }: { art: CoverArtValue; title?: string; placeholder?: string }) {
  return (
    <div className={`cover-picker-preview${isDarkCover(art) ? ' is-dark' : ''}`}>
      <CoverArt art={art} showIcon={false} />
      <div className="cover-preview-hero">
        <CoverAvatar className="cover-preview-avatar" icon={art.icon} frame={art.frame ?? DEFAULT_COVER_FRAME} />
        <div className="cover-preview-text">
          <span className="cover-preview-title">{title?.trim() || placeholder}</span>
          <span className="cover-preview-line" />
          <span className="cover-preview-line short" />
        </div>
      </div>
    </div>
  );
}

/** Choose an illustrated icon, a backdrop and the icon's frame for a list cover, with a live preview of the list header. */
export function CoverArtPicker({
  value,
  onChange,
  title,
  placeholder = 'Your list',
  preview = true,
  part,
}: {
  value: CoverArtValue;
  onChange: (v: CoverArtValue) => void;
  title?: string;
  placeholder?: string;
  /** Turn off when the preview is shown elsewhere, like beside the form. */
  preview?: boolean;
  /** Show only the background and frame, or only the icon picker, e.g. on separate tabs. */
  part?: 'style' | 'icon';
}) {
  const showStyle = part !== 'icon';
  const showIcons = part !== 'style';
  const frame = value.frame ?? DEFAULT_COVER_FRAME;
  const setFrame = (patch: Partial<CoverFrame>) => onChange({ ...value, frame: { ...frame, ...patch } });
  const style: BackgroundStyle = isPlainBackdrop(value.backdrop) ? value.backdrop : 'scene';
  // Switching between Scenes, Color and Gradient brings back what was last picked in each.
  const [lastScene, setLastScene] = useState<CoverBackdrop>(style === 'scene' ? value.backdrop : 'sky');
  const [lastSolid, setLastSolid] = useState(value.backdrop === 'solid' ? coverColors(value)[0] : DEFAULT_SOLID_COLOR);
  const [lastGradient, setLastGradient] = useState<[string, string]>(value.backdrop === 'gradient' ? coverColors(value) : DEFAULT_GRADIENT);
  const pickScene = (backdrop: CoverBackdrop) => {
    setLastScene(backdrop);
    onChange({ ...value, backdrop, colors: undefined });
  };
  const pickSolid = (color: string) => {
    setLastSolid(color);
    onChange({ ...value, backdrop: 'solid', colors: [color] });
  };
  const pickGradient = (colors: [string, string]) => {
    setLastGradient(colors);
    onChange({ ...value, backdrop: 'gradient', colors });
  };
  const pickStyle = (next: BackgroundStyle) => {
    if (next === 'scene') pickScene(lastScene);
    else if (next === 'solid') pickSolid(lastSolid);
    else pickGradient(lastGradient);
  };
  const [from, to] = coverColors(value);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const q = query.trim();
  const shownGroups = category ? COVER_ICON_GROUPS.filter((g) => g.label === category) : COVER_ICON_GROUPS;
  const results = useMemo(() => {
    if (!q) return null;
    const inCategory = category ? new Set(COVER_ICON_GROUPS.find((g) => g.label === category)?.icons) : null;
    return searchCoverIcons(q).filter((icon) => !inCategory || inCategory.has(icon));
  }, [q, category]);

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
      {preview && <CoverHeaderPreview art={value} title={title} placeholder={placeholder} />}
      <div className="cover-picker-controls">
        {showStyle && (
          <>
            <div className="cover-picker-group">
              <span className="cover-picker-label" id="cover-backdrop-label">
                Background
              </span>
              <Segmented label="Background style" value={style} onChange={pickStyle} options={BACKGROUND_STYLES} />
              {style === 'scene' && (
                <div className="cover-backdrops" role="radiogroup" aria-labelledby="cover-backdrop-label">
                  {COVER_BACKDROP_ORDER.map((b) => (
                    <button
                      key={b}
                      type="button"
                      role="radio"
                      aria-checked={value.backdrop === b}
                      className="cover-backdrop-option"
                      onClick={() => pickScene(b)}
                    >
                      <span className="cover-backdrop-thumb">
                        <CoverArt art={{ ...value, backdrop: b, colors: undefined }} showIcon={false} />
                      </span>
                      <span className="cover-backdrop-name">{COVER_BACKDROP_LABELS[b]}</span>
                    </button>
                  ))}
                </div>
              )}
              {style === 'solid' && (
                <>
                  <div className="cover-paints" role="radiogroup" aria-label="Background colour">
                    {COVER_SOLID_COLORS.map((c) => (
                      <button
                        key={c.color}
                        type="button"
                        role="radio"
                        aria-checked={sameColor(value.colors?.[0], c.color)}
                        aria-label={c.label}
                        title={c.label}
                        className="cover-paint-swatch"
                        style={{ background: c.color }}
                        onClick={() => pickSolid(c.color)}
                      />
                    ))}
                  </div>
                  <div className="cover-paint-customs">
                    <ColorField label="Custom" value={from} onChange={pickSolid} />
                  </div>
                </>
              )}
              {style === 'gradient' && (
                <>
                  <div className="cover-paints" role="radiogroup" aria-label="Background gradient">
                    {COVER_GRADIENTS.map((g) => (
                      <button
                        key={g.label}
                        type="button"
                        role="radio"
                        aria-checked={sameColor(value.colors?.[0], g.colors[0]) && sameColor(value.colors?.[1], g.colors[1])}
                        aria-label={g.label}
                        title={g.label}
                        className="cover-paint-swatch"
                        style={{ background: coverPaint({ backdrop: 'gradient', colors: g.colors }) ?? undefined }}
                        onClick={() => pickGradient(g.colors)}
                      />
                    ))}
                  </div>
                  <div className="cover-paint-customs">
                    <ColorField label="From" value={from} onChange={(c) => pickGradient([c, to])} />
                    <ColorField label="To" value={to} onChange={(c) => pickGradient([from, c])} />
                  </div>
                </>
              )}
            </div>

            <div className="cover-picker-group">
              <span className="cover-picker-label">Icon frame</span>
              <div className="cover-frame-controls">
                <Segmented label="Frame shape" value={frame.shape} onChange={(shape) => setFrame({ shape })} options={SHAPES} />
                {frame.shape !== 'none' && (
                  <Segmented label="Frame fill" value={frame.fill} onChange={(fill) => setFrame({ fill })} options={FILLS} />
                )}
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
          </>
        )}
        {showIcons && (
          <>
            <div className="cover-picker-group cover-icon-finder">
              <label className="cover-picker-label" htmlFor="cover-icon-search">
                Icon
              </label>
              <div className="cover-icon-filters">
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
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm cover-icon-search-clear"
                      aria-label="Clear search"
                      onClick={() => setQuery('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <select
                  className="select cover-icon-category"
                  value={category ?? ''}
                  onChange={(e) => setCategory(e.target.value || null)}
                  aria-label="Icon category"
                >
                  <option value="">All icons</option>
                  {COVER_ICON_GROUPS.map((g) => (
                    <option key={g.label} value={g.label}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
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
          </>
        )}
      </div>
    </div>
  );
}

/** The browser's colour picker behind a swatch showing the current colour. */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  return (
    <label className="cover-paint-custom">
      <span className="cover-paint-custom-swatch" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toLowerCase())} aria-label={`${label} colour`} />
      </span>
      {label}
    </label>
  );
}
