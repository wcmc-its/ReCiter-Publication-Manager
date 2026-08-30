#!/usr/bin/env node
/**
 * Branch table for the "assign" action's confirm gate, and the cwid canonicalization that now
 * feeds it (src/lib/assignGate.ts).
 * Run: node --experimental-strip-types scripts/check-assign-gate.mjs
 *
 * No prerequisites, no DB, no build: both functions are pure precisely so this can run
 * anywhere. Every branch they select over in controllers/db/authorships.controller.ts ends in
 * a DynamoDB / ReCiter / MySQL write, so the table can't be exercised in place.
 *
 * Three sections:
 *   1. assignGate    — which path a (offCandidate, hasIdentity, confirms) tuple takes
 *   2. canonicalCwid — which Identity record a typed cwid resolves to
 *   3. end to end    — the four cases a curator can actually type, composed, plus a source
 *                      check that the controller really does run on the canonical form
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assignGate, canonicalCwid } from "../src/lib/assignGate.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const G = (o) => assignGate({
  offCandidate: false, hasIdentity: true, confirmNoIdentity: false, confirmOffCandidate: false, ...o,
});

let n = 0;
const check = (label, actual, expected) => {
  assert.equal(actual, expected, `${label}: expected ${expected}, got ${actual}`);
  console.log(`  PASS ${label} -> ${actual}`);
  n++;
};

console.log("\nassignGate branch table:");

// NEW: a real person the producer didn't propose. Was a flat 400; now one confirm.
check("off-candidate + identity + unconfirmed => confirm",
  G({ offCandidate: true }), "confirm_off_candidate");
check("off-candidate + identity + confirmed => authoritative write",
  G({ offCandidate: true, confirmOffCandidate: true }), "write");

// UNCHANGED: #925 no-identity local-only path.
check("no identity + unconfirmed => no-identity confirm",
  G({ hasIdentity: false }), "confirm_no_identity");
check("no identity + confirmed => local-only",
  G({ hasIdentity: false, confirmNoIdentity: true }), "local_only");
check("no identity is asked even when on-candidate",
  G({ hasIdentity: false, offCandidate: false }), "confirm_no_identity");

// UNCHANGED: the ordinary pick-a-candidate assign never sees a confirm.
check("on-candidate + identity => write, no confirm",
  G({}), "write");
check("on-candidate + identity, confirms present, still just writes",
  G({ confirmNoIdentity: true, confirmOffCandidate: true }), "write");

// The two confirmations are not interchangeable — each only clears its own gate.
check("off-candidate confirm does NOT clear the no-identity gate",
  G({ offCandidate: true, hasIdentity: false, confirmOffCandidate: true }), "confirm_no_identity");
check("no-identity confirm does NOT clear the off-candidate gate",
  G({ offCandidate: true, confirmNoIdentity: true }), "confirm_off_candidate");

// ---------------------------------------------------------------------------------------
// canonicalCwid: DynamoDB keys are byte-exact, so what the curator TYPED is not necessarily
// the identifier ReCiter files things under. `found` is what reciterIdentitySet() returned
// for [typed, typed.toLowerCase()].
console.log("\ncanonicalCwid — the identifier as ReCiter stores it:");
const ddb = (...uids) => new Set(uids);

check("mis-cased cwid resolves to the stored lowercase identity",
  canonicalCwid("Aaa2014", ddb("aaa2014")), "aaa2014");
check("an already-lowercase cwid is left exactly alone",
  canonicalCwid("aaa2014", ddb("aaa2014")), "aaa2014");
check("unknown in either case: nothing to canonicalize, keep what was typed",
  canonicalCwid("Zzz9999", ddb()), "Zzz9999");
// 13 of the 35,052 DynamoDB uids have a lowercase twin that is a SEPARATE Identity row, and
// the mixed-case one is frequently the live one ('DLAMB' 131 person_article rows, 'dlamb' 0).
// 'Kym9003' and 'kym9003' are two different people. Lowercasing unconditionally would file
// the authorship under the wrong record; a byte-exact hit therefore wins.
check("byte-exact hit beats the lowercase twin when BOTH exist",
  canonicalCwid("DLAMB", ddb("DLAMB", "dlamb")), "DLAMB");
check("...and the lowercase form of a colliding pair still resolves to itself",
  canonicalCwid("dlamb", ddb("DLAMB", "dlamb")), "dlamb");

// ---------------------------------------------------------------------------------------
// End to end: what the server DOES with a cwid a curator types into "Someone else". Fixtures
// are live values measured against prod on 2026-08-29 — open row 31213 proposes a single
// candidate 'aaa2014'; 'aaa2010' has a DynamoDB identity but is not on that row; 'aaa2001' is
// named by the queue but has no DynamoDB identity at all.
const ROW_CANDIDATES = ["aaa2014"];
const DDB = ddb("aaa2014", "aaa2010");
const decide = (typed, confirms = {}) => {
  const found = DDB;                                   // reciterIdentitySet([typed, lower])
  const target = canonicalCwid(typed, found);          // <- the fix
  const gate = assignGate({
    offCandidate: !new Set(ROW_CANDIDATES).has(target),
    hasIdentity: found.has(target),
    confirmNoIdentity: false, confirmOffCandidate: false, ...confirms,
  });
  return `${target} / ${gate}`;
};

console.log("\nend to end — typed cwid -> (record written to / path taken), row 31213:");
check("mis-cased, on this row      Aaa2014", decide("Aaa2014"), "aaa2014 / write");
check("on-candidate                aaa2014", decide("aaa2014"), "aaa2014 / write");
check("off-candidate, has identity aaa2010", decide("aaa2010"), "aaa2010 / confirm_off_candidate");
check("  ...once confirmed                ", decide("aaa2010", { confirmOffCandidate: true }), "aaa2010 / write");
check("no ReCiter identity         aaa2001", decide("aaa2001"), "aaa2001 / confirm_no_identity");
check("  ...once confirmed                ", decide("aaa2001", { confirmNoIdentity: true }), "aaa2001 / local_only");

// The regression this guards: WITHOUT canonicalCwid, the merged DynamoDB-backed oracle sends
// a mis-cased cwid down the local-only path — the curator is told a real person has no ReCiter
// identity, and confirming files the authorship where their publication list will never see it.
const unfixed = assignGate({
  offCandidate: !new Set(ROW_CANDIDATES).has("Aaa2014"), hasIdentity: DDB.has("Aaa2014"),
  confirmNoIdentity: false, confirmOffCandidate: false,
});
check("pre-fix, the same keystrokes went to the wrong path", unfixed, "confirm_no_identity");

// ---------------------------------------------------------------------------------------
// Source: the pure table above is worthless if the controller still compares or writes the raw
// keystrokes. Everything after the canonicalization must speak in `target`.
console.log("\nsource — controllers/db/authorships.controller.ts runs on the canonical form:");
const src = readFileSync(join(ROOT, "controllers/db/authorships.controller.ts"), "utf8");
const assign = src.slice(src.indexOf('case "assign": {'), src.indexOf('case "reject": {'));
check("assign case located", assign.length > 500, true);
check("asks DynamoDB for the typed cwid AND its lowercase in one call",
  /reciterIdentitySet\(\[chosen, chosen\.toLowerCase\(\)\]\)/.test(assign), true);
check("resolves it through canonicalCwid", /canonicalCwid\(chosen, found\)/.test(assign), true);
check("both gate facts are computed from target, not from the keystrokes",
  /offCandidate = !allowed\.has\(target\)/.test(assign) && /hasIdentity = found\.has\(target\)/.test(assign), true);
// from the first comparison onward, the keystrokes must not appear again — not in a branch,
// not in a message, and above all not in a write.
check("no raw `chosen` survives past the canonicalization",
  assign.slice(assign.indexOf("const offCandidate")).includes("chosen"), false);
for (const sink of ["writeGoldStandard(target,", "addExternalArticle(target,",
  "getRejectedPmidsByCwid([target])", "appendFeedbackLog(curator.userID, target,",
  "resolution_cwid: target", "identityLabel(target)"]) {
  check(`writes through target: ${sink}`, assign.includes(sink), true);
}
// F2: the off-candidate confirm must be able to NAME people the IDM roster has no name for —
// 2,140 of the 26,551 reachable cwids (8.1%): residents, fellows, non-faculty staff.
check("identityLabel falls back to the DynamoDB primaryName when the roster is silent",
  /identityPrimaryName\(cwid\)/.test(src) && /primaryName/.test(src), true);

console.log(`\n${n}/${n} passed\n`);
