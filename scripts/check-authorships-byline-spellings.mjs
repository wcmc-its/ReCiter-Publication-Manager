#!/usr/bin/env node
/**
 * Byline institution spellings — INSTITUTION_BYLINE_PATTERNS was missing the hyphenated
 * spellings "Sloan-Kettering" (msk) and "Weill-Cornell" (wcm), measured on the dev database's
 * open authorship_review rows at 136 and 23 rows respectively. Both institutionFacetAttributes()
 * (the ARTICLE AFFILIATION facet counts) and bylineCondition() (the Article-affiliation filter)
 * read this same list, so the fix is one array edit shared by both call sites. Guarded by source
 * inspection so this runs with no DB, no AWS creds, no build.
 * Run: node scripts/check-authorships-byline-spellings.mjs
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

console.log("\nINSTITUTION_BYLINE_PATTERNS — hyphenated spellings added:");
const start = controllerSrc.indexOf("const INSTITUTION_BYLINE_PATTERNS: Record<string, string[]> = {");
assert(start > -1, "INSTITUTION_BYLINE_PATTERNS declaration found");
const end = controllerSrc.indexOf("};", start);
const patternsLiteral = controllerSrc.slice(start, end);
assert(patternsLiteral.length > 100, "literal sliced");

const wcmLine = patternsLiteral.slice(patternsLiteral.indexOf("wcm:"), patternsLiteral.indexOf("\n", patternsLiteral.indexOf("wcm:")));
assert(/"Weill Cornell"/.test(wcmLine), "wcm still carries the original \"Weill Cornell\" spelling first");
assert(/"Weill-Cornell"/.test(wcmLine), "wcm gained the hyphenated \"Weill-Cornell\" spelling");
assert(wcmLine.indexOf('"Weill Cornell"') < wcmLine.indexOf('"Weill-Cornell"'), "original spelling stays first in the array");

const mskLine = patternsLiteral.slice(patternsLiteral.indexOf("msk:"), patternsLiteral.indexOf("\n", patternsLiteral.indexOf("msk:")));
assert(/"Sloan Kettering"/.test(mskLine), "msk still carries the original \"Sloan Kettering\" spelling first");
assert(/"Sloan-Kettering"/.test(mskLine), "msk gained the hyphenated \"Sloan-Kettering\" spelling");
assert(mskLine.indexOf('"Sloan Kettering"') < mskLine.indexOf('"Sloan-Kettering"'), "original spelling stays first in the array");

// Both readers of the list share it verbatim — the fix needs only the one array edit above.
assert(/const pats = INSTITUTION_BYLINE_PATTERNS\[key\] \|\| \[\];[\s\S]{0,400}author_affiliation.{0,20}LIKE/.test(controllerSrc),
  "institutionFacetAttributes() reads INSTITUTION_BYLINE_PATTERNS for the facet counts");
assert(/function bylineCondition\(key: string\) \{[\s\S]{0,200}INSTITUTION_BYLINE_PATTERNS\[key\]/.test(controllerSrc),
  "bylineCondition() reads the same INSTITUTION_BYLINE_PATTERNS for the Article-affiliation filter");

console.log(failures ? `\n${failures} FAILED\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
