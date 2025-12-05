import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import {
  users,
  events,
  favorites,
  participants,
  savedSearches,
  activityLogs,
  notifications,
  rssFeeds,
  rssFeedItems,
  type User,
  type InsertUser,
  type Event,
  type InsertEvent,
  type Favorite,
  type InsertFavorite,
  type Participant,
  type InsertParticipant,
  type SavedSearch,
  type InsertSavedSearch,
  type ActivityLog,
  type InsertActivityLog,
  type Notification,
  type InsertNotification,
  type RssFeed,
  type InsertRssFeed,
  type RssFeedItem,
  type InsertRssFeedItem,
} from "@shared/schema";
import { db } from './db';
import NodeGeocoder from 'node-geocoder';

const geocoder = NodeGeocoder({
  provider: 'openstreetmap'
});

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUserCount(): Promise<number>;
  updateUser(id: number, userData: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  importUsers(users: InsertUser[]): Promise<User[]>;

  // Event operations
  createEvent(event: InsertEvent): Promise<Event>;
  getEvent(id: number): Promise<Event | undefined>;
  getEventsByRadius(lat: number, lng: number, radius: number, windowDays?: number | null): Promise<Event[]>;
  getEventsByHost(hostId: number): Promise<Event[]>;
  clearEvents(): Promise<void>; // Added clearEvents method
  getAllEvents(): Promise<Event[]>;
  updateEvent(id: number, event: Partial<Event>): Promise<Event>;
  deleteEvent(id: number): Promise<void>;
  getEventCount(): Promise<number>;
  importEvents(events: InsertEvent[]): Promise<Event[]>;

  // Favorite operations
  addFavorite(favorite: InsertFavorite): Promise<Favorite>;
  removeFavorite(userId: number, eventId: number): Promise<void>;
  getFavoritesByUser(userId: number): Promise<Event[]>;

  // Participant operations
  addParticipant(participant: InsertParticipant): Promise<Participant>;
  removeParticipant(userId: number, eventId: number): Promise<void>;
  getEventParticipants(eventId: number): Promise<User[]>;
  getEventsForParticipant(userId: number): Promise<Event[]>;
  getParticipantCount(): Promise<number>;
  getAllParticipants(): Promise<Participant[]>;

  // SavedSearch operations
  saveSavedSearch(search: InsertSavedSearch): Promise<SavedSearch>;
  getSavedSearchesByUser(userId: number): Promise<SavedSearch[]>;
  removeSavedSearch(id: number): Promise<void>;
  
  // Activity Log operations
  logActivity(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(options?: { limit?: number; offset?: number; userId?: number; activityType?: string }): Promise<ActivityLog[]>;
  getActivityLogCount(): Promise<number>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<void>;
  getUnreadNotificationCount(userId: number): Promise<number>;

  // RSS Feed operations
  createRssFeed(feed: InsertRssFeed): Promise<RssFeed>;
  getRssFeed(id: number): Promise<RssFeed | undefined>;
  getAllRssFeeds(): Promise<RssFeed[]>;
  updateRssFeed(id: number, feed: Partial<RssFeed>): Promise<RssFeed>;
  deleteRssFeed(id: number): Promise<void>;
  getRssFeedItems(feedId: number): Promise<RssFeedItem[]>;
  getRssFeedItemsCount(): Promise<number>;
}

export class PgStorage implements IStorage {
  private retryCount = 0;
  private maxRetries = 3;

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error('Database operation failed:', error);

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying operation (attempt ${this.retryCount})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
        return this.withRetry(operation);
      }

      this.retryCount = 0;
      throw error;
    }
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    return this.withRetry(async () => {
      try {
        // Bepaal de latitude, longitude en notificationReach
        // Ondersteun zowel het oude formaat (location object) als het nieuwe formaat (directe velden)
        let latitude, longitude, notificationReach;
        
        if (insertEvent.location) {
          // Oud formaat - uit location object
          latitude = insertEvent.location.lat.toString();
          longitude = insertEvent.location.lng.toString();
          notificationReach = insertEvent.location.notificationReach.toString();
        } else {
          // Nieuw formaat - directe velden
          latitude = insertEvent.latitude.toString();
          longitude = insertEvent.longitude.toString();
          notificationReach = insertEvent.notificationReach.toString();
        }
        
        const eventData = {
          title: insertEvent.title,
          description: insertEvent.description,
          latitude: latitude,
          longitude: longitude,
          notificationReach: notificationReach,
          startTime: new Date(insertEvent.startTime),
          endTime: insertEvent.endTime ? new Date(insertEvent.endTime) : null,
          category: insertEvent.category,
          secondaryCategory: insertEvent.secondaryCategory || null,
          isPaid: insertEvent.isPaid || false,
          price: insertEvent.price || null,
          maxParticipants: insertEvent.maxParticipants || null,
          hostId: insertEvent.hostId,
          recurrence: insertEvent.recurrence,
          imageUrl: insertEvent.imageUrl || null, // ✅ FIX: imageUrl toegevoegd
          tags: insertEvent.tags || [],
          address: insertEvent.address || null,
        };

        console.log('Creating event with data:', eventData);

        const [result] = await db.insert(events).values(eventData).returning();

        console.log('Created event result:', result);

        return result;
      } catch (error) {
        console.error('Error creating event:', error);
        throw error;
      }
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [result] = await db.select().from(users).where(eq(users.id, id));
      return result;
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [result] = await db.select().from(users).where(eq(users.username, username));
      return result;
    });
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const [result] = await db.select().from(users).where(eq(users.email, email));
      return result;
    });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withRetry(async () => {
      const [result] = await db.insert(users).values(insertUser).returning();
      return result;
    });
  }

  async getEvent(id: number): Promise<Event | undefined> {
    return this.withRetry(async () => {
      const [result] = await db.select().from(events).where(eq(events.id, id));
      return result;
    });
  }

  async getEventsByRadius(lat: number, lng: number, radius: number, windowDays: number | null = 14): Promise<Event[]> {
    try {
      console.log('Fetching events with params:', { lat, lng, radius, windowDays });
      const result = await db.select().from(events);

      const now = new Date();
      
      // Filter events op tijdsvenster (standaard 14 dagen vooruit)
      const filteredByTime = windowDays !== null 
        ? result.filter(event => {
            const eventStart = new Date(event.startTime);
            const eventEnd = event.endTime ? new Date(event.endTime) : eventStart;
            const maxDate = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
            
            // Event is relevant als het nog niet voorbij is EN start binnen het venster
            return eventEnd >= now && eventStart <= maxDate;
          })
        : result;

      // Convert coordinates to numbers consistently
      const formattedEvents = filteredByTime.map(event => {
        const formattedEvent = {
          ...event,
          latitude: parseFloat(event.latitude),
          longitude: parseFloat(event.longitude),
          notificationReach: parseFloat(event.notificationReach)
        };
        return formattedEvent;
      });

      console.log(`Found ${formattedEvents.length} events within ${windowDays ?? 'all'} days window`);
      return formattedEvents;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  async getEventsByHost(hostId: number): Promise<Event[]> {
    return this.withRetry(async () => {
      return db.select().from(events).where(eq(events.hostId, hostId));
    });
  }

  async clearEvents(): Promise<void> { // Added clearEvents method implementation
    return this.withRetry(async () => {
      await db.delete(events);
    });
  }

  async addFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    return this.withRetry(async () => {
      const [result] = await db.insert(favorites).values(insertFavorite).returning();
      return result;
    });
  }

  async removeFavorite(userId: number, eventId: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(favorites)
        .where(
          and(
            eq(favorites.userId, userId),
            eq(favorites.eventId, eventId)
          )
        );
    });
  }

  async getFavoritesByUser(userId: number): Promise<Event[]> {
    return this.withRetry(async () => {
      const result = await db
        .select({
          event: events
        })
        .from(favorites)
        .where(eq(favorites.userId, userId))
        .innerJoin(events, eq(events.id, favorites.eventId));

      return result.map(r => r.event);
    });
  }

  async addParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    return this.withRetry(async () => {
      const [result] = await db.insert(participants).values(insertParticipant).returning();
      return result;
    });
  }

  async removeParticipant(userId: number, eventId: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(participants)
        .where(
          and(
            eq(participants.userId, userId),
            eq(participants.eventId, eventId)
          )
        );
    });
  }

  async getEventParticipants(eventId: number): Promise<User[]> {
    return this.withRetry(async () => {
      const result = await db
        .select({
          user: users
        })
        .from(participants)
        .where(eq(participants.eventId, eventId))
        .innerJoin(users, eq(users.id, participants.userId));

      return result.map(r => r.user);
    });
  }

  async saveSavedSearch(insertSearch: InsertSavedSearch): Promise<SavedSearch> {
    return this.withRetry(async () => {
      const [result] = await db.insert(savedSearches).values(insertSearch).returning();
      return result;
    });
  }

  async getSavedSearchesByUser(userId: number): Promise<SavedSearch[]> {
    return this.withRetry(async () => {
      return db.select().from(savedSearches).where(eq(savedSearches.userId, userId));
    });
  }

  async removeSavedSearch(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(savedSearches).where(eq(savedSearches.id, id));
    });
  }
  
  // Admin methods
  async getAllUsers(): Promise<User[]> {
    return this.withRetry(async () => {
      return db.select().from(users);
    });
  }
  
  async getUserCount(): Promise<number> {
    return this.withRetry(async () => {
      const result = await db.select({ count: count() }).from(users);
      return result[0].count;
    });
  }
  
  async getAllEvents(): Promise<Event[]> {
    return this.withRetry(async () => {
      return db.select().from(events);
    });
  }
  
  async updateEvent(id: number, eventData: Partial<Event>): Promise<Event> {
    return this.withRetry(async () => {
      const [result] = await db
        .update(events)
        .set(eventData)
        .where(eq(events.id, id))
        .returning();
      return result;
    });
  }
  
  async deleteEvent(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(events).where(eq(events.id, id));
    });
  }
  
  async getEventCount(): Promise<number> {
    return this.withRetry(async () => {
      const result = await db.select({ count: count() }).from(events);
      return result[0].count;
    });
  }
  
  async getEventsForParticipant(userId: number): Promise<Event[]> {
    return this.withRetry(async () => {
      const result = await db
        .select({
          event: events
        })
        .from(participants)
        .where(eq(participants.userId, userId))
        .innerJoin(events, eq(events.id, participants.eventId));
      
      return result.map(r => r.event);
    });
  }
  
  async getParticipantCount(): Promise<number> {
    return this.withRetry(async () => {
      const result = await db.select({ count: count() }).from(participants);
      return result[0].count;
    });
  }
  
  async getAllParticipants(): Promise<Participant[]> {
    return this.withRetry(async () => {
      return await db.select().from(participants);
    });
  }
  
  // User management methods
  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    return this.withRetry(async () => {
      const [result] = await db
        .update(users)
        .set(userData)
        .where(eq(users.id, id))
        .returning();
      return result;
    });
  }
  
  async deleteUser(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(users).where(eq(users.id, id));
    });
  }
  
  async importUsers(newUsers: InsertUser[]): Promise<User[]> {
    return this.withRetry(async () => {
      const results = [];
      
      // Process users in batches to avoid large transactions
      for (const user of newUsers) {
        try {
          // Check if user with same email already exists
          const existingUser = await this.getUserByEmail(user.email);
          
          if (existingUser) {
            // Update existing user instead of creating a duplicate
            const updatedUser = await this.updateUser(existingUser.id, user);
            results.push(updatedUser);
          } else {
            // Create new user
            const createdUser = await this.createUser(user);
            results.push(createdUser);
          }
        } catch (error) {
          console.error('Error importing user:', error);
          // Continue with next user instead of failing the entire import
        }
      }
      
      return results;
    });
  }
  
  // Event import
  async importEvents(newEvents: InsertEvent[]): Promise<Event[]> {
    return this.withRetry(async () => {
      const results = [];
      
      // Process events in batches to avoid large transactions
      for (const event of newEvents) {
        try {
          const createdEvent = await this.createEvent(event);
          results.push(createdEvent);
        } catch (error) {
          console.error('Error importing event:', error);
          // Continue with next event instead of failing the entire import
        }
      }
      
      return results;
    });
  }
  
  // Activity logging methods
  async logActivity(log: InsertActivityLog): Promise<ActivityLog> {
    return this.withRetry(async () => {
      const [result] = await db.insert(activityLogs).values(log).returning();
      return result;
    });
  }
  
  async getActivityLogs(options: { limit?: number; offset?: number; userId?: number; activityType?: string } = {}): Promise<ActivityLog[]> {
    return this.withRetry(async () => {
      // Using any to resolve type issues with Drizzle's query builder
      let query: any = db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt));
      
      if (options.userId) {
        query = query.where(eq(activityLogs.userId, options.userId));
      }
      
      if (options.activityType) {
        query = query.where(eq(activityLogs.activityType, options.activityType));
      }
      
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      if (options.offset) {
        query = query.offset(options.offset);
      }
      
      return query;
    });
  }
  
  async getActivityLogCount(): Promise<number> {
    return this.withRetry(async () => {
      const result = await db.select({ count: count() }).from(activityLogs);
      return result[0].count;
    });
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Notification operations implementation
  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    return this.withRetry(async () => {
      const [notification] = await db.insert(notifications).values(insertNotification).returning();
      return notification;
    });
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return this.withRetry(async () => {
      return await db.select().from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt));
    });
  }

  async markNotificationAsRead(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, id));
    });
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    return this.withRetry(async () => {
      const result = await db.select({ count: count() }).from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      return result[0]?.count || 0;
    });
  }

  // RSS Feed operations implementation
  async createRssFeed(feed: InsertRssFeed): Promise<RssFeed> {
    return this.withRetry(async () => {
      const [rssFeed] = await db.insert(rssFeeds).values(feed).returning();
      return rssFeed;
    });
  }

  async getRssFeed(id: number): Promise<RssFeed | undefined> {
    return this.withRetry(async () => {
      const [feed] = await db.select().from(rssFeeds).where(eq(rssFeeds.id, id));
      return feed;
    });
  }

  async getAllRssFeeds(): Promise<RssFeed[]> {
    return this.withRetry(async () => {
      return await db.select().from(rssFeeds).orderBy(desc(rssFeeds.createdAt));
    });
  }

  async updateRssFeed(id: number, feed: Partial<RssFeed>): Promise<RssFeed> {
    return this.withRetry(async () => {
      const [updated] = await db.update(rssFeeds)
        .set(feed)
        .where(eq(rssFeeds.id, id))
        .returning();
      return updated;
    });
  }

  async deleteRssFeed(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(rssFeeds).where(eq(rssFeeds.id, id));
    });
  }

  async getRssFeedItems(feedId: number): Promise<RssFeedItem[]> {
    return this.withRetry(async () => {
      return await db.select().from(rssFeedItems)
        .where(eq(rssFeedItems.feedId, feedId))
        .orderBy(desc(rssFeedItems.createdAt));
    });
  }

  async getRssFeedItemsCount(): Promise<number> {
    return this.withRetry(async () => {
      const result = await db.select({ count: count() }).from(rssFeedItems);
      return result[0]?.count || 0;
    });
  }
}

export const storage = new PgStorage();