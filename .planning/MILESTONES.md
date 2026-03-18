# Milestones

## v1.0 RPM Bug Fixes, UI/UX Audit, Scoped Curation Roles, and Proxy Curation (Shipped: 2026-03-18)

**Phases:** 6 | **Plans:** 17 | **Commits:** 59 | **Timeline:** 3 days (2026-03-15 → 2026-03-18)
**Files modified:** 77 | **Net change:** +4,137 / -668 lines | **Codebase:** 28,631 LOC (JS/TS/JSX/TSX)
**Git range:** `feat(01-01)..feat(06-01)` | **Requirements:** 22/22 fulfilled

**Key accomplishments:**
1. Capability-based auth model replacing brittle role-count middleware with SAML auto-create
2. Full UI/UX audit of all 8 views with PATTERNS.md design system and 33 a11y violations fixed
3. Scoped curation roles — curators restricted by person type and/or org unit with admin UI
4. Many-to-many curation proxy assignments with [PROXY] badge, filter, and grant UI
5. Independent verification of all 6 SCOPE requirements (33/36 truths verified)
6. Proxy API scope enforcement — isProxyFor bypass on userfeedback and goldstandard endpoints

**Delivered:** Stable, audited curation platform with fine-grained role scoping and proxy delegation.

---

