-- ============================================================================
-- Phase 8 Auth Pipeline Test Users
-- Run against dev reciterDB to create test users for manual verification
-- Each user has a unique personIdentifier starting with test_p8_ for easy cleanup
--
-- Covers all role+scope+proxy combinations needed for E2E verification:
--   1. Superuser (full access)
--   2. Curator_All (curate all, search)
--   3. Curator_Self only (curate own page only)
--   4. Reporter_All only (search, report)
--   5. Curator_Self + Reporter_All (dual role)
--   6. Curator_Scoped with scope data (person types + org units)
--   7. Curator_Scoped with proxy data
--   8. Inactive user (status=0)
--   9. User with no roles (should get /error)
--
-- Role IDs reference:
--   1 = Superuser
--   2 = Curator_All
--   3 = Reporter_All
--   4 = Curator_Self
--   5 = Curator_Scoped
-- ============================================================================

-- Cleanup existing test users (idempotent)
DELETE FROM admin_users_roles WHERE userID IN (SELECT userID FROM admin_users WHERE personIdentifier LIKE 'test_p8_%');
DELETE FROM admin_users WHERE personIdentifier LIKE 'test_p8_%';

-- ============================================================================
-- Test User 1: Superuser (no scope, no proxy)
-- Expected: can access all routes, landing page = /search
-- ============================================================================
INSERT INTO admin_users (personIdentifier, email, nameFirst, nameLast, status, createTimestamp, modifyTimestamp)
VALUES ('test_p8_super', 'test_p8_super@test.local', 'Test', 'Superuser', 1, NOW(), NOW());
SET @uid1 = LAST_INSERT_ID();
INSERT INTO admin_users_roles (userID, roleID, createTimestamp) VALUES (@uid1, 1, NOW());

-- ============================================================================
-- Test User 2: Curator_All (no scope, no proxy)
-- Expected: can access /curate/*, /search; landing page = /search
-- ============================================================================
INSERT INTO admin_users (personIdentifier, email, nameFirst, nameLast, status, createTimestamp, modifyTimestamp)
VALUES ('test_p8_curall', 'test_p8_curall@test.local', 'Test', 'CuratorAll', 1, NOW(), NOW());
SET @uid2 = LAST_INSERT_ID();
INSERT INTO admin_users_roles (userID, roleID, createTimestamp) VALUES (@uid2, 2, NOW());

-- ============================================================================
-- Test User 3: Curator_Self only
-- Expected: can only access /curate/test_p8_curself; landing page = /curate/test_p8_curself
-- ============================================================================
INSERT INTO admin_users (personIdentifier, email, nameFirst, nameLast, status, createTimestamp, modifyTimestamp)
VALUES ('test_p8_curself', 'test_p8_curself@test.local', 'Test', 'CuratorSelf', 1, NOW(), NOW());
SET @uid3 = LAST_INSERT_ID();
INSERT INTO admin_users_roles (userID, roleID, createTimestamp) VALUES (@uid3, 4, NOW());

-- ============================================================================
-- Test User 4: Reporter_All only
-- Expected: can access /search, /report; landing page = /search
-- ============================================================================
INSERT INTO admin_users (personIdentifier, email, nameFirst, nameLast, status, createTimestamp, modifyTimestamp)
VALUES ('test_p8_reporter', 'test_p8_reporter@test.local', 'Test', 'Reporter', 1, NOW(), NOW());
SET @uid4 = LAST_INSERT_ID();
INSERT INTO admin_users_roles (userID, roleID, createTimestamp) VALUES (@uid4, 3, NOW());

-- ============================================================================
-- Test User 5: Curator_Self + Reporter_All (dual role)
-- Expected: can access /curate/test_p8_self_report, /search, /report
-- Landing page = /curate/test_p8_self_report (Curator_Self takes priority)
-- ============================================================================
INSERT INTO admin_users (personIdentifier, email, nameFirst, nameLast, status, createTimestamp, modifyTimestamp)
VALUES ('test_p8_self_report', 'test_p8_self_report@test.local', 'Test', 'SelfReporter', 1, NOW(), NOW());
SET @uid5 = LAST_INSERT_ID();
INSERT INTO admin_users_roles (userID, roleID, createTimestamp) VALUES (@uid5, 4, NOW());
INSERT INTO admin_users_roles (userID, roleID, createTimestamp) VALUES (@uid5, 3, NOW());

-- ============================================================================
-- Test User 6: Curator_Scoped with scope data (person types + org units)
-- Expected: can access /curate/*, /search; landing page = /search
-- Scope enforcement deferred to API layer (Phase 10)
-- ============================================================================
INSERT INTO admin_users (personIdentifier, email, nameFirst, nameLast, status, createTimestamp, modifyTimestamp,
  scope_person_types, scope_org_units)
VALUES ('test_p8_scoped', 'test_p8_scoped@test.local', 'Test', 'ScopedCurator', 1, NOW(), NOW(),
  '["academic-faculty", "academic-counselor"]', '["Anesthesiology"]');
SET @uid6 = LAST_INSERT_ID();
INSERT INTO admin_users_roles (userID, roleID, createTimestamp) VALUES (@uid6, 5, NOW());

-- ============================================================================
-- Test User 7: Curator_Scoped with proxy data
-- Expected: can access /curate/*, /search; landing page = /search
-- Proxy person IDs reference test users 3 and 4
-- ============================================================================
INSERT INTO admin_users (personIdentifier, email, nameFirst, nameLast, status, createTimestamp, modifyTimestamp,
  scope_person_types, proxy_person_ids)
VALUES ('test_p8_scoped_proxy', 'test_p8_scoped_proxy@test.local', 'Test', 'ScopedProxy', 1, NOW(), NOW(),
  '["academic-faculty"]', '["test_p8_curself", "test_p8_reporter"]');
SET @uid7 = LAST_INSERT_ID();
INSERT INTO admin_users_roles (userID, roleID, createTimestamp) VALUES (@uid7, 5, NOW());

-- ============================================================================
-- Test User 8: Inactive user (status=0)
-- Expected: redirected to /noaccess regardless of roles
-- ============================================================================
INSERT INTO admin_users (personIdentifier, email, nameFirst, nameLast, status, createTimestamp, modifyTimestamp)
VALUES ('test_p8_inactive', 'test_p8_inactive@test.local', 'Test', 'Inactive', 0, NOW(), NOW());
SET @uid8 = LAST_INSERT_ID();
INSERT INTO admin_users_roles (userID, roleID, createTimestamp) VALUES (@uid8, 3, NOW());

-- ============================================================================
-- Test User 9: User with no roles (should get /error)
-- Expected: middleware redirects to /error (no roles in JWT)
-- ============================================================================
INSERT INTO admin_users (personIdentifier, email, nameFirst, nameLast, status, createTimestamp, modifyTimestamp)
VALUES ('test_p8_noroles', 'test_p8_noroles@test.local', 'Test', 'NoRoles', 1, NOW(), NOW());

-- ============================================================================
-- Verification query: confirm all test users and their roles
-- ============================================================================
SELECT au.personIdentifier, au.email, au.status, ar.roleLabel,
       au.scope_person_types, au.scope_org_units, au.proxy_person_ids
FROM admin_users au
LEFT JOIN admin_users_roles aur ON au.userID = aur.userID
LEFT JOIN admin_roles ar ON aur.roleID = ar.roleID
WHERE au.personIdentifier LIKE 'test_p8_%'
ORDER BY au.personIdentifier;

-- ============================================================================
-- CLEANUP (run after verification is complete):
-- DELETE FROM admin_users_roles WHERE userID IN (SELECT userID FROM admin_users WHERE personIdentifier LIKE 'test_p8_%');
-- DELETE FROM admin_users WHERE personIdentifier LIKE 'test_p8_%';
-- ============================================================================
