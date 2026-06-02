import type { Request } from "express";
import {
  resolveBrand,
  getDefaultBrand,
  eventMatchesBrand,
  type BrandConfig,
} from "@shared/brands";
import { sql, inArray, or, type SQL } from "drizzle-orm";
import { events } from "@shared/schema";

/**
 * Bepaal het actieve merk voor een inkomende request op basis van de host
 * header. Valt veilig terug op het overkoepelende standaard-merk.
 */
export function getRequestBrand(req: Request): BrandConfig {
  const host = req.get("host") ?? "";
  return resolveBrand(host);
}

/**
 * Filter een lijst events op de focus van een merk. Overkoepelende merken
 * (categories === null) tonen alles ongewijzigd. Focus-merken accepteren een
 * event op categorie, titel-trefwoord of event-tag (zie eventMatchesBrand),
 * zodat ook mislabelde events alsnog op het merk verschijnen.
 */
export function filterEventsForBrand<
  T extends {
    category?: string | null;
    title?: string | null;
    tags?: (string | null)[] | null;
  },
>(events: T[], brand: BrandConfig): T[] {
  if (!brand.categories) return events;
  return events.filter((e) => eventMatchesBrand(e, brand));
}

/**
 * Bouw een SQL-conditie die overeenkomt met de focus van een merk, voor gebruik
 * in database-queries (city-methods). Spiegelt eventMatchesBrand: categorie OF
 * titel-trefwoord (ILIKE) OF event-tag (case-insensitive). Geeft undefined
 * terug voor het overkoepelende merk (geen filtering).
 */
export function buildBrandEventCondition(
  brand: BrandConfig,
): SQL | undefined {
  if (!brand.categories || brand.categories.length === 0) return undefined;

  const clauses: SQL[] = [inArray(events.category, brand.categories)];

  if (brand.matchKeywords && brand.matchKeywords.length > 0) {
    for (const kw of brand.matchKeywords) {
      clauses.push(sql`${events.title} ILIKE ${"%" + kw + "%"}`);
    }
  }

  if (brand.matchTags && brand.matchTags.length > 0) {
    const lowered = brand.matchTags.map((t) => t.toLowerCase());
    clauses.push(
      sql`EXISTS (SELECT 1 FROM unnest(${events.tags}) AS bt WHERE lower(bt) = ANY(${lowered}))`,
    );
  }

  return or(...clauses);
}

export { getDefaultBrand };
export type { BrandConfig };
