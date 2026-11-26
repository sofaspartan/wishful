import { useEffect, useState } from 'react';
import { BrandMarkSvg } from './brandLogo';
import { brand } from '../config/brand';

const SPLASH_KEY = 'wishful.splash.seen';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function ensureWishfulFont() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  try {
    await Promise.race([
      document.fonts.load("600 48px Wishful"),
      new Promise<void>((resolve) => window.setTimeout(resolve, 400)),
    ]);
  } catch {
    /* fall through with fallback stack */
  }
}

/** One-shot cloud mark + Wishful wordmark intro on first open this session. */
export function BrandSplash() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    try {
      if (sessionStorage.getItem(SPLASH_KEY) === '1') return;
    } catch {
      return;
    }

    let cancelled = false;
    let leaveAt = 0;
    let hideAt = 0;

    void (async () => {
      await ensureWishfulFont();
      if (cancelled) return;
      try {
        sessionStorage.setItem(SPLASH_KEY, '1');
      } catch {
        /* ignore */
      }
      setShow(true);
      leaveAt = window.setTimeout(() => setLeaving(true), 1100);
      hideAt = window.setTimeout(() => setShow(false), 1500);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(leaveAt);
      window.clearTimeout(hideAt);
    };
  }, []);

  if (!show) return null;

  return (
    <div className={`brand-splash${leaving ? ' is-leaving' : ''}`} role="presentation" aria-hidden>
      <div className="brand-splash-mark play">
        <BrandMarkSvg />
      </div>
      <span className="brand-splash-word display">{brand.name}</span>
    </div>
  );
}
