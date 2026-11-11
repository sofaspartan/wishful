import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Users, X } from 'lucide-react';
import type { ListKind } from '../../shared/types';
import { useSharedWishlists } from '../lib/queries';
import { countdownLabel, relativeTime } from '../lib/format';
import { forgetVisit, listVisits } from '../lib/visited';
import { WishlistCard, WishlistCardSkeleton } from './WishlistCard';
import type { CardListView } from './ViewToggle';
import { Button } from './ui/Button';
import { EmptyState } from './ui/misc';
import { SkyArt } from './SkyArt';

/** Collaborating lists + share links opened on this device, for the Lists → Shared tab. */
export function SharedListsPanel({ kind, view = 'grid' }: { kind?: ListKind; view?: CardListView }) {
  const { data: lists = [], isLoading } = useSharedWishlists();
  const [visits, setVisits] = useState(listVisits);
  const active = lists.filter((w) => !w.archivedAt && (!kind || w.kind === kind));

  return (
    <>
      <section>
        <div className="section-header">
          <span className="tile-header-icon" aria-hidden>
            <Users size={14} />
          </span>
          <h2 className="section-title">Collaborating</h2>
        </div>
        {isLoading ? (
          <div className={view === 'grid' ? 'grid-lists' : 'list-items'}>
            <WishlistCardSkeleton />
            <WishlistCardSkeleton />
          </div>
        ) : active.length ? (
          <div className={view === 'grid' ? 'grid-lists' : 'list-items'}>
            {active.map((w) => (
              <WishlistCard key={w.id} wishlist={w} view={view} showOwner />
            ))}
          </div>
        ) : (
          <EmptyState art={<SkyArt scene="invites" />} title="No shared lists yet">
            When someone adds you as a viewer or editor
            {kind === 'collection' ? ' on a collection' : kind === 'wishlist' ? ' on a wishlist' : ''}, it will show up here. They can invite you by
            username or email.
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
    </>
  );
}
