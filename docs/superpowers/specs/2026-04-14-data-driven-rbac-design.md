# Data-Driven RBAC Redesign

**Date:** 2026-04-14
**Status:** Approved
**Branch:** dev_Upd_NextJS14SNode18

## Summary

Redesign the role-based access control system so that roles, permissions, role→permission mappings, and UI resource visibility are all stored in the database rather than hardcoded in application code. The app becomes a generic enforcement engine that reads authorization data from the DB.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Permission granularity | Start coarse (match today's ~7 capabilities), extensible later | Behavior-preserving migration; admins can add finer-grained permissions via UI |
| Scope model | User-level attributes (unchanged) | Simpler; scope_person_types, scope_org_units, proxy_person_ids stay on admin_users |
| Permission resolution timing | At login, baked into JWT | No per-request DB queries; user must re-login for permission changes |
| Route enforcement | Code-based (middleware lookup object referencing DB permission keys) | Route patterns in DB are fragile; routes can't exist without deployed code anyway |
| UI gating (nav, tabs, features) | Data-driven via permission_resources table | Nav menu, tabs, feature flags all rendered from DB data |
| Admin UI location | Tabs within existing Manage Users page | Related workflow, matches existing patterns, one permission gate |
| Permission CRUD | Full admin UI for both permissions and roles | Future-proof; admins can create new permissions and compose roles without code changes |

---

## Database Schema

### New Tables

#### `admin_permissions`

The master list of all permissions in the system.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `permissionID` | INT | PK, auto-increment | |
| `permissionKey` | VARCHAR(128) | UNIQUE, NOT NULL | Slug format: `canCurate`, `canReport` |
| `label` | VARCHAR(255) | NOT NULL | Human-readable: "Curate Publications" |
| `description` | TEXT | NULLABLE | Shown in admin UI tooltip |
| `category` | VARCHAR(64) | NOT NULL | Groups in admin UI: "Curation", "Reporting", "Administration" |
| `createTimestamp` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |
| `modifyTimestamp` | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

#### `admin_role_permissions`

Junction table: which permissions each role has.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK, auto-increment | |
| `roleID` | INT | FK → `admin_roles.roleID`, NOT NULL | |
| `permissionID` | INT | FK → `admin_permissions.permissionID`, NOT NULL | |
| `createTimestamp` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

UNIQUE constraint on `(roleID, permissionID)`.

#### `admin_permission_resources`

Maps permissions to UI elements (nav items, tabs, feature flags).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INT | PK, auto-increment | |
| `permissionID` | INT | FK → `admin_permissions.permissionID`, NOT NULL | |
| `resourceType` | VARCHAR(32) | NOT NULL | `nav`, `tab`, `feature` |
| `resourceKey` | VARCHAR(128) | NOT NULL | UI identifier: `nav_curate`, `tab_suggested` |
| `displayOrder` | INT | NOT NULL, DEFAULT 0 | Ordering within resourceType |
| `icon` | VARCHAR(64) | NULLABLE | MUI icon name for nav items |
| `label` | VARCHAR(255) | NOT NULL | Display label |
| `route` | VARCHAR(255) | NULLABLE | Link target for nav items (e.g., `/curate`) |
| `createTimestamp` | DATETIME | DEFAULT CURRENT_TIMESTAMP | |

### Existing Tables — No Structural Changes

- **`admin_roles`** — unchanged (roleID, roleLabel, timestamps)
- **`admin_users_roles`** — unchanged (userID → roleID junction)
- **`admin_users`** — unchanged (scope_person_types, scope_org_units, proxy_person_ids remain user-level)

### Seed Data

#### Permissions

| permissionKey | label | category |
|---------------|-------|----------|
| `canCurate` | Curate Publications | Curation |
| `canSearch` | Search Identities | Navigation |
| `canReport` | Create Reports | Reporting |
| `canManageUsers` | Manage Users | Administration |
| `canConfigure` | Configuration | Administration |
| `canManageNotifications` | Manage Notifications | Communication |
| `canManageProfile` | Manage Profile | Profile |

#### Role → Permission Mappings

| Role | Permissions |
|------|------------|
| Superuser | all 7 |
| Curator_All | canCurate, canSearch |
| Curator_Self | canCurate |
| Curator_Scoped | canCurate, canSearch |
| Curator_Department | canCurate, canSearch |
| Curator_Department_Delegate | canCurate, canSearch |
| Reporter_All | canReport, canSearch |

Note: Today's baseline grants canReport + canSearch to all authenticated users. This baseline is implemented as a hardcoded fallback in the middleware: if a user's resolved permission set is empty (no roles or roles with no permissions), the middleware still allows access to `/search` and `/report`. This is NOT a DB-level default role — it's a safety net in code. Admins who want to restrict even search/report access for certain users should assign roles that explicitly lack those permissions (the fallback only triggers when the permission set is completely empty).

#### Permission Resources (Nav Menu)

| permissionKey | resourceType | resourceKey | displayOrder | icon | label | route |
|---------------|-------------|-------------|-------------|------|-------|-------|
| canSearch | nav | nav_search | 1 | Search | Find People | /search |
| canCurate | nav | nav_curate | 2 | LocalLibrary | Curate Publications | /curate |
| canReport | nav | nav_report | 3 | Assessment | Create Reports | /report |
| canManageNotifications | nav | nav_notifications | 4 | NotificationsActive | Manage Notifications | /notifications |
| canManageProfile | nav | nav_profile | 5 | AccountCircle | Manage Profile | /manageprofile |
| canManageUsers | nav | nav_users | 6 | Group | Manage Users | /manageusers |
| canConfigure | nav | nav_config | 7 | Settings | Configuration | /configuration |

---

## Auth Flow & JWT

### Login-time Permission Resolution

`findUserPermissions()` in `userroles.controller.ts` expands to JOIN through role_permissions → permissions and fetch permission_resources. Returns:

```javascript
{
  roles: [{ personIdentifier, roleLabel, roleID }],           // unchanged
  permissions: ["canCurate", "canSearch", ...],                // NEW: resolved keys
  permissionResources: [                                        // NEW: UI gating data
    { permissionKey: "canSearch", resourceType: "nav",
      resourceKey: "nav_search", displayOrder: 1,
      icon: "Search", label: "Find People", route: "/search" },
    ...
  ],
  scopeData: { personTypes, orgUnits },                        // unchanged
  proxyPersonIds: [...]                                         // unchanged
}
```

### JWT Token Claims

| Claim | Content | Change |
|-------|---------|--------|
| `token.userRoles` | Stringified roles array | Unchanged (still needed for curation scope) |
| `token.permissions` | Stringified permission keys array | **NEW** |
| `token.permissionResources` | Stringified resource objects array | **NEW** |
| `token.scopeData` | Stringified scope object | Unchanged |
| `token.proxyPersonIds` | Stringified proxy array | Unchanged |

### Session Passthrough

`session.data` passes all token claims to the client, same pattern as today.

---

## Middleware

### Route → Permission Mapping

A simple lookup object in middleware (not a DB table):

```javascript
const ROUTE_PERMISSIONS = {
  '/curate':        'canCurate',
  '/search':        'canSearch',
  '/report':        'canReport',
  '/manageusers':   'canManageUsers',
  '/configuration': 'canConfigure',
  '/notifications': 'canManageNotifications',
  '/manageprofile': 'canManageProfile',
}
```

### Permission Check

```javascript
const permissions = JSON.parse(token.permissions);
const permSet = new Set(permissions);

// Generic route check
for (const [routePrefix, permKey] of Object.entries(ROUTE_PERMISSIONS)) {
  if (pathName.startsWith(routePrefix)) {
    if (!permSet.has(permKey)) {
      return redirectToLandingPage(request, getLandingPage(permSet, userRoles));
    }
    break;
  }
}
```

### Curation Scope Logic — Unchanged

Self vs. scoped vs. all curation checks, proxy target validation, and person-level scope enforcement all stay in middleware exactly as today. These read `userRoles` and `scopeData` from the JWT. This is authorization scope, not permission gating.

### Baseline Behavior

Any authenticated user with zero resolved permissions still gets canSearch + canReport behavior via a middleware fallback, preserving today's baseline.

### `getLandingPage()` Update

Updated to accept a permission set instead of capabilities:

- Has `canCurate` + self-only (from roles) → `/curate/:personIdentifier`
- Has `canSearch` or `canReport` → `/search`
- Fallback → `/noaccess`

---

## Component Changes

### SideNavbar

Replaces hardcoded menu items with data-driven rendering:

```javascript
const permissionResources = JSON.parse(session.data.permissionResources);
const navItems = permissionResources
  .filter(r => r.resourceType === 'nav')
  .sort((a, b) => a.displayOrder - b.displayOrder);

// Render navItems — icon, label, route all from data
```

Special cases (e.g., Curator_Self nav links appending personIdentifier to route) handled as post-processing on the data-driven items.

### ReciterTabs

Tab visibility switches from `allowedRoleNames` arrays to permission checks:

```javascript
// Before:
{ name: 'Suggested', allowedRoleNames: ["Superuser", "Curator_All", "Curator_Self"] }

// After: tabs rendered based on session.permissions containing 'canCurate'
```

### CurateIndividual

Inline checks like `canGrantProxy` switch from capability derivation to permission checks:

```javascript
// Before:
const caps = getCapabilities(userRoles);
const canGrantProxy = caps.canCurate.all || caps.canManageUsers;

// After:
const permSet = new Set(JSON.parse(session.data.permissions));
const canGrantProxy = permSet.has('canCurate') && permSet.has('canManageUsers');
```

### checkCurationScope.ts

Updated to read permissions from the request context instead of deriving capabilities. The scope-checking logic (org unit + person type matching, proxy checks) remains unchanged.

---

## Admin UI

### Location

Three tabs within the existing Manage Users page (`/manageusers`):

**Users | Roles | Permissions**

All gated by the `canManageUsers` permission.

### Users Tab (existing, minor changes)

- Role assignment unchanged (pick roles from dropdown)
- Role picker shows each role's permissions in a tooltip or expandable detail
- Scope fields (person types, org units, proxy) unchanged

### Roles Tab (new)

**List view:**
- Table: Role Name | Permissions (as chips/badges) | Users Count | Actions
- Search/filter by role name

**Add/Edit form:**
- Role name (text input)
- Description (text area)
- Permission checklist grouped by category (Curation, Reporting, Administration, etc.)
- Each permission shows its label and description

**Delete:**
- Blocked if users are currently assigned (shows count and warning)
- Confirmation dialog

### Permissions Tab (new)

**List view:**
- Table grouped by category
- Columns: Permission Key | Label | Description | Roles Using | Resources | Actions

**Add form:**
- permissionKey (slug input, validated unique, immutable after creation)
- Label (text input)
- Description (text area)
- Category (dropdown, with option to type new)

**Edit:**
- Label, description, category editable
- permissionKey immutable (displayed as read-only)

**Delete:**
- Blocked if assigned to any role (shows affected roles)
- Confirmation dialog

**Resource management (expandable sub-section per permission):**
- List of resources mapped to this permission
- Add resource: resourceType dropdown, resourceKey, label, icon picker, displayOrder, route
- Edit/delete inline
- Preview of nav menu ordering

---

## Migration Strategy

Behavior-preserving migration. No user-facing changes on day one.

### Step 1: DB Migration
- Create `admin_permissions`, `admin_role_permissions`, `admin_permission_resources` tables
- Seed with today's 7 permissions, role→permission mappings, and nav resource entries

### Step 2: Auth Flow
- Update `findUserPermissions()` to resolve permissions and resources via JOINs
- Add `permissions` and `permissionResources` to JWT
- Keep `userRoles` in JWT (still needed for curation scope logic)

### Step 3: Middleware
- Replace `getCapabilities()` calls with `permSet.has()` checks
- Add `ROUTE_PERMISSIONS` lookup object
- Curation scope logic (self/scoped/proxy) stays as-is

### Step 4: SideNavbar
- Render nav items from `permissionResources` instead of hardcoded menu array
- Icons, labels, ordering, routes all from data

### Step 5: Component-Level Checks
- Migrate ReciterTabs, CurateIndividual, and other inline role checks to use permission set
- Remove `allowedRoleNames` arrays

### Step 6: Admin UI
- Add Roles tab and Permissions tab to Manage Users page
- CRUD for permissions, roles, role→permission mapping, and permission resources

### Step 7: Cleanup
- Remove `ROLE_CAPABILITIES`, hardcoded `allowedPermissions` enum, and `getCapabilities()` from constants.js
- Remove old capability tests, add permission-based tests

**Shipping strategy:** Steps 1-5 ship as one release (behavior-preserving, no new UI). Step 6 follows. Step 7 is cleanup after stable.

---

## Out of Scope

- Per-request permission resolution (chose login-time baking into JWT)
- Route enforcement from DB (chose code-based middleware with DB permission keys)
- Permission-level scope constraints (scope stays user-level)
- Finer-grained permission breakdown (deferred; admins can add via UI when needed)
- Session refresh mechanism (deferred; users re-login for permission changes)
