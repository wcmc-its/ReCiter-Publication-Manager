// src/lib/goldStandardRejections.ts
//
// On-the-fly lookup of GoldStandard.rejectedpmids from the ReCiter DynamoDB
// `GoldStandard` table, so the /authorships review queue can tell when a
// candidate identity has already rejected the exact PMID being reviewed
// (issue: a curator could otherwise accept/assign a paper to someone who
// explicitly said "not mine" via their own /curate page).
//
// GoldStandard has a single-attribute key uid (HASH = personIdentifier/CWID).
// rejectedpmids is a List of Number (List<N>).
//
// We read on demand (BatchGetItem) for the cwids on the page rather than
// materializing the table into MySQL: the access pattern is a per-cwid point
// lookup, which is exactly this table's key. Mirrors src/lib/articleProvenance.ts
// (same client setup, same batching-by-100 + UnprocessedKeys retry pattern, same
// "never throws, best-effort" philosophy) — see that file's header for the fuller
// rationale. Read-pattern ported from the Python reference in ReCiterDB's
// update/aar_orchestrator.py `_batch_gold_standard()` (table "GoldStandard",
// ProjectionExpression "uid, rejectedpmids", list-of-N encoding).
//
// Auth: the DynamoDBClient uses the AWS SDK default credential provider chain —
// the pod's IRSA role in prod (service account `reciter-pm`), and local AWS
// env/SSO creds in dev. No static keys.

import { DynamoDBClient, BatchGetItemCommand } from '@aws-sdk/client-dynamodb'

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
const TABLE = 'GoldStandard'
const BATCH_SIZE = 100 // BatchGetItem hard limit per request

let client: DynamoDBClient | null = null
function getClient(): DynamoDBClient {
  if (!client) {
    client = new DynamoDBClient({ region: REGION })
  }
  return client
}

/**
 * Look up rejectedpmids for a set of cwids (GoldStandard.uid). Returns a map
 * keyed by cwid -> Set of rejected PMIDs. A cwid with no GoldStandard record,
 * or an empty rejectedpmids list, is simply absent from the returned record —
 * callers should treat a missing key as "no rejections" rather than an error.
 * Never throws: any AWS error is swallowed and the affected cwids are left
 * absent, so a DynamoDB outage degrades to "no known rejections" instead of
 * failing the whole /authorships list or action.
 */
export async function getRejectedPmidsByCwid(
  cwids: string[]
): Promise<Record<string, Set<number>>> {
  const out: Record<string, Set<number>> = {}
  const uniq = [...new Set((cwids || []).filter(Boolean).map(String))]
  if (uniq.length === 0) return out

  try {
    const ddb = getClient()
    for (let i = 0; i < uniq.length; i += BATCH_SIZE) {
      let pending = uniq.slice(i, i + BATCH_SIZE)
      let attempt = 0
      while (pending.length > 0 && attempt < 4) {
        attempt++
        const Keys = pending.map((uid) => ({ uid: { S: uid } }))
        const resp = await ddb.send(
          new BatchGetItemCommand({
            RequestItems: {
              [TABLE]: { Keys, ProjectionExpression: 'uid, rejectedpmids' },
            },
          })
        )
        const items: any[] = resp.Responses?.[TABLE] ?? []
        for (const it of items) {
          const uid: string | undefined = it.uid?.S
          if (!uid) continue
          const list: any[] = it.rejectedpmids?.L ?? []
          const rejected = new Set<number>()
          for (const entry of list) {
            if (entry?.N !== undefined) {
              const n = Number(entry.N)
              if (Number.isFinite(n)) rejected.add(n)
            }
          }
          out[uid] = rejected
        }
        const unprocessed: any[] | undefined = resp.UnprocessedKeys?.[TABLE]?.Keys
        if (unprocessed && unprocessed.length > 0) {
          pending = unprocessed.map((k) => (k.uid?.S as string) ?? '').filter(Boolean)
          await new Promise((r) => setTimeout(r, 100 * attempt)) // backoff before retry
        } else {
          pending = []
        }
      }
    }
  } catch (e) {
    console.log('GoldStandard rejectedpmids lookup failed (non-fatal): ' + e)
  }
  return out
}
