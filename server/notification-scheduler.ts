import { db } from "./db";
import { notifications, favorites, participants, events, users } from "@shared/schema";
import { eq, and, gte, lte, isNull, or, sql, inArray } from "drizzle-orm";

/**
 * Generates notifications for upcoming events (within 24 hours)
 * This should be run periodically (e.g., every hour)
 */
export async function generateUpcomingEventNotifications() {
  console.log('[Notification Scheduler] Starting upcoming event notification generation...');
  
  try {
    // Calculate time window: now and 24 hours from now
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Find all events starting in the next 24 hours
    const upcomingEvents = await db
      .select()
      .from(events)
      .where(
        and(
          gte(events.startTime, now),
          lte(events.startTime, tomorrow)
        )
      );

    console.log(`[Notification Scheduler] Found ${upcomingEvents.length} upcoming events`);
    
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

      console.log(`[Notification Scheduler] Event "${event.title}" has ${allUserIds.size} interested users`);

      // Check if notifications already exist for this event
      for (const userId of Array.from(allUserIds)) {
        // Check if notification already exists
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, userId),
              eq(notifications.eventId, event.id),
              eq(notifications.type, 'event_reminder')
            )
          );

        if (existingNotifications.length > 0) {
          console.log(`[Notification Scheduler] Notification already exists for user ${userId} and event ${event.id}`);
          continue;
        }

        // Calculate hours until event
        const hoursUntilEvent = Math.round((new Date(event.startTime).getTime() - now.getTime()) / (1000 * 60 * 60));
        
        // Create notification
        const title = `Event begint binnenkort!`;
        const message = hoursUntilEvent <= 2 
          ? `"${event.title}" begint binnen ${hoursUntilEvent} uur` 
          : `"${event.title}" begint morgen om ${new Date(event.startTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;

        await db.insert(notifications).values({
          userId,
          eventId: event.id,
          type: 'event_reminder',
          title,
          message,
          isRead: false,
        });

        console.log(`[Notification Scheduler] Created notification for user ${userId}: ${title} - ${message}`);
      }
    }

    console.log('[Notification Scheduler] Completed upcoming event notification generation');
    return { success: true, eventsProcessed: upcomingEvents.length };
  } catch (error) {
    console.error('[Notification Scheduler] Error generating notifications:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Cleans up old read notifications (older than 30 days)
 */
export async function cleanupOldNotifications() {
  console.log('[Notification Scheduler] Starting old notification cleanup...');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.isRead, true),
          lte(notifications.createdAt, thirtyDaysAgo)
        )
      );

    console.log('[Notification Scheduler] Cleaned up old notifications');
    return { success: true };
  } catch (error) {
    console.error('[Notification Scheduler] Error cleaning up notifications:', error);
    return { success: false, error: String(error) };
  }
}

// Run the scheduler every hour
let schedulerInterval: NodeJS.Timeout | null = null;

export function startNotificationScheduler() {
  if (schedulerInterval) {
    console.log('[Notification Scheduler] Already running');
    return;
  }

  console.log('[Notification Scheduler] Starting scheduler...');
  
  // Run immediately on start
  generateUpcomingEventNotifications();
  
  // Then run every hour
  schedulerInterval = setInterval(() => {
    generateUpcomingEventNotifications();
    
    // Clean up old notifications once a day (on the hour)
    const now = new Date();
    if (now.getHours() === 3) { // 3 AM
      cleanupOldNotifications();
    }
  }, 60 * 60 * 1000); // Every hour

  console.log('[Notification Scheduler] Scheduler started');
}

export function stopNotificationScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Notification Scheduler] Scheduler stopped');
  }
}
