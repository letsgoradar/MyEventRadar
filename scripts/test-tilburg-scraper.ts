import axios from 'axios';
import * as cheerio from 'cheerio';

async function testTilburgScraper() {
  const eventLinks: string[] = [];
  const maxPages = 20;

  console.log('Testing Tilburg scraper...\n');

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const url = pageNum === 1 
      ? "https://tilburg.com/agenda-tilburg/"
      : `https://tilburg.com/agenda-tilburg/page/${pageNum}/`;
    
    console.log(`Scraping page ${pageNum}: ${url}`);
    
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml"
        },
        timeout: 30000
      });

      const $ = cheerio.load(response.data);
      const linksBeforeThisPage = eventLinks.length;
      
      $('a.tb-grid-item').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('/agenda/') && !eventLinks.includes(href)) {
          eventLinks.push(href);
        }
      });
      
      const newLinksOnPage = eventLinks.length - linksBeforeThisPage;
      console.log(`  Found ${newLinksOnPage} new event links (total: ${eventLinks.length})`);
      
      if (newLinksOnPage === 0) {
        console.log('  No new links, stopping pagination');
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('  Page not found (404), stopping pagination');
      } else {
        console.log(`  Error: ${error.message}`);
      }
      break;
    }
  }

  console.log(`\nTotal event links found: ${eventLinks.length}`);
  console.log('\nFirst 10 links:');
  eventLinks.slice(0, 10).forEach((link, i) => {
    console.log(`  ${i + 1}. ${link}`);
  });
}

testTilburgScraper().catch(console.error);
