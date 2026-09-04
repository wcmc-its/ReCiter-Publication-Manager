#!/usr/bin/env node
/**
 * The /authorships filter contract: one filter state in, one request body out.
 *
 * Why this exists. AuthorshipsTabs.tsx posts every list/"select all matching" request through a
 * single filterBody(). Its shape is the contract between the controls and buildWhere() on the
 * server, and the file's recurring failure mode is a filter that silently stops reaching it (a
 * name missing from a hand-written dependency array). The controls are being restructured across
 * four phases; this check is the guard that the restructure cannot quietly change what is sent.
 *
 * The owner's requirement, in one line: CHANGING ONE CONTROL MUST NOT LOSE THE OTHERS — sort in
 * particular. So the evidence is a byte comparison of JSON.stringify(body) for a table of filter
 * states, each one holding several filters off their defaults at once.
 *
 * No DB, no browser, no build. The object literals are pulled straight out of the .tsx source and
 * run for real via `new Function` — the same posture as scripts/check-authorships-scroll-and-hide.mjs.
 *
 *   node scripts/check-authorships-filter-body.mjs
 *       Compare the working tree against the committed baseline. This is the regression guard;
 *       run it after any change to the controls.
 *
 *   node scripts/check-authorships-filter-body.mjs --against <rev>
 *       Compare the working tree against <rev>'s implementation, extracted from git. Use this to
 *       show a refactor is behaviour-preserving. Pre-restructure revisions expose the filter
 *       assembly as `const filterBody = useCallback(() => ({...}), [deps])`; from phase 2 on it is
 *       the module-level `buildFilterBody(f)`. Both shapes are understood.
 *
 *   node scripts/check-authorships-filter-body.mjs --capture <rev>
 *       Rewrite the baseline from <rev>. Only legitimate when a body change is intended and
 *       reviewed.
 *
 *   ... --print     also dump every body as JSON.
 */

import assert from "node:assert/strict";
import ts from "typescript";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TABS = "src/components/elements/Authorships/AuthorshipsTabs.tsx";
const BASELINE = join(ROOT, "scripts/authorships-filter-body.baseline.json");

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null; };
const PRINT = argv.includes("--print");
const AGAINST = flag("--against");
const CAPTURE = flag("--capture");

// ---- source extraction ---------------------------------------------------
const readRev = (rev) => execFileSync("git", ["show", `${rev}:${TABS}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 32 << 20 });
const readWorkingTree = () => readFileSync(join(ROOT, TABS), "utf8");

// Slice the object literal that starts at the first "{" after `open` and ends at `close`.
const literalAfter = (src, open, close, what) => {
  const start = src.indexOf(open);
  assert.ok(start > -1, `${what}: could not find ${JSON.stringify(open)}`);
  const braceAt = src.indexOf("{", start + open.length - 1);
  const end = src.indexOf(close, braceAt);
  assert.ok(end > braceAt, `${what}: could not find ${JSON.stringify(close)}`);
  return src.slice(braceAt, end + close.indexOf("}") + 1);   // include the literal's own closing brace
};

// The 15 identifiers the pre-restructure literal reads straight out of the component's scope.
const LEGACY_PARAMS = [
  "lane", "classification", "search", "selectedTypes", "selectedInstitutions", "institutionBasis",
  "source", "selectedPubTypes", "dateFrom", "dateTo", "sort", "statusView",
  "hideNoSuggestion", "hideNoIdentity", "likeAuthor",
];

/** Returns { build(state) -> body, shape } for whichever implementation `src` holds. */
const compile = (src, label) => {
  if (src.includes("const buildFilterBody = ")) {
    const lit = literalAfter(src, "const buildFilterBody = ", "});", `${label} buildFilterBody`);
    const fn = new Function("f", `return (${lit});`);
    return { build: (state) => fn(state), shape: "buildFilterBody(f)" };
  }
  const lit = literalAfter(src, "const filterBody = useCallback(", "}), [", `${label} filterBody`);
  const fn = new Function(...LEGACY_PARAMS, `return (${lit});`);
  return { build: (state) => fn(...LEGACY_PARAMS.map((k) => state[k])), shape: "filterBody() useCallback literal" };
};

/** FILTER_DEFAULTS / INITIAL_FILTERS out of the working tree — the live key list. */
const readFilterKeys = (src) => {
  const defaults = new Function(`return (${literalAfter(src, "const FILTER_DEFAULTS: AuthorshipFilters = ", "\n};", "FILTER_DEFAULTS")});`)();
  const initial = new Function("FILTER_DEFAULTS", `return (${literalAfter(src, "const INITIAL_FILTERS: AuthorshipFilters = ", "\n};", "INITIAL_FILTERS")});`)(defaults);
  return { defaults, initial, keys: Object.keys(defaults) };
};

// ---- the filter states under test ---------------------------------------
// Dates are literal strings, never computed, so a run in six months produces the same bytes.
// Every state below holds SEVERAL filters off their defaults at once: that is the point — the
// failure this guards against is one control's change dropping another's value.
const MOUNT = {
  lane: "single", classification: "all", search: "", selectedTypes: [], selectedInstitutions: [],
  institutionBasis: "either", source: "all", selectedPubTypes: [],
  dateFrom: "2024-09-04", dateTo: "2026-09-04", sort: "io", statusView: "open",
  hideNoSuggestion: false, hideNoIdentity: false, likeAuthor: "",
};
const s = (patch) => ({ ...MOUNT, ...patch });

const STATES = {
  "mount (today's initial state)": MOUNT,
  "sort changed, nothing else": s({ sort: "date" }),
  "queue=snoozed while sort/dates/class are all non-default":
    s({ statusView: "snoozed", sort: "fg", classification: "buried", dateFrom: "2020-01-01", dateTo: "2021-12-31" }),
  "class=buried on the all-unassigned lane": s({ lane: "all", classification: "buried" }),
  "lane=fullname keeps a non-default sort": s({ lane: "fullname", sort: "precision" }),
  "institutions + basis=person + person types + sort":
    s({ selectedInstitutions: ["wcm", "nyp"], institutionBasis: "person", selectedTypes: ["academic-faculty-weillfulltime"], sort: "confidence" }),
  "institutions + basis=byline": s({ selectedInstitutions: ["msk"], institutionBasis: "byline" }),
  "scopus source carries its pub-type facet": s({ source: "scopus", selectedPubTypes: ["Article", "Review"] }),
  "pubmed source drops a stale pub-type selection": s({ source: "pubmed", selectedPubTypes: ["Article", "Review"] }),
  "both hides + likeAuthor + search, everything else non-default":
    s({ hideNoSuggestion: true, hideNoIdentity: true, likeAuthor: "Bernard Park", search: "park", lane: "all", sort: "date" }),
  "custom date window": s({ dateFrom: "2019-03-01", dateTo: "2019-04-15" }),
  "every filter off its default at once":
    s({ lane: "fullname", classification: "suggested", search: "42449164", selectedTypes: ["staff-weillfulltime", "student"],
        selectedInstitutions: ["wcm", "hss", "msk"], institutionBasis: "person", source: "scopus",
        selectedPubTypes: ["Conference Paper"], dateFrom: "2015-01-01", dateTo: "2016-06-30", sort: "precision",
        statusView: "dismissed", hideNoSuggestion: true, hideNoIdentity: true, likeAuthor: "Wei Zhang" }),
};

// ---- run -----------------------------------------------------------------
let failures = 0;
const fail = (msg) => { failures++; console.log(`  FAIL ${msg}`); };
const pass = (msg) => console.log(`  PASS ${msg}`);

const workSrc = readWorkingTree();
const work = compile(workSrc, "working tree");
const { defaults, initial, keys } = readFilterKeys(workSrc);

if (CAPTURE) {
  const from = compile(readRev(CAPTURE), CAPTURE);
  const bodies = {};
  for (const [name, state] of Object.entries(STATES)) bodies[name] = from.build(state);
  writeFileSync(BASELINE, `${JSON.stringify({ capturedFrom: CAPTURE, shape: from.shape, states: STATES, bodies }, null, 2)}\n`);
  console.log(`baseline written from ${CAPTURE} (${from.shape}) -> ${BASELINE}`);
  process.exit(0);
}

const reference = AGAINST
  ? (() => { const c = compile(readRev(AGAINST), AGAINST); const b = {}; for (const [n, st] of Object.entries(STATES)) b[n] = c.build(st); return { label: `${AGAINST} (${c.shape})`, bodies: b, states: STATES }; })()
  : (() => { const j = JSON.parse(readFileSync(BASELINE, "utf8")); return { label: `baseline captured from ${j.capturedFrom} (${j.shape})`, bodies: j.bodies, states: j.states }; })();

console.log(`\n1. request body, state by state`);
console.log(`   reference: ${reference.label}`);
console.log(`   current:   working tree (${work.shape})\n`);

for (const [name, state] of Object.entries(reference.states)) {
  const before = JSON.stringify(reference.bodies[name]);
  const after = JSON.stringify(work.build(state));
  if (before === after) {
    pass(`${name}  [${before.length} bytes identical]`);
    if (PRINT) console.log(`       ${before}`);
  } else {
    fail(name);
    console.log(`       before: ${before}`);
    console.log(`       after:  ${after}`);
  }
}

// Any state the reference does not know about (a fixture added since the baseline) still has to
// be reported rather than silently skipped.
for (const name of Object.keys(STATES)) {
  if (!(name in reference.states)) fail(`${name} — no reference body; re-capture the baseline`);
}

console.log(`\n2. every filter in the object reaches the posted body`);
// The list comes from FILTER_DEFAULTS in the source, not from this script, so a filter added in a
// later phase is covered the moment it exists: flip it, and the body must change.
const SENSITIVITY_BASE = { ...MOUNT, source: "scopus" };  // scopus, so the pubTypes branch is live
const FLIP = {
  lane: "fullname", classification: "buried", search: "zzz", selectedTypes: ["x"], selectedInstitutions: ["wcm"],
  institutionBasis: "person", source: "pubmed", selectedPubTypes: ["Article"], dateFrom: "2001-01-01",
  dateTo: "2002-02-02", sort: "date", statusView: "dismissed", hideNoSuggestion: true, hideNoIdentity: true,
  likeAuthor: "someone",
};
const baseBody = JSON.stringify(work.build(SENSITIVITY_BASE));
for (const k of keys) {
  if (!(k in FLIP)) { fail(`${k} is a filter with no flip value in this script — add one`); continue; }
  const flipped = JSON.stringify(work.build({ ...SENSITIVITY_BASE, [k]: FLIP[k] }));
  if (flipped === baseBody) fail(`${k} never reaches the request body (buildFilterBody ignores it)`);
  else pass(`${k} changes the request body`);
}

console.log(`\n3. defaults and mount state`);
const chk = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(`${label} -> ${JSON.stringify(actual)}`);
  else fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
// HANDOFF §2.4. These are the values "Reset all" restores; they are NOT (yet) what the page mounts
// with — see INITIAL_FILTERS' comment in the .tsx.
chk("FILTER_DEFAULTS.lane + classification = match class \"All unassigned\"", [defaults.lane, defaults.classification], ["all", "all"]);
chk("FILTER_DEFAULTS.selectedInstitutions = identity affiliation WCM", defaults.selectedInstitutions, ["wcm"]);
chk("FILTER_DEFAULTS.statusView", defaults.statusView, "open");
chk("FILTER_DEFAULTS.source", defaults.source, "all");
chk("mount lane is still today's high-precision lane", initial.lane, "single");
chk("mount institution filter is still unset", initial.selectedInstitutions, []);
// The one thing "Reset all" must never touch.
const resetExempt = /const RESET_EXEMPT: Array<keyof AuthorshipFilters> = \[([^\]]*)\]/.exec(workSrc);
chk("sort is exempt from Reset all", resetExempt && resetExempt[1].trim(), '"sort"');

console.log(`\n4. the two dependency arrays are derived, not hand-listed`);
const dep = (label, re) => (re.test(workSrc) ? pass(label) : fail(label));
dep("filterBody depends on the whole filter object", /const filterBody = useCallback\(\(\) => buildFilterBody\(filters\), \[filters\]\);/);
dep("the ephemeral-clear effect depends on the same object (plus page)",
  /setSelected\(new Set\(\)\); setExpanded\(null\); setPicked\(\{\}\); setAllMatching\(null\); \},\n\s*\[filters, page\]\);/);
dep("page is NOT part of the posted filter body", /offset: page \* PAGE_SIZE/);
if (/buildFilterBody[\s\S]{0,900}?\bpage\b[\s\S]{0,40}?\n\}\);/.test(workSrc)) fail("buildFilterBody mentions page");
else pass("buildFilterBody does not mention page");

console.log(`\n5. active-filter chips (HANDOFF §2.4 / mockup:607-624)`);
// The chip rules are run for real, not string-matched: the filter-model slab is lifted out of the
// .tsx and type-stripped with the repo's own TypeScript, so filterChips()/matchClassLabel() here
// are the exact functions the page renders from.
const loadFilterModel = (src) => {
  const slabs = [
    src.slice(src.indexOf("const INSTITUTION_LABELS"), src.indexOf("const ACTION_LABEL")),
    src.slice(src.indexOf("// ---- filter model"), src.indexOf("// ---- inline Lucide SVG icons")),
  ];
  assert.ok(slabs.every((x) => x.length > 200), "filter-model slabs located");
  const body = ts.transpileModule(
    `${slabs.join("\n")}\nreturn { filterChips, matchClassLabel, filterResetPatch, FILTER_DEFAULTS, INITIAL_FILTERS, MATCH_CLASS_OPTIONS };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.None } },
  ).outputText;
  return new Function(body)();
};
const M = loadFilterModel(workSrc);
const labels = (state, preset = "24m") => M.filterChips({ ...MOUNT, ...state }, preset).map((c) => c.label);

chk("the defaults produce no chips", M.filterChips(M.FILTER_DEFAULTS, "24m").map((c) => c.label), []);
chk("today's mount state names both filters it silently applies",
  M.filterChips(M.INITIAL_FILTERS, "24m").map((c) => c.label), ["Class: High-precision", "Identity affil: any"]);
chk("queue", labels({ statusView: "snoozed", selectedInstitutions: ["wcm"] }), ["Queue: Snoozed", "Class: High-precision"]);
chk("class from the classification axis", labels({ lane: "all", classification: "buried", selectedInstitutions: ["wcm"] }), ["Class: Buried"]);
chk("class from the lane axis", labels({ lane: "fullname", selectedInstitutions: ["wcm"] }), ["Class: Unique and full given-name match"]);
chk("a lane+class combination the single-select list cannot express is named honestly",
  labels({ lane: "fullname", classification: "buried", selectedInstitutions: ["wcm"] }),
  ["Class: Unique and full given-name match + Buried"]);
chk("one chip per person type", labels({ lane: "all", selectedTypes: ["Faculty", "Staff"], selectedInstitutions: ["wcm"] }),
  ["Person type: Faculty", "Person type: Staff"]);
chk("the default identity affiliation is not a chip", labels({ lane: "all", selectedInstitutions: ["wcm"] }), []);
chk("an empty identity affiliation IS a chip (the default is WCM)", labels({ lane: "all", selectedInstitutions: [] }), ["Identity affil: any"]);
chk("non-default identity affiliations chip one by one, by display name",
  labels({ lane: "all", selectedInstitutions: ["nyp", "msk"] }),
  ["Identity affil: New York-Presbyterian Hospital", "Identity affil: Memorial Sloan Kettering"]);
chk("date", labels({ lane: "all", selectedInstitutions: ["wcm"] }, "12m"), ["Date: Last 12 months"]);
chk("the default date window is not a chip", labels({ lane: "all", selectedInstitutions: ["wcm"] }, "24m"), []);
chk("hides", labels({ lane: "all", selectedInstitutions: ["wcm"], hideNoSuggestion: true, hideNoIdentity: true }),
  ["Hiding no suggested identity", "Hiding no ReCiter identity"]);
chk("the search box is a chip, trimmed and curly-quoted",
  labels({ lane: "all", selectedInstitutions: ["wcm"], search: "  park  " }), ["\u201cpark\u201d"]);
chk("the source segment is never a chip", labels({ lane: "all", selectedInstitutions: ["wcm"], source: "scopus" }), []);
chk("sort is never a chip", labels({ lane: "all", selectedInstitutions: ["wcm"], sort: "date" }), []);
chk("every match-class option in the popover list resolves back to its own label (bar the duplicate all-value)",
  M.MATCH_CLASS_OPTIONS.map((o) => M.matchClassLabel({ ...MOUNT, lane: o.lane, classification: o.classification })),
  ["All unassigned", "Unique and full given-name match", "High-precision", "Suggested", "Buried", "Never retrieved", "All unassigned"]);

// Removing a chip removes ONLY that filter — the owner's requirement, stated as a test.
const kitchenSink = { ...STATES["every filter off its default at once"] };
const sinkChips = M.filterChips(kitchenSink, "12m");
for (const chip of sinkChips) {
  const after = { ...kitchenSink, ...chip.patch };
  const untouched = keys.filter((k) => !(k in chip.patch));
  const lost = untouched.filter((k) => JSON.stringify(after[k]) !== JSON.stringify(kitchenSink[k]));
  if (lost.length) fail(`removing "${chip.label}" also changed ${lost.join(", ")}`);
  else pass(`removing "${chip.label}" touches only ${Object.keys(chip.patch).join(" + ") || "the date preset"}`);
}
chk("the Filters badge is exactly the number of chips", sinkChips.length, M.filterChips(kitchenSink, "12m").length);

// "Reset all" restores the defaults and leaves sort alone.
const afterReset = { ...kitchenSink, ...M.filterResetPatch() };
chk("Reset all clears every filter", M.filterChips(afterReset, "24m").map((c) => c.label), []);
chk("Reset all keeps the curator's sort", afterReset.sort, kitchenSink.sort);

console.log(failures === 0 ? `\nOK — no request body changed\n` : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
