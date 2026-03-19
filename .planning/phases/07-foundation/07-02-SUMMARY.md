---
phase: 07-foundation
plan: 02
subsystem: auth
tags: [capability-model, role-capabilities, curator-scoped, ddl-migration, import-test, constants]

# Dependency graph
requires:
  - phase: 07-01
    provides: "AdminUser model with JSON columns, scopeResolver.ts, feature/v1.1-port branch"
provides:
  - "Capability model (ROLE_CAPABILITIES, getCapabilities, getLandingPage) in constants.js"
  - "Curator_Scoped role in allowedPermissions"
  - "ALTER TABLE DDL migration for scope/proxy columns on admin_users"
  - "Import validation test script for all Phase 7 exports"
  - "admin_users table with scope_person_types, scope_org_units, proxy_person_ids columns on dev reciterDB"
affects: [08-auth-pipeline, 09-ui-components, 10-manage-users, 11-integration]

# Tech tracking
tech-stack:
  added: ["@types/handlebars (dev dependency, pre-existing build fix)"]
  patterns: ["Capability model pattern: roles -> capabilities -> route authorization via getCapabilities()", "ESM import test script pattern for validating Phase exports"]

key-files:
  created:
    - scripts/migrations/add-scope-proxy-columns.sql
    - scripts/test-phase7-imports.mjs
  modified:
    - src/utils/constants.js

key-decisions:
  - "Capability model merged additively into NextJS14 constants.js preserving all branch-specific functions"
  - "getCapabilities() baseline grants canReport + canSearch to all authenticated users"
  - "Curator_Scoped uses canCurate.scoped=true flag (consumed by scopeResolver in Phase 8)"
  - "@types/handlebars installed to fix pre-existing build failure on NextJS14 branch (Rule 3)"

patterns-established:
  - "Capability model: roles array -> getCapabilities() -> capability object consumed by middleware/API/UI"
  - "getLandingPage(caps) derives redirect target from capabilities, not raw role labels"
  - "Import test scripts in scripts/ directory for Phase validation"

requirements-completed: [PORT-03, DB-01]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 7 Plan 2: Capability Model, DDL Migration, and Build Validation Summary

**Capability model (Curator_Scoped, ROLE_CAPABILITIES, getCapabilities, getLandingPage) merged into NextJS14 constants.js, ALTER TABLE migration applied to dev database, and import test script validates all Phase 7 exports**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-19T00:19:25Z
- **Completed:** 2026-03-19T00:26:06Z
- **Tasks:** 4 (3 prior + 1 this session)
- **Files modified:** 5

## Accomplishments
- Merged capability model into NextJS14 branch's constants.js while preserving all branch-specific functions (setReportFilterKeyNames, setIsVisible, etc.)
- Created and applied ALTER TABLE DDL migration adding scope_person_types, scope_org_units, proxy_person_ids columns to admin_users
- Updated ReCiterDB repo's admin_users CREATE TABLE for new installations
- Created import test script that validates all 23 Phase 7 exports (scopeResolver + constants)
- Fixed pre-existing build failure by installing @types/handlebars

## Task Commits

Each task was committed atomically:

1. **Task 1: Merge capability model into NextJS14 constants.js** - `33e353f` (feat)
2. **Task 2: Create ALTER TABLE DDL migration and commit to ReCiterDB** - `b1d8c5c` (feat)
3. **Task 3: Apply ALTER TABLE migration to dev reciterDB** - N/A (human action, user confirmed applied)
4. **Task 4: Create import test script and run full build validation** - `218362c` (feat)

## Files Created/Modified
- `src/utils/constants.js` - Added Curator_Scoped to allowedPermissions, ROLE_CAPABILITIES map, getCapabilities(), getLandingPage()
- `scripts/migrations/add-scope-proxy-columns.sql` - ALTER TABLE DDL for 3 JSON columns on admin_users
- `scripts/test-phase7-imports.mjs` - ESM import test validating all Phase 7 exports (23 assertions)
- `package.json` - Added @types/handlebars dev dependency (build fix)
- `/Users/paulalbert/Dropbox/GitHub/ReCiterDB/setup/createDatabaseTableReciterDb.sql` - Updated admin_users CREATE TABLE with scope/proxy columns

## Decisions Made
- Capability model merged additively -- all NextJS14-specific functions (setReportFilterKeyNames, setIsVisible, Array.isArray guards) preserved
- getCapabilities() provides baseline canReport + canSearch for all authenticated users, even with no roles
- Import test uses tsx for TypeScript support without requiring full Next.js build for scopeResolver validation
- @types/handlebars installed as dev dependency to unblock build (pre-existing issue on NextJS14 branch)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @types/handlebars to fix pre-existing build failure**
- **Found during:** Task 4 (npm run build)
- **Issue:** controllers/db/notifications/notifictions.sendEmail.controller.ts imports handlebars but @types/handlebars was not installed, causing TypeScript compilation error. This failure exists on the base NextJS14 branch (verified by stashing Phase 7 changes and rebuilding).
- **Fix:** Ran `npm install --save-dev @types/handlebars`
- **Files modified:** package.json, package-lock.json
- **Verification:** npm run build succeeds with exit code 0
- **Committed in:** 218362c (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary to unblock the build. The missing type declaration was a pre-existing issue on the NextJS14 branch, not caused by Phase 7 changes. No scope creep.

## Issues Encountered
None beyond the pre-existing build failure documented above.

## User Setup Required
None - database migration was applied by user during Task 3 checkpoint.

## Next Phase Readiness
- Capability model ready for Phase 8 auth pipeline (getCapabilities consumed by middleware + nextauth callbacks)
- scopeResolver.ts + AdminUser JSON columns ready for Phase 8 scope enforcement
- getLandingPage() ready for Phase 8 login redirect logic
- All Phase 7 exports validated by import test script (23 assertions passing)
- npm run build passes cleanly (SWC compiles all Phase 7 files)
- dev reciterDB has scope/proxy columns ready for Phase 8 queries

## Self-Check: PASSED

All files exist on disk. All commits verified in git log.

---
*Phase: 07-foundation*
*Completed: 2026-03-18*
