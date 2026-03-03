import axios from "axios";
import * as cheerio from "cheerio";
import { parseStringPromise } from "xml2js";
import { db } from "../db";
import { feedAnalysisProfiles } from "@shared/schema";
import { FEED_IMPORT_PRINCIPLES } from "../config/rss-feed-rules";
import { ContentExtractor } from "./content-extractor";
import { FeedFieldDetector } from "./feed-field-detector";
import { AiHtmlAnalyzer } from "./ai-html-analyzer";
import { fetchRenderedHtml, detectJsRenderingNeeded } from "./puppeteer-fetcher";
import { AiProvider } from "./ai-provider";
import { validateExternalUrl } from "../utils/url-validator";

/**
 * Sanitize XML content to fix common parsing issues.
 * Handles:
 * - Unescaped ampersands ("Invalid character in entity name")
 * - Attributes without values ("Attribute without value")
 * - Invalid attribute names (special chars in attributes)
 * - Self-closing HTML tags in XML context
 */
function sanitizeXmlContent(xml: string): string {
  let sanitized = xml;
  
  // Fix unescaped ampersands - replace & not followed by valid entity patterns
  sanitized = sanitized.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
  
  // Fix attributes without values (HTML-style like <tag disabled> -> <tag disabled="disabled">)
  const booleanAttrs = ['disabled', 'checked', 'selected', 'readonly', 'required', 'multiple', 'autofocus', 'autoplay', 'controls', 'loop', 'muted', 'defer', 'async', 'hidden', 'open', 'novalidate', 'formnovalidate', 'ismap', 'itemscope'];
  for (const attr of booleanAttrs) {
    const pattern = new RegExp(`(<[^>]*\\s)${attr}(\\s|>|/>)`, 'gi');
    sanitized = sanitized.replace(pattern, `$1${attr}="${attr}"$2`);
  }
  
  // Fix self-closing tags - ensure space before />
  // e.g., <br/> is fine, but <img src="x"/> needs space: <img src="x" />
  sanitized = sanitized.replace(/(\S)\/>/g, '$1 />');
  
  // Fix self-closing HTML tags that should be self-closing in XML
  const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];
  for (const tag of selfClosingTags) {
    // Match <tag> or <tag ...> that isn't already self-closing, ensure proper spacing
    const pattern = new RegExp(`<(${tag})(\\s[^>]*)?(?<!\\s)>(?!/)`, 'gi');
    sanitized = sanitized.replace(pattern, (match, tagName, attrs) => {
      if (attrs) {
        return `<${tagName}${attrs.trimEnd()} />`;
      }
      return `<${tagName} />`;
    });
  }
  
  // Remove invalid attribute patterns like data-/something or attr/value
  sanitized = sanitized.replace(/\s+[\w-]+\/[\w-]+(?==)/g, ' ');
  
  // Fix attributes with slashes that shouldn't have them
  sanitized = sanitized.replace(/(\s+)([\w-]+)\/(?=\s|>)/g, '$1$2');
  
  return sanitized;
}

/**
 * Try to parse XML with multiple strategies, returning the first successful result.
 */
async function parseXmlWithFallback(xml: string): Promise<any> {
  const strategies = [
    // Strategy 1: Parse sanitized content
    async () => {
      const sanitized = sanitizeXmlContent(xml);
      return await parseStringPromise(sanitized, { explicitArray: false, ignoreAttrs: false });
    },
    // Strategy 2: Strip all HTML from content fields and try again
    async () => {
      let stripped = sanitizeXmlContent(xml);
      // Remove HTML tags from description and content fields
      stripped = stripped.replace(/<description>([^]*?)<\/description>/gi, (match, content) => {
        const text = content.replace(/<[^>]*>/g, '').replace(/\]\]>/g, '');
        return `<description>${text}</description>`;
      });
      stripped = stripped.replace(/<content[^>]*>([^]*?)<\/content>/gi, (match, content) => {
        const text = content.replace(/<[^>]*>/g, '').replace(/\]\]>/g, '');
        return `<content>${text}</content>`;
      });
      return await parseStringPromise(stripped, { explicitArray: false, ignoreAttrs: false });
    },
    // Strategy 3: Use cheerio to extract RSS structure
    async () => {
      const $ = cheerio.load(xml, { xmlMode: true });
      const items: any[] = [];
      $('item, entry').each((_, el) => {
        const item: any = {};
        $(el).children().each((_, child) => {
          const tagName = (child as any).tagName || (child as any).name;
          item[tagName] = $(child).text();
        });
        items.push(item);
      });
      if (items.length > 0) {
        return { rss: { channel: { item: items } } };
      }
      throw new Error('No items found with cheerio fallback');
    }
  ];
  
  let lastError: Error | null = null;
  for (const strategy of strategies) {
    try {
      return await strategy();
    } catch (error: any) {
      lastError = error;
      continue;
    }
  }
  throw lastError || new Error('All parsing strategies failed');
}

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
  'tijdvooramersfoort': 'Amersfoort',
  'vvvamersfoort': 'Amersfoort',
  'vvvbrabantsewal': 'Bergen op Zoom',
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
  // Regional news/agenda sites
  'bommelerwaard': 'Zaltbommel',
  'bommelerwaardnet': 'Zaltbommel',
  'altenanet': 'Altena',
  'altena': 'Altena',
  'rivierenlandnet': 'Tiel',
  'geldersrivierenland': 'Tiel',
  'maashorstnet': 'Uden',
  'landvancuijk': 'Cuijk',
  'meierijstad': 'Meierijstad',
  'bernheze': 'Bernheze',
  'boxtel': 'Boxtel',
  'sintmichielsgestel': 'Sint-Michielsgestel',
  'vught': 'Vught',
  'oisterwijk': 'Oisterwijk',
  'oosterhout': 'Oosterhout',
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
      validateExternalUrl(url, "feed-analyzer");
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
      // Use fallback parsing to handle various XML issues
      const parsed = await parseXmlWithFallback(content);

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

      // Detect RSS/Atom pagination
      const paginationInfo = this.detectRssPagination(content, parsed, items.length);
      if (paginationInfo.hasPagination) {
        result.suggestions.push(`RSS/Atom paginering gedetecteerd: ${paginationInfo.description}`);
        if (paginationInfo.nextUrl) {
          result.suggestions.push(`Volgende pagina: ${paginationInfo.nextUrl}`);
        }
        result.suggestions.push(`Totaal geschat: ${paginationInfo.estimatedTotal} items over ${paginationInfo.estimatedPages} pagina's`);
      }

    } catch (error: any) {
      // Provide helpful error messages for common XML issues
      if (error.message?.includes('Invalid character in entity name')) {
        result.warnings.push('XML bevat ongeldige tekens (waarschijnlijk niet-geëscapete & tekens)');
        result.suggestions.push('De feed heeft technische problemen. We proberen deze automatisch te repareren.');
      } else if (error.message?.includes('Invalid character')) {
        result.warnings.push(`XML parsing fout: ongeldige tekens in de feed`);
        result.suggestions.push('De feed bevat tekens die niet zijn toegestaan in XML');
      } else if (error.message?.includes('Unexpected close tag')) {
        result.warnings.push('XML structuur is ongeldig (ontbrekende of verkeerde tags)');
      } else {
        result.warnings.push(`XML parsing error: ${error.message}`);
      }
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
        'gowaalwijk': 'Waalwijk',
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

  /**
   * Detect Umbraco CMS sites (bezoekdelangstraat.nl and similar)
   */
  private static async detectUmbraco(
    html: string,
    origin: string,
    result: FeedAnalysisResult,
    alternatives: AlternativeSource[]
  ): Promise<void> {
    const $ = cheerio.load(html);
    
    // Check for Umbraco indicators
    const generator = $('meta[name="generator"]').attr('content') || '';
    const isUmbraco = generator.toLowerCase().includes('umbraco') ||
                      html.includes('/App_Plugins/') ||
                      html.includes('umbraco');
    
    if (!isUmbraco) return;
    
    console.log(`[FeedAnalyzer] Umbraco CMS detected`);
    result.platformDetected = 'umbraco';
    result.platformInfo = { type: 'umbraco', apiAvailable: false };
    
    // Known Umbraco site patterns
    const umbracoApiPatterns = [
      { domain: 'bezoekdelangstraat.nl', api: '/umbraco/surface/agenda/filter', paginated: true, pageParam: 'page' },
      { domain: 'visitdelangstraat.com', api: '/umbraco/surface/agenda/filter', paginated: true, pageParam: 'page' },
    ];
    
    const matchedPattern = umbracoApiPatterns.find(p => origin.includes(p.domain));
    
    if (matchedPattern) {
      // Test the API endpoint
      try {
        const apiUrl = `${origin}${matchedPattern.api}?${matchedPattern.pageParam}=1`;
        const response = await axios.get(apiUrl, {
          timeout: 15000,
          headers: { 'Accept': 'text/html, application/xhtml+xml' }
        });
        
        if (response.status === 200 && response.data) {
          const apiHtml = response.data;
          const $api = cheerio.load(apiHtml);
          
          // Count events in response
          const eventLinks = $api('.agenda__item, a[href*="/agenda/"]').toArray();
          const uniqueLinks = Array.from(new Set(eventLinks.map(el => $api(el).attr('href')).filter(Boolean)));
          
          if (uniqueLinks.length > 0) {
            result.platformInfo!.apiAvailable = true;
            
            // Estimate total by checking multiple pages
            let totalEstimate = uniqueLinks.length;
            try {
              const page10 = await axios.get(`${origin}${matchedPattern.api}?${matchedPattern.pageParam}=10`, { timeout: 10000 });
              if (page10.status === 200) {
                const $page10 = cheerio.load(page10.data);
                const page10Links = $page10('.agenda__item, a[href*="/agenda/"]').toArray();
                if (page10Links.length > 0) {
                  totalEstimate = uniqueLinks.length * 15; // Rough estimate: 12 per page * 15 pages
                }
              }
            } catch (e) {
              // Ignore pagination check errors
            }
            
            alternatives.push(this.createAlternativeSource(
              apiUrl,
              'json-api',
              totalEstimate,
              92,
              `Umbraco Agenda API met ${uniqueLinks.length}+ events per pagina`
            ));
            console.log(`[FeedAnalyzer] Umbraco agenda API found with ${uniqueLinks.length} events per page`);
          }
        }
      } catch (e) {
        console.log(`[FeedAnalyzer] Could not access Umbraco API`);
      }
    }
    
    // Also check for HTML scraper as fallback
    const agendaItems = $('.agenda__item, .agenda__list .col-12, [class*="agenda-item"]').toArray();
    if (agendaItems.length > 0) {
      alternatives.push(this.createAlternativeSource(
        origin + '/agenda/',
        'scraper',
        agendaItems.length,
        75,
        `Umbraco HTML scraper (${agendaItems.length} items zichtbaar)`
      ));
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
    
    // First, detect platform (WordPress, Drupal, Umbraco, etc.)
    await this.detectWordPress(html, origin, result, alternatives);
    await this.detectUmbraco(html, origin, result, alternatives);

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
    let maxPage = 1;
    let itemsOnFirstPage = 0;
    
    // Multiple pagination patterns to detect
    const paginationPatterns = [
      'a[href*="?page="]', 
      'a[href*="&page="]',
      '.pager a',
      '.pagination a',
      '[class*="pager"] a',
      '[class*="pagination"] a',
    ];
    
    for (const pattern of paginationPatterns) {
      $(pattern).each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        // Match page=N in URL
        const pageMatch = href.match(/page=(\d+)/);
        if (pageMatch) {
          maxPage = Math.max(maxPage, parseInt(pageMatch[1]));
        }
        // Also check for numeric text (e.g., "16" for last page)
        const numMatch = text.match(/^(\d+)$/);
        if (numMatch) {
          maxPage = Math.max(maxPage, parseInt(numMatch[1]));
        }
      });
    }
    
    // Count items on current page to estimate total
    const itemSelectors = [
      '.tiles__tile', '.tile', '.event', '.event-item', '.event-card',
      '.agenda-item', 'article.item', '.card', '[class*="event-card"]'
    ];
    for (const sel of itemSelectors) {
      const count = $(sel).length;
      if (count > itemsOnFirstPage) {
        itemsOnFirstPage = count;
      }
    }
    
    // Store pagination info for later use
    const paginationInfo = {
      maxPage,
      itemsPerPage: itemsOnFirstPage || 24,
      estimatedTotal: maxPage > 1 ? maxPage * (itemsOnFirstPage || 24) : itemsOnFirstPage
    };
    
    if (maxPage > 1) {
      result.suggestions.push(`Paginering gedetecteerd: ${maxPage} pagina's x ${paginationInfo.itemsPerPage} items = ~${paginationInfo.estimatedTotal} events`);
      console.log(`[FeedAnalyzer] Pagination detected: ${maxPage} pages, ~${paginationInfo.estimatedTotal} total events`);
    }

    // 5. Check for known sites with specialized scrapers
    const knownScrapers = [
      { pattern: 'intonijmegen', name: 'IntoNijmegen', events: 50, itemsPerPage: 24 },
      { pattern: 'uitinoss', name: 'Uit in Oss', events: 30, itemsPerPage: 20 },
      { pattern: 'uitagendabrabant', name: 'Uit Agenda Brabant', events: 100, itemsPerPage: 20 },
      { pattern: 'tilburg.com', name: 'Tilburg.com', events: 80, itemsPerPage: 20 },
      { pattern: 'trefhetinoss', name: 'Tref het in Oss', events: 40, itemsPerPage: 20 },
      { pattern: 'tijdvooramersfoort', name: 'Tijd voor Amersfoort', events: 350, itemsPerPage: 24 },
      { pattern: 'visittiel', name: 'Visit Tiel', events: 100, itemsPerPage: 20 },
      { pattern: 'visitutrecht', name: 'Visit Utrecht', events: 200, itemsPerPage: 20 },
      { pattern: 'uitagenda', name: 'UITagenda', events: 150, itemsPerPage: 24 },
    ];
    
    for (const scraper of knownScrapers) {
      if (baseUrl.includes(scraper.pattern)) {
        // Use dynamic pagination estimate if detected, otherwise use static count
        const estimatedEvents = paginationInfo.estimatedTotal > 0 
          ? paginationInfo.estimatedTotal 
          : scraper.events;
        
        const specializedSource = this.createAlternativeSource(
          baseUrl,
          'scraper',
          estimatedEvents,
          95,
          `Gespecialiseerde ${scraper.name} scraper beschikbaar (~${estimatedEvents} events met paginering over ${maxPage} pagina's)`
        );
        // Boost desirability for known scrapers (they're tested and reliable)
        specializedSource.desirabilityScore = 85;
        specializedSource.pros.push('Getest en geoptimaliseerd voor deze site');
        specializedSource.pros.push(`Automatische paginering (${maxPage} pagina's)`);
        alternatives.push(specializedSource);
        console.log(`[FeedAnalyzer] Known scraper detected: ${scraper.name} with ~${estimatedEvents} events`);
        break;
      }
    }

    // 6. Add fallback HTML scraper option with pagination support
    const hasStructuredSources = alternatives.some(a => 
      ['rss', 'atom', 'json-api', 'json-feed', 'ical', 'json-ld'].includes(a.type)
    );
    const hasSpecializedScraper = alternatives.some(a => 
      a.type === 'scraper' && a.desirabilityScore >= 80
    );
    
    if (!hasStructuredSources && !hasSpecializedScraper) {
      // Use pagination estimate for event count
      const estimatedEvents = paginationInfo.estimatedTotal > 0 
        ? paginationInfo.estimatedTotal 
        : (result.sampleItems?.length || itemsOnFirstPage || 0);
      
      const scraperSource = this.createAlternativeSource(
        baseUrl,
        'scraper',
        estimatedEvents,
        maxPage > 1 ? 60 : 40, // Higher confidence if pagination detected
        maxPage > 1 
          ? `HTML scraper met automatische paginering (~${estimatedEvents} events over ${maxPage} pagina's)`
          : 'HTML scraping als fallback optie'
      );
      
      if (maxPage > 1) {
        scraperSource.pros.push(`Automatische paginering ondersteuning (${maxPage} pagina's)`);
        scraperSource.desirabilityScore = 55; // Boost if pagination detected
      }
      
      alternatives.push(scraperSource);
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

      const response = await AiProvider.complete({
        systemPrompt: 'Je bent een expert in event feeds en RSS imports.',
        userPrompt: prompt,
        maxTokens: 500,
        temperature: 0.7,
        jsonMode: false
      });

      if (response.success && response.content) {
        result.aiRecommendation = response.content;
        console.log(`[FeedAnalyzer] AI recommendation generated`);
      }

    } catch (error: any) {
      console.error(`[FeedAnalyzer] AI recommendation error:`, error.message);
    }
  }

  private static async useAiAnalysis(
    content: any, 
    url: string, 
    result: FeedAnalysisResult
  ): Promise<void> {
    try {
      const contentSample = typeof content === 'string' 
        ? content.substring(0, 8000) 
        : JSON.stringify(content).substring(0, 8000);

      const prompt = `URL: ${url}

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

      const response = await AiProvider.complete({
        systemPrompt: 'Je bent een expert in het analyseren van event feeds en websites.',
        userPrompt: prompt,
        maxTokens: 1000,
        temperature: 0.3,
        jsonMode: true
      });

      if (!response.success || !response.content) {
        result.warnings.push(`AI analyse niet beschikbaar: ${response.error || 'geen response'}`);
        return;
      }

      const aiResult = JSON.parse(response.content);
      
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

  /**
   * Detect RSS/Atom pagination - many feeds have multiple pages
   * Common patterns:
   * - Atom: <link rel="next" href="..."/>
   * - WordPress: ?paged=2 or /page/2/
   * - Generic: ?page=2, ?offset=X, ?start=X
   */
  private static detectRssPagination(
    rawContent: string,
    parsed: any,
    itemCount: number
  ): {
    hasPagination: boolean;
    nextUrl?: string;
    estimatedPages: number;
    estimatedTotal: number;
    description: string;
  } {
    const result = {
      hasPagination: false,
      nextUrl: undefined as string | undefined,
      estimatedPages: 1,
      estimatedTotal: itemCount,
      description: ''
    };

    try {
      // 1. Check for Atom-style <link rel="next">
      const atomNextMatch = rawContent.match(/<link[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i) ||
                            rawContent.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']next["']/i);
      if (atomNextMatch) {
        result.hasPagination = true;
        result.nextUrl = atomNextMatch[1];
        result.description = 'Atom link rel="next" gevonden';
        result.estimatedPages = 5; // Conservative estimate
        result.estimatedTotal = itemCount * 5;
        return result;
      }

      // 2. Check for atom:link in RSS (WordPress style)
      const atomLinkMatch = rawContent.match(/<atom:link[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i);
      if (atomLinkMatch) {
        result.hasPagination = true;
        result.nextUrl = atomLinkMatch[1];
        result.description = 'WordPress RSS paginering gevonden';
        result.estimatedPages = 10;
        result.estimatedTotal = itemCount * 10;
        return result;
      }

      // 3. Check for opensearch totalResults (indicates more items available)
      const totalResultsMatch = rawContent.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/i) ||
                                rawContent.match(/<openSearch:totalResults>(\d+)<\/openSearch:totalResults>/i);
      if (totalResultsMatch) {
        const total = parseInt(totalResultsMatch[1]);
        if (total > itemCount) {
          result.hasPagination = true;
          result.estimatedTotal = total;
          result.estimatedPages = Math.ceil(total / itemCount);
          result.description = `OpenSearch: ${total} items totaal, ${itemCount} per pagina`;
          return result;
        }
      }

      // 4. Check if this looks like page 1 of a paginated feed (URL contains paged= or page=)
      // This is informational - the current page might be paginated
      const isPaged = rawContent.includes('?paged=') || rawContent.includes('&paged=') ||
                      rawContent.includes('?page=') || rawContent.includes('&page=') ||
                      rawContent.includes('/page/');
      
      // 5. Check for common pagination indicators in channel/feed metadata
      if (parsed.rss?.channel) {
        const channel = parsed.rss.channel;
        // Some feeds include sy:updatePeriod or similar that hint at pagination
        if (channel['sy:updateFrequency'] || channel['sy:updatePeriod']) {
          // This indicates the feed updates regularly, might have archives
          result.description = 'Feed wordt regelmatig bijgewerkt, mogelijk met archiefpaginas';
        }
      }

      // 6. Estimate based on common patterns
      // WordPress default is 10 items per page, many event feeds have 20-50
      if (itemCount >= 10 && itemCount <= 50) {
        // Likely a paginated feed with more pages
        result.estimatedPages = 3; // Conservative estimate
        result.estimatedTotal = itemCount * 3;
        result.description = `Mogelijk meer pagina's beschikbaar (${itemCount} items op deze pagina)`;
        // Don't set hasPagination unless we have proof
      }

    } catch (error: any) {
      console.log(`[FeedAnalyzer] Error detecting RSS pagination: ${error.message}`);
    }

    return result;
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

      // Check WordPress REST API - use per_page=100 with _embed for full data
      // Check ALL endpoints and choose the one with the highest event count
      const wpEndpoints = [
        { url: `${origin}/wp-json/wp/v2/posts?per_page=100&_embed`, name: 'WordPress Posts API' },
        { url: `${origin}/wp-json/wp/v2/tribe_events?per_page=100&_embed`, name: 'Tribe Events API' },
        { url: `${origin}/wp-json/tribe/events/v1/events?per_page=100`, name: 'The Events Calendar API' },
      ];

      let bestResult: MethodCheckResult | null = null;
      let highestCount = 0;

      for (const endpoint of wpEndpoints) {
        try {
          const response = await axios.get(endpoint.url, {
            headers: { 'User-Agent': this.USER_AGENT },
            timeout: 15000,
          });
          
          // Handle both array responses and object responses (Tribe Events v1 returns { events: [...] })
          let events: any[] = [];
          if (Array.isArray(response.data)) {
            events = response.data;
          } else if (response.data?.events && Array.isArray(response.data.events)) {
            events = response.data.events;
          }
          
          if (events.length > 0) {
            const sample = events[0];
            // Get total count from WordPress headers (X-WP-Total or x-wp-total)
            // Also check Tribe Events response for total field
            const totalHeader = response.headers['x-wp-total'] || response.headers['X-WP-Total'];
            let totalCount = totalHeader ? parseInt(totalHeader, 10) : events.length;
            
            // Tribe Events API returns total in response body
            if (response.data?.total && !totalHeader) {
              totalCount = parseInt(response.data.total, 10);
            }
            
            console.log(`[FeedAnalyzer] ${endpoint.name}: ${totalCount} events found`);
            
            // Keep track of the best option (highest count)
            if (totalCount > highestCount) {
              highestCount = totalCount;
              
              // Analyze content quality
              const contentQuality = ContentExtractor.analyzeContentQuality(events);
              
              bestResult = {
                viable: true,
                feedUrl: endpoint.url,
                eventCount: totalCount,
                reason: `${endpoint.name} gevonden met ${totalCount} events`,
                sampleEvent: this.formatSampleEvent(sample, 'json-api'),
                contentQuality,
              };
            }
          }
        } catch (err: any) {
          // Silently skip unavailable endpoints
        }
      }
      
      if (bestResult) {
        return bestResult;
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
            // Use fallback parsing to handle various XML issues
            const parsed = await parseXmlWithFallback(content);
            const items = parsed.rss?.channel?.item || parsed.feed?.entry || [];
            const itemArray = Array.isArray(items) ? items : [items];
            
            if (itemArray.length > 0) {
              // Detect pagination in RSS/Atom feed and count total items
              const paginationInfo = await this.detectAndCountRssPagination(feedUrl, content, parsed, itemArray.length);
              
              // Analyze feed structure with FeedFieldDetector
              const itemsWithRaw = itemArray.map((item: any) => ({ rawData: item }));
              const fieldDetection = FeedFieldDetector.analyzeItems(itemsWithRaw);
              
              // Save mapping if location data detected
              const domain = FeedFieldDetector.extractDomain(feedUrl);
              if ((fieldDetection.hasLocationData || fieldDetection.hasDateData) && Object.keys(fieldDetection.suggestedMappings).length > 0) {
                await FeedFieldDetector.saveMapping(domain, fieldDetection.suggestedMappings);
              }
              
              const totalEvents = paginationInfo.totalItems || itemArray.length;
              const paginationNote = paginationInfo.hasMore 
                ? ` (${itemArray.length} per pagina, ~${totalEvents} totaal over ${paginationInfo.estimatedPages} pagina's)`
                : '';
              
              return {
                viable: true,
                feedUrl,
                eventCount: totalEvents,
                reason: `RSS/Atom feed gevonden met ${totalEvents} items${paginationNote}`,
                sampleEvent: {
                  ...this.formatSampleEvent(itemArray[0], 'rss'),
                  paginationPages: paginationInfo.estimatedPages,
                  paginationType: paginationInfo.type,
                },
                fieldDetection: {
                  detectedFields: fieldDetection.detectedFields,
                  hasLocationData: fieldDetection.hasLocationData,
                  hasDateData: fieldDetection.hasDateData,
                  locationCompleteness: fieldDetection.locationCompleteness,
                  dateCompleteness: fieldDetection.dateCompleteness,
                  suggestedMappings: fieldDetection.suggestedMappings,
                },
              };
            }
          }
        } catch {}
      }
    } catch {}
    return { viable: false, reason: 'Geen RSS/Atom feed gevonden' };
  }

  private static async detectAndCountRssPagination(
    feedUrl: string, 
    rawContent: string, 
    parsed: any, 
    itemsOnFirstPage: number
  ): Promise<{ hasMore: boolean; totalItems: number; estimatedPages: number; type?: string }> {
    try {
      // Check OpenSearch metadata (totalResults, itemsPerPage)
      const channel = parsed.rss?.channel || parsed.feed || {};
      const openSearchTotal = parseInt(
        channel['opensearch:totalResults'] || 
        channel['openSearch:totalResults'] || 
        channel['totalResults'] || '0'
      );
      const openSearchPerPage = parseInt(
        channel['opensearch:itemsPerPage'] || 
        channel['openSearch:itemsPerPage'] || 
        channel['itemsPerPage'] || '0'
      );
      
      if (openSearchTotal > itemsOnFirstPage) {
        const pages = openSearchPerPage > 0 
          ? Math.ceil(openSearchTotal / openSearchPerPage) 
          : Math.ceil(openSearchTotal / itemsOnFirstPage);
        return { hasMore: true, totalItems: openSearchTotal, estimatedPages: pages, type: 'opensearch' };
      }
      
      // Check Atom link rel="next"
      const atomLinks = parsed.feed?.link || [];
      const atomLinksArray = Array.isArray(atomLinks) ? atomLinks : [atomLinks];
      const nextLink = atomLinksArray.find((l: any) => 
        l?.$ && l.$.rel === 'next' || l?.['@_rel'] === 'next'
      );
      if (nextLink) {
        // Follow pagination to count total
        const totalCount = await this.countRssPaginatedItems(feedUrl, itemsOnFirstPage, 'atom-link');
        return { 
          hasMore: true, 
          totalItems: totalCount.total, 
          estimatedPages: totalCount.pages, 
          type: 'atom-link' 
        };
      }
      
      // Check raw XML for link rel="next" (may not parse correctly)
      if (rawContent.includes('rel="next"') || rawContent.includes("rel='next'")) {
        const nextMatch = rawContent.match(/rel=["']next["'][^>]*href=["']([^"']+)["']/i) ||
                          rawContent.match(/href=["']([^"']+)["'][^>]*rel=["']next["']/i);
        if (nextMatch) {
          const totalCount = await this.countRssPaginatedItems(feedUrl, itemsOnFirstPage, 'atom-link');
          return { 
            hasMore: true, 
            totalItems: totalCount.total, 
            estimatedPages: totalCount.pages, 
            type: 'atom-link' 
          };
        }
      }
      
      // Check WordPress paged parameter (try page 2)
      const wpPagedUrl = feedUrl.includes('?') 
        ? `${feedUrl}&paged=2` 
        : `${feedUrl}?paged=2`;
      
      try {
        const page2Response = await axios.get(wpPagedUrl, {
          headers: { 
            'User-Agent': this.USER_AGENT,
            'Accept': 'application/rss+xml, application/atom+xml, application/xml'
          },
          timeout: 8000,
        });
        
        if (typeof page2Response.data === 'string' && 
            (page2Response.data.includes('<item>') || page2Response.data.includes('<entry>'))) {
          const parsed2 = await parseXmlWithFallback(page2Response.data);
          const items2 = parsed2.rss?.channel?.item || parsed2.feed?.entry || [];
          const items2Array = Array.isArray(items2) ? items2 : [items2];
          
          if (items2Array.length > 0) {
            // WordPress pagination works, count all pages
            const totalCount = await this.countRssPaginatedItems(feedUrl, itemsOnFirstPage, 'wordpress');
            return { 
              hasMore: true, 
              totalItems: totalCount.total, 
              estimatedPages: totalCount.pages, 
              type: 'wordpress' 
            };
          }
        }
      } catch {}
      
    } catch (error: any) {
      console.log(`[FeedAnalyzer] RSS pagination detection error: ${error.message}`);
    }
    
    return { hasMore: false, totalItems: itemsOnFirstPage, estimatedPages: 1 };
  }

  private static async countRssPaginatedItems(
    feedUrl: string, 
    itemsOnFirstPage: number, 
    type: 'wordpress' | 'atom-link'
  ): Promise<{ total: number; pages: number }> {
    let totalItems = itemsOnFirstPage;
    let currentPage = 2;
    const maxPages = 10; // Safety limit
    
    while (currentPage <= maxPages) {
      try {
        let pageUrl: string;
        if (type === 'wordpress') {
          pageUrl = feedUrl.includes('?') 
            ? `${feedUrl}&paged=${currentPage}` 
            : `${feedUrl}?paged=${currentPage}`;
        } else {
          // For atom-link, we'd need to follow the next links - simplified estimation
          break;
        }
        
        const response = await axios.get(pageUrl, {
          headers: { 
            'User-Agent': this.USER_AGENT,
            'Accept': 'application/rss+xml, application/atom+xml, application/xml'
          },
          timeout: 5000,
        });
        
        if (typeof response.data === 'string') {
          const parsed = await parseXmlWithFallback(response.data);
          const items = parsed.rss?.channel?.item || parsed.feed?.entry || [];
          const itemArray = Array.isArray(items) ? items : [items];
          
          if (itemArray.length === 0) {
            break; // No more items
          }
          
          totalItems += itemArray.length;
          currentPage++;
        } else {
          break;
        }
      } catch {
        break; // Stop on error
      }
    }
    
    return { total: totalItems, pages: currentPage - 1 };
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
      let html: string;
      let usedPuppeteer = false;
      
      // First try with regular HTTP request
      const response = await axios.get(baseUrl, {
        headers: { 
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html'
        },
        timeout: 15000,
      });
      
      html = response.data;
      
      // Check if page needs JavaScript rendering
      if (typeof html === 'string' && detectJsRenderingNeeded(html)) {
        console.log(`[FeedAnalyzer] Page requires JavaScript rendering, using Puppeteer for ${baseUrl}`);
        try {
          const puppeteerResult = await fetchRenderedHtml(baseUrl);
          if (puppeteerResult.success && puppeteerResult.html) {
            html = puppeteerResult.html;
            usedPuppeteer = true;
            console.log(`[FeedAnalyzer] Puppeteer rendered HTML successfully`);
          }
        } catch (puppeteerError: any) {
          console.log(`[FeedAnalyzer] Puppeteer fallback failed: ${puppeteerError.message}`);
        }
      }

      if (typeof html === 'string') {
        const $ = cheerio.load(html);
        
        const eventSelectors = [
          // Standard event classes
          '.tiles__tile',
          'a.link-overlay',
          'article.event', '.event-item', '.event-card',
          '.agenda-item', '.calendar-event', '.uitagenda-item',
          'a[href*="/uitagenda/"]', 'a[href*="/evenementen/"]',
          '[class*="event"]', '[data-event]',
          // Bommelerwaard.net / Laravel/PHP agenda patterns
          'a[href*="/agenda/"][href*="/"]',
          '.agenda a[href*="/agenda/"]',
          '[class*="agenda"] a',
          // Common Dutch agenda patterns
          'a[href*="/activiteiten/"]',
          'a[href*="/activiteit/"]',
          '.activiteit', '.activity-item',
          // Card-based layouts (common in modern websites)
          '.card a[href*="/agenda"]',
          '.card a[href*="/event"]',
          '[class*="card"][class*="event"]',
          // Grid/list layouts
          '.grid-item a[href*="/"]',
          '.list-item a[href*="/"]',
          // WordPress event plugins
          '.tribe-events-calendar-list__event',
          '.eventlist-event',
          '.events-list-item',
          // General patterns
          '[itemtype*="Event"]',
          '[typeof="Event"]',
        ];

        let maxPage = 1;
        const paginationPatterns = [
          'a[href*="?page="]', 
          'a[href*="&page="]',
          'a[href*="page_"]',
          '.pager a',
          '.pagination a',
          '[class*="pager"] a',
          'a.page-numbers',
        ];
        
        for (const pattern of paginationPatterns) {
          $(pattern).each((_, el) => {
            const href = $(el).attr('href') || '';
            const text = $(el).text().trim();
            const pageMatch = href.match(/page[_=]?(\d+)/);
            if (pageMatch) {
              maxPage = Math.max(maxPage, parseInt(pageMatch[1]));
            }
            const numMatch = text.match(/^(\d+)$/);
            if (numMatch) {
              maxPage = Math.max(maxPage, parseInt(numMatch[1]));
            }
          });
        }

        for (const selector of eventSelectors) {
          const elements = $(selector);
          if (elements.length >= 3) {
            const firstEl = elements.first();
            const itemsOnPage = elements.length;
            const estimatedTotal = maxPage > 1 ? maxPage * itemsOnPage : itemsOnPage;
            const paginationNote = maxPage > 1 ? ` (~${estimatedTotal} events over ${maxPage} pagina's)` : '';
            const puppeteerNote = usedPuppeteer ? ' (via JavaScript rendering)' : '';
            
            return {
              viable: true,
              feedUrl: baseUrl,
              eventCount: estimatedTotal,
              reason: `HTML pagina met ${itemsOnPage} event elementen per pagina${paginationNote}${puppeteerNote}`,
              sampleEvent: {
                selector,
                title: firstEl.find('h1, h2, h3, .title, .description__headtext').first().text().trim() || 'Event gevonden',
                note: maxPage > 1 ? `Scraper met automatische paginering (${maxPage} pagina's)` : 'Scraper configuratie vereist',
                paginationPages: maxPage,
                requiresJsRendering: usedPuppeteer,
              },
            };
          }
        }

        console.log(`[FeedAnalyzer] No standard patterns found, trying AI analysis for ${baseUrl}`);
        const aiResult = await AiHtmlAnalyzer.analyzeAndExtract(baseUrl, html);
        
        if (aiResult.success && aiResult.eventCount >= 3) {
          const paginationNote = aiResult.pagination?.maxPages && aiResult.pagination.maxPages > 1
            ? ` (~${aiResult.eventCount * aiResult.pagination.maxPages} events over ${aiResult.pagination.maxPages} pagina's)`
            : '';
          const puppeteerNote = usedPuppeteer ? ' (via JavaScript rendering)' : '';
          
          return {
            viable: true,
            feedUrl: baseUrl,
            eventCount: aiResult.pagination?.maxPages 
              ? aiResult.eventCount * aiResult.pagination.maxPages 
              : aiResult.eventCount,
            reason: `AI-geanalyseerde HTML structuur met ${aiResult.eventCount} events${paginationNote}${puppeteerNote} (${aiResult.confidence}% zekerheid)`,
            sampleEvent: {
              selector: aiResult.selectors?.eventCard || 'AI-detected',
              title: aiResult.sampleEvents[0]?.title || 'Event gevonden via AI',
              date: aiResult.sampleEvents[0]?.date,
              link: aiResult.sampleEvents[0]?.link,
              image: aiResult.sampleEvents[0]?.image,
              note: `AI-analyse: ${aiResult.reasoning || 'Automatisch gedetecteerd'}`,
              paginationPages: aiResult.pagination?.maxPages || 1,
              aiSelectors: aiResult.selectors,
              aiPagination: aiResult.pagination,
              requiresJsRendering: usedPuppeteer,
            },
          };
        }
        
        if (aiResult.error) {
          console.log(`[FeedAnalyzer] AI analysis failed: ${aiResult.error}`);
        }
      }
    } catch (error: any) {
      console.error(`[FeedAnalyzer] HTML scraper check error:`, error.message);
    }
    return { viable: false, reason: 'Geen scrapbare event structuur gevonden (ook niet via AI)' };
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

  /**
   * Discover all available fields in a feed with sample values
   * This allows users to manually map fields to event properties
   */
  static async discoverFields(url: string): Promise<FeedDiscoveryResult> {
    console.log(`[FeedAnalyzer] Discovering fields for: ${url}`);
    
    const result: FeedDiscoveryResult = {
      url,
      feedType: 'unknown',
      totalItems: 0,
      discoveredFields: [],
      sampleItems: [],
      previewEvent: null,
      errors: [],
    };

    try {
      const response = await axios.get(url, {
        headers: { 
          "User-Agent": this.USER_AGENT,
          "Accept": "application/rss+xml, application/atom+xml, application/xml, application/json, */*"
        },
        timeout: 30000,
        maxContentLength: 5 * 1024 * 1024,
      });

      const contentType = response.headers['content-type'] || '';
      const content = response.data;

      // Determine feed type and extract items
      let items: any[] = [];
      
      if (contentType.includes('json') || (typeof content === 'object' && !contentType.includes('xml'))) {
        result.feedType = 'json';
        items = this.extractJsonItems(content);
      } else if (typeof content === 'string') {
        const parsed = await parseXmlWithFallback(content);
        
        if (parsed.rss?.channel?.item) {
          result.feedType = 'rss';
          items = Array.isArray(parsed.rss.channel.item) 
            ? parsed.rss.channel.item 
            : [parsed.rss.channel.item];
        } else if (parsed.feed?.entry) {
          result.feedType = 'atom';
          items = Array.isArray(parsed.feed.entry) 
            ? parsed.feed.entry 
            : [parsed.feed.entry];
        }
      }

      if (items.length === 0) {
        result.errors.push('Geen items gevonden in de feed');
        return result;
      }

      result.totalItems = items.length;
      result.sampleItems = items.slice(0, 3);

      // Discover all fields recursively from first few items
      const fieldMap = new Map<string, DiscoveredField>();
      
      for (let i = 0; i < Math.min(items.length, 5); i++) {
        this.discoverFieldsRecursive(items[i], '', fieldMap, i, Math.min(items.length, 5));
      }

      // Convert to array and sort by path
      result.discoveredFields = Array.from(fieldMap.values())
        .filter(f => f.type !== 'object' || f.path.split('.').length <= 2) // Only show shallow objects
        .sort((a, b) => a.path.localeCompare(b.path));

      // Add suggested mappings based on field names
      for (const field of result.discoveredFields) {
        field.suggestedMapping = this.guessMappingForField(field.path, field.sampleValue);
      }

      // Generate preview event using auto-detected mappings
      result.previewEvent = this.generatePreviewFromFields(result.discoveredFields, items[0]);

      console.log(`[FeedAnalyzer] Discovered ${result.discoveredFields.length} fields from ${result.totalItems} items`);

    } catch (error: any) {
      console.error(`[FeedAnalyzer] Discovery error:`, error.message);
      result.errors.push(`Fout bij ophalen feed: ${error.message}`);
    }

    return result;
  }

  private static extractJsonItems(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data.items && Array.isArray(data.items)) return data.items;
    if (data.events && Array.isArray(data.events)) return data.events;
    if (data.data && Array.isArray(data.data)) return data.data;
    if (data.results && Array.isArray(data.results)) return data.results;
    if (data.entries && Array.isArray(data.entries)) return data.entries;
    if (data.posts && Array.isArray(data.posts)) return data.posts;
    return [];
  }

  private static discoverFieldsRecursive(
    obj: any,
    prefix: string,
    fieldMap: Map<string, DiscoveredField>,
    itemIndex: number,
    totalItems: number
  ): void {
    if (obj === null || obj === undefined) return;
    
    if (typeof obj !== 'object') {
      // Leaf value - update field info
      const path = prefix || 'value';
      const existing = fieldMap.get(path);
      
      if (existing) {
        existing.occurrenceCount++;
        if (existing.allSamples.length < 3) {
          existing.allSamples.push(obj);
        }
      } else {
        fieldMap.set(path, {
          path,
          type: this.detectFieldType(obj),
          sampleValue: obj,
          allSamples: [obj],
          occurrenceCount: 1,
        });
      }
      return;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      const path = prefix || 'items';
      fieldMap.set(path, {
        path,
        type: 'array',
        sampleValue: `Array[${obj.length}]`,
        allSamples: [obj.slice(0, 2)],
        occurrenceCount: 1,
      });
      
      // Only recurse into first array item if it's an object
      if (obj.length > 0 && typeof obj[0] === 'object') {
        this.discoverFieldsRecursive(obj[0], `${prefix}[0]`, fieldMap, itemIndex, totalItems);
      }
      return;
    }

    // Handle objects
    const keys = Object.keys(obj);
    for (const key of keys) {
      // Skip XML internal keys
      if (key === '$' || key === '_') continue;
      
      const newPath = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      // For XML with attributes, extract the text value
      if (typeof value === 'object' && value !== null && value._ !== undefined) {
        // This is an XML element with attributes - use the text value
        this.discoverFieldsRecursive(value._, newPath, fieldMap, itemIndex, totalItems);
      } else {
        this.discoverFieldsRecursive(value, newPath, fieldMap, itemIndex, totalItems);
      }
    }
  }

  private static detectFieldType(value: any): DiscoveredField['type'] {
    if (typeof value === 'string') {
      // Check if it's a date
      if (this.looksLikeDate(value)) return 'date';
      return 'string';
    }
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }

  private static looksLikeDate(value: string): boolean {
    // Common date patterns
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/,           // ISO date
      /^\d{2}[\/\-]\d{2}[\/\-]\d{4}/, // DD/MM/YYYY or MM/DD/YYYY
      /^[A-Za-z]{3},?\s+\d{1,2}/,     // Mon, 15 or Mon 15
      /^\d{1,2}\s+[A-Za-z]+\s+\d{4}/, // 15 January 2025
    ];
    return datePatterns.some(p => p.test(value.trim()));
  }

  private static guessMappingForField(path: string, sampleValue: any): string | undefined {
    const lowerPath = path.toLowerCase();
    const sampleStr = String(sampleValue || '').toLowerCase();
    
    // Title detection
    if (lowerPath.includes('title') || lowerPath.includes('name') || lowerPath.includes('titel')) {
      return 'title';
    }
    
    // Description detection
    if (lowerPath.includes('description') || lowerPath.includes('content') || 
        lowerPath.includes('summary') || lowerPath.includes('body') ||
        lowerPath.includes('excerpt') || lowerPath.includes('text')) {
      return 'description';
    }
    
    // Date detection
    if (lowerPath.includes('date') || lowerPath.includes('time') || 
        lowerPath.includes('start') || lowerPath.includes('datum') ||
        lowerPath.includes('pubdate') || lowerPath.includes('published') ||
        lowerPath.includes('created') || lowerPath.includes('updated')) {
      if (lowerPath.includes('end') || lowerPath.includes('eind')) {
        return 'endTime';
      }
      return 'startTime';
    }
    
    // Location detection
    if (lowerPath.includes('location') || lowerPath.includes('venue') || 
        lowerPath.includes('address') || lowerPath.includes('locatie') ||
        lowerPath.includes('plaats') || lowerPath.includes('adres')) {
      return 'location';
    }
    
    // Image detection
    if (lowerPath.includes('image') || lowerPath.includes('img') || 
        lowerPath.includes('photo') || lowerPath.includes('thumbnail') ||
        lowerPath.includes('media') || lowerPath.includes('picture') ||
        lowerPath.includes('afbeelding')) {
      return 'image';
    }
    
    // Link detection
    if (lowerPath.includes('link') || lowerPath.includes('url') || 
        lowerPath.includes('href') || lowerPath.includes('permalink')) {
      return 'link';
    }
    
    // Category detection
    if (lowerPath.includes('category') || lowerPath.includes('categorie') ||
        lowerPath.includes('type') || lowerPath.includes('genre')) {
      return 'category';
    }
    
    return undefined;
  }

  private static generatePreviewFromFields(
    fields: DiscoveredField[],
    sampleItem: any
  ): FeedDiscoveryResult['previewEvent'] {
    const preview: FeedDiscoveryResult['previewEvent'] = {};
    
    for (const field of fields) {
      if (!field.suggestedMapping) continue;
      
      const value = this.getValueByPath(sampleItem, field.path);
      if (value === undefined || value === null) continue;
      
      switch (field.suggestedMapping) {
        case 'title':
          preview.title = String(value).substring(0, 100);
          break;
        case 'description':
          preview.description = String(value).replace(/<[^>]*>/g, '').substring(0, 300);
          break;
        case 'startTime':
          preview.startTime = String(value);
          break;
        case 'endTime':
          preview.endTime = String(value);
          break;
        case 'location':
          preview.location = String(value);
          break;
        case 'image':
          if (typeof value === 'string' && value.startsWith('http')) {
            preview.image = value;
          } else if (value?.url) {
            preview.image = value.url;
          }
          break;
        case 'link':
          if (typeof value === 'string' && value.startsWith('http')) {
            preview.link = value;
          } else if (value?.href) {
            preview.link = value.href;
          }
          break;
      }
    }
    
    return Object.keys(preview).length > 0 ? preview : null;
  }

  private static getValueByPath(obj: any, path: string): any {
    const parts = path.split('.').flatMap(p => {
      // Handle array notation like items[0]
      const match = p.match(/^(.+)\[(\d+)\]$/);
      if (match) return [match[1], parseInt(match[2])];
      return [p];
    });
    
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    
    // Handle XML text nodes
    if (current && typeof current === 'object' && current._ !== undefined) {
      return current._;
    }
    
    return current;
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

export interface FieldDetectionInfo {
  detectedFields: Array<{
    fieldPath: string;
    fieldType: string;
    confidence: number;
    sampleValue: any;
    detectionReason: string;
  }>;
  hasLocationData: boolean;
  hasDateData: boolean;
  locationCompleteness: number;
  dateCompleteness: number;
  suggestedMappings: Record<string, string>;
}

export interface MethodCheckResult {
  viable: boolean;
  feedUrl?: string;
  eventCount?: number;
  reason: string;
  sampleEvent?: SampleEventData;
  contentQuality?: ContentQualityInfo;
  fieldDetection?: FieldDetectionInfo;
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

// Feed Field Discovery - toont alle beschikbare velden met sample waarden
export interface DiscoveredField {
  path: string;           // Volledige pad naar het veld (bijv. "item.title" of "events[0].location.address")
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'unknown';
  sampleValue: any;       // Voorbeeld waarde uit eerste item
  allSamples: any[];      // Waarden uit eerste 3 items
  occurrenceCount: number; // In hoeveel items dit veld voorkomt
  suggestedMapping?: string; // Wat we denken dat dit veld is (title, date, location, etc.)
}

export interface FeedDiscoveryResult {
  url: string;
  feedType: 'rss' | 'atom' | 'json' | 'unknown';
  totalItems: number;
  discoveredFields: DiscoveredField[];
  sampleItems: any[];     // Eerste 3 complete items
  previewEvent: {
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    image?: string;
    link?: string;
  } | null;
  errors: string[];
}
