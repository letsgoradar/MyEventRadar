import { db } from "../db";
import { sql, isNotNull, eq, and } from "drizzle-orm";
import { storage } from "../storage";
import {
  rssFeedItems,
  rssFeeds,
  events,
  feedQualityChecks,
  qualityCheckIssues,
  feedSyncHistory,
  type FeedSyncHistory,
} from "@shared/schema";
import { classifyFeedHealth } from "./feed-health";
import { classifyFeedPlatform, PLATFORM_FAMILIES } from "./feed-platform";

export type SourceStatus = "green" | "orange" | "red" | "paused";

export interface SourceFeedInfo {
  feedId: number;
  platform: string;
  status: SourceStatus;
  reason: string;
  neverSynced: boolean;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncSuccess: boolean | null;
  lastNewEventAt: string | null;
  activeEvents: number;
  futureEvents: number;
  totalFound: number;
  imported: number;
  catchRate: number | null; // 0..100, null als onbekend
  dropoutReasons: Array<{ reason: string; count: number }>;
  openIssues: { error: number; warning: number };
}

// Ouder dan dit (dagen) zonder geslaagde sync = rood voor actieve feeds.
const STALE_RED_DAYS = 30;
// Ouder dan dit = oranje.
const STALE_ORANGE_DAYS = 14;
// Vangstpercentage-drempel voor oranje (bij voldoende gevonden items).
const LOW_CATCH_RATE = 30;
const LOW_CATCH_MIN_FOUND = 10;

const DROPOUT_LABELS: Record<string, string> = {
  missing_date: "Geen datum gevonden",
  incomplete: "Onvolledige gegevens",
  skipped: "Overgeslagen (bijv. locatie buiten bereik)",
  startTime: "Starttijd ontbreekt",
  location: "Locatie ontbreekt",
  latitude: "GPS-coördinaten ontbreken",
  longitude: "GPS-coördinaten ontbreken",
  description: "Beschrijving ontbreekt",
  imageUrl: "Afbeelding ontbreekt",
  title: "Titel ontbreekt",
};

function daysAgo(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Volledige gezondheids-/opbrengstdata per feed voor het Bronnenbeheer-dashboard.
 */
export async function getSourceManagementData(): Promise<Record<number, SourceFeedInfo>> {
  const feeds = await storage.getAllRssFeeds();

  // Gekoppelde (actieve) events per feed
  const activeRows = await db
    .select({ feedId: rssFeedItems.feedId, cnt: sql<number>`COUNT(*)::int` })
    .from(rssFeedItems)
    .where(isNotNull(rssFeedItems.eventId))
    .groupBy(rssFeedItems.feedId);
  const activeCounts: Record<number, number> = {};
  for (const r of activeRows) activeCounts[r.feedId] = Number(r.cnt);

  // Toekomstige events per feed
  const futureRows = await db
    .select({ feedId: rssFeedItems.feedId, cnt: sql<number>`COUNT(*)::int` })
    .from(rssFeedItems)
    .innerJoin(events, eq(events.id, rssFeedItems.eventId))
    .where(and(sql`${events.startTime} > NOW()`, sql`${events.deletedAt} IS NULL`))
    .groupBy(rssFeedItems.feedId);
  const futureCounts: Record<number, number> = {};
  for (const r of futureRows) futureCounts[r.feedId] = Number(r.cnt);

  // Uitval per feed: item-processing-statussen (missing_date / incomplete / skipped)
  const statusRows = await db
    .select({
      feedId: rssFeedItems.feedId,
      status: rssFeedItems.processingStatus,
      cnt: sql<number>`COUNT(*)::int`,
    })
    .from(rssFeedItems)
    .where(sql`${rssFeedItems.eventId} IS NULL`)
    .groupBy(rssFeedItems.feedId, rssFeedItems.processingStatus);
  const dropoutByFeed: Record<number, Record<string, number>> = {};
  for (const r of statusRows) {
    if (!r.status || r.status === "processed") continue;
    (dropoutByFeed[r.feedId] ??= {})[r.status] = Number(r.cnt);
  }

  // Meest recente sync-moment met minimaal 1 nieuw event, per feed
  const lastNewRows = await db
    .select({
      feedId: feedSyncHistory.feedId,
      last: sql<string>`MAX(${feedSyncHistory.syncedAt})`,
    })
    .from(feedSyncHistory)
    .where(sql`${feedSyncHistory.newEvents} > 0`)
    .groupBy(feedSyncHistory.feedId);
  const lastNewEventByFeed: Record<number, string> = {};
  for (const r of lastNewRows) {
    if (r.last) lastNewEventByFeed[r.feedId] = new Date(r.last).toISOString();
  }

  // Openstaande kwaliteitsissues per feed (via laatste quality checks)
  const issueRows = await db
    .select({
      feedId: feedQualityChecks.feedId,
      severity: qualityCheckIssues.severity,
      cnt: sql<number>`COUNT(*)::int`,
    })
    .from(qualityCheckIssues)
    .innerJoin(feedQualityChecks, eq(feedQualityChecks.id, qualityCheckIssues.qualityCheckId))
    .where(sql`${qualityCheckIssues.isResolved} IS NOT TRUE`)
    .groupBy(feedQualityChecks.feedId, qualityCheckIssues.severity);
  const issuesByFeed: Record<number, { error: number; warning: number }> = {};
  for (const r of issueRows) {
    const e = (issuesByFeed[r.feedId] ??= { error: 0, warning: 0 });
    if (r.severity === "error") e.error += Number(r.cnt);
    else if (r.severity === "warning") e.warning += Number(r.cnt);
  }

  const map: Record<number, SourceFeedInfo> = {};

  for (const feed of feeds) {
    const history: FeedSyncHistory[] = await storage.getSyncHistoryForFeed(feed.id, 8);
    const latest = history[0];
    const lastSuccessful = history.find((h) => h.success !== false && h.syncedAt);
    const activeEvents = activeCounts[feed.id] ?? 0;
    const neverSynced = history.length === 0;

    const totalFound = latest?.totalFound ?? 0;
    const imported = (latest?.newEvents ?? 0) + (latest?.updatedEvents ?? 0);
    const catchRate =
      latest && totalFound > 0 ? Math.round((imported / totalFound) * 100) : null;

    // Uitvalredenen: incompleteReasons uit laatste sync + item-statussen
    const reasons: Record<string, number> = {};
    if (latest?.incompleteReasons) {
      for (const [k, v] of Object.entries(latest.incompleteReasons)) {
        const label = DROPOUT_LABELS[k] ?? k;
        reasons[label] = (reasons[label] ?? 0) + Number(v);
      }
    }
    for (const [status, cnt] of Object.entries(dropoutByFeed[feed.id] ?? {})) {
      const label = DROPOUT_LABELS[status] ?? status;
      reasons[label] = Math.max(reasons[label] ?? 0, cnt);
    }
    const dropoutReasons = Object.entries(reasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Statusbepaling groen/oranje/rood
    let status: SourceStatus;
    let reason: string;
    const successAge = daysAgo(lastSuccessful?.syncedAt ?? null);

    if (feed.status === "paused") {
      status = "paused";
      reason = "Feed is gepauzeerd.";
    } else if (feed.status === "error") {
      status = "red";
      reason = feed.lastErrorMessage
        ? `Feed staat op error: ${feed.lastErrorMessage}`
        : "Feed staat op error-status.";
    } else if (neverSynced) {
      status = "red";
      reason = "Nog nooit gesynchroniseerd — deze bron heeft nog geen enkele sync gedraaid.";
    } else if (latest?.success === false && !lastSuccessful) {
      status = "red";
      reason = latest.errorMessage
        ? `Alle recente syncs mislukt: ${latest.errorMessage}`
        : "Alle recente syncs zijn mislukt.";
    } else if (successAge !== null && successAge > STALE_RED_DAYS) {
      status = "red";
      reason = `Laatste geslaagde sync is ${Math.round(successAge)} dagen geleden.`;
    } else if ((issuesByFeed[feed.id]?.error ?? 0) > 0) {
      status = "red";
      reason = `${issuesByFeed[feed.id].error} openstaand(e) kwaliteitsissue(s) met ernst 'error'.`;
    } else {
      const base = classifyFeedHealth(history, activeEvents);
      if (base.status === "suspect") {
        status = "orange";
        reason = base.reason;
      } else if (base.status === "warning") {
        status = "orange";
        reason = base.reason;
      } else if (successAge !== null && successAge > STALE_ORANGE_DAYS) {
        status = "orange";
        reason = `Laatste geslaagde sync is ${Math.round(successAge)} dagen geleden.`;
      } else if (
        catchRate !== null &&
        catchRate < LOW_CATCH_RATE &&
        totalFound >= LOW_CATCH_MIN_FOUND
      ) {
        status = "orange";
        reason = `Laag vangstpercentage: slechts ${catchRate}% van ${totalFound} gevonden items geïmporteerd.`;
      } else if ((issuesByFeed[feed.id]?.warning ?? 0) > 0) {
        status = "orange";
        reason = `${issuesByFeed[feed.id].warning} openstaande kwaliteitswaarschuwing(en).`;
      } else {
        status = "green";
        reason = base.reason;
      }
    }

    map[feed.id] = {
      feedId: feed.id,
      platform: feed.platform || classifyFeedPlatform(feed),
      status,
      reason,
      neverSynced,
      lastSyncAt: latest?.syncedAt
        ? new Date(latest.syncedAt).toISOString()
        : feed.lastFetchedAt
          ? new Date(feed.lastFetchedAt).toISOString()
          : null,
      lastSuccessfulSyncAt: lastSuccessful?.syncedAt
        ? new Date(lastSuccessful.syncedAt).toISOString()
        : null,
      lastSyncSuccess: latest ? latest.success !== false : null,
      lastNewEventAt: lastNewEventByFeed[feed.id] ?? null,
      activeEvents,
      futureEvents: futureCounts[feed.id] ?? 0,
      totalFound,
      imported,
      catchRate,
      dropoutReasons,
      openIssues: issuesByFeed[feed.id] ?? { error: 0, warning: 0 },
    };
  }

  return map;
}

export interface CoverageMunicipality {
  municipality: string;
  province: string | null;
  feeds: Array<{
    id: number;
    name: string;
    status: string;
    platform: string;
    futureEvents: number;
    lastFetchedAt: string | null;
  }>;
  futureEvents: number;
  hasGap: boolean;
  gapReason: string | null;
}

// Onder dit aantal toekomstige events beschouwen we de dekking als "dun".
const THIN_COVERAGE_THRESHOLD = 5;

/**
 * Dekkingsoverzicht: per gemeente de feeds + aantal toekomstige events,
 * met markering van gaten (geen actieve feed of nauwelijks toekomstige events).
 */
export async function getCoverageOverview(): Promise<CoverageMunicipality[]> {
  const feeds = await storage.getAllRssFeeds();

  const futureRows = await db
    .select({ feedId: rssFeedItems.feedId, cnt: sql<number>`COUNT(*)::int` })
    .from(rssFeedItems)
    .innerJoin(events, eq(events.id, rssFeedItems.eventId))
    .where(and(sql`${events.startTime} > NOW()`, sql`${events.deletedAt} IS NULL`))
    .groupBy(rssFeedItems.feedId);
  const futureCounts: Record<number, number> = {};
  for (const r of futureRows) futureCounts[r.feedId] = Number(r.cnt);

  const byMunicipality: Record<string, CoverageMunicipality> = {};
  for (const feed of feeds) {
    const key = (feed.municipality || "Onbekend / niet gekoppeld").trim();
    const entry = (byMunicipality[key] ??= {
      municipality: key,
      province: feed.province || null,
      feeds: [],
      futureEvents: 0,
      hasGap: false,
      gapReason: null,
    });
    const fut = futureCounts[feed.id] ?? 0;
    entry.feeds.push({
      id: feed.id,
      name: feed.name,
      status: feed.status,
      platform: feed.platform || classifyFeedPlatform(feed),
      futureEvents: fut,
      lastFetchedAt: feed.lastFetchedAt ? new Date(feed.lastFetchedAt).toISOString() : null,
    });
    entry.futureEvents += fut;
    if (!entry.province && feed.province) entry.province = feed.province;
  }

  const list = Object.values(byMunicipality);
  for (const m of list) {
    const activeFeeds = m.feeds.filter((f) => f.status === "active");
    if (activeFeeds.length === 0) {
      m.hasGap = true;
      m.gapReason = "Geen actieve feed voor deze gemeente.";
    } else if (m.futureEvents === 0) {
      m.hasGap = true;
      m.gapReason = "Wel een actieve feed, maar 0 toekomstige events.";
    } else if (m.futureEvents < THIN_COVERAGE_THRESHOLD) {
      m.hasGap = true;
      m.gapReason = `Dunne dekking: slechts ${m.futureEvents} toekomstige events.`;
    }
  }

  return list.sort((a, b) => {
    if (a.hasGap !== b.hasGap) return a.hasGap ? -1 : 1;
    return a.futureEvents - b.futureEvents;
  });
}

export { PLATFORM_FAMILIES };
