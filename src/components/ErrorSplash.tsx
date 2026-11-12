import type { ReactNode } from 'react';
import { CloudBank } from './Cloud';
import { SkyArt, type SkyScene } from './SkyArt';

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

/** Full-page sky card for 404s and unexpected UI crashes. */
export function ErrorSplash({ kind, actions }: { kind: Kind; actions: ReactNode }) {
  const copy = COPY[kind];
  return (
    <div className="error-page">
      <div className={`error-sky${kind === 'crash' ? ' error-sky-crash' : ''}`}>
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
