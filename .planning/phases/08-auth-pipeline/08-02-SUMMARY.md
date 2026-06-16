---
phase: 08-auth-pipeline
plan: 02
subsystem: auth
tags: [middleware, jwt, capability-model, routing, getToken, edge-middleware]

# Dependency graph
requires:
  - phase: 08-auth-pipeline
    plan: 01
    provides: "JWT token with userRoles, scopeData, proxyPersonIds claims; getCapabilities/getLandingPage in constants.js"
provides:
  - "Capability-based Edge middleware routing via getCapabilities/getLandingPage"
  - "Deterministic index page redirect using capability model"
  - "Curator_Scoped routing support in middleware (person-level enforcement deferred to API)"
  - "SQL test script with 9 test users covering all role+scope+proxy combinations"
affects: [09-ui-port, 10-proxy-port]

# Tech tracking
tech-stack:
  added: []
  patterns: ["capability-based middleware routing", "getToken for verified JWT in Edge middleware", "getLandingPage for deterministic redirects"]

key-files:
  created:
    - scripts/sql/test-users-phase8.sql
  modified:
    - src/middleware.ts
    - src/pages/index.js

key-decisions:
  - "Use getToken() from next-auth/jwt instead of manual cookie parsing or jose.decodeJwt -- verified JWT reading (D-09)"
  - "Curator_Scoped gets NextResponse.next() on /curate routes -- person-level scope enforcement deferred to API layer (Phase 10)"
  - "All authenticated users with baseline capabilities get canReport + canSearch -- matches getCapabilities baseline"
  - "Notifications route restricted to users with curate or report capability, with self-only curators enforced to own path"

patterns-established:
  - "Capability-based route guards: if (caps.canX) return next(); return redirect(getLandingPage(caps))"
  - "Single-function redirect helper: redirectToLandingPage(request, path)"
  - "Index page: single getCapabilities + getLandingPage call replaces duplicated SAML/non-SAML logic"

requirements-completed: [PORT-06]

# Metrics
duration: 4min
completed: 2026-03-27
---

# Phase 08 Plan 02: Capability-Based Middleware and Index Page Routing Summary

**Replaced brittle 154-line role-count middleware with 126-line capability-based routing using getCapabilities/getLandingPage, cut index page from 118 to 46 lines, and created 9-user SQL test script for E2E verification**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T12:05:49Z
- **Completed:** 2026-03-27T12:10:42Z
- **Tasks:** 3
- **Files modified:** 2 modified, 1 created

## Accomplishments
- Rewrote middleware to use getCapabilities() for all route authorization decisions, eliminating nested if/else role-count logic entirely
- Added Curator_Scoped routing support -- scoped curators can access /curate and /search with person-level enforcement deferred to API layer
- Consolidated index page redirect logic from duplicated SAML/non-SAML role-checking (118 lines) into single getCapabilities/getLandingPage call (46 lines)
- Created comprehensive SQL test script with 9 test users covering all role+scope+proxy combinations

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace role-count middleware with capability-based routing** - `5f42a28` (feat)
2. **Task 2: Update index page to use getCapabilities/getLandingPage for redirects** - `a160a7e` (feat)
3. **Task 3: Create SQL test script for Phase 8 verification** - `873d32c` (chore)

## Files Created/Modified
- `src/middleware.ts` - Capability-based Edge middleware: getToken for JWT, getCapabilities for route guards, getLandingPage for redirects, Curator_Scoped support
- `src/pages/index.js` - Deterministic login redirect using getCapabilities/getLandingPage, SAML/non-SAML deduplication, missing error branch fix
- `scripts/sql/test-users-phase8.sql` - 9 test users (Superuser, Curator_All, Curator_Self, Reporter_All, dual-role, Curator_Scoped with scope, Curator_Scoped with proxy, inactive, no-roles) with cleanup and verification query

## Decisions Made
- Used getToken() from next-auth/jwt for verified JWT reading instead of jose.decodeJwt (unverified) or manual cookie parsing -- follows D-09 design decision
- Curator_Scoped gets NextResponse.next() on /curate routes without person-level checks -- scope enforcement deferred to API layer per D-10 (Phase 10)
- Notifications route accessible to users with any curate or report capability, with self-only curators enforced to /notifications/:personIdentifier path
- getLandingPage(caps) used as universal fallback redirect for all unauthorized route access

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Middleware capability model complete -- all routes use getCapabilities/getLandingPage for authorization
- JWT token carries scopeData and proxyPersonIds claims (from Plan 01), ready for Phase 9 UI components
- Curator_Scoped routing works at middleware level, API-level scope enforcement ready for Phase 10
- SQL test script available for manual E2E verification on dev database
- Phase 08 (auth-pipeline) fully complete -- all 2 plans executed

## Self-Check: PASSED

All 3 files exist (src/middleware.ts, src/pages/index.js, scripts/sql/test-users-phase8.sql). All 3 task commits verified (5f42a28, a160a7e, 873d32c).

---
*Phase: 08-auth-pipeline*
*Completed: 2026-03-27*
