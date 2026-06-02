---
name: RSS scraper dispatch & result contract
description: How feed scrapers are routed and the success-flag contract they must honor
---

# RSS scraper dispatch (server/services/rss-feed-service.ts)

All feed scraping is routed through ONE static helper `dispatchScraper(feed, options?)`.
processFeed (single sync), processFeeds (bulk sync), and previewFeed (full preview)
all call it. Test-mode preview (when a `limit` is set) intentionally stays on
`scrapeUniversal(..., { linkLimit })` for a fast smoke check.

**Why:** there used to be THREE separate if/else dispatch chains that drifted out of
sync. A feed (welkominommen.nl) existed only in the bulk chain, so single-sync/preview
fell through to the generic `scrapeUniversal` and imported only the first page (~20)
instead of all pages (~121). Add every new dedicated scraper to `dispatchScraper` only.

**Scraper result contract:** every scraper MUST return `{ success: true, items, ... }`
on success. Downstream code treats `if (!result.success)` as failure, so a scraper that
returns just `{ items, feedType }` (success undefined) is silently marked FAILED and
imports 0 events — even if it parsed events correctly. Four Overijssel scrapers
(Ommen/Hardenberg/Almelo/Zwolle) had this bug and never actually synced.

**How to apply:** when adding/editing a scraper, (1) register its URL branch in
`dispatchScraper`, (2) return `success: true` on the happy path. Note ordering of
`url.includes()` checks: more specific paths first (e.g.
`uitinderegio.nl/beleef-west-betuwe` before `uitinderegio.nl/betuwe`).
