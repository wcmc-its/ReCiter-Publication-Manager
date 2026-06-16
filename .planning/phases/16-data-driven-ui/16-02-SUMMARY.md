---
phase: 16-data-driven-ui
plan: 02
subsystem: ui-components
tags: [data-driven-ui, permissions, role-migration, permission-checks]
dependency_graph:
  requires: [16-01]
  provides: [permission-based-ui-components, deprecated-allowedPermissions]
  affects: [ReciterTabs, FilterReview, Search, Profile, Notifications, ManageProfile, Login, App, index]
tech_stack:
  added: []
  patterns: [permission-based-visibility, getLandingPageFromPermissions-redirect]
key_files:
  created: []
  modified:
    - src/components/elements/CurateIndividual/ReciterTabs.tsx
    - src/components/elements/CurateIndividual/CurateIndividual.tsx
    - src/components/elements/Search/FilterReview.tsx
    - src/components/elements/Search/Search.js
    - src/components/elements/Profile/Profile.tsx
    - src/components/elements/Notifications/Notifications.tsx
    - src/components/elements/ManageProfile/ManageProfile.tsx
    - src/components/elements/Login/Login.js
    - src/components/elements/App/App.js
    - src/pages/index.js
    - src/utils/constants.js
decisions:
  - Used (session as any)?.data?.permissions cast pattern consistent with usePermissions hook from Plan 01
  - Preserved isCuratorSelf/isSuperUserORCuratorAll state variables in Notifications and ManageProfile as they control conditional rendering blocks
  - Login and index.js parse userRoles only for getLandingPageFromPermissions self-only detection (roles needed, not just permissions)
  - Profile email visibility fix: replaced buggy (allowedPermissions.Superuser || allowedPermissions.Curator_Self) OR with hasPermission canCurate || canManageUsers
metrics:
  duration: 8m 56s
  completed: "2026-04-14T21:25:27Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 0
  tests_total: 67
  files_changed: 11
---

# Phase 16 Plan 02: Permission-Based UI Components Summary

Converted all 10 remaining UI components from role-label checking (JSON.parse + allowedPermissions matching) to permission-based checking (getPermissionsFromRaw + hasPermission), eliminating all client-side role parsing for visibility decisions.

## What Changed

### Task 1: ReciterTabs and CurateIndividual

**ReciterTabs.tsx**: Removed `allowedPermissions` import, `allowedRoleNames` from tabsData array (5 entries), `allowedRoleNames` from useEffect push, and `JSON.parse(session.data.userRoles)` role-matching block. Replaced with single `canCurate` permission gate before the tab rendering loop. All 5 tabs require the same permission, so a single early-return null check replaces per-tab role checking.

**CurateIndividual.tsx**: Removed unused `allowedPermissions` import (retained `toastMessage`).

### Task 2: All Remaining Files (8 files + constants.js)

**FilterReview.tsx**: Collapsed 150-line role cascade (12 if/else-if branches) into 3 permission checks (`canCurate`, `canReport`). Removed 4 state variables (`isCuratorSelf`, `isCuratorAll`, `isReporterAll`, `isSuperUser`), `dropdownTitle`/`dropdownMenuItems` state, and the entire useEffect. RoleSplitDropdown is now 15 lines. Removed unused `useEffect`, `ListItem` imports.

**Search.js**: Removed 6 role state variables and 100-line role cascade from useEffect. Added render-time permission computation (`canCurate`, `canReport`, `canManageUsers`, `canSearch`, `isSelfOnly`). RoleSplitDropdown collapsed to 20 lines. Pending column visibility uses `canManageUsers || (canCurate && canSearch)`. Name column click behavior uses `isSelfOnly` derived from permissions. FilterReview `showPendingToggle` prop converted.

**Profile.tsx**: Replaced `JSON.parse(session.data.userRoles)` with `getPermissionsFromRaw`. Fixed buggy email visibility check: `(allowedPermissions.Superuser || allowedPermissions.Curator_Self)` evaluated to `"Superuser"` (first truthy string), meaning only Superusers saw emails. New check: `hasPermission(permissions, 'canCurate') || hasPermission(permissions, 'canManageUsers')` correctly shows emails for both curators and admins.

**Notifications.tsx**: Replaced `JSON.parse(session.data.userRoles)` + `allowedPermissions` role checks with `getPermissionsFromRaw` + `hasPermission` for `canCurate`, `canManageUsers`, `canSearch`. Existing state variables (`isCuratorSelf`, `isSuperUserORCuratorAll`, `isReporterAll`) preserved as they control conditional rendering blocks, but their values now derive from permissions.

**ManageProfile.tsx**: Same pattern as Notifications -- replaced role parsing with permission checks while preserving the existing state-driven rendering logic.

**Login.js**: Post-login redirect replaced with `getLandingPageFromPermissions()` utility. Handles inactive users, empty permissions, and self-only detection through the tested utility function. Removed `allowedPermissions` import.

**App.js**: Fixed existing bug where `userPermissions` and `allowedPermissions` were referenced but never defined. Replaced with async session resolution using `getPermissionsFromRaw` + `hasPermission('canCurate')`. Added `permissionUtils` import.

**index.js (SSR)**: Collapsed 100 lines of duplicated role cascades (SAML and non-SAML blocks had identical logic) into 15 lines using `getPermissionsFromRaw` + `getLandingPageFromPermissions`. Single unified code path handles both SAML and local auth.

**constants.js**: Added `@deprecated` JSDoc comment to `allowedPermissions` export. Not removed -- still imported by `[...nextauth].jsx` and `middleware.ts` for self-only detection. Phase 18 will clean up.

## Verification Results

- `npx next build` succeeds with zero errors
- 67/67 tests pass (0 new, 67 existing)
- Zero `allowedRoleNames` references in src/components, src/pages, or types
- Zero `allowedPermissions` imports in any component file
- Zero `JSON.parse(session.data.userRoles)` for visibility decisions (remaining uses are for landing page routing via `getLandingPageFromPermissions`)
- Net reduction: 430 lines removed, 131 lines added (299 line reduction)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed App.js undefined variable references**
- **Found during:** Task 2
- **Issue:** App.js referenced `userPermissions` and `allowedPermissions` that were never defined or imported in scope, causing a runtime error
- **Fix:** Replaced with async session resolution using getPermissionsFromRaw + hasPermission
- **Files modified:** src/components/elements/App/App.js
- **Commit:** ba1b2d2

**2. [Rule 1 - Bug] Fixed Profile.tsx email visibility logic**
- **Found during:** Task 2
- **Issue:** `(allowedPermissions.Superuser || allowedPermissions.Curator_Self)` evaluated to `"Superuser"` (JS OR returns first truthy), so only Superusers saw emails despite intent to include Curator_Self
- **Fix:** Replaced with `hasPermission(permissions, 'canCurate') || hasPermission(permissions, 'canManageUsers')` matching original intent
- **Files modified:** src/components/elements/Profile/Profile.tsx
- **Commit:** ba1b2d2

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 2251106 | feat(16-02): convert ReciterTabs and CurateIndividual to permission checks |
| 2 | ba1b2d2 | feat(16-02): convert all remaining UI components to permission-based checks |

## Self-Check: PASSED

- All 11 modified files exist on disk
- All 2 commits found in git history
- SUMMARY.md exists at expected path
