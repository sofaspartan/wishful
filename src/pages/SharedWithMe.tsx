import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Users, X } from 'lucide-react';
import { useSharedWishlists } from '../lib/queries';
import { countdownLabel, relativeTime } from '../lib/format';
import { forgetVisit, listVisits } from '../lib/visited';
import { WishlistCard, WishlistCardSkeleton } from '../components/WishlistCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';
import { PageSky } from '../components/PageSky';
import { SkyArt } from '../components/SkyArt';

export default function SharedWithMe() {
  const { data: lists = [], isLoading } = useSharedWishlists();
  const [visits, setVisits] = useState(listVisits);
  const active = lists.filter((w) => !w.archivedAt);

  return (
    <div className="page">
      <PageSky
        eyebrow="Shared with me"
        title="Lists you're part of"
        subtitle="Wishlists friends and family have invited you to, plus share links you've opened."
        art={<SkyArt scene="shared" />}
      >
        {!isLoading && (active.length > 0 || visits.length > 0) && (
          <div className="sky-stats">
            {active.length > 0 && (
              <span className="sky-stat">
                <strong>{active.length}</strong> collaborating
              </span>
            )}
            {visits.length > 0 && (
              <span className="sky-stat">
                <strong>{visits.length}</strong> opened here
              </span>
            )}
          </div>
        )}
      </PageSky>

      <section>
        <div className="section-header">
          <span className="tile-header-icon" aria-hidden>
            <Users size={14} />
          </span>
          <h2 className="section-title">Collaborating</h2>
        </div>
        {isLoading ? (
          <div className="grid-lists">
            <WishlistCardSkeleton />
            <WishlistCardSkeleton />
          </div>
        ) : active.length ? (
          <div className="grid-lists">
            {active.map((w) => (
              <WishlistCard key={w.id} wishlist={w} showOwner />
            ))}
          </div>
        ) : (
          <EmptyState art={<SkyArt scene="invites" />} title="No shared wishlists yet">
            When someone adds you as a viewer or editor on their wishlist, it will show up here. They can invite you by your username or email address.
          </EmptyState>
        )}
      </section>

      {visits.length > 0 && (
        <section className="section">
          <div className="section-header">
            <span className="tile-header-icon" aria-hidden>
              <Link2 size={14} />
            </span>
            <h2 className="section-title">Opened on this device</h2>
          </div>
          <div className="list-items">
            {visits.map((v) => (
              <div key={v.token} className="item-row">
                <Link to={`/s/${v.token}`} className="item-card-hit" aria-label={`Open ${v.title}`} />
                <div className="item-row-thumb" style={{ background: v.accentColor, border: 0, width: 44, height: 44 }} aria-hidden />
                <div className="item-row-main">
                  <strong className="truncate">{v.title}</strong>
                  <span className="text-sm muted truncate">
                    {v.ownerName}
                    {v.eventDate ? ` · ${countdownLabel(v.eventDate)}` : ''} · opened {relativeTime(v.visitedAt)}
                  </span>
                </div>
                <div className="item-row-side">
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={<X size={16} />}
                    aria-label={`Forget ${v.title}`}
                    onClick={() => {
                      forgetVisit(v.token);
                      setVisits(listVisits());
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <div style={{ height: 'var(--s-12)' }} />
    </div>
  );
}
