import { RssFeedService } from './server/services/rss-feed-service';
import { db } from './server/db';
import { rssFeeds } from './shared/schema';
import { eq } from 'drizzle-orm';

async function syncBreda() {
  const [feed] = await db.select().from(rssFeeds).where(eq(rssFeeds.id, 13));
  if (!feed) {
    console.log('Breda feed not found');
    process.exit(1);
  }
  
  console.log(`\n=== Syncing ${feed.name} (${feed.municipality}) ===`);
  const result = await RssFeedService.processFeed(feed);
  console.log(`\nResult: ${result.itemsProcessed} processed, ${result.eventsCreated} created`);
  
  if (result.success) {
    console.log(`✓ ${feed.name} synced successfully`);
  } else {
    console.log(`✗ ${feed.name} failed: ${result.error}`);
  }
  
  process.exit(0);
}

syncBreda();
