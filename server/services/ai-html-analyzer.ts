import * as cheerio from "cheerio";
import axios from "axios";
import { db } from "../db";
import { aiExtractionProfiles } from "@shared/schema";
import { eq } from "drizzle-orm";
import { fetchRenderedHtml, detectJsRenderingNeeded } from "./puppeteer-fetcher";
import { AiProvider } from "./ai-provider";

export interface AiExtractionSelectors {
  eventCard: string;
  title?: string;
  date?: string;
  time?: string;
  category?: string;
  image?: string;
  link?: string;
  description?: string;
  location?: string;
  venue?: string;
  address?: string;
}

export interface AiPaginationInfo {
  type: 'query' | 'path' | 'loadmore' | 'none';
  paramName?: string;
  maxPages?: number;
  itemsPerPage?: number;
}

export interface AiAnalysisResult {
  success: boolean;
  selectors?: AiExtractionSelectors;
  pagination?: AiPaginationInfo;
  confidence: number;
  eventCount: number;
  sampleEvents: Array<{
    title?: string;
    date?: string;
    link?: string;
    image?: string;
    category?: string;
    venue?: string;
    address?: string;
  }>;
  reasoning?: string;
  error?: string;
  requiresJsRendering?: boolean;
}

export interface AiDetailSelectors {
  title?: string;
  date?: string;
  time?: string;
  description?: string;
  image?: string;
  location?: string;
  venue?: string;
  address?: string;
  category?: string;
  price?: string;
}

export interface AiScraperAnalysisResult {
  success: boolean;
  overviewSelectors?: AiExtractionSelectors;
  detailSelectors?: AiDetailSelectors;
  hasJsonLd: boolean;
  pagination?: AiPaginationInfo;
  sampleEvents: Array<{
    title?: string;
    date?: string;
    time?: string;
    link?: string;
    image?: string;
    location?: string;
    venue?: string;
    address?: string;
    description?: string;
    category?: string;
    price?: string;
  }>;
  confidence: number;
  reasoning: string;
  requiresJsRendering: boolean;
  suggestedFeedConfig?: {
    feedType: string;
    scraperConfig: Record<string, any>;
    fieldMappings: Record<string, string>;
  };
  error?: string;
  steps: Array<{
    name: string;
    status: 'success' | 'failed' | 'skipped';
    message: string;
  }>;
}

export class AiHtmlAnalyzer {
  private static readonly MAX_HTML_TOKENS = 4000;
  private static readonly PROMPT_VERSION = "v1.0";
  private static readonly USER_AGENT = "letsgo-radar/1.0 (+https://letsgo-radar.nl)";

  static async analyzeAndExtract(url: string, html: string): Promise<AiAnalysisResult> {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      let workingHtml = html;
      let usedJsRendering = false;
      
      const cachedProfile = await this.getCachedProfile(domain);
      if (cachedProfile && cachedProfile.confidence >= 70) {
        console.log(`[AI Analyzer] Using cached profile for ${domain} (confidence: ${cachedProfile.confidence}%, jsRendering: ${cachedProfile.requiresJsRendering})`);
        
        if (cachedProfile.requiresJsRendering) {
          console.log(`[AI Analyzer] Profile requires JS rendering, fetching with Puppeteer...`);
          const puppeteerResult = await fetchRenderedHtml(url, { waitForNetworkIdle: true });
          if (puppeteerResult.success && puppeteerResult.html) {
            workingHtml = puppeteerResult.html;
            usedJsRendering = true;
          }
        }
        
        const result = await this.extractWithSelectors(workingHtml, cachedProfile.selectors as AiExtractionSelectors);
        if (result.eventCount >= 3) {
          return {
            success: true,
            selectors: cachedProfile.selectors as AiExtractionSelectors,
            pagination: cachedProfile.pagination as AiPaginationInfo | undefined,
            confidence: cachedProfile.confidence,
            eventCount: result.eventCount,
            sampleEvents: result.sampleEvents,
            reasoning: "Gebruikt gecachte AI-analyse",
            requiresJsRendering: cachedProfile.requiresJsRendering ?? false,
          };
        }
      }

      console.log(`[AI Analyzer] Running AI analysis for ${domain}`);
      let simplifiedHtml = this.simplifyHtml(workingHtml);
      let candidateCards = this.findCandidateCards(workingHtml);
      
      if (candidateCards.length === 0 && !usedJsRendering) {
        console.log(`[AI Analyzer] No cards found in static HTML, checking if JS rendering needed...`);
        if (detectJsRenderingNeeded(html)) {
          console.log(`[AI Analyzer] JS rendering detected as needed, fetching with Puppeteer...`);
          const puppeteerResult = await fetchRenderedHtml(url, { waitForNetworkIdle: true });
          if (puppeteerResult.success && puppeteerResult.html) {
            workingHtml = puppeteerResult.html;
            usedJsRendering = true;
            simplifiedHtml = this.simplifyHtml(workingHtml);
            candidateCards = this.findCandidateCards(workingHtml);
          }
        }
      }
      
      if (candidateCards.length === 0) {
        return {
          success: false,
          confidence: 0,
          eventCount: 0,
          sampleEvents: [],
          error: "Geen herhalende kaart-structuren gevonden op de pagina",
        };
      }

      const aiResult = await this.callAiForSelectors(url, simplifiedHtml, candidateCards);
      
      if (!aiResult.success || !aiResult.selectors) {
        return aiResult;
      }

      const validationResult = await this.extractWithSelectors(workingHtml, aiResult.selectors);
      
      if (validationResult.eventCount < 3) {
        return {
          success: false,
          selectors: aiResult.selectors,
          confidence: 20,
          eventCount: validationResult.eventCount,
          sampleEvents: validationResult.sampleEvents,
          error: `AI selectors vonden slechts ${validationResult.eventCount} events (minimaal 3 nodig)`,
        };
      }

      let paginationInfo = this.detectPagination(workingHtml, url);

      if (paginationInfo.type === 'none' && !usedJsRendering) {
        console.log(`[AI Analyzer] No pagination found in static HTML, trying Puppeteer...`);
        const puppeteerResult = await fetchRenderedHtml(url, { waitForNetworkIdle: true });
        
        if (puppeteerResult.success && puppeteerResult.html) {
          const jsPaginationInfo = this.detectPagination(puppeteerResult.html, url);
          if (jsPaginationInfo.type !== 'none') {
            console.log(`[AI Analyzer] Found pagination via Puppeteer: ${jsPaginationInfo.type} (${jsPaginationInfo.paramName})`);
            paginationInfo = jsPaginationInfo;
            usedJsRendering = true;
          }
        }
      }

      await this.saveProfile(domain, aiResult.selectors, paginationInfo, validationResult.eventCount, usedJsRendering);

      return {
        success: true,
        selectors: aiResult.selectors,
        pagination: paginationInfo,
        confidence: aiResult.confidence,
        eventCount: validationResult.eventCount,
        sampleEvents: validationResult.sampleEvents,
        reasoning: aiResult.reasoning,
        requiresJsRendering: usedJsRendering,
      };
    } catch (error: any) {
      console.error('[AI Analyzer] Error:', error);
      return {
        success: false,
        confidence: 0,
        eventCount: 0,
        sampleEvents: [],
        error: error.message,
      };
    }
  }

  private static simplifyHtml(html: string): string {
    const $ = cheerio.load(html);
    
    $('script, style, noscript, iframe, svg, path, meta, link[rel="stylesheet"]').remove();
    $('[style]').removeAttr('style');
    $('header, footer, nav, aside').remove();
    $('[class*="cookie"], [class*="popup"], [class*="modal"], [id*="cookie"]').remove();
    $('[class*="menu"], [class*="nav-"], [class*="header"], [class*="footer"]').remove();
    
    $('*').each((_, el) => {
      const $el = $(el);
      const attrs = (el as any).attribs || {};
      for (const attr of Object.keys(attrs)) {
        if (!['class', 'id', 'href', 'src', 'alt', 'datetime', 'data-date', 'data-time'].includes(attr)) {
          $el.removeAttr(attr);
        }
      }
    });

    let simplified = $.html();
    simplified = simplified.replace(/\s+/g, ' ');
    simplified = simplified.replace(/>\s+</g, '><');
    
    if (simplified.length > this.MAX_HTML_TOKENS * 4) {
      const mainContent = $('main, [role="main"], .content, #content, article').first();
      if (mainContent.length) {
        simplified = mainContent.html() || simplified.substring(0, this.MAX_HTML_TOKENS * 4);
      } else {
        simplified = simplified.substring(0, this.MAX_HTML_TOKENS * 4);
      }
    }
    
    return simplified;
  }

  private static findCandidateCards(html: string): Array<{ selector: string; count: number; sample: string }> {
    const $ = cheerio.load(html);
    const candidates: Array<{ selector: string; count: number; sample: string }> = [];

    const cardPatterns = [
      'li:has(a):has(img)',
      'article',
      'div:has(> a):has(img)',
      '[class*="item"]:has(a)',
      '[class*="card"]:has(a)',
      '[class*="tile"]:has(a)',
      '[class*="event"]:has(a)',
      'a:has(img):has(h1, h2, h3, h4)',
      'a[href*="/event"], a[href*="/agenda"], a[href*="/uitagenda"], a[href*="/activiteit"]',
    ];

    for (const pattern of cardPatterns) {
      try {
        const elements = $(pattern);
        if (elements.length >= 3) {
          const sample = elements.first().html()?.substring(0, 500) || '';
          candidates.push({
            selector: pattern,
            count: elements.length,
            sample,
          });
        }
      } catch {}
    }

    candidates.sort((a, b) => b.count - a.count);
    return candidates.slice(0, 5);
  }

  private static async callAiForSelectors(
    url: string,
    simplifiedHtml: string,
    candidates: Array<{ selector: string; count: number; sample: string }>
  ): Promise<AiAnalysisResult> {
    const candidateInfo = candidates.map(c => 
      `- Selector: "${c.selector}" (${c.count} items)\n  Sample: ${c.sample.substring(0, 200)}...`
    ).join('\n\n');

    const prompt = `Analyseer deze Nederlandse evenementen-pagina en bepaal de CSS selectors om events te extraheren.

URL: ${url}

Gevonden kandidaat-patronen:
${candidateInfo}

HTML fragment (vereenvoudigd):
${simplifiedHtml.substring(0, 3000)}

Bepaal de beste CSS selectors voor:
1. eventCard: De hoofd-selector voor elk event kaartje
2. title: Relatieve selector binnen de kaart voor de titel (bijv. "h2", ".title")
3. date: Relatieve selector voor de datum
4. link: Relatieve selector voor de link (of "self" als de kaart zelf een link is)
5. image: Relatieve selector voor de afbeelding
6. category: Relatieve selector voor de categorie (optioneel)
7. venue: Relatieve selector voor de locatie/venue naam (bijv. ".location", ".venue", "[class*='locatie']")
8. address: Relatieve selector voor het adres (bijv. ".address", ".adres", "[class*='address']")

BELANGRIJK: venue en address zijn cruciaal! Zoek ook naar:
- Locatie-iconen gevolgd door tekst
- Elementen met 'locatie', 'location', 'venue', 'adres', 'waar' in class/id
- Adres patronen (straatnaam + nummer, postcode)

Antwoord in JSON formaat:
{
  "success": true/false,
  "selectors": {
    "eventCard": "...",
    "title": "...",
    "date": "...",
    "link": "...",
    "image": "...",
    "category": "...",
    "venue": "...",
    "address": "..."
  },
  "confidence": 0-100,
  "reasoning": "Korte uitleg van de gekozen strategie"
}`;

    try {
      const result = await AiProvider.complete({
        systemPrompt: "Je bent een expert in web scraping en CSS selectors. Analyseer HTML structuren en bepaal de beste selectors om event data te extraheren. Wees specifiek en gebruik relatieve selectors waar mogelijk. Antwoord alleen in JSON.",
        userPrompt: prompt,
        maxTokens: 1000,
        temperature: 0.1,
        jsonMode: true,
      });

      if (!result.success || !result.content) {
        throw new Error(result.error || "Geen response van AI");
      }

      console.log(`[AI Analyzer] Using ${result.provider} for selector analysis`);
      const parsed = JSON.parse(result.content);
      
      return {
        success: parsed.success === true,
        selectors: parsed.selectors,
        confidence: parsed.confidence || 0,
        eventCount: 0,
        sampleEvents: [],
        reasoning: parsed.reasoning,
      };
    } catch (error: any) {
      console.error('[AI Analyzer] AI error:', error);
      return {
        success: false,
        confidence: 0,
        eventCount: 0,
        sampleEvents: [],
        error: `AI analyse mislukt: ${error.message}`,
      };
    }
  }

  private static async extractWithSelectors(
    html: string,
    selectors: AiExtractionSelectors
  ): Promise<{ eventCount: number; sampleEvents: Array<any> }> {
    const $ = cheerio.load(html);
    const sampleEvents: Array<any> = [];
    
    const cards = $(selectors.eventCard);
    
    cards.slice(0, 5).each((_, card) => {
      const $card = $(card);
      const event: any = {};

      if (selectors.title) {
        event.title = $card.find(selectors.title).first().text().trim();
      }
      if (!event.title && $card.is('a')) {
        event.title = $card.find('h1, h2, h3, h4').first().text().trim();
      }

      if (selectors.date) {
        event.date = $card.find(selectors.date).first().text().trim();
      }

      if (selectors.link === 'self' && $card.is('a')) {
        event.link = $card.attr('href');
      } else if (selectors.link) {
        event.link = $card.find(selectors.link).first().attr('href');
      }
      if (!event.link) {
        event.link = $card.find('a').first().attr('href');
      }

      if (selectors.image) {
        event.image = $card.find(selectors.image).first().attr('src');
      }
      if (!event.image) {
        event.image = $card.find('img').first().attr('src');
      }

      if (selectors.category) {
        event.category = $card.find(selectors.category).first().text().trim();
      }

      if (selectors.venue) {
        event.venue = $card.find(selectors.venue).first().text().trim();
      }
      if (!event.venue) {
        const venueEl = $card.find('[class*="locatie"], [class*="location"], [class*="venue"], [class*="waar"]').first();
        if (venueEl.length) {
          event.venue = venueEl.text().trim();
        }
      }

      if (selectors.address) {
        event.address = $card.find(selectors.address).first().text().trim();
      }
      if (!event.address) {
        const addressEl = $card.find('[class*="adres"], [class*="address"]').first();
        if (addressEl.length) {
          event.address = addressEl.text().trim();
        }
      }

      if (event.title || event.link) {
        sampleEvents.push(event);
      }
    });

    return {
      eventCount: cards.length,
      sampleEvents,
    };
  }

  private static detectPagination(html: string, baseUrl: string): AiPaginationInfo {
    const $ = cheerio.load(html);
    
    let maxPage = 1;
    let paramName = 'page';
    
    const paginationLinks = $('a[href*="page"], .pagination a, .pager a, [class*="pager"] a');
    paginationLinks.each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      
      const queryMatch = href.match(/[?&](page[_\d]*|pagina)=(\d+)/);
      if (queryMatch) {
        paramName = queryMatch[1];
        maxPage = Math.max(maxPage, parseInt(queryMatch[2]));
      }
      
      const numMatch = text.match(/^(\d+)$/);
      if (numMatch) {
        maxPage = Math.max(maxPage, parseInt(numMatch[1]));
        if (!paramName.includes('_') && href.includes('page_')) {
          const paramMatch = href.match(/(page_\d+)=/);
          if (paramMatch) paramName = paramMatch[1];
        }
      }
    });
    
    if (maxPage > 1) {
      return {
        type: 'query',
        paramName,
        maxPages: Math.min(maxPage, 30),
      };
    }

    const pathPagination = $('a[href*="/page/"], a[href*="/pagina/"]');
    if (pathPagination.length > 0) {
      pathPagination.each((_, el) => {
        const href = $(el).attr('href') || '';
        const match = href.match(/\/page\/(\d+)/);
        if (match) {
          maxPage = Math.max(maxPage, parseInt(match[1]));
        }
      });
      
      if (maxPage > 1) {
        return {
          type: 'path',
          maxPages: Math.min(maxPage, 30),
        };
      }
    }

    return { type: 'none' };
  }

  static async getCachedProfilePublic(domain: string) {
    return this.getCachedProfile(domain);
  }

  private static async getCachedProfile(domain: string) {
    try {
      const altDomain = domain.startsWith('www.') ? domain.replace('www.', '') : `www.${domain}`;
      
      const profiles = await db
        .select()
        .from(aiExtractionProfiles)
        .where(eq(aiExtractionProfiles.domain, domain));
      
      const altProfiles = await db
        .select()
        .from(aiExtractionProfiles)
        .where(eq(aiExtractionProfiles.domain, altDomain));
      
      const allProfiles = [...profiles, ...altProfiles];
      if (allProfiles.length === 0) return null;
      if (allProfiles.length === 1) return allProfiles[0];
      
      const mergedSelectors: Record<string, string> = {};
      for (const profile of allProfiles) {
        const sel = profile.selectors as Record<string, string> | null;
        if (!sel) continue;
        for (const [key, value] of Object.entries(sel)) {
          if (!value) continue;
          if (key === 'eventCard') {
            if (!mergedSelectors.eventCard || (value.startsWith('a') && !mergedSelectors.eventCard.startsWith('a'))) {
              mergedSelectors.eventCard = value;
            }
          } else {
            if (!mergedSelectors[key]) {
              mergedSelectors[key] = value;
            }
          }
        }
      }
      
      const bestProfile = allProfiles.reduce((best, current) => {
        return (current.confidence || 0) > (best.confidence || 0) ? current : best;
      });
      
      return { ...bestProfile, selectors: mergedSelectors };
    } catch {
      return null;
    }
  }

  static async analyzeForScraper(url: string): Promise<AiScraperAnalysisResult> {
    const steps: AiScraperAnalysisResult['steps'] = [];
    let overviewSelectors: AiExtractionSelectors | undefined;
    let detailSelectors: AiDetailSelectors | undefined;
    let hasJsonLd = false;
    let requiresJsRendering = false;
    let confidence = 0;
    const reasoningParts: string[] = [];

    try {
      console.log(`[AI Scraper Builder] Starting analysis for: ${url}`);
      const baseUrl = new URL(url);

      steps.push({ name: 'Overzichtspagina ophalen', status: 'success', message: 'Bezig...' });
      let overviewHtml = '';
      try {
        const response = await axios.get(url, {
          timeout: 15000,
          headers: { 'User-Agent': this.USER_AGENT },
          maxContentLength: 5 * 1024 * 1024,
        });
        overviewHtml = typeof response.data === 'string' ? response.data : '';
      } catch {
        overviewHtml = '';
      }

      if (!overviewHtml || detectJsRenderingNeeded(overviewHtml)) {
        console.log(`[AI Scraper Builder] Trying Puppeteer for overview page...`);
        const puppeteerResult = await fetchRenderedHtml(url, { waitForNetworkIdle: true });
        if (puppeteerResult.success && puppeteerResult.html) {
          overviewHtml = puppeteerResult.html;
          requiresJsRendering = true;
        }
      }

      if (!overviewHtml) {
        steps[0].status = 'failed';
        steps[0].message = 'Kon de pagina niet ophalen';
        return {
          success: false, hasJsonLd: false, sampleEvents: [], confidence: 0,
          reasoning: 'Kon de overzichtspagina niet ophalen', requiresJsRendering: false,
          error: 'Pagina niet bereikbaar', steps,
        };
      }
      steps[0].status = 'success';
      steps[0].message = `Pagina opgehaald (${(overviewHtml.length / 1024).toFixed(0)} KB)${requiresJsRendering ? ' via browser rendering' : ''}`;

      steps.push({ name: 'Event-kaarten analyseren met AI', status: 'success', message: 'Bezig...' });
      const simplifiedOverview = this.simplifyHtml(overviewHtml);
      const candidateCards = this.findCandidateCards(overviewHtml);

      if (candidateCards.length === 0) {
        steps[1].status = 'failed';
        steps[1].message = 'Geen herhalende kaart-structuren gevonden';
        return {
          success: false, hasJsonLd: false, sampleEvents: [], confidence: 0,
          reasoning: 'Geen herhalende event-kaarten gevonden op de overzichtspagina', requiresJsRendering,
          error: 'Geen event-kaarten gevonden', steps,
        };
      }

      const candidateInfo = candidateCards.map(c =>
        `- Selector: "${c.selector}" (${c.count} items)\n  Sample: ${c.sample.substring(0, 300)}...`
      ).join('\n\n');

      const overviewAiResult = await AiProvider.complete({
        systemPrompt: `Je bent een senior web scraping expert gespecialiseerd in Nederlandse evenementen-websites. Analyseer de HTML structuur grondig en bepaal de meest betrouwbare CSS selectors. Wees precies en specifiek. Overweeg meerdere opties en kies de meest robuuste. Antwoord alleen in JSON.`,
        userPrompt: `Analyseer deze Nederlandse evenementen-overzichtspagina en bepaal de CSS selectors.

URL: ${url}

Gevonden kandidaat-patronen:
${candidateInfo}

HTML fragment (vereenvoudigd):
${simplifiedOverview.substring(0, 5000)}

Bepaal de beste CSS selectors voor de OVERZICHTSPAGINA:
1. eventCard: Hoofd-selector voor elk event kaartje (het herhalende element)
2. title: Relatieve selector binnen de kaart voor de titel
3. date: Relatieve selector voor datum/tijd info
4. link: Relatieve selector voor de link naar de detailpagina (of "self" als de kaart een <a> tag is)
5. image: Relatieve selector voor de event afbeelding
6. category: Relatieve selector voor categorie (optioneel)
7. venue: Relatieve selector voor locatie/venue naam
8. address: Relatieve selector voor adres

BELANGRIJK:
- Kies de meest SPECIFIEKE selectors die uniek matchen
- Test mentaal of de selectors werken voor ALLE kaarten, niet alleen de eerste
- Bij twijfel, gebruik class-based selectors boven tag-only selectors
- "self" voor link betekent dat de eventCard zelf een <a> element is

Antwoord in JSON:
{
  "success": true,
  "selectors": {
    "eventCard": "...",
    "title": "...",
    "date": "...",
    "link": "...",
    "image": "...",
    "category": "...",
    "venue": "...",
    "address": "..."
  },
  "confidence": 0-100,
  "reasoning": "Uitleg van de gekozen strategie en waarom deze selectors betrouwbaar zijn"
}`,
        maxTokens: 1500,
        temperature: 0.1,
        jsonMode: true,
        model: 'pro',
      });

      if (!overviewAiResult.success || !overviewAiResult.content) {
        steps[1].status = 'failed';
        steps[1].message = `AI analyse mislukt: ${overviewAiResult.error}`;
        return {
          success: false, hasJsonLd: false, sampleEvents: [], confidence: 0,
          reasoning: 'AI kon de overzichtspagina niet analyseren', requiresJsRendering,
          error: overviewAiResult.error || 'AI analyse mislukt', steps,
        };
      }

      const overviewParsed = JSON.parse(overviewAiResult.content);
      if (!overviewParsed.success || !overviewParsed.selectors?.eventCard) {
        steps[1].status = 'failed';
        steps[1].message = 'AI kon geen bruikbare selectors vinden';
        return {
          success: false, hasJsonLd: false, sampleEvents: [], confidence: 0,
          reasoning: overviewParsed.reasoning || 'Geen selectors gevonden', requiresJsRendering,
          error: 'Geen bruikbare selectors', steps,
        };
      }

      overviewSelectors = overviewParsed.selectors as AiExtractionSelectors;
      const validationResult = await this.extractWithSelectors(overviewHtml, overviewSelectors);

      if (validationResult.eventCount < 2) {
        steps[1].status = 'failed';
        steps[1].message = `Selectors vonden slechts ${validationResult.eventCount} events`;
        return {
          success: false, overviewSelectors, hasJsonLd: false,
          sampleEvents: validationResult.sampleEvents, confidence: 15,
          reasoning: `Selectors vonden te weinig events (${validationResult.eventCount})`, requiresJsRendering,
          error: `Slechts ${validationResult.eventCount} events gevonden`, steps,
        };
      }

      steps[1].status = 'success';
      steps[1].message = `${validationResult.eventCount} events gevonden met AI selectors (confidence: ${overviewParsed.confidence}%)`;
      reasoningParts.push(`Overzicht: ${overviewParsed.reasoning}`);
      confidence = Math.min(overviewParsed.confidence || 50, 60);

      const eventLinks: string[] = [];
      for (const sample of validationResult.sampleEvents) {
        if (sample.link) {
          try {
            const absoluteLink = sample.link.startsWith('http')
              ? sample.link
              : new URL(sample.link, baseUrl.origin).href;
            eventLinks.push(absoluteLink);
          } catch {}
        }
      }

      steps.push({ name: 'Detailpagina\'s ophalen', status: 'success', message: 'Bezig...' });

      if (eventLinks.length === 0) {
        steps[2].status = 'failed';
        steps[2].message = 'Geen event-links gevonden op overzichtspagina';
        const pagination = this.detectPagination(overviewHtml, url);
        return {
          success: true, overviewSelectors, hasJsonLd: false, pagination,
          sampleEvents: validationResult.sampleEvents, confidence: Math.max(confidence - 10, 20),
          reasoning: reasoningParts.join('\n'), requiresJsRendering,
          suggestedFeedConfig: this.buildFeedConfig(url, overviewSelectors, undefined, false, pagination, requiresJsRendering),
          steps,
        };
      }

      const detailPages: Array<{ url: string; html: string }> = [];
      const linksToFetch = eventLinks.slice(0, 3);
      for (const link of linksToFetch) {
        try {
          if (requiresJsRendering) {
            const result = await fetchRenderedHtml(link, { waitForNetworkIdle: true });
            if (result.success && result.html) {
              detailPages.push({ url: link, html: result.html });
            }
          } else {
            const resp = await axios.get(link, {
              timeout: 10000,
              headers: { 'User-Agent': this.USER_AGENT },
              maxContentLength: 5 * 1024 * 1024,
            });
            if (typeof resp.data === 'string') {
              detailPages.push({ url: link, html: resp.data });
            }
          }
        } catch (err: any) {
          console.warn(`[AI Scraper Builder] Failed to fetch detail page ${link}: ${err.message}`);
        }
      }

      if (detailPages.length === 0) {
        steps[2].status = 'failed';
        steps[2].message = 'Kon geen detailpagina\'s ophalen';
        const pagination = this.detectPagination(overviewHtml, url);
        return {
          success: true, overviewSelectors, hasJsonLd: false, pagination,
          sampleEvents: validationResult.sampleEvents, confidence: Math.max(confidence - 10, 25),
          reasoning: reasoningParts.join('\n') + '\nDetailpagina\'s niet bereikbaar.',
          requiresJsRendering,
          suggestedFeedConfig: this.buildFeedConfig(url, overviewSelectors, undefined, false, pagination, requiresJsRendering),
          steps,
        };
      }

      steps[2].status = 'success';
      steps[2].message = `${detailPages.length} van ${linksToFetch.length} detailpagina's opgehaald`;

      steps.push({ name: 'Event-details analyseren met AI', status: 'success', message: 'Bezig...' });

      const firstDetail$ = cheerio.load(detailPages[0].html);
      const jsonLdScripts = firstDetail$('script[type="application/ld+json"]');
      let jsonLdEvent: any = null;
      jsonLdScripts.each((_, el) => {
        try {
          const data = JSON.parse(firstDetail$(el).text());
          if (data['@type'] === 'Event' || (Array.isArray(data['@graph']) && data['@graph'].find((g: any) => g['@type'] === 'Event'))) {
            jsonLdEvent = data['@type'] === 'Event' ? data : data['@graph'].find((g: any) => g['@type'] === 'Event');
            hasJsonLd = true;
          }
        } catch {}
      });

      if (hasJsonLd && jsonLdEvent) {
        console.log(`[AI Scraper Builder] JSON-LD Event data found on detail page!`);
        reasoningParts.push('Detail: JSON-LD gestructureerde data gevonden — hoogste betrouwbaarheid.');
        confidence = Math.min(confidence + 25, 95);
      }

      const detailHtmlSamples = detailPages.map((p, i) => {
        const simplified = this.simplifyDetailHtml(p.html);
        return `--- Detailpagina ${i + 1} (${p.url}) ---\n${simplified.substring(0, 3000)}`;
      }).join('\n\n');

      const detailAiResult = await AiProvider.complete({
        systemPrompt: `Je bent een senior web scraping expert gespecialiseerd in het extraheren van evenementgegevens van Nederlandse websites. Analyseer de HTML van event-detailpagina's en bepaal de CSS selectors voor elk veld. Vergelijk meerdere pagina's om consistente patronen te vinden. Antwoord alleen in JSON.`,
        userPrompt: `Analyseer deze ${detailPages.length} Nederlandse event-detailpagina's en bepaal de CSS selectors.

${hasJsonLd ? `LET OP: Er is JSON-LD (schema.org Event) data gevonden! Dit is de meest betrouwbare bron. Geef dit aan in je analyse.\n\nJSON-LD voorbeeld:\n${JSON.stringify(jsonLdEvent, null, 2).substring(0, 1000)}\n\n` : ''}

${detailHtmlSamples}

Bepaal de CSS selectors voor de DETAILPAGINA:
1. title: Selector voor de event-titel (vaak h1 of h2)
2. date: Selector voor datum informatie (zoek naar datetime attributen, .date, .datum, time elementen)
3. time: Selector voor tijdsinformatie (optioneel, als apart van datum)
4. description: Selector voor de beschrijving/inhoud (vaak .content, .description, article p)
5. image: Selector voor de hoofdafbeelding (vaak .hero img, .featured-image, article img:first)
6. location: Selector voor locatie/adres (breed)
7. venue: Selector voor de venue/locatie naam
8. address: Selector voor het straatadres
9. category: Selector voor categorie (optioneel)
10. price: Selector voor prijs informatie (optioneel)

BELANGRIJK:
- Vergelijk de ${detailPages.length} pagina's: selectors moeten op ALLE pagina's werken
- Zoek naar consistente patronen (dezelfde classes/structuur op elke pagina)
- Bij JSON-LD: meld dit, maar geef OOK HTML selectors als fallback
- Wees specifiek: gebruik classes boven generieke tags

Antwoord in JSON:
{
  "success": true,
  "detailSelectors": {
    "title": "...",
    "date": "...",
    "time": "... of null",
    "description": "...",
    "image": "...",
    "location": "... of null",
    "venue": "... of null",
    "address": "... of null",
    "category": "... of null",
    "price": "... of null"
  },
  "hasJsonLd": true/false,
  "confidence": 0-100,
  "reasoning": "Uitleg van hoe de selectors werken en waarom ze betrouwbaar zijn",
  "extractedSamples": [
    {"title": "...", "date": "...", "venue": "...", "description": "eerste 100 tekens..."}
  ]
}`,
        maxTokens: 2000,
        temperature: 0.1,
        jsonMode: true,
        model: 'pro',
      });

      if (!detailAiResult.success || !detailAiResult.content) {
        steps[3].status = 'failed';
        steps[3].message = `AI detail-analyse mislukt: ${detailAiResult.error}`;
        reasoningParts.push('Detail: AI kon de detailpagina\'s niet analyseren.');
      } else {
        const detailParsed = JSON.parse(detailAiResult.content);

        if (detailParsed.success && detailParsed.detailSelectors) {
          detailSelectors = detailParsed.detailSelectors as AiDetailSelectors;
          hasJsonLd = hasJsonLd || detailParsed.hasJsonLd === true;

          const detailConfidence = detailParsed.confidence || 50;
          confidence = Math.min(Math.round((confidence + detailConfidence) / 2 + 10), 95);

          const extractedFromDetail = await this.extractFromDetailPages(detailPages, detailSelectors);

          if (extractedFromDetail.length > 0) {
            for (let i = 0; i < Math.min(validationResult.sampleEvents.length, extractedFromDetail.length); i++) {
              validationResult.sampleEvents[i] = {
                ...validationResult.sampleEvents[i],
                ...extractedFromDetail[i],
              };
            }
          }

          steps[3].status = 'success';
          steps[3].message = `Detail-selectors gevonden (confidence: ${detailConfidence}%)${hasJsonLd ? ' — JSON-LD beschikbaar!' : ''}`;
          reasoningParts.push(`Detail: ${detailParsed.reasoning}`);
        } else {
          steps[3].status = 'failed';
          steps[3].message = 'AI kon geen detail-selectors vinden';
          reasoningParts.push('Detail: Geen betrouwbare selectors gevonden.');
          confidence = Math.max(confidence - 10, 20);
        }
      }

      steps.push({ name: 'Configuratie valideren', status: 'success', message: 'Bezig...' });
      const pagination = this.detectPagination(overviewHtml, url);

      const feedConfig = this.buildFeedConfig(url, overviewSelectors, detailSelectors, hasJsonLd, pagination, requiresJsRendering);

      steps[4].status = 'success';
      steps[4].message = `Configuratie aangemaakt (totaal confidence: ${confidence}%)`;

      const domain = baseUrl.hostname.replace('www.', '');
      if (confidence >= 40) {
        await this.saveProfile(domain, overviewSelectors, pagination, validationResult.eventCount, requiresJsRendering);
      }

      return {
        success: confidence >= 30,
        overviewSelectors,
        detailSelectors,
        hasJsonLd,
        pagination,
        sampleEvents: validationResult.sampleEvents,
        confidence,
        reasoning: reasoningParts.join('\n'),
        requiresJsRendering,
        suggestedFeedConfig: feedConfig,
        steps,
      };

    } catch (error: any) {
      console.error('[AI Scraper Builder] Error:', error);
      return {
        success: false, hasJsonLd: false, sampleEvents: [], confidence: 0,
        reasoning: `Fout: ${error.message}`, requiresJsRendering: false,
        error: error.message, steps,
      };
    }
  }

  private static simplifyDetailHtml(html: string): string {
    const $ = cheerio.load(html);
    $('script:not([type="application/ld+json"]), style, noscript, iframe, svg, path, link[rel="stylesheet"]').remove();
    $('[style]').removeAttr('style');
    $('[class*="cookie"], [class*="popup"], [class*="modal"], [id*="cookie"]').remove();
    $('[class*="menu"], [class*="nav-"], [class*="sidebar"]').remove();
    $('footer, nav, aside').remove();

    $('*').each((_, el) => {
      const attrs = (el as any).attribs || {};
      for (const attr of Object.keys(attrs)) {
        if (!['class', 'id', 'href', 'src', 'alt', 'datetime', 'data-date', 'data-time', 'content', 'type'].includes(attr)) {
          $(el).removeAttr(attr);
        }
      }
    });

    let simplified = $.html();
    simplified = simplified.replace(/\s+/g, ' ').replace(/>\s+</g, '><');

    const mainContent = $('main, [role="main"], .content, #content, article, .event-detail, .single-event').first();
    if (mainContent.length && mainContent.html()) {
      const jsonLd = $('script[type="application/ld+json"]').toString();
      simplified = jsonLd + (mainContent.html() || '');
    }

    return simplified.substring(0, 6000);
  }

  private static async extractFromDetailPages(
    pages: Array<{ url: string; html: string }>,
    selectors: AiDetailSelectors
  ): Promise<Array<Record<string, string>>> {
    const results: Array<Record<string, string>> = [];

    for (const page of pages) {
      const $ = cheerio.load(page.html);
      const extracted: Record<string, string> = {};

      const fieldMap: Array<[keyof AiDetailSelectors, string]> = [
        ['title', 'title'], ['date', 'date'], ['time', 'time'],
        ['description', 'description'], ['venue', 'venue'],
        ['address', 'address'], ['category', 'category'], ['price', 'price'],
      ];

      for (const [key, name] of fieldMap) {
        const sel = selectors[key];
        if (sel) {
          const el = $(sel).first();
          if (el.length) {
            let value = el.text().trim();
            if (name === 'description') value = value.substring(0, 200);
            if (value) extracted[name] = value;
          }
        }
      }

      if (selectors.image) {
        const imgEl = $(selectors.image).first();
        if (imgEl.length) {
          extracted.image = imgEl.attr('src') || imgEl.attr('data-src') || '';
        }
      }

      if (selectors.location) {
        const locEl = $(selectors.location).first();
        if (locEl.length) {
          extracted.location = locEl.text().trim();
        }
      }

      extracted.link = page.url;
      results.push(extracted);
    }

    return results;
  }

  private static buildFeedConfig(
    url: string,
    overviewSelectors: AiExtractionSelectors,
    detailSelectors: AiDetailSelectors | undefined,
    hasJsonLd: boolean,
    pagination: AiPaginationInfo,
    requiresJsRendering: boolean
  ): AiScraperAnalysisResult['suggestedFeedConfig'] {
    const scraperConfig: Record<string, any> = {
      cardSelector: overviewSelectors.eventCard,
      overviewSelectors: { ...overviewSelectors },
      requiresJsRendering,
      aiGenerated: true,
      aiGeneratedAt: new Date().toISOString(),
    };

    if (detailSelectors) {
      scraperConfig.detailSelectors = { ...detailSelectors };
    }

    if (hasJsonLd) {
      scraperConfig.hasJsonLd = true;
      scraperConfig.preferJsonLd = true;
    }

    if (pagination.type !== 'none') {
      scraperConfig.pagination = { ...pagination };
    }

    const fieldMappings: Record<string, string> = {};
    if (overviewSelectors.title) fieldMappings.title = overviewSelectors.title;
    if (overviewSelectors.date) fieldMappings.date = overviewSelectors.date;
    if (overviewSelectors.link) fieldMappings.link = overviewSelectors.link;
    if (overviewSelectors.image) fieldMappings.image = overviewSelectors.image;
    if (overviewSelectors.venue) fieldMappings.venue = overviewSelectors.venue;
    if (overviewSelectors.address) fieldMappings.address = overviewSelectors.address;

    return {
      feedType: 'scraper',
      scraperConfig,
      fieldMappings,
    };
  }

  private static readonly MIN_CONFIDENCE_TO_SAVE = 40;

  private static async saveProfile(
    domain: string,
    selectors: AiExtractionSelectors,
    pagination: AiPaginationInfo,
    eventCount: number,
    requiresJsRendering: boolean = false
  ) {
    try {
      const existing = await this.getCachedProfile(domain);
      
      const confidence = Math.min(90, 50 + eventCount * 2);

      if (confidence < this.MIN_CONFIDENCE_TO_SAVE) {
        console.log(`[AI Analyzer] SKIPPED saving profile for ${domain}: confidence ${confidence}% below minimum threshold ${this.MIN_CONFIDENCE_TO_SAVE}%`);
        return;
      }
      
      if (existing) {
        await db
          .update(aiExtractionProfiles)
          .set({
            selectors,
            pagination,
            confidence,
            validatedEvents: eventCount,
            requiresJsRendering,
            lastValidatedAt: new Date(),
            updatedAt: new Date(),
            aiModel: "gemini-2.5-flash",
            aiPromptVersion: this.PROMPT_VERSION,
          })
          .where(eq(aiExtractionProfiles.domain, domain));
      } else {
        await db.insert(aiExtractionProfiles).values({
          domain,
          selectors,
          pagination,
          confidence,
          validatedEvents: eventCount,
          requiresJsRendering,
          aiModel: "gemini-2.5-flash",
          aiPromptVersion: this.PROMPT_VERSION,
        });
      }
      
      console.log(`[AI Analyzer] Saved profile for ${domain} with ${eventCount} events (confidence: ${confidence}%, jsRendering: ${requiresJsRendering})`);
    } catch (error) {
      console.error('[AI Analyzer] Failed to save profile:', error);
    }
  }
}
