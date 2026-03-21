import { db } from "../db";
import { rssFeeds } from "@shared/schema";
import { eq } from "drizzle-orm";

const FEEDS = [
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
  { name: "Dordrecht", url: "https://www.dordrecht.net/agenda", feedType: "scraper", province: "Zuid-Holland", municipality: "Dordrecht", defaultCategory: "community", updateFrequencyMinutes: 360 },
  { name: "visitmaastricht.com - Maastricht", url: "https://www.visitmaastricht.com/nl/uitagenda", feedType: "scraper", province: "Limburg", municipality: "Maastricht", defaultCategory: "community", updateFrequencyMinutes: 360, scraperConfig: {"hasJsonLd": true, "pagination": {"type": "query", "maxPages": 6, "paramName": "page"}, "aiGenerated": true, "cardSelector": "li.tiles__tile[itemtype*=\"schema.org/Event\"]", "preferJsonLd": true, "detailSelectors": {"date": "p.item__date", "title": "h1.item__title", "description": ".item-details__intro"}, "overviewSelectors": {"title": "span.tiles__title-txt", "eventCard": "li.tiles__tile[itemtype*=\"schema.org/Event\"]"}, "requiresJsRendering": false} },
  { name: "Heerlen Mijn Stad - Uitagenda", url: "https://heerlenmijnstad.nl/uitagenda", feedType: "scraper", province: "Limburg", municipality: "Heerlen", defaultCategory: "community", updateFrequencyMinutes: 360, scraperConfig: {"hasJsonLd": false, "aiGenerated": true, "cardSelector": "div:has(> a):has(img)", "detailSelectors": {"date": "figure.relative span.text-white/80", "title": "figure.relative h2", "description": "article div.prose"}, "overviewSelectors": {"date": "h6", "link": "a", "image": "img", "title": "h4", "eventCard": "div:has(> a):has(img)"}, "requiresJsRendering": true} },
  { name: "Assen", url: "https://www.ditisassen.nl/nl/agenda/agenda-overzicht", feedType: "scraper", province: "Drenthe", municipality: "Assen", defaultCategory: "community", updateFrequencyMinutes: 360 },
  { name: "Uit in de Regio - Rivierengebied", url: "https://evenementen.uitinderegio.nl/landvanmaasenwaal/", feedType: "scraper", province: "Gelderland", municipality: "Rivierengebied", defaultCategory: "Gezellig en Sociaal", defaultLatitude: "51.8700", defaultLongitude: "5.3500", defaultAddress: "Rivierengebied, Gelderland", updateFrequencyMinutes: 360 },
];

export async function seedFeeds(): Promise<void> {
  try {
    let inserted = 0;
    let updated = 0;

    for (const feed of FEEDS) {
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
            scraperConfig: (feed as any).scraperConfig || null,
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
          scraperConfig: (feed as any).scraperConfig || null,
        });
        inserted++;
      }
    }

    console.log(`[Seed Feeds] Done: ${inserted} added, ${updated} updated (${FEEDS.length} total in manifest)`);
  } catch (error: any) {
    console.error('[Seed Feeds] Error:', error.message);
  }
}
