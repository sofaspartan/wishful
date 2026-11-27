import { Link } from 'react-router-dom';
import { brand } from '../config/brand';
import { BrandMarkSvg, BrandWordmarkSvg } from './brandLogo';

const WORDMARK_RATIO = 1484.56 / 550.88;

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: Math.round(size * 0.73) }} aria-hidden>
      <BrandMarkSvg className="logo-mark-svg" />
    </span>
  );
}

/** Brand home link — full wordmark by default, or W+cloud mark for tight chrome. */
export function Logo({
  to = '/',
  size = 38,
  variant = 'wordmark',
}: {
  to?: string;
  size?: number;
  variant?: 'wordmark' | 'mark';
}) {
  if (variant === 'mark') {
    return (
      <Link to={to} className="logo logo-full" aria-label={`${brand.name} home`}>
        <LogoMark size={size} />
      </Link>
    );
  }
  const height = size;
  const width = Math.round(size * WORDMARK_RATIO);
  return (
    <Link to={to} className="logo logo-full" aria-label={`${brand.name} home`}>
      <span className="logo-wordmark" style={{ width, height }} aria-hidden>
        <BrandWordmarkSvg className="logo-wordmark-svg" />
      </span>
    </Link>
  );
}
