import { db } from './storage';
import type { ResetRecord, SessionRecord, UserRecord, WishlistRecord } from './records';
import { notify } from './services/notifications';
import { sendEmail } from './services/email';
import { toSelfUser } from './serialize';
import { appUrl, now } from './util';
import { atomicUpdateExisting } from './storage';

const REMINDER_DAYS = 7;

/**
 * Daily maintenance:
 *  - occasion reminders for wishlists with an event date within 7 days;
 *  - sweep expired sessions, reset tokens and rate-limit buckets.
 * Reminders only mention the occasion — never any gift activity.
 */
export async function runDailyJobs(): Promise<{ reminders: number; swept: number }> {
  const today = now();
  let reminders = 0;
  for (const key of await db('wishlists').list()) {
    const w = (await db('wishlists').get<WishlistRecord>(key))?.value;
    if (!w || !w.eventDate || w.archivedAt || w.reminderSentFor === w.eventDate) continue;
    const days = Math.ceil((new Date(`${w.eventDate}T00:00:00Z`).getTime() - today.getTime()) / 86_400_000);
    if (days < 0 || days > REMINDER_DAYS) continue;
    const eventDate = w.eventDate;
    await atomicUpdateExisting<WishlistRecord>(db('wishlists'), w.id, (draft) => ({ ...draft, reminderSentFor: eventDate }));
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    const message = `“${w.title}”${w.occasion ? ` (${w.occasion})` : ''} is coming up ${when}.`;
    await notify(w.ownerId, 'occasion_upcoming', message, `/app/lists/${w.id}`);
    const owner = (await db('users').get<UserRecord>(w.ownerId))?.value;
    if (owner && toSelfUser(owner).preferences.notifications.emailOccasionReminders) {
      await sendEmail({
        to: owner.email,
        subject: `${w.title} is coming up ${when}`,
        paragraphs: [message, 'Now is a great time to make sure your list is up to date and shared with the right people.'],
        action: { label: 'Review your list', url: `${appUrl()}/app/lists/${w.id}` },
      });
    }
    reminders++;
  }

  let swept = 0;
  const t = today.getTime();
  for (const [store, expiry] of [
    ['sessions', (v: SessionRecord) => v.expiresAt],
    ['resets', (v: ResetRecord) => v.expiresAt],
    ['ratelimits', (v: { expiresAt: string }) => v.expiresAt],
  ] as const) {
    for (const key of await db(store).list()) {
      const v = (await db(store).get<never>(key))?.value;
      if (v && new Date((expiry as (x: never) => string)(v)).getTime() <= t) {
        await db(store).delete(key);
        swept++;
      }
    }
  }
  return { reminders, swept };
}
