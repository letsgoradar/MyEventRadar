---
name: Feed sync staleness rotation
description: Why bulk RSS sync must order feeds by lastFetchedAt NULLS FIRST
---
Bulk feed sync must process feeds ordered by `lastFetchedAt ASC NULLS FIRST`, never in table/insert order.
**Why:** With autoscale deployments (run can die mid-batch) and DEV_MAX_FEEDS caps, unordered selection meant feeds late in the list (high IDs) never got their first sync — 21+ feeds sat active-but-never-synced for months.
**How to apply:** Any new bulk/batch processing over feeds (or similar long lists in request-triggered schedulers) should prioritize never-processed and stalest items first, so partial runs still make global progress.
