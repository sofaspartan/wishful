import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Gift, MoreHorizontal, StickyNote, UserMinus, UserX } from 'lucide-react';
import { LIMITS } from '../../shared/constants';
import type { FriendProfileView, FriendsOverview } from '../../shared/types';
import { keys, useFriendProfile } from '../lib/queries';
import { del, errorMessage, fieldErrors, patch } from '../lib/api';
import { countdownLabel, formatDate } from '../lib/format';
import { ListForLine, WishlistCover, WishlistListThumb } from '../components/WishlistCard';
import { CollectionBadge, VisibilityBadge } from '../components/ItemVisuals';
import { CARD_LIST_VIEWS, ViewToggle, type CardListView } from '../components/ViewToggle';
import { useLocalPref } from '../lib/prefs';
import { Avatar, EmptyState, PageLoader, useConfirm } from '../components/ui/misc';
import { FavoriteMenuItem } from '../components/FavoriteToggle';
import { Menu, MenuItem } from '../components/ui/Menu';
import { Field, FormError } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

export default function FriendProfile() {
  const { id } = useParams();
  const { data, isLoading, error } = useFriendProfile(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [listsView, setListsView] = useLocalPref<CardListView>('friends.profileListsView', 'grid', CARD_LIST_VIEWS);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setNote(data?.note ?? '');
    setNoteError(null);
  }, [data?.note, data?.user.id]);

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

  const saveNote = async () => {
    if (!data) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      const next = await patch<FriendProfileView>(`/api/friends/${data.user.id}/note`, { note });
      qc.setQueryData(keys.friend(data.user.id), next);
      qc.invalidateQueries({ queryKey: keys.friends });
      if (next.circlePersonId) qc.invalidateQueries({ queryKey: keys.circle });
      toast.success('Private note saved');
    } catch (err) {
      const fields = fieldErrors(err);
      setNoteError(fields.note ?? errorMessage(err));
    } finally {
      setSavingNote(false);
    }
  };

  const noteDirty = (data?.note ?? '') !== note;

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
              <FavoriteMenuItem targetType="user" targetId={data.user.id} name={data.user.displayName} />
              <MenuItem icon={<UserMinus size={16} />} onSelect={unfriend} danger>
                Remove friend
              </MenuItem>
            </Menu>
          </div>

          <section className="section" aria-label="Private note">
            <div className="section-header">
              <span className="tile-header-icon" aria-hidden>
                <StickyNote size={14} />
              </span>
              <h2 className="section-title">Private note</h2>
            </div>
            <div className="stack" style={{ maxWidth: 560, gap: 'var(--s-3)' }}>
              <FormError message={noteError} />
              <Field
                label="Reminders about them"
                optional
                hint={
                  data.circlePersonId
                    ? `Synced with My Circle — only you see this. (${note.length}/${LIMITS.circleNote})`
                    : `Only you see this — ring size, allergies, brands… (${note.length}/${LIMITS.circleNote})`
                }
              >
                <textarea
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={LIMITS.circleNote}
                  rows={3}
                  placeholder="Ring size 6 · allergic to nuts · loves hiking"
                />
              </Field>
              <div className="row" style={{ gap: 8 }}>
                <Button variant="primary" size="sm" loading={savingNote} disabled={!noteDirty} onClick={() => void saveNote()}>
                  Save note
                </Button>
                {noteDirty && (
                  <Button size="sm" variant="ghost" disabled={savingNote} onClick={() => setNote(data.note)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Lists</h2>
              {data.wishlists.length > 0 && <ViewToggle value={listsView} onChange={setListsView} />}
            </div>
            {data.wishlists.length ? (
              <div className={listsView === 'grid' ? 'grid-lists' : 'list-items'}>
                {data.wishlists.map((w) =>
                  listsView === 'list' ? (
                    <article key={w.id} className="item-row wl-row" aria-label={w.title}>
                      <Link to={`/s/${w.shareToken}`} className="item-card-hit" aria-label={`Open ${w.title}`} />
                      <WishlistListThumb title={w.title} coverImage={w.coverImage} coverArt={w.coverArt} accentColor={w.accentColor} />
                      <div className="item-row-main">
                        <strong className="truncate">{w.title}</strong>
                        <span className="row text-sm muted" style={{ gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
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
                        </span>
                      </div>
                    </article>
                  ) : (
                    <article key={w.id} className="wl-card">
                      <Link to={`/s/${w.shareToken}`} className="wl-card-link" aria-label={`Open ${w.title}`} />
                      <WishlistCover title={w.title} coverImage={w.coverImage} coverArt={w.coverArt} accentColor={w.accentColor} />
                      <div className="wl-body">
                        <h3 className="wl-title truncate">{w.title}</h3>
                        {w.recipients.length > 0 && <ListForLine people={w.recipients} maker={w.madeBy} />}
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
                  ),
                )}
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
