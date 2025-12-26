# letsgo radar - Community Event Discovery Platform

## Overview

letsgo radar is a full-stack web application for community event discovery and management, built with Express.js backend and React frontend. The application allows users to discover, create, and participate in local events with radar-style map visualization and comprehensive event management features. It supports both mobile app-style interface and web interface, with admin functionality for platform management.

**Brand**: letsgo radar
**Logo**: /public/images/letsgo-radar-logo.png

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and building
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **UI Framework**: Radix UI components with Tailwind CSS
- **Maps**: React Leaflet for map visualization
- **Forms**: React Hook Form with Zod validation
- **Authentication**: Session-based with Passport.js integration

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM
- **Authentication**: Passport.js with local strategy and bcrypt
- **Session Management**: Express-session with memory store
- **File Uploads**: Multer for profile photos and event images
- **Security**: Helmet for security headers, rate limiting

### Database Schema
The application uses PostgreSQL with the following main entities:
- **Users**: Authentication, profiles, and roles (user/admin)
- **Events**: Core event data with geolocation, categories, and timing
- **Favorites**: User favorite events
- **Participants**: Event participation tracking
- **Activity Logs**: Admin audit trail
- **Saved Searches**: User search preferences

## Key Components

### Map Integration
- Interactive map view using Leaflet
- Event markers with category-based styling
- Location-based event discovery with radius filtering
- Street view integration for event locations
- Geocoding for address resolution

### Event Management
- Multi-category event system with predefined categories
- Rich event creation with image generation capabilities
- Date/time scheduling with recurrence support
- Participant management and capacity limits
- Pricing support for paid events

### User Authentication & Authorization
- Session-based authentication with secure password hashing
- Role-based access control (user/admin)
- Admin dashboard with comprehensive management tools
- Profile management with photo uploads

### Search & Discovery
- Text-based event search
- Category-based filtering
- Location-radius filtering
- Date range filtering
- Saved search functionality

## Data Flow

### Event Discovery Flow
1. User location detection or manual location setting
2. Radius-based event fetching from backend
3. Client-side filtering based on search criteria
4. Map and list view rendering with real-time updates

### Event Creation Flow
1. Form validation using Zod schemas
2. Location selection via interactive map
3. Optional AI-powered image generation
4. Server-side validation and database insertion
5. Real-time UI updates via React Query

### Authentication Flow
1. Login/register via secure forms
2. Password hashing with bcrypt
3. Session creation and management
4. Protected route access control
5. Admin privilege escalation where needed

## External Dependencies

### Core Dependencies
- **Database**: PostgreSQL with Drizzle ORM for type-safe queries
- **Maps**: OpenStreetMap tiles via Leaflet
- **UI Components**: Radix UI for accessible component primitives
- **Styling**: Tailwind CSS with custom design system
- **Image Processing**: Multer for file uploads
- **Validation**: Zod for runtime type checking

### Development Dependencies
- **Build Tools**: Vite, esbuild for production builds
- **Type Checking**: TypeScript with strict configuration
- **Code Quality**: ESLint configuration
- **Testing**: React Testing Library setup

### Optional Integrations
- **AI Image Generation**: Hugging Face API for event image creation
- **Geocoding**: OpenStreetMap Nominatim for address resolution
- **Analytics**: Activity logging for admin insights

## Deployment Strategy

### Development Environment
- Replit-based development with hot module replacement
- PostgreSQL database provisioning via Replit
- Environment variable configuration for API keys
- Multi-port setup for frontend (5000) and API (3000)

### Production Deployment
- Google Cloud Run deployment target
- Build process: Vite for client, esbuild for server
- Static asset serving from Express
- Session management with production-ready store
- Security headers and rate limiting enabled

### Database Management
- Drizzle migrations for schema changes
- Seed scripts for development data
- Admin tools for user and event management
- Activity logging for audit trails

## RSS Feed Import Principes

Alle feeds moeten voldoen aan deze gestandaardiseerde regels (zie `server/config/rss-feed-rules.ts`):

1. **LOCATIE VERIFICATIE** - Alleen events met geverifieerde locatie importeren (GPS coördinaten, bekend venue, of succesvol ge-geocoded adres)
2. **DATUM GEBONDEN** - Alleen events met specifieke datum/datumperiode, geen algemene activiteiten
3. **BRON AFBEELDINGEN** - Altijd de afbeelding uit de bron gebruiken als beschikbaar
4. **MULTIDAG EVENTS** - Events op meerdere dagen als 1 event met datumbereik importeren
5. **DUPLICATE DETECTIE** - Events overslaan die al bestaan (check op titel+datum+locatie of bron-link)
6. **TIJD HANTERING** - Tijden meenemen als vindbaar, "onbekend" als niet - nooit random tijden invullen

API endpoint voor principes: `GET /api/admin/feed-import-principles`

## Public SEO Architecture

### Overview
The application implements a dual-architecture approach: React SPA for authenticated users and public SEO-optimized pages for discoverability.

### City Landing Pages
- URL pattern: `/:province/:city/evenementen` (e.g., `/noord-brabant/tilburg/evenementen`)
- Each city has a dedicated landing page with:
  - JSON-LD Event schema for Google structured data
  - Unique content variations per city (intro, description, CTA)
  - Event listings with category icons and date formatting
  - Lead capture form for email subscriptions

### Configuration Files
- `shared/cities.ts` - City configuration with slugs, provinces, coordinates, and `isActive` flags
- `shared/content.ts` - Content variation templates (intro variants, description variants, CTA variants)

### API Endpoints
- `GET /api/public/cities` - Get all active cities and provinces
- `GET /api/public/city/:citySlug?provinceSlug=...` - Get city info with content (validates province)
- `GET /api/public/events/:citySlug?provinceSlug=...` - Get events for city (validates province)
- `POST /api/leads` - Lead capture (Zod validated)
- `GET /sitemap.xml` - Dynamic sitemap based on active cities

### Lead Capture System
- Database table: `leads` (id, email, citySlug, source, createdAt)
- LeadForm component with success/loading states
- Duplicate detection prevents multiple signups

### Adding New Cities
1. Add city to `CITIES` array in `shared/cities.ts`:
   ```typescript
   { slug: 'amsterdam', name: 'Amsterdam', province: 'Noord-Holland', provinceSlug: 'noord-holland', latitude: 52.3676, longitude: 4.9041, isActive: true }
   ```
2. Sitemap.xml automatically includes new active cities
3. Content variations are generated based on city name and province

## Recent Changes
- December 26, 2025: **PUBLIC SEO CITY PAGES** - Publieke stadspagina's voor event discovery
  - Nieuwe `shared/cities.ts` met 5 steden: Tilburg, Den Bosch, Breda, Eindhoven, Veghel
  - Nieuwe `shared/content.ts` met content variaties voor unieke pagina's per stad
  - LeadForm component voor email capture met Zod validatie
  - CityPage met JSON-LD Event schema voor Google structured data
  - API endpoints: `/api/public/cities`, `/api/public/city/:citySlug`, `/api/public/events/:citySlug`, `/api/leads`
  - Automatische sitemap.xml generator op basis van actieve steden
  - Province slug validatie voor canonical URL's
  - Database tabel: `leads` (email, citySlug, source, createdAt)
- December 12, 2025: **INTELLIGENTE PAGINATIE-DETECTIE** - Standaard scraper nu met automatische paginatie
  - Nieuwe `detectPagination()` functie detecteert 5 paginatie-patronen:
    1. WordPress-style /page/N/ (zoals tilburg.com)
    2. Query string ?page=N of ?p=N
    3. Nederlandse /pagina/N/
    4. rel="next" links en .pagination-next buttons
    5. Numerieke paginatie (.page-numbers, nav.pagination)
  - Scraper volgt automatisch alle pagina's tot einde (max 30 pagina's)
  - Rate limiting: 300ms tussen pagina fetches
  - Limiet verhoogd naar 100 event links per feed (was 30)
- December 12, 2025: **TILBURG AGENDA SCRAPER V3 (PAGINATIE)** - Volledig gepagineerde scraper voor tilburg.com/agenda-tilburg/
  - URL-paginering toegevoegd: scrapt /agenda-tilburg/, /agenda-tilburg/page/2/, etc. tot einde
  - 278 unieke event links gevonden over 14 pagina's (was 21 op eerste pagina)
  - 261 Tilburg events succesvol geïmporteerd met exacte locaties
  - 35+ bekende Tilburg venue GPS coördinaten (Koepelhal, LocHal, 013, Pathé, Hall of Fame, etc.)
  - Parseert single-day en multi-day datum formaten
  - Rate limiting: 300ms tussen pagina fetches, 500ms tussen event detail fetches
- December 12, 2025: **INCOMPLETE EVENTS MANAGEMENT** - Admin workflow voor events die niet volledig geïmporteerd konden worden
  - Nieuwe `rss_item_corrections` tabel voor herbruikbare correcties
  - `rssFeedItems` uitgebreid met `processingStatus` (imported/incomplete/skipped), `missingFields`, `derivedData`
  - Admin UI tab "Onvolledige Items" in RSS Feeds pagina met bewerk/import/skip/delete acties
  - Import actie maakt event aan van gecorrigeerde incomplete item
  - 2131 bestaande incomplete items geïdentificeerd voor handmatige afhandeling
- December 12, 2025: **MUNICIPALITY BOUNDARY VALIDATION** - Geocoding validatie om events op verkeerde locaties te voorkomen
  - Nieuwe municipality-validator.ts met turf.js point-in-polygon checks
  - Graceful degradation: als polygon niet gevonden wordt, validatie overslaan met warning
  - Known venues cache voor ambigue adressen (Noordkade Veghel, Chocoladefabriek, etc.)
  - Geocoding fallback: gemeente suffix → provincie suffix → alleen Netherlands
  - 64 foutieve events verwijderd (46 Breda in Den Haag, 17 Veghel in Waddinxveen, 1 Barendrecht)
- December 12, 2025: **BREDA PREPR CMS SCRAPER** - Succesvol geïntegreerd met explorebreda.com
  - Ontdekt dat explorebreda.com Next.js gebruikt met Prepr CMS via __NEXT_DATA__ JSON extractie
  - GPS coördinaten extraheren via `coordinates.latitude/longitude` veld
  - Date handling voor `from`/`until` formaat (Prepr CMS specifiek)
  - Address formatting via `formatBredaAddress()` helper voor Prepr address objecten
  - 136 Breda events succesvol geïmporteerd met exacte locaties
  - Multi-day event consolidatie werkt: bijv. "Breda Straalt" (24 dagen) → 1 event
- December 11, 2025: **DEN BOSCH PAYLOAD CMS API** - Nieuwe integratie met zinindenbosch.nl via Payload CMS REST API
  - Ontdekt dat zinindenbosch.nl Payload CMS gebruikt met publieke REST API
  - `/api/events` endpoint levert 388 events met exacte GPS coördinaten
  - Nieuwe scraper haalt events op via API in plaats van HTML scraping
  - 221 Den Bosch events geïmporteerd met exacte locaties en afbeeldingen
  - Payload CMS data structuur: eventDates[], location.gps{lat,long}, teaserImage[]
- December 11, 2025: **FEED IMPORT PRINCIPES** - Gestandaardiseerde import regels voor alle RSS feeds
  - Duplicate detectie toegevoegd aan import service
  - 252 bestaande duplicaten opgeschoond uit database (878 unieke events behouden)
  - Feed configuratie principes vastgelegd in server/config/rss-feed-rules.ts
  - API endpoint toegevoegd voor principes documentatie
- November 28, 2025: **UNIFIED SAVED EVENTS** - Verwijderd "Favorieten" concept, nu alleen "Opgeslagen" terminologie
  - Web sidebar nu met Bookmark icoon naar /web/saved route
  - App BottomNav nu met Bookmark icoon naar /app/saved route
  - Alle hartjes iconen vervangen door bookmark iconen
  - WebSavedPage toegevoegd met grid-view voor opgeslagen evenementen
  - Consistente terminologie "Opgeslagen" door de hele app
- August 15, 2025: **FUNDAMENTELE WIJZIGING EVENT VIEWING** - Alle event clicks (kaart en tegels) gebruiken nu overlay mode
  - Events worden altijd getoond in overlay panel in plaats van aparte pagina's 
  - Zoekcontext blijft behouden bij event viewing
  - Aparte event pagina's worden nu alleen gebruikt voor event creation/editing door event makers
  - Zowel web als app interface gebruiken consistent overlay gedrag
- June 20, 2025: **DEFAULT LOGIN CHANGED** - Switched automatic login from "Jan Jansen" to "testuser"
  - Created auto-login middleware that automatically authenticates testuser on app start
  - Added comprehensive testuser verification script with statistics display
  - Testuser now auto-logs in with 9 favorites, 5 participations, and 5 notifications
  - Credentials: username "testuser", password "test123"
- June 20, 2025: **AUTHENTICATION FIXED** - Resolved testuser login system completely
  - Fixed Passport LocalStrategy configuration to accept both usernames and emails
  - Eliminated automatic "Jan Jansen" login by resetting session configuration
  - Updated login form validation to accept usernames instead of requiring email format
  - Testuser login now working: username "testuser", password "test123"
- June 20, 2025: Created comprehensive test scenario with testuser login (username: testuser, password: test123)
- June 20, 2025: Updated all 238 events with realistic future dates and proper timing
- June 20, 2025: Added 8 favorite events, 5 participant registrations, and 5 notifications for testing
- June 20, 2025: Configured 5 events to start within 2 hours for "binnenkort" highlighting testing
- June 20, 2025: Modified authentication to accept both username and email for login flexibility
- June 20, 2025: Fixed image loading issues by implementing 24 reliable Unsplash URLs with consistent formatting
- June 20, 2025: Resolved CategoryImageSelector crash caused by deprecated source.unsplash.com URLs
- June 19, 2025: Enhanced intelligent image selection system with 8 varied alternatives based on event content

## Changelog
- June 19, 2025. Initial setup and authentication system implementation

## User Preferences

Preferred communication style: Simple, everyday language.