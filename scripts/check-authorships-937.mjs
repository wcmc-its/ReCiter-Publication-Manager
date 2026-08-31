#!/usr/bin/env node
/**
 * PM#937 — three small changes on top of the typed-cwid assign flow (#936), guarded by source
 * inspection so this runs with no DB, no AWS creds, no build (same reason as
 * scripts/check-assign-gate.mjs — every branch these touch ends in a write into a real
 * person's record, or a live UI, neither of which this can exercise in place).
 * Run: node scripts/check-authorships-937.mjs
 *
 * Three sections, one per change in the issue:
 *   1. identityLabel — the byline-shaped `person` name leads, the legal `identity` name is
 *      still read (not deleted) and still supplies the department.
 *   2. the off-candidate confirm gains a sibling guard: an assign target who already has this
 *      pmid ACCEPTED 422s instead of writing a silent no-op merge.
 *   3. the overflow menu's "Assign to someone else…" item is a shortcut to the existing
 *      <AssignOther> input (expand + focus) — not a second input.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
let failures = 0;
const assert = (cond, label) => {
  console.log(`  ${cond ? PASS : FAIL} ${label}`);
  if (!cond) failures++;
};

const controllerSrc = readFileSync(join(ROOT, "controllers/db/authorships.controller.ts"), "utf8");
const tabsSrc = readFileSync(join(ROOT, "src/components/elements/Authorships/AuthorshipsTabs.tsx"), "utf8");

// ---------------------------------------------------------------------------------------
console.log("\n1. identityLabel — byline name leads, legal name stays in the system:");
const labelFn = controllerSrc.slice(
  controllerSrc.indexOf("async function identityLabel"),
  controllerSrc.indexOf("async function identityPrimaryName"),
);
assert(labelFn.length > 100, "identityLabel() found");
assert(/models\.Person\.findOne/.test(labelFn), "reads the `person` mirror (byline-shaped name)");
assert(/personIdentifier:\s*cwid/.test(labelFn), "person lookup is keyed by the same cwid");
assert(/models\.Identity\.findOne/.test(labelFn), "still reads the IDM roster `identity` — legal name is not deleted");
assert(/bylineName\s*\|\|\s*legalName\s*\|\|\s*await identityPrimaryName\(cwid\)/.test(labelFn),
  "the byline name is tried first, legal name second, DynamoDB primaryName last");
assert(/row\?\.primaryAcademicDepartment/.test(labelFn), "department still comes from `identity`, unaffected");

// ---------------------------------------------------------------------------------------
console.log("\n2. assign — an already-ACCEPTED target 422s instead of a silent no-op:");
const assignCase = controllerSrc.slice(
  controllerSrc.indexOf('case "assign": {'), controllerSrc.indexOf('case "reject": {'),
);
assert(assignCase.length > 500, "assign case located");
const knownGuard = assignCase.slice(
  assignCase.indexOf("hasIdentity && !isScopus && pmid != null"),
  assignCase.indexOf("confirm_off_candidate", assignCase.indexOf("hasIdentity && !isScopus && pmid != null")),
);
assert(knownGuard.length > 20, "the new guard is located");
assert(/getKnownPmidsByCwid\(\[target\]\)/.test(knownGuard), "checks knownpmids for `target`, not just rejectedpmids");
assert(/status\(422\)/.test(knownGuard), "422, not 409 — consistent with the other confirm-shaped responses on this path");
assert(/ACCEPTED/.test(knownGuard) && /Dismiss/.test(knownGuard),
  "message names what happened (ACCEPTED) and points at Dismiss, per the issue");
// must run before confirm_off_candidate can fire, so an off-candidate-but-already-accepted
// target gets the more useful message
assert(assignCase.indexOf("hasIdentity && !isScopus && pmid != null") < assignCase.indexOf('gate === "confirm_off_candidate"'),
  "the guard runs before the off-candidate 422, not after");
// gate can be "local_only" with hasIdentity false (confirmed, no identity); the guard must
// not run getKnownPmidsByCwid for a cwid with no Identity record, so it has to be gated on
// hasIdentity itself rather than on which `gate` branch is active.
assert(/if \(hasIdentity && !isScopus && pmid != null/.test(assignCase),
  "the guard's own condition leads with hasIdentity, not derived from `gate`");

// ---------------------------------------------------------------------------------------
console.log("\n3. overflow menu — a shortcut to the existing input, not a new one:");
const menuBlock = tabsSrc.slice(tabsSrc.indexOf("{/* overflow menu:"), tabsSrc.indexOf("{/* person-type multiselect menu */}"));
assert(menuBlock.length > 200, "overflow menu block located");
assert(/Assign to someone else/.test(menuBlock), "menu item text present");
assert(/focusAssignOther\(id\)/.test(menuBlock), "clicking it calls the shared focusAssignOther(id) helper");
// The expand+focus behavior itself moved into that shared helper (also used by the
// no-identity pill and a ghost Assign button) — check it there, not in the menu block.
const focusFnStart = tabsSrc.indexOf("const focusAssignOther = useCallback");
const focusFn = tabsSrc.slice(focusFnStart, tabsSrc.indexOf("}, []);", focusFnStart) + "}, []);".length);
assert(focusFn.length > 20, "focusAssignOther helper located");
assert(/setExpanded\(id\)/.test(focusFn), "clicking it expands the card");
assert(/getElementById\(`otherCwid-\$\{id\}`\)\.focus\(\)/.test(focusFn) || /getElementById\(`otherCwid-\$\{id\}`\)\?\.focus\(\)/.test(focusFn),
  "and focuses the SAME input <AssignOther> renders (id `otherCwid-${rowId}`)");
assert(!/<input/.test(menuBlock), "no text input was added to the menu itself");
// the collapsed card (everything before the first isExpanded-gated block) must not gain one either
const collapsedCard = tabsSrc.slice(tabsSrc.indexOf("const AuthorshipCard ="), tabsSrc.indexOf("{isExpanded && ("));
assert(!/otherCwid/.test(collapsedCard), "the typed-cwid input is not duplicated onto the collapsed card");
assert(/<AssignOther rowId=\{r\.id\}/.test(tabsSrc), "the one true input is still <AssignOther>, unmoved");

console.log(failures ? `\n${failures} FAILED\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
