-- =============================================================================
-- Migration: Add Permission Tables for Data-Driven RBAC
-- =============================================================================
--
-- This script creates three new tables for the data-driven RBAC system:
--   1. admin_permissions        - Permission definitions (7 permissions)
--   2. admin_role_permissions   - Role-to-permission mappings (18 rows)
--   3. admin_permission_resources - UI resources tied to permissions (7 nav items)
--
-- DEPLOYMENT TARGETS:
--   - Production reciterDB (reciter-pm-prod)
--   - Development reciterDB (reciter-pm-dev)
--   - ReCiterDB repo schema definition
--
-- This script is IDEMPOTENT: safe to run multiple times without errors.
-- All CREATE TABLE statements use IF NOT EXISTS.
-- All INSERT statements use ON DUPLICATE KEY UPDATE or INSERT IGNORE.
--
-- Prerequisites: admin_roles table must exist with roleLabel values for
-- Superuser, Curator_All, Curator_Self, Curator_Scoped, Curator_Department,
-- Curator_Department_Delegate, Reporter_All.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table 1: admin_permissions
-- Stores permission definitions with unique permissionKey identifiers.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_permissions` (
  `permissionID` INT NOT NULL AUTO_INCREMENT,
  `permissionKey` VARCHAR(128) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(64) NOT NULL,
  `createTimestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifyTimestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`permissionID`),
  UNIQUE KEY `uq_permission_key` (`permissionKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Table 2: admin_role_permissions
-- Junction table mapping roles to permissions (many-to-many).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_role_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `roleID` INT NOT NULL,
  `permissionID` INT NOT NULL,
  `createTimestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_permission` (`roleID`, `permissionID`),
  KEY `fk_arp_role` (`roleID`),
  KEY `fk_arp_permission` (`permissionID`),
  CONSTRAINT `fk_arp_role` FOREIGN KEY (`roleID`) REFERENCES `admin_roles` (`roleID`) ON DELETE CASCADE,
  CONSTRAINT `fk_arp_permission` FOREIGN KEY (`permissionID`) REFERENCES `admin_permissions` (`permissionID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Table 3: admin_permission_resources
-- UI resources (nav items, tabs, features) tied to permissions.
-- ---------------------------------------------------------------------------
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
  UNIQUE KEY `uq_permission_resource` (`permissionID`, `resourceKey`),
  KEY `fk_apr_permission` (`permissionID`),
  CONSTRAINT `fk_apr_permission` FOREIGN KEY (`permissionID`) REFERENCES `admin_permissions` (`permissionID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- Seed Data
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Seed: admin_permissions (7 rows)
-- Uses ON DUPLICATE KEY UPDATE keyed on permissionKey UNIQUE constraint.
-- ---------------------------------------------------------------------------
INSERT INTO `admin_permissions` (`permissionKey`, `label`, `description`, `category`) VALUES
  ('canCurate', 'Curate Publications', 'Accept or reject article suggestions for people', 'Curation'),
  ('canSearch', 'Search Identities', 'Search and browse the identity directory', 'Navigation'),
  ('canReport', 'Create Reports', 'Generate publication reports and export data', 'Reporting'),
  ('canManageUsers', 'Manage Users', 'Create, edit, and deactivate user accounts and assign roles', 'Administration'),
  ('canConfigure', 'Configuration', 'Edit application settings, labels, and field visibility', 'Administration'),
  ('canManageNotifications', 'Manage Notifications', 'Configure notification preferences', 'Communication'),
  ('canManageProfile', 'Manage Profile', 'View and edit user profile information', 'Profile')
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  category = VALUES(category);

-- ---------------------------------------------------------------------------
-- Seed: admin_role_permissions (18 rows)
-- Uses subqueries to resolve roleID and permissionID dynamically.
-- Never hardcodes IDs -- they differ between environments.
-- Uses INSERT IGNORE since UNIQUE(roleID, permissionID) handles duplicates.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `admin_role_permissions` (`roleID`, `permissionID`)
SELECT r.roleID, p.permissionID
FROM `admin_roles` r, `admin_permissions` p
WHERE (r.roleLabel, p.permissionKey) IN (
  ('Superuser', 'canCurate'),
  ('Superuser', 'canSearch'),
  ('Superuser', 'canReport'),
  ('Superuser', 'canManageUsers'),
  ('Superuser', 'canConfigure'),
  ('Superuser', 'canManageNotifications'),
  ('Superuser', 'canManageProfile'),
  ('Curator_All', 'canCurate'),
  ('Curator_All', 'canSearch'),
  ('Curator_Self', 'canCurate'),
  ('Curator_Scoped', 'canCurate'),
  ('Curator_Scoped', 'canSearch'),
  ('Curator_Department', 'canCurate'),
  ('Curator_Department', 'canSearch'),
  ('Curator_Department_Delegate', 'canCurate'),
  ('Curator_Department_Delegate', 'canSearch'),
  ('Reporter_All', 'canReport'),
  ('Reporter_All', 'canSearch')
);

-- ---------------------------------------------------------------------------
-- Seed: admin_permission_resources (7 nav rows)
-- Uses subquery to resolve permissionID via permissionKey.
-- Uses ON DUPLICATE KEY UPDATE keyed on (permissionID, resourceKey) UNIQUE constraint.
-- ---------------------------------------------------------------------------
INSERT INTO `admin_permission_resources` (`permissionID`, `resourceType`, `resourceKey`, `displayOrder`, `icon`, `label`, `route`)
SELECT p.permissionID, v.resourceType, v.resourceKey, v.displayOrder, v.icon, v.label, v.route
FROM `admin_permissions` p
JOIN (
  SELECT 'canSearch' AS pk, 'nav' AS resourceType, 'nav_search' AS resourceKey, 1 AS displayOrder, 'Search' AS icon, 'Find People' AS label, '/search' AS route
  UNION ALL SELECT 'canCurate', 'nav', 'nav_curate', 2, 'LocalLibrary', 'Curate Publications', '/curate'
  UNION ALL SELECT 'canReport', 'nav', 'nav_report', 3, 'Assessment', 'Create Reports', '/report'
  UNION ALL SELECT 'canManageNotifications', 'nav', 'nav_notifications', 4, 'NotificationsActive', 'Manage Notifications', '/notifications'
  UNION ALL SELECT 'canManageProfile', 'nav', 'nav_profile', 5, 'AccountCircle', 'Manage Profile', '/manageprofile'
  UNION ALL SELECT 'canManageUsers', 'nav', 'nav_users', 6, 'Group', 'Manage Users', '/manageusers'
  UNION ALL SELECT 'canConfigure', 'nav', 'nav_config', 7, 'Settings', 'Configuration', '/configuration'
) v ON p.permissionKey = v.pk
ON DUPLICATE KEY UPDATE
  resourceType = VALUES(resourceType),
  displayOrder = VALUES(displayOrder),
  icon = VALUES(icon),
  label = VALUES(label),
  route = VALUES(route);
