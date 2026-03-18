---
phase: 04-curation-proxy
plan: 01
subsystem: auth, api, database
tags: [sequelize, jwt, proxy, curation, next-auth, scope]

# Dependency graph
requires:
  - phase: 03-scoped-curation-roles
    provides: scopeResolver.ts, getCapabilities, findUserPermissions with scopeData, Curator_Scoped role
provides:
  - AdminUsersProxy Sequelize model for admin_users_proxy table
  - isProxyFor() utility function in scopeResolver.ts
  - proxyPersonIds in JWT token and session for curation role users
  - getCapabilities().canCurate.proxyPersonIds initialization
  - Proxy CRUD API endpoints (list, save, grant, search-persons, search-users)
affects: [04-02-PLAN, 04-03-PLAN, 04-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Proxy data follows same flow as scope data: DB query -> userroles controller -> JWT callback -> session -> getCapabilities"
    - "Replace-all pattern for proxy assignments (delete all + bulk insert in transaction)"
    - "Person enrichment pattern on proxy list endpoint (join proxy IDs with person table for names)"

key-files:
  created:
    - src/db/models/AdminUsersProxy.ts
    - src/pages/api/db/admin/proxy/index.ts
    - src/pages/api/db/admin/proxy/grant.ts
    - src/pages/api/db/admin/proxy/search-persons.ts
    - src/pages/api/db/admin/proxy/search-users.ts
    - __tests__/utils/proxy.test.ts
  modified:
    - src/db/models/init-models.ts
    - src/utils/scopeResolver.ts
    - src/utils/constants.js
    - controllers/db/userroles.controller.ts
    - src/pages/api/auth/[...nextauth].jsx
    - __tests__/utils/constants-scoped.test.ts

key-decisions:
  - "Proxy data retrieval triggers for any curation role (Curator_All, Curator_Scoped, Curator_Self), not just Curator_Scoped"
  - "userID lookup consolidated into single query shared by both scope and proxy data retrieval"
  - "proxyPersonIds stored as JSON string in JWT token (same pattern as scopeData)"

patterns-established:
  - "Proxy data pipeline: DB -> userroles.controller -> JWT -> session -> getCapabilities"
  - "Replace-all transaction pattern for proxy CRUD operations"

requirements-completed: [PROXY-01, PROXY-03, PROXY-06]

# Metrics
duration: 6min
completed: 2026-03-17
---

# Phase 4 Plan 01: Proxy Foundation Summary

**AdminUsersProxy Sequelize model with JWT-embedded proxy data, isProxyFor utility with 5 unit tests, and 4 proxy CRUD API endpoints**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-17T22:41:20Z
- **Completed:** 2026-03-17T22:47:22Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- AdminUsersProxy Sequelize model with unique (userID, personIdentifier) constraint, registered with associations in init-models.ts
- isProxyFor() utility function exported from scopeResolver.ts with 5 passing unit tests
- proxyPersonIds flows from DB through findUserPermissions -> JWT callback -> session -> getCapabilities for all curation role users
- Four proxy API endpoints with auth validation, transaction safety, and search limits

## Task Commits

Each task was committed atomically:

1. **Task 1: AdminUsersProxy model, isProxyFor utility, and unit tests (TDD)** - `1a1edd6` (test: RED), `f80d1c6` (feat: GREEN)
2. **Task 2: Extend auth pipeline with proxyPersonIds** - `3bae1a0` (feat)
3. **Task 3: Create proxy CRUD API endpoints** - `f20cefe` (feat)

## Files Created/Modified
- `src/db/models/AdminUsersProxy.ts` - Sequelize model for admin_users_proxy junction table
- `src/db/models/init-models.ts` - Registered AdminUsersProxy with initModel and associations
- `src/utils/scopeResolver.ts` - Added isProxyFor() function for proxy access checks
- `src/utils/constants.js` - Added proxyPersonIds: [] to getCapabilities canCurate
- `controllers/db/userroles.controller.ts` - Added getProxyDataForUser helper and proxyPersonIds in response
- `src/pages/api/auth/[...nextauth].jsx` - JWT and session callbacks embed proxyPersonIds
- `src/pages/api/db/admin/proxy/index.ts` - GET list and POST save proxy assignments per user
- `src/pages/api/db/admin/proxy/grant.ts` - POST grant proxy access for a person
- `src/pages/api/db/admin/proxy/search-persons.ts` - GET person search for proxy autocomplete
- `src/pages/api/db/admin/proxy/search-users.ts` - GET admin user search filtered to curation roles
- `__tests__/utils/proxy.test.ts` - 5 unit tests for isProxyFor
- `__tests__/utils/constants-scoped.test.ts` - 2 new tests for proxyPersonIds initialization

## Decisions Made
- Proxy data retrieval triggers for ALL curation roles (Curator_All, Curator_Scoped, Curator_Self), not just Curator_Scoped -- because any curator may need proxy assignments
- userID lookup consolidated into single query shared by both scope and proxy data retrieval, eliminating redundant DB call
- proxyPersonIds stored as JSON string in JWT token following same pattern as scopeData for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The admin_users_proxy table must exist in the database (CREATE TABLE handled separately or by Sequelize sync).

## Next Phase Readiness
- Proxy foundation complete: model, utility, auth pipeline, and API endpoints all operational
- Ready for Plan 04-02 (Manage Users proxy section UI) which consumes the proxy API endpoints
- Ready for Plan 04-03 (Curation page proxy grant modal) which uses the grant endpoint
- Ready for Plan 04-04 (Middleware and scope enforcement) which uses isProxyFor from scopeResolver.ts

---
*Phase: 04-curation-proxy*
*Completed: 2026-03-17*
