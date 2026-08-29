#!/usr/bin/env node
/**
 * Branch table for the "assign" action's confirm gate (src/lib/assignGate.ts).
 * Run: node --experimental-strip-types scripts/check-assign-gate.mjs
 *
 * No prerequisites, no DB, no build: assignGate is pure precisely so this can run anywhere.
 * Every branch it selects over in controllers/db/authorships.controller.ts ends in a
 * DynamoDB / ReCiter / MySQL write, so the table can't be exercised in place.
 */

import assert from "node:assert/strict";
import { assignGate } from "../src/lib/assignGate.ts";

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

console.log(`\n${n}/${n} passed\n`);
