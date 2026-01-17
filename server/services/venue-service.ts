import { db } from "../db";
import { venues, Venue } from "@shared/schema";
import { eq, ilike, and, sql, desc } from "drizzle-orm";

export class VenueService {
  static normalizeVenueName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static async findVenue(name: string, municipality?: string): Promise<Venue | null> {
    const normalizedName = this.normalizeVenueName(name);
    
    const conditions = [eq(venues.normalizedName, normalizedName)];
    if (municipality) {
      conditions.push(eq(venues.municipality, municipality));
    }

    const [venue] = await db.select()
      .from(venues)
      .where(and(...conditions))
      .limit(1);

    return venue || null;
  }

  static async findOrCreateVenue(
    name: string,
    data: {
      municipality?: string;
      address?: string;
      postalCode?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      sourceUrl?: string;
    }
  ): Promise<Venue> {
    const normalizedName = this.normalizeVenueName(name);
    
    const existingVenue = await this.findVenue(name, data.municipality);
    
    if (existingVenue) {
      const updates: Partial<Venue> = {
        usageCount: (existingVenue.usageCount || 0) + 1,
        lastUsedAt: new Date(),
      };
      
      if (!existingVenue.latitude && data.latitude) {
        updates.latitude = data.latitude.toString();
      }
      if (!existingVenue.longitude && data.longitude) {
        updates.longitude = data.longitude.toString();
      }
      if (!existingVenue.address && data.address) {
        updates.address = data.address;
      }
      
      await db.update(venues)
        .set(updates)
        .where(eq(venues.id, existingVenue.id));
      
      return { ...existingVenue, ...updates };
    }

    const [newVenue] = await db.insert(venues)
      .values({
        name,
        normalizedName,
        municipality: data.municipality,
        address: data.address,
        postalCode: data.postalCode,
        city: data.city,
        latitude: data.latitude?.toString(),
        longitude: data.longitude?.toString(),
        sourceUrl: data.sourceUrl,
        usageCount: 1,
        lastUsedAt: new Date(),
      })
      .returning();

    console.log(`[VenueService] Created new venue: "${name}" in ${data.municipality || 'unknown'} (${data.latitude}, ${data.longitude})`);
    return newVenue;
  }

  static async getVenueCoordinates(name: string, municipality?: string): Promise<{ latitude: number; longitude: number } | null> {
    const venue = await this.findVenue(name, municipality);
    
    if (venue?.latitude && venue?.longitude) {
      return {
        latitude: parseFloat(venue.latitude),
        longitude: parseFloat(venue.longitude),
      };
    }
    
    return null;
  }

  static async searchVenues(query: string, municipality?: string): Promise<Venue[]> {
    const conditions = [ilike(venues.name, `%${query}%`)];
    if (municipality) {
      conditions.push(eq(venues.municipality, municipality));
    }

    return db.select()
      .from(venues)
      .where(and(...conditions))
      .orderBy(desc(venues.usageCount))
      .limit(10);
  }

  static async getTopVenues(municipality?: string, limit = 20): Promise<Venue[]> {
    const conditions = municipality ? [eq(venues.municipality, municipality)] : [];

    return db.select()
      .from(venues)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(venues.usageCount))
      .limit(limit);
  }
}
