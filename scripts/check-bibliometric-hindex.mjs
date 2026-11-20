#!/usr/bin/env node
/**
 * h-index parity for the 5h bibliometric analysis (controllers/db/reports/bibliometrics.ts).
 * Run: node scripts/check-bibliometric-hindex.mjs [--as-of YYYY-MM-DD]
 *
 * Read-only, DEV only. It refuses any host whose name lacks "-dev-" (the RECITER_DB_* values in
 * .env.local) and any server whose @@hostname is not on the dev subnet.
 *
 * A. For every analysis_summary_person row, recompute hindexNIH, h5indexNIH, hindexScopus and
 *    h5indexScopus from the person's analysis_summary_author x analysis_summary_article rows with
 *    the module's hIndexes() and compare with the stored values (NULL stored = 0). The h5 window
 *    needs the CURDATE() of the nightly that wrote the tables: by default the date of the
 *    "6. Compute h-index" DONE row of the job whose "7. Atomic table swap" DONE row is newest.
 *    External rows (pmid <= 0) are in the live tables but were added after STEP 6, so the module
 *    must drop them; this check fails if it does not.
 * B. round1() against MySQL's concat(round(col, 1)) for the 8 top*Percentile* FLOAT columns, the
 *    exact text the RTF printed.
 *
 * Exit code 1 on any mismatch.
 */

import { createConnection } from "mysql2/promise";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hIndexes, round1 } from "../controllers/db/reports/bibliometrics.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const host = process.env.RECITER_DB_HOST || "";
if (!host.includes("-dev-")) {
  console.error("Refusing: RECITER_DB_HOST is not a dev host.");
  process.exit(2);
}
const argAsOf = (() => {
  const i = process.argv.indexOf("--as-of");
  return i > 0 ? process.argv[i + 1] : null;
})();

const conn = await createConnection({
  host, user: process.env.RECITER_DB_USERNAME, password: process.env.RECITER_DB_PASSWORD,
  database: process.env.RECITER_DB_NAME, port: Number(process.env.RECITER_DB_PORT || 3306),
  dateStrings: true,
});
let failed = false;
try {
  const [[{ h: serverHost }]] = await conn.query("SELECT @@hostname AS h");
  if (!String(serverHost).startsWith("ip-172-17-4-")) {
    console.error(`Refusing: @@hostname ${serverHost} is not the dev server.`);
    process.exit(2);
  }
  console.log(`server ${serverHost}`);
  await conn.query("SET SESSION TRANSACTION READ ONLY");

  // ---- the run that wrote the live tables
  let asOf = argAsOf;
  if (!asOf) {
    const [[swap]] = await conn.query(
      "SELECT job_id, created_at FROM analysis_job_log WHERE step LIKE '7.%' AND status = 'DONE' ORDER BY id DESC LIMIT 1");
    const [[h6]] = await conn.query(
      "SELECT created_at FROM analysis_job_log WHERE job_id = ? AND step LIKE '6.%' AND status = 'DONE' ORDER BY id DESC LIMIT 1",
      [swap.job_id]);
    asOf = String(h6.created_at).slice(0, 10);
    console.log(`nightly job ${swap.job_id}: STEP 6 done ${h6.created_at}, swap ${swap.created_at} -> asOf ${asOf}`);
  } else {
    console.log(`asOf ${asOf} (from --as-of)`);
  }

  // ---- A. h-index parity
  const [people] = await conn.query(
    "SELECT personIdentifier, hindexNIH, h5indexNIH, hindexScopus, h5indexScopus FROM analysis_summary_person");
  const [rows] = await conn.query(
    `SELECT a.personIdentifier, r.pmid, r.source_type AS sourceType, r.citationCountNIH, r.citationCountScopus,
            r.datePublicationAddedToEntrez
       FROM analysis_summary_author a
       JOIN analysis_summary_article r ON r.pmid = a.pmid
       JOIN analysis_summary_person p ON p.personIdentifier = a.personIdentifier`);
  const byPerson = new Map();
  for (const r of rows) {
    let l = byPerson.get(r.personIdentifier);
    if (!l) byPerson.set(r.personIdentifier, (l = []));
    l.push(r);
  }
  const external = rows.filter((r) => r.pmid <= 0).length;
  console.log(`A. ${people.length} persons, ${rows.length} author x article rows (${external} external, must be ignored)`);

  const metrics = ["hindexNIH", "h5indexNIH", "hindexScopus", "h5indexScopus"];
  const mismatches = Object.fromEntries(metrics.map((m) => [m, []]));
  const nonzero = Object.fromEntries(metrics.map((m) => [m, 0]));
  for (const p of people) {
    const got = hIndexes(byPerson.get(p.personIdentifier) ?? [], asOf);
    for (const m of metrics) {
      const want = p[m] === null ? 0 : Number(p[m]);
      if (want > 0) nonzero[m]++;
      if (got[m] !== want) mismatches[m].push({ uid: p.personIdentifier, stored: p[m], computed: got[m] });
    }
  }
  for (const m of metrics) {
    console.log(`   ${m.padEnd(14)} compared ${people.length}, stored > 0 for ${nonzero[m]}, mismatches ${mismatches[m].length}`);
    for (const x of mismatches[m].slice(0, 10)) console.log(`      ${x.uid}: stored ${x.stored}, computed ${x.computed}`);
    if (mismatches[m].length) failed = true;
  }

  // ---- B. round1 vs MySQL concat(round(col,1))
  const cols = ["All", "First", "Senior", "FirstSenior"].flatMap((k) => [`top5Percentile${k}`, `top10Percentile${k}`]);
  const [pct] = await conn.query(
    `SELECT personIdentifier, ${cols.map((c) => `${c}, concat(round(${c},1)) AS \`${c}_sql\``).join(", ")} FROM analysis_summary_person`);
  let compared = 0;
  const bad = [];
  for (const r of pct) {
    for (const c of cols) {
      if (r[c] === null) continue;
      compared++;
      if (round1(r[c]) !== r[`${c}_sql`]) bad.push(`${r.personIdentifier} ${c}: ${r[c]} -> js ${round1(r[c])}, sql ${r[`${c}_sql`]}`);
    }
  }
  console.log(`B. round1 vs concat(round(x,1)): compared ${compared} values, mismatches ${bad.length}`);
  for (const b of bad.slice(0, 10)) console.log(`      ${b}`);
  if (bad.length) failed = true;
} finally {
  await conn.end();
}
console.log(failed ? "FAIL" : "PASS: 0 mismatches");
process.exit(failed ? 1 : 0);
