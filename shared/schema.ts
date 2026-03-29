import { pgTable, text, varchar, serial, integer, boolean, timestamp, jsonb, decimal, unique, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const CATEGORIES = [
  'Tentoonstelling',
  'Voorstelling',
  'Activiteit',
  'Stappen & Borrel',
  'Markt & Beurs',
  'Quiz & Spelletjes',
  'Leren & Ontdekken',
  'Eten & Drinken',
] as const;

// Event Tags - specifieke beschrijvingen van wat voor evenement het is
export const eventTags = pgTable("event_tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull(), // Lucide icon name (e.g., "Music", "Theater")
  group: text("group").notNull(), // Grouping for UI (e.g., "Muziek", "Podiumkunsten")
  keywords: text("keywords").array().notNull(), // Keywords for auto-matching
  parentCategory: text("parent_category"), // Category override when this tag is matched
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Target Audiences - doelgroepen
export const targetAudiences = pgTable("target_audiences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull(), // Lucide icon name
  keywords: text("keywords").array().notNull(), // Keywords for auto-matching
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Seasonal Themes - periode-gebonden thema's
export const seasonalThemes = pgTable("seasonal_themes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull(), // Lucide icon name
  keywords: text("keywords").array().notNull(), // Keywords for auto-matching
  // Date range can be fixed dates or calculated
  startMonth: integer("start_month"), // 1-12
  startDay: integer("start_day"), // 1-31
  endMonth: integer("end_month"), // 1-12
  endDay: integer("end_day"), // 1-31
  // For floating holidays like Easter, Carnival
  isFloating: boolean("is_floating").default(false),
  floatingRule: text("floating_rule"), // e.g., "easter-2-weeks", "carnival-period"
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Event-Tag mappings (many-to-many)
export const eventTagMappings = pgTable("event_tag_mappings", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  tagId: integer("tag_id").references(() => eventTags.id, { onDelete: "cascade" }).notNull(),
  isAutoDetected: boolean("is_auto_detected").default(false), // Was this auto-matched or manually set?
  confidence: decimal("confidence"), // Confidence score for auto-detected (0-1)
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueEventTag: unique().on(table.eventId, table.tagId),
}));

// Event-Audience mappings (many-to-many)
export const eventAudienceMappings = pgTable("event_audience_mappings", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  audienceId: integer("audience_id").references(() => targetAudiences.id, { onDelete: "cascade" }).notNull(),
  isAutoDetected: boolean("is_auto_detected").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueEventAudience: unique().on(table.eventId, table.audienceId),
}));

// Event-Theme mappings (many-to-many)
export const eventThemeMappings = pgTable("event_theme_mappings", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  themeId: integer("theme_id").references(() => seasonalThemes.id, { onDelete: "cascade" }).notNull(),
  isAutoDetected: boolean("is_auto_detected").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueEventTheme: unique().on(table.eventId, table.themeId),
}));

// Types
export type EventTag = typeof eventTags.$inferSelect;
export type InsertEventTag = typeof eventTags.$inferInsert;
export type TargetAudience = typeof targetAudiences.$inferSelect;
export type InsertTargetAudience = typeof targetAudiences.$inferInsert;
export type SeasonalTheme = typeof seasonalThemes.$inferSelect;
export type InsertSeasonalTheme = typeof seasonalThemes.$inferInsert;
export type EventTagMapping = typeof eventTagMappings.$inferSelect;
export type EventAudienceMapping = typeof eventAudienceMappings.$inferSelect;
export type EventThemeMapping = typeof eventThemeMappings.$inferSelect;

// Insert schemas
export const insertEventTagSchema = createInsertSchema(eventTags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTargetAudienceSchema = createInsertSchema(targetAudiences).omit({
  id: true,
  createdAt: true,
});

export const insertSeasonalThemeSchema = createInsertSchema(seasonalThemes).omit({
  id: true,
  createdAt: true,
});

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
  preferences: jsonb("preferences"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiry: timestamp("email_verification_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const hiddenEvents = pgTable("hidden_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventId: integer("event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("hidden_events_user_event").on(table.userId, table.eventId),
]);

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
  hostId: integer("host_id"),
  recurrence: text("recurrence").notNull().default('once'),
  tags: text("tags").array(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Highlight/sponsoring system
  isHighlighted: boolean("is_highlighted").default(false),
  highlightStartDate: timestamp("highlight_start_date"),
  highlightEndDate: timestamp("highlight_end_date"),
  highlightPriority: integer("highlight_priority").default(0), // Higher numbers = higher priority
  // External link and tracking
  externalUrl: text("external_url"), // Link to external event page (from RSS feeds)
  externalPageOpens: integer("external_page_opens").default(0), // Track how often external page is opened
  savesCount: integer("saves_count").default(0), // Track how often event is saved/favorited
  detailViews: integer("detail_views").default(0), // Track how often event detail page is viewed
  // Venue reference
  venueId: integer("venue_id"), // References venues.id
  // New tag system (replaces old category system)
  eventTagIds: integer("event_tag_ids").array(), // References eventTags.id
  targetAudienceIds: integer("target_audience_ids").array(), // References targetAudiences.id
  seasonalThemeIds: integer("seasonal_theme_ids").array(), // References seasonalThemes.id
  deletedAt: timestamp("deleted_at"),
});

export const eventSources = pgTable("event_sources", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  feedId: integer("feed_id").references(() => rssFeeds.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  sourceName: text("source_name").notNull(),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type EventSource = typeof eventSources.$inferSelect;
export type InsertEventSource = typeof eventSources.$inferInsert;

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventId: integer("event_id").notNull(),
}, (table) => ({
  uniqueUserEvent: unique().on(table.userId, table.eventId),
}));

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

// Betaalde promotie-notificaties die naar gebruikers worden gepusht
export const promotedNotifications = pgTable("promoted_notifications", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  // Targeting opties
  targetRadius: integer("target_radius"), // Radius in km rond event locatie
  targetCity: text("target_city"), // Specifieke stad
  targetAllUsers: boolean("target_all_users").default(false),
  // Campagne details
  campaignName: text("campaign_name"),
  advertiserName: text("advertiser_name"),
  advertiserEmail: text("advertiser_email"),
  // Status en timing
  isActive: boolean("is_active").default(true).notNull(),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
  // Statistieken
  impressions: integer("impressions").default(0).notNull(),
  clicks: integer("clicks").default(0).notNull(),
  // Kosten
  budgetCents: integer("budget_cents").default(0), // Budget in centen
  cpmCents: integer("cpm_cents").default(0), // Cost per 1000 impressions in centen
  // Metadata
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'event_change', 'event_reminder_48h', 'event_reminder_24h', 'event_reminder_1h', 'event_cancelled', 'promotion'
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  promotionId: integer("promotion_id").references(() => promotedNotifications.id, { onDelete: "cascade" }),
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
  aiExtractionProfileId: integer("ai_extraction_profile_id"),
  scraperConfig: jsonb("scraper_config"),
  fieldMappings: jsonb("field_mappings").$type<Record<string, string>>(),
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

export const feedSyncHistory = pgTable("feed_sync_history", {
  id: serial("id").primaryKey(),
  feedId: integer("feed_id").references(() => rssFeeds.id, { onDelete: "cascade" }).notNull(),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
  durationMs: integer("duration_ms"),
  totalFound: integer("total_found").default(0),
  afterMerge: integer("after_merge").default(0),
  newEvents: integer("new_events").default(0),
  updatedEvents: integer("updated_events").default(0),
  incompleteEvents: integer("incomplete_events").default(0),
  skippedEvents: integer("skipped_events").default(0),
  incompleteReasons: jsonb("incomplete_reasons").$type<Record<string, number>>(),
  errorMessage: text("error_message"),
  success: boolean("success").default(true),
});

export type FeedSyncHistory = typeof feedSyncHistory.$inferSelect;
export type InsertFeedSyncHistory = typeof feedSyncHistory.$inferInsert;

export const venues = pgTable("venues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  municipality: text("municipality"),
  address: text("address"),
  postalCode: text("postal_code"),
  city: text("city"),
  latitude: decimal("latitude"),
  longitude: decimal("longitude"),
  sourceUrl: text("source_url"),
  usageCount: integer("usage_count").default(1),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  slug: text("slug"),
  description: text("description"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  websiteUrl: text("website_url"),
  imageUrl: text("image_url"),
  category: text("category"),
  isVerified: boolean("is_verified").default(false),
  claimedByUserId: integer("claimed_by_user_id").references(() => users.id),
  claimedAt: timestamp("claimed_at"),
  status: text("status").default("active").$type<"active" | "pending" | "archived">(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Venue = typeof venues.$inferSelect;
export type InsertVenue = typeof venues.$inferInsert;

export const venueOrganizers = pgTable("venue_organizers", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id").notNull().references(() => venues.id),
  userId: integer("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("admin").$type<"owner" | "admin" | "editor">(),
  status: text("status").notNull().default("active").$type<"active" | "pending" | "revoked">(),
  invitedByUserId: integer("invited_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type VenueOrganizer = typeof venueOrganizers.$inferSelect;
export type InsertVenueOrganizer = typeof venueOrganizers.$inferInsert;

// Venue CRM: Contactpersonen
export const venueContacts = pgTable("venue_contacts", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"), // e.g., "Programmeur", "Marketing", "Directeur"
  email: text("email"),
  phone: text("phone"),
  isPrimary: boolean("is_primary").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type VenueContact = typeof venueContacts.$inferSelect;
export type InsertVenueContact = typeof venueContacts.$inferInsert;

// Venue CRM: Notities
export const venueNotes = pgTable("venue_notes", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type VenueNote = typeof venueNotes.$inferSelect;
export type InsertVenueNote = typeof venueNotes.$inferInsert;

// Venue CRM: Taken
export const venueTasks = pgTable("venue_tasks", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id), // Assigned to
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  priority: text("priority").default("medium").$type<"low" | "medium" | "high" | "urgent">(),
  status: text("status").default("todo").$type<"todo" | "in_progress" | "done" | "cancelled">(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type VenueTask = typeof venueTasks.$inferSelect;
export type InsertVenueTask = typeof venueTasks.$inferInsert;

// Sponsor Campaigns (voor venues of specifieke events)
export const sponsorCampaigns = pgTable("sponsor_campaigns", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id").references(() => venues.id, { onDelete: "cascade" }), // Optioneel - voor venue-brede campagnes
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }), // Optioneel - voor event-specifieke campagnes
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  sponsorName: text("sponsor_name"), // Naam van de sponsor
  sponsorContact: text("sponsor_contact"), // Contactpersoon bij sponsor
  sponsorEmail: text("sponsor_email"),
  sponsorPhone: text("sponsor_phone"),
  campaignType: text("campaign_type").default("visibility").$type<"visibility" | "financial" | "in_kind" | "media" | "other">(),
  value: integer("value"), // Waarde in centen
  currency: text("currency").default("EUR"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").default("draft").$type<"draft" | "proposed" | "active" | "completed" | "cancelled">(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SponsorCampaign = typeof sponsorCampaigns.$inferSelect;
export type InsertSponsorCampaign = typeof sponsorCampaigns.$inferInsert;

export const feedFieldMappings = pgTable("feed_field_mappings", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  mappings: jsonb("mappings").notNull().$type<Record<string, string>>(),
  usageCount: integer("usage_count").default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type FeedFieldMapping = typeof feedFieldMappings.$inferSelect;
export type InsertFeedFieldMapping = typeof feedFieldMappings.$inferInsert;

export const QUALITY_CHECK_STATUS = ['pending', 'running', 'completed', 'failed'] as const;
export const QUALITY_ISSUE_SEVERITY = ['error', 'warning', 'info'] as const;

export const feedQualityChecks = pgTable("feed_quality_checks", {
  id: serial("id").primaryKey(),
  feedId: integer("feed_id").references(() => rssFeeds.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull().default('pending').$type<typeof QUALITY_CHECK_STATUS[number]>(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalEventsChecked: integer("total_events_checked").default(0),
  eventsWithIssues: integer("events_with_issues").default(0),
  overallScore: integer("overall_score"), // 0-100
  usedGemini: boolean("used_gemini").default(false),
  geminiSampleSize: integer("gemini_sample_size").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const qualityCheckIssues = pgTable("quality_check_issues", {
  id: serial("id").primaryKey(),
  qualityCheckId: integer("quality_check_id").references(() => feedQualityChecks.id, { onDelete: "cascade" }).notNull(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }),
  feedItemId: integer("feed_item_id").references(() => rssFeedItems.id, { onDelete: "cascade" }),
  issueType: text("issue_type").notNull(), // 'missing_image', 'broken_image', 'short_description', 'invalid_date', 'location_outside_nl', 'source_mismatch'
  severity: text("severity").notNull().default('warning').$type<typeof QUALITY_ISSUE_SEVERITY[number]>(),
  field: text("field"), // Which field has the issue
  message: text("message").notNull(),
  sourceValue: text("source_value"), // Value from source (for comparison checks)
  importedValue: text("imported_value"), // Value we imported
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FeedQualityCheck = typeof feedQualityChecks.$inferSelect;
export type InsertFeedQualityCheck = typeof feedQualityChecks.$inferInsert;
export type QualityCheckIssue = typeof qualityCheckIssues.$inferSelect;
export type InsertQualityCheckIssue = typeof qualityCheckIssues.$inferInsert;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  avatar: true,
  photoUrl: true,
  googleId: true,
  role: true,
  name: true,
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
  hostId: z.number().nullable().optional(),
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
  hostId: number | null;
  recurrence: string;
  tags?: string[] | null;
  imageUrl?: string | null;
  createdAt?: string | Date;
  isHighlighted?: boolean;
  highlightPriority?: number | null;
  externalUrl?: string | null;
  externalPageOpens?: number;
  savesCount?: number;
  detailViews?: number;
  venueId?: number | null;
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

export const insertPromotedNotificationSchema = createInsertSchema(promotedNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  impressions: true,
  clicks: true,
});
export type PromotedNotification = typeof promotedNotifications.$inferSelect;
export type InsertPromotedNotification = z.infer<typeof insertPromotedNotificationSchema>;

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

// Feed Analysis - voor slimme feed detectie
export const FEED_ANALYSIS_STATUS = ['pending', 'analyzing', 'completed', 'failed'] as const;

export const feedAnalysisProfiles = pgTable("feed_analysis_profiles", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  status: text("status").notNull().default('pending'),
  feedType: text("feed_type"), // 'rss', 'atom', 'json', 'html-scraper', 'unknown'
  detectedFields: jsonb("detected_fields").$type<{
    title?: { path: string; confidence: number; sample?: string };
    description?: { path: string; confidence: number; sample?: string };
    date?: { path: string; confidence: number; sample?: string };
    time?: { path: string; confidence: number; sample?: string };
    location?: { path: string; confidence: number; sample?: string };
    image?: { path: string; confidence: number; sample?: string };
    link?: { path: string; confidence: number; sample?: string };
  }>(),
  fieldMappings: jsonb("field_mappings").$type<Record<string, string>>(),
  sampleItems: jsonb("sample_items").$type<any[]>(),
  analysisResult: jsonb("analysis_result").$type<{
    isViable: boolean;
    confidenceScore: number;
    warnings: string[];
    missingRequiredFields: string[];
    suggestions: string[];
    aiAnalysis?: string;
  }>(),
  rawContentSample: text("raw_content_sample"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  analyzedAt: timestamp("analyzed_at"),
  analyzedBy: integer("analyzed_by").references(() => users.id),
});

export const insertFeedAnalysisProfileSchema = createInsertSchema(feedAnalysisProfiles).omit({
  id: true,
  createdAt: true,
  analyzedAt: true,
});

export type FeedAnalysisProfile = typeof feedAnalysisProfiles.$inferSelect;
export type InsertFeedAnalysisProfile = z.infer<typeof insertFeedAnalysisProfileSchema>;

export const feedAnalysisResultSchema = z.object({
  url: z.string(),
  feedType: z.enum(['rss', 'atom', 'json', 'html-scraper', 'unknown']),
  isViable: z.boolean(),
  confidenceScore: z.number().min(0).max(100),
  detectedFields: z.record(z.object({
    path: z.string(),
    confidence: z.number(),
    sample: z.string().optional(),
  })).optional().default({}),
  sampleItems: z.array(z.any()).optional().default([]),
  warnings: z.array(z.string()).optional().default([]),
  missingRequiredFields: z.array(z.string()).optional().default([]),
  suggestions: z.array(z.string()).optional().default([]),
  aiAnalysis: z.string().optional(),
  rawContentSample: z.string().optional(),
  eventStats: z.object({
    totalFound: z.number(),
    importable: z.number(),
    withGps: z.number(),
    withDate: z.number(),
    withImage: z.number(),
    rejected: z.number(),
    rejectionReasons: z.record(z.number()).optional(),
  }).optional(),
  suggestedMunicipality: z.string().optional(),
  suggestedFeedName: z.string().optional(),
});

export type FeedAnalysisResult = z.infer<typeof feedAnalysisResultSchema>;

// AI Extraction Profiles - voor het cachen van AI-geleerde extractie patronen per domein
export const aiExtractionProfiles = pgTable("ai_extraction_profiles", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(), // e.g., "inroosendaal.nl"
  pathPattern: text("path_pattern"), // e.g., "/uitagenda" - optional, for path-specific profiles
  selectors: jsonb("selectors").$type<{
    eventCard: string; // CSS selector for event cards
    title?: string; // Relative selector for title within card
    date?: string; // Relative selector for date
    time?: string; // Relative selector for time
    category?: string; // Relative selector for category
    image?: string; // Relative selector for image
    link?: string; // Relative selector for link/URL
    description?: string; // Relative selector for description
    location?: string; // Relative selector for location
    venue?: string; // Relative selector for venue name
    address?: string; // Relative selector for address
  }>().notNull(),
  pagination: jsonb("pagination").$type<{
    type: 'query' | 'path' | 'loadmore' | 'none';
    paramName?: string; // e.g., "page_39" or "page"
    maxPages?: number;
    itemsPerPage?: number;
  }>(),
  confidence: integer("confidence").notNull().default(0), // 0-100
  validatedEvents: integer("validated_events").default(0), // Number of events successfully extracted
  requiresJsRendering: boolean("requires_js_rendering").default(false), // Whether Puppeteer is needed for this domain
  lastSuccessfulAt: timestamp("last_successful_at"),
  lastValidatedAt: timestamp("last_validated_at"),
  aiModel: text("ai_model"), // e.g., "gpt-4o-mini"
  aiPromptVersion: text("ai_prompt_version"), // For tracking prompt changes
  municipality: text("municipality"), // e.g., "Roosendaal" - for linking to correct city
  sampleDetailUrl: text("sample_detail_url"), // e.g., URL to a sample detail page for editing/testing
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAiExtractionProfileSchema = createInsertSchema(aiExtractionProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSuccessfulAt: true,
  lastValidatedAt: true,
});

export type AiExtractionProfile = typeof aiExtractionProfiles.$inferSelect;
export type InsertAiExtractionProfile = z.infer<typeof insertAiExtractionProfileSchema>;

// Geocoding cache table for persistent address->coordinates caching
export const geocodeCache = pgTable("geocode_cache", {
  id: serial("id").primaryKey(),
  addressQuery: text("address_query").notNull().unique(), // The address string used for lookup
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  displayName: text("display_name"), // Full address from Nominatim
  municipality: text("municipality"), // Detected municipality if available
  hitCount: integer("hit_count").notNull().default(1), // How many times this cache entry was used
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
});

export type GeocodeCache = typeof geocodeCache.$inferSelect;
export type InsertGeocodeCache = {
  addressQuery: string;
  latitude: number;
  longitude: number;
  displayName?: string;
  municipality?: string;
};

// AI Assistant usage tracking - voor limiet per week
export const aiAssistantUsage = pgTable("ai_assistant_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  questionCount: integer("question_count").notNull().default(0),
  weekStart: timestamp("week_start").notNull(), // Maandag van de week
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniqueUserWeek: unique().on(table.userId, table.weekStart),
}));

export type AiAssistantUsage = typeof aiAssistantUsage.$inferSelect;
export type InsertAiAssistantUsage = typeof aiAssistantUsage.$inferInsert;

// Premium features configuratie
export const premiumFeatures = pgTable("premium_features", {
  id: serial("id").primaryKey(),
  featureKey: text("feature_key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PremiumFeature = typeof premiumFeatures.$inferSelect;
export type InsertPremiumFeature = typeof premiumFeatures.$inferInsert;

// API Usage Tracking - voor monitoring en spike detectie
export const apiUsageStats = pgTable("api_usage_stats", {
  id: serial("id").primaryKey(),
  hour: timestamp("hour").notNull(), // Afgerond naar hele uur
  endpoint: text("endpoint").notNull(), // API endpoint pad
  requestCount: integer("request_count").notNull().default(0),
  uniqueIps: integer("unique_ips").notNull().default(0),
  blockedRequests: integer("blocked_requests").notNull().default(0), // Rate limited requests
  avgResponseMs: integer("avg_response_ms").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniqueHourEndpoint: unique().on(table.hour, table.endpoint),
}));

export type ApiUsageStats = typeof apiUsageStats.$inferSelect;
export type InsertApiUsageStats = typeof apiUsageStats.$inferInsert;

// =============================================
// Advertising System - Adverteerder, Advertenties & Promoties
// =============================================

export const BUSINESS_CATEGORIES = [
  'museum',
  'dierentuin',
  'brouwerij',
  'pretpark',
  'horeca',
  'theater',
  'bioscoop',
  'sportlocatie',
  'overig'
] as const;

export const ADVERTISER_STATUS = ['pending', 'active', 'suspended'] as const;
export const BUSINESS_AD_STATUS = ['draft', 'pending', 'active', 'paused', 'exhausted'] as const;
export const PROMOTION_PERIOD = ['day', 'week', 'month'] as const;
export const PROMOTION_STATUS = ['active', 'expired', 'cancelled'] as const;
export const RADIUS_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50, 0] as const;
export const PRICING_PRODUCT_TYPE = ['event_promotion', 'business_ad'] as const;

export const advertiserProfiles = pgTable("advertiser_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  companyName: text("company_name").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  address: text("address"),
  latitude: decimal("latitude"),
  longitude: decimal("longitude"),
  businessCategory: text("business_category").notNull().$type<typeof BUSINESS_CATEGORIES[number]>(),
  phone: text("phone"),
  stripeCustomerId: text("stripe_customer_id"),
  balanceCents: integer("balance_cents").notNull().default(0),
  monthlyBudgetCapCents: integer("monthly_budget_cap_cents"),
  currentMonthSpendCents: integer("current_month_spend_cents").notNull().default(0),
  status: text("status").notNull().default('pending').$type<typeof ADVERTISER_STATUS[number]>(),
  verificationEmail: text("verification_email"),
  emailVerified: boolean("email_verified").default(false),
  verificationToken: text("verification_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const businessAds = pgTable("business_ads", {
  id: serial("id").primaryKey(),
  advertiserId: integer("advertiser_id").references(() => advertiserProfiles.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  ctaUrl: text("cta_url").notNull(),
  ctaText: text("cta_text").default("Meer info"),
  targetRadiusKm: integer("target_radius_km").notNull().default(10),
  targetCategories: text("target_categories").array(),
  status: text("status").notNull().default('draft').$type<typeof BUSINESS_AD_STATUS[number]>(),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  cpmCents: integer("cpm_cents").notNull(),
  totalSpendCents: integer("total_spend_cents").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const adImpressions = pgTable("ad_impressions", {
  id: serial("id").primaryKey(),
  adId: integer("ad_id").references(() => businessAds.id, { onDelete: "cascade" }).notNull(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  costCents: integer("cost_cents").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const eventPromotions = pgTable("event_promotions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  purchasedByUserId: integer("purchased_by_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  promotionPeriod: text("promotion_period").notNull().$type<typeof PROMOTION_PERIOD[number]>(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  targetRadiusKm: integer("target_radius_km").notNull().default(10),
  status: text("status").notNull().default('active').$type<typeof PROMOTION_STATUS[number]>(),
  priceCents: integer("price_cents").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pricingConfig = pgTable("pricing_config", {
  id: serial("id").primaryKey(),
  productType: text("product_type").notNull().$type<typeof PRICING_PRODUCT_TYPE[number]>(),
  radiusKm: integer("radius_km").notNull(),
  period: text("period").$type<typeof PROMOTION_PERIOD[number]>(),
  priceCents: integer("price_cents").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertAdvertiserProfileSchema = createInsertSchema(advertiserProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  balanceCents: true,
  currentMonthSpendCents: true,
  stripeCustomerId: true,
});

export const insertBusinessAdSchema = createInsertSchema(businessAds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  impressions: true,
  clicks: true,
  totalSpendCents: true,
});

export const insertAdImpressionSchema = createInsertSchema(adImpressions).omit({
  id: true,
  createdAt: true,
});

export const insertEventPromotionSchema = createInsertSchema(eventPromotions).omit({
  id: true,
  createdAt: true,
  impressions: true,
  clicks: true,
});

export const insertPricingConfigSchema = createInsertSchema(pricingConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type AdvertiserProfile = typeof advertiserProfiles.$inferSelect;
export type InsertAdvertiserProfile = z.infer<typeof insertAdvertiserProfileSchema>;
export type BusinessAd = typeof businessAds.$inferSelect;
export type InsertBusinessAd = z.infer<typeof insertBusinessAdSchema>;
export type AdImpression = typeof adImpressions.$inferSelect;
export type InsertAdImpression = z.infer<typeof insertAdImpressionSchema>;
export type EventPromotion = typeof eventPromotions.$inferSelect;
export type InsertEventPromotion = z.infer<typeof insertEventPromotionSchema>;
export type PricingConfig = typeof pricingConfig.$inferSelect;
export type InsertPricingConfig = z.infer<typeof insertPricingConfigSchema>;

// Beta Feedback
export const FEEDBACK_TYPES = ['bug', 'idee', 'vraag', 'anders'] as const;
export const FEEDBACK_STATUS = ['nieuw', 'gelezen', 'verwerkt', 'gearchiveerd'] as const;

export const betaFeedback = pgTable("beta_feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  pageUrl: text("page_url").notNull(),
  feedbackType: text("feedback_type").notNull().$type<typeof FEEDBACK_TYPES[number]>(),
  message: text("message").notNull(),
  rating: integer("rating"),
  email: text("email"),
  status: text("status").notNull().default('nieuw').$type<typeof FEEDBACK_STATUS[number]>(),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBetaFeedbackSchema = createInsertSchema(betaFeedback).omit({
  id: true,
  createdAt: true,
});

export type BetaFeedback = typeof betaFeedback.$inferSelect;
export type InsertBetaFeedback = z.infer<typeof insertBetaFeedbackSchema>;

// Re-export chat models
export * from "./models/chat";