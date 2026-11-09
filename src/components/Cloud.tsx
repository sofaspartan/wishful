import type { CSSProperties } from 'react';

/**
 * Decorative cloud shape (200×110); colour it with `fill`. The puffs aren't
 * centred in the box: their visual middle is at (53%, 54.5%), exposed to CSS as
 * --cloud-cx / --cloud-cy in tokens.css for centring content inside a cloud.
 */
export function Cloud({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 200 110" aria-hidden focusable="false">
      <circle cx="52" cy="70" r="30" />
      <circle cx="92" cy="50" r="40" />
      <circle cx="140" cy="60" r="32" />
      <circle cx="172" cy="80" r="22" />
      <rect x="22" y="70" width="172" height="32" rx="16" />
    </svg>
  );
}

/** A two-tone cloud (tinted shadow behind a white puff) that drifts; position it with a `cloud-N` class. */
export function CloudPuff({ className }: { className: string }) {
  return (
    <div className={`cloud ${className}`} aria-hidden>
      <Cloud className="cloud-back" />
      <Cloud className="cloud-front" />
    </div>
  );
}

const BANK_BACK_R = [66, 58, 74, 54, 70, 62, 78, 56, 68, 60, 76, 54, 72, 64, 74, 58, 70, 62];
const BANK_FRONT_R = [52, 44, 60, 40, 56, 48, 64, 42, 54, 46, 62, 40, 58, 50, 60, 44, 56, 48, 52];
/** [cx, r] puffs spanning 2880 units, wide enough that very wide screens never scale (and clip) the bank. */
const BANK_BACK = Array.from({ length: 36 }, (_, i) => [-700 + i * 80, BANK_BACK_R[i % BANK_BACK_R.length]]);
const BANK_FRONT = Array.from({ length: 37 }, (_, i) => [-740 + i * 80, BANK_FRONT_R[i % BANK_FRONT_R.length]]);

/** A rolling bank of clouds pinned to the bottom of a `position: relative` parent; colour the layers per context. */
export function CloudBank({ className }: { className: string }) {
  return (
    <svg className={`cloud-bank ${className}`} viewBox="-720 0 2880 120" preserveAspectRatio="xMidYMax slice" aria-hidden focusable="false">
      <g className="cloud-bank-back">
        {BANK_BACK.map(([cx, r]) => (
          <circle key={cx} cx={cx} cy={100 - r * 0.1} r={r} />
        ))}
      </g>
      <g className="cloud-bank-front">
        {BANK_FRONT.map(([cx, r]) => (
          <circle key={cx} cx={cx} cy={128 - r * 0.4} r={r} />
        ))}
        <rect x="-800" y="100" width="3040" height="20" />
      </g>
    </svg>
  );
}
