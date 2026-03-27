-- Phase 13 Plan 02: Deploy corrected SP to PRODUCTION database
-- CAUTION: This targets the PRODUCTION database.
-- Ensure dev deployment (Plan 01) was verified successfully before running this.

-- Step 1: Switch to the correct database
USE reciterDB;

-- Step 2: Load the corrected stored procedure definition
-- This DROP/CREATEs populateAnalysisSummaryTables_v2
SOURCE ~/Dropbox/GitHub/ReCiterDB/setup/populateAnalysisSummaryTables_v2.sql;

-- Step 3: Execute the SP to repopulate analysis_summary_person
-- NOTE: Production may take longer than dev (5-30 minutes).
-- The SP uses an atomic table swap (_new -> production) so there is no downtime.
CALL populateAnalysisSummaryTables_v2();

-- Step 4: Quick sanity check
SELECT personIdentifier, facultyRank,
  top5PercentileAll, top5DenominatorAll, top5RankAll
FROM analysis_summary_person
WHERE personIdentifier = 'aer2006';
