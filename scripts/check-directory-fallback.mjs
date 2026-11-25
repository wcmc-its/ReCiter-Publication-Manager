/**
 * Pins the routine-lookup Cornell rule (src/lib/directory.ts cornellFallback): the auto
 * lookup a weak /authorships row fires on expand asks WCM first and Cornell (Ithaca) only
 * when WCM gave no strong hit AND the byline affiliation says "Cornell University".
 *
 * Run: node --experimental-strip-types scripts/check-directory-fallback.mjs
 */
import assert from "node:assert/strict";
import { cornellFallback, bylineCampuses } from "../src/lib/directory.ts";

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

const camp = (a) => [...bylineCampuses(a)].sort().join("+") || "none";
check("Ithaca vet byline => cornell", camp("Department of Population Medicine and Diagnostic Sciences, College of Veterinary Medicine, Cornell University, Ithaca, NY 14853."), "cornell");
check("Weill Cornell byline => wcm", camp(WCM), "wcm");
check("old 'Weill Medical College of Cornell University' => wcm, not cornell", camp("Department of Surgery, Weill Medical College of Cornell University, New York, NY"), "wcm");
check("Weill Institute (an Ithaca unit) => cornell", camp("Weill Institute for Cell and Molecular Biology, Cornell University, Ithaca, NY"), "cornell");
check("both campuses across clauses => both", camp(ITHACA + "; " + WCM), "cornell+wcm");
check("no affiliation => none", camp(""), "none");
check("elsewhere => none", camp("Department of Medicine, Columbia University, New York, NY"), "none");

console.log(`\n${n}/${n} passed`);
