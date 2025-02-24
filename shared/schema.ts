import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  avatar: text("avatar"),
  googleId: text("google_id"),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: jsonb("location").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  isPaid: boolean("is_paid").default(false),
  price: integer("price"),
  hostId: integer("host_id").notNull(),
  recurrence: text("recurrence").notNull().default('once'),
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
  status: text("status").notNull(), // attending, waitlist
});

export const savedSearches = pgTable("saved_searches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  filters: jsonb("filters").notNull(),
  pushEnabled: boolean("push_enabled").default(true),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  avatar: true,
  googleId: true,
});

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  notificationReach: z.number(),
  address: z.string().optional(),
});


export const insertEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string(),
  location: locationSchema,
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()).optional(),
  isPaid: z.boolean().default(false),
  price: z.number().optional(),
  maxParticipants: z.number().optional(),
  hostId: z.number(),
  recurrence: z.enum(['once', 'daily', 'weekly', 'monthly']).default('once'),
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

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;