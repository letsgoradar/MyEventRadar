---
name: UiTdatabank (publiq) Search API auth
description: How to authenticate the UiTdatabank Search API scraper and how to read its error codes.
---

# UiTdatabank Search API (publiq) authentication

The scraper (`scrapeUiTdatabank` in rss-feed-service.ts) hits the **read-only Search API**
(`search.uitdatabank.be/offers/`). Publiq's recommended auth for read-only Search is
**client identification**: send the client id as an `X-Client-Id` header (or `?clientId=`
query param). The **client secret is NOT needed** for the Search API — it's only for
token/OAuth (Entry API / UiTPAS write access).

Env var: `UITDATABANK_CLIENT_ID` (code falls back to legacy `UITDATABANK_API_KEY`).

**Reading publiq auth errors (decisive for debugging):**
- `401 Unauthorized "api key is invalid"` → wrong/unknown credential value.
- `403 Forbidden "client id ... is not allowed to access this API"` → the credential is
  REAL and recognized, but the integration on platform.publiq.be is not linked/authorized
  to the Search API. This is an **account-side** fix (add Search API to the integration;
  test access is immediate, production must be activated by publiq) — NOT a code bug.

**Why:** we wasted a cycle assuming an invalid key when 403-vs-401 already told us the
client id was valid but unauthorized. Check the status code first.

**Environments:** test = `search-test.uitdatabank.be`, prod = `search.uitdatabank.be`.
New publiq integrations get TEST access immediately; PROD needs separate activation.

## Query parameters (validated live against the test API)
- `addressLocality` as a **URL query param is NOT supported** (404 "Unknown query
  parameter"), despite what the docs imply. Filter municipality via the advanced `q`
  field: `q=address.\*.addressLocality:<City>`. The **backslash before `*` is required**
  — `address.*.addressLocality` (no backslash) → 404 "Could not parse query". `\*`
  matches any address language. Do NOT wrap the city value in quotes → also "could not
  parse query".
- Default behaviour returns **Belgian results only**. For NL cities you must disable the
  default with the `addressCountry=*` URL param AND restrict via the advanced query
  `address.\*.addressCountry:NL`. Combine with ` AND `:
  `q=address.\*.addressCountry:NL AND address.\*.addressLocality:Groningen` + `addressCountry=*`.
- `dateFrom` must be a **full ISO-8601 datetime with an explicit offset**
  (`2026-06-07T00:00:00+00:00`). A bare date, or the `.000Z` form from
  `Date.toISOString()`, is rejected.
- Sort: only `created`/`modified` are valid sort fields. `sort[startDate]` and
  `sort[available]` → 404 "Invalid sort field". (We dropped sort; `dateFrom` already
  bounds to future events.)
- UiTdatabank is Belgium-centric: NL coverage is thin (test env had single-digit counts
  for most Dutch cities; some return 0). Set expectations accordingly.
- Endpoints: `/offers/` (events+places), `/events/`, `/places/`. Response items are in
  `data.member[]`; each `@id` ends in a UUID used for the externalId.
