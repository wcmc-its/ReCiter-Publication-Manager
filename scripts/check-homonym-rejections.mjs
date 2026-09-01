#!/usr/bin/env node
/**
 * Which of a homonym row's other candidates an assign records a rejection for, and that reopen
 * takes back exactly those (src/lib/assignGate.ts homonymRejections).
 * Run: node --experimental-strip-types scripts/check-homonym-rejections.mjs
 *
 * No prerequisites, no DB, no build — same reason as scripts/check-assign-gate.mjs: every
 * branch this selects over ends in a gold-standard write into a real person's publication
 * record, so it cannot be exercised in place.
 *
 * Three sections:
 *   1. who gets rejected — the set, and each of the four skips
 *   2. reopen           — the undo set against the write set, including the one case where
 *                         they deliberately differ
 *   3. source           — that authorships.controller.ts actually wires both directions, in
 *                         the order that makes a partial failure recoverable
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homonymRejections } from "../src/lib/assignGate.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let n = 0;
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  console.log(`  PASS ${label} -> ${JSON.stringify(actual)}`);
  n++;
};

// Live fixture, prod row 1110 on 2026-08-29: pmid 39034319, five WCM homonyms of one byline
// name, assigned to tun2001 — who is NOT top_cwid, which is what "Pick one" is for. Identity
// presence is the real thing: tan2002 and tcnguyen have no DynamoDB Identity row.
const ROW = {
  isScopus: false,
  singleCandidate: false,
  candidates: ["tdn4001", "tun2001", "tdn2001", "tan2002", "tcnguyen"],
  target: "tun2001",
};
const DDB_IDENTITY = new Set(["tun2001", "tdn2001", "tdn4001"]);
const R = (o = {}) => homonymRejections({
  hasIdentity: (c) => DDB_IDENTITY.has(c),
  hasAccepted: () => false,
  ...ROW, ...o,
});

console.log("\nwho an assign records a rejection for:");

check("the other candidates with an identity, and only those", R(), ["tdn4001", "tdn2001"]);
check("the assigned person is never rejected", R().includes(ROW.target), false);
check("no identity in ReCiter -> skipped (the write would 200 into an orphan GS row)",
  R().filter((c) => !DDB_IDENTITY.has(c)), []);
check("already ACCEPTED this pmid -> skipped (never both wrote and didn't write it)",
  R({ hasAccepted: (c) => c === "tdn2001" }), ["tdn4001"]);
check("scopus -> nothing (no pmid; gold standard is PMID-keyed)", R({ isScopus: true }), []);
// F-2 retired this bail from the live call site (the controller always passes
// singleCandidate: false now — see the source section below), but the parameter itself still
// exists on the pure function and this still describes its behavior honestly for anyone who
// passes it true.
check("singleCandidate:true still bails, though nothing live sets it anymore",
  R({ singleCandidate: true }), []);
check("every candidate lacking an identity -> nothing, not an error",
  R({ hasIdentity: () => false }), []);

// F-2 policy (verbatim from the product owner: "If I accept it for 1 person, any other person
// being considered should be a reject. This goes across the board") — a single-candidate row's
// one proposed candidate is no longer exempt from being rejected when the curator assigns
// elsewhere. The controller enforces this by always calling homonymRejections with
// singleCandidate: false (see the source section below); what decides "nothing to reject" for
// a true single-candidate row is simply that filtering out the target leaves no candidates.
console.log("\nF-2 — a single-candidate row's sole candidate is no longer exempt:");
const SOLE_ROW = { isScopus: false, singleCandidate: false, candidates: ["abt4005"] };
const S = (o = {}) => homonymRejections({
  hasIdentity: (c) => c === "abt4005", hasAccepted: () => false, ...SOLE_ROW, ...o,
});
check("assigned away from the row's only candidate -> that candidate is rejected",
  S({ target: "zzz9999" }), ["abt4005"]);
check("assigned back to the row's only candidate (the ordinary accept shape) -> nothing",
  S({ target: "abt4005" }), []);
check("the displaced sole candidate with no ReCiter identity -> still skipped",
  S({ target: "zzz9999", hasIdentity: () => false }), []);
check("the displaced sole candidate who already accepted this pmid -> still skipped",
  S({ target: "zzz9999", hasAccepted: () => true }), []);

// An off-candidate assign ("Someone else: [cwid]") on a homonym row says none of the proposed
// N wrote it AND names who did, so all N are rejected — one more than the on-candidate case.
check("assigned to someone the producer never proposed -> all N are rejected",
  R({ target: "zzz9999", hasIdentity: (c) => DDB_IDENTITY.has(c) || c === "zzz9999" }),
  ["tdn4001", "tun2001", "tdn2001"]);

// Sanity against the row as the producer left it: top_cwid is in candidates, so assigning to
// top_cwid (an accept-shaped decision made through Pick one) rejects the rest.
check("assigned to top_cwid -> the other four, minus the two with no identity",
  R({ target: "tdn4001" }), ["tun2001", "tdn2001"]);

console.log("\nreopen — the undo set against the write set:");

// reopen calls the same function with hasAccepted: () => false, because it cannot know which
// candidates the write skipped for having accepted, and a rejected-DELETE for one of them is a
// no-op (their pmid is in knownpmids, not rejectedpmids).
const undo = (o = {}) => R({ hasAccepted: () => false, ...o });

check("nobody had accepted: undo is exactly the write set", undo(), R());

// the one case the two sets differ, spelled out both ways round
const wroteWithAnAccept = R({ hasAccepted: (c) => c === "tdn2001" });
check("someone had accepted: the write skipped them", wroteWithAnAccept, ["tdn4001"]);
check("...and the undo is that write set plus their one no-op DELETE",
  undo(), [...wroteWithAnAccept, "tdn2001"]);
check("...so the undo is a superset of what the write made",
  wroteWithAnAccept.every((c) => undo().includes(c)), true);
check("...whose only extra member is the candidate the write skipped as already-accepted",
  undo().filter((c) => !wroteWithAnAccept.includes(c)), ["tdn2001"]);
check("undo of an off-candidate assign reverses all N",
  undo({ target: "zzz9999", hasIdentity: (c) => DDB_IDENTITY.has(c) || c === "zzz9999" }),
  ["tdn4001", "tun2001", "tdn2001"]);
check("a candidate who lost their identity since the assign is not deleted either",
  undo({ hasIdentity: (c) => c === "tdn4001" }), ["tdn4001"]);
check("scopus reopen undoes nothing, symmetric with the write", undo({ isScopus: true }), []);
// Same legacy-parameter note as the write-side check above: nothing live sets singleCandidate
// true anymore, but the pure function still honors it if asked.
check("singleCandidate:true reopen undo still bails, though nothing live sets it anymore",
  undo({ singleCandidate: true }), []);

console.log("\nF-2 — reopen undoes the single-candidate displaced rejection too:");
const undoSole = (o = {}) => S({ hasAccepted: () => false, ...o });
check("nobody had accepted: undo of the sole displaced candidate is exactly the write set",
  undoSole({ target: "zzz9999" }), S({ target: "zzz9999" }));
const wroteSoleWithAnAccept = S({ target: "zzz9999", hasAccepted: () => true });
check("the sole displaced candidate had already accepted: the write skipped them",
  wroteSoleWithAnAccept, []);
check("...and the undo (checkAccepted=false) reverses their no-op DELETE anyway, symmetric with the multi-candidate case",
  undoSole({ target: "zzz9999" }), ["abt4005"]);

// ---------------------------------------------------------------------------------------
// Source: the table above is worthless if the controller doesn't run it, or runs it in an
// order that can strand a half-written decision.
console.log("\nsource — controllers/db/authorships.controller.ts wires both directions:");
const src = readFileSync(join(ROOT, "controllers/db/authorships.controller.ts"), "utf8");
const assign = src.slice(src.indexOf('case "assign": {'), src.indexOf('case "reject": {'));
const reopen = src.slice(src.indexOf('case "reopen": {'), src.indexOf("      default:"));

check("assign and reopen cases located", assign.length > 500 && reopen.length > 500, true);
check("the live half re-checks identity AND acceptance, per write, not from the row",
  /reciterIdentitySet\(others\)/.test(src) && /getKnownPmidsByCwid\(others\)/.test(src), true);
check("assign writes them as ordinary rejections",
  /writeGoldStandard\(other, pmid as number, "rejected", "UPDATE", curator\.userID\)/.test(assign), true);
check("...and 502s on the first failure, like case \"reject\"",
  /Homonym rejection write failed/.test(assign), true);
check("...and logs a REJECTED feedback row for each, like case \"reject\"",
  /appendFeedbackLog\(curator\.userID, other, pmid as number, "REJECTED"\)/.test(assign), true);
check("reopen DELETEs them",
  /writeGoldStandard\(other, pmid as number, "rejected", "DELETE", curator\.userID\)/.test(reopen), true);
check("reopen passes checkAccepted=false, so it can undo what the write skipped as accepted",
  /homonymRejectionTargets\(row, reverseCwid, pmid as number, false\)/.test(reopen), true);
// Covers accepted as well as assigned. `assign` is the only ACTION that writes these, but the
// backfill writes them onto already-resolved rows and defaults to assigned,accepted — scoping
// the undo to "assigned" alone strands every rejection it lands on an accepted row, with no way
// back. Widening is safe: a real single-candidate accept never calls homonymRejectionTargets at
// all (the "accept" action is gated on row.single_candidate and never touches it), and a legacy
// un-backfilled multi accept issues DELETEs ReCiter answers 200 as no-ops.
// Coverage now comes from the OUTER branch condition alone (not a nested status check) — F-2
// moved the homonym-undo loop out from under the assignee-has-identity branch, so it must run
// unconditionally for every reopen of an "accepted" or "assigned" row.
check("reopen's undo covers assigned AND accepted via the outer branch condition",
  /\} else if \(\(row\.status === "accepted" \|\| row\.status === "assigned"\) && reverseCwid\) \{/.test(reopen), true);
// F-2: the homonym-undo loop must NOT be nested inside the "was this row local-only" else —
// a local-only assign's assignee never has one, and that must not skip undoing what it rejected
// for everybody else. Assert this structurally by indentation: the local-only if/else body sits
// one level deeper (12 spaces) than the if/else statement itself and the loop that follows it
// (10 spaces) — if the loop were still nested inside the else arm it would match the deeper
// indent instead.
// PM#949 re-anchor: the branch condition used to test reciterIdentitySet() directly; it now
// tests a `wasLocalOnly` const (marker-first, live-identity-check fallback — see
// src/lib/localOnlyMarker.ts) so this regex was re-pointed at the new condition text. The
// structural claim under test — body indentation, and the loop's position outside the else arm
// — is unchanged and still holds.
check("the local-only if/else body is indented one level deeper than the statement",
  /\n {10}if \(wasLocalOnly\) \{\n {12}console\.log/.test(reopen), true);
check("the homonym-undo loop sits at the if/else's OWN indentation, not nested inside its else arm",
  /\n {10}for \(const other of await homonymRejectionTargets\(row, reverseCwid/.test(reopen), true);
check("...and textually after the local-only if/else, not before it",
  reopen.indexOf("if (wasLocalOnly) {")
    < reopen.indexOf("for (const other of await homonymRejectionTargets(row, reverseCwid"), true);

// Ordering: the curator's actual intent lands first, so a rejection failure can never leave
// people rejected for a paper that was never assigned to anyone; and the row is resolved only
// after every write, so a failure leaves it open and the (idempotent) retry finishes the job.
const iKnown = assign.indexOf('writeGoldStandard(target, pmid as number, "known", "UPDATE"');
// lastIndexOf, not indexOf: F-2 added two earlier calls to homonymRejectionTargets(row, target
// in this same case block (the confirm_no_identity preview and the local_only recording) —
// this ordering check is specifically about the authoritative "write" path's own call, which is
// textually the last one.
const iOthers = assign.lastIndexOf("homonymRejectionTargets(row, target");
const iResolve = assign.lastIndexOf('status: "assigned", resolution_cwid: target');
check("positive write, then the rejections, then the row is resolved",
  iKnown > 0 && iOthers > iKnown && iResolve > iOthers, true);
// Same shape in reverse: the known-DELETE lands before the rejection-DELETEs.
const jKnown = reopen.indexOf('"known", "DELETE"');
const jOthers = reopen.indexOf("homonymRejectionTargets(row, reverseCwid");
check("reopen undoes the positive write first, then the rejections", jKnown > 0 && jOthers > jKnown, true);

// ---------------------------------------------------------------------------------------
// F-2 — the controller wires the new policy, not just the pure function above.
console.log("\nF-2 — the controller applies the policy in every reachable shape:");

const hrt = src.slice(
  src.indexOf("async function homonymRejectionTargets"),
  src.indexOf("// POST /api/db/authorships/action"));
check("homonymRejectionTargets located", hrt.length > 200, true);
check("the early-return guard no longer exempts single-candidate rows",
  /row\.single_candidate/.test(hrt), false);
check("...only scopus and 'no other candidate left' remain",
  /if \(isScopus \|\| others\.length === 0\) return \[\];/.test(hrt), true);
check("homonymRejections is called with singleCandidate: false unconditionally",
  /singleCandidate: false/.test(hrt), true);

const localOnly = assign.slice(assign.indexOf('if (gate === "local_only") {'), assign.indexOf('// gate === "write":'));
check("local_only block located", localOnly.length > 200, true);
check("local_only records the same homonym rejections the write path does",
  /const alsoRejected = await homonymRejectionTargets\(row, target, pmid as number\);/.test(localOnly), true);
check("...writes them as ordinary GoldStandard rejections",
  /writeGoldStandard\(other, pmid as number, "rejected", "UPDATE", curator\.userID\)/.test(localOnly), true);
check("...and logs a REJECTED feedback row for each",
  /appendFeedbackLog\(curator\.userID, other, pmid as number, "REJECTED"\)/.test(localOnly), true);
check("the assignee themselves still gets nothing written directly (no writeGoldStandard/addExternalArticle/appendFeedbackLog for `target`)",
  /writeGoldStandard\(target,/.test(localOnly)
    || /addExternalArticle\(target,/.test(localOnly)
    || /appendFeedbackLog\(curator\.userID, target,/.test(localOnly), false);

const confirmNoIdentity = assign.slice(assign.indexOf('if (gate === "confirm_no_identity") {'), assign.indexOf('// Data-integrity guard, the same direction'));
check("confirm_no_identity block located", confirmNoIdentity.length > 200, true);
check("the 422 previews the same homonymRejectionTargets() the write and reopen use",
  /const alsoRejected = await homonymRejectionTargets\(row, target, pmid as number\);/.test(confirmNoIdentity), true);
check("...and names them in the message when any exist",
  /also records "not mine" for/.test(confirmNoIdentity), true);
check("...via identityLabel, not a bare cwid list",
  /identityLabel\(c\)/.test(confirmNoIdentity), true);

// The backfill must derive its plan through the same function, or the two can disagree about
// who gets rejected for rows resolved either side of the deploy.
const backfill = readFileSync(join(ROOT, "scripts/backfill-homonym-rejections.mjs"), "utf8");
check("the backfill script plans through the same homonymRejections()",
  /import \{ homonymRejections \} from "\.\.\/src\/lib\/assignGate\.ts"/.test(backfill), true);
check("...and is dry-run unless --apply", /const APPLY = flag\("--apply"\)/.test(backfill), true);

console.log(`\n${n}/${n} passed\n`);
