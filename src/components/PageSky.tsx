import type { ReactNode } from 'react';
import { CloudBank } from './Cloud';

/** Page header drawn as a small sky: title and copy on the left, an optional illustration on the right, a cloud bank along the bottom. */
export function PageSky({
  eyebrow,
  title,
  subtitle,
  art,
  children,
  tone,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  art?: ReactNode;
  children?: ReactNode;
  /** Blush for collections, kraft for boxes; default is the cool accent sky. */
  tone?: 'blush' | 'kraft';
}) {
  return (
    <header className={['page-sky', art && 'has-art', tone && `page-sky-${tone}`].filter(Boolean).join(' ')}>
      <div className="page-sky-copy">
        {eyebrow && <span className="page-sky-eyebrow">{eyebrow}</span>}
        <h1 className="page-title display">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
        {children}
      </div>
      {art && (
        <div className="page-sky-art" aria-hidden>
          {art}
        </div>
      )}
      <CloudBank className="page-sky-bank" />
    </header>
  );
}
