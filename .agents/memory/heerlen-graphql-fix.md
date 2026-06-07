---
name: Heerlen GraphQL fix
description: heerlenmijnstad.nl scraper — uses undocumented CraftCMS GraphQL endpoint, not HTML scraping
---

# Heerlen MijnStad — GraphQL-based scraper

**Why:** The site is Next.js App Router with full JS rendering. Static HTML only shows 4 events. The `/api/events` route returns HTTP 500. The universal scraper fails completely.

**How to apply:** The scraper calls `POST https://cms.heerlenmijnstad.nl/graphql` directly — no authentication required. Query `section: "uitagenda"` with type `"short"` or `"ongoing"`.

**GraphQL fields that work:**
- `id`, `title`, `slug`, `url`, `typeHandle`
- `eventStartdate`, `eventEnddate` (ISO 8601 with timezone, e.g. `2026-06-07T20:00:00+00:00`)
- `eventSummary` (short description, sometimes null)
- `eventLocation` (venue name/address string, sometimes null)
- `eventCategories { title }` (array, Heerlen-specific category names)
- `eventImage { url }` (object or null)

**Category types seen:** Kunst/street art, Grote evenementen, Jeugd/familie, Actief, Erfgoedjaar, De Stad als Speeltuin, Theater, Muziek, Sport, Markt, Beurs, Festival

**No GPS in API:** Must geocode `eventLocation` string via `geocodeWithMunicipalityValidation(venue, "Heerlen")`.

**"ongoing" vs "short":**
- `ongoing`: permanent attractions/tours with very long date ranges (start 2022, end 2026+)
- `short`: actual time-bound events — these are the main events to import
