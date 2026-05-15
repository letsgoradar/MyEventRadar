# Threat Model

## Project Overview

letsgo radar is a community event discovery platform with a React/Vite client, an Express/TypeScript backend, PostgreSQL via Drizzle ORM, and session-based authentication through Passport (local login plus Google OAuth). Users can browse public event data, create accounts, manage profiles and event participation, while admins manage feeds, venues, backups, and other operational data. The production deployment also talks to external services including Google OAuth, Stripe, email/SMTP providers, and third-party event/feed sources.

## Assets

- **User accounts and sessions** — email addresses, password hashes, Google-linked accounts, session cookies, and password reset tokens. Compromise allows account takeover and persistent impersonation.
- **Privileged admin capabilities** — admin accounts can manage feeds, venues, backups, traffic controls, and operational data. Compromise would let an attacker alter platform content and access sensitive business data.
- **User profile and engagement data** — profile details, favorites, participations, hidden events, saved searches, notifications, and advertiser account data. This includes personal data and activity history.
- **Business and operational data** — event records, feed configs, advertiser/promotions data, feedback, image health, traffic controls, and audit logs. Tampering could affect the integrity of listings, billing, or moderation.
- **Application secrets and third-party credentials** — database credentials, session secret, SMTP credentials, Stripe secrets, Google OAuth secrets, and API tokens used for scraping/AI integrations.
- **Uploaded files and generated public assets** — profile photos and other public-facing media paths. Unsafe handling could allow storage abuse or content tampering.

## Trust Boundaries

- **Browser/native app to backend API** — all client input is untrusted and must be validated and authorized server-side.
- **Authenticated user to admin boundary** — regular users and advertisers must never be able to reach admin-only functions or mutate privileged account fields.
- **Server to PostgreSQL** — the application can read and write all core data. Authorization mistakes or injection at the API layer directly impact stored data.
- **Server to external identity/payment services** — Google OAuth callbacks, Stripe webhooks, and SMTP/email flows cross trust boundaries and must validate inputs and origins.
- **Public to authenticated surfaces** — public event browsing and landing pages are intentionally open; account, profile, notification, advertiser, and admin data must remain scoped to the current principal.
- **Runtime production code to dev-only code/scripts** — repository scripts and tooling are generally out of scope unless invoked by production startup paths. `server/index.ts` startup migrations/seeding are in scope because they run in production.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/auth.ts`
- **Highest-risk areas:** auth/session handling, OAuth callback flows, user/profile mutation routes, admin/bootstrap logic, advertiser/payment routes, upload handling
- **Surface split:** public event/search/SEO routes; authenticated user/profile/notification/favorites routes; admin/advertiser/backup/feed-management routes
- **Usually dev-only:** `server/scripts/`, local test helpers, mobile build tooling, generated `dist/` output unless a production path imports or runs it directly

## Threat Categories

### Spoofing

The app relies on session cookies, password-based login, Google OAuth, and password-reset/email-verification flows. Attackers will try to impersonate users or admins by abusing weak bootstrap credentials, unsafe OAuth callback handling, or poorly protected account mutation paths. The system must require unpredictable session secrets in production, validate all auth callbacks before redirecting or linking accounts, and ensure no production startup path creates guessable credentials.

### Tampering

Users and advertisers submit profile data, event actions, uploads, feedback, and many route parameters. Attackers may try to change records they do not own or overwrite privileged fields by sending extra JSON properties. The system must enforce ownership and allowlists on every mutating endpoint, especially generic update helpers that write directly to database tables.

### Information Disclosure

The app stores user profiles, participation history, notifications, advertiser data, and admin operational records. Some event data is public by design, but private user-specific records are not. The system must scope user data endpoints to the current authenticated principal or an admin, avoid exposing unnecessary table columns in API responses, and avoid leaking secrets or sensitive error details in logs and responses.

### Denial of Service

The platform exposes public search, feed-related processing, uploads, and several external-service integrations. Attackers may try to exhaust disk, CPU, or outbound-request budgets with oversized uploads, repeated expensive requests, or abuse of public endpoints. The system must keep production-reachable uploads and expensive routes behind authentication and rate limits, enforce file size/type limits, and bound work done per request.

### Elevation of Privilege

This project has a meaningful admin boundary with high-impact operational powers. Any path that lets a regular user change role-like fields, claim privileged identity, or reach admin-only data is high risk. The system must keep privileged state changes behind explicit server-side checks and must never trust client-supplied account or role fields for generic update operations.
