---
phase: 16-data-driven-ui
plan: 01
subsystem: navigation
tags: [data-driven-ui, permissions, icons, navbar, mui]
dependency_graph:
  requires: [14-01, 14-02, 15-01, 15-02]
  provides: [data-driven-navbar, icon-registry, usePermissions-hook]
  affects: [SideNavbar, MenuListItem, NestedListItem, MenuItem-type]
tech_stack:
  added: [icon-registry-pattern, usePermissions-hook]
  patterns: [permission-resource-rendering, mui-svg-icons, data-driven-nav]
key_files:
  created:
    - src/utils/iconRegistry.ts
    - src/hooks/usePermissions.ts
    - __tests__/iconRegistry.test.ts
  modified:
    - types/menu.d.ts
    - src/components/elements/Navbar/SideNavbar.tsx
    - src/components/elements/Navbar/MenuListItem.tsx
    - src/components/elements/Navbar/NestedListItem.tsx
decisions:
  - Used typeof SvgIcon instead of non-exported SvgIconComponent type from @mui/icons-material
  - Preserved ExpandNavContext import path as .jsx (existing file, not renamed)
  - Kept session type casting via (session as any) for data access since next-auth v3 types lack data property
metrics:
  duration: 6m 16s
  completed: "2026-04-14T21:12:04Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 11
  tests_total: 67
  files_changed: 7
---

# Phase 16 Plan 01: Data-Driven Navigation Summary

Icon registry with MUI component resolution, usePermissions session hook, and full SideNavbar/MenuListItem/NestedListItem rewrite rendering from permissionResources JWT claims instead of hardcoded menuItems array.

## What Changed

### Task 1: Icon Registry, usePermissions Hook, and MenuItem Type (TDD)

**Icon registry** (`src/utils/iconRegistry.ts`): Static map from 7 DB icon strings (Search, LocalLibrary, Assessment, NotificationsActive, AccountCircle, Group, Settings) to MUI SvgIcon components. `getIcon()` function returns the matched component or HelpOutlineIcon as fallback for null, undefined, empty, or unknown names.

**usePermissions hook** (`src/hooks/usePermissions.ts`): Convenience hook wrapping `useSession()` with memoized parsing of `session.data.permissions` (via `getPermissionsFromRaw`) and `session.data.permissionResources` (JSON parse with error handling). Returns `{ permissions, permissionResources, hasPermission, session, loading }`.

**MenuItem type** (`types/menu.d.ts`): Removed legacy fields (`imgUrl`, `imgUrlActive`, `allowedRoleNames`, `isRequired`). Added `icon?: SvgIconComponent` and `permissionKey?: string`.

**Tests**: 11 unit tests covering all 7 canonical icon names plus 4 fallback cases. All pass.

### Task 2: Data-Driven Nav Component Rewrite

**SideNavbar.tsx**: Removed all PNG icon imports (10 imports), hardcoded `menuItems` array (100+ lines), `isCurateSelf` state, and `JSON.parse(session.data.userRoles)` role matching. Replaced with `usePermissions()` hook, `getIcon()` resolution, and `permissionResources.filter(r => r.resourceType === 'nav')` rendering loop. Nav items sorted by `displayOrder` from DB seed data. Permission-based visibility via `hasPermission(permissions, item.permissionKey)`. Special cases preserved: Manage Notifications triple-check (permission + isVisibleNotification admin setting + session email), route adjustments for curate/notifications/profile user-specific paths, Curate Publications disabled when no identity selected.

**MenuListItem.tsx**: Replaced `Image` import and PNG icon rendering with `icon: IconComponent` prop receiving MUI SvgIconComponent. Renders `<IconComponent fontSize="small" aria-hidden="true" />` inside ListItemIcon. MUI StyledList CSS handles selected/hover color states (white on orange). Preserved: router path matching, Link wrapping, disabled state, ListItemText.

**NestedListItem.tsx**: Removed `Image` import, `ImageSourcePropType`, `useSession`, and role-checking loop. Accepts `icon?: SvgIconComponent` prop. Renders pre-filtered items from SideNavbar without role re-checking. Preserved: expand/collapse behavior, Box wrapping, CSS module styles.

## Verification Results

- 11/11 icon registry tests pass
- 67/67 full test suite passes (11 new + 56 existing)
- `npx next build` succeeds with zero TypeScript errors
- No `allowedRoleNames` in any nav component
- No `imgUrl` or `imgUrlActive` in MenuListItem
- No `JSON.parse(session.data.userRoles)` in any nav component

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | 3db4e22 | test(16-01): add failing tests for icon registry |
| 1 (GREEN) | 31b02aa | feat(16-01): create icon registry, usePermissions hook, and update MenuItem type |
| 2 | 6f8d905 | feat(16-01): rewrite nav components for data-driven rendering from permissionResources |

## Self-Check: PASSED

- All 3 created files exist on disk
- All 4 modified files exist on disk
- All 3 commits found in git history
- SUMMARY.md exists at expected path
