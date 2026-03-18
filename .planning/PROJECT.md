# RPM Bug Fixes, UI/UX Audit, Scoped Curation Roles, and Proxy Curation

## What This Is

ReCiter-Publication-Manager is an institutional web application for managing, curating, and reporting on scholarly publications. Faculty and librarians use it to accept/reject article suggestions, generate bibliometric reports, and export publication data. The app runs on the EKS dev cluster (`reciter-dev`).

## Current Milestone: v1.1 Feature Port to Next.js 14

**Goal:** Port all v1.0 features (capability auth, scoped curation roles, curation proxy) to the Next.js 14 / React 18 codebase running on reciter-dev.

**Target features:**
- Capability-based auth model adapted for next-auth v4
- Scoped curation roles (AdminUsersPersonType, scopeResolver, admin UI, enforcement)
- Curation proxy system (AdminUsersProxy, proxy CRUD APIs, badge/filter/grant UI)
- Proxy API scope enforcement on userfeedback and goldstandard endpoints
- Skeleton loading components adapted for React 18
- Jest test infrastructure for React 18 / Next.js 14

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

(Defined in REQUIREMENTS.md for v1.1)

### Out of Scope

- Phase 2 of PubMed search improvements (author name highlighting, affiliation hover) — deferred from v1.0
- Mobile app or responsive redesign — web-first
- ~~Migration to Next.js 13+ or React 18~~ — now in scope for v1.1 (porting to NextJS14 branch)
- Notification system overhaul — partially implemented, separate scope
- Per-article permission assignments — excessive granularity
- Custom role creation UI — roles are relatively stable
- Real-time collaborative curation — not requested

## Context

- v1.0 shipped on `dev_v2` (Next.js 12, React 16, Node 14) — 22/22 requirements fulfilled
- Target branch `dev_Upd_NextJS14SNode18` runs on reciter-dev with Next.js 14, React 18, Node 18, next-auth v4
- New working branch to be created from `origin/dev_Upd_NextJS14SNode18` for port work
- The NextJS14 branch has 813 unique commits diverging from dev_v2 (UI redesign, SAML v4, dependency updates)
- Key API changes: next-auth v3 → v4 (breaking), React 16 → 18 (hooks), Next.js 12 → 14 (middleware)
- Both branches use Pages Router (no app router migration needed)
- NextJS14 branch has NO v1.0 features: no capability model, no scoped roles, no proxy system
- Sequelize models (AdminUsersPersonType, AdminUsersProxy) and pure utilities (scopeResolver.ts) should port cleanly
- UI components need React 18 adaptation but logic is preserved
- PATTERNS.md from v1.0 audit may need updating for NextJS14 UI redesign styles

## Constraints

- **Tech stack**: Next.js 14, React 18, Node 18 — must work on the NextJS14 branch
- **Auth**: next-auth v4 with SAML on EKS; local auth for local dev
- **Database**: MySQL via Sequelize — same models, same connection patterns
- **Existing patterns**: Adapt v1.0 patterns to NextJS14 conventions where they differ
- **Deployment**: EKS dev cluster via CodeBuild pipeline
- **Source of truth**: v1.0 code on dev_v2 is the reference implementation; port logic, adapt APIs

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

| Port to new branch from NextJS14 | v1.0 features need to run on reciter-dev's modern stack | — Pending |
| next-auth v3 → v4 adaptation | Breaking API changes require rewrite, not copy-paste | — Pending |

---
*Last updated: 2026-03-18 after starting v1.1 milestone*
