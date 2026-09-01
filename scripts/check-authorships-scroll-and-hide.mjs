#!/usr/bin/env node
/**
 * Guards two /authorships changes, both in AuthorshipsTabs.tsx (+ buildWhere in
 * authorships.controller.ts for the second). No DB, no build, no AWS creds — same posture as
 * scripts/check-authorships-no-suggestion.mjs: pull the literal source line/block and run it
 * for real via `new Function`, rather than string-matching the surrounding prose.
 * Run: node scripts/check-authorships-scroll-and-hide.mjs
 *
 * 1. fetchData's `silent` flag — the {loading && …}/{!loading && rows.map(…)} gate is what
 *    unmounts the whole card list and throws scroll position to the top; `silent` must
 *    actually skip both setLoading(true) and setLoading(false), and exactly the six
 *    "restore this same view after acting on a row" call sites (action-catch, bulk-accept
 *    failure, bulk-assign failure, bulk-reject failure (T-950), undo, undo-from-recent-activity)
 *    must pass it — never the one effect that fires on a genuine filter/status/page change,
 *    where landing at the top is expected. The call-site regex requires a trailing `;` so it
 *    can't be tripped by prose that merely mentions `fetchData(true)` in a comment (two such
 *    mentions exist, describing the action-catch site's effect on a MULTI_CANDIDATE row — not
 *    call sites of their own).
 * 2. hideNoSuggestion — a real SQL predicate in buildWhere (top_cwid IS NOT NULL), gated on
 *    the same body flag the client always sends, so it can never disagree with the
 *    "Select all N matching" count (authorshipSelectable shares buildWhere). Also checks the
 *    client never re-implements this as a second, parallel client-side rows.filter().
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tabsSrc = readFileSync(join(ROOT, "src/components/elements/Authorships/AuthorshipsTabs.tsx"), "utf8");
const controllerSrc = readFileSync(join(ROOT, "controllers/db/authorships.controller.ts"), "utf8");

let n = 0;
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  console.log(`  PASS ${label} -> ${JSON.stringify(actual)}`);
  n++;
};

// ---------------------------------------------------------------------------------------
console.log("\n1. fetchData(silent) — the loading gate that unmounts the card list:");

const fetchDataStart = tabsSrc.indexOf("const fetchData = useCallback(");
assert.ok(fetchDataStart > 0, "fetchData located");
const fetchDataEnd = tabsSrc.indexOf("}, [filterBody, page]);", fetchDataStart);
const fetchDataSrc = tabsSrc.slice(fetchDataStart, fetchDataEnd);

check("fetchData takes a silent param, defaulting to false (non-silent = today's behavior)",
  /useCallback\(\(silent\s*=\s*false\)\s*=>/.test(fetchDataSrc), true);

// Run the actual guard lines against a spy, both ways, rather than trusting the regex above.
// finallyLine is pulled out of its `.finally(() => { … });` wrapper — only the guarded
// statement itself needs to run standalone through `new Function`.
const startLine = fetchDataSrc.split("\n").find((l) => l.includes("setLoading(true)"))?.trim();
const finallyLine = fetchDataSrc.match(/if \(!silent\) setLoading\(false\);/)?.[0];
assert.ok(startLine && finallyLine, "both setLoading guard lines found in fetchData");
const runGuard = (line, silent) => {
  let called = false;
  new Function("silent", "setLoading", line)(silent, () => { called = true; });
  return called;
};
check("silent=true skips setLoading(true) — the list never unmounts to \"Loading…\"", runGuard(startLine, true), false);
check("silent=false (default) still sets loading — normal navigation keeps today's spinner", runGuard(startLine, false), true);
check("silent=true also skips the matching setLoading(false)", runGuard(finallyLine, true), false);
check("silent=false still clears loading in the finally", runGuard(finallyLine, false), true);

// Exactly one non-silent call site (the filter/status/page-change effect) and exactly five
// silent ones (every "restore this same view after acting on a row" path). If a future edit
// adds a sixth action path and forgets `true`, or the navigation effect picks up `true` by
// copy-paste, this catches it by count alone. The trailing `;` keeps this from also counting
// comment prose that just mentions the call (see file header).
const bareCalls = tabsSrc.match(/\bfetchData\(\);/g) || [];
const silentCalls = tabsSrc.match(/\bfetchData\(true\);/g) || [];
check("exactly one non-silent fetchData() call (the navigation effect)", bareCalls.length, 1);
check("exactly six silent fetchData(true) calls (action-catch, bulk-accept failure, bulk-assign failure, bulk-reject failure, undo, undo-from-activity)",
  silentCalls.length, 6);

// The lone non-silent call must be the one gated on datesReady/pendingPageReset, not some
// other new call that happens to omit the argument.
const bareCallIdx = tabsSrc.indexOf("fetchData();");
const windowAroundBareCall = tabsSrc.slice(Math.max(0, bareCallIdx - 400), bareCallIdx);
check("the non-silent call sits in the datesReady-gated navigation effect",
  windowAroundBareCall.includes("datesReady") && windowAroundBareCall.includes("pendingPageReset"), true);

// ---------------------------------------------------------------------------------------
console.log("\n2. hideNoSuggestion — a real SQL predicate, not a second client-side filter:");

// signature-tolerant: buildWhere gained an `absentCwids?: Set<string>` second param for
// hideNoIdentity (unrelated to what this section checks) — locate by name, not full signature.
const buildWhereStart = controllerSrc.indexOf("function buildWhere(");
const buildWhereEnd = controllerSrc.indexOf("\n}\n", buildWhereStart);
const buildWhereSrc = controllerSrc.slice(buildWhereStart, buildWhereEnd);
assert.ok(buildWhereSrc.length > 200, "buildWhere located");

const hideBlockMatch = buildWhereSrc.match(/if \(body\.hideNoSuggestion\) \{\n\s*and\.push\((\{[\s\S]*?\})\);\n\s*\}/);
assert.ok(hideBlockMatch, "hideNoSuggestion predicate block found in buildWhere");
const pushedExpr = hideBlockMatch[1];

// Real Sequelize Op.ne is a Symbol; stand one in and evaluate the pushed object for real so
// this fails if the predicate is ever loosened (e.g. to `Op.eq: ""`) rather than tightened.
const OpNe = Symbol("ne");
const built = new Function("Op", `return ${pushedExpr};`)({ ne: OpNe });
check("the pushed predicate targets top_cwid", Object.keys(built), ["top_cwid"]);
check("...specifically top_cwid IS NOT NULL (Op.ne: null)", built.top_cwid[OpNe], null);

// The flag must actually gate the predicate — false/undefined must add nothing to `and`.
const runHideGate = (hideNoSuggestion) => {
  const and = [];
  new Function("body", "Op", "push",
    hideBlockMatch[0].replace(/and\.push/g, "push"),
  )({ hideNoSuggestion }, { ne: OpNe }, (x) => and.push(x));
  return and.length;
};
check("hideNoSuggestion:false adds no predicate", runHideGate(false), 0);
check("hideNoSuggestion:undefined adds no predicate (matches every filter above it)", runHideGate(undefined), 0);
check("hideNoSuggestion:true adds exactly one predicate", runHideGate(true), 1);

// Client always sends the flag (so the loaded-page filter and "Select all N matching" — which
// posts the same buildWhere-shaped body — can never disagree about which rows are hidden).
// Located by membership, not position: hideNoSuggestion no longer has to be the LAST field in
// either the object literal or the deps array — hideNoIdentity and likeAuthor (T5, no-identity
// hide) were added after it in both, which is fine, so long as it's still in both.
const filterBodyStart = tabsSrc.indexOf("const filterBody = useCallback(");
const filterBodyObjEnd = tabsSrc.indexOf("}), [", filterBodyStart);
const filterBodyDepsEnd = tabsSrc.indexOf(");", filterBodyObjEnd);
const filterBodyObjSrc = tabsSrc.slice(filterBodyStart, filterBodyObjEnd);
const filterBodyDepsSrc = tabsSrc.slice(filterBodyObjEnd + "}), [".length, filterBodyDepsEnd);
assert.ok(filterBodyObjSrc.length > 50 && filterBodyDepsSrc.length > 10, "filterBody located");
check("filterBody() includes hideNoSuggestion in the posted body",
  /\bhideNoSuggestion,/.test(filterBodyObjSrc), true);
check("filterBody's own useCallback deps include hideNoSuggestion (recomputes + resets page on toggle)",
  /\bhideNoSuggestion\b/.test(filterBodyDepsSrc), true);

// No parallel client-side hiding mechanism: every reference to hideNoSuggestion in the
// component is state/wiring, never a rows.filter/array-filter predicate of its own.
const hideRefLines = tabsSrc.split("\n").filter((l) => l.includes("hideNoSuggestion"));
check("hideNoSuggestion has reference sites (state, filterBody, deps, checkbox)", hideRefLines.length >= 5, true);
check("none of them run rows through a client-side .filter(...) of their own",
  hideRefLines.some((l) => l.includes(".filter(")), false);

// The checkbox is wired to the same state, not a separate local toggle.
check("the checkbox reflects hideNoSuggestion", tabsSrc.includes("checked={hideNoSuggestion}"), true);
check("the checkbox writes back through setHideNoSuggestion",
  tabsSrc.includes("onChange={(e) => setHideNoSuggestion(e.target.checked)}"), true);

console.log(`\n${n}/${n} passed\n`);
