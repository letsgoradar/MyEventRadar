/**
 * SCRAPER MANIFEST
 * ================
 * Formele regels die gelden voor ALLE scrapers in MyEventRadar.
 * Elke scraper die niet aan deze regels voldoet wordt door de
 * quality-check-service gemarkeerd met een error of warning.
 *
 * Wijzigingen aan deze regels gelden onmiddellijk voor nieuwe syncs
 * én voor de handmatige quality-check in het admin-panel.
 */

// ---------------------------------------------------------------------------
// REGEL 1: GPS-UNICITEIT PER VENUE
// ---------------------------------------------------------------------------
//
// Elk event MOET op de coördinaten van zijn eigen venue staan.
// Het is VERBODEN om een centraal gemeentepunt te gebruiken voor
// events die op verschillende locaties plaatsvinden.
//
// Reden: een kaart waarop alle events op één punt clusteren is onbruikbaar
// voor gebruikers die op locatie zoeken.
//
// Implementatievereisten voor scrapers:
//   - Haal de coördinaten op uit de bron (JSON-LD, data-attributen, etc.)
//   - Gebruik bij ontbreken de KNOWN_VENUES registry uit municipality-validator.ts
//   - Val NOOIT terug op het lat/lon van de gemeente zelf
//   - Voeg ontbrekende venues toe aan KNOWN_VENUES in plaats van
//     Nominatim-requests (sneller + geen rate-limiting)
//
// Quality-check: 'shared_gps_coordinates'  severity: 'error'
//   Vlag feeds waarbij >50% van de events exact dezelfde coördinaten deelt.

export const RULE_GPS_UNIQUENESS = {
  id: "GPS_UNIQUENESS",
  description:
    "Elk event moet op de coördinaten van zijn eigen venue staan. " +
    "Een centraal gemeentepunt als vangnet is niet toegestaan.",
  qualityCheckType: "shared_gps_coordinates",
  severity: "error" as const,
  /** Drempelwaarde: fractie van events met identieke GPS waarboven de check triggert */
  threshold: 0.5,
};

// ---------------------------------------------------------------------------
// REGEL 2: HERHALENDE EVENEMENTEN ALS RECURRERENDE EVENT
// ---------------------------------------------------------------------------
//
// Een serie gelijke events (zelfde titel + zelfde venue, >1 toekomstige datum)
// MOET worden opgeslagen als één enkel event met een recurrence-waarde
// in plaats van als losse individuele events.
//
// Toegestane recurrence-waarden (zie shared/schema.ts):
//   'once'    — eenmalig event (standaard)
//   'daily'   — dagelijks
//   'weekly'  — wekelijks
//   'monthly' — maandelijks
//
// Implementatievereisten voor scrapers:
//   - Groepeer na het scrapen events op (title.toLowerCase(), location.toLowerCase())
//   - Als een groep ≥2 toekomstige datums bevat:
//       • Bereken het gemiddelde interval tussen opeenvolgende datums
//       • interval ≤ 1 dag  → 'daily'
//       • interval ≤ 8 dagen → 'weekly'
//       • interval ≤ 35 dagen → 'monthly'
//       • anders → bewaar max 2 als 'once' (onregelmatig)
//   - Bewaar alleen de EERSTE komende datum als representatief event
//   - Zet ParsedFeedItem.recurrence op de gedetecteerde waarde
//
// Quality-check: 'unmerged_recurring_events'  severity: 'warning'
//   Vlag feeds met ≥3 events die dezelfde (genormaliseerde) titel delen.

export const RULE_RECURRING_EVENTS = {
  id: "RECURRING_EVENTS",
  description:
    "Een serie gelijke events (zelfde naam + venue) moet worden opgeslagen " +
    "als één event met recurrence='weekly'/'monthly', niet als losse duplicaten.",
  qualityCheckType: "unmerged_recurring_events",
  severity: "warning" as const,
  /** Minimaal aantal events met dezelfde titel waarboven de check triggert */
  minOccurrences: 3,
};

// ---------------------------------------------------------------------------
// HULPFUNCTIE: detecteer recurrence op basis van datumintervallen
// ---------------------------------------------------------------------------

/**
 * Gegeven een gesorteerde lijst van toekomstige datums voor hetzelfde event,
 * bepaal het recurrence-patroon op basis van het gemiddelde interval.
 *
 * @returns 'daily' | 'weekly' | 'monthly' | 'once'
 */
export function detectRecurrenceFromDates(
  dates: Date[]
): "daily" | "weekly" | "monthly" | "once" {
  if (dates.length < 2) return "once";

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const diffDays =
      (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24);
    intervals.push(diffDays);
  }

  const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;

  if (avg <= 1.5) return "daily";
  if (avg <= 8) return "weekly";
  if (avg <= 35) return "monthly";
  return "once";
}

// ---------------------------------------------------------------------------
// HULPFUNCTIE: consolideer series naar één recurring event
// ---------------------------------------------------------------------------

/**
 * Verwerk een lijst ParsedFeedItems en zet series om naar één enkel event
 * met de juiste recurrence-waarde. Gebruikt in scrapers als postprocessing-stap.
 *
 * Vereist dat ParsedFeedItem een optioneel `recurrence` veld heeft.
 */
export function consolidateRecurringEvents<
  T extends {
    title: string;
    location?: string;
    startTime?: Date;
    recurrence?: string;
  }
>(items: T[], now = new Date()): T[] {
  const future = items.filter(
    (i) => i.startTime && i.startTime >= now
  );
  const past = items.filter(
    (i) => !i.startTime || i.startTime < now
  );

  // Groepeer toekomstige events op titel + venue
  const groups = new Map<string, T[]>();
  for (const item of future) {
    const key = `${item.title.toLowerCase().trim()}|${(item.location || "").toLowerCase().trim()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const consolidated: T[] = [];

  for (const [, group] of groups) {
    const sorted = [...group].sort(
      (a, b) => (a.startTime?.getTime() ?? 0) - (b.startTime?.getTime() ?? 0)
    );

    if (sorted.length < 2) {
      // Eenmalig event: gewoon toevoegen
      consolidated.push(...sorted);
      continue;
    }

    const dates = sorted.map((i) => i.startTime!);
    const recurrence = detectRecurrenceFromDates(dates);

    if (recurrence === "once") {
      // Onregelmatig patroon: bewaar max 2 als los event
      consolidated.push(...sorted.slice(0, 2));
    } else {
      // Regelmatig patroon: bewaar alleen de eerstvolgende datum, markeer als recurring
      const representative = { ...sorted[0], recurrence };
      consolidated.push(representative);
    }
  }

  // Voeg verlopen events altijd toe (niet dedupliceren)
  return [...consolidated, ...past];
}

// ---------------------------------------------------------------------------
// EXPORTEER ALLE REGELS ALS LIJST (gebruikt door quality-check-service)
// ---------------------------------------------------------------------------

export const SCRAPER_MANIFEST_RULES = [
  RULE_GPS_UNIQUENESS,
  RULE_RECURRING_EVENTS,
] as const;
