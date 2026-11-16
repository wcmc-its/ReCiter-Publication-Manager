#!/usr/bin/env node
/**
 * Backfill: store what the duplicate check matched for Authorships rows parked by a 409 on Accept.
 *
 * authorship_review.accept_conflict holds only the check's message ("Possible duplicate. ..."),
 * so the /authorships "Duplicate records" queue could not show what a parked paper supposedly
 * duplicates. ReCiterDB v3.12 adds accept_conflict_matches, and PM now writes it with every new
 * park. This script fills it for rows parked before that.
 *
 * Per row with accept_conflict set and accept_conflict_matches NULL, it re-runs the duplicate
 * check READ-ONLY for the identity the Accept was for (top_cwid): PM's checkExternalDup
 * (src/lib/externalDupCheck.ts) over that person's external_record rows, person_article
 * candidates and external_rejection memory, the same inputs loadDupContext gathers. It stores the
 * matches in the shape src/lib/acceptConflictMatches.ts writes (via: "backfill").
 *
 * What it does NOT do: perform the accept, change status/accept_conflict, write external_record,
 * or touch DynamoDB. GoldStandard is not read: these rows are Scopus/OpenAlex works with no PMID,
 * and the check's GoldStandard tests fire only on a PMID, so they could not match anyway.
 *
 * The check differs a little from the one that parked the rows (ReCiter's Java
 * ExternalArticleDupCheck, live Analysis candidates, exact normalized title + year): this one is
 * PM's (person_article as of the last nightly, >= 85% title-word overlap with both years). A row
 * where it finds nothing is counted and left NULL; the queue then shows a plain sentence, and a
 * later run tries it again.
 *
 * Run (DRY RUN, the default: reads only):
 *   node scripts/backfill-accept-conflict-matches.mjs [--dry-run]
 * Apply:
 *   node scripts/backfill-accept-conflict-matches.mjs --apply
 *
 * Flags:
 *   --apply           write (default: dry run; --dry-run is accepted and wins over --apply)
 *   --batch <n>       rows per SELECT page (default 500)
 *   --limit <n>       stop after n parked rows (default: all)
 *   --show <n>        print the first n planned rows in the report (default 10)
 *
 * DB: RECITER_DB_HOST / _USERNAME / _PASSWORD / _NAME / _PORT, or the DB_* names the ReCiterDB
 * tooling uses. Needs node >= 22.18 (it imports the .ts libs, and node strips the types).
 *
 * Safe to re-run: it selects only parked rows without matches, and every UPDATE repeats that
 * condition, so a row filled in the meantime (by a new park or an earlier run) is left alone.
 * Each UPDATE is its own statement (autocommit), so an interrupted run resumes.
 */

import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

// The .ts libs import siblings without an extension, as Next resolves them.
registerHooks({
  resolve(spec, ctx, next) {
    try { return next(spec, ctx); } catch (e) {
      if (spec.startsWith(".") && !/\.[cm]?[jt]s$/.test(spec)) return next(spec + ".ts", ctx);
      throw e;
    }
  },
});
const { checkExternalDup } = await import("../src/lib/externalDupCheck.ts");
const { recordFromInput } = await import("../src/lib/externalRecordShape.ts");
const { openalexWorkId } = await import("../src/lib/externalSource.ts");
const { storedConflictJson } = await import("../src/lib/acceptConflictMatches.ts");

const WHERE_UNFILLED = "accept_conflict IS NOT NULL AND accept_conflict_matches IS NULL";

// The add body the Accept sent (authorships.controller externalArticlePayload), as far as the
// duplicate check reads it: article id, DOI, title and date.
export function payloadOf(row) {
  const openalex = row.source === "openalex";
  return {
    articleId: openalex ? `OPENALEX:${openalexWorkId(row.external_id)}` : `SCOPUS:${row.external_id}`,
    sourceType: openalex ? "OPENALEX" : "SCOPUS",
    doi: row.doi || undefined,
    title: row.title || undefined,
    journalOrVenue: row.journal || undefined,
    pubDate: row.entrez_date ? String(row.entrez_date instanceof Date ? row.entrez_date.toISOString().slice(0, 10) : row.entrez_date) : undefined,
    publicationType: row.pub_type || undefined,
  };
}

// loadDupContext's inputs for one person, read with plain SELECTs (no GoldStandard, see above).
export async function loadContext(conn, uid) {
  const [existing] = await conn.query(
    "SELECT id, article_id, source_type, status, pmid, doi, title, pub_date, container_title, scopus_eid, openalex_id, "
    + "orcid_put_code, title_year_key, merged_into_id, merged_into_pmid FROM external_record WHERE uid = ?",
    [uid],
  );
  const [candidates] = await conn.query(
    "SELECT pmid, doi, articleTitle, journalTitleVerbose, publicationDateStandardized, articleYear FROM person_article WHERE personIdentifier = ?",
    [uid],
  );
  const [rejections] = await conn.query(
    "SELECT key_type, key_value, record_id, reason, rejected_by, rejected_at FROM external_rejection WHERE uid = ?",
    [uid],
  );
  return {
    existing: existing.map((e) => ({ ...e, id: Number(e.id), pmid: e.pmid == null ? null : Number(e.pmid) })),
    candidates: candidates.map((c) => ({ ...c, pmid: Number(c.pmid) })),
    rejections,
    knownPmids: [],
    rejectedPmids: [],
  };
}

// What one row should get. Pure given its context.
export function planRow(row, ctx, now = new Date()) {
  if (!row.top_cwid) return { outcome: "no_identity", json: null, matches: [] };
  if (row.source !== "scopus" && row.source !== "openalex") return { outcome: "not_external", json: null, matches: [] };
  let record;
  try { record = recordFromInput(payloadOf(row)); } catch (e) { return { outcome: "bad_record", json: null, matches: [], error: e?.message }; }
  const result = checkExternalDup(record, ctx);
  const json = storedConflictJson(row.top_cwid, row.top_name, "backfill", result.matches, now);
  return { outcome: json ? "matched" : "no_match", level: result.level, json, matches: result.matches };
}

export async function runBackfill(conn, { apply = false, batch = 500, limit = Infinity, log = () => {}, now = () => new Date() } = {}) {
  if (!(Number.isInteger(batch) && batch > 0)) throw new Error(`Bad batch size ${batch}`);
  const [[{ parked, filled }]] = await conn.query(
    "SELECT COUNT(*) AS parked, COALESCE(SUM(accept_conflict_matches IS NOT NULL), 0) AS filled FROM authorship_review WHERE accept_conflict IS NOT NULL",
  );
  const counts = { checked: 0, matched: 0, no_match: 0, no_identity: 0, not_external: 0, bad_record: 0, updated: 0, raced: 0 };
  const byType = new Map();
  const planned = [];
  const contexts = new Map();
  let lastId = 0;
  outer: for (;;) {
    const [page] = await conn.query(
      "SELECT id, source, external_id, doi, title, journal, entrez_date, pub_type, top_cwid, top_name, status FROM authorship_review "
      + `WHERE ${WHERE_UNFILLED} AND id > ? ORDER BY id LIMIT ?`,
      [lastId, batch],
    );
    if (!page.length) break;
    lastId = Number(page[page.length - 1].id);
    for (const row of page) {
      if (counts.checked >= limit) break outer;
      counts.checked++;
      let ctx = null;
      if (row.top_cwid) {
        if (!contexts.has(row.top_cwid)) contexts.set(row.top_cwid, await loadContext(conn, row.top_cwid));
        ctx = contexts.get(row.top_cwid);
      }
      const p = planRow(row, ctx || {}, now());
      counts[p.outcome]++;
      for (const m of p.matches) byType.set(m.type, (byType.get(m.type) || 0) + 1);
      planned.push({ id: row.id, source: row.source, uid: row.top_cwid, status: row.status, title: row.title, outcome: p.outcome, matches: p.matches });
      if (apply && p.json) {
        const [res] = await conn.query(
          `UPDATE authorship_review SET accept_conflict_matches = ? WHERE id = ? AND ${WHERE_UNFILLED}`,
          [p.json, row.id],
        );
        const n = Number(res.affectedRows ?? 0);
        counts.updated += n;
        if (!n) counts.raced++;
      }
    }
    if (apply) log(`  through id ${lastId}: ${counts.updated} updated so far`);
    if (page.length < batch) break;
  }
  return { parked: Number(parked), alreadyFilled: Number(filled), counts, byType: [...byType].sort((a, b) => b[1] - a[1]), planned, people: contexts.size };
}

const clip = (s, n) => { const t = String(s ?? "").replace(/<[^>]+>/g, ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

export function formatReport(r, { apply = false, show = 10 } = {}) {
  const c = r.counts;
  const out = [];
  out.push(`${apply ? "APPLY" : "DRY RUN"}: authorship_review, ${r.parked} parked rows (accept_conflict set); ${r.alreadyFilled} already have matches, skipped`);
  out.push(`Checked ${c.checked} rows for ${r.people} people:`);
  out.push(`  matches found            ${c.matched}`);
  out.push(`  no match found now       ${c.no_match}   (left NULL; the queue shows a plain sentence)`);
  out.push(`  no proposed identity     ${c.no_identity}`);
  out.push(`  not an external row      ${c.not_external}`);
  out.push(`  could not build record   ${c.bad_record}`);
  if (r.byType.length) {
    out.push("Matches by type:");
    for (const [t, n] of r.byType) out.push(`  ${String(t).padEnd(28)} ${n}`);
  }
  const sample = r.planned.slice(0, show);
  if (sample.length) {
    out.push(`First ${sample.length} rows:`);
    for (const p of sample) {
      const m = p.matches[0];
      const what = m ? `${m.type} ${m.matchedId}: ${clip(m.title, 70)} (${[m.journal && clip(m.journal, 30), m.pubYear].filter(Boolean).join(", ")})${p.matches.length > 1 ? ` +${p.matches.length - 1}` : ""}` : p.outcome;
      out.push(`  id ${p.id} ${p.uid || "-"} "${clip(p.title, 50)}" -> ${what}`);
    }
  }
  out.push(apply ? `Updated ${c.updated} rows (planned ${c.matched}; ${c.raced} filled by someone else first).` : `Would update ${c.matched} rows. Nothing written.`);
  return out.join("\n");
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (name, dflt) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
  };
  const apply = argv.includes("--apply") && !argv.includes("--dry-run");
  const batch = Number(opt("--batch", "500"));
  const limit = argv.includes("--limit") ? Number(opt("--limit", "0")) : Infinity;
  const show = Number(opt("--show", "10"));
  const db = {
    host: process.env.RECITER_DB_HOST || process.env.DB_HOST,
    user: process.env.RECITER_DB_USERNAME || process.env.DB_USERNAME,
    password: process.env.RECITER_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.RECITER_DB_NAME || process.env.DB_NAME,
    port: Number(process.env.RECITER_DB_PORT || process.env.DB_PORT || 3306),
  };
  if (!db.host || !db.user || !db.database) {
    console.error("Set RECITER_DB_HOST, RECITER_DB_USERNAME, RECITER_DB_PASSWORD and RECITER_DB_NAME (or the DB_* names).");
    process.exit(2);
  }
  const { createConnection } = await import("mysql2/promise");
  const conn = await createConnection(db);
  try {
    const [[{ host }]] = await conn.query("SELECT @@hostname AS host");
    console.log(`database ${db.database} on ${host}`);
    const result = await runBackfill(conn, { apply, batch, limit, log: (s) => console.log(s) });
    console.log(formatReport(result, { apply, show }));
  } finally {
    await conn.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e?.message || e);
    process.exit(1);
  });
}
