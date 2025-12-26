import { pgTable, text, varchar, serial, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const CATEGORIES = [
  'Sport en spel',
  'Kunst en Cultuur',
  'Gezellig en Sociaal',
  'Leren en Ontdekken',
  'Vrijwilligerswerk en hulp'
] as const;

export const ACTIVITY_TYPES = [
  'login',
  'logout',
  'create_event',
  'update_event',
  'delete_event',
  'join_event',
  'leave_event',
  'favorite_event',
  'unfavorite_event',
  'create_user',
  'update_user',
  'admin_action'
] as const;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  avatar: text("avatar"),
  photoUrl: text("photo_url"),
  googleId: text("google_id"),
  role: text("role").default("user").notNull(),
  isPremium: boolean("is_premium").default(false).notNull(),
  name: text("name"),
  phone: text("phone"),
  location: text("user_location"),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  latitude: decimal("latitude").notNull(),
  longitude: decimal("longitude").notNull(),
  address: text("address"),
  notificationReach: decimal("notification_reach").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  category: text("category").notNull(),
  secondaryCategory: text("secondary_category"),
  isPaid: boolean("is_paid").default(false),
  price: decimal("price"),
  maxParticipants: integer("max_participants"),
  hostId: integer("host_id").notNull(),
  recurrence: text("recurrence").notNull().default('once'),
  tags: text("tags").array(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Highlight/sponsoring system
  isHighlighted: boolean("is_highlighted").default(false),
  highlightStartDate: timestamp("highlight_start_date"),
  highlightEndDate: timestamp("highlight_end_date"),
  highlightPriority: integer("highlight_priority").default(0), // Higher numbers = higher priority
});

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventId: integer("event_id").notNull(),
});

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventId: integer("event_id").notNull(),
  status: text("status").notNull(),
});

export const savedSearches = pgTable("saved_searches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  filters: jsonb("filters").notNull(),
  pushEnabled: boolean("push_enabled").default(true),
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  activityType: text("activity_type").notNull(),
  entityId: integer("entity_id"),
  entityType: text("entity_type"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'event_change', 'event_reminder', 'event_cancelled'
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const RSS_FEED_TYPES = ['rss', 'atom', 'scraper'] as const;
export const RSS_FEED_STATUS = ['active', 'paused', 'error'] as const;
export const RSS_ITEM_STATUS = ['imported', 'incomplete', 'skipped'] as const;

export const rssFeeds = pgTable("rss_feeds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  feedType: text("feed_type").notNull().default('rss'),
  status: text("status").notNull().default('active'),
  defaultCategory: text("default_category").notNull(),
  defaultLatitude: decimal("default_latitude"),
  defaultLongitude: decimal("default_longitude"),
  defaultAddress: text("default_address"),
  municipality: text("municipality"),
  province: text("province"),
  updateFrequencyMinutes: integer("update_frequency_minutes").notNull().default(60),
  lastFetchedAt: timestamp("last_fetched_at"),
  lastErrorMessage: text("last_error_message"),
  itemsImported: integer("items_imported").default(0),
  autoCreateEvents: boolean("auto_create_events").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rssFeedItems = pgTable("rss_feed_items", {
  id: serial("id").primaryKey(),
  feedId: integer("feed_id").references(() => rssFeeds.id, { onDelete: "cascade" }).notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  link: text("link"),
  imageUrl: text("image_url"),
  publishedAt: timestamp("published_at"),
  rawData: jsonb("raw_data"),
  eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
  isProcessed: boolean("is_processed").default(false),
  processingStatus: text("processing_status").default('incomplete'),
  missingFields: jsonb("missing_fields").$type<string[]>(),
  derivedData: jsonb("derived_data").$type<{
    geocodedAddress?: string;
    geocodedLat?: number;
    geocodedLng?: number;
    parsedStartDate?: string;
    parsedEndDate?: string;
    detectedVenue?: string;
    validationErrors?: string[];
  }>(),
  lastAttemptedAt: timestamp("last_attempted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rssItemCorrections = pgTable("rss_item_corrections", {
  id: serial("id").primaryKey(),
  feedId: integer("feed_id").references(() => rssFeeds.id, { onDelete: "cascade" }),
  fieldKey: text("field_key").notNull(),
  originalValuePattern: text("original_value_pattern").notNull(),
  correctedValue: jsonb("corrected_value").notNull(),
  appliedCount: integer("applied_count").default(0),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  avatar: true,
  photoUrl: true,
  googleId: true,
  role: true,
});

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  notificationReach: z.number(),
  locationName: z.string().optional(),
});

export const insertEventSchema = z.object({
  title: z.string().max(40, "Titel mag maximaal 40 karakters bevatten"),
  description: z.string(),
  // Maak location optioneel en voeg direct de aparte latitude/longitude velden toe
  location: locationSchema.optional(),
  // Direct latitude/longitude ondersteuning
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  address: z.string().optional(),
  // Notification reach moet altijd beschikbaar zijn
  notificationReach: z.number().default(1.5),
  category: z.enum(CATEGORIES, {
    required_error: "Kies een categorie",
    invalid_type_error: "Ongeldige categorie"
  }),
  secondaryCategory: z.enum(CATEGORIES).optional(),
  startTime: z.string().or(z.date()).transform((val) => {
    if (!val) throw new Error("Starttijd is verplicht");
    return val;
  }),
  endTime: z.string().or(z.date()).optional().nullable(),
  isPaid: z.boolean().default(false),
  price: z.number().optional().nullable(),
  maxParticipants: z.number().optional().nullable(), // Let op: Added nullable() to fix form submission
  hostId: z.number().optional(), // Wordt ingesteld door de backend op basis van ingelogde gebruiker
  recurrence: z.enum(['once', 'daily', 'weekly', 'monthly']).default('once'),
  tags: z.array(z.string()).max(5, "Maximaal 5 tags toegestaan"),
  imageUrl: z.string().optional(),
});

export const insertFavoriteSchema = createInsertSchema(favorites).pick({
  userId: true,
  eventId: true,
});

export const insertParticipantSchema = createInsertSchema(participants).pick({
  userId: true,
  eventId: true,
  status: true,
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches).pick({
  userId: true,
  name: true,
  filters: true,
  pushEnabled: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).pick({
  userId: true,
  activityType: true,
  entityId: true,
  entityType: true,
  details: true,
  ipAddress: true,
  userAgent: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  eventId: true,
  type: true,
  title: true,
  message: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
// We define EventInterface directly instead of extending Event type
export interface EventInterface {
  id: number;
  title: string;
  description: string;
  latitude: string | number;
  longitude: string | number;
  address?: string;
  notificationReach: string | number;
  startTime: string | Date;
  endTime?: string | Date | null;
  category: string;
  secondaryCategory?: string | null;
  isPaid: boolean;
  price?: string | number | null;
  maxParticipants?: number | null;
  hostId: number;
  recurrence: string;
  tags?: string[] | null;
  imageUrl?: string | null;
  createdAt?: string | Date;
}
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const insertRssFeedSchema = createInsertSchema(rssFeeds).omit({
  id: true,
  createdAt: true,
  lastFetchedAt: true,
  lastErrorMessage: true,
  itemsImported: true,
});

export const insertRssFeedItemSchema = createInsertSchema(rssFeedItems).omit({
  id: true,
  createdAt: true,
});

export type RssFeed = typeof rssFeeds.$inferSelect;
export type InsertRssFeed = z.infer<typeof insertRssFeedSchema>;
export type RssFeedItem = typeof rssFeedItems.$inferSelect;
export type InsertRssFeedItem = z.infer<typeof insertRssFeedItemSchema>;
export type RssItemCorrection = typeof rssItemCorrections.$inferSelect;

export const insertRssItemCorrectionSchema = createInsertSchema(rssItemCorrections).omit({
  id: true,
  createdAt: true,
  appliedCount: true,
});
export type InsertRssItemCorrection = z.infer<typeof insertRssItemCorrectionSchema>;

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  citySlug: text("city_slug"),
  source: text("source").default('website'),
  isSubscribed: boolean("is_subscribed").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;