import axios from "axios";
import * as cheerio from "cheerio";
import { parseStringPromise } from "xml2js";
import OpenAI from "openai";
import { db } from "../db";
import { feedAnalysisProfiles } from "@shared/schema";
import { FEED_IMPORT_PRINCIPLES } from "../config/rss-feed-rules";
import { ContentExtractor } from "./content-extractor";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Domain patterns to municipality mapping for auto-detection
const DOMAIN_MUNICIPALITY_MAP: Record<string, string> = {
  'visittiel': 'Tiel',
  'visittilburg': 'Tilburg',
  'visitbreda': 'Breda',
  'visiteindhoven': 'Eindhoven',
  'visitdenbosch': "'s-Hertogenbosch",
  'visitshertogenbosch': "'s-Hertogenbosch",
  'visitoss': 'Oss',
  'visithelmond': 'Helmond',
  'visitamersfoort': 'Amersfoort',
  'visitzwolle': 'Zwolle',
  'visitarnhem': 'Arnhem',
  'visitnijmegen': 'Nijmegen',
  'visitutrecht': 'Utrecht',
  'visitmaastricht': 'Maastricht',
  'visitgroningen': 'Groningen',
  'visitleeuwarden': 'Leeuwarden',
  'visithaarlem': 'Haarlem',
  'visitleiden': 'Leiden',
  'visitdelft': 'Delft',
  'visitdenhaag': 'Den Haag',
  'visitrotterdam': 'Rotterdam',
  'visitamsterdam': 'Amsterdam',
  'visitveenendaal': 'Veenendaal',
  'visitede': 'Ede',
  'visitapeldoorn': 'Apeldoorn',
  'visitdeventer': 'Deventer',
  'visitenschede': 'Enschede',
  'visithengelo': 'Hengelo',
  'visitalmelo': 'Almelo',
  'visitroosendaal': 'Roosendaal',
  'visitbergenopzoom': 'Bergen op Zoom',
  'visitoosterhout': 'Oosterhout',
  'visitwaalwijk': 'Waalwijk',
  'visitboxtel': 'Boxtel',
  'visitvught': 'Vught',
  'visitmeierijstad': 'Meierijstad',
  'visitveghel': 'Meierijstad',
  'tiel': 'Tiel',
  'tilburg': 'Tilburg',
  'breda': 'Breda',
  'eindhoven': 'Eindhoven',
  'denbosch': "'s-Hertogenbosch",
  'oss': 'Oss',
  'helmond': 'Helmond',
  'utrecht': 'Utrecht',
  'amsterdam': 'Amsterdam',
  'rotterdam': 'Rotterdam',
  'denhaag': 'Den Haag',
  'thehague': 'Den Haag',
  'maastricht': 'Maastricht',
  'groningen': 'Groningen',
  'arnhem': 'Arnhem',
  'nijmegen': 'Nijmegen',
  'uitinbreda': 'Breda',
  'uitintilburg': 'Tilburg',
  'uitinoost': 'Oss',
  'uitintiel': 'Tiel',
  'uitineindhoven': 'Eindhoven',
  'agenda013': 'Tilburg',
  '013tilburg': 'Tilburg',
  'mezz': 'Breda',
  'poppodium013': 'Tilburg',
};

export interface AlternativeSource {
  url: string;
  type: 'rss' | 'atom' | 'json-api' | 'json-feed' | 'sitemap' | 'ical' | 'json-ld' | 'scraper';
  itemCount: number;
  confidence: number;
  recommendation: string;
  desirabilityScore: number; // 1-100, higher = more preferred
  pros: string[];
  cons: string[];
  requirements?: string[];
}

// Desirability ranking (higher = better)
export const FEED_TYPE_DESIRABILITY: Record<string, { score: number; name: string; description: string }> = {
  'json-api': { score: 95, name: 'JSON API', description: 'Beste optie: volledige gestructureerde data, makkelijk te parsen' },
  'json-feed': { score: 90, name: 'JSON Feed', description: 'Moderne standaard met rijke metadata' },
  'rss': { score: 80, name: 'RSS Feed', description: 'Universele standaard, breed ondersteund' },
  'atom': { score: 80, name: 'Atom Feed', description: 'Moderne XML standaard met goede metadata' },
  'ical': { score: 70, name: 'iCal/ICS', description: 'Kalender formaat met datum/tijd, beperkte details' },
  'json-ld': { score: 55, name: 'JSON-LD Schema', description: 'Gestructureerde data in HTML, vereist parsing' },
  'sitemap': { score: 40, name: 'Sitemap', description: 'Alleen URLs, vereist per-pagina scraping' },
  'scraper': { score: 25, name: 'HTML Scraper', description: 'Laatste optie: foutgevoelig, kan breken bij wijzigingen' },
};

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
  aiRecommendation?: string; // Human-readable AI recommendation
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
  platformDetected?: string; // e.g. 'wordpress', 'drupal', 'custom'
  platformInfo?: {
    type: string;
    version?: string;
    hasEventsPlugin?: boolean;
    apiAvailable?: boolean;
    feedAvailable?: boolean;
    categories?: { id: number; name: string; count: number }[];
  };
}

export class FeedAnalyzerService {
  private static readonly USER_AGENT = "letsgo-radar-analyzer/1.0 (+https://letsgo-radar.nl)";

  private static createAlternativeSource(
    url: string,
    type: AlternativeSource['type'],
    itemCount: number,
    confidence: number,
    recommendation: string
  ): AlternativeSource {
    const desirability = FEED_TYPE_DESIRABILITY[type] || { score: 25, name: type, description: 'Onbekend type' };
    
    const prosConsMap: Record<string, { pros: string[]; cons: string[] }> = {
      'json-api': {
        pros: ['Volledige gestructureerde data', 'Makkelijk te parsen', 'Betrouwbare veldmapping'],
        cons: ['Kan API key vereisen', 'Niet gestandaardiseerd'],
      },
      'json-feed': {
        pros: ['Moderne standaard', 'Rijke metadata', 'Goed gedocumenteerd'],
        cons: ['Minder wijdverspreid dan RSS'],
      },
      'rss': {
        pros: ['Universele standaard', 'Breed ondersteund', 'Stabiel'],
        cons: ['Soms beperkte metadata', 'Geen GPS standaard'],
      },
      'atom': {
        pros: ['Moderne XML standaard', 'Goede metadata', 'Betere namespace support'],
        cons: ['Complexer dan RSS'],
      },
      'ical': {
        pros: ['Perfecte datum/tijd ondersteuning', 'Kalender integratie'],
        cons: ['Beperkte beschrijvingen', 'Geen afbeeldingen standaard'],
      },
      'json-ld': {
        pros: ['Gestructureerde Schema.org data', 'SEO-gericht, betrouwbaar'],
        cons: ['Vereist HTML parsing', 'Variabele implementatie'],
      },
      'sitemap': {
        pros: ['Complete lijst van URLs', 'Officiële paginastructuur'],
        cons: ['Vereist per-pagina scraping', 'Langzaam'],
      },
      'scraper': {
        pros: ['Werkt met elke website'],
        cons: ['Foutgevoelig', 'Kan breken bij wijzigingen', 'Handmatige configuratie nodig'],
      },
    };
    
    const { pros, cons } = prosConsMap[type] || { pros: [], cons: [] };
    
    return {
      url,
      type,
      itemCount,
      confidence,
      recommendation,
      desirabilityScore: desirability.score,
      pros,
      cons,
    };
  }

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

      // Generate AI recommendation if we have alternatives
      if ((result.alternativeSources?.length || 0) > 0) {
        await this.generateAiRecommendation(result);
      }

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
      const hostname = urlObj.hostname.replace('www.', '').toLowerCase();
      const domainWithoutTld = hostname.replace(/\.(nl|com|org|eu|be|de)$/, '');
      
      // First check the global DOMAIN_MUNICIPALITY_MAP
      for (const [pattern, municipality] of Object.entries(DOMAIN_MUNICIPALITY_MAP)) {
        if (hostname.includes(pattern) || domainWithoutTld === pattern) {
          result.suggestedMunicipality = municipality;
          result.suggestedFeedName = `Events ${municipality}`;
          console.log(`[FeedAnalyzer] Municipality detected from URL pattern: ${municipality}`);
          return;
        }
      }
      
      // Additional known municipality patterns
      const additionalPatterns: Record<string, string> = {
        'intonijmegen': 'Nijmegen',
        'thisiseindhoven': 'Eindhoven',
        'trefhetinoss': 'Oss',
        'bezoekmeierijstad': 'Meierijstad',
        'exploremaashorst': 'Maashorst',
        'sonenbreugel': 'Son en Breugel',
        'mooibernheze': 'Bernheze',
        'zinindenbosch': "'s-Hertogenbosch",
        'beleefboxtel': 'Boxtel',
        'goedgestel': 'Sint-Michielsgestel',
        'beleveninoosterhout': 'Oosterhout',
        'bezoekoisterwijk': 'Oisterwijk',
        'explorebreda': 'Breda',
        'grenslanddebaronie': 'Gilze en Rijen',
      };

      for (const [pattern, municipality] of Object.entries(additionalPatterns)) {
        if (hostname.includes(pattern)) {
          result.suggestedMunicipality = municipality;
          result.suggestedFeedName = `Events ${municipality}`;
          console.log(`[FeedAnalyzer] Municipality detected from additional pattern: ${municipality}`);
          return;
        }
      }

      // Try to extract city name from URL using common patterns
      const patterns = [
        /visit([a-z]+)\./i,
        /bezoek([a-z]+)\./i,
        /ontdek([a-z]+)\./i,
        /explore([a-z]+)\./i,
        /uitin([a-z]+)\./i,
        /agenda([a-z]+)\./i,
      ];
      
      for (const pattern of patterns) {
        const match = hostname.match(pattern);
        if (match && match[1] && match[1].length > 2) {
          const cityName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
          result.suggestedMunicipality = cityName;
          result.suggestedFeedName = `Events ${cityName}`;
          console.log(`[FeedAnalyzer] Municipality extracted from URL: ${cityName}`);
          return;
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  /**
   * Detect WordPress and fetch its API/feed details
   */
  private static async detectWordPress(
    html: string,
    origin: string,
    result: FeedAnalysisResult,
    alternatives: AlternativeSource[]
  ): Promise<void> {
    const $ = cheerio.load(html);
    
    // Check for WordPress indicators
    const isWordPress = 
      html.includes('wp-content') || 
      html.includes('wp-includes') ||
      $('meta[name="generator"]').attr('content')?.toLowerCase().includes('wordpress') ||
      $('link[rel="https://api.w.org/"]').length > 0;
    
    if (!isWordPress) return;
    
    console.log(`[FeedAnalyzer] WordPress site detected`);
    result.platformDetected = 'wordpress';
    result.platformInfo = { type: 'wordpress', apiAvailable: false, feedAvailable: false };
    
    // Extract version if available
    const generator = $('meta[name="generator"]').attr('content') || '';
    const versionMatch = generator.match(/WordPress\s*([\d.]+)/i);
    if (versionMatch) {
      result.platformInfo.version = versionMatch[1];
    }
    
    // 1. Check WordPress RSS feed
    try {
      const feedUrl = `${origin}/feed/`;
      const feedResponse = await axios.get(feedUrl, {
        headers: { "User-Agent": this.USER_AGENT },
        timeout: 10000,
      });
      
      if (feedResponse.status === 200 && feedResponse.headers['content-type']?.includes('xml')) {
        result.platformInfo.feedAvailable = true;
        
        // Parse RSS to count items
        const feedContent = feedResponse.data;
        const itemMatches = feedContent.match(/<item>/g);
        const itemCount = itemMatches ? itemMatches.length : 0;
        
        alternatives.push(this.createAlternativeSource(
          feedUrl,
          'rss',
          itemCount,
          90,
          `WordPress RSS feed met ${itemCount} recente items`
        ));
        console.log(`[FeedAnalyzer] WordPress RSS feed found with ${itemCount} items`);
      }
    } catch (e) {
      console.log(`[FeedAnalyzer] No WordPress RSS feed at /feed/`);
    }
    
    // 2. Check WordPress REST API
    try {
      const apiUrl = `${origin}/wp-json/wp/v2/posts?per_page=10`;
      const apiResponse = await axios.get(apiUrl, {
        headers: { "User-Agent": this.USER_AGENT },
        timeout: 10000,
      });
      
      if (apiResponse.status === 200 && Array.isArray(apiResponse.data)) {
        result.platformInfo.apiAvailable = true;
        const posts = apiResponse.data;
        
        // Get total from headers
        const totalPosts = parseInt(apiResponse.headers['x-wp-total'] || '0');
        
        alternatives.push(this.createAlternativeSource(
          `${origin}/wp-json/wp/v2/posts`,
          'json-api',
          totalPosts || posts.length,
          95,
          `WordPress REST API met ${totalPosts || posts.length} posts beschikbaar`
        ));
        console.log(`[FeedAnalyzer] WordPress API found with ${totalPosts || posts.length} posts`);
        
        // Add sample items from API
        if (posts.length > 0 && result.sampleItems.length === 0) {
          result.sampleItems = posts.slice(0, 5).map((post: any) => ({
            title: post.title?.rendered || '',
            description: post.excerpt?.rendered?.replace(/<[^>]*>/g, '') || '',
            link: post.link || '',
            date: post.date || '',
            image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || '',
          }));
        }
      }
    } catch (e) {
      console.log(`[FeedAnalyzer] No WordPress REST API available`);
    }
    
    // 3. Check for WordPress categories (to find event-related ones)
    try {
      const categoriesUrl = `${origin}/wp-json/wp/v2/categories?per_page=50`;
      const catResponse = await axios.get(categoriesUrl, {
        headers: { "User-Agent": this.USER_AGENT },
        timeout: 10000,
      });
      
      if (catResponse.status === 200 && Array.isArray(catResponse.data)) {
        result.platformInfo.categories = catResponse.data.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          count: cat.count,
        }));
        
        // Look for event-related categories
        const eventCategories = catResponse.data.filter((cat: any) => 
          /event|agenda|activiteit|programma|uitje|festival/i.test(cat.name)
        );
        
        for (const evtCat of eventCategories) {
          if (evtCat.count > 0) {
            alternatives.push(this.createAlternativeSource(
              `${origin}/wp-json/wp/v2/posts?categories=${evtCat.id}`,
              'json-api',
              evtCat.count,
              93,
              `WordPress API gefilterd op "${evtCat.name}" (${evtCat.count} items)`
            ));
          }
        }
        
        console.log(`[FeedAnalyzer] Found ${result.platformInfo.categories.length} WordPress categories`);
      }
    } catch (e) {
      console.log(`[FeedAnalyzer] Could not fetch WordPress categories`);
    }
    
    // 4. Check for The Events Calendar plugin
    try {
      const tecUrl = `${origin}/wp-json/tribe/events/v1/events`;
      const tecResponse = await axios.get(tecUrl, {
        headers: { "User-Agent": this.USER_AGENT },
        timeout: 10000,
      });
      
      if (tecResponse.status === 200 && tecResponse.data?.events) {
        result.platformInfo.hasEventsPlugin = true;
        const eventCount = tecResponse.data.total || tecResponse.data.events.length;
        
        alternatives.push(this.createAlternativeSource(
          tecUrl,
          'json-api',
          eventCount,
          98,
          `The Events Calendar plugin API met ${eventCount} echte evenementen!`
        ));
        console.log(`[FeedAnalyzer] The Events Calendar plugin found with ${eventCount} events`);
      }
    } catch (e) {
      // Plugin not installed
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
    
    // First, detect platform (WordPress, Drupal, etc.)
    await this.detectWordPress(html, origin, result, alternatives);

    // 1. Check for RSS/Atom/iCal links in HTML head
    $('link[rel="alternate"]').each((_, el) => {
      const type = $(el).attr('type') || '';
      const href = $(el).attr('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : `${origin}${href}`;
        if (type.includes('rss') || type.includes('atom')) {
          alternatives.push(this.createAlternativeSource(
            fullUrl,
            type.includes('atom') ? 'atom' : 'rss',
            0,
            90,
            'Officiële RSS/Atom feed gevonden in HTML'
          ));
        } else if (type.includes('calendar') || href.includes('.ics')) {
          alternatives.push(this.createAlternativeSource(
            fullUrl,
            'ical',
            0,
            85,
            'iCal/ICS kalender feed gevonden'
          ));
        }
      }
    });

    // 1b. Check for JSON-LD Schema.org Event data
    const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
    for (const script of jsonLdScripts) {
      try {
        const ldData = JSON.parse($(script).html() || '{}');
        const items = Array.isArray(ldData) ? ldData : [ldData];
        let eventCount = 0;
        
        for (const item of items) {
          if (item['@type'] === 'Event' || item['@type']?.includes('Event')) {
            eventCount++;
          }
          // Check for ItemList containing events
          if (item['@type'] === 'ItemList' && item.itemListElement) {
            const events = item.itemListElement.filter((e: any) => 
              e['@type'] === 'Event' || e.item?.['@type'] === 'Event'
            );
            eventCount += events.length;
          }
        }
        
        if (eventCount > 0) {
          alternatives.push(this.createAlternativeSource(
            baseUrl,
            'json-ld',
            eventCount,
            80,
            `${eventCount} events gevonden in JSON-LD Schema.org data`
          ));
          console.log(`[FeedAnalyzer] Found ${eventCount} events in JSON-LD`);
        }
      } catch {}
    }

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

    // 3. Try common feed endpoints (RSS, JSON, iCal, sitemap)
    const commonEndpoints = [
      { path: '/feed', expectedType: 'rss' },
      { path: '/feed.xml', expectedType: 'rss' },
      { path: '/rss', expectedType: 'rss' },
      { path: '/rss.xml', expectedType: 'rss' },
      { path: '/atom.xml', expectedType: 'atom' },
      { path: '/api/events', expectedType: 'json-api' },
      { path: '/api/events.json', expectedType: 'json-api' },
      { path: '/events.json', expectedType: 'json-api' },
      { path: '/wp-json/wp/v2/events', expectedType: 'json-api' },
      { path: '/feed/events', expectedType: 'rss' },
      { path: '/events.ics', expectedType: 'ical' },
      { path: '/calendar.ics', expectedType: 'ical' },
      { path: '/agenda.ics', expectedType: 'ical' },
      { path: '/sitemap.xml', expectedType: 'sitemap' },
      { path: '/sitemap_index.xml', expectedType: 'sitemap' },
    ] as const;

    for (const endpoint of commonEndpoints) {
      try {
        const testUrl = `${origin}${endpoint.path}`;
        const testResponse = await axios.head(testUrl, {
          headers: { "User-Agent": this.USER_AGENT },
          timeout: 5000,
          validateStatus: (status) => status < 400
        });
        
        if (testResponse.status === 200) {
          const contentType = testResponse.headers['content-type'] || '';
          let type: AlternativeSource['type'] = endpoint.expectedType as AlternativeSource['type'];
          
          // Override based on content-type if available
          if (contentType.includes('json')) type = 'json-api';
          else if (contentType.includes('atom')) type = 'atom';
          else if (contentType.includes('calendar')) type = 'ical';
          
          alternatives.push(this.createAlternativeSource(
            testUrl,
            type,
            0,
            75,
            `Standaard ${FEED_TYPE_DESIRABILITY[type]?.name || type} endpoint gevonden`
          ));
          console.log(`[FeedAnalyzer] Found endpoint: ${testUrl} (${type})`);
        }
      } catch {
        // Endpoint doesn't exist, continue
      }
    }

    // 4. Check for pagination support - look for pagination links
    const paginationLinks = $('a[href*="?page="]').length;
    if (paginationLinks > 0) {
      // Estimate total pages by finding highest page number
      let maxPage = 1;
      $('a[href*="?page="]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const pageMatch = href.match(/page=(\d+)/);
        if (pageMatch) {
          maxPage = Math.max(maxPage, parseInt(pageMatch[1]));
        }
      });
      
      if (maxPage > 1) {
        result.suggestions.push(`Paginering gedetecteerd (${maxPage}+ pagina's) - scraper ondersteunt dit automatisch`);
      }
    }

    // 5. Check for known sites with specialized scrapers
    const knownScrapers = [
      { pattern: 'intonijmegen', name: 'IntoNijmegen', events: 50 },
      { pattern: 'uitinoss', name: 'Uit in Oss', events: 30 },
      { pattern: 'uitagendabrabant', name: 'Uit Agenda Brabant', events: 100 },
      { pattern: 'tilburg.com', name: 'Tilburg.com', events: 80 },
      { pattern: 'trefhetinoss', name: 'Tref het in Oss', events: 40 },
    ];
    
    for (const scraper of knownScrapers) {
      if (baseUrl.includes(scraper.pattern)) {
        const specializedSource = this.createAlternativeSource(
          baseUrl,
          'scraper',
          scraper.events,
          95,
          `Gespecialiseerde ${scraper.name} scraper beschikbaar (~${scraper.events} events met paginering)`
        );
        // Boost desirability for known scrapers (they're tested and reliable)
        specializedSource.desirabilityScore = 85;
        specializedSource.pros.push('Getest en geoptimaliseerd voor deze site');
        alternatives.push(specializedSource);
        console.log(`[FeedAnalyzer] Known scraper detected: ${scraper.name}`);
        break;
      }
    }

    // 6. Add fallback HTML scraper option only if no structured sources found
    const hasStructuredSources = alternatives.some(a => 
      ['rss', 'atom', 'json-api', 'json-feed', 'ical', 'json-ld'].includes(a.type)
    );
    if (!hasStructuredSources && alternatives.length === 0) {
      alternatives.push(this.createAlternativeSource(
        baseUrl,
        'scraper',
        result.sampleItems?.length || 0,
        40,
        'HTML scraping als fallback optie'
      ));
    }

    // Sort alternatives by desirability score (highest first)
    alternatives.sort((a, b) => b.desirabilityScore - a.desirabilityScore);
    
    result.alternativeSources = alternatives;
    
    if (alternatives.length > 0) {
      result.suggestions.push(`${alternatives.length} import opties gevonden, gesorteerd op wenselijkheid`);
      
      // Highlight the best option
      const best = alternatives[0];
      result.suggestions.push(`Aanbevolen: ${FEED_TYPE_DESIRABILITY[best.type]?.name || best.type} (${best.desirabilityScore}% wenselijkheid)`);
    }
  }

  private static determineRecommendedMethod(result: FeedAnalysisResult): void {
    const alternatives = result.alternativeSources || [];
    
    // Check for specialized scraper first (highest priority for known sites with boosted desirability)
    const specializedScraper = alternatives.find(a => 
      a.type === 'scraper' && a.desirabilityScore >= 80 && a.recommendation.includes('Gespecialiseerde')
    );
    if (specializedScraper) {
      result.recommendedImportMethod = {
        method: 'scraper',
        url: specializedScraper.url,
        reason: specializedScraper.recommendation,
        estimatedEvents: specializedScraper.itemCount || 50
      };
      result.confidenceScore = Math.max(result.confidenceScore, 90);
      return;
    }
    
    if (alternatives.length === 0) {
      // No alternatives found, use discovered API endpoint or scraper
      if (result.discoveredApiEndpoint) {
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
      return;
    }
    
    // Use the highest desirability score (alternatives are already sorted)
    const best = alternatives[0];
    
    // Map alternative types to import methods
    const methodMap: Record<string, 'rss' | 'json-api' | 'scraper'> = {
      'rss': 'rss',
      'atom': 'rss',
      'json-api': 'json-api',
      'json-feed': 'json-api',
      'ical': 'rss', // iCal can be processed similar to RSS
      'json-ld': 'scraper', // Requires HTML parsing with JSON-LD extraction
      'sitemap': 'scraper',
      'scraper': 'scraper',
    };
    
    result.recommendedImportMethod = {
      method: methodMap[best.type] || 'scraper',
      url: best.url,
      reason: best.recommendation,
      estimatedEvents: best.itemCount || result.eventStats?.totalFound || 0
    };
    
    // Boost confidence based on desirability
    if (best.desirabilityScore >= 80) {
      result.confidenceScore = Math.max(result.confidenceScore, 85);
    } else if (best.desirabilityScore >= 60) {
      result.confidenceScore = Math.max(result.confidenceScore, 70);
    }
  }

  /**
   * Generate AI-powered human-readable recommendation based on analysis results
   */
  private static async generateAiRecommendation(
    result: FeedAnalysisResult
  ): Promise<void> {
    if (!process.env.OPENAI_API_KEY) {
      return;
    }

    try {
      const alternativesSummary = (result.alternativeSources || []).map(a => ({
        type: a.type,
        url: a.url,
        itemCount: a.itemCount,
        desirabilityScore: a.desirabilityScore,
        recommendation: a.recommendation,
      }));

      const prompt = `Je bent een vriendelijke expert die een website analyseert voor het importeren van evenementen.

URL: ${result.url}
Platform: ${result.platformDetected || 'onbekend'}
${result.platformInfo ? `Platform info: ${JSON.stringify(result.platformInfo)}` : ''}

ONTDEKTE IMPORT OPTIES (gesorteerd op wenselijkheid):
${JSON.stringify(alternativesSummary, null, 2)}

GEVONDEN EVENEMENTEN: ${result.sampleItems?.length || 0} voorbeelden
${result.sampleItems?.slice(0, 3).map(i => `- ${i.title || 'Geen titel'}`).join('\n') || 'Geen voorbeelden'}

Schrijf een korte, menselijk leesbare aanbeveling in het Nederlands (max 200 woorden) die:
1. Uitlegt welke opties beschikbaar zijn
2. Aangeeft welke optie het beste is en waarom
3. Concrete stappen geeft om de feed toe te voegen

Schrijf in een helpende, duidelijke toon alsof je een collega adviseert. Geen JSON, gewoon tekst.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      });

      result.aiRecommendation = response.choices[0].message.content || '';
      console.log(`[FeedAnalyzer] AI recommendation generated`);

    } catch (error: any) {
      console.error(`[FeedAnalyzer] AI recommendation error:`, error.message);
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

  // Progressive analysis - checks methods in order of desirability
  static async analyzeProgressively(url: string): Promise<ProgressiveAnalysisResult> {
    console.log(`[FeedAnalyzer] Starting progressive analysis of: ${url}`);
    
    const result: ProgressiveAnalysisResult = {
      url,
      steps: [],
      chosenMethod: null,
      sampleEvent: null,
      suggestedFeedName: null,
      suggestedMunicipality: null,
      importRules: FEED_IMPORT_PRINCIPLES,
      isComplete: false,
    };

    // Extract municipality from URL
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      const domain = urlObj.hostname.toLowerCase().replace('www.', '');
      const domainParts = domain.split('.');
      const baseDomain = domainParts[0];
      
      for (const [pattern, municipality] of Object.entries(DOMAIN_MUNICIPALITY_MAP)) {
        if (baseDomain.includes(pattern)) {
          result.suggestedMunicipality = municipality;
          result.suggestedFeedName = `${municipality} Events`;
          break;
        }
      }
    } catch {}

    // Methods in order of desirability (highest first)
    const methodsToCheck: Array<{
      id: string;
      name: string;
      description: string;
      check: () => Promise<MethodCheckResult | null>;
    }> = [
      {
        id: 'json-api',
        name: 'JSON API',
        description: 'WordPress REST API of custom JSON endpoint',
        check: async () => this.checkJsonApi(url),
      },
      {
        id: 'rss',
        name: 'RSS/Atom Feed',
        description: 'Standaard RSS of Atom feed',
        check: async () => this.checkRssFeed(url),
      },
      {
        id: 'ical',
        name: 'iCal/ICS',
        description: 'Kalender export formaat',
        check: async () => this.checkIcalFeed(url),
      },
      {
        id: 'json-ld',
        name: 'JSON-LD Schema',
        description: 'Gestructureerde data in de HTML pagina',
        check: async () => this.checkJsonLd(url),
      },
      {
        id: 'scraper',
        name: 'HTML Scraper',
        description: 'Direct scrapen van de HTML (laatste optie)',
        check: async () => this.checkHtmlScraper(url),
      },
    ];

    // Initialize all steps as pending
    for (const method of methodsToCheck) {
      result.steps.push({
        id: method.id,
        name: method.name,
        description: method.description,
        status: 'checking',
        result: null,
      });
    }

    // Run ALL checks in parallel for speed
    const checkPromises = methodsToCheck.map(async (method, index) => {
      try {
        const checkResult = await method.check();
        return { method, index, checkResult, error: null };
      } catch (error: any) {
        return { method, index, checkResult: null, error };
      }
    });

    const checkResults = await Promise.all(checkPromises);
    
    // Process results and find all viable methods
    const viableMethods: Array<{
      method: typeof methodsToCheck[0];
      result: MethodCheckResult;
      score: number;
    }> = [];

    for (const { method, index, checkResult, error } of checkResults) {
      const step = result.steps[index];
      
      if (error) {
        step.status = 'error';
        step.result = { viable: false, reason: error.message };
        console.log(`[FeedAnalyzer] Error checking ${method.id}:`, error.message);
      } else if (checkResult && checkResult.viable) {
        step.status = 'success';
        step.result = checkResult;
        
        // Calculate score: base desirability + event count bonus
        const baseScore = FEED_TYPE_DESIRABILITY[method.id]?.score || 0;
        const eventBonus = Math.min(checkResult.eventCount || 0, 500) / 10; // Max 50 bonus points
        viableMethods.push({
          method,
          result: checkResult,
          score: baseScore + eventBonus,
        });
        
        console.log(`[FeedAnalyzer] Found viable method: ${method.id} with ${checkResult.eventCount} events (score: ${baseScore + eventBonus})`);
      } else {
        step.status = 'not_found';
        step.result = checkResult;
      }
    }

    // Choose the best method based on combined score (desirability + event count)
    if (viableMethods.length > 0) {
      viableMethods.sort((a, b) => b.score - a.score);
      const best = viableMethods[0];
      
      result.chosenMethod = {
        id: best.method.id,
        name: best.method.name,
        url: best.result.feedUrl || url,
        eventCount: best.result.eventCount || 0,
        reason: best.result.reason,
        pros: FEED_TYPE_DESIRABILITY[best.method.id]?.description || '',
      };
      result.sampleEvent = best.result.sampleEvent || null;
      result.contentQuality = best.result.contentQuality;
      result.isComplete = true;
      
      console.log(`[FeedAnalyzer] Best method chosen: ${best.method.id} with score ${best.score}`);
      if (best.result.contentQuality) {
        console.log(`[FeedAnalyzer] Content quality: ${best.result.contentQuality.estimatedCompletePercentage}% estimated complete`);
      }
    }

    return result;
  }

  private static async checkJsonApi(baseUrl: string): Promise<MethodCheckResult | null> {
    try {
      const urlObj = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
      const origin = urlObj.origin;

      // Check WordPress REST API - use per_page=5 for quick check but read X-WP-Total for actual count
      const wpEndpoints = [
        { url: `${origin}/wp-json/wp/v2/posts?per_page=5`, name: 'WordPress Posts API' },
        { url: `${origin}/wp-json/tribe/events/v1/events?per_page=5`, name: 'The Events Calendar API' },
      ];

      for (const endpoint of wpEndpoints) {
        try {
          const response = await axios.get(endpoint.url, {
            headers: { 'User-Agent': this.USER_AGENT },
            timeout: 10000,
          });
          
          if (response.status === 200 && Array.isArray(response.data)) {
            const events = response.data;
            if (events.length > 0) {
              const sample = events[0];
              // Get total count from WordPress headers (X-WP-Total or x-wp-total)
              const totalHeader = response.headers['x-wp-total'] || response.headers['X-WP-Total'];
              const totalCount = totalHeader ? parseInt(totalHeader, 10) : events.length;
              
              // Analyze content quality
              const contentQuality = ContentExtractor.analyzeContentQuality(events);
              
              return {
                viable: true,
                feedUrl: endpoint.url.replace('per_page=5', 'per_page=100'),
                eventCount: totalCount,
                reason: `${endpoint.name} gevonden met ${totalCount} events`,
                sampleEvent: this.formatSampleEvent(sample, 'json-api'),
                contentQuality,
              };
            }
          }
        } catch {}
      }
    } catch {}
    return { viable: false, reason: 'Geen JSON API gevonden' };
  }

  private static async checkRssFeed(baseUrl: string): Promise<MethodCheckResult | null> {
    try {
      const urlObj = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
      const origin = urlObj.origin;

      const feedUrls = [
        `${origin}/feed/`,
        `${origin}/rss/`,
        `${origin}/feed`,
        `${origin}/rss.xml`,
        `${origin}/events/feed/`,
        `${origin}/agenda/feed/`,
        baseUrl.includes('/feed') || baseUrl.includes('.xml') ? baseUrl : null,
      ].filter(Boolean) as string[];

      for (const feedUrl of feedUrls) {
        try {
          const response = await axios.get(feedUrl, {
            headers: { 
              'User-Agent': this.USER_AGENT,
              'Accept': 'application/rss+xml, application/atom+xml, application/xml'
            },
            timeout: 10000,
          });
          
          const content = response.data;
          if (typeof content === 'string' && (content.includes('<rss') || content.includes('<feed') || content.includes('<channel>'))) {
            const parsed = await parseStringPromise(content, { explicitArray: false });
            const items = parsed.rss?.channel?.item || parsed.feed?.entry || [];
            const itemArray = Array.isArray(items) ? items : [items];
            
            if (itemArray.length > 0) {
              return {
                viable: true,
                feedUrl,
                eventCount: itemArray.length,
                reason: `RSS/Atom feed gevonden met ${itemArray.length} items`,
                sampleEvent: this.formatSampleEvent(itemArray[0], 'rss'),
              };
            }
          }
        } catch {}
      }
    } catch {}
    return { viable: false, reason: 'Geen RSS/Atom feed gevonden' };
  }

  private static async checkIcalFeed(baseUrl: string): Promise<MethodCheckResult | null> {
    try {
      const urlObj = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
      const origin = urlObj.origin;

      const icalUrls = [
        `${origin}/events.ics`,
        `${origin}/calendar.ics`,
        `${origin}/agenda.ics`,
        `${origin}/ical/`,
      ];

      for (const icalUrl of icalUrls) {
        try {
          const response = await axios.get(icalUrl, {
            headers: { 'User-Agent': this.USER_AGENT },
            timeout: 10000,
          });
          
          if (typeof response.data === 'string' && response.data.includes('BEGIN:VCALENDAR')) {
            const eventCount = (response.data.match(/BEGIN:VEVENT/g) || []).length;
            if (eventCount > 0) {
              return {
                viable: true,
                feedUrl: icalUrl,
                eventCount,
                reason: `iCal feed gevonden met ${eventCount} events`,
                sampleEvent: { title: 'iCal event', format: 'iCal parsing vereist' },
              };
            }
          }
        } catch {}
      }
    } catch {}
    return { viable: false, reason: 'Geen iCal feed gevonden' };
  }

  private static async checkJsonLd(baseUrl: string): Promise<MethodCheckResult | null> {
    try {
      const response = await axios.get(baseUrl, {
        headers: { 
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html'
        },
        timeout: 15000,
      });

      if (typeof response.data === 'string') {
        const $ = cheerio.load(response.data);
        const jsonLdScripts = $('script[type="application/ld+json"]');
        
        let eventCount = 0;
        let sampleEvent: any = null;

        jsonLdScripts.each((_, el) => {
          try {
            const content = $(el).html();
            if (content) {
              const data = JSON.parse(content);
              const items = Array.isArray(data) ? data : [data];
              for (const item of items) {
                if (item['@type'] === 'Event') {
                  eventCount++;
                  if (!sampleEvent) {
                    sampleEvent = this.formatSampleEvent(item, 'json-ld');
                  }
                }
              }
            }
          } catch {}
        });

        if (eventCount > 0) {
          return {
            viable: true,
            feedUrl: baseUrl,
            eventCount,
            reason: `JSON-LD Schema.org data gevonden met ${eventCount} events`,
            sampleEvent,
          };
        }
      }
    } catch {}
    return { viable: false, reason: 'Geen JSON-LD event data gevonden' };
  }

  private static async checkHtmlScraper(baseUrl: string): Promise<MethodCheckResult | null> {
    try {
      const response = await axios.get(baseUrl, {
        headers: { 
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html'
        },
        timeout: 15000,
      });

      if (typeof response.data === 'string') {
        const $ = cheerio.load(response.data);
        
        // Look for common event listing patterns
        const eventSelectors = [
          'article.event', '.event-item', '.event-card',
          '[class*="event"]', '[data-event]',
          '.agenda-item', '.calendar-event',
        ];

        for (const selector of eventSelectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            const firstEl = elements.first();
            return {
              viable: true,
              feedUrl: baseUrl,
              eventCount: elements.length,
              reason: `HTML pagina met ${elements.length} event elementen (${selector})`,
              sampleEvent: {
                selector,
                title: firstEl.find('h1, h2, h3, .title').first().text().trim() || 'Event gevonden',
                note: 'Scraper configuratie vereist',
              },
            };
          }
        }
      }
    } catch {}
    return { viable: false, reason: 'Geen scrapbare event structuur gevonden' };
  }

  private static formatSampleEvent(item: any, type: string): SampleEventData {
    if (type === 'json-api') {
      return {
        title: item.title?.rendered || item.title || 'Geen titel',
        description: (item.excerpt?.rendered || item.content?.rendered || '').replace(/<[^>]*>/g, '').substring(0, 200),
        date: item.date || item.start_date || null,
        image: item._embedded?.['wp:featuredmedia']?.[0]?.source_url || item.image?.url || null,
        link: item.link || item.url || null,
        location: item.venue?.venue || item.venue || null,
        rawData: item,
      };
    }
    
    if (type === 'rss') {
      return {
        title: item.title || 'Geen titel',
        description: (item.description || item.summary || '').replace(/<[^>]*>/g, '').substring(0, 200),
        date: item.pubDate || item.published || item.updated || null,
        image: item.enclosure?.$?.url || item['media:content']?.$?.url || null,
        link: item.link || item.id || null,
        location: null,
        rawData: item,
      };
    }
    
    if (type === 'json-ld') {
      return {
        title: item.name || 'Geen titel',
        description: (item.description || '').substring(0, 200),
        date: item.startDate || null,
        image: item.image?.url || item.image || null,
        link: item.url || null,
        location: item.location?.name || item.location?.address?.streetAddress || null,
        rawData: item,
      };
    }
    
    return { title: 'Onbekend formaat', rawData: item };
  }
}

// Types for progressive analysis
export interface ProgressiveStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'checking' | 'success' | 'not_found' | 'error';
  result: MethodCheckResult | null;
}

export interface ContentQualityInfo {
  hasStructuredDates: boolean;
  hasStructuredLocations: boolean;
  canExtractDates: boolean;
  canExtractLocations: boolean;
  estimatedCompletePercentage: number;
  warnings: string[];
  recommendations: string[];
}

export interface MethodCheckResult {
  viable: boolean;
  feedUrl?: string;
  eventCount?: number;
  reason: string;
  sampleEvent?: SampleEventData;
  contentQuality?: ContentQualityInfo;
}

export interface SampleEventData {
  title: string;
  description?: string;
  date?: string;
  image?: string | null;
  link?: string | null;
  location?: string | null;
  rawData?: any;
  [key: string]: any;
}

export interface ProgressiveAnalysisResult {
  url: string;
  steps: ProgressiveStep[];
  chosenMethod: {
    id: string;
    name: string;
    url: string;
    eventCount: number;
    reason: string;
    pros: string;
  } | null;
  sampleEvent: SampleEventData | null;
  suggestedFeedName: string | null;
  suggestedMunicipality: string | null;
  importRules: string;
  isComplete: boolean;
  contentQuality?: ContentQualityInfo;
}
