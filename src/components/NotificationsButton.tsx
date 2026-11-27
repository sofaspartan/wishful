import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, Inbox, Pencil, Tag, UserCheck, UserPlus, Users } from 'lucide-react';
import type { AppNotification, NotificationType } from '../../shared/types';
import { keys, useMe, useNotifications } from '../lib/queries';
import { post } from '../lib/api';
import { relativeTime } from '../lib/format';
import { COVER_ICON_ART } from './CoverArt';
import { FEATURE_ILLUSTRATIONS } from './ItemIllustrations';
import { Modal } from './ui/Modal';

const ICONS: Record<NotificationType, typeof Bell> = {
  shared_with_you: Users,
  collaborator_edit: Pencil,
  occasion_upcoming: CalendarDays,
  price_drop: Tag,
  item_changed: Pencil,
  friend_request: UserPlus,
  friend_accepted: UserCheck,
};

export function useNotificationUnreadCount() {
  const { data: me } = useMe();
  const { data: notifications = [] } = useNotifications();
  const needsRecovery = Boolean(me && !me.recoveryCodeCreatedAt);
  return notifications.filter((n) => !n.readAt).length + (needsRecovery ? 1 : 0);
}

/** Centered notifications dialog (opened from account / mobile menus). */
export function NotificationsButton({
  open = false,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** @deprecated Trigger lives in menus now; kept for call-site compatibility. */
  showTrigger?: boolean;
} = {}) {
  const { data: me } = useMe();
  const { data: notifications = [] } = useNotifications();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const needsRecovery = Boolean(me && !me.recoveryCodeCreatedAt);
  const hasUnread = notifications.some((n) => !n.readAt);

  const close = () => onOpenChange?.(false);

  const markRead = async (body: { ids?: string[]; all?: boolean }) => {
    const res = await post<{ notifications: AppNotification[] }>('/api/notifications/read', body).catch(() => null);
    if (res) qc.setQueryData(keys.notifications, res.notifications);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Notifications"
      icon={FEATURE_ILLUSTRATIONS.bell}
      size="sm"
      className="notif-modal"
      bodyClassName="notif-modal-body"
      footer={
        hasUnread ? (
          <button type="button" className="btn btn-ghost" onClick={() => markRead({ all: true })}>
            Mark all read
          </button>
        ) : undefined
      }
    >
      <div className="notif-list">
        {needsRecovery && (
          <button
            type="button"
            className="notif-item unread notif-alert"
            onClick={() => {
              close();
              navigate('/app/settings?tab=account');
            }}
          >
            <span className="art-icon art-icon-tab notif-alert-art" aria-hidden>
              {COVER_ICON_ART.chest}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block' }}>Set up a recovery code</span>
              <span className="faint text-xs">So you can get back in if you forget your password</span>
            </span>
          </button>
        )}
        {notifications.length === 0 && !needsRecovery ? (
          <div className="stack-sm" style={{ alignItems: 'center', padding: '40px 16px', textAlign: 'center' }}>
            <Inbox size={22} className="faint" aria-hidden />
            <p className="muted text-sm">You're all caught up. We'll let you know when someone shares a list with you or an occasion is coming up.</p>
          </div>
        ) : (
          notifications.slice(0, 30).map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <button
                key={n.id}
                type="button"
                className={`notif-item${n.readAt ? '' : ' unread'}`}
                onClick={() => {
                  if (!n.readAt) void markRead({ ids: [n.id] });
                  close();
                  if (n.link) navigate(n.link);
                }}
              >
                <Icon size={16} className="muted" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block' }}>{n.message}</span>
                  <span className="faint text-xs">{relativeTime(n.createdAt)}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}
