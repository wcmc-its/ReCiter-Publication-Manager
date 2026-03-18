---
phase: 03-scoped-curation-roles
plan: 02
subsystem: auth
tags: [jwt, scope, middleware, rbac, next-auth, jose, sequelize]

# Dependency graph
requires:
  - phase: 03-scoped-curation-roles plan 01
    provides: "Curator_Scoped in ROLE_CAPABILITIES, getCapabilities with scoped flag, AdminUsersPersonType model"
provides:
  - "Scope data flows from DB through findUserPermissions -> JWT -> middleware"
  - "Middleware allows Curator_Scoped on /curate/* and /manageprofile/* routes"
  - "API-level 403 enforcement on userfeedback save and goldstandard update"
  - "getPersonWithTypes helper for lightweight scope lookups"
  - "isPersonInScope utility for scope evaluation"
affects: [03-scoped-curation-roles plan 03, 03-scoped-curation-roles plan 04, 03-scoped-curation-roles plan 05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["scope data in JWT via token.scopeData", "API-level scope enforcement with getToken + getCapabilities + isPersonInScope", "getPersonWithTypes for lightweight person scope data"]

key-files:
  created:
    - "src/utils/scopeResolver.ts"
  modified:
    - "controllers/db/userroles.controller.ts"
    - "src/pages/api/auth/[...nextauth].jsx"
    - "src/middleware.ts"
    - "src/pages/api/reciter/save/userfeedback/[uid].ts"
    - "src/pages/api/reciter/update/goldstandard.ts"
    - "controllers/db/person.controller.ts"
    - "src/utils/constants.js"

key-decisions:
  - "findUserPermissions returns { roles, scopeData } instead of flat roles array -- breaking change handled in JWT callback with fallback parsing"
  - "Scope data stored as JSON string in JWT token (token.scopeData) alongside existing token.userRoles"
  - "Middleware defers person-level scope check to API layer for /curate/* routes (route-level allows access, API enforces person match)"
  - "getPersonWithTypes uses Sequelize models rather than raw SQL for consistency with person.controller patterns"

patterns-established:
  - "API scope enforcement: getToken -> parse roles -> getCapabilities -> check scoped && !all -> parse scopeData -> getPersonWithTypes -> isPersonInScope -> 403"
  - "Middleware scope pass-through: scoped curators allowed at route level, enforcement deferred to API"

requirements-completed: [SCOPE-01, SCOPE-03]

# Metrics
duration: 6min
completed: 2026-03-17
---

# Phase 3 Plan 02: Auth Pipeline & API Scope Enforcement Summary

**Scope data wired through DB -> JWT -> middleware with 403 enforcement on userfeedback save and goldstandard update for out-of-scope Curator_Scoped users**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-17T15:04:23Z
- **Completed:** 2026-03-17T15:10:49Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Extended findUserPermissions to query admin_users_person_types and return scope data alongside roles
- JWT callback parses new format and embeds scopeData in token with backward-compatible fallback
- Middleware supports Curator_Scoped on /curate/* and new /manageprofile/* routes
- userfeedback save and goldstandard update APIs enforce scope with HTTP 403 and [AUTH] logging

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend findUserPermissions to return scope data and embed in JWT** - `a027b4b` (feat)
2. **Task 2: Update middleware for Curator_Scoped and add API-level scope enforcement** - `c4ae7ce` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `src/utils/scopeResolver.ts` - ScopeData interface and isPersonInScope() evaluator (AND across dimensions, OR within)
- `controllers/db/userroles.controller.ts` - Extended findUserPermissions with scope data query for Curator_Scoped users
- `src/pages/api/auth/[...nextauth].jsx` - JWT callback parses { roles, scopeData } format, embeds in token
- `src/middleware.ts` - Added /manageprofile matcher, Curator_Scoped route check, scopeData parsing from JWT
- `src/pages/api/reciter/save/userfeedback/[uid].ts` - 403 enforcement for out-of-scope save attempts
- `src/pages/api/reciter/update/goldstandard.ts` - 403 enforcement for out-of-scope gold standard updates
- `controllers/db/person.controller.ts` - getPersonWithTypes helper for lightweight scope lookups
- `src/utils/constants.js` - Curator_Scoped in allowedPermissions, ROLE_CAPABILITIES, getCapabilities, getLandingPage

## Decisions Made
- findUserPermissions returns `{ roles, scopeData }` instead of flat roles array -- breaking change handled in JWT callback with fallback parsing for legacy format
- Scope data stored as JSON string in JWT token (`token.scopeData`) alongside existing `token.userRoles`
- Middleware defers person-level scope check to API layer for /curate/* routes -- route-level allows access, API enforces person-in-scope match
- getPersonWithTypes uses Sequelize models (Person + PersonPersonType) rather than raw SQL, consistent with existing person.controller patterns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created scopeResolver.ts prerequisite from Plan 01**
- **Found during:** Task 1 (extend auth pipeline)
- **Issue:** Plan 02 imports isPersonInScope from src/utils/scopeResolver.ts but it did not exist yet (Plan 01 artifact)
- **Fix:** Created src/utils/scopeResolver.ts with ScopeData interface and isPersonInScope function per Plan 01 interface contract
- **Files modified:** src/utils/scopeResolver.ts
- **Verification:** File exists, exports match Plan 02 interface references
- **Committed in:** a027b4b (Task 1 commit)

**2. [Rule 3 - Blocking] Extended constants.js with Curator_Scoped (Plan 01 prerequisite)**
- **Found during:** Task 1 (extend auth pipeline)
- **Issue:** Plan 02 references caps.canCurate.scoped but Curator_Scoped was not yet in ROLE_CAPABILITIES (Plan 01 work executed concurrently resolved this)
- **Fix:** Added Curator_Scoped to allowedPermissions, ROLE_CAPABILITIES, getCapabilities, and getLandingPage -- concurrent Plan 01 execution committed identical changes
- **Files modified:** src/utils/constants.js
- **Verification:** getCapabilities returns scoped: true for Curator_Scoped role, tests pass
- **Committed in:** a027b4b (Task 1 commit, merged with Plan 01 concurrent changes)

---

**Total deviations:** 2 auto-fixed (2 blocking prerequisites from Plan 01)
**Impact on plan:** Both were prerequisite artifacts referenced in Plan 02's interface contract. No scope creep -- Plan 01 concurrent execution also committed these, so the changes merged cleanly.

## Issues Encountered
None -- all tests pass (39/39), no build errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth pipeline complete: scope flows from DB -> JWT -> middleware -> API enforcement
- Ready for Plan 03 (search/curation UI) to consume scope data from session
- Ready for Plan 04 (manage profile port) to use /manageprofile/* middleware routes
- Ready for Plan 05 (admin UI) to assign Curator_Scoped roles

## Self-Check: PASSED

All 8 key files verified present. Both task commits (a027b4b, c4ae7ce) verified in git history. All acceptance criteria confirmed met.

---
*Phase: 03-scoped-curation-roles*
*Completed: 2026-03-17*
