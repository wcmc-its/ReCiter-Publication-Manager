---
phase: 14-permission-tables-and-models
plan: 02
subsystem: auth-utilities
tags: [typescript, jest, rbac, permissions, tdd, unit-tests]

requires:
  - phase: 14-01
    provides: AdminPermission, AdminRolePermission, AdminPermissionResource Sequelize models
provides:
  - Permission helper functions (hasPermission, getPermissionsFromRaw, getLandingPageFromPermissions) for Phase 15+ consumption
  - Unit test suite with 22 test cases covering permission helpers and model smoke tests
  - Jest configuration for the dev_Upd_NextJS14SNode18 branch
affects: [15-auth-and-middleware, 16-data-driven-ui, 18-cleanup]

tech-stack:
  added: []
  patterns: [TDD red-green workflow, isomorphic utility functions, role-based self-only detection via BROADER_CURATE_ROLES]

key-files:
  created:
    - src/utils/permissionUtils.ts
    - __tests__/permissionUtils.test.ts
    - jest.config.js
  modified: []

key-decisions:
  - "Self-only curator detection uses BROADER_CURATE_ROLES constant checking role labels, not permission set membership"
  - "getLandingPageFromPermissions extracts personIdentifier from the Curator_Self role entry specifically (not roles[0])"
  - "Created jest.config.js from scratch since it did not exist on the dev_Upd_NextJS14SNode18 branch"
  - "Model smoke tests verify export structure (typeof initModel === function) rather than sqlite initialization since sqlite3 is not installed"

patterns-established:
  - "Permission utility pattern: isomorphic module with no browser/server-only imports for use in Edge middleware, API routes, and React components"
  - "BROADER_CURATE_ROLES constant for self-only curator detection (Superuser, Curator_All, Curator_Scoped, Curator_Department, Curator_Department_Delegate)"

requirements-completed: [DB-04, DB-05]

duration: 4min
completed: 2026-04-14
---

# Phase 14 Plan 02: Permission Helper Functions and Unit Tests Summary

**TDD-driven permission utilities (hasPermission, getPermissionsFromRaw, getLandingPageFromPermissions) with 22 passing tests including critical Curator_Self + Reporter_All landing page parity**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-14T16:48:40Z
- **Completed:** 2026-04-14T16:52:55Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Created jest.config.js for the dev_Upd_NextJS14SNode18 branch (missing from this branch, required for test execution)
- Built 22 unit tests covering all permission helper functions and model smoke tests (TDD RED phase)
- Implemented three isomorphic permission helper functions that mirror existing getLandingPage behavior (TDD GREEN phase)
- Verified critical Curator_Self + Reporter_All test case returns /curate/paa2013 (not /search), matching the existing getLandingPage behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Create unit test file for permission helpers and model smoke tests** - `2b7b583` (test)
2. **Task 2: Implement permissionUtils.ts helper functions** - `940632a` (feat)

## Files Created/Modified
- `jest.config.js` - Jest configuration with ts-jest transform and node test environment
- `__tests__/permissionUtils.test.ts` - 22 test cases: 5 hasPermission, 6 getPermissionsFromRaw, 8 getLandingPageFromPermissions, 3 model smoke tests
- `src/utils/permissionUtils.ts` - Three exported functions: hasPermission, getPermissionsFromRaw, getLandingPageFromPermissions

## Decisions Made
- Self-only curator detection uses BROADER_CURATE_ROLES constant to check role labels (not permission set membership), preventing Curator_Self + Reporter_All from incorrectly landing on /search
- getLandingPageFromPermissions extracts personIdentifier from the Curator_Self role entry specifically rather than using roles[0], ensuring correct ID even when Curator_Self is not the first role
- Created jest.config.js from scratch since it did not exist on the dev_Upd_NextJS14SNode18 branch (deviation from plan assumption that it existed)
- Model smoke tests use export structure verification (typeof initModel === 'function') since sqlite3 is not installed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created jest.config.js (missing from branch)**
- **Found during:** Task 1
- **Issue:** jest.config.js did not exist on the dev_Upd_NextJS14SNode18 branch, blocking all test execution
- **Fix:** Created minimal jest.config.js with ts-jest transform, node environment, and __tests__/*.test.(ts|tsx|js) match pattern
- **Files created:** jest.config.js
- **Commit:** 2b7b583

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness
- permissionUtils.ts exports are ready for Phase 15 (Auth and Middleware) to import for JWT permission resolution and middleware enforcement
- getLandingPageFromPermissions can be called from next-auth JWT callback after permission resolution
- hasPermission can be called from Edge middleware for route-level permission checks
- No blockers or concerns

## Self-Check: PASSED

All 3 files verified present. Both task commits (2b7b583, 940632a) found in git history. All 3 exported functions confirmed. 22/22 tests pass.

---
*Phase: 14-permission-tables-and-models*
*Completed: 2026-04-14*
