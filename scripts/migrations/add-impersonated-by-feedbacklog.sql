-- ============================================================================
-- Migration: Add impersonatedByUserID column to admin_feedback_log
-- Feature: "View as" (impersonation) — honest "logged to you" attribution
--
-- Records the REAL superuser on every curation feedback-log write while the
-- existing userID column stays the EFFECTIVE target (the person being acted as).
-- Nullable FK to admin_users.userID; NULL for all non-impersonated writes.
--
-- Apply schedule:
--   dev reciterDB: with the impersonation feature branch (flag still off)
--   prod reciterDB: after the impersonation feature is verified on dev
--
-- Idempotency: Running this script a second time will produce a
--   "Duplicate column name" error, which is harmless (column already exists).
-- ============================================================================

ALTER TABLE admin_feedback_log
  ADD COLUMN impersonatedByUserID INT DEFAULT NULL;  -- nullable FK -> admin_users.userID

-- Verification (run manually after applying):
-- DESCRIBE admin_feedback_log;
-- Expected: new column impersonatedByUserID of type int, nullable, default NULL
