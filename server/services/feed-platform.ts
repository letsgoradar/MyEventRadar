import { db } from "../db";
import { rssFeeds } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";
import type { RssFeed } from "@shared/schema";

/**
 * Platformfamilies voor bronnenbeheer.
 * Eén fix op platformniveau = alle gemeenten op dat platform gefixt.
 */
export const PLATFORM_FAMILIES: Record<string, { label: string; description: string }> = {
  uitdatabank: {
    label: "UiTdatabank",
    description: "Officiële UiTdatabank Search API (publiq) — gestructureerde, gevalideerde eventdata.",
  },
  plaece: {
    label: "Plaece CMS",
    description: "Plaece-platform citymarketing-sites (visitXXX.nl) met JSON-LD eventdata.",
  },
  uitinderegio: {
    label: "Uit in de Regio",
    description: "evenementen.uitinderegio.nl regioportalen (zelfde platform, meerdere regio's).",
  },
  umbraco: {
    label: "Umbraco API",
    description: "Umbraco-CMS agenda's met JSON API (o.a. Uitagenda Rotterdam, De Langstraat).",
  },
  rss: {
    label: "RSS/Atom",
    description: "Standaard RSS-, Atom- of JSON-feeds.",
  },
  maatwerk: {
    label: "Maatwerk-scraper",
    description: "Site-specifieke HTML-scrapers zonder gedeeld platform.",
  },
};

// Domeinen die op het Plaece-platform draaien (afgeleid uit assets.plaece.nl beeldbron).
const PLAECE_DOMAINS = [
  "visithelmond", "bezoekmeierijstad", "exploremaashorst", "beleefboxtel",
  "visitvught", "beleveninoosterhout", "bezoekoisterwijk", "intonijmegen",
  "visitutrechtregion", "visitleeuwarden", "landvandepeel", "trefhetinoss",
  "tijdvooramersfoort", "visitgooivecht", "goedgestel", "visitmaastricht",
  "ditisassen", "landvancuijk",
];

/**
 * Classificeer een feed naar zijn platformfamilie op basis van
 * feed_type en URL-patronen. Onbekende bronnen vallen in 'maatwerk'.
 */
export function classifyFeedPlatform(feed: Pick<RssFeed, "url" | "feedType">): string {
  const url = (feed.url || "").toLowerCase();
  if (feed.feedType === "uitdatabank" || url.includes("uitdatabank.be")) return "uitdatabank";
  if (feed.feedType === "umbraco_api") return "umbraco";
  if (url.includes("uitinderegio.nl")) return "uitinderegio";
  if (PLAECE_DOMAINS.some((d) => url.includes(d))) return "plaece";
  if (feed.feedType === "rss" || feed.feedType === "atom" || feed.feedType === "json") return "rss";
  return "maatwerk";
}

/**
 * Backfill: geef elke feed zonder platformlabel automatisch een classificatie.
 * Idempotent — feeds met een (evt. handmatig gezet) label worden niet overschreven.
 */
export async function backfillFeedPlatforms(): Promise<number> {
  const unlabeled = await db.select().from(rssFeeds).where(isNull(rssFeeds.platform));
  let updated = 0;
  for (const feed of unlabeled) {
    const platform = classifyFeedPlatform(feed);
    await db.update(rssFeeds).set({ platform }).where(eq(rssFeeds.id, feed.id));
    updated++;
  }
  if (updated > 0) {
    console.log(`[FeedPlatform] ${updated} feeds automatisch geclassificeerd naar platformfamilie`);
  }
  return updated;
}
