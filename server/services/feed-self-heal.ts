import axios from "axios";
import { storage } from "../storage";
import { getFeedHealthMap, type FeedHealth } from "./feed-health";
import { RssFeedService } from "./rss-feed-service";
import { AiHtmlAnalyzer } from "./ai-html-analyzer";
import type {
  RssFeed,
  FeedRepairCase,
  SelfHealConfig,
} from "@shared/schema";

/**
 * Zelfherstellende koppelingen (self-healing feeds).
 *
 * Eén nachtelijke pass (na de gezondheidscontrole) probeert ongezonde feeds
 * automatisch te repareren langs drie sporen:
 *   A) retry   — gratis opnieuw proberen bij tijdelijke fouten (netwerk/timeout).
 *   B) ai_fix  — automatische in-app AI-reparatie, ALLEEN voor simpele
 *                config-feeds (universele scraper met AI-profiel per domein).
 *   C) dossier — een rijk reparatie-werkorder voor complexe/maatwerk feeds, plus
 *                een beslissingen-inbox voor zaken die een mens nodig hebben
 *                (API-sleutel, grote keuze, onherstelbaar).
 *
 * AI-credits zijn gebudgetteerd via `self_heal_config` (maand-limieten). Het hele
 * proces is idempotent: een feed met een open zaak wordt overgeslagen.
 */

// Maatwerk-domeinen: feeds met een eigen, handgeschreven scraper. Die kunnen NIET
// automatisch via AI worden gerepareerd — ze krijgen altijd een dossier.
// Houd deze lijst gelijk met de `url.includes(...)` checks in
// RssFeedService.dispatchScraper.
const MAATWERK_DOMAINS = [
  "iamsterdam.com", "thisiseindhoven", "trefhetinoss", "visithelmond",
  "bezoekmeierijstad", "exploremaashorst", "sonenbreugel", "mooibernheze",
  "zinindenbosch", "beleefboxtel", "visitbergeijk", "goedgestel", "visitvught",
  "beleveninoosterhout", "bezoekoisterwijk", "inzutphen", "explorebreda",
  "grenslanddebaronie", "tilburg.com", "bommelerwaard.net",
  "uitinderegio.nl/landvanmaasenwaal", "uitinderegio.nl/bommelerwaard",
  "uitinderegio.nl/beleef-west-betuwe", "uitinderegio.nl/betuwe",
  "stadwageningen", "wijchenis", "intonijmegen", "welkominommen",
  "visithardenberg", "uitinalmelo", "visitzwolle", "denhaag.com",
  "indelft.nl", "visitleiden.nl", "groenehart.nl", "heerlenmijnstad.nl",
];

type Cause = "transient" | "structure" | "auth" | "unknown";

// Hoeveel ongezonde feeds we maximaal per run aanpakken (begrenst werk + kosten).
const MAX_FEEDS_PER_RUN = 25;
const RETRY_DELAY_MS = 3000;
// Minimale AI-betrouwbaarheid + events om een AI-reparatie te accepteren.
const AI_MIN_CONFIDENCE = 30;
const AI_MIN_EVENTS = 3;

function isMaatwerkFeed(feed: RssFeed): boolean {
  if (feed.feedType !== "scraper") return false;
  const url = feed.url.toLowerCase();
  return MAATWERK_DOMAINS.some((d) => url.includes(d));
}

// Een "config-feed" is een universele scraper (geen maatwerk) — die kan de AI
// opnieuw leren via een domein-profiel.
function isConfigFeed(feed: RssFeed): boolean {
  return feed.feedType === "scraper" && !isMaatwerkFeed(feed);
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Bepaal de waarschijnlijke oorzaak van een ongezonde feed uit de
 * gezondheidsstatus en de laatste foutmelding.
 */
export function diagnoseFeed(feed: RssFeed, health: FeedHealth): Cause {
  const err = (feed.lastErrorMessage || "").toLowerCase();
  const reason = (health.reason || "").toLowerCase();
  const blob = `${err} ${reason}`;

  // Authenticatie / autorisatie → menselijke beslissing (API-sleutel e.d.).
  if (
    /\b(401|403)\b/.test(blob) ||
    blob.includes("unauthorized") ||
    blob.includes("forbidden") ||
    blob.includes("not allowed") ||
    blob.includes("api key") ||
    blob.includes("api-sleutel") ||
    blob.includes("apikey") ||
    blob.includes("access denied")
  ) {
    return "auth";
  }

  // Tijdelijke/netwerk-fouten → gratis opnieuw proberen.
  if (
    blob.includes("timeout") ||
    blob.includes("timed out") ||
    blob.includes("etimedout") ||
    blob.includes("econnreset") ||
    blob.includes("econnrefused") ||
    blob.includes("enotfound") ||
    blob.includes("eai_again") ||
    blob.includes("getaddrinfo") ||
    blob.includes("socket hang up") ||
    blob.includes("network") ||
    blob.includes("ssl") ||
    blob.includes("certificate") ||
    /\b(500|502|503|504)\b/.test(blob)
  ) {
    return "transient";
  }

  // Structuurprobleem: wel gevonden maar 0 geïmporteerd, of 0 items / geen
  // nieuwe events — bron-HTML/structuur is waarschijnlijk veranderd.
  if (
    health.status === "suspect" ||
    health.status === "warning" ||
    blob.includes("selector") ||
    blob.includes("parse") ||
    blob.includes("geïmporteerd")
  ) {
    return "structure";
  }

  return "unknown";
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LetsGoRadarBot/1.0; +https://letsgoradar.com)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      timeout: 30000,
      maxContentLength: 8 * 1024 * 1024,
    });
    return typeof res.data === "string" ? res.data : String(res.data ?? "");
  } catch (e: any) {
    console.error(`[SelfHeal] HTML ophalen mislukt voor ${url}: ${e?.message ?? e}`);
    return null;
  }
}

/**
 * Bouw een Replit-waardig reparatie-werkorder (markdown) voor een dossier.
 */
function buildWorkOrder(
  feed: RssFeed,
  health: FeedHealth,
  cause: Cause,
  extra: { aiTried?: boolean; aiNote?: string } = {},
): string {
  const lines: string[] = [];
  lines.push(`# Reparatie-werkorder: ${feed.name}`);
  lines.push("");
  lines.push(`**Feed #${feed.id}** · ${feed.municipality || "onbekende gemeente"}`);
  lines.push(`**Type:** ${feed.feedType}${isMaatwerkFeed(feed) ? " (maatwerk-scraper)" : isConfigFeed(feed) ? " (universele scraper)" : ""}`);
  lines.push(`**Bron:** ${feed.url}`);
  lines.push("");
  lines.push(`## Wat is er aan de hand`);
  lines.push(health.reason || "Onbekend probleem.");
  if (feed.lastErrorMessage) {
    lines.push("");
    lines.push(`**Laatste foutmelding:** ${feed.lastErrorMessage}`);
  }
  lines.push("");
  lines.push(`## Diagnose`);
  lines.push(`- Vermoedelijke oorzaak: **${cause}**`);
  lines.push(`- Status: ${health.status}`);
  lines.push(`- Actieve events in catalogus: ${health.activeEvents}`);
  lines.push(`- Laatste geslaagde import: ${health.lastSuccessfulSyncAt ?? "onbekend"}`);
  if (extra.aiTried) {
    lines.push(`- Automatische AI-reparatie geprobeerd: ${extra.aiNote || "geen verbetering"}`);
  }
  lines.push("");
  lines.push(`## Voorgestelde stappen`);
  if (isMaatwerkFeed(feed)) {
    lines.push("1. Open de bron-pagina handmatig en controleer of de HTML-structuur is veranderd.");
    lines.push("2. Vergelijk met de maatwerk-scraper in `rss-feed-service.ts` (selectors / link-patronen).");
    lines.push("3. Werk de selectors of het link-patroon bij; let op event-detail-URLs vs. overzichts-URL.");
    lines.push("4. Test met een handmatige sync en controleer GPS-uniekheid + tijden.");
  } else if (cause === "structure") {
    lines.push("1. Controleer of de overzichtspagina nog bestaat (geen 404 / redirect).");
    lines.push("2. Herzie het AI-domeinprofiel via de AI Scraper Builder (3-staps wizard).");
    lines.push("3. Test de nieuwe selectors en sla het profiel opnieuw op.");
    lines.push("4. Voer een handmatige sync uit en controleer het aantal geïmporteerde events.");
  } else if (cause === "transient") {
    lines.push("1. De bron lijkt tijdelijk onbereikbaar — controleer of de site nu online is.");
    lines.push("2. Voer een handmatige sync uit; als die slaagt, is verdere actie niet nodig.");
  } else {
    lines.push("1. Open de bron-pagina handmatig en beoordeel wat er mis is.");
    lines.push("2. Bepaal of dit een structuur-, netwerk- of toegangsprobleem is.");
  }
  return lines.join("\n");
}

interface RunResult {
  feedsChecked: number;
  retried: number;
  aiFixed: number;
  dossiersCreated: number;
  decisionsCreated: number;
  skipped: number;
}

/**
 * Spoor A — gratis opnieuw proberen bij tijdelijke fouten.
 * Geeft true terug als een retry slaagde.
 */
async function trackRetry(feed: RssFeed, maxRetries: number): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await RssFeedService.processFeed(feed, storage);
      if (result.success) {
        await storage.createFeedRepairLog({
          feedId: feed.id,
          feedName: feed.name,
          cause: "transient",
          track: "retry",
          outcome: "success",
          message: `Hersteld na ${attempt}e poging (${result.eventsCreated} nieuw, ${result.eventsUpdated} bijgewerkt).`,
          detail: { attempt, eventsCreated: result.eventsCreated, eventsUpdated: result.eventsUpdated },
          aiCallsUsed: 0,
        });
        return true;
      }
    } catch (e: any) {
      console.error(`[SelfHeal] Retry-poging ${attempt} faalde voor feed #${feed.id}: ${e?.message ?? e}`);
    }
    if (attempt < maxRetries) {
      // Oplopende backoff (3s, 6s, 9s, …) geeft een trage/overbelaste bron meer
      // tijd om te herstellen voordat we het opnieuw proberen.
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
  return false;
}

/**
 * Spoor B — automatische in-app AI-reparatie voor een config-feed.
 * Snapshot → her-leren via AI → toepassen → her-syncen → terugdraaien bij geen
 * verbetering. Geeft een object terug met of het lukte en de gebruikte AI-calls.
 */
async function trackAiFix(
  feed: RssFeed,
  health: FeedHealth,
): Promise<{ fixed: boolean; aiCallsUsed: number; note: string }> {
  const domain = domainOf(feed.url);
  const previousProfileId = feed.aiExtractionProfileId ?? null;

  const html = await fetchHtml(feed.url);
  if (!html) {
    return { fixed: false, aiCallsUsed: 0, note: "bron niet bereikbaar voor AI-analyse" };
  }

  let aiCallsUsed = 1;
  let result;
  try {
    result = await AiHtmlAnalyzer.analyzeAndExtract(feed.url, html);
  } catch (e: any) {
    return { fixed: false, aiCallsUsed, note: `AI-analyse fout: ${e?.message ?? e}` };
  }

  if (!result.success || !result.selectors || (result.eventCount ?? 0) < AI_MIN_EVENTS || (result.confidence ?? 0) < AI_MIN_CONFIDENCE) {
    return {
      fixed: false,
      aiCallsUsed,
      note: `AI vond ${result.eventCount ?? 0} events (betrouwbaarheid ${result.confidence ?? 0}%) — onvoldoende`,
    };
  }

  // analyzeAndExtract slaat een domein-profiel op bij voldoende betrouwbaarheid.
  const saved = await storage.getAiExtractionProfileByDomain(domain);
  if (!saved) {
    return { fixed: false, aiCallsUsed, note: "AI-profiel niet opgeslagen (te lage betrouwbaarheid)" };
  }

  // Koppel het (nieuwe) profiel aan de feed en her-sync.
  await storage.updateRssFeed(feed.id, { aiExtractionProfileId: saved.id });
  try {
    const sync = await RssFeedService.processFeed({ ...feed, aiExtractionProfileId: saved.id }, storage);
    // Kwaliteitsdrempel op GELIJKE eenheden: hoeveel event-items het nieuwe profiel
    // daadwerkelijk van de bron haalde (itemsProcessed), niet de import-delta vs.
    // de totale catalogus. Zo worden feeds met weinig dagelijkse mutaties (veel
    // 'skipped' = al bekend) niet onterecht teruggedraaid. Daarnaast mogen de
    // afgekeurde items (verkeerde locatie/datum) niet de overhand hebben.
    const processed = sync.itemsProcessed ?? 0;
    const created = sync.eventsCreated ?? 0;
    const updated = sync.eventsUpdated ?? 0;
    const skipped = sync.eventsSkipped ?? 0;
    const rejected = sync.eventsRejected ?? 0;
    const handled = created + updated + skipped; // geldig verwerkt (nieuw/bijgewerkt/al bekend)
    const enoughExtracted = processed >= AI_MIN_EVENTS;
    const notMostlyRejected = handled >= rejected;
    if (sync.success && enoughExtracted && notMostlyRejected) {
      return {
        fixed: true,
        aiCallsUsed,
        note: `${processed} items verwerkt met vernieuwd AI-profiel (${created} nieuw, ${updated} bijgewerkt, ${skipped} al bekend, ${rejected} afgekeurd).`,
      };
    }
    console.warn(
      `[SelfHeal] AI-fix feed #${feed.id} onvoldoende: verwerkt=${processed} (drempel ${AI_MIN_EVENTS}), geldig=${handled}, afgekeurd=${rejected} — terugdraaien.`,
    );
  } catch (e: any) {
    console.error(`[SelfHeal] Her-sync na AI-fix faalde voor feed #${feed.id}: ${e?.message ?? e}`);
  }

  // Geen verbetering (of verslechtering) → koppeling terugdraaien naar de vorige config.
  await storage.updateRssFeed(feed.id, { aiExtractionProfileId: previousProfileId });
  return {
    fixed: false,
    aiCallsUsed,
    note: `AI-profiel haalde de kwaliteitsdrempel (min. ${AI_MIN_EVENTS} items) niet — teruggedraaid naar vorige config.`,
  };
}

/**
 * Spoor C — maak een dossier (rijk werkorder) of een beslissing (inbox).
 * Idempotent: slaat over als er al een open zaak van dezelfde soort bestaat.
 * Geeft de aangemaakte zaak terug (of null bij overslaan).
 */
async function openCase(
  feed: RssFeed,
  health: FeedHealth,
  cause: Cause,
  kind: "dossier" | "decision",
  extra: { aiTried?: boolean; aiNote?: string } = {},
): Promise<FeedRepairCase | null> {
  const existing = await storage.getOpenRepairCaseForFeed(feed.id, kind);
  if (existing) return null;

  if (kind === "decision") {
    const decisionType = cause === "auth" ? "api_key" : "big_choice";
    const title = decisionType === "api_key"
      ? `Toegang/API-sleutel nodig: ${feed.name}`
      : `Beslissing nodig: ${feed.name}`;
    const summary = decisionType === "api_key"
      ? `De bron weigert toegang (${feed.lastErrorMessage || health.reason}). Mogelijk is een nieuwe API-sleutel of autorisatie nodig.`
      : `Deze feed vereist een menselijke keuze: ${health.reason}`;
    return storage.createFeedRepairCase({
      feedId: feed.id,
      feedName: feed.name,
      kind: "decision",
      cause,
      severity: health.status === "suspect" ? "error" : "warning",
      decisionType,
      title,
      summary,
      diagnosis: {
        cause,
        url: feed.url,
        feedType: feed.feedType,
        lastError: feed.lastErrorMessage,
        health: { status: health.status, reason: health.reason, activeEvents: health.activeEvents },
      },
      status: "open",
    });
  }

  const workOrder = buildWorkOrder(feed, health, cause, extra);
  return storage.createFeedRepairCase({
    feedId: feed.id,
    feedName: feed.name,
    kind: "dossier",
    cause,
    severity: health.status === "suspect" ? "error" : "warning",
    title: `Reparatie nodig: ${feed.name}`,
    summary: health.reason || "Deze feed heeft handmatige reparatie nodig.",
    diagnosis: {
      cause,
      url: feed.url,
      feedType: feed.feedType,
      isMaatwerk: isMaatwerkFeed(feed),
      lastError: feed.lastErrorMessage,
      health: { status: health.status, reason: health.reason, activeEvents: health.activeEvents },
      aiTried: extra.aiTried ?? false,
      aiNote: extra.aiNote,
      workOrder,
    },
    status: "open",
  });
}

/**
 * Hoofd-entreepunt. Loopt alle ongezonde feeds langs en repareert/escaleert ze
 * volgens de drie sporen, binnen de budgetlimieten. Veilig om fire-and-forget
 * aan te roepen na een sync.
 */
let isSelfHealRunning = false;

export async function runSelfHeal(): Promise<RunResult> {
  const summary: RunResult = {
    feedsChecked: 0, retried: 0, aiFixed: 0,
    dossiersCreated: 0, decisionsCreated: 0, skipped: 0,
  };

  // Voorkom overlappende runs (scheduler + handmatige knop). Net als de RSS-sync
  // guard: tweede gelijktijdige aanroep slaat over i.p.v. budget dubbel te tellen.
  if (isSelfHealRunning) {
    return { ...summary, skipped: -1 };
  }
  isSelfHealRunning = true;
  try {
    return await runSelfHealInner(summary);
  } finally {
    isSelfHealRunning = false;
  }
}

async function runSelfHealInner(summary: RunResult): Promise<RunResult> {
  const config: SelfHealConfig = await storage.getSelfHealConfig();
  const usage = await storage.getMonthlySelfHealUsage();
  let aiCallsLeft = Math.max(0, config.monthlyAiCallLimit - usage.aiCallsUsed);
  let dossiersLeft = Math.max(0, config.monthlyDossierLimit - usage.dossiersCreated);

  const healthMap = await getFeedHealthMap();
  const unhealthy = Object.values(healthMap)
    .filter((h) => h.status === "suspect" || h.status === "warning")
    .slice(0, MAX_FEEDS_PER_RUN);

  if (unhealthy.length === 0) return summary;

  const feeds = await storage.getAllRssFeeds();
  const feedById = new Map(feeds.map((f) => [f.id, f]));
  const newCases: FeedRepairCase[] = [];

  for (const health of unhealthy) {
    const feed = feedById.get(health.feedId);
    if (!feed || feed.status !== "active") continue;
    summary.feedsChecked++;

    // Idempotent: al een open zaak voor deze feed → niets doen.
    const openDossier = await storage.getOpenRepairCaseForFeed(feed.id, "dossier");
    const openDecision = await storage.getOpenRepairCaseForFeed(feed.id, "decision");
    if (openDossier || openDecision) {
      summary.skipped++;
      continue;
    }

    const cause = diagnoseFeed(feed, health);

    // --- Spoor A: tijdelijke fout → gratis opnieuw proberen ---
    if (cause === "transient" && config.autoRetryEnabled) {
      const ok = await trackRetry(feed, config.maxRetriesPerRun);
      if (ok) {
        summary.retried++;
        continue;
      }
      // Retries op → escaleer naar dossier.
      if (dossiersLeft > 0) {
        const c = await openCase(feed, health, cause, "dossier");
        if (c) { newCases.push(c); summary.dossiersCreated++; dossiersLeft--; }
      } else {
        await logSkipped(feed, cause, "dossier-budget op");
        summary.skipped++;
      }
      continue;
    }

    // --- Beslissing nodig (toegang/API-sleutel) ---
    if (cause === "auth") {
      const c = await openCase(feed, health, cause, "decision");
      if (c) { newCases.push(c); summary.decisionsCreated++; }
      await storage.createFeedRepairLog({
        feedId: feed.id, feedName: feed.name, cause, track: "decision",
        outcome: "escalated", message: "Toegangsprobleem — beslissing nodig.", aiCallsUsed: 0,
      });
      continue;
    }

    // --- Spoor B: structuurprobleem op een config-feed → AI-reparatie ---
    if (cause === "structure" && isConfigFeed(feed) && config.aiFixEnabled && aiCallsLeft > 0) {
      const ai = await trackAiFix(feed, health);
      aiCallsLeft -= ai.aiCallsUsed;
      if (ai.fixed) {
        await storage.createFeedRepairLog({
          feedId: feed.id, feedName: feed.name, cause, track: "ai_fix",
          outcome: "success", message: ai.note, aiCallsUsed: ai.aiCallsUsed,
        });
        summary.aiFixed++;
        continue;
      }
      // AI hielp niet → log + escaleer naar dossier.
      await storage.createFeedRepairLog({
        feedId: feed.id, feedName: feed.name, cause, track: "ai_fix",
        outcome: "rolled_back", message: ai.note, aiCallsUsed: ai.aiCallsUsed,
      });
      if (dossiersLeft > 0) {
        const c = await openCase(feed, health, cause, "dossier", { aiTried: true, aiNote: ai.note });
        if (c) { newCases.push(c); summary.dossiersCreated++; dossiersLeft--; }
      } else {
        summary.skipped++;
      }
      continue;
    }

    // --- Spoor C: complexe/maatwerk feed of geen budget → dossier ---
    if (dossiersLeft > 0) {
      const aiUnavailable = cause === "structure" && isConfigFeed(feed) && config.aiFixEnabled && aiCallsLeft <= 0;
      const c = await openCase(feed, health, cause, "dossier", {
        aiTried: false,
        aiNote: aiUnavailable ? "AI-budget voor deze maand op" : undefined,
      });
      if (c) { newCases.push(c); summary.dossiersCreated++; dossiersLeft--; }
    } else {
      await logSkipped(feed, cause, "dossier-budget op");
      summary.skipped++;
    }
  }

  // Eén gegroepeerde digest-mail voor alle nieuwe zaken.
  if (newCases.length > 0) {
    try {
      const { sendRepairDigest } = await import("./email-service");
      await sendRepairDigest(newCases);
    } catch (e: any) {
      console.error(`[SelfHeal] Digest-mail mislukt: ${e?.message ?? e}`);
    }
  }

  console.log(
    `[SelfHeal] Klaar — gecontroleerd:${summary.feedsChecked} hersteld:${summary.retried} ai:${summary.aiFixed} dossiers:${summary.dossiersCreated} beslissingen:${summary.decisionsCreated} overgeslagen:${summary.skipped}`,
  );
  return summary;
}

async function logSkipped(feed: RssFeed, cause: Cause, reason: string): Promise<void> {
  try {
    await storage.createFeedRepairLog({
      feedId: feed.id, feedName: feed.name, cause, track: "skipped",
      outcome: "pending", message: `Overgeslagen: ${reason}.`, aiCallsUsed: 0,
    });
  } catch {
    // niet kritiek
  }
}
