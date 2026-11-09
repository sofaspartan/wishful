import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, Inbox, Pencil, Tag, UserCheck, UserPlus, Users } from 'lucide-react';
import type { AppNotification, NotificationType } from '../../shared/types';
import { keys, useNotifications } from '../lib/queries';
import { post } from '../lib/api';
import { relativeTime } from '../lib/format';
import { Popover } from './ui/Popover';

const ICONS: Record<NotificationType, typeof Bell> = {
  shared_with_you: Users,
  collaborator_edit: Pencil,
  occasion_upcoming: CalendarDays,
  price_drop: Tag,
  item_changed: Pencil,
  friend_request: UserPlus,
  friend_accepted: UserCheck,
};

export function NotificationsButton() {
  const { data: notifications = [] } = useNotifications();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const unread = notifications.filter((n) => !n.readAt).length;

  const markRead = async (body: { ids?: string[]; all?: boolean }) => {
    const res = await post<{ notifications: AppNotification[] }>('/api/notifications/read', body).catch(() => null);
    if (res) qc.setQueryData(keys.notifications, res.notifications);
  };

  return (
    <Popover
      label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
      className="notif-panel"
      buttonContent={
        <>
          <Bell size={19} />
          {unread > 0 && <span className="notif-dot" aria-hidden />}
        </>
      }
    >
      {(close) => (
        <>
          <div className="notif-head">
            <strong>Notifications</strong>
            <div className="spacer" />
            {unread > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => markRead({ all: true })}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="stack-sm" style={{ alignItems: 'center', padding: '32px 16px', textAlign: 'center' }}>
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
        </>
      )}
    </Popover>
  );
}
