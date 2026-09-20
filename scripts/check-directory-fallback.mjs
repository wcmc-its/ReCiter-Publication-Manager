/**
 * Pins the routine-lookup Cornell rule (src/lib/directory.ts cornellFallback): the auto
 * lookup a weak /authorships row fires on expand asks WCM first and Cornell (Ithaca) only
 * when WCM gave no strong hit AND the byline affiliation says "Cornell University".
 *
 * Run: node --experimental-strip-types scripts/check-directory-fallback.mjs
 */
import assert from "node:assert/strict";
import { cornellFallback } from "../src/lib/directory.ts";

const ITHACA = "Department of Physics, Cornell University, Ithaca, NY.";
const WCM = "Division of Pulmonary and Critical Care Medicine, Weill Cornell Medicine, New York, NY.";
const nobody = [];
const weak = [{ depts: ["Surgery"], exactName: false }];
const deptHit = [{ depts: ["Physics"], exactName: false }];
const exactHit = [{ depts: ["Surgery"], exactName: true }];

let n = 0;
const check = (label, actual, expected) => {
  assert.equal(actual, expected, `${label}: expected ${expected}, got ${actual}`);
  console.log(`  PASS ${label} -> ${actual}`);
  n++;
};

check("Ithaca affiliation, WCM found nobody => ask Cornell", cornellFallback(nobody, ITHACA), true);
check("Ithaca affiliation, WCM found only a weak homonym => ask Cornell", cornellFallback(weak, ITHACA), true);
check("Ithaca affiliation, WCM found someone in the byline's dept => stop", cornellFallback(deptHit, ITHACA), false);
check("Ithaca affiliation, WCM found the exact name => stop", cornellFallback(exactHit, ITHACA), false);
check("Weill Cornell affiliation never asks Cornell ('Weill Cornell Medicine' is not 'Cornell University')", cornellFallback(nobody, WCM), false);
check("no affiliation never asks Cornell", cornellFallback(nobody, ""), false);
check("'Cornell  University' with odd whitespace/case still counts", cornellFallback(nobody, "cornell  UNIVERSITY, Ithaca"), true);

console.log(`\n${n}/${n} passed`);
