import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, desc, count, sql, isNotNull, isNull, inArray } from 'drizzle-orm';
import {
  users,
  events,
  eventSources,
  favorites,
  participants,
  savedSearches,
  activityLogs,
  notifications,
  promotedNotifications,
  rssFeeds,
  rssFeedItems,
  rssItemCorrections,
  feedSyncHistory,
  leads,
  aiExtractionProfiles,
  venues,
  venueContacts,
  venueNotes,
  venueTasks,
  sponsorCampaigns,
  geocodeCache,
  feedQualityChecks,
  qualityCheckIssues,
  eventTags,
  targetAudiences,
  seasonalThemes,
  type User,
  type InsertUser,
  type Event,
  type InsertEvent,
  type EventSource,
  type InsertEventSource,
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
  type PromotedNotification,
  type InsertPromotedNotification,
  type RssFeed,
  type InsertRssFeed,
  type RssFeedItem,
  type InsertRssFeedItem,
  type RssItemCorrection,
  type InsertRssItemCorrection,
  type FeedSyncHistory,
  type InsertFeedSyncHistory,
  type Lead,
  type InsertLead,
  type AiExtractionProfile,
  type InsertAiExtractionProfile,
  type Venue,
  type InsertVenue,
  type VenueContact,
  type InsertVenueContact,
  type VenueNote,
  type InsertVenueNote,
  type VenueTask,
  type InsertVenueTask,
  type SponsorCampaign,
  type InsertSponsorCampaign,
  type FeedQualityCheck,
  type InsertFeedQualityCheck,
  type QualityCheckIssue,
  type InsertQualityCheckIssue,
  type EventTag,
  type InsertEventTag,
  type TargetAudience,
  type InsertTargetAudience,
  type SeasonalTheme,
  type InsertSeasonalTheme,
  type PremiumFeature,
  type InsertPremiumFeature,
  premiumFeatures,
  apiUsageStats,
  type ApiUsageStats,
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
  hardDeleteEvent(id: number): Promise<void>;
  restoreEvent(id: number): Promise<Event>;
  getEventCount(): Promise<number>;
  importEvents(events: InsertEvent[]): Promise<Event[]>;
  
  // Event Sources operations
  addEventSource(source: InsertEventSource): Promise<EventSource>;
  getEventSources(eventId: number): Promise<EventSource[]>;
  findEventSourceByUrl(eventId: number, sourceUrl: string): Promise<EventSource | undefined>;
  incrementExternalPageOpens(id: number): Promise<void>;
  incrementDetailViews(id: number): Promise<void>;
  incrementSavesCount(id: number): Promise<void>;
  decrementSavesCount(id: number): Promise<void>;

  // Favorite operations
  addFavorite(favorite: InsertFavorite): Promise<Favorite | null>; // Returns null if already exists
  removeFavorite(userId: number, eventId: number): Promise<boolean>; // Returns true if actually deleted
  getFavoritesByUser(userId: number): Promise<Event[]>;
  isFavorite(userId: number, eventId: number): Promise<boolean>;

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

  // Promoted Notification operations
  createPromotedNotification(promo: InsertPromotedNotification): Promise<PromotedNotification>;
  getPromotedNotification(id: number): Promise<PromotedNotification | undefined>;
  getAllPromotedNotifications(): Promise<PromotedNotification[]>;
  getActivePromotedNotifications(): Promise<PromotedNotification[]>;
  updatePromotedNotification(id: number, promo: Partial<PromotedNotification>): Promise<PromotedNotification>;
  deletePromotedNotification(id: number): Promise<void>;
  incrementPromotionImpression(id: number): Promise<void>;
  incrementPromotionClick(id: number): Promise<void>;

  // RSS Feed operations
  createRssFeed(feed: InsertRssFeed): Promise<RssFeed>;
  getRssFeed(id: number): Promise<RssFeed | undefined>;
  getAllRssFeeds(): Promise<RssFeed[]>;
  updateRssFeed(id: number, feed: Partial<RssFeed>): Promise<RssFeed>;
  deleteRssFeed(id: number): Promise<void>;
  deleteEventsByFeedId(feedId: number, confirmDeletion?: boolean): Promise<void>;
  unlinkEventsFromFeed(feedId: number): Promise<void>;
  getRssFeedItems(feedId: number): Promise<RssFeedItem[]>;
  getRssFeedItemsCount(): Promise<number>;
  
  // Incomplete RSS Feed Items operations
  getIncompleteItems(feedId?: number, status?: string): Promise<RssFeedItem[]>;
  getIncompleteItemsCount(feedId?: number, status?: string): Promise<number>;
  updateRssFeedItem(id: number, item: Partial<RssFeedItem>): Promise<RssFeedItem>;
  createRssFeedItem(item: InsertRssFeedItem): Promise<RssFeedItem>;
  deleteRssFeedItem(id: number): Promise<void>;
  getFeedItemsSummary(feedId: number): Promise<{ imported: number; incomplete: number; skipped: number }>;
  
  // RSS Item Corrections operations
  createCorrection(correction: InsertRssItemCorrection): Promise<RssItemCorrection>;
  getCorrectionsForFeed(feedId?: number): Promise<RssItemCorrection[]>;
  findMatchingCorrections(fieldKey: string, originalValue: string): Promise<RssItemCorrection[]>;
  incrementCorrectionCount(id: number): Promise<void>;
  deleteCorrection(id: number): Promise<void>;
  
  // Feed Sync History operations
  createSyncHistory(history: InsertFeedSyncHistory): Promise<FeedSyncHistory>;
  getSyncHistoryForFeed(feedId: number, limit?: number): Promise<FeedSyncHistory[]>;
  getLatestSyncForFeed(feedId: number): Promise<FeedSyncHistory | undefined>;
  getAverageSyncDurationForFeed(feedId: number): Promise<number | null>;

  // Lead operations
  createLead(lead: InsertLead): Promise<Lead>;
  getLeadByEmail(email: string): Promise<Lead | undefined>;
  getLeadsByCitySlug(citySlug: string): Promise<Lead[]>;
  getAllLeads(): Promise<Lead[]>;
  getLeadCount(): Promise<number>;

  // AI Extraction Profile operations
  createAiExtractionProfile(profile: InsertAiExtractionProfile): Promise<AiExtractionProfile>;
  getAiExtractionProfile(id: number): Promise<AiExtractionProfile | undefined>;
  getAiExtractionProfileByDomain(domain: string): Promise<AiExtractionProfile | undefined>;
  getAiExtractionProfileByDomainAndPath(domain: string, pathPattern: string): Promise<AiExtractionProfile | undefined>;
  updateAiExtractionProfile(id: number, profile: Partial<AiExtractionProfile>): Promise<AiExtractionProfile>;
  deleteAiExtractionProfile(id: number): Promise<void>;
  getAllAiExtractionProfiles(): Promise<AiExtractionProfile[]>;

  // Public data operations
  getEventsByCitySlug(citySlug: string, limit?: number): Promise<Event[]>;
  getEventCountByCitySlug(citySlug: string): Promise<number>;

  // Venue operations
  createVenue(venue: InsertVenue): Promise<Venue>;
  getVenue(id: number): Promise<Venue | undefined>;
  getVenueById(id: number): Promise<Venue | undefined>;
  getVenueByName(name: string): Promise<Venue | undefined>;
  getAllVenues(): Promise<Venue[]>;
  searchVenues(query: string): Promise<Venue[]>;
  updateVenue(id: number, venue: Partial<Venue>): Promise<Venue>;
  deleteVenue(id: number): Promise<void>;
  getEventsByVenue(venueId: number): Promise<Event[]>;
  getEventsByVenueId(venueId: number): Promise<Event[]>;
  getVenueStats(): Promise<{ totalVenues: number; activeVenues: number; totalContacts: number; totalTasks: number; openTasks: number }>;
  discoverPotentialVenues(minEvents: number): Promise<Array<{ address: string; eventCount: number; sampleTitle: string }>>;
  createVenueFromLocation(address: string, name?: string): Promise<Venue>;

  // Venue Contacts operations
  getVenueContacts(venueId: number): Promise<VenueContact[]>;
  createVenueContact(contact: InsertVenueContact): Promise<VenueContact>;
  updateVenueContact(id: number, contact: Partial<VenueContact>): Promise<VenueContact>;
  deleteVenueContact(id: number): Promise<void>;

  // Venue Notes operations
  getVenueNotes(venueId: number): Promise<VenueNote[]>;
  createVenueNote(note: InsertVenueNote & { userId: number }): Promise<VenueNote>;
  updateVenueNote(id: number, note: Partial<VenueNote>): Promise<VenueNote>;
  deleteVenueNote(id: number): Promise<void>;

  // Venue Tasks operations
  getVenueTasks(venueId: number): Promise<VenueTask[]>;
  getAllVenueTasks(userId?: number): Promise<VenueTask[]>;
  createVenueTask(task: InsertVenueTask & { userId: number; createdByUserId: number }): Promise<VenueTask>;
  updateVenueTask(id: number, task: Partial<VenueTask>): Promise<VenueTask>;
  deleteVenueTask(id: number): Promise<void>;

  // Sponsor Campaigns operations
  getSponsorCampaignsByVenue(venueId: number): Promise<SponsorCampaign[]>;
  getSponsorCampaignsByEvent(eventId: number): Promise<SponsorCampaign[]>;
  getAllSponsorCampaigns(): Promise<SponsorCampaign[]>;
  createSponsorCampaign(campaign: InsertSponsorCampaign & { createdByUserId: number }): Promise<SponsorCampaign>;
  updateSponsorCampaign(id: number, campaign: Partial<SponsorCampaign>): Promise<SponsorCampaign>;
  deleteSponsorCampaign(id: number): Promise<void>;

  // Geocode cache operations
  getGeocodeFromCache(addressQuery: string): Promise<{ latitude: number; longitude: number; displayName?: string } | null>;
  saveGeocodeToCache(data: { addressQuery: string; latitude: number; longitude: number; displayName?: string; municipality?: string }): Promise<void>;
  getGeocodeCacheStats(): Promise<{ totalEntries: number; totalHits: number }>;

  // Quality Check operations
  createQualityCheck(check: InsertFeedQualityCheck): Promise<FeedQualityCheck>;
  getQualityCheck(id: number): Promise<FeedQualityCheck | undefined>;
  getQualityChecksByFeed(feedId: number): Promise<FeedQualityCheck[]>;
  getLatestQualityCheck(feedId: number): Promise<FeedQualityCheck | undefined>;
  updateQualityCheck(id: number, check: Partial<FeedQualityCheck>): Promise<FeedQualityCheck>;
  deleteQualityCheck(id: number): Promise<void>;
  
  // Quality Check Issues operations
  createQualityIssue(issue: InsertQualityCheckIssue): Promise<QualityCheckIssue>;
  getQualityIssuesByCheck(checkId: number): Promise<QualityCheckIssue[]>;
  getUnresolvedIssuesByFeed(feedId: number): Promise<QualityCheckIssue[]>;
  resolveQualityIssue(id: number): Promise<void>;
  deleteQualityIssuesByCheck(checkId: number): Promise<void>;
  
  // Event Tags operations
  getEventTags(): Promise<EventTag[]>;
  createEventTag(tag: InsertEventTag): Promise<EventTag>;
  updateEventTag(id: number, tag: Partial<EventTag>): Promise<EventTag>;
  deleteEventTag(id: number): Promise<void>;
  
  // Target Audiences operations
  getTargetAudiences(): Promise<TargetAudience[]>;
  createTargetAudience(audience: InsertTargetAudience): Promise<TargetAudience>;
  updateTargetAudience(id: number, audience: Partial<TargetAudience>): Promise<TargetAudience>;
  deleteTargetAudience(id: number): Promise<void>;
  
  // Seasonal Themes operations
  getSeasonalThemes(): Promise<SeasonalTheme[]>;
  createSeasonalTheme(theme: InsertSeasonalTheme): Promise<SeasonalTheme>;
  updateSeasonalTheme(id: number, theme: Partial<SeasonalTheme>): Promise<SeasonalTheme>;
  deleteSeasonalTheme(id: number): Promise<void>;
  
  // Premium Features operations
  getPremiumFeatures(): Promise<PremiumFeature[]>;
  createPremiumFeature(feature: InsertPremiumFeature): Promise<PremiumFeature>;
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

  /**
   * Check for suspicious exact midnight endTime that's likely a parsing artifact.
   * Returns true if endTime is exactly 00:00:00.000 on the same day as startTime,
   * and startTime has a non-midnight time component.
   */
  private isSuspiciousMidnightEndTime(startTime: Date, endTime: Date): boolean {
    const isExactMidnight = endTime.getHours() === 0 && 
                            endTime.getMinutes() === 0 && 
                            endTime.getSeconds() === 0 && 
                            endTime.getMilliseconds() === 0;
    const sameDay = startTime.toDateString() === endTime.toDateString();
    const startHasRealTime = startTime.getHours() !== 0;
    
    return isExactMidnight && sameDay && startHasRealTime;
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
        
        // Validate endTime: exclude if before startTime or suspicious midnight parsing artifact
        const startTime = new Date(insertEvent.startTime);
        let endTime: Date | null = null;
        if (insertEvent.endTime) {
          const parsedEndTime = new Date(insertEvent.endTime);
          
          // Check 1: endTime must be >= startTime
          if (parsedEndTime < startTime) {
            console.log(`[Storage] EndTime validation: endTime ${parsedEndTime.toISOString()} is before startTime ${startTime.toISOString()} - excluding endTime`);
          }
          // Check 2: Suspicious exact midnight on same day with real start time (parsing artifact)
          else if (this.isSuspiciousMidnightEndTime(startTime, parsedEndTime)) {
            console.log(`[Storage] EndTime validation: suspicious exact 00:00 endTime on same day - excluding endTime`);
          }
          else {
            endTime = parsedEndTime;
          }
        }
        
        const eventData = {
          title: insertEvent.title,
          description: insertEvent.description,
          latitude: latitude,
          longitude: longitude,
          notificationReach: notificationReach,
          startTime: startTime,
          endTime: endTime,
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
      const [result] = await db.select().from(events).where(and(eq(events.id, id), isNull(events.deletedAt)));
      return result;
    });
  }

  async getEventsByRadius(lat: number, lng: number, radius: number, windowDays: number | null = null): Promise<Event[]> {
    try {
      console.log('Fetching events with params:', { lat, lng, radius, windowDays });
      const result = await db.select().from(events).where(isNull(events.deletedAt));

      const now = new Date();
      
      // Filter events op tijdsvenster (null = alle toekomstige events)
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
      return db.select().from(events).where(and(eq(events.hostId, hostId), isNull(events.deletedAt)));
    });
  }

  async clearEvents(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('clearEvents is not allowed in production environment');
    }
    return this.withRetry(async () => {
      await db.delete(events);
    });
  }

  async addFavorite(insertFavorite: InsertFavorite): Promise<Favorite | null> {
    return this.withRetry(async () => {
      // Check if favorite already exists
      const existing = await db
        .select()
        .from(favorites)
        .where(
          and(
            eq(favorites.userId, insertFavorite.userId),
            eq(favorites.eventId, insertFavorite.eventId)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        return null; // Already exists
      }
      
      const [result] = await db.insert(favorites).values(insertFavorite).returning();
      return result;
    });
  }

  async removeFavorite(userId: number, eventId: number): Promise<boolean> {
    return this.withRetry(async () => {
      const result = await db.delete(favorites)
        .where(
          and(
            eq(favorites.userId, userId),
            eq(favorites.eventId, eventId)
          )
        )
        .returning();
      
      return result.length > 0; // True if something was actually deleted
    });
  }

  async isFavorite(userId: number, eventId: number): Promise<boolean> {
    return this.withRetry(async () => {
      const result = await db
        .select()
        .from(favorites)
        .where(
          and(
            eq(favorites.userId, userId),
            eq(favorites.eventId, eventId)
          )
        )
        .limit(1);
      
      return result.length > 0;
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
      return db.select().from(events).where(isNull(events.deletedAt));
    });
  }
  
  async updateEvent(id: number, eventData: Partial<Event>): Promise<Event> {
    return this.withRetry(async () => {
      let validatedData = { ...eventData };
      
      // Validate endTime: if endTime is being set, validate it against startTime
      if (validatedData.endTime !== undefined && validatedData.endTime !== null) {
        // Get startTime from update data or fetch from existing event
        let startTime: Date | null = null;
        if (validatedData.startTime !== undefined) {
          startTime = validatedData.startTime instanceof Date 
            ? validatedData.startTime 
            : new Date(validatedData.startTime);
        } else {
          // Fetch existing event to get startTime
          const [existingEvent] = await db.select({ startTime: events.startTime })
            .from(events)
            .where(eq(events.id, id));
          if (existingEvent?.startTime) {
            startTime = existingEvent.startTime;
          }
        }
        
        if (startTime) {
          const endTime = validatedData.endTime instanceof Date 
            ? validatedData.endTime 
            : new Date(validatedData.endTime);
          
          if (endTime < startTime) {
            console.log(`[Storage] EndTime validation: endTime ${endTime.toISOString()} is before startTime ${startTime.toISOString()} - excluding endTime`);
            validatedData.endTime = null;
          }
          // Check 2: Suspicious exact midnight on same day with real start time
          else if (this.isSuspiciousMidnightEndTime(startTime, endTime)) {
            console.log(`[Storage] EndTime validation: suspicious exact 00:00 endTime on same day - excluding endTime`);
            validatedData.endTime = null;
          }
        }
      }
      
      const [result] = await db
        .update(events)
        .set(validatedData)
        .where(eq(events.id, id))
        .returning();
      return result;
    });
  }
  
  async deleteEvent(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, id));
    });
  }

  async hardDeleteEvent(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(events).where(eq(events.id, id));
    });
  }

  async restoreEvent(id: number): Promise<Event> {
    return this.withRetry(async () => {
      const [result] = await db.update(events).set({ deletedAt: null }).where(eq(events.id, id)).returning();
      return result;
    });
  }

  async incrementExternalPageOpens(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db
        .update(events)
        .set({ externalPageOpens: sql`COALESCE(${events.externalPageOpens}, 0) + 1` })
        .where(eq(events.id, id));
    });
  }

  async incrementDetailViews(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db
        .update(events)
        .set({ detailViews: sql`COALESCE(${events.detailViews}, 0) + 1` })
        .where(eq(events.id, id));
    });
  }

  async incrementSavesCount(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db
        .update(events)
        .set({ savesCount: sql`COALESCE(${events.savesCount}, 0) + 1` })
        .where(eq(events.id, id));
    });
  }

  async decrementSavesCount(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db
        .update(events)
        .set({ savesCount: sql`GREATEST(COALESCE(${events.savesCount}, 0) - 1, 0)` })
        .where(eq(events.id, id));
    });
  }
  
  async getEventCount(): Promise<number> {
    return this.withRetry(async () => {
      const result = await db.select({ count: count() }).from(events).where(isNull(events.deletedAt));
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

  async addEventSource(source: InsertEventSource): Promise<EventSource> {
    return this.withRetry(async () => {
      const [created] = await db.insert(eventSources).values(source).returning();
      return created;
    });
  }

  async getEventSources(eventId: number): Promise<EventSource[]> {
    return this.withRetry(async () => {
      return db.select()
        .from(eventSources)
        .where(eq(eventSources.eventId, eventId))
        .orderBy(desc(eventSources.isPrimary));
    });
  }

  async findEventSourceByUrl(eventId: number, sourceUrl: string): Promise<EventSource | undefined> {
    return this.withRetry(async () => {
      const [source] = await db.select()
        .from(eventSources)
        .where(and(
          eq(eventSources.eventId, eventId),
          eq(eventSources.sourceUrl, sourceUrl)
        ))
        .limit(1);
      return source;
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

  // Promoted Notification operations implementation
  async createPromotedNotification(promo: InsertPromotedNotification): Promise<PromotedNotification> {
    return this.withRetry(async () => {
      const [result] = await db.insert(promotedNotifications).values(promo).returning();
      return result;
    });
  }

  async getPromotedNotification(id: number): Promise<PromotedNotification | undefined> {
    return this.withRetry(async () => {
      const [promo] = await db.select().from(promotedNotifications).where(eq(promotedNotifications.id, id));
      return promo;
    });
  }

  async getAllPromotedNotifications(): Promise<PromotedNotification[]> {
    return this.withRetry(async () => {
      return await db.select().from(promotedNotifications).orderBy(desc(promotedNotifications.createdAt));
    });
  }

  async getActivePromotedNotifications(): Promise<PromotedNotification[]> {
    return this.withRetry(async () => {
      const now = new Date();
      return await db.select().from(promotedNotifications)
        .where(and(
          eq(promotedNotifications.isActive, true),
          sql`${promotedNotifications.startDate} <= ${now}`,
          sql`(${promotedNotifications.endDate} IS NULL OR ${promotedNotifications.endDate} >= ${now})`
        ))
        .orderBy(desc(promotedNotifications.createdAt));
    });
  }

  async updatePromotedNotification(id: number, promo: Partial<PromotedNotification>): Promise<PromotedNotification> {
    return this.withRetry(async () => {
      const [result] = await db.update(promotedNotifications)
        .set({ ...promo, updatedAt: new Date() })
        .where(eq(promotedNotifications.id, id))
        .returning();
      return result;
    });
  }

  async deletePromotedNotification(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(promotedNotifications).where(eq(promotedNotifications.id, id));
    });
  }

  async incrementPromotionImpression(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.update(promotedNotifications)
        .set({ impressions: sql`${promotedNotifications.impressions} + 1` })
        .where(eq(promotedNotifications.id, id));
    });
  }

  async incrementPromotionClick(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.update(promotedNotifications)
        .set({ clicks: sql`${promotedNotifications.clicks} + 1` })
        .where(eq(promotedNotifications.id, id));
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

  async deleteEventsByFeedId(feedId: number, confirmDeletion: boolean = false): Promise<void> {
    if (process.env.NODE_ENV === 'production' && !confirmDeletion) {
      throw new Error('deleteEventsByFeedId requires explicit confirmation in production. Pass confirmDeletion=true to proceed.');
    }
    return this.withRetry(async () => {
      // Find all events linked to this feed via rssFeedItems
      const linkedItems = await db.select({ eventId: rssFeedItems.eventId })
        .from(rssFeedItems)
        .where(and(
          eq(rssFeedItems.feedId, feedId),
          isNotNull(rssFeedItems.eventId)
        ));
      
      const eventIds = linkedItems
        .map(item => item.eventId)
        .filter((id): id is number => id !== null);
      
      if (eventIds.length > 0) {
        await db.delete(events).where(inArray(events.id, eventIds));
        console.log(`[Storage] Deleted ${eventIds.length} events linked to feed ${feedId}`);
      }
    });
  }

  async unlinkEventsFromFeed(feedId: number): Promise<void> {
    return this.withRetry(async () => {
      // Set eventId to null for all items linked to this feed (keeps events but removes feed connection)
      await db.update(rssFeedItems)
        .set({ eventId: null })
        .where(eq(rssFeedItems.feedId, feedId));
      console.log(`[Storage] Unlinked events from feed ${feedId}`);
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

  async getIncompleteItems(feedId?: number, status?: string): Promise<RssFeedItem[]> {
    return this.withRetry(async () => {
      const statuses = status === 'missing_date'
        ? ['missing_date']
        : status === 'all'
          ? ['incomplete', 'missing_date']
          : ['incomplete'];

      const conditions = [inArray(rssFeedItems.processingStatus, statuses)];
      if (feedId) conditions.push(eq(rssFeedItems.feedId, feedId));

      return await db.select().from(rssFeedItems)
        .where(and(...conditions))
        .orderBy(desc(rssFeedItems.createdAt));
    });
  }

  async getIncompleteItemsCount(feedId?: number, status?: string): Promise<number> {
    return this.withRetry(async () => {
      const statuses = status === 'missing_date'
        ? ['missing_date']
        : status === 'all'
          ? ['incomplete', 'missing_date']
          : ['incomplete'];

      const conditions = [inArray(rssFeedItems.processingStatus, statuses)];
      if (feedId) conditions.push(eq(rssFeedItems.feedId, feedId));

      const result = await db.select({ count: count() }).from(rssFeedItems)
        .where(and(...conditions));
      return result[0]?.count || 0;
    });
  }

  async updateRssFeedItem(id: number, item: Partial<RssFeedItem>): Promise<RssFeedItem> {
    return this.withRetry(async () => {
      const [updated] = await db.update(rssFeedItems)
        .set(item)
        .where(eq(rssFeedItems.id, id))
        .returning();
      return updated;
    });
  }

  async createRssFeedItem(item: InsertRssFeedItem): Promise<RssFeedItem> {
    return this.withRetry(async () => {
      const [created] = await db.insert(rssFeedItems).values([item]).returning();
      return created;
    });
  }

  async deleteRssFeedItem(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(rssFeedItems).where(eq(rssFeedItems.id, id));
    });
  }

  async getFeedItemsSummary(feedId: number): Promise<{ imported: number; incomplete: number; skipped: number }> {
    return this.withRetry(async () => {
      const importedResult = await db.select({ count: count() }).from(rssFeedItems)
        .where(and(
          eq(rssFeedItems.feedId, feedId),
          eq(rssFeedItems.processingStatus, 'imported')
        ));
      const incompleteResult = await db.select({ count: count() }).from(rssFeedItems)
        .where(and(
          eq(rssFeedItems.feedId, feedId),
          eq(rssFeedItems.processingStatus, 'incomplete')
        ));
      const skippedResult = await db.select({ count: count() }).from(rssFeedItems)
        .where(and(
          eq(rssFeedItems.feedId, feedId),
          eq(rssFeedItems.processingStatus, 'skipped')
        ));
      return {
        imported: importedResult[0]?.count || 0,
        incomplete: incompleteResult[0]?.count || 0,
        skipped: skippedResult[0]?.count || 0
      };
    });
  }

  async createCorrection(correction: InsertRssItemCorrection): Promise<RssItemCorrection> {
    return this.withRetry(async () => {
      const [created] = await db.insert(rssItemCorrections).values(correction).returning();
      return created;
    });
  }

  async getCorrectionsForFeed(feedId?: number): Promise<RssItemCorrection[]> {
    return this.withRetry(async () => {
      if (feedId) {
        return await db.select().from(rssItemCorrections)
          .where(eq(rssItemCorrections.feedId, feedId))
          .orderBy(desc(rssItemCorrections.createdAt));
      }
      return await db.select().from(rssItemCorrections)
        .orderBy(desc(rssItemCorrections.createdAt));
    });
  }

  async findMatchingCorrections(fieldKey: string, originalValue: string): Promise<RssItemCorrection[]> {
    return this.withRetry(async () => {
      const normalizedValue = originalValue.toLowerCase().trim();
      return await db.select().from(rssItemCorrections)
        .where(and(
          eq(rssItemCorrections.fieldKey, fieldKey),
          eq(rssItemCorrections.originalValuePattern, normalizedValue)
        ));
    });
  }

  async incrementCorrectionCount(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.update(rssItemCorrections)
        .set({ appliedCount: sql`${rssItemCorrections.appliedCount} + 1` })
        .where(eq(rssItemCorrections.id, id));
    });
  }

  async deleteCorrection(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(rssItemCorrections).where(eq(rssItemCorrections.id, id));
    });
  }

  async createSyncHistory(history: InsertFeedSyncHistory): Promise<FeedSyncHistory> {
    return this.withRetry(async () => {
      const [created] = await db.insert(feedSyncHistory).values(history).returning();
      return created;
    });
  }

  async getSyncHistoryForFeed(feedId: number, limit: number = 10): Promise<FeedSyncHistory[]> {
    return this.withRetry(async () => {
      return db.select()
        .from(feedSyncHistory)
        .where(eq(feedSyncHistory.feedId, feedId))
        .orderBy(desc(feedSyncHistory.syncedAt))
        .limit(limit);
    });
  }

  async getLatestSyncForFeed(feedId: number): Promise<FeedSyncHistory | undefined> {
    return this.withRetry(async () => {
      const [latest] = await db.select()
        .from(feedSyncHistory)
        .where(eq(feedSyncHistory.feedId, feedId))
        .orderBy(desc(feedSyncHistory.syncedAt))
        .limit(1);
      return latest;
    });
  }

  async getAverageSyncDurationForFeed(feedId: number): Promise<number | null> {
    return this.withRetry(async () => {
      const result = await db.select({
        avgDuration: sql<number>`ROUND(AVG(${feedSyncHistory.durationMs}))`.as('avg_duration')
      })
        .from(feedSyncHistory)
        .where(and(
          eq(feedSyncHistory.feedId, feedId),
          isNotNull(feedSyncHistory.durationMs)
        ));
      return result[0]?.avgDuration || null;
    });
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    return this.withRetry(async () => {
      const [created] = await db.insert(leads).values(lead).returning();
      return created;
    });
  }

  async getLeadByEmail(email: string): Promise<Lead | undefined> {
    return this.withRetry(async () => {
      const [lead] = await db.select().from(leads).where(eq(leads.email, email));
      return lead;
    });
  }

  async getLeadsByCitySlug(citySlug: string): Promise<Lead[]> {
    return this.withRetry(async () => {
      return await db.select().from(leads)
        .where(eq(leads.citySlug, citySlug))
        .orderBy(desc(leads.createdAt));
    });
  }

  async getAllLeads(): Promise<Lead[]> {
    return this.withRetry(async () => {
      return await db.select().from(leads).orderBy(desc(leads.createdAt));
    });
  }

  async getLeadCount(): Promise<number> {
    return this.withRetry(async () => {
      const result = await db.select({ count: count() }).from(leads);
      return result[0]?.count || 0;
    });
  }

  async createAiExtractionProfile(profile: InsertAiExtractionProfile): Promise<AiExtractionProfile> {
    return this.withRetry(async () => {
      const [created] = await db.insert(aiExtractionProfiles).values(profile).returning();
      return created;
    });
  }

  async getAiExtractionProfile(id: number): Promise<AiExtractionProfile | undefined> {
    return this.withRetry(async () => {
      const [profile] = await db.select().from(aiExtractionProfiles).where(eq(aiExtractionProfiles.id, id)).limit(1);
      return profile;
    });
  }

  async getAiExtractionProfileByDomain(domain: string): Promise<AiExtractionProfile | undefined> {
    return this.withRetry(async () => {
      const [profile] = await db.select().from(aiExtractionProfiles).where(eq(aiExtractionProfiles.domain, domain)).limit(1);
      return profile;
    });
  }

  async getAiExtractionProfileByDomainAndPath(domain: string, pathPattern: string): Promise<AiExtractionProfile | undefined> {
    return this.withRetry(async () => {
      const [profile] = await db.select().from(aiExtractionProfiles)
        .where(and(
          eq(aiExtractionProfiles.domain, domain),
          eq(aiExtractionProfiles.pathPattern, pathPattern)
        ))
        .limit(1);
      return profile;
    });
  }

  async updateAiExtractionProfile(id: number, profile: Partial<AiExtractionProfile>): Promise<AiExtractionProfile> {
    return this.withRetry(async () => {
      const [updated] = await db.update(aiExtractionProfiles)
        .set({ ...profile, updatedAt: new Date() })
        .where(eq(aiExtractionProfiles.id, id))
        .returning();
      return updated;
    });
  }

  async deleteAiExtractionProfile(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(aiExtractionProfiles).where(eq(aiExtractionProfiles.id, id));
    });
  }

  async getAllAiExtractionProfiles(): Promise<AiExtractionProfile[]> {
    return this.withRetry(async () => {
      return await db.select().from(aiExtractionProfiles).orderBy(desc(aiExtractionProfiles.updatedAt));
    });
  }

  async getEventsByCitySlug(citySlug: string, limit: number = 50): Promise<Event[]> {
    return this.withRetry(async () => {
      const { getCityBySlug } = await import('@shared/cities');
      const city = getCityBySlug(citySlug);
      if (!city) return [];

      const radiusKm = 15;
      const latDiff = radiusKm / 111;
      const lonDiff = radiusKm / (111 * Math.cos(city.latitude * Math.PI / 180));

      const now = new Date();
      return await db.select().from(events)
        .where(and(
          sql`${events.latitude}::float BETWEEN ${city.latitude - latDiff} AND ${city.latitude + latDiff}`,
          sql`${events.longitude}::float BETWEEN ${city.longitude - lonDiff} AND ${city.longitude + lonDiff}`,
          sql`${events.startTime} >= ${now}`
        ))
        .orderBy(events.startTime)
        .limit(limit);
    });
  }

  async getEventCountByCitySlug(citySlug: string): Promise<number> {
    return this.withRetry(async () => {
      const { getCityBySlug } = await import('@shared/cities');
      const city = getCityBySlug(citySlug);
      if (!city) return 0;

      const radiusKm = 15;
      const latDiff = radiusKm / 111;
      const lonDiff = radiusKm / (111 * Math.cos(city.latitude * Math.PI / 180));

      const now = new Date();
      const result = await db.select({ count: count() }).from(events)
        .where(and(
          sql`${events.latitude}::float BETWEEN ${city.latitude - latDiff} AND ${city.latitude + latDiff}`,
          sql`${events.longitude}::float BETWEEN ${city.longitude - lonDiff} AND ${city.longitude + lonDiff}`,
          sql`${events.startTime} >= ${now}`,
          isNull(events.deletedAt)
        ));
      return result[0]?.count || 0;
    });
  }

  // Venue operations
  async createVenue(venue: InsertVenue): Promise<Venue> {
    return this.withRetry(async () => {
      const normalizedName = venue.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const result = await db.insert(venues).values({
        ...venue,
        normalizedName,
      }).returning();
      return result[0];
    });
  }

  async getVenue(id: number): Promise<Venue | undefined> {
    return this.withRetry(async () => {
      const result = await db.select().from(venues).where(eq(venues.id, id));
      return result[0];
    });
  }

  async getVenueByName(name: string): Promise<Venue | undefined> {
    return this.withRetry(async () => {
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const result = await db.select().from(venues).where(eq(venues.normalizedName, normalizedName));
      return result[0];
    });
  }

  async getAllVenues(): Promise<Venue[]> {
    return this.withRetry(async () => {
      return db.select().from(venues).orderBy(venues.name);
    });
  }

  async searchVenues(query: string): Promise<Venue[]> {
    return this.withRetry(async () => {
      const searchTerm = `%${query.toLowerCase()}%`;
      return db.select().from(venues)
        .where(sql`LOWER(${venues.name}) LIKE ${searchTerm}`)
        .orderBy(venues.name)
        .limit(20);
    });
  }

  async updateVenue(id: number, venue: Partial<Venue>): Promise<Venue> {
    return this.withRetry(async () => {
      const result = await db.update(venues)
        .set({ ...venue, updatedAt: new Date() })
        .where(eq(venues.id, id))
        .returning();
      return result[0];
    });
  }

  async getEventsByVenue(venueId: number): Promise<Event[]> {
    return this.withRetry(async () => {
      return db.select().from(events)
        .where(eq(events.venueId, venueId))
        .orderBy(desc(events.startTime));
    });
  }

  async getVenueById(id: number): Promise<Venue | undefined> {
    return this.getVenue(id);
  }

  async deleteVenue(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(venues).where(eq(venues.id, id));
    });
  }

  async getEventsByVenueId(venueId: number): Promise<Event[]> {
    return this.getEventsByVenue(venueId);
  }

  async getVenueStats(): Promise<{ totalVenues: number; activeVenues: number; totalContacts: number; totalTasks: number; openTasks: number }> {
    return this.withRetry(async () => {
      const venueCount = await db.select({ count: count() }).from(venues);
      const activeCount = await db.select({ count: count() }).from(venues).where(eq(venues.status, 'active'));
      const contactCount = await db.select({ count: count() }).from(venueContacts);
      const taskCount = await db.select({ count: count() }).from(venueTasks);
      const openTaskCount = await db.select({ count: count() }).from(venueTasks)
        .where(and(sql`${venueTasks.status} != 'done'`, sql`${venueTasks.status} != 'cancelled'`));
      
      return {
        totalVenues: venueCount[0]?.count || 0,
        activeVenues: activeCount[0]?.count || 0,
        totalContacts: contactCount[0]?.count || 0,
        totalTasks: taskCount[0]?.count || 0,
        openTasks: openTaskCount[0]?.count || 0,
      };
    });
  }

  async discoverPotentialVenues(minEvents: number): Promise<Array<{ address: string; eventCount: number; sampleTitle: string }>> {
    return this.withRetry(async () => {
      const result = await db.execute(sql`
        SELECT address, COUNT(*) as event_count, MIN(title) as sample_title
        FROM events
        WHERE address IS NOT NULL AND address != ''
        GROUP BY address
        HAVING COUNT(*) >= ${minEvents}
        ORDER BY COUNT(*) DESC
        LIMIT 100
      `);
      return (result.rows as any[]).map(row => ({
        address: row.address,
        eventCount: parseInt(row.event_count),
        sampleTitle: row.sample_title,
      }));
    });
  }

  async createVenueFromLocation(address: string, name?: string): Promise<Venue> {
    return this.withRetry(async () => {
      const venueName = name || address.split(',')[0].trim();
      const normalizedName = venueName.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const result = await db.insert(venues).values({
        name: venueName,
        normalizedName,
        address,
        status: 'active',
      }).returning();
      
      return result[0];
    });
  }

  // Venue Contacts operations
  async getVenueContacts(venueId: number): Promise<VenueContact[]> {
    return this.withRetry(async () => {
      return db.select().from(venueContacts)
        .where(eq(venueContacts.venueId, venueId))
        .orderBy(desc(venueContacts.isPrimary), venueContacts.name);
    });
  }

  async createVenueContact(contact: InsertVenueContact): Promise<VenueContact> {
    return this.withRetry(async () => {
      const result = await db.insert(venueContacts).values(contact).returning();
      return result[0];
    });
  }

  async updateVenueContact(id: number, contact: Partial<VenueContact>): Promise<VenueContact> {
    return this.withRetry(async () => {
      const result = await db.update(venueContacts)
        .set({ ...contact, updatedAt: new Date() })
        .where(eq(venueContacts.id, id))
        .returning();
      return result[0];
    });
  }

  async deleteVenueContact(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(venueContacts).where(eq(venueContacts.id, id));
    });
  }

  // Venue Notes operations
  async getVenueNotes(venueId: number): Promise<VenueNote[]> {
    return this.withRetry(async () => {
      return db.select().from(venueNotes)
        .where(eq(venueNotes.venueId, venueId))
        .orderBy(desc(venueNotes.isPinned), desc(venueNotes.createdAt));
    });
  }

  async createVenueNote(note: InsertVenueNote & { userId: number }): Promise<VenueNote> {
    return this.withRetry(async () => {
      const result = await db.insert(venueNotes).values(note).returning();
      return result[0];
    });
  }

  async updateVenueNote(id: number, note: Partial<VenueNote>): Promise<VenueNote> {
    return this.withRetry(async () => {
      const result = await db.update(venueNotes)
        .set({ ...note, updatedAt: new Date() })
        .where(eq(venueNotes.id, id))
        .returning();
      return result[0];
    });
  }

  async deleteVenueNote(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(venueNotes).where(eq(venueNotes.id, id));
    });
  }

  // Venue Tasks operations
  async getVenueTasks(venueId: number): Promise<VenueTask[]> {
    return this.withRetry(async () => {
      return db.select().from(venueTasks)
        .where(eq(venueTasks.venueId, venueId))
        .orderBy(venueTasks.dueDate, desc(venueTasks.priority));
    });
  }

  async getAllVenueTasks(userId?: number): Promise<VenueTask[]> {
    return this.withRetry(async () => {
      if (userId) {
        return db.select().from(venueTasks)
          .where(eq(venueTasks.userId, userId))
          .orderBy(venueTasks.dueDate, desc(venueTasks.priority));
      }
      return db.select().from(venueTasks)
        .orderBy(venueTasks.dueDate, desc(venueTasks.priority));
    });
  }

  async createVenueTask(task: InsertVenueTask & { userId: number; createdByUserId: number }): Promise<VenueTask> {
    return this.withRetry(async () => {
      const result = await db.insert(venueTasks).values(task).returning();
      return result[0];
    });
  }

  async updateVenueTask(id: number, task: Partial<VenueTask>): Promise<VenueTask> {
    return this.withRetry(async () => {
      const updateData = { ...task, updatedAt: new Date() };
      if (task.status === 'done') {
        (updateData as any).completedAt = new Date();
      }
      const result = await db.update(venueTasks)
        .set(updateData)
        .where(eq(venueTasks.id, id))
        .returning();
      return result[0];
    });
  }

  async deleteVenueTask(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(venueTasks).where(eq(venueTasks.id, id));
    });
  }

  // Sponsor Campaigns operations
  async getSponsorCampaignsByVenue(venueId: number): Promise<SponsorCampaign[]> {
    return this.withRetry(async () => {
      return db.select().from(sponsorCampaigns)
        .where(eq(sponsorCampaigns.venueId, venueId))
        .orderBy(desc(sponsorCampaigns.createdAt));
    });
  }

  async getSponsorCampaignsByEvent(eventId: number): Promise<SponsorCampaign[]> {
    return this.withRetry(async () => {
      return db.select().from(sponsorCampaigns)
        .where(eq(sponsorCampaigns.eventId, eventId))
        .orderBy(desc(sponsorCampaigns.createdAt));
    });
  }

  async getAllSponsorCampaigns(): Promise<SponsorCampaign[]> {
    return this.withRetry(async () => {
      return db.select().from(sponsorCampaigns)
        .orderBy(desc(sponsorCampaigns.createdAt));
    });
  }

  async createSponsorCampaign(campaign: InsertSponsorCampaign & { createdByUserId: number }): Promise<SponsorCampaign> {
    return this.withRetry(async () => {
      const result = await db.insert(sponsorCampaigns).values(campaign).returning();
      return result[0];
    });
  }

  async updateSponsorCampaign(id: number, campaign: Partial<SponsorCampaign>): Promise<SponsorCampaign> {
    return this.withRetry(async () => {
      const result = await db.update(sponsorCampaigns)
        .set({ ...campaign, updatedAt: new Date() })
        .where(eq(sponsorCampaigns.id, id))
        .returning();
      return result[0];
    });
  }

  async deleteSponsorCampaign(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(sponsorCampaigns).where(eq(sponsorCampaigns.id, id));
    });
  }

  // Geocode cache operations
  async getGeocodeFromCache(addressQuery: string): Promise<{ latitude: number; longitude: number; displayName?: string } | null> {
    return this.withRetry(async () => {
      const normalizedQuery = addressQuery.toLowerCase().trim();
      const result = await db.select().from(geocodeCache)
        .where(eq(geocodeCache.addressQuery, normalizedQuery))
        .limit(1);
      
      if (result.length > 0) {
        // Update hit count and last used timestamp
        await db.update(geocodeCache)
          .set({ 
            hitCount: sql`${geocodeCache.hitCount} + 1`,
            lastUsedAt: new Date()
          })
          .where(eq(geocodeCache.id, result[0].id));
        
        return {
          latitude: result[0].latitude,
          longitude: result[0].longitude,
          displayName: result[0].displayName || undefined
        };
      }
      return null;
    });
  }

  async saveGeocodeToCache(data: { addressQuery: string; latitude: number; longitude: number; displayName?: string; municipality?: string }): Promise<void> {
    return this.withRetry(async () => {
      const normalizedQuery = data.addressQuery.toLowerCase().trim();
      try {
        await db.insert(geocodeCache).values({
          addressQuery: normalizedQuery,
          latitude: data.latitude,
          longitude: data.longitude,
          displayName: data.displayName,
          municipality: data.municipality,
        }).onConflictDoUpdate({
          target: geocodeCache.addressQuery,
          set: {
            latitude: data.latitude,
            longitude: data.longitude,
            displayName: data.displayName,
            municipality: data.municipality,
            lastUsedAt: new Date(),
          }
        });
      } catch (error) {
        // Ignore duplicate key errors
        console.log('[GeocodeCache] Cache entry already exists for:', normalizedQuery);
      }
    });
  }

  async getGeocodeCacheStats(): Promise<{ totalEntries: number; totalHits: number }> {
    return this.withRetry(async () => {
      const stats = await db.select({
        totalEntries: count(),
        totalHits: sql<number>`COALESCE(SUM(${geocodeCache.hitCount}), 0)`
      }).from(geocodeCache);
      
      return {
        totalEntries: stats[0]?.totalEntries || 0,
        totalHits: Number(stats[0]?.totalHits) || 0
      };
    });
  }

  // Quality Check operations
  async createQualityCheck(check: InsertFeedQualityCheck): Promise<FeedQualityCheck> {
    return this.withRetry(async () => {
      const result = await db.insert(feedQualityChecks).values(check).returning();
      return result[0];
    });
  }

  async getQualityCheck(id: number): Promise<FeedQualityCheck | undefined> {
    return this.withRetry(async () => {
      const result = await db.select().from(feedQualityChecks).where(eq(feedQualityChecks.id, id));
      return result[0];
    });
  }

  async getQualityChecksByFeed(feedId: number): Promise<FeedQualityCheck[]> {
    return this.withRetry(async () => {
      return db.select().from(feedQualityChecks)
        .where(eq(feedQualityChecks.feedId, feedId))
        .orderBy(desc(feedQualityChecks.createdAt));
    });
  }

  async getLatestQualityCheck(feedId: number): Promise<FeedQualityCheck | undefined> {
    return this.withRetry(async () => {
      const result = await db.select().from(feedQualityChecks)
        .where(eq(feedQualityChecks.feedId, feedId))
        .orderBy(desc(feedQualityChecks.createdAt))
        .limit(1);
      return result[0];
    });
  }

  async updateQualityCheck(id: number, check: Partial<FeedQualityCheck>): Promise<FeedQualityCheck> {
    return this.withRetry(async () => {
      const result = await db.update(feedQualityChecks)
        .set(check)
        .where(eq(feedQualityChecks.id, id))
        .returning();
      return result[0];
    });
  }

  async deleteQualityCheck(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(feedQualityChecks).where(eq(feedQualityChecks.id, id));
    });
  }

  // Quality Check Issues operations
  async createQualityIssue(issue: InsertQualityCheckIssue): Promise<QualityCheckIssue> {
    return this.withRetry(async () => {
      const result = await db.insert(qualityCheckIssues).values(issue).returning();
      return result[0];
    });
  }

  async getQualityIssuesByCheck(checkId: number): Promise<QualityCheckIssue[]> {
    return this.withRetry(async () => {
      return db.select().from(qualityCheckIssues)
        .where(eq(qualityCheckIssues.qualityCheckId, checkId))
        .orderBy(desc(qualityCheckIssues.createdAt));
    });
  }

  async getUnresolvedIssuesByFeed(feedId: number): Promise<QualityCheckIssue[]> {
    return this.withRetry(async () => {
      const latestCheck = await this.getLatestQualityCheck(feedId);
      if (!latestCheck) return [];
      
      return db.select().from(qualityCheckIssues)
        .where(and(
          eq(qualityCheckIssues.qualityCheckId, latestCheck.id),
          eq(qualityCheckIssues.isResolved, false)
        ))
        .orderBy(desc(qualityCheckIssues.createdAt));
    });
  }

  async resolveQualityIssue(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.update(qualityCheckIssues)
        .set({ isResolved: true, resolvedAt: new Date() })
        .where(eq(qualityCheckIssues.id, id));
    });
  }

  async deleteQualityIssuesByCheck(checkId: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(qualityCheckIssues).where(eq(qualityCheckIssues.qualityCheckId, checkId));
    });
  }

  // ===== Event Tags operations =====
  async getEventTags(): Promise<EventTag[]> {
    return this.withRetry(async () => {
      return await db.select().from(eventTags).orderBy(eventTags.group, eventTags.sortOrder);
    });
  }

  async createEventTag(tag: InsertEventTag): Promise<EventTag> {
    return this.withRetry(async () => {
      const [newTag] = await db.insert(eventTags).values(tag).returning();
      return newTag;
    });
  }

  async updateEventTag(id: number, tag: Partial<EventTag>): Promise<EventTag> {
    return this.withRetry(async () => {
      const [updated] = await db.update(eventTags)
        .set({ ...tag, updatedAt: new Date() })
        .where(eq(eventTags.id, id))
        .returning();
      return updated;
    });
  }

  async deleteEventTag(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(eventTags).where(eq(eventTags.id, id));
    });
  }

  // ===== Target Audiences operations =====
  async getTargetAudiences(): Promise<TargetAudience[]> {
    return this.withRetry(async () => {
      return await db.select().from(targetAudiences).orderBy(targetAudiences.sortOrder);
    });
  }

  async createTargetAudience(audience: InsertTargetAudience): Promise<TargetAudience> {
    return this.withRetry(async () => {
      const [newAudience] = await db.insert(targetAudiences).values(audience).returning();
      return newAudience;
    });
  }

  async updateTargetAudience(id: number, audience: Partial<TargetAudience>): Promise<TargetAudience> {
    return this.withRetry(async () => {
      const [updated] = await db.update(targetAudiences)
        .set(audience)
        .where(eq(targetAudiences.id, id))
        .returning();
      return updated;
    });
  }

  async deleteTargetAudience(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(targetAudiences).where(eq(targetAudiences.id, id));
    });
  }

  // ===== Seasonal Themes operations =====
  async getSeasonalThemes(): Promise<SeasonalTheme[]> {
    return this.withRetry(async () => {
      return await db.select().from(seasonalThemes).orderBy(seasonalThemes.sortOrder);
    });
  }

  async createSeasonalTheme(theme: InsertSeasonalTheme): Promise<SeasonalTheme> {
    return this.withRetry(async () => {
      const [newTheme] = await db.insert(seasonalThemes).values(theme).returning();
      return newTheme;
    });
  }

  async updateSeasonalTheme(id: number, theme: Partial<SeasonalTheme>): Promise<SeasonalTheme> {
    return this.withRetry(async () => {
      const [updated] = await db.update(seasonalThemes)
        .set(theme)
        .where(eq(seasonalThemes.id, id))
        .returning();
      return updated;
    });
  }

  async deleteSeasonalTheme(id: number): Promise<void> {
    return this.withRetry(async () => {
      await db.delete(seasonalThemes).where(eq(seasonalThemes.id, id));
    });
  }

  // ===== Premium Features operations =====
  async getPremiumFeatures(): Promise<PremiumFeature[]> {
    return this.withRetry(async () => {
      return await db.select().from(premiumFeatures).orderBy(premiumFeatures.sortOrder);
    });
  }

  async createPremiumFeature(feature: InsertPremiumFeature): Promise<PremiumFeature> {
    return this.withRetry(async () => {
      const [newFeature] = await db.insert(premiumFeatures).values(feature).returning();
      return newFeature;
    });
  }

  // ===== API Usage Tracking operations =====
  async trackApiUsage(endpoint: string, wasBlocked: boolean = false): Promise<void> {
    try {
      // Round to current hour
      const now = new Date();
      const hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
      
      // Simplify endpoint (remove query params and IDs)
      const simplifiedEndpoint = endpoint.split('?')[0].replace(/\/\d+/g, '/:id');
      
      // Try to update existing record or insert new one
      const existing = await db.select().from(apiUsageStats)
        .where(and(
          eq(apiUsageStats.hour, hour),
          eq(apiUsageStats.endpoint, simplifiedEndpoint)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(apiUsageStats)
          .set({
            requestCount: sql`${apiUsageStats.requestCount} + 1`,
            blockedRequests: wasBlocked 
              ? sql`${apiUsageStats.blockedRequests} + 1` 
              : apiUsageStats.blockedRequests,
            updatedAt: new Date(),
          })
          .where(eq(apiUsageStats.id, existing[0].id));
      } else {
        await db.insert(apiUsageStats).values({
          hour,
          endpoint: simplifiedEndpoint,
          requestCount: 1,
          uniqueIps: 1,
          blockedRequests: wasBlocked ? 1 : 0,
        });
      }
    } catch (error) {
      // Don't throw - tracking shouldn't break the app
      console.error('[API Usage] Failed to track usage:', error);
    }
  }

  async getApiUsageStats(hoursBack: number = 24): Promise<ApiUsageStats[]> {
    return this.withRetry(async () => {
      const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
      return await db.select().from(apiUsageStats)
        .where(sql`${apiUsageStats.hour} >= ${cutoff}`)
        .orderBy(desc(apiUsageStats.hour));
    });
  }

  async getApiUsageSummary(): Promise<{
    last24h: { requests: number; blocked: number };
    lastHour: { requests: number; blocked: number };
    averageHourly: number;
    peakHour: { hour: Date; requests: number } | null;
    isSpike: boolean;
  }> {
    return this.withRetry(async () => {
      const stats = await this.getApiUsageStats(24);
      
      const now = new Date();
      const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
      const oneHourAgo = new Date(currentHour.getTime() - 60 * 60 * 1000);
      
      // Last hour stats
      const lastHourStats = stats.filter(s => s.hour >= oneHourAgo);
      const lastHour = {
        requests: lastHourStats.reduce((sum, s) => sum + s.requestCount, 0),
        blocked: lastHourStats.reduce((sum, s) => sum + s.blockedRequests, 0),
      };
      
      // Last 24h stats
      const last24h = {
        requests: stats.reduce((sum, s) => sum + s.requestCount, 0),
        blocked: stats.reduce((sum, s) => sum + s.blockedRequests, 0),
      };
      
      // Average hourly (excluding current hour)
      const historicalStats = stats.filter(s => s.hour < currentHour);
      const uniqueHours = new Set(historicalStats.map(s => s.hour.getTime())).size;
      const averageHourly = uniqueHours > 0 
        ? historicalStats.reduce((sum, s) => sum + s.requestCount, 0) / uniqueHours 
        : 0;
      
      // Peak hour
      const hourlyTotals = new Map<number, number>();
      stats.forEach(s => {
        const hourKey = s.hour.getTime();
        hourlyTotals.set(hourKey, (hourlyTotals.get(hourKey) || 0) + s.requestCount);
      });
      
      let peakHour: { hour: Date; requests: number } | null = null;
      hourlyTotals.forEach((requests, hourKey) => {
        if (!peakHour || requests > peakHour.requests) {
          peakHour = { hour: new Date(hourKey), requests };
        }
      });
      
      // Spike detection: current hour > 200% of average
      const isSpike = averageHourly > 0 && lastHour.requests > averageHourly * 2;
      
      return { last24h, lastHour, averageHourly, peakHour, isSpike };
    });
  }
}

export const storage = new PgStorage();