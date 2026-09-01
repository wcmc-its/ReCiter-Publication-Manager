#!/usr/bin/env node
/**
 * PM#951 Layer 2 — PubMed-twin adjudication surface for Scopus review rows the producer has
 * flagged with a possible PubMed match (authorship_review.matched_pmid, ReCiterDB v2.7).
 * Guarded by source inspection so this runs with no DB (the new columns don't exist yet
 * anywhere real), no AWS creds, no build — same reason as the other scripts/check-*.mjs in
 * this directory.
 * Run: node scripts/check-authorships-951.mjs
 *
 * Sections:
 *   1. AuthorshipReview.ts — the 4 new columns declared in all three spots (interface, class,
 *      init()), ENUM value lists matching the DDL.
 *   2. LIST_ATTRIBUTES — the 4 columns are returned to the client.
 *   3. openStatusWhere — duplicates widened (accept_conflict OR unverdicted matched_pmid),
 *      open narrowed (excludes an unverdicted matched_pmid flag) — a clean partition.
 *   4. case "dismiss" — dup_of_matched_pmid composes its note server-side from the row's own
 *      matched_pmid, never from client-supplied body.note/body.note-shaped free text.
 *   5. case "verdict" — new action, only accepts verdict:"distinct", never touches status.
 *   6. counterpart.ts — gates on reciterConfig.backendApiKey exactly like lookup.ts (the
 *      read-only gating level, not action.ts's curator-resolving one).
 *   7. authorshipCounterpart — PubMed fetch via the same proxy/term shape as findPubmedByDoi,
 *      a bounded timeout, PersonArticle membership check, and a fetchError that degrades to
 *      HTTP 200 rather than a 4xx/5xx.
 *   8. AuthorshipsTabs.tsx — the 4 fields on AuthorshipRow, the "PubMed twin?" chip, the
 *      CounterpartPanel component, its "could not be fetched" states, and both verdict buttons
 *      wired to the right action payloads.
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

const modelSrc = readFileSync(join(ROOT, "src/db/models/AuthorshipReview.ts"), "utf8");
const controllerSrc = readFileSync(join(ROOT, "controllers/db/authorships.controller.ts"), "utf8");
const lookupSrc = readFileSync(join(ROOT, "src/pages/api/db/authorships/lookup.ts"), "utf8");
const counterpartRouteSrc = readFileSync(join(ROOT, "src/pages/api/db/authorships/counterpart.ts"), "utf8");
const tabsSrc = readFileSync(join(ROOT, "src/components/elements/Authorships/AuthorshipsTabs.tsx"), "utf8");

// ---------------------------------------------------------------------------------------
console.log("\n1. AuthorshipReview.ts — 4 new columns, all three spots, correct ENUMs:");
assert((modelSrc.match(/matched_pmid\?:\s*number/g) || []).length >= 2,
  "matched_pmid?: number declared (interface + class)");
assert((modelSrc.match(/matched_pmid_source\?:\s*'scopus' \| 'doi' \| 'title'/g) || []).length >= 2,
  "matched_pmid_source?: 'scopus' | 'doi' | 'title' declared (interface + class)");
assert((modelSrc.match(/matched_pmid_at\?:\s*Date/g) || []).length >= 2,
  "matched_pmid_at?: Date declared (interface + class)");
assert((modelSrc.match(/matched_pmid_verdict\?:\s*'same' \| 'distinct'/g) || []).length >= 2,
  "matched_pmid_verdict?: 'same' | 'distinct' declared (interface + class)");
const initBlock = modelSrc.slice(modelSrc.indexOf("AuthorshipReview.init({"), modelSrc.indexOf("tableName: 'authorship_review'"));
assert(/matched_pmid:\s*\{\s*type:\s*DataTypes\.BIGINT,\s*allowNull:\s*true\s*\}/.test(initBlock),
  "init(): matched_pmid is BIGINT, nullable");
assert(/matched_pmid_source:\s*\{\s*type:\s*DataTypes\.ENUM\('scopus',\s*'doi',\s*'title'\)/.test(initBlock),
  "init(): matched_pmid_source ENUM('scopus','doi','title')");
assert(/matched_pmid_at:\s*\{\s*type:\s*DataTypes\.DATE/.test(initBlock),
  "init(): matched_pmid_at is DATE");
assert(/matched_pmid_verdict:\s*\{\s*type:\s*DataTypes\.ENUM\('same',\s*'distinct'\)/.test(initBlock),
  "init(): matched_pmid_verdict ENUM('same','distinct')");

// ---------------------------------------------------------------------------------------
console.log("\n2. LIST_ATTRIBUTES — the 4 columns reach the client:");
const listAttrs = controllerSrc.slice(controllerSrc.indexOf("const LIST_ATTRIBUTES"), controllerSrc.indexOf("];", controllerSrc.indexOf("const LIST_ATTRIBUTES")));
for (const col of ["matched_pmid", "matched_pmid_source", "matched_pmid_at", "matched_pmid_verdict"]) {
  assert(listAttrs.includes(`"${col}"`), `LIST_ATTRIBUTES includes "${col}"`);
}

// ---------------------------------------------------------------------------------------
console.log("\n3. openStatusWhere — duplicates widened, open narrowed, a clean partition:");
const openStatusFn = controllerSrc.slice(
  controllerSrc.indexOf("function openStatusWhere"), controllerSrc.indexOf("function isRowOpenForLike"),
);
assert(openStatusFn.length > 200, "openStatusWhere() located");
const dupBranch = openStatusFn.slice(openStatusFn.indexOf('view === "duplicates"'), openStatusFn.indexOf("// open queue:"));
assert(/accept_conflict:\s*\{\s*\[Op\.ne\]:\s*null\s*\}/.test(dupBranch), "duplicates: still includes accept_conflict IS NOT NULL");
assert(/matched_pmid:\s*\{\s*\[Op\.ne\]:\s*null\s*\},\s*matched_pmid_verdict:\s*null/.test(dupBranch),
  "duplicates: widened with matched_pmid IS NOT NULL AND matched_pmid_verdict IS NULL");
assert(/\[Op\.or\]/.test(dupBranch), "duplicates: the two signals are OR'd, not AND'd");
const openBranch = openStatusFn.slice(openStatusFn.indexOf("// open queue:"));
assert(/matched_pmid:\s*null/.test(openBranch) && /matched_pmid_verdict:\s*\{\s*\[Op\.ne\]:\s*null\s*\}/.test(openBranch),
  "open: excludes an unverdicted matched_pmid flag (matched_pmid IS NULL OR matched_pmid_verdict IS NOT NULL)");
// isRowOpenForLike must stay in lockstep with the widened open branch, or like_count silently
// double-subtracts for exactly the rows this feature is about (see its own header comment).
const likeFn = controllerSrc.slice(
  controllerSrc.indexOf("function isRowOpenForLike"), controllerSrc.indexOf("const ABSENT_CWID_TTL_MS"),
);
assert(/matched_pmid_verdict\s*==\s*null/.test(likeFn) && /matched_pmid\s*!=\s*null/.test(likeFn),
  "isRowOpenForLike kept in lockstep with the widened open-queue predicate");

// ---------------------------------------------------------------------------------------
console.log('\n4. case "dismiss" — server-composed note, never client free text:');
const dismissCase = controllerSrc.slice(controllerSrc.indexOf('case "dismiss": {'), controllerSrc.indexOf('case "reopen": {'));
assert(dismissCase.length > 100, 'case "dismiss" located');
assert(/body\.reason\s*===\s*"dup_of_matched_pmid"/.test(dismissCase), 'gated on body.reason === "dup_of_matched_pmid"');
assert(/row\.matched_pmid\s*==\s*null/.test(dismissCase) && /status\(400\)/.test(dismissCase),
  "400s when the row has no matched_pmid to dismiss against");
assert(/dup of PMID \$\{row\.matched_pmid\} \(curator\)/.test(dismissCase),
  "note is composed from row.matched_pmid (server-side), matching assign's append convention");
assert(/row\.note \? `\$\{row\.note\} \| `/.test(dismissCase), "reuses the `${row.note ? ... : \"\"}` append convention");
assert(!/body\.note/.test(dismissCase), "never reads body.note — no client-supplied free text reaches the note column");
// plain dismiss (no reason) must still work unchanged
assert(/status:\s*"dismissed",\s*reviewer,\s*resolved_at:\s*new Date\(\)\s*\},\s*\{\s*where:\s*\{\s*id\s*\}\s*\}\s*\);\s*\n\s*break;\s*\n\s*\}/.test(dismissCase),
  "plain dismiss (no reason) path is still present, unchanged");

// ---------------------------------------------------------------------------------------
console.log('\n5. case "verdict" — new action, "distinct" only, never touches status:');
const verdictCase = controllerSrc.slice(controllerSrc.indexOf('case "verdict": {'), controllerSrc.indexOf("\n      default:"));
assert(verdictCase.length > 50 && verdictCase.length < 1200, 'case "verdict" located, before default:');
assert(/body\.verdict\s*!==\s*"distinct"/.test(verdictCase) && /status\(400\)/.test(verdictCase),
  'rejects anything but verdict:"distinct" with 400');
assert(/matched_pmid_verdict:\s*"distinct"/.test(verdictCase), "writes matched_pmid_verdict: 'distinct'");
assert(/row\.matched_pmid == null/.test(verdictCase) && verdictCase.split("status(400)").length >= 3, "rejects a row without matched_pmid with 400");
assert(!/\bstatus:\s*"/.test(verdictCase), "never sets status");
assert(!/\breviewer[,:]/.test(verdictCase) && !/resolved_at:/.test(verdictCase) && !/note:/.test(verdictCase),
  "never sets reviewer/resolved_at/note — not a resolution of the row");
assert(!/"same"/.test(controllerSrc.slice(controllerSrc.indexOf('case "verdict": {'), controllerSrc.indexOf('case "verdict": {') + 800)),
  '"same" is never written by case "verdict"');

// ---------------------------------------------------------------------------------------
console.log("\n6. counterpart.ts — gates like lookup.ts (read-only level, not action.ts's):");
assert(/authorshipCounterpart/.test(counterpartRouteSrc), "imports/calls authorshipCounterpart");
// Compare just the handler function body (header comments legitimately differ per-route).
const handlerBody = (src) => src.slice(src.indexOf("export default async function handler"))
  .replace(/authorshipLookupCwid|authorshipCounterpart/g, "FN");
assert(handlerBody(lookupSrc) === handlerBody(counterpartRouteSrc), "handler() body is byte-identical to lookup.ts's (modulo the controller fn name)");
assert(/reciterConfig\.backendApiKey/.test(counterpartRouteSrc), "gates on reciterConfig.backendApiKey");
assert(!/getToken|resolveCurator/.test(counterpartRouteSrc), "no curator-identity resolution — read-only route");

// ---------------------------------------------------------------------------------------
console.log("\n7. authorshipCounterpart — PubMed fetch, timeout, PersonArticle check, degrades to 200:");
const counterpartFn = controllerSrc.slice(
  controllerSrc.indexOf("export const authorshipCounterpart"), controllerSrc.length,
);
assert(counterpartFn.length > 500, "authorshipCounterpart() located");
assert(/reciterConfig\.reciterPubmed\.searchPubmedEndpoint/.test(counterpartFn), "uses the same PubMed proxy endpoint as findPubmedByDoi");
assert(/\$\{pmid\}\[PMID\]/.test(counterpartFn), "term is `${pmid}[PMID]`, not the DOI [AID] term");
assert(/new AbortController\(\)/.test(counterpartFn) && /10000/.test(counterpartFn), "bounded (10s) AbortController timeout on the PubMed fetch");
assert(/models\.PersonArticle\.findAll/.test(counterpartFn), "queries PersonArticle for the in-record-for check");
assert(/candidateCwidsFromRow\(row\)/.test(counterpartFn), "candidate set is [top_cwid] ∪ candidate_cwids_json (candidateCwidsFromRow)");
assert(/source:\s*"pubmed",\s*pmid/.test(counterpartFn), "pubmedLaneRow query is scoped to source='pubmed' for this pmid");
assert(/fetchError\s*=/.test(counterpartFn), "a PubMed fetch failure sets fetchError rather than throwing");
assert(/res\.status\(200\)\.send\(\{\s*scopus,\s*pubmed,\s*fetchError/.test(counterpartFn), "response is always HTTP 200, fetchError included, actions stay usable");
assert(/doiEqual:\s*scopusNorm\.doi\s*&&\s*pubmedNorm\.doi\s*\?/.test(counterpartFn), "doiEqual is null (not false) when either side lacks a DOI");

// ---------------------------------------------------------------------------------------
console.log("\n8. AuthorshipsTabs.tsx — fields, chip, CounterpartPanel, buttons:");
assert(/matched_pmid\?:\s*number \| null/.test(tabsSrc), "AuthorshipRow.matched_pmid");
assert(/matched_pmid_source\?:\s*"scopus" \| "doi" \| "title" \| null/.test(tabsSrc), "AuthorshipRow.matched_pmid_source");
assert(/matched_pmid_verdict\?:\s*"same" \| "distinct" \| null/.test(tabsSrc), "AuthorshipRow.matched_pmid_verdict");
assert(/r\.matched_pmid != null && !r\.matched_pmid_verdict/.test(tabsSrc), "the PubMed-twin chip is gated on matched_pmid set + no verdict yet");
assert(/PubMed twin\?/.test(tabsSrc), '"PubMed twin?" chip text present');
assert(/const CounterpartPanel = /.test(tabsSrc), "CounterpartPanel component defined");
assert(/r\.matched_pmid != null &&\s*\(\s*<CounterpartPanel/.test(tabsSrc), "CounterpartPanel mounted in the isExpanded block, gated on matched_pmid != null");
assert(/could not be fetched \(/.test(tabsSrc), '"could not be fetched (<reason>)" state present (never an empty column)');
assert(/onAction\("dismiss",\s*\{\s*reason:\s*"dup_of_matched_pmid"\s*\}\)/.test(tabsSrc), '"Same paper" button: onAction("dismiss", { reason: "dup_of_matched_pmid" })');
assert(/onAction\("verdict",\s*\{\s*verdict:\s*"distinct"\s*\}\)/.test(tabsSrc), '"Different papers" button: onAction("verdict", { verdict: "distinct" })');
assert(/Same paper/.test(tabsSrc) && /Different papers/.test(tabsSrc), "both button labels present");
assert(/action !== "reopen" && action !== "verdict"/.test(tabsSrc), 'undo toast suppressed for "verdict", same as "reopen"');
assert(!/setUndo[\s\S]{0,40}"same"/.test(tabsSrc), '"same" is never surfaced as a stored verdict client-side either');

console.log(failures ? `\n${failures} FAILED\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
