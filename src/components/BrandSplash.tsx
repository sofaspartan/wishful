import { useEffect, useState } from 'react';
import { BrandMarkSvg } from './brandLogo';
import { brand } from '../config/brand';

const SPLASH_KEY = 'wishful.splash.seen';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** One-shot cloud mark intro on first open this session. */
export function BrandSplash() {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (prefersReducedMotion()) return false;
    try {
      return sessionStorage.getItem(SPLASH_KEY) !== '1';
    } catch {
      return false;
    }
  });
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem(SPLASH_KEY, '1');
    } catch {
      /* ignore */
    }
    const leaveAt = window.setTimeout(() => setLeaving(true), 1100);
    const hideAt = window.setTimeout(() => setShow(false), 1500);
    return () => {
      window.clearTimeout(leaveAt);
      window.clearTimeout(hideAt);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div className={`brand-splash${leaving ? ' is-leaving' : ''}`} role="presentation" aria-hidden>
      <div className="brand-splash-mark play">
        <BrandMarkSvg />
      </div>
      <span className="brand-splash-word">{brand.name}</span>
    </div>
  );
}
