#!/usr/bin/env node
/**
 * The bulk-selection/bulk-assign logic behind "Find others like this" + assigning one cwid
 * to many rows at once (T4, the Vickers case; B-8, the sts2022/nns9003 prod cases):
 * src/lib/bulkAssign.ts.
 * Run: node --experimental-strip-types scripts/check-bulk-assign.mjs
 *
 * No prerequisites, no DB, no build: every function here is pure precisely so the table can
 * be asserted directly, same reason as scripts/check-assign-gate.mjs and
 * scripts/check-homonym-rejections.mjs.
 *
 * Eight sections:
 *   1. eligibility — which OPEN rows are checkbox-selectable, and which of those are also in
 *                    the (unchanged) single-candidate bulk ACCEPT set
 *   2. candidates  — union-of-candidates + match-count computation for the picker
 *   3. partition   — which selected rows already have a chosen cwid as their own candidate
 *                    (onCandidate) vs. don't (offCandidate) — B-8: informational only, no
 *                    row is ever skipped from submission
 *   4. flags       — assignConfirmFlags: the one confirm flag a row's submit needs, mirroring
 *                    assignGate()'s own dominance rule
 *   5. buckets     — doBulkAccept-style failure bucketing for the assign submit loop
 *   6. reject buckets — T-950: bucketRejectFailures, the same shape for the bulk-reject
 *                    submit loop (only two statuses reject can fail with — see the function's
 *                    own header comment for why 422 can't occur there)
 *   7. authorKey   — the normalized "same person, different byline spelling" key behind
 *                    "Show N others like this" (T5) — variant equivalence/non-equivalence
 *   8. typedCwidPreview — T-NAG: the typed "Someone else" box's inline lookup preview text,
 *                    idle/loading/error/resolved
 */

import assert from "node:assert/strict";
import {
  isAcceptEligible, isMultiAssignEligible, isNoIdentityAssignEligible, isBulkSelectable,
  unionCandidates, partitionForAssign, assignConfirmFlags, bucketAssignFailures,
  bucketRejectFailures,
  authorKey, typedCwidPreview,
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
const noIdentitySingle = { single_candidate: true, identity_in_reciter: false, top_already_rejected: false, top_cwid: "nns9003", source: "pubmed" };

check("single-candidate, identity, not rejected, has top_cwid -> accept-eligible", isAcceptEligible(single), true);
check("...no ReCiter identity -> not accept-eligible", isAcceptEligible({ ...single, identity_in_reciter: false }), false);
check("...already rejected -> not accept-eligible", isAcceptEligible({ ...single, top_already_rejected: true }), false);
check("...no top_cwid (#938) -> not accept-eligible", isAcceptEligible({ ...single, top_cwid: undefined }), false);
check("multi-candidate is never accept-eligible, identity/rejected notwithstanding",
  isAcceptEligible({ ...multiPubmed, identity_in_reciter: true, top_cwid: "aaa2014" }), false);
check("no-identity single-candidate row is never accept-eligible (nothing to Accept into)",
  isAcceptEligible(noIdentitySingle), false);

check("multi-candidate pubmed -> assign-eligible", isMultiAssignEligible(multiPubmed), true);
check("multi-candidate scopus -> NOT assign-eligible (homonym recording is pubmed-lane only)",
  isMultiAssignEligible(multiScopus), false);
check("single-candidate row is never multi-assign-eligible", isMultiAssignEligible(single), false);

console.log("\nB-8: no-identity single-candidate rows (the nns9003 case) — assign-only:");
check("single-candidate, no ReCiter identity, real top_cwid, not rejected -> no-identity-assign-eligible",
  isNoIdentityAssignEligible(noIdentitySingle), true);
check("...an ordinary (has-identity) single-candidate row is NOT",
  isNoIdentityAssignEligible(single), false);
check("...already-rejected still excludes it (nothing left to assign)",
  isNoIdentityAssignEligible({ ...noIdentitySingle, top_already_rejected: true }), false);
check("...no top_cwid at all (#938) still excludes it — nothing to confirm against",
  isNoIdentityAssignEligible({ ...noIdentitySingle, top_cwid: undefined }), false);
check("...a multi-candidate row is never no-identity-assign-eligible (that's a different path)",
  isNoIdentityAssignEligible({ ...multiPubmed, identity_in_reciter: false }), false);
check("...scopus source is fine (the local-only write is row-scoped, source-independent)",
  isNoIdentityAssignEligible({ ...noIdentitySingle, source: "scopus" }), true);

console.log("\nbulk-selectable (open queue only):");
check("single-candidate, open -> selectable", isBulkSelectable(single, "open"), true);
check("multi-candidate pubmed, open -> selectable (T4)", isBulkSelectable(multiPubmed, "open"), true);
check("multi-candidate scopus, open -> NOT selectable", isBulkSelectable(multiScopus, "open"), false);
check("single-candidate, snoozed view -> NOT selectable (matches pre-T4 toggleSelect)",
  isBulkSelectable(single, "snoozed"), false);
check("multi-candidate pubmed, dismissed view -> NOT selectable",
  isBulkSelectable(multiPubmed, "dismissed"), false);
check("B-8: no-identity single-candidate, open -> selectable (assign-only, was NOT before B-8)",
  isBulkSelectable(noIdentitySingle, "open"), true);
check("...not accept-eligible even though it's now bulk-selectable",
  isAcceptEligible(noIdentitySingle), false);
check("...and stays unselectable outside the open view, same as every other row",
  isBulkSelectable(noIdentitySingle, "dismissed"), false);
check("a genuine no-suggestion row (top_cwid null) stays fully unselectable — #938's guarantee, unchanged",
  isBulkSelectable({ single_candidate: true, identity_in_reciter: false, top_cwid: null }, "open"), false);

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
console.log("\npartition for a chosen (already-canonicalized) cwid — B-8: onCandidate/offCandidate, nobody skipped:");

const rows = [
  { id: 1, candidates: rowA }, { id: 2, candidates: rowB }, { id: 3, candidates: rowC },
];
const candidatesOf = (r) => r.candidates;

const p1 = partitionForAssign(rows, candidatesOf, "abv9001");
check("abv9001 is on all three rows -> all onCandidate", p1.onCandidate.map((r) => r.id), [1, 2, 3]);
check("...offCandidate empty", p1.offCandidate, []);

const p2 = partitionForAssign(rows, candidatesOf, "amv2003");
check("amv2003 only on row 1 -> onCandidate just that one", p2.onCandidate.map((r) => r.id), [1]);
check("...rows 2 and 3 are offCandidate — but B-8 still submits them (see assignConfirmFlags below)",
  p2.offCandidate.map((r) => r.id), [2, 3]);

const p3 = partitionForAssign(rows, candidatesOf, "someone_else_entirely");
check("typed cwid on nobody's candidate list -> onCandidate empty", p3.onCandidate, []);
check("...all three rows land in offCandidate, none dropped (the sts2022 case: 10/10 off-candidate)",
  p3.offCandidate.map((r) => r.id), [1, 2, 3]);

// ---------------------------------------------------------------------------------------
console.log("\nassignConfirmFlags — one row's confirm flag, mirroring assignGate()'s dominance rule:");

check("on-candidate + has identity -> no flag at all (straight to write)",
  assignConfirmFlags(false, true), {});
check("off-candidate + has identity -> confirmOffCandidate",
  assignConfirmFlags(true, true), { confirmOffCandidate: "true" });
check("on-candidate + NO identity -> confirmNoIdentity (identity absence dominates even on-candidate — the nns9003 case)",
  assignConfirmFlags(false, false), { confirmNoIdentity: "true" });
check("off-candidate + NO identity -> confirmNoIdentity, NOT confirmOffCandidate (no stand-in — opposite consequences)",
  assignConfirmFlags(true, false), { confirmNoIdentity: "true" });

// ---------------------------------------------------------------------------------------
console.log("\nfailure bucketing (every selected row submits now — a bucketed 422 is a real anomaly):");

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

// ---------------------------------------------------------------------------------------
console.log("\nT-950: bulk-reject failure bucketing — only two statuses reject can fail with:");

check("empty batch -> all zero", bucketRejectFailures([]), { noProposal: 0, writeFailed: 0, other: 0 });
check("one of each + one unexplained", bucketRejectFailures([
  { status: 409 },
  { status: 502 },
  { status: 500 },
]), { noProposal: 1, writeFailed: 1, other: 1 });
check("a reason with no status at all still counts, as other",
  bucketRejectFailures([{}]), { noProposal: 0, writeFailed: 0, other: 1 });
check("multiple 409s and 502s each accumulate in their own bucket",
  bucketRejectFailures([{ status: 409 }, { status: 409 }, { status: 502 }]),
  { noProposal: 2, writeFailed: 1, other: 0 });

// ---------------------------------------------------------------------------------------
console.log("\nauthorKey — the driving T5 case: middle-initial byline variants:");

check("\"Bernard Park\" and \"Bernard J. Park\" key equal (the driving case)",
  authorKey("Bernard Park") === authorKey("Bernard J. Park"), true);
check("...and a different middle initial still keys the same",
  authorKey("Bernard J. Park") === authorKey("Bernard Q Park"), true);
check("a different first name does NOT key equal — \"Bernarda Park\" != \"Bernard Park\"",
  authorKey("Bernarda Park") === authorKey("Bernard Park"), false);
check("a different last name does NOT key equal",
  authorKey("Bernard Parker") === authorKey("Bernard Park"), false);
check("case-insensitive", authorKey("BERNARD PARK") === authorKey("bernard park"), true);
check("a single-token name keys on itself twice (no delimiter to split on)",
  authorKey("Park"), "park|park");
check("empty/undefined input keys to the empty string (never queried)",
  authorKey(""), "");
check("...same for undefined", authorKey(undefined), "");
check("extra internal whitespace doesn't change the first/last token",
  authorKey("Bernard   J.   Park") === authorKey("Bernard Park"), true);
check("leading/trailing whitespace is trimmed before tokenizing",
  authorKey("  Bernard Park  ") === authorKey("Bernard Park"), true);
// ponytail-documented ceiling: compound surnames key on the LAST token only, so two distinct
// "…berg" people with the same first name collide. This asserts that's the real, known
// behavior (not an accidental regression) rather than claiming it's handled.
check("known ceiling: a compound surname collides with any other same-first-name '…berg'",
  authorKey("Anna van der Berg") === authorKey("Anna Berg"), true);

// ---------------------------------------------------------------------------------------
console.log("\ntypedCwidPreview — T-NAG's inline preview under the typed 'Someone else' box:");

check("idle -> no preview at all (nothing typed long enough yet)",
  typedCwidPreview({ status: "idle" }), null);
check("loading -> the in-flight label, never blocking",
  typedCwidPreview({ status: "loading" }), { text: "looking up…", tone: "neutral" });
check("error -> the raw error text, verbatim, tone warn (still never blocking Assign)",
  typedCwidPreview({ status: "error", message: "Couldn't look up \"akt9003\" — HTTP 500" }),
  { text: "Couldn't look up \"akt9003\" — HTTP 500", tone: "warn" });
check("resolved + identity + name -> the arrow-name line, tone neutral",
  typedCwidPreview({ status: "resolved", cwid: "akt9003", name: "Anna K. Tiwari", hasIdentity: true }),
  { text: "→ Anna K. Tiwari", tone: "neutral" });
check("resolved + no identity -> the local-only warning, tone warn (matches NO_RECITER_IDENTITY's own framing)",
  typedCwidPreview({ status: "resolved", cwid: "zzz0000", name: null, hasIdentity: false }),
  { text: "→ zzz0000: no ReCiter identity — records on this row only", tone: "warn" });
check("resolved + identity but no name on file -> the check-the-identifier warning, tone warn",
  typedCwidPreview({ status: "resolved", cwid: "abc1234", name: null, hasIdentity: true }),
  { text: "→ no name on file for abc1234 — check the identifier", tone: "warn" });
check("resolved always renders the CANONICAL cwid the lookup returned, not whatever was typed",
  typedCwidPreview({ status: "resolved", cwid: "aaa2014", name: null, hasIdentity: false }).text.includes("aaa2014"),
  true);

console.log(`\n${n}/${n} passed\n`);
