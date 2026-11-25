/**
 * Repair personTypes on Identity records PM's directory mint wrote with the wrong vocabulary.
 *
 * Two defects shipped in #1001 and were found by inspecting what the 2026-09-08 local-only
 * backfill had actually written:
 *
 *   1. Cornell types kept the directory's spaces -- `cornell-former postdoc` where every other
 *      reader and writer uses `cornell-former-postdoc`.
 *   2. WCM types were prefixed -- `wcm-affiliate-cornell` where ED, and every live Identity
 *      record, uses `affiliate-cornell`.
 *
 * Neither breaks campus scoping (that keys on the `cornell-ithaca` marker and the `cornell-%`
 * SQL prefix, both unaffected), but both put a second spelling of one concept into DynamoDB.
 *
 * This re-projects each person straight from the live directory using the FIXED code in
 * src/lib/directory.ts, and rewrites personTypes only where it differs. Everything else on the
 * record is left exactly as it is.
 *
 * Run (DRY RUN, the default -- reads LDAP and DynamoDB, writes nothing):
 *   node --experimental-strip-types scripts/repair-directory-person-types.mjs
 * Execute:
 *   ... scripts/repair-directory-person-types.mjs --execute
 *
 * Needs the same env as mint-local-only-identities.mjs: RECITER_API_BASE_URL, RECITER_API_KEY,
 * and the four/six *_LDAP_* variables. --ledger <path> overrides the JSONL ledger, which
 * lives outside any git worktree for the same reason the mint script's does: a worktree can
 * be removed, and this is the only record of a value that was overwritten rather than created.
 *
 * A record is rewritten ONLY when the fresh projection is the repair of what is on it --
 * `wcm-` stripped, whitespace hyphenated, same set otherwise. Any other disagreement is
 * refused and logged, because it is not one of the two defects and this script has no
 * mandate to re-project somebody.
 *
 * ponytail: takes the uid list on the command line (default: the 19 known-affected records from
 * the 2026-09-08 backfill) rather than re-deriving who PM has ever minted. There is no marker on
 * an Identity saying "PM wrote this", and adding one to fix a one-off is worse than typing the
 * list. If this is ever needed at scale, the durable answer is that marker.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { lookupDirectoryPerson } from "../src/lib/directory.ts";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const uids = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--ledger");

// The 19 records the 2026-09-08 backfill wrote with the pre-fix vocabulary: 16 WCM carrying the
// `wcm-` prefix, 3 Cornell carrying a space. The other 48 were already correct.
const DEFAULT_UIDS = [
  "alc2033", "asi4013", "dcw2001", "evw4005", "ghb2002", "had4008", "ist4009", "jon7014",
  "lim4007", "mid9033", "rar9181", "sif4005", "tyc3001", "wexlerl", "xiz4005", "gor2002",
  "kjc39", "sm682", "wg254",
];

const LEDGER = (() => {
  const i = args.indexOf("--ledger");
  return i >= 0 && args[i + 1]
    ? args[i + 1]
    : "/Users/paulalbert/Dropbox/Projects/ReCiter Research/analysis/local_only_reconcile/repair-person-types.jsonl";
})();
const ledger = (rec) => {
  mkdirSync(dirname(LEDGER), { recursive: true });
  appendFileSync(LEDGER, `${JSON.stringify({ at: new Date().toISOString(), ...rec })}\n`);
};

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// The two defects this script exists to undo, and nothing else. `wcm-affiliate-cornell` ->
// `affiliate-cornell`; `cornell-former postdoc` -> `cornell-former-postdoc`.
const repaired = (t) => t.replace(/^wcm-/, "").replace(/\s+/g, "-");

/**
 * Is `after` the repair of `before`, or is it a different answer?
 *
 * Without this the script is an unconditional full replace of personTypes from a fresh
 * directory projection, and a projection that disagrees for any OTHER reason silently
 * destroys real data. Two real ways that happens: ED returns no type codes and
 * projectWcmPerson yields the placeholder ["wcm-directory"]; or a Cornell netid that
 * collides with a WCM uid re-projects as a WCM person and loses the `cornell-ithaca`
 * campus marker. Neither is a spelling defect, so neither is ours to write.
 *
 * ponytail: an exact set match on the repaired form, not a subset or a merge. If the
 * directory has genuinely gained or lost a type since the record was written, that is a
 * re-projection, and re-projection is mint-local-only-identities.mjs's job, not this
 * one-off's.
 */
const isPureSpellingRepair = (before, after) => {
  const want = [...new Set(before.map(repaired))].sort();
  return same(want, [...new Set(after)].sort());
};


if (args.includes("--selftest")) {
  const cases = [
    [["wcm-affiliate-cornell"], ["affiliate-cornell"], true, "wcm- prefix stripped"],
    [["cornell-former postdoc"], ["cornell-former-postdoc"], true, "space hyphenated"],
    [["cornell-ithaca", "cornell-former postdoc"], ["cornell-ithaca", "cornell-former-postdoc"], true,
     "the campus marker survives a repair"],
    [["cornell-ithaca", "cornell-faculty"], ["wcm-directory"], false,
     "ED returning no type codes yields the placeholder — refuse, do not overwrite"],
    [["cornell-ithaca", "cornell-faculty"], ["affiliate-cornell"], false,
     "a Cornell netid re-projected as WCM would lose the campus marker — refuse"],
    [["cornell-ithaca"], ["cornell-ithaca", "cornell-faculty"], false,
     "a type gained since the record was written is a re-projection, not a repair"],
  ];
  let bad = 0;
  for (const [before, after, want, name] of cases) {
    const got = isPureSpellingRepair(before, after);
    if (got !== want) { console.error(`FAIL ${name} (got ${got})`); bad++; }
  }
  console.log(bad ? `${bad} failed` : `${cases.length}/${cases.length} passed`);
  process.exit(bad ? 1 : 0);
}

const BASE = process.env.RECITER_API_BASE_URL;
const KEY = process.env.RECITER_API_KEY;
if (!BASE || !KEY) {
  console.error("RECITER_API_BASE_URL and RECITER_API_KEY must be set.");
  process.exit(1);
}

const api = async (path, init) => {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "api-key": KEY, ...(init?.headers || {}) },
  });
  return r;
};

const targets = uids.length ? uids : DEFAULT_UIDS;
console.log(`${EXECUTE ? "EXECUTE" : "DRY RUN"} — repairing personTypes on ${targets.length} record(s)\n`);

let changed = 0, ok = 0, missing = 0, failed = 0, refused = 0;

for (const uid of targets) {
  const res = await api(`/reciter/find/identity/by/uid?uid=${encodeURIComponent(uid)}`);
  if (res.status !== 200) { console.log(`  ${uid.padEnd(10)} SKIP — no identity (HTTP ${res.status})`); missing++; continue; }
  const identity = await res.json();
  const before = [...(identity.personTypes || [])];

  // Re-project from the LIVE directory through the fixed code. This is the whole point: the
  // repair must come from the same function that will write every future record, or it just
  // introduces a third spelling.
  const hit = await lookupDirectoryPerson(uid);
  if (!hit) { console.log(`  ${uid.padEnd(10)} SKIP — directory no longer returns them`); missing++; continue; }
  const after = hit.personTypes;

  if (same(before, after)) { console.log(`  ${uid.padEnd(10)} ok — already correct`); ok++; continue; }

  if (!isPureSpellingRepair(before, after)) {
    console.log(`  ${uid.padEnd(10)} SKIP — not a spelling repair, the directory disagrees`);
    console.log(`  ${"".padEnd(10)}    on record: ${JSON.stringify(before)}`);
    console.log(`  ${"".padEnd(10)}    directory: ${JSON.stringify(after)}`);
    ledger({ phase: "skip", uid, reason: "not-a-spelling-repair", before, after });
    refused++;
    continue;
  }

  console.log(`  ${uid.padEnd(10)} ${JSON.stringify(before)}`);
  console.log(`  ${"".padEnd(10)} -> ${JSON.stringify(after)}`);
  changed++;
  ledger({ phase: EXECUTE ? "write" : "would-write", uid, before, after });
  if (!EXECUTE) continue;

  // POST /reciter/identity/ upserts the whole item, so send the record back unchanged except
  // for personTypes. Anything dropped here is lost -- this is why we re-POST the fetched
  // identity rather than a freshly built one.
  const put = await api("/reciter/identity/", {
    method: "POST",
    body: JSON.stringify({ ...identity, personTypes: after }),
  });
  if (put.status !== 200) {
    const body = (await put.text()).slice(0, 160);
    console.log(`  ${"".padEnd(10)} FAILED HTTP ${put.status}: ${body}`);
    ledger({ phase: "result", uid, status: put.status, body });
    failed++;
  } else {
    console.log(`  ${"".padEnd(10)} repaired`);
    ledger({ phase: "result", uid, status: 200 });
  }
}

console.log(`\n${EXECUTE ? "repaired" : "would repair"} ${changed}; already correct ${ok}; skipped ${missing}; refused ${refused}; failed ${failed}.`);
console.log(`ledger ${LEDGER}`);
if (!EXECUTE && changed) console.log("Re-run with --execute to apply.");
