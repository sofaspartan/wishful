import { Link } from 'react-router-dom';
import { brand } from '../config/brand';

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path d="M11 2.5c.55 4.3 2.7 6.45 7 7-4.3.55-6.45 2.7-7 7-.55-4.3-2.7-6.45-7-7 4.3-.55 6.45-2.7 7-7Z" fill="#fff" />
        <circle cx="18.5" cy="18.5" r="2" fill="#fff" />
      </svg>
    </span>
  );
}

export function Logo({ to = '/', size = 30 }: { to?: string; size?: number }) {
  return (
    <Link to={to} className="logo" aria-label={`${brand.name} home`}>
      <LogoMark size={size} />
      <span className="logo-word">{brand.name}</span>
    </Link>
  );
}
