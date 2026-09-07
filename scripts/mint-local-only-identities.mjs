#!/usr/bin/env node
/**
 * The MISSING FIRST HALF of scripts/reconcile-local-only-assigns.mjs.
 *
 * That script promotes a local-only assign to a real gold-standard write "once ReCiter gains an
 * Identity for the assignee it didn't have when the row was resolved" — and then waits, because
 * nothing was ever going to create those identities. Measured against production 2026-09-07:
 *
 *     rows that ever carried LOCAL_ONLY_MARKER      255
 *     rows still local-only right now               255      <- not one has EVER been reconciled
 *     distinct assignees                             67
 *     by source                        241 pubmed, 14 scopus
 *
 * So 255 curator decisions have written nothing to anybody's publication record, and they never
 * will on their own. This script closes that: for each of those assignees, ask the live
 * directories (src/lib/directory.ts — WCM Enterprise Directory and Cornell Ithaca) who they are,
 * and mint the ReCiter identity from the directory record. Afterwards
 * reconcile-local-only-assigns.mjs sees an identity where there was none and promotes the rows,
 * unchanged — this script deliberately writes NO gold standard itself, so the two halves stay
 * independently reviewable and the promotion keeps its own ledger, guards and resume logic.
 *
 * Why these people have no identity in the first place: reciter-inst-client builds its roster
 * from `(&(objectClass=eduPerson)(weillCornellEduPersonTypeCode=academic))`
 * (LdapIdentityDaoImpl.java:545). WCM staff, residents and fellows are structurally excluded,
 * and Cornell Ithaca people are in a different directory entirely. A curator naming one of them
 * was always naming a real human ReCiter had no record of.
 *
 * Run (DRY RUN, the default — reads MySQL, DynamoDB and LDAP, writes nothing anywhere):
 *   node --experimental-strip-types scripts/mint-local-only-identities.mjs
 * Execute (creates DynamoDB Identity records — NEVER run this from an agent session):
 *   node --experimental-strip-types scripts/mint-local-only-identities.mjs --execute \
 *     --ledger "/Users/paulalbert/Dropbox/Projects/ReCiter Research/analysis/local_only_reconcile/mint.jsonl"
 *
 * Flags mirror reconcile-local-only-assigns.mjs exactly:
 *   --execute          actually POST /reciter/identity/ (default: dry run)
 *   --ledger <path>    JSONL ledger (default: the analysis/ path below)
 *   --limit <n>        cap the number MINTED (applied after classification, not to the SQL)
 *   --json <path>      also write the derived plan as JSON, for auditing it as data
 *   --help
 *
 * FOUR OUTCOMES, and only the first is written:
 *   mint      the directory names them and the record satisfies ReCiter's mandatory fields
 *             (uid,firstName,firstInitial,lastName — application.properties:391)
 *   bridged   a Cornell record that publishes a `cornellEduCWID` — i.e. Cornell says this netid
 *             and that WCM cwid are one human. NOT minted, deliberately: minting the netid is
 *             exactly how Martin Wells became mtw1 (24 pubs) AND maw2065 (65 pubs), 89
 *             publications split across two records for one person. The row needs its assignee
 *             RE-POINTED at the cwid, which is a decision about someone else's attribution and
 *             belongs to a curator, not to an unattended backfill. (The live assign path in
 *             controllers/db/authorships.controller.ts DOES resolve this automatically — it can,
 *             because a curator is right there confirming against the name. This script has no
 *             such moment, which is the whole difference.) Reported so a human can action it.
 *   unusable  a directory record with no given or family name — cannot satisfy the mandatory
 *             fields, so it would 500 on the POST. Left local-only.
 *   absent    neither directory has them. Left local-only, which is the correct state: there is
 *             genuinely nothing to attribute to.
 *
 * Requires an active port-forward for --execute, same as the reconciler
 * (kubectl -n reciter port-forward svc/reciter-prod 9082:80, RECITER_API_BASE_URL pointed at it).
 * Directory credentials come from the same env vars the app uses — WCM_ED_LDAP_* and
 * CORNELL_LDAP_* — and a source whose vars are unset is simply absent, so a partial
 * configuration downgrades people to `absent` rather than failing the run.
 *
 * The ledger lives outside any git worktree, same reasoning as the reconciler: a worktree can be
 * removed, and the ledger is the only reversal-relevant record of what this created. Rollback is
 * DELETE /reciter/identity/{uid} per minted uid — but note the reconciler may have promoted rows
 * against those identities by then, so reverse in the opposite order to creation.
 */
import { createConnection } from "mysql2/promise";
import { DynamoDBClient, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { LOCAL_ONLY_MARKER, isLocalOnlyNote } from "../src/lib/localOnlyMarker.ts";
import { lookupDirectoryPerson, directoryIdentityPayload, directoryConfigured } from "../src/lib/directory.ts";

const DEFAULT_LEDGER_DIR = "/Users/paulalbert/Dropbox/Projects/ReCiter Research/analysis/local_only_reconcile";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

if (flag("--help")) {
  console.log("Usage: node --experimental-strip-types scripts/mint-local-only-identities.mjs [--execute] [--ledger <path>] [--limit <n>] [--json <path>]");
  console.log("  Dry run (default): reads MySQL + DynamoDB + LDAP only, writes nothing anywhere.");
  console.log("  --execute: creates DynamoDB Identity records. NEVER from an agent session.");
  console.log("  Run reconcile-local-only-assigns.mjs afterwards to promote the rows.");
  process.exit(0);
}

const EXECUTE = flag("--execute");
const LEDGER = opt("--ledger", join(DEFAULT_LEDGER_DIR, "mint.jsonl"));
const LIMIT = Number(opt("--limit", "0")) || 0;
const JSON_OUT = opt("--json", null);

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

const ledger = (rec) => {
  mkdirSync(dirname(LEDGER), { recursive: true });
  appendFileSync(LEDGER, `${JSON.stringify({ at: new Date().toISOString(), ...rec })}\n`);
};

// Same shape and retry posture as the reconciler's batchGet: throttling is retried, exhaustion
// throws. A silent miss here would mint a duplicate identity over someone who already has one.
async function existingIdentityUids(uids) {
  const out = new Set();
  for (let i = 0; i < uids.length; i += 100) {
    let pending = uids.slice(i, i + 100).map((uid) => ({ uid: { S: uid } }));
    for (let attempt = 0; attempt < 5 && pending.length; attempt++) {
      const resp = await ddb.send(new BatchGetItemCommand({
        RequestItems: { Identity: { Keys: pending, ProjectionExpression: "uid" } },
      }));
      for (const it of resp.Responses?.Identity ?? []) if (it.uid?.S) out.add(it.uid.S);
      pending = resp.UnprocessedKeys?.Identity?.Keys ?? [];
      if (pending.length) await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
    }
    if (pending.length) throw new Error("Identity BatchGetItem still throttled after 5 attempts");
  }
  return out;
}

async function mint(identity) {
  const resp = await fetch(`${RECITER_BASE}/reciter/identity/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", "api-key": RECITER_KEY,
      "User-Agent": "reciter-pub-manager-backfill",
    },
    body: JSON.stringify(identity),
  });
  return { status: resp.status, body: resp.status === 200 ? "" : (await resp.text()).slice(0, 300) };
}

// ---------------------------------------------------------------------------------- scope

const conn = await createConnection(DB);
// Superset scope, narrowed in JS by isLocalOnlyNote — the note is append-only and either marker
// can appear more than once, so "LIKE but NOT LIKE" is wrong. Identical reasoning, and identical
// predicate, as the reconciler.
const [rows] = await conn.execute(
  `SELECT id, resolution_cwid, pmid, source, note FROM authorship_review
    WHERE status = 'assigned' AND resolution_cwid IS NOT NULL AND note LIKE ?`,
  [`%${LOCAL_ONLY_MARKER}%`]);
const live = rows.filter((r) => isLocalOnlyNote(r.note));

const byCwid = new Map();
for (const r of live) {
  if (!byCwid.has(r.resolution_cwid)) byCwid.set(r.resolution_cwid, []);
  byCwid.get(r.resolution_cwid).push(r.id);
}
const cwids = [...byCwid.keys()].sort();

// A cwid that has GAINED an identity since (IC#148 backfills, or a previous run of this script)
// is not this script's problem — it is the reconciler's, and minting over it would replace a
// live record. reciterIdentitySet's byte-exact/lowercase pairing is mirrored here for the same
// reason it exists there: DynamoDB keys are byte-exact.
const already = await existingIdentityUids([...new Set(cwids.flatMap((c) => [c, c.toLowerCase()]))]);

const plan = [], skipped = { already: [], bridged: [], unusable: [], absent: [] };
for (const cwid of cwids) {
  if (already.has(cwid) || already.has(cwid.toLowerCase())) {
    skipped.already.push({ cwid, rows: byCwid.get(cwid).length }); continue;
  }
  const dir = await lookupDirectoryPerson(cwid);
  if (!dir) { skipped.absent.push({ cwid, rows: byCwid.get(cwid).length }); continue; }
  // Bridged on the ATTRIBUTE'S PRESENCE, not on whether that cwid happens to hold an identity
  // today. A `cornellEduCWID` is Cornell publishing "this person is also that WCM person", and
  // that is true whether or not inst-client has gotten around to them. Minting the netid in the
  // meantime seeds precisely the split we are trying to avoid: inst-client creates the cwid
  // identity on its own schedule, and the person then holds two. Either way the fix is the same
  // — a human decides which identifier owns the attribution — so both go to the same bucket.
  if (dir.wcmCwid) {
    const bridge = await existingIdentityUids([dir.wcmCwid]);
    skipped.bridged.push({
      cwid, rows: byCwid.get(cwid).length, name: dir.name, wcmCwid: dir.wcmCwid,
      wcmCwidHasIdentity: bridge.has(dir.wcmCwid),
    });
    continue;
  }
  const payload = directoryIdentityPayload(dir);
  if (!payload) {
    skipped.unusable.push({ cwid, rows: byCwid.get(cwid).length, name: dir.name }); continue;
  }
  plan.push({
    cwid, rows: byCwid.get(cwid).length, rowIds: byCwid.get(cwid),
    source: dir.source, name: dir.name, dept: dir.dept, title: dir.title, payload,
  });
}

// ---------------------------------------------------------------------------------- report

console.log(`\nlocal-only assign backlog, as of ${new Date().toISOString()}`);
console.log(`directories configured                        ${directoryConfigured()}`);
console.log(`rows still local-only                         ${live.length}`);
console.log(`distinct assignees                            ${cwids.length}`);
console.log(`  already have an identity (reconciler's)     ${skipped.already.length}`);
console.log(`  BRIDGED — needs re-pointing, not minting    ${skipped.bridged.length}`);
console.log(`  directory record unusable (no name)         ${skipped.unusable.length}`);
console.log(`  absent from both directories                ${skipped.absent.length}`);
console.log(`  MINTABLE                                    ${plan.length}`);
console.log(`ledger                                        ${LEDGER}`);

if (skipped.bridged.length) {
  console.log("\nbridged — a curator must re-point these rows; minting the netid would split the person:");
  for (const b of skipped.bridged) {
    console.log(`  ${b.cwid.padEnd(14)} ${b.name} → same person as ${b.wcmCwid}`
      + `${b.wcmCwidHasIdentity ? ", which already holds a ReCiter identity" : ", which has no identity yet either"}`
      + ` (${b.rows} row${b.rows === 1 ? "" : "s"})`);
  }
}
if (plan.length) {
  console.log("\nmintable:");
  for (const p of plan) {
    console.log(`  ${p.cwid.padEnd(14)} ${p.source.padEnd(8)} ${p.name}${p.dept ? ` · ${p.dept}` : ""} (${p.rows} row${p.rows === 1 ? "" : "s"})`);
  }
}
if (skipped.absent.length) {
  console.log(`\nabsent from both directories (left local-only): ${skipped.absent.map((s) => s.cwid).join(", ")}`);
}

const capped = LIMIT ? plan.slice(0, LIMIT) : plan;
if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ plan: capped, skipped }, null, 2));
  console.log(`\nplan written to ${JSON_OUT}`);
}

if (!EXECUTE) {
  console.log(`\ndry run — nothing written. Re-run with --execute to create ${capped.length} identit${capped.length === 1 ? "y" : "ies"}.`);
  console.log("Then run scripts/reconcile-local-only-assigns.mjs to promote the rows they unblock.\n");
  await conn.end();
  process.exit(0);
}

if (!RECITER_BASE || !RECITER_KEY) {
  console.error("RECITER_API_BASE_URL and RECITER_API_KEY must be set to --execute.");
  await conn.end();
  process.exit(1);
}

let created = 0, failed = 0;
for (const p of capped) {
  // Ledger BEFORE the attempt, so the record is complete even if the process dies mid-write.
  ledger({ phase: "write", cwid: p.cwid, source: p.source, name: p.name, rowIds: p.rowIds });
  const { status, body } = await mint(p.payload);
  ledger({ phase: "result", cwid: p.cwid, status, body });
  if (status === 200) {
    created++;
    console.log(`  created ${p.cwid} (${p.name})`);
    // Enrol for ongoing scoring, exactly as the live assign path does — otherwise the identity
    // is inert and /curate/<uid> stays empty forever. Ledgered separately so a failure here is
    // visible and re-runnable without re-minting. Same table ReCiterDB's nightly
    // executeFeatureGenerator.py reads; no unique constraint on it, hence the existence check.
    try {
      const [seen] = await conn.execute(
        "SELECT personIdentifier FROM reporting_ad_hoc_feature_generator_execution WHERE personIdentifier = ? LIMIT 1",
        [p.cwid]);
      if (!seen.length) {
        await conn.execute(
          "INSERT INTO reporting_ad_hoc_feature_generator_execution (personIdentifier, frequency, type) "
          + "VALUES (?, 'weekly', 'AuthorshipsDirectoryAssign')", [p.cwid]);
      }
      ledger({ phase: "enrol", cwid: p.cwid, alreadyEnrolled: seen.length > 0 });
    } catch (e) {
      ledger({ phase: "enrol", cwid: p.cwid, error: String(e) });
      console.log(`  WARN    ${p.cwid} minted but NOT enrolled for scoring: ${e}`);
    }
  } else { failed++; console.log(`  FAILED  ${p.cwid} -> ${status} ${body}`); }
}
console.log(`\ncreated ${created}, failed ${failed}.`);
console.log("Next: scripts/reconcile-local-only-assigns.mjs (dry run first) to promote the rows.\n");
await conn.end();
