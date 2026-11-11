import { useRef, useState, type AnimationEvent, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { coverColors, coverPaint, isDarkCover, isPlainBackdrop, type CoverArt as CoverArtValue } from '../../shared/types';
import { brand } from '../config/brand';
import { Cloud, CloudBank } from './Cloud';
import { FEATURE_ILLUSTRATIONS, ILLUSTRATED_ITEMS } from './ItemIllustrations';
import { Logo } from './Logo';

/** Items that ride across the footer in thought clouds. Must be longer than PARADE_SLOTS so on-screen clouds never repeat. */
const PARADE_ITEMS = [FEATURE_ILLUSTRATIONS.surprise, ...ILLUSTRATED_ITEMS.map((i) => i.art), FEATURE_ILLUSTRATIONS.store];
const PARADE_SECONDS = 42;
const PARADE_SLOTS = [
  { width: 112, top: 6 },
  { width: 92, top: 30 },
  { width: 120, top: 2 },
  { width: 100, top: 26 },
  { width: 108, top: 12 },
  { width: 88, top: 34 },
];

/**
 * Thought clouds drifting left to right on a loop. Each time a cloud wraps
 * (off-screen) it takes the next item in PARADE_ITEMS, so the clouds on screen
 * are always the most recent PARADE_SLOTS.length items and never repeat.
 */
function FooterParade() {
  const [slotItems, setSlotItems] = useState(() => PARADE_SLOTS.map((_, i) => i));
  const nextItem = useRef(PARADE_SLOTS.length);

  const onWrap = (slot: number) => (e: AnimationEvent) => {
    if (e.animationName !== 'thought-parade') return;
    const item = nextItem.current++ % PARADE_ITEMS.length;
    setSlotItems((current) => current.map((v, i) => (i === slot ? item : v)));
  };

  return (
    <>
      {PARADE_SLOTS.map(({ width, top }, i) => (
        <span
          key={i}
          className={`footer-thought${i % 2 ? ' footer-thought-alt' : ''}`}
          onAnimationIteration={onWrap(i)}
          style={{
            top,
            ['--w' as string]: `${width}px`,
            ['--rest' as string]: `calc(${(i + 0.3) / PARADE_SLOTS.length} * 100cqw)`,
            animationDelay: `${(-i / PARADE_SLOTS.length) * PARADE_SECONDS}s, ${-i * 0.8}s`,
          }}
        >
          <Cloud className="thought-cloud" />
          <span className="thought-art">{PARADE_ITEMS[slotItems[i]]}</span>
        </span>
      ))}
    </>
  );
}

/** Soft tint for the cloud bank back, derived from a profile cover without filling the sky. */
function themeVars(coverArt: CoverArtValue): CSSProperties {
  if (isPlainBackdrop(coverArt.backdrop)) {
    const [a, b] = coverColors(coverArt);
    const base = coverArt.backdrop === 'gradient' ? b : a;
    return {
      ['--footer-base' as string]: base,
      ['--footer-inner-bg' as string]: coverPaint(coverArt) ?? base,
      ['--footer-cloud-back' as string]: `color-mix(in srgb, ${a} 45%, var(--tint-base))`,
    } as CSSProperties;
  }

  const sceneTint: Partial<Record<CoverArtValue['backdrop'], string>> = {
    sky: 'color-mix(in srgb, var(--accent) 22%, var(--tint-base))',
    blush: 'color-mix(in srgb, var(--blush) 28%, var(--tint-base))',
    mint: 'color-mix(in srgb, #5f9e6e 26%, var(--tint-base))',
    lilac: 'color-mix(in srgb, #7c6cf0 22%, var(--tint-base))',
    sunset: '#f6c6c4',
    night: 'rgba(255, 255, 255, 0.16)',
    snow: 'rgba(255, 255, 255, 0.4)',
    spring: '#9fd18f',
    summer: '#3fb2c9',
    autumn: '#e7a463',
    hearts: '#f4b0c0',
    shamrock: '#93cf95',
    spooky: 'rgba(255, 255, 255, 0.14)',
    harvest: '#d98d45',
    hanukkah: 'rgba(255, 255, 255, 0.3)',
    confetti: 'color-mix(in srgb, var(--accent) 22%, var(--tint-base))',
  };

  const sceneBase: Partial<Record<CoverArtValue['backdrop'], string>> = {
    night: '#e9effb',
    spring: '#cdeabf',
    summer: '#f8e5b5',
    autumn: '#f7d9b2',
    shamrock: '#e0f3d4',
    spooky: '#e8def6',
    harvest: '#f8dbb0',
    hanukkah: '#e6edfb',
    hearts: 'color-mix(in srgb, #f4b0c0 35%, var(--cloud-fill))',
    blush: 'color-mix(in srgb, var(--blush) 18%, var(--cloud-fill))',
    mint: 'color-mix(in srgb, #5f9e6e 14%, var(--cloud-fill))',
    lilac: 'color-mix(in srgb, #7c6cf0 12%, var(--cloud-fill))',
    sunset: 'color-mix(in srgb, #f6c6c4 28%, var(--cloud-fill))',
  };

  return {
    ['--footer-cloud-back' as string]: sceneTint[coverArt.backdrop] ?? 'color-mix(in srgb, var(--accent) 22%, var(--tint-base))',
    ['--footer-base' as string]: sceneBase[coverArt.backdrop] ?? 'var(--cloud-fill)',
  } as CSSProperties;
}

/** Sky footer for the public pages. Optionally mirrors a profile cover graphic. */
export function SiteFooter({ coverArt = null }: { coverArt?: CoverArtValue | null }) {
  const themed = Boolean(coverArt);
  const dark = coverArt ? isDarkCover(coverArt) : false;
  const darkBar = Boolean(coverArt && dark && isPlainBackdrop(coverArt.backdrop));
  const style = coverArt ? themeVars(coverArt) : undefined;

  return (
    <footer
      className={['landing-footer', themed && 'landing-footer-themed', dark && 'landing-footer-themed-dark', darkBar && 'is-dark-bar'].filter(Boolean).join(' ')}
      style={style}
    >
      <div className="footer-sky" aria-hidden>
        <FooterParade />
        <CloudBank className="footer-bank" />
      </div>
      <div className="landing-footer-inner">
        <Logo to="/" size={26} />
        <span>{brand.tagline}</span>
        <span className="spacer" />
        <nav className="legal-links" aria-label="More">
          <Link to="/gifts">Gift ideas</Link>
          <Link to="/extension">Browser extension</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/pricing">Mock pricing</Link>
        </nav>
        <span>
          © {new Date().getFullYear()} {brand.name}
        </span>
      </div>
    </footer>
  );
}
