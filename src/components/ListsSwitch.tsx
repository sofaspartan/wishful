import { NavLink } from 'react-router-dom';
import { List, Package } from 'lucide-react';

/** Lists and boxes share the "Lists" tab; this switches between the two pages. */
export function ListsSwitch() {
  return (
    <nav className="segmented lists-switch" aria-label="Lists or boxes">
      <NavLink to="/app/lists" end>
        <List size={15} aria-hidden /> Lists
      </NavLink>
      <NavLink to="/app/boxes" end>
        <Package size={15} aria-hidden /> Boxes
      </NavLink>
    </nav>
  );
}
