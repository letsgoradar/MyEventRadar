import axios from 'axios';
import * as cheerio from 'cheerio';

async function testOisterwijkScraper() {
  const baseUrl = 'https://www.bezoekoisterwijk.nl';
  const agendaPath = '/uitagenda';
  const linkPattern = /\/uitagenda\/\d+\/[a-z0-9-]+/;
  const eventLinks: string[] = [];
  const maxPages = 10;

  console.log('Testing Oisterwijk scraper...\n');

  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1 
      ? `${baseUrl}${agendaPath}`
      : `${baseUrl}${agendaPath}?page=${page}`;
    
    console.log(`Scraping page ${page}: ${url}`);
    
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
      
      $(`a[href*="${agendaPath}/"]`).each((_, element) => {
        const href = $(element).attr("href");
        if (!href) return;
        if (href === agendaPath || href.includes("?page=") || href.includes("?calendar")) return;
        
        if (!linkPattern.test(href)) return;
        
        const fullLink = href.startsWith("http") 
          ? href 
          : `${baseUrl}${href}`;
        
        if (!eventLinks.includes(fullLink)) {
          eventLinks.push(fullLink);
        }
      });
      
      const newLinksOnPage = eventLinks.length - linksBeforeThisPage;
      console.log(`  Found ${newLinksOnPage} new event links (total: ${eventLinks.length})`);
      
      if (newLinksOnPage === 0) {
        console.log('  No new links, stopping pagination');
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.log(`  Error: ${error.message}`);
      break;
    }
  }

  console.log(`\nTotal event links found: ${eventLinks.length}`);
  console.log('\nFirst 10 links:');
  eventLinks.slice(0, 10).forEach((link, i) => {
    console.log(`  ${i + 1}. ${link}`);
  });
}

testOisterwijkScraper().catch(console.error);
