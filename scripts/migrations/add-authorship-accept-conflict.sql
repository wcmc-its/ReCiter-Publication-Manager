-- ============================================================================
-- Migration: Add accept_conflict to authorship_review
-- Purpose: durably park an authorship whose Accept came back 409 from ReCiter's
--   ExternalArticleDupCheck, so it leaves the open queue for the "Possible
--   duplicates" view instead of returning to the feed to be re-attempted.
--
-- Why a new column rather than reusing dup_flag/dup_reason: those are the AAR
--   producer's exact-DOI precheck, refreshed on every producer run, and they
--   mean "the producer thinks this may be a duplicate". This column means "an
--   accept actually hit the server's dup check, and here is its verdict" — a
--   fuzzy title+year match, which is the one that can pair distinct works.
--   Reusing dup_reason would let the producer silently clobber that verdict.
--
-- Apply schedule:
--   dev reciterDB:  with the PR
--   prod reciterDB: before the image carrying this PR is rolled to prod
--
-- Idempotency: re-running errors with "Duplicate column name", which is
--   harmless (the column already exists).
-- ============================================================================

ALTER TABLE authorship_review
  ADD COLUMN accept_conflict VARCHAR(500) NULL
  COMMENT 'ExternalArticleDupCheck 409 verdict from a curator/bulk Accept; NULL = never conflicted';

-- The open queue filters on `accept_conflict IS NULL` on every page load.
CREATE INDEX idx_authorship_review_accept_conflict ON authorship_review (accept_conflict(1));
