#!/usr/bin/env node
/**
 * PM#986 + PM#990 — the identity-conflicts queue moves from a surname approximation to the
 * exact byline-slot test, and the queue starts naming the rival who already holds the slot.
 * Guarded by source inspection so this runs with no DB, no AWS creds and no build — the same
 * reason as every other scripts/check-*.mjs here (and doubly so for this one: the predicate it
 * guards needs person_article_author + identity rows the dev DB does not usefully carry).
 * Run: node scripts/check-authorships-986.mjs
 *
 * Sections:
 *   1. identityConflictWhere — exact (pmid, rank) slot test, ACCEPTED rival, rival joined to
 *      `identity`, targetAuthor's carriage-return trap avoided, COLLATE on the
 *      AuthorshipReview side only, and the surname test actually GONE rather than left beside
 *      the new one.
 *   2. LIST_ATTRIBUTES — author_position is returned, since the predicate and accepted_by both
 *      key off it and the client cannot ask for it separately.
 *   3. acceptedBySlot — one parameterised query per page, ACCEPTED + identity join identical to
 *      the predicate above, empty-page short-circuit, keyed `${pmid}|${rank}`.
 *   4. listAuthorships — accepted_by computed in the existing Promise.all, only for pubmed rows
 *      with an author_position, and the row's OWN top_cwid excluded CASE-INSENSITIVELY (the SQL
 *      it mirrors compares under a _ci collation; a case-sensitive !== here would disagree with
 *      the conflicts COUNT on exactly the rows this feature exists to explain).
 *   5. AuthorshipsTabs.tsx — the accepted_by field, the "Already accepted by" line, the
 *      "Accepted this article" candidate chip, and its cwid compare lowercased on both sides.
 *   6. Wording — nothing left in either file still describes the queue as a PMID-level or
 *      surname-matched test.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
let failures = 0;
const assert = (cond, label) => {
  console.log(`  ${cond ? PASS : FAIL} ${label}`);
  if (!cond) failures++;
};

const controllerSrc = readFileSync(join(ROOT, "controllers/db/authorships.controller.ts"), "utf8");
const tabsSrc = readFileSync(join(ROOT, "src/components/elements/Authorships/AuthorshipsTabs.tsx"), "utf8");

// Bodies only — never the comment block above them, so a sentence quoting the OLD predicate in
// prose can never make one of these assertions pass.
const slice = (src, startMarker, endMarker) => {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a);
  if (a < 0 || b < 0) return "";
  return src.slice(a, b);
};
const conflictFn = slice(controllerSrc, "function identityConflictWhere(): any {", "\n}");
const acceptedFn = slice(controllerSrc, "async function acceptedBySlot(", "\n}");
const listFn = slice(controllerSrc, "export const listAuthorships", "export const authorshipSelectable");

// ---------------------------------------------------------------------------------------
console.log("\n1. identityConflictWhere — exact byline slot, WCM rival, no surname test:");
assert(/FROM `person_article_author` `paa`/.test(conflictFn),
  "the EXISTS drives FROM person_article_author (the shape the (pmid, rank) index is for)");
assert(/`paa`\.`pmid` = `AuthorshipReview`\.`pmid`/.test(conflictFn), "same pmid");
assert(/`paa`\.`rank` = `AuthorshipReview`\.`author_position`/.test(conflictFn),
  "same byline slot: paa.rank = AuthorshipReview.author_position");
assert(/`pa`\.`userAssertion` = 'ACCEPTED'/.test(conflictFn),
  "the rival must be ACCEPTED (a PENDING person_article row is a suggestion, not an assignment)");
assert(/JOIN `identity` `i` ON `i`\.`cwid` = `pa`\.`personIdentifier`/.test(conflictFn),
  "#990: the rival is joined to `identity`, so external-validation cohorts are not rivals");
assert(/`paa`\.`targetAuthor` LIKE '1%'/.test(conflictFn),
  "targetAuthor tested with LIKE '1%' (the stored value is '1' + CR; TRIM would match nothing)");
assert(!/TRIM\(\s*`?paa`?\.`?targetAuthor/.test(controllerSrc),
  "TRIM(targetAuthor) appears nowhere in the controller");
assert(/`pa`\.`personIdentifier` <> `AuthorshipReview`\.`top_cwid` COLLATE utf8mb4_unicode_ci/.test(conflictFn),
  "rival <> this row's own top_cwid, COLLATE on the AuthorshipReview side");
assert(!/`(pa|paa|i)`\.`[A-Za-z_]+` COLLATE/.test(conflictFn),
  "no COLLATE on person_article / person_article_author / identity columns (would de-index them)");
assert(/top_cwid: \{ \[Op\.ne\]: null \}/.test(conflictFn),
  "top_cwid IS NOT NULL stays an explicit guard");
assert(!/SUBSTRING_INDEX/.test(conflictFn) && !/articleAuthorNameLastName/.test(conflictFn),
  "the #985 surname test is gone from the predicate, not left beside the new one");
assert(!/articleAuthorNameLastName/.test(acceptedFn),
  "the surname column is not used by the accepted_by lookup either (authorshipPriorNames still\n       reads it for the hover card — that is a different feature and stays)");

// ---------------------------------------------------------------------------------------
console.log("\n2. LIST_ATTRIBUTES — author_position reaches the client:");
const listAttrs = slice(controllerSrc, "const LIST_ATTRIBUTES = [", "];");
assert(/"author_position",/.test(listAttrs), '"author_position" is in LIST_ATTRIBUTES');
assert(/"author_position_label",/.test(listAttrs), "author_position_label still there (not replaced by it)");

// ---------------------------------------------------------------------------------------
console.log("\n3. acceptedBySlot — one parameterised page query, same join as the predicate:");
assert(acceptedFn.length > 0, "acceptedBySlot() exists");
assert(/if \(!pmids\.length \|\| !positions\.length\) return out;/.test(acceptedFn),
  "short-circuits on an empty page rather than sending IN ()");
assert(/`paa`\.`pmid` IN \(:pmids\) AND `paa`\.`rank` IN \(:positions\)/.test(acceptedFn),
  "scoped by the page's pmids AND its author positions");
assert(/replacements: \{ pmids, positions \}/.test(acceptedFn) && /type: QueryTypes\.SELECT/.test(acceptedFn),
  "bound via replacements + QueryTypes.SELECT, never string-interpolated");
assert(/`pa`\.`userAssertion` = 'ACCEPTED'/.test(acceptedFn)
  && /JOIN `identity` `i` ON `i`\.`cwid` = `pa`\.`personIdentifier`/.test(acceptedFn)
  && /`paa`\.`targetAuthor` LIKE '1%'/.test(acceptedFn),
  "ACCEPTED + identity join + the LIKE '1%' trap, identical to identityConflictWhere()");
assert(/const key = `\$\{r\.pmid\}\|\$\{r\.rnk\}`/.test(acceptedFn),
  "keyed by the exact (pmid, rank) pair, so the IN×IN cross-product cannot land under a wrong row");

// ---------------------------------------------------------------------------------------
console.log("\n4. listAuthorships — accepted_by per row, own cwid excluded case-insensitively:");
assert(/const \[rejectedByCwid, divisions, acceptedByMap\] = await Promise\.all\(\[/.test(listFn),
  "acceptedBySlot joins the existing independent-input Promise.all (not a serial leg)");
assert(/pubmedRows\s*\n?\s*\.filter\(\(r: any\) => r\.author_position != null\)/.test(listFn),
  "pairs come from pubmed rows only, and only those with an author_position");
assert(/const ownCwid = String\(r\.top_cwid \|\| ""\)\.toLowerCase\(\);/.test(listFn),
  "the row's own cwid is lowercased before the compare");
assert(/\.filter\(\(a\) => a\.cwid\.toLowerCase\(\) !== ownCwid\)/.test(listFn),
  "and the rival side is lowercased too — matches the _ci collation the SQL exclusion uses");
assert(/accepted_by,/.test(listFn), "accepted_by is on the response row");
assert(/r\.source !== "scopus" && r\.pmid != null && r\.author_position != null/.test(listFn),
  "scopus / pmid-less / position-less rows get [] rather than a bogus lookup");

// ---------------------------------------------------------------------------------------
console.log("\n5. AuthorshipsTabs.tsx — the named rival and the candidate chip:");
assert(/accepted_by\?: Array<\{ cwid: string; name: string \}>;/.test(tabsSrc),
  "AuthorshipRow.accepted_by declared");
assert(/\(r\.accepted_by\?\.length \?\? 0\) > 0 && \(/.test(tabsSrc),
  "the card line is gated on a non-empty accepted_by");
assert(/Already accepted by \{r\.accepted_by!\.map\(\(a\) => `\$\{a\.name\} \(\$\{a\.cwid\}\)`\)/.test(tabsSrc),
  '"Already accepted by <name> (<cwid>)" rendered');
assert(/const acceptedByCwids = new Set\(\(r\.accepted_by \|\| \[\]\)\.map\(\(a\) => String\(a\.cwid \|\| ""\)\.toLowerCase\(\)\)\);/.test(tabsSrc),
  "the Pick-one lookup set is lowercased");
assert(/const acceptedElsewhere = acceptedByCwids\.has\(String\(c\.cwid \|\| ""\)\.toLowerCase\(\)\);/.test(tabsSrc),
  "and the candidate cwid is lowercased before the lookup");
assert(/acceptedElsewhere && <Chip kind="warn">Accepted this article<\/Chip>/.test(tabsSrc),
  '"Accepted this article" chip on the rival candidate');
assert(/rejected \|\| acceptedElsewhere\)/.test(tabsSrc),
  "the chip row opens for acceptedElsewhere too, not only for the pre-existing three cases");

// ---------------------------------------------------------------------------------------
console.log("\n6. Wording — no PMID-level or surname description of the queue survives:");
assert(!/rows whose PMID is already/i.test(controllerSrc) && !/rows whose PMID is already/i.test(tabsSrc),
  "no 'rows whose PMID is already accepted' left in either file");
assert(/byline position on this paper is already accepted by a different WCM identity/.test(tabsSrc),
  "the header pill tooltip says byline position + WCM identity");
assert(/same PMID AND same\s*\n?\s*\/\/ author position/.test(tabsSrc),
  "Summary.conflicts documents the exact-slot test");

console.log(failures ? `\n${failures} FAILED\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
