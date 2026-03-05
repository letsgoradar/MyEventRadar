import { db } from "./db";
import { notifications, favorites, participants, events, users } from "@shared/schema";
import { eq, and, gte, lte, isNull, or, sql, inArray } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

const REMINDER_HOURS = [48, 24, 1] as const;
type ReminderHour = typeof REMINDER_HOURS[number];

let lastNotificationCheck: Date | null = null;
let lastCleanup: Date | null = null;
let isChecking = false;

const NOTIFICATION_CHECK_INTERVAL_HOURS = 1;
const CLEANUP_INTERVAL_HOURS = 24;

export async function generateUpcomingEventNotifications() {
  try {
    const now = new Date();
    let totalNotificationsCreated = 0;
    
    for (const hoursAhead of REMINDER_HOURS) {
      const notificationsCreated = await generateNotificationsForTimeWindow(now, hoursAhead);
      totalNotificationsCreated += notificationsCreated;
    }
    
    if (totalNotificationsCreated > 0) {
      console.log(`[Notifications] ${totalNotificationsCreated} herinneringen aangemaakt`);
    }
    
    return { success: true, notificationsCreated: totalNotificationsCreated };
  } catch (error) {
    console.error('[Notifications] Fout bij aanmaken herinneringen:', error);
    return { success: false, error: String(error) };
  }
}

async function generateNotificationsForTimeWindow(now: Date, hoursAhead: ReminderHour): Promise<number> {
  const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);
  
  const upcomingEvents = await db
    .select()
    .from(events)
    .where(
      and(
        gte(events.startTime, windowStart),
        lte(events.startTime, windowEnd)
      )
    );

  if (upcomingEvents.length === 0) {
    return 0;
  }

  let notificationsCreated = 0;
  const reminderType = `event_reminder_${hoursAhead}h`;
  
  for (const event of upcomingEvents) {
    const favoriteUsers = await db
      .select({ userId: favorites.userId })
      .from(favorites)
      .where(eq(favorites.eventId, event.id));

    const participantUsers = await db
      .select({ userId: participants.userId })
      .from(participants)
      .where(eq(participants.eventId, event.id));

    const allUserIds = new Set([
      ...favoriteUsers.map((f: { userId: number }) => f.userId),
      ...participantUsers.map((p: { userId: number }) => p.userId)
    ]);

    if (allUserIds.size === 0) {
      continue;
    }

    for (const userId of Array.from(allUserIds)) {
      const existingNotifications = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.eventId, event.id),
            eq(notifications.type, reminderType)
          )
        );

      if (existingNotifications.length > 0) {
        continue;
      }

      const { title, message } = getReminderMessage(event, hoursAhead);

      await db.insert(notifications).values({
        userId,
        eventId: event.id,
        type: reminderType,
        title,
        message,
        isRead: false,
      });

      notificationsCreated++;
    }
  }

  return notificationsCreated;
}

function getReminderMessage(event: typeof events.$inferSelect, hoursAhead: ReminderHour): { title: string; message: string } {
  const eventTime = new Date(event.startTime);
  const timeStr = eventTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  const dateStr = eventTime.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  
  switch (hoursAhead) {
    case 48:
      return {
        title: '📅 Over 2 dagen',
        message: `"${event.title}" begint op ${dateStr} om ${timeStr}`
      };
    case 24:
      return {
        title: '🔔 Morgen!',
        message: `"${event.title}" begint morgen om ${timeStr}`
      };
    case 1:
      return {
        title: '⏰ Bijna tijd!',
        message: `"${event.title}" begint over 1 uur om ${timeStr}`
      };
  }
}

export async function cleanupOldNotifications() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.isRead, true),
          lte(notifications.createdAt, thirtyDaysAgo)
        )
      );

    return { success: true };
  } catch (error) {
    console.error('[Notifications] Fout bij opschonen oude notificaties:', error);
    return { success: false, error: String(error) };
  }
}

function shouldCheckNotifications(): boolean {
  if (isChecking) return false;
  if (!lastNotificationCheck) return true;
  const hoursSinceLastCheck = (Date.now() - lastNotificationCheck.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastCheck >= NOTIFICATION_CHECK_INTERVAL_HOURS;
}

function shouldCleanup(): boolean {
  if (!lastCleanup) return true;
  const hoursSinceLastCleanup = (Date.now() - lastCleanup.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastCleanup >= CLEANUP_INTERVAL_HOURS;
}

export function notificationSyncMiddleware(req: Request, res: Response, next: NextFunction): void {
  next();
  
  if (shouldCheckNotifications()) {
    isChecking = true;
    lastNotificationCheck = new Date();
    
    generateUpcomingEventNotifications()
      .then(() => {
        if (shouldCleanup()) {
          lastCleanup = new Date();
          return cleanupOldNotifications();
        }
      })
      .catch((err) => console.error('[Notifications] Background check error:', err))
      .finally(() => { isChecking = false; });
  }
}

export function startNotificationScheduler() {
  console.log('[Notification Scheduler] Request-triggered mode enabled (check every 1h on traffic)');
  generateUpcomingEventNotifications().catch(console.error);
  lastNotificationCheck = new Date();
}

export function stopNotificationScheduler() {
  console.log('[Notification Scheduler] Gestopt');
}
