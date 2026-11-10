import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Cloud } from './Cloud';
import { BOX_ITEMS, COLLECTION_ITEMS, ILLUSTRATED_ITEMS, type SceneItem } from './ItemIllustrations';

/*
 * Timeline, in seconds within one scene:
 *   0 – 2.2   items float in a loose cloud, each inside its own little cloud
 *   1.9 – 2.9 the little clouds puff away
 *   2.0 – 2.8 the list card forms in the middle
 *   2.2 – 3.6 items ease from the cloud onto an orbit around the list
 *   3.6 + i·k items dive into the list one at a time (last lands ~10.5)
 *  11.0 – 16.5 scene finale: guests buy from the wishlist, the collection
 *             settles onto a shelf, or the box card collapses into a QR label
 *             that a phone scans
 *  16.8–17.6 the finished beat fades out, then the next scene starts
 * Scenes play in order (wishlist, collection, box) and then loop.
 */
const LOOP = 18;
const LIST_IN: [number, number] = [2.0, 2.8];
const LIST_OUT: [number, number] = [16.8, 17.6];
const ORBIT_START = 2.2;
const CLOUD_POP: [number, number] = [1.9, 2.9];
const ORBIT_BLEND = 1.4;
const DIVE_START = 3.6;
const DIVE_STAGGER = 0.85;
const DIVE_DURATION = 1.0;
const FINALE_START = 11.0;
const CLAIM_STAGGER = 0.85;
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

/** Guests who reserve or buy from the birthday wishlist during its finale. */
const GUESTS = [
  { who: 'Maya', status: 'reserved' as const },
  { who: 'Alex', status: 'bought' as const },
  { who: 'Sam', status: 'reserved' as const },
  { who: 'Jo', status: 'bought' as const },
];

export type HeroSceneId = 'wishlist' | 'collection' | 'box';

interface Scene {
  id: HeroSceneId;
  tab: string;
  title: string;
  noun: [string, string];
  /** One per CLOUD position. */
  items: SceneItem[];
}

const SCENES: Scene[] = [
  {
    id: 'wishlist',
    tab: 'Wishlists',
    title: 'Birthday wishlist',
    noun: ['item', 'items'],
    items: ILLUSTRATED_ITEMS.map((i) => ({ name: i.name, meta: i.price, art: i.art })),
  },
  { id: 'collection', tab: 'Collections', title: 'My collection', noun: ['item', 'items'], items: COLLECTION_ITEMS },
  { id: 'box', tab: 'Boxes', title: 'Box 3 · Living room', noun: ['thing', 'things'], items: BOX_ITEMS },
];

const N = CLOUD.length;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const ramp = (from: number, to: number, t: number) => easeInOut(clamp01((t - from) / (to - from)));

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Row {
  key: number;
  item: number;
}

interface Claim {
  who: string;
  status: 'reserved' | 'bought';
  /** Index from the newest landed row: 0 is the most recent gift guests shop for. */
  row: number;
}

/**
 * Decorative hero animation: item illustrations float in a cloud, a list forms, and the
 * items spiral around it before dropping in one by one — first into a wishlist, then a
 * collection, then a moving box. After each list fills, a short finale plays: guests
 * reserve gifts, the collection settles onto a shelf, or the packing list collapses into
 * a QR-labelled box a phone scans. Positions are written straight to the DOM from a rAF
 * loop so React only re-renders when an item lands, a claim appears, or the scene changes.
 */
export function HeroSwirl({ onSceneChange }: { onSceneChange?: (id: HeroSceneId) => void } = {}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const scenesRef = useRef<HTMLDivElement>(null);
  const toastsRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const measureRef = useRef<() => void>(undefined);
  const jumpRef = useRef<(scene: number) => void>(undefined);
  const nextKey = useRef(0);
  const allRows = () => Array.from({ length: N }, (_, item) => ({ key: nextKey.current++, item }));
  const [scene, setScene] = useState(0);
  const [rows, setRows] = useState<Row[]>(() => (prefersReducedMotion() ? allRows() : []));
  const [claims, setClaims] = useState<Claim[]>(() => (prefersReducedMotion() ? GUESTS.map((g, i) => ({ ...g, row: i })) : []));
  const [visibleRows, setVisibleRows] = useState(4);
  const current = SCENES[scene];

  useEffect(() => {
    onSceneChange?.(SCENES[scene].id);
  }, [scene, onSceneChange]);

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
    measureRef.current = measure;

    const landed = new Array<boolean>(N).fill(false);
    const claimed = new Array<boolean>(GUESTS.length).fill(false);
    const land = (i: number) => {
      const key = nextKey.current++;
      setRows((r) => [...r, { key, item: i }]);
    };
    const claim = (i: number) => {
      const guest = GUESTS[i];
      setClaims((c) => [...c, { ...guest, row: i }]);
    };

    const setList = (progress: number) => {
      list.style.opacity = progress.toFixed(3);
      list.style.transform = `translate(-50%, -50%) scale(${(0.94 + 0.06 * progress).toFixed(3)})`;
    };

    const setFinale = (t: number, sceneId: Scene['id']) => {
      const out = 1 - ramp(LIST_OUT[0], LIST_OUT[1], t);

      if (sceneId === 'wishlist') {
        for (let i = 0; i < GUESTS.length; i++) {
          if (t > FINALE_START + 0.4 + i * CLAIM_STAGGER && !claimed[i]) {
            claimed[i] = true;
            claim(i);
          }
        }
        if (toastsRef.current) {
          const show = ramp(FINALE_START + 0.3, FINALE_START + 0.9, t) * out;
          toastsRef.current.style.opacity = show.toFixed(3);
        }
      }

      if (sceneId === 'collection' && shelfRef.current) {
        const shelf = ramp(FINALE_START + 0.3, FINALE_START + 1.1, t) * out;
        shelfRef.current.style.opacity = shelf.toFixed(3);
        shelfRef.current.style.transform = `translate(-50%, ${lerp(18, 0, shelf).toFixed(1)}px)`;
      }

      if (sceneId === 'box') {
        // The packing list shrinks into the cardboard box, then the phone slides in to scan the QR.
        const toBox = ramp(FINALE_START, FINALE_START + 1.1, t);
        const phoneIn = ramp(FINALE_START + 1.0, FINALE_START + 1.8, t) * out;
        const listKeep = (1 - toBox) * out;
        list.style.opacity = (parseFloat(list.style.opacity || '0') * listKeep).toFixed(3);
        list.style.transform = `translate(-50%, -50%) scale(${(0.94 + 0.06 * listKeep - 0.35 * toBox).toFixed(3)})`;
        if (boxRef.current) {
          boxRef.current.style.opacity = (toBox * out).toFixed(3);
          boxRef.current.style.transform = `translate(-50%, -50%) scale(${(0.86 + 0.14 * toBox).toFixed(3)}) rotate(${((-8 + 8 * toBox) * out).toFixed(2)}deg)`;
        }
        if (phoneRef.current) {
          phoneRef.current.style.opacity = phoneIn.toFixed(3);
          phoneRef.current.style.transform = `translate(${lerp(42, 0, phoneIn).toFixed(1)}%, -50%) rotate(${lerp(12, -6, phoneIn).toFixed(2)}deg)`;
        }
      }
    };

    let shownScene = 0;

    const placeStatic = () => {
      const isBox = SCENES[shownScene]?.id === 'box';
      setList(isBox ? 0 : 1);
      if (ringRef.current) ringRef.current.style.opacity = isBox ? '0' : '0.7';
      for (let i = 0; i < N; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
        const x = w / 2 + Math.cos(angle) * w * 0.42;
        const y = h / 2 + Math.sin(angle) * h * 0.41;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${ORBIT_SCALE})`;
        el.style.opacity = isBox ? '0' : '1';
        el.style.setProperty('--cloud', '0');
      }
      if (toastsRef.current) toastsRef.current.style.opacity = '1';
      if (shelfRef.current) {
        shelfRef.current.style.opacity = '1';
        shelfRef.current.style.transform = 'translate(-50%, 0)';
      }
      if (boxRef.current) {
        boxRef.current.style.opacity = '1';
        boxRef.current.style.transform = 'translate(-50%, -50%) scale(1) rotate(0deg)';
      }
      if (phoneRef.current) {
        phoneRef.current.style.opacity = '1';
        phoneRef.current.style.transform = 'translate(0, -50%) rotate(-6deg)';
      }
    };

    const place = (t: number) => {
      const sceneId = SCENES[shownScene].id;
      const out = 1 - ramp(LIST_OUT[0], LIST_OUT[1], t);
      const baseList = ramp(LIST_IN[0], LIST_IN[1], t) * out;
      setList(baseList);
      const blend = ramp(ORBIT_START, ORBIT_START + ORBIT_BLEND, t);
      const orbitT = Math.max(0, t - ORBIT_START);
      const tighten = Math.min(orbitT / 9, 1);
      const fadeIn = ramp(0, 0.8, t);
      const cloud = (1 - ramp(CLOUD_POP[0], CLOUD_POP[1], t)).toFixed(3);
      // The dashed ring is the orbit path — only show it once items start circling, and hide it again when the box finale takes over.
      let ring = blend * out * 0.7;
      if (sceneId === 'box') ring *= 1 - ramp(FINALE_START, FINALE_START + 1.1, t);
      if (ringRef.current) ringRef.current.style.opacity = ring.toFixed(3);

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

      setFinale(t, sceneId);
    };

    const setProgress = (p: number) => scenesRef.current?.style.setProperty('--scene-progress', p.toFixed(3));

    measure();
    if (reduceMotion) {
      placeStatic();
      setProgress(1);
      measureRef.current = () => {
        measure();
        placeStatic();
      };
      jumpRef.current = (next) => {
        shownScene = next;
        setScene(next);
        setRows(allRows());
        setClaims(GUESTS.map((g, i) => ({ ...g, row: i })));
      };
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
    let last = performance.now();
    const startScene = (next: number) => {
      shownScene = next;
      landed.fill(false);
      claimed.fill(false);
      setRows([]);
      setClaims([]);
      setScene(next);
      if (boxRef.current) {
        boxRef.current.style.opacity = '0';
        boxRef.current.style.transform = 'translate(-50%, -50%) scale(0.86) rotate(-8deg)';
      }
      if (phoneRef.current) {
        phoneRef.current.style.opacity = '0';
        phoneRef.current.style.transform = 'translate(42%, -50%) rotate(12deg)';
      }
      if (shelfRef.current) {
        shelfRef.current.style.opacity = '0';
        shelfRef.current.style.transform = 'translate(-50%, 18px)';
      }
      if (toastsRef.current) toastsRef.current.style.opacity = '0';
      if (ringRef.current) ringRef.current.style.opacity = '0';
    };
    jumpRef.current = (next) => {
      elapsed = next * LOOP;
      startScene(next);
    };
    let raf = requestAnimationFrame(function tick(now) {
      // A frame's timestamp can predate the `performance.now()` taken above; a negative step would put `elapsed` (and the scene) below zero.
      const dt = Math.min(Math.max(now - last, 0), 50) / 1000;
      last = now;
      if (visible) {
        elapsed = (elapsed + dt) % (LOOP * SCENES.length);
        const next = Math.floor(elapsed / LOOP);
        if (next !== shownScene) startScene(next);
        const t = elapsed - next * LOOP;
        place(t);
        setProgress(t / LOOP);
      }
      raf = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  // A new scene mounts new item elements and can change the card's header, so re-measure (and re-place when static).
  useLayoutEffect(() => {
    measureRef.current?.();
  }, [scene]);

  const placeholders = Math.max(0, visibleRows - rows.length);
  const shown = rows.slice(-visibleRows - 1);
  const [one, many] = current.noun;
  const claimByRow = new Map(claims.map((c) => [c.row, c]));
  // The shelf shows the newest landed things; before anything lands, preview the first four.
  const shelfItems = rows.length ? rows.slice(-4).map((r) => current.items[r.item]) : current.items.slice(0, 4);

  return (
    <div className="swirl-wrap">
      <div
        className={`swirl is-${current.id}`}
        ref={stageRef}
        role="img"
        aria-label="Items floating in a cloud, then spiralling into a wishlist guests shop from, a collection that settles onto a shelf, and a moving box whose QR label a phone scans"
      >
        <div className="swirl-ring" ref={ringRef} aria-hidden />

        <div className="swirl-list" ref={listRef} aria-hidden>
          <div className="swirl-list-head">
            <span className="swirl-list-dot" />
            <strong>{current.title}</strong>
            <span className="swirl-list-count">
              {rows.length} {rows.length === 1 ? one : many}
            </span>
          </div>
          <div className="swirl-rows" ref={rowsRef}>
            {shown.map((row) => {
              const item = current.items[row.item];
              const index = rows.indexOf(row);
              // Claims attach to the newest visible rows (the ones guests would shop from first).
              const fromEnd = rows.length - 1 - index;
              const claim = current.id === 'wishlist' ? claimByRow.get(fromEnd) : undefined;
              return (
                <div className={`swirl-row${index >= visibleRows ? ' is-pushing' : ''}${claim ? ` is-${claim.status}` : ''}`} key={row.key}>
                  <span className="swirl-row-thumb">{item.art}</span>
                  <span className="swirl-row-name">{item.name}</span>
                  {claim ? (
                    <span className={`swirl-row-claim is-${claim.status}`}>
                      <span className="swirl-row-claim-who">{claim.who}</span>
                      {claim.status === 'bought' ? 'bought' : 'reserved'}
                    </span>
                  ) : (
                    <span className="swirl-row-meta">{item.meta}</span>
                  )}
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

        {current.id === 'wishlist' && (
          <div className="swirl-toasts" ref={toastsRef} aria-hidden>
            {claims.map((c) => (
              <span className={`swirl-toast is-${c.status}`} key={`${c.who}-${c.row}`}>
                <span className="swirl-toast-avatar">{c.who[0]}</span>
                {c.who} {c.status === 'bought' ? 'bought a gift' : 'reserved something'}
              </span>
            ))}
          </div>
        )}

        {current.id === 'collection' && (
          <div className="swirl-shelf" ref={shelfRef} aria-hidden>
            <div className="swirl-shelf-rail">
              {shelfItems.map((item, i) => (
                <span className="swirl-shelf-thumb" key={`${item.name}-${i}`}>
                  {item.art}
                </span>
              ))}
            </div>
            <span className="swirl-shelf-label">On your shelf · ★ 4.8</span>
          </div>
        )}

        {current.id === 'box' && (
          <>
            <div className="swirl-box" ref={boxRef} aria-hidden>
              <PackedBoxArt />
            </div>
            <div className="swirl-phone" ref={phoneRef} aria-hidden>
              <ScanPhoneArt />
            </div>
          </>
        )}

        {current.items.map((item, i) => (
          <div
            key={`${current.id}-${item.name}`}
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

      <div className="swirl-scenes" ref={scenesRef} role="group" aria-label="Show the animation for">
        {SCENES.map((s, i) => (
          <button key={s.id} type="button" className={`swirl-scene is-${s.id}`} aria-pressed={i === scene} onClick={() => jumpRef.current?.(i)}>
            {s.tab}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Decorative QR-labelled packing box (not a real scannable code). */
function PackedBoxArt() {
  return (
    <svg className="swirl-box-art" viewBox="0 0 120 100" fill="none" aria-hidden focusable="false">
      <rect x="16" y="28" width="88" height="62" rx="6" fill="#c8a27a" />
      <rect x="12" y="18" width="96" height="18" rx="4" fill="#b48a5e" />
      <rect x="52" y="18" width="16" height="28" fill="#e2c093" />
      <rect x="24" y="42" width="32" height="32" rx="3.5" fill="#fff" />
      <g fill="#2f3440">
        <rect x="27.5" y="45.5" width="9" height="9" rx="1.4" />
        <rect x="43.5" y="45.5" width="9" height="9" rx="1.4" />
        <rect x="27.5" y="61.5" width="9" height="9" rx="1.4" />
        <rect x="40" y="61.5" width="3.5" height="3.5" />
        <rect x="45.5" y="61.5" width="3.5" height="3.5" />
        <rect x="40" y="67" width="3.5" height="3.5" />
        <rect x="49" y="67" width="3.5" height="3.5" />
        <rect x="43.5" y="64" width="3.5" height="3.5" />
      </g>
      <text x="62" y="54" fill="#6b4f32" fontSize="9" fontWeight="700" fontFamily="ui-sans-serif, system-ui, sans-serif">
        BOX 3
      </text>
      <text x="62" y="66" fill="#8a6a45" fontSize="7" fontFamily="ui-sans-serif, system-ui, sans-serif">
        Living
      </text>
      <text x="62" y="76" fill="#8a6a45" fontSize="7" fontFamily="ui-sans-serif, system-ui, sans-serif">
        room
      </text>
      <rect className="swirl-scanline" x="24" y="42" width="32" height="3" rx="1.5" fill="#e8745b" />
    </svg>
  );
}

/** Phone that shows what's inside the scanned box, with a soft beam toward the QR. */
function ScanPhoneArt() {
  return (
    <svg className="swirl-phone-art" viewBox="0 0 72 120" fill="none" aria-hidden focusable="false">
      <path className="swirl-beam" d="M10 40 L-18 28 L-18 72 L10 70 Z" fill="#4fa3a5" opacity=".35" />
      <rect x="10" y="4" width="52" height="112" rx="10" fill="#2f3440" />
      <rect x="16" y="14" width="40" height="86" rx="4" fill="#eef1f5" />
      <rect x="30" y="104" width="12" height="3" rx="1.5" fill="#5a6070" />
      <rect x="20" y="20" width="12" height="12" rx="3" fill="#c8a27a" />
      <rect x="36" y="22" width="14" height="3" rx="1.5" fill="#c9ced8" />
      <rect x="36" y="28" width="10" height="2.5" rx="1.2" fill="#c9ced8" />
      <rect x="20" y="38" width="8" height="8" rx="2" fill="#e8745b" />
      <rect x="31" y="40" width="18" height="2.5" rx="1.2" fill="#c9ced8" />
      <rect x="20" y="50" width="8" height="8" rx="2" fill="#4fa3a5" />
      <rect x="31" y="52" width="16" height="2.5" rx="1.2" fill="#c9ced8" />
      <rect x="20" y="62" width="8" height="8" rx="2" fill="#f2c14e" />
      <rect x="31" y="64" width="14" height="2.5" rx="1.2" fill="#c9ced8" />
    </svg>
  );
}
