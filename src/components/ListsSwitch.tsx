import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Library, List, Package } from 'lucide-react';

/** Wishlists, collections and boxes share the Lists tab; this switches among the three. */
export function ListsSwitch() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const onLists = pathname === '/app/lists';
  const onBoxes = pathname === '/app/boxes';
  const kind = params.get('kind') === 'collection' ? 'collection' : 'wishlist';
  const status = params.get('status');
  const statusQuery = status === 'archived' || status === 'shared' ? `&status=${status}` : '';

  return (
    <nav className="segmented lists-switch" aria-label="Wishlists, collections, or boxes">
      <Link to={`/app/lists?kind=wishlist${statusQuery}`} aria-current={onLists && kind === 'wishlist' ? 'page' : undefined}>
        <List size={15} aria-hidden /> Wishlists
      </Link>
      <Link to={`/app/lists?kind=collection${statusQuery}`} aria-current={onLists && kind === 'collection' ? 'page' : undefined}>
        <Library size={15} aria-hidden /> Collections
      </Link>
      <Link to="/app/boxes" aria-current={onBoxes ? 'page' : undefined}>
        <Package size={15} aria-hidden /> Boxes
      </Link>
    </nav>
  );
}
