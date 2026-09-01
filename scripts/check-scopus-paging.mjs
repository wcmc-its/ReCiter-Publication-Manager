#!/usr/bin/env node
/**
 * R2 — page through ALL of an author's Scopus documents in the curate tab's Scopus search,
 * instead of stopping at the tool's first 200-doc page (AU-ID 55415053000: 809 docs, 609
 * unreachable before this). Source-text assertions, no DB/build/browser — same convention as
 * scripts/check-authorships-937.mjs.
 * Run: node scripts/check-scopus-paging.mjs
 *
 * Seven sections, one per file touched (the first six predate Ticket L; section 7 covers it):
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
 *   6. Ticket H — (1) ExternalArticle dedupe: TabScopusAuthorships fetches the person's
 *      ExternalArticles, builds a non-suppressed articleId Set, folds it into the
 *      needsReview/inRecord partition, and seeds addState 'added' for a match. (2) "Add via
 *      PubMed" auto-runs the search (ReciterTabs.handleAddViaPubMed dispatches
 *      pubmedFetchData) and actions.js's pubmedFetchData no longer throws on a null/undefined
 *      data.reciter. (3) CurateIndividual.module.css .tabsBar wraps instead of clipping.
 *   7. Ticket L — the 2026-09-01 stuck-spinner incident: (1) actions.js's pubmedFetchData
 *      non-200 branch dispatches PUBMED_CANCEL_FETCHING on every path, recognised or not.
 *      (2) controllers/pubmed.controller.ts times out both upstream fetches and never
 *      returns a bare error object as statusText. (3) src/pages/api/reciter/search/pubmed.ts
 *      always sends a numeric statusCode and always responds, even on an unrecognised
 *      statusCode-200 payload.
 *   8. Ticket N — direct "Add" on the Scopus card for a PMID-bearing doc: the new
 *      pubmed-article/[pmid] route + findPubmedByPmid, the shared toReciterArticle mapping
 *      used by both TabAddPublication.tsx and ReciterTabs.tsx, handleAcceptPmid (accepts
 *      without a tab switch), the card's primary Add + secondary Add via PubMed + accepted
 *      tag, and the justAccepted partition guard.
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
const actionsSrc = readFileSync(join(ROOT, "src/redux/actions/actions.js"), "utf8");
const cssSrc = readFileSync(join(ROOT, "src/components/elements/CurateIndividual/CurateIndividual.module.css"), "utf8");
const pubmedControllerSrc = readFileSync(join(ROOT, "controllers/pubmed.controller.ts"), "utf8");
const pubmedRouteSrc = readFileSync(join(ROOT, "src/pages/api/reciter/search/pubmed.ts"), "utf8");
const pubmedLookupSrc = readFileSync(join(ROOT, "controllers/pubmedLookup.controller.ts"), "utf8");
const pubmedArticleRouteSrc = readFileSync(join(ROOT, "src/pages/api/reciter/pubmed-article/[pmid].ts"), "utf8");
const toReciterArticleSrc = readFileSync(join(ROOT, "src/utils/toReciterArticle.ts"), "utf8");
const tabAddPublicationSrc = readFileSync(join(ROOT, "src/components/elements/TabAddPublication/TabAddPublication.tsx"), "utf8");
const cardSrc = readFileSync(join(ROOT, "src/components/elements/CurateIndividual/ExternalPublicationCard.tsx"), "utf8");

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
// Ticket N wraps the raw `d.pmid && props.getPmidStatus(d.pmid)` check in
// inGoldStandardRecord(d) (see section 7e) so a justAccepted pmid doesn't flip a
// doc into this block the instant doAcceptPmid succeeds — inGoldStandardRecord's own
// body still reads d.pmid && props.getPmidStatus(d.pmid), so the underlying condition
// is unchanged, just named.
assert(/inGoldStandardRecord\(d\)/.test(inRecordExpr), "inRecord = has a PMID with a known record status (via inGoldStandardRecord)");
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

// ---------------------------------------------------------------------------------------
console.log("\n6. Ticket H — external-article dedupe, PubMed auto-run, tab strip wrap:");

// (1) TabScopusAuthorships.tsx — externalIds Set fetched the way SourceArticleTab.tsx does,
// folded into the partition, and seeded into addStates as 'added'.
assert(/const \[externalIds, setExternalIds\]\s*=\s*useState<Set<string>>\(new Set\(\)\)/.test(tabSrc), "externalIds Set state declared");
const fetchExternalIdsSrc = tabSrc.slice(
  tabSrc.indexOf("const fetchExternalIds"),
  tabSrc.indexOf("const runSearch = (byArg")
);
assert(fetchExternalIdsSrc.length > 0 && fetchExternalIdsSrc.indexOf("const fetchExternalIds") === 0, "fetchExternalIds() defined");
assert(/fetch\(`\/api\/reciter\/external-article\/\$\{encodeURIComponent\(uid\)\}`/.test(fetchExternalIdsSrc), "fetches GET /api/reciter/external-article/${uid} — same endpoint as SourceArticleTab.tsx");
assert(/credentials:\s*"same-origin"/.test(fetchExternalIdsSrc) && /headers:\s*apiHeaders/.test(fetchExternalIdsSrc), "carries credentials: same-origin and apiHeaders");
assert(/body\.external/.test(fetchExternalIdsSrc), "reads rows off body.external");
assert(/row\.suppressed/.test(fetchExternalIdsSrc) && /!row\.suppressed/.test(fetchExternalIdsSrc), "Set is built from non-suppressed rows only (suppressed/revoked rows stay excluded — offering Add again is correct)");
assert(/row\.articleId/.test(fetchExternalIdsSrc), "Set is keyed on row.articleId");
assert(/\.catch\(\(\)\s*=>\s*setExternalIds\(new Set\(\)\)\)/.test(fetchExternalIdsSrc), "fetch failure degrades to an empty Set, never an error state");

assert(/fetchExternalIds\(\)/.test(tabSrc.slice(tabSrc.indexOf("useEffect(() => {\n        setDismissed"), tabSrc.indexOf("useEffect(() => {\n        setDismissed") + 300)), "called on tab open (mount effect)");
const runSearchSrc = tabSrc.slice(tabSrc.indexOf("const runSearch = (byArg"), tabSrc.indexOf("// On open:"));
assert(/fetchExternalIds\(\)/.test(runSearchSrc), "called again after a search completes");

assert(/const inExternalRecord\s*=\s*\(d:\s*any\)\s*=>\s*externalIds\.has\(d\.articleId\)/.test(tabSrc), "inExternalRecord(d) helper checks the Set");
const needsReviewLine = tabSrc.slice(tabSrc.indexOf("const needsReview = docs.filter"), tabSrc.indexOf("const needsReview = docs.filter") + 250);
assert(/!inExternalRecord\(d\)/.test(needsReviewLine), "needsReview excludes an externalIds match");
const inRecordLine2 = tabSrc.slice(tabSrc.indexOf("const inRecord = docs.filter"), tabSrc.indexOf("const inRecord = docs.filter") + 250);
assert(/inExternalRecord\(d\)/.test(inRecordLine2), "inRecord includes an externalIds match");

assert(/next\[d\.articleId\]\s*=\s*\{\s*status:\s*'added'\s*\}/.test(tabSrc), "a matched doc's addState is seeded to { status: 'added' } (renders the card's existing 'Added \u2713' tag)");
assert(/setExternalIds\(\(prev\)\s*=>\s*new Set\(prev\)\.add\(articleId\)\)/.test(tabSrc), "a successful in-session add inserts articleId into the local Set (re-search stays in-record without a refetch)");

// (2) ReciterTabs.tsx handleAddViaPubMed dispatches the same search the Add tab's button does;
// actions.js's pubmedFetchData no longer throws on a null/undefined data.reciter.
assert(/import\s*\{[^}]*\bpubmedFetchData\b[^}]*\}\s*from\s*"\.\.\/\.\.\/\.\.\/redux\/actions\/actions"/.test(reciterTabsSrc), "ReciterTabs.tsx imports pubmedFetchData");
const handleAddViaPubMedSrc = reciterTabsSrc.slice(
  reciterTabsSrc.indexOf("const handleAddViaPubMed = (pmid: number) => {"),
  reciterTabsSrc.indexOf("const handleAddViaPubMed = (pmid: number) => {") + 500
);
assert(/dispatch\(pubmedFetchData\(\{/.test(handleAddViaPubMedSrc), "handleAddViaPubMed dispatches pubmedFetchData(...)");
assert(/"strategy-query":\s*String\(pmid\)/.test(handleAddViaPubMedSrc), "query carries strategy-query: String(pmid) — mirrors TabAddPublication.tsx searchFunction");
assert(/"start":\s*''/.test(handleAddViaPubMedSrc) && /"end":\s*''/.test(handleAddViaPubMedSrc), "query carries empty start/end, same as an unfiltered PubMed search");
assert(/"personIdentifier":\s*reciterData\?\.reciter\?\.personIdentifier/.test(handleAddViaPubMedSrc), "query carries the person's uid as personIdentifier");
assert(/setPubSearchFilters/.test(handleAddViaPubMedSrc) && /onTabChange\('AddPub'\)/.test(handleAddViaPubMedSrc), "still pre-fills the search box and switches to the Add tab");

const pubmedFetchDataSrc = actionsSrc.slice(
  actionsSrc.indexOf("export const pubmedFetchData"),
  actionsSrc.indexOf("export const reciterUpdatePublication")
);
assert(/data\.reciter\s*&&\s*data\.reciter\.status\s*==\s*500\s*&&\s*recognised/.test(pubmedFetchDataSrc), "the non-200 branch guards data.reciter before reading .status/.message (null/undefined can no longer throw) — superseded by Ticket L's rewrite, still guarded");
assert(/toast\.error\("Pubmed query "\s*\+\s*query\["strategy-query"\]\s*\+\s*" failed"/.test(pubmedFetchDataSrc), "the guarded branch still shows the existing 'Pubmed query … failed' toast");
assert(/type:\s*methods\.PUBMED_CHANGE_DATA,\s*\n\s*payload:\s*\[\]/.test(pubmedFetchDataSrc), "the guarded branch still resets the list (PUBMED_CHANGE_DATA payload: [])");

// ---------------------------------------------------------------------------------------
console.log("\n8. Ticket N — direct Add on the Scopus card for a PMID-bearing doc:");

// (a) server: findPubmedByPmid + the new route, with a timeout.
assert(/export async function findPubmedByPmid\(pmid:\s*number\)/.test(pubmedLookupSrc), "findPubmedByPmid(pmid) exported from pubmedLookup.controller.ts");
const findByPmidSrc = pubmedLookupSrc.slice(pubmedLookupSrc.indexOf("export async function findPubmedByPmid"));
assert(/'strategy-query':\s*`\$\{pmid\}\[UID\]`/.test(findByPmidSrc), "queries strategy-query: `${pmid}[UID]`");
assert(/signal:\s*AbortSignal\.timeout\(30000\)/.test(findByPmidSrc), "carries AbortSignal.timeout(30000)");
assert(/Number\(articlePmid\)\s*===\s*Number\(pmid\)/.test(findByPmidSrc), "matches the first article whose own PMID equals the requested pmid");
assert(/return match \?\? null/.test(findByPmidSrc), "returns null when no article matches");

assert(/export function formatPubmedSearch/.test(pubmedControllerSrc), "formatPubmedSearch is exported from pubmed.controller.ts");

assert(/import\s*\{\s*findPubmedByPmid\s*\}\s*from\s*'\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/controllers\/pubmedLookup\.controller'/.test(pubmedArticleRouteSrc), "route imports findPubmedByPmid");
assert(/import\s*\{\s*formatPubmedSearch\s*\}\s*from\s*'\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/controllers\/pubmed\.controller'/.test(pubmedArticleRouteSrc), "route imports formatPubmedSearch (same formatter the Add tab's search results use)");
assert(/req\.method\s*!==\s*"GET"/.test(pubmedArticleRouteSrc), "route only supports GET");
assert(/req\.headers\.authorization\s*!==\s*reciterConfig\.backendApiKey/.test(pubmedArticleRouteSrc), "route checks Authorization === reciterConfig.backendApiKey, same pattern as search/pubmed.ts");
assert(/!Number\.isInteger\(pmid\)\s*\|\|\s*pmid\s*<=\s*0/.test(pubmedArticleRouteSrc), "route 400s on a pmid that isn't a positive integer");
assert(/res\.status\(404\)\.send\(\{\s*statusCode:\s*404/.test(pubmedArticleRouteSrc), "route 404s when findPubmedByPmid returns null");
assert(/formatPubmedSearch\(\{\s*filter100PubMedArticles:\s*\[article\]\s*\}/.test(pubmedArticleRouteSrc), "route formats the single article via formatPubmedSearch({filter100PubMedArticles: [article]}, false)[0] — formatPubmedSearch reads data.filter100PubMedArticles, not a bare array");
assert(/res\.status\(200\)\.send\(\{\s*statusCode:\s*200,\s*article:\s*formatted\s*\}\)/.test(pubmedArticleRouteSrc), "route responds 200 {article}");
assert((pubmedArticleRouteSrc.match(/console\.error\(/g) || []).length === 2, "two console.error lines: one for the lookup failure/timeout, one for an article the formatter cannot shape");
assert(/if \(!formatted \|\| !formatted\.pmid\)[\s\S]{0,200}res\.status\(502\)/.test(pubmedArticleRouteSrc), "route answers 502 when the formatted article has no pmid (never returns a shapeless article)");
assert(/504\s*:\s*502/.test(pubmedArticleRouteSrc), "route responds 504 on a timeout, 502 on any other lookup failure");

// (b) shared mapping: toReciterArticle, used by both TabAddPublication.tsx and ReciterTabs.tsx.
assert(/export const toReciterArticle\s*=\s*\(article:\s*any,\s*userAssertion:\s*string\s*=\s*'ACCEPTED'\)/.test(toReciterArticleSrc), "toReciterArticle(article, userAssertion) exported");
assert(/articleTitle:\s*article\.title/.test(toReciterArticleSrc) && /reCiterArticleAuthorFeatures:\s*mapPubMedAuthorsToReciterAuthors\(article\.authors\)/.test(toReciterArticleSrc), "builds the same articleTitle/reCiterArticleAuthorFeatures fields TabAddPublication.tsx built inline");

assert(/import\s*\{\s*toReciterArticle\s*\}\s*from\s*"\.\.\/\.\.\/\.\.\/utils\/toReciterArticle"/.test(tabAddPublicationSrc), "TabAddPublication.tsx imports toReciterArticle");
const acceptPublicationSrc = tabAddPublicationSrc.slice(
  tabAddPublicationSrc.indexOf("const acceptPublication = async"),
  tabAddPublicationSrc.indexOf("const rejectPublication = ")
);
assert(/toReciterArticle\(publication,\s*"ACCEPTED"\)/.test(acceptPublicationSrc), "TabAddPublication.tsx's acceptPublication calls toReciterArticle instead of building the object inline");
assert(!/Object\.assign\(publication,/.test(acceptPublicationSrc), "the old inline Object.assign(publication, {...}) construction is gone from acceptPublication");
// rejectPublication is untouched — still builds its own object inline (a pure move only
// touches the one call site the ticket named).
const rejectPublicationSrc = tabAddPublicationSrc.slice(tabAddPublicationSrc.indexOf("const rejectPublication = "));
assert(/Object\.assign\(publication,/.test(rejectPublicationSrc), "rejectPublication is left untouched (still builds its object inline)");

assert(/import\s*\{\s*toReciterArticle\s*\}\s*from\s*"\.\.\/\.\.\/\.\.\/utils\/toReciterArticle"/.test(reciterTabsSrc), "ReciterTabs.tsx imports toReciterArticle");

// (c) handleAcceptPmid: dispatches reciterUpdatePublication, calls updatePublicationAssertion,
// and does NOT switch tabs (no onTabChange call anywhere in its body).
assert(/import\s*\{[^}]*\breciterUpdatePublication\b[^}]*\}\s*from\s*"\.\.\/\.\.\/\.\.\/redux\/actions\/actions"/.test(reciterTabsSrc), "ReciterTabs.tsx imports reciterUpdatePublication");
assert(/const userId\s*=\s*session\?\.data\?\.databaseUser\?\.userID/.test(reciterTabsSrc), "userId is read from session.data.databaseUser.userID — same source TabAddPublication.tsx uses");
assert(/const identityData\s*=\s*useSelector\(\(state:\s*RootStateOrAny\)\s*=>\s*state\.identityData\)/.test(reciterTabsSrc), "identityData is read from state.identityData via useSelector — same source TabAddPublication.tsx uses");
const handleAcceptPmidSrc = reciterTabsSrc.slice(
  reciterTabsSrc.indexOf("const handleAcceptPmid = (pmid: number, item: any): Promise<void> => {"),
  reciterTabsSrc.indexOf("const handleAcceptPmid = (pmid: number, item: any): Promise<void> => {") + 1600
);
assert(handleAcceptPmidSrc.indexOf("const handleAcceptPmid") === 0, "handleAcceptPmid(pmid, item) defined, returning Promise<void>");
assert(/fetch\(`\/api\/reciter\/pubmed-article\/\$\{pmid\}`/.test(handleAcceptPmidSrc), "fetches GET /api/reciter/pubmed-article/{pmid}");
assert(/Authorization:\s*reciterConfig\.backendApiKey/.test(handleAcceptPmidSrc), "carries Authorization: reciterConfig.backendApiKey, same header pattern as the tab's other client calls");
assert(/dispatch\(reciterUpdatePublication\(identityData\.uid,\s*request\)\)/.test(handleAcceptPmidSrc), "dispatches reciterUpdatePublication(identityData.uid, request)");
assert(/updatePublicationAssertion\(newObject,\s*"ACCEPTED",\s*undefined\)/.test(handleAcceptPmidSrc), "calls updatePublicationAssertion(article, 'ACCEPTED', undefined)");
assert(!/onTabChange/.test(handleAcceptPmidSrc), "does NOT call onTabChange — stays on the current tab, unlike handleAddViaPubMed");
assert(!/UpdatePubMadeData/.test(handleAcceptPmidSrc), "does NOT dispatch UpdatePubMadeData — there is no PubMed-tab search list to prune here");
assert(/throw new Error\(\(body\s*&&\s*body\.message\)\s*\|\|\s*`HTTP \$\{r\.status\}`\)/.test(handleAcceptPmidSrc), "rejects with a message on a non-200/missing-article response from the route");

assert(/onAcceptPmid=\{handleAcceptPmid\}/.test(reciterTabsSrc), "handleAcceptPmid is passed to <TabScopusAuthorships> as onAcceptPmid");

// (d) TabScopusAuthorships.tsx — doAcceptPmid mirrors doAdd's state handling.
assert(/onAcceptPmid:\s*\(pmid:\s*number,\s*item:\s*any\)\s*=>\s*Promise<void>/.test(tabSrc), "FuncProps declares onAcceptPmid");
const doAcceptPmidSrc = tabSrc.slice(
  tabSrc.indexOf("const doAcceptPmid = (pmid: number, item: any) => {"),
  tabSrc.indexOf("const doReject = (item: any) => {")
);
assert(doAcceptPmidSrc.indexOf("const doAcceptPmid") === 0, "doAcceptPmid(pmid, item) defined");
assert(/setAddState\(articleId,\s*\{\s*status:\s*"adding"\s*\}\)/.test(doAcceptPmidSrc), "sets addState 'adding' before calling onAcceptPmid, same as doAdd");
assert(/props\.onAcceptPmid\(pmid,\s*item\)/.test(doAcceptPmidSrc), "calls props.onAcceptPmid(pmid, item) with the pmid the card passed (item.pmid, or the PMID a DOI lookup resolved)");
assert(/setAddState\(articleId,\s*\{\s*status:\s*"accepted"\s*\}\)/.test(doAcceptPmidSrc), "on success sets addState 'accepted'");
assert(/setJustAccepted\(\(prev\)\s*=>\s*new Set\(prev\)\.add\(pmid\)\)/.test(doAcceptPmidSrc), "on success adds the pmid to the justAccepted Set");
assert(/setAddState\(articleId,\s*\{\s*status:\s*"idle"\s*\}\)/.test(doAcceptPmidSrc) && /toast\.error\("Could not accept:\s*"/.test(doAcceptPmidSrc), "on failure toasts the message and clears the addState back to idle, same toast style as doAdd");

assert(/const \[justAccepted, setJustAccepted\]\s*=\s*useState<Set<number>>\(new Set\(\)\)/.test(tabSrc), "justAccepted Set state declared");
assert(/onAcceptPmid=\{\(pmid,\s*it\)\s*=>\s*doAcceptPmid\(pmid,\s*it\)\}/.test(tabSrc), "doAcceptPmid is wired to the <ExternalPublicationCard> onAcceptPmid prop");

// (e) justAccepted guard in the needsReview/inRecord partition.
assert(/const inGoldStandardRecord\s*=\s*\(d:\s*any\)\s*=>\s*!!\(d\.pmid\s*&&\s*props\.getPmidStatus\(d\.pmid\)\s*&&\s*!justAccepted\.has\(d\.pmid\)\)/.test(tabSrc), "inGoldStandardRecord(d) excludes a justAccepted pmid from counting as already-in-record");
assert(/const needsReview = docs\.filter\(\(d\)\s*=>\s*!dismissed\.has\(d\.articleId\)\s*&&\s*!inGoldStandardRecord\(d\)\s*&&\s*!inExternalRecord\(d\)\)/.test(tabSrc), "needsReview uses inGoldStandardRecord (not the raw getPmidStatus check)");
assert(/const inRecord = docs\.filter\(\(d\)\s*=>\s*!dismissed\.has\(d\.articleId\)\s*&&\s*\(inGoldStandardRecord\(d\)\s*\|\|\s*inExternalRecord\(d\)\)\)/.test(tabSrc), "inRecord uses inGoldStandardRecord too, so the two partitions stay complementary");

// (f) ExternalPublicationCard.tsx — primary Add + secondary Add via PubMed + accepted tag.
assert(/status:\s*'idle'\s*\|\s*'adding'\s*\|\s*'checking'\s*\|\s*'blocked'\s*\|\s*'warning'\s*\|\s*'inPubmed'\s*\|\s*'added'\s*\|\s*'accepted'/.test(cardSrc), "AddState gains an 'accepted' status");
assert(/onAcceptPmid\?:\s*\(pmid:\s*number,\s*item:\s*any\)\s*=>\s*void/.test(cardSrc), "FuncProps declares onAcceptPmid(pmid, item)");
assert(/status === 'accepted'[\s\S]{0,60}<span className=\{styles\.addedTag\}>Accepted &#10003;<\/span>/.test(cardSrc), "status === 'accepted' renders an 'Accepted ✓' tag reusing styles.addedTag");
assert(/props\.onAcceptPmid\s*&&\s*props\.onAcceptPmid\(pubmedPmid,\s*item\)/.test(cardSrc), "the primary Add button passes pubmedPmid (item.pmid or the DOI-resolved addState.pmid), not just the item");
assert(/status === 'adding' && pubmedPmid && !recStatus[\s\S]{0,120}Adding&#8230;/.test(cardSrc), "status === 'adding' renders a disabled 'Adding…' button");
assert(/props\.onAddViaPubMed\s*&&\s*props\.onAddViaPubMed\(pubmedPmid,\s*item\)/.test(cardSrc), "the secondary button still calls onAddViaPubMed(pubmedPmid, item)");

// (3) CurateIndividual.module.css — .tabsBar wraps instead of clipping.
const tabsBarBlock = cssSrc.slice(cssSrc.indexOf(".tabsBar {"), cssSrc.indexOf(".tabsBar {") + cssSrc.slice(cssSrc.indexOf(".tabsBar {")).indexOf("}") + 1);
assert(/flex-wrap:\s*wrap/.test(tabsBarBlock), ".tabsBar gains flex-wrap: wrap");
assert(/overflow-x:\s*auto/.test(tabsBarBlock), ".tabsBar keeps overflow-x: auto as a fallback");

// ---------------------------------------------------------------------------------------
console.log("\n7. Ticket L — PubMed search: clear the spinner on every error path; time out and log:");

// (a) actions.js pubmedFetchData non-200 branch — both the recognised and the error path
// fall through to a single PUBMED_CANCEL_FETCHING dispatch before the outer statusCode
// if/else closes (the bug: the pre-Ticket-L error path never cancelled the spinner).
const nonOkStart = pubmedFetchDataSrc.indexOf("if (data.statusCode != 200 )");
const nonOkEnd = pubmedFetchDataSrc.indexOf("} else {", nonOkStart);
assert(nonOkStart !== -1 && nonOkEnd !== -1 && nonOkEnd > nonOkStart, "non-200 branch located (bounded by the outer '} else {')");
const nonOkBlock = pubmedFetchDataSrc.slice(nonOkStart, nonOkEnd);
assert(/const recognised\s*=\s*msg\.indexOf\('No results were found\.'\)\s*>=\s*0\s*\|\|\s*msg\.indexOf\('more than 1,000 results'\)\s*>=\s*0/.test(nonOkBlock), "recognised = 'No results were found.' or 'more than 1,000 results' (the stale 200-results string and the wrong || are gone)");
assert(/toast\.error\("Pubmed query "/.test(nonOkBlock), "the error path still fires the toast.error call");
const cancelDispatchCount = (nonOkBlock.match(/type:\s*methods\.PUBMED_CANCEL_FETCHING/g) || []).length;
assert(cancelDispatchCount === 1, "exactly one PUBMED_CANCEL_FETCHING dispatch in the non-200 branch (shared by both paths, not duplicated per-branch)");
const lastCancelIdx = nonOkBlock.lastIndexOf("PUBMED_CANCEL_FETCHING");
const toastIdx = nonOkBlock.indexOf("toast.error(");
const recognisedIdx = nonOkBlock.indexOf("const recognised =");
assert(recognisedIdx !== -1 && toastIdx > recognisedIdx && lastCancelIdx > toastIdx, "the recognised check and the toast.error call both precede the PUBMED_CANCEL_FETCHING dispatch");
assert(nonOkBlock.slice(lastCancelIdx).trim().endsWith("})"), "the PUBMED_CANCEL_FETCHING dispatch is the last statement in the non-200 branch, unconditionally reached by both paths, right before the outer '} else {'");

// (b) controllers/pubmed.controller.ts — both upstream fetches time out; no bare error object
// is ever handed back as statusText (a fetch TypeError has no .status).
const timeoutOccurrences = (pubmedControllerSrc.match(/AbortSignal\.timeout\(/g) || []).length;
assert(timeoutOccurrences === 2, `both upstream fetches carry AbortSignal.timeout (found ${timeoutOccurrences}, want 2)`);
assert(/const COUNT_FETCH_TIMEOUT_MS\s*=\s*30_000/.test(pubmedControllerSrc), "count hop timeout is 30 000 ms");
assert(/const SEARCH_FETCH_TIMEOUT_MS\s*=\s*240_000/.test(pubmedControllerSrc), "search hop timeout is 240 000 ms (under the client's 300 000 ms race)");
assert(!/statusCode:\s*error\.status/.test(pubmedControllerSrc), "no statusCode: error.status (a fetch TypeError has no .status — always undefined)");
assert(/isTimeoutError\(error\)/.test(pubmedControllerSrc), "abort/timeout errors are distinguished from other thrown errors");
assert(/statusCode:\s*504/.test(pubmedControllerSrc) && /statusCode:\s*502/.test(pubmedControllerSrc), "timeout maps to 504, any other thrown error maps to 502");
assert(/console\.error\(`\[search\/pubmed\]/.test(pubmedControllerSrc), "failures are logged with the [search/pubmed] prefix");
const consoleErrorCount = (pubmedControllerSrc.match(/console\.error\(/g) || []).length;
assert(consoleErrorCount === 1, "console.error is called from a single shared logger (one definition, multiple call sites)");
assert(/responseText\s*=\s*\{\s*status:\s*500,\s*message:\s*`PubMed count request failed with HTTP \$\{res\.status\}`\s*\}/.test(pubmedControllerSrc), "a non-JSON count-hop error response (e.g. a Tomcat HTML page) falls back to a { status, message } object instead of throwing");

// (c) src/pages/api/reciter/search/pubmed.ts — statusCode is always a number, and the
// statusCode-200 branch can never finish without sending a response.
assert(/const code\s*=\s*Number\.isInteger\(apiResponse\.statusCode\)\s*\?\s*apiResponse\.statusCode\s*:\s*500;/.test(pubmedRouteSrc), "non-200 path coerces a non-integer apiResponse.statusCode to 500");
const nonOkRouteBranch = pubmedRouteSrc.slice(pubmedRouteSrc.indexOf("} else{"));
assert((nonOkRouteBranch.match(/\bcode\b/g) || []).length >= 2, "the coerced `code` is used in both the res.status(...) call and the response body's statusCode");
const statusCode200Branch = pubmedRouteSrc.slice(pubmedRouteSrc.indexOf("if(apiResponse.statusCode === 200)"), pubmedRouteSrc.indexOf("} else{"));
assert(/else \{\s*\n\s*console\.error/.test(statusCode200Branch), "a final else on the statusCode-200 branch logs the unexpected payload");
assert(/res\.status\(502\)\.send\(\{\s*\n\s*statusCode:\s*502,\s*\n\s*message:\s*'Unexpected PubMed response'/.test(statusCode200Branch), "and always responds 502 'Unexpected PubMed response' rather than falling through with no response sent");

// ---------------------------------------------------------------------------
// SAML login must hand the jwt() callback the scope columns (est4003, 2026-09-01):
// samlUtils.js builds the databaseUser object by hand; the three admin_users scope
// columns that [...nextauth].jsx reads from it must be present.
const samlUtilsSrc = readFileSync(join(ROOT, "src/utils/samlUtils.js"), "utf8");
const samlDbUserBlock = samlUtilsSrc.slice(samlUtilsSrc.indexOf("let databaseUser = {"), samlUtilsSrc.indexOf("createdAdminUser['databaseUser'] = databaseUser"));
for (const col of ["scope_person_types", "scope_org_units", "proxy_person_ids"]) {
  assert(new RegExp(`"${col}":\\s*createdAdminUser\\.${col}`).test(samlDbUserBlock), `SAML databaseUser carries ${col}`);
}

console.log(failures ? `\n${failures} FAILED\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
