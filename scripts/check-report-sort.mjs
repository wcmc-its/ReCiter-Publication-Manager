#!/usr/bin/env node
/**
 * Reports sort: every option in config/report.js sortOptions must map to a real
 * AnalysisSummaryArticle column, and the on-screen search and the CSV exports must both build
 * their ORDER BY from the one shared helper (controllers/db/reports/reportSort.ts). Before this,
 * the publication-date option was spelled `publicationDateStandarized` (no such column, so the
 * sort errored) and the CSV exports silently ignored RCR, Scopus citations and Journal Metric.
 * Source-text assertions plus a transpiled run of the helper with a stubbed Sequelize; no DB.
 * Run: node scripts/check-report-sort.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(root, p), "utf8");
const require = createRequire(import.meta.url);
const ts = require(path.join(root, "node_modules/typescript"));

// 1. config sortOptions keys
const config = read("config/report.js");
const sortBlock = config.match(/export const sortOptions = \{([\s\S]*?)\n\}/);
assert.ok(sortBlock, "sortOptions block not found in config/report.js");
const sortKeys = [...sortBlock[1].matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]);
assert.ok(sortKeys.length >= 10, `expected >=10 sort options, got ${sortKeys.length}`);

// 2. AnalysisSummaryArticle model attributes
const model = read("src/db/models/AnalysisSummaryArticle.ts");
const initBlock = model.slice(model.indexOf(".init({"));
const columns = new Set([...initBlock.matchAll(/^ {4}(\w+): \{/gm)].map((m) => m[1]));
assert.ok(columns.has("publicationDateStandardized"), "model column publicationDateStandardized missing");

// 3. Run the helper itself (transpiled, Sequelize stubbed)
const helperSrc = read("controllers/db/reports/reportSort.ts");
const { outputText } = ts.transpileModule(helperSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
});
const mod = { exports: {} };
const stubRequire = (id) => {
  assert.equal(id, "sequelize");
  return { Sequelize: { literal: (val) => ({ val }) } };
};
new Function("module", "exports", "require", outputText)(mod, mod.exports, stubRequire);
const { REPORT_SORT_COLUMNS, buildReportSort } = mod.exports;

for (const key of sortKeys) {
  const column = REPORT_SORT_COLUMNS[key];
  assert.ok(column, `sort option "${key}" has no entry in REPORT_SORT_COLUMNS`);
  assert.ok(columns.has(column), `sort option "${key}" maps to "${column}", not an AnalysisSummaryArticle column`);
  assert.deepEqual(buildReportSort({ type: key, order: "asc" }), [[{ val: `isnull(${column}), ${column} ASC` }]]);
  assert.deepEqual(buildReportSort({ type: key, order: "DESC" }), [[{ val: `isnull(${column}), ${column} DESC` }]]);
  assert.deepEqual(buildReportSort({ type: key }), [[{ val: `isnull(${column}), ${column} DESC` }]]);
}
for (const key of Object.keys(REPORT_SORT_COLUMNS)) {
  assert.ok(columns.has(REPORT_SORT_COLUMNS[key]), `REPORT_SORT_COLUMNS.${key} is not a model column`);
}
assert.deepEqual(buildReportSort(undefined), []);
assert.deepEqual(buildReportSort({ type: "publicationDateStandarized", order: "DESC" }), [], "old misspelling must not reach SQL");
assert.deepEqual(buildReportSort({ type: "constructor" }), [], "prototype keys must not map");
assert.deepEqual(
  buildReportSort({ type: "citationCountNIH", order: "DESC; DROP TABLE x" }),
  [[{ val: "isnull(citationCountNIH), citationCountNIH DESC" }]],
  "order must be whitelisted to ASC/DESC",
);

// 4. Both paths use the helper; no inline sort literals or misspelling left
const paths = {
  "controllers/db/reports/publication.report.search.controller.ts": 2,
  "controllers/db/reports/publication.report.controller.ts": 2,
};
for (const [file, count] of Object.entries(paths)) {
  const src = read(file);
  assert.match(src, /import \{ buildReportSort \} from "\.\/reportSort";/, `${file} must import buildReportSort`);
  const uses = src.match(/const sort = buildReportSort\(apiBody && apiBody\.sort\);/g) || [];
  assert.equal(uses.length, count, `${file}: expected ${count} buildReportSort call(s), got ${uses.length}`);
  assert.doesNotMatch(src, /Sequelize\.literal\('isnull\(/, `${file} still builds sort literals inline`);
}
for (const file of [...Object.keys(paths), "config/report.js", "types/publication.report.search.d.ts"]) {
  assert.doesNotMatch(read(file), /Standarized/, `${file} still has the publicationDateStandarized typo`);
}

console.log(`check-report-sort: OK (${sortKeys.length} sort options, both paths share the helper)`);
