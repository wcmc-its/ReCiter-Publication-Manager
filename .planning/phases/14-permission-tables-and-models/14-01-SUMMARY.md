---
phase: 14-permission-tables-and-models
plan: 01
subsystem: database
tags: [mysql, sequelize, rbac, permissions, migration, orm]

requires:
  - phase: none
    provides: existing AdminRole.ts and AdminUsersRole.ts model patterns
provides:
  - SQL migration script for 3 permission tables with idempotent seed data
  - Sequelize models for admin_permissions, admin_role_permissions, admin_permission_resources
  - Model associations wired in init-models.ts (6 new associations)
affects: [15-auth-and-middleware, 16-data-driven-ui, 17-admin-crud, 18-cleanup]

tech-stack:
  added: []
  patterns: [idempotent SQL migrations with ON DUPLICATE KEY UPDATE, permission table schema for data-driven RBAC]

key-files:
  created:
    - src/db/migrations/add-permission-tables.sql
    - src/db/models/AdminPermission.ts
    - src/db/models/AdminRolePermission.ts
    - src/db/models/AdminPermissionResource.ts
  modified:
    - src/db/models/init-models.ts

key-decisions:
  - "Added UNIQUE(permissionID, resourceKey) constraint on admin_permission_resources for idempotent seeding"
  - "Followed camelCase model refs (adminRoles, adminPermissions) matching AdminUsersRole.ts convention"
  - "AdminPermission.initModel and AdminPermissionResource.initModel placed before AdminRole.initModel alphabetically in initModels()"

patterns-established:
  - "Permission model pattern: AdminPermission.ts with permissionKey unique index and hasMany associations"
  - "Junction model pattern for permissions: AdminRolePermission.ts with auto-increment id PK and belongsTo both sides"
  - "Resource model pattern: AdminPermissionResource.ts with composite unique (permissionID, resourceKey)"
  - "SQL migration location: src/db/migrations/ directory for raw SQL DDL+seed scripts"

requirements-completed: [DB-01, DB-02, DB-03, DB-04, DB-05]

duration: 4min
completed: 2026-04-14
---

# Phase 14 Plan 01: Permission Tables and Models Summary

**Idempotent SQL migration creating 3 RBAC permission tables (7 permissions, 18 role mappings, 7 nav resources) with Sequelize models following existing AdminRole/AdminUsersRole patterns**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-14T16:39:08Z
- **Completed:** 2026-04-14T16:42:58Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created idempotent SQL migration with 3 CREATE TABLE IF NOT EXISTS statements, 7 permission seeds, 18 role-permission mappings, and 7 nav resource entries
- Built 3 Sequelize model files (AdminPermission, AdminRolePermission, AdminPermissionResource) matching established codebase patterns exactly
- Registered all 3 models in init-models.ts with imports, type exports, initModel calls, 6 associations, and return object entries

## Task Commits

Each task was committed atomically:

1. **Task 1: Create idempotent SQL migration script with DDL and seed data** - `05f737c` (feat)
2. **Task 2: Create three Sequelize model files and register with associations in init-models.ts** - `dc5f82d` (feat)

## Files Created/Modified
- `src/db/migrations/add-permission-tables.sql` - DDL for admin_permissions, admin_role_permissions, admin_permission_resources tables with idempotent seed data
- `src/db/models/AdminPermission.ts` - Sequelize model for admin_permissions table with permissionKey unique index
- `src/db/models/AdminRolePermission.ts` - Junction model for admin_role_permissions with FK refs to adminRoles and adminPermissions
- `src/db/models/AdminPermissionResource.ts` - Model for admin_permission_resources with composite unique (permissionID, resourceKey)
- `src/db/models/init-models.ts` - Updated with 3 model imports, type exports, initModel calls, 6 associations, and return entries

## Decisions Made
- Added UNIQUE(permissionID, resourceKey) constraint on admin_permission_resources per RESEARCH.md recommendation (enables ON DUPLICATE KEY UPDATE for idempotent seeding)
- Used camelCase model reference names (adminRoles, adminPermissions) in Sequelize references.model fields, matching established AdminUsersRole.ts convention
- Placed new initModel calls in alphabetical order among existing calls in initModels() function

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The SQL migration must be executed manually against prod reciterDB, dev reciterDB, and the ReCiterDB repo schema when deploying.

## Next Phase Readiness
- All 3 permission tables and Sequelize models are ready for Phase 15 (Auth and Middleware) to use for login-time permission resolution
- Plan 14-02 (permissionUtils.ts helper functions) can proceed independently
- No blockers or concerns

## Self-Check: PASSED

All 6 files verified present. Both task commits (05f737c, dc5f82d) found in git history.

---
*Phase: 14-permission-tables-and-models*
*Completed: 2026-04-14*
