# Phase 9: Scoped Roles and Proxy UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 09-scoped-roles-and-proxy-ui
**Areas discussed:** Proxy API design, GrantProxyModal scope, Person type options source, Search page scope filtering, UsersTable scope display, Proxy entry points

---

## Proxy API Design

| Option | Description | Selected |
|--------|-------------|----------|
| JSON-only | Rewrite v1.0 APIs to use JSON_CONTAINS on admin_users.proxy_person_ids | ✓ |
| Hybrid (junction + JSON) | Keep junction table as source of truth, JSON as denormalized cache | |
| Port junction table as-is | Copy v1.0 AdminUsersProxy model and APIs unchanged | |

**User's choice:** JSON-only (recommended)
**Notes:** Phase 7 decided JSON columns over junction tables. Reverse lookups via JSON_CONTAINS are adequate for tens of users. 6 API endpoints rewritten.

---

## GrantProxyModal Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Include in Phase 9 | Ship complete proxy story with both entry points | ✓ |
| Defer to later phase | Ship only AddUser proxy section, add modal later | |

**User's choice:** Include (recommended)
**Notes:** Proxy feature incomplete without both admin and curate-page entry points. Modal is self-contained.

---

## Person Type / Department Options Source

| Option | Description | Selected |
|--------|-------------|----------|
| Existing DB tables | Departments from admin_departments, person types from DISTINCT query | ✓ |
| Admin settings | Store available options in admin_settings table | |
| Hard-coded | Fixed list in constants | |

**User's choice:** Existing DB tables (recommended)
**Notes:** One new endpoint for person types. Departments use existing endpoint. Options vary per institution.

---

## Search Page Scope Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side filtering | Pass scope params to /api/db/person, filter in WHERE clause | ✓ |
| Client-side filtering | Filter paginated results in browser with scopeResolver | |

**User's choice:** Server-side (recommended)
**Notes:** Client-side filtering on paginated results creates bad UX (partial pages). Server-side gives accurate pagination.

---

## UsersTable Scope Display

| Option | Description | Selected |
|--------|-------------|----------|
| Inline format | "Curator_Scoped (Faculty, Surgery)" in role column + proxy count badge | ✓ |
| Separate columns | Dedicated Scope and Proxy columns | |
| Tooltip on hover | Clean role name, details in tooltip | |

**User's choice:** Inline format (recommended)
**Notes:** Matches v1.0 pattern. Scannable for admins.

---

## Proxy Entry Points

| Option | Description | Selected |
|--------|-------------|----------|
| Both in Phase 9 | AddUser (user→persons) + GrantProxyModal (person→users) | ✓ |
| AddUser only | Defer GrantProxyModal to later phase | |

**User's choice:** Both (recommended)
**Notes:** Same data, different angles. API layer handles both directions.

---

## Claude's Discretion

- React 18 adaptations (useSession pattern, etc.)
- CSS module naming and styling
- MUI Autocomplete configuration
- Debounce timing for searches
- Error/loading states
- Plan splitting strategy

## Deferred Ideas

- Server-side scope enforcement on API endpoints — Phase 10
- Skeleton loading for React 18 — Phase 11
- a11y fixes — Phase 11
- Default scope on SAML auto-create — future
