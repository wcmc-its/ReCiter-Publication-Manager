#!/usr/bin/env node
/**
 * Guards #938's "no suggestion" state — an open authorship_review row with top_cwid NULL
 * (ReCiterDB#177 nulls the producer's candidate columns on 474 rows the merged matcher no
 * longer matches to anyone). Every gate below is keyed off top_cwid itself, never off
 * identity_in_reciter, which is vacuously true when top_cwid is null and so cannot see this
 * case (`!r.top_cwid || knownIdentities.has(...)`).
 * Run: node scripts/check-authorships-no-suggestion.mjs
 *
 * No prerequisites, no DB, no build. Where a gate is a plain boolean expression this pulls the
 * literal text out of the two source files and runs it for real via `new Function` — genuine
 * behavior, not a string match — against a no-suggestion fixture and an ordinary-row fixture.
 * Only the two JSX branches that can't be evaluated without a renderer (the right-rail actions,
 * and the evidence-panel note) fall back to a scoped string check on the exact slice.
 *
 * Section 2's own gates (toggleSelect/eligibleRows/the checkbox) now delegate to
 * isAcceptEligible/isBulkSelectable (src/lib/bulkAssign.ts, T4) rather than carrying their own
 * inline predicate — imported directly (same as scripts/check-bulk-assign.mjs) and exercised for
 * real, plus a plain string check that the call sites actually delegate to them, so a future
 * revert to an inline predicate that happens to agree today still gets caught structurally.
 *
 * Four sections:
 *   1. doActionAsync guard   — accept/reject on a no-suggestion row never reaches the network
 *   2. bulk eligibility      — toggleSelect, nearCertain, eligibleRows, checkbox disabled
 *   3. authorshipSelectable  — the "Select all N matching" server-side eligibility filter
 *   4. rendering             — no Accept/Reject pair, no live score, no false "unique match"
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isAcceptEligible, isBulkSelectable } from "../src/lib/bulkAssign.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tabsSrc = readFileSync(join(ROOT, "src/components/elements/Authorships/AuthorshipsTabs.tsx"), "utf8");
const controllerSrc = readFileSync(join(ROOT, "controllers/db/authorships.controller.ts"), "utf8");

let n = 0;
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  console.log(`  PASS ${label} -> ${JSON.stringify(actual)}`);
  n++;
};
// pull one exact source line (minus indentation) so a predicate can be handed to `new Function`
// verbatim — if the line ever moves or is reworded, this throws instead of matching the wrong
// thing silently.
const line = (src, needle, label) => {
  const found = src.split("\n").find((l) => l.includes(needle));
  assert.ok(found, `source line not found (moved or reworded?): ${label}`);
  return found.trim();
};

// ---------------------------------------------------------------------------------------
console.log("\n1. doActionAsync guard — accept/reject never fire the fetch for a no-suggestion row:");
const guardLine = line(tabsSrc, 'action === "accept" || action === "reject"', "doActionAsync guard");
const guard = new Function("action", "row", `return (${guardLine.replace(/^if \(/, "").replace(/\)\s*\{$/, "")});`);
check("accept blocked, top_cwid null", guard("accept", { top_cwid: null }), true);
check("reject blocked, top_cwid undefined", guard("reject", { top_cwid: undefined }), true);
check("accept allowed once a candidate exists", guard("accept", { top_cwid: "aaa2014" }), false);
check("unrelated actions (snooze) never blocked by this guard", guard("snooze", { top_cwid: null }), false);

// ---------------------------------------------------------------------------------------
console.log("\n2. bulk eligibility — every path a curator can select/accept a batch through:");

// toggleSelect (AuthorshipsTabs.tsx) is `if (!isBulkSelectable(row, statusView)) return;` —
// assert the call site really delegates, then exercise the real imported function.
const toggleLine = line(tabsSrc, "if (!isBulkSelectable(row, statusView)) return;", "toggleSelect guard");
check("toggleSelect's guard line delegates to isBulkSelectable", toggleLine.length > 0, true);
check("toggleSelect (isBulkSelectable) refuses a no-suggestion row",
  isBulkSelectable({ single_candidate: true, top_cwid: null }, "open"), false);
check("toggleSelect still allows an ordinary single-candidate open row",
  isBulkSelectable({ single_candidate: true, top_cwid: "aaa2014", identity_in_reciter: true }, "open"), true);

// Array.prototype.filter only cares about truthiness — the real expression short-circuits on
// `r.top_cwid` and returns null, not false, for a no-suggestion row. `!!` reproduces exactly
// what .filter() itself does with that return value, without softening the assertion.
const nearCertainLine = line(tabsSrc, "const nearCertain = rows.filter", "nearCertain filter");
const nearCertainPredicate = new Function("r", `return !!(${nearCertainLine.match(/rows\.filter\(\(r\) => (.+)\);$/)[1]});`);
check("near-certain bulk excludes a no-suggestion row even at IO 100",
  nearCertainPredicate({ single_candidate: true, identity_in_reciter: true, top_cwid: null, top_io_score: 100 }), false);
check("near-certain bulk still includes a real high-IO single-candidate row",
  nearCertainPredicate({ single_candidate: true, identity_in_reciter: true, top_cwid: "aaa2014", top_io_score: 100 }), true);

// eligibleRows is `rows.filter(isAcceptEligible)` (T4) — assert the delegation, then exercise
// the real imported function, same pattern as toggleSelect above.
const eligibleLine = line(tabsSrc, "const eligibleRows = statusView", "eligibleRows filter");
check("eligibleRows delegates to isAcceptEligible", eligibleLine.includes("rows.filter(isAcceptEligible)"), true);
check("header select-all-on-page excludes a no-suggestion row",
  isAcceptEligible({ single_candidate: true, identity_in_reciter: true, top_already_rejected: false, top_cwid: null }), false);
check("header select-all-on-page still includes an ordinary row",
  isAcceptEligible({ single_candidate: true, identity_in_reciter: true, top_already_rejected: false, top_cwid: "aaa2014" }), true);

// The row checkbox is `disabled={!selectable}` where `selectable = isBulkSelectable(r, statusView)`
// (T4) — assert the delegation, then exercise isBulkSelectable directly (the same function
// toggleSelect above already covers) rather than re-deriving `selectable` via new Function.
const checkboxLine = line(tabsSrc, "input type=\"checkbox\" disabled=", "checkbox disabled expression");
check("the row checkbox delegates to !selectable (isBulkSelectable)",
  checkboxLine.includes("disabled={!selectable}"), true);
check("the row checkbox is disabled for a no-suggestion open row",
  !isBulkSelectable({ single_candidate: true, top_cwid: null }, "open"), true);
check("the row checkbox stays enabled for an ordinary open row",
  !isBulkSelectable({ single_candidate: true, top_cwid: "aaa2014", identity_in_reciter: true }, "open"), false);

// ---------------------------------------------------------------------------------------
console.log("\n3. authorshipSelectable — cross-page \"Select all N matching\":");
const selectableFn = controllerSrc.slice(
  controllerSrc.indexOf("export const authorshipSelectable"),
  controllerSrc.indexOf("export const authorshipSummary"),
);
assert.ok(selectableFn.length > 200, "authorshipSelectable located");
const selectableLine = line(selectableFn, "knownIdentities.has(String(r.top_cwid)))", "authorshipSelectable eligibility filter");
const selectablePredicate = new Function("r", "knownIdentities",
  `return (${selectableLine.match(/\.filter\(\(r: any\) => (.+)\)$/)[1]});`);
check("a no-suggestion row never enters a cross-page bulk selection",
  selectablePredicate({ top_cwid: null }, new Set(["whatever-is-known"])), false);
check("an ordinary row known to ReCiter still qualifies",
  selectablePredicate({ top_cwid: "aaa2014" }, new Set(["aaa2014"])), true);
check("an ordinary row NOT known to ReCiter is still excluded (pre-existing, unchanged)",
  selectablePredicate({ top_cwid: "zzz9999" }, new Set(["aaa2014"])), false);

// ---------------------------------------------------------------------------------------
console.log("\n4. rendering — the card itself:");

// Right-rail actions: the noSuggestion branch of the isMulti/noSuggestion/noIdentity/
// alreadyRejected chain must not be able to fire accept or reject.
const rightRail = tabsSrc.slice(tabsSrc.indexOf('isMulti ? (\n              <button style={btn("ghost")}'), tabsSrc.indexOf(") : noIdentity ? ("));
const noSuggestionBranch = rightRail.slice(rightRail.indexOf(": noSuggestion ? ("));
check("right-rail no-suggestion branch found", noSuggestionBranch.length > 20, true);
check("it never calls onAction(\"accept\")", noSuggestionBranch.includes('onAction("accept")'), false);
check("it never calls onAction(\"reject\")", noSuggestionBranch.includes('onAction("reject")'), false);
check("it reuses the existing noIdentityPillStyle rather than a new style object",
  noSuggestionBranch.includes("noIdentityPillStyle"), true);

// ScoreRail: the top_cwid-null early return (code only, not its own explanatory comment, which
// names top_io_score precisely to say why the branch exists) must not reference the score it's
// suppressing, and must come before the isMulti/isAbsent checks that follow it.
const scoreRailFnStart = tabsSrc.indexOf("const ScoreRail = ");
const scoreRailBranchStart = tabsSrc.indexOf("if (!r.top_cwid) {", scoreRailFnStart);
const scoreRailIsMultiStart = tabsSrc.indexOf("if (isMulti) {", scoreRailFnStart);
check("ScoreRail's no-suggestion branch renders before the isMulti/isAbsent checks",
  scoreRailBranchStart > scoreRailFnStart && scoreRailBranchStart < scoreRailIsMultiStart, true);
const scoreRailBranchCode = tabsSrc.slice(scoreRailBranchStart, scoreRailIsMultiStart);
check("...and its code never touches top_io_score", scoreRailBranchCode.includes("top_io_score"), false);

// SingleEvidence: the noSuggestion arm (the true-branch only — the false branch is the
// pre-existing scopusNote/ioFgNote choice, still correct for every other row) must not call
// either evidence-note helper.
const noteStart = tabsSrc.lastIndexOf("<span>{noSuggestion");
const noteFalseBranchStart = tabsSrc.indexOf(': r.source === "scopus" ? scopusNote(r) : ioFgNote(r)', noteStart);
assert.ok(noteStart > 0 && noteFalseBranchStart > noteStart, "SingleEvidence note ternary located");
const noteTrueBranch = tabsSrc.slice(noteStart, noteFalseBranchStart);
check("the no-suggestion note's true branch never calls ioFgNote", noteTrueBranch.includes("ioFgNote("), false);
check("the no-suggestion note's true branch never calls scopusNote", noteTrueBranch.includes("scopusNote("), false);

// AssignOther ("Someone else") is rendered unconditionally for every non-multi row, including
// no-suggestion ones — this asserts the call site carries no noSuggestion/noIdentity guard.
const assignOtherCall = line(tabsSrc, "<AssignOther rowId=", "AssignOther render call");
check("AssignOther's own call site is not gated on noSuggestion",
  assignOtherCall.includes("noSuggestion"), false);

console.log(`\n${n}/${n} passed\n`);
