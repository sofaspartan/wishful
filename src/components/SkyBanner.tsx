import type { ReactNode } from 'react';
import { CloudBank, CloudPuff } from './Cloud';

/** Edge-to-edge sky under the site header, with drifting side clouds and a cloud bank along the bottom. */
export function SkyBanner({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`sky-banner${className ? ` ${className}` : ''}`}>
      <CloudPuff className="cloud-1" />
      <CloudPuff className="cloud-2" />
      <CloudPuff className="cloud-3" />
      <CloudPuff className="cloud-4" />
      <div className="sky-banner-inner">{children}</div>
      <CloudBank className="hero-bottom" />
    </div>
  );
}
