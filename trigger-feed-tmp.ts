import { db } from './server/db';
import { rssFeeds, rssFeedItems, events } from './shared/schema';
import { eq, desc } from 'drizzle-orm';
import { RssFeedService } from './server/services/rss-feed-service';

async function main() {
  const [feed] = await db.select().from(rssFeeds).where(eq(rssFeeds.id, 71));
  console.log('Feed:', feed.name, '| URL:', feed.url, '| Status:', feed.status);

  console.log('\n--- Starting feed sync ---');
  const service = new RssFeedService();
  const result = await (RssFeedService as any).processFeed(feed, (progress: any) => {
    if (progress.logMessage) console.log(progress.logMessage);
    else console.log(`[${progress.status}] ${progress.message || ''}`);
  });

  console.log('\n--- Sync result ---');
  console.log('Success:', result.success);
  console.log('Items processed:', result.itemsProcessed);
  console.log('Events created:', result.eventsCreated);
  console.log('Events updated:', result.eventsUpdated);
  if (result.error) console.log('Error:', result.error);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
