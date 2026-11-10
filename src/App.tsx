import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useMe } from './lib/queries';
import { rememberDeviceAccount } from './lib/deviceAccounts';
import { ErrorBoundary, PageLoader } from './components/ui/misc';
import { AppLayout } from './components/AppLayout';
import { RecoveryCodeDialog } from './components/RecoveryCodeDialog';
import { brand } from './config/brand';

const Landing = lazy(() => import('./pages/Landing'));
const AuthPages = lazy(() => import('./pages/AuthPages'));
const Home = lazy(() => import('./pages/Home'));
const Wishlists = lazy(() => import('./pages/Wishlists'));
const WishlistDetailPage = lazy(() => import('./pages/WishlistDetail'));
const SavedItems = lazy(() => import('./pages/SavedItems'));
const SharedWithMe = lazy(() => import('./pages/SharedWithMe'));
const Friends = lazy(() => import('./pages/Friends'));
const FriendProfile = lazy(() => import('./pages/FriendProfile'));
const Settings = lazy(() => import('./pages/Settings'));
const PublicWishlist = lazy(() => import('./pages/PublicWishlist'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Privacy = lazy(() => import('./pages/Privacy'));
const ExtensionConnect = lazy(() => import('./pages/ExtensionConnect'));
const ExtensionPage = lazy(() => import('./pages/ExtensionPage'));

/** Redirects to /login (remembering the destination) when signed out. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useMe();
  const location = useLocation();
  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useMe();
  const location = useLocation();
  if (isLoading) return <PageLoader />;
  if (user) {
    const next = new URLSearchParams(location.search).get('next');
    return <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : '/app'} replace />;
  }
  return <>{children}</>;
}

function RememberDeviceAccount() {
  const { data: user } = useMe();
  useEffect(() => {
    if (user) rememberDeviceAccount(user.id);
  }, [user]);
  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  const location = useLocation();
  useEffect(() => {
    document.title = `${brand.name} — ${brand.tagline.replace(/\.$/, '')}`;
  }, []);
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ScrollToTop />
      <RememberDeviceAccount />
      <RecoveryCodeDialog />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<GuestOnly><AuthPages mode="login" /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><AuthPages mode="register" /></GuestOnly>} />
          <Route path="/forgot-password" element={<AuthPages mode="forgot" />} />
          <Route path="/reset-password" element={<AuthPages mode="reset" />} />
          <Route path="/s/:token" element={<PublicWishlist />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/extension" element={<ExtensionPage />} />
          <Route
            path="/extension/connect"
            element={
              <RequireAuth>
                <ExtensionConnect />
              </RequireAuth>
            }
          />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Home />} />
            <Route path="lists" element={<Wishlists />} />
            <Route path="lists/:id" element={<WishlistDetailPage />} />
            <Route path="items" element={<SavedItems />} />
            <Route path="shared" element={<SharedWithMe />} />
            <Route path="friends" element={<Friends />} />
            <Route path="friends/:id" element={<FriendProfile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
