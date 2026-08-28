-- Post-migration check for add-authorship-accept-conflict.sql. Run against the same
-- database you applied the migration to. Every row must be TRUE.
--
-- The failure this guards against is a row falling out of BOTH views: the open queue now
-- filters `accept_conflict IS NULL` and the duplicates view filters `IS NOT NULL`, so if
-- either predicate drifts, authorships go invisible rather than erroring.

SELECT 'open + duplicates partitions every open row' AS check_name,
       (SELECT COUNT(*) FROM authorship_review WHERE status='open' AND accept_conflict IS NULL)
     + (SELECT COUNT(*) FROM authorship_review WHERE status='open' AND accept_conflict IS NOT NULL)
     = (SELECT COUNT(*) FROM authorship_review WHERE status='open') AS ok

UNION ALL
SELECT 'the column exists and defaults to NULL (no row parked by the migration itself)',
       (SELECT COUNT(*) FROM authorship_review WHERE accept_conflict IS NOT NULL) = 0

UNION ALL
-- The claim the "Unique and full given-name match" lane is built on. If this ever returns
-- FALSE, a curator has rejected a row in the class and the lane's premise needs re-checking
-- before it keeps being offered as a bulk target.
SELECT 'no curator has ever rejected a row in the fullname class',
       (SELECT COUNT(*) FROM authorship_review
         WHERE single_candidate=1 AND top_given_match='full' AND status='rejected') = 0;
