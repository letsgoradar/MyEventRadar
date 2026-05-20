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
  { name: "This Is Eindhoven Events", url: "https://www.thisiseindhoven.com/en/events", feedType: "scraper", province: "Noord-Brabant", municipality: "Eindhoven", defaultCategory: "Stappen & Borrel", defaultLatitude: "51.4416", defaultLongitude: "5.4697", defaultAddress: "Eindhoven Centrum", updateFrequencyMinutes: 120 },
  { name: "Visit Helmond", url: "https://www.visithelmond.nl/nl/agenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Helmond", defaultCategory: "Stappen & Borrel", defaultAddress: "Helmond, Netherlands", updateFrequencyMinutes: 1440 },
  { name: "Bezoek Meierijstad", url: "https://www.bezoekmeierijstad.nl/agenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Meierijstad", defaultCategory: "Stappen & Borrel", defaultLatitude: "51.6167", defaultLongitude: "5.5500", defaultAddress: "Veghel, Meierijstad", updateFrequencyMinutes: 720 },
  { name: "Bernheze Uitagenda", url: "https://www.mooibernheze.nl/agenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Bernheze", defaultCategory: "Voorstelling", updateFrequencyMinutes: 360 },
  { name: "Explore Maashorst Uitagenda", url: "https://www.exploremaashorst.nl/uitagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Maashorst", defaultCategory: "Activiteit", updateFrequencyMinutes: 360 },
  { name: "Son en Breugel Evenementen", url: "https://www.sonenbreugel.nl/evenementenagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Son en Breugel", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 60 },
  { name: "s-Hertogenbosch - Zin in Den Bosch", url: "https://www.zinindenbosch.nl/api/events", feedType: "scraper", province: "Noord-Brabant", municipality: "s-Hertogenbosch", defaultCategory: "Voorstelling", defaultLatitude: "51.6881", defaultLongitude: "5.3036", updateFrequencyMinutes: 60 },
  { name: "Beleef Boxtel", url: "https://www.beleefboxtel.nl/uitagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Boxtel", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 60 },
  { name: "Visit Vught", url: "https://www.visitvught.nl/agenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Vught", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 60 },
  { name: "Explore Breda", url: "https://www.explorebreda.com/nl/events", feedType: "scraper", province: "Noord-Brabant", municipality: "Breda", defaultCategory: "Voorstelling", updateFrequencyMinutes: 60 },
  { name: "Beleving in Oosterhout", url: "https://www.beleveninoosterhout.nl/uitagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Oosterhout", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 60 },
  { name: "Grensland De Baronie", url: "https://grenslanddebaronie.nl/evenementen/", feedType: "scraper", province: "Noord-Brabant", municipality: "Gilze en Rijen", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 60 },
  { name: "Tilburg Agenda", url: "https://tilburg.com/agenda-tilburg/", feedType: "scraper", province: "Noord-Brabant", municipality: "Tilburg", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 60 },
  { name: "Bezoek Oisterwijk", url: "https://www.bezoekoisterwijk.nl/uitagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Oisterwijk", defaultCategory: "Activiteit", defaultAddress: "Oisterwijk", updateFrequencyMinutes: 60 },
  { name: "Samen Dongen Agenda", url: "https://samendongen.nl/uitagenda?format=feed&type=rss", feedType: "rss", province: "Noord-Brabant", municipality: "Dongen", defaultCategory: "Voorstelling", defaultLatitude: "51.6269", defaultLongitude: "4.9367", defaultAddress: "Dongen, Noord-Brabant", updateFrequencyMinutes: 360 },
  { name: "IntoNijmegen Events", url: "https://www.intonijmegen.com/agenda/agenda-overzicht", feedType: "scraper", province: "Gelderland", municipality: "Nijmegen", defaultCategory: "Stappen & Borrel", defaultAddress: "Nijmegen", updateFrequencyMinutes: 60 },
  { name: "Wijchen Evenementen", url: "https://www.wijchenis.nl/agenda/", feedType: "scraper", province: "Gelderland", municipality: "Wijchen", defaultCategory: "Stappen & Borrel", defaultLatitude: "51.8069", defaultLongitude: "5.7381", defaultAddress: "Wijchen", updateFrequencyMinutes: 360 },
  { name: "Stad Wageningen Agenda", url: "https://www.stadwageningen.nl/agenda", feedType: "scraper", province: "Gelderland", municipality: "Wageningen", defaultCategory: "Voorstelling", defaultLatitude: "51.9644", defaultLongitude: "5.6647", defaultAddress: "Wageningen", updateFrequencyMinutes: 360 },
  { name: "Zwolle Events", url: "https://www.visitzwolle.com/rss.xml/", feedType: "rss", province: "Overijssel", municipality: "Zwolle", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 60 },
  { name: "Regio Utrecht/ Montfoort", url: "https://www.visitutrechtregion.com/nl/evenementen", feedType: "scraper", province: "Utrecht", municipality: "Montfoort", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 60 },
  { name: "Cuijk", url: "https://www.landvancuijk.nl/agenda/", feedType: "scraper", province: "Noord-Brabant", municipality: "Cuijk", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 60 },
  { name: "Leeuwarden", url: "https://www.visitleeuwarden.com/nl/agenda", feedType: "scraper", province: "Friesland", municipality: "Leeuwarden", defaultCategory: "Voorstelling", updateFrequencyMinutes: 360 },
  { name: "Gemert-Bakel", url: "https://www.landvandepeel.nl/nl/agenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Gemert-Bakel", defaultCategory: "Activiteit", updateFrequencyMinutes: 360 },
  { name: "Tref het in Oss", url: "https://www.trefhetinoss.nl/uitagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Oss", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 60 },
  { name: "Amersfoort", url: "https://www.tijdvooramersfoort.nl/nl/evenementen/volledige-uitagenda", feedType: "scraper", province: "Utrecht", municipality: "Amersfoort", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 360 },
  { name: "Hilversum/ Gooi", url: "https://www.visitgooivecht.nl/nl/uitagenda", feedType: "scraper", province: "Noord-Holland", municipality: "Hilversum", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 360 },
  { name: "Goedgestel", url: "https://www.goedgestel.nl/agenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Sint-Michielsgestel", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 360 },
  { name: "Visit Bergeijk", url: "https://www.visitbergeijk.nl/nl/uitagenda", feedType: "scraper", province: "Noord-Brabant", municipality: "Bergeijk", defaultCategory: "Activiteit", updateFrequencyMinutes: 360 },
  { name: "Bommelerwaard - BommelerwaardNet", url: "https://www.bommelerwaard.net/agenda", feedType: "scraper", province: "Gelderland", municipality: "Zaltbommel", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 60 },
  { name: "Bezoek De Langstraat - Waalwijk", url: "https://www.bezoekdelangstraat.nl/agenda/", feedType: "umbraco_api", province: "Noord-Brabant", municipality: "Waalwijk", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 360, scraperConfig: {"type": "umbraco_api", "apiPath": "/umbraco/surface/agenda/filter", "agendaPath": "/agenda/"} },
  { name: "Dordrecht", url: "https://www.dordrecht.net/rss/agenda", feedType: "rss", province: "Zuid-Holland", municipality: "Dordrecht", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 360 },
  { name: "visitmaastricht.com - Maastricht", url: "https://www.visitmaastricht.com/nl/uitagenda", feedType: "scraper", province: "Limburg", municipality: "Maastricht", defaultCategory: "Voorstelling", updateFrequencyMinutes: 360, scraperConfig: {"hasJsonLd": true, "pagination": {"type": "query", "maxPages": 6, "paramName": "page"}, "aiGenerated": true, "cardSelector": "li.tiles__tile[itemtype*=\"schema.org/Event\"]", "preferJsonLd": true, "detailSelectors": {"date": "p.item__date", "title": "h1.item__title", "description": ".item-details__intro"}, "overviewSelectors": {"title": "span.tiles__title-txt", "eventCard": "li.tiles__tile[itemtype*=\"schema.org/Event\"]"}, "requiresJsRendering": false} },
  { name: "Heerlen Mijn Stad - Uitagenda", url: "https://heerlenmijnstad.nl/uitagenda", feedType: "scraper", province: "Limburg", municipality: "Heerlen", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 360, scraperConfig: {"hasJsonLd": false, "aiGenerated": true, "cardSelector": "div:has(> a):has(img)", "detailSelectors": {"date": "figure.relative span.text-white/80", "title": "figure.relative h2", "description": "article div.prose"}, "overviewSelectors": {"date": "h6", "link": "a", "image": "img", "title": "h4", "eventCard": "div:has(> a):has(img)"}, "requiresJsRendering": true} },
  { name: "Assen", url: "https://www.ditisassen.nl/nl/agenda/agenda-overzicht", feedType: "scraper", province: "Drenthe", municipality: "Assen", defaultCategory: "Stappen & Borrel", updateFrequencyMinutes: 360 },
  { name: "Uit in de Regio - Land van Maas en Waal", url: "https://evenementen.uitinderegio.nl/landvanmaasenwaal/", feedType: "scraper", province: "Gelderland", municipality: "Rivierengebied", defaultCategory: "Stappen & Borrel", defaultLatitude: "51.8700", defaultLongitude: "5.3500", defaultAddress: "Rivierengebied, Gelderland", updateFrequencyMinutes: 360 },
  { name: "Uit in de Regio - Bommelerwaard", url: "https://evenementen.uitinderegio.nl/bommelerwaard/", feedType: "scraper", province: "Gelderland", municipality: "Bommelerwaard", defaultCategory: "Stappen & Borrel", defaultLatitude: "51.7700", defaultLongitude: "5.2000", defaultAddress: "Bommelerwaard, Gelderland", updateFrequencyMinutes: 360 },
  { name: "Uit in de Regio - Betuwe", url: "https://evenementen.uitinderegio.nl/betuwe/", feedType: "scraper", province: "Gelderland", municipality: "Betuwe", defaultCategory: "Stappen & Borrel", defaultLatitude: "51.8800", defaultLongitude: "5.4300", defaultAddress: "Betuwe, Gelderland", updateFrequencyMinutes: 360 },
  { name: "Uit in de Regio - West Betuwe", url: "https://evenementen.uitinderegio.nl/beleef-west-betuwe/", feedType: "scraper", province: "Gelderland", municipality: "West Betuwe", defaultCategory: "Stappen & Borrel", defaultLatitude: "51.8900", defaultLongitude: "5.1100", defaultAddress: "West Betuwe, Gelderland", updateFrequencyMinutes: 360 },
  { name: "I Amsterdam - Uitagenda", url: "https://www.iamsterdam.com/uit/agenda", feedType: "scraper", province: "Noord-Holland", municipality: "Amsterdam", defaultCategory: "Stappen & Borrel", defaultLatitude: "52.3676", defaultLongitude: "4.9041", defaultAddress: "Amsterdam", updateFrequencyMinutes: 360 },
  { name: "Uitagenda Rotterdam", url: "https://www.uitagendarotterdam.nl/agenda/", feedType: "umbraco_api", province: "Zuid-Holland", municipality: "Rotterdam", defaultCategory: "Stappen & Borrel", defaultLatitude: "51.9225", defaultLongitude: "4.47917", defaultAddress: "Rotterdam", updateFrequencyMinutes: 360 },
  { name: "Uitagenda Den Haag", url: "https://denhaag.com/nl/agenda", feedType: "scraper", province: "Zuid-Holland", municipality: "Den Haag", defaultCategory: "Stappen & Borrel", defaultLatitude: "52.0705", defaultLongitude: "4.3007", defaultAddress: "Den Haag", updateFrequencyMinutes: 360 },
  { name: "Uitagenda Delft", url: "https://www.indelft.nl/nl/uitagenda/uitagenda-delft", feedType: "scraper", province: "Zuid-Holland", municipality: "Delft", defaultCategory: "Stappen & Borrel", defaultLatitude: "52.0116", defaultLongitude: "4.3571", defaultAddress: "Delft", updateFrequencyMinutes: 360 },
  { name: "Visit Leiden", url: "https://www.visitleiden.nl/nl/agenda", feedType: "scraper", province: "Zuid-Holland", municipality: "Leiden", defaultCategory: "Voorstelling", defaultLatitude: "52.1601", defaultLongitude: "4.4970", defaultAddress: "Leiden, Netherlands", updateFrequencyMinutes: 1440 },
  { name: "Groene Hart Agenda", url: "https://www.groenehart.nl/agenda/overzicht", feedType: "scraper", province: "Zuid-Holland", municipality: "Groene Hart", defaultCategory: "Stappen & Borrel", defaultLatitude: "52.1100", defaultLongitude: "4.7300", defaultAddress: "Groene Hart, Nederland", updateFrequencyMinutes: 1440 },
  { name: "Welkom in Ommen", url: "https://www.welkominommen.nl/agenda-0/all/", feedType: "scraper", province: "Overijssel", municipality: "Ommen", defaultCategory: "Activiteit", defaultLatitude: "52.5161", defaultLongitude: "6.4191", defaultAddress: "Ommen, Overijssel", updateFrequencyMinutes: 360 },
  { name: "Visit Hardenberg", url: "http://www.visithardenberg.nl/agenda/vandaag/", feedType: "scraper", province: "Overijssel", municipality: "Hardenberg", defaultCategory: "Activiteit", defaultLatitude: "52.5779", defaultLongitude: "6.6183", defaultAddress: "Hardenberg, Overijssel", updateFrequencyMinutes: 360 },
  { name: "Uit in Almelo", url: "https://www.uitinalmelo.nl/uitagenda/all/", feedType: "scraper", province: "Overijssel", municipality: "Almelo", defaultCategory: "Activiteit", defaultLatitude: "52.3563", defaultLongitude: "6.6635", defaultAddress: "Almelo, Overijssel", updateFrequencyMinutes: 360 },
  { name: "Visit Zwolle", url: "https://www.visitzwolle.com/agenda/vandaag/", feedType: "scraper", province: "Overijssel", municipality: "Zwolle", defaultCategory: "Activiteit", defaultLatitude: "52.5168", defaultLongitude: "6.0830", defaultAddress: "Zwolle, Overijssel", updateFrequencyMinutes: 360 },
  { name: "In Zutphen", url: "https://www.inzutphen.nl/nl/uitagenda/alle-evenementen", feedType: "scraper", province: "Gelderland", municipality: "Zutphen", defaultCategory: "Activiteit", defaultLatitude: "52.1462", defaultLongitude: "6.1961", defaultAddress: "Zutphen, Gelderland", updateFrequencyMinutes: 360 },
  { name: "UiTdatabank Utrecht", url: "https://search.uitdatabank.be/offers/?addressLocality=Utrecht", feedType: "uitdatabank", province: "Utrecht", municipality: "Utrecht", defaultCategory: "Voorstelling", defaultLatitude: "52.0907", defaultLongitude: "5.1214", defaultAddress: "Utrecht", updateFrequencyMinutes: 1440 },
  { name: "UiTdatabank Groningen", url: "https://search.uitdatabank.be/offers/?addressLocality=Groningen", feedType: "uitdatabank", province: "Groningen", municipality: "Groningen", defaultCategory: "Voorstelling", defaultLatitude: "53.2194", defaultLongitude: "6.5665", defaultAddress: "Groningen", updateFrequencyMinutes: 1440 },
  { name: "UiTdatabank Almere", url: "https://search.uitdatabank.be/offers/?addressLocality=Almere", feedType: "uitdatabank", province: "Flevoland", municipality: "Almere", defaultCategory: "Activiteit", defaultLatitude: "52.3508", defaultLongitude: "5.2647", defaultAddress: "Almere", updateFrequencyMinutes: 1440 },
  { name: "UiTdatabank Middelburg", url: "https://search.uitdatabank.be/offers/?addressLocality=Middelburg", feedType: "uitdatabank", province: "Zeeland", municipality: "Middelburg", defaultCategory: "Activiteit", defaultLatitude: "51.4988", defaultLongitude: "3.6136", defaultAddress: "Middelburg, Zeeland", updateFrequencyMinutes: 1440 },
  { name: "UiTdatabank Lelystad", url: "https://search.uitdatabank.be/offers/?addressLocality=Lelystad", feedType: "uitdatabank", province: "Flevoland", municipality: "Lelystad", defaultCategory: "Activiteit", defaultLatitude: "52.5185", defaultLongitude: "5.4714", defaultAddress: "Lelystad, Flevoland", updateFrequencyMinutes: 1440 },
];

type FeedsConfigFile = {
  feeds: FeedConfig[];
  deleted: string[]; // tombstones: URLs of admin-deleted feeds (prevents re-seeding bundled entries)
};

function readFeedsConfigFile(): FeedsConfigFile {
  try {
    if (fs.existsSync(FEEDS_CONFIG_PATH)) {
      const raw = fs.readFileSync(FEEDS_CONFIG_PATH, "utf8");
      const parsed = JSON.parse(raw);
      // Handle legacy format (plain array)
      if (Array.isArray(parsed)) return { feeds: parsed, deleted: [] };
      if (parsed && typeof parsed === "object") {
        return {
          feeds: Array.isArray(parsed.feeds) ? parsed.feeds : [],
          deleted: Array.isArray(parsed.deleted) ? parsed.deleted : [],
        };
      }
    }
  } catch {
    // ignore parse/read errors
  }
  return { feeds: [], deleted: [] };
}

function writeFeedsConfigFile(data: FeedsConfigFile): void {
  try {
    fs.writeFileSync(FEEDS_CONFIG_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err: any) {
    console.error("[Seed Feeds] Could not write feeds-config.json:", err.message);
  }
}

export function upsertFeedInConfig(feed: FeedConfig): void {
  const data = readFeedsConfigFile();
  // Remove from tombstones (admin re-created a previously deleted feed)
  data.deleted = data.deleted.filter(u => u !== feed.url);
  const idx = data.feeds.findIndex(f => f.url === feed.url);
  if (idx >= 0) {
    data.feeds[idx] = feed;
  } else {
    data.feeds.push(feed);
  }
  writeFeedsConfigFile(data);
}

export function removeFeedFromConfig(url: string): void {
  const data = readFeedsConfigFile();
  // Remove from user-added feeds list
  data.feeds = data.feeds.filter(f => f.url !== url);
  // Add to tombstones so bundled feeds with this URL are also excluded on next seed
  if (!data.deleted.includes(url)) {
    data.deleted.push(url);
  }
  writeFeedsConfigFile(data);
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
    // Config feeds win for duplicate URLs so admin edits persist across deployments.
    // Tombstoned URLs (admin-deleted) are excluded even if present in hardcoded FEEDS.
    const { feeds: configFeeds, deleted: tombstones } = readFeedsConfigFile();
    const feedMap = new Map<string, FeedConfig>();
    for (const f of FEEDS) feedMap.set(f.url, f);
    for (const f of configFeeds) feedMap.set(f.url, f); // config overrides bundled
    // Remove tombstoned URLs from the merged map
    for (const url of tombstones) feedMap.delete(url);

    const allFeeds = Array.from(feedMap.values());
    const overrideCount = configFeeds.filter(f => FEEDS.some(b => b.url === f.url)).length;
    const newCount = configFeeds.length - overrideCount;

    if (configFeeds.length > 0 || tombstones.length > 0) {
      console.log(`[Seed Feeds] feeds-config.json: ${overrideCount} override(s), ${newCount} new, ${tombstones.length} tombstone(s)`);
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
