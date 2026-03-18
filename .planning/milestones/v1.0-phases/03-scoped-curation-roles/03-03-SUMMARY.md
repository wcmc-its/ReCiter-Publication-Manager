---
phase: 03-scoped-curation-roles
plan: 03
subsystem: ui
tags: [react, mui-autocomplete, sequelize, react-bootstrap, css-modules, form-validation, rbac]

# Dependency graph
requires:
  - phase: 03-scoped-curation-roles/03-01
    provides: AdminUsersPersonType model, init-models associations, allowedPermissions with Curator_Scoped
  - phase: 03-scoped-curation-roles/03-02
    provides: JWT scopeData embedding, middleware scope enforcement, findUserPermissions returning scopeData
provides:
  - CurationScopeSection form component for assigning person type and org unit scope
  - Server-side mutual exclusion validation (Curator_All + Curator_Scoped)
  - Person type scope persistence in create/edit user flows
  - Roles column with inline scope summary in UsersTable
  - Role filter dropdown in ManageUsers page
  - fetchUserPersonTypes API endpoint for edit-mode pre-population
affects: [03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional form section via react-bootstrap Collapse with derived boolean state"
    - "Sequelize includes for enriched list queries (roles + departments + person types)"
    - "Server-side role label resolution for validation before persist"
    - "CSS Modules for scoped component styling (fieldset/legend pattern)"

key-files:
  created:
    - src/components/elements/AddUser/CurationScopeSection.tsx
    - src/components/elements/AddUser/CurationScopeSection.module.css
    - src/pages/api/db/admin/users/persontypes/index.ts
  modified:
    - src/components/elements/AddUser/AddUser.tsx
    - controllers/db/manage-users/user.controller.ts
    - src/components/elements/Manage/UsersTable.tsx
    - src/components/elements/Manage/ManageUsers.tsx

key-decisions:
  - "Departments field relocated inside CurationScopeSection when Curator_Scoped is selected, stays in original position otherwise"
  - "Server-side mutual exclusion resolves role IDs to labels via AdminRole.findByPk before comparison"
  - "listAllUsers enriched with Sequelize includes (distinct: true for correct count with associations)"
  - "Role filter uses required: true on AdminUsersRole include with where clause on role label"

patterns-established:
  - "Conditional form sections: derive boolean from state, wrap in Collapse, render sub-component"
  - "Enriched list API: add includes to findAndCountAll with distinct: true for correct pagination"

requirements-completed: [SCOPE-01, SCOPE-04, SCOPE-05, SCOPE-06]

# Metrics
duration: 14min
completed: 2026-03-17
---

# Phase 3 Plan 3: Admin Scope Assignment UI Summary

**CurationScopeSection form component with mutual exclusion validation, scope persistence to admin_users_person_types, roles column with inline scope summary in UsersTable, and role filter dropdown in ManageUsers**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-17T16:06:06Z
- **Completed:** 2026-03-17T16:20:09Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- CurationScopeSection renders conditionally when Curator_Scoped is selected, with fieldset/legend for accessibility, Person Types and Organizational Units multi-selects
- Client and server-side mutual exclusion validation prevents Curator_All + Curator_Scoped combination
- Person type scope persisted to admin_users_person_types in both create and edit user transaction flows
- UsersTable shows Roles column with inline scope summary ("Curator_Scoped (Faculty, Surgery)")
- ManageUsers has working role filter dropdown that filters users by selected role via server-side query

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CurationScopeSection component, extend AddUser form, and update user controller** - `f9e851f` (feat)
2. **Task 2: Add roles column to UsersTable and role filter to ManageUsers** - `366180b` (feat)

## Files Created/Modified
- `src/components/elements/AddUser/CurationScopeSection.tsx` - Conditional scope assignment form with Person Types and Org Units multi-selects
- `src/components/elements/AddUser/CurationScopeSection.module.css` - Scoped styles for the scope section (#f5f5f5 background, 16px padding)
- `src/components/elements/AddUser/AddUser.tsx` - Extended with CurationScopeSection, mutual exclusion validation, personTypeLabels payload, edit-mode scope loading
- `controllers/db/manage-users/user.controller.ts` - Server-side validation, scope persistence, enriched listAllUsers with role/dept/personType includes, fetchUserPersonTypes
- `src/pages/api/db/admin/users/persontypes/index.ts` - API route for fetching a user's person type scope assignments
- `src/components/elements/Manage/UsersTable.tsx` - Added Roles column with scope summary, populated Department column from enriched data, scope="col" on all headers
- `src/components/elements/Manage/ManageUsers.tsx` - Added role filter dropdown with all role options, wired to server-side filtering

## Decisions Made
- Departments field relocated inside CurationScopeSection when Curator_Scoped is selected, stays in its original position outside the section otherwise (avoids duplicating the field)
- Server-side mutual exclusion resolves role IDs to labels via AdminRole.findByPk before comparison (because form sends role IDs, not labels)
- listAllUsers uses distinct: true in findAndCountAll to get correct count when Sequelize includes create JOINs
- Role filter is server-side (required: true on include with where clause) rather than client-side for correct pagination behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin scope assignment workflow complete: create, edit, view, and filter scoped curators
- Plans 03-04 (Search scope filtering, ScopeFilterCheckbox) and 03-05 (Navbar scope label, curate page denial) can proceed
- All enriched user data (roles, departments, person types) available from listAllUsers API

## Self-Check: PASSED

All created files verified on disk. All task commits found in git log.

---
*Phase: 03-scoped-curation-roles*
*Completed: 2026-03-17*
