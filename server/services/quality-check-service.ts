import axios from "axios";
import { storage } from "../storage";
import { db } from "../db";
import { events, rssFeedItems, rssFeeds } from "@shared/schema";
import { eq, and, isNotNull, desc, gte } from "drizzle-orm";
import type { FeedQualityCheck, QualityCheckIssue, InsertQualityCheckIssue } from "@shared/schema";
import { RULE_GPS_UNIQUENESS, RULE_RECURRING_EVENTS } from "./scraper-manifest";

const NL_BOUNDS = {
  minLat: 50.75,
  maxLat: 53.55,
  minLng: 3.36,
  maxLng: 7.21
};

const MIN_DESCRIPTION_LENGTH = 50;

export interface QualityCheckResult {
  checkId: number;
  feedId: number;
  status: 'completed' | 'failed';
  totalEventsChecked: number;
  eventsWithIssues: number;
  overallScore: number;
  issues: QualityCheckIssue[];
  usedGemini: boolean;
  geminiSampleSize: number;
}

export interface BasicCheckResult {
  issueType: string;
  severity: 'error' | 'warning' | 'info';
  field?: string;
  message: string;
  sourceValue?: string;
  importedValue?: string;
}

export class QualityCheckService {
  
  async runBasicChecks(feedId: number): Promise<QualityCheckResult> {
    console.log(`[QualityCheck] Starting basic checks for feed ${feedId}`);
    
    const qualityCheck = await storage.createQualityCheck({
      feedId,
      status: 'running',
      startedAt: new Date(),
    });
    
    try {
      const feedItems = await db.select({
        item: rssFeedItems,
        event: events
      })
      .from(rssFeedItems)
      .leftJoin(events, eq(rssFeedItems.eventId, events.id))
      .where(and(
        eq(rssFeedItems.feedId, feedId),
        isNotNull(rssFeedItems.eventId)
      ));
      
      const issues: InsertQualityCheckIssue[] = [];
      let eventsWithIssues = 0;
      
      for (const { item, event } of feedItems) {
        if (!event) continue;
        
        const eventIssues = await this.checkEvent(qualityCheck.id, event, item);
        if (eventIssues.length > 0) {
          eventsWithIssues++;
          issues.push(...eventIssues);
        }
      }

      // -----------------------------------------------------------------------
      // Feed-brede checks (Scraper Manifest regels)
      // -----------------------------------------------------------------------

      const validEvents = feedItems
        .map(f => f.event)
        .filter((e): e is NonNullable<typeof e> => e != null);

      // MANIFEST REGEL 1: shared_gps_coordinates
      // Als meer dan 50% van de events exact hetzelfde lat/lon deelt, is de
      // scraper waarschijnlijk teruggevallen op een centraal gemeentepunt.
      if (validEvents.length >= 4) {
        const coordCounts = new Map<string, { lat: number; lng: number; count: number }>();
        for (const ev of validEvents) {
          const lat = parseFloat(String(ev.latitude ?? ""));
          const lng = parseFloat(String(ev.longitude ?? ""));
          if (!isNaN(lat) && !isNaN(lng)) {
            const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
            const entry = coordCounts.get(key) ?? { lat, lng, count: 0 };
            entry.count++;
            coordCounts.set(key, entry);
          }
        }
        for (const [, entry] of coordCounts) {
          const fraction = entry.count / validEvents.length;
          if (fraction >= RULE_GPS_UNIQUENESS.threshold) {
            issues.push({
              qualityCheckId: qualityCheck.id,
              eventId: null,
              feedItemId: null,
              issueType: RULE_GPS_UNIQUENESS.qualityCheckType,
              severity: RULE_GPS_UNIQUENESS.severity,
              field: "location",
              message: `${Math.round(fraction * 100)}% van de events (${entry.count}/${validEvents.length}) staat op exact hetzelfde coördinaat (${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)}). Scraper manifest regel: elk event moet op zijn eigen venue-locatie staan.`,
              importedValue: `${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)}`,
            });
            break; // Één melding per feed volstaat
          }
        }
      }

      // MANIFEST REGEL 2: unmerged_recurring_events
      // Als ≥3 events dezelfde (genormaliseerde) titel hebben, zijn het
      // waarschijnlijk wekelijkse/maandelijkse sessies die als één recurring
      // event opgeslagen hadden moeten worden.
      const titleCounts = new Map<string, number>();
      for (const ev of validEvents) {
        const key = ev.title.toLowerCase().replace(/\s+/g, " ").trim();
        titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
      }
      for (const [title, count] of titleCounts) {
        if (count >= RULE_RECURRING_EVENTS.minOccurrences) {
          issues.push({
            qualityCheckId: qualityCheck.id,
            eventId: null,
            feedItemId: null,
            issueType: RULE_RECURRING_EVENTS.qualityCheckType,
            severity: RULE_RECURRING_EVENTS.severity,
            field: "recurrence",
            message: `"${title}" komt ${count}x voor als los event. Scraper manifest regel: herhaaldelijke events moeten worden geconsolideerd naar één event met recurrence='weekly' of 'monthly'.`,
            importedValue: `${count} losse events`,
          });
        }
      }

      for (const issue of issues) {
        await storage.createQualityIssue(issue);
      }
      
      const totalEvents = feedItems.filter(f => f.event).length;
      const score = totalEvents > 0 
        ? Math.round(((totalEvents - eventsWithIssues) / totalEvents) * 100)
        : 100;
      
      await storage.updateQualityCheck(qualityCheck.id, {
        status: 'completed',
        completedAt: new Date(),
        totalEventsChecked: totalEvents,
        eventsWithIssues,
        overallScore: score,
        usedGemini: false,
        geminiSampleSize: 0,
      });
      
      const savedIssues = await storage.getQualityIssuesByCheck(qualityCheck.id);
      
      console.log(`[QualityCheck] Completed: ${totalEvents} events checked, ${eventsWithIssues} with issues, score: ${score}%`);
      
      return {
        checkId: qualityCheck.id,
        feedId,
        status: 'completed',
        totalEventsChecked: totalEvents,
        eventsWithIssues,
        overallScore: score,
        issues: savedIssues,
        usedGemini: false,
        geminiSampleSize: 0,
      };
      
    } catch (error) {
      console.error(`[QualityCheck] Error:`, error);
      
      await storage.updateQualityCheck(qualityCheck.id, {
        status: 'failed',
        completedAt: new Date(),
      });
      
      throw error;
    }
  }
  
  private async checkEvent(
    qualityCheckId: number, 
    event: typeof events.$inferSelect, 
    feedItem: typeof rssFeedItems.$inferSelect
  ): Promise<InsertQualityCheckIssue[]> {
    const issues: InsertQualityCheckIssue[] = [];
    
    if (!event.imageUrl) {
      issues.push({
        qualityCheckId,
        eventId: event.id,
        feedItemId: feedItem.id,
        issueType: 'missing_image',
        severity: 'warning',
        field: 'imageUrl',
        message: 'Event heeft geen afbeelding',
      });
    } else {
      const imageReachable = await this.checkUrlReachable(event.imageUrl);
      if (!imageReachable) {
        issues.push({
          qualityCheckId,
          eventId: event.id,
          feedItemId: feedItem.id,
          issueType: 'broken_image',
          severity: 'error',
          field: 'imageUrl',
          message: 'Afbeelding URL is niet bereikbaar',
          importedValue: event.imageUrl,
        });
      }
    }
    
    if (!event.description || event.description.length < MIN_DESCRIPTION_LENGTH) {
      issues.push({
        qualityCheckId,
        eventId: event.id,
        feedItemId: feedItem.id,
        issueType: 'short_description',
        severity: 'warning',
        field: 'description',
        message: `Beschrijving is te kort (min. ${MIN_DESCRIPTION_LENGTH} karakters)`,
        importedValue: event.description ? `${event.description.length} karakters` : '0 karakters',
      });
    }
    
    const lat = parseFloat(String(event.latitude));
    const lng = parseFloat(String(event.longitude));
    
    if (isNaN(lat) || isNaN(lng)) {
      issues.push({
        qualityCheckId,
        eventId: event.id,
        feedItemId: feedItem.id,
        issueType: 'invalid_coordinates',
        severity: 'error',
        field: 'location',
        message: 'Ongeldige coördinaten',
        importedValue: `${event.latitude}, ${event.longitude}`,
      });
    } else if (!this.isInNetherlands(lat, lng)) {
      issues.push({
        qualityCheckId,
        eventId: event.id,
        feedItemId: feedItem.id,
        issueType: 'location_outside_nl',
        severity: 'error',
        field: 'location',
        message: 'Locatie ligt buiten Nederland',
        importedValue: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });
    }
    
    const now = new Date();
    const startTime = new Date(event.startTime);
    
    if (startTime < now) {
      issues.push({
        qualityCheckId,
        eventId: event.id,
        feedItemId: feedItem.id,
        issueType: 'past_event',
        severity: 'info',
        field: 'startTime',
        message: 'Event is al geweest',
        importedValue: startTime.toISOString(),
      });
    }
    
    if (event.endTime) {
      const endTime = new Date(event.endTime);
      if (endTime < startTime) {
        issues.push({
          qualityCheckId,
          eventId: event.id,
          feedItemId: feedItem.id,
          issueType: 'invalid_date_range',
          severity: 'error',
          field: 'endTime',
          message: 'Eindtijd is voor starttijd',
          importedValue: `Start: ${startTime.toISOString()}, Eind: ${endTime.toISOString()}`,
        });
      }
    }
    
    if (feedItem.link) {
      const sourceReachable = await this.checkUrlReachable(feedItem.link);
      if (!sourceReachable) {
        issues.push({
          qualityCheckId,
          eventId: event.id,
          feedItemId: feedItem.id,
          issueType: 'broken_source_link',
          severity: 'warning',
          field: 'externalUrl',
          message: 'Bron URL is niet bereikbaar',
          importedValue: feedItem.link,
        });
      }
    }
    
    return issues;
  }
  
  private async checkUrlReachable(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        maxRedirects: 3,
        validateStatus: (status) => status < 400,
      });
      return true;
    } catch (error) {
      try {
        const response = await axios.get(url, {
          timeout: 5000,
          maxRedirects: 3,
          validateStatus: (status) => status < 400,
          headers: { 'Range': 'bytes=0-0' }
        });
        return true;
      } catch {
        return false;
      }
    }
  }
  
  private isInNetherlands(lat: number, lng: number): boolean {
    return (
      lat >= NL_BOUNDS.minLat &&
      lat <= NL_BOUNDS.maxLat &&
      lng >= NL_BOUNDS.minLng &&
      lng <= NL_BOUNDS.maxLng
    );
  }
  
  async getLatestCheckResult(feedId: number): Promise<QualityCheckResult | null> {
    const latestCheck = await storage.getLatestQualityCheck(feedId);
    if (!latestCheck) return null;
    
    const issues = await storage.getQualityIssuesByCheck(latestCheck.id);
    
    return {
      checkId: latestCheck.id,
      feedId: latestCheck.feedId,
      status: latestCheck.status as 'completed' | 'failed',
      totalEventsChecked: latestCheck.totalEventsChecked || 0,
      eventsWithIssues: latestCheck.eventsWithIssues || 0,
      overallScore: latestCheck.overallScore || 0,
      issues,
      usedGemini: latestCheck.usedGemini || false,
      geminiSampleSize: latestCheck.geminiSampleSize || 0,
    };
  }
  
  async getCheckHistory(feedId: number): Promise<FeedQualityCheck[]> {
    return storage.getQualityChecksByFeed(feedId);
  }
  
  async runGeminiCheck(feedId: number, sampleSize: number = 3): Promise<QualityCheckResult> {
    console.log(`[QualityCheck] Starting Gemini check for feed ${feedId} with sample size ${sampleSize}`);
    
    const basicResult = await this.runBasicChecks(feedId);
    
    const qualityCheck = await storage.getQualityCheck(basicResult.checkId);
    if (!qualityCheck) {
      throw new Error('Quality check not found');
    }
    
    await storage.updateQualityCheck(qualityCheck.id, {
      status: 'running',
      usedGemini: true,
      geminiSampleSize: sampleSize,
    });
    
    try {
      const feedItems = await db.select({
        item: rssFeedItems,
        event: events
      })
      .from(rssFeedItems)
      .leftJoin(events, eq(rssFeedItems.eventId, events.id))
      .where(and(
        eq(rssFeedItems.feedId, feedId),
        isNotNull(rssFeedItems.eventId),
        isNotNull(rssFeedItems.link)
      ))
      .limit(sampleSize);
      
      const geminiIssues: InsertQualityCheckIssue[] = [];
      
      for (const { item, event } of feedItems) {
        if (!event || !item.link) continue;
        
        try {
          const sourceContent = await this.fetchSourceContent(item.link);
          if (!sourceContent) continue;
          
          const comparison = await this.compareWithGemini(event, item, sourceContent);
          if (comparison.issues.length > 0) {
            geminiIssues.push(...comparison.issues.map(issue => ({
              ...issue,
              qualityCheckId: qualityCheck.id,
              eventId: event.id,
              feedItemId: item.id,
            })));
          }
        } catch (error) {
          console.error(`[QualityCheck] Error checking event ${event.id}:`, error);
        }
      }
      
      for (const issue of geminiIssues) {
        await storage.createQualityIssue(issue);
      }
      
      const allIssues = await storage.getQualityIssuesByCheck(qualityCheck.id);
      const eventsWithIssues = new Set(allIssues.map(i => i.eventId)).size;
      const score = basicResult.totalEventsChecked > 0 
        ? Math.round(((basicResult.totalEventsChecked - eventsWithIssues) / basicResult.totalEventsChecked) * 100)
        : 100;
      
      await storage.updateQualityCheck(qualityCheck.id, {
        status: 'completed',
        completedAt: new Date(),
        eventsWithIssues,
        overallScore: score,
      });
      
      console.log(`[QualityCheck] Gemini check completed: ${geminiIssues.length} additional issues found`);
      
      return {
        checkId: qualityCheck.id,
        feedId,
        status: 'completed',
        totalEventsChecked: basicResult.totalEventsChecked,
        eventsWithIssues,
        overallScore: score,
        issues: allIssues,
        usedGemini: true,
        geminiSampleSize: sampleSize,
      };
      
    } catch (error) {
      console.error(`[QualityCheck] Gemini check error:`, error);
      
      await storage.updateQualityCheck(qualityCheck.id, {
        status: 'failed',
        completedAt: new Date(),
      });
      
      throw error;
    }
  }
  
  private async fetchSourceContent(url: string): Promise<string | null> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        maxRedirects: 3,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; QualityCheck/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      return response.data;
    } catch (error) {
      console.error(`[QualityCheck] Failed to fetch source: ${url}`);
      return null;
    }
  }
  
  private async compareWithGemini(
    event: typeof events.$inferSelect,
    feedItem: typeof rssFeedItems.$inferSelect,
    sourceHtml: string
  ): Promise<{ issues: Omit<InsertQualityCheckIssue, 'qualityCheckId' | 'eventId' | 'feedItemId'>[] }> {
    const { AiProvider } = await import('./ai-provider');
    
    const strippedHtml = sourceHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 3000);
    
    const systemPrompt = `Je bent een kwaliteitscontrole assistent voor evenementen data. 
Vergelijk de geïmporteerde event data met de bron pagina content en identificeer discrepanties.
Geef je antwoord als JSON array met objecten die de volgende velden hebben:
- issueType: string (bijv. 'title_mismatch', 'date_mismatch', 'description_mismatch', 'missing_info')
- severity: 'error' | 'warning' | 'info'
- field: string (welk veld het betreft)
- message: string (korte Nederlandse beschrijving van het probleem)
- sourceValue: string (waarde gevonden in bron, indien van toepassing)
- importedValue: string (waarde die we geïmporteerd hebben)

Alleen echte discrepanties rapporteren, geen kleine formatting verschillen.
Als alles correct is, geef dan een lege array [].`;

    const userPrompt = `Vergelijk deze event data met de bronpagina:

GEÏMPORTEERDE EVENT DATA:
- Titel: ${event.title}
- Beschrijving: ${event.description?.substring(0, 500) || 'geen'}
- Startdatum: ${event.startTime}
- Einddatum: ${event.endTime || 'niet ingesteld'}
- Adres: ${event.address || 'niet ingesteld'}

BRONPAGINA CONTENT:
${strippedHtml}

Geef je analyse als JSON array.`;

    const result = await AiProvider.complete({
      systemPrompt,
      userPrompt,
      maxTokens: 1000,
      temperature: 0.1,
      jsonMode: true,
    });
    
    if (!result.success || !result.content) {
      console.error(`[QualityCheck] Gemini comparison failed:`, result.error);
      return { issues: [] };
    }
    
    try {
      let parsed = JSON.parse(result.content);
      if (!Array.isArray(parsed)) {
        parsed = [];
      }
      
      return {
        issues: parsed.map((issue: any) => ({
          issueType: issue.issueType || 'source_mismatch',
          severity: issue.severity || 'warning',
          field: issue.field,
          message: issue.message || 'Discrepantie gevonden',
          sourceValue: issue.sourceValue,
          importedValue: issue.importedValue,
        }))
      };
    } catch (error) {
      console.error(`[QualityCheck] Failed to parse Gemini response:`, result.content);
      return { issues: [] };
    }
  }
}

export const qualityCheckService = new QualityCheckService();
