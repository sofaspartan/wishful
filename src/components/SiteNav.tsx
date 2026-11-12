import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useMe } from '../lib/queries';
import { brand } from '../config/brand';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

interface SiteNavProps {
  current?: 'home' | 'gifts' | 'knowledge';
  /** Where to land after logging in or signing up. */
  next?: string;
}

/** Full-width top bar for the public pages; wrap it in `.landing-top` to sit it on the sky. */
export function SiteNav({ current, next }: SiteNavProps) {
  const { data: me } = useMe();
  const query = next ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <header className="landing-nav">
      <Logo to="/" />
      <nav className="landing-nav-links hide-xs" aria-label="Explore">
        <Link to="/" className="btn btn-ghost" aria-current={current === 'home' ? 'page' : undefined}>
          Home
        </Link>
        <Link to={me ? '/app/gifts' : '/gifts'} className="btn btn-ghost" aria-current={current === 'gifts' ? 'page' : undefined}>
          Gift ideas
        </Link>
        <Link to="/knowledge" className="btn btn-ghost" aria-current={current === 'knowledge' ? 'page' : undefined}>
          Knowledge base
        </Link>
      </nav>
      <div className="spacer" />
      {me ? (
        <Link to="/app" className="btn btn-primary">
          Open {brand.name} <ArrowRight size={16} aria-hidden />
        </Link>
      ) : (
        <>
          <Link to={`/login${query}`} className="btn btn-ghost">
            Log in
          </Link>
          <Link to={`/register${query}`} className="btn btn-primary">
            Get started
          </Link>
        </>
      )}
      <ThemeToggle />
    </header>
  );
}
