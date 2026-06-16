# RPM Bug Fixes, UI/UX Audit, Scoped Curation Roles, and Proxy Curation

## What This Is

ReCiter-Publication-Manager is an institutional web application for managing, curating, and reporting on scholarly publications. Faculty and librarians use it to accept/reject article suggestions, generate bibliometric reports, and export publication data. The app runs on the EKS dev cluster (`reciter-dev`).

## Current Milestone: v1.3 Data-Driven RBAC

**Goal:** Move all role/permission definitions, role→permission mappings, and UI resource visibility from hardcoded application code to database tables, with full admin CRUD.

**Target features:**
- DB-driven permissions (admin_permissions, admin_role_permissions, admin_permission_resources tables)
- Login-time permission resolution baked into JWT
- Middleware enforcement using permission set from JWT
- Data-driven SideNavbar rendered from permission_resources
- Component-level permission checks replacing role-based checks
- Admin UI: Roles tab and Permissions tab in Manage Users page
- Full CRUD for permissions, roles, role→permission mappings, and UI resources

## Previous State

**Shipped:** v1.2 Bibliometric Bug Fix (2026-03-27)

**Archived:** v1.1 Feature Port to Next.js 14 (92% complete, Phase 11 executing)

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

- ✓ Bibliometric peer-based percentile, rank, and denominator computations (PCTL-01–04, SYNC-01–02, DEPLOY-01–02, VFY-01–03) — v1.2

### Active

- [x] DB-driven permission tables with seed data matching current behavior — Phase 14
- [x] Permission resolution at login, baked into JWT — Phase 15
- [x] Middleware uses permission set instead of role labels — Phase 15
- [ ] Data-driven SideNavbar from permission_resources table
- [ ] Component-level permission checks replacing role-based checks
- [ ] Admin UI: Roles tab with permission assignment
- [ ] Admin UI: Permissions tab with full CRUD and resource management
- [ ] Cleanup: remove deprecated ROLE_CAPABILITIES, getCapabilities, getLandingPage

### Out of Scope

- Phase 2 of PubMed search improvements (author name highlighting, affiliation hover) — deferred from v1.0
- Mobile app or responsive redesign — web-first
- Notification system overhaul — partially implemented, separate scope
- Per-article permission assignments — excessive granularity
- Real-time collaborative curation — not requested
- Per-request permission resolution — chose login-time baking into JWT
- Route enforcement from DB — chose code-based middleware with DB permission keys
- Permission-level scope constraints — scope stays user-level
- Session refresh mechanism — users re-login for permission changes

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
| Sync standalone SP with canonical | Standalone had wrong percentile logic; canonical was correct | ✓ Good — all 8 metrics now match canonical peer-based logic |
| Deploy SP to each database separately | "Same RDS instance" doesn't mean shared data — SPs and data are database-scoped | ✓ Good — lesson learned: always SOURCE+CALL per database |

| Data-driven RBAC: generic permission strings (Approach A) | Simplest model, extensible, app code still references permission keys | — Pending |
| Hybrid route enforcement: code-based middleware + DB permission keys | Route patterns in DB are fragile; UI gating is fully data-driven | — Pending |
| Permissions resolved at login, baked into JWT | No per-request DB queries; user must re-login for changes | — Pending |
| Scope stays user-level (not permission-level) | Simpler; scope_person_types/scope_org_units/proxy_person_ids on admin_users | — Pending |
| Admin UI as tabs in Manage Users (not separate routes) | Related workflow, matches existing patterns, one permission gate | — Pending |

---
*Last updated: 2026-04-14 after v1.3 milestone start*
