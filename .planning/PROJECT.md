# RPM Bug Fixes, UI/UX Audit, Scoped Curation Roles, and Proxy Curation

## What This Is

A maintenance and feature release for ReCiter-Publication-Manager that fixed authentication blockers, audited and improved UI/UX across all views, and added fine-grained curation controls. Curators can now be scoped to specific person types and organizational units, and curation proxy assignments allow designated users to curate on behalf of others. The app runs on the EKS dev cluster (`reciter-dev`) using SAML authentication against the `dev_v2` branch.

## Core Value

Curators and administrators can reliably log in, navigate without encountering broken UI, and have fine-grained control over who curates publications for which groups of people.

## Requirements

### Validated

- ✓ SAML and local authentication flow — existing
- ✓ Role-based access control (Superuser, Curator_All, Reporter_All, Curator_Self) — existing
- ✓ Manage Users page with role and department assignment — existing
- ✓ Search/Find People page with identity lookup — existing
- ✓ Individual curation page with accept/reject workflow — existing
- ✓ Profile modal with biographical and bibliometric data — existing
- ✓ PubMed search with client-side dedup, pending badges, filter persistence — v1.0
- ✓ Capability-based auth model replacing role-count middleware (AUTH-01 through AUTH-04) — v1.0
- ✓ UI bug fixes: curate dropdown removed, profile modal fixed, skeleton loading (UIBUG-01 through UIBUG-03) — v1.0
- ✓ Full UI/UX audit of all 8 views with PATTERNS.md design system (UIUX-01 through UIUX-03) — v1.0
- ✓ Scoped curation roles by person type and/or org unit with admin UI (SCOPE-01 through SCOPE-06) — v1.0
- ✓ Many-to-many curation proxy with badge, filter, and grant UI (PROXY-01 through PROXY-06) — v1.0

### Active

(None — start next milestone with `/gsd:new-milestone`)

### Out of Scope

- Phase 2 of PubMed search improvements (author name highlighting, affiliation hover) — deferred from v1.0
- Mobile app or responsive redesign — web-first
- Migration to Next.js 13+ or React 18 — separate effort, different risk profile
- Notification system overhaul — partially implemented, separate scope
- Per-article permission assignments — excessive granularity
- Custom role creation UI — roles are relatively stable
- Real-time collaborative curation — not requested

## Context

- Shipped v1.0 with 28,631 LOC (JS/TS/JSX/TSX) across 77 modified files (+4,137/-668 lines)
- Tech stack: Next.js 12, React 16, Node 14, MySQL via Sequelize, Redux + thunk
- The `dev_v2` branch is the active development branch
- Authentication uses capability-based model (getCapabilities) with SAML auto-create
- Jest test infrastructure established with React 16 compatible stack (27.5.1 + @testing-library/react 12.1.5)
- eslint-plugin-jsx-a11y strict mode integrated; 33/64 a11y violations fixed, 31 deferred
- PATTERNS.md established as authoritative design reference for future UI work
- 5 new Sequelize models added: AdminUsersPersonType, AdminUsersProxy, plus scope/proxy utilities
- Nyquist validation exists in draft for all 4 core phases (not fully compliant)

## Constraints

- **Tech stack**: Next.js 12, React 16, Node 14 — no framework upgrades in this milestone
- **Auth**: SAML on EKS; local auth for local dev — capability model works in both modes
- **Database**: MySQL via Sequelize — scoped role and proxy tables follow existing model patterns
- **Existing patterns**: Redux + thunk async pattern for state management
- **Deployment**: EKS dev cluster via CodeBuild pipeline

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Capability-based auth model (getCapabilities) | Replace brittle role-count comparisons with derived capabilities | ✓ Good — eliminated /noaccess redirect bug, cleaner middleware |
| SAML auto-create with status=1 | Users in IdP but not in admin_users should get access | ✓ Good — removes manual user creation step |
| eslint-plugin-jsx-a11y strict mode | Static analysis for a11y instead of runtime @axe-core/react | ✓ Good — catches issues at lint time, 33 violations fixed |
| PATTERNS.md as design system reference | Prescriptive rules for future UI work based on audit findings | ✓ Good — consistent reference for Phase 3+ UI |
| Scoped roles use flexible combination (type + org) | Maximum flexibility without overcomplicating assignments | ✓ Good — scopeResolver handles all combos with null=unrestricted |
| Manage scoped roles in existing Manage Users page | Avoids a separate admin page; keeps user management centralized | ✓ Good — CurationScopeSection integrates cleanly |
| Full UI/UX audit scope (all views) | Group Curation and other views may have accumulated UX debt | ✓ Good — surfaced 63 findings across 8 views |
| Curation proxy uses search page with badge/filter | Leverages existing search UX; avoids new navigation surface | ✓ Good — ProxyBadge + ScopeFilterCheckbox work naturally |
| Proxy assignment from both Manage Users and curation page | Superusers centralize; curators grant contextually | ✓ Good — GrantProxyModal enables in-context proxy grants |
| Middleware defers scope check to API layer for /curate/* | Route allows access, API enforces scope | ✓ Good — cleaner separation; proxy bypass works at API level |
| Jest 27.5.1 + @testing-library/react 12.1.5 | React 16 compatibility requires older test libraries | ✓ Good — --legacy-peer-deps needed but tests work |
| isProxyFor check wraps scope block (not early return) | Preserves existing code structure in API endpoints | ✓ Good — minimal diff, easy to understand |

---
*Last updated: 2026-03-18 after v1.0 milestone*
