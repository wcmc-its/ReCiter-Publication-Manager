-- ============================================================================
-- Migration: Add scope and proxy JSON columns to admin_users
-- Phase: 7 (Foundation) of v1.1 Feature Port
-- Target: MariaDB (JSON is alias for LONGTEXT with JSON_VALID CHECK constraint)
--
-- Apply schedule:
--   dev reciterDB: Phase 7 (now)
--   prod reciterDB: after Phase 8 (Auth Pipeline) is verified
--
-- Idempotency: Running this script a second time will produce a
--   "Duplicate column name" error, which is harmless (columns already exist).
-- ============================================================================

ALTER TABLE admin_users
  ADD COLUMN scope_person_types JSON DEFAULT NULL,
  ADD COLUMN scope_org_units JSON DEFAULT NULL,
  ADD COLUMN proxy_person_ids JSON DEFAULT NULL;

-- Verification (run manually after applying):
-- DESCRIBE admin_users;
-- Expected: three new columns of type longtext (MariaDB JSON alias)
--
-- SELECT VERSION();
-- Expected: MariaDB 10.2.7+ (JSON type support required)
