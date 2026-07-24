import puppeteer, { Browser } from "puppeteer";
import { validateExternalUrl } from "../utils/url-validator";

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    // Find chromium in Nix store
    const chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
    
    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath: chromiumPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ],
    });
  }
  return browserInstance;
}

export interface PuppeteerFetchResult {
  success: boolean;
  html?: string;
  error?: string;
  renderTime?: number;
}

export async function fetchRenderedHtml(
  url: string,
  options: {
    waitForSelector?: string;
    timeout?: number;
    waitForNetworkIdle?: boolean;
  } = {}
): Promise<PuppeteerFetchResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 15000;
  
  let page = null;
  
  try {
    validateExternalUrl(url, "puppeteer-fetch");
    const browser = await getBrowser();
    page = await browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(url, {
      waitUntil: options.waitForNetworkIdle ? 'networkidle2' : 'domcontentloaded',
      timeout,
    });

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 5000 }).catch(() => {});
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    const html = await page.content();
    const renderTime = Date.now() - startTime;

    console.log(`[Puppeteer] Fetched ${url} in ${renderTime}ms (${html.length} chars)`);

    return {
      success: true,
      html,
      renderTime,
    };
  } catch (error: any) {
    console.error(`[Puppeteer] Error fetching ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
      renderTime: Date.now() - startTime,
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

export interface InterceptedApiResult {
  success: boolean;
  responses: any[];
  html?: string;
  error?: string;
  renderTime?: number;
}

/**
 * Load a page with Puppeteer, intercept JSON API responses from specified domains,
 * and return both the captured API data and the rendered HTML.
 * Injects cookie-consent acceptance to bypass GDPR consent walls.
 */
export async function interceptPageApiCalls(
  pageUrl: string,
  options: {
    apiDomains?: string[];
    timeout?: number;
    waitMs?: number;
  } = {}
): Promise<InterceptedApiResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 30000;
  const apiDomains = options.apiDomains || [];
  const capturedResponses: any[] = [];

  let page = null;
  try {
    validateExternalUrl(pageUrl, "puppeteer-intercept");
    const browser = await getBrowser();
    page = await browser.newPage();

    // Pre-inject cookie consent acceptance to bypass Cookiebot and similar
    await page.evaluateOnNewDocument(() => {
      // Cookiebot consent
      const expires = new Date(Date.now() + 365 * 86400000).toUTCString();
      document.cookie = `CookieConsent={stamp:'bypass',necessary:true,preferences:true,statistics:true,marketing:true}; expires=${expires}; path=/`;
      // CookieFirst consent
      (window as any).CookieFirst = { consent: { necessary: true, functional: true, performance: true, advertising: true } };
      // Generic consent flags
      (window as any).Cookiebot = { consent: { necessary: true, preferences: true, statistics: true, marketing: true } };
    });

    // Intercept: abort heavy assets, capture API JSON responses
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const rt = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(rt)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Capture responses from target API domains
    page.on('response', async (response) => {
      try {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';
        if (!contentType.includes('json')) return;
        const matchesDomain = apiDomains.length === 0 ||
          apiDomains.some(d => url.includes(d));
        if (!matchesDomain) return;
        const body = await response.json().catch(() => null);
        if (body) {
          capturedResponses.push({ url, body });
          console.log(`[Puppeteer] Intercepted API response from: ${url} (${JSON.stringify(body).length} chars)`);
        }
      } catch {}
    });

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout });

    // Extra wait for lazy-loading widgets
    const waitMs = options.waitMs ?? 3000;
    await new Promise(r => setTimeout(r, waitMs));

    const html = await page.content();
    const renderTime = Date.now() - startTime;
    console.log(`[Puppeteer] Intercepted ${capturedResponses.length} API responses from ${pageUrl} in ${renderTime}ms`);

    return { success: true, responses: capturedResponses, html, renderTime };
  } catch (error: any) {
    console.error(`[Puppeteer] interceptPageApiCalls error for ${pageUrl}:`, error.message);
    return { success: false, responses: capturedResponses, error: error.message, renderTime: Date.now() - startTime };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

export function detectJsRenderingNeeded(html: string): boolean {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;
  
  const textContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                  .replace(/<[^>]+>/g, '')
                                  .replace(/\s+/g, ' ')
                                  .trim();
  
  if (textContent.length < 500) {
    console.log('[Puppeteer] Detected minimal text content - JS rendering likely needed');
    return true;
  }

  const spaIndicators = [
    'id="root"',
    'id="app"',
    'id="__next"',
    'id="__nuxt"',
    'ng-app',
    'data-reactroot',
    '<div id="root"></div>',
    '<div id="app"></div>',
  ];
  
  for (const indicator of spaIndicators) {
    if (html.includes(indicator)) {
      console.log(`[Puppeteer] Detected SPA indicator: ${indicator}`);
      return true;
    }
  }

  const emptyListPatterns = [
    /<div[^>]*id="filteredList"[^>]*>\s*<\/div>/i,
    /<div[^>]*class="[^"]*list[^"]*"[^>]*>\s*<\/div>/i,
    /<div[^>]*class="[^"]*agenda[^"]*list[^"]*"[^>]*>\s*<\/div>/i,
    /<div[^>]*class="[^"]*events?[^"]*"[^>]*>\s*<\/div>/i,
    /<ul[^>]*class="[^"]*events?[^"]*"[^>]*>\s*<\/ul>/i,
  ];
  
  for (const pattern of emptyListPatterns) {
    if (pattern.test(html)) {
      console.log('[Puppeteer] Detected empty list container - JS rendering likely needed');
      return true;
    }
  }

  const scriptTags = (html.match(/<script/gi) || []).length;
  const htmlSize = html.length;
  
  if (scriptTags > 20 && htmlSize < 50000) {
    console.log(`[Puppeteer] High script density detected (${scriptTags} scripts, ${htmlSize} bytes)`);
    return true;
  }

  return false;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}
