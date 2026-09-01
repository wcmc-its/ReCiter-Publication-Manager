#!/usr/bin/env node
/**
 * Reconciler: promote a local-only assign to an authoritative gold-standard write, once ReCiter
 * gains an Identity for the assignee it didn't have when the row was resolved.
 *
 * PM#949: `case "assign"`'s local_only branch (controllers/db/authorships.controller.ts) resolves
 * a row for a curator-chosen cwid ReCiter has no Identity record for by writing NOTHING
 * downstream — no writeGoldStandard, no addExternalArticle, no AdminFeedbackLog — and stamping
 * the row's note with the marker src/lib/localOnlyMarker.ts defines:
 *   LOCAL_ONLY_MARKER  = "local record only, nothing written to the publication record"
 *   RECONCILED_MARKER  = "reconciled to publication record"
 * `case "reopen"` now reads that marker (rather than inferring local-only from a live identity
 * check) to decide whether there is a gold-standard DELETE to undo. Both the marker text and the
 * predicate live in that one shared module so the writer, the reader, and this script cannot
 * drift from each other — see localOnlyMarker.ts's own header for the fuller rationale.
 *
 * This script is the OTHER HALF: identities get backfilled after the fact (IC#148, ~1,595
 * cwids), and a local-only row sitting on one of those cwids never gets promoted on its own —
 * nothing re-visits a resolved row. This sweeps `authorship_review` for rows still carrying the
 * un-reconciled local-only marker, re-checks each one's assignee against DynamoDB LIVE, and for
 * the ones who now have an Identity and don't already have a conflicting gold-standard entry,
 * writes the knownpmids merge the assign should have made and stamps the row RECONCILED so it is
 * never picked up again (and so `case "reopen"` starts treating it like an ordinary assign).
 *
 * Run (DRY RUN, the default — reads only, writes nothing anywhere):
 *   RECITER_DB_HOST=... RECITER_DB_USERNAME=... RECITER_DB_PASSWORD=... RECITER_DB_NAME=... \
 *     node scripts/reconcile-local-only-assigns.mjs
 *   # or, from a shell already exporting DB_HOST/DB_USERNAME/DB_PASSWORD/DB_NAME (see below):
 *   node scripts/reconcile-local-only-assigns.mjs
 * Execute (writes gold-standard known-pmids AND stamps the row — NEVER run this from an agent
 * session):
 *   node scripts/reconcile-local-only-assigns.mjs --execute \
 *     --ledger "/Users/paulalbert/Dropbox/Projects/ReCiter Research/analysis/local_only_reconcile/reconcile.jsonl"
 *
 * Flags (same names/shapes as scripts/sweep-displaced-candidate-rejections.mjs):
 *   --execute             actually POST the gold-standard write + UPDATE the row (default: dry run)
 *   --ledger <path>       JSONL ledger (default: the analysis/ path below)
 *   --limit <n>           caps the SCOPE query (SQL LIMIT) — writes land on at most n of those
 *                          LIMIT-ed rows once the JS-side filters below remove some of them, not
 *                          exactly n; see --help below, which says the same thing
 *   --json <path>         also write the derived plan as JSON, for auditing it as data
 *   --help                print usage and exit
 *
 * Needs Node >= 22.18 for unflagged `.ts` imports (this file imports localOnlyMarker.ts
 * directly); on an older Node, run with `node --experimental-strip-types` instead.
 *
 * SCOPE (the WHERE clause): status = 'assigned', resolution_cwid IS NOT NULL, note LIKE
 * LOCAL_ONLY_LIKE, AND (source = 'scopus' OR pmid IS NOT NULL). The LIKE pattern is built from
 * the imported LOCAL_ONLY_MARKER constant (not typed out a second time in SQL) so the scope can
 * never drift from the marker module that also defines what the writer stamps and the reader
 * reads. The `pmid IS NOT NULL` half of the last guard is a cheap SQL-side version of the
 * no_pmid check below — dropped from the result set before it ever reaches DynamoDB — but is not
 * itself the no_pmid check: it does not catch a non-numeric or non-positive value that made it
 * into the column, hence the JS-side check too.
 *
 * That SQL scope is a SUPERSET of "still local-only right now" — it matches every row that EVER
 * carried the marker, including one later reconciled (and, per PM#949's fix to `case "reopen"`
 * and this same bug in this script, one reconciled and then made local-only AGAIN to a different
 * cwid, since the note is append-only and either marker can appear more than once). The actual
 * answer is positional, not "LIKE but NOT LIKE": every fetched row is re-filtered in JS with
 * isLocalOnlyNote(row.note) — the identical function `case "reopen"` calls — and a row that fails
 * it is counted in skips.reconciled and never planned. Filtering in JS rather than folding a
 * second LIKE into the SQL keeps the one positional read textually identical everywhere it
 * matters (writer's marker, reader's predicate, this script's scope), instead of the SQL layer
 * re-deriving its own approximation of the same logic.
 *
 * PER-ROW CLASSIFICATION — one batched Identity read + one batched GoldStandard read (uid,
 * knownpmids, rejectedpmids — NOTE: lowercase attribute names, see src/lib/goldStandardRejections.ts)
 * across every distinct resolution_cwid in scope, then six buckets:
 *   scopus_unsupported — source === 'scopus' (no pmid, gold standard is PMID-keyed). Checked
 *     FIRST and independent of identity: there is no pmid to promote into knownpmids here even
 *     when an identity now exists. Reported (id + external_id), never written.
 *     ponytail: upgrade path — addExternalArticle() with scopusExternalPayload(row), the same
 *     write shape `case "assign"`'s authoritative (non-local-only) scopus branch already uses
 *     (controllers/db/authorships.controller.ts, ~1087) — is not implemented here because it
 *     needs the full row (title/journal/authors/etc.) this scope query does not select, and a
 *     scopus local-only assign has always been rarer than pubmed's.
 *   no_pmid — a non-scopus row whose Number(pmid) is not a positive finite integer (a malformed
 *     or missing pmid that slipped past the SQL `pmid IS NOT NULL` guard, e.g. a non-numeric
 *     string). Counted only, never planned — there is nothing to promote into knownpmids either.
 *   awaiting_identity — resolution_cwid still has no Identity row. Skipped, counted only: the
 *     row is correctly still local-only and reopen still correctly treats it that way.
 *   contradiction — the assignee's OWN GoldStandard.rejectedpmids already contains this pmid,
 *     i.e. they rejected the exact article this row assigned them via their own /curate page.
 *     Skipped and REPORTED LOUDLY (never silent — this is a real conflict a human should look
 *     at), note left untouched: the row stays local-only on purpose, so reopen keeps skipping
 *     the DELETE it would otherwise need to undo (there is nothing to undo — this script wrote
 *     nothing).
 *   already_accepted — the assignee's GoldStandard.knownpmids already contains this pmid (most
 *     often: they accepted it themselves on /curate after the local-only assign). Skipped and
 *     reported, note left untouched — their own acceptance must survive an eventual reopen of
 *     this row exactly as it is; this script writing a merge on top would be a harmless no-op at
 *     the DynamoDB layer but would incorrectly mark the row RECONCILED for a promotion this
 *     script never actually made.
 *   promote — identity present, neither list contains the pmid: the planned write.
 *
 * THE WRITE: writeKnown(uid, pmid, curatedBy) is the 'known' twin of the sweep's
 * writeRejection() — POST {base}/reciter/goldstandard?goldStandardUpdateFlag=UPDATE&source=
 * adversarial-attribution-review&entryPath=PM_AUTHOR(&curatedBy=<userID>), body
 * {uid, knownPmids:[pmid]}. curatedBy is appended only when the row's `reviewer` maps to an
 * admin_users.userID (mirror of writeGoldStandard()'s curatedByQ conditional in the controller,
 * ~698-719) — the same "attribute to the human who actually made the call" reasoning as the
 * sweep. On HTTP 200, the row is stamped with a COMPARE-AND-SET on the note as it was read at
 * plan time (carried on the plan entry as `note`), not a NOT LIKE guard:
 *   UPDATE authorship_review SET note = CONCAT(?, ' | ', ?) WHERE id = ? AND note = ?
 * params [originalNote, stampText, row_id, originalNote] (originalNote passed twice: once into
 * the new value, once into the WHERE). A plain NOT LIKE RECONCILED_LIKE guard has the same flaw
 * this ticket fixes in `case "reopen"` — it would happily stamp over a note that changed for a
 * reason other than "already reconciled" (reopened, re-assigned to someone else, stamped by a
 * concurrent run) as long as it didn't yet contain RECONCILED_MARKER. The CAS is exact: the
 * UPDATE only lands if the note is BYTE-IDENTICAL to what this script read when it built the
 * plan, so ANY change underneath it — reconciled, reopened, re-assigned, or anything else —
 * makes affectedRows come back 0 instead of silently overwriting a note this script no longer
 * has an accurate picture of. A 0-row stamp is ledgered (phase 'stamp', affectedRows 0, row id
 * only — never the note text itself, which can be long) AND printed as a WARN line naming the
 * row, because at that point the gold-standard write already landed but the note could not be
 * safely stamped and a human should look at that row.
 *
 * WHAT IT DELIBERATELY DOES NOT DO — same as the sweep: no AdminFeedbackLog row (that is a
 * live-curator artifact, a timestamp of the moment a human decided; a script back-dating one
 * would fabricate it), and no pending-article-count touch. ReCiter's own /reciter/goldstandard
 * endpoint logs the curatedBy attribution itself — nothing here needs to duplicate that.
 *
 * Safety (identical structure to the sweep):
 *   - dry run by default; --execute is the only way to write, gated a second and third time:
 *     RECITER_API_BASE_URL and RECITER_API_KEY must both be set, or the script refuses before
 *     touching the network (exit 1)
 *   - every write is appended to the JSONL ledger BEFORE it is attempted (phase 'write'), so the
 *     ledger is a complete record even if the process dies mid-write; the network result is
 *     ledgered after (phase 'result'), and the row-stamp result after that (phase 'stamp')
 *   - resumable: a (row_id, pmid, cwid) already in the ledger with a phase:'result' status:200
 *     record is skipped on re-run
 *   - the identity/knownpmids/rejectedpmids guards are re-checked LIVE immediately before each
 *     write via recheck(), not just in the batch pass that built the plan, because the plan can
 *     be minutes or hours old by then
 *   - THIS SCRIPT MUST NEVER BE RUN WITH --execute BY AN AGENT SESSION. Dry run only from here;
 *     --execute is a human decision, made after reading the dry-run plan below.
 *
 * The ledger lives outside any git worktree, same reasoning as the sweep: a worktree can be (and
 * has been) removed, and the ledger is the only reversal-relevant record of what this wrote.
 *   /Users/paulalbert/Dropbox/Projects/ReCiter Research/analysis/local_only_reconcile/
 *
 * Requires an active port-forward to run --execute (e.g.
 *   kubectl -n reciter port-forward svc/reciter-prod 9082:80
 * ) with RECITER_API_BASE_URL pointed at it and RECITER_API_KEY set from the reciter-secrets
 * Kubernetes secret — same mechanism note as the sweep; this script does not fetch the key
 * itself, so set both env vars by hand before passing --execute.
 */

import { createConnection } from "mysql2/promise";
import { DynamoDBClient, BatchGetItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { LOCAL_ONLY_MARKER, RECONCILED_MARKER, isLocalOnlyNote } from "../src/lib/localOnlyMarker.ts";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

if (flag("--help")) {
  console.log("Usage: node scripts/reconcile-local-only-assigns.mjs [--execute] [--ledger <path>] [--limit <n>] [--json <path>]");
  console.log("  Dry run (default): reads MySQL + DynamoDB only, writes nothing anywhere.");
  console.log("  --execute: writes gold-standard knownPmids + stamps the row. NEVER from an agent session.");
  console.log("  --limit caps the SCOPE query (a SQL LIMIT), not the write count.");
  console.log("  See this file's header docstring for the full marker contract and safety rules.");
  process.exit(0);
}

const DEFAULT_LEDGER_DIR =
  "/Users/paulalbert/Dropbox/Projects/ReCiter Research/analysis/local_only_reconcile";

const EXECUTE = flag("--execute");
const LEDGER = opt("--ledger", join(DEFAULT_LEDGER_DIR, "reconcile.jsonl"));
const LIMIT = Number(opt("--limit", "0")) || 0; // 0 = no SQL LIMIT
const JSON_OUT = opt("--json", "");

mkdirSync(dirname(LEDGER), { recursive: true });

// The app reads RECITER_DB_*; a shell set up for the ReCiterDB tooling has the same values as
// DB_*. Accept either rather than making the operator re-export four variables — same fallback
// as the sweep.
const DB = {
  host: process.env.RECITER_DB_HOST || process.env.DB_HOST,
  user: process.env.RECITER_DB_USERNAME || process.env.DB_USERNAME,
  password: process.env.RECITER_DB_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.RECITER_DB_NAME || process.env.DB_NAME,
  port: Number(process.env.RECITER_DB_PORT || 3306),
};
const RECITER_BASE = process.env.RECITER_API_BASE_URL;
const RECITER_KEY = process.env.RECITER_API_KEY;

const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1" });

// ---- DynamoDB reads (same tables/shapes/retry as the sweep) -------------------------------
async function batchGet(table, uids, projection, names) {
  const out = new Map();
  const uniq = [...new Set(uids.filter(Boolean).map(String))];
  for (let i = 0; i < uniq.length; i += 100) {
    let pending = uniq.slice(i, i + 100);
    for (let attempt = 0; pending.length && attempt < 5; attempt++) {
      const resp = await ddb.send(new BatchGetItemCommand({
        RequestItems: {
          [table]: {
            Keys: pending.map((uid) => ({ uid: { S: uid } })),
            ProjectionExpression: projection,
            ...(names ? { ExpressionAttributeNames: names } : {}),
          },
        },
      }));
      for (const it of resp.Responses?.[table] ?? []) if (it.uid?.S) out.set(it.uid.S, it);
      const un = resp.UnprocessedKeys?.[table]?.Keys ?? [];
      pending = un.map((k) => k.uid?.S).filter(Boolean);
      if (pending.length) await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
    }
    if (pending.length) throw new Error(`${table} BatchGetItem still throttled after 5 attempts`);
  }
  return out;
}

const pmidSet = (item, attr) =>
  new Set((item?.[attr]?.L ?? []).map((e) => Number(e.N)).filter(Number.isFinite));

// Live re-check of one target, immediately before its write — same reasoning as the sweep:
// identities disappear when people leave WCM, acceptances/rejections appear the moment the
// person curates their own /curate page, and the plan can be minutes or hours old by the time
// we get here.
async function recheck(cwid, pmid) {
  const [ident, gs] = await Promise.all([
    ddb.send(new GetItemCommand({ TableName: "Identity", Key: { uid: { S: cwid } }, ProjectionExpression: "uid" })),
    ddb.send(new GetItemCommand({ TableName: "GoldStandard", Key: { uid: { S: cwid } }, ProjectionExpression: "uid, knownpmids, rejectedpmids" })),
  ]);
  return {
    hasIdentity: !!ident.Item,
    hasAccepted: pmidSet(gs.Item, "knownpmids").has(pmid),
    hasRejected: pmidSet(gs.Item, "rejectedpmids").has(pmid),
  };
}

// ---- gold-standard write — the 'known' twin of the sweep's writeRejection() ----------------
async function writeKnown(uid, pmid, curatedBy) {
  const q = `?goldStandardUpdateFlag=UPDATE&source=adversarial-attribution-review&entryPath=PM_AUTHOR`
    + (curatedBy != null ? `&curatedBy=${curatedBy}` : "");
  const resp = await fetch(`${RECITER_BASE}/reciter/goldstandard${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": RECITER_KEY, "User-Agent": "reciter-pub-manager-reconcile" },
    body: JSON.stringify({ uid, knownPmids: [pmid] }),
  });
  return resp.status;
}

// ---- main -----------------------------------------------------------------------------------
const conn = await createConnection(DB);

// LIKE pattern built from the shared constant, not retyped, so this scope query cannot drift
// from what the writer stamps or the reader reads. No RECONCILED_LIKE / NOT LIKE here — that
// SQL-side approximation is exactly the "hasLocalOnly && !hasReconciled" bug this ticket fixes;
// see the header for why the real filter is the JS-side isLocalOnlyNote() below instead.
const LOCAL_ONLY_LIKE = `%${LOCAL_ONLY_MARKER}%`;
const limitSql = LIMIT > 0 ? " LIMIT ?" : "";
const scopeParams = LIMIT > 0 ? [LOCAL_ONLY_LIKE, LIMIT] : [LOCAL_ONLY_LIKE];
const [rows] = await conn.execute(
  `SELECT id, pmid, source, external_id, resolution_cwid, reviewer, resolved_at, note
     FROM authorship_review
    WHERE status = 'assigned' AND resolution_cwid IS NOT NULL
      AND note LIKE ? AND (source = 'scopus' OR pmid IS NOT NULL)
    ORDER BY id${limitSql}`, scopeParams);

// The curator who made each original decision, so the promoted write carries their userID
// rather than a script's — same as the sweep.
const [admins] = await conn.query(`SELECT userID, personIdentifier FROM admin_users WHERE personIdentifier IS NOT NULL`);
const userIdByCwid = new Map(admins.map((a) => [String(a.personIdentifier).toLowerCase(), a.userID]));
// The MySQL connection stays open past this point (unlike the sweep, which closes it here) —
// --execute needs it later to stamp rows, not just to read them.

// One batched Identity read + one batched GoldStandard read across every distinct
// resolution_cwid in scope — "one live DynamoDB read pair" for the whole scope, not one round
// trip per row.
const targets = [...new Set(rows.map((r) => String(r.resolution_cwid)))];
const identities = await batchGet("Identity", targets, "uid");
const goldStandard = await batchGet("GoldStandard", targets, "uid, knownpmids, rejectedpmids");

// Ledger: (row_id|pmid|cwid) already promoted SUCCESSFULLY on an earlier run. Keyed on the
// `result` record (not `write`, appended before the attempt so the ledger stays useful even on
// a mid-call crash); the gold-standard write is an idempotent MERGE, so re-attempting one whose
// outcome was never recorded costs nothing.
const done = new Set();
if (existsSync(LEDGER)) {
  for (const line of readFileSync(LEDGER, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.phase === "result" && rec.status === 200) done.add(`${rec.row_id}|${rec.pmid}|${rec.cwid}`);
    } catch { /* a torn last line is not a reason to refuse to resume */ }
  }
}

const plan = [];
const scopusUnsupported = [];
const contradictions = [];
const alreadyAccepted = [];
const skips = { reconciled: 0, no_pmid: 0, awaiting_identity: 0, resumed: 0 };
for (const r of rows) {
  const cwid = String(r.resolution_cwid);
  const key = `${r.id}|${r.pmid}|${cwid}`;
  if (done.has(key)) { skips.resumed++; continue; }

  // The SQL LIKE above is a superset of "still local-only right now" (see the header): filter
  // with the same positional read `case "reopen"` uses. A row this says is no longer local-only
  // was already reconciled (possibly more than once, possibly after a re-assign in between) —
  // count it and move on, never plan a second promotion for it.
  if (!isLocalOnlyNote(r.note)) { skips.reconciled++; continue; }

  // scopus_unsupported next and independent of identity — there is no pmid to promote here
  // regardless of what DynamoDB says about this cwid.
  if (r.source === "scopus") {
    scopusUnsupported.push({ id: r.id, external_id: r.external_id, cwid });
    continue;
  }

  const pmid = Number(r.pmid);
  if (!Number.isFinite(pmid) || pmid <= 0) { skips.no_pmid++; continue; }
  if (!identities.has(cwid)) { skips.awaiting_identity++; continue; }

  const gs = goldStandard.get(cwid);
  if (pmidSet(gs, "rejectedpmids").has(pmid)) {
    contradictions.push({ id: r.id, cwid, pmid });
    continue;
  }
  if (pmidSet(gs, "knownpmids").has(pmid)) {
    alreadyAccepted.push({ id: r.id, cwid, pmid });
    continue;
  }
  plan.push({
    row_id: r.id, pmid, cwid, note: r.note,
    curatedBy: userIdByCwid.get(String(r.reviewer || "").toLowerCase()) ?? null,
    reviewer: r.reviewer, resolved_at: r.resolved_at,
  });
}

console.log(`\n${EXECUTE ? "EXECUTE" : "DRY RUN"} — local-only assign reconciliation`);
console.log(`ledger                                       ${LEDGER}`);
console.log(`\nrows in scope (note LIKE local-only, SQL)    ${rows.length}${LIMIT > 0 ? `   (--limit ${LIMIT} applied to the scope query)` : ""}`);
console.log(`already reconciled since (skip, count only)   ${skips.reconciled}`);
console.log(`no usable pmid, non-scopus (skip, count only)  ${skips.no_pmid}`);
console.log(`awaiting identity (skip, count only)           ${skips.awaiting_identity}`);
console.log(`scopus, no automated promotion (report)        ${scopusUnsupported.length}`);
console.log(`contradiction: self-rejected (report)          ${contradictions.length}`);
console.log(`already accepted by that person (report)       ${alreadyAccepted.length}`);
console.log(`already in this ledger (resume, skip)          ${skips.resumed}`);
console.log(`NET WRITES THAT WOULD LAND                     ${plan.length}   (${new Set(plan.map((p) => p.cwid)).size} distinct people, ${new Set(plan.map((p) => p.pmid)).size} pmids)`);

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({
    rows: rows.length, skips, plan, scopusUnsupported, contradictions, alreadyAccepted,
  }, null, 1));
  console.log(`\nplan written to ${JSON_OUT}`);
}

if (!EXECUTE) {
  if (plan.length) {
    console.log("\nfirst 10 planned promotions (row_id, pmid, cwid, reviewer -> curatedBy):");
    for (const p of plan.slice(0, 10)) {
      console.log(`  ${p.row_id}\t${p.pmid}\t${p.cwid}\t${p.reviewer ?? "(none)"} -> ${p.curatedBy ?? "(no admin_users match)"}`);
    }
  }
  if (contradictions.length) {
    console.log("\nCONTRADICTIONS — assignee rejected this exact pmid themselves (row id, cwid, pmid):");
    for (const c of contradictions) console.log(`  ${c.id}\t${c.cwid}\t${c.pmid}`);
  }
  if (scopusUnsupported.length) {
    console.log("\nSCOPUS, not auto-promotable (row id, external_id, cwid):");
    for (const s of scopusUnsupported) console.log(`  ${s.id}\t${s.external_id}\t${s.cwid}`);
  }
  await conn.end();
  console.log(`\ndry run — nothing written. Re-run with --execute to write ${plan.length}.\n`);
  process.exit(0);
}

if (!RECITER_BASE || !RECITER_KEY) {
  await conn.end();
  console.error("RECITER_API_BASE_URL and RECITER_API_KEY must be set to --execute.");
  process.exit(1);
}

let wrote = 0, skipped = 0, failed = 0, stampWarnings = 0;
for (const p of plan) {
  // Never put the note text itself in the ledger (it can be long) — ledger the row identity
  // and outcome only. `note` stays on `p` in memory for the CAS stamp below.
  const { note: originalNote, ...planForLedger } = p;
  const live = await recheck(p.cwid, p.pmid);
  if (!live.hasIdentity || live.hasAccepted || live.hasRejected) {
    skipped++;
    appendFileSync(LEDGER, JSON.stringify({ phase: "skip", ts: new Date().toISOString(), ...planForLedger, live }) + "\n");
    continue;
  }
  // BEFORE the write, so a crash mid-flight still leaves a record of intent.
  appendFileSync(LEDGER, JSON.stringify({ phase: "write", ts: new Date().toISOString(), ...planForLedger, live }) + "\n");
  const status = await writeKnown(p.cwid, p.pmid, p.curatedBy);
  appendFileSync(LEDGER, JSON.stringify({ phase: "result", ts: new Date().toISOString(), row_id: p.row_id, pmid: p.pmid, cwid: p.cwid, status }) + "\n");
  if (status !== 200) {
    failed++;
    console.error(`  FAILED ${p.cwid}/${p.pmid} -> HTTP ${status}`);
    continue;
  }
  wrote++;
  // Compare-and-set on the note exactly as read at plan time: the UPDATE only lands if the note
  // is still byte-identical to `originalNote`. Any change underneath us since then — reconciled,
  // reopened, re-assigned, or stamped by something else — makes affectedRows come back 0 instead
  // of overwriting a note this script no longer has an accurate picture of.
  const stampText = `${RECONCILED_MARKER} ${new Date().toISOString().slice(0, 10)}`;
  const [result] = await conn.execute(
    `UPDATE authorship_review SET note = CONCAT(?, ' | ', ?) WHERE id = ? AND note = ?`,
    [originalNote, stampText, p.row_id, originalNote],
  );
  // Never the note text — row id and affectedRows only.
  appendFileSync(LEDGER, JSON.stringify({ phase: "stamp", ts: new Date().toISOString(), row_id: p.row_id, affectedRows: result.affectedRows }) + "\n");
  if (result.affectedRows === 0) {
    stampWarnings++;
    console.warn(`  WARN row ${p.row_id}: gold-standard write landed but the note changed underneath us — stamp skipped, needs a human look`);
  }
}
await conn.end();
console.log(`\nwrote ${wrote}, skipped on live re-check ${skipped}, failed ${failed}, stamp warnings ${stampWarnings}\n`);
