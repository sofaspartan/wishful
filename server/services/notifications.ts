import type { AppNotification, NotificationType } from '../../shared/types';
import { atomicUpdate, db } from '../storage';
import { newId, nowIso } from '../util';

const MAX_NOTIFICATIONS = 100;

interface NotificationDoc {
  items: AppNotification[];
}

/**
 * In-app notifications. Callers are responsible for never creating a
 * notification that reveals Surprise Mode gift activity to a list owner —
 * claim/pledge code paths deliberately do not call this module at all.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  message: string,
  link: string | null = null,
): Promise<void> {
  try {
    await atomicUpdate<NotificationDoc>(db('notifications'), userId, (doc) => {
      const items = doc?.items ?? [];
      items.unshift({ id: newId(), type, message, link, readAt: null, createdAt: nowIso() });
      return { items: items.slice(0, MAX_NOTIFICATIONS) };
    });
  } catch (err) {
    console.error('[notify] failed', err);
  }
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const res = await db('notifications').get<NotificationDoc>(userId);
  return res?.value.items ?? [];
}

export async function markRead(userId: string, ids: string[] | 'all'): Promise<AppNotification[]> {
  const doc = await atomicUpdate<NotificationDoc>(db('notifications'), userId, (current) => {
    const stamp = nowIso();
    const items = (current?.items ?? []).map((n) =>
      n.readAt || (ids !== 'all' && !ids.includes(n.id)) ? n : { ...n, readAt: stamp },
    );
    return { items };
  });
  return doc.items;
}
