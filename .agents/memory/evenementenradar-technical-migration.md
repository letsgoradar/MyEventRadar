---
name: Evenementenradar technical migration
description: Separates the visible rebrand from high-risk technical identity and email migration.
---

Use Evenementenradar.nl for visible branding, but keep existing package identifiers, callback schemes, deep links and working email addresses until the new domain, DNS, mailboxes and authentication callbacks are confirmed operational.

**Why:** Changing these identifiers as a cosmetic rename can break installed apps, OAuth callbacks, deep links and email delivery. A visible rebrand does not prove the replacement infrastructure is ready.

**How to apply:** Treat the technical cutover as a separate migration with compatibility redirects/allowlists and verification for Android, iOS, authentication and SMTP before removing legacy identifiers.