import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
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
  location: locationSchema,
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
  maxParticipants: z.number().optional(),
  hostId: z.number(),
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