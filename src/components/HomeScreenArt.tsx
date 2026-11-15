import { useEffect, useRef, useState } from 'react';
import { Download, Monitor, Plus, Share } from 'lucide-react';
import { brand } from '../config/brand';
import { LogoMark } from './Logo';

type Scene = 'phone' | 'desktop';

const SCENE_MS = 5600;

const SCENES: Array<{ id: Scene; tab: string }> = [
  { id: 'phone', tab: 'Phone' },
  { id: 'desktop', tab: 'Desktop' },
];

/** Decorative install scenes that alternate between phone Home Screen and desktop browser install. */
export function HomeScreenArt() {
  const [scene, setScene] = useState<Scene>('phone');
  const [progress, setProgress] = useState(0);
  const reduceRef = useRef(false);
  const startedAt = useRef(performance.now());

  useEffect(() => {
    reduceRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceRef.current) {
      setProgress(1);
      return;
    }
    startedAt.current = performance.now();
    setProgress(0);
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt.current) / SCENE_MS);
      setProgress(t);
      if (t >= 1) {
        setScene((s) => (s === 'phone' ? 'desktop' : 'phone'));
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [scene]);

  const pick = (next: Scene) => {
    if (next === scene) return;
    setScene(next);
  };

  return (
    <div className="hs-art" style={{ ['--scene-progress' as string]: String(progress) }}>
      <div className={['hs-scene hs-scene-phone', scene === 'phone' && 'is-active'].filter(Boolean).join(' ')} aria-hidden>
        <PhoneScene />
      </div>
      <div className={['hs-scene hs-scene-desktop', scene === 'desktop' && 'is-active'].filter(Boolean).join(' ')} aria-hidden>
        <DesktopScene />
      </div>
      <div className="swirl-scenes hs-scenes" role="group" aria-label="Show install for">
        {SCENES.map((s) => (
          <button key={s.id} type="button" className="swirl-scene" aria-pressed={scene === s.id} onClick={() => pick(s.id)}>
            {s.tab}
          </button>
        ))}
      </div>
    </div>
  );
}

function PhoneScene() {
  return (
    <>
      <div className="hs-phone">
        <div className="hs-phone-notch" />
        <div className="hs-home">
          <div className="hs-status">
            <span>9:41</span>
            <span className="hs-status-dots" />
          </div>
          <div className="hs-grid">
            <span className="hs-app hs-app-wish is-landing">
              <LogoMark size={28} />
            </span>
            <span className="hs-app hs-app-teal" />
            <span className="hs-app hs-app-gold" />
            <span className="hs-app hs-app-coral" />
            <span className="hs-app hs-app-muted" />
            <span className="hs-app hs-app-lavender" />
            <span className="hs-app hs-app-muted" />
            <span className="hs-app hs-app-teal" />
            <span className="hs-app hs-app-coral" />
            <span className="hs-app hs-app-gold" />
            <span className="hs-app hs-app-muted" />
            <span className="hs-app hs-app-lavender" />
          </div>
          <div className="hs-dock">
            <span className="hs-app hs-app-muted" />
            <span className="hs-app hs-app-coral" />
            <span className="hs-app hs-app-gold" />
            <span className="hs-app hs-app-teal" />
          </div>
          <div className="hs-phone-bar" />
        </div>
      </div>

      <div className="hs-sheet">
        <div className="hs-sheet-handle" />
        <div className="hs-sheet-row">
          <span className="hs-sheet-step" aria-hidden>
            1
          </span>
          <span className="hs-sheet-icon">
            <Share size={16} />
          </span>
          <span>
            <strong>Share</strong>
            <em>Open the share menu</em>
          </span>
        </div>
        <div className="hs-sheet-row is-focus">
          <span className="hs-sheet-step" aria-hidden>
            2
          </span>
          <span className="hs-sheet-icon is-plus">
            <Plus size={16} strokeWidth={2.5} />
          </span>
          <span>
            <strong>Add to Home Screen</strong>
            <em>Save the {brand.name} icon</em>
          </span>
        </div>
        <div className="hs-sheet-row hs-sheet-row-done">
          <span className="hs-sheet-step" aria-hidden>
            3
          </span>
          <span className="hs-sheet-icon is-done">
            <LogoMark size={28} />
          </span>
          <span>
            <strong>Open it full screen</strong>
            <em>App-like — no browser chrome</em>
          </span>
        </div>
      </div>
    </>
  );
}

function DesktopScene() {
  return (
    <>
      <div className="hs-desktop">
        <div className="hs-desktop-bar">
          <span className="ext-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="hs-desktop-url">wishful.app/app</span>
          <span className="hs-desktop-install" title="Install">
            <Download size={14} aria-hidden />
          </span>
        </div>
        <div className="hs-desktop-page">
          <div className="hs-desktop-sky">
            <LogoMark size={36} />
            <span className="hs-desktop-title">{brand.name}</span>
            <span className="hs-desktop-line" />
            <span className="hs-desktop-line hs-desktop-line-sm" />
          </div>
          <div className="hs-desktop-tiles">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>

      <div className="hs-desktop-card">
        <div className="hs-desktop-card-head">
          <LogoMark size={22} />
          <span>Install {brand.name}?</span>
        </div>
        <div className="hs-sheet-row">
          <span className="hs-sheet-step" aria-hidden>
            1
          </span>
          <span className="hs-sheet-icon">
            <Download size={16} />
          </span>
          <span>
            <strong>Install app</strong>
            <em>Address bar or browser menu</em>
          </span>
        </div>
        <div className="hs-sheet-row is-focus">
          <span className="hs-sheet-step" aria-hidden>
            2
          </span>
          <span className="hs-sheet-icon is-plus">
            <Monitor size={16} />
          </span>
          <span>
            <strong>Open its own window</strong>
            <em>Dock or taskbar icon</em>
          </span>
        </div>
        <div className="hs-sheet-row hs-sheet-row-done">
          <span className="hs-sheet-step" aria-hidden>
            3
          </span>
          <span className="hs-sheet-icon is-done">
            <LogoMark size={28} />
          </span>
          <span>
            <strong>Use it like an app</strong>
            <em>Same lists, no browser tabs</em>
          </span>
        </div>
      </div>
    </>
  );
}
