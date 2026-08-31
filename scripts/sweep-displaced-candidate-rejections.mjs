#!/usr/bin/env node
/**
 * Sweep: record the rejection a DISPLACED single-candidate row never wrote.
 *
 * scripts/backfill-homonym-rejections.mjs (2026-08-30) backfilled homonym rejections for
 * already-resolved MULTI-candidate rows (its query is scoped to `single_candidate = 0 OR
 * single_candidate IS NULL`). A single-candidate row's one proposed candidate getting DISPLACED
 * — the curator assigned the paper to someone else instead — is the same "not mine" judgment
 * (F-2 policy, verbatim from the product owner: "If I accept it for 1 person, any other person
 * being considered should be a reject. This goes across the board"), but that backfill's WHERE
 * clause explicitly excluded these rows, so they were never covered. Driving case: PMID
 * 41319722, resolved local-only away from abt4005 (single-candidate) — abt4005 never got a
 * rejection. F-2 fixed this going forward in the live assign/reopen code path
 * (controllers/db/authorships.controller.ts); this script is the retroactive sweep for rows
 * resolved before that shipped.
 *
 * Run (DRY RUN, the default — reads only, writes nothing anywhere):
 *   RECITER_DB_HOST=... RECITER_DB_USERNAME=... RECITER_DB_PASSWORD=... RECITER_DB_NAME=... \
 *     node --experimental-strip-types scripts/sweep-displaced-candidate-rejections.mjs
 *   # or, from a shell already exporting DB_HOST/DB_USERNAME/DB_PASSWORD/DB_NAME (see below):
 *   node --experimental-strip-types scripts/sweep-displaced-candidate-rejections.mjs
 * Execute (writes gold-standard rejections — NEVER run this from an agent session):
 *   node --experimental-strip-types scripts/sweep-displaced-candidate-rejections.mjs --execute \
 *     --ledger "/Users/paulalbert/Dropbox/Projects/ReCiter Research/analysis/displaced_rejection_sweep/sweep.jsonl"
 *
 * Flags (same names/shapes as the backfill, except --apply is spelled --execute here so the two
 * scripts can never be confused on the command line):
 *   --execute             actually POST the gold-standard writes (default: dry run)
 *   --ledger <path>       JSONL ledger (default: the analysis/ path below)
 *   --status <list>       comma-separated statuses to sweep (default "assigned,accepted")
 *   --limit <n>           stop after n writes — for a small first execute batch
 *   --json <path>         also write the derived plan as JSON, for auditing it as data
 *
 * SCOPE (the WHERE clause): source = 'pubmed', pmid IS NOT NULL, single_candidate = 1,
 * resolution_cwid IS NOT NULL, resolution_cwid <> top_cwid, status IN (<--status>). pubmed only
 * — scopus carries no pmid and gold standard is PMID-keyed, same precedent as the live code's
 * `case "reject"` scopus branch and homonymRejections' own isScopus guard. single_candidate = 1
 * only — that is precisely the complement of what the 2026-08-30 backfill already covered; a
 * multi-candidate row is not this script's job even if resolution_cwid <> top_cwid (that shape
 * is already inside the backfill's general "others = candidates minus target" plan). Every row
 * this query matches is, by construction, an off-candidate assign: a single-candidate row has
 * exactly one proposed candidate, so resolution_cwid <> top_cwid means the assignee was never
 * the row's suggestion.
 *
 * DISPLACED SET: the same parseCandidates()-then-filter shape as the backfill —
 * candidates = unique([top_cwid, ...candidate_cwids_json]), displaced = candidates minus
 * resolution_cwid. For a genuine single-candidate row candidate_cwids_json is empty, so this is
 * just [top_cwid]; the general form is kept (rather than hardcoding top_cwid) so a row with a
 * stray non-empty candidate_cwids_json under single_candidate = 1 is still handled correctly
 * instead of silently under-counted.
 *
 * PLAN DERIVED THROUGH THE SAME PURE FUNCTION AS THE LIVE CODE AND THE BACKFILL: homonymRejections()
 * from src/lib/assignGate.ts, called with singleCandidate: false — F-2 made that the live
 * controller's unconditional call shape (a single-candidate row's sole candidate is no longer
 * exempt), so this sweep must plan through the identical shape or it and the live code could
 * disagree about who gets rejected. That import is why this script needs
 * --experimental-strip-types (node >= 22.6), same as the backfill and
 * scripts/check-assign-gate.mjs.
 *
 * PER-TARGET SKIPS — identical semantics to homonymRejectionTargets() in the controller and to
 * the backfill's own accounting:
 *   - no ReCiter identity for the displaced cwid  -> skip + count (a write would 200 into an
 *     orphan GoldStandard row no Identity and no PM view ever reads)
 *   - displaced cwid already ACCEPTED this pmid   -> skip + count (never tell ReCiter someone
 *     both wrote and didn't write a paper)
 *   - displaced cwid already REJECTED this pmid   -> skip, not counted toward net writes
 *     (idempotency: re-running finds nothing new to do; also protects a person's own /curate
 *     rejection from being mistaken for one this sweep should ledger as its own to reverse)
 *
 * WHAT IT WRITES, AND WHAT IT DELIBERATELY DOES NOT — identical to the backfill: gold standard
 * only, POST /reciter/goldstandard with rejectedPmids, the same call the endpoint makes. It does
 * NOT append AdminFeedbackLog rows and does NOT touch pending-article counts — both are
 * live-curator artifacts (a timestamp of the moment a human decided) that a script back-dating
 * would fabricate.
 *
 * Safety (identical structure to the backfill):
 *   - dry run by default; --execute is the only way to write, and even then is gated a second
 *     and third time: RECITER_API_BASE_URL and RECITER_API_KEY must both be set, or the script
 *     refuses before touching the network
 *   - every write is appended to the JSONL ledger BEFORE it is attempted, so the ledger is a
 *     complete reversal script even if the process dies mid-write (replay each phase:"write"
 *     record with goldStandardUpdateFlag=DELETE)
 *   - resumable: a (row_id, pmid, cwid) already in the ledger is skipped on re-run
 *   - both guards are re-checked LIVE immediately before each write, not just in the batch pass
 *     that built the plan, because the plan can be minutes or hours old by then
 *   - THIS SCRIPT MUST NEVER BE RUN WITH --execute BY AN AGENT SESSION. Dry run only from here;
 *     --execute is a human decision, made after reading the dry-run plan below.
 *
 * The ledger lives outside any git worktree, same reasoning as the backfill: a worktree can be
 * (and has been) removed, and the ledger is the only reversal record for these writes.
 *   /Users/paulalbert/Dropbox/Projects/ReCiter Research/analysis/displaced_rejection_sweep/
 *
 * Requires an active port-forward to run --execute (e.g.
 *   kubectl -n reciter port-forward svc/reciter-prod 9082:80
 * ) with RECITER_API_BASE_URL pointed at it and RECITER_API_KEY set from the
 * reciter-secrets Kubernetes secret — see scripts/run-homonym-backfill.sh for the exact
 * mechanism (fetches the key itself so it never appears on a command line); this script does not
 * duplicate that wrapper, so set both env vars by hand before passing --execute.
 */

import { createConnection } from "mysql2/promise";
import { DynamoDBClient, BatchGetItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homonymRejections } from "../src/lib/assignGate.ts";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const DEFAULT_LEDGER_DIR =
  "/Users/paulalbert/Dropbox/Projects/ReCiter Research/analysis/displaced_rejection_sweep";

const EXECUTE = flag("--execute");
const LEDGER = opt("--ledger", join(DEFAULT_LEDGER_DIR, "sweep.jsonl"));
const STATUSES = opt("--status", "assigned,accepted").split(",").map((s) => s.trim()).filter(Boolean);
const LIMIT = Number(opt("--limit", "0")) || Infinity;
const JSON_OUT = opt("--json", "");

mkdirSync(dirname(LEDGER), { recursive: true });

// The app reads RECITER_DB_*; a shell set up for the ReCiterDB tooling has the same values as
// DB_*. Accept either rather than making the operator re-export four variables — same fallback
// as the backfill.
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

// ---- DynamoDB reads (same tables/shapes as the backfill / src/lib/goldStandardRejections.ts) --
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

// Live re-check of one target, immediately before its write — same reasoning as the backfill:
// identities disappear when people leave WCM, acceptances appear the moment the person curates
// their own /curate page, and the plan can be minutes or hours old by the time we get here.
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

// ---- gold-standard write (mirrors writeGoldStandard() in the controller / the backfill) -------
async function writeRejection(uid, pmid, curatedBy) {
  const q = `?goldStandardUpdateFlag=UPDATE&source=adversarial-attribution-review&entryPath=PM_AUTHOR`
    + (curatedBy != null ? `&curatedBy=${curatedBy}` : "");
  const resp = await fetch(`${RECITER_BASE}/reciter/goldstandard${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": RECITER_KEY, "User-Agent": "reciter-pub-manager-sweep" },
    body: JSON.stringify({ uid, rejectedPmids: [pmid] }),
  });
  return resp.status;
}

// ---- main ---------------------------------------------------------------------------------
// Same helper as the backfill: the general "unique([top_cwid, ...json])" shape, kept general
// rather than hardcoded to [top_cwid] so a single_candidate = 1 row with a stray non-empty
// candidate_cwids_json is still handled correctly.
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
      AND single_candidate = 1
      AND resolution_cwid IS NOT NULL AND resolution_cwid <> top_cwid
      AND status IN (${STATUSES.map(() => "?").join(",")})
    ORDER BY id`, STATUSES);

// The curator who made each original decision, so the replayed write carries their userID
// rather than a script's — same as the backfill.
const [admins] = await conn.query(`SELECT userID, personIdentifier FROM admin_users WHERE personIdentifier IS NOT NULL`);
const userIdByCwid = new Map(admins.map((a) => [String(a.personIdentifier).toLowerCase(), a.userID]));
await conn.end();

// Everything the plan needs about every displaced candidate, in two batched reads.
const allDisplaced = new Set();
for (const r of rows) {
  for (const c of parseCandidates(r.candidate_cwids_json, r.top_cwid)) {
    if (c !== String(r.resolution_cwid)) allDisplaced.add(c);
  }
}
const identities = await batchGet("Identity", [...allDisplaced], "uid");
const goldStandard = await batchGet("GoldStandard", [...allDisplaced], "uid, knownpmids, rejectedpmids");

// Ledger: (row_id|pmid|cwid) already written SUCCESSFULLY on an earlier run. Same reasoning as
// the backfill: keyed on the `result` record (not `write`, which is appended before the attempt
// so the ledger stays a reversal script even on a mid-call crash); writeGoldStandard is an
// idempotent MERGE, so re-attempting a write whose outcome was never recorded costs nothing.
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
const perStatus = {};
for (const r of rows) {
  const pmid = Number(r.pmid);
  const target = String(r.resolution_cwid);
  const candidates = parseCandidates(r.candidate_cwids_json, r.top_cwid);
  perStatus[r.status] = (perStatus[r.status] || 0) + 1;
  const displaced = candidates.filter((c) => c !== target);
  // Everything homonymRejectionTargets() would have found for this row, through the same pure
  // function the live controller uses post-F-2 (singleCandidate: false unconditionally) —
  // including the two skips below, counted rather than assumed.
  const keep = homonymRejections({
    isScopus: false, singleCandidate: false, candidates, target,
    hasIdentity: (c) => identities.has(c),
    hasAccepted: (c) => pmidSet(goldStandard.get(c), "knownpmids").has(pmid),
  });
  for (const c of displaced) {
    if (!identities.has(c)) { skips.no_identity++; continue; }
    if (pmidSet(goldStandard.get(c), "knownpmids").has(pmid)) { skips.already_accepted++; continue; }
  }
  for (const cwid of keep) {
    // Already carrying this rejection — from their own /curate page, or an earlier run of this
    // sweep whose ledger is gone. The write would be a no-op MERGE, but LEDGERING it would not
    // be: the ledger is the reversal script, and replaying a DELETE for a rejection this sweep
    // did not cause would erase the person's own decision. Skip it in both directions.
    if (pmidSet(goldStandard.get(cwid), "rejectedpmids").has(pmid)) { skips.already_rejected++; continue; }
    if (done.has(`${r.id}|${pmid}|${cwid}`)) { skips.resumed++; continue; }
    plan.push({ row_id: r.id, pmid, cwid, target, status: r.status,
      curatedBy: userIdByCwid.get(String(r.reviewer || "").toLowerCase()) ?? null,
      reviewer: r.reviewer, resolved_at: r.resolved_at });
  }
}

const implied = plan.length + Object.values(skips).reduce((a, b) => a + b, 0);
console.log(`\n${EXECUTE ? "EXECUTE" : "DRY RUN"} — displaced single-candidate rejection sweep`);
console.log(`ledger                                    ${LEDGER}`);
console.log(`statuses                                  ${STATUSES.join(",")}`);
console.log(`\nresolved single-candidate displaced rows  ${rows.length}   (${Object.entries(perStatus).map(([k, v]) => `${k} ${v}`).join(", ")})`);
console.log(`(every matched row is off-candidate by construction: a single-candidate row's only`);
console.log(` proposed cwid was displaced, or it would not match resolution_cwid <> top_cwid)`);
console.log(`rejection writes implied                  ${implied}`);
console.log(`already ACCEPTED by that person (skip)    ${skips.already_accepted}`);
console.log(`target has NO ReCiter identity (skip)     ${skips.no_identity}`);
console.log(`already rejected by that person (skip)    ${skips.already_rejected}`);
console.log(`already in this ledger (resume, skip)     ${skips.resumed}`);
console.log(`NET WRITES THAT WOULD LAND                ${plan.length}   (${new Set(plan.map((p) => p.cwid)).size} distinct people, ${new Set(plan.map((p) => p.pmid)).size} pmids)`);
if (!plan.length) { console.log("\nnothing to do.\n"); process.exit(0); }

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ rows: rows.length, perStatus, implied, skips, plan }, null, 1));
  console.log(`\nplan written to ${JSON_OUT}`);
}

if (!EXECUTE) {
  console.log("\nfirst 10 planned writes (row_id, pmid, reject cwid, assigned to, curatedBy):");
  for (const p of plan.slice(0, 10)) console.log(`  ${p.row_id}\t${p.pmid}\t${p.cwid}\t-> ${p.target}\t${p.curatedBy ?? "(no admin_users match)"}`);
  console.log(`\ndry run — nothing written. Re-run with --execute to write ${Math.min(plan.length, LIMIT)}.\n`);
  process.exit(0);
}

if (!RECITER_BASE || !RECITER_KEY) {
  console.error("RECITER_API_BASE_URL and RECITER_API_KEY must be set to --execute.");
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
