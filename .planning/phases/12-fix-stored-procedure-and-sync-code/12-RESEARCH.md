# Phase 12: Fix Stored Procedure and Sync Code - Research

**Researched:** 2026-03-26
**Domain:** MySQL stored procedure logic (percentile/rank/denominator computation in bibliometric ETL)
**Confidence:** HIGH

## Summary

The standalone stored procedure `populateAnalysisSummaryTables_v2.sql` has three fundamental bugs in STEP 5 (percentile rankings) compared to the canonical version in `createEventsProceduresReciterDb.sql`. Additionally, STEP 4 (person population and article counting) has two divergences that must also be fixed. Steps 1-3, 2b, 2c, 6, and 7 are identical between the two files and require no changes.

The bugs are well-understood and narrowly scoped: the standalone computes percentile as a percentage of articles above a threshold (wrong), whereas the canonical computes it as the average percentileNIH of a person's top N best articles (correct). The rank and denominator columns are similarly wrong. The fix involves replacing STEP 4's person-insert and article-count logic, and replacing STEP 5's 8 combined UPDATE statements (each setting percentile+rank+denominator together) with 24 separate UPDATE statements (8 percentile + 8 denominator + 8 rank), matching the canonical's structure.

**Primary recommendation:** Replace the standalone's STEP 4 person population (simple join on `person`) with the canonical's `person_person_type` LEFT JOIN chain that derives `facultyRank` from personType values. Replace the standalone's STEP 4 article counts (counting all articles) with the canonical's filtered counts (Research Article + percentileNIH not null). Then replace the entire STEP 5 block (lines 533-678) with the canonical's 24-statement pattern for percentile, denominator, and rank, adding `log_progress` calls and using `_new` table suffixes throughout.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Keep the standalone SP as a self-contained, independently runnable script (the nightly ETL job calls it)
- Preserve the overall step structure (STEP 1 through STEP 5+) and `log_progress` calls at each step
- STEP 5 (percentile/rank/denominator) may be restructured into sub-steps as needed
- A cleaner abstraction is acceptable for the 8 percentile computation blocks -- does not need to mirror the canonical's exact query structure verbatim
- Query structure can differ from canonical (e.g., UPDATE...JOIN vs temp tables) as long as the math produces identical results
- The canonical's peer-comparison logic MUST be preserved: denominator counts only peers at the same facultyRank who meet minimum publication thresholds (>4 for top5, >9 for top10)
- Audit ALL steps (1-5+) for divergence from the canonical, not just step 5
- Fix any divergence found in steps 1-4 as part of this phase (not deferred)
- Both diff-based and output comparison verification required
- Generate a structured diff of percentile/rank/denominator logic sections between fixed standalone and canonical SP -- confirm no logic divergence
- Compare query outputs for specific faculty: aer2006 (Tony Rosen), yiwang, paa2013
- Output comparison happens against the dev database
- Commit fix to ReCiterDB master branch first
- Cherry-pick the commit to the dev branch
- Push to origin immediately after committing (both master and dev)
- Use descriptive commit message explaining what was wrong, what was fixed, and referencing the canonical SP
- Primary fix is the percentile/rank/denominator logic in STEP 5
- Audit all other steps for divergence and fix in this same phase
- Update comments and section headers in the standalone SQL to accurately describe the corrected logic
- Preserve the `analysis_summary_person_new` temp table swap mechanism (prevents downtime during nightly refresh)
- Quick-check `cleanup_staging_tables_v2.sql` and `restore_from_backup_v2.sql` for any percentile-related references -- fix if affected, skip if not

### Claude's Discretion
- Exact query structure for the fixed percentile computations (temp tables vs inline subqueries vs UPDATE...JOIN)
- Whether to use a helper pattern to reduce repetition across the 8 metric blocks
- Exact sub-step breakdown within STEP 5
- How to structure the diff comparison for verification
- Log_progress message wording for updated sub-steps

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PCTL-01 | Percentile computed as average percentileNIH of person's top N best articles (top 5 or top 10), not % of articles above a threshold | Full diff analysis of canonical vs standalone STEP 5 percentile blocks provides exact replacement queries |
| PCTL-02 | Denominator computed as count of peers at same facultyRank with minimum publications (>4 for top5, >9 for top10) | Canonical denominator pattern documented with all 8 variants and their specific count column thresholds |
| PCTL-03 | Rank computed as ordinal position among peers using RANK() OVER (PARTITION BY facultyRank) | Canonical rank pattern documented with all 8 variants and their minimum publication threshold filters |
| PCTL-04 | Minimum publication thresholds enforced per author position (countAll, countFirst, countSenior, first+senior) | Complete threshold mapping table provided for all 8 metrics across percentile/denominator/rank |
| SYNC-01 | Standalone populateAnalysisSummaryTables_v2.sql synced with correct logic from createEventsProceduresReciterDb.sql | Full audit of all steps identifies exactly which sections diverge and which are identical |
| SYNC-02 | Changes committed to ReCiterDB master and dev branches | Git state analysis confirms branch strategy feasibility; master has 1 local commit diverged from origin/master |
</phase_requirements>

## Architecture Patterns

### File Structure (No Changes)
```
~/Dropbox/GitHub/ReCiterDB/
  setup/
    createEventsProceduresReciterDb.sql   # Canonical (source of truth, ~5041 lines)
    populateAnalysisSummaryTables_v2.sql  # Standalone (to be fixed, ~886 lines)
    cleanup_staging_tables_v2.sql         # Cleanup helper (no changes needed)
    restore_from_backup_v2.sql            # Restore helper (no changes needed)
```

### Step Structure of the Standalone SP
The standalone SP has this step structure, which must be preserved:

| Step | Description | Status |
|------|-------------|--------|
| Pre-flight | Check person_article has data | IDENTICAL -- no fix needed |
| STEP 1 | Create staging tables (_new) | IDENTICAL -- no fix needed |
| STEP 2 | Populate analysis_summary_author_new | IDENTICAL -- no fix needed |
| STEP 2b | Handle equal contribution authors | IDENTICAL -- no fix needed |
| STEP 2c | Populate analysis_summary_author_list_new | IDENTICAL -- no fix needed |
| STEP 3 | Populate analysis_summary_article_new | IDENTICAL -- no fix needed |
| STEP 4 | Populate analysis_summary_person_new | **DIVERGENT -- MUST FIX** |
| STEP 5 | Compute percentile rankings | **DIVERGENT -- MUST FIX (primary bug)** |
| STEP 6 | Compute h-index | IDENTICAL -- no fix needed |
| STEP 7 | Atomic table swap | IDENTICAL -- no fix needed |

### Detailed Audit: STEP 4 Divergences

**Divergence 4a: Person INSERT -- Missing facultyRank derivation**

The standalone (lines 482-491) does a simple join:
```sql
INSERT INTO analysis_summary_person_new (personIdentifier, nameFirst, nameMiddle, nameLast, facultyRank, department)
SELECT DISTINCT p.personIdentifier, p.firstName, p.middleName, p.lastName,
    p.title,                              -- <-- Uses person.title directly
    p.primaryOrganizationalUnit
FROM person p
JOIN analysis_summary_person_scope s ON s.personIdentifier = p.personIdentifier;
```

The canonical (lines 3729-3766) derives facultyRank from person_person_type using a LEFT JOIN chain with COALESCE:
```sql
INSERT INTO analysis_summary_person_new (personIdentifier, nameFirst, nameMiddle, nameLast, department, facultyRank)
SELECT * FROM (
    SELECT DISTINCT p.personIdentifier, p.firstName, p.middleName, p.lastName,
        p.primaryOrganizationalUnit,
        COALESCE(a.facultyRank, b.facultyRank, c.facultyRank, d.facultyRank) AS facultyRank
    FROM person p
    LEFT JOIN (SELECT personIdentifier, 'Full Professor' FROM person_person_type WHERE personType = 'academic-faculty-fullprofessor') a ON ...
    LEFT JOIN (SELECT personIdentifier, 'Associate Professor' FROM person_person_type WHERE personType = 'academic-faculty-associate') b ON ...
    LEFT JOIN (SELECT personIdentifier, 'Assistant Professor' FROM person_person_type WHERE personType = 'academic-faculty-assistant') c ON ...
    LEFT JOIN (SELECT personIdentifier, 'Instructor or Lecturer' FROM person_person_type WHERE personType IN ('academic-faculty-instructor','academic-faculty-lecturer')) d ON ...
    INNER JOIN analysis_summary_person_scope e ON e.personIdentifier = p.personIdentifier
) x WHERE facultyRank IS NOT NULL;
```

**Impact:** The standalone uses `person.title` as facultyRank, while the canonical derives it from `person_person_type`. The canonical also filters out people with no faculty rank (WHERE facultyRank IS NOT NULL), which the standalone does not.

**Divergence 4b: Article counts -- Different counting criteria**

The standalone (lines 498-522) counts all articles regardless of type:
```sql
-- countAll: COUNT(DISTINCT pmid) FROM analysis_summary_author_new
-- countFirst: COUNT(DISTINCT pmid) ... WHERE authorPosition = 'first'
-- countSenior: COUNT(DISTINCT pmid) ... WHERE authorPosition = 'last'
```

The canonical (lines 3779-3820) counts only Research Articles with NIH percentile:
```sql
-- countAll: COUNT(pmid) ... WHERE publicationTypeNIH = 'Research Article' AND percentileNIH IS NOT NULL
-- countFirst: COUNT(pmid) ... WHERE publicationTypeNIH = 'Research Article' AND percentileNIH IS NOT NULL AND authorPosition = 'first'
-- countSenior: COUNT(pmid) ... WHERE publicationTypeNIH = 'Research Article' AND percentileNIH IS NOT NULL AND authorPosition = 'last'
```

**Impact:** The standalone's counts are inflated because they include non-research articles and articles without NIH percentile data. Since these counts are used as minimum publication thresholds in STEP 5, this would cause some people to qualify for percentile computation when they shouldn't, and affect denominator calculations.

### Detailed Audit: STEP 5 Divergences (PRIMARY BUG)

The standalone's STEP 5 has THREE fundamental logic errors in all 8 metric blocks:

#### Bug 1: Percentile Computation (PCTL-01)

**Standalone (WRONG):** Percentage of articles above a fixed percentileNIH threshold
```sql
ROUND(100 * SUM(CASE WHEN percentileNIH >= 95 THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct
-- "What fraction of this person's articles are in the top 5% nationally?"
-- Uses fixed threshold (95 for top5, 90 for top10)
```

**Canonical (CORRECT):** Average percentileNIH of top N articles ranked by percentileNIH
```sql
ROUND(AVG(percentileNIH), 3) AS percentileNIH
-- Inner subquery: RANK() OVER (PARTITION BY personIdentifier ORDER BY percentileNIH DESC) AS article_rank
-- Filtered: WHERE article_rank < 6 (for top5) or < 11 (for top10)
-- With minimum publication threshold: AND countAll > 4 (for top5) or > 9 (for top10)
-- "What is the average NIH percentile of this person's best 5 (or 10) articles?"
```

#### Bug 2: Denominator Computation (PCTL-02)

**Standalone (WRONG):** Count of the person's own articles
```sql
COUNT(*) AS denominator  -- from the same per-person subquery
-- "How many articles does this person have?"
```

**Canonical (CORRECT):** Count of peers at same facultyRank who meet minimum publication threshold
```sql
SELECT COUNT(*) AS count, facultyRank
FROM analysis_summary_person_new
WHERE top5PercentileAll IS NOT NULL AND countAll > 4
GROUP BY facultyRank
-- "How many people at the same faculty rank have enough publications?"
-- Joined on: x.facultyRank = p.facultyRank
```

#### Bug 3: Rank Computation (PCTL-03)

**Standalone (WRONG):** Count of articles above threshold
```sql
SUM(CASE WHEN percentileNIH >= 95 THEN 1 ELSE 0 END) AS rank_count
-- "How many of this person's articles are above the 95th percentile?"
```

**Canonical (CORRECT):** Ordinal peer ranking using window function
```sql
RANK() OVER (PARTITION BY facultyRank ORDER BY top5PercentileAll DESC) AS personRank
FROM analysis_summary_person_new WHERE countAll > 4
-- "What is this person's ranking among their peers at the same faculty rank?"
```

### Complete Threshold Mapping (PCTL-04)

This table defines which count column and threshold is used for each of the 8 metrics:

| Metric | Percentile Threshold Filter | Denominator Count Check | Rank Count Check | Author Position |
|--------|----------------------------|------------------------|-----------------|-----------------|
| top5*All | countAll > 4 | countAll > 4 | countAll > 4 | (none) |
| top10*All | countAll > 9 | countAll > 9 | countAll > 9 | (none) |
| top5*First | countFirst > 4 | countFirst > 4 | countFirst > 4 | 'first' |
| top10*First | countFirst > 9 | countFirst > 9 | countFirst > 9 | 'first' |
| top5*Senior | countSenior > 4 | countSenior > 4 | countSenior > 4 | 'last' |
| top10*Senior | countSenior > 9 | countSenior > 9 | countSenior > 9 | 'last' |
| top5*FirstSenior | inline subquery > 4 | top5PercentileFirstSenior IS NOT NULL | top5PercentileFirstSenior IS NOT NULL | 'first','last' |
| top10*FirstSenior | inline subquery > 9 | top10PercentileFirstSenior IS NOT NULL | top10PercentileFirstSenior IS NOT NULL | 'first','last' |

**Important nuance for FirstSenior:** The canonical uses a different pattern for FirstSenior metrics because there is no `countFirstSenior` column in `analysis_summary_person`. Instead:
- Percentile: Uses an inline `IN (SELECT ... HAVING COUNT(*) > N)` subquery to find qualifying people
- Denominator: Uses `WHERE top*PercentileFirstSenior IS NOT NULL` (relying on percentile already being computed)
- Rank: Uses `WHERE top*PercentileFirstSenior IS NOT NULL` (same as denominator filter)

This differs from All/First/Senior which use `count* > N` for all three.

### Canonical STEP 5 Structure (24 statements)

The canonical organizes STEP 5 into 8 groups of 3 statements each (percentile, then denominator, then rank):

```
5a. top5*All:           percentile -> denominator -> rank
5b. top10*All:          percentile -> denominator -> rank
5c. top5*First:         percentile -> denominator -> rank
5d. top10*First:        percentile -> denominator -> rank
5e. top5*Senior:        percentile -> denominator -> rank
5f. top10*Senior:       percentile -> denominator -> rank
5g. top5*FirstSenior:   percentile -> denominator -> rank
5h. top10*FirstSenior:  percentile -> denominator -> rank
```

Order matters: denominator and rank for each metric depend on the percentile having been computed first.

### Additional Files Checked

**cleanup_staging_tables_v2.sql:** Contains only DROP TABLE statements for staging and temp tables. No percentile references. No changes needed.

**restore_from_backup_v2.sql:** Contains only RENAME TABLE statements for backup restoration. No percentile references. No changes needed.

## Common Pitfalls

### Pitfall 1: Table Name Suffix Mismatch
**What goes wrong:** The canonical SP uses both `analysis_summary_person` (production) and `analysis_summary_person_new` (staging) at different points. The standalone MUST use `_new` suffixes throughout since it's building staging tables.
**Why it happens:** The canonical's v2 procedure also uses `_new` tables, but the OLD v1 canonical procedure (lines 1918-3240) uses production table names directly. If copying from the wrong section, you'd get table name errors.
**How to avoid:** Always copy from the v2 canonical procedure (lines 3246-4451), NOT the v1 procedure (lines 1918-3240). The v2 procedure already uses `_new` tables.
**Warning signs:** Any reference to `analysis_summary_person` without `_new` suffix inside STEP 5 would be wrong (it should always be `analysis_summary_person_new` since we're computing against the staging table).

### Pitfall 2: FirstSenior Metrics Use Different Threshold Pattern
**What goes wrong:** Applying the same `countX > N` pattern used for All/First/Senior metrics to FirstSenior.
**Why it happens:** There is no `countFirstSenior` column in the table schema. The canonical works around this with inline subqueries.
**How to avoid:** For FirstSenior, the percentile query must include an inline subquery that counts first+last articles per person and checks `HAVING COUNT(*) > 4` (or > 9). The denominator and rank queries use `WHERE top*PercentileFirstSenior IS NOT NULL` instead of a count threshold.
**Warning signs:** A query referencing `countFirstSenior` or `(countFirst + countSenior) > N` in the percentile computation would be incorrect (though the old v1 canonical uses `(countFirst + countSenior)` for rank -- the v2 canonical changed this to use IS NOT NULL).

### Pitfall 3: Canonical v2 vs v1 vs Old Standalone SP Confusion
**What goes wrong:** The canonical file contains TWO versions of `populateAnalysisSummaryTables`: v1 (line 1918) and v2 (line 3246). Additionally there's the old standalone SP. Mixing logic from different versions.
**Why it happens:** The file is 5041 lines long with multiple SP definitions.
**How to avoid:** The source of truth is exclusively the v2 canonical at lines 3246-4451. The v1 canonical (lines 1918-3240) is legacy and has its own patterns that should NOT be used.
**Warning signs:** Seeing `analysis_summary_person` without `_new`, seeing `truncate` instead of `DROP/CREATE`, or seeing the old event-based patterns.

### Pitfall 4: Git Branch State
**What goes wrong:** The local master branch has 1 commit ahead and 15 behind origin/master. A naive push could fail or create merge conflicts.
**Why it happens:** Someone previously committed `feat(admin_users): add scope and proxy JSON columns for v1.1 feature port` locally but never pulled remote changes.
**How to avoid:** Before committing the fix, pull/rebase master to sync with origin. Resolve any conflicts in setup/populateAnalysisSummaryTables_v2.sql if the remote has touched this file. Then commit the fix, push, cherry-pick to dev, and push dev.
**Warning signs:** `git push` rejecting with "non-fast-forward" error.

### Pitfall 5: Rounding Precision Difference
**What goes wrong:** The standalone uses `ROUND(100 * ..., 1)` for percentile (one decimal place). The canonical uses `ROUND(AVG(percentileNIH), 3)` (three decimal places, no 100x multiplier).
**Why it happens:** Completely different computation approaches produce different value ranges and precision.
**How to avoid:** Use `ROUND(AVG(percentileNIH), 3)` exactly as the canonical does. The values should be in the 0-100 range already (percentileNIH is stored as a 0-100 value from NIH iCite), so no multiplication is needed.
**Warning signs:** Values in top*Percentile columns appearing as very small decimals (0.xxx) or very large (9500+) instead of reasonable percentile ranges (e.g., 40-99).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Percentile computation | Threshold-based percentage formula | AVG of top N via RANK() OVER window function | The canonical defines the business logic; the window function approach correctly selects each person's top N articles by percentileNIH |
| FacultyRank derivation | Simple column reference to person.title | LEFT JOIN chain on person_person_type with COALESCE | person.title may not be populated or may not match the expected faculty rank labels used in peer comparison |
| Article counting | Count all articles | Count only Research Article + percentileNIH IS NOT NULL | These counts gate eligibility for percentile computation; wrong counts mean wrong eligibility |

## Code Examples

### Pattern 1: Percentile Computation (e.g., top5PercentileAll)
```sql
-- Source: createEventsProceduresReciterDb.sql lines 3844-3858
UPDATE analysis_summary_person_new p
JOIN (
    SELECT personIdentifier, ROUND(AVG(percentileNIH), 3) AS percentileNIH
    FROM (
        SELECT s.personIdentifier, a1.pmid, a1.percentileNIH,
               RANK() OVER (PARTITION BY s.personIdentifier ORDER BY a1.percentileNIH DESC) AS article_rank
        FROM analysis_summary_person_new s
        JOIN analysis_summary_author_new a ON a.personIdentifier = s.personIdentifier
        Join analysis_summary_article_new a1 ON a1.pmid = a.pmid
        WHERE a1.percentileNIH IS NOT NULL AND s.countAll > 4
    ) y
    WHERE article_rank < 6
    GROUP BY personIdentifier
) x ON x.personIdentifier = p.personIdentifier
SET p.top5PercentileAll = x.percentileNIH;
```

### Pattern 2: Denominator Computation (e.g., top5DenominatorAll)
```sql
-- Source: createEventsProceduresReciterDb.sql lines 3863-3870
UPDATE analysis_summary_person_new p
JOIN (
    SELECT COUNT(*) AS count, facultyRank
    FROM analysis_summary_person_new
    WHERE top5PercentileAll IS NOT NULL AND countAll > 4
    GROUP BY facultyRank
) x ON x.facultyRank = p.facultyRank
SET p.top5DenominatorAll = x.count;
```

### Pattern 3: Rank Computation (e.g., top5RankAll)
```sql
-- Source: createEventsProceduresReciterDb.sql lines 3875-3882
UPDATE analysis_summary_person_new p
JOIN (
    SELECT personIdentifier,
           RANK() OVER (PARTITION BY facultyRank ORDER BY top5PercentileAll DESC) AS personRank
    FROM analysis_summary_person_new
    WHERE countAll > 4
) x ON x.personIdentifier = p.personIdentifier
SET p.top5RankAll = x.personRank;
```

### Pattern 4: FirstSenior Percentile (different threshold approach)
```sql
-- Source: createEventsProceduresReciterDb.sql lines 4132-4158
UPDATE analysis_summary_person_new p
JOIN (
    SELECT personIdentifier, ROUND(AVG(percentileNIH), 3) AS percentileNIH
    FROM (
        SELECT s.personIdentifier, a1.pmid, a1.percentileNIH,
               RANK() OVER (PARTITION BY s.personIdentifier ORDER BY a1.percentileNIH DESC) AS article_rank
        FROM analysis_summary_person_new s
        JOIN analysis_summary_author_new a ON a.personIdentifier = s.personIdentifier
        JOIN analysis_summary_article_new a1 ON a1.pmid = a.pmid
        WHERE a1.percentileNIH IS NOT NULL
          AND a.authorPosition IN ('first', 'last')
          AND s.personIdentifier IN (
              SELECT s2.personIdentifier
              FROM analysis_summary_person_new s2
              JOIN analysis_summary_author_new a2 ON a2.personIdentifier = s2.personIdentifier
              JOIN analysis_summary_article_new a12 ON a12.pmid = a2.pmid
              WHERE a12.publicationTypeNIH = 'Research Article' AND a12.percentileNIH IS NOT NULL
                AND a2.authorPosition IN ('first', 'last')
              GROUP BY s2.personIdentifier
              HAVING COUNT(*) > 4
          )
    ) y
    WHERE article_rank < 6
    GROUP BY personIdentifier
) x ON x.personIdentifier = p.personIdentifier
SET p.top5PercentileFirstSenior = x.percentileNIH;
```

### Pattern 5: Person INSERT with facultyRank derivation
```sql
-- Source: createEventsProceduresReciterDb.sql lines 3729-3766
INSERT INTO analysis_summary_person_new (personIdentifier, nameFirst, nameMiddle, nameLast, department, facultyRank)
SELECT * FROM (
    SELECT DISTINCT
        p.personIdentifier,
        p.firstName AS nameFirst,
        p.middleName AS nameMiddle,
        p.lastName AS nameLast,
        p.primaryOrganizationalUnit AS department,
        COALESCE(a.facultyRank, b.facultyRank, c.facultyRank, d.facultyRank) AS facultyRank
    FROM person p
    LEFT JOIN (SELECT personIdentifier, 'Full Professor' AS facultyRank FROM person_person_type WHERE personType = 'academic-faculty-fullprofessor') a ON a.personIdentifier = p.personIdentifier
    LEFT JOIN (SELECT personIdentifier, 'Associate Professor' AS facultyRank FROM person_person_type WHERE personType = 'academic-faculty-associate') b ON b.personIdentifier = p.personIdentifier
    LEFT JOIN (SELECT personIdentifier, 'Assistant Professor' AS facultyRank FROM person_person_type WHERE personType = 'academic-faculty-assistant') c ON c.personIdentifier = p.personIdentifier
    LEFT JOIN (SELECT personIdentifier, 'Instructor or Lecturer' AS facultyRank FROM person_person_type WHERE personType IN ('academic-faculty-instructor', 'academic-faculty-lecturer')) d ON d.personIdentifier = p.personIdentifier
    INNER JOIN analysis_summary_person_scope e ON e.personIdentifier = p.personIdentifier
) x
WHERE facultyRank IS NOT NULL;
```

### Pattern 6: Article Counts (canonical filtering)
```sql
-- Source: createEventsProceduresReciterDb.sql lines 3779-3820
-- countAll
UPDATE analysis_summary_person_new p
JOIN (
    SELECT s.personIdentifier, COUNT(a1.pmid) AS count
    FROM analysis_summary_person_new s
    JOIN analysis_summary_author_new a ON a.personIdentifier = s.personIdentifier
    JOIN analysis_summary_article_new a1 ON a1.pmid = a.pmid
    WHERE publicationTypeNIH = 'Research Article' AND percentileNIH IS NOT NULL
    GROUP BY s.personIdentifier
) x ON x.personIdentifier = p.personIdentifier
SET p.countAll = x.count;

-- countFirst (add: AND a.authorPosition = 'first')
-- countSenior (add: AND a.authorPosition = 'last')
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | SQL diff comparison + database output comparison |
| Config file | None (manual verification) |
| Quick run command | Structured diff between fixed standalone and canonical STEP 4+5 |
| Full suite command | Run both SPs on dev database and compare `analysis_summary_person` output for test persons |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PCTL-01 | Percentile = avg of top N | manual+diff | `diff` of STEP 5 percentile blocks between standalone and canonical | N/A (SQL files) |
| PCTL-02 | Denominator = peer count by facultyRank | manual+diff | `diff` of STEP 5 denominator blocks between standalone and canonical | N/A (SQL files) |
| PCTL-03 | Rank = RANK() OVER partitioned by facultyRank | manual+diff | `diff` of STEP 5 rank blocks between standalone and canonical | N/A (SQL files) |
| PCTL-04 | Thresholds enforced per position | manual+diff | Review all 8 metric blocks for correct count column and threshold value | N/A (SQL files) |
| SYNC-01 | Standalone synced with canonical | diff | `diff` between fixed standalone STEP 4-5 and canonical STEP 4-5 (after normalizing table names) | N/A |
| SYNC-02 | Committed to master and dev | git | `git log master --oneline -1 && git log dev --oneline -1` | N/A |

### Sampling Rate
- **Per task commit:** Visual diff of changed sections against canonical
- **Per wave merge:** Full SP file review
- **Phase gate:** Structured diff showing no logic divergence in percentile/rank/denominator sections

### Wave 0 Gaps
None -- this phase operates on SQL files, not a test framework. Verification is diff-based and output-comparison-based (output comparison is deferred to Phase 13 deployment).

## Open Questions

1. **Git master divergence**
   - What we know: Local master is 1 ahead, 15 behind origin/master. The local commit is `feat(admin_users): add scope and proxy JSON columns for v1.1 feature port`.
   - What's unclear: Whether those 15 remote commits touch `populateAnalysisSummaryTables_v2.sql`. If they do, there could be merge conflicts.
   - Recommendation: Pull/rebase master before making changes. If conflicts arise in the standalone file, resolve by keeping the canonical's logic. The local ahead commit should be safe to rebase on top of remote.

2. **person.title vs person_person_type for facultyRank**
   - What we know: The standalone uses `person.title` directly while the canonical derives from `person_person_type`. These may or may not produce the same values.
   - What's unclear: Whether the dev database has `person.title` populated with the same strings as the canonical's derived values ('Full Professor', 'Associate Professor', etc.).
   - Recommendation: Use the canonical's `person_person_type` approach regardless. It's the source of truth and ensures the standalone matches.

## Sources

### Primary (HIGH confidence)
- `~/Dropbox/GitHub/ReCiterDB/setup/createEventsProceduresReciterDb.sql` (canonical v2 SP, lines 3246-4451) -- full STEP 4 and STEP 5 logic read and analyzed
- `~/Dropbox/GitHub/ReCiterDB/setup/populateAnalysisSummaryTables_v2.sql` (standalone SP, all 886 lines) -- full audit completed
- `~/Dropbox/GitHub/ReCiterDB/setup/cleanup_staging_tables_v2.sql` -- read in full, no percentile references found
- `~/Dropbox/GitHub/ReCiterDB/setup/restore_from_backup_v2.sql` -- read in full, no percentile references found

### Secondary (MEDIUM confidence)
- None needed -- all analysis is from direct source code comparison

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Divergence analysis: HIGH -- both files read in full, line-by-line comparison of all steps
- Fix approach: HIGH -- canonical v2 provides exact replacement queries
- Git strategy: MEDIUM -- local master has diverged; may need conflict resolution during rebase
- Impact on other files: HIGH -- cleanup and restore helpers confirmed unaffected

**Research date:** 2026-03-26
**Valid until:** Indefinite (SQL logic analysis, not library version dependent)
