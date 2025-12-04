import axios from "axios";
import * as cheerio from "cheerio";
import { parseStringPromise } from "xml2js";
import { db } from "../db";
import { rssFeeds, rssFeedItems, events } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { RssFeed, RssFeedItem, InsertRssFeedItem } from "@shared/schema";

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
  rawData?: any;
}

interface FeedParseResult {
  success: boolean;
  items: ParsedFeedItem[];
  error?: string;
}

export class RssFeedService {
  private static readonly USER_AGENT = "letsgo-radar/1.0 (+https://letsgo-radar.nl)";

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
      
      for (let page = 1; page <= 3; page++) {
        const url = page === 1 
          ? "https://www.thisiseindhoven.com/en/events"
          : `https://www.thisiseindhoven.com/en/events?page=${page}`;
        
        console.log(`[RSS] Scraping This Is Eindhoven page ${page}...`);
        
        const response = await axios.get(url, {
          headers: {
            "User-Agent": this.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          timeout: 30000
        });

        const $ = cheerio.load(response.data);
        
        $('a[href*="/en/events/"]').each((_, element) => {
          const $el = $(element);
          const href = $el.attr("href");
          
          if (!href || href === "/en/events" || href.includes("?page=")) return;
          
          const title = $el.find("h2, h3, strong").first().text().trim() || 
                       $el.text().trim().split("\n")[0]?.trim();
          
          if (!title || title.length < 3) return;
          
          const fullLink = href.startsWith("http") 
            ? href 
            : `https://www.thisiseindhoven.com${href}`;
          
          const existingItem = items.find(i => i.link === fullLink);
          if (existingItem) return;
          
          let description = "";
          const descEl = $el.find("p").first();
          if (descEl.length) {
            description = descEl.text().trim();
          }
          
          let dateText = "";
          $el.find("*").each((_, child) => {
            const text = $(child).text();
            const dateMatch = text.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i);
            if (dateMatch) {
              dateText = dateMatch[1];
              return false;
            }
          });
          
          let imageUrl = "";
          const imgEl = $el.find("img").first();
          if (imgEl.length) {
            imageUrl = imgEl.attr("src") || "";
            if (imageUrl && !imageUrl.startsWith("http")) {
              imageUrl = `https://www.thisiseindhoven.com${imageUrl}`;
            }
          }
          
          items.push({
            externalId: `thisiseindhoven-${href.replace(/[^a-z0-9]/gi, "-")}`,
            title: this.cleanText(title),
            description: this.cleanText(description),
            link: fullLink,
            imageUrl: imageUrl || undefined,
            publishedAt: dateText ? this.parseEventDate(dateText) : new Date(),
            startTime: dateText ? this.parseEventDate(dateText) : undefined,
            location: "Eindhoven",
            rawData: { href, dateText }
          });
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`[RSS] Scraped ${items.length} events from This Is Eindhoven`);
      return { success: true, items };
    } catch (error: any) {
      console.error(`[RSS] Error scraping This Is Eindhoven:`, error.message);
      return { success: false, items: [], error: error.message };
    }
  }

  static async processFeeds(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    const activeFeeds = await db.select().from(rssFeeds).where(eq(rssFeeds.status, "active"));
    
    console.log(`[RSS] Processing ${activeFeeds.length} active feeds...`);

    for (const feed of activeFeeds) {
      try {
        const shouldFetch = this.shouldFetchFeed(feed);
        if (!shouldFetch) {
          console.log(`[RSS] Skipping feed ${feed.name} - not due for update yet`);
          continue;
        }

        console.log(`[RSS] Processing feed: ${feed.name} (${feed.feedType})`);

        let result: FeedParseResult;

        if (feed.feedType === "scraper" && feed.url.includes("thisiseindhoven")) {
          result = await this.scrapeThisIsEindhoven();
        } else {
          result = await this.fetchAndParseRssFeed(feed.url);
        }

        if (!result.success) {
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

        console.log(`[RSS] Feed ${feed.name}: ${newItemsCount} new items imported`);
        processed++;
      } catch (error: any) {
        console.error(`[RSS] Error processing feed ${feed.name}:`, error.message);
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

      const [event] = await db.insert(events)
        .values({
          title: parsedItem.title.substring(0, 40),
          description: parsedItem.description || `Meer info: ${parsedItem.link}`,
          latitude: feed.defaultLatitude || "51.4416",
          longitude: feed.defaultLongitude || "5.4697",
          address: feed.defaultAddress || "Eindhoven",
          notificationReach: "2.5",
          startTime: startTime,
          endTime: endTime,
          category: feed.defaultCategory,
          isPaid: false,
          hostId: 1,
          recurrence: "once",
          tags: ["rss-import", feed.name.toLowerCase().replace(/\s+/g, "-")],
          imageUrl: parsedItem.imageUrl || null
        })
        .returning();

      if (event) {
        await db.update(rssFeedItems)
          .set({ eventId: event.id, isProcessed: true })
          .where(eq(rssFeedItems.id, feedItem.id));
        
        console.log(`[RSS] Created event "${event.title}" (ID: ${event.id}) from feed item`);
      }
    } catch (error: any) {
      console.error(`[RSS] Error creating event from feed item:`, error.message);
    }
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

  private static parseEventDate(dateText: string): Date | undefined {
    try {
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      
      const match = dateText.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/i);
      if (match) {
        const day = parseInt(match[1]);
        const month = months[match[2].toLowerCase()];
        const year = parseInt(match[3]);
        
        if (!isNaN(day) && month !== undefined && !isNaN(year)) {
          return new Date(year, month, day, 10, 0, 0);
        }
      }
      
      return new Date(dateText);
    } catch {
      return undefined;
    }
  }
}
