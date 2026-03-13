# letsgo radar - Community Event Discovery Platform

## Overview
letsgo radar is a full-stack web application designed for community event discovery and management. It enables users to find, create, and participate in local events, featuring a radar-style map visualization and comprehensive event management tools. The platform supports both mobile app-style and web interfaces, complete with administrative functionalities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build**: Vite
- **State Management**: TanStack Query
- **Routing**: Wouter (per-route Suspense boundaries + Error Boundary in App.tsx)
- **UI**: Radix UI with Tailwind CSS
- **Maps**: React Leaflet
- **Forms**: React Hook Form with Zod validation
- **Authentication**: Session-based with Passport.js (Local + Google OAuth20)
  - **AuthModal** (`client/src/components/Auth/AuthModal.tsx`): Single modal overlay with 3 views (welcome/login/register) rendered over the live map. Used in both WebLayout and App homepage.
  - Auth flow: anonymous browsing → AuthModal appears after 15 sec → login/register → on close, re-opens after 60 sec if still not logged in
  - Old routes (`/web/login`, `/web/register`, `/web/welcome`, `/app/login`, `/app/register`, `/app/welcome`) redirect to `/web` or `/app` respectively
  - Admin login: `/login`, `/admin/login`
  - Google OAuth: requires `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` env vars
  - Password requirements: min 8 chars + 1 uppercase + 1 lowercase + 1 digit (Zod backend + real-time frontend)
  - Email verification: register → check email → click link → login
  - Test user: `demo@letsgo.nl` / `demo1234`

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ES modules)
- **Database ORM**: Drizzle ORM
- **Authentication**: Passport.js (local strategy, bcrypt)
- **Session Management**: Express-session
- **File Uploads**: Multer
- **Security**: Helmet, rate limiting

### Database Schema
PostgreSQL with entities for Users, Events, Favorites, Participants, Activity Logs, Saved Searches, Hidden Events, and Password Reset Tokens.

### Key Features
- **Hidden Events**: Users can hide events (eye icon on cards). Stored in `hidden_events` table for logged-in users, sessionStorage for guests. Hook: `useHiddenEvents` (`client/src/hooks/useHiddenEvents.ts`). API: GET `/api/hidden-events`, POST/DELETE `/api/events/:id/hide`. Filter toggle in SplitView header. Hidden events filtered from map and list.
- **Map Integration**: Interactive Leaflet map with event markers, location-based discovery, street view, and geocoding.
- **Event Management**: Multi-category system, rich event creation (with optional AI image generation), scheduling, participant management, and pricing.
- **User Authentication & Authorization**: Session-based, role-based access control (user/admin), and profile management.
- **Search & Discovery**: Text, category, location-radius, and date range filtering with saved search functionality.
- **Public SEO Architecture**: Dual-architecture with React SPA for authenticated users and SEO-optimized public city landing pages. Features include JSON-LD, dynamic content, event listings, lead capture, and sitemap generation.
- **RSS Feed Import Principles**: Standardized rules for importing events (see detailed rules below).

### RSS Feed Import Richtlijnen

1. **Locatie Verificatie** (verplicht)
   - Alleen events met geverifieerde locatie importeren
   - Accepteer: GPS coördinaten, bekend venue, geocodeerbaar adres
   - Weiger: Events zonder locatie of met alleen regio-aanduiding

2. **Datum Gebonden** (verplicht)
   - Alleen events met specifieke datum of datumperiode
   - Weiger: Algemene activiteiten zonder specifieke datum

3. **Bron Afbeeldingen** (voorkeur)
   - Altijd afbeelding uit de bron gebruiken als beschikbaar
   - Alleen fallback naar stock images als geen bron-afbeelding

4. **Multi-dag Events** 
   - Events op meerdere aaneengesloten dagen als 1 event importeren
   - Startdatum en einddatum opslaan als bereik

5. **Duplicaat Detectie**
   - Check op bestaande events voordat je importeert
   - Detectie op: externalId, titel + locatie + startdatum

6. **Tijd Hantering** (kritiek)
   - Importeer starttijd/eindtijd ALLEEN als deze in de bron staat (JSON-LD, HTML, tekst)
   - Zoek altijd naar tijden: JSON-LD startDate (bijv. T20:15:00), "om XX.XX uur", "XX:XX - XX:XX"
   - Bij 2 verschillende tijden: automatisch bepalen welke begin- en eindtijd is
   - **NOOIT default/fake tijden invullen** (geen 10:00, 11:00, 22:00, 23:00 als fallback!)
   - Als geen tijd gevonden: startTime en endTime op `undefined` laten (niet invullen)
   - Liever geen tijd dan een foutieve tijd - gebruiker kan doorlinken naar bron
   - **EndTime Validatie**: Als endTime VOOR startTime ligt, wordt endTime uitgesloten (waarschijnlijk parsing error)
   - **Timezone**: ISO strings ZONDER timezone indicator (bijv. `2026-01-31T16:00:00`) als lokale Nederlandse tijd parsen, NIET als UTC. Gebruik `parseLocalDateTime()` helper.
   - **DST Handling**: `parseLocalDateTime()` detecteert automatisch zomer/wintertijd:
     - Zomertijd (CEST, UTC+2): april t/m september, en na 02:00 op laatste zondag maart
     - Wintertijd (CET, UTC+1): november t/m februari, en vanaf 02:00 op laatste zondag oktober
     - Dubbelzinnige 02:00-03:00 uur in oktober → standaardtijd (CET) wordt gebruikt

7. **Sync Strategie (upsert)** (kritiek)
   - Bij sync: **updaten** van bestaande events, NIET verwijderen/opnieuw aanmaken
   - Bestaande events herkennen via externalId in rss_feed_items
   - Behoud user interacties (favorites, participants, views, saves) bij updates
   - Alleen titel, beschrijving, locatie, datum/tijd, categorie, en externe URL worden geüpdatet
   - Afbeelding, tags, hostId, recurrence blijven ongewijzigd om handmatige edits te behouden

### Scraper Configuratie Best Practices

**BELANGRIJK: Bij het toevoegen of aanpassen van scrapers:**

1. **Altijd de bron-website controleren** voordat je een scraper configureert:
   - Bezoek de agenda pagina handmatig
   - Inspecteer de HTML om te zien hoe event links eruitzien
   - Let op: de overzichtspagina URL kan anders zijn dan de event detail URLs!

2. **Plaece CMS scrapers** (goedgestel.nl, visitvught.nl, etc.):
   - `agendaPath`: de URL van de overzichtspagina (bijv. `/agenda`)
   - `eventLinkPath`: de URL prefix van event detail links (bijv. `/activiteiten`)
   - `linkPattern`: regex die matcht op de event links
   - Deze kunnen VERSCHILLEN! Bijv. agenda op `/agenda` maar links naar `/activiteiten/123/event-naam`

3. **Veelvoorkomende fouten te vermijden:**
   - NIET aannemen dat event links dezelfde prefix hebben als de agenda pagina
   - ALTIJD het linkPattern baseren op de ECHTE links van de website
   - Bij 404 errors: check of de agendaPath nog klopt (websites veranderen soms hun URL structuur)
   - Bij 0 events gevonden: check of eventLinkPath en linkPattern matchen met de echte links

4. **Debugging scraper problemen:**
   - Logs tonen `[RSS] Page X: found Y new event links` - als Y=0, matcht de eventLinkPath niet
   - Test de website met curl: `curl -s "URL" | grep -oE 'href="[^"]*"' | head -50`

### Advertising System (nieuw)
Twee-producten advertentiesysteem:

**Product 1: Bedrijfsadvertenties (CPM-model)**
- Hospitality-bedrijven adverteren in ExternalLinkInterstitial
- Pay-per-impression, prijs schaalt met gekozen doelradius (5/10/15/20/25/30/40/50 km + landelijk)
- Auto-incasso via Stripe, budget-cap instelbaar
- Tabellen: `advertiser_profiles`, `business_ads`, `ad_impressions`

**Product 2: Gepromote Events (prepaid)**
- Events verschijnen als "Gepromoot" bovenaan zoekresultaten (max 2 tegelijk, carousel bij meer)
- Prepaid per periode (dag/week/maand), prijs schaalt met radius (5-50 km + landelijk)
- Landelijk (radius=0) bereikt alle gebruikers in Nederland
- Carousel met eerlijke rotatie (auto 8s), dot-indicators
- Tabel: `event_promotions`

**Prijsconfiguratie**: `pricing_config` tabel met radius × periode matrix, aanpasbaar via admin

**Routes**:
- Public: `/adverteren` (landingspagina met prijscalculator)
- Adverteerder: `/advertiser/register`, `/advertiser/dashboard`, `/advertiser/ads`, `/advertiser/promotions`, `/advertiser/billing`
- Backend: `/api/promotions/*`, `/api/advertiser/*`, `/api/ads/*`
- Admin: Admin → Promotions tab met 5 subtabs (advertenties goedkeuring, promoties, adverteerders, inkomsten, prijsbeheer)

**Bestanden**:
- Schema: `shared/schema.ts` (onderaan: advertiser tables + beta_feedback)
- Routes: `server/routes/advertiser-routes.ts`, `server/routes/feedback-routes.ts`
- Stripe: `server/stripe.ts`
- Email: `server/services/email-service.ts` (sendVerificationEmail + sendFeedbackNotification)
- Frontend: `client/src/pages/Advertiser/` (5 pagina's), `client/src/components/Advertiser/` (AuthGuard, Sidebar), `client/src/components/Ads/` (AdBanner, ExternalLinkInterstitial, PromotedEventsCarousel)

### Beta Feedback Systeem
- **Beta banner**: `client/src/components/BetaBanner.tsx` — sluitbare balk bovenaan alle niet-admin pagina's
- **Feedback widget**: `client/src/components/FeedbackWidget.tsx` — zwevende knop rechtsonder met formulier (type/bericht/rating/email)
- **Database**: `beta_feedback` tabel (feedbackType: bug/idee/vraag/anders, status: nieuw/gelezen/verwerkt)
- **API**: `POST /api/feedback` (public), `GET/PATCH /api/admin/feedback`, `GET /api/admin/feedback/stats`
- **E-mail**: Bij nieuwe feedback wordt notificatie gestuurd naar info@letsgoradar.com
- **Admin**: `/admin/feedback` — overzichtspagina met filters, statistieken en detail-dialoog

**Stripe**: Packages geïnstalleerd (`stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`). Vereist `STRIPE_SECRET_KEY` en optioneel `STRIPE_WEBHOOK_SECRET` environment variables.

### Event Ownership & Bedrijfsaccount Systeem

**RSS Events zonder eigenaar**: Alle RSS-geïmporteerde events hebben `hostId: null`. Ze verschijnen gewoon op de kaart maar staan niet onder iemands "Mijn Evenementen". Handmatig aangemaakte events krijgen de ingelogde gebruiker als hostId.

**Bedrijfsaccount (Adverteerdersprofiel) met e-mailverificatie**:
- Gebruiker maakt eerst een persoonlijk account aan (bestaand systeem)
- Daarna optioneel een bedrijfsaccount via `/advertiser/register` met verplicht bedrijfs e-mailadres
- Verificatie via e-mail link (24 uur geldig), token in `advertiser_profiles` tabel
- Na verificatie: status wordt "active", `emailVerified: true`
- Alleen geverifieerde bedrijfsaccounts kunnen events promoten
- E-mail service: `server/services/email-service.ts` (Nodemailer SMTP, fallback naar console in dev)
- SMTP config: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` environment variables
- Verificatie pagina: `/advertiser/verify` (toont status: success/expired/invalid/error)

**Promotie-flow**: Gebruikers met geverifieerd bedrijfsaccount zoeken events via een zoekbalk (niet handmatig ID invoeren), selecteren een event, kiezen periode + radius, en kopen de promotie. Je hoeft het event NIET te bezitten om het te promoten.

### Native App (Capacitor)
- **Framework**: Capacitor 7 wraps the React web app as a native Android/iOS app
- **App ID**: `nl.letsgoradar.app`
- **Web Dir**: `dist/public` (Vite build output)
- **Android**: Project in `android/` directory, open with Android Studio
- **iOS**: Not yet added (run `npx cap add ios` on a Mac with Xcode)
- **API URL**: Native apps need `VITE_API_URL` env var pointing to the deployed backend (e.g. `https://letsgoradar.replit.app`)
- **CORS**: Backend accepts requests from `capacitor://localhost` and `https://localhost`
- **Build workflow**:
  1. `npm run build` — builds frontend to `dist/public`
  2. `npx cap sync` — copies web assets to native projects
  3. Open in Android Studio (`npx cap open android`) or Xcode (`npx cap open ios`)
  4. Build and run from the IDE
- **Store requirements**: Privacy policy at `/privacy`, app icons in `client/public/images/`
- **Accounts**: Google Play (€25 one-time), Apple Developer (€99/year)

## External Dependencies

### Core
- **Database**: PostgreSQL
- **Maps**: OpenStreetMap (via Leaflet)
- **UI Components**: Radix UI
- **Styling**: Tailwind CSS
- **File Uploads**: Multer
- **Validation**: Zod
- **Payments**: Stripe (stripe, @stripe/stripe-js, @stripe/react-stripe-js)

### Optional Integrations
- **AI Image Generation**: Hugging Face API
- **Geocoding**: OpenStreetMap Nominatim

### Security Configuration
- **Session Secret**: `SESSION_SECRET` environment variable is **required** in production. In development, a random secret is generated automatically.
- **Auto-login Middleware**: Disabled by default. To enable in development, set both `NODE_ENV=development` and `ENABLE_AUTO_LOGIN=true`.
- **Content Security Policy**: Strict in production (no `unsafe-inline`/`unsafe-eval`). Relaxed in development for Vite HMR.
- **SSL Certificate Validation**: Enabled in production (`rejectUnauthorized: true`), disabled in development for self-signed certs.
- **Rate Limiting**: Auth routes (5/15min), general API (60/min), expensive endpoints (10/min), advertiser impressions/clicks (30/min per IP+ID).
- **Authorization**: All user-specific data routes (favorites, saved searches, notifications) require authentication and verify ownership.
- **Chat Routes**: State-changing conversation endpoints (create, delete, send message) require authentication.
- **Passwords**: Hashed with bcrypt (10 rounds). No hardcoded credentials in frontend forms.
- **Soft-Delete**: Events use a `deletedAt` column instead of permanent deletion. Admin can restore soft-deleted events via `POST /api/admin/events/:id/restore`. Hard delete available via `storage.hardDeleteEvent()` for permanent removal.
- **Audit Logging**: All destructive admin operations (user deletion, feed deletion, event deletion, bulk sync) are logged to the `activity_logs` table with admin ID, action details, IP and user-agent.
- **Production Guards**: `clearEvents()` and bulk seed/test scripts refuse to run when `NODE_ENV === 'production'`. `deleteEventsByFeedId()` requires explicit confirmation in production.
- **Data Backup**: Admin can export events and users as JSON via `POST /api/admin/backup/events` and `POST /api/admin/backup/users`.
- **AI Safeguards**: AI-created venues are validated for NL bounds (lat 50.7-53.6, lng 3.3-7.2). AI extraction profiles require minimum 40% confidence. RSS batch imports are limited to 500 items per feed.

### Broken Image Detection & Auto-Repair
- **Shared cache**: `client/src/lib/imageCache.ts` — `failedImageUrls` Set shared between EventCard and ClusterLayer map markers
- **Auto-reporting**: When images fail to load, event IDs are batched and sent to `POST /api/report-broken-images` every 30 seconds; server nullifies the broken imageUrl
- **CSP-compatible map markers**: ClusterLayer uses `addEventListener` instead of inline `onerror` (fixes CSP violations)
- **Admin endpoints**:
  - `GET /api/admin/image-health` — overview of image coverage, problematic domains, top image sources
  - `POST /api/admin/fix-broken-images` — bulk-fix by domain (`{domains: [...]}`) or event IDs (`{eventIds: [...]}`)
- **Known problematic domains**: `assets.plaece.nl`, `storage.pubble.nl` — flagged in image health reports

### Traffic Monitoring & Circuit Breaker
- **Middleware**: `server/middleware/traffic-monitor.ts` tracks requests/min and unique IPs
- **Thresholds**: Warning at 500 req/min, Critical at 2000 req/min
- **Email alerts**: Sent to info@letsgoradar.com when thresholds are crossed (max 1 alert/hour)
- **Circuit breaker**: Auto-activates at CRITICAL threshold, blocks non-essential API requests for 5 minutes
  - Allowed during pause: `/api/health`, `/api/auth/login`, `/api/auth/me`, admin endpoints
  - Auto-recovers after 5 min cooldown
- **Admin control**: `POST /api/admin/circuit-breaker` with `{enabled: true/false/null}` for manual override
- **Admin status**: `GET /api/admin/traffic-status` returns current traffic, circuit breaker state, alert history
- **Email templates**: Warning (amber), Critical (red), Circuit breaker on/off notifications

### Deployment Configuration
- **Type**: Autoscale — scales up/down based on traffic, cost-effective for variable usage
- **Build**: `npm run build` (Vite frontend + esbuild backend)
- **Run**: `npm run start` (`NODE_ENV=production node dist/index.js`)
- **Schedulers**: All schedulers are request-triggered (no setInterval/setTimeout):
  - RSS feed sync: runs on first request if last sync > 24h ago (fire-and-forget background task)
  - Notification check: runs on first request if last check > 1h ago
  - Promotion expiration: runs on first request if last check > 5min ago
- **Graceful Shutdown**: `SIGTERM`/`SIGINT` handlers close the database pool cleanly before exit. 10s forced timeout.
- **Unhandled Errors**: Global `unhandledRejection` and `uncaughtException` handlers log errors and trigger graceful shutdown.
- **Health Check**: `GET /api/health` returns database status, uptime, memory usage. Returns 503 if database is unreachable.
- **Cache Limits**: All in-memory caches (AI title/location/translation, geocoding) are capped at 500-1000 entries to prevent memory growth.

### Network Security (Session 4)
- **SSRF Protection**: `server/utils/url-validator.ts` blocks requests to private IPs (RFC 1918), localhost, metadata endpoints (169.254.x.x), and non-http(s) protocols. Applied to RSS feed fetching, Puppeteer, and feed analyzer.
- **Stripe Webhook**: Signature verification is now mandatory — rejects requests when `STRIPE_WEBHOOK_SECRET` is missing or signature is invalid.
- **WebSocket Hardening**: Max 200 concurrent connections, 5-minute idle timeout, 1KB max message size. Excess connections rejected with code 1013.
- **Request Limits**: JSON/urlencoded body limit reduced from 10MB to 2MB. Unsplash API calls have 10s timeout.
- **File Uploads**: Profile photo uploads validated (JPEG/PNG/GIF/WEBP only, 5MB max, server-generated filenames prevent path traversal).

### Attack Prevention (Session 4 continued)
- **Brute-Force Protection**: Per-account lockout after 10 failed attempts (30-min lockout). Tracked in-memory via `failedAttempts` map in `server/auth.ts`. IP-level rate limiting (5/15min) on auth routes.
- **Rate Limiting Layers**: Auth (5/15min), General API (60/min), Expensive endpoints like AI/geocoding (10/min), Admin (120/min), Ad impressions (30/min per IP+ad).
- **SQL Injection**: All queries use Drizzle ORM parameterized queries. No raw string concatenation found. `sql` tagged templates with `${}` interpolation are properly parameterized by Drizzle.
- **XSS Prevention**: `server/utils/sanitize.ts` provides `sanitizeRichText()`, `stripHtml()`, and `sanitizeUserInput()` using `sanitize-html`. Registration validates usernames with regex.
- **Input Validation**: Registration uses Zod schema (username regex, email format, password length 6-128). Events validated via `insertEventSchema.parse()`. Leads validated via `insertLeadSchema.safeParse()`.

### RSS Date Quality (Session 5)
- **Root Cause Fix**: `createEventFromFeedItem()` no longer falls back to `publishedAt` or `new Date()` when `startTime` is missing. Items without a parsed date are marked `processingStatus: 'missing_date'` instead of creating events with incorrect dates.
- **AI Date Rescue**: After each feed sync, `rescueMissingDates(feedId)` runs automatically. It fetches the source page for each `missing_date` item and uses Gemini AI to extract event dates from the page content. Max 20 AI lookups per feed sync.
  - Confidence >= 0.6: Item updated to `processingStatus: 'incomplete'` with AI-extracted date in `derivedData.parsedStartDate` for admin review.
  - Confidence < 0.6: Item stays as `missing_date` with AI analysis stored for reference.
- **Admin UI**: IncompleteItemsManager now has tabs (Incompleet / Datum ontbreekt / Alles). Shows AI date suggestions with confidence scores. Admins can accept AI dates or manually enter dates.
- **Manual Trigger**: `POST /api/admin/rss-feeds/:id/rescue-dates` allows admins to re-run AI date rescue for a specific feed.
- **Data Cleanup**: 73 events from March 3rd sync that had incorrect dates (sync date as start date) were soft-deleted.
- **Sensitive Data Logging**: Login credentials no longer logged even in development mode.

### AI Scraper Builder (Session 6-7)
- **3-Step Feed Wizard**: Feed Analyzer wizard now has a 3-step flow: 1) Feed zoeken (RSS/Atom/JSON), 2) AI Scraper Builder, 3) Handmatig (visuele editor)
- **AI Provider Model Selection**: `AiProvider.complete()` accepts `model: 'flash' | 'pro'` parameter. Default: `gemini-2.5-flash`. Pro: `gemini-2.5-pro` for complex analysis (4 retries, 500ms delay)
- **AI HTML Analyzer**: `AiHtmlAnalyzer.analyzeForScraper(url)` performs 2-step analysis:
  - Step A: Overview page — priority-ranked candidate detection (schema.org > tiles > items > cards > articles > links), exactSelector fallback for robust matching, pagination detection with estimated total events
  - Step B: Detail pages — fetches 2-3 detail pages, JSON-LD extraction with full event data (venue, address, dates, description), CSS selector fallback
  - Returns: overviewSelectors, detailSelectors, hasJsonLd, pagination, eventsOnPage, estimatedTotalEvents, sampleEvents, confidence score, suggestedFeedConfig
- **Candidate Card Detection**: Priority-based with `itemtype="schema.org/Event"` as highest priority. Each candidate includes exactSelector (actual CSS class names) for fallback. Containers (li, div, article) prioritized over `<a>` tags.
- **JSON-LD Integration**: Detail page JSON-LD automatically extracts name, description, venue, address, startDate, image. Falls back to HTML selectors for missing fields.
- **Backend Endpoint**: `POST /api/admin/rss-feeds/ai-scraper-analyze` — admin-only, calls analyzeForScraper
- **Frontend Integration**: New `ai-scraper` wizard step in `FeedAnalyzerModal.tsx` with:
  - Progress indicator (5 steps)
  - Confidence bar (green >70%, amber 50-70%, red <50%) with colored messages
  - Sample events preview with title, date, venue, address, category, description from real detail pages
  - JSON-LD badge, browser rendering badge, pagination info with page count and estimated total events
  - Collapsible AI reasoning section (Accordion)
  - "Handmatig aanpassen" pre-fills visual editor with AI-found selectors
  - Purple "AI" badges on AI-filled fields in configure step (removed on manual edit)
  - "Terug naar AI" button in configure step footer to navigate back to AI results
  - Auto-transition: when no usable feed is found (no RSS/Atom/iCal/JSON-LD), automatically starts AI Scraper analysis after 1.5s
- **Stepper Navigation**: Clickable breadcrumb: Feed zoeken → AI Scraper → Handmatig → Opslaan. AI Scraper step shows ✓ green (≥70%), ⚠ orange (50-69%), ✕ red (<50%) with confidence percentage badge
- **Scraper Opslaan**: "Scraper Opslaan" button in AI Scraper wizard directly saves the AI-generated config as a feed via `POST /api/admin/visual-configurator/save-config`. Creates both an AI extraction profile AND an RSS feed (feedType='scraper') with scraperConfig containing overviewSelectors, detailSelectors, pagination, and hasJsonLd flag.
- **Import Pipeline (scrapeUniversal)**: When a feed has `aiExtractionProfileId`, `scrapeUniversal()` tries AI profile selectors FIRST (Strategy 0) before falling back to WordPress API, Next.js, JSON-LD, Umbraco, Generic HTML. The `tryAiProfileSelectors` method: loads the saved profile selectors → extracts event links from overview pages using the AI-detected eventCard + link selectors → follows pagination → fetches detail pages in parallel (5 at a time) → extracts full event data via JSON-LD + CSS selectors.
- **Validation Relaxation**: `save-config` endpoint skips location selector requirement for AI-generated scrapers (`isAiGenerated` flag) since location data comes from detail page JSON-LD.
- **Tested**: visitmaastricht.com/nl/uitagenda — 24 events/page, 144 estimated total, 95% confidence, JSON-LD found
- **Tested**: heerlenmijnstad.nl/uitagenda — 87 events/page, 60% confidence, no JSON-LD, Puppeteer rendering, 72 events imported (Feed #69, Profile #25)

### AI Import Robustness (Session 10)
- **Pro→Flash Fallback**: `AiProvider.complete()` now falls back from Gemini Pro to Flash if Pro fails after 5 attempts. Flash gets 3 additional attempts.
- **JSON Cleaning**: Added JS comment removal (`//` and `/* */`) in `cleanJsonResponse()`. Single-quote → double-quote conversion moved before unquoted property name fix for better repair order.
- **Event Link Extraction**: Fixed relative URL resolution using full page URL as base (not just origin). When eventCard IS an `<a>` tag, href is extracted from the card itself.
- **Fallback Selector Selection**: Changed from first-match to best-match strategy — all candidate selectors are tested, the one matching most events wins.
- **Reasoning Fix**: When AI model returns no `reasoning` field, generate descriptive fallback text instead of `undefined`.
- **Request Timeout**: AI scraper analyze endpoint now has 180s timeout (`req.setTimeout(180000)`).
- **Selector Sanitization**: `sanitizeSelector()` auto-generalizes selectors with unique attribute values (e.g. `[data-item-id="4808"]` → `[data-item-id]`). Prevents AI from generating selectors that match only 1 item.
- **AI Prompt Update**: Added explicit instruction to never use unique attribute values in selectors.
- **Tested**: ditisassen.nl/nl/agenda/agenda-overzicht — Feed #70, Profile #27, 371 items across 16 pages → 284 events (87 merged duplicates), `[data-item-id]` selector, pagination `?page=N`
- **Pagination Auto-detect**: When AI profile has no stored pagination config, `tryAiProfileSelectors()` now auto-detects `?page=N` or `/page/N` patterns from the overview page HTML. Falls back to this when `scraperConfig.pagination` and `profile.pagination` are both empty.
- **Save-config Route**: Now passes `pagination` data from `scraperConfig.pagination` or `req.body.pagination` to the saved AI extraction profile.
- **Files**: `server/services/ai-provider.ts`, `server/services/ai-html-analyzer.ts`, `server/routes.ts`

### App Event Loading (Two-Phase Strategy)
- **Phase 1** (immediate): When the map first renders, calculates the visible area radius and fetches events for that radius with `windowDays=100`. Shows bouncing MapPin loading animation.
- **Phase 2** (background): After Phase 1 completes, silently fetches events for 200km radius (covers all of NL) with `windowDays=100`. No loading overlay shown.
- **Merged pool**: Both data sets are merged (deduplicated by event ID) into `allEvents`. Search/filters run on the full pool so search results include events outside the visible map.
- **No step-by-step radius expansion**: Previous approach (15→30→60→100→200→350→500km steps) was removed. Only 2 API calls per session.
- **AppLayout simplified**: Removed `originalEvents` state cache that caused stale data bugs. `displayedEvents` now works directly on `filteredEvents` prop.
- **Files**: `client/src/pages/App/index.tsx`, `client/src/components/App/AppLayout.tsx`, `client/src/lib/api.ts`