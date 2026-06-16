---
phase: 15-auth-and-middleware
plan: 01
subsystem: auth
tags: [jwt, sequelize, next-auth, permissions, rbac]

# Dependency graph
requires:
  - phase: 14-permission-tables-and-models
    provides: admin_permissions, admin_role_permissions, admin_permission_resources tables and Sequelize models
provides:
  - findUserPermissionsEnriched controller function resolving permission keys and UI resources from DB
  - JWT token carrying permissions and permissionResources as JSON strings
  - Session exposing permissions and permissionResources to client components
affects: [15-auth-and-middleware plan 02 (middleware enforcement), 16-data-driven-ui (SideNavbar from permissionResources)]

# Tech tracking
tech-stack:
  added: []
  patterns: [permission-resolution-via-4-table-join, jwt-serialized-permission-arrays, try-catch-enrichment-resilience]

key-files:
  created:
    - __tests__/permissionsEnriched.test.ts
  modified:
    - controllers/db/userroles.controller.ts
    - src/pages/api/auth/[...nextauth].jsx

key-decisions:
  - "findUserPermissionsEnriched uses identical WHERE clause to findUserPermissions for consistency and proven SQL injection safety"
  - "Permissions serialized as JSON.stringify in JWT because next-auth v3 tokens store flat key-value pairs"
  - "Try/catch around enrichment calls ensures login never fails due to permission resolution errors"

patterns-established:
  - "Permission enrichment pattern: resolve permission keys first, then fetch resources only if permissions exist"
  - "Error resilience pattern: enrichment failure produces empty arrays, not login failure"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 8min
completed: 2026-04-14
---

# Phase 15 Plan 01: Permission Enrichment Summary

**findUserPermissionsEnriched resolves DB-driven permission keys and UI resources at login, serialized into JWT via both SAML and direct login auth paths**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-14T18:45:23Z
- **Completed:** 2026-04-14T18:53:05Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created findUserPermissionsEnriched function that resolves permission keys via 4-table JOIN (admin_users -> admin_users_roles -> admin_role_permissions -> admin_permissions) and fetches matching UI resources from admin_permission_resources
- Wired permission enrichment into both SAML and direct login auth paths with error-resilient try/catch wrappers
- Extended JWT callback to serialize permissions and permissionResources as JSON strings in the token
- 10 unit tests covering all role combinations (Superuser, Curator_Self, Reporter_All, Curator_All), edge cases (no roles, empty resources), input validation, and displayOrder ordering

## Task Commits

Each task was committed atomically:

1. **Task 1: findUserPermissionsEnriched controller + tests (TDD)** - `4400746` (test: RED), `da80719` (feat: GREEN)
2. **Task 2: Wire into auth paths and JWT callback** - `589cf07` (feat)

Infrastructure commits (worktree setup):
- `21dd2f9` (chore: restore Phase 14 dependency files)
- `1646255` (chore: restore .planning files and init-models.ts)

## Files Created/Modified
- `__tests__/permissionsEnriched.test.ts` - 10 unit tests for findUserPermissionsEnriched with mocked sequelize.query
- `controllers/db/userroles.controller.ts` - Added findUserPermissionsEnriched function (permission resolution + resource fetching)
- `src/pages/api/auth/[...nextauth].jsx` - Import enrichment function, call in SAML and direct login paths, serialize into JWT

## Decisions Made
- Used identical WHERE clause from existing findUserPermissions to maintain proven SQL injection protection via named replacements
- JSON.stringify for permissions arrays in JWT because next-auth v3 requires flat key-value pairs in tokens
- Try/catch around enrichment calls so permission resolution failures never block login (empty arrays as fallback)
- Kept findUserPermissions unchanged for backward compatibility -- the old userRoles field is fully preserved

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed test import pattern for SWC/next-jest transform**
- **Found during:** Task 1 (TDD RED/GREEN transition)
- **Issue:** Top-level ES module `import { findUserPermissionsEnriched }` failed with next/jest SWC transformer -- test suite reported zero tests
- **Fix:** Changed to `jest.mock` declaration first, then `require()` for function import, keeping test mock setup working correctly
- **Files modified:** `__tests__/permissionsEnriched.test.ts`
- **Verification:** All 10 tests pass
- **Committed in:** da80719 (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] Restored Phase 14 dependency files in worktree**
- **Found during:** Task 1 setup
- **Issue:** Worktree branch setup (soft reset) caused Phase 14 files (jest.config.js, permissionUtils.ts, AdminPermission models, init-models.ts) to be deleted
- **Fix:** Copied Phase 14 files from main repo and restored init-models.ts from correct branch commit
- **Files modified:** jest.config.js, src/utils/permissionUtils.ts, src/db/models/AdminPermission.ts, src/db/models/AdminRolePermission.ts, src/db/models/AdminPermissionResource.ts, src/db/models/init-models.ts
- **Verification:** All tests pass, imports resolve correctly
- **Committed in:** 21dd2f9, 1646255 (infrastructure commits)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for test infrastructure and worktree setup. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data flows are fully wired (controller queries DB, results flow through auth paths to JWT to session).

## Next Phase Readiness
- Plan 02 (middleware enforcement) can now read `token.permissions` (JSON string of permission keys) and `token.permissionResources` (JSON string of UI resource metadata) from the JWT
- Client components can access `session.data.permissions` and `session.data.permissionResources` for UI rendering
- `getPermissionsFromRaw()` from permissionUtils.ts parses the JSON strings back into arrays
- `hasPermission()` from permissionUtils.ts checks individual permission keys

## Self-Check: PASSED

- controllers/db/userroles.controller.ts: FOUND
- src/pages/api/auth/[...nextauth].jsx: FOUND
- __tests__/permissionsEnriched.test.ts: FOUND
- .planning/phases/15-auth-and-middleware/15-01-SUMMARY.md: FOUND
- Commit da80719: FOUND
- Commit 589cf07: FOUND

---
*Phase: 15-auth-and-middleware*
*Completed: 2026-04-14*
