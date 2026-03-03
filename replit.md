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
- **Routing**: Wouter
- **UI**: Radix UI with Tailwind CSS
- **Maps**: React Leaflet
- **Forms**: React Hook Form with Zod validation
- **Authentication**: Session-based with Passport.js

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ES modules)
- **Database ORM**: Drizzle ORM
- **Authentication**: Passport.js (local strategy, bcrypt)
- **Session Management**: Express-session
- **File Uploads**: Multer
- **Security**: Helmet, rate limiting

### Database Schema
PostgreSQL with entities for Users, Events, Favorites, Participants, Activity Logs, and Saved Searches.

### Key Features
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
- Schema: `shared/schema.ts` (onderaan: advertiser tables)
- Routes: `server/routes/advertiser-routes.ts`
- Stripe: `server/stripe.ts`
- Frontend: `client/src/pages/Advertiser/` (5 pagina's), `client/src/components/Advertiser/` (AuthGuard, Sidebar), `client/src/components/Ads/` (AdBanner, ExternalLinkInterstitial, PromotedEventsCarousel)

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