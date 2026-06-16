# Phase 17: Admin CRUD - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Superusers can view, create, edit, and delete roles and permissions through a tabbed interface in the Manage Users page, with safety guards preventing deletion of in-use items. No new permission types, no changes to auth/middleware/JWT, no cleanup of deprecated code -- those are Phase 18.

</domain>

<decisions>
## Implementation Decisions

### Tab Layout and Navigation
- **D-01:** Add MUI Tab/TabPanel components at the top of the existing ManageUsers page. Three tabs: Users, Roles, Permissions. Tab state is local (no URL change). MUI is already a project dependency.
- **D-02:** PageHeader stays as "Manage Users" regardless of active tab.
- **D-03:** Each tab has its own contextual toolbar. Users tab keeps existing search/Add User. Roles tab gets an "Add Role" button. Permissions tab gets an "Add Permission" button. No search on Roles/Permissions tabs (small lists).

### Role Editing Workflow
- **D-04:** Roles tab displays a table listing all roles. Each row shows role name and its assigned permissions as MUI Chips. Edit and Delete action buttons per row.
- **D-05:** Clicking "Edit" on a role opens a modal with: editable role name text field, and all permissions listed as checkboxes (checked = assigned). Save/Cancel buttons.
- **D-06:** "Add Role" opens the same modal component with empty role name and all permissions unchecked. Reuses the same component for both create and edit.

### Permission CRUD and Resources
- **D-07:** Permissions tab displays a table listing all permissions, visually grouped by category. Columns: permissionKey, label, category, resource count. Edit and Delete action buttons per row.
- **D-08:** Clicking "Edit" on a permission opens a modal with: read-only permissionKey field, editable label, description, and category fields. Category is a combo box (dropdown populated from existing distinct categories in DB, but allows typing a new value).
- **D-09:** Bottom section of the permission edit modal shows a list of associated UI resources. Each resource row shows resourceType, resourceKey, icon, label, route, displayOrder. An "X" button removes a resource.
- **D-10:** Clicking "+ Add Resource" adds a new inline editable row at the bottom of the resources list. Fields: resourceType (dropdown: nav/tab/feature), resourceKey (text), icon (text), label (text), route (text), displayOrder (number). All changes saved together with the modal Save button.
- **D-11:** "Add Permission" opens the same modal with empty fields and permissionKey editable (since it's a new permission). Key becomes read-only after creation.

### Deletion Safety Guards
- **D-12:** Delete buttons are always visible and clickable on both Roles and Permissions tables. Server-side dependency check happens on click.
- **D-13:** For roles: if users are assigned, a blocking modal shows the warning with a list of assigned user names. Message: "[Role] cannot be deleted because N users are assigned." Action: "Remove these assignments first." Single "OK" button to dismiss.
- **D-14:** For permissions: if roles use the permission, a blocking modal shows the affected roles with their user counts. Message: "[Permission] is assigned to N roles:" followed by role names with user counts. Action: "Remove from all roles first." Single "OK" button to dismiss.
- **D-15:** If no dependencies exist, a standard confirmation dialog asks "Delete [role/permission name]? This action cannot be undone." with Cancel/Delete buttons.

### Claude's Discretion
- API route structure and controller organization (whether to create new controller files or extend existing ones)
- Whether to use React Bootstrap Modal or MUI Dialog for the modals (MUI is growing in usage but Bootstrap modals are the existing pattern)
- Exact MUI Tab variant and styling to match the existing page aesthetic
- Loading states and error handling patterns for CRUD operations
- How category grouping is rendered in the Permissions table (section headers vs row grouping vs just a sortable column)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema and Models
- `src/db/models/AdminRole.ts` -- Role model (roleID, roleLabel) with hasMany AdminUsersRole
- `src/db/models/AdminPermission.ts` -- Permission model (permissionID, permissionKey, label, description, category) with hasMany AdminRolePermission and hasMany AdminPermissionResource
- `src/db/models/AdminRolePermission.ts` -- Junction table model (roleID, permissionID) with belongsTo on both sides
- `src/db/models/AdminPermissionResource.ts` -- Resource model (permissionID, resourceType, resourceKey, displayOrder, icon, label, route) with belongsTo AdminPermission
- `src/db/models/AdminUsersRole.ts` -- User-role junction table (needed for dependency checks on role deletion)

### Existing Admin UI (must read before modifying)
- `src/pages/manageusers/index.tsx` -- Page wrapper, AppLayout integration
- `src/components/elements/Manage/ManageUsers.tsx` -- Current Users tab content: search, pagination, fetch, table rendering
- `src/components/elements/Manage/UsersTable.tsx` -- Users table component with action buttons
- `src/components/elements/Manage/ManageUsers.module.css` -- Existing styles
- `src/components/elements/Manage/UsersTable.module.css` -- Existing table styles

### Existing Admin API Routes (reference pattern)
- `src/pages/api/db/admin/users/index.ts` -- Users list API (POST with pagination, auth header check)
- `src/pages/api/db/admin/adminRoles/index.ts` -- Roles list API (GET, listAllAdminRoles controller)
- `controllers/db/manage-users/user.controller.ts` -- Controller pattern: Sequelize queries, findAndCountAll, include associations

### Requirements
- `.planning/REQUIREMENTS.md` section "Admin CRUD" -- ADMIN-01 through ADMIN-09

### Prior Phase Context
- `.planning/phases/14-permission-tables-and-models/14-CONTEXT.md` -- Model patterns, association scope, SQL migration approach
- `.planning/phases/16-data-driven-ui/16-CONTEXT.md` -- Icon registry, permission check patterns, MUI icon usage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminPermission` model: Has full Sequelize association mixins (getAdminRolePermissions, countAdminRolePermissions, etc.) ready for CRUD operations
- `AdminRole` model: Has countAdminUsersRoles for checking user assignments before deletion
- `src/utils/permissionUtils.ts`: hasPermission() for gating the admin tabs to Superuser-only
- MUI `@mui/material`: Tab, Tabs, Chip, Dialog, Checkbox components already available
- React Bootstrap: Modal, Button, Form components used heavily in existing ManageUsers code
- `src/components/elements/Common/Loader.tsx`: Loading spinner component
- `ToastContainerWrapper`: Toast notifications for success/error feedback

### Established Patterns
- API routes: POST method, authorization header check against `reciterConfig.backendApiKey`, controller delegation
- Controllers: Sequelize queries with `findAndCountAll`, `include` for associations, `Op.like` for search
- State management: Local `useState` for component state, `useEffect` for initial data load, direct `fetch()` calls to API routes
- Modals: React Bootstrap Modal with show/hide state, form inputs, Save/Cancel buttons
- Tables: React Bootstrap Table with `<thead>` / `<tbody>`, row iteration with `.map()`
- Toast notifications: `toast.success()` / `toast.error()` for CRUD feedback

### Integration Points
- `ManageUsers.tsx`: Tab components will wrap the existing content as the Users tab panel
- `src/pages/api/db/admin/`: New API routes for roles CRUD and permissions CRUD go here
- `controllers/db/`: New controller files for roles and permissions CRUD logic
- `init-models.ts`: Models already initialized -- no changes needed, associations already wired

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- standard CRUD admin interface using existing MUI and Bootstrap patterns with the established API route/controller architecture.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 17-admin-crud*
*Context gathered: 2026-04-14*
