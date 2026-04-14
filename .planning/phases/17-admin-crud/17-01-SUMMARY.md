---
phase: 17-admin-crud
plan: 01
subsystem: admin-api
tags: [api, crud, roles, permissions, sequelize, transactions]
dependency_graph:
  requires: [phase-14-models]
  provides: [roles-crud-api, permissions-crud-api, check-only-delete]
  affects: [17-02-roles-ui, 17-03-permissions-ui]
tech_stack:
  added: []
  patterns: [eager-loading, transactional-mutations, destroy-and-recreate, check-only-delete, dependency-check]
key_files:
  created:
    - controllers/db/admin/roles.controller.ts
    - controllers/db/admin/permissions.controller.ts
    - src/pages/api/db/admin/roles/index.ts
    - src/pages/api/db/admin/roles/[roleId].ts
    - src/pages/api/db/admin/roles/create.ts
    - src/pages/api/db/admin/permissions/index.ts
    - src/pages/api/db/admin/permissions/[permissionId].ts
    - src/pages/api/db/admin/permissions/create.ts
    - src/pages/api/db/admin/permissions/categories.ts
  modified: []
decisions:
  - "Used any-cast on role.map callback to handle dynamic Sequelize associations not typed in model class"
  - "Permission delete checks AdminRolePermission directly rather than via adminRolePermissions alias for cleaner query"
metrics:
  duration: 4m
  completed: "2026-04-14T23:36:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 9
  files_modified: 0
---

# Phase 17 Plan 01: Roles and Permissions API Layer Summary

Complete CRUD API layer for roles and permissions with Sequelize eager-loading, transactional mutations, dependency-safe deletion with check-only mode, and duplicate-key guard on permission creation.

## What Was Built

### Roles Controller (controllers/db/admin/roles.controller.ts)
4 exported functions:
- **listAllRolesWithPermissions**: Eager-loads roles with AdminRolePermission -> AdminPermission (nested) and AdminUsersRole for user counts. Returns flat objects with `permissions[]` array and `userCount`.
- **createRole**: Transactional creation of AdminRole + bulk-insert of AdminRolePermission join rows. Validates non-empty roleLabel.
- **updateRole**: Transactional destroy-and-recreate pattern for AdminRolePermission rows, then updates AdminRole.roleLabel. Maintains referential integrity within transaction.
- **deleteRole**: Two-phase delete support. Checks AdminUsersRole for user dependencies, returning 409 with user names when blocked. Supports `?check=true` query param for check-only mode (returns `{ canDelete: true }` without deleting). Actual deletion cleans up AdminRolePermission rows first, then AdminRole.

### Permissions Controller (controllers/db/admin/permissions.controller.ts)
5 exported functions:
- **listAllPermissionsWithResources**: Eager-loads permissions with AdminPermissionResource. Ordered by category then permissionKey. Returns resourceCount alongside full resources array.
- **createPermission**: Transactional creation of AdminPermission + bulk-insert of AdminPermissionResource rows. Validates permissionKey, label, category. Catches SequelizeUniqueConstraintError returning 409.
- **updatePermission**: Transactional update. permissionKey is immutable (not accepted in payload). Destroy-and-recreate pattern for resources. Updates label, description, category.
- **deletePermission**: Two-phase delete. Checks AdminRolePermission for role dependencies, returning 409 with role labels and their user counts. Supports `?check=true` for check-only mode. Actual deletion cleans up resources first, then permission.
- **getDistinctCategories**: DISTINCT query on AdminPermission.category, returns sorted string array for combo box population.

### API Routes (7 files under src/pages/api/db/admin/)
All routes follow the established Pages Router pattern:
- Authorization header check against `reciterConfig.backendApiKey`
- 400 for missing auth, 401 for wrong auth
- Method routing (GET/POST/PUT/DELETE as appropriate)

| Route | Methods | Controller Functions |
|-------|---------|---------------------|
| /api/db/admin/roles | GET | listAllRolesWithPermissions |
| /api/db/admin/roles/[roleId] | PUT, DELETE | updateRole, deleteRole |
| /api/db/admin/roles/create | POST | createRole |
| /api/db/admin/permissions | GET | listAllPermissionsWithResources |
| /api/db/admin/permissions/[permissionId] | PUT, DELETE | updatePermission, deletePermission |
| /api/db/admin/permissions/create | POST | createPermission |
| /api/db/admin/permissions/categories | GET | getDistinctCategories |

## Deviations from Plan

None - plan executed exactly as written.

## Threat Model Compliance

All 7 threat mitigations from the plan's threat model are addressed:
- **T-17-01** (Elevation of Privilege): Every route checks Authorization header before controller delegation
- **T-17-02** (Tampering): Only expected fields destructured from req.body; no spread operator used
- **T-17-03** (Tampering): All queries use Sequelize model methods (parameterized); no raw SQL
- **T-17-04** (DoS): Dependency checks prevent cascading deletes; return 409 with info
- **T-17-05** (Info Disclosure): User names in 409 response acceptable (Superuser-only endpoint)
- **T-17-06** (Tampering): SequelizeUniqueConstraintError caught, returns 409 for duplicate permissionKey
- **T-17-07** (Tampering): permissionKey not accepted in updatePermission payload (immutable)

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Roles controller | 8a8d131 | controllers/db/admin/roles.controller.ts |
| 2 | Permissions controller | e765a3a | controllers/db/admin/permissions.controller.ts |
| 3 | API route files (7) | ff7809f | src/pages/api/db/admin/roles/*, src/pages/api/db/admin/permissions/* |

## Self-Check: PASSED

All 9 created files verified present. All 3 commit hashes verified in git log.
