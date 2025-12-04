import { RssFeedService } from "./services/rss-feed-service";

let schedulerInterval: NodeJS.Timeout | null = null;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function startRssScheduler(): void {
  if (schedulerInterval) {
    console.log("[RSS Scheduler] Scheduler already running");
    return;
  }

  console.log("[RSS Scheduler] Starting RSS feed scheduler...");
  
  setTimeout(async () => {
    console.log("[RSS Scheduler] Running initial feed check...");
    try {
      const result = await RssFeedService.processFeeds();
      console.log(`[RSS Scheduler] Initial check: ${result.processed} feeds processed, ${result.errors} errors`);
    } catch (error: any) {
      console.error("[RSS Scheduler] Error during initial check:", error.message);
    }
  }, 10000);

  schedulerInterval = setInterval(async () => {
    console.log("[RSS Scheduler] Running scheduled feed check...");
    try {
      const result = await RssFeedService.processFeeds();
      console.log(`[RSS Scheduler] Check complete: ${result.processed} feeds processed, ${result.errors} errors`);
    } catch (error: any) {
      console.error("[RSS Scheduler] Error during scheduled check:", error.message);
    }
  }, CHECK_INTERVAL_MS);

  console.log(`[RSS Scheduler] Scheduler started (checking every ${CHECK_INTERVAL_MS / 1000 / 60} minutes)`);
}

export function stopRssScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[RSS Scheduler] Scheduler stopped");
  }
}

export async function runManualFeedCheck(): Promise<{ processed: number; errors: number }> {
  console.log("[RSS Scheduler] Running manual feed check...");
  return await RssFeedService.processFeeds();
}
