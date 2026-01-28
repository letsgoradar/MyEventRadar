import axios from "axios";
import { storage } from "../storage";
import { db } from "../db";
import { events, rssFeedItems, rssFeeds } from "@shared/schema";
import { eq, and, isNotNull, desc, gte } from "drizzle-orm";
import type { FeedQualityCheck, QualityCheckIssue, InsertQualityCheckIssue } from "@shared/schema";

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
}

export const qualityCheckService = new QualityCheckService();
