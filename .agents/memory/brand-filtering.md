---
name: Brand event filtering
description: How multi-brand focus filtering decides which events show on focus-brand domains
---

# Brand event filtering (focus brands)

Focus brands (Marktenradar, Foodtruckfestivalradar) no longer filter purely on
top-level event `category`. An event is accepted when ANY of:
- `category` is in the brand's `categories`, OR
- event title contains one of the brand's `matchKeywords` (case-insensitive substring), OR
- one of the event's free-text `tags` matches a brand `matchTag` (case-insensitive).

The overkoepelend brand (`categories === null`, e.g. MyEventRadar) still shows everything.

**Why:** Some genuinely relevant events get imported under the wrong category
(e.g. a vlooienmarkt categorized "Voorstelling"), shrinking the focus-brand catalog.
Keyword/tag matching recovers them without loosening the overkoepelend brand.

**How to apply:** Two implementations must stay in lockstep or list and count APIs disagree:
- `eventMatchesBrand()` in `shared/brands.ts` — in-memory path (used by
  `filterEventsForBrand` in `server/brand.ts`; powers /api/events/nearby, /api/events/search, getAllEvents).
- `buildBrandEventCondition()` in `server/brand.ts` — Drizzle SQL path (used by
  storage city methods getEventsByCitySlug / getEventCountByCitySlug, which take a
  BrandConfig, not a categories array).

Keyword matching is **title-only** (not description) to keep precision high — bare
"markt" is intentionally excluded (matches supermarkt etc.); only compound market
words (braderie, rommelmarkt, vlooienmarkt, ...) are used.
