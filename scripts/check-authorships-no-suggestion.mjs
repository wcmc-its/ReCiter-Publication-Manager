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
const nearCertainLine = line(tabsSrc, "const nearCertainOnPage = rows.filter", "nearCertain filter");
const nearCertainPredicate = new Function("r", `return !!(${nearCertainLine.match(/rows\.filter\(\(r\) => (.+)\);$/)[1]});`);
check("near-certain bulk excludes a no-suggestion row even at IO 100",
  nearCertainPredicate({ single_candidate: true, identity_in_reciter: true, top_cwid: null, top_io_score: 100 }), false);
check("near-certain bulk still includes a real high-IO single-candidate row",
  nearCertainPredicate({ single_candidate: true, identity_in_reciter: true, top_cwid: "aaa2014", top_io_score: 100 }), true);
// The row predicate above is queue-blind on purpose (so it can be run standalone), so the queue
// gate is a separate line and needs its own assertion: the redesigned bulk bar renders in every
// queue for its "Showing N of M" line, and "Accept near-certain" must stay Open-only.
check("near-certain is gated on the open queue outside the predicate",
  line(tabsSrc, "const nearCertain = statusView", "nearCertain queue gate"),
  'const nearCertain = statusView === "open" ? nearCertainOnPage : [];');

// eligibleRows is `rows.filter((r) => isBulkSelectable(r, statusView))` (T4 + the select-all
// widening) — assert the delegation, then exercise the real imported function, same pattern as
// toggleSelect above. Accept safety lives downstream in selectedAcceptRows, not here.
const eligibleLine = line(tabsSrc, "const eligibleRows = statusView", "eligibleRows filter");
check("eligibleRows delegates to isBulkSelectable", eligibleLine.includes("isBulkSelectable(r, statusView)"), true);
check("header select-all-on-page excludes a no-suggestion row",
  isBulkSelectable({ single_candidate: true, identity_in_reciter: true, top_already_rejected: false, top_cwid: null }, "open"), false);
check("header select-all-on-page still includes an ordinary row",
  isBulkSelectable({ single_candidate: true, identity_in_reciter: true, top_already_rejected: false, top_cwid: "aaa2014" }, "open"), true);

// The table row renders its checkbox only when `selectable` (= isBulkSelectable(r, statusView),
// T4) — assert the delegation, then exercise isBulkSelectable directly (the same function
// toggleSelect above already covers) rather than re-deriving `selectable` via new Function.
const checkboxLine = line(tabsSrc, "{selectable ? (", "row checkbox gate");
check("the row checkbox delegates to selectable (isBulkSelectable)",
  checkboxLine === "{selectable ? (", true);
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

// Row actions: the table row always draws ✓ and ✕, disabled whenever acceptBlock / rejectBlock
// names a reason. A no-suggestion row must get a reason for both, so neither can fire.
const acceptBlockSrc = tabsSrc.slice(tabsSrc.indexOf("const acceptBlock: string | null ="), tabsSrc.indexOf("const rejectBlock ="));
check("acceptBlock has a no-suggestion reason", /: noSuggestion \? "No candidate to accept"/.test(acceptBlockSrc), true);
const rejectBlockLine = line(tabsSrc, "const rejectBlock =", "rejectBlock");
check("rejectBlock is set for a no-suggestion row", rejectBlockLine.includes("noSuggestion ?"), true);
check("✓ is disabled by acceptBlock", tabsSrc.includes("disabled={acting || !!acceptBlock}"), true);
check("✕ is disabled by rejectBlock", tabsSrc.includes("disabled={acting || !!rejectBlock}"), true);

// IO badge: a row with no top_cwid shows "—", never the score the producer left behind
// (top_io_score is not part of ReCiterDB#177's null sweep).
const { ioBadge } = await import("../src/utils/authorshipRow.ts");
check("the IO badge of a no-suggestion row is a dash even with a stale top_io_score",
  ioBadge({ top_cwid: null, top_io_score: 97.4, single_candidate: true }).text, "—");

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
