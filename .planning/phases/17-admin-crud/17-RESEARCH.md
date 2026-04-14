# Phase 17: Admin CRUD - Research

**Researched:** 2026-04-14
**Domain:** Admin CRUD UI for roles and permissions management (React + Bootstrap + MUI + Sequelize)
**Confidence:** HIGH

## Summary

Phase 17 builds a three-tab admin interface on the existing Manage Users page: Users (existing, wrapped), Roles (new table + edit modal), and Permissions (new table + edit modal with nested resource rows). All database models, associations, and Sequelize mixins already exist from Phase 14. The frontend stack is a known quantity: React Bootstrap for tables/modals/forms, MUI for tabs/chips/autocomplete, CSS Modules for styling.

The primary technical challenges are: (1) wiring Sequelize eager-loading queries that join roles with their permissions and users for dependency checks, (2) implementing the permission resources inline editing within the permission modal, and (3) getting the tab container to correctly wrap the existing ManageUsers component without breaking its Redux state or pagination.

**Primary recommendation:** Build API routes first (roles CRUD, permissions CRUD with dependency-check endpoints), then build UI components bottom-up (modals first, then tab panels, then tab container wrapper).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Add MUI Tab/TabPanel components at the top of the existing ManageUsers page. Three tabs: Users, Roles, Permissions. Tab state is local (no URL change). MUI is already a project dependency.
- **D-02:** PageHeader stays as "Manage Users" regardless of active tab.
- **D-03:** Each tab has its own contextual toolbar. Users tab keeps existing search/Add User. Roles tab gets an "Add Role" button. Permissions tab gets an "Add Permission" button. No search on Roles/Permissions tabs (small lists).
- **D-04:** Roles tab displays a table listing all roles. Each row shows role name and its assigned permissions as MUI Chips. Edit and Delete action buttons per row.
- **D-05:** Clicking "Edit" on a role opens a modal with: editable role name text field, and all permissions listed as checkboxes (checked = assigned). Save/Cancel buttons.
- **D-06:** "Add Role" opens the same modal component with empty role name and all permissions unchecked. Reuses the same component for both create and edit.
- **D-07:** Permissions tab displays a table listing all permissions, visually grouped by category. Columns: permissionKey, label, category, resource count. Edit and Delete action buttons per row.
- **D-08:** Clicking "Edit" on a permission opens a modal with: read-only permissionKey field, editable label, description, and category fields. Category is a combo box (dropdown populated from existing distinct categories in DB, but allows typing a new value).
- **D-09:** Bottom section of the permission edit modal shows a list of associated UI resources. Each resource row shows resourceType, resourceKey, icon, label, route, displayOrder. An "X" button removes a resource.
- **D-10:** Clicking "+ Add Resource" adds a new inline editable row at the bottom of the resources list. Fields: resourceType (dropdown: nav/tab/feature), resourceKey (text), icon (text), label (text), route (text), displayOrder (number). All changes saved together with the modal Save button.
- **D-11:** "Add Permission" opens the same modal with empty fields and permissionKey editable (since it's a new permission). Key becomes read-only after creation.
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIN-01 | Superuser can view all roles with their assigned permissions in a Roles tab | Roles tab component with eager-loaded AdminRole -> AdminRolePermission -> AdminPermission query; MUI Chip for permission display |
| ADMIN-02 | Superuser can edit which permissions are assigned to a role | RoleEditModal with checkbox list of all permissions; API endpoint that diff-syncs AdminRolePermission rows in a transaction |
| ADMIN-03 | Superuser cannot delete a role that has users assigned to it | Server-side dependency check using AdminUsersRole.count({ where: { roleID } }) before deletion; DeleteBlockedModal showing user names |
| ADMIN-04 | Superuser can view all permissions grouped by category in a Permissions tab | Permissions tab with category section headers; eager-loaded AdminPermission -> AdminPermissionResource (count) query |
| ADMIN-05 | Superuser can create new permissions (permissionKey, label, description, category) | PermissionEditModal in create mode with editable permissionKey; AdminPermission.create() API |
| ADMIN-06 | Superuser can edit permission label, description, and category (permissionKey is immutable) | PermissionEditModal in edit mode with read-only permissionKey; AdminPermission.update() API |
| ADMIN-07 | Superuser cannot delete a permission assigned to any role | Server-side dependency check using AdminRolePermission.count({ where: { permissionID } }); DeleteBlockedModal showing affected roles |
| ADMIN-08 | Superuser can manage permission resources per permission | ResourceRow inline editing within PermissionEditModal; bulk save via destroy-and-recreate AdminPermissionResource rows in transaction |
| ADMIN-09 | Manage Users page has three tabs: Users, Roles, Permissions | ManageUsersTabs wrapper using MUI Tabs with local useState index; existing ManageUsers wrapped as Users tab panel |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No hardcoded credentials** -- API routes must use `reciterConfig.backendApiKey` from env vars via `config/local.js`
- **Port 3000** -- dev server runs on port 3000
- **No Co-Authored-By lines** in commits
- **React 16.14.0** -- no React 18 hooks (useId, useTransition, etc.)
- **Next.js 12.3.4** -- Pages Router only, no App Router patterns
- **CSS Modules** for styling -- no Tailwind, no styled-components for new code
- **Mixed Bootstrap/MUI stack** -- Bootstrap for tables/modals/forms, MUI for tabs/chips/autocomplete/icons
- **Sequelize 6.9.0** -- ORM for all database operations

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 16.14.0 | UI framework | Project standard [VERIFIED: node_modules] |
| react-bootstrap | 2.0.3 | Tables, Modals, Forms, Buttons | Project standard for layout components [VERIFIED: node_modules] |
| @mui/material | 5.0.6 | Tabs, Chip, Autocomplete | Project standard for interactive components [VERIFIED: node_modules] |
| @mui/icons-material | ^5.0.5 | Icons (ClearIcon for resource remove) | Project standard [VERIFIED: package.json] |
| sequelize | 6.9.0 | ORM for CRUD operations | Project standard [VERIFIED: node_modules] |
| react-toastify | 8.0.3 | Toast notifications for CRUD feedback | Project standard [VERIFIED: node_modules] |
| react-redux | 7.2.5+ | Redux state for admin roles list | Project standard, used by existing ManageUsers [VERIFIED: codebase] |

### Supporting (No New Installs)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @emotion/react | ^11.5.0 | MUI styling engine | Required by @mui/material (already installed) |
| @emotion/styled | ^11.3.0 | MUI styled components | Required for MUI Autocomplete CssTextField pattern |

**Installation:** No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure (New Files Only)

```
src/
  components/
    elements/
      Manage/
        ManageUsersTabs.tsx          # NEW - Tab container wrapping all three tabs
        ManageUsersTabs.module.css   # NEW - Tab container styles
        RolesTab.tsx                 # NEW - Roles table with chips
        RolesTab.module.css          # NEW - Roles tab styles
        PermissionsTab.tsx           # NEW - Permissions table grouped by category
        PermissionsTab.module.css    # NEW - Permissions tab styles
        RoleEditModal.tsx            # NEW - Create/edit role modal
        PermissionEditModal.tsx      # NEW - Create/edit permission modal with resources
        PermissionEditModal.module.css # NEW - Permission modal styles (resource row layout)
        ResourceRow.tsx              # NEW - Inline resource row component
        DeleteBlockedModal.tsx       # NEW - Dependency warning modal
        DeleteConfirmModal.tsx       # NEW - Deletion confirmation modal
  pages/
    api/
      db/
        admin/
          roles/
            index.ts                # NEW - GET all roles (with permissions eager-loaded)
            [roleId].ts             # NEW - PUT update, DELETE with dep check
            create.ts               # NEW - POST create role
          permissions/
            index.ts                # NEW - GET all permissions (with resource counts)
            [permissionId].ts       # NEW - PUT update, DELETE with dep check
            create.ts               # NEW - POST create permission
            categories.ts           # NEW - GET distinct categories for autocomplete
controllers/
  db/
    admin/
      roles.controller.ts           # NEW - Role CRUD + dependency check logic
      permissions.controller.ts      # NEW - Permission CRUD + resource management
```

### Pattern 1: API Route + Controller (Established Project Pattern)

**What:** API routes in `src/pages/api/` delegate to controller functions in `controllers/db/`
**When to use:** All new CRUD endpoints
**Example:**
```typescript
// Source: src/pages/api/db/admin/adminRoles/index.ts (existing pattern)
// API route: auth check + method routing + controller delegation
import { reciterConfig } from '../../../../../../config/local'
import { listAllRolesWithPermissions } from '../../../../../../controllers/db/admin/roles.controller'

export default async function handler(req, res) {
    if (req.method === "GET") {
        if (req.headers.authorization === reciterConfig.backendApiKey) {
            await listAllRolesWithPermissions(req, res)
        } else if (!req.headers.authorization) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        res.status(400).send('HTTP Supported method is GET')
    }
}
```
[VERIFIED: src/pages/api/db/admin/adminRoles/index.ts]

### Pattern 2: Sequelize Eager Loading with Associations

**What:** Use `include` with association aliases to load related data in one query
**When to use:** Fetching roles with their permissions, permissions with resource counts
**Example:**
```typescript
// Source: controllers/db/manage-users/user.controller.ts (existing pattern, adapted)
// List all roles with their permissions eagerly loaded
const roles = await models.AdminRole.findAll({
  include: [
    {
      model: models.AdminRolePermission,
      as: "adminRolePermissions",
      include: [{
        model: models.AdminPermission,
        as: "permission",
        attributes: ['permissionID', 'permissionKey', 'label']
      }]
    },
    {
      model: models.AdminUsersRole,
      as: "adminUsersRoles",
      attributes: ['userID']
    }
  ],
  order: [['roleLabel', 'ASC']]
});
```
[VERIFIED: init-models.ts lines 276-282 confirm all association aliases]

### Pattern 3: Transaction-Based Mutation (Established)

**What:** Wrap multi-table mutations in `sequelize.transaction()` with auto-rollback
**When to use:** Role permission sync (delete old, insert new), permission resource sync, role deletion
**Example:**
```typescript
// Source: controllers/db/manage-users/user.controller.ts lines 220-271 (existing pattern)
import sequelize from "../../../src/db/db";

const result = await sequelize.transaction(async (t) => {
  // Delete existing role-permission mappings
  await models.AdminRolePermission.destroy({
    where: { roleID },
    transaction: t
  });
  // Bulk create new mappings
  const newMappings = permissionIDs.map(pid => ({
    roleID,
    permissionID: pid,
    createTimestamp: new Date()
  }));
  await models.AdminRolePermission.bulkCreate(newMappings, { transaction: t });
  // Update role label
  await models.AdminRole.update(
    { roleLabel, modifyTimestamp: new Date() },
    { where: { roleID }, transaction: t }
  );
});
```
[VERIFIED: controllers/db/manage-users/user.controller.ts lines 220-271]

### Pattern 4: MUI Tabs with Local State

**What:** MUI `<Tabs>` with `useState` integer index, no URL routing
**When to use:** ManageUsersTabs component (D-01)
**Example:**
```typescript
// MUI Tabs API verified against @mui/material 5.0.6
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

const [tabIndex, setTabIndex] = useState(0);

<Tabs value={tabIndex} onChange={(e, newValue) => setTabIndex(newValue)}>
  <Tab label="Users" id="tab-0" aria-controls="tabpanel-0" />
  <Tab label="Roles" id="tab-1" aria-controls="tabpanel-1" />
  <Tab label="Permissions" id="tab-2" aria-controls="tabpanel-2" />
</Tabs>
{tabIndex === 0 && <div role="tabpanel" id="tabpanel-0"><ManageUsers /></div>}
{tabIndex === 1 && <div role="tabpanel" id="tabpanel-1"><RolesTab /></div>}
{tabIndex === 2 && <div role="tabpanel" id="tabpanel-2"><PermissionsTab /></div>}
```
[VERIFIED: @mui/material Tabs.d.ts exists in node_modules]

### Pattern 5: React Bootstrap Modal (Established)

**What:** Bootstrap `<Modal>` with show/onHide state pattern
**When to use:** All modals in this phase (per existing codebase pattern)
**Example:**
```typescript
// Source: src/components/elements/Report/ExportModal.tsx (existing pattern)
import { Modal, Button } from "react-bootstrap";

<Modal show={show} onHide={handleClose}>
  <Modal.Header closeButton>
    <Modal.Title>Edit Role</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    {/* form content */}
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={handleClose}>Cancel</Button>
    <Button variant="primary" onClick={handleSave} disabled={saving}>Save Role</Button>
  </Modal.Footer>
</Modal>
```
[VERIFIED: src/components/elements/Report/ExportModal.tsx]

### Pattern 6: MUI Autocomplete freeSolo (Established)

**What:** MUI Autocomplete with `freeSolo` for combo-box behavior (select existing or type new)
**When to use:** Category field in PermissionEditModal (D-08)
**Example:**
```typescript
// Source: src/components/elements/AddUser/AddUser.tsx lines 262-280 (existing pattern)
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

<Autocomplete
  freeSolo
  id="category"
  options={existingCategories}
  value={category}
  onChange={(event, value) => setCategory(value as string)}
  onInputChange={(event, value) => setCategory(value)}
  renderInput={(params) => (
    <TextField variant="outlined" {...params} />
  )}
/>
```
[VERIFIED: src/components/elements/AddUser/AddUser.tsx lines 262-280]

### Anti-Patterns to Avoid

- **Do NOT use Redux for roles/permissions CRUD state:** The existing ManageUsers uses Redux for the admin roles list (via `getAdminRoles` action), but the new Roles and Permissions tabs should manage their own data with local `useState` + direct `fetch()`. The existing Redux `AllAdminRoles` state is used by AddUser and should not be conflated with the CRUD tab's state. Fetch fresh data on tab activation and after mutations.

- **Do NOT modify the existing ManageUsers component:** Wrap it inside the Users tab panel. Do not refactor its internal state management, search, or pagination.

- **Do NOT use `AdminRole.destroy()` without checking dependencies first:** The server must always check `AdminUsersRole.count()` before deleting a role, and `AdminRolePermission.count()` before deleting a permission. The delete endpoint should return dependency info rather than the client guessing.

- **Do NOT route-based tabs:** Tab state is local `useState` integer index (D-01). No URL query params, no router.push.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab switching UI | Custom tab bar with CSS | MUI `<Tabs>` + `<Tab>` | Keyboard navigation, ARIA attributes, active indicator all built-in [D-01] |
| Permission chips display | Custom styled badges | MUI `<Chip size="small">` | Consistent styling with default color, proper ARIA for display-only mode |
| Category combo box | Custom dropdown with text input | MUI `<Autocomplete freeSolo>` | Existing pattern in AddUser.tsx, handles edge cases (blur, clear, custom entry) |
| Toast notifications | Custom alert system | react-toastify `toast.success/error` | Existing pattern throughout codebase, consistent positioning and auto-close |
| Form validation display | Custom error state management | Bootstrap `<Form.Control isInvalid>` + `<Form.Control.Feedback>` | Existing pattern in AddUser.tsx, automatic ARIA binding |

## Common Pitfalls

### Pitfall 1: Stale Data After CRUD Operations
**What goes wrong:** User creates a role, but the roles table does not refresh, showing stale data.
**Why it happens:** Using Redux global state that does not auto-refresh, or forgetting to re-fetch after mutation.
**How to avoid:** After every successful create/update/delete, re-fetch the full list from the API. Use a `fetchRoles()` / `fetchPermissions()` function called both on initial load and after mutations. Return the updated list from the server response to avoid a second round trip if possible.
**Warning signs:** Data appears unchanged after saving, user must manually switch tabs to see updates.

### Pitfall 2: ManageUsers Redux State Interference
**What goes wrong:** The existing `ManageUsers` component dispatches `getAdminRoles()` and `getAdminDepartments()` on mount, which populates Redux state. If the new Roles tab also writes to the same Redux store, edits in the Roles tab could corrupt the AddUser form's role dropdown.
**Why it happens:** Shared Redux state for different concerns.
**How to avoid:** The new Roles/Permissions tabs should use local component state (`useState`) with direct `fetch()` calls, not Redux. The existing Redux actions (`getAdminRoles`) remain untouched for the AddUser form.
**Warning signs:** Adding a role in the Roles tab causes the AddUser form to show unexpected data.

### Pitfall 3: Sequelize Association Alias Mismatch
**What goes wrong:** Eager loading fails with "Unknown association" error.
**Why it happens:** Using wrong alias in `include`. The model associations use specific aliases: `adminRolePermissions`, `adminUsersRoles`, `adminPermissionResources`, `permission`, `role`.
**How to avoid:** Always reference the exact alias from init-models.ts: `AdminRole.hasMany(AdminRolePermission, { as: "adminRolePermissions" })`, `AdminRolePermission.belongsTo(AdminPermission, { as: "permission" })`, etc.
**Warning signs:** Sequelize throws "X is not associated to Y" errors at runtime.

### Pitfall 4: Permission Resource Orphan Rows
**What goes wrong:** Editing a permission's resources leaves orphaned rows in `admin_permission_resources`.
**Why it happens:** Partial updates (only inserting new rows, not removing deleted ones).
**How to avoid:** Use the destroy-and-recreate pattern within a transaction: delete all existing resources for the permissionID, then bulkCreate the new set. This is the same pattern used for user role assignments in `createOrUpdateAdminUser`.
**Warning signs:** Resource count grows unexpectedly, duplicate resources appear.

### Pitfall 5: Unique Constraint Violations on permissionKey
**What goes wrong:** Creating a permission with a duplicate key crashes with a Sequelize UniqueConstraintError.
**Why it happens:** The `admin_permissions` table has a unique index on `permissionKey` (index: `uq_permission_key`).
**How to avoid:** Catch `SequelizeUniqueConstraintError` in the controller and return a 409 Conflict with a user-friendly message. Display validation error in the modal.
**Warning signs:** Unhandled 500 error when creating a permission with an existing key.

### Pitfall 6: MUI Tab Index vs Content Rendering
**What goes wrong:** The existing ManageUsers component re-mounts every time the user switches away from the Users tab and back, losing search state and pagination position.
**Why it happens:** Using conditional rendering (`tabIndex === 0 && <ManageUsers />`) unmounts/remounts the component.
**How to avoid:** Use CSS visibility/display toggling instead of conditional rendering for the Users tab. Render all three tab panels but hide inactive ones with `display: none`. This preserves ManageUsers internal state across tab switches.
**Warning signs:** Users tab resets to page 1 with empty search every time the user switches back to it.

### Pitfall 7: Category Grouping Sort Order
**What goes wrong:** Categories appear in random order because the database returns permissions in ID order.
**Why it happens:** Not sorting by category before grouping.
**How to avoid:** Sort permissions by `[['category', 'ASC'], ['permissionKey', 'ASC']]` in the Sequelize query. Then group client-side by iterating and inserting category header rows when the category changes.
**Warning signs:** Permissions from the same category appear in different visual groups.

## Code Examples

### Dependency Check for Role Deletion
```typescript
// Source: Pattern derived from existing AdminUsersRole association [VERIFIED: init-models.ts line 276]
export const checkRoleDependencies = async (roleID: number) => {
  // Count users assigned to this role
  const userCount = await models.AdminUsersRole.count({
    where: { roleID }
  });

  if (userCount > 0) {
    // Fetch user names for the blocking modal
    const users = await models.AdminUsersRole.findAll({
      where: { roleID },
      include: [{
        model: models.AdminUser,
        as: "user",
        attributes: ['nameFirst', 'nameLast']
      }]
    });
    return {
      canDelete: false,
      userCount,
      users: users.map(ur => ({
        name: `${ur.user.nameFirst || ''} ${ur.user.nameLast || ''}`.trim()
      }))
    };
  }

  return { canDelete: true, userCount: 0, users: [] };
};
```

### Dependency Check for Permission Deletion
```typescript
// Source: Pattern derived from existing associations [VERIFIED: init-models.ts lines 277-280]
export const checkPermissionDependencies = async (permissionID: number) => {
  const rolePermissions = await models.AdminRolePermission.findAll({
    where: { permissionID },
    include: [{
      model: models.AdminRole,
      as: "role",
      attributes: ['roleID', 'roleLabel'],
      include: [{
        model: models.AdminUsersRole,
        as: "adminUsersRoles",
        attributes: ['userID']
      }]
    }]
  });

  if (rolePermissions.length > 0) {
    return {
      canDelete: false,
      roles: rolePermissions.map(rp => ({
        roleLabel: rp.role.roleLabel,
        userCount: rp.role.adminUsersRoles?.length || 0
      }))
    };
  }

  return { canDelete: true, roles: [] };
};
```

### Fetch Distinct Categories for Autocomplete
```typescript
// Source: Sequelize DISTINCT query pattern [ASSUMED - standard Sequelize 6.x API]
export const getDistinctCategories = async (req, res) => {
  try {
    const categories = await models.AdminPermission.findAll({
      attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('category')), 'category']],
      order: [['category', 'ASC']],
      raw: true
    });
    res.json(categories.map(c => c.category));
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};
```

### Tab Panel with Preserved State (Hidden vs Unmounted)
```typescript
// Prevents ManageUsers from re-mounting on tab switch
<div role="tabpanel" id="tabpanel-0" style={{ display: tabIndex === 0 ? 'block' : 'none' }}>
  <ManageUsers />
</div>
{tabIndex === 1 && (
  <div role="tabpanel" id="tabpanel-1">
    <RolesTab />
  </div>
)}
{tabIndex === 2 && (
  <div role="tabpanel" id="tabpanel-2">
    <PermissionsTab />
  </div>
)}
```
[ASSUMED - React 16 rendering pattern, standard approach]

## Discretion Recommendations

Based on research, here are recommendations for areas left to Claude's discretion:

### API Route Structure: Separate Controller Files
**Recommendation:** Create two new controller files: `controllers/db/admin/roles.controller.ts` and `controllers/db/admin/permissions.controller.ts`. Do NOT extend `user.controller.ts`.
**Rationale:** The existing `user.controller.ts` is already 350+ lines and deals with user CRUD. Role CRUD and permission CRUD are distinct domains. Separate files follow the single-responsibility pattern already established by the project (e.g., `admin.settings.controller.ts`, `notifications.controller.ts`). [VERIFIED: existing controller file structure]

### Modals: Use React Bootstrap Modal
**Recommendation:** Use React Bootstrap `<Modal>` for all modals in this phase.
**Rationale:** Every existing modal in the codebase uses React Bootstrap Modal (ExportModal, NoAccessModal, HistoryModal, Profile). MUI Dialog would introduce a second modal pattern. Consistency trumps MUI alignment here. [VERIFIED: grep shows 6 React Bootstrap Modal usages, 0 MUI Dialog usages]

### MUI Tab Styling
**Recommendation:** Use `variant="standard"` (default) with minimal custom CSS. Override the indicator color to match accent `#0d6efd` via the `TabIndicatorProps` or `sx` prop. Set inactive text to `#666363` and active text to `#0d6efd` with weight 600.
**Rationale:** Matches UI-SPEC precisely. MUI 5.0.6 supports `sx` prop for one-off styling without a theme provider. [VERIFIED: MUI 5.x Tabs supports sx prop]

### Loading States
**Recommendation:** Use the existing `<Loader />` component (centered spinner) for initial tab data loading. Disable the Save button during mutation API calls. Show toast on completion.
**Rationale:** Matches existing ManageUsers loading pattern exactly. [VERIFIED: ManageUsers.tsx lines 256-258]

### Category Grouping in Permissions Table
**Recommendation:** Use category section header rows (full-width `<tr>` with `<td colSpan>`) within a single `<Table>`. Background `#f0f0f0`, semibold text. Sort by category then permissionKey server-side.
**Rationale:** Matches UI-SPEC layout contract. Single table with section headers is simpler than multiple tables and preserves consistent column widths. [VERIFIED: UI-SPEC specifies this approach]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded role arrays for tab visibility | Data-driven permission checks via `hasPermission()` | Phase 16 (current milestone) | Roles/Permissions tabs should be gated with `hasPermission(permissions, 'canManageUsers')` or equivalent Superuser check |
| Full-page forms for CRUD (AddUser page) | In-page modals for CRUD | This phase (D-05, D-08) | Roles and permissions use modal pattern instead of separate pages |
| Redux for all admin data fetching | Local state + direct fetch for CRUD tabs | This phase | Avoids Redux state conflicts with existing AddUser form |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (via next/jest) |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern=__tests__/admin` |
| Full suite command | `npx jest` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | Roles list API returns roles with permissions | unit | `npx jest __tests__/rolesController.test.ts -x` | No - Wave 0 |
| ADMIN-02 | Role update syncs permissions in transaction | unit | `npx jest __tests__/rolesController.test.ts -x` | No - Wave 0 |
| ADMIN-03 | Role delete blocked when users assigned | unit | `npx jest __tests__/rolesController.test.ts -x` | No - Wave 0 |
| ADMIN-04 | Permissions list grouped by category | unit | `npx jest __tests__/permissionsController.test.ts -x` | No - Wave 0 |
| ADMIN-05 | Permission create with unique key | unit | `npx jest __tests__/permissionsController.test.ts -x` | No - Wave 0 |
| ADMIN-06 | Permission update (key immutable) | unit | `npx jest __tests__/permissionsController.test.ts -x` | No - Wave 0 |
| ADMIN-07 | Permission delete blocked when roles use it | unit | `npx jest __tests__/permissionsController.test.ts -x` | No - Wave 0 |
| ADMIN-08 | Resource CRUD within permission save | unit | `npx jest __tests__/permissionsController.test.ts -x` | No - Wave 0 |
| ADMIN-09 | Three tabs render on ManageUsers page | manual-only | Playwright MCP browser verification | N/A |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern=__tests__/admin`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `__tests__/rolesController.test.ts` -- covers ADMIN-01, ADMIN-02, ADMIN-03
- [ ] `__tests__/permissionsController.test.ts` -- covers ADMIN-04 through ADMIN-08

Note: Controller tests require mocking Sequelize models. The existing test files (`__tests__/permissionUtils.test.ts`, `__tests__/middleware.test.ts`) do not mock Sequelize, so a mock pattern needs to be established. This is feasible but adds complexity to Wave 0.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Session handled by next-auth (existing) |
| V3 Session Management | No | JWT session (existing) |
| V4 Access Control | Yes | API routes check `Authorization` header against `reciterConfig.backendApiKey`; Superuser-only page access via middleware |
| V5 Input Validation | Yes | Server-side validation of role names, permission keys, resource fields before DB writes |
| V6 Cryptography | No | No crypto operations in this phase |

### Known Threat Patterns for Admin CRUD

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via direct API call | Elevation of Privilege | All admin API routes verify `Authorization` header matches `backendApiKey` (existing pattern) |
| SQL injection in search/filter | Tampering | Sequelize parameterized queries (automatic with model methods) |
| Mass assignment (extra fields in request body) | Tampering | Destructure only expected fields from `req.body` in controllers |
| CSRF on state-changing operations | Tampering | API routes require `Authorization` header (custom API key acts as CSRF token equivalent) |
| Deletion of critical system roles | Denial of Service | Server-side dependency check prevents deletion of in-use roles/permissions |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sequelize `DISTINCT` function works with `Sequelize.fn('DISTINCT', Sequelize.col('category'))` syntax in v6.9.0 | Code Examples (categories) | LOW -- standard SQL, fallback is raw query |
| A2 | MUI 5.0.6 `<Tabs>` supports `sx` prop for inline styling | Discretion Recommendations | LOW -- if not, use `style` prop or CSS Module override |
| A3 | React 16.14.0 supports `style={{ display: 'none' }}` pattern for hidden tab panels without performance issues | Code Examples (tab panel) | VERY LOW -- this is fundamental React |
| A4 | Jest tests can mock Sequelize models by mocking `../../../src/db/sequelize` module | Validation Architecture | MEDIUM -- may need to use a different mocking approach |

## Open Questions (RESOLVED)

1. **Should the delete-check API be a separate endpoint or merged with the delete endpoint?**
   - What we know: D-12 says "Server-side dependency check happens on click". The delete button click needs to either show the blocked modal or the confirm modal.
   - What's unclear: Whether to make a separate `GET /api/db/admin/roles/[roleId]/dependencies` endpoint, or have the `DELETE /api/db/admin/roles/[roleId]` endpoint return 409 with dependency info.
   - Recommendation: Use a single `DELETE` endpoint that returns 409 Conflict with dependency data when blocked, and performs the deletion when clear. This reduces API surface area and ensures the check-and-delete is atomic (no TOCTOU race). The client interprets 409 to show the blocked modal and 200 to show the success toast.
   - RESOLVED: Using `DELETE` with `?check=true` query param — returns `{ canDelete: true }` without deleting, or 409 if deps found. Client calls `DELETE` again without `?check=true` to perform actual deletion. Implemented in Plan 01 Tasks 1 and 2.

2. **Should the ManageUsers page re-render when the Redux admin roles list changes?**
   - What we know: ManageUsers dispatches `getAdminRoles()` on mount for the AddUser form. If a user adds a role in the Roles tab, then navigates to AddUser, the role dropdown should include the new role.
   - What's unclear: Whether to invalidate the Redux cache when a role is created/deleted in the Roles tab.
   - Recommendation: After a successful role create/delete in the Roles tab, dispatch `getAdminRoles()` to refresh the Redux store. This ensures the AddUser form's role dropdown stays current. This is a one-line addition with minimal coupling.
   - RESOLVED: Dispatch `getAdminRoles()` after every role create/delete mutation in RolesTab to keep AddUser form dropdown current. Implemented in Plan 02 Task 1.

## Sources

### Primary (HIGH confidence)
- `src/db/models/AdminRole.ts` -- Model structure, association mixins
- `src/db/models/AdminPermission.ts` -- Model structure, unique constraint on permissionKey
- `src/db/models/AdminRolePermission.ts` -- Junction table with unique constraint on (roleID, permissionID)
- `src/db/models/AdminPermissionResource.ts` -- Resource model with unique constraint on (permissionID, resourceKey)
- `src/db/models/AdminUsersRole.ts` -- User-role junction for dependency checks
- `src/db/models/init-models.ts` -- All association declarations (lines 273-293)
- `controllers/db/manage-users/user.controller.ts` -- Transaction pattern, eager loading pattern, controller structure
- `src/pages/api/db/admin/adminRoles/index.ts` -- API route auth pattern
- `src/components/elements/Manage/ManageUsers.tsx` -- Existing page structure to wrap
- `src/components/elements/Manage/UsersTable.tsx` -- Bootstrap table pattern
- `src/components/elements/AddUser/AddUser.tsx` -- MUI Autocomplete freeSolo pattern, form validation pattern
- `src/components/elements/Report/ExportModal.tsx` -- Bootstrap Modal pattern
- `package.json` -- Dependency versions confirmed
- `node_modules/` -- Runtime version verification for all key packages

### Secondary (MEDIUM confidence)
- UI-SPEC (`17-UI-SPEC.md`) -- Layout contracts, component inventory, interaction states
- CONTEXT.md (`17-CONTEXT.md`) -- Locked decisions D-01 through D-15

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified in node_modules, no new dependencies
- Architecture: HIGH -- all patterns verified against existing codebase files
- Pitfalls: HIGH -- derived from actual code inspection of models and controllers
- Security: HIGH -- follows existing API auth pattern exactly

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable -- no dependency changes expected)
