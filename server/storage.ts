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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private events: Map<number, Event>;
  private favorites: Map<number, Favorite>;
  private participants: Map<number, Participant>;
  private savedSearches: Map<number, SavedSearch>;
  private currentId: { [key: string]: number };

  constructor() {
    this.users = new Map();
    this.events = new Map();
    this.favorites = new Map();
    this.participants = new Map();
    this.savedSearches = new Map();
    this.currentId = {
      users: 1,
      events: 1,
      favorites: 1,
      participants: 1,
      savedSearches: 1,
    };
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId.users++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = this.currentId.events++;
    const event = { ...insertEvent, id };
    this.events.set(id, event);
    return event;
  }

  async getEvent(id: number): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEventsByRadius(lat: number, lng: number, radius: number): Promise<Event[]> {
    return Array.from(this.events.values()).filter(event => {
      const eventLoc = event.location as { lat: number; lng: number };
      const distance = this.calculateDistance(lat, lng, eventLoc.lat, eventLoc.lng);
      return distance <= radius;
    });
  }

  async getEventsByHost(hostId: number): Promise<Event[]> {
    return Array.from(this.events.values()).filter(
      event => event.hostId === hostId
    );
  }

  async addFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    const id = this.currentId.favorites++;
    const favorite = { ...insertFavorite, id };
    this.favorites.set(id, favorite);
    return favorite;
  }

  async removeFavorite(userId: number, eventId: number): Promise<void> {
    const favorite = Array.from(this.favorites.values()).find(
      f => f.userId === userId && f.eventId === eventId
    );
    if (favorite) {
      this.favorites.delete(favorite.id);
    }
  }

  async getFavoritesByUser(userId: number): Promise<Event[]> {
    const userFavorites = Array.from(this.favorites.values()).filter(
      f => f.userId === userId
    );
    return userFavorites.map(f => this.events.get(f.eventId)!);
  }

  async addParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    const id = this.currentId.participants++;
    const participant = { ...insertParticipant, id };
    this.participants.set(id, participant);
    return participant;
  }

  async removeParticipant(userId: number, eventId: number): Promise<void> {
    const participant = Array.from(this.participants.values()).find(
      p => p.userId === userId && p.eventId === eventId
    );
    if (participant) {
      this.participants.delete(participant.id);
    }
  }

  async getEventParticipants(eventId: number): Promise<User[]> {
    const eventParticipants = Array.from(this.participants.values()).filter(
      p => p.eventId === eventId
    );
    return eventParticipants.map(p => this.users.get(p.userId)!);
  }

  async saveSavedSearch(insertSearch: InsertSavedSearch): Promise<SavedSearch> {
    const id = this.currentId.savedSearches++;
    const search = { ...insertSearch, id };
    this.savedSearches.set(id, search);
    return search;
  }

  async getSavedSearchesByUser(userId: number): Promise<SavedSearch[]> {
    return Array.from(this.savedSearches.values()).filter(
      s => s.userId === userId
    );
  }

  async removeSavedSearch(id: number): Promise<void> {
    this.savedSearches.delete(id);
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

export const storage = new MemStorage();
