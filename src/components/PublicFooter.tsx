import { Link } from 'react-router-dom';
import { brand } from '../config/brand';
import { CloudBank } from './Cloud';
import { Logo } from './Logo';

/** Shared public-page footer with a themed cloud bank along the top. */
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <CloudBank className="public-footer-bank" />
      <div className="public-footer-inner">
        <Logo to="/" size={22} />
        <p>
          {brand.tagline}{' '}
          <Link to="/register">Make your own wishlist</Link>
        </p>
      </div>
    </footer>
  );
}
