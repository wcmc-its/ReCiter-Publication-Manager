-- ============================================================================
-- Migration: Add Curator_Scoped role
-- Phase: 8 (Auth Pipeline) of v1.1 Feature Port
-- Completes what add-scope-proxy-columns.sql (Phase 7) started -- that
-- migration added scope_person_types/scope_org_units/proxy_person_ids to
-- admin_users but nothing ever added a role that uses them or wired the
-- columns into the session (see PM#849).
--
-- admin_roles has no unique constraint on roleLabel (only roleID is a PK),
-- so this uses a NOT EXISTS guard rather than ON DUPLICATE KEY / INSERT
-- IGNORE for idempotency.
--
-- Apply schedule:
--   dev reciterDB: now
--   prod reciterDB: after the Curator_Scoped UI + server-side enforcement
--     (PM#849) are verified on dev
-- ============================================================================

INSERT INTO admin_roles (roleLabel, createTimestamp, modifyTimestamp)
SELECT 'Curator_Scoped', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM admin_roles WHERE roleLabel = 'Curator_Scoped'
);

-- Verification (run manually after applying):
-- SELECT * FROM admin_roles WHERE roleLabel = 'Curator_Scoped';
-- Expected: exactly one row
