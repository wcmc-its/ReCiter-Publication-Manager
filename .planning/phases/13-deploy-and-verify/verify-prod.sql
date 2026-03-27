-- Phase 13 Plan 02: Verify corrected SP output on PRODUCTION database
-- Run AFTER deploy-prod.sql completes successfully

USE reciterDB;

-- ============================================================
-- VERIFICATION 1: Tony Rosen (aer2006) - Primary test case
-- ============================================================
SELECT '=== PROD VFY: Tony Rosen (aer2006) ===' AS verification;
SELECT personIdentifier, facultyRank,
  countAll, countFirst, countSenior,
  top5PercentileAll, top5DenominatorAll, top5RankAll,
  top10PercentileAll, top10DenominatorAll, top10RankAll,
  top5PercentileFirst, top5DenominatorFirst, top5RankFirst,
  top10PercentileFirst, top10DenominatorFirst, top10RankFirst,
  top5PercentileSenior, top5DenominatorSenior, top5RankSenior,
  top10PercentileSenior, top10DenominatorSenior, top10RankSenior,
  top5PercentileFirstSenior, top5DenominatorFirstSenior, top5RankFirstSenior,
  top10PercentileFirstSenior, top10DenominatorFirstSenior, top10RankFirstSenior
FROM analysis_summary_person
WHERE personIdentifier = 'aer2006';

-- ============================================================
-- VERIFICATION 2: Cross-rank spot-check (VFY-03 production)
-- ============================================================
SELECT '=== PROD VFY: Faculty rank distribution ===' AS verification;
SELECT facultyRank, COUNT(*) as count,
  MIN(personIdentifier) as sample_person
FROM analysis_summary_person
WHERE facultyRank IS NOT NULL AND facultyRank != ''
GROUP BY facultyRank
ORDER BY count DESC;

SELECT '--- PROD: Full Professor sample ---' AS rank_check;
SELECT personIdentifier, facultyRank,
  countAll, top5PercentileAll, top5DenominatorAll, top5RankAll,
  top10PercentileAll, top10DenominatorAll, top10RankAll
FROM analysis_summary_person
WHERE facultyRank = 'Full Professor'
ORDER BY top5RankAll ASC
LIMIT 3;

SELECT '--- PROD: Associate Professor sample ---' AS rank_check;
SELECT personIdentifier, facultyRank,
  countAll, top5PercentileAll, top5DenominatorAll, top5RankAll,
  top10PercentileAll, top10DenominatorAll, top10RankAll
FROM analysis_summary_person
WHERE facultyRank = 'Associate Professor'
ORDER BY top5RankAll ASC
LIMIT 3;

SELECT '--- PROD: Assistant Professor sample ---' AS rank_check;
SELECT personIdentifier, facultyRank,
  countAll, top5PercentileAll, top5DenominatorAll, top5RankAll,
  top10PercentileAll, top10DenominatorAll, top10RankAll
FROM analysis_summary_person
WHERE facultyRank = 'Assistant Professor'
ORDER BY top5RankAll ASC
LIMIT 3;

-- ============================================================
-- VERIFICATION 3: Data integrity checks
-- ============================================================
SELECT '=== PROD: Data Integrity Checks ===' AS verification;

SELECT 'Ranks exceeding denominator (should be 0):' AS integrity_check;
SELECT COUNT(*) AS violations
FROM analysis_summary_person
WHERE (top5RankAll > top5DenominatorAll AND top5DenominatorAll > 0)
   OR (top10RankAll > top10DenominatorAll AND top10DenominatorAll > 0)
   OR (top5RankFirst > top5DenominatorFirst AND top5DenominatorFirst > 0)
   OR (top10RankFirst > top10DenominatorFirst AND top10DenominatorFirst > 0);

SELECT 'Percentiles outside 0-100 (should be 0):' AS integrity_check;
SELECT COUNT(*) AS violations
FROM analysis_summary_person
WHERE top5PercentileAll > 100 OR top5PercentileAll < 0
   OR top10PercentileAll > 100 OR top10PercentileAll < 0
   OR top5PercentileFirst > 100 OR top5PercentileFirst < 0
   OR top10PercentileFirst > 100 OR top10PercentileFirst < 0;

SELECT 'Denominator consistency per rank:' AS integrity_check;
SELECT facultyRank,
  MIN(top5DenominatorAll) as min_denom,
  MAX(top5DenominatorAll) as max_denom,
  COUNT(*) as persons
FROM analysis_summary_person
WHERE facultyRank IS NOT NULL AND facultyRank != '' AND top5DenominatorAll > 0
GROUP BY facultyRank;

-- ============================================================
-- VERIFICATION 4: Compare with dev (optional, if dev values known)
-- ============================================================
-- Dev deployment (Plan 01) confirmed:
--   aer2006: facultyRank=Associate Professor, countAll=93,
--            top5DenominatorAll=422, top5RankAll=165, top5PercentileAll=94.520
--   Denominator consistency: Full Professor=380, Associate Professor=422,
--            Assistant Professor=763, Instructor/Lecturer=96
-- Production denominators may differ if data volumes differ,
-- but the pattern should be similar (hundreds, not single digits).
SELECT '=== PROD: Total faculty per rank ===' AS comparison;
SELECT facultyRank, COUNT(*) as total_faculty
FROM analysis_summary_person
WHERE facultyRank IS NOT NULL AND facultyRank != ''
GROUP BY facultyRank
ORDER BY total_faculty DESC;
