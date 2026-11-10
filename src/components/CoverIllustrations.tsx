import type { ReactElement, ReactNode } from 'react';

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

export const COVER_ILLUSTRATIONS: Record<string, ReactElement> = {
  wishlist: Wishlist,
  sparkles: Sparkles,
  chest: Chest,
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
};
