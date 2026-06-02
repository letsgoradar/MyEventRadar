import type { Request } from "express";
import { resolveBrand, getDefaultBrand, type BrandConfig } from "@shared/brands";

/**
 * Bepaal het actieve merk voor een inkomende request op basis van de host
 * header. Valt veilig terug op het overkoepelende standaard-merk.
 */
export function getRequestBrand(req: Request): BrandConfig {
  const host = req.get("host") ?? "";
  return resolveBrand(host);
}

/**
 * Filter een lijst events op de categorie-focus van een merk. Overkoepelende
 * merken (categories === null) tonen alles ongewijzigd.
 */
export function filterEventsForBrand<T extends { category?: string | null }>(
  events: T[],
  brand: BrandConfig,
): T[] {
  if (!brand.categories) return events;
  const allowed = new Set(brand.categories);
  return events.filter((e) => e.category != null && allowed.has(e.category));
}

export { getDefaultBrand };
export type { BrandConfig };
