import type { CSSProperties, ReactNode } from 'react';
import { CloudBank, CloudPuff } from './Cloud';
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
  const showSoftClouds = look.mode === 'classic' || look.mode === 'scene';

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
      {showSoftClouds && (
        <div className="error-page-clouds" aria-hidden>
          <CloudPuff className="error-cloud error-cloud-a" />
          <CloudPuff className="error-cloud error-cloud-b" />
          <CloudPuff className="error-cloud error-cloud-c" />
          <CloudPuff className="error-cloud error-cloud-d" />
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
        <CloudBank className="error-sky-bank" />
      </div>
    </div>
  );
}
