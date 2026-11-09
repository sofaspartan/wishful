import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Gift, MoreHorizontal, UserMinus, UserX } from 'lucide-react';
import type { FriendsOverview } from '../../shared/types';
import { keys, useFriendProfile } from '../lib/queries';
import { del, errorMessage } from '../lib/api';
import { countdownLabel, formatDate } from '../lib/format';
import { WishlistCover } from '../components/WishlistCard';
import { CollectionBadge, VisibilityBadge } from '../components/ItemVisuals';
import { Avatar, EmptyState, PageLoader, useConfirm } from '../components/ui/misc';
import { Menu, MenuItem } from '../components/ui/Menu';
import { useToast } from '../components/ui/Toast';

export default function FriendProfile() {
  const { id } = useParams();
  const { data, isLoading, error } = useFriendProfile(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const unfriend = async () => {
    if (!data) return;
    const first = data.user.displayName.split(' ')[0];
    const ok = await confirm({
      title: `Remove ${first} as a friend?`,
      message: `You'll stop seeing each other's friends-only lists. Gifts you've already reserved stay reserved.`,
      confirmLabel: 'Remove friend',
      danger: true,
    });
    if (!ok) return;
    try {
      qc.setQueryData(keys.friends, await del<FriendsOverview>(`/api/friends/${data.user.id}`));
      qc.removeQueries({ queryKey: keys.friend(data.user.id) });
      toast.success(`Removed ${first} from your friends`);
      navigate('/app/friends', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="page">
      <Link to="/app/friends" className="section-link" style={{ marginLeft: 0, marginBottom: 'var(--s-3)' }}>
        <ArrowLeft size={14} /> Friends
      </Link>
      {isLoading ? (
        <PageLoader />
      ) : error || !data ? (
        <EmptyState icon={<UserX size={22} />} title="Not available">
          You can only see the wishlists of people you're friends with.
        </EmptyState>
      ) : (
        <>
          <div className="friend-header">
            <Avatar name={data.user.displayName} src={data.user.avatarUrl} size={72} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 className="page-title display truncate">{data.user.displayName}</h1>
              <p className="muted text-sm">
                @{data.user.username} · Friends since {formatDate(data.since)}
              </p>
              {data.user.bio && (
                <p className="muted" style={{ marginTop: 'var(--s-2)', maxWidth: 560, whiteSpace: 'pre-line' }}>
                  {data.user.bio}
                </p>
              )}
            </div>
            <Menu label={`Options for ${data.user.displayName}`} icon={<MoreHorizontal size={18} />} buttonClassName="btn btn-icon">
              <MenuItem icon={<UserMinus size={16} />} onSelect={unfriend} danger>
                Remove friend
              </MenuItem>
            </Menu>
          </div>

          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Lists</h2>
            </div>
            {data.wishlists.length ? (
              <div className="grid-lists">
                {data.wishlists.map((w) => (
                  <article key={w.id} className="wl-card">
                    <Link to={`/s/${w.shareToken}`} className="wl-card-link" aria-label={`Open ${w.title}`} />
                    <WishlistCover title={w.title} coverImage={w.coverImage} coverArt={w.coverArt} accentColor={w.accentColor} />
                    <div className="wl-body">
                      <h3 className="wl-title truncate">{w.title}</h3>
                      {w.description && <p className="wl-desc clamp-2">{w.description}</p>}
                      <div className="wl-meta">
                        <VisibilityBadge visibility={w.visibility} outline />
                        {w.kind === 'collection' && <CollectionBadge outline />}
                        <span>
                          <Gift size={13} aria-hidden /> {w.itemCount} item{w.itemCount === 1 ? '' : 's'}
                        </span>
                        {w.eventDate && (
                          <span>
                            <CalendarDays size={13} aria-hidden /> {w.occasion ? `${w.occasion} · ` : ''}
                            {countdownLabel(w.eventDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Gift size={22} />} title="Nothing shared yet">
                {data.user.displayName.split(' ')[0]} hasn't shared any lists with friends yet.
              </EmptyState>
            )}
          </section>
        </>
      )}
      <div style={{ height: 'var(--s-12)' }} />
    </div>
  );
}
