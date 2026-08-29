#!/usr/bin/env node
/**
 * Guards the /authorships `identity_in_reciter` oracle.
 * Run: node scripts/check-authorships-identity-oracle.mjs
 *
 * Two asserts, no framework, no fixtures:
 *
 *  1. SOURCE — reciterIdentitySet() in controllers/db/authorships.controller.ts must ask
 *     DynamoDB `Identity`, and must NOT be back on the reciterdb `person` mirror or its
 *     null-name guard. That guard was wrong for 74 cwids / 254 open rows (a null name in
 *     `person` means ReCiterDB's second loader pass never covered the cwid, not that ReCiter
 *     has no identity), which is what made brf9046 show a false "No ReCiter identity" pill.
 *
 *  2. LIVE — the same BatchGetItem the controller runs must still separate cwids whose
 *     status was established by hand on 2026-08-29, and must still be BYTE-EXACT about case
 *     (the premise canonicalCwid rests on). Needs AWS credentials (pod IRSA in
 *     cluster, SSO/env locally); exits non-zero rather than passing silently without them,
 *     because a check that can green-light with no evidence is worse than no check.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { DynamoDBClient, BatchGetItemCommand } from '@aws-sdk/client-dynamodb'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PASS = '\x1b[32mPASS\x1b[0m'
const FAIL = '\x1b[31mFAIL\x1b[0m'
let failures = 0
const assert = (cond, label) => {
  console.log(`  ${cond ? PASS : FAIL} ${label}`)
  if (!cond) failures++
}

// 1. source
const src = readFileSync(join(ROOT, 'controllers/db/authorships.controller.ts'), 'utf8')
const fn = src.slice(src.indexOf('async function reciterIdentitySet'), src.indexOf('async function personNames'))
console.log('source: reciterIdentitySet asks DynamoDB Identity')
assert(fn.length > 100, 'reciterIdentitySet() found')
assert(/BatchGetItemCommand/.test(fn) && /Identity:/.test(fn), 'uses BatchGetItem on table Identity')
assert(!/models\.Person/.test(fn), 'does NOT read the reciterdb `person` mirror')
assert(!/firstName|lastName/.test(fn), 'does NOT re-introduce the null-name guard')
assert(!/catch/.test(fn), 'does not swallow AWS errors (must surface as a 500, never a false pill)')

// 2. live
// Present: reported bug (brf9046) + the two highest-volume cwids the `person` mirror missed.
// Absent: the departed cohort the guard was originally written for.
const PRESENT = ['brf9046', 'ack7001', 'stetson', 'aaa2014']
const ABSENT = ['lbm2001', 'maf2086', 'kmf2001']
// Byte-exactness is the premise canonicalCwid rests on (src/lib/assignGate.ts): a curator who
// capitalises a perfectly real cwid MUST miss here, which is why the assign path asks for the
// typed form and its lowercase together. If DynamoDB ever became case-folding this assert
// fails and that canonicalization can be deleted.
const MISCASED = ['Aaa2014', 'Brf9046']
console.log('live: DynamoDB Identity presence')
try {
  const ddb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
  const resp = await ddb.send(new BatchGetItemCommand({
    RequestItems: { Identity: { Keys: [...PRESENT, ...ABSENT, ...MISCASED].map((uid) => ({ uid: { S: uid } })), ProjectionExpression: 'uid' } },
  }))
  assert(!resp.UnprocessedKeys?.Identity?.Keys?.length, 'no unprocessed keys')
  const found = new Set((resp.Responses?.Identity ?? []).map((i) => i.uid?.S))
  PRESENT.forEach((u) => assert(found.has(u), `${u} present (Accept must be offered)`))
  ABSENT.forEach((u) => assert(!found.has(u), `${u} absent (Accept must stay hidden)`))
  MISCASED.forEach((u) => assert(!found.has(u) && found.has(u.toLowerCase()),
    `${u} misses byte-exact while ${u.toLowerCase()} hits (assign must canonicalize)`))
} catch (e) {
  console.log(`  ${FAIL} DynamoDB lookup failed: ${e}`)
  failures++
}

console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed')
process.exit(failures ? 1 : 0)
