import type { ReactNode } from 'react';

/** Page header: title and copy on the left, optional illustration on the right. */
export function PageSky({
  title,
  subtitle,
  art,
  children,
  tone,
}: {
  /** @deprecated Unused — kept so call sites can drop it gradually. */
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
        <h1 className="page-title display">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
        {children}
      </div>
      {art && (
        <div className="page-sky-art" aria-hidden>
          {art}
        </div>
      )}
    </header>
  );
}
