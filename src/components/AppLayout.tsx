import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bookmark, Gift, House, List, LogOut, Menu as MenuIcon, Moon, Search, Settings, Sun, User, UserRoundPlus } from 'lucide-react';
import { useFriends, useMe, useWishlists } from '../lib/queries';
import { post } from '../lib/api';
import { setTheme, useTheme } from '../lib/theme';
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
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { to: '/app', label: 'Home', icon: House, end: true },
  { to: '/app/lists', label: 'My Lists', short: 'Lists', icon: List },
  { to: '/app/items', label: 'Saved Items', short: 'Saved', icon: Bookmark },
  { to: '/app/friends', label: 'Friends', icon: UserRoundPlus },
];

export function AppLayout() {
  const { data: user } = useMe();
  const { data: wishlists } = useWishlists();
  const { data: friends } = useFriends();
  const theme = useTheme();
  const dark = theme === 'dark';
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
      {user.profileVisibility !== 'private' && (
        <MenuItem icon={<User size={16} />} onSelect={() => navigate(`/u/${user.username}`)}>
          View profile
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem icon={<LogOut size={16} />} onSelect={logout}>
        Log out
      </MenuItem>
    </>
  );

  return (
    <AppActionsContext.Provider value={actions}>
      <div className="app-shell">
        <aside className="sidebar" aria-label="Sidebar">
          <div className="sidebar-brand">
            <Logo to="/app" />
          </div>
          <CreateMenu variant="add" block align="left" />
          <nav className="sidebar-nav" aria-label="Main" style={{ marginTop: 12 }}>
            {NAV.map(({ to, label, icon: Icon, end }) => (
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
          <CloudBank className="sidebar-bank" />
        </aside>

        <div style={{ minWidth: 0 }}>
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
              <NotificationsButton />
              <ThemeToggle />
            </div>
            <div className="hide-desktop topbar-mobile-actions">
              <NotificationsButton />
              <Menu label="Menu" buttonClassName="btn btn-ghost btn-icon" buttonContent={<MenuIcon size={20} aria-hidden />}>
                <MenuItem icon={<Search size={16} />} onSelect={() => setSearchOpen(true)}>
                  Search
                </MenuItem>
                <MenuItem icon={<Gift size={16} />} onSelect={() => navigate('/app/gifts')}>
                  Gift ideas
                </MenuItem>
                <MenuItem icon={dark ? <Sun size={16} /> : <Moon size={16} />} onSelect={() => setTheme(dark ? 'light' : 'dark')}>
                  {dark ? 'Light mode' : 'Dark mode'}
                </MenuItem>
                <MenuSeparator />
                {userMenuItems}
              </Menu>
            </div>
          </header>
          <main id="main" className="app-main" tabIndex={-1}>
            <Outlet />
          </main>
        </div>

        <nav className="bottom-nav" aria-label="Main">
          {NAV.slice(0, 2).map(({ to, short, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `bottom-link${isActive || (to === '/app/lists' && pathname.startsWith('/app/boxes')) ? ' active' : ''}`}
            >
              <Icon size={21} aria-hidden />
              {short ?? label}
            </NavLink>
          ))}
          <CreateMenu variant="fab" />
          {NAV.slice(2).map(({ to, short, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `bottom-link${isActive ? ' active' : ''}`}>
              <span className="bottom-icon">
                <Icon size={21} aria-hidden />
                {badgeFor(to)}
              </span>
              {short ?? label}
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
