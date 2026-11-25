#!/usr/bin/env node
/**
 * Guards the two things the hover-card change added: the department self-heal on the list
 * endpoint, and the top-topics block on the prior-names endpoint.
 * Run: node scripts/check-authorships-dept-keywords.mjs
 *
 * Unlike the source-only checks beside it (986, homonym-note, reports) this one needs the DB,
 * because both behaviours are claims about DATA — "a blank producer dept is stale, not a
 * different fact" and "a homonym's REJECTED keywords describe the other person" — and a source
 * regex cannot tell you whether either is true. It reads only; it writes nothing.
 *
 * The logic under test is never re-implemented here. Every executable line of it is SLICED OUT
 * OF controllers/db/authorships.controller.ts at run time and evaluated verbatim via
 * `new Function` — the same trick check-authorships-homonym-note.mjs uses on the HomonymNote
 * counts, for the same reason: a check that re-types the expression it is checking proves only
 * that the author can type it twice. The `const x: T = {}` declarations that wrap two of those
 * blocks are re-declared here untyped, which is what they compile to anyway.
 *
 * Ground truth comes from queries that are deliberately NOT the controller's — a separate
 * NOT EXISTS probe establishes which keywords are reachable only through non-ACCEPTED rows, and
 * the controller's own SQL is then asked whether it returns any of them. Two independent
 * statements disagreeing is the whole point; asking the controller's query to audit itself would
 * not be.
 *
 * Fixtures are DISCOVERED, not hardcoded. The dev DB is thinly populated relative to prod (13
 * blank-top_dept rows recoverable here vs a prod screenshot showing rascott's "Pediatrics"
 * against a producer-written ""), so a hardcoded cwid that stops qualifying would quietly turn
 * an assertion into a no-op. Where no natural example exists the script says so in the clear
 * and counts a failure rather than passing on an empty set.
 *
 * Sections:
 *   A. DEPARTMENT — a CANDIDATE's blank producer dept is filled from
 *      identity.primaryAcademicDepartment; a non-blank one is NOT overwritten even when identity
 *      now says something different; the LEAD's top_dept is left alone entirely, because its
 *      presence picks between two different evidence sentences a curator reads as justification;
 *      and identityDeptDivision is asked about every cwid on the page, not the leads alone.
 *   B. KEYWORDS — topics are drawn ONLY from the cwid's ACCEPTED papers. The teeth: keywords
 *      that reach the cwid only through REJECTED/pending rows must be absent, and at least one
 *      of them must be one that WOULD have made the top six unfiltered — otherwise the
 *      userAssertion filter could be deleted with no visible effect and this check would be
 *      guarding nothing.
 *   C. SHAPE — the per-cwid cap binds, and every requested cwid gets an entry.
 *
 * Verified by mutation, 2026-09-10/11: edits to the controller — dropping the userAssertion
 * filter, making the candidate dept fill unconditional, deleting it, dropping
 * primaryAcademicDepartment from the identity read, removing the per-cwid entry fill, narrowing
 * identityDeptDivision back to the leads, and re-introducing a json.top_dept assignment — each
 * produced a red run naming that defect.
 * The cap's VALUE is the one thing here that is not policed: CAP is read from
 * PRIOR_NAMES_TOPIC_CAP, so raising it keeps this green by design. What is asserted is that the
 * cap binds at whatever it is set to, which is the invariant; its value is a product call.
 */

import { createConnection } from "mysql2/promise";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
const NOTE = "\x1b[33mNOTE\x1b[0m";
let failures = 0;
const assert = (cond, label) => {
  console.log(`  ${cond ? PASS : FAIL} ${label}`);
  if (!cond) failures++;
};
// A missing fixture is reported, never swallowed: an assertion over an empty set is a green
// tick that means nothing, which is worse than a red one that means "go look".
const missing = (label) => {
  console.log(`  ${FAIL} ${label}`);
  failures++;
};
const note = (msg) => console.log(`  ${NOTE} ${msg}`);

// Same .env.local reader as mint-local-session.mjs — an already-exported value wins, so a shell
// that has `set -a && . ./.env.local` still works.
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

// ---------------------------------------------------------------------------------------
// 0. Lift the real code out of the controller.
// ---------------------------------------------------------------------------------------
const ctl = readFileSync(join(ROOT, "controllers/db/authorships.controller.ts"), "utf8");
const slice = (from, to, after = 0) => {
  const a = ctl.indexOf(from, after);
  if (a < 0) return "";
  const b = ctl.indexOf(to, a + from.length);
  return b < 0 ? "" : ctl.slice(a, b + to.length);
};
// Same, but returning only what lies BETWEEN the two anchors. Section A's blocks are anchored on
// their NEIGHBOURS — the enclosing map's `let next = c;`, the retired-cwid comment, the
// gold-standard top-level check — never on their own condition. Anchoring a slice on the text it
// is testing means any edit to that text reports "extraction broke" instead of naming the defect:
// a reviewer reads that as a stale check, not as a bug, which is the failure mode a mutation run
// caught here (an unconditional overwrite must fail as an overwrite).
const between = (from, to) => {
  const a = ctl.indexOf(from);
  if (a < 0) return "";
  const b = ctl.indexOf(to, a + from.length);
  return b < 0 ? "" : ctl.slice(a + from.length, b);
};
console.log("\n0. extraction — every assertion below runs the controller's own source text:");

// identityDeptDivision's row shaper. `out` is re-declared untyped; the controller's
// `Record<string, { division?: string; department?: string }>` erases to exactly this.
const shaperSrc = slice("found.forEach((r) => {", "\n  });");
// The candidate blank-fill, verbatim, sliced between its neighbours. The slice carries the
// already_rejected line with it — that is deliberate, it is what actually runs beside the dept
// fill, and running the pair proves the two annotations still compose on one `next`.
const candFillSrc = between('          const cwid = String(c.cwid);', "          // ED has retired this identifier");
// There is deliberately NO lead blank-fill to slice. top_dept is left exactly as the producer
// wrote it, because its PRESENCE selects between two different evidence claims the curator reads
// as justification: the never-retrieved line picks "…names Weill Cornell and the department (X)"
// over "…and the surname is unique", and the `Dept: {top_dept} ✓` chip is gated on the producer's
// own top_affil_match (75 dev rows have top_affil_match=1 with a blank top_dept). Healing it
// would make both assert that a department the producer never compared is what matched.
// This is the guard that stops someone "finishing the job" later.
// The identity read's column list, used to build the same SELECT the controller's findAll emits.
// A dropped column is caught by section A, not by a guard here: it arrives as a department that
// never turns up, which is the symptom a curator would actually report.
const idAttrs = slice('attributes: ["cwid", "primaryAcademicDivision"', "raw: true,");
// The topics query, as a JS expression: the controller builds it by string concatenation, so
// evaluating that concatenation gives back the exact statement it sends.
const sqlExprSrc = slice('"SELECT `k`.`personIdentifier` AS `cwid`', '`k`.`keyword`",').replace(/,$/, "");
// The grouping loop and the sort/cap loop, together, unchanged.
const topicsSrc = slice("for (const r of keywordRows) {", "\n    }\n\n    // ---- roster identity");
// The line that guarantees an entry per requested cwid.
const entrySrc = slice("for (const c of cwids) { names[c]", "}\n");
const capSrc = (ctl.match(/const PRIOR_NAMES_TOPIC_CAP = (\d+);/) || [])[1];

const idColumns = [...idAttrs.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);

// The controller with every line comment removed, so a prose mention of a token cannot satisfy a
// search for that token in code. Used by the "top_dept is NOT healed" guard below, which would
// otherwise be defeated by the very paragraph that explains why the fill is absent.
const ctlCode = ctl.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

// These guards are about the SLICE, not the semantics: each proves a region was located and is
// the size it should be. None of them names the token under test, on purpose. A mutation run
// showed the alternative is worse: a guard reading `primaryAcademicDepartment` or
// `topics[c] ||= []` turns "someone deleted the feature" into "extraction broke", which a
// reviewer reads as a stale check rather than a defect. What the code DOES is settled below,
// against the database, where a deleted fill shows up as a department that never arrived.
assert(/found\.forEach/.test(shaperSrc) && shaperSrc.length < 1200, "identityDeptDivision row shaper sliced");
assert(idColumns[0] === "cwid", "identity read's attribute list sliced");
assert(/let next = c;/.test(candFillSrc) && candFillSrc.length < 600, "candidate annotation block sliced");
// Semantic, not structural: no code path may assign to json.top_dept.
assert(!/\bjson\.top_dept\s*=[^=]/.test(ctlCode),
  "lead top_dept is NOT healed (no assignment to json.top_dept)");
assert(sqlExprSrc.includes("person_article_keyword"), "topics SQL literal sliced");
assert(topicsSrc.includes("keywordRows") && topicsSrc.length < 1500, "topics grouping + sort/cap sliced");
assert(/\|\|=/.test(entrySrc) && entrySrc.length < 200, "per-cwid entry fill sliced");
assert(!!capSrc, "PRIOR_NAMES_TOPIC_CAP found");
if (failures) { console.log(`\n${failures} failure(s) — a region could not be located in the controller, so nothing below would have meant anything`); process.exit(1); }

const CAP = Number(capSrc);
// Every injected block gets its own line. The slices carry their end marker, and one of those
// markers is a `//` comment header — appending `return` to the same line silently commented the
// return out and handed the section an undefined object to assert against.
const shapeIdm = new Function("found", `const out = {};\n${shaperSrc}\nreturn out;`);
// checkRejected=false / empty map / pmid 0 neutralise the already_rejected annotation that
// shares the block; the dept fill is the only thing left able to change `next`.
const fillCandidate = new Function("c", "cwid", "idm",
  `const checkRejected = false, rejectedByCwid = {}, pmidNum = 0;\n${candFillSrc}\nreturn next;`);
const TOPICS_SQL = new Function(`return (${sqlExprSrc});`)();
const buildTopics = new Function("keywordRows", "PRIOR_NAMES_TOPIC_CAP",
  `const topics = {};\n${topicsSrc}\nreturn topics;`);
const fillEntries = new Function("cwids", "topics",
  `const names = {}, accepted = {}, papers = {};\n${entrySrc}\nreturn topics;`);

// The widening is a source fact, not a data fact: identityDeptDivision must be asked about the
// candidate cwids too, and pageCwids must be built from ALL rows — not the pubmed-only subset
// the gold-standard rejection check uses, which would drop every scopus row's candidates.
const listFn = slice("export const listAuthorships", "export const authorshipSelectable");
assert(/identityDeptDivision\(\[\.\.\.pageCwids\]\)/.test(listFn),
  "identityDeptDivision is asked about pageCwids, not rows.map(top_cwid)");
assert(/for \(const r of rows\) \{[\s\S]{0,200}pageCwids\.add/.test(listFn),
  "pageCwids is built from every row (scopus included), not just pubmedRows");

// ---------------------------------------------------------------------------------------
const conn = await createConnection({
  host: process.env.RECITER_DB_HOST, user: process.env.RECITER_DB_USERNAME,
  password: process.env.RECITER_DB_PASSWORD, database: process.env.RECITER_DB_NAME,
  port: Number(process.env.RECITER_DB_PORT || 3306),
  // The controller's SQL is lifted verbatim, `:cwids` and all, so the driver has to speak the
  // same placeholder dialect Sequelize does. Rewriting the statement to `?` would mean this
  // check no longer runs the string the app runs.
  namedPlaceholders: true,
});

// ---------------------------------------------------------------------------------------
// A. DEPARTMENT
// ---------------------------------------------------------------------------------------
console.log("\nA. department self-heal (candidates blank-fill only; lead deliberately untouched):");

// Discovery. Deliberately NOT the controller's read — this is the ground truth the controller's
// answer is judged against. identity is scanned whole because the collation trap forbids the
// obvious join: identity.cwid is utf8mb4_unicode_ci and authorship_review.top_cwid is
// utf8mb4_general_ci, so `WHERE top_cwid IN (SELECT cwid FROM identity)` throws 1267 — the same
// reason the controller does its own IN() app-side instead of a fourth include.
const [arRows] = await conn.query(
  "SELECT id, top_cwid, top_dept, candidate_cwids_json FROM authorship_review " +
  "WHERE candidate_cwids_json IS NOT NULL AND candidate_cwids_json <> '' ORDER BY id");
const [idRows] = await conn.query(
  "SELECT cwid, primaryAcademicDepartment d FROM identity WHERE primaryAcademicDepartment <> ''");
const truth = new Map(idRows.map((r) => [String(r.cwid), String(r.d).trim()]));

let fillCand = null, keepCand = null, fillTopRow = null;
for (const r of arRows) {
  let cs = []; try { cs = JSON.parse(r.candidate_cwids_json || "[]"); } catch { cs = []; }
  if (!Array.isArray(cs)) cs = [];
  const topDept = String(r.top_dept || "").trim();
  const topTruth = r.top_cwid ? truth.get(String(r.top_cwid)) : undefined;
  if (!fillTopRow && !topDept && topTruth) fillTopRow = { row: r, cs, expect: topTruth };
  for (const c of cs) {
    if (!c || !c.cwid) continue;
    const dept = String(c.dept || "").trim();
    const t = truth.get(String(c.cwid));
    if (!t) continue;
    if (!fillCand && !dept) fillCand = { row: r, cs, c, expect: t };
    // Teeth: identity must say something DIFFERENT, so an unconditional overwrite changes the
    // rendered value and this assertion goes red. A candidate whose identity dept merely equals
    // the producer's would pass either way (4,356 of them do on dev) and prove nothing.
    if (!keepCand && dept && t !== dept) keepCand = { row: r, cs, c, keep: dept, rival: t };
  }
}

// Runs the controller's own path: its column list, its IN() over the page's cwids, its shaper.
const idmFor = async (cwids) => {
  const wanted = [...new Set(cwids.filter(Boolean).map(String))];
  if (!wanted.length) return {};
  const [found] = await conn.query(
    `SELECT ${idColumns.map((c) => `\`${c}\``).join(", ")} FROM identity WHERE cwid IN (:cwids)`,
    { cwids: wanted });
  return shapeIdm(found);
};
const pageCwidsOf = (row, cs) => [row.top_cwid, ...cs.map((c) => c && c.cwid)].filter(Boolean).map(String);

if (!fillCand) {
  missing("no dev candidate has a blank producer dept AND an identity department — " +
    "A's fill case asserted NOTHING; re-check on prod before believing this file is green");
} else {
  const idm = await idmFor(pageCwidsOf(fillCand.row, fillCand.cs));
  const out = fillCandidate(fillCand.c, String(fillCand.c.cwid), idm);
  assert(String(fillCand.c.dept || "").trim() === "", `fixture: row ${fillCand.row.id} candidate ${fillCand.c.cwid} producer dept is blank`);
  assert(out.dept === fillCand.expect,
    `candidate ${fillCand.c.cwid} blank "" -> "${out.dept}" (identity says "${fillCand.expect}")`);
}

if (!keepCand) {
  missing("no dev candidate has a non-blank producer dept that identity DISAGREES with — " +
    "A's do-not-overwrite case asserted nothing with teeth");
} else {
  const idm = await idmFor(pageCwidsOf(keepCand.row, keepCand.cs));
  const out = fillCandidate(keepCand.c, String(keepCand.c.cwid), idm);
  assert(idm[String(keepCand.c.cwid)]?.department === keepCand.rival,
    `fixture: identity offers a different dept for ${keepCand.c.cwid} ("${keepCand.rival}")`);
  assert(out.dept === keepCand.keep,
    `candidate ${keepCand.c.cwid} keeps producer "${keepCand.keep}", NOT identity's "${keepCand.rival}"`);
}

// The lead is NOT healed, and this is the case that would tempt someone to heal it: a row whose
// producer top_dept is blank while identity knows the department perfectly well. It must stay
// blank, so that the never-retrieved evidence line keeps saying "and the surname is unique"
// rather than naming a department the producer never compared. The structural guard above proves
// no assignment exists; this proves the consequence on a real row.
if (!fillTopRow) {
  missing("no dev row has a blank top_dept AND an identity department — lead do-not-heal asserted nothing");
} else {
  const idm = await idmFor(pageCwidsOf(fillTopRow.row, fillTopRow.cs));
  assert(!!idm[String(fillTopRow.row.top_cwid)]?.department,
    `fixture: identity DOES know ${fillTopRow.row.top_cwid}'s dept ("${fillTopRow.expect}"), so leaving it blank is a choice`);
  assert(String(fillTopRow.row.top_dept || "").trim() === "",
    `row ${fillTopRow.row.id} lead ${fillTopRow.row.top_cwid} top_dept stays blank, NOT "${fillTopRow.expect}" (evidence-line provenance)`);
}

// A cwid absent from `identity` must leave the producer's blank alone rather than crash or
// invent a value — the hover card omits the line, which is the common case (of 1,232 distinct
// dev candidate cwids carrying dept "", only 18 are recoverable at all).
const orphan = arRows.flatMap((r) => {
  let cs = []; try { cs = JSON.parse(r.candidate_cwids_json || "[]"); } catch { cs = []; }
  return (Array.isArray(cs) ? cs : []).filter((c) => c && c.cwid && !String(c.dept || "").trim() && !truth.has(String(c.cwid)))
    .map((c) => ({ row: r, c, cs }));
})[0];
if (!orphan) note("every blank-dept candidate on dev has an identity row — orphan case not exercised");
else {
  const idm = await idmFor(pageCwidsOf(orphan.row, orphan.cs));
  const out = fillCandidate(orphan.c, String(orphan.c.cwid), idm);
  assert(String(out.dept || "") === String(orphan.c.dept || ""),
    `candidate ${orphan.c.cwid} has no identity row — dept left as the producer wrote it`);
}

// ---------------------------------------------------------------------------------------
// B. KEYWORDS
// ---------------------------------------------------------------------------------------
console.log("\nB. topics come only from the cwid's ACCEPTED papers:");

// Ground truth, by a statement the controller does not contain: keywords that reach a cwid ONLY
// through a REJECTED or pending person_article row. For a homonym these are the OTHER person's
// subjects, which is exactly why they must not reach a card whose job is telling the two apart.
const rejectedOnly = async (cwid) => {
  const [r] = await conn.query(
    "SELECT k.keyword, COUNT(*) n FROM person_article_keyword k " +
    "JOIN person_article pa ON pa.personIdentifier = k.personIdentifier AND pa.pmid = k.pmid " +
    "WHERE k.personIdentifier = :c AND pa.userAssertion <> 'ACCEPTED' AND k.keyword <> '' " +
    "AND NOT EXISTS (SELECT 1 FROM person_article_keyword k2 " +
    "  JOIN person_article pa2 ON pa2.personIdentifier = k2.personIdentifier AND pa2.pmid = k2.pmid " +
    "  WHERE k2.personIdentifier = k.personIdentifier AND k2.keyword = k.keyword " +
    "    AND pa2.userAssertion = 'ACCEPTED') " +
    "GROUP BY k.keyword ORDER BY n DESC, k.keyword", { c: cwid });
  return r.map((x) => ({ keyword: String(x.keyword), n: Number(x.n) }));
};
// …and what the card WOULD show if the userAssertion filter were deleted.
const unfilteredTop = async (cwid) => {
  const [r] = await conn.query(
    "SELECT k.keyword, COUNT(*) n FROM person_article_keyword k " +
    "JOIN person_article pa ON pa.personIdentifier = k.personIdentifier AND pa.pmid = k.pmid " +
    "WHERE k.personIdentifier = :c AND k.keyword <> '' GROUP BY k.keyword " +
    "ORDER BY n DESC, k.keyword LIMIT :cap", { c: cwid, cap: CAP });
  return r.map((x) => String(x.keyword));
};

// Pick the cwid where the filter matters most: on the queue, with accepted keywords of its own,
// and with the largest count of keywords that only its non-accepted papers carry.
const [contested] = await conn.query(
  "SELECT k.personIdentifier cwid, " +
  "  SUM(CASE WHEN pa.userAssertion = 'ACCEPTED' THEN 1 ELSE 0 END) acc, " +
  "  SUM(CASE WHEN pa.userAssertion <> 'ACCEPTED' THEN 1 ELSE 0 END) non " +
  "FROM person_article_keyword k " +
  "JOIN person_article pa ON pa.personIdentifier = k.personIdentifier AND pa.pmid = k.pmid " +
  "GROUP BY k.personIdentifier HAVING acc > 0 AND non > 0 ORDER BY non DESC LIMIT 50");
const queueCwids = new Set(arRows.flatMap((r) => {
  let cs = []; try { cs = JSON.parse(r.candidate_cwids_json || "[]"); } catch { cs = []; }
  return [r.top_cwid, ...(Array.isArray(cs) ? cs.map((c) => c && c.cwid) : [])].filter(Boolean).map(String);
}));
const probe = contested.map((r) => String(r.cwid)).find((c) => queueCwids.has(c))
  || (contested[0] && String(contested[0].cwid));

if (!probe) {
  missing("no cwid on dev has both ACCEPTED and non-ACCEPTED keyword rows — B asserted nothing");
} else {
  const banned = await rejectedOnly(probe);
  const wouldShow = await unfilteredTop(probe);
  const bannedSet = new Set(banned.map((b) => b.keyword));
  const loadBearing = wouldShow.filter((k) => bannedSet.has(k));
  console.log(`  probe cwid ${probe}${queueCwids.has(probe) ? " (on the authorships queue)" : ""}: ` +
    `${banned.length} keyword(s) reachable only via REJECTED/pending rows`);

  if (!banned.length) {
    missing(`${probe} has no REJECTED/pending-only keyword — the strong form of B could not be asserted`);
  } else {
    // The controller's own statement, its own placeholder, asked about a real page's worth of
    // cwids: the probe, its rivals, and a cwid with no keyword rows at all (C, below).
    const [noKeywords] = await conn.query(
      "SELECT DISTINCT k.personIdentifier c FROM person_article_keyword k WHERE k.personIdentifier IN (:cwids)",
      { cwids: [...queueCwids].slice(0, 400) });
    const withKw = new Set(noKeywords.map((x) => String(x.c)));
    const emptyCwid = [...queueCwids].slice(0, 400).find((c) => !withKw.has(c));
    const requested = [probe, ...contested.slice(0, 8).map((r) => String(r.cwid)), emptyCwid]
      .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

    const [keywordRows] = await conn.query(TOPICS_SQL, { cwids: requested });
    const topics = fillEntries(requested, buildTopics(keywordRows, CAP));
    const got = (topics[probe] || []).map((t) => t.keyword);
    console.log(`  ${probe} topics: ${got.join(" / ") || "(none)"}`);

    const leaked = got.filter((k) => bannedSet.has(k));
    assert(leaked.length === 0,
      `no REJECTED/pending-only keyword reaches ${probe}'s topics${leaked.length ? ` (leaked: ${leaked.join(", ")})` : ""}`);
    if (!loadBearing.length) {
      note(`dropping the userAssertion filter would not change ${probe}'s top ${CAP} — ` +
        "the absence assertion above is true but currently costs nothing to satisfy");
    } else {
      assert(!got.includes(loadBearing[0]),
        `"${loadBearing[0]}" would lead ${probe}'s card unfiltered (${banned.find((b) => b.keyword === loadBearing[0]).n} rows) and is absent`);
    }

    // ---- C. shape ----------------------------------------------------------------------
    console.log("\nC. cap and per-cwid entries:");
    const over = Object.entries(topics).filter(([, v]) => v.length > CAP);
    assert(over.length === 0, `no cwid exceeds PRIOR_NAMES_TOPIC_CAP=${CAP}${over.length ? ` (${over[0][0]}: ${over[0][1].length})` : ""}`);
    const [distinct] = await conn.query(
      "SELECT k.personIdentifier c, COUNT(DISTINCT k.keyword) n FROM person_article_keyword k " +
      "JOIN person_article pa ON pa.personIdentifier = k.personIdentifier AND pa.pmid = k.pmid " +
      "AND pa.userAssertion = 'ACCEPTED' WHERE k.personIdentifier IN (:cwids) AND k.keyword <> '' " +
      "GROUP BY k.personIdentifier", { cwids: requested });
    const binding = distinct.find((d) => Number(d.n) > CAP);
    if (!binding) missing(`no requested cwid has more than ${CAP} distinct accepted keywords — the cap never binds`);
    else assert((topics[String(binding.c)] || []).length === CAP,
      `${binding.c} has ${binding.n} distinct accepted keywords, capped to exactly ${CAP}`);
    assert(requested.every((c) => Array.isArray(topics[c])),
      `all ${requested.length} requested cwids have a topics entry`);
    if (!emptyCwid) note("no queue cwid on dev is entirely without keyword rows — empty-entry case not exercised");
    else assert(Array.isArray(topics[emptyCwid]) && topics[emptyCwid].length === 0,
      `${emptyCwid} has no keyword rows at all and still gets [] (asked-and-none, not never-asked)`);

    // Counts must survive the driver: COUNT(*) can arrive as a string, and a string sort would
    // rank "9" above "41". The controller's Number(r.n) is what stops that, so check the result
    // is actually ordered rather than trusting the coercion.
    const ordered = got.every((_, i) => i === 0 || topics[probe][i - 1].n >= topics[probe][i].n);
    assert(ordered && topics[probe].every((t) => typeof t.n === "number"),
      "topics are numerically ranked, descending (COUNT(*) coerced, not string-sorted)");
  }
}

await conn.end();
console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
