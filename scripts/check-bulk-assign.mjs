#!/usr/bin/env node
/**
 * The bulk-selection/bulk-assign logic behind "Find others like this" + assigning one cwid
 * to many rows at once (T4, the Vickers case): src/lib/bulkAssign.ts.
 * Run: node --experimental-strip-types scripts/check-bulk-assign.mjs
 *
 * No prerequisites, no DB, no build: every function here is pure precisely so the table can
 * be asserted directly, same reason as scripts/check-assign-gate.mjs and
 * scripts/check-homonym-rejections.mjs.
 *
 * Four sections:
 *   1. eligibility — which OPEN rows are checkbox-selectable, and which of those are also in
 *                    the (unchanged) single-candidate bulk ACCEPT set
 *   2. candidates  — union-of-candidates + match-count computation for the picker
 *   3. partition   — which selected rows a chosen cwid actually reaches
 *   4. buckets     — doBulkAccept-style failure bucketing for the assign submit loop
 */

import assert from "node:assert/strict";
import {
  isAcceptEligible, isMultiAssignEligible, isBulkSelectable,
  unionCandidates, partitionForAssign, bucketAssignFailures,
} from "../src/lib/bulkAssign.ts";

let n = 0;
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  console.log(`  PASS ${label} -> ${JSON.stringify(actual)}`);
  n++;
};

// ---------------------------------------------------------------------------------------
console.log("\neligibility:");

const single = { single_candidate: true, identity_in_reciter: true, top_already_rejected: false, top_cwid: "aaa2014", source: "pubmed" };
const multiPubmed = { single_candidate: false, source: "pubmed" };
const multiScopus = { single_candidate: false, source: "scopus" };

check("single-candidate, identity, not rejected, has top_cwid -> accept-eligible", isAcceptEligible(single), true);
check("...no ReCiter identity -> not accept-eligible", isAcceptEligible({ ...single, identity_in_reciter: false }), false);
check("...already rejected -> not accept-eligible", isAcceptEligible({ ...single, top_already_rejected: true }), false);
check("...no top_cwid (#938) -> not accept-eligible", isAcceptEligible({ ...single, top_cwid: undefined }), false);
check("multi-candidate is never accept-eligible, identity/rejected notwithstanding",
  isAcceptEligible({ ...multiPubmed, identity_in_reciter: true, top_cwid: "aaa2014" }), false);

check("multi-candidate pubmed -> assign-eligible", isMultiAssignEligible(multiPubmed), true);
check("multi-candidate scopus -> NOT assign-eligible (homonym recording is pubmed-lane only)",
  isMultiAssignEligible(multiScopus), false);
check("single-candidate row is never multi-assign-eligible", isMultiAssignEligible(single), false);

console.log("\nbulk-selectable (open queue only):");
check("single-candidate, open -> selectable", isBulkSelectable(single, "open"), true);
check("multi-candidate pubmed, open -> selectable (T4)", isBulkSelectable(multiPubmed, "open"), true);
check("multi-candidate scopus, open -> NOT selectable", isBulkSelectable(multiScopus, "open"), false);
check("single-candidate, snoozed view -> NOT selectable (matches pre-T4 toggleSelect)",
  isBulkSelectable(single, "snoozed"), false);
check("multi-candidate pubmed, dismissed view -> NOT selectable",
  isBulkSelectable(multiPubmed, "dismissed"), false);
check("no-identity single-candidate, open -> NOT selectable", isBulkSelectable({ ...single, identity_in_reciter: false }, "open"), false);

// ---------------------------------------------------------------------------------------
// Fixture shape: the Vickers case — three open rows for "Andrew J Vickers", each a
// multi-candidate homonym row proposing a different mix of WCM Andrew Vickers homonyms.
console.log("\nunion of candidates across a selection:");

const rowA = [{ cwid: "abv9001", name: "Andrew B Vickers" }, { cwid: "amv2003", name: "Alan M Vickers" }];
const rowB = [{ cwid: "abv9001", name: "Andrew B Vickers" }];
const rowC = [{ cwid: "abv9001", name: "Andrew B Vickers" }, { cwid: "zzz0000", name: "Zach Vickers" }];

const union = unionCandidates([rowA, rowB, rowC]);
check("abv9001 proposed by all 3 rows, ranked first", union[0], { cwid: "abv9001", name: "Andrew B Vickers", matches: 3 });
check("the two 1-match candidates trail it, tie broken by cwid", union.slice(1), [
  { cwid: "amv2003", name: "Alan M Vickers", matches: 1 },
  { cwid: "zzz0000", name: "Zach Vickers", matches: 1 },
]);
check("a row proposing the same cwid twice still counts once",
  unionCandidates([[{ cwid: "abv9001" }, { cwid: "abv9001" }]]), [{ cwid: "abv9001", name: undefined, matches: 1 }]);
check("a later sighting fills in a name the first omitted",
  unionCandidates([[{ cwid: "abv9001" }], [{ cwid: "abv9001", name: "Andrew B Vickers" }]]),
  [{ cwid: "abv9001", name: "Andrew B Vickers", matches: 2 }]);
check("empty selection -> empty union", unionCandidates([]), []);

// ---------------------------------------------------------------------------------------
console.log("\npartition for a chosen cwid:");

const rows = [
  { id: 1, candidates: rowA }, { id: 2, candidates: rowB }, { id: 3, candidates: rowC },
];
const candidatesOf = (r) => r.candidates;

const p1 = partitionForAssign(rows, candidatesOf, "abv9001");
check("abv9001 is on all three rows -> nobody skipped", p1.toSubmit.map((r) => r.id), [1, 2, 3]);
check("...toSkip empty", p1.toSkip, []);

const p2 = partitionForAssign(rows, candidatesOf, "amv2003");
check("amv2003 only on row 1 -> submit just that one", p2.toSubmit.map((r) => r.id), [1]);
check("...rows 2 and 3 skipped, never sent to the server", p2.toSkip.map((r) => r.id), [2, 3]);

const p3 = partitionForAssign(rows, candidatesOf, "someone_else_entirely");
check("typed cwid on nobody's candidate list -> everything skipped", p3.toSubmit, []);
check("...all three rows accounted for in toSkip", p3.toSkip.map((r) => r.id), [1, 2, 3]);

// ---------------------------------------------------------------------------------------
console.log("\nfailure bucketing (submitted rows only — partition's toSkip never reaches this):");

check("empty batch -> all zero", bucketAssignFailures([]), { offCandidate: 0, noIdentity: 0, conflict409: 0, other: 0 });
check("one of each + one unexplained", bucketAssignFailures([
  { status: 422, code: "OFF_CANDIDATE" },
  { status: 422, code: "NO_RECITER_IDENTITY" },
  { status: 409 },
  { status: 502 },
]), { offCandidate: 1, noIdentity: 1, conflict409: 1, other: 1 });
check("a 422 with neither known code falls to other (not silently miscounted as off-candidate)",
  bucketAssignFailures([{ status: 422, code: "SOMETHING_ELSE" }]),
  { offCandidate: 0, noIdentity: 0, conflict409: 0, other: 1 });
check("a network-level rejection with no status at all still counts, as other",
  bucketAssignFailures([{}]), { offCandidate: 0, noIdentity: 0, conflict409: 0, other: 1 });

console.log(`\n${n}/${n} passed\n`);
