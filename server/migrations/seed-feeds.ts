import { db } from "../db";
import { rssFeeds } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

const FEEDS_CONFIG_PATH = path.join(process.cwd(), "server", "migrations", "feeds-config.json");

type FeedConfig = {
  name: string;
  url: string;
  feedType: string;
  province?: string;
  municipality?: string;
  defaultCategory: string;
  defaultLatitude?: string;
  defaultLongitude?: string;
  defaultAddress?: string;
  updateFrequencyMinutes: number;
  scraperConfig?: any;
  fieldMappings?: any;
};

const FEEDS: FeedConfig[] = [
  { name: "This Is Eindhoven Events", url: "https://www.thisiseindhoven.com/en/events", feedType: "scraper", province: "Noord-Brabant", municipality: "Eindhoven", defaultCategory: "Gezellig en Sociaal", defaultLatitude: "51.4416", defaultLongitude: "5.4697", defaultAddress: "Eindhoven Centrum", updateFrequencyMinutes: 120 },
  { name: "Visit Helmond", url: "https://www.visithelmond.nl/nl/agenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Helmond", defaultCategory: "Gezellig en Sociaal", defaultAddress: "Helmond, Netherlands", updateFrequencyMinutes: 1440 },
  { name: "Bezoek Meierijstad", url: "https://www.bezoekmeierijstad.nl/agenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Meierijstad", defaultCategory: "Gezellig en Sociaal", defaultLatitude: "51.6167", defaultLongitude: "5.5500", defaultAddress: "Veghel, Meierijstad", updateFrequencyMinutes: 720 },
  { name: "Bernheze Uitagenda", url: "https://www.mooibernheze.nl/agenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Bernheze", defaultCategory: "Kunst en Cultuur", updateFrequencyMinutes: 360 },
  { name: "Explore Maashorst Uitagenda", url: "https://www.exploremaashorst.nl/uitagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Maashorst", defaultCategory: "Kunst en Cultuur", updateFrequencyMinutes: 360 },
  { name: "Son en Breugel Evenementen", url: "https://www.sonenbreugel.nl/evenementenagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Son en Breugel", defaultCategory: "Kunst en Cultuur", updateFrequencyMinutes: 60 },
  { name: "s-Hertogenbosch - Zin in Den Bosch", url: "https://www.zinindenbosch.nl/api/events", feedType: "scraper", province: "Noord-Brabant", municipality: "s-Hertogenbosch", defaultCategory: "Cultuur & Entertainment", defaultLatitude: "51.6881", defaultLongitude: "5.3036", updateFrequencyMinutes: 60 },
  { name: "Beleef Boxtel", url: "https://www.beleefboxtel.nl/uitagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Boxtel", defaultCategory: "Kunst en Cultuur", updateFrequencyMinutes: 60 },
  { name: "Visit Vught", url: "https://www.visitvught.nl/agenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Vught", defaultCategory: "Kunst en Cultuur", updateFrequencyMinutes: 60 },
  { name: "Explore Breda", url: "https://www.explorebreda.com/nl/events", feedType: "scraper", province: "Noord-Brabant", municipality: "Breda", defaultCategory: "Kunst en Cultuur", updateFrequencyMinutes: 60 },
  { name: "Beleving in Oosterhout", url: "https://www.beleveninoosterhout.nl/uitagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Oosterhout", defaultCategory: "Kunst en Cultuur", updateFrequencyMinutes: 60 },
  { name: "Grensland De Baronie", url: "https://grenslanddebaronie.nl/evenementen/", feedType: "scraper", province: "Noord-Brabant", municipality: "Gilze en Rijen", defaultCategory: "Kunst en Cultuur", updateFrequencyMinutes: 60 },
  { name: "Tilburg Agenda", url: "https://tilburg.com/agenda-tilburg/", feedType: "scraper", province: "Noord-Brabant", municipality: "Tilburg", defaultCategory: "entertainment", updateFrequencyMinutes: 60 },
  { name: "Bezoek Oisterwijk", url: "https://www.bezoekoisterwijk.nl/uitagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Oisterwijk", defaultCategory: "Overig", defaultAddress: "Oisterwijk", updateFrequencyMinutes: 60 },
  { name: "IntoNijmegen Events", url: "https://www.intonijmegen.com/agenda/agenda-overzicht", feedType: "scraper", province: "Gelderland", municipality: "Nijmegen", defaultCategory: "Evenementen", defaultAddress: "Nijmegen", updateFrequencyMinutes: 60 },
  { name: "Zwolle Events", url: "https://www.visitzwolle.com/rss.xml/", feedType: "rss", province: "Overijssel", municipality: "Zwolle", defaultCategory: "Gezellig en Sociaal", updateFrequencyMinutes: 60 },
  { name: "Regio Utrecht/ Montfoort", url: "https://www.visitutrechtregion.com/nl/evenementen", feedType: "scraper", province: "Utrecht", municipality: "Montfoort", defaultCategory: "Gezellig en Sociaal", updateFrequencyMinutes: 60 },
  { name: "Cuijk", url: "https://www.landvancuijk.nl/agenda/", feedType: "scraper", province: "Noord-Brabant", municipality: "Cuijk", defaultCategory: "Gezellig en Sociaal", updateFrequencyMinutes: 60 },
  { name: "Leeuwarden", url: "https://www.visitleeuwarden.com/nl/agenda", feedType: "scraper", province: "Friesland", municipality: "Leeuwarden", defaultCategory: "community", updateFrequencyMinutes: 360 },
  { name: "Gemert-Bakel", url: "https://www.landvandepeel.nl/nl/agenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Gemert-Bakel", defaultCategory: "community", updateFrequencyMinutes: 360 },
  { name: "Tref het in Oss", url: "https://www.trefhetinoss.nl/uitagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Oss", defaultCategory: "Gezellig en Sociaal", updateFrequencyMinutes: 60 },
  { name: "Amersfoort", url: "https://www.tijdvooramersfoort.nl/nl/evenementen/volledige-uitagenda", feedType: "scraper", province: "Utrecht", municipality: "Amersfoort", defaultCategory: "community", updateFrequencyMinutes: 360 },
  { name: "Hilversum/ Gooi", url: "https://www.visitgooivecht.nl/nl/uitagenda", feedType: "scraper", province: "Noord-Holland", municipality: "Hilversum", defaultCategory: "community", updateFrequencyMinutes: 360 },
  { name: "Goedgestel", url: "https://www.goedgestel.nl/agenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Sint-Michielsgestel", defaultCategory: "community", updateFrequencyMinutes: 360 },
  { name: "Bommelerwaard - BommelerwaardNet", url: "https://www.bommelerwaard.net/agenda", feedType: "scraper", province: "Gelderland", municipality: "Zaltbommel", defaultCategory: "community", updateFrequencyMinutes: 60 },
  { name: "Bezoek De Langstraat - Waalwijk", url: "https://www.bezoekdelangstraat.nl/agenda/", feedType: "umbraco_api", province: "Noord-Brabant", municipality: "Waalwijk", defaultCategory: "community", updateFrequencyMinutes: 360, scraperConfig: {"type": "umbraco_api", "apiPath": "/umbraco/surface/agenda/filter", "agendaPath": "/agenda/"} },
  { name: "Dordrecht", url: "https://www.dordrecht.net/rss/agenda", feedType: "rss", province: "Zuid-Holland", municipality: "Dordrecht", defaultCategory: "community", updateFrequencyMinutes: 360 },
  { name: "visitmaastricht.com - Maastricht", url: "https://www.visitmaastricht.com/nl/uitagenda", feedType: "scraper", province: "Limburg", municipality: "Maastricht", defaultCategory: "community", updateFrequencyMinutes: 360, scraperConfig: {"hasJsonLd": true, "pagination": {"type": "query", "maxPages": 6, "paramName": "page"}, "aiGenerated": true, "cardSelector": "li.tiles__tile[itemtype*=\"schema.org/Event\"]", "preferJsonLd": true, "detailSelectors": {"date": "p.item__date", "title": "h1.item__title", "description": ".item-details__intro"}, "overviewSelectors": {"title": "span.tiles__title-txt", "eventCard": "li.tiles__tile[itemtype*=\"schema.org/Event\"]"}, "requiresJsRendering": false} },
  { name: "Heerlen Mijn Stad - Uitagenda", url: "https://heerlenmijnstad.nl/uitagenda", feedType: "scraper", province: "Limburg", municipality: "Heerlen", defaultCategory: "community", updateFrequencyMinutes: 360, scraperConfig: {"hasJsonLd": false, "aiGenerated": true, "cardSelector": "div:has(> a):has(img)", "detailSelectors": {"date": "figure.relative span.text-white/80", "title": "figure.relative h2", "description": "article div.prose"}, "overviewSelectors": {"date": "h6", "link": "a", "image": "img", "title": "h4", "eventCard": "div:has(> a):has(img)"}, "requiresJsRendering": true} },
  { name: "Assen", url: "https://www.ditisassen.nl/nl/agenda/agenda-overzicht", feedType: "scraper", province: "Drenthe", municipality: "Assen", defaultCategory: "community", updateFrequencyMinutes: 360 },
  { name: "Uit in de Regio - Land van Maas en Waal", url: "https://evenementen.uitinderegio.nl/landvanmaasenwaal/", feedType: "scraper", province: "Gelderland", municipality: "Rivierengebied", defaultCategory: "Gezellig en Sociaal", defaultLatitude: "51.8700", defaultLongitude: "5.3500", defaultAddress: "Rivierengebied, Gelderland", updateFrequencyMinutes: 360 },
  { name: "Uit in de Regio - Bommelerwaard", url: "https://evenementen.uitinderegio.nl/bommelerwaard/", feedType: "scraper", province: "Gelderland", municipality: "Bommelerwaard", defaultCategory: "Gezellig en Sociaal", defaultLatitude: "51.7700", defaultLongitude: "5.2000", defaultAddress: "Bommelerwaard, Gelderland", updateFrequencyMinutes: 360 },
  { name: "Uit in de Regio - Betuwe", url: "https://evenementen.uitinderegio.nl/betuwe/", feedType: "scraper", province: "Gelderland", municipality: "Betuwe", defaultCategory: "Gezellig en Sociaal", defaultLatitude: "51.8800", defaultLongitude: "5.4300", defaultAddress: "Betuwe, Gelderland", updateFrequencyMinutes: 360 },
  { name: "Uit in de Regio - West Betuwe", url: "https://evenementen.uitinderegio.nl/beleef-west-betuwe/", feedType: "scraper", province: "Gelderland", municipality: "West Betuwe", defaultCategory: "Gezellig en Sociaal", defaultLatitude: "51.8900", defaultLongitude: "5.1100", defaultAddress: "West Betuwe, Gelderland", updateFrequencyMinutes: 360 },
  { name: "I Amsterdam - Uitagenda", url: "https://www.iamsterdam.com/uit/agenda", feedType: "scraper", province: "Noord-Holland", municipality: "Amsterdam", defaultCategory: "Gezellig en Sociaal", defaultLatitude: "52.3676", defaultLongitude: "4.9041", defaultAddress: "Amsterdam", updateFrequencyMinutes: 360 },
];

function readFeedsConfig(): FeedConfig[] {
  try {
    if (fs.existsSync(FEEDS_CONFIG_PATH)) {
      const raw = fs.readFileSync(FEEDS_CONFIG_PATH, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

export function writeFeedsConfig(feeds: FeedConfig[]): void {
  try {
    fs.writeFileSync(FEEDS_CONFIG_PATH, JSON.stringify(feeds, null, 2), "utf8");
  } catch (err: any) {
    console.error("[Seed Feeds] Could not write feeds-config.json:", err.message);
  }
}

export function upsertFeedInConfig(feed: FeedConfig): void {
  const existing = readFeedsConfig();
  const idx = existing.findIndex(f => f.url === feed.url);
  if (idx >= 0) {
    existing[idx] = feed;
  } else {
    existing.push(feed);
  }
  writeFeedsConfig(existing);
}

export function removeFeedFromConfig(url: string): void {
  const existing = readFeedsConfig();
  const updated = existing.filter(f => f.url !== url);
  writeFeedsConfig(updated);
}

export async function seedFeeds(): Promise<void> {
  try {
    // One-time URL migrations: update old URLs to new ones before upsert loop
    const URL_RENAMES: Array<{ from: string; to: string }> = [
      { from: 'https://www.dordrecht.net/agenda', to: 'https://www.dordrecht.net/rss/agenda' },
    ];
    for (const rename of URL_RENAMES) {
      const [existing] = await db.select({ id: rssFeeds.id }).from(rssFeeds).where(eq(rssFeeds.url, rename.from));
      if (existing) {
        await db.update(rssFeeds).set({ url: rename.to }).where(eq(rssFeeds.id, existing.id));
        console.log(`[Seed Feeds] Migrated URL: ${rename.from} → ${rename.to}`);
      }
    }

    // Merge hardcoded FEEDS (baseline) with feeds-config.json (admin overrides).
    // Config wins for duplicate URLs so that admin edits to bundled feeds persist
    // across deployments. New entries in config are appended after the baseline.
    const configFeeds = readFeedsConfig();
    const feedMap = new Map<string, FeedConfig>();
    for (const f of FEEDS) feedMap.set(f.url, f);
    for (const f of configFeeds) feedMap.set(f.url, f); // config overrides bundled

    const allFeeds = Array.from(feedMap.values());
    const overrideCount = configFeeds.filter(f => FEEDS.some(b => b.url === f.url)).length;
    const newCount = configFeeds.length - overrideCount;

    if (configFeeds.length > 0) {
      console.log(`[Seed Feeds] feeds-config.json: ${overrideCount} override(s), ${newCount} new feed(s)`);
    }

    let inserted = 0;
    let updated = 0;

    for (const feed of allFeeds) {
      const [existing] = await db
        .select({ id: rssFeeds.id })
        .from(rssFeeds)
        .where(eq(rssFeeds.url, feed.url));

      if (existing) {
        await db
          .update(rssFeeds)
          .set({
            name: feed.name,
            feedType: feed.feedType,
            province: feed.province,
            municipality: feed.municipality,
            defaultCategory: feed.defaultCategory,
            defaultLatitude: feed.defaultLatitude || null,
            defaultLongitude: feed.defaultLongitude || null,
            defaultAddress: feed.defaultAddress || null,
            updateFrequencyMinutes: feed.updateFrequencyMinutes,
            scraperConfig: feed.scraperConfig || null,
            fieldMappings: feed.fieldMappings || null,
          })
          .where(eq(rssFeeds.id, existing.id));
        updated++;
      } else {
        await db.insert(rssFeeds).values({
          name: feed.name,
          url: feed.url,
          feedType: feed.feedType,
          status: "active",
          province: feed.province,
          municipality: feed.municipality,
          defaultCategory: feed.defaultCategory,
          defaultLatitude: feed.defaultLatitude || null,
          defaultLongitude: feed.defaultLongitude || null,
          defaultAddress: feed.defaultAddress || null,
          updateFrequencyMinutes: feed.updateFrequencyMinutes,
          autoCreateEvents: true,
          scraperConfig: feed.scraperConfig || null,
          fieldMappings: feed.fieldMappings || null,
        });
        inserted++;
      }
    }

    console.log(`[Seed Feeds] Done: ${inserted} added, ${updated} updated (${allFeeds.length} total: ${FEEDS.length} bundled, ${configFeeds.length} from config)`);
  } catch (error: any) {
    console.error('[Seed Feeds] Error:', error.message);
  }
}
