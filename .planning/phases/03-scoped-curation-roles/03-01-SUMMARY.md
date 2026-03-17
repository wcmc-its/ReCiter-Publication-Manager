---
phase: 03-scoped-curation-roles
plan: 01
subsystem: auth
tags: [rbac, sequelize, scope-resolution, curator-scoped, jest]

# Dependency graph
requires:
  - phase: 01-login-and-nav
    provides: "Capability model (getCapabilities, ROLE_CAPABILITIES, allowedPermissions)"
provides:
  - "Curator_Scoped role in allowedPermissions and ROLE_CAPABILITIES"
  - "AdminUsersPersonType Sequelize model for scope junction table"
  - "isPersonInScope() pure function for scope resolution"
  - "Extended getCapabilities() with scoped/scopeData fields"
affects: [03-02, 03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["AND across dimensions, OR within dimensions for scope resolution", "Junction table pattern for many-to-many scope assignment"]

key-files:
  created:
    - src/db/models/AdminUsersPersonType.ts
    - src/utils/scopeResolver.ts
    - __tests__/utils/constants-scoped.test.ts
    - __tests__/utils/scopeResolver.test.ts
  modified:
    - src/db/models/init-models.ts
    - src/utils/constants.js

key-decisions:
  - "scopeResolver.ts is a pure function (no DB access) usable in Edge middleware, Node API, and React"
  - "Null dimension means no restriction on that axis (not empty array)"
  - "AdminUsersPersonType uses STRING(128) for personType to match existing person_person_type patterns"

patterns-established:
  - "Scope resolution: AND across dimensions (personTypes AND orgUnits), OR within (any match suffices)"
  - "Capability model extension: add role to allowedPermissions, ROLE_CAPABILITIES, and merge logic in getCapabilities"

requirements-completed: [SCOPE-01, SCOPE-06]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 03 Plan 01: Data Model and Scope Resolution Summary

**Curator_Scoped capability model, AdminUsersPersonType junction table, and isPersonInScope() resolver with 25 unit tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-17T15:04:34Z
- **Completed:** 2026-03-17T15:09:03Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Curator_Scoped role registered in capability model with canCurate.scoped flag and scopeData carrier
- AdminUsersPersonType Sequelize model created following existing junction table patterns (AdminUsersDepartment)
- isPersonInScope() pure function implements AND/OR scope logic with comprehensive edge case handling
- 25 unit tests (12 for capabilities, 13 for scope resolver) all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: AdminUsersPersonType model + Curator_Scoped capability** - TDD
   - `1aebafe` (test: add failing tests for Curator_Scoped capability model)
   - `603d071` (feat: add AdminUsersPersonType model and Curator_Scoped capability)
2. **Task 2: scopeResolver utility with isPersonInScope()** - TDD
   - `8be8347` (test: add tests for isPersonInScope scope resolver)
   - Implementation was pre-existing from commit `a027b4b` (prior session)

## Files Created/Modified
- `src/db/models/AdminUsersPersonType.ts` - Sequelize model for admin_users_person_types junction table
- `src/utils/scopeResolver.ts` - Pure isPersonInScope() function with ScopeData interface
- `src/utils/constants.js` - Curator_Scoped in allowedPermissions, ROLE_CAPABILITIES, and getCapabilities()
- `src/db/models/init-models.ts` - AdminUsersPersonType registration, initModel, associations
- `__tests__/utils/constants-scoped.test.ts` - 12 tests for capability model with Curator_Scoped
- `__tests__/utils/scopeResolver.test.ts` - 13 tests for scope resolution logic

## Decisions Made
- scopeResolver.ts implemented as a pure function with no database dependency, enabling use across Edge middleware (via JWT-embedded scope data), Node.js API routes, and React components
- Null dimension means "no restriction" (matches everything), while empty array would mean "nothing matches" -- null is the correct representation for unconfigured scope axes
- AdminUsersPersonType uses STRING(128) for personType field to match the existing person_person_type table's string-based person types

## Deviations from Plan

### Observation: scopeResolver.ts pre-existed

The scopeResolver.ts implementation was already committed in a prior session (commit a027b4b as part of plan 03-02 work). The tests were written fresh in this execution and validate the pre-existing implementation. This is not a deviation in logic -- the file matches the plan specification exactly.

---

**Total deviations:** 0 functional deviations
**Impact on plan:** None -- all artifacts match specification.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Capability model ready for middleware enforcement (Plan 03-02)
- isPersonInScope() ready for API route filtering (Plan 03-03)
- AdminUsersPersonType model ready for user management CRUD (Plan 03-04)

---
*Phase: 03-scoped-curation-roles*
*Completed: 2026-03-17*

## Self-Check: PASSED

All 6 files verified present. All 3 commits verified in git history.
