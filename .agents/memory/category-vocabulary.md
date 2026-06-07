---
name: Category vocabulary is duplicated across many scraper maps
description: Changing the CATEGORIES enum requires updating many scattered string-literal maps that tsc cannot catch.
---

The canonical category list lives in `shared/schema.ts` (`CATEGORIES`), but the
**output values** of category classification are hardcoded as plain string literals in
many independent maps, most of them inside `server/services/rss-feed-service.ts`. These
are typed as `Record<string, string>`, so a value that is NOT a member of `CATEGORIES`
compiles fine — tsc will not flag it.

**Why this matters:** when a value falls outside `CATEGORIES`, the create/update path
rejects it (zod enum) and silently falls back to the feed's default category, so events
get misclassified with no error. A category rename/rework looks "done" after the schema
+ UI change but quietly breaks scraper category fidelity.

**How to apply:** after any change to `CATEGORIES`, grep the whole repo for the OLD
category strings as map *values* (e.g. `: 'Voorstelling'`, `return 'Stappen & Borrel'`)
and update every occurrence. Known clusters (as of the 8→13 rework): `UNSPLASH_CATEGORY_KEYWORDS`,
`detectCategory()` keyword map, iAmsterdam `categoryMap`, Heerlen `HEERLEN_CATEGORY_MAP`,
plus the UiTdatabank eventtype map. The neutral default fallback bucket is
`Rondleiding & Uitstap` (NOT a festive/nightlife category). The DB backfill of existing
rows is the `OLD_TO_NEW` map in `server/index.ts` startup.
