import * as cheerio from "cheerio";
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

export class AiHtmlAnalyzer {
  private static readonly MAX_HTML_TOKENS = 4000;
  private static readonly PROMPT_VERSION = "v1.0";

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
