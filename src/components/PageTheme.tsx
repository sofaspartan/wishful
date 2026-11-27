import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  DEFAULT_GRADIENT,
  DEFAULT_SOLID_COLOR,
  coverColors,
  coverPaint,
  isDarkCover,
  isPlainBackdrop,
  resolvePageTheme,
  type CoverArt,
  type CoverBackdrop,
  type PageBackdrop,
} from '../../shared/types';
import {
  COVER_BACKDROP_LABELS,
  COVER_BACKDROP_ORDER,
  COVER_GRADIENTS,
  COVER_SOLID_COLORS,
  CoverArt as CoverArtView,
} from './CoverArt';
import { CloudBank } from './Cloud';
import { ColorField, CoverHeaderPreview } from './CoverArtPicker';
import { Segmented } from './ui/misc';

type PageMode = 'default' | 'match' | 'scene' | 'solid' | 'gradient';

const PAGE_MODES: Array<{ value: PageMode; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'match', label: 'Match cover' },
  { value: 'scene', label: 'Scene' },
  { value: 'solid', label: 'Color' },
  { value: 'gradient', label: 'Gradient' },
];

const sameColor = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();

function modeOf(value: PageBackdrop | null | undefined): PageMode {
  if (!value) return 'default';
  if (value === 'match') return 'match';
  if (value === 'solid') return 'solid';
  if (value === 'gradient') return 'gradient';
  return 'scene';
}

/** Pick how the whole list/box page is washed — default, match the cover, or a scene / colour / gradient. */
export function PageBackdropPicker({
  value,
  colors,
  onChange,
  coverArt,
}: {
  value: PageBackdrop | null | undefined;
  colors?: string[] | null;
  onChange: (next: PageBackdrop | null, colors?: string[] | null) => void;
  coverArt?: CoverArt | null;
}) {
  const mode = modeOf(value);
  const scene: CoverBackdrop =
    mode === 'scene' && value && value !== 'match' && !isPlainBackdrop(value)
      ? value
      : coverArt && !coverPaint(coverArt)
        ? coverArt.backdrop
        : 'sky';
  const paintArt = { backdrop: mode === 'gradient' ? ('gradient' as const) : ('solid' as const), colors: colors ?? undefined };
  const [from, to] = coverColors(mode === 'solid' || mode === 'gradient' ? paintArt : { backdrop: 'solid', colors: undefined });
  const [lastScene, setLastScene] = useState<CoverBackdrop>(scene);
  const [lastSolid, setLastSolid] = useState(value === 'solid' && colors?.[0] ? colors[0] : DEFAULT_SOLID_COLOR);
  const [lastGradient, setLastGradient] = useState<[string, string]>(
    value === 'gradient' && colors?.length === 2 ? [colors[0], colors[1]] : DEFAULT_GRADIENT,
  );

  const pickScene = (backdrop: CoverBackdrop) => {
    setLastScene(backdrop);
    onChange(backdrop, null);
  };
  const pickSolid = (color: string) => {
    setLastSolid(color);
    onChange('solid', [color]);
  };
  const pickGradient = (next: [string, string]) => {
    setLastGradient(next);
    onChange('gradient', next);
  };

  return (
    <div className="field">
      <span className="field-label">Page background</span>
      <Segmented<PageMode>
        label="Page background"
        value={mode}
        onChange={(next) => {
          if (next === 'default') onChange(null, null);
          else if (next === 'match') onChange('match', null);
          else if (next === 'scene') pickScene(lastScene);
          else if (next === 'solid') pickSolid(lastSolid);
          else pickGradient(lastGradient);
        }}
        options={PAGE_MODES}
      />
      {mode === 'default' && <span className="field-hint">Keeps the usual app background below the cover.</span>}
      {mode === 'match' && <span className="field-hint">Soft wash from your cover scene down the page.</span>}
      {mode === 'scene' && (
        <>
          <span className="field-hint">Pick a scene for the page, independent of the cover.</span>
          <div className="cover-backdrops" role="radiogroup" aria-label="Page scene">
            {COVER_BACKDROP_ORDER.map((b) => (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={scene === b}
                className="cover-backdrop-option"
                onClick={() => pickScene(b)}
              >
                <span className="cover-backdrop-thumb">
                  <CoverArtView
                    art={{
                      icon: coverArt?.icon ?? 'gift',
                      backdrop: b,
                      colors: undefined,
                      frame: coverArt?.frame,
                    }}
                    showIcon={false}
                  />
                </span>
                <span className="cover-backdrop-name">{COVER_BACKDROP_LABELS[b]}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {mode === 'solid' && (
        <>
          <span className="field-hint">A flat colour wash behind the whole page.</span>
          <div className="cover-paints" role="radiogroup" aria-label="Page colour">
            {COVER_SOLID_COLORS.map((c) => (
              <button
                key={c.color}
                type="button"
                role="radio"
                aria-checked={sameColor(colors?.[0], c.color)}
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
      {mode === 'gradient' && (
        <>
          <span className="field-hint">A two-colour wash behind the whole page.</span>
          <div className="cover-paints" role="radiogroup" aria-label="Page gradient">
            {COVER_GRADIENTS.map((g) => (
              <button
                key={g.label}
                type="button"
                role="radio"
                aria-checked={sameColor(colors?.[0], g.colors[0]) && sameColor(colors?.[1], g.colors[1])}
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
  );
}

function themeStyle(
  theme: ReturnType<typeof resolvePageTheme>,
  accent: string,
): CSSProperties | undefined {
  if (theme.kind === 'none') return { ['--wl-accent' as string]: accent };
  if (theme.kind === 'accent') {
    return {
      ['--wl-accent' as string]: accent,
      ['--page-tint' as string]: accent,
      ['--page-tint-2' as string]: accent,
      ['--list-tint' as string]: accent,
      ['--list-tint-2' as string]: accent,
    };
  }
  const paint = coverPaint({ backdrop: theme.backdrop, colors: theme.colors });
  if (paint) {
    const from = theme.colors?.[0] ?? accent;
    const to = theme.colors?.[1] ?? from;
    return {
      ['--wl-accent' as string]: accent,
      ['--page-tint' as string]: from,
      ['--page-tint-2' as string]: to,
      ['--list-tint' as string]: from,
      ['--list-tint-2' as string]: to,
      ['--page-paint' as string]: paint,
    };
  }
  // Scene tints come from `.page-bg-*` — don't override them with the accent.
  return { ['--wl-accent' as string]: accent };
}

/** Applies a soft themed wash (and optional sky band) around list/box page content. */
export function ThemedPage({
  pageBackdrop,
  pageColors,
  coverArt,
  accentColor,
  className,
  style,
  as: Tag = 'div',
  children,
}: {
  pageBackdrop?: PageBackdrop | null;
  pageColors?: string[] | null;
  coverArt?: CoverArt | null;
  /** Falls back to the brand accent when omitted (e.g. public profiles). */
  accentColor?: string;
  className?: string;
  style?: CSSProperties;
  as?: 'div' | 'section';
  children: ReactNode;
}) {
  const theme = resolvePageTheme({ pageBackdrop, pageColors, coverArt });
  const backdrop: CoverBackdrop | null = theme.kind === 'backdrop' ? theme.backdrop : null;
  const themeColors = theme.kind === 'backdrop' ? theme.colors : undefined;
  const dark = backdrop ? isDarkCover({ backdrop, colors: themeColors }) : false;
  const paint = backdrop ? coverPaint({ backdrop, colors: themeColors }) : null;
  const classes = [
    className,
    theme.kind !== 'none' && 'page-themed',
    theme.kind === 'accent' && 'page-themed-accent',
    backdrop && `page-bg-${backdrop}`,
    paint && 'page-themed-paint',
    dark && 'page-themed-dark',
  ]
    .filter(Boolean)
    .join(' ');

  const accent = accentColor ?? DEFAULT_SOLID_COLOR;

  return (
    <Tag className={classes} style={{ ...themeStyle(theme, accent), ...style }}>
      {backdrop && !paint && (
        <div className="page-theme-sky" aria-hidden>
          {/* Scene fades; bank stays opaque so footer clouds don’t go see-through. */}
          <div className="page-theme-sky-scene">
            <CoverArtView
              art={{
                icon: coverArt?.icon ?? 'gift',
                backdrop,
                colors: themeColors,
                frame: coverArt?.frame,
              }}
              showIcon={false}
              showBank={false}
            />
          </div>
          {backdrop !== 'confetti' && (
            <div className="page-theme-bank-wrap">
              <CloudBank className="page-theme-bank cover-bank" />
            </div>
          )}
        </div>
      )}
      {children}
    </Tag>
  );
}

/** Compact mock of a list/box page with the chosen page wash behind the cover. */
export function PageThemePreview({
  pageBackdrop,
  pageColors,
  coverArt,
  accentColor,
  title,
  placeholder = 'Your list',
}: {
  pageBackdrop?: PageBackdrop | null;
  pageColors?: string[] | null;
  coverArt?: CoverArt | null;
  accentColor: string;
  title?: string;
  placeholder?: string;
}) {
  return (
    <ThemedPage
      className="page-theme-preview"
      pageBackdrop={pageBackdrop}
      pageColors={pageColors}
      coverArt={coverArt}
      accentColor={accentColor}
    >
      <span className="section-link page-theme-preview-back">My Lists</span>
      {coverArt ? (
        <CoverHeaderPreview art={coverArt} title={title} placeholder={placeholder} />
      ) : (
        <div className="page-theme-preview-hero" style={{ ['--wl-accent' as string]: accentColor }}>
          <span className="page-theme-preview-title">{title?.trim() || placeholder}</span>
        </div>
      )}
      <div className="page-theme-preview-card" aria-hidden>
        <span className="page-theme-preview-line" />
        <span className="page-theme-preview-line short" />
      </div>
    </ThemedPage>
  );
}
