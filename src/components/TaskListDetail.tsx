import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ArrowLeft, Copy, MoreHorizontal, Pencil, Share2, Trash2, Users } from 'lucide-react';
import type { ListTask, WishlistDetail as Detail } from '../../shared/types';
import { LIST_KIND_LABELS, isTaskList } from '../../shared/constants';
import { keys, useInvalidate } from '../lib/queries';
import { VisibilityBadge } from './ItemVisuals';
import { CoverAvatar, suggestCoverArt } from './CoverArt';
import { ThemedPage } from './PageTheme';
import { WishlistFormModal } from './WishlistFormModal';
import { CollaboratorsDialog, ShareDialog } from './WishlistDialogs';
import { useWishlistActions } from './WishlistMenu';
import { TaskListPanel } from './TaskListPanel';
import { FavoriteMenuItem } from './FavoriteToggle';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';
import { Button } from './ui/Button';

/** Detail chrome for standard / checklist / todo lists. */
export function TaskListDetail({ detail }: { detail: Detail }) {
  const w = detail.wishlist;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const listActions = useWishlistActions();
  const [params, setParams] = useSearchParams();
  const isOwner = detail.role === 'owner';
  const canEdit = detail.role !== 'viewer';
  const [editingList, setEditingList] = useState(params.get('edit') === '1');
  const [sharing, setSharing] = useState(params.get('share') === '1');
  const [collaborators, setCollaborators] = useState(false);
  const [tasks, setTasks] = useState<ListTask[]>(w.tasks ?? []);

  useEffect(() => {
    setTasks(w.tasks ?? []);
  }, [w.tasks, w.updatedAt]);

  useEffect(() => {
    if (params.has('edit') || params.has('share')) {
      const next = new URLSearchParams(params);
      next.delete('edit');
      next.delete('share');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  if (!isTaskList(w)) return null;

  const noun = LIST_KIND_LABELS[w.kind].toLowerCase();
  const art = w.coverArt ?? (w.coverImage ? null : suggestCoverArt('', w.kind));

  const setTasksAndCache = (next: ListTask[]) => {
    setTasks(next);
    qc.setQueryData<Detail>(keys.wishlist(w.id), (prev) =>
      prev ? { ...prev, wishlist: { ...prev.wishlist, tasks: next } } : prev,
    );
  };

  return (
    <ThemedPage
      className="page page-list-detail"
      pageBackdrop={w.pageBackdrop}
      pageColors={w.pageColors}
      coverArt={w.coverArt}
      accentColor={w.accentColor}
    >
      <div className="toolbar">
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => navigate('/app/lists?kind=lists')}>
          Lists
        </Button>
        <div className="spacer" />
        {isOwner && (
          <Button size="sm" icon={<Share2 size={15} />} onClick={() => setSharing(true)}>
            Share
          </Button>
        )}
        {isOwner && (
          <Button size="sm" icon={<Users size={15} />} onClick={() => setCollaborators(true)}>
            People
          </Button>
        )}
        <Menu
          label="List actions"
          align="right"
          buttonClassName="btn btn-sm btn-ghost btn-icon"
          buttonContent={<MoreHorizontal size={18} aria-hidden />}
        >
          {isOwner && (
            <MenuItem icon={<Pencil size={16} />} onSelect={() => setEditingList(true)}>
              Edit {noun}
            </MenuItem>
          )}
          <FavoriteMenuItem targetType="wishlist" targetId={w.id} name={w.title} />
          {isOwner && (
            <>
              <MenuItem icon={<Copy size={16} />} onSelect={() => void listActions.duplicate(w)}>
                Duplicate
              </MenuItem>
              {w.archivedAt ? (
                <MenuItem icon={<ArchiveRestore size={16} />} onSelect={() => void listActions.setArchived(w, false)}>
                  Restore
                </MenuItem>
              ) : (
                <MenuItem icon={<Archive size={16} />} onSelect={() => void listActions.setArchived(w, true)}>
                  Archive
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem
                icon={<Trash2 size={16} />}
                danger
                onSelect={() => void listActions.remove(w, () => navigate('/app/lists?kind=lists', { replace: true }))}
              >
                Delete
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      <header className="wl-hero">
        <div className="wl-hero-body">
          <CoverAvatar
            className="wl-hero-avatar"
            icon={(art ?? suggestCoverArt('', w.kind)).icon}
            frame={art?.frame}
            photo={w.coverImage}
          />
          <div className="wl-hero-main">
            <p className="eyebrow">{LIST_KIND_LABELS[w.kind]}</p>
            <h1 className="wl-hero-title display">{w.title}</h1>
            {w.description && <p className="page-subtitle">{w.description}</p>}
            <div className="row-wrap" style={{ gap: 8, marginTop: 8 }}>
              <VisibilityBadge visibility={w.visibility} />
              <span className="muted text-sm">
                {tasks.length} {tasks.length === 1 ? 'row' : 'rows'}
                {detail.role === 'editor' ? ' · You can edit' : ''}
              </span>
            </div>
          </div>
        </div>
      </header>

      <TaskListPanel
        wishlistId={w.id}
        kind={w.kind}
        tasks={tasks}
        canEdit={canEdit}
        onChange={(next) => {
          setTasksAndCache(next);
          invalidate([w.id]);
        }}
      />

      {editingList && (
        <WishlistFormModal
          open
          wishlist={w}
          onClose={() => setEditingList(false)}
          onSaved={() => {
            setEditingList(false);
            invalidate([w.id]);
          }}
        />
      )}
      {sharing && <ShareDialog open={sharing} onClose={() => setSharing(false)} wishlist={w} whose="Your" />}
      {collaborators && <CollaboratorsDialog open={collaborators} onClose={() => setCollaborators(false)} detail={detail} />}
      <Link to="/app/lists?kind=lists" className="sr-only">
        Back to lists
      </Link>
    </ThemedPage>
  );
}
