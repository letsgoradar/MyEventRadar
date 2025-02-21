import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
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

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    this.db = drizzle(pool);
  }

  async getUser(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const result = await this.db.insert(events).values(insertEvent).returning();
    return result[0];
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const result = await this.db.select().from(events).where(eq(events.id, id));
    return result[0];
  }

  async getEventsByRadius(lat: number, lng: number, radius: number): Promise<Event[]> {
    // For now, return all events since we need PostGIS for proper radius search
    // TODO: Add PostGIS extension and implement proper radius search
    const allEvents = await this.db.select().from(events);
    return allEvents.filter(event => {
      const eventLoc = event.location as { lat: number; lng: number };
      const distance = this.calculateDistance(lat, lng, eventLoc.lat, eventLoc.lng);
      return distance <= radius;
    });
  }

  async getEventsByHost(hostId: number): Promise<Event[]> {
    return this.db.select().from(events).where(eq(events.hostId, hostId));
  }

  async addFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    const result = await this.db.insert(favorites).values(insertFavorite).returning();
    return result[0];
  }

  async removeFavorite(userId: number, eventId: number): Promise<void> {
    await this.db.delete(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.eventId, eventId)
        )
      );
  }

  async getFavoritesByUser(userId: number): Promise<Event[]> {
    const result = await this.db
      .select({
        event: events
      })
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .leftJoin(events, eq(events.id, favorites.eventId));

    return result.map(r => r.event);
  }

  async addParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    const result = await this.db.insert(participants).values(insertParticipant).returning();
    return result[0];
  }

  async removeParticipant(userId: number, eventId: number): Promise<void> {
    await this.db.delete(participants)
      .where(
        and(
          eq(participants.userId, userId),
          eq(participants.eventId, eventId)
        )
      );
  }

  async getEventParticipants(eventId: number): Promise<User[]> {
    const result = await this.db
      .select({
        user: users
      })
      .from(participants)
      .where(eq(participants.eventId, eventId))
      .leftJoin(users, eq(users.id, participants.userId));

    return result.map(r => r.user);
  }

  async saveSavedSearch(insertSearch: InsertSavedSearch): Promise<SavedSearch> {
    const result = await this.db.insert(savedSearches).values(insertSearch).returning();
    return result[0];
  }

  async getSavedSearchesByUser(userId: number): Promise<SavedSearch[]> {
    return this.db.select().from(savedSearches).where(eq(savedSearches.userId, userId));
  }

  async removeSavedSearch(id: number): Promise<void> {
    await this.db.delete(savedSearches).where(eq(savedSearches.id, id));
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