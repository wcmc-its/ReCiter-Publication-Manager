#!/usr/bin/env node
/**
 * PM#988 — POST /api/db/authorships/summary honours every filter the list endpoint does, instead
 * of neutralising source/classification/precision/personTypes/pubTypes/institutions/
 * authorAffiliations on arrival. Guarded by source inspection so this runs with no DB, no AWS
 * creds and no build — the same posture as scripts/check-authorships-986.mjs.
 * Run: node scripts/check-authorships-988.mjs
 *
 * Sections:
 *   1. the old neutralising override literal is gone, and summaryWhere() exists.
 *   2. exclusion map — each response field's own where excludes exactly the key(s) design says
 *      and nothing else: total (none), single_candidate/fullname/classes (precision+
 *      classification), bySource (source+pubTypes), pubTypes (pubTypes), personTypes
 *      (personTypes), institutions facet (institutions), authorInstitutions facet
 *      (authorAffiliations).
 *   3. total uses the full, un-excluded body.
 *   4. duplicates/conflicts force statusView (and conflicts forces identityConflicts) on the
 *      FULL body — never blind to anything else.
 *   5. personInstitutionInclude() + the qualified/deduplicated id are present on every query that
 *      can carry an institutions condition, gated on hasInstitutions.
 *   6. authorInstitutions runs as its own query (not shared columns off the institutions query),
 *      is gated on wantAuthorInstitutions, and the response key is undefined (absent) when unset.
 *   7. SUMMARY_BLIND_BODY_KEYS is exactly ["sort"].
 *
 * Slices function BODIES, not comments, wherever the assertion is about behaviour — a sentence
 * describing the contract in prose can never satisfy one of these.
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

// Bodies only — never the comment block above them, so a sentence quoting the contract in prose
// can never make one of these assertions pass.
const slice = (src, startMarker, endMarker) => {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a);
  if (a < 0 || b < 0) return "";
  return src.slice(a, b);
};
const summaryFn = slice(controllerSrc, "export const authorshipSummary", "\n// POST /api/db/authorships/prior-names");
const summaryWhereFn = slice(controllerSrc, "function summaryWhere(", "\n}");

// ---------------------------------------------------------------------------------------
console.log("\n1. the neutralising literal is gone; summaryWhere() exists:");
assert(summaryFn.length > 0, "authorshipSummary located in the controller");
assert(!/const body = \{\s*\.\.\.\(req\.body \|\| \{\}\),\s*source: "all"/.test(controllerSrc),
  "no `const body = { ...req.body, source: \"all\", … }` override literal anywhere in the file");
assert(/const body = req\.body \|\| \{\};/.test(summaryFn),
  "authorshipSummary takes the body as-is (no per-field neutralising on arrival)");
assert(summaryWhereFn.length > 0, "summaryWhere(body, exclude, absentCwids) helper exists");
assert(/return buildWhere\(b, absentCwids\);/.test(summaryWhereFn),
  "summaryWhere() delegates to the ONE shared buildWhere() — no forked filter logic");
assert(
  /source: "all", classification: "all", precision: "all",/.test(summaryWhereFn)
  && /personTypes: \[\], pubTypes: \[\], institutions: \[\], authorAffiliations: \[\],/.test(summaryWhereFn),
  "summaryWhere()'s neutral values match the seven keys the old literal used",
);

// ---------------------------------------------------------------------------------------
console.log("\n2. exclusion map — each response field excludes exactly its own key(s):");
assert(/const where = summaryWhere\(body, \[\], absentCwids\);/.test(summaryFn),
  "total: summaryWhere(body, []) — nothing excluded");
assert(/const matchClassWhere = summaryWhere\(body, \["precision", "classification"\], absentCwids\);/.test(summaryFn),
  "single_candidate/fullname/classes: summaryWhere(body, [\"precision\", \"classification\"])");
assert(/const bySourceWhere = summaryWhere\(body, \["source", "pubTypes"\], absentCwids\);/.test(summaryFn),
  "bySource: summaryWhere(body, [\"source\", \"pubTypes\"])");
assert(/const pubTypesWhere = summaryWhere\(body, \["pubTypes"\], absentCwids\);/.test(summaryFn),
  "pubTypes: summaryWhere(body, [\"pubTypes\"])");
assert(/const personTypesWhere = summaryWhere\(body, \["personTypes"\], absentCwids\);/.test(summaryFn),
  "personTypes: summaryWhere(body, [\"personTypes\"])");
assert(/const institutionsWhere = summaryWhere\(body, \["institutions"\], absentCwids\);/.test(summaryFn),
  "institutions facet: summaryWhere(body, [\"institutions\"])");
assert(/const authorInstWhere = summaryWhere\(body, \["authorAffiliations"\], absentCwids\);/.test(summaryFn),
  "authorInstitutions facet: summaryWhere(body, [\"authorAffiliations\"])");
// The three MATCH CLASS fields (single_candidate, fullname, classes) all read off matchClassWhere.
assert(/models\.AuthorshipReview\.count\(countOpts\(\{ \[Op\.and\]: \[matchClassWhere, \{ single_candidate: true \}\] \}\)\)/.test(summaryFn),
  "single_candidate is counted against matchClassWhere");
assert(/models\.AuthorshipReview\.count\(countOpts\(\{ \[Op\.and\]: \[matchClassWhere, \{ single_candidate: true, top_given_match: "full" \}\] \}\)\)/.test(summaryFn),
  "fullname is counted against matchClassWhere");
assert(/attributes: \["classification", \[groupCountAttr, "n"\]\], \.\.\.whereOpts\(matchClassWhere\)/.test(summaryFn),
  "classes (byClass) is grouped against matchClassWhere");
assert(/attributes: \["top_person_type", \[groupCountAttr, "n"\]\], \.\.\.whereOpts\(personTypesWhere\)/.test(summaryFn),
  "personTypes (byType) is grouped against personTypesWhere");
assert(/attributes: \["source", \[groupCountAttr, "n"\]\], \.\.\.whereOpts\(bySourceWhere\)/.test(summaryFn),
  "bySource (bySrc) is grouped against bySourceWhere");
assert(/attributes: \["pub_type", \[groupCountAttr, "n"\]\], \.\.\.whereOpts\(\{ \[Op\.and\]: \[pubTypesWhere, \{ source: "scopus" \}\] \}\)/.test(summaryFn),
  "pubTypes (byPub) is grouped against pubTypesWhere AND source:\"scopus\" (forced source kept)");
assert(/where: institutionsWhere, raw: true,/.test(summaryFn),
  "the institutions facet query reads institutionsWhere");
assert(/attributes: institutionFacetAttributes\("byline"\),\s*\n\s*\.\.\.whereOpts\(authorInstWhere\),/.test(summaryFn),
  "the authorInstitutions facet query reads authorInstWhere, basis \"byline\"");

// ---------------------------------------------------------------------------------------
console.log("\n3. total uses the full body:");
assert(/models\.AuthorshipReview\.count\(countOpts\(where\)\)/.test(summaryFn),
  "total is counted against `where` (summaryWhere(body, []) — the unexcluded full body)");

// ---------------------------------------------------------------------------------------
console.log("\n4. duplicates/conflicts force statusView on the FULL body:");
assert(/const dupWhere = buildWhere\(\{ \.\.\.body, statusView: "duplicates" \}, absentCwids\);/.test(summaryFn),
  "dupWhere = buildWhere({...body, statusView: \"duplicates\"}) — full body, only statusView forced");
assert(/const conflictWhere = buildWhere\(\s*\{ \.\.\.body, statusView: "open", identityConflicts: true \}, absentCwids,\s*\);/.test(summaryFn),
  "conflictWhere = buildWhere({...body, statusView: \"open\", identityConflicts: true}) — full body, only statusView+identityConflicts forced");
assert(/models\.AuthorshipReview\.count\(countOpts\(dupWhere\)\)/.test(summaryFn),
  "duplicates is counted against dupWhere");
assert(/models\.AuthorshipReview\.count\(countOpts\(conflictWhere\)\)/.test(summaryFn),
  "conflicts is counted against conflictWhere");

// ---------------------------------------------------------------------------------------
console.log("\n5. institution include + qualified/deduplicated id, gated on hasInstitutions:");
assert(/const hasInstitutions = Array\.isArray\(body\.institutions\) && body\.institutions\.length > 0;/.test(summaryFn),
  "hasInstitutions reflects the caller's own body.institutions");
assert(/const instInclude = \[personInstitutionInclude\(false\)\];/.test(summaryFn),
  "instInclude wraps personInstitutionInclude(false) — required:false (LEFT JOIN)");
assert(/const countOpts = \(w: any\) => \(hasInstitutions \? \{ where: w, include: instInclude, distinct: true, col: "id" \} : \{ where: w \}\);/.test(summaryFn),
  "count() calls attach { include, distinct: true, col: \"id\" } only when hasInstitutions — the qualified/deduplicated form");
assert(/const whereOpts = \(w: any\) => \(hasInstitutions \? \{ where: w, include: instInclude \} : \{ where: w \}\);/.test(summaryFn),
  "findAll() calls attach { include } only when hasInstitutions");
assert(/const groupCountAttr = hasInstitutions \? fn\("COUNT", fn\("DISTINCT", col\("AuthorshipReview\.id"\)\)\) : fn\("COUNT", col\("id"\)\);/.test(summaryFn),
  "GROUP BY counts use COUNT(DISTINCT AuthorshipReview.id) only when hasInstitutions, else the plain COUNT(id) — no-institutions cost is unchanged");
// every count()/findAll() in the Promise.all that CAN carry the institutions filter goes through
// countOpts/whereOpts, i.e. none of them pass a bare `{ where }`-shaped literal for those fields.
const promiseAllBlock = slice(summaryFn, "await Promise.all([", "\n    ]);");
assert(promiseAllBlock.length > 0, "the Promise.all block is present");
assert((promiseAllBlock.match(/countOpts\(/g) || []).length === 5,
  "all 5 count() calls (total, single, fullname, duplicates, conflicts) go through countOpts()");
assert((promiseAllBlock.match(/whereOpts\(/g) || []).length === 5,
  "all 5 findAll() calls that can carry institutions (classes, personTypes, bySource, pubTypes, authorInstitutions) go through whereOpts()");

// ---------------------------------------------------------------------------------------
console.log("\n6. authorInstitutions is its own query, opt-in, absent (not []) when unset:");
assert(/wantAuthorInstitutions\s*\n\s*\? models\.AuthorshipReview\.findAll\(\{\s*\n\s*attributes: institutionFacetAttributes\("byline"\),/.test(summaryFn),
  "the authorInstitutions query is gated on wantAuthorInstitutions and always basis \"byline\"");
// "byline_" survives in two historical measurement comments (what #983 measured before this
// fix) — those are fine; the CODE path that produced byline_-prefixed columns must be gone.
assert(!/institutionFacetAttributes\("byline", "byline_"\)/.test(summaryFn),
  "the old byline_-prefixed shared-columns call (institutionFacetAttributes(\"byline\", \"byline_\")) is gone");
assert(/const authorInstitutions = wantAuthorInstitutions\s*\n\s*\? bucketCounts\([\s\S]*?\)\s*\n\s*: undefined;/.test(summaryFn),
  "authorInstitutions is undefined, not [], when the flag is unset");
assert(/const institutions = bucketCounts\(\(\(byInstitution as any\[\]\)\[0\]\) \|\| \{\}\);/.test(summaryFn),
  "the institutions facet is still computed unconditionally, off its own query");

// ---------------------------------------------------------------------------------------
console.log("\n7. SUMMARY_BLIND_BODY_KEYS is exactly [\"sort\"]:");
const blindMatch = /const SUMMARY_BLIND_BODY_KEYS = \[([\s\S]*?)\] as const;/.exec(tabsSrc);
assert(!!blindMatch, "SUMMARY_BLIND_BODY_KEYS declaration found in AuthorshipsTabs.tsx");
const blindKeys = blindMatch
  ? [...blindMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  : [];
assert(blindKeys.length === 1 && blindKeys[0] === "sort",
  `SUMMARY_BLIND_BODY_KEYS is ["sort"] (found ${JSON.stringify(blindKeys)})`);

console.log(failures ? `\n${failures} FAILED\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
