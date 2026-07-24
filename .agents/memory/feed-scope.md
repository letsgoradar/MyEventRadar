---
name: Feed scope column
description: rss_feeds.scope column design and migration approach
---

Scope values: `landelijk` / `provincie` / `gemeente` / `venue`.

Added via `ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS scope TEXT`.

Default backfill logic:
- `municipality IS NULL AND province IS NULL` → `landelijk`
- `municipality IS NULL AND province IS NOT NULL` → `provincie`
- `municipality IS NOT NULL` → `gemeente`

**Why:** Provincie-level feeds (Friesland, Groningen, Zuid-Limburg, Hart van Limburg) cover many municipalities and needed to be distinguishable from gemeente-feeds in the admin UI filter.

**How to apply:**
- POST /api/admin/rss-feeds: include `scope` in body; defaults to null if omitted
- PATCH /api/admin/rss-feeds/:id: scope passes through via req.body → storage.updateRssFeed (no explicit handling needed)
- Admin UI filter: pill buttons (Alle / Gemeente / Provincie / Landelijk / Venue) + text search above the platform-grouped feeds table
- Admin UI badge: shown in the Type column alongside RSS/Scraper badge, via `getScopeBadge(feed.scope)`
