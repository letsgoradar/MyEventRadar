---
name: Safe AI scraper repair
description: Safety boundary for AI-assisted changes to shared scraper extraction profiles.
---

AI may investigate feed failures and propose actions, but automatic application must remain disabled while extraction profiles are edited in place and can be shared by multiple feeds. Safe automation requires an isolated candidate profile, deterministic verification, promotion only after passing, and restoration of the full previous profile contents on failure.

**Why:** Reassigning a feed to its previous profile ID is not a rollback when analysis has already mutated that same profile row. A failed candidate could otherwise change every feed sharing the domain profile.

**How to apply:** Keep portal AI actions read-only for diagnosis until candidate profiles can be created and tested independently. Never treat an ID reassignment as sufficient rollback for mutable shared configuration.