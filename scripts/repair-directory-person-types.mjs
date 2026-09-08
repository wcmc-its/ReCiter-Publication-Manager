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
 * and the four/six *_LDAP_* variables.
 *
 * ponytail: takes the uid list on the command line (default: the 19 known-affected records from
 * the 2026-09-08 backfill) rather than re-deriving who PM has ever minted. There is no marker on
 * an Identity saying "PM wrote this", and adding one to fix a one-off is worse than typing the
 * list. If this is ever needed at scale, the durable answer is that marker.
 */
import { lookupDirectoryPerson } from "../src/lib/directory.ts";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const uids = args.filter((a) => !a.startsWith("--"));

// The 19 records the 2026-09-08 backfill wrote with the pre-fix vocabulary: 16 WCM carrying the
// `wcm-` prefix, 3 Cornell carrying a space. The other 48 were already correct.
const DEFAULT_UIDS = [
  "alc2033", "asi4013", "dcw2001", "evw4005", "ghb2002", "had4008", "ist4009", "jon7014",
  "lim4007", "mid9033", "rar9181", "sif4005", "tyc3001", "wexlerl", "xiz4005", "gor2002",
  "kjc39", "sm682", "wg254",
];

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

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

const targets = uids.length ? uids : DEFAULT_UIDS;
console.log(`${EXECUTE ? "EXECUTE" : "DRY RUN"} — repairing personTypes on ${targets.length} record(s)\n`);

let changed = 0, ok = 0, missing = 0, failed = 0;

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

  console.log(`  ${uid.padEnd(10)} ${JSON.stringify(before)}`);
  console.log(`  ${"".padEnd(10)} -> ${JSON.stringify(after)}`);
  changed++;
  if (!EXECUTE) continue;

  // POST /reciter/identity/ upserts the whole item, so send the record back unchanged except
  // for personTypes. Anything dropped here is lost -- this is why we re-POST the fetched
  // identity rather than a freshly built one.
  const put = await api("/reciter/identity/", {
    method: "POST",
    body: JSON.stringify({ ...identity, personTypes: after }),
  });
  if (put.status !== 200) { console.log(`  ${"".padEnd(10)} FAILED HTTP ${put.status}: ${(await put.text()).slice(0, 160)}`); failed++; }
  else console.log(`  ${"".padEnd(10)} repaired`);
}

console.log(`\n${EXECUTE ? "repaired" : "would repair"} ${changed}; already correct ${ok}; skipped ${missing}; failed ${failed}.`);
if (!EXECUTE && changed) console.log("Re-run with --execute to apply.");
