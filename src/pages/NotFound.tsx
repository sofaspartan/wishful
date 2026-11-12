import { Link } from 'react-router-dom';
import { ErrorSplash } from '../components/ErrorSplash';
import { useMe } from '../lib/queries';

export default function NotFound() {
  const { data: me } = useMe();
  return (
    <ErrorSplash
      kind="not-found"
      actions={
        <>
          <Link to={me ? '/app' : '/'} className="btn btn-primary">
            {me ? 'Back to dashboard' : 'Go home'}
          </Link>
          {me && (
            <Link to="/app/lists" className="btn">
              My lists
            </Link>
          )}
        </>
      }
    />
  );
}
