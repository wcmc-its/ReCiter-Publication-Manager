#!/usr/bin/env node
/**
 * Guards the two canned curator/model disagreement reports (PM #997).
 * Run: node scripts/check-authorships-reports.mjs
 *
 * No prerequisites, no DB, no build. Every section either evaluates real source text via
 * `new Function` or asserts a structural property of the SQL builders. The four things it
 * guards are the four defects that were actually caught during review, plus the partition
 * that the whole design rests on:
 *
 *   1. filters       every filter key is either HONOURED or HIDDEN, never neither. A key that
 *                    is neither is visibly set and silently ignored, which is the exact bug
 *                    the honour/hide split exists to prevent -- three controls shipped that
 *                    way in the first draft.
 *   2. person type   the identity flag columns are varchar 'yes'/''/NULL, so `= 1` matches
 *                    nothing; and the CASE needs an ELSE, because the producer's
 *                    "Other / CTSC" chip otherwise emptied both reports silently.
 *   3. all-zero      the exclusion must stay the NULL-safe EXISTS form. The NOT IN / GROUP BY
 *                    form it replaces is a full scan of 858,946 rows (~2.4 s measured).
 *   4. grouping      groupReportRows must preserve the server's document order, never sort.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tabs = readFileSync(join(ROOT, "src/components/elements/Authorships/AuthorshipsTabs.tsx"), "utf8");
const ctl = readFileSync(join(ROOT, "controllers/db/authorships.controller.ts"), "utf8");

let n = 0;
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, `${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  n++; console.log(`  ok  ${label}`);
};
const slice = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));

// ---- 1. the honour/hide partition is total -------------------------------------------------
// buildFilterBody's literal IS the set of keys the server can receive. Every one of them must be
// accounted for: honoured by the report query, or hidden from the UI while a report is active.
console.log("1. every filter key is honoured or hidden");
const bodyKeys = [...slice(tabs, "const buildFilterBody", "\n}")
  .matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)].map((m) => m[1]);
const HONOURED = ["dateFrom", "dateTo", "personTypes", "institutions", "searchTextInput"];
const HIDDEN = ["precision", "classification", "source", "authorAffiliations", "pubTypes",
  "hideNoSuggestion", "hideNoIdentity", "likeAuthor", "statusView", "sort",
  "feed", "institutionBasis"];   // feed/institutionBasis are pinned constants, not controls
check("buildFilterBody still has 17 keys", bodyKeys.length, 17);
check("no key is unclassified",
  bodyKeys.filter((k) => !HONOURED.includes(k) && !HIDDEN.includes(k)), []);
// every honoured key is actually read by the report's filter builder
const filterFn = slice(ctl, "function reportFilterSql", "\n}\n");
check("reportFilterSql reads every honoured key",
  HONOURED.filter((k) => !filterFn.includes(k)), []);
// ...and none of the ignored ones, which would mean a hidden control still filtering
check("reportFilterSql reads no hidden key",
  HIDDEN.filter((k) => k !== "sort" && new RegExp(`body\\.${k}\\b`).test(filterFn)), []);

// ---- 2. the chip row's hidden set is exactly the complement --------------------------------
console.log("2. chip row matches the partition");
const chipIds = [...slice(tabs, "const filterChips", "\n};")
  .matchAll(/id: (?:`([^`]*)`|"([^"]*)")/g)].map((m) => (m[1] ?? m[2]).replace(/\$\{[^}]*\}/, "*"));
const hidden = new Function(`return ${slice(tabs, "new Set([", "]);")}])`)();
const isHidden = (id) => hidden.has(id) || id.startsWith("authorAffil:");
const shown = chipIds.filter((id) => !isHidden(id.replace("*", "x")));
// the chips that survive a report are exactly the honoured filters' chips
check("chips shown under a report", shown.sort(),
  ["affil:*", "affil:any", "date", "search", "type:*"]);
check("every declared hidden chip id is a real chip id",
  [...hidden].filter((id) => !chipIds.includes(id)), []);

// ---- 3. the person-type CASE ---------------------------------------------------------------
console.log("3. person-type CASE");
const labels = new Function(`return ${slice(ctl, "const REPORT_PERSON_TYPE_LABELS", "\n];").replace(/^const [^=]*=/, "")}]`)();
check("21 labels, the producer's precedence list", labels.length, 21);
check("precedence starts full-time faculty", labels[0], ["fullTimeFaculty", "Full-Time Faculty"]);
const caseSql = slice(ctl, "const REPORT_PERSON_TYPE_CASE", "END`;");
// the identity flag columns are varchar holding 'yes' / '' / NULL -- `= 1` yields 0 for every
// row, so the whole CASE silently collapses to its ELSE.
check("compares against the string 'yes'", /= *'yes'/.test(caseSql), true);
check("never compares against 1", /= *1\b/.test(caseSql), false);
// without an ELSE the producer's "Other / CTSC" chip matches nothing and empties both reports.
check("has an ELSE fallback", /ELSE '\$\{REPORT_PERSON_TYPE_FALLBACK\}'/.test(caseSql), true);
check("the fallback is the producer's label",
  /const REPORT_PERSON_TYPE_FALLBACK = "Other \/ CTSC"/.test(ctl), true);

// ---- 4. the all-zero exclusion stays the NULL-safe EXISTS form -----------------------------
console.log("4. all-zero-cwid exclusion");
const excl = slice(ctl, "const REPORT_EXCLUDE_ALL_ZERO_CWIDS", ";\n");
check("EXISTS form", /EXISTS *\(/.test(excl), true);
check("NULL-safe <=> 0, not = 0", /NOT *\(.*<=> *0\)/s.test(excl), true);
check("not the NOT IN / GROUP BY scan", /NOT +IN|GROUP +BY/i.test(excl), false);
check("correlated on personIdentifier", /z.*personIdentifier.*=.*pa.*personIdentifier/s.test(excl), true);

// ---- 5. grouping preserves the server's order ----------------------------------------------
console.log("5. grouping");
// evaluated for real, with only the TS annotations stripped -- the loop is the thing under test
const groupSrc = slice(tabs, "const groupReportRows", "\n};")
  .replace("(rows: ReportRow[]): ReportGroup[]", "(rows)")
  .replace("const out: ReportGroup[] = []", "const out = []");
const group = new Function(`${groupSrc}\n}; return groupReportRows;`)();
const rows = [
  { cwid: "a", pmid: 1, groupCount: 2 }, { cwid: "a", pmid: 2, groupCount: 2 },
  { cwid: "b", pmid: 3, groupCount: 1 }, { cwid: "a", pmid: 4, groupCount: 2 },
];
const got = group(rows);
// "a" appears twice non-contiguously: the server never emits that, and the grouper must NOT
// silently repair it by sorting -- doing so would reorder a result the server ordered on purpose.
check("groups in document order", got.map((g) => g.cwid), ["a", "b", "a"]);
check("rows kept in arrival order", got[0].rows.map((r) => r.pmid), [1, 2]);
check("does not sort", /\.sort\(/.test(slice(tabs, "const groupReportRows", "\n};")), false);

// ---- 6. bulk actions and the queue are off under a report ----------------------------------
console.log("6. report disables the feed's machinery");
check("eligibleRows gates on reportView",
  /const eligibleRows = statusView === "open" && reportView === null/.test(tabs), true);
check("keyboard shortcuts bail early", /if \(reportViewRef\.current\) return;/.test(tabs), true);
check("no new Sequelize model", /sequelize\.define|extends Model|\.init\(/.test(ctl), false);

console.log(`\n${n} checks passed.`);
