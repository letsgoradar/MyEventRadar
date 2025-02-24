import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import { Pool } from '@neondatabase/serverless';
import {
  users,
  events,
  favorites,
  participants,
  savedSearches,
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
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Event operations
  createEvent(event: InsertEvent): Promise<Event>;
  getEvent(id: number): Promise<Event | undefined>;
  getEventsByRadius(lat: number, lng: number, radius: number): Promise<Event[]>;
  getEventsByHost(hostId: number): Promise<Event[]>;

  // Favorite operations
  addFavorite(favorite: InsertFavorite): Promise<Favorite>;
  removeFavorite(userId: number, eventId: number): Promise<void>;
  getFavoritesByUser(userId: number): Promise<Event[]>;

  // Participant operations
  addParticipant(participant: InsertParticipant): Promise<Participant>;
  removeParticipant(userId: number, eventId: number): Promise<void>;
  getEventParticipants(eventId: number): Promise<User[]>;

  // SavedSearch operations
  saveSavedSearch(search: InsertSavedSearch): Promise<SavedSearch>;
  getSavedSearchesByUser(userId: number): Promise<SavedSearch[]>;
  removeSavedSearch(id: number): Promise<void>;
}

export class PgStorage implements IStorage {
  private db;
  private pool;
  private retryCount = 0;
  private maxRetries = 3;

  constructor() {
    this.initializeDatabase();
  }

  private initializeDatabase() {
    try {
      this.pool = new Pool({ 
        connectionString: process.env.DATABASE_URL!,
        connectionTimeoutMillis: 5000,
        max: 20,
        idleTimeoutMillis: 30000
      });

      this.db = drizzle(this.pool);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

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
        console.log('Creating event with data:', insertEvent);
        const eventData = {
          title: insertEvent.title,
          description: insertEvent.description,
          location: insertEvent.location,
          startTime: new Date(insertEvent.startTime),
          endTime: insertEvent.endTime ? new Date(insertEvent.endTime) : null,
          category: insertEvent.category,
          subcategory: insertEvent.subcategory || null,
          isPaid: insertEvent.isPaid || false,
          price: insertEvent.price || null,
          hostId: insertEvent.hostId,
          recurrence: insertEvent.recurrence,
        };

        console.log('Formatted event data:', eventData);
        const result = await this.db.insert(events).values(eventData).returning();
        console.log('Created event:', result[0]);
        return result[0];
      } catch (error) {
        console.error('Error creating event:', error);
        throw error;
      }
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.withRetry(async () => {
      const result = await this.db.select().from(users).where(eq(users.id, id));
      return result[0];
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const result = await this.db.select().from(users).where(eq(users.username, username));
      return result[0];
    });
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.withRetry(async () => {
      const result = await this.db.select().from(users).where(eq(users.email, email));
      return result[0];
    });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withRetry(async () => {
      const result = await this.db.insert(users).values(insertUser).returning();
      return result[0];
    });
  }

  async getEvent(id: number): Promise<Event | undefined> {
    return this.withRetry(async () => {
      const result = await this.db.select().from(events).where(eq(events.id, id));
      return result[0];
    });
  }

  async getEventsByRadius(lat: number, lng: number, radius: number): Promise<Event[]> {
    return this.withRetry(async () => {
      // For now, return all events since we need PostGIS for proper radius search
      // TODO: Add PostGIS extension and implement proper radius search
      const allEvents = await this.db.select().from(events).orderBy(desc(events.startTime));
      return allEvents.filter(event => {
        const eventLoc = event.location as { lat: number; lng: number };
        const distance = this.calculateDistance(lat, lng, eventLoc.lat, eventLoc.lng);
        return distance <= radius;
      });
    });
  }

  async getEventsByHost(hostId: number): Promise<Event[]> {
    return this.withRetry(async () => {
      return this.db.select().from(events).where(eq(events.hostId, hostId));
    });
  }

  async addFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    return this.withRetry(async () => {
      const result = await this.db.insert(favorites).values(insertFavorite).returning();
      return result[0];
    });
  }

  async removeFavorite(userId: number, eventId: number): Promise<void> {
    return this.withRetry(async () => {
      await this.db.delete(favorites)
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
      const result = await this.db
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
      const result = await this.db.insert(participants).values(insertParticipant).returning();
      return result[0];
    });
  }

  async removeParticipant(userId: number, eventId: number): Promise<void> {
    return this.withRetry(async () => {
      await this.db.delete(participants)
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
      const result = await this.db
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
      const result = await this.db.insert(savedSearches).values(insertSearch).returning();
      return result[0];
    });
  }

  async getSavedSearchesByUser(userId: number): Promise<SavedSearch[]> {
    return this.withRetry(async () => {
      return this.db.select().from(savedSearches).where(eq(savedSearches.userId, userId));
    });
  }

  async removeSavedSearch(id: number): Promise<void> {
    return this.withRetry(async () => {
      await this.db.delete(savedSearches).where(eq(savedSearches.id, id));
    });
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
}

export const storage = new PgStorage();