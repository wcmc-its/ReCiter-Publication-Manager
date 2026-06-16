# Data-Driven RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all role/permission definitions, role→permission mappings, and UI resource visibility from hardcoded application code to database tables, preserving existing behavior exactly.

**Architecture:** Three new DB tables (`admin_permissions`, `admin_role_permissions`, `admin_permission_resources`) seeded with today's 7 permissions and 7 role mappings. The auth flow resolves permissions at login and bakes them into the JWT. Middleware checks permission strings from JWT. SideNavbar renders from permission_resources data. Admin UI adds Roles and Permissions tabs to the existing Manage Users page.

**Tech Stack:** MySQL, Sequelize ORM v6, Next.js 14 (Pages Router), next-auth v3, React 16, MUI, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-14-data-driven-rbac-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/db/models/AdminPermission.ts` | Sequelize model for `admin_permissions` table |
| `src/db/models/AdminRolePermission.ts` | Sequelize model for `admin_role_permissions` junction table |
| `src/db/models/AdminPermissionResource.ts` | Sequelize model for `admin_permission_resources` table |
| `src/db/migrations/add-permission-tables.sql` | DDL + seed data for the three new tables |
| `src/utils/permissionHelpers.ts` | `hasPermission()`, `getPermissionsFromSession()`, `getLandingPageFromPermissions()` |
| `__tests__/permissions.test.ts` | Tests for permission helper utilities |
| `controllers/db/permissions/permissions.controller.ts` | CRUD controller for permissions + role-permissions + resources |
| `src/pages/api/db/admin/permissions.ts` | API route for permissions CRUD |
| `src/pages/api/db/admin/roles/index.ts` | API route for roles CRUD (with permissions) |
| `src/pages/api/db/admin/roles/permissions.ts` | API route for role-permission assignments |
| `src/components/elements/Manage/RolesTab.tsx` | Admin UI: Roles list + add/edit with permission checklist |
| `src/components/elements/Manage/PermissionsTab.tsx` | Admin UI: Permissions list + add/edit + resource management |

### Modified Files
| File | Change |
|------|--------|
| `src/db/models/init-models.ts` | Register 3 new models + associations |
| `controllers/db/userroles.controller.ts` | Expand `findUserPermissions()` to resolve permissions + resources via JOINs |
| `src/pages/api/auth/[...nextauth].jsx` | Add `permissions` and `permissionResources` to JWT/session |
| `types/next-auth.d.ts` | Add `permissions` and `permissionResources` to session type |
| `src/middleware.ts` | Replace `getCapabilities()` with permission set checks |
| `src/utils/constants.js` | Keep `getCapabilities()` temporarily, add deprecation comment |
| `src/components/elements/Navbar/SideNavbar.tsx` | Render nav from `permissionResources` data instead of hardcoded array |
| `types/menu.d.ts` | Remove `allowedRoleNames`, add `permissionKey` |
| `src/components/elements/CurateIndividual/CurateIndividual.tsx` | Use permission set instead of `getCapabilities()` |
| `src/components/elements/CurateIndividual/ReciterTabs.tsx` | Remove `allowedRoleNames` from tab data |
| `src/utils/checkCurationScope.ts` | Read permissions from JWT instead of deriving via `getCapabilities()` |
| `src/pages/index.js` | Use permission set for landing page redirect |
| `src/pages/manageusers/index.tsx` | Add tab navigation: Users / Roles / Permissions |
| `controllers/db/manage-users/user.controller.ts` | Add role description to `listAllAdminRoles` response |

---

## Task 1: SQL Migration + Seed Data

**Files:**
- Create: `src/db/migrations/add-permission-tables.sql`

This SQL must be run against both dev and prod `reciterDB` databases, plus committed to the ReCiterDB repo schema.

- [ ] **Step 1: Write the migration SQL**

```sql
-- src/db/migrations/add-permission-tables.sql
-- Data-Driven RBAC: Create permission tables and seed with current behavior

-- 1. admin_permissions
CREATE TABLE IF NOT EXISTS `admin_permissions` (
  `permissionID` INT NOT NULL AUTO_INCREMENT,
  `permissionKey` VARCHAR(128) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(64) NOT NULL,
  `createTimestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifyTimestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`permissionID`),
  UNIQUE KEY `uq_permissionKey` (`permissionKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. admin_role_permissions
CREATE TABLE IF NOT EXISTS `admin_role_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `roleID` INT NOT NULL,
  `permissionID` INT NOT NULL,
  `createTimestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_permission` (`roleID`, `permissionID`),
  KEY `idx_roleID` (`roleID`),
  KEY `idx_permissionID` (`permissionID`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`roleID`) REFERENCES `admin_roles` (`roleID`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permissionID`) REFERENCES `admin_permissions` (`permissionID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. admin_permission_resources
CREATE TABLE IF NOT EXISTS `admin_permission_resources` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `permissionID` INT NOT NULL,
  `resourceType` VARCHAR(32) NOT NULL,
  `resourceKey` VARCHAR(128) NOT NULL,
  `displayOrder` INT NOT NULL DEFAULT 0,
  `icon` VARCHAR(64) NULL,
  `label` VARCHAR(255) NOT NULL,
  `route` VARCHAR(255) NULL,
  `createTimestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pr_permissionID` (`permissionID`),
  CONSTRAINT `fk_pr_permission` FOREIGN KEY (`permissionID`) REFERENCES `admin_permissions` (`permissionID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Seed permissions
INSERT INTO `admin_permissions` (`permissionKey`, `label`, `description`, `category`) VALUES
  ('canCurate', 'Curate Publications', 'Accept or reject article suggestions for people', 'Curation'),
  ('canSearch', 'Search Identities', 'Search and browse the identity directory', 'Navigation'),
  ('canReport', 'Create Reports', 'Generate publication reports and export data', 'Reporting'),
  ('canManageUsers', 'Manage Users', 'Create, edit, and deactivate user accounts and assign roles', 'Administration'),
  ('canConfigure', 'Configuration', 'Edit application settings, labels, and field visibility', 'Administration'),
  ('canManageNotifications', 'Manage Notifications', 'Configure notification preferences', 'Communication'),
  ('canManageProfile', 'Manage Profile', 'View and edit user profile information', 'Profile');

-- 5. Seed role→permission mappings
-- Superuser gets all 7
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID
  FROM admin_roles ar
  CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Superuser';

-- Curator_All: canCurate, canSearch
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID
  FROM admin_roles ar
  CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Curator_All'
    AND ap.permissionKey IN ('canCurate', 'canSearch');

-- Curator_Self: canCurate
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID
  FROM admin_roles ar
  CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Curator_Self'
    AND ap.permissionKey IN ('canCurate');

-- Curator_Scoped: canCurate, canSearch
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID
  FROM admin_roles ar
  CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Curator_Scoped'
    AND ap.permissionKey IN ('canCurate', 'canSearch');

-- Curator_Department: canCurate, canSearch
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID
  FROM admin_roles ar
  CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Curator_Department'
    AND ap.permissionKey IN ('canCurate', 'canSearch');

-- Curator_Department_Delegate: canCurate, canSearch
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID
  FROM admin_roles ar
  CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Curator_Department_Delegate'
    AND ap.permissionKey IN ('canCurate', 'canSearch');

-- Reporter_All: canReport, canSearch
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID
  FROM admin_roles ar
  CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Reporter_All'
    AND ap.permissionKey IN ('canReport', 'canSearch');

-- 6. Seed permission resources (nav menu items)
INSERT INTO `admin_permission_resources` (`permissionID`, `resourceType`, `resourceKey`, `displayOrder`, `icon`, `label`, `route`)
  SELECT ap.permissionID, v.resourceType, v.resourceKey, v.displayOrder, v.icon, v.label, v.route
  FROM admin_permissions ap
  JOIN (
    SELECT 'canSearch' AS pk, 'nav' AS resourceType, 'nav_search' AS resourceKey, 1 AS displayOrder, 'Search' AS icon, 'Find People' AS label, '/search' AS route
    UNION ALL SELECT 'canCurate', 'nav', 'nav_curate', 2, 'LocalLibrary', 'Curate Publications', '/curate'
    UNION ALL SELECT 'canReport', 'nav', 'nav_report', 3, 'Assessment', 'Create Reports', '/report'
    UNION ALL SELECT 'canManageNotifications', 'nav', 'nav_notifications', 4, 'NotificationsActive', 'Manage Notifications', '/notifications'
    UNION ALL SELECT 'canManageProfile', 'nav', 'nav_profile', 5, 'AccountCircle', 'Manage Profile', '/manageprofile'
    UNION ALL SELECT 'canManageUsers', 'nav', 'nav_users', 6, 'Group', 'Manage Users', '/manageusers'
    UNION ALL SELECT 'canConfigure', 'nav', 'nav_config', 7, 'Settings', 'Configuration', '/configuration'
  ) v ON ap.permissionKey = v.pk;
```

- [ ] **Step 2: Run the migration against dev database**

Run: `mysql -u $RECITER_DB_USERNAME -p$RECITER_DB_PASSWORD -h $RECITER_DB_HOST $RECITER_DB_NAME < src/db/migrations/add-permission-tables.sql`

Verify: `mysql -e "SELECT COUNT(*) FROM admin_permissions; SELECT COUNT(*) FROM admin_role_permissions; SELECT COUNT(*) FROM admin_permission_resources;" $RECITER_DB_NAME`

Expected: 7 permissions, ~17 role-permission rows (varies by how many roles exist), 7 resources.

- [ ] **Step 3: Commit**

```bash
git add src/db/migrations/add-permission-tables.sql
git commit -m "feat(rbac): add SQL migration for permission tables with seed data"
```

---

## Task 2: Sequelize Models

**Files:**
- Create: `src/db/models/AdminPermission.ts`
- Create: `src/db/models/AdminRolePermission.ts`
- Create: `src/db/models/AdminPermissionResource.ts`
- Modify: `src/db/models/init-models.ts:1-315`

- [ ] **Step 1: Create AdminPermission model**

```typescript
// src/db/models/AdminPermission.ts
import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminRolePermission, AdminRolePermissionId } from './AdminRolePermission';
import type { AdminPermissionResource, AdminPermissionResourceId } from './AdminPermissionResource';

export interface AdminPermissionAttributes {
  permissionID: number;
  permissionKey: string;
  label: string;
  description?: string;
  category: string;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminPermissionPk = "permissionID";
export type AdminPermissionId = AdminPermission[AdminPermissionPk];
export type AdminPermissionOptionalAttributes = "permissionID" | "description" | "createTimestamp" | "modifyTimestamp";
export type AdminPermissionCreationAttributes = Optional<AdminPermissionAttributes, AdminPermissionOptionalAttributes>;

export class AdminPermission extends Model<AdminPermissionAttributes, AdminPermissionCreationAttributes> implements AdminPermissionAttributes {
  permissionID!: number;
  permissionKey!: string;
  label!: string;
  description?: string;
  category!: string;
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  adminRolePermissions!: AdminRolePermission[];
  getAdminRolePermissions!: Sequelize.HasManyGetAssociationsMixin<AdminRolePermission>;
  adminPermissionResources!: AdminPermissionResource[];
  getAdminPermissionResources!: Sequelize.HasManyGetAssociationsMixin<AdminPermissionResource>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminPermission {
    AdminPermission.init({
      permissionID: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      permissionKey: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true
      },
      label: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      category: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      createTimestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.fn('current_timestamp')
      },
      modifyTimestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.fn('current_timestamp')
      }
    }, {
      sequelize,
      tableName: 'admin_permissions',
      timestamps: false,
      indexes: [
        { name: "PRIMARY", unique: true, using: "BTREE", fields: [{ name: "permissionID" }] },
        { name: "uq_permissionKey", unique: true, using: "BTREE", fields: [{ name: "permissionKey" }] },
      ]
    });
    return AdminPermission;
  }
}
```

- [ ] **Step 2: Create AdminRolePermission model**

```typescript
// src/db/models/AdminRolePermission.ts
import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminRole, AdminRoleId } from './AdminRole';
import type { AdminPermission, AdminPermissionId } from './AdminPermission';

export interface AdminRolePermissionAttributes {
  id: number;
  roleID: number;
  permissionID: number;
  createTimestamp: Date;
}

export type AdminRolePermissionPk = "id";
export type AdminRolePermissionId = AdminRolePermission[AdminRolePermissionPk];
export type AdminRolePermissionOptionalAttributes = "id" | "createTimestamp";
export type AdminRolePermissionCreationAttributes = Optional<AdminRolePermissionAttributes, AdminRolePermissionOptionalAttributes>;

export class AdminRolePermission extends Model<AdminRolePermissionAttributes, AdminRolePermissionCreationAttributes> implements AdminRolePermissionAttributes {
  id!: number;
  roleID!: number;
  permissionID!: number;
  createTimestamp!: Date;

  role!: AdminRole;
  getRole!: Sequelize.BelongsToGetAssociationMixin<AdminRole>;
  permission!: AdminPermission;
  getPermission!: Sequelize.BelongsToGetAssociationMixin<AdminPermission>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminRolePermission {
    AdminRolePermission.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      roleID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'admin_roles', key: 'roleID' }
      },
      permissionID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'admin_permissions', key: 'permissionID' }
      },
      createTimestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.fn('current_timestamp')
      }
    }, {
      sequelize,
      tableName: 'admin_role_permissions',
      timestamps: false,
      indexes: [
        { name: "PRIMARY", unique: true, using: "BTREE", fields: [{ name: "id" }] },
        { name: "uq_role_permission", unique: true, using: "BTREE", fields: [{ name: "roleID" }, { name: "permissionID" }] },
        { name: "idx_roleID", using: "BTREE", fields: [{ name: "roleID" }] },
        { name: "idx_permissionID", using: "BTREE", fields: [{ name: "permissionID" }] },
      ]
    });
    return AdminRolePermission;
  }
}
```

- [ ] **Step 3: Create AdminPermissionResource model**

```typescript
// src/db/models/AdminPermissionResource.ts
import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminPermission, AdminPermissionId } from './AdminPermission';

export interface AdminPermissionResourceAttributes {
  id: number;
  permissionID: number;
  resourceType: string;
  resourceKey: string;
  displayOrder: number;
  icon?: string;
  label: string;
  route?: string;
  createTimestamp: Date;
}

export type AdminPermissionResourcePk = "id";
export type AdminPermissionResourceId = AdminPermissionResource[AdminPermissionResourcePk];
export type AdminPermissionResourceOptionalAttributes = "id" | "displayOrder" | "icon" | "route" | "createTimestamp";
export type AdminPermissionResourceCreationAttributes = Optional<AdminPermissionResourceAttributes, AdminPermissionResourceOptionalAttributes>;

export class AdminPermissionResource extends Model<AdminPermissionResourceAttributes, AdminPermissionResourceCreationAttributes> implements AdminPermissionResourceAttributes {
  id!: number;
  permissionID!: number;
  resourceType!: string;
  resourceKey!: string;
  displayOrder!: number;
  icon?: string;
  label!: string;
  route?: string;
  createTimestamp!: Date;

  permission!: AdminPermission;
  getPermission!: Sequelize.BelongsToGetAssociationMixin<AdminPermission>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminPermissionResource {
    AdminPermissionResource.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      permissionID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'admin_permissions', key: 'permissionID' }
      },
      resourceType: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      resourceKey: {
        type: DataTypes.STRING(128),
        allowNull: false
      },
      displayOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      icon: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      label: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      route: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      createTimestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.fn('current_timestamp')
      }
    }, {
      sequelize,
      tableName: 'admin_permission_resources',
      timestamps: false,
      indexes: [
        { name: "PRIMARY", unique: true, using: "BTREE", fields: [{ name: "id" }] },
        { name: "idx_pr_permissionID", using: "BTREE", fields: [{ name: "permissionID" }] },
      ]
    });
    return AdminPermissionResource;
  }
}
```

- [ ] **Step 4: Register models in init-models.ts**

Add imports at the top of `src/db/models/init-models.ts` (after existing imports around line 81):

```typescript
import { AdminPermission } from "./AdminPermission";
import type { AdminPermissionAttributes, AdminPermissionCreationAttributes } from "./AdminPermission";
import { AdminRolePermission } from "./AdminRolePermission";
import type { AdminRolePermissionAttributes, AdminRolePermissionCreationAttributes } from "./AdminRolePermission";
import { AdminPermissionResource } from "./AdminPermissionResource";
import type { AdminPermissionResourceAttributes, AdminPermissionResourceCreationAttributes } from "./AdminPermissionResource";
```

Add to the `export { ... }` block (after `AdminRole,` around line 93):

```typescript
  AdminPermission,
  AdminRolePermission,
  AdminPermissionResource,
```

Add to the `export type { ... }` block (after `AdminRoleCreationAttributes,` around line 142):

```typescript
  AdminPermissionAttributes,
  AdminPermissionCreationAttributes,
  AdminRolePermissionAttributes,
  AdminRolePermissionCreationAttributes,
  AdminPermissionResourceAttributes,
  AdminPermissionResourceCreationAttributes,
```

Add `initModel` calls in `initModels()` function (after `AdminRole.initModel(sequelize);` around line 218):

```typescript
  AdminPermission.initModel(sequelize);
  AdminRolePermission.initModel(sequelize);
  AdminPermissionResource.initModel(sequelize);
```

Add associations (after the existing `AdminRole.hasMany(AdminUsersRole, ...)` line around line 258):

```typescript
  AdminRolePermission.belongsTo(AdminRole, { as: "role", foreignKey: "roleID" });
  AdminRole.hasMany(AdminRolePermission, { as: "adminRolePermissions", foreignKey: "roleID" });
  AdminRolePermission.belongsTo(AdminPermission, { as: "permission", foreignKey: "permissionID" });
  AdminPermission.hasMany(AdminRolePermission, { as: "adminRolePermissions", foreignKey: "permissionID" });
  AdminPermissionResource.belongsTo(AdminPermission, { as: "permission", foreignKey: "permissionID" });
  AdminPermission.hasMany(AdminPermissionResource, { as: "adminPermissionResources", foreignKey: "permissionID" });
```

Add to the `return { ... }` object (after `AdminUsersRole: AdminUsersRole,` around line 281):

```typescript
    AdminPermission: AdminPermission,
    AdminRolePermission: AdminRolePermission,
    AdminPermissionResource: AdminPermissionResource,
```

- [ ] **Step 5: Commit**

```bash
git add src/db/models/AdminPermission.ts src/db/models/AdminRolePermission.ts src/db/models/AdminPermissionResource.ts src/db/models/init-models.ts
git commit -m "feat(rbac): add Sequelize models for permission tables"
```

---

## Task 3: Permission Helper Utilities + Tests

**Files:**
- Create: `src/utils/permissionHelpers.ts`
- Create: `__tests__/permissions.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/permissions.test.ts
import { hasPermission, getPermissionsFromRaw, getLandingPageFromPermissions } from '../src/utils/permissionHelpers'

describe('hasPermission', () => {
  it('returns true when permission exists in set', () => {
    const perms = new Set(['canCurate', 'canSearch'])
    expect(hasPermission(perms, 'canCurate')).toBe(true)
  })

  it('returns false when permission is missing', () => {
    const perms = new Set(['canSearch'])
    expect(hasPermission(perms, 'canCurate')).toBe(false)
  })

  it('returns false for empty set', () => {
    const perms = new Set<string>()
    expect(hasPermission(perms, 'canCurate')).toBe(false)
  })
})

describe('getPermissionsFromRaw', () => {
  it('parses a JSON string of permission keys', () => {
    const raw = '["canCurate","canSearch"]'
    const result = getPermissionsFromRaw(raw)
    expect(result).toBeInstanceOf(Set)
    expect(result.has('canCurate')).toBe(true)
    expect(result.has('canSearch')).toBe(true)
    expect(result.size).toBe(2)
  })

  it('returns empty set for null', () => {
    const result = getPermissionsFromRaw(null)
    expect(result.size).toBe(0)
  })

  it('returns empty set for undefined', () => {
    const result = getPermissionsFromRaw(undefined)
    expect(result.size).toBe(0)
  })

  it('returns empty set for invalid JSON', () => {
    const result = getPermissionsFromRaw('not json')
    expect(result.size).toBe(0)
  })

  it('returns empty set for empty array string', () => {
    const result = getPermissionsFromRaw('[]')
    expect(result.size).toBe(0)
  })
})

describe('getLandingPageFromPermissions', () => {
  it('returns /search for users with canSearch', () => {
    const perms = new Set(['canSearch', 'canReport'])
    expect(getLandingPageFromPermissions(perms, [])).toBe('/search')
  })

  it('returns /search for users with canReport', () => {
    const perms = new Set(['canReport'])
    expect(getLandingPageFromPermissions(perms, [])).toBe('/search')
  })

  it('returns /curate/:id for self-only curators', () => {
    const perms = new Set(['canCurate'])
    const roles = [{ roleLabel: 'Curator_Self', personIdentifier: 'paa2013' }]
    expect(getLandingPageFromPermissions(perms, roles)).toBe('/curate/paa2013')
  })

  it('returns /search for Curator_All (has canCurate + canSearch)', () => {
    const perms = new Set(['canCurate', 'canSearch'])
    const roles = [{ roleLabel: 'Curator_All', personIdentifier: 'paa2013' }]
    expect(getLandingPageFromPermissions(perms, roles)).toBe('/search')
  })

  it('returns /noaccess for empty permissions', () => {
    const perms = new Set<string>()
    expect(getLandingPageFromPermissions(perms, [])).toBe('/noaccess')
  })

  it('returns /curate/:id for Curator_Self + Reporter_All', () => {
    const perms = new Set(['canCurate', 'canReport', 'canSearch'])
    const roles = [
      { roleLabel: 'Curator_Self', personIdentifier: 'paa2013' },
      { roleLabel: 'Reporter_All', personIdentifier: 'paa2013' },
    ]
    expect(getLandingPageFromPermissions(perms, roles)).toBe('/curate/paa2013')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/permissions.test.ts --no-cache`
Expected: FAIL — `Cannot find module '../src/utils/permissionHelpers'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/utils/permissionHelpers.ts

/**
 * Check if a permission set contains a specific permission key.
 */
export function hasPermission(permSet: Set<string>, key: string): boolean {
  return permSet.has(key)
}

/**
 * Parse a raw JSON string (from JWT/session) into a Set of permission keys.
 * Returns empty Set on null, undefined, or invalid input.
 */
export function getPermissionsFromRaw(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set()
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return new Set(parsed)
    return new Set()
  } catch {
    return new Set()
  }
}

/**
 * Determine the landing page from a permission set.
 * Mirrors the old getLandingPage() logic but uses permissions instead of capabilities.
 *
 * Self-only curators (Curator_Self without canSearch) land on /curate/:id.
 * Everyone else with canSearch or canReport lands on /search.
 * Fallback: /noaccess.
 *
 * @param permSet - Set of permission keys
 * @param roles - User's role array (needed to determine personIdentifier for self curators)
 */
export function getLandingPageFromPermissions(
  permSet: Set<string>,
  roles: Array<{ roleLabel: string; personIdentifier?: string }>
): string {
  const hasCurate = permSet.has('canCurate')
  const hasSearch = permSet.has('canSearch')
  const hasReport = permSet.has('canReport')

  // Determine if user is a self-only curator:
  // Has canCurate but NOT canSearch (Curator_Self doesn't get canSearch)
  const personIdentifier = roles?.[0]?.personIdentifier || null
  const isSelfOnly = hasCurate && !hasSearch && personIdentifier

  if (isSelfOnly) {
    return '/curate/' + personIdentifier
  }

  if (hasSearch || hasReport) {
    return '/search'
  }

  return '/noaccess'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/permissions.test.ts --no-cache`
Expected: All 12 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/permissionHelpers.ts __tests__/permissions.test.ts
git commit -m "feat(rbac): add permission helper utilities with tests"
```

---

## Task 4: Expand Auth Flow (findUserPermissions + JWT)

**Files:**
- Modify: `controllers/db/userroles.controller.ts:1-81`
- Modify: `src/pages/api/auth/[...nextauth].jsx:152-188`
- Modify: `types/next-auth.d.ts`

- [ ] **Step 1: Update findUserPermissions() to resolve permissions and resources**

Replace the entire `findUserPermissions` function in `controllers/db/userroles.controller.ts` with:

```typescript
import sequelize from "../../src/db/db";

const parseJson = (val: any) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
        try { return JSON.parse(val); }
        catch { return null; }
    }
    return val;
};

/**
 * Retrieves user roles, resolved permissions, permission resources,
 * scope data, and proxy person IDs for a given user.
 *
 * Returns a composite JSON string:
 * { roles, permissions, permissionResources, scopeData, proxyPersonIds }
 */
export const findUserPermissions = async (attrValue: string, attrType: string) => {
    let userRolesList = [];

    try {
        const whereCondition = attrType === "email"
            ? "au.email = :value"
            : "au.personIdentifier = :value";

        // 1. Query roles (same as before)
        userRolesList = await sequelize.query(
            `SELECT DISTINCT au.personIdentifier, ar.roleLabel, aur.roleID ` +
            `FROM admin_users au ` +
            `INNER JOIN admin_users_roles aur ON au.userID = aur.userID ` +
            `INNER JOIN admin_roles ar ON aur.roleID = ar.roleID ` +
            `WHERE ${whereCondition}`,
            {
                replacements: { value: attrValue },
                nest: true,
                raw: true
            }
        );

        // 2. Resolve permissions from roles via admin_role_permissions
        const roleIds = userRolesList.map((r: any) => r.roleID).filter(Boolean);
        let permissions: string[] = [];
        if (roleIds.length > 0) {
            const permResult: any = await sequelize.query(
                `SELECT DISTINCT ap.permissionKey ` +
                `FROM admin_role_permissions arp ` +
                `INNER JOIN admin_permissions ap ON arp.permissionID = ap.permissionID ` +
                `WHERE arp.roleID IN (:roleIds)`,
                {
                    replacements: { roleIds },
                    raw: true,
                }
            );
            permissions = (permResult[0] || []).map((r: any) => r.permissionKey);
        }

        // 3. Fetch permission resources for the resolved permissions
        let permissionResources: any[] = [];
        if (permissions.length > 0) {
            const resResult: any = await sequelize.query(
                `SELECT ap.permissionKey, apr.resourceType, apr.resourceKey, ` +
                `apr.displayOrder, apr.icon, apr.label, apr.route ` +
                `FROM admin_permission_resources apr ` +
                `INNER JOIN admin_permissions ap ON apr.permissionID = ap.permissionID ` +
                `WHERE ap.permissionKey IN (:permissions) ` +
                `ORDER BY apr.displayOrder ASC`,
                {
                    replacements: { permissions },
                    raw: true,
                }
            );
            permissionResources = resResult[0] || [];
        }

        // 4. Scope + proxy (unchanged)
        let scopeData = null;
        let proxyPersonIds: string[] = [];

        const scopeWhereCondition = attrType === "email"
            ? "email = :value"
            : "personIdentifier = :value";

        const scopeResult: any = await sequelize.query(
            `SELECT scope_person_types, scope_org_units, proxy_person_ids ` +
            `FROM admin_users WHERE ${scopeWhereCondition} LIMIT 1`,
            {
                replacements: { value: attrValue },
                raw: true,
            }
        );

        if (scopeResult[0]?.[0]) {
            const row = scopeResult[0][0];
            const personTypes = parseJson(row.scope_person_types);
            const orgUnits = parseJson(row.scope_org_units);
            const proxyIds = parseJson(row.proxy_person_ids);

            if (personTypes || orgUnits) {
                scopeData = { personTypes: personTypes || null, orgUnits: orgUnits || null };
            }
            proxyPersonIds = proxyIds || [];
        }

        return JSON.stringify({
            roles: userRolesList,
            permissions,
            permissionResources,
            scopeData,
            proxyPersonIds
        });
    } catch (e) {
        console.error('[AUTH] findUserPermissions error:', e);
        return JSON.stringify({ roles: [], permissions: [], permissionResources: [], scopeData: null, proxyPersonIds: [] });
    }
};
```

- [ ] **Step 2: Update JWT callback to pass permissions and resources**

In `src/pages/api/auth/[...nextauth].jsx`, replace the JWT callback (lines 152-191) with:

```javascript
    async jwt({ token, user }) {
      if (user) {
        token.user = user;
        token.username = user.databaseUser?.personIdentifier || user.personIdentifier || user.email;
        token.email = user.email || '';
        token.databaseUser = user.databaseUser || null;
        token.name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || token.username;
        token.picture = user.image || user.databaseUser?.profilePicture;

        // Parse composite findUserPermissions response
        if (user.userRoles) {
            try {
                const parsed = JSON.parse(user.userRoles);
                if (parsed.roles) {
                    token.userRoles = JSON.stringify(parsed.roles);
                    token.permissions = parsed.permissions ? JSON.stringify(parsed.permissions) : '[]';
                    token.permissionResources = parsed.permissionResources ? JSON.stringify(parsed.permissionResources) : '[]';
                    token.scopeData = parsed.scopeData ? JSON.stringify(parsed.scopeData) : null;
                    token.proxyPersonIds = (parsed.proxyPersonIds && parsed.proxyPersonIds.length > 0)
                        ? JSON.stringify(parsed.proxyPersonIds) : null;
                } else {
                    // Legacy format fallback
                    token.userRoles = user.userRoles;
                    token.permissions = '[]';
                    token.permissionResources = '[]';
                    token.scopeData = null;
                    token.proxyPersonIds = null;
                }
            } catch (e) {
                token.userRoles = user.userRoles;
                token.permissions = '[]';
                token.permissionResources = '[]';
                token.scopeData = null;
                token.proxyPersonIds = null;
            }
        } else {
            token.userRoles = '[]';
            token.permissions = '[]';
            token.permissionResources = '[]';
            token.scopeData = null;
            token.proxyPersonIds = null;
        }
      }
      return token;
    },
```

- [ ] **Step 3: Update TypeScript session type**

In `types/next-auth.d.ts`, add to the session data interface:

```typescript
    permissions?: string;            // JSON stringified permission keys array
    permissionResources?: string;    // JSON stringified resource objects array
```

- [ ] **Step 4: Verify the dev server still starts and login works**

Run: Start dev server, log in, check browser console for session data containing `permissions` and `permissionResources` fields.

- [ ] **Step 5: Commit**

```bash
git add controllers/db/userroles.controller.ts src/pages/api/auth/[...nextauth].jsx types/next-auth.d.ts
git commit -m "feat(rbac): resolve permissions from DB at login, add to JWT"
```

---

## Task 5: Update Middleware

**Files:**
- Modify: `src/middleware.ts:1-133`
- Modify: `src/utils/constants.js` (add deprecation comment only)

- [ ] **Step 1: Rewrite middleware to use permission set**

Replace the entire contents of `src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from "next-auth/jwt";

// Route → permission mapping (single source of truth for route enforcement)
const ROUTE_PERMISSIONS: Record<string, string> = {
  '/curate':        'canCurate',
  '/search':        'canSearch',
  '/report':        'canReport',
  '/manageusers':   'canManageUsers',
  '/configuration': 'canConfigure',
  '/notifications': 'canManageNotifications',
  '/manageprofile': 'canManageProfile',
}

// Baseline permissions for authenticated users with empty permission sets
const BASELINE_PERMISSIONS = new Set(['canSearch', 'canReport'])

export const config = {
  matcher: ['/manageusers/:path*', '/curate/:path*', '/report', '/search',
            '/configuration', '/notifications/:path*', '/manageprofile/:path*'],
}

export async function middleware(request: NextRequest) {
  try {
    const pathName = request.nextUrl.pathname;

    if (pathName?.includes('.git')) {
      return new NextResponse(null, { status: 403 });
    }

    const isAuthRoute = pathName.startsWith('/api/auth') ||
                       pathName.startsWith('/api/saml') ||
                       pathName.startsWith('/auth/finalize');
    if (isAuthRoute) return NextResponse.next();

    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Parse permissions from JWT (data-driven)
    let permSet: Set<string>;
    try {
      const perms = token.permissions ? JSON.parse(token.permissions as string) : [];
      permSet = new Set(perms);
    } catch {
      permSet = new Set();
    }

    // Baseline fallback: if permission set is empty, grant canSearch + canReport
    if (permSet.size === 0) {
      BASELINE_PERMISSIONS.forEach(p => permSet.add(p));
    }

    // Parse roles (still needed for curation scope logic)
    let userRoles: any[] = [];
    try {
      if (token.userRoles) {
        userRoles = JSON.parse(token.userRoles as string);
      }
    } catch {
      return redirectToLandingPage(request, '/error');
    }

    if (!userRoles || userRoles.length === 0) {
      return redirectToLandingPage(request, '/error');
    }

    const personIdentifier = userRoles[0]?.personIdentifier || null;

    // --- Route-level permission checks ---

    // Find which permission this route requires
    let requiredPermission: string | null = null;
    for (const [routePrefix, permKey] of Object.entries(ROUTE_PERMISSIONS)) {
      if (pathName.startsWith(routePrefix)) {
        requiredPermission = permKey;
        break;
      }
    }

    // If route doesn't match any known prefix, allow (Next.js handles 404)
    if (!requiredPermission) return NextResponse.next();

    // Check the user has the required permission
    if (!permSet.has(requiredPermission)) {
      return redirectToLandingPage(request, getLandingPage(permSet, personIdentifier, userRoles));
    }

    // --- Curation-specific scope logic (unchanged from before) ---
    if (pathName.startsWith('/curate')) {
      // Determine curation scope from roles
      const isCurateAll = userRoles.some((r: any) =>
        r.roleLabel === 'Superuser' || r.roleLabel === 'Curator_All'
      );
      if (isCurateAll) return NextResponse.next();

      const isCurateScoped = userRoles.some((r: any) =>
        r.roleLabel === 'Curator_Scoped' || r.roleLabel === 'Curator_Department' || r.roleLabel === 'Curator_Department_Delegate'
      );
      if (isCurateScoped) return NextResponse.next();

      // Allow proxy targets
      const proxyPersonIds: string[] = token.proxyPersonIds
        ? JSON.parse(token.proxyPersonIds as string)
        : [];
      const targetId = pathName.replace('/curate/', '');
      if (targetId && proxyPersonIds.includes(targetId)) return NextResponse.next();

      // Self-only: must match own ID
      const isCurateSelf = userRoles.some((r: any) => r.roleLabel === 'Curator_Self');
      if (isCurateSelf) {
        const expectedPath = '/curate/' + personIdentifier;
        if (pathName === expectedPath) return NextResponse.next();
        return redirectToLandingPage(request, expectedPath);
      }

      return redirectToLandingPage(request, getLandingPage(permSet, personIdentifier, userRoles));
    }

    // --- Notifications/Profile: self-only users must access their own path ---
    if (pathName.startsWith('/notifications') || pathName.startsWith('/manageprofile')) {
      const isSelfOnly = userRoles.some((r: any) => r.roleLabel === 'Curator_Self') &&
        !userRoles.some((r: any) =>
          r.roleLabel === 'Superuser' || r.roleLabel === 'Curator_All' ||
          r.roleLabel === 'Curator_Scoped' || r.roleLabel === 'Reporter_All'
        );
      if (isSelfOnly && personIdentifier) {
        const prefix = pathName.startsWith('/notifications') ? '/notifications/' : '/manageprofile/';
        const expectedPath = prefix + personIdentifier;
        if (pathName === expectedPath) return NextResponse.next();
        return redirectToLandingPage(request, expectedPath);
      }
    }

    return NextResponse.next();

  } catch (error) {
    console.error("[MIDDLEWARE]", error);
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = '/error';
    return NextResponse.redirect(errorUrl);
  }
}

function getLandingPage(permSet: Set<string>, personIdentifier: string | null, roles: any[]): string {
  const hasCurate = permSet.has('canCurate');
  const hasSearch = permSet.has('canSearch');
  const hasReport = permSet.has('canReport');

  // Self-only curator: has canCurate but not canSearch
  if (hasCurate && !hasSearch && personIdentifier) {
    return '/curate/' + personIdentifier;
  }
  if (hasSearch || hasReport) return '/search';
  return '/noaccess';
}

function redirectToLandingPage(request: NextRequest, pathName: string) {
  const redirectedUrl = request.nextUrl.clone();
  redirectedUrl.pathname = pathName;
  return NextResponse.redirect(redirectedUrl);
}
```

- [ ] **Step 2: Add deprecation comment to constants.js**

At the top of `ROLE_CAPABILITIES` in `src/utils/constants.js` (line 82), add:

```javascript
/**
 * @deprecated Use data-driven permissions from session.data.permissions instead.
 * This map is retained temporarily for backward compatibility during migration.
 * Will be removed once all consumers are migrated.
 */
```

- [ ] **Step 3: Update pages/index.js to use permission helpers**

Replace `src/pages/index.js` contents:

```javascript
import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]";
import { getLandingPageFromPermissions, getPermissionsFromRaw } from "../utils/permissionHelpers";

export async function getServerSideProps(ctx) {
    try {
        const session = await getServerSession(ctx.req, ctx.res, authOptions);

        if (!session || !session.data) {
            if (process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML") {
                return { redirect: { destination: "/login", permanent: false } };
            }
            return { redirect: { destination: "/api/auth/saml-login?callbackUrl=/search", permanent: false } };
        }

        if (session.data.databaseUser?.status == 0) {
            return { redirect: { destination: "/noaccess", permanent: false } };
        }

        const permSet = getPermissionsFromRaw(session.data.permissions);
        let roles = [];
        try {
            if (session.data.userRoles) {
                roles = JSON.parse(session.data.userRoles);
            }
        } catch (e) {
            roles = [];
        }

        const landing = getLandingPageFromPermissions(permSet, roles);
        return { redirect: { destination: landing, permanent: false } };
    } catch (error) {
        console.error("[INDEX:getServerSideProps]", error);
        if (process.env.NEXT_PUBLIC_LOGIN_PROVIDER !== "SAML") {
            return { redirect: { destination: "/login", permanent: false } };
        }
        return { redirect: { destination: "/api/auth/saml-login?callbackUrl=/search", permanent: false } };
    }
}

export default function Home() {
    return <></>;
}
```

- [ ] **Step 4: Update checkCurationScope.ts to use permissions**

Replace `src/utils/checkCurationScope.ts`:

```typescript
import type { NextApiRequest } from 'next'
import { getToken } from 'next-auth/jwt'
import { getPermissionsFromRaw } from './permissionHelpers'
import { isPersonInScope, isProxyFor, ScopeData } from './scopeResolver'
import models from '../db/sequelize'

interface ScopeCheckResult {
  allowed: boolean
  status?: number
  message?: string
}

/**
 * Check whether the authenticated user is allowed to curate for the given person.
 *
 * Bypass order:
 *  1. Superuser / Curator_All (canCurate via all-access roles) — always allowed
 *  2. Curator_Self curating own profile — allowed
 *  3. Proxy holder (target in proxyPersonIds) — allowed
 *  4. Curator_Scoped — allowed if person is within scope
 *  5. Otherwise — 403
 */
export async function checkCurationScope(
  req: NextApiRequest,
  targetUid: string
): Promise<ScopeCheckResult> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    return { allowed: false, status: 401, message: 'Not authenticated' }
  }

  // Check user has canCurate permission at all
  const permSet = getPermissionsFromRaw(token.permissions as string)
  if (!permSet.has('canCurate')) {
    return { allowed: false, status: 403, message: 'You do not have curation permission' }
  }

  // Parse roles for scope logic
  const roles = token.userRoles ? JSON.parse(token.userRoles as string) : []
  const personIdentifier = roles[0]?.personIdentifier || null

  // 1. Superuser / Curator_All — unrestricted
  const isCurateAll = roles.some((r: any) =>
    r.roleLabel === 'Superuser' || r.roleLabel === 'Curator_All'
  )
  if (isCurateAll) {
    return { allowed: true }
  }

  // 2. Curator_Self curating own profile
  const isCurateSelf = roles.some((r: any) => r.roleLabel === 'Curator_Self')
  if (isCurateSelf && personIdentifier === targetUid) {
    return { allowed: true }
  }

  // 3. Proxy holder
  const proxyPersonIds: string[] = token.proxyPersonIds
    ? JSON.parse(token.proxyPersonIds as string)
    : []
  if (isProxyFor(proxyPersonIds, targetUid)) {
    return { allowed: true }
  }

  // 4. Scoped curator
  const isCurateScoped = roles.some((r: any) =>
    r.roleLabel === 'Curator_Scoped' || r.roleLabel === 'Curator_Department' || r.roleLabel === 'Curator_Department_Delegate'
  )
  if (isCurateScoped) {
    const scopeData: ScopeData = token.scopeData
      ? JSON.parse(token.scopeData as string)
      : null

    const person = await models.Person.findOne({
      where: { personIdentifier: targetUid },
      attributes: ['primaryOrganizationalUnit'],
      raw: true,
    })

    const personTypes = await models.PersonPersonType.findAll({
      where: { personIdentifier: targetUid },
      attributes: ['personType'],
      raw: true,
    })

    const orgUnit = person?.primaryOrganizationalUnit || null
    const types = personTypes.map((pt: any) => pt.personType).filter(Boolean)

    if (isPersonInScope(scopeData, orgUnit, types)) {
      return { allowed: true }
    }
  }

  return { allowed: false, status: 403, message: 'You do not have permission to curate this person' }
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest --no-cache`
Expected: All existing capability tests still pass, all new permission tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts src/utils/constants.js src/pages/index.js src/utils/checkCurationScope.ts
git commit -m "feat(rbac): middleware and auth helpers use data-driven permissions"
```

---

## Task 6: Data-Driven SideNavbar

**Files:**
- Modify: `src/components/elements/Navbar/SideNavbar.tsx:193-437`
- Modify: `types/menu.d.ts:1-12`

- [ ] **Step 1: Update MenuItem type**

Replace `types/menu.d.ts`:

```typescript
export type MenuItem = {
  title: string
  to?: string
  nestedMenu?: Array<MenuItem>
  id?: number
  imgUrl?: string | StaticImport
  imgUrlActive?: string | StaticImport
  muiIcon?: any
  disabled?: boolean
  permissionKey?: string
  isRequired?: boolean
  section?: 'nav' | 'admin'
}
```

- [ ] **Step 2: Rewrite SideNavbar to use permissionResources**

In `src/components/elements/Navbar/SideNavbar.tsx`, replace the component body (from line 193 `const SideNavbar` to line 437 `export default SideNavbar`) with:

```tsx
const SideNavbar: React.FC<SideNavBarProps> = () => {
  const theme = useTheme();
  const [open, setOpen] = React.useState(true);
  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings)

  const [isVisibleNotification, setVisibleNotification] = React.useState(true);

  const { data: session, status } = useSession(); const loading = status === "loading";

  const userPermissions = JSON.parse(session.data.userRoles);

  // Parse data-driven permission resources from session
  const permissionResources = React.useMemo(() => {
    try {
      return JSON.parse(session.data.permissionResources || '[]');
    } catch { return []; }
  }, [session.data.permissionResources]);

  // Parse scope/proxy data for scope label
  const scopeData = session?.data?.scopeData ? JSON.parse(session.data.scopeData) : null;
  const proxyPersonIds = session?.data?.proxyPersonIds ? JSON.parse(session.data.proxyPersonIds) : [];
  const caps = getCapabilities(userPermissions);
  const isScopedCurator = caps.canCurate.scoped && !caps.canCurate.all;

  // Icon lookup: maps icon string from DB to React component
  const iconMap: Record<string, React.ReactNode> = {
    'Search': <IconSearch />,
    'LocalLibrary': <IconCurate />,
    'Assessment': <IconReports />,
    'NotificationsActive': <IconCurate />,
    'AccountCircle': <IconPerson />,
    'Group': <IconManageUsers />,
    'Settings': <IconConfig />,
  };

  // Build nav items from permission resources
  const navItems: Array<MenuItem> = React.useMemo(() => {
    const navResources = permissionResources
      .filter((r: any) => r.resourceType === 'nav')
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder);

    return navResources.map((r: any) => {
      let to = r.route || '/';

      // Self-only curators: append personIdentifier to certain routes
      const isSelfOnly = caps.canCurate.self && !caps.canCurate.all && !caps.canCurate.scoped;
      if (isSelfOnly && (r.resourceKey === 'nav_notifications' || r.resourceKey === 'nav_profile')) {
        to = r.route + '/' + session.data.username;
      }

      return {
        title: r.label,
        to,
        muiIcon: iconMap[r.icon] || <IconSearch />,
        disabled: false,
        permissionKey: r.permissionKey,
        isRequired: true,
        section: r.displayOrder <= 5 ? 'nav' as const : 'admin' as const,
      };
    });
  }, [permissionResources, caps, session.data.username]);

  // Split into nav and admin sections
  const mainNavItems = navItems.filter(i => i.section === 'nav');
  const adminNavItems = navItems.filter(i => i.section === 'admin');

  const expandNavCotext = React.useContext(ExpandNavContext);

  const handleDrawerToggle = () => {
    expandNavCotext.updateExpand();
    setOpen(!open);
  };

  React.useEffect(()=>{
    var manageNotifications = [];
    if (updatedAdminSettings.length > 0) {
      let updatedData = updatedAdminSettings.find(obj => obj.viewName === "EmailNotifications")
      manageNotifications = updatedData?.viewAttributes || [];
    } else if (session?.adminSettings) {
      let adminSettings = JSON.parse(JSON.stringify(session.adminSettings));
      let data = JSON.parse(adminSettings).find(obj => obj.viewName === "EmailNotifications")
      manageNotifications = data ? JSON.parse(data.viewAttributes) : [];
    }
    let settingsObj = manageNotifications.find(data=> data.isVisible)
    setVisibleNotification(settingsObj && settingsObj.isVisible || false)
  },[])

  React.useEffect(() => {
    if (updatedAdminSettings && updatedAdminSettings.length > 0) {
      let updatedData = updatedAdminSettings.find(obj => obj.viewName === "EmailNotifications")
      let manageNotifications = updatedData?.viewAttributes || [];
      let settingsObj = manageNotifications.find(data => data.isVisible)
      setVisibleNotification(settingsObj && settingsObj.isVisible || false)
    }
  }, [updatedAdminSettings])

  return (
    <Drawer variant="permanent" className='drawer-container' open={open} theme={theme}>
      {open && (
        <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#c44040', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>ReCiter</span>
        </div>
      )}
      <StyledList sx={{ flexGrow: 1, paddingTop: '4px' }}>
          {open && (
            <Typography sx={{ padding: '4px 20px 6px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5a7a94' }}>
              Navigation
            </Typography>
          )}
          {isScopedCurator && open && (
            <ScopeLabel
              scopeData={scopeData}
              proxyCount={proxyPersonIds.length}
            />
          )}
          {
            mainNavItems.map((item: MenuItem, index: number) => (
              <MenuListItem
                title={item.title}
                key={index}
                id={index}
                to={item.to}
                muiIcon={item.muiIcon}
                disabled={item.disabled}
              />
            ))
          }
          {adminNavItems.length > 0 && open && (
            <Typography sx={{ padding: '12px 20px 6px', marginTop: '8px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5a7a94' }}>
              Admin
            </Typography>
          )}
          {
            adminNavItems.map((item: MenuItem, index: number) => (
              <MenuListItem
                title={item.title}
                key={index + mainNavItems.length}
                id={index + mainNavItems.length}
                to={item.to}
                muiIcon={item.muiIcon}
                disabled={item.disabled}
              />
            ))
          }
      </StyledList>
      <button type="button" className={styles.compactToggle} onClick={handleDrawerToggle} style={{ marginTop: 'auto', borderTop: '1px solid #2e4050', background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', width: '100%' }} aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}>
        {open && <span>Compact mode</span>}
        {open ? <ChevronLeftIcon sx={{ fontSize: 16, color: '#4a5568' }} /> : <ChevronRightIcon sx={{ fontSize: 16, color: '#4a5568' }} />}
      </button>
    </Drawer>
  )
}
export default SideNavbar;
```

- [ ] **Step 3: Verify nav renders correctly**

Start dev server, log in, confirm all nav items appear in the correct order with correct icons and links for different role types.

- [ ] **Step 4: Commit**

```bash
git add src/components/elements/Navbar/SideNavbar.tsx types/menu.d.ts
git commit -m "feat(rbac): SideNavbar renders from data-driven permissionResources"
```

---

## Task 7: Update Component-Level Permission Checks

**Files:**
- Modify: `src/components/elements/CurateIndividual/CurateIndividual.tsx:56-66`
- Modify: `src/components/elements/CurateIndividual/ReciterTabs.tsx:34-40`

- [ ] **Step 1: Update CurateIndividual to use permissions**

In `src/components/elements/CurateIndividual/CurateIndividual.tsx`, replace lines 56-66:

```typescript
  // Derive permissions from session
  const permSet = React.useMemo(() => {
    try {
      const perms = JSON.parse(session?.data?.permissions || '[]');
      return new Set(perms);
    } catch { return new Set(); }
  }, [session?.data?.permissions]);
  const canGrantProxy = permSet.has('canCurate') && permSet.has('canManageUsers');
```

Also update the import on line 17 — remove `getCapabilities` if no longer used elsewhere in this file. Replace:

```typescript
import { allowedPermissions, toastMessage, getCapabilities } from "../../../utils/constants";
```

with:

```typescript
import { allowedPermissions, toastMessage } from "../../../utils/constants";
```

- [ ] **Step 2: Remove allowedRoleNames from ReciterTabs**

In `src/components/elements/CurateIndividual/ReciterTabs.tsx`, replace lines 34-40:

```typescript
  const tabsData = [
    { name: 'Suggested', value: 'NULL' },
    { name: 'Accepted', value: 'ACCEPTED' },
    { name: 'Rejected', value: 'REJECTED' },
    { name: addnewtabName, value: 'addNewRecord' },
    { name: pubMedTabName, value: 'AddPub' },
  ]
```

And update the useEffect on line 46 to remove `allowedRoleNames` from the mapped objects:

```typescript
      publicationsPerTabs.push({ value: tab.value, name: tab.name, data: filteredReciterData, count: filteredReciterData.length })
```

Also remove the unused import on line 9:

```typescript
// Remove this line:
// import { allowedPermissions } from "../../../utils/constants";
```

- [ ] **Step 3: Verify curation page works**

Start dev server, navigate to `/curate/:id`, confirm tabs render, proxy button visibility is correct.

- [ ] **Step 4: Commit**

```bash
git add src/components/elements/CurateIndividual/CurateIndividual.tsx src/components/elements/CurateIndividual/ReciterTabs.tsx
git commit -m "feat(rbac): component-level checks use permission set instead of roles"
```

---

## Task 8: Admin API Routes for Permissions CRUD

**Files:**
- Create: `controllers/db/permissions/permissions.controller.ts`
- Create: `src/pages/api/db/admin/permissions.ts`
- Create: `src/pages/api/db/admin/roles/index.ts`
- Create: `src/pages/api/db/admin/roles/permissions.ts`

- [ ] **Step 1: Create the permissions controller**

```typescript
// controllers/db/permissions/permissions.controller.ts
import type { NextApiRequest, NextApiResponse } from "next";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";

// --- Permissions CRUD ---

export const listAllPermissions = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const permissions: any = await sequelize.query(
      `SELECT ap.permissionID, ap.permissionKey, ap.label, ap.description, ap.category,
        (SELECT COUNT(*) FROM admin_role_permissions arp WHERE arp.permissionID = ap.permissionID) AS roleCount
       FROM admin_permissions ap
       ORDER BY ap.category, ap.label`,
      { raw: true }
    );
    res.json(permissions[0] || []);
  } catch (e) {
    console.error('[PERMISSIONS] listAll error:', e);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
};

export const createPermission = async (req: NextApiRequest, res: NextApiResponse) => {
  const { permissionKey, label, description, category } = req.body;
  if (!permissionKey || !label || !category) {
    return res.status(400).json({ error: 'permissionKey, label, and category are required' });
  }
  try {
    const existing = await models.AdminPermission.findOne({ where: { permissionKey } });
    if (existing) {
      return res.status(409).json({ error: 'permissionKey already exists' });
    }
    const permission = await models.AdminPermission.create({ permissionKey, label, description, category });
    res.status(201).json(permission);
  } catch (e) {
    console.error('[PERMISSIONS] create error:', e);
    res.status(500).json({ error: 'Failed to create permission' });
  }
};

export const updatePermission = async (req: NextApiRequest, res: NextApiResponse) => {
  const { permissionID, label, description, category } = req.body;
  if (!permissionID) {
    return res.status(400).json({ error: 'permissionID is required' });
  }
  try {
    await models.AdminPermission.update(
      { label, description, category },
      { where: { permissionID } }
    );
    res.json({ success: true });
  } catch (e) {
    console.error('[PERMISSIONS] update error:', e);
    res.status(500).json({ error: 'Failed to update permission' });
  }
};

export const deletePermission = async (req: NextApiRequest, res: NextApiResponse) => {
  const { permissionID } = req.body;
  if (!permissionID) {
    return res.status(400).json({ error: 'permissionID is required' });
  }
  try {
    const roleCount: any = await sequelize.query(
      `SELECT COUNT(*) AS cnt FROM admin_role_permissions WHERE permissionID = :permissionID`,
      { replacements: { permissionID }, raw: true }
    );
    if (roleCount[0]?.[0]?.cnt > 0) {
      return res.status(409).json({ error: 'Cannot delete: permission is assigned to roles' });
    }
    await models.AdminPermission.destroy({ where: { permissionID } });
    res.json({ success: true });
  } catch (e) {
    console.error('[PERMISSIONS] delete error:', e);
    res.status(500).json({ error: 'Failed to delete permission' });
  }
};

// --- Roles with Permissions ---

export const listRolesWithPermissions = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const roles: any = await sequelize.query(
      `SELECT ar.roleID, ar.roleLabel,
         (SELECT COUNT(*) FROM admin_users_roles aur WHERE aur.roleID = ar.roleID) AS userCount
       FROM admin_roles ar
       ORDER BY ar.roleLabel`,
      { raw: true }
    );

    const rolePermissions: any = await sequelize.query(
      `SELECT arp.roleID, ap.permissionID, ap.permissionKey, ap.label, ap.category
       FROM admin_role_permissions arp
       INNER JOIN admin_permissions ap ON arp.permissionID = ap.permissionID
       ORDER BY ap.category, ap.label`,
      { raw: true }
    );

    const permByRole = new Map<number, any[]>();
    for (const rp of (rolePermissions[0] || [])) {
      if (!permByRole.has(rp.roleID)) permByRole.set(rp.roleID, []);
      permByRole.get(rp.roleID)!.push(rp);
    }

    const result = (roles[0] || []).map((role: any) => ({
      ...role,
      permissions: permByRole.get(role.roleID) || [],
    }));

    res.json(result);
  } catch (e) {
    console.error('[PERMISSIONS] listRoles error:', e);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

export const updateRolePermissions = async (req: NextApiRequest, res: NextApiResponse) => {
  const { roleID, permissionIDs } = req.body;
  if (!roleID || !Array.isArray(permissionIDs)) {
    return res.status(400).json({ error: 'roleID and permissionIDs array are required' });
  }
  try {
    await sequelize.transaction(async (t) => {
      await models.AdminRolePermission.destroy({ where: { roleID }, transaction: t });
      const rows = permissionIDs.map((permissionID: number) => ({
        roleID,
        permissionID,
        createTimestamp: new Date(),
      }));
      await models.AdminRolePermission.bulkCreate(rows, { transaction: t });
    });
    res.json({ success: true });
  } catch (e) {
    console.error('[PERMISSIONS] updateRolePermissions error:', e);
    res.status(500).json({ error: 'Failed to update role permissions' });
  }
};

export const deleteRole = async (req: NextApiRequest, res: NextApiResponse) => {
  const { roleID } = req.body;
  if (!roleID) {
    return res.status(400).json({ error: 'roleID is required' });
  }
  try {
    const userCount: any = await sequelize.query(
      `SELECT COUNT(*) AS cnt FROM admin_users_roles WHERE roleID = :roleID`,
      { replacements: { roleID }, raw: true }
    );
    if (userCount[0]?.[0]?.cnt > 0) {
      return res.status(409).json({ error: 'Cannot delete: role is assigned to users' });
    }
    await sequelize.transaction(async (t) => {
      await models.AdminRolePermission.destroy({ where: { roleID }, transaction: t });
      await models.AdminRole.destroy({ where: { roleID }, transaction: t });
    });
    res.json({ success: true });
  } catch (e) {
    console.error('[PERMISSIONS] deleteRole error:', e);
    res.status(500).json({ error: 'Failed to delete role' });
  }
};

// --- Permission Resources ---

export const listPermissionResources = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const resources: any = await sequelize.query(
      `SELECT apr.id, apr.permissionID, ap.permissionKey, apr.resourceType,
              apr.resourceKey, apr.displayOrder, apr.icon, apr.label, apr.route
       FROM admin_permission_resources apr
       INNER JOIN admin_permissions ap ON apr.permissionID = ap.permissionID
       ORDER BY apr.displayOrder`,
      { raw: true }
    );
    res.json(resources[0] || []);
  } catch (e) {
    console.error('[PERMISSIONS] listResources error:', e);
    res.status(500).json({ error: 'Failed to fetch permission resources' });
  }
};

export const createOrUpdateResource = async (req: NextApiRequest, res: NextApiResponse) => {
  const { id, permissionID, resourceType, resourceKey, displayOrder, icon, label, route } = req.body;
  if (!permissionID || !resourceType || !resourceKey || !label) {
    return res.status(400).json({ error: 'permissionID, resourceType, resourceKey, and label are required' });
  }
  try {
    if (id) {
      await models.AdminPermissionResource.update(
        { permissionID, resourceType, resourceKey, displayOrder: displayOrder || 0, icon, label, route },
        { where: { id } }
      );
      res.json({ success: true });
    } else {
      const resource = await models.AdminPermissionResource.create({
        permissionID, resourceType, resourceKey, displayOrder: displayOrder || 0, icon, label, route
      });
      res.status(201).json(resource);
    }
  } catch (e) {
    console.error('[PERMISSIONS] createOrUpdateResource error:', e);
    res.status(500).json({ error: 'Failed to save permission resource' });
  }
};

export const deleteResource = async (req: NextApiRequest, res: NextApiResponse) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }
  try {
    await models.AdminPermissionResource.destroy({ where: { id } });
    res.json({ success: true });
  } catch (e) {
    console.error('[PERMISSIONS] deleteResource error:', e);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
};
```

- [ ] **Step 2: Create the permissions API route**

```typescript
// src/pages/api/db/admin/permissions.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { reciterConfig } from "../../../../../config/local";
import {
  listAllPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  listPermissionResources,
  createOrUpdateResource,
  deleteResource,
} from "../../../../../controllers/db/permissions/permissions.controller";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== reciterConfig.backendApiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { action } = req.body;

  switch (action) {
    case 'list': return listAllPermissions(req, res);
    case 'create': return createPermission(req, res);
    case 'update': return updatePermission(req, res);
    case 'delete': return deletePermission(req, res);
    case 'listResources': return listPermissionResources(req, res);
    case 'createOrUpdateResource': return createOrUpdateResource(req, res);
    case 'deleteResource': return deleteResource(req, res);
    default: return res.status(400).json({ error: 'Unknown action' });
  }
}
```

- [ ] **Step 3: Create the roles API route**

```typescript
// src/pages/api/db/admin/roles/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { reciterConfig } from "../../../../../../config/local";
import {
  listRolesWithPermissions,
  deleteRole,
} from "../../../../../../controllers/db/permissions/permissions.controller";
import { listAllAdminRoles } from "../../../../../../controllers/db/manage-users/user.controller";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== reciterConfig.backendApiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { action } = req.body;

  switch (action) {
    case 'listWithPermissions': return listRolesWithPermissions(req, res);
    case 'list': return listAllAdminRoles(req, res);
    case 'delete': return deleteRole(req, res);
    default: return res.status(400).json({ error: 'Unknown action' });
  }
}
```

- [ ] **Step 4: Create the role-permissions API route**

```typescript
// src/pages/api/db/admin/roles/permissions.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { reciterConfig } from "../../../../../../config/local";
import { updateRolePermissions } from "../../../../../../controllers/db/permissions/permissions.controller";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== reciterConfig.backendApiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return updateRolePermissions(req, res);
}
```

- [ ] **Step 5: Commit**

```bash
git add controllers/db/permissions/permissions.controller.ts src/pages/api/db/admin/permissions.ts src/pages/api/db/admin/roles/index.ts src/pages/api/db/admin/roles/permissions.ts
git commit -m "feat(rbac): admin API routes for permissions and role-permission CRUD"
```

---

## Task 9: Admin UI — Roles Tab

**Files:**
- Create: `src/components/elements/Manage/RolesTab.tsx`
- Modify: `src/pages/manageusers/index.tsx` (add tab navigation)

This task creates the Roles management tab. The specific UI implementation will follow the existing patterns in ManageUsers (MUI table, modals) and should be built based on the API endpoints created in Task 8. The component needs:

- [ ] **Step 1: Create RolesTab component**

Build `src/components/elements/Manage/RolesTab.tsx` that:
- Fetches roles via `POST /api/db/admin/roles` with `action: 'listWithPermissions'`
- Renders a table: Role Name | Permissions (chips) | Users Count | Actions (Edit, Delete)
- Edit modal: role name input + permission checklist grouped by category
- Fetches all permissions via `POST /api/db/admin/permissions` with `action: 'list'`
- Save calls `POST /api/db/admin/roles/permissions` with `{ roleID, permissionIDs }`
- Delete blocked if userCount > 0 (show warning)

The exact React implementation should follow existing patterns in `UsersTable.tsx` and `AddUser.tsx` (axios calls with auth header, MUI components, modal patterns).

- [ ] **Step 2: Add tab navigation to manageusers page**

In `src/pages/manageusers/index.tsx`, wrap the existing ManageUsers content in a tab container. Add three tabs: "Users" (existing content), "Roles" (RolesTab), "Permissions" (placeholder for Task 10).

- [ ] **Step 3: Verify the Roles tab renders and CRUD works**

Start dev server, navigate to `/manageusers`, click "Roles" tab, verify roles list with permissions, edit a role's permissions, verify save works.

- [ ] **Step 4: Commit**

```bash
git add src/components/elements/Manage/RolesTab.tsx src/pages/manageusers/index.tsx
git commit -m "feat(rbac): Roles tab in Manage Users with permission assignment"
```

---

## Task 10: Admin UI — Permissions Tab

**Files:**
- Create: `src/components/elements/Manage/PermissionsTab.tsx`
- Modify: `src/pages/manageusers/index.tsx` (replace placeholder tab)

- [ ] **Step 1: Create PermissionsTab component**

Build `src/components/elements/Manage/PermissionsTab.tsx` that:
- Fetches permissions via `POST /api/db/admin/permissions` with `action: 'list'`
- Renders a table grouped by category: Permission Key | Label | Description | Roles Using | Actions
- Add permission form: permissionKey (slug input), label, description, category dropdown
- Edit: label, description, category (permissionKey is read-only)
- Delete: blocked if roleCount > 0
- Expandable sub-section per permission showing resources
- Resource CRUD: resourceType, resourceKey, label, icon, displayOrder, route
- Fetches resources via `action: 'listResources'`
- Save resources via `action: 'createOrUpdateResource'`

Follow existing patterns from the AdminSettings accordion UI.

- [ ] **Step 2: Wire into manageusers tab navigation**

Replace the placeholder "Permissions" tab content in `src/pages/manageusers/index.tsx` with `<PermissionsTab />`.

- [ ] **Step 3: Verify permissions tab renders and CRUD works**

Start dev server, navigate to `/manageusers`, click "Permissions" tab, create a new permission, verify it appears, expand to manage resources.

- [ ] **Step 4: Commit**

```bash
git add src/components/elements/Manage/PermissionsTab.tsx src/pages/manageusers/index.tsx
git commit -m "feat(rbac): Permissions tab with full CRUD and resource management"
```

---

## Task 11: Cleanup — Remove Deprecated Code

**Files:**
- Modify: `src/utils/constants.js` (remove ROLE_CAPABILITIES, getCapabilities, getLandingPage)
- Modify: `__tests__/capabilities.test.ts` (delete file)
- Modify: `src/components/elements/Navbar/SideNavbar.tsx` (remove getCapabilities import if still present)

Only proceed with this task after Tasks 1-10 are stable and deployed.

- [ ] **Step 1: Remove deprecated exports from constants.js**

Remove:
- `ROLE_CAPABILITIES` object (lines 83-133)
- `getCapabilities()` function (lines 148-183)
- `getLandingPage()` function (lines 190-201)
- The deprecation comment added in Task 5

Keep: `allowedPermissions` (still used for display formatting in AddUser), utility functions.

- [ ] **Step 2: Update all remaining imports**

Search for any remaining `getCapabilities` or `getLandingPage` imports and remove them. The SideNavbar still imports `getCapabilities` for the `isScopedCurator` check — replace with role-based check:

```typescript
// Replace getCapabilities usage in SideNavbar with:
const isScopedCurator = userPermissions.some((r: any) =>
  r.roleLabel === 'Curator_Scoped' || r.roleLabel === 'Curator_Department' || r.roleLabel === 'Curator_Department_Delegate'
) && !userPermissions.some((r: any) =>
  r.roleLabel === 'Superuser' || r.roleLabel === 'Curator_All'
);
```

- [ ] **Step 3: Delete old capability tests**

```bash
rm __tests__/capabilities.test.ts
```

- [ ] **Step 4: Run all tests**

Run: `npx jest --no-cache`
Expected: All permission tests pass. No remaining references to `getCapabilities`.

- [ ] **Step 5: Search for any remaining references**

Run: `grep -r "getCapabilities\|ROLE_CAPABILITIES\|getLandingPage" src/ controllers/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"`

Expected: No matches (or only comments).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(rbac): remove deprecated ROLE_CAPABILITIES, getCapabilities, getLandingPage"
```

---

## Verification Checklist

After all tasks complete, verify end-to-end:

- [ ] Superuser can access all pages, sees all nav items
- [ ] Curator_All can access /curate and /search, cannot access /manageusers or /configuration
- [ ] Curator_Self lands on /curate/:ownId, cannot navigate to other curate pages
- [ ] Reporter_All can access /report and /search, cannot access /curate
- [ ] Curator_Scoped can access /curate and /search, scope enforcement works at API level
- [ ] Proxy holders can access curate pages for their proxy targets
- [ ] Manage Users → Roles tab: can view/edit role permissions
- [ ] Manage Users → Permissions tab: can create/edit/delete permissions and resources
- [ ] Nav menu items match the permission_resources data from the database
- [ ] Login works via both SAML and direct login paths
- [ ] Existing capability tests replaced with permission tests
