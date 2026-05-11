import { RssFeedService } from "./services/rss-feed-service";
import type { Request, Response, NextFunction } from "express";

let isProcessing = false;
let lastSyncTime: Date | null = null;
let initialized = false;

const SYNC_INTERVAL_HOURS = 84; // ~2x per week

function formatTime(date: Date): string {
  return date.toLocaleTimeString('nl-NL', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam'
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', { 
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Amsterdam'
  });
}

async function initializeLastSyncTime(): Promise<void> {
  if (initialized) return;
  initialized = true;
  
  try {
    const { db } = await import("./db");
    const { rssFeeds } = await import("@shared/schema");
    const { desc, isNotNull } = await import("drizzle-orm");
    
    const [mostRecent] = await db
      .select({ lastFetchedAt: rssFeeds.lastFetchedAt })
      .from(rssFeeds)
      .where(isNotNull(rssFeeds.lastFetchedAt))
      .orderBy(desc(rssFeeds.lastFetchedAt))
      .limit(1);
    
    if (mostRecent?.lastFetchedAt) {
      lastSyncTime = new Date(mostRecent.lastFetchedAt);
      console.log(`[RSS Scheduler] Last sync was at ${formatTime(lastSyncTime)} on ${formatDate(lastSyncTime)}`);
    } else {
      console.log(`[RSS Scheduler] No previous sync found, will sync on first request`);
    }
  } catch (error: any) {
    console.error("[RSS Scheduler] Error reading last sync time:", error.message);
  }
}

function shouldSync(): boolean {
  if (isProcessing) return false;
  if (!lastSyncTime) return true;
  
  const hoursSinceLastSync = (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastSync >= SYNC_INTERVAL_HOURS;
}

async function runBackgroundSync(): Promise<void> {
  if (isProcessing) return;
  
  const startTime = new Date();
  console.log(`[RSS Scheduler] ===== Starting request-triggered scrape at ${formatTime(startTime)} on ${formatDate(startTime)} =====`);
  
  isProcessing = true;
  try {
    const result = await RssFeedService.processFeeds();
    lastSyncTime = new Date();
    const endTime = new Date();
    const durationMinutes = ((endTime.getTime() - startTime.getTime()) / 1000 / 60).toFixed(1);
    
    console.log(`[RSS Scheduler] ===== Scrape completed =====`);
    console.log(`[RSS Scheduler] Duration: ${durationMinutes} minutes`);
    console.log(`[RSS Scheduler] Feeds processed: ${result.processed}`);
    console.log(`[RSS Scheduler] Errors: ${result.errors}`);
  } catch (error: any) {
    console.error("[RSS Scheduler] Error during scrape:", error.message);
  } finally {
    isProcessing = false;
  }
}

export function rssSyncMiddleware(req: Request, res: Response, next: NextFunction): void {
  next();
  
  if (!initialized) {
    initializeLastSyncTime().then(() => {
      if (shouldSync()) {
        runBackgroundSync();
      }
    });
  } else if (shouldSync()) {
    runBackgroundSync();
  }
}

export function startRssScheduler(): void {
  console.log("[RSS Scheduler] Request-triggered mode enabled (sync every 84h / ~2x per week on traffic)");
  initializeLastSyncTime();
}

export function stopRssScheduler(): void {
  console.log("[RSS Scheduler] Stopped");
}

export async function runManualFeedCheck(): Promise<{ processed: number; errors: number }> {
  if (isProcessing) {
    console.log("[RSS Scheduler] Manual check requested but scrape already in progress");
    return { processed: 0, errors: 0 };
  }
  
  const startTime = new Date();
  console.log(`[RSS Scheduler] ===== Starting MANUAL scrape at ${formatTime(startTime)} =====`);
  
  isProcessing = true;
  try {
    const result = await RssFeedService.processFeeds();
    lastSyncTime = new Date();
    const endTime = new Date();
    const durationMinutes = ((endTime.getTime() - startTime.getTime()) / 1000 / 60).toFixed(1);
    
    console.log(`[RSS Scheduler] ===== Manual scrape completed =====`);
    console.log(`[RSS Scheduler] Duration: ${durationMinutes} minutes`);
    console.log(`[RSS Scheduler] Feeds processed: ${result.processed}`);
    console.log(`[RSS Scheduler] Errors: ${result.errors}`);
    
    return result;
  } catch (error: any) {
    console.error("[RSS Scheduler] Error during manual scrape:", error.message);
    return { processed: 0, errors: 1 };
  } finally {
    isProcessing = false;
  }
}

export function getSchedulerStatus(): { 
  isRunning: boolean; 
  isProcessing: boolean; 
  nextRun: Date | null;
  scheduleHours: number[];
  lastSyncTime: Date | null;
  mode: string;
} {
  return {
    isRunning: true,
    isProcessing,
    nextRun: null,
    scheduleHours: [],
    lastSyncTime,
    mode: 'request-triggered'
  };
}
