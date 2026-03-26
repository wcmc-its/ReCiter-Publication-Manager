-- Phase 13 Plan 01: Verify corrected SP output on dev database
-- Run AFTER deploy-dev.sql completes successfully

USE reciterDB;

-- ============================================================
-- VERIFICATION 1: Tony Rosen (aer2006) - Primary test case (VFY-02)
-- ============================================================
-- Expected: denominators are peer counts (dozens to hundreds, not single digits)
-- Expected: ranks are ordinal positions (1, 2, 3... up to denominator)
-- Expected: percentiles are 0-100 with 3 decimal places
SELECT '=== VFY-02: Tony Rosen (aer2006) ===' AS verification;
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
-- VERIFICATION 2: Spot-check across faculty ranks (VFY-03)
-- ============================================================
-- Pick one faculty member per rank to verify correct data
SELECT '=== VFY-03: Sample faculty per rank ===' AS verification;

-- 2a: Find one person at each faculty rank for spot-checking
SELECT facultyRank, COUNT(*) as count,
  MIN(personIdentifier) as sample_person
FROM analysis_summary_person
WHERE facultyRank IS NOT NULL AND facultyRank != ''
GROUP BY facultyRank
ORDER BY count DESC;

-- 2b: Full Professor sample
SELECT '--- Full Professor sample ---' AS rank_check;
SELECT personIdentifier, facultyRank,
  countAll, top5PercentileAll, top5DenominatorAll, top5RankAll,
  top10PercentileAll, top10DenominatorAll, top10RankAll
FROM analysis_summary_person
WHERE facultyRank = 'Full Professor'
ORDER BY top5RankAll ASC
LIMIT 3;

-- 2c: Associate Professor sample
SELECT '--- Associate Professor sample ---' AS rank_check;
SELECT personIdentifier, facultyRank,
  countAll, top5PercentileAll, top5DenominatorAll, top5RankAll,
  top10PercentileAll, top10DenominatorAll, top10RankAll
FROM analysis_summary_person
WHERE facultyRank = 'Associate Professor'
ORDER BY top5RankAll ASC
LIMIT 3;

-- 2d: Assistant Professor sample
SELECT '--- Assistant Professor sample ---' AS rank_check;
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
SELECT '=== Data Integrity Checks ===' AS verification;

-- 3a: No ranks should exceed denominator
SELECT 'Ranks exceeding denominator (should be 0):' AS integrity_check;
SELECT COUNT(*) AS violations
FROM analysis_summary_person
WHERE (top5RankAll > top5DenominatorAll AND top5DenominatorAll > 0)
   OR (top10RankAll > top10DenominatorAll AND top10DenominatorAll > 0)
   OR (top5RankFirst > top5DenominatorFirst AND top5DenominatorFirst > 0)
   OR (top10RankFirst > top10DenominatorFirst AND top10DenominatorFirst > 0);

-- 3b: Percentiles should be in 0-100 range
SELECT 'Percentiles outside 0-100 (should be 0):' AS integrity_check;
SELECT COUNT(*) AS violations
FROM analysis_summary_person
WHERE top5PercentileAll > 100 OR top5PercentileAll < 0
   OR top10PercentileAll > 100 OR top10PercentileAll < 0
   OR top5PercentileFirst > 100 OR top5PercentileFirst < 0
   OR top10PercentileFirst > 100 OR top10PercentileFirst < 0;

-- 3c: Denominators should be consistent within same rank
SELECT 'Denominator consistency per rank (all persons at same rank should have same denominator for All metrics):' AS integrity_check;
SELECT facultyRank,
  MIN(top5DenominatorAll) as min_denom,
  MAX(top5DenominatorAll) as max_denom,
  COUNT(*) as persons
FROM analysis_summary_person
WHERE facultyRank IS NOT NULL AND facultyRank != '' AND top5DenominatorAll > 0
GROUP BY facultyRank;
