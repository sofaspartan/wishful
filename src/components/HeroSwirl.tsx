import { useEffect, useRef, useState } from 'react';
import { Cloud } from './Cloud';
import { ILLUSTRATED_ITEMS } from './ItemIllustrations';

/*
 * Timeline, in seconds within one loop:
 *   0 – 2.2   items float in a loose cloud, each inside its own little cloud
 *   1.9 – 2.9 the little clouds puff away
 *   2.0 – 2.8 the list card forms in the middle
 *   2.2 – 3.6 items ease from the cloud onto an orbit around the list
 *   3.6 + i·k items dive into the list one at a time
 *   12.6–13.3 the finished list fades out, then the loop restarts
 */
const LOOP = 14;
const LIST_IN: [number, number] = [2.0, 2.8];
const LIST_OUT: [number, number] = [12.6, 13.3];
const ORBIT_START = 2.2;
const CLOUD_POP: [number, number] = [1.9, 2.9];
const ORBIT_BLEND = 1.4;
const DIVE_START = 3.6;
const DIVE_STAGGER = 0.85;
const DIVE_DURATION = 1.0;
const SPIN = (Math.PI * 2) / 7;
const ORBIT_SCALE = 0.62;
/** Items (with their clouds) are drawn larger while floating, then shrink onto the orbit. */
const FLOAT_SCALE = 1.2;

/** Hand-placed so the cloud looks scattered rather than gridded. */
const CLOUD = [
  { x: 0.2, y: 0.2, r: -10 },
  { x: 0.52, y: 0.12, r: 6 },
  { x: 0.82, y: 0.26, r: -4 },
  { x: 0.34, y: 0.48, r: 8 },
  { x: 0.7, y: 0.52, r: -8 },
  { x: 0.14, y: 0.76, r: 5 },
  { x: 0.48, y: 0.85, r: -6 },
  { x: 0.84, y: 0.78, r: 10 },
];

const N = ILLUSTRATED_ITEMS.length;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const ramp = (from: number, to: number, t: number) => easeInOut(clamp01((t - from) / (to - from)));

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Row {
  key: number;
  item: number;
}

/**
 * Decorative hero animation: item illustrations float in a cloud, a list forms, and the
 * items spiral around it before dropping in one by one. Positions are written straight
 * to the DOM from a rAF loop so React only re-renders when an item lands.
 */
export function HeroSwirl() {
  const stageRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nextKey = useRef(0);
  const [rows, setRows] = useState<Row[]>(() =>
    prefersReducedMotion() ? ILLUSTRATED_ITEMS.map((_, item) => ({ key: nextKey.current++, item })) : [],
  );
  const [visibleRows, setVisibleRows] = useState(4);

  useEffect(() => {
    const stage = stageRef.current;
    const list = listRef.current;
    const rowsEl = rowsRef.current;
    if (!stage || !list || !rowsEl) return;
    const reduceMotion = prefersReducedMotion();

    let w = 0;
    let h = 0;
    let rowH = 42;
    let slots = 4;
    let rowsLeft = 0;
    let rowsTop = 0;
    let landScale = 0.3;
    const measure = () => {
      w = stage.clientWidth;
      h = stage.clientHeight;
      const css = getComputedStyle(stage);
      rowH = parseFloat(css.getPropertyValue('--row-h')) || 42;
      slots = parseInt(css.getPropertyValue('--rows'), 10) || 4;
      setVisibleRows(slots);
      // offset* ignores transforms, so this is stable while the card animates in.
      rowsLeft = list.offsetLeft - list.offsetWidth / 2 + rowsEl.offsetLeft;
      rowsTop = list.offsetTop - list.offsetHeight / 2 + rowsEl.offsetTop;
      const itemW = itemRefs.current[0]?.offsetWidth || 90;
      landScale = (0.72 * (rowH - 14)) / itemW;
    };

    const landed = new Array<boolean>(N).fill(false);
    const land = (i: number) => {
      const key = nextKey.current++;
      setRows((r) => [...r, { key, item: i }]);
    };

    const setList = (progress: number) => {
      list.style.opacity = progress.toFixed(3);
      list.style.transform = `translate(-50%, -50%) scale(${(0.94 + 0.06 * progress).toFixed(3)})`;
      if (ringRef.current) ringRef.current.style.opacity = (progress * 0.7).toFixed(3);
    };

    const placeStatic = () => {
      setList(1);
      for (let i = 0; i < N; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
        const x = w / 2 + Math.cos(angle) * w * 0.42;
        const y = h / 2 + Math.sin(angle) * h * 0.41;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${ORBIT_SCALE})`;
        el.style.opacity = '1';
        el.style.setProperty('--cloud', '0');
      }
    };

    const place = (t: number) => {
      setList(ramp(LIST_IN[0], LIST_IN[1], t) * (1 - ramp(LIST_OUT[0], LIST_OUT[1], t)));
      const blend = ramp(ORBIT_START, ORBIT_START + ORBIT_BLEND, t);
      const orbitT = Math.max(0, t - ORBIT_START);
      const tighten = Math.min(orbitT / 9, 1);
      const fadeIn = ramp(0, 0.8, t);
      const cloud = (1 - ramp(CLOUD_POP[0], CLOUD_POP[1], t)).toFixed(3);

      for (let i = 0; i < N; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        const c = CLOUD[i];
        const phase = i * 1.7;

        const cloudX = c.x * w + Math.sin(t * 0.8 + phase) * w * 0.015;
        const cloudY = c.y * h + Math.cos(t * 1.05 + phase) * h * 0.02;
        const cloudRot = c.r + Math.sin(t * 0.6 + phase) * 4;

        const angle = Math.atan2((c.y - 0.5) * h, (c.x - 0.5) * w) + orbitT * SPIN;
        const orbitX = w / 2 + Math.cos(angle) * w * (0.42 - 0.05 * tighten);
        const orbitY = h / 2 + Math.sin(angle) * h * (0.41 - 0.05 * tighten);

        let x = lerp(cloudX, orbitX, blend);
        let y = lerp(cloudY, orbitY, blend);
        let rot = lerp(cloudRot, 0, blend);
        let scale = lerp(FLOAT_SCALE, ORBIT_SCALE, blend);
        let opacity = fadeIn;

        const diveAt = DIVE_START + i * DIVE_STAGGER;
        if (t > diveAt) {
          const raw = clamp01((t - diveAt) / DIVE_DURATION);
          const d = easeInOut(raw);
          const slot = Math.min(i, slots - 1);
          x = lerp(x, rowsLeft + (rowH - 14) / 2, d);
          y = lerp(y, rowsTop + slot * rowH + rowH / 2, d);
          scale = lerp(scale, landScale, d);
          rot = lerp(rot, 0, d);
          opacity *= 1 - clamp01((raw - 0.8) / 0.2);
          if (raw >= 1 && !landed[i]) {
            landed[i] = true;
            land(i);
          }
        }

        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        el.style.opacity = opacity.toFixed(3);
        el.style.setProperty('--cloud', cloud);
      }
    };

    measure();
    if (reduceMotion) {
      placeStatic();
      const ro = new ResizeObserver(() => {
        measure();
        placeStatic();
      });
      ro.observe(stage);
      return () => ro.disconnect();
    }

    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(stage);

    let elapsed = 0;
    let prevT = 0;
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const dt = Math.min(now - last, 50) / 1000;
      last = now;
      if (visible) {
        elapsed += dt;
        const t = elapsed % LOOP;
        if (t < prevT) {
          landed.fill(false);
          setRows([]);
        }
        prevT = t;
        place(t);
      }
      raf = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  const placeholders = Math.max(0, visibleRows - rows.length);
  const shown = rows.slice(-visibleRows - 1);

  return (
    <div className="swirl" ref={stageRef} role="img" aria-label="Items floating in a cloud, then spiralling into a single wishlist">
      <div className="swirl-ring" ref={ringRef} aria-hidden />

      <div className="swirl-list" ref={listRef} aria-hidden>
        <div className="swirl-list-head">
          <span className="swirl-list-dot" />
          <strong>Birthday wishlist</strong>
          <span className="swirl-list-count">
            {rows.length} item{rows.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="swirl-rows" ref={rowsRef}>
          {shown.map((row) => {
            const item = ILLUSTRATED_ITEMS[row.item];
            const index = rows.indexOf(row);
            return (
              <div className={`swirl-row${index >= visibleRows ? ' is-pushing' : ''}`} key={row.key}>
                <span className="swirl-row-thumb">{item.art}</span>
                <span className="swirl-row-name">{item.name}</span>
                <span className="swirl-row-price">{item.price}</span>
              </div>
            );
          })}
          {Array.from({ length: placeholders }, (_, i) => (
            <div className="swirl-row is-empty" key={`empty-${i}`}>
              <span className="swirl-row-thumb" />
              <span className="swirl-row-name" />
            </div>
          ))}
        </div>
      </div>

      {ILLUSTRATED_ITEMS.map((item, i) => (
        <div
          key={item.name}
          className="swirl-item"
          aria-hidden
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
        >
          <Cloud className="swirl-item-cloud" />
          <span className="swirl-item-art">{item.art}</span>
        </div>
      ))}
    </div>
  );
}
