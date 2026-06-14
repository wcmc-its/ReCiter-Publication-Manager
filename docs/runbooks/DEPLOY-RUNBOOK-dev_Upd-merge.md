<!-- Deploy runbook for shipping dev_Upd_NextJS14SNode18 (June arc: authorships redesign + View-as impersonation + data-driven RBAC) to an environment whose reciterDB may not yet have the new schema. Derived from the branch review (../reviews/REVIEW-dev_Upd-june-arc.md). -->

# Deploy Runbook — `dev_Upd_NextJS14SNode18` → reciterDB-backed environment

**Scope:** the database and environment prerequisites that MUST be satisfied before (or atomically with) deploying this branch's code. The branch's middleware and curation write paths depend on schema that is **not** created by any repo migration. Deploying the code first will hard-fail core flows.

**Source:** branch review of the #732 arc. Related: PR #738 (RBAC fail-safe), issues #739 (RBAC seeding), #733 (impersonation column), #734 (enable flag).

---

## 0. Pre-flight summary

| # | Prerequisite | Why | Blast radius if skipped | Tracking |
|---|---|---|---|---|
| 1 | Seed the 3 RBAC permission tables | Middleware gates `/curate` `/manageusers` `/configuration` on a JWT permission set resolved from these tables at login | Privileged users redirected off core routes (PR #738 fallback prevents total lockout, but the data-driven gating is inert) | #739 |
| 2 | Add `impersonatedByUserID` to `admin_feedback_log` | Every curate accept/reject INSERT names this column (Sequelize bulkCreate lists all model attributes) | **All** accept/reject 500 (`Unknown column`), even with impersonation off | #733 |
| 3 | `NEXTAUTH_SECRET` set + stable across pods | Branch derives JWT key from an explicit secret | One-time forced re-login on deploy; instability ⇒ repeated logouts / decode failures | — |
| 4 | `IMPERSONATION_ENABLED` unset/false in prod | Feature ships dark; pre-enable hardening pending (M1/M2) | Audit-attribution inconsistencies; stale overlay across re-auth | #734, #733 |

**Ordering rule:** apply DB changes **1 and 2 first**, verify, then deploy the code. Never deploy code ahead of the schema.

---

## 1. RBAC permission tables  (issue #739)

> ⚠️ There is **no repo migration** for these tables — the canonical DDL/seed lives only in `docs/superpowers/plans/2026-04-14-data-driven-rbac.md`. Capture it as a real migration (`scripts/migrations/add-permission-tables.sql`) and mirror into the ReCiterDB repo (3-places rule).

### 1a. Check current state (per environment: dev, prod)

```sql
-- Do the tables exist and are they seeded?
SELECT COUNT(*) AS permissions     FROM admin_permissions;        -- expect 7
SELECT COUNT(*) AS role_perm_rows  FROM admin_role_permissions;   -- expect > 0
SELECT COUNT(*) AS nav_resources   FROM admin_permission_resources; -- expect 7
```

If the tables are missing or any count is 0, seed them with 1b. (Dev should already be seeded — confirm and capture the exact seed actually used before copying to prod.)

### 1b. DDL + seed (idempotent CREATEs; run seed once per environment)

```sql
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
  CONSTRAINT `fk_rp_role`       FOREIGN KEY (`roleID`)       REFERENCES `admin_roles` (`roleID`)             ON DELETE CASCADE,
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

-- 4. Seed permissions (7)
INSERT INTO `admin_permissions` (`permissionKey`, `label`, `description`, `category`) VALUES
  ('canCurate', 'Curate Publications', 'Accept or reject article suggestions for people', 'Curation'),
  ('canSearch', 'Search Identities', 'Search and browse the identity directory', 'Navigation'),
  ('canReport', 'Create Reports', 'Generate publication reports and export data', 'Reporting'),
  ('canManageUsers', 'Manage Users', 'Create, edit, and deactivate user accounts and assign roles', 'Administration'),
  ('canConfigure', 'Configuration', 'Edit application settings, labels, and field visibility', 'Administration'),
  ('canManageNotifications', 'Manage Notifications', 'Configure notification preferences', 'Communication'),
  ('canManageProfile', 'Manage Profile', 'View and edit user profile information', 'Profile');

-- 5. Seed role → permission mappings
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

-- 6. Seed nav resources
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

> **`/manageprofile` + `/notifications` decision (issue #739):** the seed grants `canManageProfile`/`canManageNotifications` to **Superuser only**, but the sidebar exposes those links to Curator/Department roles. PR #738 ungates both routes in middleware (self-only redirect only) so those roles keep access without a DB change. If you instead want them permission-gated, add the keys to the appropriate roles here and revert that part of #738. **Pick one and keep middleware + seed consistent.**

### 1c. Verify (each environment)

```sql
-- Every role resolves the permissions it should (spot-check a known user per role)
SELECT au.personIdentifier, ar.roleLabel, GROUP_CONCAT(ap.permissionKey ORDER BY ap.permissionKey) AS perms
FROM admin_users au
JOIN admin_users_roles aur     ON au.userID = aur.userID
JOIN admin_roles ar            ON aur.roleID = ar.roleID
LEFT JOIN admin_role_permissions arp ON ar.roleID = arp.roleID
LEFT JOIN admin_permissions ap ON arp.permissionID = ap.permissionID
WHERE au.personIdentifier = 'REPLACE_WITH_TEST_CWID'
GROUP BY au.personIdentifier, ar.roleLabel;
-- Superuser → all 7; Curator_All → canCurate,canSearch; Reporter_All → canReport,canSearch
```

> Even if seeding is delayed, PR #738's `getPermissionsFromRoles` fallback keeps privileged users functional — but the nav/menu (driven by `admin_permission_resources`) and any future permission-only feature will be wrong until seeded. Seed before relying on the data-driven model.

---

## 2. `impersonatedByUserID` column  (issue #733)

Repo migration exists: `scripts/migrations/add-impersonated-by-feedbacklog.sql`. Its header **defers** the prod apply — do **not** defer; apply before/with the code deploy.

### 2a. Check + apply (per environment)

```sql
-- Present?
SELECT COUNT(*) AS has_col FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_feedback_log'
  AND COLUMN_NAME = 'impersonatedByUserID';   -- 0 = missing

-- Apply (idempotent-safe form for MariaDB; plain ADD for MySQL once)
ALTER TABLE admin_feedback_log ADD COLUMN impersonatedByUserID INT DEFAULT NULL;

-- Optional but recommended: real FK (the model documents one; the migration omits it — issue #733 / finding M3)
ALTER TABLE admin_feedback_log
  ADD CONSTRAINT admin_feedback_log_ibfk_2
  FOREIGN KEY (impersonatedByUserID) REFERENCES admin_users (userID);
```

### 2b. Why this is a hard gate
`createFeedbackLog` always puts `impersonatedByUserID` (null when not impersonating) into `bulkCreate`, and Sequelize builds the INSERT column list from **all** model attributes. So **every** accept/reject names the column regardless of `IMPERSONATION_ENABLED`. Missing column ⇒ MySQL 1054 ⇒ 500 on `/api/db/admin/feedbacklog/create` for all users.

### 2c. 3-places mirror
- [ ] dev reciterDB (already applied per #733)
- [ ] prod reciterDB
- [ ] ReCiterDB repo: add the column (and FK) to `setup/createDatabaseTableReciterDb.sql` on both relevant branches (`grep -rni impersonat` over ReCiterDB currently returns nothing).

---

## 3. Environment configuration

```bash
# Required, stable, identical across all pods/replicas:
NEXTAUTH_SECRET=<stable-value>     # deploy forces a one-time re-login of active sessions; schedule a low-traffic window
# Impersonation: keep OFF in prod until M1/M2 hardening (issues #734, #733 comments) is done
# IMPERSONATION_ENABLED   -> unset or false
# IMPERSONATION_TTL_SECONDS (optional, default 1800)
```

- [ ] Confirm `NEXTAUTH_SECRET` is set in the prod K8s secret and identical across replicas (a per-pod or rotating value causes intermittent JWT decode failures → random logouts).
- [ ] Communicate the expected one-time forced re-login to users/support.
- [ ] Confirm `IMPERSONATION_ENABLED` is **not** truthy in prod.

---

## 4. Deploy sequence

1. Backup reciterDB (`admin_feedback_log`, `admin_*` role/permission tables).
2. Apply **Step 1** (RBAC tables + seed) and **Step 2** (impersonatedByUserID) to the target reciterDB. Run the Step 1c / 2a verification queries — do not proceed on failure.
3. Confirm **Step 3** env config.
4. Deploy the branch code (CodeBuild → reciter-pm-* per `reference_eks_deployment`).
5. Run **Step 5** post-deploy checks.

---

## 5. Post-deploy verification

**Smoke (as a real user per role):**
- [ ] Superuser reaches `/curate`, `/manageusers`, `/configuration`, `/report`, `/search`.
- [ ] Curator_All reaches `/curate`, `/search`, `/manageprofile`, `/notifications`; is redirected from `/manageusers`, `/configuration`.
- [ ] Curator_Self is confined to `/curate/<self>` and `/manageprofile/<self>`.
- [ ] Accept and reject a suggestion in `/curate` → **succeeds** (proves the `impersonatedByUserID` column exists). Confirm a row in `admin_feedback_log` with `impersonatedByUserID = NULL`.
- [ ] Sidebar shows the correct nav items (driven by `admin_permission_resources`).

**Logs:**
- [ ] No `Unknown column 'impersonatedByUserID'` errors.
- [ ] No unexpected redirect loops or `/error` / `/noaccess` landings for privileged users.

---

## 6. Rollback

- DB changes are **additive and backward-compatible** (nullable column; new tables). The previously-deployed (older-model) app tolerates them, so a code rollback does **not** require a DB rollback.
- Do **not** drop `impersonatedByUserID` or the permission tables on a code rollback — leave them; they are harmless to the old code and needed on re-deploy.

---

## Appendix — finding ↔ artifact map

| Finding | Severity | Addressed by |
|---|---|---|
| C1 middleware lockout on empty permissions | Critical | PR #738 (fallback) + Step 1 (seed) / #739 |
| H1 `/manageprofile`+`/notifications` regression | High | PR #738 (ungate) + Step 1 decision / #739 |
| H2/H3 impersonatedByUserID missing / ordering | High | Step 2 / #733 |
| M3 documented-FK vs plain column | Medium | Step 2a optional FK / #733 |
| M1 authorships attribution mismatch | Medium | pre-enable code fix / #734 |
| M2 stale overlay across re-auth | Medium | pre-enable code fix / #734 |
| NEXTAUTH_SECRET forced re-login | Low | Step 3 (rollout note) |

Full detail: `../reviews/REVIEW-dev_Upd-june-arc.md`.
