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
check("single-candidate -> nothing (no homonym judgment to record)", R({ singleCandidate: true }), []);
check("every candidate lacking an identity -> nothing, not an error",
  R({ hasIdentity: () => false }), []);

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
check("single-candidate reopen undoes nothing, symmetric with the write",
  undo({ singleCandidate: true }), []);

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
// back. Widening is safe: a real single-candidate accept returns [] from the single_candidate
// guard, and a legacy un-backfilled multi accept issues DELETEs ReCiter answers 200 as no-ops.
const undoBlock = reopen.slice(reopen.indexOf('"known", "DELETE"'), reopen.indexOf("homonymRejectionTargets(row, reverseCwid"));
check("reopen's undo covers assigned AND accepted, so backfilled rejections stay reversible",
  /if \(row\.status === "assigned" \|\| row\.status === "accepted"\) \{/.test(undoBlock), true);

// Ordering: the curator's actual intent lands first, so a rejection failure can never leave
// people rejected for a paper that was never assigned to anyone; and the row is resolved only
// after every write, so a failure leaves it open and the (idempotent) retry finishes the job.
const iKnown = assign.indexOf('writeGoldStandard(target, pmid as number, "known", "UPDATE"');
const iOthers = assign.indexOf("homonymRejectionTargets(row, target");
const iResolve = assign.lastIndexOf('status: "assigned", resolution_cwid: target');
check("positive write, then the rejections, then the row is resolved",
  iKnown > 0 && iOthers > iKnown && iResolve > iOthers, true);
// Same shape in reverse: the known-DELETE lands before the rejection-DELETEs.
const jKnown = reopen.indexOf('"known", "DELETE"');
const jOthers = reopen.indexOf("homonymRejectionTargets(row, reverseCwid");
check("reopen undoes the positive write first, then the rejections", jKnown > 0 && jOthers > jKnown, true);

// The backfill must derive its plan through the same function, or the two can disagree about
// who gets rejected for rows resolved either side of the deploy.
const backfill = readFileSync(join(ROOT, "scripts/backfill-homonym-rejections.mjs"), "utf8");
check("the backfill script plans through the same homonymRejections()",
  /import \{ homonymRejections \} from "\.\.\/src\/lib\/assignGate\.ts"/.test(backfill), true);
check("...and is dry-run unless --apply", /const APPLY = flag\("--apply"\)/.test(backfill), true);

console.log(`\n${n}/${n} passed\n`);
