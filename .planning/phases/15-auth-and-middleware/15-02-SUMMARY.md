---
phase: 15-auth-and-middleware
plan: 02
subsystem: middleware
tags: [middleware, rbac, permissions, edge-runtime, jwt, route-enforcement]

# Dependency graph
requires:
  - phase: 15-auth-and-middleware plan 01
    provides: JWT token carrying permissions and permissionResources as JSON strings
  - phase: 14-permission-tables-and-models
    provides: permissionUtils.ts (hasPermission, getPermissionsFromRaw, getLandingPageFromPermissions)
provides:
  - Permission-based Edge middleware using ROUTE_PERMISSIONS lookup map
  - Self-only curator enforcement via role labels (not permissions)
  - Baseline fallback granting canSearch + canReport for empty permission sets
affects: [16-data-driven-ui (middleware now enforces permission keys instead of role labels)]

# Tech tracking
tech-stack:
  added: []
  patterns: [route-to-permission-lookup-map, permission-based-route-enforcement, baseline-fallback-for-empty-permissions]

key-files:
  created:
    - __tests__/middleware.test.ts
  modified:
    - src/middleware.ts

key-decisions:
  - "ROUTE_PERMISSIONS map replaces 130-line if/else chain with 7-entry lookup table"
  - "Self-only curator detection uses role labels (Curator_Self) not permission keys because both Curator_Self and Curator_Scoped resolve to canCurate"
  - "Baseline fallback grants canSearch + canReport for authenticated users with empty permission sets"
  - "Preserved .git 403, no-cookie /login redirect, and no-roles /error redirect behaviors unchanged"

patterns-established:
  - "Route enforcement pattern: ROUTE_PERMISSIONS[matchedRoute] + hasPermission() for all 7 protected routes"
  - "Self-only detection pattern: check role labels first, then enforce /curate/:ownId restriction after permission check passes"

requirements-completed: [MW-01, MW-02, MW-03, MW-04, MW-05]

# Metrics
duration: 3min
completed: 2026-04-14
---

# Phase 15 Plan 02: Middleware Enforcement Summary

**Permission-based Edge middleware using ROUTE_PERMISSIONS lookup map replacing 130-line role-label if/else chain with 7-entry route-to-permission mapping**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-14T18:57:59Z
- **Completed:** 2026-04-14T19:01:34Z
- **Tasks:** 1 (TDD: RED -> GREEN)
- **Files modified:** 2

## Accomplishments
- Rewrote src/middleware.ts from 138 lines of nested role-label if/else chains to 113 lines using a ROUTE_PERMISSIONS lookup map with hasPermission() checks
- Removed allowedPermissions import and isCuratorAll/isReporterAll/isSuperUser variable declarations
- Added getPermissionsFromRaw, hasPermission, getLandingPageFromPermissions imports from permissionUtils
- MW-01: Permissions parsed from JWT via getPermissionsFromRaw(decoded.permissions)
- MW-02: ROUTE_PERMISSIONS map with 7 entries covering all matcher routes
- MW-03: Baseline fallback grants ['canSearch', 'canReport'] when permissions array is empty
- MW-04: Self-only curator detection uses role labels (r.roleLabel === 'Curator_Self') with broader-role exclusion list
- MW-05: Landing page redirect uses getLandingPageFromPermissions(permissions, userRoles)
- Created 24 unit tests covering all role combinations, edge cases, and redirect behaviors
- All 56 tests pass (24 new + 32 existing) with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Failing middleware tests** - `4ecd7d9` (test: 24 tests, 3 failing against old middleware)
2. **Task 1 (TDD GREEN): Middleware rewrite** - `2fc4bdd` (feat: all 24 tests pass, 56 total pass)

Infrastructure commits (worktree setup):
- `98e8e3e` (chore: restore Phase 14 and 15-01 dependency files in worktree)

## Files Created/Modified
- `__tests__/middleware.test.ts` - 24 unit tests: ROUTE_PERMISSIONS map validation, Superuser/Curator_All/Reporter_All/Curator_Self access, Curator_Self+Reporter_All combinations, baseline fallback, no-cookie, .git 403, no-roles, landing page redirect
- `src/middleware.ts` - Complete rewrite: ROUTE_PERMISSIONS lookup map, permissionUtils imports, permission-based enforcement, self-only curator detection, baseline fallback

## Decisions Made
- Used ROUTE_PERMISSIONS lookup map (7 entries) instead of per-route if/else blocks to reduce middleware from 138 to 113 lines while making it trivially extensible
- Self-only curator detection explicitly checks role labels rather than permission keys because Curator_Self and Curator_Scoped both resolve to canCurate -- using permissions alone would incorrectly restrict Curator_Scoped users
- Baseline fallback (MW-03) grants only canSearch + canReport -- these are read-only routes; admin routes (canManageUsers, canConfigure) and mutation routes (canCurate) are intentionally excluded from baseline
- Preserved the existing `redirectToLandingPage` helper function, .git 403 check, cookie detection logic, and /error redirect for empty roles

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored Phase 14 and 15-01 dependency files in worktree**
- **Found during:** Task setup
- **Issue:** Worktree branch setup (soft reset to correct base) caused Phase 14 files (permissionUtils.ts, jest.config.js, AdminPermission models, init-models.ts) and Phase 15-01 files (userroles.controller.ts, nextauth.jsx, test files) to appear as deleted
- **Fix:** Restored all dependency files from the correct base commit via git checkout
- **Files modified:** 10 files restored
- **Verification:** All tests pass, imports resolve correctly
- **Committed in:** 98e8e3e (infrastructure commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Dependency restoration necessary for worktree setup. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - middleware is fully functional with permission-based route enforcement wired to JWT permissions from Plan 01.

## Threat Surface Scan
No new network endpoints, auth paths, file access patterns, or schema changes introduced. The middleware rewrite preserves the same trust boundaries (JWT cookie -> Edge middleware -> route handler) documented in the plan's threat model.

## Self-Check: PASSED

- src/middleware.ts: FOUND
- __tests__/middleware.test.ts: FOUND
- Commit 4ecd7d9: FOUND
- Commit 2fc4bdd: FOUND

---
*Phase: 15-auth-and-middleware*
*Completed: 2026-04-14*
