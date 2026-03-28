---
phase: 09-scoped-roles-and-proxy-ui
plan: 01
subsystem: api
tags: [sequelize, proxy, scope, json-columns, crud, search, mysql]

# Dependency graph
requires:
  - phase: 07-foundation
    provides: AdminUser JSON columns (scope_person_types, scope_org_units, proxy_person_ids), scopeResolver
  - phase: 08-auth-pipeline
    provides: JWT/session enriched with scopeData/proxyPersonIds, capability-based middleware
provides:
  - 6 proxy API endpoints under /api/db/admin/proxy/ for CRUD, grant, search
  - person-types alias endpoint under /api/db/admin/person-types/
  - proxy.controller.ts with 6 business logic functions
  - scope-filtered person search (scopeOrgUnits, scopePersonTypes, proxyPersonIds)
  - user CRUD with scope field persistence (create/edit)
  - user list with scope, proxy, and role label data for display
affects: [09-02-PLAN, 09-03-PLAN, 09-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [JSON_CONTAINS raw SQL for reverse proxy lookup, parseJsonColumn helper for MySQL/MariaDB JSON column parsing]

key-files:
  created:
    - controllers/db/proxy.controller.ts
    - src/pages/api/db/admin/proxy/index.ts
    - src/pages/api/db/admin/proxy/grant.ts
    - src/pages/api/db/admin/proxy/search-persons.ts
    - src/pages/api/db/admin/proxy/search-users.ts
    - src/pages/api/db/admin/person-types/index.ts
  modified:
    - controllers/db/person.controller.ts
    - controllers/db/manage-users/user.controller.ts
    - types/personapi.body.d.ts

key-decisions:
  - "Used parseJsonColumn helper with typeof check for robust MySQL/MariaDB JSON column parsing"
  - "scopePersonTypes uses left JOIN when proxyPersonIds present so proxy persons bypass person type filter"
  - "listAllUsers includes AdminUsersRole + AdminRole join with unique alias (listRoles/listRole) for role label display"
  - "Proxy grant endpoint uses individual UPDATE loops rather than transactions (small data volume, independent rows)"

patterns-established:
  - "Pattern: parseJsonColumn(value) for safe parsing of Sequelize JSON columns that may be string or array"
  - "Pattern: Unique Sequelize association aliases (proxySearchRoles, listRoles) to avoid conflicts with existing associations"
  - "Pattern: API route auth follows same 3-way check (missing/incorrect/valid) as existing admin routes"

requirements-completed: [PORT-14, PORT-15]

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 9 Plan 01: API Layer for Proxy CRUD and Scope Filtering Summary

**Complete proxy CRUD, search, and scope-filtered person search API layer with 6 new endpoints and 3 controller modifications**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-28T04:48:08Z
- **Completed:** 2026-03-28T04:56:23Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Created proxy controller with 6 business logic functions (getProxiesForUser, getProxiesForPerson, saveProxiesForUser, grantProxyForPerson, searchPersons, searchUsersWithCurationRoles)
- Created 4 proxy API routes and 1 person-types alias endpoint, all with proper auth checks
- Added scope filtering to person search with proxy OR bypass and person type JOIN handling
- Extended user CRUD to persist scope fields and return scope/proxy/role data for display

## Task Commits

Each task was committed atomically:

1. **Task 1: Create proxy controller with all 6 business logic functions** - `8e31acc` (feat)
2. **Task 2: Create 4 proxy API route files and person-types alias** - `f82e5bd` (feat)
3. **Task 3: Modify person.controller and user.controller** - `665b59d` (feat)

## Files Created/Modified
- `controllers/db/proxy.controller.ts` - 6 exported proxy business logic functions with JSON_CONTAINS reverse lookup
- `src/pages/api/db/admin/proxy/index.ts` - GET (userID/personIdentifier) and POST proxy CRUD route
- `src/pages/api/db/admin/proxy/grant.ts` - POST per-person proxy grant/revoke route
- `src/pages/api/db/admin/proxy/search-persons.ts` - GET person search for autocomplete
- `src/pages/api/db/admin/proxy/search-users.ts` - GET admin user search with curation role filter
- `src/pages/api/db/admin/person-types/index.ts` - GET alias to existing findAllPersonTypes controller
- `controllers/db/person.controller.ts` - Added scopeOrgUnits/scopePersonTypes/proxyPersonIds filter handling to findAll
- `controllers/db/manage-users/user.controller.ts` - Added scope/proxy attributes to list/detail, scope fields to create/edit payloads, role label JOIN
- `types/personapi.body.d.ts` - Added scopeOrgUnits, scopePersonTypes, proxyPersonIds filter fields

## Decisions Made
- Used parseJsonColumn helper with typeof check for robust MySQL/MariaDB JSON column parsing -- MySQL may return JSON as string or array depending on driver
- scopePersonTypes uses left JOIN (required: false) when proxyPersonIds present so proxy persons are not excluded by person type filter
- listAllUsers includes AdminUsersRole + AdminRole join with unique alias (listRoles/listRole) to avoid conflicts with existing adminUsersRoles association
- Proxy grant endpoint uses individual UPDATE loops rather than transactions since each update is an independent single-row operation on small data volume

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Merged feature/v1.1-port branch into worktree**
- **Found during:** Pre-Task 1 (reading existing files)
- **Issue:** Worktree branch was based on old commit without Phase 7/8 deliverables (AdminUser JSON columns, scopeResolver, capability model)
- **Fix:** Merged feature/v1.1-port into worktree branch, resolved one conflict in Publication.tsx
- **Files modified:** src/components/elements/Publication/Publication.tsx (conflict resolution)
- **Verification:** AdminUser model confirmed to have scope_person_types, scope_org_units, proxy_person_ids columns
- **Committed in:** a678e7e (merge commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Merge was necessary prerequisite -- Phase 7/8 columns required for all proxy controller operations. No scope creep.

## Issues Encountered
None beyond the merge prerequisite documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 proxy API endpoints ready for UI components in Plans 02-04
- Person search scope filtering ready for ScopeFilterCheckbox integration (Plan 03)
- User CRUD scope persistence ready for CurationScopeSection integration (Plan 02)
- User list role labels ready for UsersTable display (Plan 02)
- TypeScript compilation passes with no errors

## Self-Check: PASSED

All 6 created files verified on disk. All 3 task commits verified in git log. SUMMARY.md exists. TypeScript compilation passes.

---
*Phase: 09-scoped-roles-and-proxy-ui*
*Completed: 2026-03-28*
