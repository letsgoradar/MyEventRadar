import { RssFeedService } from "./services/rss-feed-service";

let schedulerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

const SCHEDULE_HOURS = [3, 15];

function getNextScheduledTime(): Date {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  
  let nextHour = SCHEDULE_HOURS.find(h => h > currentHour || (h === currentHour && currentMinutes < 0));
  
  if (nextHour === undefined) {
    nextHour = SCHEDULE_HOURS[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(nextHour, 0, 0, 0);
    return tomorrow;
  }
  
  const next = new Date(now);
  next.setHours(nextHour, 0, 0, 0);
  return next;
}

function getMillisecondsUntilNext(): number {
  const next = getNextScheduledTime();
  const now = new Date();
  return next.getTime() - now.getTime();
}

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

async function runScheduledScrape(): Promise<void> {
  if (isProcessing) {
    console.log("[RSS Scheduler] Skipping - previous run still in progress");
    return;
  }
  
  const startTime = new Date();
  console.log(`[RSS Scheduler] ===== Starting scheduled scrape at ${formatTime(startTime)} on ${formatDate(startTime)} =====`);
  
  isProcessing = true;
  try {
    const result = await RssFeedService.processFeeds();
    const endTime = new Date();
    const durationMinutes = ((endTime.getTime() - startTime.getTime()) / 1000 / 60).toFixed(1);
    
    console.log(`[RSS Scheduler] ===== Scrape completed =====`);
    console.log(`[RSS Scheduler] Duration: ${durationMinutes} minutes`);
    console.log(`[RSS Scheduler] Feeds processed: ${result.processed}`);
    console.log(`[RSS Scheduler] Errors: ${result.errors}`);
    
    const nextRun = getNextScheduledTime();
    console.log(`[RSS Scheduler] Next scheduled run: ${formatTime(nextRun)} on ${formatDate(nextRun)}`);
  } catch (error: any) {
    console.error("[RSS Scheduler] Error during scheduled scrape:", error.message);
  } finally {
    isProcessing = false;
  }
}

function scheduleNextRun(): void {
  const msUntilNext = getMillisecondsUntilNext();
  const nextTime = getNextScheduledTime();
  
  console.log(`[RSS Scheduler] Next run scheduled for ${formatTime(nextTime)} on ${formatDate(nextTime)} (in ${(msUntilNext / 1000 / 60 / 60).toFixed(1)} hours)`);
  
  schedulerInterval = setTimeout(async () => {
    await runScheduledScrape();
    scheduleNextRun();
  }, msUntilNext);
}

export function startRssScheduler(): void {
  if (schedulerInterval) {
    console.log("[RSS Scheduler] Scheduler already running");
    return;
  }

  console.log("[RSS Scheduler] Starting RSS feed scheduler...");
  console.log(`[RSS Scheduler] Configured to run at: ${SCHEDULE_HOURS.map(h => `${h.toString().padStart(2, '0')}:00`).join(' and ')}`);
  
  scheduleNextRun();
  
  console.log("[RSS Scheduler] Scheduler started successfully");
}

export function stopRssScheduler(): void {
  if (schedulerInterval) {
    clearTimeout(schedulerInterval);
    schedulerInterval = null;
    console.log("[RSS Scheduler] Scheduler stopped");
  }
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
} {
  return {
    isRunning: schedulerInterval !== null,
    isProcessing,
    nextRun: schedulerInterval ? getNextScheduledTime() : null,
    scheduleHours: SCHEDULE_HOURS
  };
}
