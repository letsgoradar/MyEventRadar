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
   - Importeer starttijd/eindtijd ALLEEN als 100% zeker is welke tijd wat is
   - Bij 2 verschillende tijden: automatisch bepalen welke begin- en eindtijd is
   - Bij onzekerheid: importeer event op juiste datum ZONDER tijden
   - NOOIT willekeurige tijden invullen
   - Bij alleen datum bekend: 00:00 als start, 23:59 als eind

7. **Sync Strategie (upsert)** (kritiek)
   - Bij sync: **updaten** van bestaande events, NIET verwijderen/opnieuw aanmaken
   - Bestaande events herkennen via externalId in rss_feed_items
   - Behoud user interacties (favorites, participants, views, saves) bij updates
   - Alleen titel, beschrijving, locatie, datum/tijd, categorie, en externe URL worden geüpdatet
   - Afbeelding, tags, hostId, recurrence blijven ongewijzigd om handmatige edits te behouden

## External Dependencies

### Core
- **Database**: PostgreSQL
- **Maps**: OpenStreetMap (via Leaflet)
- **UI Components**: Radix UI
- **Styling**: Tailwind CSS
- **File Uploads**: Multer
- **Validation**: Zod

### Optional Integrations
- **AI Image Generation**: Hugging Face API
- **Geocoding**: OpenStreetMap Nominatim