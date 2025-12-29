import axios from "axios";
import * as cheerio from "cheerio";
import { parseStringPromise } from "xml2js";
import { db } from "../db";
import { rssFeeds, rssFeedItems, events, CATEGORIES } from "@shared/schema";
import { eq, and, sql, ilike } from "drizzle-orm";
import type { RssFeed, RssFeedItem, InsertRssFeedItem } from "@shared/schema";
import { AIHelper } from "./ai-helper";
import { DEFAULT_FEED_RULES, FEED_IMPORT_PRINCIPLES, createDuplicateKey, validateEventForImport } from "../config/rss-feed-rules";
import { validateCoordinatesInMunicipality, findActualMunicipality, getMunicipalityCentroid, getKnownVenue } from "./municipality-validator";

interface ParsedFeedItem {
  externalId: string;
  title: string;
  description: string;
  link?: string;
  imageUrl?: string;
  publishedAt?: Date;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rawData?: any;
  allDates?: Date[];
}

interface GeocodingResult {
  lat: number;
  lon: number;
  displayName: string;
}

const UNSPLASH_CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Sport en spel": ["sports", "fitness", "running", "cycling", "gym", "football", "tennis"],
  "Kunst en Cultuur": ["art", "museum", "culture", "painting", "sculpture", "concert", "music", "festival", "theater"],
  "Gezellig en Sociaal": ["social", "community", "people", "gathering", "meetup", "party", "food", "restaurant", "market"],
  "Leren en Ontdekken": ["workshop", "learning", "education", "class", "training", "nature", "outdoor"],
  "Vrijwilligerswerk en hulp": ["volunteer", "charity", "helping", "community", "support"]
};

interface FeedParseResult {
  success: boolean;
  items: ParsedFeedItem[];
  error?: string;
}

export class RssFeedService {
  private static readonly USER_AGENT = "letsgo-radar/1.0 (+https://letsgo-radar.nl)";
  private static geocodeCache: Map<string, GeocodingResult> = new Map();

  /**
   * Normalize title for comparison (lowercase, trim, remove special chars)
   */
  private static normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Create a grouping key for multi-day consolidation based on title + location
   * Returns null if event doesn't have verified location (prevents title-only grouping)
   */
  private static createConsolidationKey(item: ParsedFeedItem): string | null {
    const normalizedTitle = this.normalizeTitle(item.title);
    
    // Round coordinates to 3 decimals (~100m precision)
    const lat = item.latitude ? Math.round(item.latitude * 1000) / 1000 : 0;
    const lng = item.longitude ? Math.round(item.longitude * 1000) / 1000 : 0;
    
    // REQUIRE verified coordinates for consolidation
    // This prevents unrelated events with same title from merging
    if (lat === 0 || lng === 0 || Math.abs(lat) < 1 || Math.abs(lng) < 1) {
      // No valid coords - return unique key to prevent consolidation
      return null;
    }
    
    return `${normalizedTitle}|${lat},${lng}`;
  }

  /**
   * Check if dates are contiguous (within 1 day of each other)
   */
  private static areContiguousDates(dates: Date[]): boolean {
    if (dates.length <= 1) return true;
    
    const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
    
    for (let i = 1; i < sortedDates.length; i++) {
      const diff = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
      const daysDiff = diff / (1000 * 60 * 60 * 24);
      // Allow up to 2 days gap for weekend events
      if (daysDiff > 2) {
        return false;
      }
    }
    return true;
  }

  /**
   * UNIVERSAL MULTI-DAY CONSOLIDATION
   * Groups events by title+location and merges contiguous dates into single events.
   * Works for all feeds without per-feed configuration.
   */
  static consolidateMultiDayEvents(items: ParsedFeedItem[]): ParsedFeedItem[] {
    const eventGroups = new Map<string, ParsedFeedItem[]>();
    const ungroupedItems: ParsedFeedItem[] = [];
    
    // Group items by consolidated key (title + location)
    for (const item of items) {
      const key = this.createConsolidationKey(item);
      
      // Items without valid key (no coords) cannot be consolidated
      if (key === null) {
        item.allDates = item.startTime ? [item.startTime] : [];
        ungroupedItems.push(item);
        continue;
      }
      
      if (!eventGroups.has(key)) {
        eventGroups.set(key, []);
      }
      eventGroups.get(key)!.push(item);
    }
    
    const consolidated: ParsedFeedItem[] = [];
    
    for (const [key, group] of Array.from(eventGroups.entries())) {
      if (group.length === 1) {
        // Single item, no consolidation needed
        const item = group[0];
        item.allDates = item.startTime ? [item.startTime] : [];
        consolidated.push(item);
        continue;
      }
      
      // Collect all dates from the group
      const allDates: Date[] = [];
      for (const item of group) {
        if (item.startTime) {
          allDates.push(item.startTime);
        }
      }
      
      // Check if dates are contiguous (not recurring weekly events)
      if (!this.areContiguousDates(allDates)) {
        // Not contiguous - treat as separate recurring events
        for (const item of group) {
          item.allDates = item.startTime ? [item.startTime] : [];
          consolidated.push(item);
        }
        console.log(`[RSS] Non-contiguous dates for "${group[0].title}" - keeping ${group.length} separate events`);
        continue;
      }
      
      // Merge into single multi-day event
      const sortedDates = allDates.sort((a, b) => a.getTime() - b.getTime());
      const baseItem = group[0];
      
      // Use earliest startTime and latest as endTime
      baseItem.startTime = sortedDates[0];
      baseItem.endTime = sortedDates[sortedDates.length - 1];
      baseItem.allDates = sortedDates;
      
      // Prefer item with image
      for (const item of group) {
        if (item.imageUrl && !baseItem.imageUrl) {
          baseItem.imageUrl = item.imageUrl;
          break;
        }
      }
      
      // Prefer item with longest description
      for (const item of group) {
        if (item.description && item.description.length > (baseItem.description?.length || 0)) {
          baseItem.description = item.description;
        }
      }
      
      consolidated.push(baseItem);
      console.log(`[RSS] MERGED ${group.length} days into 1 event: "${baseItem.title}" (${sortedDates[0].toDateString()} - ${sortedDates[sortedDates.length - 1].toDateString()})`);
    }
    
    // Add ungrouped items (those without valid coords)
    const allResults = [...consolidated, ...ungroupedItems];
    console.log(`[RSS] Consolidated ${items.length} items into ${allResults.length} events (${ungroupedItems.length} ungrouped)`);
    return allResults;
  }

  static async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    if (this.geocodeCache.has(address)) {
      return this.geocodeCache.get(address)!;
    }

    try {
      const encodedAddress = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`;
      
      const response = await axios.get(url, {
        headers: { "User-Agent": this.USER_AGENT },
        timeout: 10000
      });

      if (response.data && response.data.length > 0) {
        const result = {
          lat: parseFloat(response.data[0].lat),
          lon: parseFloat(response.data[0].lon),
          displayName: response.data[0].display_name
        };
        this.geocodeCache.set(address, result);
        console.log(`[RSS] Geocoded "${address}" to ${result.lat}, ${result.lon}`);
        return result;
      }
    } catch (error: any) {
      console.error(`[RSS] Geocoding error for "${address}":`, error.message);
    }
    return null;
  }

  /**
   * Geocode address with municipality validation
   * Returns null if coordinates fall outside expected municipality
   */
  static async geocodeWithMunicipalityValidation(
    address: string, 
    expectedMunicipality: string
  ): Promise<GeocodingResult | null> {
    // Strategy 0: Check known venues first for exact matches
    const knownVenue = getKnownVenue(expectedMunicipality, address);
    if (knownVenue) {
      console.log(`[RSS] Known venue MATCH: "${address}" -> ${knownVenue.address}`);
      return {
        lat: knownVenue.lat,
        lon: knownVenue.lng,
        displayName: knownVenue.address
      };
    }
    
    // Strategy 1: Try geocoding with municipality suffix for disambiguation
    const addressWithMunicipality = `${address}, ${expectedMunicipality}, Netherlands`;
    let result = await this.geocodeAddress(addressWithMunicipality);
    
    if (result) {
      const validation = validateCoordinatesInMunicipality(result.lat, result.lon, expectedMunicipality);
      if (validation.isValid) {
        console.log(`[RSS] Geocode VALID: "${address}" in ${expectedMunicipality}`);
        return result;
      } else {
        const actualMunicipality = findActualMunicipality(result.lat, result.lon);
        console.log(`[RSS] Geocode REJECTED: "${address}" -> ${actualMunicipality || 'unknown'} (expected ${expectedMunicipality})`);
      }
    }
    
    // Strategy 2: Try with province suffix for Noord-Brabant
    const addressWithProvince = `${address}, ${expectedMunicipality}, Noord-Brabant, Netherlands`;
    result = await this.geocodeAddress(addressWithProvince);
    
    if (result) {
      const validation = validateCoordinatesInMunicipality(result.lat, result.lon, expectedMunicipality);
      if (validation.isValid) {
        console.log(`[RSS] Geocode VALID (with province): "${address}" in ${expectedMunicipality}`);
        return result;
      }
    }
    
    // Strategy 3: Try original address with Netherlands only, but validate
    result = await this.geocodeAddress(`${address}, Netherlands`);
    
    if (result) {
      const validation = validateCoordinatesInMunicipality(result.lat, result.lon, expectedMunicipality);
      if (validation.isValid) {
        console.log(`[RSS] Geocode VALID (NL only): "${address}" in ${expectedMunicipality}`);
        return result;
      } else {
        const actualMunicipality = findActualMunicipality(result.lat, result.lon);
        console.log(`[RSS] Geocode FINAL REJECTED: "${address}" -> ${actualMunicipality || 'unknown'} (expected ${expectedMunicipality}), distance: ${validation.distance}km`);
      }
    }
    
    return null;
  }

  /**
   * Validate existing coordinates against expected municipality
   */
  static validateExistingCoordinates(
    latitude: number,
    longitude: number,
    expectedMunicipality: string
  ): boolean {
    const validation = validateCoordinatesInMunicipality(latitude, longitude, expectedMunicipality);
    if (!validation.isValid) {
      const actualMunicipality = findActualMunicipality(latitude, longitude);
      console.log(`[RSS] Coordinate validation FAILED: (${latitude}, ${longitude}) in ${actualMunicipality || 'unknown'}, expected ${expectedMunicipality}`);
    }
    return validation.isValid;
  }

  /**
   * Log an incomplete feed item to the database for later manual review
   */
  static async logIncompleteItem(
    feedId: number,
    data: {
      externalId: string;
      title: string;
      description?: string;
      link?: string;
      imageUrl?: string;
      rawData?: any;
      missingFields: string[];
      derivedData?: {
        geocodedAddress?: string;
        geocodedLat?: number;
        geocodedLng?: number;
        parsedStartDate?: string;
        parsedEndDate?: string;
        detectedVenue?: string;
        validationErrors?: string[];
      };
    }
  ): Promise<void> {
    try {
      // Check if item already exists
      const existing = await db.select().from(rssFeedItems)
        .where(and(
          eq(rssFeedItems.feedId, feedId),
          eq(rssFeedItems.externalId, data.externalId)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing incomplete item
        await db.update(rssFeedItems)
          .set({
            title: data.title,
            description: data.description,
            link: data.link,
            imageUrl: data.imageUrl,
            rawData: data.rawData,
            processingStatus: 'incomplete',
            missingFields: data.missingFields,
            derivedData: data.derivedData,
            lastAttemptedAt: new Date(),
          })
          .where(eq(rssFeedItems.id, existing[0].id));
      } else {
        // Create new incomplete item
        await db.insert(rssFeedItems).values([{
          feedId,
          externalId: data.externalId,
          title: data.title,
          description: data.description,
          link: data.link,
          imageUrl: data.imageUrl,
          rawData: data.rawData,
          processingStatus: 'incomplete',
          missingFields: data.missingFields,
          derivedData: data.derivedData,
          lastAttemptedAt: new Date(),
          isProcessed: false,
        }]);
      }
      
      console.log(`[RSS] Logged incomplete item: "${data.title}" (missing: ${data.missingFields.join(', ')})`);
    } catch (error: any) {
      console.error(`[RSS] Failed to log incomplete item:`, error.message);
    }
  }

  /**
   * Mark a feed item as successfully imported
   */
  static async markItemImported(
    feedId: number,
    externalId: string,
    eventId: number
  ): Promise<void> {
    try {
      const existing = await db.select().from(rssFeedItems)
        .where(and(
          eq(rssFeedItems.feedId, feedId),
          eq(rssFeedItems.externalId, externalId)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(rssFeedItems)
          .set({
            eventId,
            processingStatus: 'imported',
            isProcessed: true,
            lastAttemptedAt: new Date(),
          })
          .where(eq(rssFeedItems.id, existing[0].id));
      }
    } catch (error: any) {
      console.error(`[RSS] Failed to mark item imported:`, error.message);
    }
  }

  /**
   * Mark a feed item as skipped (explicitly excluded by user/admin)
   */
  static async markItemSkipped(
    feedId: number,
    externalId: string
  ): Promise<void> {
    try {
      await db.update(rssFeedItems)
        .set({
          processingStatus: 'skipped',
          isProcessed: true,
          lastAttemptedAt: new Date(),
        })
        .where(and(
          eq(rssFeedItems.feedId, feedId),
          eq(rssFeedItems.externalId, externalId)
        ));
    } catch (error: any) {
      console.error(`[RSS] Failed to mark item skipped:`, error.message);
    }
  }

  static async getUnsplashImage(category: string, searchTerms?: string): Promise<string | null> {
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!unsplashKey) {
      console.log("[RSS] No Unsplash API key available");
      return null;
    }

    try {
      const keywords = UNSPLASH_CATEGORY_KEYWORDS[category] || ["event", "community"];
      const searchQuery = searchTerms || keywords[Math.floor(Math.random() * keywords.length)];
      
      const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(searchQuery)}&orientation=landscape`;
      
      const response = await axios.get(url, {
        headers: { 
          "Authorization": `Client-ID ${unsplashKey}`,
          "Accept-Version": "v1"
        },
        timeout: 10000
      });

      if (response.data?.urls?.regular) {
        console.log(`[RSS] Got Unsplash image for "${searchQuery}"`);
        return response.data.urls.regular;
      }
    } catch (error: any) {
      console.error(`[RSS] Unsplash error:`, error.message);
    }
    return null;
  }

  static formatTitle(title: string): string {
    let formatted = title
      .replace(/^(Event:|Evenement:|Activiteit:)\s*/i, "")
      .replace(/\s*[-–|]\s*.+$/, "")
      .trim();
    
    if (formatted.length > 50) {
      const words = formatted.split(" ");
      formatted = "";
      for (const word of words) {
        if ((formatted + " " + word).trim().length <= 47) {
          formatted = (formatted + " " + word).trim();
        } else {
          break;
        }
      }
      if (formatted.length < title.length) {
        formatted += "...";
      }
    }
    
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  static detectCategory(title: string, description: string): string {
    const text = (title + " " + description).toLowerCase();
    
    const categoryKeywords: Record<string, string[]> = {
      "Sport en spel": ["sport", "fitness", "hardlopen", "zwemmen", "voetbal", "tennis", "gym", "yoga", "run", "cycling", "fiets", "basketbal", "hockey", "toernooi"],
      "Kunst en Cultuur": ["kunst", "museum", "tentoonstelling", "theater", "galerie", "expositie", "cultuur", "art", "concert", "muziek", "festival", "dj", "band", "optreden", "dans", "film", "comedy"],
      "Leren en Ontdekken": ["workshop", "cursus", "lezing", "leren", "training", "presentatie", "educatie", "natuur", "wandelen", "outdoor"],
      "Vrijwilligerswerk en hulp": ["vrijwilliger", "hulp", "voedselbank", "donatie", "goed doel", "charity", "steun", "helper"]
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return category;
        }
      }
    }
    
    return "Gezellig en Sociaal";
  }

  // Format Breda address from Prepr CMS address object
  static formatBredaAddress(address: any): string | null {
    if (!address) return null;
    
    const parts: string[] = [];
    
    // Add street with number
    if (address.street) {
      let streetPart = address.street;
      if (address.streetNumber) {
        streetPart += ` ${address.streetNumber}`;
        if (address.streetNumberSuffix) {
          streetPart += address.streetNumberSuffix;
        }
      }
      parts.push(streetPart);
    }
    
    // Add zipcode and city
    if (address.zipcode || address.city) {
      const cityPart = [address.zipcode, address.city].filter(Boolean).join(' ');
      parts.push(cityPart);
    }
    
    // Add title if no other info
    if (parts.length === 0 && address.title) {
      parts.push(address.title);
      parts.push('Breda');
    }
    
    return parts.length > 0 ? parts.join(', ') : null;
  }

  static async fetchAndParseRssFeed(url: string): Promise<FeedParseResult> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": this.USER_AGENT,
          "Accept": "application/rss+xml, application/xml, text/xml, */*"
        },
        timeout: 30000
      });

      const xmlData = response.data;
      const parsed = await parseStringPromise(xmlData, {
        explicitArray: false,
        ignoreAttrs: false
      });

      const items: ParsedFeedItem[] = [];

      if (parsed.rss?.channel?.item) {
        const rssItems = Array.isArray(parsed.rss.channel.item) 
          ? parsed.rss.channel.item 
          : [parsed.rss.channel.item];
        
        for (const item of rssItems) {
          items.push({
            externalId: item.guid?._ || item.guid || item.link || `${Date.now()}-${Math.random()}`,
            title: this.cleanText(item.title || "Geen titel"),
            description: this.cleanText(item.description || ""),
            link: item.link,
            imageUrl: this.extractImageFromRssItem(item),
            publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
            rawData: item
          });
        }
      }

      if (parsed.feed?.entry) {
        const atomItems = Array.isArray(parsed.feed.entry) 
          ? parsed.feed.entry 
          : [parsed.feed.entry];
        
        for (const item of atomItems) {
          items.push({
            externalId: item.id || item.link?.$ ?.href || `${Date.now()}-${Math.random()}`,
            title: this.cleanText(item.title?._ || item.title || "Geen titel"),
            description: this.cleanText(item.summary?._ || item.summary || item.content?._ || item.content || ""),
            link: item.link?.$ ?.href || item.link,
            imageUrl: this.extractImageFromAtomItem(item),
            publishedAt: item.published || item.updated ? new Date(item.published || item.updated) : undefined,
            rawData: item
          });
        }
      }

      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error fetching feed ${url}:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  static async scrapeThisIsEindhoven(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      const eventLinks: string[] = [];
      const maxPages = 15;
      
      for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 
          ? "https://www.thisiseindhoven.com/en/events"
          : `https://www.thisiseindhoven.com/en/events?page=${page}`;
        
        console.log(`[RSS] Scraping This Is Eindhoven page ${page}...`);
        
        const response = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          timeout: 30000
        });

        const $ = cheerio.load(response.data);
        const linksBeforeThisPage = eventLinks.length;
        
        $('a[href*="/en/events/"]').each((_, element) => {
          const href = $(element).attr("href");
          if (!href || href === "/en/events" || href.includes("?page=")) return;
          
          const fullLink = href.startsWith("http") 
            ? href 
            : `https://www.thisiseindhoven.com${href}`;
          
          if (!eventLinks.includes(fullLink)) {
            eventLinks.push(fullLink);
          }
        });
        
        const newLinksOnPage = eventLinks.length - linksBeforeThisPage;
        console.log(`[RSS] Page ${page}: found ${newLinksOnPage} new event links (total: ${eventLinks.length})`);
        
        if (newLinksOnPage === 0) {
          console.log(`[RSS] No new events on page ${page}, stopping pagination`);
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[RSS] Found ${eventLinks.length} event links, fetching ALL details...`);

      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < eventLinks.length; i++) {
        const link = eventLinks[i];
        try {
          console.log(`[RSS] Fetching event ${i + 1}/${eventLinks.length}: ${link.split('/').pop()}`);
          const item = await this.scrapeEventDetail(link);
          if (item) {
            items.push(item);
            successCount++;
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error: any) {
          errorCount++;
          console.error(`[RSS] Error fetching event ${link}:`, error.message);
        }
        
        if ((i + 1) % 20 === 0) {
          console.log(`[RSS] Progress: ${i + 1}/${eventLinks.length} events processed (${successCount} success, ${errorCount} errors)`);
        }
      }

      console.log(`[RSS] Scraped ${items.length} events from This Is Eindhoven (${errorCount} errors)`);
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping This Is Eindhoven:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  static async scrapeTrefhetInOss(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      const eventLinks: string[] = [];
      const maxPages = 20;
      
      for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 
          ? "https://www.trefhetinoss.nl/uitagenda"
          : `https://www.trefhetinoss.nl/uitagenda?page=${page}`;
        
        console.log(`[RSS] Scraping Tref het in Oss page ${page}...`);
        
        const response = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          timeout: 30000
        });

        const $ = cheerio.load(response.data);
        const linksBeforeThisPage = eventLinks.length;
        
        $('a[href*="/uitagenda/"]').each((_, element) => {
          const href = $(element).attr("href");
          if (!href || href === "/uitagenda" || href.includes("?page=") || href.includes("?calendar")) return;
          
          const match = href.match(/\/uitagenda\/\d+\//);
          if (!match) return;
          
          const fullLink = href.startsWith("http") 
            ? href 
            : `https://www.trefhetinoss.nl${href}`;
          
          if (!eventLinks.includes(fullLink)) {
            eventLinks.push(fullLink);
          }
        });
        
        const newLinksOnPage = eventLinks.length - linksBeforeThisPage;
        console.log(`[RSS] Page ${page}: found ${newLinksOnPage} new event links (total: ${eventLinks.length})`);
        
        if (newLinksOnPage === 0) {
          console.log(`[RSS] No new events on page ${page}, stopping pagination`);
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[RSS] Found ${eventLinks.length} Oss event links, fetching details...`);

      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < eventLinks.length; i++) {
        const link = eventLinks[i];
        try {
          console.log(`[RSS] Fetching Oss event ${i + 1}/${eventLinks.length}: ${link.split('/').pop()}`);
          const eventItems = await this.scrapeOssEventDetail(link);
          if (eventItems.length > 0) {
            items.push(...eventItems);
            successCount++;
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error: any) {
          errorCount++;
          console.error(`[RSS] Error fetching Oss event ${link}:`, error.message);
        }
        
        if ((i + 1) % 20 === 0) {
          console.log(`[RSS] Progress: ${i + 1}/${eventLinks.length} events processed (${successCount} success, ${errorCount} errors)`);
        }
      }

      console.log(`[RSS] Scraped ${items.length} events from Tref het in Oss (${errorCount} errors)`);
      // Note: Multi-day consolidation now happens in syncFeed/processFeeds
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping Tref het in Oss:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  static async scrapeVisitHelmond(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      const eventLinks: string[] = [];
      const maxPages = 20;
      
      for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 
          ? "https://www.visithelmond.nl/nl/agenda"
          : `https://www.visithelmond.nl/nl/agenda?page=${page}`;
        
        console.log(`[RSS] Scraping Visit Helmond page ${page}...`);
        
        const response = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          timeout: 30000
        });

        const $ = cheerio.load(response.data);
        const linksBeforeThisPage = eventLinks.length;
        
        $('a[href*="/nl/agenda/"]').each((_, element) => {
          const href = $(element).attr("href");
          if (!href || href === "/nl/agenda" || href.includes("?page=") || href.includes("?calendar")) return;
          
          const match = href.match(/\/nl\/agenda\/\d+\//);
          if (!match) return;
          
          const fullLink = href.startsWith("http") 
            ? href 
            : `https://www.visithelmond.nl${href}`;
          
          if (!eventLinks.includes(fullLink)) {
            eventLinks.push(fullLink);
          }
        });
        
        const newLinksOnPage = eventLinks.length - linksBeforeThisPage;
        console.log(`[RSS] Page ${page}: found ${newLinksOnPage} new event links (total: ${eventLinks.length})`);
        
        if (newLinksOnPage === 0) {
          console.log(`[RSS] No new events on page ${page}, stopping pagination`);
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[RSS] Found ${eventLinks.length} Helmond event links, fetching details...`);

      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < eventLinks.length; i++) {
        const link = eventLinks[i];
        try {
          console.log(`[RSS] Fetching Helmond event ${i + 1}/${eventLinks.length}: ${link.split('/').pop()}`);
          const eventItems = await this.scrapeHelmondEventDetail(link);
          if (eventItems.length > 0) {
            items.push(...eventItems);
            successCount++;
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error: any) {
          errorCount++;
          console.error(`[RSS] Error fetching Helmond event ${link}:`, error.message);
        }
        
        if ((i + 1) % 20 === 0) {
          console.log(`[RSS] Progress: ${i + 1}/${eventLinks.length} events processed (${successCount} success, ${errorCount} errors)`);
        }
      }

      console.log(`[RSS] Scraped ${items.length} events from Visit Helmond (${errorCount} errors)`);
      // Note: Multi-day consolidation now happens in syncFeed/processFeeds
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping Visit Helmond:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  static async scrapeHelmondEventDetail(url: string): Promise<ParsedFeedItem[]> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml"
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const items: ParsedFeedItem[] = [];
      
      const jsonLdScripts = $('script[type="application/ld+json"]');
      
      for (let i = 0; i < jsonLdScripts.length; i++) {
        const scriptContent = $(jsonLdScripts[i]).html();
        if (!scriptContent) continue;
        
        try {
          const jsonData = JSON.parse(scriptContent);
          const events = Array.isArray(jsonData) ? jsonData : [jsonData];
          
          for (const event of events) {
            if (event["@type"] !== "Event") continue;
            
            const name = event.name || "";
            if (!name) continue;
            
            const imageUrl = event.image || "";
            const location = event.location;
            const venueName = location?.name || "";
            const address = location?.address;
            const streetAddress = address?.streetAddress || "";
            const postalCode = address?.postalCode || "";
            const city = address?.addressLocality || "Helmond";
            const fullAddress = [streetAddress, postalCode, city].filter(Boolean).join(", ");
            
            const geo = location?.geo;
            const latitude = geo?.latitude;
            const longitude = geo?.longitude;
            
            // QUALITY FILTER: Only import events with verified GPS coordinates
            if (!latitude || !longitude) {
              console.log(`[RSS] SKIPPED Helmond event (no GPS): ${name}`);
              continue;
            }
            
            const startDate = event.startDate ? new Date(event.startDate) : undefined;
            const endDate = event.endDate ? new Date(event.endDate) : undefined;
            
            if (startDate && startDate < new Date()) continue;
            
            const urlSlug = url.split('/')[5] || url.replace(/[^a-z0-9]/gi, "-");
            const externalId = `helmond-${urlSlug}`;
            
            let description = event.description || "";
            if (!description || description.length < 20) {
              description = `${name} in ${venueName || city}. ${fullAddress ? `Locatie: ${fullAddress}.` : ""} Ontdek dit evenement in Helmond!`;
            }
            
            const formattedTitle = RssFeedService.formatTitle(name);
            
            items.push({
              externalId,
              title: formattedTitle,
              description: description,
              link: url,
              imageUrl: imageUrl || undefined,
              publishedAt: new Date(),
              startTime: startDate,
              endTime: endDate || (startDate ? new Date(startDate.getTime() + 2 * 60 * 60 * 1000) : undefined),
              location: venueName || city,
              address: fullAddress || `${city}, Netherlands`,
              latitude,
              longitude,
              rawData: event
            });
          }
        } catch (parseError) {
          continue;
        }
      }
      
      // No fallback - only verified locations
      return items;
    } catch (error: any) {
      console.error(`[RSS] Error scraping Helmond event detail ${url}:`, error.message);
      return [];
    }
  }

  static async scrapeOssEventDetail(url: string): Promise<ParsedFeedItem[]> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml"
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const items: ParsedFeedItem[] = [];
      
      const jsonLdScripts = $('script[type="application/ld+json"]');
      
      for (let i = 0; i < jsonLdScripts.length; i++) {
        const scriptContent = $(jsonLdScripts[i]).html();
        if (!scriptContent) continue;
        
        try {
          const jsonData = JSON.parse(scriptContent);
          const events = Array.isArray(jsonData) ? jsonData : [jsonData];
          
          for (const event of events) {
            if (event["@type"] !== "Event") continue;
            
            const name = event.name || "";
            if (!name) continue;
            
            const imageUrl = event.image || "";
            const location = event.location;
            const venueName = location?.name || "";
            const address = location?.address;
            const streetAddress = address?.streetAddress || "";
            const postalCode = address?.postalCode || "";
            const city = address?.addressLocality || "Oss";
            const fullAddress = [streetAddress, postalCode, city].filter(Boolean).join(", ");
            
            const geo = location?.geo;
            const latitude = geo?.latitude;
            const longitude = geo?.longitude;
            
            // QUALITY FILTER: Only import events with verified GPS coordinates
            if (!latitude || !longitude) {
              console.log(`[RSS] SKIPPED Oss event (no GPS): ${name}`);
              continue;
            }
            
            const startDate = event.startDate ? new Date(event.startDate) : undefined;
            const endDate = event.endDate ? new Date(event.endDate) : undefined;
            
            if (startDate && startDate < new Date()) continue;
            
            const urlSlug = url.split('/')[4] || url.replace(/[^a-z0-9]/gi, "-");
            const externalId = `oss-${urlSlug}`;
            
            let description = event.description || "";
            if (!description || description.length < 20) {
              description = `${name} bij ${venueName || city}. ${fullAddress ? `Locatie: ${fullAddress}.` : ""} Ontdek dit evenement in Oss!`;
            }
            
            const formattedTitle = RssFeedService.formatTitle(name);
            
            items.push({
              externalId,
              title: formattedTitle,
              description: description,
              link: url,
              imageUrl: imageUrl || undefined,
              publishedAt: new Date(),
              startTime: startDate,
              endTime: endDate || (startDate ? new Date(startDate.getTime() + 2 * 60 * 60 * 1000) : undefined),
              location: venueName || city,
              address: fullAddress || `${city}, Netherlands`,
              latitude,
              longitude,
              rawData: event
            });
          }
        } catch (parseError) {
          continue;
        }
      }
      
      // No fallback - only verified locations
      return items;
    } catch (error: any) {
      console.error(`[RSS] Error scraping Oss event detail ${url}:`, error.message);
      return [];
    }
  }

  static async scrapeMeierijstad(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      const eventLinks: string[] = [];
      const maxPages = 10;
      
      for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 
          ? "https://www.bezoekmeierijstad.nl/agenda"
          : `https://www.bezoekmeierijstad.nl/agenda?order=desc&sort=calendar&page=${page}`;
        
        console.log(`[RSS] Scraping Meierijstad page ${page}...`);
        
        const response = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          timeout: 30000
        });

        const $ = cheerio.load(response.data);
        const linksBeforeThisPage = eventLinks.length;
        
        $('a[href*="/agenda/"]').each((_, element) => {
          const href = $(element).attr("href");
          if (!href || href === "/agenda" || href.includes("?page=") || href.includes("?order=")) return;
          
          const match = href.match(/\/agenda\/\d+\//);
          if (!match) return;
          
          const fullLink = href.startsWith("http") 
            ? href 
            : `https://www.bezoekmeierijstad.nl${href}`;
          
          if (!eventLinks.includes(fullLink)) {
            eventLinks.push(fullLink);
          }
        });
        
        const newLinksOnPage = eventLinks.length - linksBeforeThisPage;
        console.log(`[RSS] Page ${page}: found ${newLinksOnPage} new event links (total: ${eventLinks.length})`);
        
        if (newLinksOnPage === 0) {
          console.log(`[RSS] No new events on page ${page}, stopping pagination`);
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[RSS] Found ${eventLinks.length} Meierijstad event links, fetching details...`);

      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < eventLinks.length; i++) {
        const link = eventLinks[i];
        try {
          console.log(`[RSS] Fetching Meierijstad event ${i + 1}/${eventLinks.length}: ${link.split('/').pop()}`);
          const eventItems = await this.scrapeMeierijstadEventDetail(link);
          if (eventItems.length > 0) {
            items.push(...eventItems);
            successCount++;
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error: any) {
          errorCount++;
          console.error(`[RSS] Error fetching Meierijstad event ${link}:`, error.message);
        }
        
        if ((i + 1) % 20 === 0) {
          console.log(`[RSS] Progress: ${i + 1}/${eventLinks.length} events processed (${successCount} success, ${errorCount} errors)`);
        }
      }

      console.log(`[RSS] Scraped ${items.length} events from Meierijstad (${errorCount} errors)`);
      // Note: Multi-day consolidation now happens in syncFeed/processFeeds
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping Meierijstad:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  static async scrapeMeierijstadEventDetail(url: string): Promise<ParsedFeedItem[]> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml"
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const items: ParsedFeedItem[] = [];
      
      const title = $('h1').first().text().trim();
      if (!title) return items;
      
      let description = '';
      $('p').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 50 && !this.isCookieText(text)) {
          description = text;
          return false;
        }
      });
      
      let imageUrl = '';
      $('img').each((_, el) => {
        const src = $(el).attr('src') || '';
        if (src.includes('assets.plaece.nl') && !imageUrl) {
          imageUrl = src;
        }
      });
      
      let latitude: number | undefined;
      let longitude: number | undefined;
      
      $('a[href*="google.com/maps"]').each((_, el) => {
        if (latitude && longitude) return;
        const href = $(el).attr('href') || '';
        
        let coordMatch = href.match(/destination=([0-9.-]+)%2C([0-9.-]+)/);
        if (!coordMatch) {
          coordMatch = href.match(/destination=([0-9.-]+),([0-9.-]+)/);
        }
        if (!coordMatch) {
          coordMatch = href.match(/@([0-9.-]+),([0-9.-]+)/);
        }
        if (!coordMatch) {
          coordMatch = href.match(/q=([0-9.-]+),([0-9.-]+)/);
        }
        
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          if (lat >= 50 && lat <= 54 && lng >= 3 && lng <= 8) {
            latitude = lat;
            longitude = lng;
          }
        }
      });
      
      let location = '';
      let address = '';
      const fullText = $('body').text();
      
      $('a[href*="google.com/maps"]').parent().parent().find('*').each((_, el) => {
        if (location && address) return;
        const text = $(el).text().trim();
        if (text && text.length > 3 && text.length < 100 && 
            !text.includes('Plan je route') && !text.includes('Route') &&
            !text.includes('Google Maps') && !text.includes('Bekijk')) {
          if (!location) {
            location = text;
          } else if (!address && text !== location && text.length > location.length) {
            address = text;
          }
        }
      });
      
      const venuePatterns = [
        /(?:Locatie|Venue|Waar):\s*([^\n]+)/i,
        /(?:bij|in)\s+(?:het\s+)?([A-Z][a-zA-Z\s]+(?:Café|Theater|Zaal|Centrum|Kerk|Museum|Park|Plein|Huis|Gebouw))/,
        /([A-Z][a-zA-Z\s]+(?:kade|straat|weg|laan|plein))\s*\d*/i
      ];
      
      if (!location || location.length < 5) {
        for (const pattern of venuePatterns) {
          const match = fullText.match(pattern);
          if (match) {
            location = match[1].trim();
            break;
          }
        }
      }
      
      const dateText = $('body').text();
      let startTime: Date | undefined;
      let endTime: Date | undefined;
      
      const dateRangeMatch = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+t\/m\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
      if (dateRangeMatch) {
        const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = dateRangeMatch;
        const startMonthNum = this.MONTHS[startMonth.toLowerCase()];
        const endMonthNum = this.MONTHS[endMonth.toLowerCase()];
        if (startMonthNum !== undefined && endMonthNum !== undefined) {
          startTime = new Date(parseInt(startYear), startMonthNum, parseInt(startDay), 10, 0);
          endTime = new Date(parseInt(endYear), endMonthNum, parseInt(endDay), 22, 0);
        }
      }
      
      if (!startTime) {
        const tmMatch = dateText.match(/t\/m\s+(\d{1,2})\s+(\w+)\s+(\d{4})?/i);
        if (tmMatch) {
          const [, day, month, year] = tmMatch;
          const monthNum = this.MONTHS[month.toLowerCase()];
          if (monthNum !== undefined) {
            const eventYear = year ? parseInt(year) : new Date().getFullYear();
            endTime = new Date(eventYear, monthNum, parseInt(day), 22, 0);
            startTime = new Date();
            startTime.setHours(10, 0, 0, 0);
          }
        }
      }
      
      if (!startTime) {
        const simpleDateMatch = dateText.match(/(\w+dag)\s+(\d{1,2})\s+(\w+)/i);
        if (simpleDateMatch) {
          const [, , day, month] = simpleDateMatch;
          const monthNum = this.MONTHS[month.toLowerCase()];
          if (monthNum !== undefined) {
            const now = new Date();
            let year = now.getFullYear();
            const testDate = new Date(year, monthNum, parseInt(day));
            testDate.setHours(23, 59, 59, 999);
            if (testDate < now) year++;
            startTime = new Date(year, monthNum, parseInt(day), 10, 0);
            endTime = new Date(year, monthNum, parseInt(day), 22, 0);
          }
        }
      }
      
      if (!startTime) {
        const dailyMatch = dateText.match(/dagelijks\s+vanaf\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
        if (dailyMatch) {
          const [, day, month, year] = dailyMatch;
          const monthNum = this.MONTHS[month.toLowerCase()];
          if (monthNum !== undefined) {
            startTime = new Date(parseInt(year), monthNum, parseInt(day), 10, 0);
          }
        }
      }
      
      if (startTime && startTime < new Date() && !endTime) return items;
      if (endTime && endTime < new Date()) return items;
      
      const urlSlug = url.split('/')[4] || url.replace(/[^a-z0-9]/gi, "-");
      const externalId = `meierijstad-${urlSlug}`;
      
      const formattedTitle = this.formatTitle(title);
      
      // Known venues with EXACT coordinates - only these are trusted
      const meierijstadVenues: Record<string, {lat: number, lng: number, address: string}> = {
        'noordkade': { lat: 51.6155, lng: 5.5301, address: 'Noordkade, Veghel' },
        'theater aan de noordkade': { lat: 51.6155, lng: 5.5301, address: 'Noordkade 64a, Veghel' },
        'blauwe kei': { lat: 51.6154, lng: 5.5301, address: 'Noordkade 10, Veghel' },
        'afzakkerij': { lat: 51.6149, lng: 5.5299, address: 'Noordkade 58, Veghel' },
        'de beckart': { lat: 51.6167, lng: 5.5492, address: 'Pastoor Clercxstraat 2, Veghel' },
        'de pas': { lat: 51.6183, lng: 5.4360, address: 'Steeg 9, Schijndel' },
        'den brouwer': { lat: 51.5675, lng: 5.4510, address: 'Heuvel 26, Sint-Oedenrode' },
        'd\'n brouwer': { lat: 51.5675, lng: 5.4510, address: 'Heuvel 26, Sint-Oedenrode' },
        'hoeve arbeidslust': { lat: 51.5710, lng: 5.4650, address: 'Schijndelseweg 52, Sint-Oedenrode' },
        'kienehoef': { lat: 51.5690, lng: 5.4480, address: 'Kienehoef, Sint-Oedenrode' },
        'kulturhus erp': { lat: 51.5850, lng: 5.6010, address: 'Pastoor Beenenstraat 2, Erp' },
        'gemeentehuis veghel': { lat: 51.6175, lng: 5.5478, address: 'Stadhuisplein 1, Veghel' },
        'jumbo dome': { lat: 51.6189, lng: 5.5412, address: 'De Amert 201, Veghel' },
        'the chocolate factory': { lat: 51.6158, lng: 5.5275, address: 'Noordkade 56, Veghel' },
        'markt schijndel': { lat: 51.6180, lng: 5.4365, address: 'Markt, Schijndel' },
        'markt veghel': { lat: 51.6162, lng: 5.5458, address: 'Markt, Veghel' },
        'heuvel sint-oedenrode': { lat: 51.5680, lng: 5.4520, address: 'Heuvel, Sint-Oedenrode' }
      };
      
      let locationSource: 'gps' | 'venue' | 'unknown' = 'unknown';
      
      // Check if we have GPS coordinates from Google Maps
      if (latitude && longitude) {
        locationSource = 'gps';
      }
      
      // If no GPS, try to match known venues (exact coordinates)
      if (!latitude || !longitude) {
        const searchText = (location + ' ' + address + ' ' + title).toLowerCase();
        
        for (const [venue, venueData] of Object.entries(meierijstadVenues)) {
          if (searchText.includes(venue)) {
            latitude = venueData.lat;
            longitude = venueData.lng;
            if (!address || address.length < 10) {
              address = venueData.address;
            }
            locationSource = 'venue';
            break;
          }
        }
      }
      
      // QUALITY FILTER: Only import events with known locations
      if (!latitude || !longitude || locationSource === 'unknown') {
        console.log(`[RSS] SKIPPED Meierijstad event (no exact location): ${title}`);
        return items;
      }
      
      if (!address) {
        address = location ? `${location}, Meierijstad` : 'Meierijstad, Nederland';
      }
      
      items.push({
        externalId,
        title: formattedTitle,
        description: description || `${formattedTitle} - Evenement in Meierijstad`,
        link: url,
        imageUrl: imageUrl || undefined,
        publishedAt: new Date(),
        startTime,
        endTime: endTime || (startTime ? new Date(startTime.getTime() + 4 * 60 * 60 * 1000) : undefined),
        location: location || 'Meierijstad',
        address,
        latitude,
        longitude,
        rawData: { url, location, address }
      });
      
      return items;
    } catch (error: any) {
      console.error(`[RSS] Error scraping Meierijstad event detail ${url}:`, error.message);
      return [];
    }
  }

  static async scrapeMaashorst(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      const eventLinks: string[] = [];
      const maxPages = 10;
      
      for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 
          ? "https://www.exploremaashorst.nl/uitagenda"
          : `https://www.exploremaashorst.nl/uitagenda?page=${page}`;
        
        console.log(`[RSS] Scraping Maashorst page ${page}...`);
        
        const response = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          timeout: 30000
        });

        const $ = cheerio.load(response.data);
        const linksBeforeThisPage = eventLinks.length;
        
        $('a[href*="/uitagenda/"]').each((_, element) => {
          const href = $(element).attr("href");
          if (!href || href === "/uitagenda" || href.includes("?page=") || href.includes("?order=")) return;
          
          const match = href.match(/\/uitagenda\/\d+\//);
          if (!match) return;
          
          const fullLink = href.startsWith("http") 
            ? href 
            : `https://www.exploremaashorst.nl${href}`;
          
          if (!eventLinks.includes(fullLink)) {
            eventLinks.push(fullLink);
          }
        });
        
        const newLinksOnPage = eventLinks.length - linksBeforeThisPage;
        console.log(`[RSS] Page ${page}: found ${newLinksOnPage} new event links (total: ${eventLinks.length})`);
        
        if (newLinksOnPage === 0) {
          console.log(`[RSS] No new events on page ${page}, stopping pagination`);
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[RSS] Found ${eventLinks.length} Maashorst event links, fetching details...`);

      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < eventLinks.length; i++) {
        const link = eventLinks[i];
        try {
          console.log(`[RSS] Fetching Maashorst event ${i + 1}/${eventLinks.length}: ${link.split('/').pop()}`);
          const eventItems = await this.scrapeMaashorstEventDetail(link);
          if (eventItems.length > 0) {
            items.push(...eventItems);
            successCount++;
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error: any) {
          errorCount++;
          console.error(`[RSS] Error fetching Maashorst event ${link}:`, error.message);
        }
        
        if ((i + 1) % 20 === 0) {
          console.log(`[RSS] Progress: ${i + 1}/${eventLinks.length} events processed (${successCount} success, ${errorCount} errors)`);
        }
      }

      console.log(`[RSS] Scraped ${items.length} events from Maashorst (${errorCount} errors)`);
      // Note: Multi-day consolidation now happens in syncFeed/processFeeds
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping Maashorst:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  static async scrapeMaashorstEventDetail(url: string): Promise<ParsedFeedItem[]> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml"
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const items: ParsedFeedItem[] = [];
      
      const title = $('h1').first().text().trim();
      if (!title) return items;
      
      let description = '';
      $('p').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 50 && !this.isCookieText(text)) {
          description = text;
          return false;
        }
      });
      
      let imageUrl = '';
      $('img').each((_, el) => {
        const src = $(el).attr('src') || '';
        if (src.includes('assets.plaece.nl') && !imageUrl) {
          imageUrl = src;
        }
      });
      
      let latitude: number | undefined;
      let longitude: number | undefined;
      
      $('a[href*="google.com/maps"]').each((_, el) => {
        if (latitude && longitude) return;
        const href = $(el).attr('href') || '';
        
        let coordMatch = href.match(/destination=([0-9.-]+)%2C([0-9.-]+)/);
        if (!coordMatch) {
          coordMatch = href.match(/destination=([0-9.-]+),([0-9.-]+)/);
        }
        if (!coordMatch) {
          coordMatch = href.match(/@([0-9.-]+),([0-9.-]+)/);
        }
        if (!coordMatch) {
          coordMatch = href.match(/q=([0-9.-]+),([0-9.-]+)/);
        }
        
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          if (lat >= 50 && lat <= 54 && lng >= 3 && lng <= 8) {
            latitude = lat;
            longitude = lng;
          }
        }
      });
      
      let location = '';
      let address = '';
      
      $('a[href*="google.com/maps"]').parent().parent().find('*').each((_, el) => {
        if (location && address) return;
        const text = $(el).text().trim();
        if (text && text.length > 3 && text.length < 100 && 
            !text.includes('Plan je route') && !text.includes('Route') &&
            !text.includes('Google Maps') && !text.includes('Bekijk')) {
          if (!location) {
            location = text;
          } else if (!address && text !== location && text.length > location.length) {
            address = text;
          }
        }
      });
      
      const dateText = $('body').text();
      let startTime: Date | undefined;
      let endTime: Date | undefined;
      
      const dateRangeMatch = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+t\/m\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
      if (dateRangeMatch) {
        const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = dateRangeMatch;
        const startMonthNum = this.MONTHS[startMonth.toLowerCase()];
        const endMonthNum = this.MONTHS[endMonth.toLowerCase()];
        if (startMonthNum !== undefined && endMonthNum !== undefined) {
          startTime = new Date(parseInt(startYear), startMonthNum, parseInt(startDay), 10, 0);
          endTime = new Date(parseInt(endYear), endMonthNum, parseInt(endDay), 22, 0);
        }
      }
      
      if (!startTime) {
        const tmMatch = dateText.match(/t\/m\s+(\d{1,2})\s+(\w+)\s+(\d{4})?/i);
        if (tmMatch) {
          const [, day, month, year] = tmMatch;
          const monthNum = this.MONTHS[month.toLowerCase()];
          if (monthNum !== undefined) {
            const eventYear = year ? parseInt(year) : new Date().getFullYear();
            endTime = new Date(eventYear, monthNum, parseInt(day), 22, 0);
            startTime = new Date();
            startTime.setHours(10, 0, 0, 0);
          }
        }
      }
      
      if (!startTime) {
        const simpleDateMatch = dateText.match(/(\w+dag)\s+(\d{1,2})\s+(\w+)/i);
        if (simpleDateMatch) {
          const [, , day, month] = simpleDateMatch;
          const monthNum = this.MONTHS[month.toLowerCase()];
          if (monthNum !== undefined) {
            const now = new Date();
            let year = now.getFullYear();
            const testDate = new Date(year, monthNum, parseInt(day));
            testDate.setHours(23, 59, 59, 999);
            if (testDate < now) year++;
            startTime = new Date(year, monthNum, parseInt(day), 10, 0);
            endTime = new Date(year, monthNum, parseInt(day), 22, 0);
          }
        }
      }
      
      if (!startTime) {
        const timeMatch = dateText.match(/(\d{1,2})[:.:](\d{2})\s*[-–]\s*(\d{1,2})[:.:](\d{2})\s*uur/);
        if (timeMatch) {
          const [, startHour, startMin, endHour, endMin] = timeMatch;
          const today = new Date();
          startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(startHour), parseInt(startMin));
          endTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(endHour), parseInt(endMin));
        }
      }
      
      if (startTime && startTime < new Date() && !endTime) return items;
      if (endTime && endTime < new Date()) return items;
      
      // QUALITY FILTER: Only import events with GPS coordinates
      if (!latitude || !longitude) {
        console.log(`[RSS] SKIPPED Maashorst event (no GPS): ${title}`);
        return items;
      }
      
      const urlSlug = url.split('/')[4] || url.replace(/[^a-z0-9]/gi, "-");
      const externalId = `maashorst-${urlSlug}`;
      
      const formattedTitle = this.formatTitle(title);
      
      if (!address) {
        address = location ? `${location}, Maashorst` : 'Maashorst, Nederland';
      }
      
      items.push({
        externalId,
        title: formattedTitle,
        description: description || `${formattedTitle} - Evenement in Maashorst`,
        link: url,
        imageUrl: imageUrl || undefined,
        publishedAt: new Date(),
        startTime,
        endTime: endTime || (startTime ? new Date(startTime.getTime() + 4 * 60 * 60 * 1000) : undefined),
        location: location || 'Maashorst',
        address,
        latitude,
        longitude,
        rawData: { url, location, address }
      });
      
      return items;
    } catch (error: any) {
      console.error(`[RSS] Error scraping Maashorst event detail ${url}:`, error.message);
      return [];
    }
  }

  // Known venues in Son en Breugel with coordinates
  static readonly SON_EN_BREUGEL_VENUES: Record<string, { lat: number; lng: number; address: string }> = {
    'dommelhuis': { lat: 51.5132, lng: 5.4974, address: 'Dommelhuis, Raadhuisplein 1, Son en Breugel' },
    'vestzaktheater': { lat: 51.5132, lng: 5.4974, address: 'Vestzaktheater, Raadhuisplein 1, Son en Breugel' },
    'st. genovevakerk': { lat: 51.5179, lng: 5.5039, address: 'St. Genovevakerk, Kerkplein, Breugel' },
    'genovevakerk': { lat: 51.5179, lng: 5.5039, address: 'St. Genovevakerk, Kerkplein, Breugel' },
    'raadhuisplein': { lat: 51.5132, lng: 5.4974, address: 'Raadhuisplein, Son en Breugel' },
    'de bongerd': { lat: 51.5148, lng: 5.4963, address: 'De Bongerd, Son en Breugel' },
    'erfgoedpark': { lat: 51.5095, lng: 5.4950, address: 'Erfgoedpark, Son en Breugel' },
    'braecklant': { lat: 51.5120, lng: 5.4920, address: 'Braecklant, Son en Breugel' },
    'dorpsstraat': { lat: 51.5130, lng: 5.4970, address: 'Dorpsstraat, Son en Breugel' },
    'centrum': { lat: 51.5130, lng: 5.4970, address: 'Centrum, Son en Breugel' },
  };

  static async scrapeSonEnBreugel(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Build list of relevant month pages (current + next 3 months)
      const monthPages: { url: string; month: number; year: number }[] = [];
      
      for (let i = 0; i < 4; i++) {
        const targetMonth = (currentMonth + i) % 12;
        const targetYear = currentYear + Math.floor((currentMonth + i) / 12);
        const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 
                           'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
        const monthName = monthNames[targetMonth];
        const url = `https://www.sonenbreugel.nl/evenementen-${monthName}-${targetYear}`;
        monthPages.push({ url, month: targetMonth, year: targetYear });
      }
      
      console.log(`[RSS] Scraping Son en Breugel: ${monthPages.length} month pages...`);
      
      for (const page of monthPages) {
        try {
          console.log(`[RSS] Fetching: ${page.url}`);
          const response = await axios.get(page.url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "text/html,application/xhtml+xml"
            },
            timeout: 15000
          });
          
          const $ = cheerio.load(response.data);
          
          // Find all h2 headers which contain event titles
          $('h2').each((_, element) => {
            const title = $(element).text().trim();
            if (!title || title.length < 5 || title.includes('Cookie') || title.includes('Gemeente')) return;
            
            // Get the text after the h2 until the next h2
            let contentText = '';
            let nextEl = $(element).next();
            while (nextEl.length && !nextEl.is('h2')) {
              contentText += ' ' + nextEl.text();
              nextEl = nextEl.next();
            }
            contentText = contentText.trim();
            if (!contentText || contentText.length < 20) return;
            
            // Parse date patterns
            let startTime: Date | undefined;
            let endTime: Date | undefined;
            
            // Pattern: "Zaterdag 6 december t/m woensdag 24 december 2025"
            const dateRangeMatch = contentText.match(/(\w+dag)\s+(\d{1,2})\s+(\w+)\s+t\/m\s+\w+dag\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
            if (dateRangeMatch) {
              const [, , startDay, startMonth, endDay, endMonth, year] = dateRangeMatch;
              const startMonthNum = this.MONTHS[startMonth.toLowerCase()];
              const endMonthNum = this.MONTHS[endMonth.toLowerCase()];
              if (startMonthNum !== undefined && endMonthNum !== undefined) {
                startTime = new Date(parseInt(year), startMonthNum, parseInt(startDay), 10, 0);
                endTime = new Date(parseInt(year), endMonthNum, parseInt(endDay), 22, 0);
              }
            }
            
            // Pattern: "Woensdag 3 december 2025"
            if (!startTime) {
              const simpleDateMatch = contentText.match(/(\w+dag)\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
              if (simpleDateMatch) {
                const [, , day, month, year] = simpleDateMatch;
                const monthNum = this.MONTHS[month.toLowerCase()];
                if (monthNum !== undefined) {
                  startTime = new Date(parseInt(year), monthNum, parseInt(day), 10, 0);
                  endTime = new Date(parseInt(year), monthNum, parseInt(day), 22, 0);
                }
              }
            }
            
            // Pattern: "Zondag 7 december 2025"  (from title itself)
            if (!startTime) {
              const titleDateMatch = title.match(/(\w+dag)\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
              if (titleDateMatch) {
                const [, , day, month, year] = titleDateMatch;
                const monthNum = this.MONTHS[month.toLowerCase()];
                if (monthNum !== undefined) {
                  startTime = new Date(parseInt(year), monthNum, parseInt(day), 10, 0);
                  endTime = new Date(parseInt(year), monthNum, parseInt(day), 22, 0);
                }
              }
            }
            
            // Parse time: "Van 14.00 tot 16.30 uur" or "van 15.00 tot 17.00 uur"
            const timeMatch = contentText.match(/van\s+(\d{1,2})[.:](\d{2})\s+tot\s+(\d{1,2})[.:](\d{2})\s*uur/i);
            if (timeMatch && startTime) {
              const [, startHour, startMin, endHour, endMin] = timeMatch;
              startTime.setHours(parseInt(startHour), parseInt(startMin));
              if (endTime) {
                endTime = new Date(startTime);
                endTime.setHours(parseInt(endHour), parseInt(endMin));
              }
            }
            
            // Skip past events
            if (!startTime || startTime < now) return;
            
            // Find location in content
            let latitude: number | undefined;
            let longitude: number | undefined;
            let address: string = 'Son en Breugel, Nederland';
            let location: string = 'Son en Breugel';
            
            // Check for known venues
            const contentLower = (title + ' ' + contentText).toLowerCase();
            for (const [venueName, venueData] of Object.entries(this.SON_EN_BREUGEL_VENUES)) {
              if (contentLower.includes(venueName)) {
                latitude = venueData.lat;
                longitude = venueData.lng;
                address = venueData.address;
                location = venueName.charAt(0).toUpperCase() + venueName.slice(1);
                break;
              }
            }
            
            // If no known venue found, try geocoding
            if (!latitude || !longitude) {
              // Extract location hints from text like "in het Dommelhuis" or "op het Raadhuisplein"
              const locationMatch = contentText.match(/(?:in het|in de|bij de|op het|op de)\s+([A-Z][a-zA-Z\s]+?)(?:\s|,|\.|\)|$)/);
              if (locationMatch) {
                const extractedLocation = locationMatch[1].trim();
                // Check if it matches a known venue
                for (const [venueName, venueData] of Object.entries(this.SON_EN_BREUGEL_VENUES)) {
                  if (extractedLocation.toLowerCase().includes(venueName)) {
                    latitude = venueData.lat;
                    longitude = venueData.lng;
                    address = venueData.address;
                    location = extractedLocation;
                    break;
                  }
                }
              }
            }
            
            // QUALITY FILTER: Skip if no exact location
            if (!latitude || !longitude) {
              console.log(`[RSS] SKIPPED Son en Breugel event (no exact location): ${title.substring(0, 50)}`);
              return;
            }
            
            // Clean title
            const cleanTitle = this.formatTitle(title.replace(/^(Ars longa\s+)?/i, ''));
            
            // Create description from content
            const description = contentText.substring(0, 500).replace(/\s+/g, ' ').trim();
            
            const externalId = `sonenbreugel-${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50)}-${startTime.getTime()}`;
            
            items.push({
              externalId,
              title: cleanTitle,
              description: description || `${cleanTitle} - Evenement in Son en Breugel`,
              link: page.url,
              imageUrl: undefined,
              publishedAt: new Date(),
              startTime,
              endTime: endTime || new Date(startTime.getTime() + 2 * 60 * 60 * 1000),
              location,
              address,
              latitude,
              longitude,
              rawData: { url: page.url, location }
            });
          });
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          console.log(`[RSS] Could not fetch ${page.url}: ${error.message}`);
        }
      }
      
      console.log(`[RSS] Scraped ${items.length} events from Son en Breugel`);
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping Son en Breugel:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  // Bernheze scraper - fetches event list and extracts GPS from detail pages
  static async scrapeBernheze(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      const eventLinks: string[] = [];
      const maxPages = 15;
      
      // Collect event links from overview pages
      for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 
          ? "https://www.mooibernheze.nl/agenda"
          : `https://www.mooibernheze.nl/agenda?page=${page}`;
        
        console.log(`[RSS] Scraping Bernheze page ${page}...`);
        
        try {
          const response = await axios.get(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            },
            timeout: 30000
          });

          const $ = cheerio.load(response.data);
          const linksBeforeThisPage = eventLinks.length;
          
          // Extract event links - format: /agenda/2025/12/11/event-name-12345
          $('a[href*="/agenda/"]').each((_, element) => {
            const href = $(element).attr("href");
            if (!href) return;
            
            // Match pattern /agenda/YYYY/MM/DD/event-name-id
            const match = href.match(/\/agenda\/\d{4}\/\d{1,2}\/\d{1,2}\/[\w-]+-\d+$/);
            if (!match) return;
            
            const fullLink = href.startsWith("http") 
              ? href 
              : `https://www.mooibernheze.nl${href}`;
            
            if (!eventLinks.includes(fullLink)) {
              eventLinks.push(fullLink);
            }
          });
          
          const newLinksOnPage = eventLinks.length - linksBeforeThisPage;
          console.log(`[RSS] Page ${page}: found ${newLinksOnPage} new event links (total: ${eventLinks.length})`);
          
          if (newLinksOnPage === 0) {
            console.log(`[RSS] No new events on page ${page}, stopping pagination`);
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          console.log(`[RSS] Could not fetch page ${page}: ${error.message}`);
          break;
        }
      }

      console.log(`[RSS] Found ${eventLinks.length} Bernheze event links, fetching details...`);

      let successCount = 0;
      let skippedCount = 0;
      
      for (let i = 0; i < eventLinks.length; i++) {
        const link = eventLinks[i];
        try {
          console.log(`[RSS] Fetching Bernheze event ${i + 1}/${eventLinks.length}: ${link.split('/').pop()}`);
          const eventItems = await this.scrapeBernhezeEventDetail(link);
          if (eventItems.length > 0) {
            items.push(...eventItems);
            successCount++;
          } else {
            skippedCount++;
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error: any) {
          console.log(`[RSS] Error fetching ${link}: ${error.message}`);
          skippedCount++;
        }
      }

      console.log(`[RSS] Scraped ${items.length} events from Bernheze (${successCount} with GPS, ${skippedCount} skipped)`);
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping Bernheze:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  static async scrapeBernhezeEventDetail(url: string): Promise<ParsedFeedItem[]> {
    try {
      const items: ParsedFeedItem[] = [];
      
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml"
        },
        timeout: 15000
      });
      
      const $ = cheerio.load(response.data);
      const html = response.data;
      
      // Extract GPS from Google Maps embed: ?q=51.6547905027,5.47214570354
      let latitude: number | undefined;
      let longitude: number | undefined;
      
      const gpsMatch = html.match(/google\.com\/maps\/embed\/v1\/place\?q=([\d.]+),([\d.]+)/);
      if (gpsMatch) {
        latitude = parseFloat(gpsMatch[1]);
        longitude = parseFloat(gpsMatch[2]);
      }
      
      // QUALITY FILTER: Skip if no GPS coordinates
      if (!latitude || !longitude) {
        return items;
      }
      
      // Extract title
      const title = $('h1').first().text().trim();
      if (!title || title.length < 3) return items;
      
      // Extract description
      const description = $('article p, .content p, main p').first().text().trim() ||
                         $('meta[name="description"]').attr('content') || '';
      
      // Extract image
      const imageUrl = $('article img, .content img, main img').first().attr('src') ||
                      $('meta[property="og:image"]').attr('content');
      
      // Extract date from URL: /agenda/2025/12/11/event-name
      const dateMatch = url.match(/\/agenda\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
      let startTime: Date | undefined;
      let endTime: Date | undefined;
      
      if (dateMatch) {
        const year = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        const day = parseInt(dateMatch[3]);
        
        // Try to extract time from page content
        const timeText = $('time, .date, .time').text() || html;
        const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(?:-|tot|–)\s*(\d{1,2}):(\d{2})/);
        
        if (timeMatch) {
          startTime = new Date(year, month, day, parseInt(timeMatch[1]), parseInt(timeMatch[2]));
          endTime = new Date(year, month, day, parseInt(timeMatch[3]), parseInt(timeMatch[4]));
        } else {
          // Default times
          startTime = new Date(year, month, day, 10, 0);
          endTime = new Date(year, month, day, 22, 0);
        }
      }
      
      // Skip past events
      const now = new Date();
      if (!startTime || startTime < now) return items;
      
      // Extract location name
      const locationSection = $('h4:contains("Locatie")').next().text().trim() ||
                             $('li:contains("Locatie")').text().replace('Locatie', '').trim();
      const location = locationSection.split('\n')[0]?.trim() || 'Bernheze';
      
      // Extract address
      const addressMatch = html.match(/(\d{4}\s*[A-Z]{2})\s*([\w-]+)/);
      const address = addressMatch 
        ? `${location}, ${addressMatch[0]}` 
        : `${location}, Bernheze, Nederland`;
      
      // Generate external ID
      const externalId = `bernheze-${url.split('/').pop() || Date.now()}`;
      
      items.push({
        externalId,
        title: this.formatTitle(title),
        description: description.substring(0, 500) || `${title} - Evenement in Bernheze`,
        link: url,
        imageUrl: imageUrl || undefined,
        publishedAt: new Date(),
        startTime,
        endTime: endTime || new Date(startTime.getTime() + 2 * 60 * 60 * 1000),
        location,
        address,
        latitude,
        longitude,
        rawData: { url, location, address }
      });
      
      return items;
    } catch (error: any) {
      console.error(`[RSS] Error scraping Bernheze event detail ${url}:`, error.message);
      return [];
    }
  }

  /**
   * Generic Plaece CMS scraper - works for multiple sites using Plaece platform
   * Extracts GPS from JSON-LD data in detail pages
   */
  static async scrapePlaeceSite(config: {
    baseUrl: string;
    agendaPath: string;
    linkPattern: RegExp;
    municipality: string;
    maxPages?: number;
  }): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      const eventLinks: string[] = [];
      const maxPages = config.maxPages || 10;
      
      for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 
          ? `${config.baseUrl}${config.agendaPath}`
          : `${config.baseUrl}${config.agendaPath}?page=${page}`;
        
        console.log(`[RSS] Scraping ${config.municipality} page ${page}...`);
        
        try {
          const response = await axios.get(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "text/html,application/xhtml+xml"
            },
            timeout: 30000
          });

          const $ = cheerio.load(response.data);
          const linksBeforeThisPage = eventLinks.length;
          
          $(`a[href*="${config.agendaPath}/"]`).each((_, element) => {
            const href = $(element).attr("href");
            if (!href) return;
            if (href === config.agendaPath || href.includes("?page=") || href.includes("?calendar")) return;
            
            if (!config.linkPattern.test(href)) return;
            
            const fullLink = href.startsWith("http") 
              ? href 
              : `${config.baseUrl}${href}`;
            
            if (!eventLinks.includes(fullLink)) {
              eventLinks.push(fullLink);
            }
          });
          
          const newLinksOnPage = eventLinks.length - linksBeforeThisPage;
          console.log(`[RSS] Page ${page}: found ${newLinksOnPage} new event links (total: ${eventLinks.length})`);
          
          if (newLinksOnPage === 0) break;
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          console.log(`[RSS] Could not fetch page ${page}: ${error.message}`);
          break;
        }
      }

      console.log(`[RSS] Found ${eventLinks.length} ${config.municipality} event links, fetching details...`);

      let successCount = 0;
      let skippedCount = 0;
      
      for (let i = 0; i < eventLinks.length; i++) {
        const link = eventLinks[i];
        try {
          console.log(`[RSS] Fetching ${config.municipality} event ${i + 1}/${eventLinks.length}`);
          const eventItems = await this.scrapePlaeceSiteEventDetail(link, config.municipality);
          if (eventItems.length > 0) {
            items.push(...eventItems);
            successCount++;
          } else {
            skippedCount++;
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error: any) {
          skippedCount++;
        }
      }

      console.log(`[RSS] Scraped ${items.length} events from ${config.municipality} (${successCount} with GPS, ${skippedCount} skipped)`);
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping ${config.municipality}:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  static async scrapePlaeceSiteEventDetail(url: string, municipality: string): Promise<ParsedFeedItem[]> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml"
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const items: ParsedFeedItem[] = [];
      
      // Try JSON-LD first (most Plaece sites have this)
      const jsonLdScripts = $('script[type="application/ld+json"]');
      
      for (let i = 0; i < jsonLdScripts.length; i++) {
        const scriptContent = $(jsonLdScripts[i]).html();
        if (!scriptContent) continue;
        
        try {
          const jsonData = JSON.parse(scriptContent);
          const events = Array.isArray(jsonData) ? jsonData : [jsonData];
          
          for (const event of events) {
            if (event["@type"] !== "Event") continue;
            
            const name = event.name || "";
            if (!name) continue;
            
            const imageUrl = event.image || "";
            const location = event.location;
            const venueName = location?.name || "";
            const address = location?.address;
            const streetAddress = address?.streetAddress || "";
            const postalCode = address?.postalCode || "";
            const city = address?.addressLocality || municipality;
            const fullAddress = [streetAddress, postalCode, city].filter(Boolean).join(", ");
            
            const geo = location?.geo;
            const latitude = geo?.latitude;
            const longitude = geo?.longitude;
            
            // QUALITY FILTER: Only import events with verified GPS
            if (!latitude || !longitude) {
              console.log(`[RSS] SKIPPED ${municipality} event (no GPS): ${name}`);
              continue;
            }
            
            const startDate = event.startDate ? new Date(event.startDate) : undefined;
            const endDate = event.endDate ? new Date(event.endDate) : undefined;
            
            if (startDate && startDate < new Date()) continue;
            
            const urlSlug = url.split('/').pop() || url.replace(/[^a-z0-9]/gi, "-");
            const externalId = `${municipality.toLowerCase().replace(/\s+/g, '-')}-${urlSlug}`;
            
            let description = event.description || "";
            if (!description || description.length < 20) {
              description = `${name} bij ${venueName || city}. ${fullAddress ? `Locatie: ${fullAddress}.` : ""}`;
            }
            
            items.push({
              externalId,
              title: this.formatTitle(name),
              description: this.cleanText(description.substring(0, 500)),
              link: url,
              imageUrl: imageUrl || undefined,
              publishedAt: new Date(),
              startTime: startDate,
              endTime: endDate || (startDate ? new Date(startDate.getTime() + 3 * 60 * 60 * 1000) : undefined),
              location: venueName || city,
              address: fullAddress,
              latitude,
              longitude,
              rawData: { url, venueName, city }
            });
          }
        } catch (parseError) {
          continue;
        }
      }
      
      // Fallback: Try to extract GPS from Google Maps links if JSON-LD failed
      if (items.length === 0) {
        let latitude: number | undefined;
        let longitude: number | undefined;
        
        $('a[href*="google.com/maps"]').each((_, el) => {
          if (latitude && longitude) return;
          const href = $(el).attr('href') || '';
          
          let coordMatch = href.match(/destination=([0-9.-]+)%2C([0-9.-]+)/);
          if (!coordMatch) coordMatch = href.match(/destination=([0-9.-]+),([0-9.-]+)/);
          if (!coordMatch) coordMatch = href.match(/@([0-9.-]+),([0-9.-]+)/);
          if (!coordMatch) coordMatch = href.match(/q=([0-9.-]+),([0-9.-]+)/);
          
          if (coordMatch) {
            const lat = parseFloat(coordMatch[1]);
            const lng = parseFloat(coordMatch[2]);
            if (lat >= 50 && lat <= 54 && lng >= 3 && lng <= 8) {
              latitude = lat;
              longitude = lng;
            }
          }
        });
        
        if (latitude && longitude) {
          const title = $('h1').first().text().trim();
          if (title && title.length > 3) {
            let imageUrl = '';
            $('img').each((_, el) => {
              const src = $(el).attr('src') || '';
              if (src.includes('assets.plaece.nl') && !imageUrl) {
                imageUrl = src;
              }
            });
            
            items.push({
              externalId: `${municipality.toLowerCase().replace(/\s+/g, '-')}-${url.split('/').pop() || Date.now()}`,
              title: this.formatTitle(title),
              description: `${title} - Evenement in ${municipality}`,
              link: url,
              imageUrl: imageUrl || undefined,
              publishedAt: new Date(),
              startTime: new Date(),
              endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
              location: municipality,
              address: `${municipality}, Nederland`,
              latitude,
              longitude,
              rawData: { url }
            });
          }
        }
      }
      
      return items;
    } catch (error: any) {
      console.error(`[RSS] Error scraping ${municipality} event detail ${url}:`, error.message);
      return [];
    }
  }

  // Boxtel scraper using Plaece CMS
  static async scrapeBoxtel(): Promise<FeedParseResult> {
    return this.scrapePlaeceSite({
      baseUrl: 'https://www.beleefboxtel.nl',
      agendaPath: '/uitagenda',
      linkPattern: /\/uitagenda\/\d+\/[a-z0-9-]+/,
      municipality: 'Boxtel'
    });
  }

  // Sint-Michielsgestel scraper using Plaece CMS
  static async scrapeSintMichielsgestel(): Promise<FeedParseResult> {
    return this.scrapePlaeceSite({
      baseUrl: 'https://www.goedgestel.nl',
      agendaPath: '/uitagenda',
      linkPattern: /\/uitagenda\/\d+\/[a-z0-9-]+/,
      municipality: 'Sint-Michielsgestel'
    });
  }

  // Vught scraper using Plaece CMS
  static async scrapeVught(): Promise<FeedParseResult> {
    return this.scrapePlaeceSite({
      baseUrl: 'https://www.visitvught.nl',
      agendaPath: '/agenda',
      linkPattern: /\/agenda\/\d+\/[a-z0-9-]+/,
      municipality: 'Vught'
    });
  }

  // Oosterhout scraper using Plaece CMS
  static async scrapeOosterhout(): Promise<FeedParseResult> {
    return this.scrapePlaeceSite({
      baseUrl: 'https://www.beleveninoosterhout.nl',
      agendaPath: '/uitagenda',
      linkPattern: /\/uitagenda\/\d+\/[a-z0-9-]+/,
      municipality: 'Oosterhout'
    });
  }

  // Oisterwijk scraper using Plaece CMS
  static async scrapeOisterwijk(): Promise<FeedParseResult> {
    return this.scrapePlaeceSite({
      baseUrl: 'https://www.bezoekoisterwijk.nl',
      agendaPath: '/uitagenda',
      linkPattern: /\/uitagenda\/\d+\/[a-z0-9-]+/,
      municipality: 'Oisterwijk'
    });
  }

  // Breda scraper - uses Prepr CMS via Next.js with __NEXT_DATA__ extraction
  static async scrapeBreda(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      const eventLinks: string[] = [];
      const maxPages = 10;
      
      // Step 1: Collect event URLs from /nl/evenementen pages
      for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 
          ? "https://www.explorebreda.com/nl/evenementen"
          : `https://www.explorebreda.com/nl/evenementen?page=${page}`;
        
        console.log(`[RSS] Scraping Breda page ${page}...`);
        
        try {
          const response = await axios.get(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "text/html,application/xhtml+xml"
            },
            timeout: 30000
          });

          const $ = cheerio.load(response.data);
          const linksBeforeThisPage = eventLinks.length;
          
          // Find event links with pattern /nl/evenementen/slug
          $('a[href*="/nl/evenementen/"]').each((_, element) => {
            const href = $(element).attr("href");
            if (!href || href === "/nl/evenementen" || href.includes("?page=") || href.includes("?")) return;
            
            const fullLink = href.startsWith("http") 
              ? href 
              : `https://www.explorebreda.com${href}`;
            
            if (!eventLinks.includes(fullLink) && fullLink.match(/\/nl\/evenementen\/[a-z0-9-]+$/)) {
              eventLinks.push(fullLink);
            }
          });
          
          const newLinksOnPage = eventLinks.length - linksBeforeThisPage;
          console.log(`[RSS] Page ${page}: found ${newLinksOnPage} new event links (total: ${eventLinks.length})`);
          
          if (newLinksOnPage === 0) break;
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          console.log(`[RSS] Could not fetch page ${page}: ${error.message}`);
          break;
        }
      }

      console.log(`[RSS] Found ${eventLinks.length} Breda event links, fetching details...`);

      let successCount = 0;
      let skippedCount = 0;
      
      // Step 2: Fetch each event page and extract __NEXT_DATA__
      for (let i = 0; i < eventLinks.length; i++) {
        const link = eventLinks[i];
        try {
          console.log(`[RSS] Fetching Breda event ${i + 1}/${eventLinks.length}`);
          
          const response = await axios.get(link, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "text/html,application/xhtml+xml"
            },
            timeout: 30000
          });
          
          const $ = cheerio.load(response.data);
          
          // Extract __NEXT_DATA__ JSON
          const nextDataScript = $('script#__NEXT_DATA__').html();
          if (!nextDataScript) {
            skippedCount++;
            continue;
          }
          
          const nextData = JSON.parse(nextDataScript);
          const page = nextData?.props?.pageProps?.page;
          
          if (!page || page.typename !== 'EventPage') {
            skippedCount++;
            continue;
          }
          
          // Extract GPS coordinates from coordinates field
          const coordinates = page.coordinates;
          if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
            console.log(`[RSS] Skipping ${page.title}: no GPS coordinates`);
            skippedCount++;
            continue;
          }
          
          const latitude = coordinates.latitude;
          const longitude = coordinates.longitude;
          
          // Validate coordinates
          if (Math.abs(latitude) < 1 || Math.abs(longitude) < 0.1) {
            skippedCount++;
            continue;
          }
          
          // Extract dates - Breda uses 'from' and 'until' instead of 'startDate' and 'endDate'
          const dates = page.dates || [];
          const now = new Date();
          let startTime: Date | undefined;
          let endTime: Date | undefined;
          
          if (dates.length > 0) {
            // Find future dates using 'from' and 'until' fields (Prepr CMS format)
            const futureDates = dates
              .filter((d: any) => d.from)
              .map((d: any) => ({
                start: new Date(d.from),
                end: d.until ? new Date(d.until) : new Date(d.from)
              }))
              .filter((d: any) => d.end >= now)
              .sort((a: any, b: any) => a.start.getTime() - b.start.getTime());
            
            if (futureDates.length > 0) {
              startTime = futureDates[0].start;
              endTime = futureDates[futureDates.length - 1].end;
            }
          }
          
          // Skip past events (but allow events without dates if they have future content)
          if (!startTime) {
            // If no dates but event exists, use current date as fallback
            startTime = new Date();
            endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
          }
          
          // Extract image
          let imageUrl: string | undefined;
          if (page.image?.url) {
            imageUrl = page.image.url;
          } else if (page.extraImages?.[0]?.url) {
            imageUrl = page.extraImages[0].url;
          }
          
          // Build description
          let description = '';
          if (page.introText) {
            description = page.introText.replace(/<[^>]+>/g, '').trim();
          }
          if (page.description) {
            const descText = typeof page.description === 'string' 
              ? page.description 
              : JSON.stringify(page.description);
            description = description 
              ? `${description}\n\n${descText.replace(/<[^>]+>/g, '').trim()}`
              : descText.replace(/<[^>]+>/g, '').trim();
          }
          
          // Add source link
          description = description 
            ? `${description}\n\nMeer info: ${link}`
            : `Meer info: ${link}`;
          
          // Create event item
          const slug = page.slug || link.split('/').pop() || '';
          
          // For multi-day events, create one item per date (using 'from' and 'until')
          if (dates.length > 1) {
            for (const dateEntry of dates) {
              const dateStart = new Date(dateEntry.from);
              const dateEnd = dateEntry.until ? new Date(dateEntry.until) : dateStart;
              
              if (dateEnd < now) continue;
              
              items.push({
                externalId: `breda-${page.id}-${dateStart.toISOString().split('T')[0]}`,
                title: this.formatTitle(page.title),
                description: this.cleanText(description),
                link,
                imageUrl,
                publishedAt: new Date(),
                startTime: dateStart,
                endTime: dateEnd,
                latitude,
                longitude,
                location: page.location?.[0]?.title || page.address?.title || 'Breda',
                address: this.formatBredaAddress(page.address) || 'Breda, Nederland',
                rawData: { preprId: page.id, slug, category: page.category?.title }
              });
            }
          } else {
            items.push({
              externalId: `breda-${page.id}`,
              title: this.formatTitle(page.title),
              description: this.cleanText(description),
              link,
              imageUrl,
              publishedAt: new Date(),
              startTime,
              endTime,
              latitude,
              longitude,
              location: page.location?.[0]?.title || page.address?.title || 'Breda',
              address: this.formatBredaAddress(page.address) || 'Breda, Nederland',
              rawData: { preprId: page.id, slug, category: page.category?.title }
            });
          }
          
          successCount++;
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error: any) {
          console.log(`[RSS] Error fetching ${link}: ${error.message}`);
          skippedCount++;
        }
      }

      console.log(`[RSS] Scraped ${items.length} events from Breda (${successCount} with GPS, ${skippedCount} skipped)`);
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping Breda:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  /**
   * TILBURG SCRAPER - Custom scraper for tilburg.com agenda
   * Scrapes the full agenda page and fetches event details from individual pages
   * Each event page contains: title, date, time, venue, description, image
   */
  static async scrapeTilburg(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      const agendaUrl = 'https://tilburg.com/agenda-tilburg/';
      
      console.log(`[RSS] Scraping Tilburg full agenda...`);
      
      // Known Tilburg venues with GPS coordinates
      const tilburgVenues: Record<string, { lat: number; lng: number; address: string }> = {
        'koepelhal': { lat: 51.5577, lng: 5.0790, address: 'Koepelhal, Tilburg' },
        'binnenstad': { lat: 51.5594, lng: 5.0854, address: 'Binnenstad, Tilburg' },
        'spoorpark': { lat: 51.5630, lng: 5.0890, address: 'Spoorpark, Tilburg' },
        'spoorzone': { lat: 51.5615, lng: 5.0855, address: 'Spoorzone, Tilburg' },
        'spoorboulevard': { lat: 51.5615, lng: 5.0855, address: 'Spoorboulevard, Tilburg' },
        'piusplein': { lat: 51.5605, lng: 5.0825, address: 'Piusplein, Tilburg' },
        'piushaven': { lat: 51.5610, lng: 5.0705, address: 'Piushaven, Tilburg' },
        'reeshofpark': { lat: 51.5310, lng: 5.0270, address: 'Reeshofpark, Tilburg' },
        'reeshofplein': { lat: 51.5310, lng: 5.0270, address: 'Reeshofplein, Tilburg' },
        'het laar': { lat: 51.5440, lng: 5.0665, address: 'Het Laar, Tilburg' },
        'de heuvel': { lat: 51.5585, lng: 5.0855, address: 'De Heuvel, Tilburg' },
        'stadhuisstraat': { lat: 51.5590, lng: 5.0840, address: 'Stadhuisstraat, Tilburg' },
        'wilhelminapark': { lat: 51.5495, lng: 5.0880, address: 'Wilhelminapark, Tilburg' },
        'leijpark': { lat: 51.5575, lng: 5.1205, address: 'Leijpark, Tilburg' },
        'tilburg university': { lat: 51.5676, lng: 5.0433, address: 'Tilburg University' },
        'oude warande': { lat: 51.5540, lng: 5.0970, address: 'De Oude Warande, Tilburg' },
        'ireen wüstbaan': { lat: 51.5555, lng: 5.0480, address: 'IJssportcentrum, Tilburg' },
        'ireen wustbaan': { lat: 51.5555, lng: 5.0480, address: 'IJssportcentrum, Tilburg' },
        '013': { lat: 51.5565, lng: 5.0830, address: 'Poppodium 013, Tilburg' },
        'wagenmakerij': { lat: 51.5610, lng: 5.0870, address: 'Wagenmakerij, Tilburg' },
        'hall of fame': { lat: 51.5550, lng: 5.0640, address: 'Hall of Fame, Tilburg' },
        'prise d\'eau': { lat: 51.5425, lng: 5.1230, address: 'Prise d\'Eau Golf, Tilburg' },
        'prise deau': { lat: 51.5425, lng: 5.1230, address: 'Prise d\'Eau Golf, Tilburg' },
        'klasse': { lat: 51.5583, lng: 5.0848, address: 'Klasse, Tilburg' },
        'lochal': { lat: 51.5615, lng: 5.0868, address: 'LocHal, Tilburg' },
        'pathé': { lat: 51.5580, lng: 5.0850, address: 'Pathé Tilburg Centrum, Tilburg' },
        'pathe': { lat: 51.5580, lng: 5.0850, address: 'Pathé Tilburg Centrum, Tilburg' },
        'rosalie': { lat: 51.5600, lng: 5.0820, address: 'Rosalie, Tilburg' },
        'capt. j\'s hurricane': { lat: 51.5575, lng: 5.0835, address: 'Capt. J\'s Hurricane, Tilburg' },
        'capt j': { lat: 51.5575, lng: 5.0835, address: 'Capt. J\'s Hurricane, Tilburg' },
        'hurricane': { lat: 51.5575, lng: 5.0835, address: 'Capt. J\'s Hurricane, Tilburg' },
        'boemel': { lat: 51.5565, lng: 5.0830, address: 'Stadstheater De Boemel, Tilburg' },
        'cenakel': { lat: 51.5580, lng: 5.0870, address: 'Het Cenakel, Tilburg' },
        'bet kolen': { lat: 51.5570, lng: 5.0840, address: 'Café Bet Kolen, Tilburg' },
        'de schalm': { lat: 51.5320, lng: 5.0290, address: 'SCC De Schalm, Tilburg' },
        'koning willem ii': { lat: 51.5535, lng: 5.0730, address: 'Koning Willem II Stadion, Tilburg' },
        'willem ii stadion': { lat: 51.5535, lng: 5.0730, address: 'Koning Willem II Stadion, Tilburg' },
        'trappers': { lat: 51.5555, lng: 5.0480, address: 'IJssportcentrum Stappegoor, Tilburg' },
        'ijssportcentrum': { lat: 51.5555, lng: 5.0480, address: 'IJssportcentrum Stappegoor, Tilburg' },
        'stappegoor': { lat: 51.5535, lng: 5.0730, address: 'Stappegoor, Tilburg' },
        'jeruzalem': { lat: 51.5520, lng: 5.0550, address: 'Buurthuis Jeruzalem, Tilburg' },
        'contourdetwern': { lat: 51.5560, lng: 5.0800, address: 'ContourdeTwern, Tilburg' },
        'giardino': { lat: 51.5310, lng: 5.0270, address: 'Giardino D\'Italia, Tilburg' },
        'zeven geitjes': { lat: 51.5480, lng: 5.0920, address: 'De Zeven Geitjes, Tilburg' },
      };
      
      // Dutch month names for parsing
      const monthNames: Record<string, number> = {
        'januari': 0, 'februari': 1, 'maart': 2, 'april': 3,
        'mei': 4, 'juni': 5, 'juli': 6, 'augustus': 7,
        'september': 8, 'oktober': 9, 'november': 10, 'december': 11
      };
      
      // Step 1: Fetch all pages of the agenda (paginated at /page/2/, /page/3/, etc.)
      const eventLinks: string[] = [];
      const maxPages = 50; // Safety limit
      
      // Helper function to extract event links from a page
      const extractEventLinks = ($: cheerio.CheerioAPI) => {
        const links: string[] = [];
        $('a.tb-grid-item').each((_, el) => {
          const href = $(el).attr('href');
          if (href && href.includes('/agenda/') && !links.includes(href) && !eventLinks.includes(href)) {
            links.push(href);
          }
        });
        $('a[href*="/agenda/"]').each((_, el) => {
          const href = $(el).attr('href');
          if (href && href.includes('tilburg.com/agenda/') && 
              !href.endsWith('/agenda/') && !href.endsWith('/agenda-tilburg/') &&
              !href.includes('/page/') && !links.includes(href) && !eventLinks.includes(href)) {
            links.push(href);
          }
        });
        return links;
      };
      
      // Fetch page 1 (main agenda URL)
      console.log(`[RSS] Fetching Tilburg agenda page 1...`);
      const page1Response = await axios.get(agendaUrl, {
        headers: { "User-Agent": this.USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
        timeout: 30000
      });
      const $page1 = cheerio.load(page1Response.data);
      const page1Links = extractEventLinks($page1);
      eventLinks.push(...page1Links);
      console.log(`[RSS] Page 1: found ${page1Links.length} event links`);
      
      // Fetch subsequent pages (start at page 2)
      for (let pageNum = 2; pageNum <= maxPages; pageNum++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 300)); // Rate limiting
          
          const pageUrl = `${agendaUrl}page/${pageNum}/`;
          console.log(`[RSS] Fetching Tilburg agenda page ${pageNum}...`);
          
          const pageResponse = await axios.get(pageUrl, {
            headers: { "User-Agent": this.USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
            timeout: 30000
          });
          
          const $page = cheerio.load(pageResponse.data);
          const pageLinks = extractEventLinks($page);
          
          if (pageLinks.length === 0) {
            console.log(`[RSS] Page ${pageNum}: no new events, stopping pagination`);
            break;
          }
          
          eventLinks.push(...pageLinks);
          console.log(`[RSS] Page ${pageNum}: found ${pageLinks.length} new event links (total: ${eventLinks.length})`);
          
        } catch (error: any) {
          // 404 means we've reached the end of pagination
          if (error.response?.status === 404) {
            console.log(`[RSS] Page ${pageNum}: 404, end of pagination reached`);
            break;
          }
          console.log(`[RSS] Page ${pageNum}: error ${error.message}, stopping pagination`);
          break;
        }
      }
      
      console.log(`[RSS] Total: found ${eventLinks.length} event links across all pages`);
      
      // Step 2: Fetch each event page for details
      let successCount = 0;
      let skippedCount = 0;
      
      for (const eventUrl of eventLinks) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
          
          const eventResponse = await axios.get(eventUrl, {
            headers: {
              "User-Agent": this.USER_AGENT,
              "Accept": "text/html,application/xhtml+xml"
            },
            timeout: 15000
          });
          
          const $event = cheerio.load(eventResponse.data);
          
          // Extract title from h1.tribe-events-single-event-title or og:title
          let title = $event('h1.tribe-events-single-event-title').first().text().trim();
          if (!title) {
            title = $event('meta[property="og:title"]').attr('content') || '';
          }
          title = this.formatTitle(title.replace(' - Tilburg.com', '').trim());
          
          if (!title || title.length < 3) {
            skippedCount++;
            continue;
          }
          
          // Extract description from og:description or meta description
          let description = $event('meta[property="og:description"]').attr('content') || 
                           $event('meta[name="description"]').attr('content') || '';
          
          // Extract image from og:image
          const imageUrl = $event('meta[property="og:image"]').attr('content') || undefined;
          
          // Extract date and time from event-informatie div
          // Pattern: <div class='informate-data-item'><span class='informate-sub-text'>Datum:</span><div class='info-date-item'>12 december 2025</div></div>
          let dateText = '';
          let timeText = '';
          let locationName = 'Tilburg';
          let priceText = '';
          
          $event('.informate-data-item').each((_, infoItem) => {
            const label = $event(infoItem).find('.informate-sub-text').text().trim().toLowerCase();
            const value = $event(infoItem).find('.info-date-item').text().trim() || 
                         $event(infoItem).contents().filter(function() { return this.type === 'text'; }).text().trim();
            
            if (label.includes('datum')) {
              dateText = value;
            } else if (label.includes('tijd')) {
              timeText = value;
            } else if (label.includes('prijs')) {
              priceText = value;
            }
          });
          
          // Also check for location in informate-sub-text with "Locatie:"
          $event('.informate-sub-text').each((_, labelEl) => {
            const labelText = $event(labelEl).text().trim().toLowerCase();
            if (labelText.includes('locatie')) {
              // Get next sibling text node or element
              const parent = $event(labelEl).parent();
              const fullText = parent.text();
              const locMatch = fullText.match(/locatie[:\s]*(.*?)(?:$|datum|tijd|prijs)/i);
              if (locMatch) {
                locationName = locMatch[1].trim();
              }
            }
          });
          
          // Try to get venue from bedrijf link
          const venueLink = $event('a[href*="/bedrijf/"]').first();
          if (venueLink.length) {
            const venueName = venueLink.text().trim();
            if (venueName && venueName.length > 2) {
              locationName = venueName;
            }
          }
          
          // Parse date: "12 december 2025" or "12 december 2025 19:30 - 13 december 2025 00:30"
          let startTime: Date | undefined;
          let endTime: Date | undefined;
          
          // Handle multi-day format: "12 december 2025 19:30 - 13 december 2025 00:30"
          const multiDayMatch = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})(?:\s+(\d{1,2}:\d{2}))?\s*[-–]\s*(\d{1,2})\s+(\w+)\s+(\d{4})(?:\s+(\d{1,2}:\d{2}))?/);
          
          if (multiDayMatch) {
            const startDay = parseInt(multiDayMatch[1]);
            const startMonthName = multiDayMatch[2].toLowerCase();
            const startYear = parseInt(multiDayMatch[3]);
            const startTimeStr = multiDayMatch[4] || '12:00';
            
            const endDay = parseInt(multiDayMatch[5]);
            const endMonthName = multiDayMatch[6].toLowerCase();
            const endYear = parseInt(multiDayMatch[7]);
            const endTimeStr = multiDayMatch[8] || '23:59';
            
            const startMonth = monthNames[startMonthName];
            const endMonth = monthNames[endMonthName];
            
            if (startMonth !== undefined && endMonth !== undefined) {
              const [startHour, startMin] = startTimeStr.split(':').map(Number);
              const [endHour, endMin] = endTimeStr.split(':').map(Number);
              
              startTime = new Date(startYear, startMonth, startDay, startHour || 12, startMin || 0);
              endTime = new Date(endYear, endMonth, endDay, endHour || 23, endMin || 59);
            }
          } else {
            // Single day format: "12 december 2025"
            const singleDayMatch = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
            if (singleDayMatch) {
              const day = parseInt(singleDayMatch[1]);
              const monthName = singleDayMatch[2].toLowerCase();
              const year = parseInt(singleDayMatch[3]);
              const month = monthNames[monthName];
              
              if (month !== undefined) {
                // Parse time from timeText: "19:00 tot 20:30"
                let startHour = 12, startMin = 0, endHour = 23, endMin = 59;
                
                const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(?:tot|[-–])\s*(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                  startHour = parseInt(timeMatch[1]);
                  startMin = parseInt(timeMatch[2]);
                  endHour = parseInt(timeMatch[3]);
                  endMin = parseInt(timeMatch[4]);
                } else {
                  // Try single time: "19:00"
                  const singleTimeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
                  if (singleTimeMatch) {
                    startHour = parseInt(singleTimeMatch[1]);
                    startMin = parseInt(singleTimeMatch[2]);
                    endHour = startHour + 3; // Assume 3 hour duration
                    if (endHour > 23) endHour = 23;
                  }
                }
                
                startTime = new Date(year, month, day, startHour, startMin);
                endTime = new Date(year, month, day, endHour, endMin);
                
                // Handle overnight events
                if (endTime <= startTime) {
                  endTime.setDate(endTime.getDate() + 1);
                }
              }
            }
          }
          
          if (!startTime || !endTime) {
            console.log(`[RSS] Tilburg: Skipping "${title}" - could not parse date: "${dateText}"`);
            skippedCount++;
            continue;
          }
          
          // Skip past events
          if (endTime < new Date()) {
            skippedCount++;
            continue;
          }
          
          // Find GPS coordinates for venue
          let latitude: number | undefined;
          let longitude: number | undefined;
          let address = `${locationName}, Tilburg`;
          
          const locationLower = locationName.toLowerCase();
          const titleLower = title.toLowerCase();
          
          // Check venues in both location and title
          for (const [venueName, coords] of Object.entries(tilburgVenues)) {
            if (locationLower.includes(venueName) || titleLower.includes(venueName)) {
              latitude = coords.lat;
              longitude = coords.lng;
              address = coords.address;
              break;
            }
          }
          
          // If no venue found, try geocoding
          if (!latitude || !longitude) {
            try {
              const geoResult = await this.geocodeAddress(`${locationName}, Tilburg, Netherlands`);
              if (geoResult && geoResult.lat && geoResult.lon) {
                latitude = geoResult.lat;
                longitude = geoResult.lon;
              }
            } catch (e) {
              // Geocoding failed, use default
            }
          }
          
          // Default to Tilburg center if still no coordinates
          if (!latitude || !longitude) {
            latitude = 51.5562;
            longitude = 5.0886;
            console.log(`[RSS] Tilburg: Using default coords for "${title}" (venue: ${locationName})`);
          }
          
          // Generate external ID from URL slug
          const urlSlug = eventUrl.split('/agenda/')[1]?.replace(/\/$/, '') || '';
          const externalId = `tilburg-${urlSlug || title.substring(0, 30).replace(/[^a-z0-9]/gi, '-')}`;
          
          items.push({
            externalId,
            title,
            description: description || `${title} bij ${locationName} in Tilburg.`,
            link: eventUrl,
            imageUrl,
            publishedAt: new Date(),
            startTime,
            endTime,
            latitude,
            longitude,
            location: locationName,
            address,
            rawData: { 
              source: 'tilburg-agenda', 
              dateText, 
              timeText, 
              price: priceText 
            }
          });
          
          successCount++;
          console.log(`[RSS] Tilburg: Parsed "${title}" at ${locationName} (${startTime.toLocaleDateString('nl-NL')})`);
          
        } catch (error: any) {
          console.log(`[RSS] Error fetching ${eventUrl}: ${error.message}`);
          skippedCount++;
        }
      }

      console.log(`[RSS] Scraped ${items.length} events from Tilburg agenda (${successCount} success, ${skippedCount} skipped)`);
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping Tilburg:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  /**
   * INTONIJMEGEN SCRAPER - Scrapes events from intonijmegen.com
   * The website has an agenda page with event listings
   */
  static async scrapeIntoNijmegen(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      const baseUrl = 'https://www.intonijmegen.com';
      const agendaUrl = `${baseUrl}/agenda/agenda-overzicht`;
      
      console.log(`[RSS] Scraping IntoNijmegen agenda...`);
      
      // Known Nijmegen venues with GPS coordinates
      const nijmegenVenues: Record<string, { lat: number; lng: number; address: string }> = {
        'doornroosje': { lat: 51.8414, lng: 5.8689, address: 'Doornroosje, Nijmegen' },
        'de vereeniging': { lat: 51.8445, lng: 5.8674, address: 'Concertgebouw De Vereeniging, Nijmegen' },
        'lindenbergtheater': { lat: 51.8448, lng: 5.8646, address: 'LindenbergTheater, Nijmegen' },
        'lindenberg': { lat: 51.8448, lng: 5.8646, address: 'LindenbergTheater, Nijmegen' },
        'honig complex': { lat: 51.8440, lng: 5.8505, address: 'Honig Complex, Nijmegen' },
        'honigcomplex': { lat: 51.8440, lng: 5.8505, address: 'Honig Complex, Nijmegen' },
        'waalkade': { lat: 51.8468, lng: 5.8665, address: 'Waalkade, Nijmegen' },
        'grote markt': { lat: 51.8461, lng: 5.8636, address: 'Grote Markt, Nijmegen' },
        'valkhof': { lat: 51.8487, lng: 5.8688, address: 'Valkhofpark, Nijmegen' },
        'valkhofpark': { lat: 51.8487, lng: 5.8688, address: 'Valkhofpark, Nijmegen' },
        'goffertpark': { lat: 51.8280, lng: 5.8510, address: 'Goffertpark, Nijmegen' },
        'goffertstadion': { lat: 51.8280, lng: 5.8510, address: 'Goffertstadion, Nijmegen' },
        'de stevenskerk': { lat: 51.8465, lng: 5.8620, address: 'Stevenskerk, Nijmegen' },
        'stevenskerk': { lat: 51.8465, lng: 5.8620, address: 'Stevenskerk, Nijmegen' },
        'merleyn': { lat: 51.8426, lng: 5.8658, address: 'Merleyn, Nijmegen' },
        'lux': { lat: 51.8465, lng: 5.8570, address: 'LUX, Nijmegen' },
        'luxor': { lat: 51.8465, lng: 5.8570, address: 'LUX, Nijmegen' },
        'kronenburgerpark': { lat: 51.8440, lng: 5.8580, address: 'Kronenburgerpark, Nijmegen' },
        'museum het valkhof': { lat: 51.8495, lng: 5.8700, address: 'Museum Het Valkhof, Nijmegen' },
        'de bastei': { lat: 51.8495, lng: 5.8660, address: 'De Bastei, Nijmegen' },
        'de lindenberg': { lat: 51.8448, lng: 5.8646, address: 'De Lindenberg, Nijmegen' },
        'stadsschouwburg': { lat: 51.8445, lng: 5.8674, address: 'Stadsschouwburg, Nijmegen' },
        'radboud universiteit': { lat: 51.8203, lng: 5.8657, address: 'Radboud Universiteit, Nijmegen' },
        'hunnerpark': { lat: 51.8505, lng: 5.8650, address: 'Hunnerpark, Nijmegen' },
        'de kaaij': { lat: 51.8500, lng: 5.8730, address: 'De Kaaij, Nijmegen' },
        'onderbroek': { lat: 51.8480, lng: 5.8600, address: 'De Onderbroek, Nijmegen' },
      };
      
      // Dutch month names
      const monthNames: Record<string, number> = {
        'januari': 0, 'februari': 1, 'maart': 2, 'april': 3,
        'mei': 4, 'juni': 5, 'juli': 6, 'augustus': 7,
        'september': 8, 'oktober': 9, 'november': 10, 'december': 11,
        'jan': 0, 'feb': 1, 'mrt': 2, 'apr': 3,
        'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
      };
      
      // Step 1: Collect all event links from the agenda pages
      const eventLinks: string[] = [];
      const maxPages = 30;
      
      for (let page = 1; page <= maxPages; page++) {
        try {
          const pageUrl = page === 1 ? agendaUrl : `${agendaUrl}?page=${page}`;
          console.log(`[RSS] Fetching IntoNijmegen agenda page ${page}...`);
          
          const response = await axios.get(pageUrl, {
            headers: { "User-Agent": this.USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
            timeout: 30000
          });
          
          const $ = cheerio.load(response.data);
          const linksBeforeThisPage = eventLinks.length;
          
          // Find event links - look for agenda item links
          $('a[href*="/agenda/"]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href || href === '/agenda' || href.includes('agenda-overzicht') || href.includes('?page=')) return;
            
            const fullLink = href.startsWith('http') ? href : `${baseUrl}${href}`;
            if (!eventLinks.includes(fullLink)) {
              eventLinks.push(fullLink);
            }
          });
          
          const newLinksOnPage = eventLinks.length - linksBeforeThisPage;
          console.log(`[RSS] Page ${page}: found ${newLinksOnPage} new event links (total: ${eventLinks.length})`);
          
          if (newLinksOnPage === 0) {
            console.log(`[RSS] No new events on page ${page}, stopping pagination`);
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          if (error.response?.status === 404) {
            console.log(`[RSS] Page ${page}: 404, end of pagination`);
            break;
          }
          console.log(`[RSS] Page ${page} error: ${error.message}`);
          break;
        }
      }
      
      console.log(`[RSS] Found ${eventLinks.length} Nijmegen event links, fetching details...`);
      
      // Step 2: Fetch each event page for details
      let successCount = 0;
      let skippedCount = 0;
      
      for (let i = 0; i < eventLinks.length; i++) {
        const eventUrl = eventLinks[i];
        try {
          if (i > 0 && i % 20 === 0) {
            console.log(`[RSS] Progress: ${i}/${eventLinks.length} events processed (${successCount} success, ${skippedCount} skipped)`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 400));
          
          const eventResponse = await axios.get(eventUrl, {
            headers: { "User-Agent": this.USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
            timeout: 15000
          });
          
          const $ = cheerio.load(eventResponse.data);
          
          // Try to find JSON-LD structured data first
          let eventData: any = null;
          const jsonLdScripts = $('script[type="application/ld+json"]');
          
          for (let j = 0; j < jsonLdScripts.length; j++) {
            try {
              const content = $(jsonLdScripts[j]).html();
              if (!content) continue;
              const parsed = JSON.parse(content);
              const events = Array.isArray(parsed) ? parsed : [parsed];
              for (const ev of events) {
                if (ev['@type'] === 'Event') {
                  eventData = ev;
                  break;
                }
              }
              if (eventData) break;
            } catch {}
          }
          
          let title = '';
          let description = '';
          let imageUrl = '';
          let venueName = '';
          let fullAddress = '';
          let latitude: number | undefined;
          let longitude: number | undefined;
          let startTime: Date | undefined;
          let endTime: Date | undefined;
          
          if (eventData) {
            // Extract from JSON-LD
            title = eventData.name || '';
            description = eventData.description || '';
            imageUrl = eventData.image || '';
            
            const location = eventData.location;
            if (location) {
              venueName = location.name || '';
              const address = location.address;
              if (typeof address === 'string') {
                fullAddress = address;
              } else if (address) {
                fullAddress = [address.streetAddress, address.postalCode, address.addressLocality].filter(Boolean).join(', ');
              }
              if (location.geo) {
                latitude = parseFloat(location.geo.latitude);
                longitude = parseFloat(location.geo.longitude);
              }
            }
            
            if (eventData.startDate) {
              startTime = new Date(eventData.startDate);
            }
            if (eventData.endDate) {
              endTime = new Date(eventData.endDate);
            }
          } else {
            // Fallback to HTML scraping
            title = $('h1').first().text().trim() || $('title').text().split('|')[0].trim();
            description = $('meta[name="description"]').attr('content') || 
                         $('.event-description, .description, .content').first().text().trim();
            imageUrl = $('meta[property="og:image"]').attr('content') || 
                      $('.event-image img, .hero-image img, article img').first().attr('src') || '';
            
            // Try to find date info
            const dateText = $('.event-date, .date, time').first().text().toLowerCase();
            const dateMatch = dateText.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|okt|nov|dec)\s*(\d{4})?/);
            if (dateMatch) {
              const day = parseInt(dateMatch[1]);
              const month = monthNames[dateMatch[2]];
              const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
              if (!isNaN(day) && month !== undefined) {
                startTime = new Date(year, month, day);
              }
            }
            
            venueName = $('.venue, .location-name').first().text().trim();
          }
          
          if (!title) {
            skippedCount++;
            continue;
          }
          
          // Try to match venue to known locations
          if (!latitude || !longitude) {
            const venueLower = (venueName + ' ' + fullAddress).toLowerCase();
            for (const [key, venue] of Object.entries(nijmegenVenues)) {
              if (venueLower.includes(key)) {
                latitude = venue.lat;
                longitude = venue.lng;
                if (!fullAddress) fullAddress = venue.address;
                break;
              }
            }
          }
          
          // Fallback to Nijmegen city center if no GPS
          if (!latitude || !longitude) {
            const geoResult = await this.geocodeWithMunicipalityValidation(
              fullAddress || venueName || 'Nijmegen centrum',
              'Nijmegen'
            );
            if (geoResult) {
              latitude = geoResult.lat;
              longitude = geoResult.lon;
              if (!fullAddress) fullAddress = geoResult.displayName || 'Nijmegen';
            }
          }
          
          // Skip events without GPS
          if (!latitude || !longitude) {
            console.log(`[RSS] SKIPPED Nijmegen event (no GPS): ${title}`);
            skippedCount++;
            continue;
          }
          
          // Skip past events
          if (startTime && startTime < new Date()) {
            skippedCount++;
            continue;
          }
          
          const urlSlug = eventUrl.split('/').filter(Boolean).pop() || `${Date.now()}`;
          const externalId = `intonijmegen-${urlSlug}`;
          
          if (!imageUrl.startsWith('http') && imageUrl) {
            imageUrl = `${baseUrl}${imageUrl}`;
          }
          
          items.push({
            externalId,
            title: this.cleanText(title),
            description: this.cleanText(description || `${title} in Nijmegen. ${fullAddress ? `Locatie: ${fullAddress}.` : ''}`),
            link: eventUrl,
            imageUrl: imageUrl || undefined,
            publishedAt: startTime,
            startTime,
            endTime,
            address: fullAddress || venueName || 'Nijmegen',
            latitude,
            longitude,
            rawData: eventData || { url: eventUrl, venue: venueName }
          });
          
          successCount++;
        } catch (error: any) {
          console.log(`[RSS] Error fetching Nijmegen event ${eventUrl}: ${error.message}`);
          skippedCount++;
        }
      }
      
      console.log(`[RSS] Scraped ${items.length} events from IntoNijmegen (${successCount} success, ${skippedCount} skipped)`);
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping IntoNijmegen:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  // Grensland De Baronie scraper - WordPress site covering Gilze en Rijen, Alphen-Chaam, Baarle-Nassau
  static async scrapeGrensland(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      
      console.log(`[RSS] Scraping Grensland De Baronie (WordPress)...`);
      
      // Try WordPress REST API first
      const apiUrl = 'https://www.grenslanddebaronie.nl/wp-json/wp/v2/posts?per_page=50&categories=agenda';
      
      try {
        const response = await axios.get(apiUrl, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "letsgo-radar/1.0"
          },
          timeout: 30000
        });
        
        if (Array.isArray(response.data)) {
          for (const post of response.data) {
            // WordPress posts may have ACF fields with GPS
            const latitude = post.acf?.latitude || post.acf?.gps?.lat;
            const longitude = post.acf?.longitude || post.acf?.gps?.lng;
            
            if (!latitude || !longitude) continue;
            
            items.push({
              externalId: `grensland-${post.id}`,
              title: this.formatTitle(post.title?.rendered || ''),
              description: this.cleanText((post.excerpt?.rendered || '').replace(/<[^>]+>/g, '')),
              link: post.link,
              imageUrl: post._embedded?.['wp:featuredmedia']?.[0]?.source_url,
              publishedAt: new Date(post.date),
              startTime: post.acf?.event_date ? new Date(post.acf.event_date) : new Date(post.date),
              latitude,
              longitude,
              location: post.acf?.location || 'Gilze en Rijen',
              address: post.acf?.address || 'Gilze en Rijen, Nederland',
              rawData: post
            });
          }
        }
      } catch (apiError) {
        console.log(`[RSS] WordPress API not available for Grensland, trying HTML scrape...`);
      }
      
      // Fallback: HTML scraping
      if (items.length === 0) {
        const response = await axios.get('https://www.grenslanddebaronie.nl/agenda', {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml"
          },
          timeout: 30000
        });
        
        const $ = cheerio.load(response.data);
        
        $('a[href*="/agenda/"]').each((_, element) => {
          const href = $(element).attr("href");
          if (!href || href === "/agenda" || href.includes("?")) return;
          
          const link = href.startsWith("http") ? href : `https://www.grenslanddebaronie.nl${href}`;
          console.log(`[RSS] Found Grensland event link: ${link}`);
        });
      }

      console.log(`[RSS] Scraped ${items.length} events from Grensland De Baronie`);
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping Grensland:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  /**
   * Fetch Den Bosch events from zinindenbosch.nl Payload CMS API
   * Uses official REST API for reliable data extraction with exact GPS coordinates
   * Following Feed Import Principles: verified locations, date-bound events, source images
   */
  static async scrapeDenBosch(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      
      console.log(`[RSS] Starting Den Bosch fetcher (zinindenbosch.nl Payload CMS API)...`);
      
      // Payload CMS API endpoint - fetch all published events
      const apiUrl = 'https://www.zinindenbosch.nl/api/events';
      let page = 1;
      let hasMorePages = true;
      const limit = 50; // Fetch 50 events per page
      
      while (hasMorePages && page <= 20) { // Max 20 pages (1000 events)
        const pageUrl = `${apiUrl}?limit=${limit}&page=${page}&depth=2&sort=-createdAt`;
        console.log(`[RSS] Fetching Den Bosch API page ${page}...`);
        
        const response = await fetch(pageUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'letsgo-radar/1.0 (+https://letsgo-radar.nl)'
          }
        });
        
        if (!response.ok) {
          console.log(`[RSS] API page ${page} returned ${response.status}, stopping`);
          break;
        }
        
        const data = await response.json() as {
          docs: any[];
          totalDocs: number;
          totalPages: number;
          page: number;
          hasNextPage: boolean;
        };
        
        if (!data.docs || data.docs.length === 0) {
          console.log(`[RSS] No events on page ${page}, stopping`);
          break;
        }
        
        console.log(`[RSS] Processing ${data.docs.length} events from page ${page} (total: ${data.totalDocs})`);
        
        for (const event of data.docs) {
          try {
            // Skip if no title
            const title = event.title;
            if (!title || title.length < 3) continue;
            
            // FEED PRINCIPLE 1: Verified location with exact GPS coordinates
            const location = event.location;
            if (!location || !location.gps) {
              continue; // Skip events without GPS coordinates
            }
            
            const latitude = location.gps.lat;
            const longitude = location.gps.long || location.gps.lng;
            
            if (!latitude || !longitude || Math.abs(latitude) < 1 || Math.abs(longitude) < 1) {
              continue; // Skip invalid coordinates
            }
            
            // FEED PRINCIPLE 2: Only date-bound events
            const eventDates = event.eventDates || [];
            if (eventDates.length === 0) {
              continue; // Skip events without dates
            }
            
            // Get the earliest and latest dates for multi-day event consolidation
            const now = new Date();
            const futureDates = eventDates
              .filter((d: any) => d.startDate)
              .map((d: any) => ({
                start: new Date(d.startDate),
                end: d.endDate ? new Date(d.endDate) : new Date(d.startDate),
                startTime: d.startTime ? new Date(d.startTime) : null,
                endTime: d.endTime ? new Date(d.endTime) : null
              }))
              .filter((d: any) => d.end >= now)
              .sort((a: any, b: any) => a.start.getTime() - b.start.getTime());
            
            if (futureDates.length === 0) {
              continue; // Skip past events
            }
            
            // Combine first date with time info
            const firstDate = futureDates[0];
            const lastDate = futureDates[futureDates.length - 1];
            
            let startTime = firstDate.start;
            let endTime = lastDate.end;
            
            // Apply specific times if available
            if (firstDate.startTime) {
              const timeHours = firstDate.startTime.getUTCHours();
              const timeMinutes = firstDate.startTime.getUTCMinutes();
              startTime = new Date(firstDate.start);
              startTime.setUTCHours(timeHours, timeMinutes, 0, 0);
            }
            
            if (lastDate.endTime) {
              const timeHours = lastDate.endTime.getUTCHours();
              const timeMinutes = lastDate.endTime.getUTCMinutes();
              endTime = new Date(lastDate.end);
              endTime.setUTCHours(timeHours, timeMinutes, 0, 0);
            }
            
            // FEED PRINCIPLE 3: Use source images
            let imageUrl: string | undefined;
            if (event.teaserImage?.[0]?.image?.url) {
              imageUrl = event.teaserImage[0].image.url;
            } else if (event.images?.[0]?.image?.url) {
              imageUrl = event.images[0].image.url;
            }
            
            // Build address
            const address = location.address || `${location.title}, 's-Hertogenbosch`;
            
            // Build description from summary or intro
            let description = event.summary || '';
            if (!description && event.intro?.[0]?.children?.[0]?.text) {
              description = event.intro[0].children[0].text;
            }
            description = description.substring(0, 1000) || `${title} - Evenement in 's-Hertogenbosch`;
            
            // Generate external ID using slug
            const externalId = `denbosch-${event.slug || event.id}`;
            
            // Build event link
            const link = `https://www.zinindenbosch.nl/nl/event/${event.slug}`;
            
            // Collect all dates for multi-day consolidation
            const allDates = futureDates.map((d: any) => d.start);
            
            items.push({
              externalId,
              title: this.formatTitle(title),
              description,
              link,
              imageUrl,
              publishedAt: new Date(event.createdAt),
              startTime,
              endTime,
              location: location.title || '\'s-Hertogenbosch',
              address,
              latitude,
              longitude,
              allDates,
              rawData: {
                payloadId: event.id,
                slug: event.slug,
                categories: event.categories,
                sponsored: event.sponsored,
                topChoice: event.topChoice,
                locationSlug: location.slug,
                eventDatesCount: eventDates.length
              }
            });
          } catch (error) {
            // Skip this event silently
          }
        }
        
        // Check for next page
        hasMorePages = data.hasNextPage;
        page++;
        
        // Rate limiting between pages
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log(`[RSS] Den Bosch complete: ${items.length} events from Payload CMS API`);
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error fetching Den Bosch:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  static async scrapeDenBoschEventDetail(url: string, cheerio: any): Promise<ParsedFeedItem[]> {
    const items: ParsedFeedItem[] = [];
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      
      if (!response.ok) return items;
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract title
      const title = $('h1').first().text().trim();
      if (!title || title.length < 3) return items;
      
      // Extract description from paragraphs
      let description = '';
      $('p').each((_: number, el: any) => {
        const text = $(el).text().trim();
        if (text.length > 50 && text.length > description.length && !text.toLowerCase().includes('cookie')) {
          description = text;
        }
      });
      
      // Extract image URL
      let imageUrl = '';
      $('img').each((_: number, el: any) => {
        const src = $(el).attr('src') || '';
        if (src.includes('api/uploads') && !imageUrl) {
          imageUrl = src.startsWith('http') ? src : `https://www.zinindenbosch.nl${src}`;
        }
      });
      
      // Extract location from location link
      let location = '';
      const locationLink = $('a[href*="/nl/location/"]').first();
      if (locationLink.length) {
        location = locationLink.text().trim();
      }
      
      // Get full text for date parsing
      const fullText = $('body').text();
      
      // Parse dates
      const { startTime, endTime } = this.parseDenBoschDates(fullText);
      
      // FEED PRINCIPLE 2: Only date-bound events
      if (!startTime) return items;
      
      // Skip past events
      const now = new Date();
      if (startTime < now) return items;
      
      // FEED PRINCIPLE 1: Verified location - use known venues
      const DEN_BOSCH_VENUES: Record<string, { lat: number; lng: number; address: string }> = {
        'de markt': { lat: 51.6878, lng: 5.3066, address: 'Markt, 5211 JZ \'s-Hertogenbosch' },
        'markt': { lat: 51.6878, lng: 5.3066, address: 'Markt, 5211 JZ \'s-Hertogenbosch' },
        'theater aan de parade': { lat: 51.6871, lng: 5.3031, address: 'Parade 2, 5211 KL \'s-Hertogenbosch' },
        'sint-janskathedraal': { lat: 51.6890, lng: 5.3075, address: 'Torenstraat 16, 5211 KK \'s-Hertogenbosch' },
        'sint jan': { lat: 51.6890, lng: 5.3075, address: 'Torenstraat 16, 5211 KK \'s-Hertogenbosch' },
        'het noordbrabants museum': { lat: 51.6847, lng: 5.3048, address: 'Verwersstraat 41, 5211 HT \'s-Hertogenbosch' },
        'noordbrabants museum': { lat: 51.6847, lng: 5.3048, address: 'Verwersstraat 41, 5211 HT \'s-Hertogenbosch' },
        'willem twee': { lat: 51.6875, lng: 5.2967, address: 'Boschdijkstraat 100, 5211 VD \'s-Hertogenbosch' },
        'verkadefabriek': { lat: 51.6829, lng: 5.2827, address: 'Boschdijkstraat 45, 5211 VD \'s-Hertogenbosch' },
        'de verkadefabriek': { lat: 51.6829, lng: 5.2827, address: 'Boschdijkstraat 45, 5211 VD \'s-Hertogenbosch' },
        'jheronimus bosch art center': { lat: 51.6867, lng: 5.3017, address: 'Jeroen Boschplein 2, 5211 ML \'s-Hertogenbosch' },
        'efteling': { lat: 51.6499, lng: 5.0498, address: 'Europalaan 1, 5171 KW Kaatsheuvel' },
        'winter efteling': { lat: 51.6499, lng: 5.0498, address: 'Europalaan 1, 5171 KW Kaatsheuvel' },
        'mainstage': { lat: 51.6832, lng: 5.2981, address: 'Stationsplein, 5211 AP \'s-Hertogenbosch' },
        'tramkade': { lat: 51.6805, lng: 5.2855, address: 'Tramkade, 5211 VD \'s-Hertogenbosch' },
        'design museum': { lat: 51.6867, lng: 5.3017, address: 'Jeroen Boschplein 2, 5211 ML \'s-Hertogenbosch' },
        'muzerije': { lat: 51.6858, lng: 5.3052, address: 'Hinthamerstraat 74, 5211 MR \'s-Hertogenbosch' },
        'bolwerk': { lat: 51.6912, lng: 5.2982, address: 'Bolwerk-Noord 1, 5211 NJ \'s-Hertogenbosch' },
        'brabanthallen': { lat: 51.6845, lng: 5.2698, address: 'Diezekade 2, 5018 CG \'s-Hertogenbosch' },
        'de groene engel': { lat: 51.6881, lng: 5.3017, address: 'Hinthamerstraat 180, 5211 MV \'s-Hertogenbosch' },
        'poppodium w2': { lat: 51.6875, lng: 5.2967, address: 'Boschdijkstraat 100, 5211 VD \'s-Hertogenbosch' }
      };
      
      // Default to city center
      let latitude = 51.6881;
      let longitude = 5.3036;
      let address = '\'s-Hertogenbosch, Nederland';
      let venueFound = false;
      
      // Try to match venue
      const locationLower = location.toLowerCase();
      const titleLower = title.toLowerCase();
      
      for (const [venueName, venueData] of Object.entries(DEN_BOSCH_VENUES)) {
        if (locationLower.includes(venueName) || titleLower.includes(venueName)) {
          latitude = venueData.lat;
          longitude = venueData.lng;
          address = venueData.address;
          venueFound = true;
          break;
        }
      }
      
      // If no specific venue found but we have a location name, use city center (still valid)
      if (!venueFound && location) {
        address = `${location}, 's-Hertogenbosch`;
      }
      
      const slug = url.split('/').pop() || Date.now().toString();
      const externalId = `denbosch-${slug}`;
      
      items.push({
        externalId,
        title: this.formatTitle(title),
        description: description.substring(0, 1000) || `${title} - Evenement in 's-Hertogenbosch`,
        link: url,
        imageUrl: imageUrl || undefined,
        publishedAt: new Date(),
        startTime,
        endTime: endTime || new Date(startTime.getTime() + 4 * 60 * 60 * 1000),
        location: location || '\'s-Hertogenbosch',
        address,
        latitude,
        longitude,
        rawData: { url, location, venueFound }
      });
      
      return items;
    } catch (error: any) {
      return [];
    }
  }

  private static parseDenBoschDates(text: string): { startTime: Date | undefined; endTime: Date | undefined } {
    try {
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      
      // Pattern: "DD month YYYY" or "DD month"
      const datePattern = /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s*(\d{4})?/gi;
      const matches = Array.from(text.matchAll(datePattern));
      
      if (matches.length === 0) return { startTime: undefined, endTime: undefined };
      
      const parseDateMatch = (match: RegExpMatchArray): Date => {
        const day = parseInt(match[1]);
        const monthName = match[2].toLowerCase();
        const year = match[3] ? parseInt(match[3]) : (new Date().getMonth() < this.MONTHS[monthName] ? currentYear : nextYear);
        return new Date(year, this.MONTHS[monthName], day, 10, 0);
      };
      
      const startTime = parseDateMatch(matches[0]);
      const endTime = matches.length > 1 ? parseDateMatch(matches[matches.length - 1]) : undefined;
      
      return { startTime, endTime };
    } catch (e) {
      return { startTime: undefined, endTime: undefined };
    }
  }

  static readonly MONTHS: Record<string, number> = {
    jan: 0, january: 0, januari: 0,
    feb: 1, february: 1, februari: 1,
    mar: 2, march: 2, maart: 2,
    apr: 3, april: 3,
    may: 4, mei: 4,
    jun: 5, june: 5, juni: 5,
    jul: 6, july: 6, juli: 6,
    aug: 7, august: 7, augustus: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9, oktober: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
  };

  static parseEventDate(dateStr: string): { startTime: Date; endTime: Date } | null {
    try {
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      
      const match = dateStr.match(/(\w+)\s+(\d{1,2})\s+(\w+),?\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/i);
      if (!match) return null;
      
      const [, dayName, day, monthStr, startHour, startMin, endHour, endMin] = match;
      
      const monthNum = this.MONTHS[monthStr.toLowerCase()];
      if (monthNum === undefined) return null;
      
      let year = currentYear;
      const now = new Date();
      const testDate = new Date(year, monthNum, parseInt(day));
      if (testDate < now) {
        year = nextYear;
      }
      
      const startTime = new Date(year, monthNum, parseInt(day), parseInt(startHour), parseInt(startMin));
      const endTime = new Date(year, monthNum, parseInt(day), parseInt(endHour), parseInt(endMin));
      
      if (endTime < startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }
      
      return { startTime, endTime };
    } catch (e) {
      return null;
    }
  }

  static parseDateFromBody(dateStr: string): { startTime: Date; endTime: Date } | null {
    try {
      const normalizeMonth = (monthStr: string): number | undefined => {
        const normalized = monthStr.toLowerCase().substring(0, 3);
        if (normalized === "maa") return 2;
        if (normalized === "mei") return 4;
        if (normalized === "okt") return 9;
        return this.MONTHS[normalized];
      };
      
      const withTimeMatch = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4}),?\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/i);
      if (withTimeMatch) {
        const [, day, monthStr, year, startHour, startMin, endHour, endMin] = withTimeMatch;
        const monthNum = normalizeMonth(monthStr);
        if (monthNum === undefined) return null;
        
        const startTime = new Date(parseInt(year), monthNum, parseInt(day), parseInt(startHour), parseInt(startMin));
        const endTime = new Date(parseInt(year), monthNum, parseInt(day), parseInt(endHour), parseInt(endMin));
        
        if (endTime < startTime) {
          endTime.setDate(endTime.getDate() + 1);
        }
        
        return { startTime, endTime };
      }
      
      const dateOnlyMatch = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
      if (dateOnlyMatch) {
        const [, day, monthStr, year] = dateOnlyMatch;
        const monthNum = normalizeMonth(monthStr);
        if (monthNum === undefined) return null;
        
        const startTime = new Date(parseInt(year), monthNum, parseInt(day), 10, 0);
        const endTime = new Date(parseInt(year), monthNum, parseInt(day), 18, 0);
        
        return { startTime, endTime };
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }

  static async scrapeEventDetail(url: string): Promise<ParsedFeedItem | null> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": this.USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "nl-NL,nl;q=0.9"
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      
      let title = "";
      let description = "";
      let imageUrl = "";
      let venue = "";
      let streetAddress = "";
      let city = "";
      let startTime: Date | undefined;
      let endTime: Date | undefined;
      
      title = $("h1").first().text().trim();
      
      const streetEl = $('[itemprop="streetAddress"]');
      const cityEl = $('[itemprop="addressLocality"]');
      if (streetEl.length) streetAddress = streetEl.text().trim();
      if (cityEl.length) city = cityEl.text().trim() || "Eindhoven";
      
      const dateListItem = $(".list-dates li .date a, .list-dates li .date").first();
      if (dateListItem.length) {
        const dateText = dateListItem.text().trim();
        console.log(`[RSS] Found date text in list: "${dateText}"`);
        const parsed = this.parseEventDate(dateText);
        if (parsed) {
          startTime = parsed.startTime;
          endTime = parsed.endTime;
          console.log(`[RSS] Parsed date: ${startTime.toISOString()} - ${endTime.toISOString()}`);
        }
      }
      
      if (!startTime) {
        const bodyText = $("body").text();
        const monthPattern = "(?:jan(?:uary|uari)?|feb(?:ruary|ruari)?|ma(?:r(?:ch)?|a(?:rt)?)|apr(?:il)?|ma[yi]|jun[ei]?|jul[yi]?|aug(?:ustus)?|sep(?:t(?:ember)?)?|o[ck]t(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
        const datePatterns = [
          new RegExp(`(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4}),?\\s*(\\d{1,2}):(\\d{2})\\s*-\\s*(\\d{1,2}):(\\d{2})`, "gi"),
          new RegExp(`(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})`, "gi")
        ];
        
        for (const pattern of datePatterns) {
          const match = bodyText.match(pattern);
          if (match && match[0]) {
            console.log(`[RSS] Found date in body: "${match[0]}"`);
            const parsed = this.parseDateFromBody(match[0]);
            if (parsed) {
              startTime = parsed.startTime;
              endTime = parsed.endTime;
              console.log(`[RSS] Parsed body date: ${startTime.toISOString()} - ${endTime.toISOString()}`);
              break;
            }
          }
        }
      }
      
      const eventListItem = $(".list-dates li .event").first();
      if (eventListItem.length) {
        venue = eventListItem.text().trim();
      }
      
      if (!venue) {
        const venueEl = $('[itemprop="name"]').first();
        if (venueEl.length) {
          const venueText = venueEl.text().trim();
          if (venueText !== title && venueText.length > 2 && venueText.length < 50) {
            venue = venueText;
          }
        }
      }
      
      const ogImage = $('meta[property="og:image"]').attr("content");
      if (ogImage) {
        imageUrl = ogImage;
      }
      
      const introEl = $(".intro, .c-intro, [class*='intro']").first();
      if (introEl.length) {
        description = introEl.text().trim().replace(/\s+/g, " ");
      }
      
      if (!description || description.length < 30) {
        $("article p, main p, .content p").each((_, el) => {
          const text = $(el).text().trim().replace(/\s+/g, " ");
          if (text.length > 50 && !this.isCookieText(text)) {
            if (!description || text.length > description.length) {
              description = text;
            }
          }
        });
      }
      
      if (!description || description.length < 30) {
        description = `${title} in ${city || "Eindhoven"}. Ontdek dit evenement en geniet van een unieke ervaring.`;
      }
      
      description = description
        .replace(/\s+/g, " ")
        .replace(/Lees meer.*$/i, "")
        .replace(/Read more.*$/i, "")
        .trim();
      
      if (!title || title.length < 3) {
        console.log(`[RSS] Skipping event without title: ${url}`);
        return null;
      }
      
      let address = "";
      if (streetAddress && city) {
        address = `${streetAddress}, ${city}`;
      } else if (venue && city) {
        address = `${venue}, ${city}`;
      } else if (city) {
        address = city;
      } else {
        address = "Eindhoven";
      }
      
      if (AIHelper.isBadTitle(title)) {
        console.log(`[RSS] Bad title detected: "${title}", trying fallback...`);
        const titleFromUrl = url.split("/").pop()?.replace(/-/g, " ");
        if (titleFromUrl && titleFromUrl.length > 3) {
          title = titleFromUrl.charAt(0).toUpperCase() + titleFromUrl.slice(1);
        }
      }
      
      if (imageUrl && !imageUrl.startsWith("http")) {
        imageUrl = `https://www.thisiseindhoven.com${imageUrl}`;
      }
      
      console.log(`[RSS] Scraped: "${title}" at "${address}" on ${startTime?.toLocaleDateString() || "unknown date"}`);
      
      return {
        externalId: `thisiseindhoven-${url.replace(/[^a-z0-9]/gi, "-")}`,
        title: this.cleanText(title),
        description: this.cleanText(description),
        link: url,
        imageUrl: imageUrl || undefined,
        publishedAt: startTime || new Date(),
        startTime,
        endTime,
        location: venue || streetAddress || address,
        address,
        rawData: { url, venue, streetAddress, city }
      };
    } catch (error: any) {
      console.error(`[RSS] Error scraping detail ${url}:`, error.message);
      return null;
    }
  }
  
  static isCookieText(text: string): boolean {
    const cookiePatterns = [
      "cookie", "privacy", "functional cookies", "functionele cookies",
      "we only place", "we plaatsen alleen", "your data", "uw gegevens",
      "we can therefore", "we kunnen daarom", "improve our"
    ];
    const lowerText = text.toLowerCase();
    return cookiePatterns.filter(p => lowerText.includes(p)).length >= 2;
  }

  /**
   * INTELLIGENT UNIVERSAL SCRAPER
   * Automatically detects website type and applies appropriate extraction strategy.
   * Uses a cascade of detection methods:
   * 1. WordPress REST API (wp-json)
   * 2. Next.js __NEXT_DATA__ 
   * 3. JSON-LD structured data (schema.org/Event)
   * 4. Generic HTML parsing with multiple selectors
   */
  static async scrapeUniversal(feed: RssFeed): Promise<FeedParseResult> {
    const url = feed.url;
    const municipality = feed.municipality || 'Unknown';
    
    console.log(`[RSS] Universal scraper starting for ${municipality}: ${url}`);
    
    try {
      // First, fetch the page to analyze its structure
      const response = await axios.get(url, {
        headers: { 
          "User-Agent": this.USER_AGENT,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        timeout: 30000
      });
      
      const html = response.data;
      const $ = cheerio.load(html);
      
      // STRATEGY 1: Try WordPress REST API
      const wpApiResult = await this.tryWordPressApi(url, municipality, feed);
      if (wpApiResult.success && wpApiResult.items.length > 0) {
        console.log(`[RSS] WordPress API succeeded: ${wpApiResult.items.length} items`);
        return wpApiResult;
      }
      
      // STRATEGY 2: Try Next.js __NEXT_DATA__
      const nextDataResult = this.tryNextJsData($, url, municipality);
      if (nextDataResult.success && nextDataResult.items.length > 0) {
        console.log(`[RSS] Next.js __NEXT_DATA__ succeeded: ${nextDataResult.items.length} items`);
        return nextDataResult;
      }
      
      // STRATEGY 3: Try JSON-LD structured data
      const jsonLdResult = this.tryJsonLd($, url, municipality);
      if (jsonLdResult.success && jsonLdResult.items.length > 0) {
        console.log(`[RSS] JSON-LD succeeded: ${jsonLdResult.items.length} items`);
        return jsonLdResult;
      }
      
      // STRATEGY 4: Generic HTML parsing with multiple selectors
      const htmlResult = await this.tryGenericHtml($, url, municipality, feed);
      if (htmlResult.success && htmlResult.items.length > 0) {
        console.log(`[RSS] Generic HTML succeeded: ${htmlResult.items.length} items`);
        return htmlResult;
      }
      
      console.log(`[RSS] All strategies failed for ${municipality}`);
      return { success: false, items: [], error: "No events found with any extraction strategy" };
      
    } catch (error: any) {
      console.error(`[RSS] Universal scraper error for ${municipality}:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  /**
   * Try WordPress REST API extraction
   */
  private static async tryWordPressApi(baseUrl: string, municipality: string, feed: RssFeed): Promise<FeedParseResult> {
    try {
      const urlObj = new URL(baseUrl);
      const wpApiUrl = `${urlObj.origin}/wp-json/wp/v2`;
      
      // First check if wp-json is available
      const testResponse = await axios.get(`${wpApiUrl}/posts?per_page=1`, {
        headers: { "User-Agent": this.USER_AGENT },
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      
      if (testResponse.status !== 200) {
        return { success: false, items: [], error: "WordPress API not available" };
      }
      
      // Try to find event categories
      const categoriesResponse = await axios.get(`${wpApiUrl}/categories?per_page=100`, {
        headers: { "User-Agent": this.USER_AGENT },
        timeout: 10000
      });
      
      const categories = categoriesResponse.data;
      const eventCategory = categories.find((c: any) => 
        c.slug.includes('event') || 
        c.slug.includes('agenda') || 
        c.slug.includes('uitagenda') ||
        c.name.toLowerCase().includes('evenement')
      );
      
      let postsUrl = `${wpApiUrl}/posts?per_page=50&_embed`;
      if (eventCategory) {
        postsUrl += `&categories=${eventCategory.id}`;
        console.log(`[RSS] Found event category: ${eventCategory.name} (${eventCategory.id})`);
      }
      
      const postsResponse = await axios.get(postsUrl, {
        headers: { "User-Agent": this.USER_AGENT },
        timeout: 30000
      });
      
      const posts = postsResponse.data;
      if (!Array.isArray(posts) || posts.length === 0) {
        return { success: false, items: [], error: "No posts found" };
      }
      
      const items: ParsedFeedItem[] = [];
      
      for (const post of posts) {
        const title = this.cleanText(post.title?.rendered || '');
        const description = this.cleanText(post.excerpt?.rendered?.replace(/<[^>]*>/g, '') || '');
        const link = post.link;
        const publishedAt = post.date ? new Date(post.date) : new Date();
        
        // Get featured image
        let imageUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
        
        // Skip if title is empty or too short
        if (!title || title.length < 3) continue;
        
        items.push({
          externalId: `wp-${municipality.toLowerCase()}-${post.id}`,
          title,
          description,
          link,
          imageUrl,
          publishedAt,
          startTime: publishedAt,
          location: municipality,
          address: municipality,
          rawData: { source: 'wordpress-api', postId: post.id }
        });
      }
      
      console.log(`[RSS] WordPress API: found ${items.length} items for ${municipality}`);
      return { success: true, items };
      
    } catch (error: any) {
      return { success: false, items: [], error: `WordPress API failed: ${error.message}` };
    }
  }

  /**
   * Try Next.js __NEXT_DATA__ extraction
   */
  private static tryNextJsData($: cheerio.CheerioAPI, baseUrl: string, municipality: string): FeedParseResult {
    try {
      const nextDataScript = $('script#__NEXT_DATA__').html();
      if (!nextDataScript) {
        return { success: false, items: [], error: "No __NEXT_DATA__ found" };
      }
      
      const nextData = JSON.parse(nextDataScript);
      const pageProps = nextData?.props?.pageProps;
      
      if (!pageProps) {
        return { success: false, items: [], error: "No pageProps in __NEXT_DATA__" };
      }
      
      // Look for events in various common locations
      let events: any[] = [];
      
      // Common Next.js patterns
      if (pageProps.events) events = pageProps.events;
      else if (pageProps.items) events = pageProps.items;
      else if (pageProps.data?.events) events = pageProps.data.events;
      else if (pageProps.data?.items) events = pageProps.data.items;
      else if (pageProps.page?.items) events = pageProps.page.items;
      else if (pageProps.initialData?.items) events = pageProps.initialData.items;
      
      if (!Array.isArray(events) || events.length === 0) {
        return { success: false, items: [], error: "No events array found in __NEXT_DATA__" };
      }
      
      const items: ParsedFeedItem[] = [];
      
      for (const event of events) {
        const title = event.title || event.name || '';
        const description = event.description || event.intro || event.excerpt || '';
        const link = event.url || event.link || event.slug ? `${new URL(baseUrl).origin}/${event.slug}` : baseUrl;
        
        // Try to extract dates
        let startTime: Date | undefined;
        let endTime: Date | undefined;
        
        if (event.startDate || event.start_date || event.date || event.from) {
          startTime = new Date(event.startDate || event.start_date || event.date || event.from);
        }
        if (event.endDate || event.end_date || event.until || event.to) {
          endTime = new Date(event.endDate || event.end_date || event.until || event.to);
        }
        
        // Try to extract location
        let latitude: number | undefined;
        let longitude: number | undefined;
        let address: string | undefined;
        
        if (event.location) {
          if (event.location.coordinates) {
            latitude = event.location.coordinates.latitude;
            longitude = event.location.coordinates.longitude;
          }
          if (event.location.gps) {
            latitude = event.location.gps.lat || event.location.gps.latitude;
            longitude = event.location.gps.long || event.location.gps.lng || event.location.gps.longitude;
          }
          address = event.location.address || event.location.street;
        }
        
        // Get image
        let imageUrl = event.image?.url || event.teaserImage?.[0]?.url || event.thumbnail || event.image;
        
        if (typeof imageUrl !== 'string') imageUrl = undefined;
        
        items.push({
          externalId: `nextjs-${municipality.toLowerCase()}-${event.id || event._id || items.length}`,
          title: this.cleanText(title),
          description: this.cleanText(description),
          link,
          imageUrl,
          startTime,
          endTime,
          latitude,
          longitude,
          location: address || municipality,
          address: address || municipality,
          rawData: { source: 'nextjs-data', event }
        });
      }
      
      console.log(`[RSS] Next.js: found ${items.length} items for ${municipality}`);
      return { success: true, items };
      
    } catch (error: any) {
      return { success: false, items: [], error: `Next.js parsing failed: ${error.message}` };
    }
  }

  /**
   * Try JSON-LD structured data extraction
   */
  private static tryJsonLd($: cheerio.CheerioAPI, baseUrl: string, municipality: string): FeedParseResult {
    try {
      const items: ParsedFeedItem[] = [];
      
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const jsonText = $(el).html();
          if (!jsonText) return;
          
          const data = JSON.parse(jsonText);
          const events = Array.isArray(data) ? data : [data];
          
          for (const item of events) {
            // Check if it's an Event schema
            if (item['@type'] !== 'Event' && !item['@type']?.includes?.('Event')) continue;
            
            const title = item.name || '';
            const description = item.description || '';
            const link = item.url || baseUrl;
            
            let startTime: Date | undefined;
            let endTime: Date | undefined;
            
            if (item.startDate) startTime = new Date(item.startDate);
            if (item.endDate) endTime = new Date(item.endDate);
            
            let latitude: number | undefined;
            let longitude: number | undefined;
            let address: string | undefined;
            
            if (item.location) {
              if (item.location.geo) {
                latitude = parseFloat(item.location.geo.latitude);
                longitude = parseFloat(item.location.geo.longitude);
              }
              if (item.location.address) {
                address = typeof item.location.address === 'string' 
                  ? item.location.address 
                  : item.location.address.streetAddress || item.location.address.name;
              }
            }
            
            const imageUrl = Array.isArray(item.image) ? item.image[0] : item.image;
            
            items.push({
              externalId: `jsonld-${municipality.toLowerCase()}-${items.length}`,
              title: this.cleanText(title),
              description: this.cleanText(description),
              link,
              imageUrl,
              startTime,
              endTime,
              latitude,
              longitude,
              location: address || municipality,
              address: address || municipality,
              rawData: { source: 'json-ld', item }
            });
          }
        } catch (e) {
          // Skip invalid JSON-LD
        }
      });
      
      if (items.length === 0) {
        return { success: false, items: [], error: "No Event JSON-LD found" };
      }
      
      console.log(`[RSS] JSON-LD: found ${items.length} items for ${municipality}`);
      return { success: true, items };
      
    } catch (error: any) {
      return { success: false, items: [], error: `JSON-LD parsing failed: ${error.message}` };
    }
  }

  /**
   * Detect pagination patterns in the page
   * Returns pagination info: type, next URL patterns, or null if no pagination
   */
  private static detectPagination($: cheerio.CheerioAPI, baseUrl: string): { type: string; nextUrls: string[] } | null {
    const baseUrlObj = new URL(baseUrl);
    const nextUrls: string[] = [];
    
    // Pattern 1: WordPress-style /page/N/ pagination
    const wpPageLinks = $('a[href*="/page/"]').map((_, el) => $(el).attr('href')).get();
    if (wpPageLinks.length > 0) {
      const pageNumbers = new Set<number>();
      wpPageLinks.forEach(href => {
        const match = href?.match(/\/page\/(\d+)/);
        if (match) pageNumbers.add(parseInt(match[1]));
      });
      if (pageNumbers.size > 0) {
        const maxPage = Math.max(...Array.from(pageNumbers));
        for (let i = 2; i <= Math.min(maxPage + 5, 50); i++) {
          const pageUrl = baseUrl.replace(/\/$/, '') + `/page/${i}/`;
          if (!nextUrls.includes(pageUrl)) nextUrls.push(pageUrl);
        }
        return { type: 'wordpress', nextUrls };
      }
    }
    
    // Pattern 2: Query string ?page=N or ?p=N pagination
    const queryPageLinks = $('a[href*="page="], a[href*="p="]').map((_, el) => $(el).attr('href')).get();
    if (queryPageLinks.length > 0) {
      const pageNumbers = new Set<number>();
      queryPageLinks.forEach(href => {
        const match = href?.match(/[?&](?:page|p)=(\d+)/);
        if (match) pageNumbers.add(parseInt(match[1]));
      });
      if (pageNumbers.size > 0) {
        const maxPage = Math.max(...Array.from(pageNumbers));
        for (let i = 2; i <= Math.min(maxPage + 5, 50); i++) {
          const pageUrl = baseUrl.includes('?') 
            ? baseUrl.replace(/([?&])(?:page|p)=\d+/, `$1page=${i}`)
            : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${i}`;
          if (!nextUrls.includes(pageUrl)) nextUrls.push(pageUrl);
        }
        return { type: 'query', nextUrls };
      }
    }
    
    // Pattern 3: Dutch pagination /pagina/N/
    const dutchPageLinks = $('a[href*="/pagina/"]').map((_, el) => $(el).attr('href')).get();
    if (dutchPageLinks.length > 0) {
      const pageNumbers = new Set<number>();
      dutchPageLinks.forEach(href => {
        const match = href?.match(/\/pagina\/(\d+)/);
        if (match) pageNumbers.add(parseInt(match[1]));
      });
      if (pageNumbers.size > 0) {
        const maxPage = Math.max(...Array.from(pageNumbers));
        for (let i = 2; i <= Math.min(maxPage + 5, 50); i++) {
          const pageUrl = baseUrl.replace(/\/$/, '') + `/pagina/${i}/`;
          if (!nextUrls.includes(pageUrl)) nextUrls.push(pageUrl);
        }
        return { type: 'dutch', nextUrls };
      }
    }
    
    // Pattern 4: Next/Previous buttons with rel="next"
    const nextLink = $('a[rel="next"], .next a, .pagination-next a, [class*="next"] a').first().attr('href');
    if (nextLink) {
      const fullUrl = nextLink.startsWith('http') ? nextLink : `${baseUrlObj.origin}${nextLink.startsWith('/') ? '' : '/'}${nextLink}`;
      nextUrls.push(fullUrl);
      return { type: 'next-link', nextUrls };
    }
    
    // Pattern 5: Numeric pagination links
    const numericLinks = $('a.page-numbers, .pagination a, nav.pagination a').map((_, el) => $(el).attr('href')).get();
    if (numericLinks.length > 0) {
      numericLinks.forEach(href => {
        if (href && !href.includes('#') && !nextUrls.includes(href)) {
          const fullUrl = href.startsWith('http') ? href : `${baseUrlObj.origin}${href.startsWith('/') ? '' : '/'}${href}`;
          nextUrls.push(fullUrl);
        }
      });
      if (nextUrls.length > 0) {
        return { type: 'numeric', nextUrls };
      }
    }
    
    return null;
  }

  /**
   * Try generic HTML parsing with multiple selectors and intelligent pagination detection
   */
  private static async tryGenericHtml($: cheerio.CheerioAPI, baseUrl: string, municipality: string, feed: RssFeed): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      
      // Common event selectors used across different CMSs
      const eventSelectors = [
        // Grid item patterns (like Tilburg)
        'a.tb-grid-item',
        '.grid-item a[href*="/agenda/"]',
        '.grid-item a[href*="/event"]',
        // Elementor
        'article.elementor-post',
        '.elementor-post',
        // Generic article patterns
        'article[class*="event"]',
        '.event-item',
        '.event-card',
        '.agenda-item',
        '.uitagenda-item',
        // List patterns
        '.events-list article',
        '.event-list-item',
        '.agenda-list-item',
        // Card patterns
        '[class*="event-card"]',
        '[class*="agenda-card"]',
        // WordPress patterns
        '.type-tribe_events',
        '.tribe-events-calendar-list__event',
        // Generic patterns
        '[data-event]',
        '[data-event-id]'
      ];
      
      // Helper function to extract event links from a page
      const extractEventLinks = ($page: cheerio.CheerioAPI, baseUrlObj: URL, collectedLinks: string[]): string[] => {
        const newLinks: string[] = [];
        
        // First try specific selectors
        for (const selector of eventSelectors) {
          const elements = $page(selector);
          if (elements.length > 0) {
            elements.each((_, el) => {
              const $el = $page(el);
              let link = $el.is('a') ? $el.attr('href') : ($el.find('a').first().attr('href') || $el.find('h2 a, h3 a').attr('href'));
              if (!link) return;
              
              if (!link.startsWith('http')) {
                link = `${baseUrlObj.origin}${link.startsWith('/') ? '' : '/'}${link}`;
              }
              
              if (link.includes('/category/') || link.includes('/tag/') || link.includes('#') || link.includes('/page/')) return;
              if (!collectedLinks.includes(link) && !newLinks.includes(link)) {
                newLinks.push(link);
              }
            });
            if (newLinks.length > 0) break;
          }
        }
        
        // Fallback: find any article elements
        if (newLinks.length === 0) {
          const articles = $page('article').filter((_, el) => {
            const classes = $page(el).attr('class') || '';
            return classes.includes('post') || classes.includes('event') || classes.includes('agenda');
          });
          
          articles.each((_, el) => {
            const $el = $page(el);
            let link = $el.find('a').first().attr('href') || $el.find('h2 a, h3 a').attr('href');
            if (!link) return;
            
            if (!link.startsWith('http')) {
              link = `${baseUrlObj.origin}${link.startsWith('/') ? '' : '/'}${link}`;
            }
            
            if (link.includes('/category/') || link.includes('/tag/') || link.includes('#')) return;
            if (!collectedLinks.includes(link) && !newLinks.includes(link)) {
              newLinks.push(link);
            }
          });
        }
        
        return newLinks;
      };
      
      const baseUrlObj = new URL(baseUrl);
      const allEventLinks: string[] = [];
      
      // Extract from first page
      const page1Links = extractEventLinks($, baseUrlObj, allEventLinks);
      allEventLinks.push(...page1Links);
      console.log(`[RSS] Page 1: found ${page1Links.length} event links`);
      
      // Detect and handle pagination
      const pagination = this.detectPagination($, baseUrl);
      if (pagination && pagination.nextUrls.length > 0) {
        console.log(`[RSS] Detected ${pagination.type} pagination with ${pagination.nextUrls.length} potential pages`);
        
        for (const pageUrl of pagination.nextUrls.slice(0, 30)) {
          try {
            await new Promise(resolve => setTimeout(resolve, 300)); // Rate limiting
            
            const pageResponse = await axios.get(pageUrl, {
              headers: { "User-Agent": this.USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
              timeout: 30000
            });
            
            const $page = cheerio.load(pageResponse.data);
            const pageLinks = extractEventLinks($page, baseUrlObj, allEventLinks);
            
            if (pageLinks.length === 0) {
              console.log(`[RSS] ${pageUrl}: no new events, stopping pagination`);
              break;
            }
            
            allEventLinks.push(...pageLinks);
            console.log(`[RSS] ${pageUrl}: found ${pageLinks.length} new links (total: ${allEventLinks.length})`);
            
          } catch (error: any) {
            if (error.response?.status === 404) {
              console.log(`[RSS] ${pageUrl}: 404, end of pagination`);
              break;
            }
            console.log(`[RSS] ${pageUrl}: error ${error.message}`);
            break;
          }
        }
      }
      
      if (allEventLinks.length === 0) {
        return { success: false, items: [], error: "No event elements found with any selector" };
      }
      
      console.log(`[RSS] Total: found ${allEventLinks.length} event links across all pages`);
      
      // Limit to first 100 to avoid overwhelming (increased from 30 due to pagination)
      const linksToProcess = Array.from(new Set(allEventLinks)).slice(0, 100);
      
      for (const link of linksToProcess) {
        try {
          const detail = await this.scrapeGenericEventPage(link, municipality);
          if (detail) {
            items.push(detail);
          }
        } catch (e: any) {
          console.log(`[RSS] Failed to scrape ${link}: ${e.message}`);
        }
        
        // Small delay to be polite
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (items.length === 0) {
        return { success: false, items: [], error: "No events could be extracted from detail pages" };
      }
      
      console.log(`[RSS] Generic HTML: found ${items.length} items for ${municipality}`);
      return { success: true, items };
      
    } catch (error: any) {
      return { success: false, items: [], error: `Generic HTML parsing failed: ${error.message}` };
    }
  }

  /**
   * Scrape a single event detail page with intelligent extraction
   */
  private static async scrapeGenericEventPage(url: string, municipality: string): Promise<ParsedFeedItem | null> {
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": this.USER_AGENT },
        timeout: 15000
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract title
      let title = $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') ||
                  $('title').text().split('|')[0].trim();
      
      // Extract description
      let description = $('meta[name="description"]').attr('content') ||
                        $('meta[property="og:description"]').attr('content') ||
                        $('.entry-content p, .content p, article p').first().text().trim();
      
      // Extract image
      let imageUrl = $('meta[property="og:image"]').attr('content') ||
                     $('article img, .entry-content img, .featured-image img').first().attr('src');
      
      // Try to extract date from various places
      let startTime: Date | undefined;
      let endTime: Date | undefined;
      
      // Look for JSON-LD first
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const data = JSON.parse($(el).html() || '');
          if (data['@type'] === 'Event' || data['@type']?.includes?.('Event')) {
            if (data.startDate) startTime = new Date(data.startDate);
            if (data.endDate) endTime = new Date(data.endDate);
          }
        } catch (e) {}
      });
      
      // Look for common date patterns in text if not found
      if (!startTime) {
        const datePatterns = [
          /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/gi,
          /(\d{1,2})-(\d{1,2})-(\d{4})/g,
          /(\d{4})-(\d{1,2})-(\d{1,2})/g
        ];
        
        const pageText = $('body').text();
        for (const pattern of datePatterns) {
          const match = pattern.exec(pageText);
          if (match) {
            try {
              startTime = new Date(match[0]);
              if (isNaN(startTime.getTime())) startTime = undefined;
            } catch (e) {}
            break;
          }
        }
      }
      
      // Skip if no title
      if (!title || title.length < 3 || this.isCookieText(title)) {
        return null;
      }
      
      return {
        externalId: `generic-${municipality.toLowerCase()}-${url.replace(/[^a-z0-9]/gi, '-').slice(-50)}`,
        title: this.cleanText(title),
        description: this.cleanText(description || ''),
        link: url,
        imageUrl,
        startTime,
        endTime,
        location: municipality,
        address: municipality,
        rawData: { source: 'generic-html', url }
      };
      
    } catch (error: any) {
      console.log(`[RSS] Failed to scrape generic page ${url}: ${error.message}`);
      return null;
    }
  }

  static async processFeed(feed: RssFeed, storage?: any): Promise<{ success: boolean; itemsProcessed: number; eventsCreated: number; error?: string }> {
    const feedStartTime = Date.now();
    
    try {
      console.log(`[RSS] Single feed sync: ${feed.name}...`);

      let result: FeedParseResult;

      if (feed.feedType === "scraper" && feed.url.includes("thisiseindhoven")) {
        result = await this.scrapeThisIsEindhoven();
      } else if (feed.feedType === "scraper" && feed.url.includes("trefhetinoss")) {
        result = await this.scrapeTrefhetInOss();
      } else if (feed.feedType === "scraper" && feed.url.includes("visithelmond")) {
        result = await this.scrapeVisitHelmond();
      } else if (feed.feedType === "scraper" && feed.url.includes("bezoekmeierijstad")) {
        result = await this.scrapeMeierijstad();
      } else if (feed.feedType === "scraper" && feed.url.includes("exploremaashorst")) {
        result = await this.scrapeMaashorst();
      } else if (feed.feedType === "scraper" && feed.url.includes("sonenbreugel")) {
        result = await this.scrapeSonEnBreugel();
      } else if (feed.feedType === "scraper" && feed.url.includes("mooibernheze")) {
        result = await this.scrapeBernheze();
      } else if (feed.feedType === "scraper" && feed.url.includes("zinindenbosch")) {
        result = await this.scrapeDenBosch();
      } else if (feed.feedType === "scraper" && feed.url.includes("beleefboxtel")) {
        result = await this.scrapeBoxtel();
      } else if (feed.feedType === "scraper" && feed.url.includes("goedgestel")) {
        result = await this.scrapeSintMichielsgestel();
      } else if (feed.feedType === "scraper" && feed.url.includes("visitvught")) {
        result = await this.scrapeVught();
      } else if (feed.feedType === "scraper" && feed.url.includes("beleveninoosterhout")) {
        result = await this.scrapeOosterhout();
      } else if (feed.feedType === "scraper" && feed.url.includes("bezoekoisterwijk")) {
        result = await this.scrapeOisterwijk();
      } else if (feed.feedType === "scraper" && feed.url.includes("explorebreda")) {
        result = await this.scrapeBreda();
      } else if (feed.feedType === "scraper" && feed.url.includes("grenslanddebaronie")) {
        result = await this.scrapeGrensland();
      } else if (feed.feedType === "scraper" && feed.url.includes("tilburg.com")) {
        result = await this.scrapeTilburg();
      } else if (feed.feedType === "scraper") {
        // Use intelligent universal scraper for unknown scraper feeds
        result = await this.scrapeUniversal(feed);
      } else {
        result = await this.fetchAndParseRssFeed(feed.url);
      }

      const feedDuration = ((Date.now() - feedStartTime) / 1000 / 60).toFixed(1);

      if (!result.success) {
        console.log(`[RSS] ${feed.name}: FAILED after ${feedDuration} min - ${result.error}`);
        await db.update(rssFeeds)
          .set({ 
            status: "error", 
            lastErrorMessage: result.error,
            lastFetchedAt: new Date()
          })
          .where(eq(rssFeeds.id, feed.id));
        return { success: false, itemsProcessed: 0, eventsCreated: 0, error: result.error };
      }

      // UNIVERSAL MULTI-DAY CONSOLIDATION - apply to ALL feeds
      const consolidatedItems = this.consolidateMultiDayEvents(result.items);
      console.log(`[RSS] ${feed.name}: Consolidated ${result.items.length} items into ${consolidatedItems.length} events`);

      let newItemsCount = 0;
      for (const item of consolidatedItems) {
        const created = await this.createOrUpdateFeedItem(feed, item);
        if (created) newItemsCount++;
      }

      await db.update(rssFeeds)
        .set({
          status: "active",
          lastFetchedAt: new Date(),
          lastErrorMessage: null,
          itemsImported: (feed.itemsImported || 0) + newItemsCount
        })
        .where(eq(rssFeeds.id, feed.id));

      console.log(`[RSS] ${feed.name}: SUCCESS - ${newItemsCount} new items in ${feedDuration} min (total: ${consolidatedItems.length} consolidated from ${result.items.length})`);
      return { success: true, itemsProcessed: result.items.length, eventsCreated: newItemsCount };
    } catch (error: any) {
      const feedDuration = ((Date.now() - feedStartTime) / 1000 / 60).toFixed(1);
      console.error(`[RSS] ${feed.name}: ERROR after ${feedDuration} min - ${error.message}`);
      await db.update(rssFeeds)
        .set({ 
          status: "error", 
          lastErrorMessage: error.message,
          lastFetchedAt: new Date()
        })
        .where(eq(rssFeeds.id, feed.id));
      return { success: false, itemsProcessed: 0, eventsCreated: 0, error: error.message };
    }
  }

  static async processFeeds(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;
    const totalStartTime = Date.now();

    const activeFeeds = await db.select().from(rssFeeds).where(eq(rssFeeds.status, "active"));
    
    console.log(`[RSS] ========================================`);
    console.log(`[RSS] Starting feed processing: ${activeFeeds.length} active feeds`);
    console.log(`[RSS] ========================================`);

    for (let i = 0; i < activeFeeds.length; i++) {
      const feed = activeFeeds[i];
      const feedStartTime = Date.now();
      
      try {
        const shouldFetch = this.shouldFetchFeed(feed);
        if (!shouldFetch) {
          console.log(`[RSS] [${i + 1}/${activeFeeds.length}] ${feed.name}: SKIPPED (recently updated)`);
          continue;
        }

        console.log(`[RSS] [${i + 1}/${activeFeeds.length}] ${feed.name}: Starting...`);

        let result: FeedParseResult;

        if (feed.feedType === "scraper" && feed.url.includes("thisiseindhoven")) {
          result = await this.scrapeThisIsEindhoven();
        } else if (feed.feedType === "scraper" && feed.url.includes("trefhetinoss")) {
          result = await this.scrapeTrefhetInOss();
        } else if (feed.feedType === "scraper" && feed.url.includes("visithelmond")) {
          result = await this.scrapeVisitHelmond();
        } else if (feed.feedType === "scraper" && feed.url.includes("bezoekmeierijstad")) {
          result = await this.scrapeMeierijstad();
        } else if (feed.feedType === "scraper" && feed.url.includes("exploremaashorst")) {
          result = await this.scrapeMaashorst();
        } else if (feed.feedType === "scraper" && feed.url.includes("sonenbreugel")) {
          result = await this.scrapeSonEnBreugel();
        } else if (feed.feedType === "scraper" && feed.url.includes("mooibernheze")) {
          result = await this.scrapeBernheze();
        } else if (feed.feedType === "scraper" && feed.url.includes("zinindenbosch")) {
          result = await this.scrapeDenBosch();
        } else if (feed.feedType === "scraper" && feed.url.includes("beleefboxtel")) {
          result = await this.scrapeBoxtel();
        } else if (feed.feedType === "scraper" && feed.url.includes("goedgestel")) {
          result = await this.scrapeSintMichielsgestel();
        } else if (feed.feedType === "scraper" && feed.url.includes("visitvught")) {
          result = await this.scrapeVught();
        } else if (feed.feedType === "scraper" && feed.url.includes("beleveninoosterhout")) {
          result = await this.scrapeOosterhout();
        } else if (feed.feedType === "scraper" && feed.url.includes("bezoekoisterwijk")) {
          result = await this.scrapeOisterwijk();
        } else if (feed.feedType === "scraper" && feed.url.includes("explorebreda")) {
          result = await this.scrapeBreda();
        } else if (feed.feedType === "scraper" && feed.url.includes("grenslanddebaronie")) {
          result = await this.scrapeGrensland();
        } else if (feed.feedType === "scraper" && feed.url.includes("tilburg.com")) {
          result = await this.scrapeTilburg();
        } else if (feed.feedType === "scraper" && feed.url.includes("intonijmegen")) {
          result = await this.scrapeIntoNijmegen();
        } else if (feed.feedType === "scraper") {
          // Use intelligent universal scraper for unknown scraper feeds
          result = await this.scrapeUniversal(feed);
        } else {
          result = await this.fetchAndParseRssFeed(feed.url);
        }

        const feedDuration = ((Date.now() - feedStartTime) / 1000 / 60).toFixed(1);

        if (!result.success) {
          console.log(`[RSS] [${i + 1}/${activeFeeds.length}] ${feed.name}: FAILED after ${feedDuration} min - ${result.error}`);
          await db.update(rssFeeds)
            .set({ 
              status: "error", 
              lastErrorMessage: result.error,
              lastFetchedAt: new Date()
            })
            .where(eq(rssFeeds.id, feed.id));
          errors++;
          continue;
        }

        // UNIVERSAL MULTI-DAY CONSOLIDATION - apply to ALL feeds
        const consolidatedItems = this.consolidateMultiDayEvents(result.items);
        
        let newItemsCount = 0;
        for (const item of consolidatedItems) {
          const created = await this.createOrUpdateFeedItem(feed, item);
          if (created) newItemsCount++;
        }

        await db.update(rssFeeds)
          .set({
            status: "active",
            lastFetchedAt: new Date(),
            lastErrorMessage: null,
            itemsImported: (feed.itemsImported || 0) + newItemsCount
          })
          .where(eq(rssFeeds.id, feed.id));

        console.log(`[RSS] [${i + 1}/${activeFeeds.length}] ${feed.name}: SUCCESS - ${newItemsCount} new items in ${feedDuration} min (consolidated: ${consolidatedItems.length} from ${result.items.length})`);
        processed++;
      } catch (error: any) {
        const feedDuration = ((Date.now() - feedStartTime) / 1000 / 60).toFixed(1);
        console.error(`[RSS] [${i + 1}/${activeFeeds.length}] ${feed.name}: ERROR after ${feedDuration} min - ${error.message}`);
        await db.update(rssFeeds)
          .set({ 
            status: "error", 
            lastErrorMessage: error.message,
            lastFetchedAt: new Date()
          })
          .where(eq(rssFeeds.id, feed.id));
        errors++;
      }
    }

    const totalDuration = ((Date.now() - totalStartTime) / 1000 / 60).toFixed(1);
    console.log(`[RSS] ========================================`);
    console.log(`[RSS] Feed processing complete`);
    console.log(`[RSS] Total duration: ${totalDuration} minutes`);
    console.log(`[RSS] Processed: ${processed}, Errors: ${errors}, Skipped: ${activeFeeds.length - processed - errors}`);
    console.log(`[RSS] ========================================`);

    return { processed, errors };
  }

  private static async createOrUpdateFeedItem(
    feed: RssFeed, 
    parsedItem: ParsedFeedItem
  ): Promise<boolean> {
    const existingItems = await db.select()
      .from(rssFeedItems)
      .where(and(
        eq(rssFeedItems.feedId, feed.id),
        eq(rssFeedItems.externalId, parsedItem.externalId)
      ));

    if (existingItems.length > 0) {
      return false;
    }

    const [feedItem] = await db.insert(rssFeedItems)
      .values({
        feedId: feed.id,
        externalId: parsedItem.externalId,
        title: parsedItem.title,
        description: parsedItem.description,
        link: parsedItem.link,
        imageUrl: parsedItem.imageUrl,
        publishedAt: parsedItem.publishedAt,
        rawData: parsedItem.rawData,
        isProcessed: false
      })
      .returning();

    if (feed.autoCreateEvents && feedItem) {
      await this.createEventFromFeedItem(feed, feedItem, parsedItem);
    }

    return true;
  }

  private static async createEventFromFeedItem(
    feed: RssFeed, 
    feedItem: RssFeedItem,
    parsedItem: ParsedFeedItem
  ): Promise<void> {
    try {
      const startTime = parsedItem.startTime || parsedItem.publishedAt || new Date();
      const endTime = parsedItem.endTime || new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

      const formattedTitle = this.formatTitle(parsedItem.title);
      
      // DUPLICATE DETECTION: Check if this event already exists in the database
      const isDuplicate = await this.checkForDuplicateEvent(
        formattedTitle,
        parsedItem.latitude,
        parsedItem.longitude,
        startTime,
        parsedItem.link
      );
      
      if (isDuplicate) {
        console.log(`[RSS] DUPLICATE SKIPPED: "${formattedTitle}" already exists in database`);
        await db.update(rssFeedItems)
          .set({ isProcessed: true })
          .where(eq(rssFeedItems.id, feedItem.id));
        return;
      }
      
      const validCategories = CATEGORIES as readonly string[];
      const detectedCategory = this.detectCategory(parsedItem.title, parsedItem.description);
      const category = validCategories.includes(detectedCategory) 
        ? detectedCategory 
        : (validCategories.includes(feed.defaultCategory) ? feed.defaultCategory : "Gezellig en Sociaal");

      let latitude = parsedItem.latitude?.toString() || "";
      let longitude = parsedItem.longitude?.toString() || "";
      let address = parsedItem.address || parsedItem.location || "";
      let geocodeSuccess = false;
      const expectedMunicipality = feed.municipality || "";

      // STEP 1: If we have GPS coordinates from the source, validate them first
      if (parsedItem.latitude && parsedItem.longitude) {
        const isValid = this.validateExistingCoordinates(
          parsedItem.latitude, 
          parsedItem.longitude, 
          expectedMunicipality
        );
        
        if (isValid) {
          latitude = parsedItem.latitude.toString();
          longitude = parsedItem.longitude.toString();
          address = parsedItem.address || parsedItem.location || expectedMunicipality;
          geocodeSuccess = true;
          console.log(`[RSS] Source GPS validated for "${formattedTitle}" in ${expectedMunicipality}`);
        } else {
          console.log(`[RSS] Source GPS REJECTED for "${formattedTitle}" - outside ${expectedMunicipality}`);
          // Don't use invalid source coordinates, try geocoding instead
        }
      }

      // STEP 2: Try geocoding with municipality validation if no valid GPS
      if (!geocodeSuccess && (parsedItem.address || parsedItem.location)) {
        const locationQuery = parsedItem.address || parsedItem.location || "";
        const geoResult = await this.geocodeWithMunicipalityValidation(locationQuery, expectedMunicipality);
        if (geoResult) {
          latitude = geoResult.lat.toString();
          longitude = geoResult.lon.toString();
          address = geoResult.displayName.split(",").slice(0, 3).join(",").trim();
          geocodeSuccess = true;
        }
      }
      
      // STEP 3: Try venue-only geocoding with municipality
      if (!geocodeSuccess && parsedItem.location) {
        const venueResult = await this.geocodeWithMunicipalityValidation(parsedItem.location, expectedMunicipality);
        if (venueResult) {
          latitude = venueResult.lat.toString();
          longitude = venueResult.lon.toString();
          address = parsedItem.address || `${parsedItem.location}, ${expectedMunicipality}`;
          geocodeSuccess = true;
        }
      }
      
      // QUALITY FILTER: Only create events with verified AND validated locations
      if (!geocodeSuccess) {
        console.log(`[RSS] SKIPPED event (no valid location in ${expectedMunicipality}): ${parsedItem.title}`);
        return;
      }

      let imageUrl = parsedItem.imageUrl;
      
      if (imageUrl) {
        try {
          const imgResponse = await axios.head(imageUrl, { timeout: 5000 });
          if (imgResponse.status !== 200) {
            imageUrl = undefined;
          }
        } catch {
          console.log(`[RSS] Image URL not accessible: ${imageUrl}`);
          imageUrl = undefined;
        }
      }

      if (!imageUrl) {
        const titleKeywords = formattedTitle.toLowerCase().split(" ").slice(0, 2).join(" ");
        imageUrl = await this.getUnsplashImage(category, titleKeywords) || undefined;
      }

      const fullDescription = parsedItem.description 
        ? `${parsedItem.description}${parsedItem.link ? `\n\nMeer info: ${parsedItem.link}` : ""}`
        : (parsedItem.link ? `Meer informatie: ${parsedItem.link}` : "Geen beschrijving beschikbaar.");

      const recurrence = this.detectRecurrence(formattedTitle, fullDescription);

      const [event] = await db.insert(events)
        .values({
          title: formattedTitle,
          description: fullDescription,
          latitude: latitude,
          longitude: longitude,
          address: address,
          notificationReach: "2.5",
          startTime: startTime,
          endTime: endTime,
          category: category,
          isPaid: false,
          hostId: 1,
          recurrence: recurrence,
          tags: ["rss-import", feed.name.toLowerCase().replace(/\s+/g, "-")],
          imageUrl: imageUrl || null
        })
        .returning();

      if (event) {
        await db.update(rssFeedItems)
          .set({ eventId: event.id, isProcessed: true, processingStatus: 'imported' })
          .where(eq(rssFeedItems.id, feedItem.id));
        
        console.log(`[RSS] Created event "${event.title}" at ${address} (ID: ${event.id})`);
      }

      await new Promise(resolve => setTimeout(resolve, 1100));
    } catch (error: any) {
      console.error(`[RSS] Error creating event from feed item:`, error.message);
    }
  }

  private static detectRecurrence(title: string, description: string): "once" | "daily" | "weekly" | "monthly" {
    const text = `${title} ${description}`.toLowerCase();
    
    const weeklyPatterns = [
      /\bmarkt\b/,
      /\bmarket\b/,
      /\bwekelijks\b/,
      /\bweekly\b/,
      /\bevery\s+week\b/,
      /\belke\s+week\b/,
      /\biedere\s+week\b/,
      /\balle\s+(zondagen|zaterdagen|vrijdagen|donderdagen|woensdagen|dinsdagen|maandagen)\b/,
      /\bevery\s+(sunday|saturday|friday|thursday|wednesday|tuesday|monday)\b/,
      /\biedere\s+(zondag|zaterdag|vrijdag|donderdag|woensdag|dinsdag|maandag)\b/,
      /\bop\s+(zondagen|zaterdagen|vrijdagen)\b/,
      /\bfood\s*truck\b/,
      /\bvlooienmarkt\b/,
      /\bflea\s*market\b/,
      /\bboerenmarkt\b/,
      /\bfarmers?\s*market\b/,
      /\bweekmarkt\b/,
      /\bstofmarkt\b/,
      /\blapjesmarkt\b/,
      /\bbloemmarkt\b/,
      /\bantiekmarkt\b/,
      /\bbroodmarkt\b/,
      /\bfeelgood\s*market\b/,
      /\bfeelgood\s*markt\b/,
    ];
    
    const monthlyPatterns = [
      /\bmaandelijks\b/,
      /\bmonthly\b/,
      /\bevery\s+month\b/,
      /\belke\s+maand\b/,
      /\biedere\s+maand\b/,
      /\b(eerste|tweede|derde|vierde|laatste)\s+(zondag|zaterdag|vrijdag)\s+van\s+de\s+maand\b/,
      /\b(first|second|third|fourth|last)\s+(sunday|saturday|friday)\s+of\s+(the\s+)?month\b/,
    ];
    
    const dailyPatterns = [
      /\bdagelijks\b/,
      /\bdaily\b/,
      /\bevery\s+day\b/,
      /\belke\s+dag\b/,
      /\biedere\s+dag\b/,
    ];
    
    for (const pattern of dailyPatterns) {
      if (pattern.test(text)) {
        console.log(`[RSS] Detected DAILY recurrence for: "${title.substring(0, 40)}..."`);
        return "daily";
      }
    }
    
    for (const pattern of weeklyPatterns) {
      if (pattern.test(text)) {
        console.log(`[RSS] Detected WEEKLY recurrence for: "${title.substring(0, 40)}..."`);
        return "weekly";
      }
    }
    
    for (const pattern of monthlyPatterns) {
      if (pattern.test(text)) {
        console.log(`[RSS] Detected MONTHLY recurrence for: "${title.substring(0, 40)}..."`);
        return "monthly";
      }
    }
    
    return "once";
  }

  private static shouldFetchFeed(feed: RssFeed): boolean {
    if (!feed.lastFetchedAt) return true;
    
    const now = new Date();
    const lastFetched = new Date(feed.lastFetchedAt);
    const diffMinutes = (now.getTime() - lastFetched.getTime()) / (1000 * 60);
    
    return diffMinutes >= feed.updateFrequencyMinutes;
  }

  private static cleanText(text: string): string {
    if (!text) return "";
    return text
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  private static extractImageFromRssItem(item: any): string | undefined {
    if (item.enclosure?.$.url) return item.enclosure.$.url;
    if (item["media:content"]?.$.url) return item["media:content"].$.url;
    if (item["media:thumbnail"]?.$.url) return item["media:thumbnail"].$.url;
    
    const descMatch = item.description?.match(/<img[^>]+src=["']([^"']+)["']/);
    if (descMatch) return descMatch[1];
    
    return undefined;
  }

  private static extractImageFromAtomItem(item: any): string | undefined {
    if (item.link && Array.isArray(item.link)) {
      const imgLink = item.link.find((l: any) => l.$?.rel === "enclosure" || l.$?.type?.startsWith("image"));
      if (imgLink?.$?.href) return imgLink.$.href;
    }
    return undefined;
  }

  /**
   * Check if an event already exists in the database to prevent duplicates.
   * Uses multiple detection methods:
   * 1. Exact title match + same date
   * 2. Similar location coordinates + same date
   * 3. Same source link (externalId in description)
   */
  private static async checkForDuplicateEvent(
    title: string,
    latitude: number | undefined,
    longitude: number | undefined,
    startTime: Date,
    sourceLink: string | undefined
  ): Promise<boolean> {
    try {
      const normalizedTitle = title.toLowerCase().trim();
      const startDate = startTime.toISOString().split('T')[0];
      
      // Ensure latitude and longitude are valid numbers (not 0 or undefined)
      const hasValidCoords = latitude !== undefined && longitude !== undefined 
        && !isNaN(latitude) && !isNaN(longitude)
        && latitude !== 0 && longitude !== 0
        && Math.abs(latitude) > 1 && Math.abs(longitude) > 1;
      
      // Method 1: Check for exact title match on same date
      const titleMatches = await db.select({ id: events.id, title: events.title })
        .from(events)
        .where(
          sql`LOWER(TRIM(${events.title})) = ${normalizedTitle} 
              AND DATE(${events.startTime}) = ${startDate}`
        )
        .limit(1);
      
      if (titleMatches.length > 0) {
        return true;
      }
      
      // Method 2: Check for same location (within ~100m) on same date with similar title
      if (hasValidCoords) {
        const coordMatches = await db.select({ id: events.id, title: events.title })
          .from(events)
          .where(
            sql`ABS(CAST(${events.latitude} AS DECIMAL) - ${latitude}) < 0.001
                AND ABS(CAST(${events.longitude} AS DECIMAL) - ${longitude}) < 0.001
                AND DATE(${events.startTime}) = ${startDate}
                AND LOWER(TRIM(${events.title})) = ${normalizedTitle}`
          )
          .limit(1);
        
        if (coordMatches.length > 0) {
          return true;
        }
      }
      
      // Method 3: Check if source link is already in description (matches previous import)
      if (sourceLink) {
        const linkMatches = await db.select({ id: events.id })
          .from(events)
          .where(sql`${events.description} LIKE ${'%' + sourceLink + '%'}`)
          .limit(1);
        
        if (linkMatches.length > 0) {
          return true;
        }
      }
      
      return false;
    } catch (error: any) {
      // If similarity extension not available, fall back to basic check
      if (error.message?.includes('similarity')) {
        console.log(`[RSS] Note: pg_trgm extension not available, using basic duplicate check`);
        return this.checkForDuplicateEventBasic(title, startTime, sourceLink);
      }
      console.error(`[RSS] Error checking for duplicate:`, error.message);
      return false;
    }
  }
  
  /**
   * Basic duplicate check without pg_trgm extension
   */
  private static async checkForDuplicateEventBasic(
    title: string,
    startTime: Date,
    sourceLink: string | undefined
  ): Promise<boolean> {
    try {
      const normalizedTitle = title.toLowerCase().trim();
      const startDate = startTime.toISOString().split('T')[0];
      
      // Check for exact title match on same date
      const titleMatches = await db.select({ id: events.id })
        .from(events)
        .where(
          sql`LOWER(TRIM(${events.title})) = ${normalizedTitle} 
              AND DATE(${events.startTime}) = ${startDate}`
        )
        .limit(1);
      
      if (titleMatches.length > 0) {
        return true;
      }
      
      // Check if source link already in description
      if (sourceLink) {
        const linkMatches = await db.select({ id: events.id })
          .from(events)
          .where(sql`${events.description} LIKE ${'%' + sourceLink + '%'}`)
          .limit(1);
        
        if (linkMatches.length > 0) {
          return true;
        }
      }
      
      return false;
    } catch (error: any) {
      console.error(`[RSS] Error in basic duplicate check:`, error.message);
      return false;
    }
  }

  /**
   * Get feed import principles documentation
   */
  static getFeedImportPrinciples(): string {
    return FEED_IMPORT_PRINCIPLES;
  }
}
