---
name: RSS sync history must cover every sync path
description: Why per-feed sync_history rows go stale/empty and the invariant that prevents it
---

# RSS sync history recording

**Rule:** Every code path that runs a feed sync must write exactly one
`feed_sync_history` row (success AND every failure branch). Route all of them
through the single `recordSyncHistory()` helper in `rss-feed-service.ts`.

**Why:** Admin sync reporting once looked stale/empty for most feeds because only
the manual single-feed sync recorded history, while the bulk/auto scheduler path
did not. There are several distinct sync entry points (manual single, bulk/auto)
and each has multiple exits: success, an early `!result.success` return (scraper
returns `{success:false}` WITHOUT throwing), and a thrown-error catch. Missing any
one exit silently drops a feed's history.

**How to apply:** When adding/altering a sync path, ensure history is recorded on:
(1) success, (2) the non-throwing `!result.success` branch, (3) the catch. Don't
inline a `createSyncHistory` call — extend/use `recordSyncHistory()` so incomplete
counts and `pagesProcessed` stay consistent.

**Reporting semantics:** `pagesProcessed` is `null` for non-paginated/non-tracked
scrapers, `>=1` = pages attempted. "Skipped events" perception is usually past-dated
events being hidden (app shows only upcoming), not a scraper bug — check upcoming vs
total before assuming pagination is broken.
