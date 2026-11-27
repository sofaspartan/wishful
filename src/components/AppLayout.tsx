import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Search } from 'lucide-react';
import { useFriends, useMe } from '../lib/queries';
import { post } from '../lib/api';
import { CLASSIC_DASHBOARD_TINTS, dashboardLookIsDark, useDashboardLook } from '../lib/dashboardScene';
import { useLayoutMode, useStandaloneDisplayAttr } from '../lib/layoutMode';
import { Logo } from './Logo';
import { Cloud, CloudBank } from './Cloud';
import { CoverArt, COVER_ICON_ART } from './CoverArt';
import { FEATURE_ILLUSTRATIONS } from './ItemIllustrations';
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
  { to: '/app', label: 'Home', art: COVER_ICON_ART.house, end: true },
  { to: '/app/lists', label: 'My Lists', art: FEATURE_ILLUSTRATIONS.lists },
  { to: '/app/items', label: 'Items', art: FEATURE_ILLUSTRATIONS.store },
  { to: '/app/favorites', label: 'Favorites', art: COVER_ICON_ART.star },
  { to: '/app/friends', label: 'Friends', art: FEATURE_ILLUSTRATIONS.together },
  { to: '/app/gifts', label: 'Gift ideas', art: FEATURE_ILLUSTRATIONS.surprise },
];

/** Mobile bottom bar trailing slots: Ideas · Friends (Home + Browse + Add are fixed). */
const BOTTOM_NAV = [
  { to: '/app/gifts', label: 'Ideas', art: FEATURE_ILLUSTRATIONS.surprise },
  { to: '/app/friends', label: 'Friends', art: FEATURE_ILLUSTRATIONS.together },
];

const BROWSE_PATHS = ['/app/items', '/app/lists', '/app/boxes', '/app/favorites'];

function tabArt(art: ReactNode) {
  return (
    <span className="art-icon art-icon-tab" aria-hidden>
      {art}
    </span>
  );
}

function BrowseMenu({ active, onNavigate }: { active: boolean; onNavigate: (to: string) => void }) {
  return (
    <Menu
      label="Browse"
      align="center"
      className="bottom-browse-menu"
      buttonClassName={`bottom-link${active ? ' active' : ''}`}
      buttonContent={
        <>
          <span className="bottom-icon">{tabArt(FEATURE_ILLUSTRATIONS.lists)}</span>
          Browse
        </>
      }
    >
      <MenuItem icon={tabArt(COVER_ICON_ART.star)} onSelect={() => onNavigate('/app/favorites')}>
        Favorites
      </MenuItem>
      <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.lists)} onSelect={() => onNavigate('/app/lists?kind=wishlist')}>
        Wishlists
      </MenuItem>
      <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.tasks)} onSelect={() => onNavigate('/app/lists?kind=lists')}>
        Lists
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.collection)} onSelect={() => onNavigate('/app/lists?kind=collection')}>
        Collections
      </MenuItem>
      <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.store)} onSelect={() => onNavigate('/app/items')}>
        Items
      </MenuItem>
      <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.boxes)} onSelect={() => onNavigate('/app/boxes')}>
        Boxes
      </MenuItem>
    </Menu>
  );
}

export function AppLayout() {
  const { data: user } = useMe();
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

  const userMenuItems = (
    <>
      <MenuItem icon={tabArt(COVER_ICON_ART.pencil)} onSelect={() => navigate('/app/settings')}>
        Profile & settings
      </MenuItem>
      <MenuSeparator />
      {user.profileVisibility !== 'private' && (
        <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.together)} onSelect={() => navigate(`/u/${user.username}`)}>
          View profile
        </MenuItem>
      )}
      <MenuItem icon={tabArt(COVER_ICON_ART.house)} onSelect={() => navigate('/')}>
        Home
      </MenuItem>
      <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.idea)} onSelect={() => navigate('/knowledge')}>
        Knowledge base
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={<LogOut size={16} />} onSelect={logout}>
        Log out
      </MenuItem>
    </>
  );

  /* Soft classics share card/sidebar chrome tinting; sky-family scenes keep their own washes. */
  const soft = dashboardLook.mode === 'classic';
  const softTints = soft ? CLASSIC_DASHBOARD_TINTS[dashboardLook.scene] : null;
  const shellStyle: CSSProperties | undefined =
    soft && softTints
      ? {
          ['--page-tint' as string]: softTints.tint,
          ['--page-tint-2' as string]: softTints.tint2,
        }
      : undefined;

  return (
    <AppActionsContext.Provider value={actions}>
      <div
        className={[
          'app-shell',
          'dashboard-themed',
          soft && 'dashboard-soft',
          dashboardLook.mode === 'scene' && `page-bg-${dashboardLook.backdrop}`,
          !soft && dashboardLookIsDark(dashboardLook) && 'dashboard-themed-dark',
        ]
          .filter(Boolean)
          .join(' ')}
        data-layout-mode={layoutMode}
        data-dashboard-scene={soft ? dashboardLook.scene : undefined}
        style={shellStyle}
      >
        {/* Opaque paint under the iOS status bar (same idea as Add Item’s fullscreen modal). */}
        <div className="ios-status-bleed" aria-hidden />
        <aside className="sidebar" aria-label="Sidebar">
          <div className="sidebar-drift" aria-hidden>
            <Cloud className="sidebar-sil sidebar-sil-a" />
            <Cloud className="sidebar-sil sidebar-sil-b" />
            <Cloud className="sidebar-cloud sidebar-cloud-1" />
            <Cloud className="sidebar-cloud sidebar-cloud-2" />
            <Cloud className="sidebar-cloud sidebar-cloud-3" />
            {/* Phase twins keep coverage without stacking on the same beat. */}
            <Cloud className="sidebar-cloud sidebar-cloud-1 sidebar-phase-b" />
            <Cloud className="sidebar-sil sidebar-sil-b sidebar-phase-b" />
          </div>
          <div className="sidebar-main">
            <div className="sidebar-brand">
              <Logo to="/app" size={56} />
            </div>
            <nav className="sidebar-nav" aria-label="Main">
              {SIDEBAR_NAV.map(({ to, label, art, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `nav-link${isActive || (to === '/app/lists' && pathname.startsWith('/app/boxes')) ? ' active' : ''}`
                  }
                >
                  {tabArt(art)}
                  {label}
                  {badgeFor(to)}
                </NavLink>
              ))}
            </nav>
          </div>
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
              <Logo to="/app" size={42} variant="mark" />
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
              <Menu
                label="Menu"
                buttonClassName="btn btn-ghost btn-icon topbar-art-btn"
                buttonContent={
                  <span className="art-icon art-icon-tab topbar-menu-icon" aria-hidden>
                    {FEATURE_ILLUSTRATIONS.menu}
                  </span>
                }
              >
                <MenuItem icon={tabArt(COVER_ICON_ART.sparkles)} onSelect={() => setSearchOpen(true)}>
                  Search
                </MenuItem>
                <MenuItem icon={tabArt(FEATURE_ILLUSTRATIONS.surprise)} onSelect={() => navigate('/app/gifts')}>
                  Gift ideas
                </MenuItem>
                <MenuItem
                  icon={tabArt(layoutMode === 'mobile' ? FEATURE_ILLUSTRATIONS.lists : FEATURE_ILLUSTRATIONS.phone)}
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
            <span className="bottom-icon">{tabArt(COVER_ICON_ART.house)}</span>
            Home
          </NavLink>
          <BrowseMenu active={BROWSE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))} onNavigate={navigate} />
          <CreateMenu variant="fab" />
          {BOTTOM_NAV.map(({ to, label, art }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `bottom-link${isActive ? ' active' : ''}`}>
              <span className="bottom-icon">
                {tabArt(art)}
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
