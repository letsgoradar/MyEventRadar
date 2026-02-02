import { db } from "./db";
import { notifications, favorites, participants, events, users } from "@shared/schema";
import { eq, and, gte, lte, isNull, or, sql, inArray } from "drizzle-orm";

// Herinneringstijden in uren
const REMINDER_HOURS = [48, 24, 1] as const;
type ReminderHour = typeof REMINDER_HOURS[number];

/**
 * Generates notifications for upcoming events at 48h, 24h and 1h intervals
 * Only creates notifications for users who favorited or are participating in events
 */
export async function generateUpcomingEventNotifications() {
  try {
    const now = new Date();
    let totalNotificationsCreated = 0;
    
    for (const hoursAhead of REMINDER_HOURS) {
      const notificationsCreated = await generateNotificationsForTimeWindow(now, hoursAhead);
      totalNotificationsCreated += notificationsCreated;
    }
    
    // Alleen loggen als er iets gebeurd is of bij debug
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
  // Calculate time window: events starting in hoursAhead hours (+/- 30 min tolerance)
  const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);
  
  // Find events in this window
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
    // Find all users who favorited this event
    const favoriteUsers = await db
      .select({ userId: favorites.userId })
      .from(favorites)
      .where(eq(favorites.eventId, event.id));

    // Find all users who are participating in this event
    const participantUsers = await db
      .select({ userId: participants.userId })
      .from(participants)
      .where(eq(participants.eventId, event.id));

    // Combine unique user IDs
    const allUserIds = new Set([
      ...favoriteUsers.map((f: { userId: number }) => f.userId),
      ...participantUsers.map((p: { userId: number }) => p.userId)
    ]);

    if (allUserIds.size === 0) {
      continue;
    }

    // Create notifications for each user (skip if already exists for this reminder type)
    for (const userId of Array.from(allUserIds)) {
      // Check if notification already exists for this specific reminder
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

      // Create appropriate message based on time
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

/**
 * Cleans up old read notifications (older than 30 days)
 */
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

// Run the scheduler every hour
let schedulerInterval: NodeJS.Timeout | null = null;

export function startNotificationScheduler() {
  if (schedulerInterval) {
    return;
  }

  console.log('[Notification Scheduler] Gestart');
  
  // Run immediately on start (silent unless there are notifications)
  generateUpcomingEventNotifications();
  
  // Then run every hour
  schedulerInterval = setInterval(() => {
    generateUpcomingEventNotifications();
    
    // Clean up old notifications once a day (at 3 AM)
    const now = new Date();
    if (now.getHours() === 3) {
      cleanupOldNotifications();
    }
  }, 60 * 60 * 1000); // Every hour
}

export function stopNotificationScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Notification Scheduler] Gestopt');
  }
}
