#!/usr/bin/env node
/**
 * Guards the one-note-per-card fix: a multi-candidate PubMed row used to render HomonymNote
 * twice — once from MultiEvidence (n = candidates-1) and once from AssignOther (n = candidates)
 * — and both numbers were individually correct, which is why it survived review.
 * Run: node scripts/check-authorships-homonym-note.mjs
 *
 * No prerequisites, no DB, no build. The two count expressions are pulled out of the source as
 * literal text and evaluated for real via `new Function`, so a future edit that changes the
 * arithmetic fails here rather than in prod.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "src/components/elements/Authorships/AuthorshipsTabs.tsx"), "utf8");

let n = 0;
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, `${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  n++; console.log(`  ok  ${label}`);
};

// 1. exactly one render site, and it is the card-level one.
console.log("1. single render site");
check("<HomonymNote occurrences", (src.match(/<HomonymNote/g) || []).length, 1);
check("AssignOther no longer takes a homonyms prop", /homonyms\s*[?:=]/.test(src), false);

// 2. the counts, evaluated for real off the source text.
console.log("2. counts");
const grab = (prop) => {
  const at = src.indexOf(`${prop}={`, src.indexOf("<HomonymNote"));
  let i = at + prop.length + 1, depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return src.slice(at + prop.length + 2, i);
};
const counts = new Function("r", "isMulti", "candidates", "noSuggestion", "noIdentity",
  `return { listed: (${grab("listed")}), typed: (${grab("typed")}) };`);

const pubmed = { source: "pubmed" }, scopus = { source: "scopus" };
check("3-candidate pubmed row", counts(pubmed, true, [1, 2, 3], false, false), { listed: 2, typed: 3 });
check("single-candidate row with a real top_cwid", counts(pubmed, false, [1], false, false), { listed: 0, typed: 1 });
check("single-candidate, no ReCiter identity", counts(pubmed, false, [1], false, true), { listed: 0, typed: 0 });
check("single-candidate, no suggestion", counts(pubmed, false, [], true, false), { listed: 0, typed: 0 });
check("scopus row", counts(scopus, true, [1, 2, 3], false, false), { listed: 0, typed: 0 });

// 3. the wording branches on `listed`, so the collapsed single-candidate case reads right.
console.log("3. wording");
const body = src.slice(src.indexOf("const HomonymNote"), src.indexOf("const MultiEvidence"));
check("typed < 1 renders nothing", /typed < 1 \? null/.test(body), true);
check("branches on listed", /listed < 1/.test(body), true);
check("combined sentence names both counts", /\{listed\}[\s\S]*\{typed\}/.test(body), true);

console.log(`\n${n} checks passed.`);
