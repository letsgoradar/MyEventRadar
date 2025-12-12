import { RssFeedService } from './server/services/rss-feed-service';
import { db } from './server/db';
import { rssFeeds } from './shared/schema';
import { eq } from 'drizzle-orm';

async function syncFeeds() {
  const feedIds = [10, 12, 14]; // Boxtel, Vught, Oosterhout
  
  for (const feedId of feedIds) {
    try {
      const [feed] = await db.select().from(rssFeeds).where(eq(rssFeeds.id, feedId));
      if (!feed) {
        console.log(`Feed ${feedId} not found`);
        continue;
      }
      
      console.log(`\n=== Syncing ${feed.name} (${feed.municipality}) ===`);
      const result = await RssFeedService.processFeed(feed);
      console.log(`Result: ${result.itemsProcessed} processed, ${result.eventsCreated} created`);
      
      if (result.success) {
        console.log(`✓ ${feed.name} synced successfully`);
      } else {
        console.log(`✗ ${feed.name} failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error(`Error syncing feed ${feedId}:`, error.message);
    }
  }
  
  console.log('\n=== Done ===');
  process.exit(0);
}

syncFeeds();
