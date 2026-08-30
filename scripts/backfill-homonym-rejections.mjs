#!/usr/bin/env node
/**
 * Backfill: record the homonym rejections that ALREADY-RESOLVED multi-candidate rows never
 * wrote.
 *
 * Assigning a multi-candidate authorship to one of N proposed homonyms says two things — this
 * person wrote it, and the other N-1 did not. Until the change this script accompanies, only
 * the first was written down. This replays the second for the rows resolved before it shipped.
 *
 * Run (DRY RUN, the default — reads only, writes nothing anywhere):
 *   node --experimental-strip-types scripts/backfill-homonym-rejections.mjs
 * Apply:
 *   node --experimental-strip-types scripts/backfill-homonym-rejections.mjs --apply
 *
 * Flags:
 *   --apply              actually POST the gold-standard writes (default: dry run)
 *   --ledger <path>      JSONL ledger (default scripts/backfill-homonym-rejections.jsonl)
 *   --status <list>      comma-separated statuses to backfill (default "assigned,accepted")
 *   --limit <n>          stop after n writes — for a small first apply batch
 *   --json <path>        also write the derived plan as JSON, for auditing it as data
 *
 * The plan is derived through homonymRejections() from src/lib/assignGate.ts — the same pure
 * function controllers/db/authorships.controller.ts writes through — so the backfill and the
 * endpoint cannot disagree about who gets rejected. That import is why the script needs
 * --experimental-strip-types (node >= 22.6); scripts/check-assign-gate.mjs has the same
 * requirement for the same reason.
 *
 * WHY status defaults to "assigned,accepted": the live feature only ever fires on `assign`,
 * because `case "accept"` 409s on a multi-candidate row ("use Pick one"). But 31 multi-candidate
 * rows were resolved through accept before that gate existed, and the curator judgment they
 * record is identical — one of these N homonyms wrote it. Pass --status assigned to backfill
 * only what the live code path can still produce.
 *
 * WHAT IT WRITES, AND WHAT IT DELIBERATELY DOES NOT: gold standard only —
 * POST /reciter/goldstandard with rejectedPmids, the same call the endpoint makes. It does NOT
 * append AdminFeedbackLog rows and does NOT touch pending-article counts, both of which the
 * live action does. Those two are live-curator artifacts: a FeedbackLog row is stamped with a
 * userID and a timestamp of the moment it happened, and back-dating them into curators'
 * histories would be a fabrication of when they were decided; updatePendingArticleCount()
 * decrements a person's pending count, which is wrong for an article that was never in their
 * pending list to begin with. The gold standard is the record ReCiter, /curate and the model
 * actually read, and it is the one that was genuinely missing.
 *
 * Safety:
 *   - dry run by default; --apply is the only way to write
 *   - every write is appended to the JSONL ledger BEFORE it is attempted, so the ledger is a
 *     complete reversal script even if the process dies mid-write (replay each phase:"write"
 *     record with goldStandardUpdateFlag=DELETE)
 *   - resumable: a (row_id, pmid, cwid) already in the ledger is skipped on re-run
 *   - both guards are re-checked LIVE immediately before each write, not just in the batch
 *     pass that built the plan, because the plan can be minutes or hours old by then
 */

import { createConnection } from "mysql2/promise";
import { DynamoDBClient, BatchGetItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homonymRejections } from "../src/lib/assignGate.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const APPLY = flag("--apply");
const LEDGER = opt("--ledger", join(ROOT, "scripts/backfill-homonym-rejections.jsonl"));
const STATUSES = opt("--status", "assigned,accepted").split(",").map((s) => s.trim()).filter(Boolean);
const LIMIT = Number(opt("--limit", "0")) || Infinity;
const JSON_OUT = opt("--json", "");

// The app reads RECITER_DB_*; a shell set up for the ReCiterDB tooling has the same values as
// DB_*. Accept either rather than making the operator re-export four variables.
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

// ---- DynamoDB reads (same tables/shapes as src/lib/goldStandardRejections.ts) --------------
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

// Live re-check of one target, immediately before its write. Both facts can move between the
// batch pass and the write: identities disappear when people leave WCM, acceptances appear the
// moment the person curates their own /curate page.
async function recheck(cwid, pmid) {
  const [ident, gs] = await Promise.all([
    ddb.send(new GetItemCommand({ TableName: "Identity", Key: { uid: { S: cwid } }, ProjectionExpression: "uid" })),
    ddb.send(new GetItemCommand({ TableName: "GoldStandard", Key: { uid: { S: cwid } }, ProjectionExpression: "uid, knownpmids, rejectedpmids" })),
  ]);
  return {
    hasIdentity: !!ident.Item,
    hasAccepted: pmidSet(gs.Item, "knownpmids").has(pmid),
    alreadyRejected: pmidSet(gs.Item, "rejectedpmids").has(pmid),
  };
}

// ---- gold-standard write (mirrors writeGoldStandard() in the controller) -------------------
async function writeRejection(uid, pmid, curatedBy) {
  const q = `?goldStandardUpdateFlag=UPDATE&source=adversarial-attribution-review&entryPath=PM_AUTHOR`
    + (curatedBy != null ? `&curatedBy=${curatedBy}` : "");
  const resp = await fetch(`${RECITER_BASE}/reciter/goldstandard${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": RECITER_KEY, "User-Agent": "reciter-pub-manager-backfill" },
    body: JSON.stringify({ uid, rejectedPmids: [pmid] }),
  });
  return resp.status;
}

// ---- main ---------------------------------------------------------------------------------
const parseCandidates = (json, topCwid) => {
  let parsed = [];
  try { parsed = JSON.parse(json || "[]"); } catch { parsed = []; }
  const list = Array.isArray(parsed)
    ? parsed.map((c) => (typeof c === "string" ? c : c?.cwid)).filter(Boolean).map(String)
    : [];
  return [...new Set([topCwid, ...list].filter(Boolean).map(String))];
};

const conn = await createConnection(DB);
const [rows] = await conn.execute(
  `SELECT id, pmid, top_cwid, resolution_cwid, candidate_cwids_json, status, reviewer, resolved_at
     FROM authorship_review
    WHERE source = 'pubmed' AND pmid IS NOT NULL
      AND (single_candidate = 0 OR single_candidate IS NULL)
      AND resolution_cwid IS NOT NULL
      AND status IN (${STATUSES.map(() => "?").join(",")})
    ORDER BY id`, STATUSES);

// The curator who made each original decision, so the replayed write carries their userID
// rather than a script's. authorship_review.reviewer holds their cwid.
const [admins] = await conn.query(`SELECT userID, personIdentifier FROM admin_users WHERE personIdentifier IS NOT NULL`);
const userIdByCwid = new Map(admins.map((a) => [String(a.personIdentifier).toLowerCase(), a.userID]));
await conn.end();

// Everything the plan needs about every non-chosen candidate, in two batched reads.
const allOthers = new Set();
for (const r of rows) {
  for (const c of parseCandidates(r.candidate_cwids_json, r.top_cwid)) {
    if (c !== String(r.resolution_cwid)) allOthers.add(c);
  }
}
const identities = await batchGet("Identity", [...allOthers], "uid");
const goldStandard = await batchGet("GoldStandard", [...allOthers], "uid, knownpmids, rejectedpmids");

// Ledger: (row_id|pmid|cwid) already written SUCCESSFULLY on an earlier run.
// Keyed on the `result` record, not `write`. A `write` record is appended BEFORE the attempt
// (so the ledger is a complete reversal script even if we die mid-call), which means a failed
// write is indistinguishable from a successful one by phase alone — resuming on `write` would
// silently drop every 502 and require a hand-edited ledger to recover. writeGoldStandard is an
// idempotent MERGE, so retrying a write whose outcome we never recorded costs nothing; a crash
// between the two appends simply re-attempts.
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
const skips = { no_identity: 0, already_accepted: 0, already_rejected: 0, resumed: 0 };
const offCandidate = [];
const perStatus = {};
for (const r of rows) {
  const pmid = Number(r.pmid);
  const target = String(r.resolution_cwid);
  const candidates = parseCandidates(r.candidate_cwids_json, r.top_cwid);
  perStatus[r.status] = (perStatus[r.status] || 0) + 1;
  if (!candidates.includes(target)) offCandidate.push(r.id);
  const others = candidates.filter((c) => c !== target);
  // Everything the endpoint's homonymRejectionTargets() would have found, through the same
  // pure function — including the two skips, so they can be counted rather than assumed.
  const keep = homonymRejections({
    isScopus: false, singleCandidate: false, candidates, target,
    hasIdentity: (c) => identities.has(c),
    hasAccepted: (c) => pmidSet(goldStandard.get(c), "knownpmids").has(pmid),
  });
  for (const c of others) {
    if (!identities.has(c)) { skips.no_identity++; continue; }
    if (pmidSet(goldStandard.get(c), "knownpmids").has(pmid)) { skips.already_accepted++; continue; }
  }
  for (const cwid of keep) {
    // Already carrying this rejection — from their own /curate page, or an earlier run whose
    // ledger is gone. The write would be a no-op MERGE, but LEDGERING it would not be: the
    // ledger is the reversal script, and replaying a DELETE for a rejection this backfill did
    // not cause would erase the person's own decision. Skip it in both directions.
    if (pmidSet(goldStandard.get(cwid), "rejectedpmids").has(pmid)) { skips.already_rejected++; continue; }
    if (done.has(`${r.id}|${pmid}|${cwid}`)) { skips.resumed++; continue; }
    plan.push({ row_id: r.id, pmid, cwid, target, status: r.status,
      curatedBy: userIdByCwid.get(String(r.reviewer || "").toLowerCase()) ?? null,
      reviewer: r.reviewer, resolved_at: r.resolved_at });
  }
}

const implied = plan.length + Object.values(skips).reduce((a, b) => a + b, 0);
console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — homonym rejection backfill`);
console.log(`ledger                                    ${LEDGER}`);
console.log(`statuses                                  ${STATUSES.join(",")}`);
console.log(`\nresolved multi-candidate pubmed rows      ${rows.length}   (${Object.entries(perStatus).map(([k, v]) => `${k} ${v}`).join(", ")})`);
console.log(`rejection writes implied                  ${implied}`);
console.log(`already ACCEPTED by that person (skip)    ${skips.already_accepted}`);
console.log(`target has NO ReCiter identity (skip)     ${skips.no_identity}`);
console.log(`already rejected by that person (skip)    ${skips.already_rejected}`);
console.log(`already in this ledger (resume, skip)     ${skips.resumed}`);
console.log(`NET WRITES THAT WOULD LAND                ${plan.length}   (${new Set(plan.map((p) => p.cwid)).size} distinct people, ${new Set(plan.map((p) => p.pmid)).size} pmids)`);
if (offCandidate.length) {
  console.log(`\nnote: ${offCandidate.length} row(s) were assigned to someone who was NOT a proposed`);
  console.log(`candidate, so every candidate on those rows is rejected: ${offCandidate.slice(0, 12).join(", ")}`);
}
if (!plan.length) { console.log("\nnothing to do.\n"); process.exit(0); }

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ rows: rows.length, perStatus, implied, skips, plan }, null, 1));
  console.log(`\nplan written to ${JSON_OUT}`);
}

if (!APPLY) {
  console.log("\nfirst 10 planned writes (row_id, pmid, reject cwid, assigned to, curatedBy):");
  for (const p of plan.slice(0, 10)) console.log(`  ${p.row_id}\t${p.pmid}\t${p.cwid}\t-> ${p.target}\t${p.curatedBy ?? "(no admin_users match)"}`);
  console.log(`\ndry run — nothing written. Re-run with --apply to write ${Math.min(plan.length, LIMIT)}.\n`);
  process.exit(0);
}

if (!RECITER_BASE || !RECITER_KEY) {
  console.error("RECITER_API_BASE_URL and RECITER_API_KEY must be set to --apply.");
  process.exit(1);
}

let wrote = 0, skipped = 0, failed = 0;
for (const p of plan) {
  if (wrote >= LIMIT) break;
  const live = await recheck(p.cwid, p.pmid);
  if (!live.hasIdentity || live.hasAccepted || live.alreadyRejected) {
    skipped++;
    appendFileSync(LEDGER, JSON.stringify({ phase: "skip", ts: new Date().toISOString(), ...p, live }) + "\n");
    continue;
  }
  // BEFORE the write, so a crash mid-flight still leaves a reversible record.
  appendFileSync(LEDGER, JSON.stringify({ phase: "write", ts: new Date().toISOString(), ...p, live }) + "\n");
  const status = await writeRejection(p.cwid, p.pmid, p.curatedBy);
  appendFileSync(LEDGER, JSON.stringify({ phase: "result", ts: new Date().toISOString(), row_id: p.row_id, pmid: p.pmid, cwid: p.cwid, status }) + "\n");
  if (status === 200) wrote++;
  else { failed++; console.error(`  FAILED ${p.cwid}/${p.pmid} -> HTTP ${status}`); }
}
console.log(`\nwrote ${wrote}, skipped on live re-check ${skipped}, failed ${failed}\n`);
