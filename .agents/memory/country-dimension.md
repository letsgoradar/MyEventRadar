---
name: Per-country event separation (NL/BE) and brand country-awareness
description: How events are tagged by country and how a brand can be scoped to specific countries.
---

Events carry a free-text `country` column (`shared/schema.ts`). Rows from before the
column existed (and any untagged) are treated as **NL** everywhere.

Brand scoping by country is optional via `BrandConfig.countries?: string[]`
(`shared/brands.ts`). Rules to keep JS and SQL filters in lockstep:
- `eventMatchesBrand()` country-gates first (missing event country → "NL"), independent
  of category logic.
- `server/brand.ts` `buildBrandEventCondition()` mirrors it with
  `COALESCE(UPPER(events.country),'NL') = ANY(...)`, AND-combined with the category
  OR-group. `filterEventsForBrand()` must short-circuit only when there is neither a
  category focus NOR a country focus.

**Why:** the overkoepelend default brand has `categories:null` and no `countries`, so it
must keep returning everything (NL **and** BE) — that's how Belgian events show on the
current site today. A future Belgium-only brand sets `countries:['BE']` (categories may
stay null) to show only BE.

**UiTdatabank country mode:** a feed whose URL contains `?country=BE` (feedType
`uitdatabank`) triggers country-wide windowed scraping in `scrapeUiTdatabank`
(month-by-month slicing to stay under the ~10k deep-offset cap, `embed=true`, `/events/`).
Per-event country comes from the language-nested `location.address.{nl|fr|en|de}.addressCountry`.
The 500/feed runaway cap is raised to 40000 ONLY for these country feeds
(`isCountryFeed` check in the sync loop).

**Known blocker:** production `search.uitdatabank.be` returns 403 until publiq grants
Search API production access — an account-side action on platform.publiq.be, not a code
bug. Auth uses the `X-Client-Id` header (client id only, no secret).
