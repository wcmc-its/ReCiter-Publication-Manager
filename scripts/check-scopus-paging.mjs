#!/usr/bin/env node
/**
 * R2 — page through ALL of an author's Scopus documents in the curate tab's Scopus search,
 * instead of stopping at the tool's first 200-doc page (AU-ID 55415053000: 809 docs, 609
 * unreachable before this). Source-text assertions, no DB/build/browser — same convention as
 * scripts/check-authorships-937.mjs.
 * Run: node scripts/check-scopus-paging.mjs
 *
 * Five sections, one per file touched:
 *   1. controllers/scopusSearch.controller.ts — PAGE/CAP constants, the sequential paging
 *      loop and its two stop guards (zero entries, zero new identifiers), dc:identifier
 *      dedupe, and the fetched/capped/partial return shape.
 *   2. src/pages/api/reciter/search/scopus.ts — passes fetched/capped/partial through untouched.
 *   3. src/components/elements/CurateIndividual/TabScopusAuthorships.tsx — needsReview/inRecord
 *      partition, the collapsed <details> section, the capped/partial-gated amber note (and
 *      the removed moreThanFetched heuristic), and the updated loading-state copy.
 *   4. Hardening follow-up (PM#957): every upstream fetch in the controller carries an
 *      AbortSignal.timeout, and normalizeScopusDoc() omits rawRecord for a PMID-bearing doc
 *      (never consumed on that path — see the ticket's rawRecord decision).
 *   5. Ticket F — a PMID-less Scopus doc is recognised as already in-record by DOI / Scopus
 *      document ID: findRecordPmid exists in ReciterTabs.tsx, is passed to
 *      TabScopusAuthorships as a prop, and the tab enriches d.pmid from it before the
 *      needsReview/inRecord partition runs.
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

const controllerSrc = readFileSync(join(ROOT, "controllers/scopusSearch.controller.ts"), "utf8");
const routeSrc = readFileSync(join(ROOT, "src/pages/api/reciter/search/scopus.ts"), "utf8");
const tabSrc = readFileSync(join(ROOT, "src/components/elements/CurateIndividual/TabScopusAuthorships.tsx"), "utf8");
const reciterTabsSrc = readFileSync(join(ROOT, "src/components/elements/CurateIndividual/ReciterTabs.tsx"), "utf8");

// ---------------------------------------------------------------------------------------
console.log("\n1. controllers/scopusSearch.controller.ts — sequential paging with two stop guards:");
const searchFnStart = controllerSrc.indexOf("export async function searchScopusDocuments");
assert(searchFnStart !== -1, "searchScopusDocuments() found");
const searchFn = controllerSrc.slice(searchFnStart);

assert(/const PAGE\s*=\s*200/.test(controllerSrc), "PAGE = 200 module constant");
assert(/const CAP\s*=\s*1000/.test(controllerSrc), "CAP = 1000 module constant");
// each constant carries its own explanatory comment directly above it (not just the shared
// block comment) — loosely checked as "a comment line immediately precedes the const"
const pageDeclIdx = controllerSrc.indexOf("const PAGE = 200");
const linesAbovePage = controllerSrc.slice(0, pageDeclIdx).trim().split("\n").slice(-1)[0];
assert(/^\/\//.test(linesAbovePage.trim()) || /\*\//.test(linesAbovePage), "PAGE constant has a preceding comment line");

assert(/while\s*\(\s*seen\.size\s*<\s*Math\.min\(total,\s*CAP\)\s*\)/.test(searchFn), "loop bounds on Math.min(total, CAP)");
assert(/if\s*\(\s*page\.entries\.length\s*===\s*0\s*\)\s*break/.test(searchFn), "stop guard: a page with zero entries breaks the loop");
assert(/if\s*\(\s*added\s*===\s*0\s*\)\s*break/.test(searchFn), "stop guard: zero NEW identifiers breaks the loop (defensive against `start` being ignored)");
assert(/seen\s*=\s*new Map/.test(searchFn) || /const seen = new Map/.test(controllerSrc), "dedupe set/map keyed for dc:identifier");
assert(/seen\.has\(id\)/.test(controllerSrc) && /seen\.set\(id,\s*e\)/.test(controllerSrc), "dedupe by dc:identifier across pages");
assert(/start\s*=\s*seen\.size/.test(searchFn), "next page's start offset is the count fetched so far");
assert(!/Promise\.all/.test(searchFn), "no parallel page fetches (Promise.all) — pages are sequential");

assert(/fetched:\s*results\.length/.test(searchFn), "return shape includes fetched: results.length");
assert(/capped:\s*total\s*>\s*results\.length/.test(searchFn), "return shape includes capped: total > results.length (fires for CAP, an ignored start, or a rollback)");
assert(/partial\s*\?\s*\{\s*partial:\s*true\s*\}/.test(searchFn) || /partial:\s*true/.test(searchFn), "return shape carries partial: true when a later page fails");

// page-one failure still throws (no try/catch wraps the first fetchScopusDocPage call);
// a later-page failure is caught and degrades to partial instead of throwing.
const firstPageCall = searchFn.indexOf("fetchScopusDocPage(params, 0)");
const beforeFirstCall = searchFn.slice(0, firstPageCall);
assert(!/try\s*\{[^}]*$/.test(beforeFirstCall.slice(-200)), "page-one fetch is NOT wrapped in try/catch (a page-one failure still throws)");
const loopBody = searchFn.slice(searchFn.indexOf("while ("));
assert(/try\s*\{\s*page\s*=\s*await fetchScopusDocPage/.test(loopBody), "a later page's fetch IS wrapped in try/catch");
assert(/catch\s*\(err\)\s*\{[^}]*partial\s*=\s*true/.test(loopBody), "a later-page failure sets partial = true rather than throwing");

assert(/console\.log\(`Scopus doc search: fetched extra page/.test(searchFn), "logs one line per extra page fetched");

// ---------------------------------------------------------------------------------------
console.log("\n2. src/pages/api/reciter/search/scopus.ts — passes fetched/capped/partial through:");
assert(/fetched\?:\s*number/.test(routeSrc), "Resp type gains fetched?: number");
assert(/capped\?:\s*boolean/.test(routeSrc), "Resp type gains capped?: boolean");
assert(/partial\?:\s*boolean/.test(routeSrc), "Resp type gains partial?: boolean");
assert(
  /const\s*\{\s*results,\s*total,\s*fetched,\s*capped,\s*partial\s*\}\s*=\s*await searchScopusDocuments/.test(routeSrc),
  "destructures fetched/capped/partial from searchScopusDocuments()"
);
assert(
  /res\.status\(200\)\.send\(\{\s*statusCode:\s*200,\s*results,\s*total,\s*fetched,\s*capped,\s*partial\s*\}\)/.test(routeSrc),
  "response passes fetched/capped/partial through untouched (no re-derivation)"
);

// ---------------------------------------------------------------------------------------
console.log("\n3. TabScopusAuthorships.tsx — needsReview/inRecord partition, collapsed section, gated note:");
assert(/const needsReview\s*=\s*docs\.filter/.test(tabSrc), "needsReview computed (today's feed predicate, renamed)");
assert(/const inRecord\s*=\s*docs\.filter/.test(tabSrc), "inRecord computed");
const inRecordDeclLine = tabSrc.slice(tabSrc.indexOf("const inRecord = docs.filter"));
const inRecordExpr = inRecordDeclLine.slice(0, inRecordDeclLine.indexOf("\n"));
assert(/!dismissed\.has\(d\.articleId\)/.test(inRecordExpr), "inRecord excludes dismissed rows");
assert(/d\.pmid\s*&&\s*props\.getPmidStatus\(d\.pmid\)/.test(inRecordExpr), "inRecord = has a PMID with a known record status");
assert(/const dismissedCount\s*=/.test(tabSrc), "a separate dismissed-this-session count is tracked");

assert(/moreThanFetched/.test(tabSrc) === false, "the moreThanFetched = total > docs.length heuristic is gone");
assert(/\(capped \|\| partial\)/.test(tabSrc), "the amber note is gated on capped || partial, not on a length heuristic");
assert(/Scopus stopped responding after/.test(tabSrc), "partial-specific note copy present");
assert(/Showing the first \$\{docs\.length\} of \$\{total\.toLocaleString\(\)\} Scopus documents/.test(tabSrc), "capped note copy present");

const detailsIdx = tabSrc.indexOf("<details");
assert(detailsIdx !== -1, "a <details> element is rendered");
const detailsBlock = tabSrc.slice(detailsIdx, tabSrc.indexOf("</details>") + "</details>".length);
assert(/inRecord\.length/.test(detailsBlock), "<details> summary/body references inRecord");
assert(/already in this person&apos;s record/.test(detailsBlock), "<details> summary reads '... already in this person&apos;s record'");
assert(/inRecord\.map/.test(detailsBlock), "<details> body maps over inRecord");
assert(/<ExternalPublicationCard/.test(detailsBlock), "<details> body renders ExternalPublicationCard for each inRecord doc");
assert(/mode="preview"/.test(detailsBlock), "inRecord cards use the same mode=\"preview\" as needsReview (reuses the 'Already accepted' state)");

assert(/needsReview\.map/.test(tabSrc), "needsReview list still rendered with ExternalPublicationCard");
assert(/Scopus results\{!loadingDocs && searched \? ` \(\$\{needsReview\.length\}\)` : ""\}/.test(tabSrc), "header count is needsReview.length");
assert(/Searching Scopus… large author profiles take a few seconds \(up to 5 pages\)/.test(tabSrc), "loading-state copy updated");

// ---------------------------------------------------------------------------------------
console.log("\n4. Hardening follow-up — upstream fetch timeouts + conditional rawRecord trim:");
assert(/const SCOPUS_FETCH_TIMEOUT_MS\s*=\s*15_000/.test(controllerSrc), "SCOPUS_FETCH_TIMEOUT_MS = 15_000 module constant");
const timeoutSignalCount = (controllerSrc.match(/signal:\s*AbortSignal\.timeout\(SCOPUS_FETCH_TIMEOUT_MS\)/g) || []).length;
assert(timeoutSignalCount === 2, `both upstream fetches (author search + doc page) carry the AbortSignal.timeout (found ${timeoutSignalCount}, want 2)`);

const authorSearchFnSrc = controllerSrc.slice(
  controllerSrc.indexOf("export async function searchScopusAuthors"),
  controllerSrc.indexOf("const PAGE = 200")
);
assert(/fetch\(`\$\{reciterConfig\.reciterScopus\.searchAuthorsEndpoint\}[\s\S]*?signal:\s*AbortSignal\.timeout\(SCOPUS_FETCH_TIMEOUT_MS\)/.test(authorSearchFnSrc), "author-search fetch carries the timeout signal");

const fetchPageFnSrc = controllerSrc.slice(
  controllerSrc.indexOf("async function fetchScopusDocPage"),
  controllerSrc.indexOf("export async function searchScopusDocuments")
);
assert(/fetch\(`\$\{reciterConfig\.reciterScopus\.searchDocumentsEndpoint\}[\s\S]*?signal:\s*AbortSignal\.timeout\(SCOPUS_FETCH_TIMEOUT_MS\)/.test(fetchPageFnSrc), "doc-page fetch carries the timeout signal");

// A timeout on an extra page (start > 0) is just another fetchScopusDocPage() rejection —
// it lands in the existing try/catch -> partial = true branch already asserted above
// (loopBody). A timeout on page one or the author search is likewise just another thrown
// error, surfaced through the existing (unwrapped) error paths already asserted above
// (beforeFirstCall / authorSearchFnSrc having no try/catch). No new branches to assert here
// beyond confirming no new try/catch was introduced around either call.
assert(!/try\s*\{[\s\S]*AbortSignal\.timeout[\s\S]*?catch/.test(authorSearchFnSrc), "no new try/catch wraps the author-search fetch (timeout surfaces through the existing error path)");

const normalizeFnSrc = controllerSrc.slice(
  controllerSrc.indexOf("function normalizeScopusDoc"),
  controllerSrc.indexOf("export async function searchScopusAuthors")
);
assert(/Number\(pmidRaw\) \? \{\} : \{ rawRecord: JSON\.stringify\(entry\) \}/.test(normalizeFnSrc), "rawRecord is included only for a doc without a numeric PMID (Number(pmidRaw) ? {} : { rawRecord }) — same predicate as the card's item.pmid gating");
assert(!/^\s*rawRecord:\s*JSON\.stringify\(entry\),\s*$/m.test(normalizeFnSrc), "rawRecord is no longer an unconditional field on every doc");

// ---------------------------------------------------------------------------------------
console.log("\n5. Ticket F — recognise in-record docs by DOI / Scopus ID:");
assert(/const findRecordPmid\s*=\s*\(doc:/.test(reciterTabsSrc), "findRecordPmid resolver defined in ReciterTabs.tsx");
const findRecordPmidSrc = reciterTabsSrc.slice(
  reciterTabsSrc.indexOf("const findRecordPmid = (doc:"),
  reciterTabsSrc.indexOf("const handleRefresh")
);
assert(/doc\.doi\b/.test(findRecordPmidSrc) && /doc\.articleId\b/.test(findRecordPmidSrc), "resolver reads doc.doi and doc.articleId");
assert(/replace\(\/\^SCOPUS:\//.test(findRecordPmidSrc), "resolver strips the leading SCOPUS: prefix from articleId");
assert(/normalizeDoi\(a\.doi\)\s*===\s*docDoi/.test(findRecordPmidSrc), "resolver matches on normalized DOI equality");
assert(/String\(a\.scopusDocID\)\s*===\s*docScopusId/.test(findRecordPmidSrc), "resolver matches on String(scopusDocID) equality");
assert(/tab\.value !== 'NULL' && tab\.value !== 'ACCEPTED' && tab\.value !== 'REJECTED'/.test(findRecordPmidSrc), "resolver scans the same NULL/ACCEPTED/REJECTED tab lists as getPmidStatus");

assert(/findRecordPmid=\{findRecordPmid\}/.test(reciterTabsSrc), "findRecordPmid is passed to TabScopusAuthorships as a prop");
const scopusAuthTagSrc = reciterTabsSrc.slice(reciterTabsSrc.indexOf("<TabScopusAuthorships"), reciterTabsSrc.indexOf("<TabScopusAuthorships") + 400);
assert(/findRecordPmid=\{findRecordPmid\}/.test(scopusAuthTagSrc), "the prop is wired on the <TabScopusAuthorships> tag itself (not just present elsewhere)");

assert(/findRecordPmid:\s*\(doc:/.test(tabSrc), "TabScopusAuthorships FuncProps declares findRecordPmid");
assert(/props\.findRecordPmid\(d\)/.test(tabSrc), "the tab calls props.findRecordPmid(d) to enrich a fetched doc");
const setDocsCallSrc = tabSrc.slice(tabSrc.indexOf("setDocs(results.map"), tabSrc.indexOf("setDocs(results.map") + 200);
assert(/d\.pmid\s*\?\s*d\s*:\s*\{\s*\.\.\.d,\s*pmid:\s*props\.findRecordPmid\(d\)\s*\?\?\s*undefined\s*\}/.test(setDocsCallSrc), "enrichment only fills pmid when the doc doesn't already have one");
assert(tabSrc.indexOf("setDocs(results.map") < tabSrc.indexOf("const needsReview"), "docs are enriched before the needsReview/inRecord partition runs");

console.log(failures ? `\n${failures} FAILED\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
