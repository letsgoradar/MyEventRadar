import axios from "axios";
import * as cheerio from "cheerio";
import { parseStringPromise } from "xml2js";
import { db } from "../db";
import { rssFeeds, rssFeedItems, events, CATEGORIES } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { RssFeed, RssFeedItem, InsertRssFeedItem } from "@shared/schema";
import { AIHelper } from "./ai-helper";

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

  static consolidateMultiDayEvents(items: ParsedFeedItem[]): ParsedFeedItem[] {
    const eventMap = new Map<string, ParsedFeedItem>();
    
    for (const item of items) {
      const key = item.link || item.externalId;
      
      if (eventMap.has(key)) {
        const existing = eventMap.get(key)!;
        const allDates = existing.allDates || [];
        
        if (item.startTime) {
          allDates.push(item.startTime);
        }
        
        if (item.startTime && (!existing.startTime || item.startTime < existing.startTime)) {
          existing.startTime = item.startTime;
        }
        
        if (item.startTime && (!existing.endTime || item.startTime > existing.endTime)) {
          existing.endTime = item.startTime;
        }
        
        existing.allDates = allDates;
        
        if (!existing.imageUrl && item.imageUrl) {
          existing.imageUrl = item.imageUrl;
        }
      } else {
        const allDates: Date[] = [];
        if (item.startTime) {
          allDates.push(item.startTime);
        }
        eventMap.set(key, { ...item, allDates });
      }
    }
    
    const consolidated = Array.from(eventMap.values());
    console.log(`[RSS] Consolidated ${items.length} items into ${consolidated.length} multi-day events`);
    return consolidated;
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
      const consolidated = this.consolidateMultiDayEvents(items);
      return { success: true, items: consolidated };
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
      const consolidated = this.consolidateMultiDayEvents(items);
      return { success: true, items: consolidated };
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
      
      if (items.length === 0) {
        const title = $('h1').first().text().trim() || $('title').text().split('|')[0].trim();
        if (title) {
          const formattedTitle = RssFeedService.formatTitle(title);
          items.push({
            externalId: `helmond-fallback-${url.split('/')[5] || Date.now()}`,
            title: formattedTitle,
            description: `${formattedTitle} - Evenement in Helmond`,
            link: url,
            location: "Helmond",
            address: "Helmond, Netherlands"
          });
        }
      }
      
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
      
      if (items.length === 0) {
        const title = $('h1').first().text().trim() || $('title').text().split('|')[0].trim();
        if (title) {
          const formattedTitle = RssFeedService.formatTitle(title);
          items.push({
            externalId: `oss-fallback-${url.split('/')[4] || Date.now()}`,
            title: formattedTitle,
            description: `${formattedTitle} - Evenement in Oss`,
            link: url,
            location: "Oss",
            address: "Oss, Netherlands"
          });
        }
      }
      
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
      const consolidated = this.consolidateMultiDayEvents(items);
      return { success: true, items: consolidated };
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
      
      const meierijstadVenues: Record<string, {lat: number, lng: number}> = {
        'noordkade': { lat: 51.6155, lng: 5.5301 },
        'theater aan de noordkade': { lat: 51.6155, lng: 5.5301 },
        'blauwe kei': { lat: 51.6154, lng: 5.5301 },
        'afzakkerij': { lat: 51.6149, lng: 5.5299 },
        'de beckart': { lat: 51.6167, lng: 5.5492 },
        'de pas': { lat: 51.6183, lng: 5.4360 },
        'den brouwer': { lat: 51.5675, lng: 5.4510 },
        'd\'n brouwer': { lat: 51.5675, lng: 5.4510 },
        'hoeve arbeidslust': { lat: 51.5710, lng: 5.4650 },
        'kienehoef': { lat: 51.5690, lng: 5.4480 },
        'kulturhus': { lat: 51.5850, lng: 5.6010 }
      };
      
      const meierijstadPlaces: Record<string, {lat: number, lng: number}> = {
        'schijndel': { lat: 51.6178, lng: 5.4363 },
        'veghel': { lat: 51.6167, lng: 5.5500 },
        'sint-oedenrode': { lat: 51.5667, lng: 5.4500 },
        'sint oedenrode': { lat: 51.5667, lng: 5.4500 },
        'rooi': { lat: 51.5667, lng: 5.4500 },
        'erp': { lat: 51.5833, lng: 5.6000 },
        'mariaheide': { lat: 51.5833, lng: 5.5000 },
        'boskant': { lat: 51.5500, lng: 5.4833 },
        'nijnsel': { lat: 51.5500, lng: 5.5167 },
        'olland': { lat: 51.5667, lng: 5.3833 },
        'zijtaart': { lat: 51.5950, lng: 5.5833 }
      };
      
      if (!latitude || !longitude) {
        const searchText = (location + ' ' + address + ' ' + title).toLowerCase();
        
        for (const [venue, coords] of Object.entries(meierijstadVenues)) {
          if (searchText.includes(venue)) {
            latitude = coords.lat + (Math.random() - 0.5) * 0.001;
            longitude = coords.lng + (Math.random() - 0.5) * 0.001;
            break;
          }
        }
      }
      
      if (!latitude || !longitude) {
        const searchText = (location + ' ' + address + ' ' + fullText.substring(0, 1000)).toLowerCase();
        for (const [place, coords] of Object.entries(meierijstadPlaces)) {
          if (searchText.includes(place)) {
            latitude = coords.lat + (Math.random() - 0.5) * 0.01;
            longitude = coords.lng + (Math.random() - 0.5) * 0.01;
            break;
          }
        }
      }
      
      if (!latitude || !longitude) {
        latitude = 51.6100 + (Math.random() - 0.5) * 0.05;
        longitude = 5.5200 + (Math.random() - 0.5) * 0.1;
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

      let newItemsCount = 0;
      for (const item of result.items) {
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

      console.log(`[RSS] ${feed.name}: SUCCESS - ${newItemsCount} new items in ${feedDuration} min (total: ${result.items.length} found)`);
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

        let newItemsCount = 0;
        for (const item of result.items) {
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

        console.log(`[RSS] [${i + 1}/${activeFeeds.length}] ${feed.name}: SUCCESS - ${newItemsCount} new items in ${feedDuration} min (total: ${result.items.length} found)`);
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
      
      if (!geocodeSuccess) {
        latitude = feed.defaultLatitude || "51.4416";
        longitude = feed.defaultLongitude || "5.4697";
        address = feed.defaultAddress || parsedItem.address || "Eindhoven Centrum";
        console.log(`[RSS] Using default location for event: ${address}`);
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
}
