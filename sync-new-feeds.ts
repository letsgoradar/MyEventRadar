import { RssFeedService } from './server/services/rss-feed-service';
import { storage } from './server/storage';

async function syncNewFeeds() {
  const feedIds = [10, 11, 12, 13, 14, 15];
  
  for (const feedId of feedIds) {
    try {
      const feed = await storage.getRssFeed(feedId);
      if (!feed) {
        console.log(`Feed ${feedId} not found`);
        continue;
      }
      
      console.log(`\n=== Syncing ${feed.name} (${feed.municipality}) ===`);
      const result = await RssFeedService.processFeed(feedId);
      console.log(`Result: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`);
      
      if (result.success) {
        console.log(`✓ ${feed.name} synced successfully`);
      } else {
        console.log(`✗ ${feed.name} failed: ${result.message}`);
      }
    } catch (error: any) {
      console.error(`Error syncing feed ${feedId}:`, error.message);
    }
  }
  
  console.log('\n=== All feeds synced ===');
  process.exit(0);
}

syncNewFeeds();
