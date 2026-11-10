import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMe } from '../lib/queries';
import { brand } from '../config/brand';
import { SiteFooter } from '../components/SiteFooter';
import { SiteNav } from '../components/SiteNav';
import { PageLoader } from '../components/ui/misc';
import GiftIdeas from './GiftIdeas';

/** Gift ideas for signed-out visitors; signed-in people get the in-app page. */
export default function PublicGifts() {
  const { data: me, isLoading } = useMe();
  const { search } = useLocation();

  useEffect(() => {
    const previous = document.title;
    document.title = `Gift ideas · ${brand.name}`;
    return () => {
      document.title = previous;
    };
  }, []);

  if (isLoading) return <PageLoader />;
  if (me) return <Navigate to={`/app/gifts${search}`} replace />;

  return (
    <div className="public-shell">
      <div className="landing-top">
        <SiteNav current="gifts" next={`/app/gifts${search}`} />
      </div>
      <main id="main">
        <GiftIdeas banner />
      </main>
      <SiteFooter />
    </div>
  );
}
