---
name: Venue learning in RSS import
description: How learned venues + Nominatim throttling are wired into the main feed-import flow, and the rules that protect against generic-centroid pollution.
---

# Venue learning in the main RSS import flow

The `venues` table + `VenueService` (findVenue/findOrCreateVenue/findBestVenue) are the
self-improving location store. `createEventFromFeedItem` (the path most feeds use) now:
1. checks the learned venue DB BEFORE Nominatim (STEP 1b, after source-GPS), reusing
   stored GPS when within `MAX_DISTANCE_KM` (verified venues trusted beyond the limit), and
2. LEARNs the venue via `findOrCreateVenue` only after a real geocode succeeds.

**Why:** re-geocoding every venue every sync caused Nominatim 429 floods and the platform
forbids generic municipality-centroid locations — learned venues kill both problems.

**How to apply / invariants:**
- `findBestVenue(name)` ignores municipality (matches regional venues stored under a
  neighbouring gemeente); the caller MUST validate distance. Order: isVerified desc, usageCount desc.
- NEVER learn a venue when `usedFeedDefault` (feed centroid), `usedLearnedVenue` (already in DB),
  or `isSpecificVenueLocation()` is false. The last guard rejects generic names
  (`GENERIC_VENUE_NAMES`: gemeentehuis/centrum/markt/online/...) and coords within ~250m of the
  `getMunicipalityCentroid()` — these would pollute the DB with centroid points.
- Nominatim is globally throttled to >=1 req/sec via `throttleNominatim()` (promise-chain mutex).
- `geocodeMisses` Set negative-caches GENUINE not-found only — never 429/timeout, or transient
  failures would be wrongly suppressed for the rest of the session.
