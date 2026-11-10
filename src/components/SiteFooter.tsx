import { useRef, useState, type AnimationEvent } from 'react';
import { Link } from 'react-router-dom';
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

/** Sky footer for the public pages. */
export function SiteFooter() {
  return (
    <footer className="landing-footer">
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
        </nav>
        <span>
          © {new Date().getFullYear()} {brand.name}
        </span>
      </div>
    </footer>
  );
}
