import { Link } from 'react-router-dom';
import { useMe } from '../lib/queries';

export default function NotFound() {
  const { data: me } = useMe();
  return (
    <div className="error-page">
      <div className="stack" style={{ alignItems: 'center', maxWidth: 420 }}>
        <div className="display">404</div>
        <h1 style={{ fontSize: 'var(--text-xl)' }}>This page doesn't exist</h1>
        <p className="muted">The link might be broken, or the page may have moved.</p>
        <Link to={me ? '/app' : '/'} className="btn btn-primary">
          {me ? 'Back to dashboard' : 'Go home'}
        </Link>
      </div>
    </div>
  );
}
