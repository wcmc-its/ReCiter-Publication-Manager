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
 *   node scripts/check-authorships-filter-body.mjs --capture <rev|work>
 *       Rewrite the baseline from <rev>, or from the working tree ("work"). Only legitimate when
 *       a body change is intended and reviewed.
 *
 *   ... --print     also dump every body as JSON.
 *
 * INTENDED CHANGES. A phase does sometimes mean to change the posted body, and "recapture the
 * baseline and move on" would throw away the evidence that nothing ELSE moved with it. So an
 * intended change is declared as BODY_DELTA below — a transformation applied to the reference
 * body before the byte comparison. Everything the declaration does not name still has to match
 * exactly, key order included. The transformation is idempotent, so it holds whether the
 * reference predates the change (--against an old rev) or already contains it (the baseline).
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
// `institutionBasis` is still set here even though phase 3 removed it as a filter: the reference
// implementations this runs against DO read it, and a state that stopped mentioning it would
// quietly compare a body that no longer exercises the basis at all.
const MOUNT = {
  lane: "single", classification: "all", search: "", selectedTypes: [], selectedInstitutions: [],
  selectedAuthorAffiliations: [],
  institutionBasis: "either", source: "all", selectedPubTypes: [],
  dateFrom: "2024-09-04", dateTo: "2026-09-04", sort: "io", statusView: "open",
  hideNoSuggestion: false, hideNoIdentity: false, likeAuthor: "",
};
const s = (patch) => ({ ...MOUNT, ...patch });

// ---- the one intended body change, declared -------------------------------------------------
// Phase 3 (HANDOFF §2.2) replaced #982's `match: either/person/byline` select with the two-list
// Affiliation popover. Two keys move as a result, and NOTHING else may:
//
//   institutionBasis   either|person|byline -> the constant "person". The identity list IS the
//                      person basis now; the server parameter is kept and still works, so
//                      restoring an OR across the two conditions later is a UI change only.
//   authorAffiliations NEW, immediately after institutionBasis — the byline-basis list. The
//                      server ANDs it with `institutions`.
//
// Applied to the reference body before comparison, in place, so key ORDER is still checked:
// authorAffiliations has to land exactly where the current implementation puts it.
const BODY_DELTA_NOTE = [
  'institutionBasis: pinned to "person" (was a user-facing select, deleted in §2.2)',
  "authorAffiliations: new, inserted after institutionBasis (ARTICLE AFFILIATION list)",
];
const applyBodyDelta = (before, state) => {
  const out = {};
  for (const [k, v] of Object.entries(before)) {
    if (k === "authorAffiliations") continue;                 // re-inserted at its fixed position
    out[k] = k === "institutionBasis" ? "person" : v;
    if (k === "institutionBasis") out.authorAffiliations = state.selectedAuthorAffiliations ?? [];
  }
  return out;
};

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
  "identity and article affiliation together (ANDed server-side)":
    s({ selectedInstitutions: ["wcm"], selectedAuthorAffiliations: ["nyp", "msk"], sort: "date" }),
  "scopus source carries its pub-type facet": s({ source: "scopus", selectedPubTypes: ["Article", "Review"] }),
  "pubmed source drops a stale pub-type selection": s({ source: "pubmed", selectedPubTypes: ["Article", "Review"] }),
  "both hides + likeAuthor + search, everything else non-default":
    s({ hideNoSuggestion: true, hideNoIdentity: true, likeAuthor: "Bernard Park", search: "park", lane: "all", sort: "date" }),
  "custom date window": s({ dateFrom: "2019-03-01", dateTo: "2019-04-15" }),
  "every filter off its default at once":
    s({ lane: "fullname", classification: "suggested", search: "42449164", selectedTypes: ["staff-weillfulltime", "student"],
        selectedInstitutions: ["wcm", "hss", "msk"], selectedAuthorAffiliations: ["nyp"],
        institutionBasis: "person", source: "scopus",
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

// The current implementation is fed the state PLUS any filter key it has gained since the
// reference was captured, defaulted from FILTER_DEFAULTS — a reference state literally cannot
// mention a key that did not exist when it was written, and a missing key would otherwise
// stringify away to nothing and look like agreement.
const currentBody = (state) => work.build({ ...defaults, ...state });

if (CAPTURE) {
  const fromWorkingTree = CAPTURE === "work" || CAPTURE === "working-tree";
  const from = fromWorkingTree ? { ...work, build: currentBody } : compile(readRev(CAPTURE), CAPTURE);
  const label = fromWorkingTree
    ? execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim() + " + working tree"
    : CAPTURE;
  const bodies = {};
  for (const [name, state] of Object.entries(STATES)) bodies[name] = from.build(state);
  writeFileSync(BASELINE, `${JSON.stringify({ capturedFrom: label, shape: from.shape, states: STATES, bodies }, null, 2)}\n`);
  console.log(`baseline written from ${label} (${from.shape}) -> ${BASELINE}`);
  process.exit(0);
}

const reference = AGAINST
  ? (() => { const c = compile(readRev(AGAINST), AGAINST); const b = {}; for (const [n, st] of Object.entries(STATES)) b[n] = c.build(st); return { label: `${AGAINST} (${c.shape})`, bodies: b, states: STATES }; })()
  : (() => { const j = JSON.parse(readFileSync(BASELINE, "utf8")); return { label: `baseline captured from ${j.capturedFrom} (${j.shape})`, bodies: j.bodies, states: j.states }; })();

console.log(`\n1. request body, state by state`);
console.log(`   reference: ${reference.label}`);
console.log(`   current:   working tree (${work.shape})`);
console.log(`   declared changes applied to the reference before comparing (everything else must match byte for byte):`);
BODY_DELTA_NOTE.forEach((n) => console.log(`     · ${n}`));
console.log("");

for (const [name, state] of Object.entries(reference.states)) {
  const raw = JSON.stringify(reference.bodies[name]);
  const before = JSON.stringify(applyBodyDelta(reference.bodies[name], state));
  const after = JSON.stringify(currentBody(state));
  if (before === after) {
    pass(`${name}  [${after.length} bytes${raw === before ? " identical" : ", identical after the declared change"}]`);
    if (PRINT) console.log(`       ${after}`);
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
  selectedAuthorAffiliations: ["nyp"],
  source: "pubmed", selectedPubTypes: ["Article"], dateFrom: "2001-01-01",
  dateTo: "2002-02-02", sort: "date", statusView: "conflicts", hideNoSuggestion: true, hideNoIdentity: true,
  likeAuthor: "someone",
};
const baseBody = JSON.stringify(currentBody(SENSITIVITY_BASE));
for (const k of keys) {
  if (!(k in FLIP)) { fail(`${k} is a filter with no flip value in this script — add one`); continue; }
  const flipped = JSON.stringify(currentBody({ ...SENSITIVITY_BASE, [k]: FLIP[k] }));
  if (flipped === baseBody) fail(`${k} never reaches the request body (buildFilterBody ignores it)`);
  else pass(`${k} changes the request body`);
}
// The converse for the one key that is no longer a filter: institutionBasis must be a constant
// in the body, unmoved by anything the caller can express.
{
  const bodies = ["person", "byline", "either"].map((v) => currentBody({ ...SENSITIVITY_BASE, institutionBasis: v }).institutionBasis);
  if (bodies.every((v) => v === "person")) pass('institutionBasis is pinned to "person" and is no longer a filter');
  else fail(`institutionBasis is still read from the filter state: ${JSON.stringify(bodies)}`);
}

console.log(`\n3. defaults and mount state`);
const chk = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(`${label} -> ${JSON.stringify(actual)}`);
  else fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
// HANDOFF §2.4. Phase 3 adopts these as the mount state too, so the two must now agree exactly —
// the page loads on its own defaults and the chip row starts empty.
chk("FILTER_DEFAULTS.lane + classification = match class \"All unassigned\"", [defaults.lane, defaults.classification], ["all", "all"]);
chk("FILTER_DEFAULTS.selectedInstitutions = identity affiliation WCM", defaults.selectedInstitutions, ["wcm"]);
chk("FILTER_DEFAULTS.selectedAuthorAffiliations = article affiliation any", defaults.selectedAuthorAffiliations, []);
chk("FILTER_DEFAULTS.statusView", defaults.statusView, "open");
chk("FILTER_DEFAULTS.source", defaults.source, "all");
chk("institutionBasis is no longer a filter key at all", Object.keys(defaults).includes("institutionBasis"), false);
// §3a's stranded-default trap, stated as a test: the lane's old "single" default outlived the
// chip strip that set it. It must now mount on the lane's own all-value.
chk("the lane is not stranded on high-precision at mount", initial.lane, "all");
chk("the page mounts on FILTER_DEFAULTS exactly", initial, defaults);
// The one thing "Reset all" must never touch.
const resetExempt = /const RESET_EXEMPT: Array<keyof AuthorshipFilters> = \[([^\]]*)\]/.exec(workSrc);
chk("sort is exempt from Reset all", resetExempt && resetExempt[1].trim(), '"sort"');

console.log(`\n4. the three dependency arrays are derived, not hand-listed`);
const dep = (label, re) => (re.test(workSrc) ? pass(label) : fail(label));
dep("filterBody depends on the whole filter object", /const filterBody = useCallback\(\(\) => buildFilterBody\(filters\), \[filters\]\);/);
dep("the ephemeral-clear effect depends on the same object (plus page)",
  /setSelected\(new Set\(\)\); setExpanded\(null\); setPicked\(\{\}\); setAllMatching\(null\); \},\n\s*\[filters, page\]\);/);
// The summary is the third, and was the last hand-listed one: it named seven filters by hand and
// was correct only because the server neutralises the rest. It is now derived from the same
// object, keyed on the serialised body so a blind filter still costs no refetch (§6).
//
// UPDATED 2026-09-04 alongside the on-demand Article-affiliation facet. These assertions used to
// pin one exact expression each, and that expression legitimately changed: the summary body now
// carries an opt-in request flag and fetchSummary grew a sequence guard. They are rewritten to
// test the same PROPERTIES rather than the old spelling, and are strictly stronger for it — the
// old "derived" regex could not have distinguished a second hand-listed dependency from a
// derived one, whereas the dep array is now compared element by element. §7 adds the flag's own
// contract. Nothing here was relaxed to make the new code pass.
dep("baseSummaryBody is derived from the whole filter object",
  /const baseSummaryBody = useMemo\(\(\) => JSON\.stringify\(buildSummaryBody\(filters\)\), \[filters\]\);/);
// summaryBody is baseSummaryBody plus, conditionally, the ONE non-filter request flag. It must
// still be assembled by CALLING buildSummaryBody, never by listing filter names again.
const summaryBodyMemo = /const summaryBody = useMemo\(\n([\s\S]*?\n\s*\[[^\]]*\],)\n\s*\);/.exec(workSrc);
if (!summaryBodyMemo) fail("summaryBody is a useMemo whose deps this check can read");
else {
  const memo = summaryBodyMemo[1];
  const calls = (memo.match(/buildSummaryBody\(filters\)/g) || []).length;
  if (calls >= 1 && !/\bfilters\s*\.\s*[A-Za-z_$]/.test(memo)) {
    pass(`summaryBody is derived from the filter object, never re-listed -> buildSummaryBody(filters) x${calls}`);
  } else {
    fail("summaryBody names filters by hand instead of calling buildSummaryBody(filters)");
  }
  const deps = /\[([^\]]*)\],$/.exec(memo.trim());
  chk("summaryBody's deps are the filter object plus the opt-in latch only",
    deps ? deps[1].split(",").map((s) => s.trim()).filter(Boolean) : null,
    ["filters", "affilFacetKey", "baseSummaryBody"]);
}
dep("fetchSummary depends on that derived value alone, not on a list of filter names",
  /\n\s*\}, \[summaryBody\]\);/);
// A correct dep array on a fetch that posts something else is the same bug wearing a disguise:
// the summary refetches on the right trigger and then asks the wrong question. Depending on
// summaryBody is only meaningful if summaryBody is what actually goes over the wire — which now
// also means the body POSTED and the body RECORDED as "what summary describes" are the same
// value, since the popover reads that equality to tell fresh counts from in-flight ones.
dep("the /summary fetch posts summaryBody itself, not a re-inlined literal",
  /const body = summaryBody;[\s\S]{0,240}?headers: apiHeaders, body,/);
dep("the summary response is stamped with the body that produced it",
  /setSummary\(d\);\n\s*setSummaryFor\(body\);/);
// BOTH arms, counted rather than merely present: an early version of this check matched the
// .catch guard when the .then guard had been deleted, i.e. it passed while a stale success
// response could still repaint the counts. The success path is the one that actually matters.
{
  const armed = /const myId = \+\+summarySeqRef\.current;/.test(workSrc);
  const guards = (workSrc.match(/if \(myId !== summarySeqRef\.current\) return;/g) || []).length;
  const thenArm = /\.then\(\(d\) => \{\n\s*if \(myId !== summarySeqRef\.current\) return;/.test(workSrc);
  const catchArm = /\.catch\(\(\) => \{\n\s*if \(myId !== summarySeqRef\.current\) return;/.test(workSrc);
  if (armed && thenArm && catchArm && guards >= 2) {
    pass(`a stale summary response cannot overwrite a newer one (both arms guarded, ${guards} checks)`);
  } else {
    fail(`the summary sequence guard must cover BOTH the .then and the .catch arm `
      + `(armed=${armed} then=${thenArm} catch=${catchArm} checks=${guards})`);
  }
}
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
    `${slabs.join("\n")}\nreturn { filterChips, matchClassLabel, filterResetPatch, FILTER_DEFAULTS, INITIAL_FILTERS, MATCH_CLASS_OPTIONS, buildFilterBody, buildSummaryBody, SUMMARY_BLIND_BODY_KEYS };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.None } },
  ).outputText;
  return new Function(body)();
};
const M = loadFilterModel(workSrc);
const labels = (state, preset = "24m") => M.filterChips({ ...MOUNT, ...state }, preset).map((c) => c.label);

chk("the defaults produce no chips", M.filterChips(M.FILTER_DEFAULTS, "24m").map((c) => c.label), []);
chk("the page mounts with an empty chip row", M.filterChips(M.INITIAL_FILTERS, "24m").map((c) => c.label), []);
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
// ARTICLE AFFILIATION: default is EMPTY, so unlike the identity list it has no "any" chip —
// every value present is off-default by definition, and the two lists chip independently.
chk("the default article affiliation is not a chip", labels({ lane: "all", selectedInstitutions: ["wcm"], selectedAuthorAffiliations: [] }), []);
chk("article affiliations chip one by one, beside the identity ones",
  labels({ lane: "all", selectedInstitutions: ["nyp"], selectedAuthorAffiliations: ["wcm", "msk"] }),
  ["Identity affil: New York-Presbyterian Hospital", "Article affil: Weill Cornell Medicine", "Article affil: Memorial Sloan Kettering"]);
chk("the structured like-author filter is a chip in this row, not a pill of its own",
  labels({ lane: "all", selectedInstitutions: ["wcm"], likeAuthor: "Bernard Park" }), ["Like: Bernard Park"]);
chk("date", labels({ lane: "all", selectedInstitutions: ["wcm"] }, "12m"), ["Date: Last 12 months"]);
chk("the default date window is not a chip", labels({ lane: "all", selectedInstitutions: ["wcm"] }, "24m"), []);
chk("hides", labels({ lane: "all", selectedInstitutions: ["wcm"], hideNoSuggestion: true, hideNoIdentity: true }),
  ["Hiding no suggested identity", "Hiding no ReCiter identity"]);
chk("the search box is a chip, trimmed and curly-quoted",
  labels({ lane: "all", selectedInstitutions: ["wcm"], search: "  park  " }), ["\u201cpark\u201d"]);
chk("the source segment is never a chip", labels({ lane: "all", selectedInstitutions: ["wcm"], source: "scopus" }), []);
chk("sort is never a chip", labels({ lane: "all", selectedInstitutions: ["wcm"], sort: "date" }), []);
// SIX options, and each resolves back to its own label. The mockup's seventh, "All classes",
// was the classification strip's all-value and landed on the same (lane:"all",
// classification:"all") state as "All unassigned" — a second entry for one state that
// activeMatchClass's .find() could never highlight. It was removed; a re-added duplicate fails
// the second check below.
chk("every match-class option in the popover list resolves back to its own label",
  M.MATCH_CLASS_OPTIONS.map((o) => M.matchClassLabel({ ...MOUNT, lane: o.lane, classification: o.classification })),
  ["All unassigned", "Unique and full given-name match", "High-precision", "Suggested", "Buried", "Never retrieved"]);
chk("no two match-class options address the same (lane, classification) state",
  new Set(M.MATCH_CLASS_OPTIONS.map((o) => `${o.lane}|${o.classification}`)).size, M.MATCH_CLASS_OPTIONS.length);

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

console.log(`\n6. the summary body, checked against the honoured-filters contract (PM#988)`);
// #988: /api/db/authorships/summary used to see a NARROWER body than the list — a hand-typed
// override literal neutralised seven keys on arrival so every facet reported an unfiltered
// queue-wide total. That literal is gone: the summary now honours every filter the list does,
// with exclusions applied per RESPONSE FIELD instead (the header total is blind to nothing; a
// MATCH CLASS option is blind to precision+classification; etc — see authorshipSummary's own
// exclusion-map comment). The only thing left for buildSummaryBody to drop at all is `sort`
// (a set of COUNT/GROUP BY queries has no ORDER BY), so SUMMARY_BLIND_BODY_KEYS collapses to
// that one key — checked here against the controller's own source, not a copy kept in this file:
//
//   * SUMMARY_BLIND_BODY_KEYS is exactly ["sort"];
//   * the seven-key override literal the endpoint used to open with is GONE from the controller;
//   * `sort` itself is genuinely never read by the endpoint;
//   * and every filter whose value survives buildFilterBody's output reaches the summary body
//     too — the property that fails if a future filter silently stops reaching the counts. It is
//     derived from FILTER_DEFAULTS, so a new filter is covered the moment it exists.
const CONTROLLER = "controllers/db/authorships.controller.ts";
const ctrl = readFileSync(join(ROOT, CONTROLLER), "utf8");
const summaryFn = (() => {
  const a = ctrl.indexOf("export const authorshipSummary");
  assert.ok(a > -1, "authorshipSummary located in the controller");
  const b = ctrl.indexOf("\n};", ctrl.indexOf("res.status(500)", a));
  return ctrl.slice(a, b);
})();
const blind = [...(M.SUMMARY_BLIND_BODY_KEYS || [])];
chk('SUMMARY_BLIND_BODY_KEYS is exactly ["sort"]', blind, ["sort"]);
const overrideLitGone = !/const body = \{\s*\.\.\.\(req\.body \|\| \{\}\),\s*source: "all"/.test(summaryFn);
if (overrideLitGone) pass("authorshipSummary's seven-key neutralising override literal is gone");
else fail("authorshipSummary still opens with the old `const body = { ...req.body, source: \"all\", … }` override literal");
// `sort` is the one blind key, so its justification is checked directly: the endpoint must never
// READ it. (Array.prototype.sort on the facet arrays is not a read of the body — match the
// property access and the SORTS table, not the word.)
const readsSort = /\b(?:req\.)?body(?:\s*\|\|\s*\{\})?\??\.sort\b|\bSORTS\s*\[/.test(summaryFn);
if (readsSort) fail("authorshipSummary reads `sort` — it is not safe to drop from the summary body");
else pass("authorshipSummary never reads body.sort (ten COUNT/GROUP BY queries, no ORDER BY)");

// Sensitivity, key by key, derived from FILTER_DEFAULTS exactly as §2 is. For each filter, work
// out which BODY keys it moves, then require: all of them blind -> the summary body must not
// change (no wasted refetch); any of them live -> it must (or the counts silently desync from
// the list they describe).
const listBody = (state) => M.buildFilterBody({ ...defaults, ...state });
const summaryOf = (state) => JSON.stringify(M.buildSummaryBody({ ...defaults, ...state }));
const summaryBase = summaryOf(SENSITIVITY_BASE);
for (const k of keys) {
  if (!(k in FLIP)) continue;   // already reported as a failure in §2
  const before = listBody(SENSITIVITY_BASE);
  const after = listBody({ ...SENSITIVITY_BASE, [k]: FLIP[k] });
  const moved = Object.keys(before).filter((b) => JSON.stringify(before[b]) !== JSON.stringify(after[b]));
  const isBlind = moved.length > 0 && moved.every((b) => blind.includes(b));
  const changed = summaryOf({ ...SENSITIVITY_BASE, [k]: FLIP[k] }) !== summaryBase;
  if (moved.length === 0) fail(`${k} moves nothing in the list body — §2 should already have caught this`);
  else if (isBlind && changed) fail(`${k} reaches the summary body although it is blind (${moved.join(" + ")})`);
  else if (!isBlind && !changed) fail(`${k} never reaches the SUMMARY body (it moves ${moved.join(" + ")}, which the server honours per #988)`);
  else if (!isBlind) pass(`${k} -> ${moved.join(" + ")}: reaches the summary body`);
  else pass(`${k} -> ${moved.join(" + ")}: blind (a set of COUNTs has no ORDER BY), correctly absent`);
}
// institutionBasis must survive the removal: the identity-affiliation facet is COUNTED on it.
chk('institutionBasis survives into the summary body as "person"',
  M.buildSummaryBody(defaults).institutionBasis, "person");
chk("the summary body carries no key the list body does not",
  Object.keys(M.buildSummaryBody(defaults)).filter((k) => !(k in M.buildFilterBody(defaults))), []);

console.log(`\n7. includeAuthorInstitutions — the on-demand Article-affiliation facet`);
// Added 2026-09-04. #983 computed the byline institution facet on EVERY /summary call: 12
// leading-wildcard LIKEs over author_affiliation, measured on production at 563 ms of an 896 ms
// endpoint against a 311 ms pre-deploy baseline. It now ships behind an opt-in flag the client
// sets only while the Affiliation popover wants it. Three things have to stay true, and each one
// is a bug this project has already shipped once in some other form:
//
//   (a) the flag is NOT a filter. Putting it in AuthorshipFilters would give it a chip, a place
//       in filterBody()'s deps and a place in the ephemeral-clear deps — so opening a popover
//       would drop the curator's selection and refetch the LIST. §2/§6 above police the filter
//       object; this policies the boundary of it.
//   (b) the server computes the byline columns ONLY under the flag, and
//   (c) omits `authorInstitutions` entirely when it did not — never [] and never a stale
//       number. The client reads that absence as "loading"; a zero would read as fact.
const FLAG = "includeAuthorInstitutions";
chk(`${FLAG} is not a filter (absent from buildFilterBody's output)`,
  Object.keys(M.buildFilterBody(defaults)).includes(FLAG), false);
chk(`${FLAG} is not a filter (absent from FILTER_DEFAULTS)`,
  Object.keys(defaults).includes(FLAG), false);
chk(`${FLAG} is not baked into buildSummaryBody either — the fetch site adds it`,
  Object.keys(M.buildSummaryBody(defaults)).includes(FLAG), false);
// The client must only ever send it as `true`, tied to the popover latch — never unconditionally.
dep(`the client sends ${FLAG} only under the affiliation-popover latch`,
  new RegExp(`affilFacetKey === baseSummaryBody\\s*\\n?[\\s\\S]{0,120}?${FLAG}: true`));
dep("the popover latch is armed by the affiliation anchor, not left permanently on",
  /if \(affilAnchor\) setAffilFacetKey\(baseSummaryBody\);/);
// Server side, read out of the controller source §6 already loaded.
if (new RegExp(`const wantAuthorInstitutions = \\(req\\.body \\|\\| \\{\\}\\)\\.${FLAG} === true;`).test(summaryFn)) {
  pass(`authorshipSummary reads ${FLAG} off req.body, outside the honoured-filters body`);
} else fail(`authorshipSummary must read ${FLAG} off req.body`);
// #988 dropped the old shared-columns query (institutions + byline_-prefixed columns read off
// ONE findAll) for its own separate SUM query, gated on the flag and always counted on the
// byline basis — the UI pins institutionBasis to "person", so the old "share the unprefixed
// columns when basis is already byline" branch never fired and is gone, not just unreachable.
if (/wantAuthorInstitutions\s*\n\s*\? models\.AuthorshipReview\.findAll\(\{\s*\n\s*attributes: institutionFacetAttributes\("byline"\),/.test(summaryFn)) {
  pass("the Article-affiliation facet is its own query, gated on wantAuthorInstitutions, counted on the byline basis");
} else fail("the Article-affiliation facet must be its own query, gated on wantAuthorInstitutions, counted on the byline basis");
if (/const authorInstitutions = wantAuthorInstitutions\s*\n\s*\? bucketCounts\([\s\S]*?\)\s*\n\s*: undefined;/.test(summaryFn)) {
  pass("authorInstitutions is undefined (key absent) when the flag is unset — not [] and not stale");
} else fail("authorInstitutions must be undefined, not [], when the flag is unset");
// The Identity-affiliation facet must NOT have been dragged behind the same flag: it has a
// non-empty default, so it is on screen without anyone opening a popover.
if (/const institutions = bucketCounts\(\(\(byInstitution as any\[\]\)\[0\]\) \|\| \{\}\);/.test(summaryFn)) {
  pass("the Identity-affiliation facet is still computed unconditionally, off its own query");
} else fail("the Identity-affiliation facet must not be gated on the flag");
// And the client must render the absence as a loading state rather than as zeros.
dep("the client gates the Article counts on a freshness test, not on truthiness",
  /const authorFacetsReady = summaryFor === summaryBody && Array\.isArray\(summary\?\.authorInstitutions\);/);
dep("an unready Article facet renders a placeholder, never a 0",
  /\{!authorFacetsReady && <div style=\{emptyOptStyle\}>Counting…<\/div>\}/);
dep("an unready Article facet blanks the count column too",
  /\{authorFacetsReady \? inst\.n\.toLocaleString\(\) : "—"\}/);

console.log(failures === 0 ? `\nOK — no request body changed\n` : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
