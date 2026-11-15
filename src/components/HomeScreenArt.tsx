import { Plus, Share } from 'lucide-react';
import { brand } from '../config/brand';
import { LogoMark } from './Logo';

/** Decorative phone + home-screen scene for the landing “Add to Home Screen” section. */
export function HomeScreenArt() {
  return (
    <div className="hs-art" aria-hidden>
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
    </div>
  );
}
