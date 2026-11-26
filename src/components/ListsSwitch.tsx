import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { FEATURE_ILLUSTRATIONS } from './ItemIllustrations';

/** Wishlists, collections, lists and boxes share the Lists tab; this switches among them. */
export function ListsSwitch() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const onLists = pathname === '/app/lists';
  const onBoxes = pathname === '/app/boxes';
  const raw = params.get('kind');
  const kind = raw === 'collection' ? 'collection' : raw === 'lists' ? 'lists' : 'wishlist';
  const status = params.get('status');
  const statusQuery = status === 'archived' || status === 'shared' ? `&status=${status}` : '';

  return (
    <nav className="segmented lists-switch" aria-label="Wishlists, collections, lists, or boxes">
      <Link to={`/app/lists?kind=wishlist${statusQuery}`} aria-current={onLists && kind === 'wishlist' ? 'page' : undefined}>
        <span className="art-icon art-icon-tab" aria-hidden>
          {FEATURE_ILLUSTRATIONS.lists}
        </span>
        Wishlists
      </Link>
      <Link to={`/app/lists?kind=collection${statusQuery}`} aria-current={onLists && kind === 'collection' ? 'page' : undefined}>
        <span className="art-icon art-icon-tab" aria-hidden>
          {FEATURE_ILLUSTRATIONS.collection}
        </span>
        Collections
      </Link>
      <Link to={`/app/lists?kind=lists${statusQuery}`} aria-current={onLists && kind === 'lists' ? 'page' : undefined}>
        <span className="art-icon art-icon-tab" aria-hidden>
          {FEATURE_ILLUSTRATIONS.tasks}
        </span>
        Lists
      </Link>
      <Link to={statusQuery ? `/app/boxes?status=${status}` : '/app/boxes'} aria-current={onBoxes ? 'page' : undefined}>
        <span className="art-icon art-icon-tab" aria-hidden>
          {FEATURE_ILLUSTRATIONS.boxes}
        </span>
        Boxes
      </Link>
    </nav>
  );
}
