# Event App - Community Event Management Platform

## Overview

This is a full-stack web application for community event management, built with Express.js backend and React frontend. The application allows users to discover, create, and participate in local events with map-based visualization and comprehensive event management features. It supports both mobile app-style interface and web interface, with admin functionality for platform management.

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

## Recent Changes
- June 19, 2025: Fixed authentication session configuration for development environment
- June 19, 2025: Updated cookie settings (secure: false, sameSite: 'lax') for proper session handling
- June 19, 2025: Completed event creation functionality - events save successfully to database
- June 19, 2025: Enhanced AI image generation error handling with user-friendly messages
- June 19, 2025: Added credentials: 'include' to all API requests for proper authentication

## Changelog
- June 19, 2025. Initial setup and authentication system implementation

## User Preferences

Preferred communication style: Simple, everyday language.