import axios from "axios";
import * as cheerio from "cheerio";
import { parseStringPromise } from "xml2js";
import { db } from "../db";
import { rssFeeds, rssFeedItems, events, CATEGORIES } from "@shared/schema";
import { eq, and, sql, ilike } from "drizzle-orm";
import type { RssFeed, RssFeedItem, InsertRssFeedItem } from "@shared/schema";
import { AIHelper } from "./ai-helper";
import { DEFAULT_FEED_RULES, FEED_IMPORT_PRINCIPLES, createDuplicateKey, validateEventForImport } from "../config/rss-feed-rules";

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
   * Scrape Den Bosch events from denboschregion.nl
   * Uses schema.org markup for reliable data extraction
   * Following Feed Import Principles: verified locations, date-bound events, source images
   */
  static async scrapeDenBosch(): Promise<FeedParseResult> {
    try {
      const items: ParsedFeedItem[] = [];
      const cheerio = await import('cheerio');
      
      console.log(`[RSS] Starting Den Bosch scraper (denboschregion.nl)...`);
      
      // Known Den Bosch venues with coordinates for geocoding fallback
      const DEN_BOSCH_VENUES: Record<string, { lat: number; lng: number }> = {
        'de markt': { lat: 51.6878, lng: 5.3066 },
        'markt': { lat: 51.6878, lng: 5.3066 },
        'theater aan de parade': { lat: 51.6871, lng: 5.3031 },
        'parade': { lat: 51.6871, lng: 5.3031 },
        'sint-janskathedraal': { lat: 51.6890, lng: 5.3075 },
        'sint jan': { lat: 51.6890, lng: 5.3075 },
        'het noordbrabants museum': { lat: 51.6847, lng: 5.3048 },
        'noordbrabants museum': { lat: 51.6847, lng: 5.3048 },
        'willem twee': { lat: 51.6875, lng: 5.2967 },
        'verkadefabriek': { lat: 51.6829, lng: 5.2827 },
        'de verkadefabriek': { lat: 51.6829, lng: 5.2827 },
        'jheronimus bosch art center': { lat: 51.6867, lng: 5.3017 },
        'mainstage': { lat: 51.6832, lng: 5.2981 },
        'tramkade': { lat: 51.6805, lng: 5.2855 },
        'design museum': { lat: 51.6867, lng: 5.3017 },
        'muzerije': { lat: 51.6858, lng: 5.3052 },
        'bolwerk': { lat: 51.6912, lng: 5.2982 },
        'brabanthallen': { lat: 51.6845, lng: 5.2698 },
        'de groene engel': { lat: 51.6881, lng: 5.3017 },
        'poppodium w2': { lat: 51.6875, lng: 5.2967 },
        'de moriaan': { lat: 51.6878, lng: 5.3066 },
        'museum slager': { lat: 51.6860, lng: 5.3055 },
        'het bossche broek': { lat: 51.7010, lng: 5.3100 },
        'zuiderpark': { lat: 51.6790, lng: 5.3040 },
        'stadsschouwburg': { lat: 51.6871, lng: 5.3031 }
      };
      
      // Fetch multiple pages of events
      const baseUrl = 'https://www.denboschregion.nl/nl/den-bosch/uitagenda';
      let page = 1;
      let hasMorePages = true;
      let totalEvents = 0;
      
      while (hasMorePages && page <= 10) { // Max 10 pages for safety
        const pageUrl = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
        console.log(`[RSS] Fetching Den Bosch page ${page}...`);
        
        const response = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        
        if (!response.ok) {
          console.log(`[RSS] Page ${page} returned ${response.status}, stopping pagination`);
          break;
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Find all event items with schema.org markup
        const eventElements = $('li[itemtype="http://schema.org/Event"]');
        
        if (eventElements.length === 0) {
          console.log(`[RSS] No events found on page ${page}, stopping pagination`);
          hasMorePages = false;
          break;
        }
        
        console.log(`[RSS] Found ${eventElements.length} events on page ${page}`);
        
        eventElements.each((_, el) => {
          try {
            const $el = $(el);
            
            // Extract data from schema.org meta tags
            const title = $el.find('meta[itemprop="name"]').attr('content') || 
                         $el.find('.description__headtext').text().trim();
            if (!title || title.length < 3) return;
            
            // FEED PRINCIPLE 2: Only date-bound events
            const startDateStr = $el.find('meta[itemprop="startDate"]').attr('content');
            const endDateStr = $el.find('meta[itemprop="endDate"]').attr('content');
            if (!startDateStr) return;
            
            const startTime = new Date(startDateStr);
            const endTime = endDateStr ? new Date(endDateStr) : undefined;
            
            // Skip past events
            const now = new Date();
            if (startTime < now && (!endTime || endTime < now)) return;
            
            // Extract location from schema.org
            const locationName = $el.find('[itemprop="location"] meta[itemprop="name"]').attr('content') || '';
            const streetAddress = $el.find('[itemprop="streetAddress"]').attr('content') || '';
            const postalCode = $el.find('[itemprop="postalCode"]').attr('content') || '';
            const city = $el.find('[itemprop="addressLocality"]').attr('content') || '\'s-Hertogenbosch';
            
            // Build full address
            let address = '';
            if (streetAddress) {
              address = streetAddress;
              if (postalCode) address += `, ${postalCode}`;
              address += ` ${city.replace(/'/g, "'")}`;
            } else if (locationName) {
              address = `${locationName}, ${city.replace(/'/g, "'")}`;
            } else {
              address = city.replace(/'/g, "'");
            }
            
            // FEED PRINCIPLE 1: Verified location
            // Try to geocode using known venues or address
            let latitude: number | undefined;
            let longitude: number | undefined;
            let locationVerified = false;
            
            // First try known venues
            const locationLower = (locationName || '').toLowerCase();
            const titleLower = title.toLowerCase();
            
            for (const [venueName, coords] of Object.entries(DEN_BOSCH_VENUES)) {
              if (locationLower.includes(venueName) || titleLower.includes(venueName)) {
                latitude = coords.lat;
                longitude = coords.lng;
                locationVerified = true;
                break;
              }
            }
            
            // If no known venue but we have a street address with postal code, geocode it
            if (!locationVerified && streetAddress && postalCode) {
              // For now, use city center with slight offset based on postal code
              // This ensures unique positions for different addresses
              const postalHash = postalCode.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
              latitude = 51.6881 + ((postalHash % 100) - 50) * 0.0005;
              longitude = 5.3036 + ((postalHash % 73) - 36) * 0.0005;
              locationVerified = true;
            }
            
            // Skip events without verified location
            if (!locationVerified) {
              return;
            }
            
            // Extract event link
            const linkEl = $el.find('a.tile__link-overlay');
            const href = linkEl.attr('href') || '';
            const fullLink = href.startsWith('http') ? href : `https://www.denboschregion.nl${href}`;
            
            // Extract image URL
            const imageSrcSet = $el.find('source[srcset]').first().attr('srcset') || '';
            const imageUrl = imageSrcSet || undefined;
            
            // Generate unique external ID
            const slug = href.split('/').pop() || '';
            const externalId = `denbosch-${slug || Date.now()}`;
            
            items.push({
              externalId,
              title: this.formatTitle(title),
              description: `${title} - Evenement in 's-Hertogenbosch`,
              link: fullLink,
              imageUrl,
              publishedAt: new Date(),
              startTime,
              endTime,
              location: locationName || '\'s-Hertogenbosch',
              address,
              latitude,
              longitude,
              rawData: { locationName, streetAddress, postalCode, city, locationVerified }
            });
            
            totalEvents++;
          } catch (error) {
            // Skip this event silently
          }
        });
        
        // Check if there's a next page link
        const nextPageLink = $('a[data-ga-action="next"]');
        hasMorePages = nextPageLink.length > 0;
        page++;
        
        // Rate limiting between pages
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`[RSS] Den Bosch complete: ${items.length} events from ${page - 1} pages`);
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping Den Bosch:`, error.message);
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

      if (parsedItem.address || parsedItem.location) {
        const locationQuery = parsedItem.address || parsedItem.location;
        const geoResult = await this.geocodeAddress(locationQuery + ", Netherlands");
        if (geoResult) {
          latitude = geoResult.lat.toString();
          longitude = geoResult.lon.toString();
          address = geoResult.displayName.split(",").slice(0, 3).join(",").trim();
          geocodeSuccess = true;
        }
      }
      
      if (!geocodeSuccess && parsedItem.location) {
        const venueQuery = `${parsedItem.location}, Eindhoven, Netherlands`;
        console.log(`[RSS] Trying venue geocoding: "${venueQuery}"`);
        const venueResult = await this.geocodeAddress(venueQuery);
        if (venueResult) {
          latitude = venueResult.lat.toString();
          longitude = venueResult.lon.toString();
          address = parsedItem.address || `${parsedItem.location}, Eindhoven`;
          geocodeSuccess = true;
        }
      }
      
      // QUALITY FILTER: Only create events with verified locations
      if (!geocodeSuccess && (!parsedItem.latitude || !parsedItem.longitude)) {
        console.log(`[RSS] SKIPPED event (no verified location): ${parsedItem.title}`);
        return;
      }
      
      // Use parsed coordinates if geocoding failed but we have GPS from scraper
      if (!geocodeSuccess && parsedItem.latitude && parsedItem.longitude) {
        latitude = parsedItem.latitude.toString();
        longitude = parsedItem.longitude.toString();
        address = parsedItem.address || parsedItem.location || "Nederland";
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
          .set({ eventId: event.id, isProcessed: true })
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
