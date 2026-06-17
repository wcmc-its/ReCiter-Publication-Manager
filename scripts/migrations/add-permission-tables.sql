-- ============================================================================
-- Migration: Create data-driven RBAC permission tables and seed current behavior
-- Feature: Data-Driven RBAC (Phase 14) — permissions resolved at login into the
--          JWT; middleware gates routes on permission strings; SideNavbar renders
--          from admin_permission_resources.
--
-- Creates three tables (admin_permissions, admin_role_permissions,
-- admin_permission_resources) and seeds the 7 current permissions, the role→
-- permission mappings that reproduce today's behavior, and the 7 nav resources.
--
-- Apply schedule:
--   dev reciterDB:  with the data-driven-RBAC code (already applied per #739)
--   prod reciterDB: BEFORE (or atomically with) deploying the dev_Upd code.
--                   Middleware gates /curate, /manageusers, /configuration on a
--                   permission set resolved from these tables. PR #738's
--                   getPermissionsFromRoles() fallback prevents a hard lockout if
--                   they are unseeded, but the data-driven gating + nav menu stay
--                   inert until this runs. See docs/runbooks/DEPLOY-RUNBOOK-dev_Upd-merge.md.
--
-- Idempotency: the CREATE TABLE statements are IF NOT EXISTS (safe to re-run).
--   The INSERT seeds are NOT guarded — run the seed section exactly ONCE per
--   environment, or the UNIQUE keys (uq_permissionKey, uq_role_permission) will
--   reject duplicate permissions / role mappings (admin_permission_resources has
--   no unique key, so re-running its INSERT would duplicate nav rows).
--
-- 3-places rule: this schema is mirrored in the ReCiterDB repo
--   (setup/createDatabaseTableReciterDb.sql). Keep them in sync.
--
-- NOTE on roleLabel matching: the role→permission seed uses INSERT … SELECT joined
--   on admin_roles.roleLabel, so it adapts to whatever roles an environment has.
--   'Curator_Scoped' is included for environments that define it; where it does
--   not exist (e.g. the canonical 6-role seed) that row is a harmless no-op.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. admin_permissions
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2. admin_role_permissions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_role_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `roleID` INT NOT NULL,
  `permissionID` INT NOT NULL,
  `createTimestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_permission` (`roleID`, `permissionID`),
  KEY `idx_roleID` (`roleID`),
  KEY `idx_permissionID` (`permissionID`),
  CONSTRAINT `fk_rp_role`       FOREIGN KEY (`roleID`)       REFERENCES `admin_roles` (`roleID`)             ON DELETE CASCADE,
  CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permissionID`) REFERENCES `admin_permissions` (`permissionID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- 3. admin_permission_resources
-- ----------------------------------------------------------------------------
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

-- ============================================================================
-- SEED  (run exactly once per environment — see idempotency note above)
-- ============================================================================

-- 4. Seed permissions (7)
INSERT INTO `admin_permissions` (`permissionKey`, `label`, `description`, `category`) VALUES
  ('canCurate', 'Curate Publications', 'Accept or reject article suggestions for people', 'Curation'),
  ('canSearch', 'Search Identities', 'Search and browse the identity directory', 'Navigation'),
  ('canReport', 'Create Reports', 'Generate publication reports and export data', 'Reporting'),
  ('canManageUsers', 'Manage Users', 'Create, edit, and deactivate user accounts and assign roles', 'Administration'),
  ('canConfigure', 'Configuration', 'Edit application settings, labels, and field visibility', 'Administration'),
  ('canManageNotifications', 'Manage Notifications', 'Configure notification preferences', 'Communication'),
  ('canManageProfile', 'Manage Profile', 'View and edit user profile information', 'Profile');

-- 5. Seed role → permission mappings (reproduces current behavior)
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID FROM admin_roles ar CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Superuser';                                                   -- all 7
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID FROM admin_roles ar CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Curator_All'                 AND ap.permissionKey IN ('canCurate','canSearch');
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID FROM admin_roles ar CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Curator_Self'                AND ap.permissionKey IN ('canCurate');
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID FROM admin_roles ar CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Curator_Scoped'              AND ap.permissionKey IN ('canCurate','canSearch');
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID FROM admin_roles ar CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Curator_Department'          AND ap.permissionKey IN ('canCurate','canSearch');
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID FROM admin_roles ar CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Curator_Department_Delegate' AND ap.permissionKey IN ('canCurate','canSearch');
INSERT INTO `admin_role_permissions` (`roleID`, `permissionID`)
  SELECT ar.roleID, ap.permissionID FROM admin_roles ar CROSS JOIN admin_permissions ap
  WHERE ar.roleLabel = 'Reporter_All'                AND ap.permissionKey IN ('canReport','canSearch');

-- 6. Seed nav resources (sidebar items, driven by admin_permission_resources)
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

-- ============================================================================
-- Verification (run manually after applying):
--   SELECT COUNT(*) FROM admin_permissions;          -- expect 7
--   SELECT COUNT(*) FROM admin_role_permissions;     -- expect > 0
--   SELECT COUNT(*) FROM admin_permission_resources; -- expect 7
-- ============================================================================
