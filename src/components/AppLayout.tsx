import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, Boxes, Gift, House, LayoutTemplate, Library, List, LogOut, Menu as MenuIcon, Package, Search, Settings, Smartphone, Star, User, UserRoundPlus } from 'lucide-react';
import { coverPaint } from '../../shared/types';
import { useFriends, useMe, useWishlists } from '../lib/queries';
import { post } from '../lib/api';
import { CLASSIC_DASHBOARD_TINTS, dashboardLookIsDark, useDashboardLook } from '../lib/dashboardScene';
import { useLayoutMode, useStandaloneDisplayAttr } from '../lib/layoutMode';
import { Logo } from './Logo';
import { CloudBank } from './Cloud';
import { CoverArt } from './CoverArt';
import { Avatar } from './ui/misc';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';
import { AppActionsContext, type AddItemOptions, type AppActions, type CreateListOptions } from './appActions';
import { AddItemModal } from './AddItemModal';
import { BoxFormModal } from './BoxFormModal';
import { CreateMenu } from './CreateMenu';
import { WishlistFormModal } from './WishlistFormModal';
import { SearchPalette } from './SearchPalette';
import { NotificationsButton } from './NotificationsButton';
import { DashboardScenePicker } from './DashboardScenePicker';
import { InstallTip } from './InstallTip';

/** Desktop sidebar — includes Lists (boxes live under lists). */
const SIDEBAR_NAV = [
  { to: '/app', label: 'Home', icon: House, end: true },
  { to: '/app/lists', label: 'My Lists', icon: List },
  { to: '/app/items', label: 'Items', icon: Package },
  { to: '/app/favorites', label: 'Favorites', icon: Star },
  { to: '/app/friends', label: 'Friends', icon: UserRoundPlus },
];

/** Mobile bottom bar trailing slots: Ideas · Friends (Home + Browse + Add are fixed). */
const BOTTOM_NAV = [
  { to: '/app/gifts', label: 'Ideas', icon: Gift },
  { to: '/app/friends', label: 'Friends', icon: UserRoundPlus },
];

const BROWSE_PATHS = ['/app/items', '/app/lists', '/app/boxes', '/app/favorites'];

function BrowseMenu({ active, onNavigate }: { active: boolean; onNavigate: (to: string) => void }) {
  return (
    <Menu
      label="Browse"
      align="center"
      className="bottom-browse-menu"
      buttonClassName={`bottom-link${active ? ' active' : ''}`}
      buttonContent={
        <>
          <List size={21} aria-hidden />
          Browse
        </>
      }
    >
      <MenuItem icon={<Star size={16} />} onSelect={() => onNavigate('/app/favorites')}>
        Favorites
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={<Package size={16} />} onSelect={() => onNavigate('/app/items')}>
        Items
      </MenuItem>
      <MenuItem icon={<List size={16} />} onSelect={() => onNavigate('/app/lists?kind=wishlist')}>
        Wishlists
      </MenuItem>
      <MenuItem icon={<Library size={16} />} onSelect={() => onNavigate('/app/lists?kind=collection')}>
        Collections
      </MenuItem>
      <MenuItem icon={<Boxes size={16} />} onSelect={() => onNavigate('/app/boxes')}>
        Boxes
      </MenuItem>
    </Menu>
  );
}

export function AppLayout() {
  const { data: user } = useMe();
  const { data: wishlists } = useWishlists();
  const { data: friends } = useFriends();
  const [dashboardLook] = useDashboardLook();
  const [layoutMode, setLayoutMode] = useLayoutMode();
  useStandaloneDisplayAttr();
  const requestCount = friends?.incoming.length ?? 0;
  const badgeFor = (to: string) =>
    to === '/app/friends' && requestCount > 0 ? (
      <span className="nav-badge" aria-label={`${requestCount} friend request${requestCount === 1 ? '' : 's'}`}>
        {requestCount}
      </span>
    ) : null;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const [addItem, setAddItem] = useState<AddItemOptions | null>(null);
  const [createList, setCreateList] = useState<CreateListOptions | null>(null);
  const [createBox, setCreateBox] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const actions = useMemo<AppActions>(
    () => ({
      openAddItem: (opts) => setAddItem(opts ?? {}),
      openCreateWishlist: (opts) => setCreateList(opts ?? {}),
      openCreateBox: () => setCreateBox(true),
      openSearch: () => setSearchOpen(true),
    }),
    [],
  );

  const logout = useCallback(async () => {
    await post('/api/auth/logout').catch(() => undefined);
    qc.clear();
    navigate('/', { replace: true });
  }, [qc, navigate]);

  if (!user) return null;
  const recentLists = (wishlists ?? []).filter((w) => !w.archivedAt).slice(0, 8);

  const userMenuItems = (
    <>
      <MenuItem icon={<Settings size={16} />} onSelect={() => navigate('/app/settings')}>
        Profile & settings
      </MenuItem>
      <MenuSeparator />
      {user.profileVisibility !== 'private' && (
        <MenuItem icon={<User size={16} />} onSelect={() => navigate(`/u/${user.username}`)}>
          View profile
        </MenuItem>
      )}
      <MenuItem icon={<House size={16} />} onSelect={() => navigate('/')}>
        Home
      </MenuItem>
      <MenuItem icon={<BookOpen size={16} />} onSelect={() => navigate('/knowledge')}>
        Knowledge base
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={<LogOut size={16} />} onSelect={logout}>
        Log out
      </MenuItem>
    </>
  );

  /* Soft classics share card/sidebar chrome tinting; scenes & paints keep their own washes. */
  const themed = true;
  const soft = dashboardLook.mode === 'classic';
  const paint = dashboardLook.mode === 'solid' || dashboardLook.mode === 'gradient';
  const softTints = soft ? CLASSIC_DASHBOARD_TINTS[dashboardLook.scene] : null;
  const shellStyle: CSSProperties | undefined =
    soft && softTints
      ? {
          ['--page-tint' as string]: softTints.tint,
          ['--page-tint-2' as string]: softTints.tint2,
        }
      : dashboardLook.mode === 'solid'
        ? {
            ['--page-tint' as string]: dashboardLook.color,
            ['--page-tint-2' as string]: dashboardLook.color,
            ['--page-paint' as string]: dashboardLook.color,
          }
        : dashboardLook.mode === 'gradient'
          ? {
              ['--page-tint' as string]: dashboardLook.colors[0],
              ['--page-tint-2' as string]: dashboardLook.colors[1],
              ['--page-paint' as string]:
                coverPaint({ backdrop: 'gradient', colors: dashboardLook.colors }) ?? undefined,
            }
          : undefined;

  return (
    <AppActionsContext.Provider value={actions}>
      <div
        className={[
          'app-shell',
          themed && 'dashboard-themed',
          soft && 'dashboard-soft',
          paint && 'dashboard-themed-paint',
          dashboardLook.mode === 'scene' && `page-bg-${dashboardLook.backdrop}`,
          themed && !soft && dashboardLookIsDark(dashboardLook) && 'dashboard-themed-dark',
        ]
          .filter(Boolean)
          .join(' ')}
        data-layout-mode={layoutMode}
        data-dashboard-scene={soft ? dashboardLook.scene : undefined}
        style={shellStyle}
      >
        <aside className="sidebar" aria-label="Sidebar">
          <div className="sidebar-brand">
            <Logo to="/app" />
          </div>
          <CreateMenu variant="add" block align="left" />
          <nav className="sidebar-nav" aria-label="Main" style={{ marginTop: 12 }}>
            {SIDEBAR_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `nav-link${isActive || (to === '/app/lists' && pathname.startsWith('/app/boxes')) ? ' active' : ''}`
                }
              >
                <Icon size={18} aria-hidden />
                {label}
                {badgeFor(to)}
              </NavLink>
            ))}
            <NavLink to="/app/gifts" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Gift size={18} aria-hidden />
              Gift ideas
            </NavLink>
          </nav>
          {recentLists.length > 0 && (
            <div className="sidebar-section">
              <div className="section-label">Your lists</div>
              {recentLists.map((w) => (
                <NavLink key={w.id} to={`/app/lists/${w.id}`} className={({ isActive }) => `sidebar-list-link${isActive ? ' active' : ''}`}>
                  {w.coverArt && !w.coverImage ? (
                    <CoverArt art={w.coverArt} size="sm" className="sidebar-list-art" />
                  ) : (
                    <span className="swatch-dot" style={{ background: w.accentColor }} aria-hidden />
                  )}
                  <span className="truncate">{w.title}</span>
                  <span className="nav-count">{w.itemCount}</span>
                </NavLink>
              ))}
            </div>
          )}
          <div className="sidebar-footer">
            <Menu
              label="Account menu"
              buttonClassName="user-button"
              align="left"
              buttonContent={
                <>
                  <Avatar name={user.displayName} src={user.avatarUrl} size={34} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="truncate" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                      {user.displayName}
                    </span>
                    <span className="truncate muted" style={{ display: 'block', fontSize: 'var(--text-xs)' }}>
                      @{user.username}
                    </span>
                  </span>
                </>
              }
            >
              {userMenuItems}
            </Menu>
          </div>
          {dashboardLook.mode !== 'classic' && <CloudBank className="sidebar-bank" />}
        </aside>

        <div className="app-column">
          {dashboardLook.mode === 'scene' && (
            <div className="dashboard-theme-sky" aria-hidden>
              <CoverArt art={{ icon: 'gift', backdrop: dashboardLook.backdrop }} showIcon={false} />
            </div>
          )}
          <header className={`topbar${scrolled ? ' scrolled' : ''}`}>
            <div className="topbar-brand">
              <Logo to="/app" size={28} />
            </div>
            <button type="button" className="search-trigger" onClick={() => setSearchOpen(true)}>
              <Search size={16} aria-hidden />
              <span>Search wishlists and items…</span>
              <kbd>⌘K</kbd>
            </button>
            <div className="spacer" />
            <div className="hide-mobile row" style={{ gap: 'var(--s-1)' }}>
              <DashboardScenePicker />
              <NotificationsButton />
            </div>
            <div className="hide-desktop topbar-mobile-actions">
              <DashboardScenePicker />
              <NotificationsButton />
              <Menu label="Menu" buttonClassName="btn btn-ghost btn-icon" buttonContent={<MenuIcon size={20} aria-hidden />}>
                <MenuItem icon={<Search size={16} />} onSelect={() => setSearchOpen(true)}>
                  Search
                </MenuItem>
                <MenuItem icon={<Gift size={16} />} onSelect={() => navigate('/app/gifts')}>
                  Gift ideas
                </MenuItem>
                <MenuItem
                  icon={layoutMode === 'mobile' ? <LayoutTemplate size={16} /> : <Smartphone size={16} />}
                  onSelect={() => setLayoutMode(layoutMode === 'mobile' ? 'responsive' : 'mobile')}
                >
                  {layoutMode === 'mobile' ? 'Responsive layout' : 'Mobile app layout'}
                </MenuItem>
                <MenuSeparator />
                {userMenuItems}
              </Menu>
            </div>
          </header>
          <main id="main" className="app-main" tabIndex={-1}>
            <InstallTip />
            <Outlet />
          </main>
        </div>

        <nav className="bottom-nav" aria-label="Main">
          <NavLink to="/app" end className={({ isActive }) => `bottom-link${isActive ? ' active' : ''}`}>
            <House size={21} aria-hidden />
            Home
          </NavLink>
          <BrowseMenu active={BROWSE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))} onNavigate={navigate} />
          <CreateMenu variant="fab" />
          {BOTTOM_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `bottom-link${isActive ? ' active' : ''}`}>
              <span className="bottom-icon">
                <Icon size={21} aria-hidden />
                {badgeFor(to)}
              </span>
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <AddItemModal options={addItem} onClose={() => setAddItem(null)} onCreateWishlist={actions.openCreateWishlist} />
      <WishlistFormModal
        open={Boolean(createList)}
        kind={createList?.kind}
        onClose={() => setCreateList(null)}
        onSaved={(w) => {
          const cb = createList?.onCreated;
          setCreateList(null);
          if (cb) cb(w);
          else navigate(`/app/lists/${w.id}`);
        }}
      />
      <BoxFormModal
        open={createBox}
        onClose={() => setCreateBox(false)}
        onSaved={(box) => {
          setCreateBox(false);
          navigate(`/app/boxes/${box.id}`);
        }}
      />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </AppActionsContext.Provider>
  );
}
