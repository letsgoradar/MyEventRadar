import { RssFeedService } from '../server/services/rss-feed-service';
import { db } from '../server/db';
import { rssFeeds } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function importFeeds() {
  console.log('Starting feed imports...\n');
  
  const feedIds = [16]; // Tilburg
  
  for (const feedId of feedIds) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing feed ID: ${feedId}...`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
      const [feed] = await db.select().from(rssFeeds).where(eq(rssFeeds.id, feedId));
      
      if (!feed) {
        console.error(`Feed ${feedId} not found`);
        continue;
      }
      
      console.log(`Found feed: ${feed.name} (${feed.municipality})`);
      const result = await RssFeedService.processFeed(feed);
      console.log(`\n${feed.name} result:`, JSON.stringify(result, null, 2));
    } catch (error: any) {
      console.error(`Error importing feed ${feedId}:`, error.message);
    }
  }
  
  console.log('\n\nImport complete!');
  process.exit(0);
}

importFeeds().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
