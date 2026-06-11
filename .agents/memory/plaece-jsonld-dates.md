---
name: Plaece/trefhetinoss JSON-LD stale top-level dates
description: Why Oss-style scrapers must read eventSchedule, not the top-level startDate, for the real event date
---

Plaece-CMS event sites (e.g. trefhetinoss.nl, assets.plaece.nl) publish JSON-LD where the
top-level `startDate`/`endDate` is a **stale publish/availability timestamp** (often months in
the past), while the real occurrence date(s) live in `eventSchedule[]` (an array of Schedule
objects with their own startDate/endDate).

**Why:** A parser that prefers top-level `startDate` reads a past date, then a "future date"
filter (`startDate < now` → skip) silently drops every event — the feed imports 0 with
"0 success, 0 errors" and no error. This is what broke the Oss feed sync.

**How to apply:** For these sources, prefer `eventSchedule`: sort occurrences ascending and pick
the next upcoming one (fall back to the earliest if all are past) so recurring/multi-day events
whose first occurrence already passed still import. Only fall back to the top-level
startDate/endDate when `eventSchedule` is absent. Do NOT inherit the top-level `endDate` onto a
chosen schedule occurrence — that broad window inflates the single occurrence's duration.
