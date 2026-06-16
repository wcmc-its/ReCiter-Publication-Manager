# Phase 16: Data-Driven UI - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The navigation menu and component-level permission checks are driven by database data instead of hardcoded arrays. SideNavbar renders from `permissionResources` session data. All UI components that currently check `allowedRoleNames` or parse `userRoles` switch to using the `permissions` and `permissionResources` arrays from the JWT. No new permissions, no new DB tables, no admin CRUD -- those are Phases 17-18.

</domain>

<decisions>
## Implementation Decisions

### Icon Strategy
- **D-01:** Switch from PNG image imports to MUI icons. Create an icon registry (`src/utils/iconRegistry.ts`) that maps DB icon strings (e.g., `Search`, `LocalLibrary`, `Assessment`) to MUI icon components.
- **D-02:** Remove old PNG icon imports from SideNavbar (`facultyIcon`, `chartIcon`, `checkMarkIcon`, etc.) and their active variants. The MUI icons handle active/inactive states via props (color, className).
- **D-03:** The 7 icon names in the DB seed (`Search`, `LocalLibrary`, `Assessment`, `NotificationsActive`, `AccountCircle`, `Group`, `Settings`) are the canonical set. Registry must cover all 7.

### Nav Rendering
- **D-04:** SideNavbar reads `permissionResources` from session, filters by `resourceType === 'nav'`, sorts by `displayOrder`, and renders each item dynamically.
- **D-05:** The `MenuItem` type and `allowedRoleNames` property are replaced. Nav items come from DB data (icon, label, route, displayOrder) not a hardcoded array.
- **D-06:** NestedListItem follows the same pattern -- it receives data-driven items, not hardcoded role arrays.

### Mixed Visibility Rules
- **D-07:** Permission controls visibility (show/hide). Application state controls enabled/disabled. If a user lacks the permission, the nav item is hidden entirely. If they have the permission but state isn't ready (e.g., no identity selected for Curate), the item appears but is disabled/grayed.
- **D-08:** Manage Notifications visibility combines permission check (`canManageNotifications` in permissions array) AND the existing admin settings check (`isVisibleNotification`) AND email requirement. All three must pass to show the item.

### ReciterTabs Conversion
- **D-09:** ReciterTabs stops using `allowedRoleNames` arrays. Tab visibility is determined by checking `hasPermission(permissions, 'canCurate')` from `permissionUtils.ts`. Since all 5 tabs require the same `canCurate` permission, a single check gates the entire tab set.
- **D-10:** No new `permissionResources` entries needed for tabs at this phase -- the existing `canCurate` permission check is sufficient. Tab resources can be added later if per-tab granularity is needed (Phase 17 or backlog).

### Full Role-Check Conversion Scope
- **D-11:** All UI components that reference `allowedRoleNames` or parse `session.data.userRoles` for visibility decisions are converted to use `permissions` and/or `permissionResources` from the session. This is a full sweep across all 14 files identified.
- **D-12:** Files in scope: SideNavbar.tsx, NestedListItem.tsx, ReciterTabs.tsx, CurateIndividual.tsx, Search.js, FilterReview.tsx, Profile.tsx, Notifications.tsx, ManageProfile.tsx, Login.js, App.js, index.js, constants.js. Note: `[...nextauth].jsx` already updated in Phase 15.
- **D-13:** The conversion pattern is: replace `JSON.parse(session.data.userRoles)` + `role.roleLabel` matching with `getPermissionsFromRaw(session.data.permissions)` + `hasPermission()` calls from `permissionUtils.ts`.

### Deferred Requirements
- **D-14:** UI-04 (Grant Proxy button permission check) is deferred. `GrantProxyModal.tsx` and related proxy UI components were deleted in Phase 14. They will be rebuilt with the permission model when v1.1 proxy work resumes.
- **D-15:** UI-05 (`checkCurationScope.ts` permission conversion) is deferred. The file was deleted in Phase 14. Server-side scope enforcement will be rebuilt with permissions when v1.1 resumes.

### Claude's Discretion
- Exact structure of the icon registry file (default export vs named, typing approach)
- How to handle the Curate Publications route dynamic segment (`/curate` needs a personIdentifier appended for Curator_Self users)
- Whether to create a shared `usePermissions()` hook or keep inline `getPermissionsFromRaw()` calls in each component
- Error/fallback behavior when permissionResources is empty or malformed
- Whether `allowedPermissions` in constants.js gets updated or removed (may overlap with Phase 18 cleanup)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema and Design
- `docs/superpowers/specs/2026-04-14-data-driven-rbac-design.md` -- Complete schema definitions for permission tables, seed data, column types (deleted from working tree in Phase 14 commit but available in git history)
- `src/db/migrations/add-permission-tables.sql` -- Canonical seed data including 7 permission resource rows with icon names, labels, routes, display orders

### Requirements
- `.planning/REQUIREMENTS.md` section "UI Gating" -- UI-01 through UI-05 requirements for this phase (UI-04, UI-05 deferred)

### Phase 14 Context
- `.planning/phases/14-permission-tables-and-models/14-CONTEXT.md` -- Decisions on model patterns, helper utility design, association scope

### Existing Patterns (must read before modifying)
- `src/components/elements/Navbar/SideNavbar.tsx` -- Current hardcoded nav items with allowedRoleNames (7 items, PNG icons, mixed visibility rules)
- `src/components/elements/Navbar/NestedListItem.tsx` -- Companion component with same role-check pattern
- `src/components/elements/CurateIndividual/ReciterTabs.tsx` -- 5 hardcoded tabs with allowedRoleNames
- `src/utils/permissionUtils.ts` -- Phase 14 permission helpers: hasPermission(), getPermissionsFromRaw(), getLandingPageFromPermissions()
- `src/middleware.ts` -- Phase 15 permission-based middleware with ROUTE_PERMISSIONS map (reference for permission key naming)
- `src/pages/api/auth/[...nextauth].jsx` -- JWT/session callbacks carrying permissions and permissionResources
- `src/db/models/AdminPermissionResource.ts` -- Sequelize model for permission resources table

### Icon System
- `@mui/icons-material` package -- Already a dependency. MUI icon components to replace PNG imports.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `permissionUtils.ts`: `hasPermission()` and `getPermissionsFromRaw()` are the primary utilities for permission checks -- all UI components should use these
- `AdminPermissionResource.ts` Sequelize model: defines the shape of permissionResources objects (id, permissionID, resourceType, resourceKey, displayOrder, icon, label, route)
- `@mui/icons-material`: Already installed and used elsewhere (ChevronLeftIcon, ChevronRightIcon in SideNavbar). Full MUI icon library available.
- `ROUTE_PERMISSIONS` map in middleware.ts: Reference for which permission key maps to which route

### Established Patterns
- Session access: `const [session, loading] = useSession()` or `const session = useSession()` -- varies by component
- Role parsing: `JSON.parse(session.data.userRoles)` then filter by `roleLabel` -- this is the pattern being replaced
- New pattern: `getPermissionsFromRaw(session.data.permissions)` then `hasPermission(permissions, key)`
- Admin settings integration: `session.adminSettings` or `updatedAdminSettings` used for dynamic UI config
- Redux state: `useSelector((state: RootStateOrAny) => state.filters)` for application state checks

### Integration Points
- `SideNavbar.tsx` is rendered by `AppLayout.jsx` which wraps all authenticated pages
- `ReciterTabs.tsx` is rendered by `CurateIndividual.tsx` on the `/curate/[id]` page
- `session.data.permissions` (JSON string) and `session.data.permissionResources` (JSON string) are set in `[...nextauth].jsx` JWT callback
- `types/menu.d.ts` defines `MenuItem` interface with `allowedRoleNames` -- needs updating or replacement

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- standard data-driven rendering approach using existing session data and MUI icon components.

</specifics>

<deferred>
## Deferred Ideas

- **UI-04 (Grant Proxy button)** -- GrantProxyModal and proxy UI deleted in Phase 14. Rebuild with permission model when v1.1 proxy work resumes.
- **UI-05 (checkCurationScope permission conversion)** -- File deleted in Phase 14. Rebuild with permission-based server-side scope enforcement when v1.1 resumes.
- **Per-tab permission resources** -- Current 5 curation tabs all share `canCurate`. Finer-grained tab resources (tab_suggested, tab_accepted, etc.) can be seeded in Phase 17 if needed.
- **Dynamic icon loading** -- Could eventually load icons lazily or from a CDN. Not needed now with a static registry of 7 icons.

</deferred>

---

*Phase: 16-data-driven-ui*
*Context gathered: 2026-04-14*
