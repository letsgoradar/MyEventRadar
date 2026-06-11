import { db } from "../db";
import { sql, isNotNull } from "drizzle-orm";
import { storage } from "../storage";
import { rssFeedItems, type FeedSyncHistory } from "@shared/schema";

export type FeedHealthStatus = "healthy" | "warning" | "suspect" | "unknown";

export interface FeedHealth {
  feedId: number;
  status: FeedHealthStatus;
  reason: string;
  activeEvents: number;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
}

// "Wel veel gevonden maar niks geïmporteerd" telt pas als signaal vanaf dit aantal.
const FOUND_THRESHOLD = 5;
// Aantal recente syncs zonder nieuwe events voordat we waarschuwen.
const STALE_SYNC_COUNT = 3;
// Minimale catalogusgrootte voor de "geen nieuwe events"-waarschuwing.
const MIN_CATALOG = 10;

/**
 * Classify a feed's health from its recent sync history (newest first) and the
 * number of active (linked) events it currently has.
 *
 * The key failure mode this catches is the "Oss signature": a sync reports
 * success and finds many items, yet imports/updates 0 — meaning every event was
 * silently skipped (e.g. by a stale source date). That stays invisible in the
 * normal success/error status, so we surface it explicitly.
 */
export function classifyFeedHealth(
  history: FeedSyncHistory[],
  activeEvents: number,
): { status: FeedHealthStatus; reason: string } {
  if (!history || history.length === 0) {
    return { status: "unknown", reason: "Nog geen sync-gegevens beschikbaar." };
  }

  const latest = history[0];

  if (latest.success === false) {
    return {
      status: "suspect",
      reason: latest.errorMessage
        ? `Laatste sync mislukt: ${latest.errorMessage}`
        : "Laatste sync is mislukt.",
    };
  }

  const found = latest.totalFound ?? 0;
  const newE = latest.newEvents ?? 0;
  const updE = latest.updatedEvents ?? 0;

  // Oss-signatuur: wel items gevonden, maar 0 geïmporteerd én 0 bijgewerkt.
  if (found > FOUND_THRESHOLD && newE + updE === 0) {
    return {
      status: "suspect",
      reason: `Wel ${found} items gevonden, maar 0 geïmporteerd of bijgewerkt — waarschijnlijk een datum- of formaatprobleem bij de bron.`,
    };
  }

  // Bron leverde helemaal niets op.
  if (found === 0) {
    return {
      status: "warning",
      reason: "De bron leverde 0 items op bij de laatste sync.",
    };
  }

  // Geen nieuwe events over meerdere recente syncs, terwijl er wél een catalogus is.
  const recent = history.slice(0, STALE_SYNC_COUNT).filter((h) => h.success !== false);
  if (
    recent.length >= STALE_SYNC_COUNT &&
    recent.every((h) => (h.newEvents ?? 0) === 0) &&
    activeEvents >= MIN_CATALOG
  ) {
    return {
      status: "warning",
      reason: `Geen nieuwe events in de laatste ${recent.length} syncs (${activeEvents} in de catalogus). Mogelijk worden nieuwe events van de bron niet meer opgepikt.`,
    };
  }

  return {
    status: "healthy",
    reason: `Gezond — laatste sync: ${newE} nieuw, ${updE} bijgewerkt.`,
  };
}

/**
 * Compute health for all active feeds. Uses one grouped query for active-event
 * counts and a small history query per feed.
 */
export async function getFeedHealthMap(): Promise<Record<number, FeedHealth>> {
  const feeds = await storage.getAllRssFeeds();

  const countRows = await db
    .select({ feedId: rssFeedItems.feedId, cnt: sql<number>`COUNT(*)::int` })
    .from(rssFeedItems)
    .where(isNotNull(rssFeedItems.eventId))
    .groupBy(rssFeedItems.feedId);

  const counts: Record<number, number> = {};
  for (const row of countRows) counts[row.feedId] = Number(row.cnt);

  const map: Record<number, FeedHealth> = {};
  for (const feed of feeds) {
    if (feed.status !== "active") continue;
    const history = await storage.getSyncHistoryForFeed(feed.id, STALE_SYNC_COUNT + 5);
    const activeEvents = counts[feed.id] ?? 0;
    const { status, reason } = classifyFeedHealth(history, activeEvents);

    // Laatste GESLAAGDE import (success !== false). History is newest-first.
    const lastSuccessful = history.find((h) => h.success !== false && h.syncedAt);

    map[feed.id] = {
      feedId: feed.id,
      status,
      reason,
      activeEvents,
      lastSyncAt: history[0]?.syncedAt
        ? new Date(history[0].syncedAt).toISOString()
        : feed.lastFetchedAt
          ? new Date(feed.lastFetchedAt).toISOString()
          : null,
      lastSuccessfulSyncAt: lastSuccessful?.syncedAt
        ? new Date(lastSuccessful.syncedAt).toISOString()
        : null,
    };
  }
  return map;
}

// "Ongezonde" statussen waarvoor we waarschuwen.
const UNHEALTHY_STATUSES: FeedHealthStatus[] = ["warning", "suspect"];

// Per-feed alert state (in-memory). We waarschuwen edge-getriggerd: bij elke
// OMSLAG naar (of tussen) een ongezonde status, en daarna hooguit 1× per cooldown
// zolang de feed ongezond blijft. Zodra een feed herstelt, vergeten we de staat
// zodat een latere terugval opnieuw als omslag telt.
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const lastAlert = new Map<number, { status: FeedHealthStatus; at: number }>();

/**
 * Check all feeds and send a single grouped email for any feed that has
 * transitioned into an unhealthy state (warning or suspect). Re-alerts at most
 * once per cooldown while a feed stays unhealthy, and resets on recovery so a
 * later relapse alerts again. Safe to call fire-and-forget after a sync run.
 */
export async function checkFeedHealthAndAlert(): Promise<void> {
  try {
    const map = await getFeedHealthMap();
    const now = Date.now();

    const toAlert: FeedHealth[] = [];
    for (const h of Object.values(map)) {
      const isUnhealthy = UNHEALTHY_STATUSES.includes(h.status);
      const prev = lastAlert.get(h.feedId);

      if (!isUnhealthy) {
        // Hersteld (of gezond/onbekend) → vergeet staat zodat een latere
        // terugval opnieuw als omslag telt.
        if (prev) lastAlert.delete(h.feedId);
        continue;
      }

      // Ongezond: waarschuw bij een omslag (geen eerdere alert, of de ongezonde
      // status is veranderd, bijv. warning→suspect) of als de cooldown verlopen is.
      const transitioned = !prev || prev.status !== h.status;
      const cooldownElapsed = prev != null && now - prev.at >= ALERT_COOLDOWN_MS;
      if (transitioned || cooldownElapsed) {
        toAlert.push(h);
      }
    }

    if (toAlert.length === 0) return;

    const feeds = await storage.getAllRssFeeds();
    const named = toAlert.map((h) => ({
      name: feeds.find((f) => f.id === h.feedId)?.name ?? `Feed #${h.feedId}`,
      municipality: feeds.find((f) => f.id === h.feedId)?.municipality ?? null,
      status: h.status,
      reason: h.reason,
      activeEvents: h.activeEvents,
      lastSuccessfulSyncAt: h.lastSuccessfulSyncAt,
    }));

    const { sendFeedHealthAlert } = await import("./email-service");
    const sent = await sendFeedHealthAlert(named);
    if (sent) {
      for (const h of toAlert) lastAlert.set(h.feedId, { status: h.status, at: now });
    }
  } catch (err: any) {
    console.error("[FeedHealth] Fout bij gezondheidscontrole/alert:", err?.message ?? err);
  }
}
