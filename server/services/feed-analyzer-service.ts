import axios from "axios";
import * as cheerio from "cheerio";
import { parseStringPromise } from "xml2js";
import OpenAI from "openai";
import { db } from "../db";
import { feedAnalysisProfiles } from "@shared/schema";
import { FEED_IMPORT_PRINCIPLES } from "../config/rss-feed-rules";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AlternativeSource {
  url: string;
  type: 'rss' | 'atom' | 'json-api' | 'json-feed' | 'sitemap';
  itemCount: number;
  confidence: number;
  recommendation: string;
}

export interface FeedAnalysisResult {
  url: string;
  feedType: 'rss' | 'atom' | 'json' | 'html-scraper' | 'unknown';
  isViable: boolean;
  confidenceScore: number;
  detectedFields: {
    title?: { path: string; confidence: number; sample?: string };
    description?: { path: string; confidence: number; sample?: string };
    date?: { path: string; confidence: number; sample?: string };
    time?: { path: string; confidence: number; sample?: string };
    location?: { path: string; confidence: number; sample?: string };
    image?: { path: string; confidence: number; sample?: string };
    link?: { path: string; confidence: number; sample?: string };
  };
  sampleItems: any[];
  warnings: string[];
  missingRequiredFields: string[];
  suggestions: string[];
  aiAnalysis?: string;
  rawContentSample?: string;
  eventStats?: {
    totalFound: number;
    importable: number;
    withGps: number;
    withDate: number;
    withImage: number;
    rejected: number;
    rejectionReasons?: Record<string, number>;
  };
  suggestedMunicipality?: string;
  suggestedFeedName?: string;
  alternativeSources?: AlternativeSource[];
  discoveredApiEndpoint?: string;
  recommendedImportMethod?: {
    method: 'rss' | 'json-api' | 'scraper';
    url: string;
    reason: string;
    estimatedEvents: number;
  };
}

export class FeedAnalyzerService {
  private static readonly USER_AGENT = "letsgo-radar-analyzer/1.0 (+https://letsgo-radar.nl)";

  static async analyzeUrl(url: string): Promise<FeedAnalysisResult> {
    console.log(`[FeedAnalyzer] Starting analysis of: ${url}`);
    
    const result: FeedAnalysisResult = {
      url,
      feedType: 'unknown',
      isViable: false,
      confidenceScore: 0,
      detectedFields: {},
      sampleItems: [],
      warnings: [],
      missingRequiredFields: [],
      suggestions: [],
      alternativeSources: [],
    };

    try {
      const response = await axios.get(url, {
        headers: { 
          "User-Agent": this.USER_AGENT,
          "Accept": "application/rss+xml, application/atom+xml, application/xml, application/json, text/html, */*"
        },
        timeout: 30000,
        maxContentLength: 5 * 1024 * 1024,
      });

      const contentType = response.headers['content-type'] || '';
      const content = response.data;
      result.rawContentSample = typeof content === 'string' 
        ? content.substring(0, 5000) 
        : JSON.stringify(content).substring(0, 5000);

      result.feedType = await this.detectFeedType(content, contentType, url);
      console.log(`[FeedAnalyzer] Detected feed type: ${result.feedType}`);

      // For HTML pages, discover alternative sources first
      if (result.feedType === 'html-scraper' && typeof content === 'string') {
        await this.discoverAlternativeSources(content, url, result);
      }

      switch (result.feedType) {
        case 'rss':
        case 'atom':
          await this.analyzeXmlFeed(content, result);
          break;
        case 'json':
          await this.analyzeJsonFeed(content, result);
          break;
        case 'html-scraper':
          await this.analyzeHtmlPage(content, url, result);
          break;
        default:
          result.warnings.push('Kon feed type niet automatisch detecteren');
          await this.useAiAnalysis(content, url, result);
      }

      // Determine best import method
      this.determineRecommendedMethod(result);

      this.validateAgainstImportRules(result);
      this.calculateConfidenceScore(result);

      result.isViable = result.confidenceScore >= 50 && 
                        result.missingRequiredFields.length === 0;

      await this.saveAnalysisProfile(result);

    } catch (error: any) {
      console.error(`[FeedAnalyzer] Error analyzing ${url}:`, error.message);
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        result.warnings.push('De URL reageerde niet binnen de tijdslimiet (30 seconden)');
        result.suggestions.push('Controleer of de server bereikbaar is en probeer het later opnieuw');
      } else if (error.response?.status === 404) {
        result.warnings.push('De opgegeven URL bestaat niet (404 fout)');
        result.suggestions.push('Controleer of de URL correct is geschreven');
      } else if (error.response?.status === 403) {
        result.warnings.push('Toegang geweigerd tot deze URL (403 fout)');
        result.suggestions.push('De website blokkeert mogelijk automatische toegang');
      } else if (error.response?.status >= 500) {
        result.warnings.push('De server heeft een fout (5xx status)');
        result.suggestions.push('Probeer het later opnieuw wanneer de server weer werkt');
      } else if (error.code === 'ENOTFOUND') {
        result.warnings.push('De domeinnaam kon niet worden gevonden');
        result.suggestions.push('Controleer of het domein correct is geschreven');
      } else {
        result.warnings.push('Kon de URL niet ophalen vanwege een verbindingsprobleem');
        result.suggestions.push('Controleer of de URL correct en bereikbaar is');
      }
      
      result.isViable = false;
    }

    return result;
  }

  private static async detectFeedType(
    content: any, 
    contentType: string,
    url: string
  ): Promise<'rss' | 'atom' | 'json' | 'html-scraper' | 'unknown'> {
    if (contentType.includes('application/rss+xml') || 
        contentType.includes('application/atom+xml')) {
      const contentStr = typeof content === 'string' ? content : '';
      return contentStr.includes('<feed') ? 'atom' : 'rss';
    }

    if (contentType.includes('application/json')) {
      return 'json';
    }

    if (typeof content === 'string') {
      const trimmed = content.trim();
      
      if (trimmed.startsWith('<?xml') || trimmed.startsWith('<rss') || trimmed.startsWith('<feed')) {
        if (trimmed.includes('<feed') && trimmed.includes('xmlns="http://www.w3.org/2005/Atom"')) {
          return 'atom';
        }
        if (trimmed.includes('<rss') || trimmed.includes('<channel>')) {
          return 'rss';
        }
        return 'rss';
      }

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          JSON.parse(trimmed);
          return 'json';
        } catch {}
      }

      if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html')) {
        return 'html-scraper';
      }
    }

    if (url.includes('/feed') || url.includes('.rss') || url.includes('/rss')) {
      return 'rss';
    }
    if (url.includes('.json') || url.includes('/api/')) {
      return 'json';
    }
    if (url.includes('/agenda') || url.includes('/events') || url.includes('/evenementen')) {
      return 'html-scraper';
    }

    return 'unknown';
  }

  private static async analyzeXmlFeed(content: string, result: FeedAnalysisResult): Promise<void> {
    try {
      const parsed = await parseStringPromise(content, { 
        explicitArray: false, 
        ignoreAttrs: false 
      });

      let items: any[] = [];
      
      if (parsed.rss?.channel?.item) {
        items = Array.isArray(parsed.rss.channel.item) 
          ? parsed.rss.channel.item 
          : [parsed.rss.channel.item];
        result.feedType = 'rss';
      } else if (parsed.feed?.entry) {
        items = Array.isArray(parsed.feed.entry) 
          ? parsed.feed.entry 
          : [parsed.feed.entry];
        result.feedType = 'atom';
      }

      if (items.length === 0) {
        result.warnings.push('Geen items gevonden in XML feed');
        return;
      }

      result.sampleItems = items.slice(0, 5);
      console.log(`[FeedAnalyzer] Found ${items.length} items in XML feed`);

      const sampleItem = items[0];
      
      if (sampleItem.title) {
        result.detectedFields.title = {
          path: 'title',
          confidence: 95,
          sample: this.extractTextValue(sampleItem.title)
        };
      }

      if (sampleItem.description || sampleItem.content || sampleItem['content:encoded']) {
        const descPath = sampleItem.description ? 'description' : 
                         sampleItem['content:encoded'] ? 'content:encoded' : 'content';
        result.detectedFields.description = {
          path: descPath,
          confidence: 90,
          sample: this.extractTextValue(sampleItem[descPath])?.substring(0, 200)
        };
      }

      if (sampleItem.pubDate || sampleItem.published || sampleItem.updated) {
        const datePath = sampleItem.pubDate ? 'pubDate' : 
                         sampleItem.published ? 'published' : 'updated';
        result.detectedFields.date = {
          path: datePath,
          confidence: 85,
          sample: this.extractTextValue(sampleItem[datePath])
        };
      }

      const imageUrl = this.findImageInItem(sampleItem);
      if (imageUrl) {
        result.detectedFields.image = {
          path: 'enclosure/media:content/image',
          confidence: 80,
          sample: imageUrl
        };
      }

      if (sampleItem.link) {
        result.detectedFields.link = {
          path: 'link',
          confidence: 95,
          sample: this.extractTextValue(sampleItem.link)
        };
      }

      const locationHint = this.detectLocationInContent(sampleItem);
      if (locationHint) {
        result.detectedFields.location = {
          path: 'description/content',
          confidence: 50,
          sample: locationHint
        };
        result.warnings.push('Locatie moet mogelijk uit beschrijving worden geëxtraheerd');
      }

    } catch (error: any) {
      result.warnings.push(`XML parsing error: ${error.message}`);
    }
  }

  private static async analyzeJsonFeed(content: any, result: FeedAnalysisResult): Promise<void> {
    try {
      const data = typeof content === 'string' ? JSON.parse(content) : content;
      
      let items: any[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data.items) {
        items = data.items;
      } else if (data.events) {
        items = data.events;
      } else if (data.data) {
        items = Array.isArray(data.data) ? data.data : [data.data];
      }

      if (items.length === 0) {
        result.warnings.push('Geen items gevonden in JSON feed');
        return;
      }

      result.sampleItems = items.slice(0, 5);
      console.log(`[FeedAnalyzer] Found ${items.length} items in JSON feed`);

      const sampleItem = items[0];
      const fields = Object.keys(sampleItem);

      const titleField = fields.find(f => 
        ['title', 'name', 'titel', 'naam', 'event_title'].includes(f.toLowerCase())
      );
      if (titleField) {
        result.detectedFields.title = {
          path: titleField,
          confidence: 90,
          sample: sampleItem[titleField]
        };
      }

      const descField = fields.find(f => 
        ['description', 'beschrijving', 'content', 'body', 'text', 'summary'].includes(f.toLowerCase())
      );
      if (descField) {
        result.detectedFields.description = {
          path: descField,
          confidence: 85,
          sample: String(sampleItem[descField]).substring(0, 200)
        };
      }

      const dateField = fields.find(f => 
        ['date', 'datum', 'startDate', 'start_date', 'eventDate', 'dateStart', 'start'].includes(f.toLowerCase()) ||
        f.toLowerCase().includes('date')
      );
      if (dateField) {
        result.detectedFields.date = {
          path: dateField,
          confidence: 80,
          sample: sampleItem[dateField]
        };
      }

      const locationField = fields.find(f => 
        ['location', 'locatie', 'venue', 'address', 'adres', 'place'].includes(f.toLowerCase())
      );
      if (locationField) {
        result.detectedFields.location = {
          path: locationField,
          confidence: 75,
          sample: typeof sampleItem[locationField] === 'object' 
            ? JSON.stringify(sampleItem[locationField]) 
            : sampleItem[locationField]
        };
      }

      const imageField = fields.find(f => 
        ['image', 'imageUrl', 'image_url', 'photo', 'thumbnail', 'afbeelding', 'picture'].includes(f.toLowerCase()) ||
        f.toLowerCase().includes('image')
      );
      if (imageField) {
        result.detectedFields.image = {
          path: imageField,
          confidence: 85,
          sample: sampleItem[imageField]
        };
      }

      const linkField = fields.find(f => 
        ['url', 'link', 'href', 'uri'].includes(f.toLowerCase())
      );
      if (linkField) {
        result.detectedFields.link = {
          path: linkField,
          confidence: 90,
          sample: sampleItem[linkField]
        };
      }

    } catch (error: any) {
      result.warnings.push(`JSON parsing error: ${error.message}`);
    }
  }

  private static async analyzeHtmlPage(
    content: string, 
    url: string, 
    result: FeedAnalysisResult
  ): Promise<void> {
    try {
      const $ = cheerio.load(content);
      
      const eventSelectors = [
        '.event', '.events', '.event-item', '.event-card',
        '.agenda-item', '.agenda-entry', '.agenda',
        '[data-event]', '[class*="event"]',
        '.program-item', '.calendar-item',
        'article', '.card', '.item'
      ];

      let foundItems: any[] = [];
      let usedSelector = '';

      for (const selector of eventSelectors) {
        const elements = $(selector);
        if (elements.length >= 3) {
          foundItems = elements.toArray().slice(0, 10).map(el => {
            const $el = $(el);
            return {
              html: $el.html()?.substring(0, 500),
              text: $el.text().trim().substring(0, 300),
              title: $el.find('h1, h2, h3, h4, .title, [class*="title"]').first().text().trim(),
              date: $el.find('.date, [class*="date"], time').first().text().trim(),
              location: $el.find('.location, .venue, [class*="location"]').first().text().trim(),
              image: $el.find('img').first().attr('src'),
              link: $el.find('a').first().attr('href'),
            };
          });
          usedSelector = selector;
          break;
        }
      }

      if (foundItems.length === 0) {
        result.warnings.push('Geen herkenbare event-elementen gevonden op pagina');
        result.suggestions.push('Mogelijk is een aangepaste scraper nodig voor deze website');
        await this.useAiAnalysis(content, url, result);
        return;
      }

      result.sampleItems = foundItems;
      console.log(`[FeedAnalyzer] Found ${foundItems.length} items with selector: ${usedSelector}`);

      const sample = foundItems[0];
      
      if (sample.title) {
        result.detectedFields.title = {
          path: `${usedSelector} h1,h2,h3,h4,.title`,
          confidence: 70,
          sample: sample.title
        };
      }

      if (sample.date) {
        result.detectedFields.date = {
          path: `${usedSelector} .date,time`,
          confidence: 60,
          sample: sample.date
        };
      }

      if (sample.location) {
        result.detectedFields.location = {
          path: `${usedSelector} .location,.venue`,
          confidence: 55,
          sample: sample.location
        };
      }

      if (sample.image) {
        result.detectedFields.image = {
          path: `${usedSelector} img`,
          confidence: 65,
          sample: sample.image
        };
      }

      if (sample.link) {
        result.detectedFields.link = {
          path: `${usedSelector} a`,
          confidence: 70,
          sample: sample.link
        };
      }

      result.warnings.push('HTML scraping vereist: handmatige configuratie kan nodig zijn');
      result.suggestions.push('Controleer of er een RSS/JSON alternatief beschikbaar is');

      // Calculate event stats based on found items
      this.calculateEventStats(foundItems, result);
      
      // Extract suggested municipality and feed name from URL
      this.extractUrlMetadata(url, result);

    } catch (error: any) {
      result.warnings.push(`HTML parsing error: ${error.message}`);
    }
  }

  private static calculateEventStats(items: any[], result: FeedAnalysisResult): void {
    const stats = {
      totalFound: items.length,
      importable: 0,
      withGps: 0,
      withDate: 0,
      withImage: 0,
      rejected: 0,
      rejectionReasons: {} as Record<string, number>,
    };

    for (const item of items) {
      let canImport = true;
      
      // Check for title
      if (!item.title || item.title.length < 3) {
        canImport = false;
        stats.rejectionReasons['Geen titel'] = (stats.rejectionReasons['Geen titel'] || 0) + 1;
      }
      
      // Check for date
      if (item.date && item.date.length > 0) {
        stats.withDate++;
      } else {
        canImport = false;
        stats.rejectionReasons['Geen datum'] = (stats.rejectionReasons['Geen datum'] || 0) + 1;
      }
      
      // Check for location (potential GPS)
      if (item.location && item.location.length > 0) {
        stats.withGps++; // Assume location can be geocoded
      }
      
      // Check for image
      if (item.image && item.image.length > 0) {
        stats.withImage++;
      }
      
      if (canImport) {
        stats.importable++;
      } else {
        stats.rejected++;
      }
    }

    result.eventStats = stats;
  }

  private static extractUrlMetadata(url: string, result: FeedAnalysisResult): void {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      
      // Known municipality patterns
      const municipalityPatterns: Record<string, string> = {
        'intonijmegen': 'Nijmegen',
        'thisiseindhoven': 'Eindhoven',
        'trefhetinoss': 'Oss',
        'visithelmond': 'Helmond',
        'bezoekmeierijstad': 'Meierijstad',
        'exploremaashorst': 'Maashorst',
        'sonenbreugel': 'Son en Breugel',
        'mooibernheze': 'Bernheze',
        'zinindenbosch': "'s-Hertogenbosch",
        'beleefboxtel': 'Boxtel',
        'goedgestel': 'Sint-Michielsgestel',
        'visitvught': 'Vught',
        'beleveninoosterhout': 'Oosterhout',
        'bezoekoisterwijk': 'Oisterwijk',
        'explorebreda': 'Breda',
        'tilburg': 'Tilburg',
        'grenslanddebaronie': 'Gilze en Rijen',
      };

      // Check for known patterns
      for (const [pattern, municipality] of Object.entries(municipalityPatterns)) {
        if (hostname.includes(pattern)) {
          result.suggestedMunicipality = municipality;
          result.suggestedFeedName = `Events ${municipality}`;
          return;
        }
      }

      // Try to extract city name from URL
      const match = hostname.match(/(?:in|visit|bezoek|ontdek|explore)?([a-z]+)(?:\.com|\.nl)/i);
      if (match && match[1]) {
        const cityName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        result.suggestedMunicipality = cityName;
        result.suggestedFeedName = `Events ${cityName}`;
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  private static async discoverAlternativeSources(
    html: string,
    baseUrl: string,
    result: FeedAnalysisResult
  ): Promise<void> {
    const $ = cheerio.load(html);
    const urlObj = new URL(baseUrl);
    const origin = urlObj.origin;
    const alternatives: AlternativeSource[] = [];

    console.log(`[FeedAnalyzer] Discovering alternative sources for ${baseUrl}`);

    // 1. Check for RSS/Atom links in HTML head
    $('link[rel="alternate"]').each((_, el) => {
      const type = $(el).attr('type') || '';
      const href = $(el).attr('href');
      if (href && (type.includes('rss') || type.includes('atom'))) {
        const fullUrl = href.startsWith('http') ? href : `${origin}${href}`;
        alternatives.push({
          url: fullUrl,
          type: type.includes('atom') ? 'atom' : 'rss',
          itemCount: 0,
          confidence: 90,
          recommendation: 'Officiële RSS feed gevonden in HTML'
        });
      }
    });

    // 2. Look for embedded API endpoints (Nuxt, Next.js, etc.)
    const scripts = $('script').map((_, el) => $(el).html()).get().join('\n');
    
    // Check for Nuxt hydration data
    const nuxtMatch = scripts.match(/__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
    if (nuxtMatch) {
      try {
        // Look for API URLs in the data
        const apiMatch = scripts.match(/["']([\/](?:api|nl\/api|en\/api)[\/][^"']+events[^"']*?)["']/i);
        if (apiMatch) {
          result.discoveredApiEndpoint = `${origin}${apiMatch[1]}`;
          console.log(`[FeedAnalyzer] Found Nuxt API endpoint: ${result.discoveredApiEndpoint}`);
        }
      } catch {}
    }

    // Check for Next.js data
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        // Look for event data or API routes
        if (nextData.props?.pageProps?.events?.length) {
          result.eventStats = {
            totalFound: nextData.props.pageProps.events.length,
            importable: nextData.props.pageProps.events.length,
            withGps: 0,
            withDate: 0,
            withImage: 0,
            rejected: 0
          };
        }
      } catch {}
    }

    // 3. Try common feed endpoints
    const commonEndpoints = [
      '/feed', '/feed.xml', '/rss', '/rss.xml', '/atom.xml',
      '/api/events', '/api/events.json', '/events.json',
      '/wp-json/wp/v2/events', '/feed/events'
    ];

    for (const endpoint of commonEndpoints) {
      try {
        const testUrl = `${origin}${endpoint}`;
        const testResponse = await axios.head(testUrl, {
          headers: { "User-Agent": this.USER_AGENT },
          timeout: 5000,
          validateStatus: (status) => status < 400
        });
        
        if (testResponse.status === 200) {
          const contentType = testResponse.headers['content-type'] || '';
          let type: AlternativeSource['type'] = 'rss';
          if (contentType.includes('json')) type = 'json-api';
          else if (contentType.includes('atom')) type = 'atom';
          
          alternatives.push({
            url: testUrl,
            type,
            itemCount: 0, // Would need GET request to determine
            confidence: 75,
            recommendation: `Standaard ${type} endpoint gevonden`
          });
          console.log(`[FeedAnalyzer] Found endpoint: ${testUrl} (${type})`);
        }
      } catch {
        // Endpoint doesn't exist, continue
      }
    }

    // 4. Look for specific known API patterns
    if (baseUrl.includes('intonijmegen')) {
      const apiUrl = `${origin}/nl/api/search/events?size=50&page=1`;
      try {
        const apiResponse = await axios.get(apiUrl, {
          headers: { "User-Agent": this.USER_AGENT },
          timeout: 10000
        });
        if (apiResponse.data?.items?.length) {
          const totalItems = apiResponse.data.totalCount || apiResponse.data.items.length;
          alternatives.push({
            url: `${origin}/nl/api/search/events`,
            type: 'json-api',
            itemCount: totalItems,
            confidence: 95,
            recommendation: `API endpoint met ${totalItems} events ontdekt`
          });
          result.discoveredApiEndpoint = `${origin}/nl/api/search/events`;
          console.log(`[FeedAnalyzer] IntoNijmegen API: ${totalItems} events found`);
        }
      } catch {}
    }

    result.alternativeSources = alternatives;
    
    if (alternatives.length > 0) {
      result.suggestions.push(`${alternatives.length} alternatieve bronnen ontdekt - bekijk de opties hieronder`);
    }
  }

  private static determineRecommendedMethod(result: FeedAnalysisResult): void {
    const alternatives = result.alternativeSources || [];
    
    // Priority: JSON API > RSS/Atom > HTML Scraper
    const jsonApi = alternatives.find(a => a.type === 'json-api' && a.itemCount > 0);
    const rssFeed = alternatives.find(a => a.type === 'rss' || a.type === 'atom');
    
    if (jsonApi && jsonApi.itemCount > 10) {
      result.recommendedImportMethod = {
        method: 'json-api',
        url: jsonApi.url,
        reason: `JSON API met ${jsonApi.itemCount} events - meest betrouwbaar en volledig`,
        estimatedEvents: jsonApi.itemCount
      };
      result.confidenceScore = Math.max(result.confidenceScore, 85);
    } else if (rssFeed) {
      result.recommendedImportMethod = {
        method: 'rss',
        url: rssFeed.url,
        reason: 'Officiële RSS feed - stabiel en gestandaardiseerd',
        estimatedEvents: rssFeed.itemCount || 0
      };
      result.confidenceScore = Math.max(result.confidenceScore, 80);
    } else if (result.discoveredApiEndpoint) {
      result.recommendedImportMethod = {
        method: 'json-api',
        url: result.discoveredApiEndpoint,
        reason: 'API endpoint ontdekt in pagina - aanbevolen voor volledige import',
        estimatedEvents: result.eventStats?.totalFound || 0
      };
    } else if (result.sampleItems.length > 0) {
      result.recommendedImportMethod = {
        method: 'scraper',
        url: result.url,
        reason: 'HTML scraping - kan beperkt zijn door paginering',
        estimatedEvents: result.eventStats?.totalFound || result.sampleItems.length
      };
    }
  }

  private static async useAiAnalysis(
    content: any, 
    url: string, 
    result: FeedAnalysisResult
  ): Promise<void> {
    if (!process.env.OPENAI_API_KEY) {
      result.warnings.push('OpenAI API key niet geconfigureerd voor geavanceerde analyse');
      return;
    }

    try {
      const contentSample = typeof content === 'string' 
        ? content.substring(0, 8000) 
        : JSON.stringify(content).substring(0, 8000);

      const prompt = `Je bent een expert in het analyseren van event feeds en websites.

URL: ${url}

IMPORT RICHTLIJNEN:
${FEED_IMPORT_PRINCIPLES}

CONTENT SAMPLE:
${contentSample}

Analyseer deze content en geef een JSON response met:
{
  "feedType": "rss|atom|json|html-scraper|unknown",
  "isViable": true/false,
  "fieldMappings": {
    "title": "pad naar titel veld",
    "description": "pad naar beschrijving",
    "date": "pad naar datum",
    "time": "pad naar tijd (alleen als 100% zeker)",
    "location": "pad naar locatie",
    "image": "pad naar afbeelding"
  },
  "warnings": ["lijst van waarschuwingen"],
  "suggestions": ["suggesties voor import"],
  "confidence": 0-100
}

Let op de tijdregel: alleen tijden extraheren als je 100% zeker bent welke start en welke eind is.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.3,
      });

      const aiResult = JSON.parse(response.choices[0].message.content || '{}');
      
      result.aiAnalysis = JSON.stringify(aiResult, null, 2);
      
      if (aiResult.feedType && result.feedType === 'unknown') {
        result.feedType = aiResult.feedType;
      }
      
      if (aiResult.fieldMappings) {
        for (const [field, path] of Object.entries(aiResult.fieldMappings)) {
          if (path && !result.detectedFields[field as keyof typeof result.detectedFields]) {
            result.detectedFields[field as keyof typeof result.detectedFields] = {
              path: path as string,
              confidence: (aiResult.confidence || 50) * 0.8,
              sample: `[AI gedetecteerd: ${path}]`
            };
          }
        }
      }

      if (aiResult.warnings) {
        result.warnings.push(...aiResult.warnings.map((w: string) => `[AI] ${w}`));
      }
      if (aiResult.suggestions) {
        result.suggestions.push(...aiResult.suggestions);
      }

      console.log(`[FeedAnalyzer] AI analysis completed with confidence: ${aiResult.confidence}`);

    } catch (error: any) {
      console.error(`[FeedAnalyzer] AI analysis error:`, error.message);
      result.warnings.push('Geavanceerde AI-analyse kon niet worden uitgevoerd');
      result.suggestions.push('De standaard analyse is nog steeds beschikbaar');
    }
  }

  private static validateAgainstImportRules(result: FeedAnalysisResult): void {
    if (!result.detectedFields.date) {
      result.missingRequiredFields.push('datum');
      result.warnings.push('VERPLICHT: Geen datumveld gedetecteerd - events moeten een datum hebben');
    }

    if (!result.detectedFields.title) {
      result.missingRequiredFields.push('titel');
      result.warnings.push('VERPLICHT: Geen titelveld gedetecteerd');
    }

    if (!result.detectedFields.location) {
      result.warnings.push('WAARSCHUWING: Geen locatieveld gedetecteerd - handmatige locatie-invoer nodig');
      result.suggestions.push('Overweeg een standaard locatie te configureren voor deze feed');
    }

    if (result.detectedFields.time && result.detectedFields.time.confidence < 80) {
      result.warnings.push('WAARSCHUWING: Tijdveld onzeker - events worden mogelijk zonder tijd geïmporteerd');
    }

    if (!result.detectedFields.image) {
      result.suggestions.push('Geen afbeeldingsveld - fallback afbeeldingen worden gebruikt');
    }
  }

  private static calculateConfidenceScore(result: FeedAnalysisResult): void {
    let score = 0;
    let maxScore = 0;

    const fieldWeights = {
      title: 25,
      date: 25,
      description: 15,
      location: 20,
      image: 10,
      link: 5,
    };

    for (const [field, weight] of Object.entries(fieldWeights)) {
      maxScore += weight;
      const detected = result.detectedFields[field as keyof typeof result.detectedFields];
      if (detected) {
        score += (weight * detected.confidence) / 100;
      }
    }

    if (result.feedType === 'rss' || result.feedType === 'atom') {
      score += 10;
    } else if (result.feedType === 'json') {
      score += 8;
    } else if (result.feedType === 'html-scraper') {
      score += 3;
    }
    maxScore += 10;

    if (result.sampleItems.length >= 5) {
      score += 5;
    } else if (result.sampleItems.length >= 2) {
      score += 3;
    }
    maxScore += 5;

    result.confidenceScore = Math.round((score / maxScore) * 100);
    console.log(`[FeedAnalyzer] Confidence score: ${result.confidenceScore}%`);
  }

  private static async saveAnalysisProfile(result: FeedAnalysisResult): Promise<void> {
    try {
      await db.insert(feedAnalysisProfiles).values({
        url: result.url,
        status: 'completed',
        feedType: result.feedType,
        detectedFields: result.detectedFields,
        sampleItems: result.sampleItems,
        analysisResult: {
          isViable: result.isViable,
          confidenceScore: result.confidenceScore,
          warnings: result.warnings,
          missingRequiredFields: result.missingRequiredFields,
          suggestions: result.suggestions,
          aiAnalysis: result.aiAnalysis,
        },
        rawContentSample: result.rawContentSample,
        analyzedAt: new Date(),
      });
      console.log(`[FeedAnalyzer] Analysis profile saved for: ${result.url}`);
    } catch (error: any) {
      console.error(`[FeedAnalyzer] Error saving profile:`, error.message);
    }
  }

  private static extractTextValue(value: any): string {
    if (typeof value === 'string') return value;
    if (value?._ ) return value._;
    if (value?.$?.href) return value.$.href;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value || '');
  }

  private static findImageInItem(item: any): string | null {
    if (item.enclosure?.$?.url) return item.enclosure.$.url;
    if (item['media:content']?.$?.url) return item['media:content'].$.url;
    if (item['media:thumbnail']?.$?.url) return item['media:thumbnail'].$.url;
    if (item.image?.url) return item.image.url;
    if (item.image) return this.extractTextValue(item.image);
    
    const content = item.description || item['content:encoded'] || item.content;
    if (content) {
      const imgMatch = String(content).match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) return imgMatch[1];
    }
    
    return null;
  }

  private static detectLocationInContent(item: any): string | null {
    const content = `${item.title || ''} ${item.description || ''} ${item['content:encoded'] || ''}`;
    
    const locationPatterns = [
      /(?:locatie|location|venue|plaats|adres|address)[:\s]+([^,\n<]+)/i,
      /(?:bij|at|in|@)\s+([A-Z][a-zA-Z\s]+(?:theater|museum|centrum|hal|zaal|café|restaurant))/i,
    ];

    for (const pattern of locationPatterns) {
      const match = content.match(pattern);
      if (match) return match[1].trim();
    }

    return null;
  }
}
