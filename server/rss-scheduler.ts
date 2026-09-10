import { RssFeedService } from "./services/rss-feed-service";
import type { Request, Response, NextFunction } from "express";

let isProcessing = false;
let lastSyncTime: Date | null = null;
let initialized = false;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

const SYNC_INTERVAL_HOURS = 48;

let lastDigestSentAt: Date | null = null;
const DIGEST_COOLDOWN_HOURS = 20;
const DIGEST_TARGET_HOUR_CET = 7;

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
      console.log(`[RSS Scheduler] No previous sync found, will sync immediately`);
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
  console.log(`[RSS Scheduler] ===== Starting interval-triggered scrape at ${formatTime(startTime)} on ${formatDate(startTime)} =====`);
  
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

    // Zelfherstellende koppelingen: probeer ongezonde feeds automatisch te
    // repareren (retry/AI) en escaleer de rest naar dossiers/beslissingen
    // (fire-and-forget, budget-gegrendeld in self_heal_config).
    import("./services/feed-self-heal")
      .then(({ runSelfHeal }) => runSelfHeal())
      .catch((err) => console.error("[RSS Scheduler] Zelf-herstel faalde:", err?.message ?? err));
  } catch (error: any) {
    console.error("[RSS Scheduler] Error during scrape:", error.message);
  } finally {
    isProcessing = false;
  }
}

function currentHourCET(): number {
  return parseInt(
    new Date().toLocaleString("nl-NL", { hour: "numeric", hour12: false, timeZone: "Europe/Amsterdam" }),
    10
  );
}

function shouldSendDigest(): boolean {
  if (lastDigestSentAt) {
    const hoursSince = (Date.now() - lastDigestSentAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince < DIGEST_COOLDOWN_HOURS) return false;
  }
  return currentHourCET() === DIGEST_TARGET_HOUR_CET;
}

async function runDailyDigest(): Promise<void> {
  lastDigestSentAt = new Date();
  try {
    const { sendDailyDigest } = await import("./services/email-service");
    const ok = await sendDailyDigest();
    if (ok) {
      console.log(`[RSS Scheduler] Dagelijkse digest verstuurd om ${formatTime(new Date())}`);
    } else {
      console.warn("[RSS Scheduler] Digest verzending mislukt (zie e-mail logs)");
      lastDigestSentAt = null;
    }
  } catch (err: any) {
    console.error("[RSS Scheduler] Fout bij dagelijkse digest:", err.message);
    lastDigestSentAt = null;
  }
}

export function triggerDigestNow(): void {
  lastDigestSentAt = null;
  runDailyDigest();
}

export function getLastDigestSentAt(): Date | null {
  return lastDigestSentAt;
}

// No-op middleware — sync is now handled by the internal interval, not per-request
export function rssSyncMiddleware(req: Request, res: Response, next: NextFunction): void {
  next();
}

export function startRssScheduler(): void {
  console.log(`[RSS Scheduler] Interval-based mode enabled (sync every ${SYNC_INTERVAL_HOURS}h)`);

  initializeLastSyncTime().then(() => {
    // Run immediately if overdue, then schedule regular interval
    if (shouldSync()) {
      runBackgroundSync();
    }

    // Tick every 15 minutes to check if any feed is due — actual fetch
    // frequency per feed is controlled by updateFrequencyMinutes
    schedulerInterval = setInterval(() => {
      if (shouldSync()) {
        runBackgroundSync();
      }
      if (shouldSendDigest()) {
        runDailyDigest();
      }
    }, 15 * 60 * 1000);
  });
}

export function stopRssScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
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
  const nextRun = lastSyncTime
    ? new Date(lastSyncTime.getTime() + SYNC_INTERVAL_HOURS * 60 * 60 * 1000)
    : null;

  return {
    isRunning: schedulerInterval !== null,
    isProcessing,
    nextRun,
    scheduleHours: [SYNC_INTERVAL_HOURS],
    lastSyncTime,
    mode: 'interval',
  };
}
