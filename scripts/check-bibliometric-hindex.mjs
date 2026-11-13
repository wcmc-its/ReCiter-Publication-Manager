#!/usr/bin/env node
/**
 * Parity check for the bibliometric report v2 (controllers/db/reports/bibliometrics.ts).
 *
 *   node scripts/check-bibliometric-hindex.mjs [--as-of YYYY-MM-DD] [--require-v2]
 *        [--article-table T] [--author-table T] [--peer-table T] [--allow-non-dev]
 *
 * Read-only: the session is set READ ONLY before any query. By default it refuses a host
 * without "-dev-" in RECITER_DB_HOST and a server whose @@hostname is not on the dev subnet;
 * --allow-non-dev lifts that for the prod read-only run in the rollout (credentials from the
 * RECITER_DB_* environment, which wins over .env.local).
 *
 * A. h-index.
 *    A1. The module's STEP 6 rule (hIndexes(..., { stepSix: true })) against the stored v1
 *        analysis_summary_person.hindexNIH / h5indexNIH (NULL = 0). Must be 0 mismatches.
 *    A2. The module's v2 rule (errata and retractions left out, Decision 6) against an
 *        independent SQL window-function computation, for every person with a works row.
 *        Must be 0 mismatches. Also prints how many people's v2 h differs from v1 (informational).
 *    The h5 window needs the nightly run date: --as-of, else runDate in the peer table, else the
 *    date of the "6." DONE row of the job whose "7." swap DONE row is newest.
 * B. Top-N (needs v3.11 / R2). For every analysis_summary_person_peer row: the module's
 *    topNAverage() from the flagged rows equals avgTop exactly (thousandths), and ratedCount and
 *    recentCount match. The stored ranks are re-derived: M = qualifying eligible members of the
 *    same facultyRank x roleSet x topN, R = 1 + members strictly higher, NULL when M < 20.
 *    Lists every tie group of 3 or more at the same avgTop. Skipped (not failed) when the v3.11
 *    columns or the table are absent, unless --require-v2.
 *
 * Exit code 1 on any mismatch, 2 on a refused host.
 */

import { createConnection } from "mysql2/promise";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hIndexes, topNAverage, recentResearchInSet, ratedInSet, countedWorks, thousandths, isoDate,
  MIN_COHORT, V2_WORK_COLUMNS, V2_PEER_COLUMNS, flag,
} from "../controllers/db/reports/bibliometrics.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(ROOT, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const has = (name) => process.argv.includes(name);
const ident = (v, dflt) => {
  const t = v ?? dflt;
  if (!/^[A-Za-z0-9_]+$/.test(t)) throw new Error(`bad table name ${t}`);
  return `\`${t}\``;
};
const ARTICLE = ident(arg("--article-table"), "analysis_summary_article");
const AUTHOR = ident(arg("--author-table"), "analysis_summary_author");
const PEER = ident(arg("--peer-table"), "analysis_summary_person_peer");
const allowNonDev = has("--allow-non-dev");

const host = process.env.RECITER_DB_HOST || "";
if (!allowNonDev && !host.includes("-dev-")) {
  console.error("Refusing: RECITER_DB_HOST is not a dev host (pass --allow-non-dev for a read-only prod run).");
  process.exit(2);
}

const conn = await createConnection({
  host, user: process.env.RECITER_DB_USERNAME, password: process.env.RECITER_DB_PASSWORD,
  database: process.env.RECITER_DB_NAME, port: Number(process.env.RECITER_DB_PORT || 3306),
  dateStrings: true, supportBigNumbers: true, decimalNumbers: false,
});
let failed = false;
let skipped = false;
const fail = () => { failed = true; };
try {
  await conn.query("SET SESSION TRANSACTION READ ONLY");
  await conn.query("START TRANSACTION READ ONLY");
  const [[{ h: serverHost }]] = await conn.query("SELECT @@hostname AS h");
  if (!allowNonDev && !String(serverHost).startsWith("ip-172-17-4-")) {
    console.error(`Refusing: @@hostname ${serverHost} is not the dev server.`);
    process.exit(2);
  }
  console.log(`server ${serverHost}; tables ${ARTICLE}, ${AUTHOR}, ${PEER}`);

  // ---- v3.11 presence
  const bare = (t) => t.replace(/`/g, "");
  const [cols] = await conn.query(
    "SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?)",
    [bare(ARTICLE), bare(AUTHOR), bare(PEER)]);
  const colSet = new Set(cols.map((r) => r.c));
  const peerCols = new Set(cols.filter((r) => r.t === bare(PEER)).map((r) => r.c));
  const missingWork = V2_WORK_COLUMNS.filter((c) => !colSet.has(c));
  const missingPeer = V2_PEER_COLUMNS.filter((c) => !peerCols.has(c));
  const v2 = missingWork.length === 0 && missingPeer.length === 0;

  // ---- run date
  let asOf = arg("--as-of");
  if (asOf) console.log(`asOf ${asOf} (from --as-of)`);
  else if (v2) {
    const [[r]] = await conn.query(`SELECT MAX(runDate) AS d, COUNT(DISTINCT runDate) AS n FROM ${PEER}`);
    asOf = isoDate(r.d);
    console.log(`asOf ${asOf} (runDate in ${PEER}; ${r.n} distinct)`);
  }
  if (!asOf) {
    const [[swap]] = await conn.query(
      "SELECT job_id, created_at FROM analysis_job_log WHERE step LIKE '7.%' AND status = 'DONE' ORDER BY id DESC LIMIT 1");
    const [[h6]] = await conn.query(
      "SELECT created_at FROM analysis_job_log WHERE job_id = ? AND step LIKE '6.%' AND status = 'DONE' ORDER BY id DESC LIMIT 1",
      [swap.job_id]);
    asOf = String(h6.created_at).slice(0, 10);
    console.log(`nightly job ${swap.job_id}: STEP 6 done ${h6.created_at}, swap ${swap.created_at} -> asOf ${asOf}`);
  }

  // ---- works rows for everyone (v3.11 columns when present)
  const v2Select = missingWork.length === 0
    ? ", r.provisionalNIH, r.hasPercentileNIH, r.pctExact, r.researchArticleV2, r.ratedV2, r.recentV2, a.authorRoleV2, a.soleAuthor"
    : "";
  const [rows] = await conn.query(
    `SELECT a.personIdentifier, r.pmid, r.source_type AS sourceType, r.pubTypeCounted, r.publicationTypeCanonical,
            r.citationCountNIH, r.relativeCitationRatioNIH, r.datePublicationAddedToEntrez, r.pubDate, r.articleYear${v2Select}
       FROM ${AUTHOR} a JOIN ${ARTICLE} r ON r.pmid = a.pmid`);
  const byPerson = new Map();
  for (const r of rows) {
    let l = byPerson.get(r.personIdentifier);
    if (!l) byPerson.set(r.personIdentifier, (l = []));
    l.push(r);
  }
  console.log(`works: ${rows.length} author x article rows, ${byPerson.size} persons (${rows.filter((r) => r.pmid <= 0).length} external)`);

  // ---- A1. STEP 6 rule vs stored v1
  const [people] = await conn.query("SELECT personIdentifier, hindexNIH, h5indexNIH FROM analysis_summary_person");
  const a1 = { hindexNIH: [], h5indexNIH: [] };
  for (const p of people) {
    const got = hIndexes(byPerson.get(p.personIdentifier) ?? [], asOf, { stepSix: true });
    for (const m of Object.keys(a1)) {
      const want = p[m] === null ? 0 : Number(p[m]);
      if (got[m] !== want) a1[m].push(`${p.personIdentifier}: stored ${p[m]}, module ${got[m]}`);
    }
  }
  for (const [m, bad] of Object.entries(a1)) {
    console.log(`A1. ${m.padEnd(11)} module STEP 6 rule vs stored v1: compared ${people.length}, mismatches ${bad.length}`);
    for (const b of bad.slice(0, 10)) console.log(`      ${b}`);
    if (bad.length) fail();
  }

  // ---- A2. v2 rule vs independent SQL
  const pubmedCounted = `r.pmid > 0 AND (r.source_type IS NULL OR r.source_type = '' OR UPPER(r.source_type) = 'PUBMED')
      AND COALESCE(r.pubTypeCounted, 1) <> 0 AND r.citationCountNIH > 0`;
  const [sqlH] = await conn.query(
    `SELECT pid, MAX(IF(c >= rn, rn, 0)) AS h,
            MAX(IF(c5 IS NOT NULL AND c5 >= rn5, rn5, 0)) AS h5
       FROM (SELECT a.personIdentifier AS pid, r.citationCountNIH AS c,
                    ROW_NUMBER() OVER (PARTITION BY a.personIdentifier ORDER BY r.citationCountNIH DESC) AS rn,
                    IF(r.datePublicationAddedToEntrez <> '' AND r.datePublicationAddedToEntrez > DATE_FORMAT(DATE_SUB(?, INTERVAL 5 YEAR), '%Y-%m-%d'), r.citationCountNIH, NULL) AS c5,
                    ROW_NUMBER() OVER (PARTITION BY a.personIdentifier,
                        (r.datePublicationAddedToEntrez <> '' AND r.datePublicationAddedToEntrez > DATE_FORMAT(DATE_SUB(?, INTERVAL 5 YEAR), '%Y-%m-%d'))
                      ORDER BY r.citationCountNIH DESC) AS rn5
               FROM ${AUTHOR} a JOIN ${ARTICLE} r ON r.pmid = a.pmid
              WHERE ${pubmedCounted}) x
      GROUP BY pid`, [asOf, asOf]);
  const sqlByPid = new Map(sqlH.map((r) => [r.pid, { h: Number(r.h), h5: Number(r.h5) }]));
  const stored = new Map(people.map((p) => [p.personIdentifier, p]));
  const a2 = [];
  let differsFromV1 = 0;
  let comparedV1 = 0;
  for (const [pid, works] of byPerson) {
    const got = hIndexes(works, asOf);
    const want = sqlByPid.get(pid) ?? { h: 0, h5: 0 };
    if (got.hindexNIH !== want.h || got.h5indexNIH !== want.h5) a2.push(`${pid}: sql ${want.h}/${want.h5}, module ${got.hindexNIH}/${got.h5indexNIH}`);
    const s = stored.get(pid);
    if (s) {
      comparedV1++;
      if (got.hindexNIH !== Number(s.hindexNIH ?? 0) || got.h5indexNIH !== Number(s.h5indexNIH ?? 0)) differsFromV1++;
    }
  }
  console.log(`A2. h/h5 v2 rule (errata excluded) module vs SQL: compared ${byPerson.size}, mismatches ${a2.length}`);
  for (const b of a2.slice(0, 10)) console.log(`      ${b}`);
  if (a2.length) fail();
  console.log(`    informational: v2 h or h5 differs from stored v1 for ${differsFromV1} of ${comparedV1} v1 persons (errata rule)`);

  // ---- B. top-N vs analysis_summary_person_peer
  if (!v2) {
    const what = [...missingWork.map((c) => `works.${c}`), ...(peerCols.size === 0 ? [`table ${bare(PEER)}`] : missingPeer.map((c) => `peer.${c}`))];
    console.log(`B. SKIPPED: v3.11 not applied (missing ${what.join(", ")})`);
    if (has("--require-v2")) fail();
    else skipped = true;
  } else {
    const [cells] = await conn.query(
      `SELECT personIdentifier, facultyRank, cohortEligible, roleSet, topN, ratedCount, recentCount,
              CAST(avgTop AS CHAR) AS avgTop, cohortRank, cohortM FROM ${PEER}`);
    const bad = { avg: [], rated: [], recent: [], rank: [], m: [] };
    let compared = 0;
    let withAvg = 0;
    for (const c of cells) {
      compared++;
      const works = byPerson.get(c.personIdentifier) ?? [];
      const n = Number(c.topN);
      const t = topNAverage(works, c.roleSet, n);
      const want = thousandths(c.avgTop);
      if (want !== null) withAvg++;
      if (t.avgThousandths !== want) bad.avg.push(`${c.personIdentifier} ${c.roleSet}/${n}: stored ${c.avgTop}, module ${t.avgThousandths === null ? "NULL" : (t.avgThousandths / 1000).toFixed(3)}`);
      const rc = ratedInSet(countedWorks(works), c.roleSet).length;
      if (rc !== Number(c.ratedCount)) bad.rated.push(`${c.personIdentifier} ${c.roleSet}/${n}: stored ${c.ratedCount}, module ${rc}`);
      const rec = recentResearchInSet(works, c.roleSet).length;
      if (rec !== Number(c.recentCount ?? 0)) bad.recent.push(`${c.personIdentifier} ${c.roleSet}/${n}: stored ${c.recentCount}, module ${rec}`);
    }
    // ranks re-derived from the stored averages
    const groups = new Map();
    for (const c of cells) {
      const v = thousandths(c.avgTop);
      if (!flag(c.cohortEligible) || v === null) continue;
      const k = `${c.facultyRank}\u0000${c.roleSet}\u0000${Number(c.topN)}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push({ c, v });
    }
    const ties = [];
    for (const [k, members] of groups) {
      const M = members.length;
      const counts = new Map();
      for (const m of members) counts.set(m.v, (counts.get(m.v) ?? 0) + 1);
      for (const m of members) {
        const R = 1 + members.filter((o) => o.v > m.v).length;
        const wantR = M >= MIN_COHORT ? R : null;
        const gotR = m.c.cohortRank === null ? null : Number(m.c.cohortRank);
        if (gotR !== wantR) bad.rank.push(`${m.c.personIdentifier} ${m.c.roleSet}/${m.c.topN}: stored R ${gotR}, expected ${wantR} (M ${M})`);
        if (Number(m.c.cohortM) !== M) bad.m.push(`${m.c.personIdentifier} ${m.c.roleSet}/${m.c.topN}: stored M ${m.c.cohortM}, expected ${M}`);
      }
      for (const [v, n] of counts) if (n >= 3) ties.push(`${k.replace(/\u0000/g, " / ")} at ${(v / 1000).toFixed(3)}: ${members.filter((m) => m.v === v).map((m) => `${m.c.personIdentifier}#${m.c.cohortRank}`).join(", ")}`);
    }
    console.log(`B. ${compared} cells (${withAvg} with an average) over ${new Set(cells.map((c) => c.personIdentifier)).size} persons, ${groups.size} cohort groups`);
    console.log(`   avgTop      mismatches ${bad.avg.length}`);
    console.log(`   ratedCount  mismatches ${bad.rated.length}`);
    console.log(`   recentCount mismatches ${bad.recent.length}`);
    console.log(`   cohortRank  mismatches ${bad.rank.length}`);
    console.log(`   cohortM     mismatches ${bad.m.length}`);
    for (const [k, l] of Object.entries(bad)) for (const b of l.slice(0, 10)) console.log(`      ${k}: ${b}`);
    if (Object.values(bad).some((l) => l.length)) fail();
    console.log(`   tie groups of 3 or more: ${ties.length}`);
    for (const t of ties.filter((x) => /alg2053|lct4001|rom2043/.test(x)).concat(ties.slice(0, 3))) console.log(`      ${t}`);
  }
  await conn.query("COMMIT");
} finally {
  await conn.end();
}
console.log(failed ? "FAIL" : skipped ? "PASS: 0 mismatches (A only; B skipped, v3.11 not applied)" : "PASS: 0 mismatches");
process.exit(failed ? 1 : 0);
