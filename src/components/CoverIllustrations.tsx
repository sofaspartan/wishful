import type { ReactElement, ReactNode } from 'react';
import type { CoverIcon } from '../../shared/types';

/* Seasonal and occasion illustrations for list cover graphics, in the same 48×48 flat style as ItemIllustrations. */

const INK = '#2f3440';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden focusable="false">
      {children}
    </svg>
  );
}

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join('L')}Z`;
}

const Tree = (
  <Svg>
    <rect x="21" y="35" width="6" height="8" rx="1.5" fill="#a37c4f" />
    <path d="M24 17L41 36H7z" fill="#3f8a5a" strokeLinejoin="round" stroke="#3f8a5a" strokeWidth="2" />
    <path d="M24 11L37 27H11z" fill="#4f9e68" strokeLinejoin="round" stroke="#4f9e68" strokeWidth="2" />
    <path d="M24 6L33 18H15z" fill="#5fb07a" strokeLinejoin="round" stroke="#5fb07a" strokeWidth="2" />
    <path d="M14.5 31.5c6 2 13 2 19-1M17 23c4.5 1.5 9.5 1.5 14-.5" stroke="#f2c14e" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="18" cy="29" r="1.9" fill="#e8745b" />
    <circle cx="28.5" cy="33" r="1.9" fill="#7c6cf0" />
    <circle cx="30" cy="22" r="1.7" fill="#e8745b" />
    <circle cx="20" cy="18.5" r="1.5" fill="#4fa3a5" />
    <path className="fa-spark" d={starPath(24, 5.5, 4.6, 2)} fill="#f2c14e" strokeLinejoin="round" stroke="#f2c14e" strokeWidth="1" />
  </Svg>
);

const Snowflake = (
  <Svg>
    <g stroke="#5b8fd6" strokeWidth="2.6" strokeLinecap="round">
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <g key={a} transform={`rotate(${a} 24 24)`}>
          <path d="M24 24V5" />
          <path d="M24 11l-4.5-4.5M24 11l4.5-4.5M24 17.5l-3.5-3.5M24 17.5l3.5-3.5" strokeWidth="2.1" />
        </g>
      ))}
    </g>
    <circle cx="24" cy="24" r="3.4" fill="#fff" stroke="#5b8fd6" strokeWidth="2" />
  </Svg>
);

const Snowman = (
  <Svg>
    <path d="M14.5 30L7 24.5M33.5 30L41 24.5M9.5 26l-2.5.5M38.5 26l2.5.5" stroke="#a37c4f" strokeWidth="2" strokeLinecap="round" />
    <circle cx="24" cy="33" r="10" fill="#fff" stroke="#c9d6e8" strokeWidth="1.5" />
    <circle cx="24" cy="17.5" r="7" fill="#fff" stroke="#c9d6e8" strokeWidth="1.5" />
    <rect x="19" y="2.5" width="10" height="8" rx="1.5" fill={INK} />
    <rect x="16" y="9.5" width="16" height="2.6" rx="1.3" fill={INK} />
    <rect x="19" y="7" width="10" height="2" fill="#e8745b" />
    <circle cx="21.6" cy="16.5" r="1.1" fill={INK} />
    <circle cx="26.4" cy="16.5" r="1.1" fill={INK} />
    <path d="M24 18.6l5 1.3-5 1.1z" fill="#f08a3c" />
    <path d="M17 23.4h14a1.8 1.8 0 0 1 0 3.6H17a1.8 1.8 0 0 1 0-3.6z" fill="#e8745b" />
    <rect x="26" y="25" width="3.6" height="7" rx="1.5" fill="#c4553d" />
    <circle cx="24" cy="31" r="1.2" fill={INK} />
    <circle cx="24" cy="36" r="1.2" fill={INK} />
  </Svg>
);

const Ornament = (
  <Svg>
    <circle cx="24" cy="6.5" r="2.4" stroke="#b8963f" strokeWidth="1.6" />
    <rect x="20.5" y="8.5" width="7" height="4.5" rx="1.2" fill="#d9b453" />
    <circle cx="24" cy="27" r="14" fill="#e8745b" />
    <rect x="10.6" y="23.6" width="26.8" height="6" rx="3" fill="#f2c14e" />
    <circle cx="16" cy="26.6" r="1.2" fill="#fff" />
    <circle cx="24" cy="26.6" r="1.2" fill="#fff" />
    <circle cx="32" cy="26.6" r="1.2" fill="#fff" />
    <path d="M16.5 19a10 10 0 0 1 5-4.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".75" />
  </Svg>
);

const CandyCane = (
  <Svg>
    <path d="M29 43V16a7 7 0 0 0-14 0v3" stroke="#e0533d" strokeWidth="6.5" strokeLinecap="round" />
    <path d="M29 43V16a7 7 0 0 0-14 0v3" stroke="#fff" strokeWidth="6.5" strokeDasharray="3.6 3.6" />
    <path d="M24.5 30l4.5 2.5 4.5-2.5v5l-4.5-2.5-4.5 2.5z" fill="#4f9e68" />
    <circle cx="29" cy="32.5" r="1.6" fill="#3f8a5a" />
  </Svg>
);

const Pumpkin = (
  <Svg>
    <path d="M24 15c0-4 1.5-7 4-8.5" stroke="#6b8e4e" strokeWidth="3" strokeLinecap="round" />
    <path d="M27 11c3-3 7-3 9-1-2.5 2.5-6 3-9 1z" fill="#76b584" />
    <ellipse cx="16" cy="29" rx="9" ry="12" fill="#e2772f" />
    <ellipse cx="32" cy="29" rx="9" ry="12" fill="#e2772f" />
    <ellipse cx="24" cy="29" rx="9.5" ry="13" fill="#f2924a" />
    <path d="M24 17v24M17.5 19c-2 6-2 14 0 20M30.5 19c2 6 2 14 0 20" stroke="#d26a26" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
  </Svg>
);

const Leaf = (
  <Svg>
    <path d="M24 44V32" stroke="#a5582a" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M24 4c9 6 14 14 12.5 22.5C35 34 29.5 37 24 38c-5.5-1-11-4-12.5-11.5C10 18 15 10 24 4z" fill="#e98a3a" />
    <path d="M24 9v29M24 18l-6-5M24 18l6-5M24 26l-8-6M24 26l8-6M24 33l-6-4M24 33l6-4" stroke="#c4662a" strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

const Sun = (
  <Svg>
    <g className="fa-rays" stroke="#f2c14e" strokeWidth="2.8" strokeLinecap="round">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <path key={a} d="M24 6.5v4" transform={`rotate(${a} 24 24)`} />
      ))}
    </g>
    <circle cx="24" cy="24" r="10" fill="#f6c443" />
    <circle cx="20.5" cy="23" r="1.2" fill={INK} />
    <circle cx="27.5" cy="23" r="1.2" fill={INK} />
    <path d="M21 26.8c1.8 1.6 4.2 1.6 6 0" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="18.5" cy="26.5" r="1.5" fill="#f08a6c" opacity=".7" />
    <circle cx="29.5" cy="26.5" r="1.5" fill="#f08a6c" opacity=".7" />
  </Svg>
);

const Flower = (
  <Svg>
    <path d="M24 26v17" stroke="#3f7d52" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M24 37c-6 0-9-3.5-9-8 5 0 9 3 9 8zM24 34c0-4.5 3.5-7.5 8.5-7.5 0 4.5-3.5 7.5-8.5 7.5z" fill="#5f9e6e" />
    {[0, 72, 144, 216, 288].map((a) => (
      <circle key={a} cx="24" cy="10.5" r="6" fill="#f19bb0" transform={`rotate(${a} 24 18)`} />
    ))}
    <circle cx="24" cy="18" r="4.6" fill="#f2c14e" />
  </Svg>
);

const HOLLY_LEAF = 'M0 0Q2-4 6-8.5Q7.5-5.5 11-8.8Q12.5-5.5 16-8Q17-4.5 22 0Q17 4.5 16 8Q12.5 5.5 11 8.8Q7.5 5.5 6 8.5Q2 4 0 0z';

const Holly = (
  <Svg>
    {[
      [-90, '#4a9a5c'],
      [-165, '#2f7a45'],
      [-15, '#2f7a45'],
    ].map(([a, fill]) => (
      <g key={a} transform={`translate(24 31) rotate(${a}) scale(1 0.74)`}>
        <path d={HOLLY_LEAF} fill={fill as string} strokeLinejoin="round" stroke="#1f5a30" strokeWidth="1.3" />
        <path d="M3 0H18.5" stroke="#1f5a30" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
      </g>
    ))}
    <circle cx="19.8" cy="33.6" r="4.2" fill="#c4343a" />
    <circle cx="28.2" cy="33.6" r="4.2" fill="#c4343a" />
    <circle cx="24" cy="29.6" r="4.2" fill="#e04848" />
    <circle cx="22.6" cy="28.2" r="1.2" fill="#fff" opacity=".7" />
    <circle cx="18.4" cy="32.2" r="1.1" fill="#fff" opacity=".6" />
    <circle cx="26.8" cy="32.2" r="1.1" fill="#fff" opacity=".6" />
    <path className="fa-spark" d={starPath(40, 9, 3.2, 1.3)} fill="#f2c14e" />
  </Svg>
);

const Umbrella = (
  <Svg>
    <path d="M24 5v3" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M24 22v15a4 4 0 0 1-8 0" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
    <path
      d="M6 23a18 16 0 0 1 36 0c-1.5-2-4.5-2-6 0-1.5-2-4.5-2-6 0-1.5-2-4.5-2-6 0-1.5-2-4.5-2-6 0-1.5-2-4.5-2-6 0-1.5-2-4.5-2-6 0z"
      fill="#7c6cf0"
    />
    <path d="M24 7.5c-4 4-6 9.5-6 15.5M24 7.5c4 4 6 9.5 6 15.5" stroke="#a79cf6" strokeWidth="1.6" strokeLinecap="round" />
    <path className="fa-rays" d="M9 30c1.6 2.1 2 3.3 0 4.7-2-1.4-1.6-2.6 0-4.7z" fill="#5b8fd6" />
    <path className="fa-rays" d="M39.5 28c1.6 2.1 2 3.3 0 4.7-2-1.4-1.6-2.6 0-4.7z" fill="#5b8fd6" />
  </Svg>
);

const IceCream = (
  <Svg>
    <path d="M15.5 24L24 44l8.5-20z" fill="#e0a868" strokeLinejoin="round" stroke="#e0a868" strokeWidth="1.5" />
    <path d="M18 29.5h12M20.4 35h7.2" stroke="#c4874a" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="18" cy="21" r="6.5" fill="#fbe7c6" />
    <circle cx="30" cy="21" r="6.5" fill="#9fd3c7" />
    <circle cx="24" cy="15" r="7.5" fill="#f19bb0" />
    <path d="M20.5 13l1.6-.8M26.5 11.5l1.2 1.2M24 17.5l1.6.4M28 16.5l.3 1.6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M24 6c.6-2.2 2.4-3.6 4.8-3.8" stroke="#5f9e6e" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="23.6" cy="7.6" r="2.6" fill="#e8745b" />
  </Svg>
);

const Watermelon = (
  <Svg>
    <path d="M5 15a19 19 0 0 0 38 0z" fill="#5f9e6e" />
    <path d="M8 15a16 16 0 0 0 32 0z" fill="#f4f1e0" />
    <path d="M9.6 15a14.4 14.4 0 0 0 28.8 0z" fill="#ef6b6b" />
    <ellipse cx="17" cy="20" rx="1" ry="1.6" fill={INK} />
    <ellipse cx="24" cy="24" rx="1" ry="1.6" fill={INK} />
    <ellipse cx="31" cy="20" rx="1" ry="1.6" fill={INK} />
    <ellipse cx="20.5" cy="17" rx="1" ry="1.6" fill={INK} />
    <ellipse cx="27.5" cy="17" rx="1" ry="1.6" fill={INK} />
    <path className="fa-spark" d={starPath(40, 8, 3.4, 1.4)} fill="#f2c14e" />
  </Svg>
);

const Acorn = (
  <Svg>
    <path d="M24 6v5" stroke="#7a5230" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M26 9c3-3 7-3 9.5-1-2.5 2.6-6.5 3-9.5 1z" fill="#5f9e6e" />
    <path d="M13 22c0 10 5 17.5 11 20 6-2.5 11-10 11-20z" fill="#d99a52" />
    <path d="M17.5 27c.5 4 2 7.5 4.5 9.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".45" />
    <path d="M10.5 20c0-6 6-9.5 13.5-9.5S37.5 14 37.5 20c0 2-1.2 3-3.2 3H13.7c-2 0-3.2-1-3.2-3z" fill="#8a5a33" />
    <path d="M16 15.5l2.6 4M22 13l1.4 5M28 13l-1.4 5M32 15.5l-2.6 4" stroke="#6e4526" strokeWidth="1.3" strokeLinecap="round" />
  </Svg>
);

const Heart = (
  <Svg>
    <path d="M24 40L10.4 27a8.6 8.6 0 0 1 12.2-12.2L24 16.2l1.4-1.4A8.6 8.6 0 0 1 37.6 27z" fill="#e8745b" />
    <path d="M14 22a4.5 4.5 0 0 1 4-3.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".7" />
    <path className="fa-spark" d={starPath(39, 10, 3.6, 1.5)} fill="#f19bb0" />
  </Svg>
);

const Cake = (
  <Svg>
    <rect x="7" y="38.5" width="34" height="3" rx="1.5" fill="#c9d1dc" />
    <rect x="10" y="24" width="28" height="15" rx="3" fill="#f6d8c8" />
    <path d="M10 27a3 3 0 0 1 3-3h22a3 3 0 0 1 3 3v1.5c-1.6 1.8-3.2 0-4.6 0s-2.2 2.6-4.6 2.6-2.4-2.6-4.8-2.6-2.4 2.6-4.8 2.6-3-2.6-4.6-2.6-2 1.8-3.6 0z" fill="#f19bb0" />
    <rect x="15.5" y="15" width="2.6" height="9" rx="1.2" fill="#5b8fd6" />
    <rect x="22.7" y="15" width="2.6" height="9" rx="1.2" fill="#f2c14e" />
    <rect x="29.9" y="15" width="2.6" height="9" rx="1.2" fill="#4fa3a5" />
    <g className="fa-flame">
      <path d="M16.8 9.5c1.7 2 1.9 3.5 0 4.7-1.9-1.2-1.7-2.7 0-4.7zM24 9.5c1.7 2 1.9 3.5 0 4.7-1.9-1.2-1.7-2.7 0-4.7zM31.2 9.5c1.7 2 1.9 3.5 0 4.7-1.9-1.2-1.7-2.7 0-4.7z" fill="#f08a3c" />
    </g>
    <circle cx="16" cy="34" r="1" fill="#e8745b" />
    <circle cx="22" cy="35.5" r="1" fill="#5b8fd6" />
    <circle cx="28" cy="34" r="1" fill="#4fa3a5" />
    <circle cx="33" cy="35.5" r="1" fill="#f2c14e" />
  </Svg>
);

const Balloon = (
  <Svg>
    <path d="M31 25c-1.5 5 2 8 0 12.5" stroke="#9aa3b2" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M21 30c1.5 5-2 8 0 13" stroke="#9aa3b2" strokeWidth="1.4" strokeLinecap="round" />
    <ellipse cx="31" cy="14.5" rx="8" ry="10" fill="#4fa3a5" />
    <path d="M29.6 24.2h2.8l-1.4 2z" fill="#3f8a8c" />
    <ellipse cx="20.5" cy="18" rx="10" ry="12" fill="#e8745b" />
    <path d="M18.8 29.6h3.4l-1.7 2.4z" fill="#c4553d" />
    <path d="M14.5 13.5a6.5 6.5 0 0 1 4-4.4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".7" />
  </Svg>
);

const GradCap = (
  <Svg>
    <path d="M13 21v8c0 3 5 5.5 11 5.5s11-2.5 11-5.5v-8l-11 4.4z" fill="#454b59" />
    <path d="M24 9l20 8.5-20 8.5-20-8.5z" fill={INK} strokeLinejoin="round" stroke={INK} strokeWidth="1.5" />
    <path d="M24 17.5l13 4v10" stroke="#f2c14e" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M35.2 31h3.6l.8 6h-5.2z" fill="#f2c14e" />
    <circle cx="24" cy="17.5" r="1.6" fill="#f2c14e" />
  </Svg>
);

const Ring = (
  <Svg>
    <circle cx="24" cy="31" r="11" stroke="#e3b54d" strokeWidth="4.5" />
    <path d="M18 13.5h12l4 4.5-10 9.5-10-9.5z" fill="#a9d8f0" strokeLinejoin="round" stroke="#a9d8f0" strokeWidth="1" />
    <path d="M14 18h20M18 13.5l3 4.5 3 9.5 3-9.5 3-4.5" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" opacity=".85" />
    <path className="fa-spark" d={starPath(38, 9, 3.4, 1.4)} fill="#f2c14e" />
    <path className="fa-spark fa-spark-2" d={starPath(10, 11, 2.6, 1.1)} fill="#7c6cf0" />
  </Svg>
);

const House = (
  <Svg>
    <rect x="30.5" y="9.5" width="4.5" height="9" rx="1" fill="#c4553d" />
    <rect x="11" y="21" width="26" height="20" rx="2" fill="#f3e6d3" />
    <path d="M7 23.5L24 8.5l17 15z" fill="#e8745b" strokeLinejoin="round" stroke="#e8745b" strokeWidth="2.5" />
    <rect x="20.5" y="29.5" width="7" height="11.5" rx="1.6" fill="#3f6fb5" />
    <circle cx="26" cy="35.5" r=".9" fill="#f2c14e" />
    <rect x="13.5" y="26" width="5" height="5" rx="1" fill="#a9d8f0" />
    <rect x="29.5" y="26" width="5" height="5" rx="1" fill="#a9d8f0" />
  </Svg>
);

const StarIcon = (
  <Svg>
    <path d={starPath(24, 25.5, 18, 8)} fill="#f6c443" strokeLinejoin="round" stroke="#f6c443" strokeWidth="3" />
    <circle cx="20.5" cy="25" r="1.2" fill={INK} />
    <circle cx="27.5" cy="25" r="1.2" fill={INK} />
    <path d="M21.5 28.6c1.6 1.3 3.4 1.3 5 0" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
    <path className="fa-spark" d={starPath(41, 8, 3, 1.2)} fill="#7c6cf0" />
    <path className="fa-spark fa-spark-2" d={starPath(7, 40, 2.6, 1.1)} fill="#4fa3a5" />
  </Svg>
);

const Suitcase = (
  <Svg>
    <path d="M18 16v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" stroke={INK} strokeWidth="2.6" />
    <rect x="7" y="16" width="34" height="25" rx="4" fill="#4fa3a5" />
    <rect x="14" y="16" width="3.4" height="25" fill="#3f8a8c" />
    <rect x="30.6" y="16" width="3.4" height="25" fill="#3f8a8c" />
    <circle cx="24" cy="26" r="3.4" fill="#e8745b" />
    <rect x="20" y="32" width="8" height="4" rx="1.2" fill="#f2c14e" transform="rotate(-8 24 34)" />
    <circle cx="12" cy="42" r="1.6" fill={INK} />
    <circle cx="36" cy="42" r="1.6" fill={INK} />
  </Svg>
);

const Record = (
  <Svg>
    <g className="fa-record">
      <circle cx="24" cy="24" r="18" fill={INK} />
      <circle cx="24" cy="24" r="13.5" stroke="#4a5162" strokeWidth="1" />
      <circle cx="24" cy="24" r="10" stroke="#4a5162" strokeWidth="1" />
      <circle cx="24" cy="24" r="6.5" fill="#e8745b" />
      <circle cx="24" cy="24" r="1.3" fill="#fff" />
      <path d="M12.5 15.5a14 14 0 0 1 6-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".35" />
    </g>
  </Svg>
);

const Brick = (
  <Svg>
    {[12, 27].map((x) => (
      <g key={x}>
        <rect x={x} y="12.5" width="9" height="8" rx="1.6" fill="#d63d34" />
        <ellipse cx={x + 4.5} cy="12.5" rx="4.5" ry="1.9" fill="#f0675d" />
      </g>
    ))}
    <rect x="7" y="18" width="34" height="21" rx="3" fill="#e5483e" />
    <rect x="7" y="33" width="34" height="6" rx="2.5" fill="#c4362e" />
    <path d="M11 22.5h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".4" />
  </Svg>
);

const Controller = (
  <Svg>
    <path d="M14 16h20a9 9 0 0 1 8.7 6.8l2 8.2a5.5 5.5 0 0 1-9.4 5l-3.8-4H16.5l-3.8 4a5.5 5.5 0 0 1-9.4-5l2-8.2A9 9 0 0 1 14 16z" fill="#5b5bd6" />
    <path d="M9 19.5a7 7 0 0 1 5-2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".35" />
    <path d="M13.5 21.5v7M10 25h7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="33" cy="22.6" r="2" fill="#f2c14e" />
    <circle cx="37.2" cy="26.4" r="2" fill="#e8745b" />
    <circle cx="28.8" cy="26.4" r="2" fill="#4fa3a5" />
    <circle cx="33" cy="30.2" r="2" fill="#fdfaf3" />
    <path className="fa-spark" d={starPath(41.5, 8.5, 3, 1.2)} fill="#f2c14e" />
  </Svg>
);

function sparklePath(cx: number, cy: number, r: number): string {
  const k = r * 0.16;
  return `M${cx} ${cy - r}C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy}C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r}C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy}C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
}

const HEART_PATH = 'M24 22.5s-6.2-3.7-6.2-8a3.4 3.4 0 0 1 6.2-1.9 3.4 3.4 0 0 1 6.2 1.9c0 4.3-6.2 8-6.2 8z';

const Wishlist = (
  <Svg>
    <rect x="10" y="7.5" width="28" height="35" rx="4" fill="#fdfaf3" stroke={INK} strokeWidth="2" />
    <rect x="18" y="4.5" width="12" height="6" rx="2" fill="#7c6cf0" />
    <path d={HEART_PATH} fill="#e8745b" />
    <rect x="14.5" y="26" width="4.2" height="4.2" rx="1.1" fill="#4fa3a5" />
    <path d="M15.4 28.1l1.1 1.1 1.7-2.1" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 28.1h11.5" stroke="#c9cdd6" strokeWidth="2.6" strokeLinecap="round" />
    <rect x="14.5" y="33.5" width="4.2" height="4.2" rx="1.1" stroke={INK} strokeWidth="1.3" />
    <path d="M22 35.6h8" stroke="#c9cdd6" strokeWidth="2.6" strokeLinecap="round" />
    <path className="fa-spark" d={starPath(41.5, 9, 3.2, 1.3)} fill="#f2c14e" />
  </Svg>
);

const Sparkles = (
  <Svg>
    <path d={sparklePath(21, 27, 16)} fill="#f6c443" strokeLinejoin="round" stroke="#f6c443" strokeWidth="1.5" />
    <path className="fa-spark" d={sparklePath(38.5, 10.5, 6.5)} fill="#7c6cf0" />
    <path className="fa-spark fa-spark-2" d={sparklePath(39, 37, 4)} fill="#4fa3a5" />
    <circle cx="8" cy="9" r="1.6" fill="#e8745b" />
  </Svg>
);

const Chest = (
  <Svg>
    <path d="M7 23v-5a8 8 0 0 1 8-8h18a8 8 0 0 1 8 8v5z" fill="#b0763d" />
    <rect x="7" y="23" width="34" height="18" rx="3" fill="#c98a4b" />
    <rect x="7" y="21.5" width="34" height="3.4" fill="#8f5c2c" />
    <rect x="12.5" y="10.8" width="3.6" height="30.2" fill="#f2c14e" />
    <rect x="31.9" y="10.8" width="3.6" height="30.2" fill="#f2c14e" />
    <rect x="20.5" y="19.5" width="7" height="8.5" rx="1.8" fill="#f2c14e" />
    <circle cx="24" cy="23.2" r="1.3" fill={INK} />
    <path d="M24 23.8v2.2" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
    <path className="fa-spark" d={sparklePath(40, 6.5, 3.6)} fill="#f6c443" />
    <path className="fa-spark fa-spark-2" d={sparklePath(8, 6.5, 2.6)} fill="#7c6cf0" />
  </Svg>
);

/** Default cash-fund avatar: coin with a centered, correctly oriented dollar. */
const Cash = (
  <Svg>
    <circle cx="24" cy="24" r="16.5" fill="#f2c14e" />
    <circle cx="24" cy="24" r="13.2" fill="#ffe08a" stroke="#d4a017" strokeWidth="1.6" />
    <circle cx="24" cy="24" r="10.2" fill="none" stroke="#e8b83a" strokeWidth="1.2" strokeDasharray="2.2 2.4" />
    <g transform="translate(24 24) scale(1.15) translate(-12 -12)" stroke="#8a6410" strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </g>
    <path className="fa-spark" d={sparklePath(39, 9, 3.2)} fill="#fff3bf" />
  </Svg>
);

/* ── Halloween ─────────────────────────────────────────────────────────── */

const JackOLantern = (
  <Svg>
    <path d="M24 15c0-4 1.5-7 4-8.5" stroke="#6b8e4e" strokeWidth="3" strokeLinecap="round" />
    <path d="M27 11c3-3 7-3 9-1-2.5 2.5-6 3-9 1z" fill="#76b584" />
    <ellipse cx="16" cy="29" rx="9" ry="12" fill="#e2772f" />
    <ellipse cx="32" cy="29" rx="9" ry="12" fill="#e2772f" />
    <ellipse cx="24" cy="29" rx="9.5" ry="13" fill="#f2924a" />
    <g className="fa-rays" fill="#ffe08a" stroke="#b4561c" strokeWidth=".9" strokeLinejoin="round">
      <path d="M14.5 27l3.2-5.6 3.2 5.6z" />
      <path d="M27.1 27l3.2-5.6 3.2 5.6z" />
      <path d="M22.4 30.4l1.6-2.6 1.6 2.6z" />
      <path d="M14.5 32.5Q24 41 33.5 32.5L31 33.6 29.5 32.3 28 34 26 32.6 24 34.2 22 32.6 20 34 18.5 32.3 17 33.6z" />
    </g>
  </Svg>
);

const Ghost = (
  <Svg>
    <path
      d="M10 40V21a14 14 0 0 1 28 0v19c-2.3 0-2.3-2.6-4.6-2.6S31 40 28.6 40s-2.3-2.6-4.6-2.6S21.7 40 19.4 40s-2.4-2.6-4.7-2.6S12.3 40 10 40z"
      fill="#fff"
      stroke="#c9d1e0"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M10.5 25.5l-4 3M37.5 25.5l4 3" stroke="#c9d1e0" strokeWidth="2.6" strokeLinecap="round" />
    <ellipse cx="19.5" cy="20.5" rx="1.7" ry="2.3" fill={INK} />
    <ellipse cx="28.5" cy="20.5" rx="1.7" ry="2.3" fill={INK} />
    <ellipse cx="24" cy="27" rx="2.1" ry="2.7" fill={INK} />
    <circle cx="16" cy="24.6" r="1.7" fill="#f19bb0" opacity=".7" />
    <circle cx="32" cy="24.6" r="1.7" fill="#f19bb0" opacity=".7" />
    <path className="fa-spark" d={sparklePath(40.5, 8, 3.6)} fill="#7c6cf0" />
  </Svg>
);

const WitchHat = (
  <Svg>
    <ellipse cx="24" cy="37.5" rx="19" ry="4.6" fill="#4b3f9a" />
    <path d="M13 37L20 16Q23 8 33 6Q27 10 27 16L35 37Q24 40.5 13 37z" fill="#6b5bd2" />
    <path d="M15.4 30Q24 32.8 32.6 30L33.9 34Q24 37 14.1 34z" fill="#f2924a" />
    <rect x="21.4" y="30.6" width="5.2" height="4.6" rx=".8" stroke="#f6c443" strokeWidth="1.6" />
    <path d="M22 13.5c.6-2 1.8-3.6 3.6-4.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".35" />
    <path className="fa-spark" d={starPath(40, 13, 3.4, 1.4)} fill="#f2c14e" />
    <path className="fa-spark fa-spark-2" d={starPath(9, 22, 2.6, 1.1)} fill="#f2c14e" />
  </Svg>
);

const Bat = (
  <Svg>
    <circle cx="33" cy="13" r="8.5" fill="#fbe7a1" />
    <path
      d="M24 18c-2 0-3.5 1-4 2.5l-1.5-4-1 4.2C14 18 9 17 4 19c3 2 4 5 3.5 8 2-1.5 4.5-1.5 6 .5 1.5-1.8 4-2 5.5-.5 1.5 2.5 3 4 5 4s3.5-1.5 5-4c1.5-1.5 4-1.3 5.5.5 1.5-2 4-2 6-.5-.5-3 .5-6 3.5-8-5-2-10-1-13.5 1.7l-1-4.2-1.5 4C27.5 19 26 18 24 18z"
      fill="#4a3f6b"
      strokeLinejoin="round"
      stroke="#4a3f6b"
      strokeWidth="1"
    />
    <circle cx="21.8" cy="22.6" r="1.3" fill="#f6c443" />
    <circle cx="26.2" cy="22.6" r="1.3" fill="#f6c443" />
    <path d="M22.4 26.2l.8 1.7.8-1.7zM24 26.2l.8 1.7.8-1.7z" fill="#fff" />
    <path className="fa-spark" d={starPath(10, 36, 2.8, 1.2)} fill="#7c6cf0" />
  </Svg>
);

const CandyCorn = (
  <Svg>
    <g transform="rotate(14 24 24)">
      <path d="M24 5c1.8 0 4.5 5 6.6 11H17.4C19.5 10 22.2 5 24 5z" fill="#fdfaf3" stroke="#e8dcc4" strokeWidth="1" />
      <path d="M17.4 16h13.2c1.9 5 3.6 9.6 4.4 13H13c.8-3.4 2.5-8 4.4-13z" fill="#f2924a" />
      <path d="M13 29h22c1.2 3 2 5.4 2 7 0 4-6 6-13 6s-13-2-13-6c0-1.6.8-4 2-7z" fill="#f6c443" />
      <path d="M19.5 20c-1 3-1.8 6-2.2 8.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".45" />
    </g>
    <path className="fa-spark" d={sparklePath(40, 9, 3.6)} fill="#7c6cf0" />
    <path className="fa-spark fa-spark-2" d={sparklePath(8, 12, 2.6)} fill="#f2924a" />
  </Svg>
);

/* ── St. Patrick's Day ─────────────────────────────────────────────────── */

const LEAF_HEART = 'M0 0C-3-2-9-5-9-10a4.5 4.5 0 0 1 9-1.5 4.5 4.5 0 0 1 9 1.5c0 5-6 8-9 10z';

const Shamrock = (
  <Svg>
    <path d="M24 22c0 8 2 14 6 20" stroke="#3f8a5a" strokeWidth="2.8" strokeLinecap="round" />
    {[
      [0, '#5fb07a'],
      [-112, '#4f9e68'],
      [112, '#4f9e68'],
    ].map(([a, fill]) => (
      <g key={a} transform={`translate(24 22) rotate(${a})`}>
        <path d={LEAF_HEART} fill={fill as string} strokeLinejoin="round" stroke={fill as string} strokeWidth="1" />
        <path d="M0-2v-8" stroke="#8fd0a0" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    ))}
    <circle cx="24" cy="22" r="2" fill="#3f8a5a" />
    <path className="fa-spark" d={starPath(40, 9, 3.4, 1.4)} fill="#f2c14e" />
  </Svg>
);

const PotOfGold = (
  <Svg>
    <path d="M11 22c0-5.5 5.8-9 13-9s13 3.5 13 9z" fill="#f6c443" />
    {[
      [17, 15.5],
      [27.5, 13],
      [22.5, 10.2],
      [31.5, 17],
    ].map(([cx, cy]) => (
      <circle key={cx} cx={cx} cy={cy} r="3.3" fill="#f6c443" stroke="#d9a62e" strokeWidth="1.2" />
    ))}
    <path d="M9.5 24h29c0 2-1 3-2.3 3.6 1.6 2 2.3 4.3 2.3 6.4 0 5.5-6.5 8.5-14.5 8.5S9.5 39.5 9.5 34c0-2.1.7-4.4 2.3-6.4C10.5 27 9.5 26 9.5 24z" fill={INK} />
    <rect x="8" y="21" width="32" height="5" rx="2.5" fill="#454b59" />
    <path d="M14 31.5c.3 2.6 1.6 4.6 3.6 5.8" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".25" />
    <path className="fa-spark" d={sparklePath(40.5, 8, 3.6)} fill="#f6c443" />
    <path className="fa-spark fa-spark-2" d={sparklePath(8, 10, 2.8)} fill="#f6c443" />
  </Svg>
);

const LeprechaunHat = (
  <Svg>
    <ellipse cx="24" cy="38" rx="19" ry="4.5" fill="#2f7a45" />
    <path d="M13 37L15 12Q24 9.5 33 12L35 37Q24 40 13 37z" fill="#3f9a5c" />
    <ellipse cx="24" cy="12" rx="9" ry="2.4" fill="#4fb06c" />
    <path d="M14.2 28.5Q24 31 33.8 28.5L34.3 34Q24 36.8 13.7 34z" fill={INK} />
    <rect x="20" y="29.2" width="8" height="6" rx="1" stroke="#f2c14e" strokeWidth="2" />
    <path d="M18 16c-.4 3-.6 6-.6 9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".3" />
    <g transform="translate(37 20) scale(.42)">
      {[0, -112, 112].map((a) => (
        <path key={a} d={LEAF_HEART} transform={`rotate(${a})`} fill="#5fb07a" />
      ))}
    </g>
  </Svg>
);

const CLOUD_PUFF = 'M2 38a4 4 0 0 1 4-4 5 5 0 0 1 9 1.5 3.3 3.3 0 0 1 .5 6.5H5.5A3.5 3.5 0 0 1 2 38z';

const Rainbow = (
  <Svg>
    {[
      [18, '#e8745b'],
      [14, '#f2c14e'],
      [10, '#5fb07a'],
      [6, '#5b8fd6'],
    ].map(([r, stroke]) => (
      <path key={r} d={`M${24 - (r as number)} 36a${r} ${r} 0 0 1 ${2 * (r as number)} 0`} stroke={stroke as string} strokeWidth="4.2" />
    ))}
    <path d={CLOUD_PUFF} fill="#fff" stroke="#d5deeb" strokeWidth="1.2" />
    <path d={CLOUD_PUFF} transform="matrix(-1 0 0 1 48 0)" fill="#fff" stroke="#d5deeb" strokeWidth="1.2" />
    <path className="fa-spark" d={sparklePath(41, 9, 3.4)} fill="#f2c14e" />
  </Svg>
);

/* ── Valentine's Day ───────────────────────────────────────────────────── */

const LoveLetter = (
  <Svg>
    <rect x="6" y="14" width="36" height="25" rx="3" fill="#fdf0ea" stroke="#f0a898" strokeWidth="1.6" />
    <path d="M7.5 16L24 29.5 40.5 16M7.5 37.5l12-10M40.5 37.5l-12-10" stroke="#f0a898" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d={HEART_PATH} transform="translate(0 11)" fill="#e8745b" />
    <g transform="translate(30 -4) scale(.45)">
      <path className="fa-spark" d={HEART_PATH} fill="#f19bb0" />
    </g>
    <g transform="translate(2 -2) scale(.32)">
      <path className="fa-spark fa-spark-2" d={HEART_PATH} fill="#e8745b" />
    </g>
  </Svg>
);

const BIG_HEART = 'M24 41L8.6 26.3A9.4 9.4 0 0 1 21.9 13l2.1 2.1 2.1-2.1A9.4 9.4 0 0 1 39.4 26.3z';

const Chocolates = (
  <Svg>
    <path d={BIG_HEART} fill="#c4343a" strokeLinejoin="round" stroke="#c4343a" strokeWidth="1.5" />
    <path d={BIG_HEART} transform="translate(24 27) scale(.78) translate(-24 -27)" fill="#f7c4d2" />
    {[
      [17.8, 23, '#7a4a2a'],
      [24, 24.4, '#a5683d'],
      [30.2, 23, '#7a4a2a'],
      [20.9, 29.6, '#a5683d'],
      [27.1, 29.6, '#7a4a2a'],
      [24, 35.4, '#a5683d'],
    ].map(([cx, cy, fill]) => (
      <g key={`${cx}-${cy}`}>
        <circle cx={cx} cy={cy} r="2.7" fill={fill as string} />
        <path d={`M${(cx as number) - 1.4} ${(cy as number) + 0.3}l.7-.8.7.8.7-.8.7.8`} stroke="#e9c9a8" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ))}
    <g transform="translate(13 13) rotate(-35)">
      <ellipse cx="-3.6" cy="0" rx="3.6" ry="2.2" fill="#f2c14e" />
      <ellipse cx="3.6" cy="0" rx="3.6" ry="2.2" fill="#f2c14e" />
      <circle r="1.7" fill="#d9a62e" />
    </g>
  </Svg>
);

const Rose = (
  <Svg>
    <path d="M24 25v18" stroke="#3f7d52" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M24 38c-6 0-9-3.5-9-8 5 0 9 3 9 8zM24 34c0-4.5 3.5-7.5 8.5-7.5 0 4.5-3.5 7.5-8.5 7.5z" fill="#5f9e6e" />
    <path d="M13 14c0 7.5 5 12.5 11 12.5S35 21.5 35 14c0-1-.2-2-.5-3-2.5 1-4.5.5-6-1.5h-9c-1.5 2-3.5 2.5-6 1.5-.3 1-.5 2-.5 3z" fill="#e04848" />
    <circle cx="24" cy="12" r="7.5" fill="#c4343a" />
    <path d="M24 12.5a1.6 1.6 0 1 1 1.6-1.6c0 2.4-2 3.8-4 3.8a4 4 0 0 1-4-4c0-3 2.6-5.2 5.4-5.2" stroke="#ef6b6b" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M14.5 16.5c2.2 3 5.4 4.5 9.5 4.5s7.3-1.5 9.5-4.5c-.6 5.2-4.4 9.5-9.5 9.5s-8.9-4.3-9.5-9.5z" fill="#e85656" />
    <path d="M17 20.5c1 2 2.6 3.5 4.6 4.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".4" />
    <g transform="translate(30 -3) scale(.4)">
      <path className="fa-spark" d={HEART_PATH} fill="#f19bb0" />
    </g>
  </Svg>
);

/* ── Thanksgiving ──────────────────────────────────────────────────────── */

const FEATHERS = ['#c4553d', '#f2924a', '#f2c14e', '#e8745b', '#f2c14e', '#f2924a', '#c4553d'];

const Turkey = (
  <Svg>
    {[-70, -47, -23, 0, 23, 47, 70].map((a, i) => (
      <ellipse key={a} cx="24" cy="15.5" rx="4.6" ry="8.6" fill={FEATHERS[i]} transform={`rotate(${a} 24 30)`} />
    ))}
    <path d="M20 40.5v3M28 40.5v3M18.6 43.5h2.8M26.6 43.5h2.8" stroke="#f2924a" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="24" cy="31" r="10" fill="#8a5a33" />
    <ellipse cx="24" cy="34.5" rx="6" ry="5" fill="#a5703f" />
    <circle cx="24" cy="21.5" r="5.6" fill="#9a6a3c" />
    <circle cx="22" cy="20.6" r="1" fill={INK} />
    <circle cx="26" cy="20.6" r="1" fill={INK} />
    <path d="M22.4 22.6h3.2L24 25z" fill="#f2c14e" />
    <path d="M25 24.2c1.2 1 1.3 3 .2 4-1-1-1.3-2.8-.2-4z" fill="#e04848" />
  </Svg>
);

const Pie = (
  <Svg>
    <path d="M18 13c-1.5 2 1.5 3 0 5M24 10c-1.5 2 1.5 3 0 5M30 13c-1.5 2 1.5 3 0 5" className="fa-rays" stroke="#c9d1dc" strokeWidth="1.6" strokeLinecap="round" />
    <ellipse cx="24" cy="34" rx="21" ry="8" fill="#dfe5ee" />
    <ellipse cx="24" cy="31" rx="17" ry="7.5" fill="#c98a4b" />
    <ellipse cx="24" cy="28" rx="17" ry="7.5" fill="#e2a35a" />
    <ellipse cx="24" cy="28" rx="15.4" ry="6.4" stroke="#f0c27a" strokeWidth="2" strokeDasharray="2 2.4" />
    <ellipse cx="24" cy="28" rx="13.4" ry="5.2" fill="#e2862f" />
    <path d="M19 27c0-2.5 2.2-4 5-4s5 1.5 5 4c0 1.5-2 2.5-5 2.5s-5-1-5-2.5z" fill="#fff" />
    <path d="M21.5 24c.5-2 1.5-3 2.5-3.5.5 1 2 2 2 3.5z" fill="#fff" />
  </Svg>
);

const Cornucopia = (
  <Svg>
    <path d="M44 7c1 6.5-1 13.5-5 19.5-3.2 5-8.2 9-14.2 10.5L18 38V22.5l6-.8c5-.7 9-3 12.6-6.5C39 12.8 41.5 10 44 7z" fill="#d99a52" />
    <path d="M24.5 23.5c1.5 3.5 1.8 8 .8 12.5M31 20.5c1.6 3 2 6.6 1.4 10.4M37 15.5c1.3 2.4 1.5 5 1 7.6" stroke="#b0763d" strokeWidth="1.5" strokeLinecap="round" />
    <ellipse cx="18" cy="30.2" rx="3.8" ry="8" fill="#8a5a33" />
    {[
      [10.5, 20.5],
      [14, 20.5],
      [12.2, 23.6],
      [8.8, 23.6],
      [10.5, 26.6],
    ].map(([cx, cy]) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" fill="#7c6cf0" />
    ))}
    <circle cx="12" cy="32" r="5" fill="#e04848" />
    <path d="M12 27.2c.2-1.4 1-2.4 2.2-3" stroke="#7a5230" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M9.5 30a3 3 0 0 1 2-1.6" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity=".6" />
    <ellipse cx="17.5" cy="40" rx="5.5" ry="3.8" fill="#f2924a" />
    <path d="M17.5 36.4v7.2M14.4 37.2c-.8 1.8-.8 3.8 0 5.6M20.6 37.2c.8 1.8.8 3.8 0 5.6" stroke="#d26a26" strokeWidth="1.1" strokeLinecap="round" opacity=".7" />
    <path d="M6 37.5c1.5-2.5 4-3.5 6-3-1 2.3-3.5 3.5-6 3z" fill="#5f9e6e" />
  </Svg>
);

/* ── Hanukkah ──────────────────────────────────────────────────────────── */

const Menorah = (
  <Svg>
    <rect x="16" y="41" width="16" height="3" rx="1.5" fill="#d9b453" />
    <rect x="22.8" y="20" width="2.4" height="22" fill="#d9b453" />
    {[1, 2, 3, 4].map((i) => (
      <path key={i} d={`M${24 - 4.5 * i} 22a${4.5 * i} 9 0 0 0 ${9 * i} 0`} stroke="#d9b453" strokeWidth="2" />
    ))}
    {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((i) => {
      const x = 24 + 4.5 * i;
      const top = i === 0 ? 10 : 14.5;
      return (
        <g key={i}>
          <rect x={x - 1.2} y={top} width="2.4" height={i === 0 ? 10 : 7.5} rx=".6" fill={i % 2 ? '#9cc0ef' : '#5b8fd6'} />
          <path className="fa-rays" d={`M${x} ${top - 5}c1.4 1.7 1.6 3 0 4-1.6-1-1.4-2.3 0-4z`} fill="#f2a541" />
        </g>
      );
    })}
  </Svg>
);

const Dreidel = (
  <Svg>
    <g transform="rotate(12 24 24)">
      <rect x="22" y="3.5" width="4" height="9.5" rx="1.6" fill="#3f6fb5" />
      <path d="M13 14h22v14L24 43 13 28z" fill="#5b8fd6" strokeLinejoin="round" stroke="#5b8fd6" strokeWidth="1.5" />
      <path d="M29 14h6v14L24 43l5-15z" fill="#4a7cc4" />
      <rect x="12" y="12" width="24" height="3.4" rx="1.6" fill="#86aee6" />
      <path d="M16.5 19v5.5c0 2.5 2 4 4.5 4s4.5-1.5 4.5-4V19M21 19v7" stroke="#f6c443" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <path d="M4 34h5M5 39h6M38 40h5" stroke="#c9d1dc" strokeWidth="1.8" strokeLinecap="round" />
    <path className="fa-spark" d={sparklePath(41, 9, 3.4)} fill="#f2c14e" />
  </Svg>
);

const StarOfDavid = (
  <Svg>
    <path d="M24 5L40.45 33.5H7.55z" fill="#d6e4fb" opacity=".8" />
    <path d="M24 43L7.55 14.5h32.9z" fill="#d6e4fb" opacity=".8" />
    <path d="M24 5L40.45 33.5H7.55z" stroke="#3f6fb5" strokeWidth="3" strokeLinejoin="round" />
    <path d="M24 43L7.55 14.5h32.9z" stroke="#3f6fb5" strokeWidth="3" strokeLinejoin="round" />
    <path className="fa-spark" d={sparklePath(42, 6, 3)} fill="#f2c14e" />
    <path className="fa-spark fa-spark-2" d={sparklePath(6, 42, 2.4)} fill="#f2c14e" />
  </Svg>
);

/* ── Toys ──────────────────────────────────────────────────────────────── */

function ToyBlock({ x, y, front, top, side, digit }: { x: number; y: number; front: string; top: string; side: string; digit: string }) {
  return (
    <g>
      <path d={`M${x} ${y}l3-3h16l-3 3z`} fill={top} />
      <path d={`M${x + 16} ${y}l3-3v16l-3 3z`} fill={side} />
      <rect x={x} y={y} width="16" height="16" rx="2" fill={front} />
      <path d={digit} transform={`translate(${x + 8} ${y + 8})`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

const Blocks = (
  <Svg>
    <ToyBlock x={5} y={27} front="#e8745b" top="#f29a85" side="#c4553d" digit="M-1.5-3l1.5-1.4v8.6" />
    <ToyBlock x={25} y={27} front="#5b8fd6" top="#86aee6" side="#3f6fb5" digit="M-2.6-2.2a2.6 2.6 0 0 1 5.2.4c0 2.2-5.2 3.4-5.2 6.2h5.2" />
    <ToyBlock x={15} y={9} front="#f2c14e" top="#f7d77f" side="#d9a62e" digit="M-2.5-4h4.8l-2.7 3.2a2.7 2.7 0 1 1-2.3 4.4" />
  </Svg>
);

const Robot = (
  <Svg>
    <path d="M24 5.5v4.5" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    <circle className="fa-rays" cx="24" cy="4.6" r="2.2" fill="#e8745b" />
    <path d="M12 30l-4.5 5M36 32l4 5" stroke="#7d93ab" strokeWidth="3" strokeLinecap="round" />
    <path d="M36 27h4" stroke="#d9b453" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="41.6" cy="24.4" rx="1.8" ry="2.6" fill="#f2c14e" stroke="#d9a62e" strokeWidth="1" />
    <ellipse cx="41.6" cy="29.6" rx="1.8" ry="2.6" fill="#f2c14e" stroke="#d9a62e" strokeWidth="1" />
    <rect x="16" y="38.5" width="5" height="5" rx="1.2" fill="#7d93ab" />
    <rect x="27" y="38.5" width="5" height="5" rx="1.2" fill="#7d93ab" />
    <rect x="12" y="25" width="24" height="14.5" rx="3" fill="#b8c7d8" />
    <rect x="17" y="28.2" width="14" height="7.4" rx="1.6" fill="#3f6fb5" />
    <circle cx="20.2" cy="31.9" r="1.3" fill="#f2c14e" />
    <circle cx="24" cy="31.9" r="1.3" fill="#e8745b" />
    <circle cx="27.8" cy="31.9" r="1.3" fill="#4fd1a5" />
    <rect x="21" y="22.5" width="6" height="3" fill="#7d93ab" />
    <rect x="14" y="10" width="20" height="13" rx="3.2" fill="#9fb3c8" />
    <circle cx="19.5" cy="16" r="2.6" fill="#fff" />
    <circle cx="28.5" cy="16" r="2.6" fill="#fff" />
    <circle cx="20" cy="16.3" r="1.2" fill={INK} />
    <circle cx="29" cy="16.3" r="1.2" fill={INK} />
    <path d="M21 20.2h6" stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.2 1.2" />
  </Svg>
);

const Teddy = (
  <Svg>
    <circle cx="14.5" cy="11.5" r="5" fill="#b07a4a" />
    <circle cx="33.5" cy="11.5" r="5" fill="#b07a4a" />
    <circle cx="14.5" cy="11.5" r="2.5" fill="#e3b88a" />
    <circle cx="33.5" cy="11.5" r="2.5" fill="#e3b88a" />
    <ellipse cx="13.5" cy="32" rx="3.6" ry="5.2" transform="rotate(32 13.5 32)" fill="#b07a4a" />
    <ellipse cx="34.5" cy="32" rx="3.6" ry="5.2" transform="rotate(-32 34.5 32)" fill="#b07a4a" />
    <ellipse cx="24" cy="34.5" rx="10" ry="9" fill="#c48a55" />
    <ellipse cx="24" cy="36" rx="5.5" ry="5" fill="#ecc79a" />
    <circle cx="17" cy="42" r="3.6" fill="#b07a4a" />
    <circle cx="31" cy="42" r="3.6" fill="#b07a4a" />
    <circle cx="17" cy="42" r="1.7" fill="#ecc79a" />
    <circle cx="31" cy="42" r="1.7" fill="#ecc79a" />
    <circle cx="24" cy="18" r="10" fill="#c48a55" />
    <ellipse cx="24" cy="21.6" rx="4.6" ry="3.6" fill="#ecc79a" />
    <ellipse cx="24" cy="20.1" rx="1.8" ry="1.3" fill={INK} />
    <path d="M24 21.4v1.4M22.4 23.3c.8.8 2.4.8 3.2 0" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="20" cy="16.4" r="1.3" fill={INK} />
    <circle cx="28" cy="16.4" r="1.3" fill={INK} />
    <path d="M24 27.6l-4.6-2.6v5.2zM24 27.6l4.6-2.6v5.2z" fill="#e8745b" />
    <circle cx="24" cy="27.6" r="1.4" fill="#c4553d" />
  </Svg>
);

const Duck = (
  <Svg>
    <path d="M7 29c-1-4 0-7 1.5-8 1 3 3 5 6 6z" fill="#f6c443" />
    <ellipse cx="22" cy="32" rx="15" ry="9.5" fill="#f6c443" />
    <circle cx="30" cy="18" r="8.5" fill="#f6c443" />
    <path d="M37 18.5c3-1 6-.5 7 1-1 1.8-4 2.6-7 1.6z" fill="#f2924a" />
    <circle cx="32" cy="16" r="1.4" fill={INK} />
    <circle cx="32.5" cy="15.5" r=".45" fill="#fff" />
    <circle cx="34" cy="20.6" r="1.6" fill="#f19bb0" opacity=".7" />
    <path d="M14 30c3-3 9-3 12 0-2 4-9 5-12 0z" fill="#e8ae2f" />
    <path d="M25 12.5a7 7 0 0 1 3.5-2.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".6" />
    <path d="M3 41.5c3-2 5-2 8 0s5 2 8 0 5-2 8 0 5 2 8 0 5-2 8 0" stroke="#5b8fd6" strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

const Train = (
  <Svg>
    <circle className="fa-rays" cx="17" cy="6" r="2.6" fill="#dfe5ee" />
    <circle className="fa-rays" cx="22" cy="3.6" r="2" fill="#dfe5ee" />
    <rect x="11" y="11" width="4.5" height="9" fill={INK} />
    <rect x="9.8" y="9.4" width="7" height="3" rx="1" fill={INK} />
    <rect x="8" y="19" width="20" height="11" rx="4" fill="#5b8fd6" />
    <path d="M14 19.5v10M20 19.5v10" stroke="#3f6fb5" strokeWidth="1.6" />
    <rect x="26" y="12" width="14" height="18" rx="2" fill="#e8745b" />
    <rect x="24" y="9.5" width="18" height="4" rx="1.5" fill="#c4553d" />
    <rect x="29" y="15.5" width="8" height="6" rx="1.2" fill="#a9d8f0" />
    <path d="M6 30l-3 6h5z" fill="#c4553d" />
    <rect x="6" y="30" width="36" height="4" rx="1.5" fill={INK} />
    {[13, 24, 35].map((cx) => (
      <g key={cx}>
        <circle cx={cx} cy="37.5" r="4.5" fill="#f2c14e" stroke={INK} strokeWidth="2" />
        <circle cx={cx} cy="37.5" r="1.2" fill={INK} />
      </g>
    ))}
  </Svg>
);

const RockingHorse = (
  <Svg>
    <path d="M4 38q20 10 40 0" stroke="#a37c4f" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M14 31L11 41M19 32.5l.5 10M29 32.5l-.5 10M34 31l3 10" stroke="#c98a4b" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M12 26c-3 0-5 3-5 6.5" stroke="#8a5a33" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="23" cy="28" rx="12" ry="5.5" fill="#d99a52" />
    <path d="M29 27c1-6 2.5-11 5.5-14 2-2 5-2 7 0l2.5 4c.5 1-.3 2-1.3 2H39c-1 2-1.5 5-1 9z" fill="#d99a52" />
    <path d="M37.5 11.5l1-3.6 2 3.4z" fill="#d99a52" />
    <path d="M34 12.5c-2.4 3-3.6 7-4 12" stroke="#8a5a33" strokeWidth="3" strokeLinecap="round" />
    <circle cx="39.4" cy="14" r="1" fill={INK} />
    <path d="M18 23h10c0 2.6-2.2 4.2-5 4.2S18 25.6 18 23z" fill="#e8745b" />
    <path d="M23 27v3" stroke="#c4553d" strokeWidth="1.4" strokeLinecap="round" />
  </Svg>
);

const Dinosaur = (
  <Svg>
    <path d="M13 28c-4.5.5-8 0-10.5-2.5 3-.8 7-1.6 10.5-3z" fill="#5fb07a" />
    <rect x="13" y="33" width="4.6" height="9" rx="2" fill="#4f9e68" />
    <rect x="24" y="33" width="4.6" height="9" rx="2" fill="#4f9e68" />
    <path d="M27 27c2-6 4-12 7.5-15.5" stroke="#5fb07a" strokeWidth="6.5" strokeLinecap="round" />
    <ellipse cx="21" cy="29.5" rx="11" ry="8" fill="#5fb07a" />
    <path d="M14 33.5c4 2.4 10 2.4 14 0" stroke="#8fd0a0" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="37" cy="10.5" rx="5.6" ry="4.2" fill="#5fb07a" />
    <circle cx="38" cy="9.2" r="1" fill={INK} />
    <path d="M39.4 12.4c.8.3 1.6.2 2.2-.3" stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
    <circle cx="17" cy="26.5" r="1.8" fill="#8fd0a0" />
    <circle cx="23" cy="24.6" r="1.4" fill="#8fd0a0" />
    <circle cx="25.4" cy="29" r="1.6" fill="#8fd0a0" />
    <path className="fa-spark" d={sparklePath(8, 10, 3)} fill="#f2c14e" />
  </Svg>
);

const Rocket = (
  <Svg>
    <path className="fa-rays" d="M19 35h10c0 4-2.5 7-5 9-2.5-2-5-5-5-9z" fill="#f2a541" />
    <path d="M21.5 35h5c0 2.4-1.2 4-2.5 5.2-1.3-1.2-2.5-2.8-2.5-5.2z" fill="#f6c443" />
    <path d="M15.5 26l-6 7v5.5l6-3zM32.5 26l6 7v5.5l-6-3z" fill="#e8745b" />
    <path d="M24 4c6 5 9 12 9 20v11H15V24c0-8 3-15 9-20z" fill="#f3f5f9" stroke="#c9d1dc" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M24 4.8c2.9 2.4 5.2 5.4 6.8 8.7H17.2c1.6-3.3 3.9-6.3 6.8-8.7z" fill="#e8745b" />
    <circle cx="24" cy="21.5" r="4" fill="#a9d8f0" stroke="#5b8fd6" strokeWidth="2" />
    <path d="M24 29v6" stroke="#e8745b" strokeWidth="2.4" strokeLinecap="round" />
    <path className="fa-spark" d={starPath(41, 9, 3, 1.2)} fill="#f2c14e" />
    <path className="fa-spark fa-spark-2" d={starPath(7, 16, 2.4, 1)} fill="#7c6cf0" />
  </Svg>
);

/** Points of a regular polygon, first point straight up (rotated by `rot` degrees). */
function polygon(cx: number, cy: number, r: number, n: number, rot = 0): string {
  return Array.from({ length: n }, (_, i) => {
    const a = ((rot - 90 + (i * 360) / n) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

/** A five-petal flower centred on (cx, cy). */
function Blossom({ cx, cy, r, petal, middle = '#f2c14e' }: { cx: number; cy: number; r: number; petal: string; middle?: string }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => {
        const rad = ((a - 90) * Math.PI) / 180;
        return <circle key={a} cx={cx + r * Math.cos(rad)} cy={cy + r * Math.sin(rad)} r={r} fill={petal} />;
      })}
      <circle cx={cx} cy={cy} r={r * 0.7} fill={middle} />
    </g>
  );
}

/* ── Easter ────────────────────────────────────────────────────────────── */

const EasterEgg = (
  <Svg>
    <path d="M24 5c8 0 14 12 14 22 0 9-6 16-14 16s-14-7-14-16C10 17 16 5 24 5z" fill="#9fd3c7" />
    <path d="M12 21l3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3" stroke="#f19bb0" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M10.4 30h27.2" stroke="#f6c443" strokeWidth="3.4" />
    <circle cx="19" cy="13" r="1.4" fill="#fff" />
    <circle cx="24" cy="10" r="1.4" fill="#fff" />
    <circle cx="29" cy="13" r="1.4" fill="#fff" />
    <circle cx="17.5" cy="37" r="1.6" fill="#7c6cf0" />
    <circle cx="24" cy="38.6" r="1.6" fill="#7c6cf0" />
    <circle cx="30.5" cy="37" r="1.6" fill="#7c6cf0" />
    <path className="fa-spark" d={sparklePath(41, 8, 3.4)} fill="#f2c14e" />
  </Svg>
);

const Bunny = (
  <Svg>
    {[
      [18, -12],
      [30, 12],
    ].map(([cx, a]) => (
      <g key={cx} transform={`rotate(${a} ${cx} 14)`}>
        <ellipse cx={cx} cy="12" rx="4.4" ry="10" fill="#fff" stroke="#d8dde6" strokeWidth="1.4" />
        <ellipse cx={cx} cy="12.5" rx="2.1" ry="7" fill="#f7c4d2" />
      </g>
    ))}
    <ellipse cx="24" cy="30" rx="13" ry="11.5" fill="#fff" stroke="#d8dde6" strokeWidth="1.4" />
    <circle cx="19.5" cy="28" r="1.5" fill={INK} />
    <circle cx="28.5" cy="28" r="1.5" fill={INK} />
    <path d="M22.6 31.4h2.8L24 33.1z" fill="#f19bb0" />
    <path d="M24 33.1v1.5M24 34.6c-.8 1-2 1.2-2.8.6M24 34.6c.8 1 2 1.2 2.8.6" stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
    <circle cx="16.5" cy="32" r="1.8" fill="#f19bb0" opacity=".6" />
    <circle cx="31.5" cy="32" r="1.8" fill="#f19bb0" opacity=".6" />
    <path d="M13.5 31.5H8.5M13.5 34l-4.5 1.5M34.5 31.5h5M34.5 34l4.5 1.5" stroke="#c9d1dc" strokeWidth="1.1" strokeLinecap="round" />
  </Svg>
);

const Chick = (
  <Svg>
    <ellipse cx="13.5" cy="25" rx="3" ry="5" transform="rotate(25 13.5 25)" fill="#e8ae2f" />
    <ellipse cx="34.5" cy="25" rx="3" ry="5" transform="rotate(-25 34.5 25)" fill="#e8ae2f" />
    <circle cx="24" cy="22" r="11" fill="#f6c443" />
    <path d="M23 11.2c-.5-2.5.5-4 2-5M25 11.2c1-2 2.5-2.5 4-2" stroke="#e8ae2f" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="20.5" cy="20" r="1.3" fill={INK} />
    <circle cx="27.5" cy="20" r="1.3" fill={INK} />
    <path d="M22 23h4l-2 2.6z" fill="#f2924a" />
    <circle cx="18" cy="24" r="1.5" fill="#f19bb0" opacity=".7" />
    <circle cx="30" cy="24" r="1.5" fill="#f19bb0" opacity=".7" />
    <path d="M9 28l4 3 4-3 4 3 3-3 3 3 4-3 4 3 4-3c0 9-6.5 15-15 15S9 37 9 28z" fill="#fdfaf3" stroke="#e3d6bd" strokeWidth="1.4" strokeLinejoin="round" />
  </Svg>
);

const Basket = (
  <Svg>
    <path d="M11 24c0-11 6-17 13-17s13 6 13 17" stroke="#b0763d" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="17" cy="21" rx="4" ry="5" fill="#f19bb0" />
    <ellipse cx="24" cy="19.5" rx="4" ry="5" fill="#9fd3c7" />
    <ellipse cx="31" cy="21" rx="4" ry="5" fill="#f6c443" />
    <path d="M14.5 20.5l2.5-1.5 2.5 1.5M21.5 18.5l2.5 1.5 2.5-1.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d={`M9 25${Array.from({ length: 15 }, (_, i) => `l1-${i % 2 ? 2.5 : 3.5} 1 ${i % 2 ? 2.5 : 3.5}`).join('')}z`} fill="#76b584" />
    <path d="M8 25h32l-3 15a3 3 0 0 1-3 2.5H14A3 3 0 0 1 11 40z" fill="#d99a52" />
    <path d="M9.4 30.5h29.2M10.4 35.5h27.2" stroke="#b0763d" strokeWidth="1.4" />
    <path d="M16 26l1 16M24 26v16.5M32 26l-1 16" stroke="#b0763d" strokeWidth="1.2" opacity=".7" />
    <rect x="7" y="23.5" width="34" height="3.4" rx="1.7" fill="#c98a4b" />
  </Svg>
);

/* ── New Year's & Fourth of July ───────────────────────────────────────── */

function Burst({ cx, cy, inner, outer, colors, count }: { cx: number; cy: number; inner: number; outer: number; colors: string[]; count: number }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const a = (i * 2 * Math.PI) / count;
        const [c, s] = [Math.cos(a), Math.sin(a)];
        const color = colors[i % colors.length];
        return (
          <g key={i}>
            <path d={`M${cx + inner * c} ${cy + inner * s}L${cx + outer * c} ${cy + outer * s}`} stroke={color} strokeWidth="2.4" strokeLinecap="round" />
            <circle cx={cx + (outer + 2.6) * c} cy={cy + (outer + 2.6) * s} r="1.2" fill={color} />
          </g>
        );
      })}
    </g>
  );
}

const Fireworks = (
  <Svg>
    <g className="fa-rays">
      <Burst cx={20} cy={19} inner={4.5} outer={12} colors={['#e8745b', '#f2c14e', '#7c6cf0']} count={12} />
    </g>
    <Burst cx={36} cy={33} inner={2.5} outer={6.5} colors={['#4fa3a5', '#f19bb0']} count={8} />
    <path d="M20 44v-8" stroke="#c9d1dc" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1.6 2.4" />
    <path className="fa-spark" d={sparklePath(41, 8, 3.2)} fill="#f2c14e" />
  </Svg>
);

const PartyHat = (
  <Svg>
    <path d="M24 7L37 40H11z" fill="#7c6cf0" strokeLinejoin="round" stroke="#7c6cf0" strokeWidth="2" />
    <path d="M17.2 24.2l11.6-4.4M14 32.4l18.4-7M12.4 38.4l23-8.8" stroke="#a79cf6" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="22" cy="20" r="1.5" fill="#f2c14e" />
    <circle cx="27" cy="29.5" r="1.6" fill="#f2c14e" />
    <circle cx="19" cy="34.5" r="1.5" fill="#f2c14e" />
    <path d="M10 40.5h28" stroke="#f2c14e" strokeWidth="4" strokeLinecap="round" />
    <circle cx="24" cy="6" r="3.6" fill="#e8745b" />
    <path d="M7 15l2.5 2M41 11l-2.5 2.5M42 25h-3.5M6 27h3" stroke="#4fa3a5" strokeWidth="1.8" strokeLinecap="round" />
    <path className="fa-spark" d={sparklePath(38, 4.5, 2.6)} fill="#f19bb0" />
  </Svg>
);

function Flute({ x, rot }: { x: number; rot: number }) {
  return (
    <g transform={`rotate(${rot} ${x} 41)`}>
      <path d={`M${x - 4} 9h8l-1 14a3 3 0 0 1-6 0z`} fill="#fdfaf3" stroke="#c9d1dc" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={`M${x - 3.6} 14h7.2l-.6 9a3 3 0 0 1-6 0z`} fill="#f6d77a" />
      <circle cx={x - 1} cy="18.5" r=".8" fill="#fff" />
      <circle cx={x + 1.2} cy="21" r=".7" fill="#fff" />
      <path d={`M${x} 26v13M${x - 4} 40.5h8`} stroke="#c9d1dc" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

const Champagne = (
  <Svg>
    <Flute x={18} rot={-14} />
    <Flute x={30} rot={14} />
    <path className="fa-spark" d={sparklePath(24, 5, 3.6)} fill="#f2c14e" />
    <path d="M17 6l1.5 2M31 6l-1.5 2" stroke="#f2c14e" strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

const wave = (y: number) => `M10 ${y}C16 ${y - 2} 20 ${y + 2} 26 ${y}C32 ${y - 2} 35 ${y - 2} 40 ${y}`;

const Flag = (
  <Svg>
    <path d="M9.5 6v38" stroke="#a37c4f" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="9.5" cy="5" r="2" fill="#f2c14e" />
    <path d="M10 8C16 6 20 10 26 8C32 6 35 6 40 8V26C35 24 32 24 26 26C20 28 16 24 10 26z" fill="#fff" stroke="#e3e7ee" strokeWidth="1" />
    {[9.3, 14.43, 19.57, 24.7].map((y) => (
      <path key={y} d={wave(y)} stroke="#e04848" strokeWidth="2.6" />
    ))}
    <path d="M10 8C13 7 16.5 7.2 20 8.4V17.6C16.5 16.4 13 16.2 10 17.2z" fill="#3f6fb5" />
    {[
      [12.5, 10.4],
      [15, 10.6],
      [17.5, 11],
      [12.5, 14.2],
      [15, 14.4],
      [17.5, 14.8],
    ].map(([cx, cy]) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r=".8" fill="#fff" />
    ))}
  </Svg>
);

/* ── Diwali, Lunar New Year, Eid & Ramadan ─────────────────────────────── */

const Diya = (
  <Svg>
    <circle className="fa-rays" cx="24" cy="15" r="9" fill="#f6c443" opacity=".22" />
    <path className="fa-rays" d="M24 6c3 4 4 7 4 9.5a4 4 0 0 1-8 0C20 13 21 10 24 6z" fill="#f2a541" />
    <path d="M24 11c1.4 2 2 3.4 2 4.6a2 2 0 0 1-4 0c0-1.2.6-2.6 2-4.6z" fill="#ffe08a" />
    <rect x="23.2" y="19" width="1.6" height="5" fill={INK} />
    <path d="M7 24c3 9 9 14 17 14s14-5 17-14c-2-.5-4 0-5 1H12c-1-1-3-1.5-5-1z" fill="#d2693c" />
    <ellipse cx="24" cy="24.6" rx="12" ry="2.2" fill="#9c4421" />
    <path d="M12.5 29.5l2.2 2 2.2-2 2.2 2 2.2-2 2.2 2 2.2-2 2.2 2 2.2-2 2.2 2 2.2-2" stroke="#f6c443" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="18" cy="34.4" r="1.1" fill="#f6c443" />
    <circle cx="24" cy="35.6" r="1.1" fill="#f6c443" />
    <circle cx="30" cy="34.4" r="1.1" fill="#f6c443" />
    <ellipse cx="24" cy="40.5" rx="7" ry="2" fill="#b4532a" />
  </Svg>
);

const PaperLantern = (
  <Svg>
    <path d="M24 3v5" stroke="#d9a62e" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="18" y="7.5" width="12" height="3.5" rx="1" fill="#d9a62e" />
    <ellipse cx="24" cy="23" rx="14" ry="12.5" fill="#e04848" />
    <path d="M24 11v24M17.6 11.6c-3.2 7-3.2 16 0 22.8M30.4 11.6c3.2 7 3.2 16 0 22.8" stroke="#c4343a" strokeWidth="1.4" />
    <path d="M13.5 18c-1 3-1 6.5 0 9.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".35" />
    <rect x="18" y="34.5" width="12" height="3.5" rx="1" fill="#d9a62e" />
    <path d="M24 38v3M22 41l-.5 5M24 41v5.5M26 41l.5 5" stroke="#e04848" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="24" cy="41" r="1.4" fill="#d9a62e" />
  </Svg>
);

const RedEnvelope = (
  <Svg>
    <rect x="11" y="6" width="26" height="36" rx="3" fill="#e04848" />
    <path d="M11 9a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v6c-4 4-8.5 6-13 6s-9-2-13-6z" fill="#c4343a" />
    <circle cx="24" cy="21" r="5" fill="#f6c443" />
    <path d="M24 18l3 3-3 3-3-3z" fill="#e04848" />
    <path d="M16 33h16M18 37.5h12" stroke="#f6c443" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
    <path className="fa-spark" d={sparklePath(41, 9, 3.2)} fill="#f2c14e" />
    <path className="fa-spark fa-spark-2" d={sparklePath(7, 30, 2.4)} fill="#f2c14e" />
  </Svg>
);

const Crescent = (
  <Svg>
    <path d="M20 2a20 20 0 1 0 18 30 16 16 0 1 1-18-30z" transform="translate(4 3) scale(.95)" fill="#f6c443" />
    <path d={starPath(35, 17, 5.2, 2.2)} fill="#f2c14e" strokeLinejoin="round" stroke="#f2c14e" strokeWidth="1" />
    <path className="fa-spark" d={sparklePath(41, 33, 2.8)} fill="#7c6cf0" />
    <path className="fa-spark fa-spark-2" d={sparklePath(40, 6, 2.2)} fill="#f2c14e" />
  </Svg>
);

const Fanous = (
  <Svg>
    <circle cx="24" cy="4.5" r="2.2" stroke="#d9a62e" strokeWidth="1.6" />
    <path d="M17 15c0-4 3-7.5 7-8.5 4 1 7 4.5 7 8.5z" fill="#d9a62e" />
    <rect x="15" y="14.5" width="18" height="3" rx="1" fill="#b8963f" />
    <path d="M16 17.5h16l-2 16H18z" fill="#ffe08a" />
    <circle className="fa-rays" cx="24" cy="25.5" r="3.4" fill="#f2a541" />
    <path d="M20.5 17.5l-.5 16M27.5 17.5l.5 16" stroke="#b8963f" strokeWidth="1.6" />
    <rect x="16.5" y="33" width="15" height="3" rx="1" fill="#b8963f" />
    <path d="M19 36h10l-2 5h-6z" fill="#d9a62e" />
    <path className="fa-spark" d={starPath(39, 12, 3, 1.2)} fill="#7c6cf0" />
    <path className="fa-spark fa-spark-2" d={starPath(9, 28, 2.4, 1)} fill="#f2c14e" />
  </Svg>
);

/* ── Mother's & Father's Day ───────────────────────────────────────────── */

const Bouquet = (
  <Svg>
    <ellipse cx="13" cy="21" rx="3" ry="6" transform="rotate(-45 13 21)" fill="#5f9e6e" />
    <ellipse cx="35" cy="21" rx="3" ry="6" transform="rotate(45 35 21)" fill="#5f9e6e" />
    <Blossom cx={17} cy={18} r={3.4} petal="#f19bb0" />
    <Blossom cx={31} cy={18} r={3.4} petal="#a79cf6" />
    <Blossom cx={24} cy={12} r={3.6} petal="#e8745b" />
    <path d="M13 24l11 20 11-20z" fill="#fbd5cb" strokeLinejoin="round" stroke="#f0a898" strokeWidth="1.5" />
    <path d="M24 31l-4.5-3v6zM24 31l4.5-3v6z" fill="#e8745b" />
    <circle cx="24" cy="31" r="1.4" fill="#c4553d" />
  </Svg>
);

const Necktie = (
  <Svg>
    <path d="M20 7l-7 4 3 5.5 5-4.5M28 7l7 4-3 5.5-5-4.5" fill="#fff" stroke="#c9d1dc" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M21.5 12h5l3.5 22-6 8-6-8z" fill="#5b8fd6" />
    <path d="M21 18.5l6.2-2.6M20 25.5l8.4-3.6M19 32.5l10.2-4.4" stroke="#f2c14e" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M20 7h8l-1.5 5h-5z" fill="#3f6fb5" />
  </Svg>
);

const Grill = (
  <Svg>
    <path className="fa-rays" d="M18 12c-1.5-2 1.5-3 0-5M24.5 11c-1.5-2 1.5-3 0-5M31 12c-1.5-2 1.5-3 0-5" stroke="#c9d1dc" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="11" y="16.5" width="12" height="4" rx="2" fill="#c4553d" />
    <path d="M14 17v3M17 17v3M20 17v3" stroke="#8f3a2a" strokeWidth="1" />
    <ellipse cx="31" cy="19" rx="5.4" ry="2.4" fill="#7a4a2a" />
    <path d="M15 33l-4 10M33 33l4 10M24 35v8" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
    <path d="M8 22h32a16 13 0 0 1-32 0z" fill={INK} />
    <path d="M6.5 22h35" stroke="#9aa3b2" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M13 27c1 2.5 2.6 4.4 4.6 5.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".25" />
    <circle cx="37" cy="43" r="1.8" fill="#9aa3b2" />
  </Svg>
);

/* ── Baby ──────────────────────────────────────────────────────────────── */

const BabyBottle = (
  <Svg>
    <path d="M21 9.5c0-3 1.4-5.5 3-5.5s3 2.5 3 5.5z" fill="#f6c443" />
    <rect x="17" y="9" width="14" height="5" rx="1.6" fill="#9fd3c7" />
    <rect x="16" y="14" width="16" height="28" rx="5" fill="#fff" stroke="#c9d1dc" strokeWidth="1.5" />
    <path d="M17.5 24h13v13.5a3.5 3.5 0 0 1-3.5 3.5h-6a3.5 3.5 0 0 1-3.5-3.5z" fill="#fbe7c6" />
    <path d="M17 18.5h3M17 22h3M17 25.5h3" stroke="#9aa3b2" strokeWidth="1.2" strokeLinecap="round" />
    <g transform="translate(13.5 14) scale(.45)">
      <path d={HEART_PATH} fill="#f19bb0" />
    </g>
    <path className="fa-spark" d={sparklePath(39, 10, 3)} fill="#9fd3c7" />
  </Svg>
);

const Rattle = (
  <Svg>
    <path d="M30 30l8.5 8.5" stroke="#f19bb0" strokeWidth="4.5" strokeLinecap="round" />
    <circle cx="40.5" cy="40.5" r="3.4" stroke="#f19bb0" strokeWidth="2.4" />
    <circle cx="29.5" cy="29.5" r="2.8" fill="#f6c443" />
    <circle cx="21" cy="21" r="11" fill="#9fd3c7" />
    <circle cx="16.5" cy="17" r="2" fill="#fff" />
    <circle cx="25" cy="18.5" r="1.6" fill="#f6c443" />
    <circle cx="18.5" cy="25.5" r="1.8" fill="#f19bb0" />
    <circle cx="26" cy="25" r="1.4" fill="#fff" />
    <path d="M13 15a9 9 0 0 1 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".6" />
    <path className="fa-rays" d="M6 9l3 2M8 4.5l2 3M4 15h3.5" stroke="#c9d1dc" strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

const Stroller = (
  <Svg>
    <path d="M38 22l4-9h3" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 31l-2 6M31 31l2 6" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    <path d="M10 22h28c0 6-5 10-11 10h-6c-6 0-11-4-11-10z" fill="#a79cf6" />
    <path d="M10 22a14 14 0 0 1 14-14v14z" fill="#7c6cf0" />
    <path d="M24 8.5L13 18M24 8.5L19.5 21" stroke="#5b4fd0" strokeWidth="1.2" opacity=".7" />
    <path d="M14 26.5h20" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1.6 2" opacity=".7" />
    {[15, 33].map((cx) => (
      <g key={cx}>
        <circle cx={cx} cy="38.5" r="4.5" fill="#fff" stroke={INK} strokeWidth="2.4" />
        <circle cx={cx} cy="38.5" r="1.2" fill={INK} />
      </g>
    ))}
  </Svg>
);

const Onesie = (
  <Svg>
    <path
      d="M17 7c1 3 4 4.5 7 4.5S30 10 31 7l7 3 4 8-5 3.5-3-3V31l-3 7c-.8 2-2 3-4 3h-6c-2 0-3.2-1-4-3l-3-7V18.5l-3 3L6 18l4-8z"
      fill="#9fd3c7"
      strokeLinejoin="round"
      stroke="#9fd3c7"
      strokeWidth="1.2"
    />
    <path d="M17 7c1 3 4 4.5 7 4.5S30 10 31 7" stroke="#6fb3a4" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M14 18.5v1.5M34 18.5v1.5" stroke="#6fb3a4" strokeWidth="1.4" strokeLinecap="round" />
    <path d={starPath(24, 23, 5, 2.2)} fill="#f6c443" />
    <circle cx="21.5" cy="38" r="1" fill="#fff" />
    <circle cx="26.5" cy="38" r="1" fill="#fff" />
  </Svg>
);

/* ── Back to school ────────────────────────────────────────────────────── */

const Backpack = (
  <Svg>
    <path d="M19 11a5 5 0 0 1 10 0v2" stroke="#3f6fb5" strokeWidth="2.6" strokeLinecap="round" />
    <rect x="11" y="11" width="26" height="32" rx="8" fill="#5b8fd6" />
    <path d="M11.5 20c4 3 8.5 4.5 12.5 4.5s8.5-1.5 12.5-4.5" stroke="#3f6fb5" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="21.5" y="22.5" width="5" height="4" rx="1" fill="#f2c14e" />
    <rect x="15" y="28.5" width="18" height="11.5" rx="4" fill="#86aee6" />
    <path d="M15.5 32.5h17" stroke="#3f6fb5" strokeWidth="1.4" />
    <rect x="22.6" y="31.6" width="2.8" height="3.4" rx=".8" fill="#e8745b" />
  </Svg>
);

const Pencil = (
  <Svg>
    <g transform="rotate(-45 24 24)">
      <rect x="8" y="19.5" width="26" height="9" fill="#f6c443" />
      <path d="M8 22.5h26M8 25.5h26" stroke="#e8ae2f" strokeWidth="1" />
      <rect x="34" y="19.5" width="4" height="9" fill="#c9d1dc" />
      <path d="M35.3 19.5v9M36.7 19.5v9" stroke="#9aa3b2" strokeWidth=".8" />
      <rect x="38" y="19.5" width="4.5" height="9" rx="1.6" fill="#f19bb0" />
      <path d="M8 19.5L1.5 24 8 28.5z" fill="#f3d9b0" />
      <path d="M3.6 22.5L1.5 24l2.1 1.5z" fill={INK} />
    </g>
    <path className="fa-spark" d={sparklePath(10, 9, 3)} fill="#7c6cf0" />
  </Svg>
);

const Apple = (
  <Svg>
    <path d="M24 14c0-3 1-5.5 3-7" stroke="#7a5230" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M26 10.5c2.5-3.5 7-4 9-2.5-2 3-6 4.5-9 2.5z" fill="#5fb07a" />
    <path d="M24 15c-3-2-9-2.5-12 1.5-3.5 4.5-2.5 13 1.5 19 2.5 4 6 6.5 10.5 4.5 4.5 2 8-.5 10.5-4.5 4-6 5-14.5 1.5-19-3-4-9-3.5-12-1.5z" fill="#e04848" />
    <path d="M15 21c-1 2.5-1 5.5 0 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".5" />
    <path className="fa-spark" d={sparklePath(39, 30, 2.8)} fill="#f2c14e" />
  </Svg>
);

function Crayon({ rot, color, band }: { rot: number; color: string; band: string }) {
  return (
    <g transform={`rotate(${rot} 24 42)`}>
      <path d="M21 15l3-8 3 8z" fill={color} />
      <rect x="21" y="15" width="6" height="26" rx="1" fill={color} />
      <rect x="21" y="21" width="6" height="11" fill={band} />
      <path d="M21.6 24.5c.8-.8 1.6.8 2.4 0s1.6.8 2.4 0M21.6 28.5c.8-.8 1.6.8 2.4 0s1.6.8 2.4 0" stroke="#fff" strokeWidth=".9" strokeLinecap="round" opacity=".8" />
    </g>
  );
}

const Crayons = (
  <Svg>
    <Crayon rot={-24} color="#5b8fd6" band="#3f6fb5" />
    <Crayon rot={24} color="#f2c14e" band="#d9a62e" />
    <Crayon rot={0} color="#e8745b" band="#c4553d" />
  </Svg>
);

/* ── Hobbies & sports ──────────────────────────────────────────────────── */

const Palette = (
  <Svg>
    <path d="M24 7C13 7 6 14.5 6 23.5S13 41 22 41c3 0 4-2 3.5-4s.5-4.5 3.5-4.5H34c5 0 8-3 8-8C42 14 34 7 24 7z" fill="#e9c9a0" />
    <circle cx="16" cy="31" r="2.6" fill="#c9a274" />
    <circle cx="14.5" cy="20" r="3.2" fill="#e8745b" />
    <circle cx="21.5" cy="13.8" r="3.2" fill="#f6c443" />
    <circle cx="30.5" cy="14" r="3.2" fill="#5fb07a" />
    <circle cx="36" cy="21.5" r="3" fill="#5b8fd6" />
    <circle cx="25" cy="22" r="2.8" fill="#7c6cf0" />
    <path d="M31 44l11-14" stroke="#a37c4f" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M42 30l2.6-3.4" stroke="#e8745b" strokeWidth="3.4" strokeLinecap="round" />
  </Svg>
);

const Guitar = (
  <Svg>
    <g transform="rotate(-35 24 24)">
      <rect x="21" y="0" width="6" height="5.5" rx="1.6" fill="#6e4526" />
      <rect x="22" y="4" width="4" height="17" fill="#8a5a33" />
      <path d="M22 8.5h4M22 12h4M22 15.5h4" stroke="#d9b453" strokeWidth=".8" />
      <path d="M24 18c-4 0-7 3-7 6.5 0 2 1 3 1 4.5S14 32 14 37c0 5 4.5 8 10 8s10-3 10-8c0-5-4-6.5-4-8s1-2.5 1-4.5c0-3.5-3-6.5-7-6.5z" fill="#e2a35a" />
      <circle cx="24" cy="31" r="3.4" fill="#6e4526" />
      <rect x="20" y="38" width="8" height="2" rx=".8" fill="#6e4526" />
      <path d="M23.2 4v35M24.8 4v35" stroke="#fdfaf3" strokeWidth=".6" />
    </g>
  </Svg>
);

const Yarn = (
  <Svg>
    <path d="M33 33c4 3 6 6 10 7" stroke="#f19bb0" strokeWidth="2" strokeLinecap="round" />
    <circle cx="22" cy="24" r="14" fill="#f19bb0" />
    <path d="M10 20c6-3 16-3 24 2M9 27c7-2 17-1 25 4M14 35c4-5 12-9 21-9M15 12c4 6 6 14 5 24M27 11c-3 7-3 16 0 25" stroke="#e07a97" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M30 4l-6 16M40 8L28 20" stroke="#a37c4f" strokeWidth="2" strokeLinecap="round" />
    <circle cx="30" cy="4" r="1.8" fill="#f2c14e" />
    <circle cx="40" cy="8" r="1.8" fill="#f2c14e" />
  </Svg>
);

const Tent = (
  <Svg>
    <path d="M4 41h40" stroke="#76b584" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M24 9L42 40H6z" fill="#f2924a" strokeLinejoin="round" stroke="#f2924a" strokeWidth="2" />
    <path d="M24 9L42 40H31z" fill="#e2772f" strokeLinejoin="round" stroke="#e2772f" strokeWidth="2" />
    <path d="M24 22l-6 18h12z" fill="#7a3a12" />
    <path d="M24 22l-3 18" stroke="#f2924a" strokeWidth="1.2" />
    <path d="M24 9l-3-4M24 9l3-4" stroke="#a37c4f" strokeWidth="2" strokeLinecap="round" />
    <path className="fa-spark" d={starPath(39, 10, 3, 1.2)} fill="#f2c14e" />
    <path className="fa-spark fa-spark-2" d={starPath(9, 16, 2.4, 1)} fill="#f2c14e" />
  </Svg>
);

const FishingRod = (
  <Svg>
    <path d="M6 42L34 8" stroke="#a37c4f" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M34 8c4 6 6 14 6 20" stroke="#9aa3b2" strokeWidth="1" />
    <circle cx="13" cy="33.5" r="3.4" fill="#9aa3b2" />
    <path d="M13 33.5l3 2" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M33 38c2-1 3-1 5 0s3 1 5 0" stroke="#5b8fd6" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="40" cy="31" r="3" fill="#e8745b" />
    <path d="M37 31a3 3 0 0 1 6 0z" fill="#fff" />
    <path d="M18 42.5c2-2.5 5-3 8-1.6 1-1.4 2.4-2 3.4-2.2-.2 1.6-.2 3.2 0 4.8-1-.2-2.4-.8-3.4-2.2-3 1.4-6 .9-8-.8z" fill="#5b8fd6" />
  </Svg>
);

const SoccerBall = (
  <Svg>
    <circle cx="24" cy="24" r="17" fill="#fff" stroke={INK} strokeWidth="2" />
    <polygon points={polygon(24, 24, 5.4, 5)} fill={INK} />
    {[0, 72, 144, 216, 288].map((a) => {
      const rad = ((a - 90) * Math.PI) / 180;
      const [c, s] = [Math.cos(rad), Math.sin(rad)];
      return (
        <g key={a}>
          <path d={`M${24 + 5.4 * c} ${24 + 5.4 * s}L${24 + 10 * c} ${24 + 10 * s}`} stroke={INK} strokeWidth="1.4" />
          <polygon points={polygon(24 + 13.2 * c, 24 + 13.2 * s, 3.4, 5, a + 36)} fill={INK} />
        </g>
      );
    })}
  </Svg>
);

const Basketball = (
  <Svg>
    <circle cx="24" cy="24" r="17" fill="#f2924a" stroke="#7a3a12" strokeWidth="1.6" />
    <path d="M7 24h34M24 7v34M12 12c5 4 7 8 7 12s-2 8-7 12M36 12c-5 4-7 8-7 12s2 8 7 12" stroke="#7a3a12" strokeWidth="1.6" />
    <path d="M13.5 17a12 12 0 0 1 4-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".35" />
  </Svg>
);

const Baseball = (
  <Svg>
    <circle cx="24" cy="24" r="16.5" fill="#fff" stroke="#c9d1dc" strokeWidth="1.6" />
    <path d="M13 12c4 3.5 6 7.5 6 12s-2 8.5-6 12M35 12c-4 3.5-6 7.5-6 12s2 8.5 6 12" stroke="#e04848" strokeWidth="1.4" />
    <path d="M13 12c4 3.5 6 7.5 6 12s-2 8.5-6 12M35 12c-4 3.5-6 7.5-6 12s2 8.5 6 12" stroke="#e04848" strokeWidth="3.6" strokeDasharray="1 2.4" />
  </Svg>
);

/* ── Pets ──────────────────────────────────────────────────────────────── */

const Paw = (
  <Svg>
    <path d="M24 25c-5 0-10 5-10 10 0 3 2.5 5 5.5 5 2 0 3-1 4.5-1s2.5 1 4.5 1c3 0 5.5-2 5.5-5 0-5-5-10-10-10z" fill="#8a5a33" />
    {[
      [14, 21.5, -22],
      [20.3, 14.5, -8],
      [27.7, 14.5, 8],
      [34, 21.5, 22],
    ].map(([cx, cy, a]) => (
      <ellipse key={cx} cx={cx} cy={cy} rx="3.3" ry="4.4" transform={`rotate(${a} ${cx} ${cy})`} fill="#8a5a33" />
    ))}
    <g transform="translate(26 -6) scale(.5)">
      <path className="fa-spark" d={HEART_PATH} fill="#f19bb0" />
    </g>
  </Svg>
);

const Bone = (
  <Svg>
    <g transform="rotate(-30 24 24)">
      <rect x="12" y="20" width="24" height="8" fill="#efd9b4" />
      {[
        [11, 19.5],
        [11, 28.5],
        [37, 19.5],
        [37, 28.5],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4.6" fill="#efd9b4" />
      ))}
      <path d="M14 22.5h20" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".6" />
    </g>
    <path className="fa-spark" d={sparklePath(39, 37, 3)} fill="#f2c14e" />
  </Svg>
);

const Fishbowl = (
  <Svg>
    <path d="M15 10h18v2c6 3 9 8.5 9 14.5C42 35 34 42 24 42S6 35 6 26.5C6 20.5 9 15 15 12z" fill="#e6f3fa" stroke="#9cc9e0" strokeWidth="1.5" />
    <path d="M7.4 22h33.2c.6 1.4.9 3 .9 4.5C41.5 35 33.8 41 24 41S6.5 35 6.5 26.5c0-1.5.3-3.1.9-4.5z" fill="#9fd0ea" />
    <path d="M31 41c0-4 2-7 1-10M34.5 40c1-3 0-5 1-8" stroke="#5fb07a" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="21" cy="30" rx="5" ry="3.4" fill="#f2924a" />
    <path d="M26 30l4-3v6z" fill="#f2924a" />
    <circle cx="18.6" cy="29.3" r=".8" fill={INK} />
    <circle cx="16" cy="24" r="1.2" stroke="#fff" strokeWidth=".9" />
    <circle cx="18" cy="19" r=".8" stroke="#fff" strokeWidth=".9" />
    <rect x="14" y="8.5" width="20" height="3" rx="1.5" fill="#bfe0f0" />
  </Svg>
);

const ToyMouse = (
  <Svg>
    <path d="M8 34c-4 0-5 3-3 5s1 5-2 6" stroke="#f19bb0" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="27" cy="20" r="4.2" fill="#9aa3b2" />
    <circle cx="27" cy="20" r="2" fill="#f19bb0" />
    <path d="M8 34c0-8 7-14 16-14 7 0 12 4 14 10l3 4z" fill="#b3bccb" />
    <path d="M13 29c4-2.4 9-3.2 14-1.4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.4 1.6" />
    <circle cx="33" cy="27.5" r="1.1" fill={INK} />
    <circle cx="41" cy="33.6" r="1.5" fill="#f19bb0" />
    <path d="M38 31l5-2M38 33h5.5" stroke={INK} strokeWidth=".8" strokeLinecap="round" />
    <path d="M14 34v3M30 34v3" stroke="#9aa3b2" strokeWidth="2.4" strokeLinecap="round" />
  </Svg>
);

/* ── Home & kitchen ────────────────────────────────────────────────────── */

const Whisk = (
  <Svg>
    <g transform="rotate(-28 24 24)">
      <path d="M24 29C17 24 16 12 24 4c8 8 7 20 0 25zM24 29c-4-5-4.5-16 0-25 4.5 9 4 20 0 25zM24 4v25" stroke="#9aa3b2" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="22" y="27" width="4" height="3.5" fill="#c9d1dc" />
      <rect x="21.5" y="30" width="5" height="14" rx="2.5" fill="#e8745b" />
    </g>
    <circle cx="39" cy="34" r="2" fill="#fbe7c6" />
    <circle cx="42" cy="29" r="1.3" fill="#fbe7c6" />
  </Svg>
);

const ChefHat = (
  <Svg>
    <path d="M14 30V24a7 7 0 0 1 2-13.7A8.5 8.5 0 0 1 32 10.3 7 7 0 0 1 34 24v6z" fill="#fff" stroke="#d5deeb" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M19 24v6M24 22v8M29 24v6" stroke="#d5deeb" strokeWidth="1.4" strokeLinecap="round" />
    <rect x="14" y="30" width="20" height="9" rx="2" fill="#fff" stroke="#d5deeb" strokeWidth="1.5" />
    <path d="M14.5 34.5h19" stroke="#e8745b" strokeWidth="1.6" />
    <path className="fa-spark" d={sparklePath(40, 9, 3)} fill="#f2c14e" />
  </Svg>
);

const WateringCan = (
  <Svg>
    <path d="M14 20c0-6 3-9 8-9s8 3 8 9" stroke="#3f8a8c" strokeWidth="3" strokeLinecap="round" />
    <path d="M31 33l9-13" stroke="#4fa3a5" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M38 16.5l5.5 4-2 2.4-5.4-3.4z" fill="#3f8a8c" />
    <path d="M12 20h20v16a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z" fill="#4fa3a5" />
    <Blossom cx={22} cy={30} r={2.4} petal="#f19bb0" />
    <path className="fa-rays" d="M44 26c1 1.4 1.3 2.2 0 3-1.3-.8-1-1.6 0-3zM41 30c1 1.4 1.3 2.2 0 3-1.3-.8-1-1.6 0-3z" fill="#5b8fd6" />
  </Svg>
);

const Candle = (
  <Svg>
    <circle className="fa-rays" cx="24" cy="12" r="8" fill="#f6c443" opacity=".25" />
    <path className="fa-rays" d="M24 5c2.6 3 3.4 5.4 3.4 7a3.4 3.4 0 0 1-6.8 0c0-1.6.8-4 3.4-7z" fill="#f2a541" />
    <path d="M24 9.5c1 1.4 1.4 2.4 1.4 3.2a1.4 1.4 0 0 1-2.8 0c0-.8.4-1.8 1.4-3.2z" fill="#ffe08a" />
    <path d="M24 16v3" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
    <rect x="17" y="19" width="14" height="21" rx="2" fill="#f7c4d2" />
    <path d="M17 22c0-2 1-3 3-3h8c2 0 3 1 3 3v2c-1 1.4-2.2 1.4-2.6 0s-1.6-1.4-2.4 0v3c0 1.2-2 1.2-2 0v-4c-.6-1.2-1.8-1.2-2.4 0s-1.8 1.4-2.6 0z" fill="#fbe3ea" />
    <ellipse cx="24" cy="41" rx="11" ry="2.6" fill="#d9b453" />
  </Svg>
);

/* ── Fashion & beauty ──────────────────────────────────────────────────── */

const Lipstick = (
  <Svg>
    <path d="M19.5 19V12c0-2 2-4 9-7v14z" fill="#e04848" />
    <path d="M21.5 17v-4.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity=".4" />
    <rect x="18.5" y="18.5" width="11" height="7" fill="#c9d1dc" />
    <rect x="17" y="25" width="14" height="3" fill="#b8963f" />
    <rect x="17" y="27.5" width="14" height="15.5" rx="2" fill="#d9b453" />
    <path d="M20 31v9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".35" />
    <g transform="translate(18 9) scale(.42)">
      <path className="fa-spark" d={HEART_PATH} fill="#f19bb0" />
    </g>
  </Svg>
);

const Perfume = (
  <Svg>
    <path d="M30 10.5h5" stroke="#d9b453" strokeWidth="1.4" strokeLinecap="round" />
    <ellipse cx="39" cy="10.5" rx="3.4" ry="2.6" fill="#f19bb0" />
    <rect x="18" y="7" width="12" height="7" rx="2" fill="#7c6cf0" />
    <rect x="20" y="13" width="8" height="5.5" fill="#d9b453" />
    <rect x="11" y="18" width="26" height="24" rx="6" fill="#e3defc" stroke="#a79cf6" strokeWidth="1.5" />
    <path d="M12.5 28h23v8a4.5 4.5 0 0 1-4.5 4.5H17A4.5 4.5 0 0 1 12.5 36z" fill="#a79cf6" opacity=".6" />
    <rect x="17" y="23.5" width="14" height="6" rx="1.5" fill="#fff" />
    <path d="M14.5 22v5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".6" />
    <circle className="fa-rays" cx="44" cy="6" r="1" fill="#a79cf6" />
    <circle className="fa-rays" cx="45" cy="11" r="1" fill="#a79cf6" />
  </Svg>
);

const Handbag = (
  <Svg>
    <path d="M16 19c0-6 3.5-10 8-10s8 4 8 10" stroke="#a5582a" strokeWidth="2.8" strokeLinecap="round" />
    <path d="M9 19h30l-2.5 21a3 3 0 0 1-3 2.6H14.5a3 3 0 0 1-3-2.6z" fill="#e8745b" />
    <path d="M9 19h30v3c-4 5-9 7-15 7S13 27 9 22z" fill="#c4553d" />
    <circle cx="24" cy="28" r="2.2" fill="#f2c14e" />
    <path d="M13 37.5h22" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" strokeDasharray="1.4 1.8" opacity=".6" />
  </Svg>
);

/* ── Tech ──────────────────────────────────────────────────────────────── */

const Laptop = (
  <Svg>
    <rect x="9" y="10" width="30" height="21" rx="2.5" fill={INK} />
    <rect x="11.5" y="12.5" width="25" height="15.5" rx="1" fill="#a9d8f0" />
    <rect x="14" y="15" width="9" height="2.4" rx="1.2" fill="#fff" />
    <rect x="14" y="19.5" width="13" height="2.4" rx="1.2" fill="#fff" opacity=".7" />
    <g transform="translate(6 3) scale(.5)">
      <path d={HEART_PATH} fill="#e8745b" transform="translate(30 20)" />
    </g>
    <path d="M5 32h38l-2.5 4.5a2 2 0 0 1-1.8 1H9.3a2 2 0 0 1-1.8-1z" fill="#c9d1dc" />
    <path d="M20 32h8v1.2a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1z" fill="#9aa3b2" />
  </Svg>
);

const Phone = (
  <Svg>
    <rect x="14" y="5" width="20" height="38" rx="4" fill={INK} />
    <rect x="16" y="8.5" width="16" height="31" rx="2" fill="#a9d8f0" />
    <rect x="21" y="6.2" width="6" height="1.6" rx=".8" fill="#454b59" />
    {[
      [18.5, 12, '#e8745b'],
      [24, 12, '#f6c443'],
      [29.5, 12, '#5fb07a'],
      [18.5, 17.5, '#7c6cf0'],
      [24, 17.5, '#f19bb0'],
      [29.5, 17.5, '#4fa3a5'],
    ].map(([x, y, fill]) => (
      <rect key={`${x}-${y}`} x={(x as number) - 2} y={y as number} width="4" height="4" rx="1.2" fill={fill as string} />
    ))}
    <rect x="18" y="35" width="12" height="2.4" rx="1.2" fill="#fff" opacity=".8" />
  </Svg>
);

const Tablet = (
  <Svg>
    <rect x="6" y="9" width="36" height="28" rx="4" fill={INK} />
    <rect x="9.5" y="12" width="29" height="22" rx="1.6" fill="#a9d8f0" />
    <circle cx="32" cy="18" r="2.8" fill="#f6c443" />
    <path d="M9.5 34l8-10 6 6 4-4 11 8z" fill="#5fb07a" />
    <path d="M32 42l9-9" stroke="#9aa3b2" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M41 33l1.5-1.5" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

/* ── More toys ─────────────────────────────────────────────────────────── */

const Kite = (
  <Svg>
    <path d="M24 38c-3 2-1 4-4 6" stroke="#9aa3b2" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M24 4l12 14-12 20-12-20z" fill="#e8745b" />
    <path d="M24 4L12 18h12zM24 18h12L24 38z" fill="#f6c443" />
    <path d="M24 4v34M12 18h24" stroke="#c4553d" strokeWidth="1.2" />
    <path d="M21 40.5l-3-1 1 3zM22.5 43.5l3-1-1 3z" fill="#5b8fd6" />
    <path className="fa-spark" d={sparklePath(40, 8, 3)} fill="#7c6cf0" />
  </Svg>
);

const Doll = (
  <Svg>
    <circle cx="13.5" cy="18" r="4" fill="#a5582a" />
    <circle cx="34.5" cy="18" r="4" fill="#a5582a" />
    <circle cx="24" cy="16" r="10" fill="#a5582a" />
    <path d="M17.5 28l-4 7M30.5 28l4 7M20 40v3.5M28 40v3.5" stroke="#f6d8c8" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M17 26h14l5 15H12z" fill="#7c6cf0" strokeLinejoin="round" stroke="#7c6cf0" strokeWidth="1.5" />
    <path d="M20 26.5l4 3 4-3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="24" cy="17.5" r="8" fill="#f6d8c8" />
    <path d="M16 15.5c1-5 4.5-7.5 8-7.5s7 2.5 8 7.5c-3-1.5-5.5-3.5-6.5-5.5-2 2.5-5.5 4.5-9.5 5.5z" fill="#a5582a" />
    <circle cx="21" cy="18" r="1.1" fill={INK} />
    <circle cx="27" cy="18" r="1.1" fill={INK} />
    <path d="M22 21.2c1.2 1 2.8 1 4 0" stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
    <circle cx="19" cy="20.4" r="1.4" fill="#f19bb0" opacity=".7" />
    <circle cx="29" cy="20.4" r="1.4" fill="#f19bb0" opacity=".7" />
    <path d="M31 8.5l-3.5-2v4zM31 8.5l3.5-2v4z" fill="#f19bb0" />
  </Svg>
);

const ToyCar = (
  <Svg>
    <path d="M2.5 22h4M1.5 26.5h3" stroke="#c9d1dc" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M6 31v-4a3 3 0 0 1 3-3h4l5-7h12l6 7h3a3 3 0 0 1 3 3v4z" fill="#4fa3a5" />
    <path d="M19.5 19h4.5v5h-8zM26 19h3.5l4 5H26z" fill="#a9d8f0" />
    <circle cx="24" cy="28" r="2.6" fill="#fff" />
    <rect x="5" y="30" width="38" height="3" rx="1.5" fill="#3f8a8c" />
    <circle cx="41" cy="27" r="1.4" fill="#f6c443" />
    {[14, 34].map((cx) => (
      <g key={cx}>
        <circle cx={cx} cy="34" r="4.6" fill={INK} />
        <circle cx={cx} cy="34" r="1.8" fill="#c9d1dc" />
      </g>
    ))}
  </Svg>
);

const PUZZLE_PIECE = 'M11 16h7a4 4 0 1 1 8 0h7v6a4 4 0 1 1 0 8v8h-7a4 4 0 1 0-8 0h-7v-8a4 4 0 1 0 0-8z';

const Puzzle = (
  <Svg>
    <path d={PUZZLE_PIECE} transform="rotate(18 24 24) translate(6 -6) scale(.7)" fill="#f6c443" />
    <path d={PUZZLE_PIECE} fill="#7c6cf0" strokeLinejoin="round" stroke="#7c6cf0" strokeWidth="1" />
    <path d="M14.5 20v6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".4" />
  </Svg>
);

/* ── Storage ───────────────────────────────────────────────────────────── */

const StorageBox = (
  <Svg>
    <path d="M6 17l18-7 18 7-18 7z" fill="#e2c093" />
    <path d="M6 17v19l18 7V24z" fill="#c8a27a" />
    <path d="M42 17v19l-18 7V24z" fill="#b48a5e" />
    <path d="M6 17l-3.5 6.5L20.5 30 24 24zM42 17l3.5 6.5L27.5 30 24 24z" fill="#d9b585" />
    <path d="M15 13.5l18 7v6.2l-3.2-1.2v-4.2l-18-7z" fill="#e8d3b2" opacity=".9" />
    <path d="M28.5 28.2l9-3.5v5.6l-9 3.5z" fill="#fff" opacity=".9" />
    <path d="M30.2 30.2l5.4-2.1M30.2 32.3l3.4-1.3" stroke={INK} strokeWidth="1" strokeLinecap="round" opacity=".35" />
  </Svg>
);

const StorageTote = (
  <Svg>
    <path d="M9 19h30l-2.6 21a3 3 0 0 1-3 2.6H14.6a3 3 0 0 1-3-2.6z" fill="#5b8fd6" />
    <path d="M12.4 26h23.2M13.2 33h21.6" stroke="#4a7cc2" strokeWidth="1.8" strokeLinecap="round" />
    <rect x="5" y="13" width="38" height="7.5" rx="2.6" fill="#2f5fa8" />
    <rect x="18" y="15" width="12" height="3.4" rx="1.7" fill="#1f4c8f" />
    <rect x="17" y="27.5" width="14" height="8" rx="1.4" fill="#fff" opacity=".92" />
    <path d="M19.5 30.5h9M19.5 33h6" stroke="#9aa3ad" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M14 22.5l1.6 15" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".3" />
  </Svg>
);

const TUB_BODY = 'M9 19h30l-2.4 20.5a3 3 0 0 1-3 2.6H14.4a3 3 0 0 1-3-2.6z';

const ClearTub = (
  <Svg>
    <circle cx="17.5" cy="34.5" r="5" fill="#f2a541" />
    <path d="M15 31.5c2 1 3.5 3 3.8 5.6" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
    <rect x="22" y="24.5" width="7" height="15" rx="1" fill="#7c6cf0" transform="rotate(-6 25.5 32)" />
    <rect x="29.5" y="29.5" width="6.5" height="10" rx="1.4" fill="#e86a92" />
    <path d={TUB_BODY} fill="#d6ecf8" opacity=".5" />
    <path d={TUB_BODY} stroke="#94c3e2" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M13.5 22.5l1.8 15.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".75" />
    <rect x="5" y="13" width="38" height="7.5" rx="2.6" fill="#eef2f6" stroke="#c4ced8" strokeWidth="1" />
    <rect x="18" y="15" width="12" height="3.4" rx="1.7" fill="#d5dde5" />
    <rect x="6.5" y="17" width="4.5" height="8" rx="1.4" fill="#5b8fd6" />
    <rect x="37" y="17" width="4.5" height="8" rx="1.4" fill="#5b8fd6" />
  </Svg>
);

const WoodenCrate = (
  <Svg>
    <path d="M7 13l4.5-4.5h32L39 13z" fill="#e6b57e" />
    <path d="M39 13l4.5-4.5v27L39 40z" fill="#9c6a3b" />
    <rect x="7" y="13" width="32" height="27" fill="#8a5a30" />
    {[14, 23, 32].map((y) => (
      <g key={y}>
        <rect x="7" y={y} width="32" height="7" fill="#d9a066" />
        <path d={`M14 ${y + 2.6}h9M25 ${y + 4.6}h8`} stroke="#c08850" strokeWidth="1" strokeLinecap="round" />
      </g>
    ))}
    <rect x="7" y="13" width="5" height="27" fill="#c58b52" />
    <rect x="34" y="13" width="5" height="27" fill="#c58b52" />
    {[17.5, 26.5, 35.5].map((cy) => (
      <g key={cy} fill="#5e3e22">
        <circle cx="9.5" cy={cy} r=".9" />
        <circle cx="36.5" cy={cy} r=".9" />
      </g>
    ))}
  </Svg>
);

const MetalCase = (
  <Svg>
    <path d="M18.5 13.5v-3a2.5 2.5 0 0 1 2.5-2.5h6a2.5 2.5 0 0 1 2.5 2.5v3" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
    <rect x="6" y="18" width="36" height="23" rx="2.5" fill="#8d99a8" />
    <path d="M6 29.5h36M6 35h36" stroke="#7b8796" strokeWidth="1.4" />
    <rect x="5" y="13" width="38" height="8" rx="2.5" fill="#6f7c8d" />
    <path d="M8 15.5h32" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".25" />
    <path d="M6 37v1.5A2.5 2.5 0 0 0 8.5 41H12v-4zM42 37v1.5a2.5 2.5 0 0 1-2.5 2.5H36v-4z" fill="#56616f" />
    {[11, 32].map((x) => (
      <g key={x}>
        <rect x={x} y="18" width="5" height="7.5" rx="1.2" fill="#f6c443" />
        <circle cx={x + 2.5} cy="23" r=".9" fill="#b58a1e" />
      </g>
    ))}
    <path d="M10.5 22v14" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".2" />
  </Svg>
);

const FabricBin = (
  <Svg>
    <path d="M14 13c0-4 4.5-6 8-4 2.5-3 9-2.5 10 1.5 1.5.5 2 1.5 2 2.5z" fill="#f2c14e" />
    <path d="M22 9.5c.5 1.5.5 2.5 0 3.5" stroke="#d9a62e" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M9 15h30l.8 25a2.5 2.5 0 0 1-2.5 2.6H10.7A2.5 2.5 0 0 1 8.2 40z" fill="#8fb3a3" />
    <rect x="11.5" y="19.5" width="25" height="20.5" rx="1.5" stroke="#fff" strokeWidth="1" strokeDasharray="1.6 1.6" opacity=".55" />
    <rect x="8" y="12" width="32" height="5.5" rx="2.2" fill="#7aa18f" />
    <rect x="18.5" y="22" width="11" height="4.2" rx="2.1" fill="#4f6f61" />
    <path d="M12 23l1 14" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".25" />
  </Svg>
);

const StorageDrawers = (
  <Svg>
    <circle cx="14.5" cy="44" r="2" fill={INK} />
    <circle cx="33.5" cy="44" r="2" fill={INK} />
    <rect x="10" y="5" width="28" height="38" rx="3" fill="#eef2f6" stroke="#c4ced8" strokeWidth="1" />
    {[
      { y: 8, tint: '#f2a541' },
      { y: 19.5, tint: '#e86a92' },
      { y: 31, tint: '#4f9e68' },
    ].map(({ y, tint }) => (
      <g key={y}>
        <rect x="13" y={y} width="22" height="9.5" rx="1.6" fill="#cfe6f5" />
        <rect x="15.5" y={y + 4.5} width="7" height="4" rx="1" fill={tint} opacity=".55" />
        <rect x="25.5" y={y + 5.5} width="6" height="3" rx="1" fill={tint} opacity=".35" />
        <rect x="19.5" y={y + 1.4} width="9" height="2.4" rx="1.2" fill="#5b8fd6" />
      </g>
    ))}
  </Svg>
);

const ArchiveBox = (
  <Svg>
    <rect x="7" y="17" width="34" height="25" rx="1.5" fill="#ece4d6" />
    <rect x="7" y="37" width="34" height="5" rx="1" fill="#4f9e68" opacity=".85" />
    <rect x="5.5" y="12" width="37" height="7.5" rx="1.6" fill="#f6f0e6" />
    <path d="M7 19.5h34" stroke="#d6cbb8" strokeWidth="1.2" />
    <rect x="19" y="13.8" width="10" height="3.2" rx="1.6" fill="#a8977c" />
    <rect x="14" y="23.5" width="20" height="10.5" rx="1" fill="#fff" stroke="#cbbfa9" strokeWidth="1" />
    <path d="M17 27.2h14M17 30.5h9" stroke={INK} strokeWidth="1.2" strokeLinecap="round" opacity=".35" />
  </Svg>
);

const Duffel = (
  <Svg>
    <path d="M14 18c0-3.5 4.5-6 10-6s10 2.5 10 6" stroke="#6b4a2e" strokeWidth="2.6" strokeLinecap="round" />
    <ellipse cx="24" cy="36" rx="17" ry="6.5" fill="#8a5a30" />
    <path d="M7 24c0-4 7.5-7 17-7s17 3 17 7v8c0 4-7.5 7-17 7S7 36 7 32z" fill="#c58b52" />
    <path d="M9 27c3.5 2 9 3 15 3s11.5-1 15-3" stroke="#a06e3c" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="20.5" y="24.5" width="7" height="4.2" rx="1.2" fill="#f2c14e" />
    <path d="M11 22.5c2.5-1.2 6-2 13-2s10.5.8 13 2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".35" />
    <ellipse cx="24" cy="20" rx="12" ry="3.2" fill="#a06e3c" />
  </Svg>
);

/** Icons drawn elsewhere (feature and item illustrations), filled in by CoverArt. */
type BorrowedIcon = 'collection' | 'gift' | 'bag' | 'camera' | 'headphones' | 'sneaker' | 'watch' | 'sweater' | 'plant' | 'book' | 'mug' | 'idea' | 'plane';

export const COVER_ILLUSTRATIONS: Record<Exclude<CoverIcon, BorrowedIcon>, ReactElement> = {
  wishlist: Wishlist,
  sparkles: Sparkles,
  chest: Chest,
  cash: Cash,
  tree: Tree,
  snowflake: Snowflake,
  holly: Holly,
  snowman: Snowman,
  ornament: Ornament,
  'candy-cane': CandyCane,
  pumpkin: Pumpkin,
  leaf: Leaf,
  sun: Sun,
  flower: Flower,
  umbrella: Umbrella,
  'ice-cream': IceCream,
  watermelon: Watermelon,
  acorn: Acorn,
  heart: Heart,
  cake: Cake,
  balloon: Balloon,
  'grad-cap': GradCap,
  ring: Ring,
  house: House,
  star: StarIcon,
  suitcase: Suitcase,
  record: Record,
  brick: Brick,
  controller: Controller,
  'jack-o-lantern': JackOLantern,
  ghost: Ghost,
  'witch-hat': WitchHat,
  bat: Bat,
  'candy-corn': CandyCorn,
  shamrock: Shamrock,
  'pot-of-gold': PotOfGold,
  'leprechaun-hat': LeprechaunHat,
  rainbow: Rainbow,
  'love-letter': LoveLetter,
  chocolates: Chocolates,
  rose: Rose,
  turkey: Turkey,
  pie: Pie,
  cornucopia: Cornucopia,
  menorah: Menorah,
  dreidel: Dreidel,
  'star-of-david': StarOfDavid,
  blocks: Blocks,
  robot: Robot,
  teddy: Teddy,
  duck: Duck,
  train: Train,
  'rocking-horse': RockingHorse,
  dinosaur: Dinosaur,
  rocket: Rocket,
  'easter-egg': EasterEgg,
  bunny: Bunny,
  chick: Chick,
  basket: Basket,
  fireworks: Fireworks,
  'party-hat': PartyHat,
  champagne: Champagne,
  flag: Flag,
  diya: Diya,
  'paper-lantern': PaperLantern,
  'red-envelope': RedEnvelope,
  crescent: Crescent,
  fanous: Fanous,
  bouquet: Bouquet,
  necktie: Necktie,
  grill: Grill,
  'baby-bottle': BabyBottle,
  rattle: Rattle,
  stroller: Stroller,
  onesie: Onesie,
  backpack: Backpack,
  pencil: Pencil,
  apple: Apple,
  crayons: Crayons,
  palette: Palette,
  guitar: Guitar,
  yarn: Yarn,
  tent: Tent,
  'fishing-rod': FishingRod,
  'soccer-ball': SoccerBall,
  basketball: Basketball,
  baseball: Baseball,
  paw: Paw,
  bone: Bone,
  fishbowl: Fishbowl,
  'toy-mouse': ToyMouse,
  whisk: Whisk,
  'chef-hat': ChefHat,
  'watering-can': WateringCan,
  candle: Candle,
  lipstick: Lipstick,
  perfume: Perfume,
  handbag: Handbag,
  laptop: Laptop,
  phone: Phone,
  tablet: Tablet,
  kite: Kite,
  doll: Doll,
  'toy-car': ToyCar,
  puzzle: Puzzle,
  box: StorageBox,
  tote: StorageTote,
  'clear-tub': ClearTub,
  crate: WoodenCrate,
  'metal-case': MetalCase,
  'fabric-bin': FabricBin,
  drawers: StorageDrawers,
  'archive-box': ArchiveBox,
  duffel: Duffel,
};
