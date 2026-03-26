-- Phase 13 Plan 01: Deploy corrected SP to dev database
-- Run this in MySQL client connected to the DEV database

-- Step 1: Switch to the correct database
USE reciterDB;

-- Step 2: Load the corrected stored procedure definition
-- This DROP/CREATEs populateAnalysisSummaryTables_v2
SOURCE ~/Dropbox/GitHub/ReCiterDB/setup/populateAnalysisSummaryTables_v2.sql;

-- Step 3: Execute the SP to repopulate analysis_summary_person
-- NOTE: This may take 5-30 minutes depending on data volume.
-- The SP uses an atomic table swap (_new -> production) so there is no downtime.
CALL populateAnalysisSummaryTables_v2();

-- Step 4: Quick sanity check
SELECT personIdentifier, facultyRank,
  top5PercentileAll, top5DenominatorAll, top5RankAll
FROM analysis_summary_person
WHERE personIdentifier = 'aer2006';
