import type { CSSProperties, ReactNode } from 'react';
import { Cloud, CloudBank } from './Cloud';
import { CoverArt } from './CoverArt';
import { SkyArt, type SkyScene } from './SkyArt';
import { dashboardLookSurface, useDashboardLook, type DashboardLook } from '../lib/dashboardScene';
import { useMe } from '../lib/queries';

type Kind = 'not-found' | 'crash';

const COPY: Record<Kind, { eyebrow: string; title: string; body: string; scene: SkyScene }> = {
  'not-found': {
    eyebrow: '404',
    title: 'This page took a detour',
    body: 'We checked every list, box, and couch cushion. Nothing here matches that link — it may have moved, or it never existed.',
    scene: 'search',
  },
  crash: {
    eyebrow: 'Whoops',
    title: 'We dropped the wrapping paper',
    body: 'Something unexpected happened while drawing this page. Your data is still safe — try a reload, or head home and start fresh.',
    scene: 'gifts',
  },
};

const GUEST_SKY: DashboardLook = { mode: 'scene', backdrop: 'sky' };

/** Full-page sky card for 404s and unexpected UI crashes. */
export function ErrorSplash({ kind, actions }: { kind: Kind; actions: ReactNode }) {
  const copy = COPY[kind];
  const { data: me } = useMe();
  const [storedLook] = useDashboardLook();
  /* Guests (confirmed signed-out) get a blue sky; signed-in users keep their dashboard look. */
  const look = me === null ? GUEST_SKY : storedLook;
  const surface = dashboardLookSurface(look);
  const showSceneArt = look.mode === 'scene';
  /* Soft classics skip drifting clouds (same as sidebar); scene keeps free sils + whites. */
  const showDrift = look.mode !== 'classic';

  return (
    <div
      className={['error-page', surface.className].filter(Boolean).join(' ')}
      style={surface.style as CSSProperties | undefined}
      data-dashboard-scene={look.mode === 'classic' ? look.scene : undefined}
      data-error-kind={kind}
    >
      {showSceneArt && (
        <div className="error-page-scene" aria-hidden>
          <CoverArt art={{ icon: 'gift', backdrop: look.mode === 'scene' ? look.backdrop : 'sky' }} showIcon={false} />
        </div>
      )}
      {showDrift && (
        <div className="error-page-drift" aria-hidden>
          {/* Independent dark lanes first (behind), then whites — not shadow-locked pairs. */}
          <Cloud className="error-sil error-sil-a" />
          <Cloud className="error-sil error-sil-b" />
          <Cloud className="error-sil error-sil-a error-phase-b" />
          <Cloud className="error-sil error-sil-c" />
          <Cloud className="error-cloud error-cloud-1" />
          <Cloud className="error-cloud error-cloud-1 error-phase-b" />
          <Cloud className="error-cloud error-cloud-2" />
          <Cloud className="error-cloud error-cloud-3" />
          <Cloud className="error-cloud error-cloud-3 error-phase-b" />
          <Cloud className="error-cloud error-cloud-4" />
        </div>
      )}

      <div className="error-sky">
        <div className="error-sky-copy">
          <span className="page-sky-eyebrow">{copy.eyebrow}</span>
          <h1 className="display error-sky-title">{copy.title}</h1>
          <p className="error-sky-body">{copy.body}</p>
          <div className="error-sky-actions">{actions}</div>
        </div>
        <div className="error-sky-art" aria-hidden>
          <SkyArt scene={copy.scene} />
        </div>
      </div>

      <CloudBank className="error-page-bank" />
    </div>
  );
}
