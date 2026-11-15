#!/usr/bin/env node
/**
 * Backfill: give every external_record row that has no type yet the type PM would give it.
 *
 * Plan 3b-3e, item P3 (plans/phase3b-3e-external-lifecycle.md). The ReCiterDB sync (R2) copies
 * the source's own type into `source_pub_type` and leaves `pub_type`, `type_notice`,
 * `peer_reviewed` and `role` alone. This script fills them from src/lib/pubTypes.ts, the same
 * mapSourceType() that recordFromInput() uses when PM creates a record, so there is one mapping.
 *
 * What it writes, per row where pub_type IS NULL AND type_notice IS NULL:
 *   - pub_type     the mapped type (Academic Article, Book Chapter, ...)
 *   - type_notice  'erratum' or 'retraction' for the not-counted mappings (pub_type stays NULL)
 *   - peer_reviewed and role are left NULL, which in this table means "use the type default"
 *     (peerReviewedOf / defaultRole). That is what a PM create writes too, and it keeps the
 *     default following the type if a curator changes the type later. A hand-set value is
 *     never touched. The dry run shows the effective peer-review and role per type.
 * Rows that map to nothing (unmapped, presentation, out-of-scope) keep pub_type NULL, so a
 * curator picks the type; they are counted, and a later run picks them up again if a map is added.
 *
 * It does not set pm_touched (this is not a curator edit, and the sync must keep updating the
 * row) and writes no external_record_event rows. The sync never writes these four columns.
 *
 * Run (DRY RUN, the default: reads only):
 *   node scripts/backfill-external-type.mjs [--dry-run]
 * Apply:
 *   node scripts/backfill-external-type.mjs --apply
 *
 * Flags:
 *   --apply           write (default: dry run; --dry-run is accepted and wins over --apply)
 *   --batch <n>       rows per SELECT page and per UPDATE (default 1000)
 *   --table <name>    table to read and write (default external_record), for a throwaway copy
 *
 * DB: RECITER_DB_HOST / _USERNAME / _PASSWORD / _NAME / _PORT, or the DB_* names the ReCiterDB
 * tooling uses. Needs node >= 22.18 (it imports pubTypes.ts, and node strips the types).
 *
 * Safe to re-run: it selects only untyped rows, and every UPDATE repeats that condition, so a
 * row typed in the meantime (by PM or an earlier run) is left as it is. Batches are keyset
 * pages on id, each UPDATE is its own statement (autocommit), so an interrupted run resumes.
 */

import { pathToFileURL } from "node:url";
import { defaultRole, mapSourceType, peerReviewedOf } from "../src/lib/pubTypes.ts";

// external_record.source_type -> the source name mapSourceType knows. WOS and MANUAL have no
// map: a manual record gets its type from the curator, and there is no WOS map yet.
// Same table as SOURCE_LABEL in src/lib/externalRecordShape.ts (tests check they agree).
export const SOURCE_LABEL = { SCOPUS: "Scopus", OPENALEX: "OpenAlex", CROSSREF: "Crossref", ORCID: "ORCID" };

// The columns one row should get. Pure.
export function planRow(row) {
  const label = SOURCE_LABEL[row.source_type];
  const m = label && row.source_pub_type ? mapSourceType(label, row.source_pub_type) : { type: null, disposition: "unmapped" };
  return { pub_type: m.type ?? null, type_notice: m.notice ?? null, disposition: m.disposition };
}

const TABLE_RE = /^[A-Za-z0-9_]{1,64}$/;
const WHERE_UNTYPED = "pub_type IS NULL AND type_notice IS NULL";

// Run over a mysql2/promise connection (anything with query(sql, params) -> [rows]).
// Returns { rows: [{source_type, source_pub_type, pub_type, type_notice, disposition, n}], updated, skippedTyped }.
export async function runBackfill(conn, { apply = false, batch = 1000, table = "external_record", log = () => {} } = {}) {
  if (!TABLE_RE.test(table)) throw new Error(`Bad table name ${table}`);
  if (!(Number.isInteger(batch) && batch > 0)) throw new Error(`Bad batch size ${batch}`);
  const [[{ n: typed }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE NOT (${WHERE_UNTYPED})`);
  const counts = new Map();
  let updated = 0;
  let lastId = 0;
  for (;;) {
    const [page] = await conn.query(
      `SELECT id, source_type, source_pub_type FROM \`${table}\` WHERE ${WHERE_UNTYPED} AND id > ? ORDER BY id LIMIT ?`,
      [lastId, batch],
    );
    if (!page.length) break;
    lastId = Number(page[page.length - 1].id);
    const writes = new Map(); // "pub_type|type_notice" -> ids
    for (const r of page) {
      const p = planRow(r);
      const key = [r.source_type, r.source_pub_type ?? "", p.pub_type ?? "", p.type_notice ?? "", p.disposition].join("\u0000");
      const c = counts.get(key) || { source_type: r.source_type, source_pub_type: r.source_pub_type ?? null, ...p, n: 0 };
      c.n++;
      counts.set(key, c);
      if (p.pub_type || p.type_notice) {
        const wk = `${p.pub_type ?? ""}|${p.type_notice ?? ""}`;
        if (!writes.has(wk)) writes.set(wk, { pub_type: p.pub_type, type_notice: p.type_notice, ids: [] });
        writes.get(wk).ids.push(r.id);
      }
    }
    if (apply) {
      for (const w of writes.values()) {
        const [res] = await conn.query(
          `UPDATE \`${table}\` SET pub_type = ?, type_notice = ? WHERE id IN (?) AND ${WHERE_UNTYPED}`,
          [w.pub_type, w.type_notice, w.ids],
        );
        updated += Number(res.affectedRows ?? 0);
      }
      log(`  through id ${lastId}: ${updated} updated so far`);
    }
    if (page.length < batch) break;
  }
  const rows = [...counts.values()].sort(
    (a, b) => a.source_type.localeCompare(b.source_type) || b.n - a.n || String(a.source_pub_type).localeCompare(String(b.source_pub_type)),
  );
  return { rows, updated, skippedTyped: Number(typed) };
}

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

export function formatReport({ rows, updated, skippedTyped }, { apply = false, table = "external_record" } = {}) {
  const out = [];
  const total = rows.reduce((s, r) => s + r.n, 0);
  out.push(`${apply ? "APPLY" : "DRY RUN"}: ${table}, ${total} untyped rows (pub_type and type_notice both NULL); ${skippedTyped} already typed, skipped`);
  out.push("");
  out.push("By source and source type:");
  out.push(`  ${pad("source", 9)} ${pad("source_pub_type", 22)} ${pad("-> pub_type", 22)} ${pad("type_notice", 12)} ${pad("disposition", 13)} ${lpad("rows", 7)}`);
  for (const r of rows) {
    out.push(`  ${pad(r.source_type, 9)} ${pad(r.source_pub_type ?? "(none)", 22)} ${pad(r.pub_type ?? "NULL", 22)} ${pad(r.type_notice ?? "", 12)} ${pad(r.disposition, 13)} ${lpad(r.n, 7)}`);
  }
  const bySource = new Map();
  for (const r of rows) {
    const s = bySource.get(r.source_type) || { typed: 0, notice: 0, untyped: 0 };
    if (r.pub_type) s.typed += r.n;
    else if (r.type_notice) s.notice += r.n;
    else s.untyped += r.n;
    bySource.set(r.source_type, s);
  }
  out.push("");
  out.push("By source:");
  out.push(`  ${pad("source", 9)} ${lpad("gets type", 10)} ${lpad("notice only", 12)} ${lpad("stays NULL", 11)}`);
  for (const [k, s] of bySource) out.push(`  ${pad(k, 9)} ${lpad(s.typed, 10)} ${lpad(s.notice, 12)} ${lpad(s.untyped, 11)}`);
  const byType = new Map();
  for (const r of rows) {
    const k = r.pub_type ? r.pub_type : r.type_notice ? `(not counted: ${r.type_notice})` : `(no type: ${r.disposition})`;
    byType.set(k, (byType.get(k) || 0) + r.n);
  }
  out.push("");
  out.push("By resulting type (peer_reviewed and role stay NULL = the type default shown):");
  out.push(`  ${pad("pub_type", 34)} ${pad("peer reviewed", 14)} ${pad("role", 8)} ${lpad("rows", 7)}`);
  for (const [k, n] of [...byType].sort((a, b) => b[1] - a[1])) {
    const real = !k.startsWith("(");
    out.push(`  ${pad(k, 34)} ${pad(real ? (peerReviewedOf({ type: k }) ? "yes" : "no") : "", 14)} ${pad(real ? defaultRole(k) : "", 8)} ${lpad(n, 7)}`);
  }
  const willWrite = rows.filter((r) => r.pub_type || r.type_notice).reduce((s, r) => s + r.n, 0);
  out.push("");
  out.push(apply ? `Updated ${updated} rows (planned ${willWrite}).` : `Would update ${willWrite} rows; ${total - willWrite} stay untyped. Nothing written.`);
  return out.join("\n");
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (name, dflt) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
  };
  const apply = argv.includes("--apply") && !argv.includes("--dry-run");
  const batch = Number(opt("--batch", "1000"));
  const table = opt("--table", "external_record");
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
    const result = await runBackfill(conn, { apply, batch, table, log: (s) => console.log(s) });
    console.log(formatReport(result, { apply, table }));
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
