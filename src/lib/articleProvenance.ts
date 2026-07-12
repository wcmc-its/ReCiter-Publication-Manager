// src/lib/articleProvenance.ts
//
// On-the-fly lookup of first-retrieval provenance from the ReCiter DynamoDB
// `ArticleProvenance` table, for the "date a publication was first retrieved"
// display on /curate (issue #737).
//
// ArticleProvenance has a composite key uid (HASH = personIdentifier/CWID) +
// articleId (RANGE = PMID as a String). frd = first retrieval date (epoch
// SECONDS, immutable), rs = retrieval strategy, src = source.
//
// We read on demand (BatchGetItem) for the publications on the page rather than
// materializing the ~11M-row table into MySQL nightly: the access pattern is a
// per-(person, article) point lookup, which is exactly this table's key.
//
// Auth: the DynamoDBClient uses the AWS SDK default credential provider chain —
// the pod's IRSA role in prod (service account `reciter-pm`), and local AWS
// env/SSO creds in dev. No static keys.

import { DynamoDBClient, BatchGetItemCommand } from '@aws-sdk/client-dynamodb'

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
const TABLE = 'ArticleProvenance'
const BATCH_SIZE = 100 // BatchGetItem hard limit per request

let client: DynamoDBClient | null = null
function getClient(): DynamoDBClient {
  if (!client) {
    client = new DynamoDBClient({ region: REGION })
  }
  return client
}

export interface ArticleProvenanceRecord {
  firstRetrievalDate: string | null // display date, e.g. "Jan 31, 2025" (UTC)
  firstRetrievalEpoch: number | null // raw epoch seconds
  retrievalStrategy: string | null
  source: string | null
}

function formatUtcDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Look up first-retrieval provenance for a set of (personIdentifier, pmid) pairs.
 * Returns a map keyed `${personIdentifier}:${pmid}`. Best-effort: any AWS error
 * propagates to the caller, which degrades gracefully (the field is absent).
 */
export async function getArticleProvenance(
  keys: { personIdentifier: string; pmid: number | string }[]
): Promise<Record<string, ArticleProvenanceRecord>> {
  const out: Record<string, ArticleProvenanceRecord> = {}
  if (!keys || keys.length === 0) return out

  // Dedupe to unique (uid, articleId) string pairs.
  const uniq = new Map<string, { uid: string; articleId: string }>()
  for (const k of keys) {
    if (!k || !k.personIdentifier || k.pmid === undefined || k.pmid === null) continue
    const articleId = String(k.pmid)
    if (!articleId) continue
    uniq.set(`${k.personIdentifier}:${articleId}`, { uid: k.personIdentifier, articleId })
  }
  const all = Array.from(uniq.values())
  if (all.length === 0) return out

  const ddb = getClient()
  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    let pending = all.slice(i, i + BATCH_SIZE)
    let attempt = 0
    while (pending.length > 0 && attempt < 4) {
      attempt++
      const Keys = pending.map((k) => ({ uid: { S: k.uid }, articleId: { S: k.articleId } }))
      const resp = await ddb.send(
        new BatchGetItemCommand({ RequestItems: { [TABLE]: { Keys } } })
      )
      const items: any[] = resp.Responses?.[TABLE] ?? []
      for (const it of items) {
        const uid: string | undefined = it.uid?.S
        const articleId: string | undefined = it.articleId?.S
        if (!uid || !articleId) continue
        const epoch = it.frd?.N ? Number(it.frd.N) : null
        const validEpoch = epoch !== null && Number.isFinite(epoch) ? epoch : null
        out[`${uid}:${articleId}`] = {
          firstRetrievalDate: validEpoch !== null ? formatUtcDate(validEpoch) : null,
          firstRetrievalEpoch: validEpoch,
          retrievalStrategy: it.rs?.S ?? null,
          source: it.src?.S ?? null,
        }
      }
      const unprocessed: any[] | undefined = resp.UnprocessedKeys?.[TABLE]?.Keys
      if (unprocessed && unprocessed.length > 0) {
        pending = unprocessed.map((k) => ({
          uid: (k.uid?.S as string) ?? '',
          articleId: (k.articleId?.S as string) ?? '',
        }))
        await new Promise((r) => setTimeout(r, 100 * attempt)) // backoff before retry
      } else {
        pending = []
      }
    }
  }
  return out
}

/**
 * Attach `firstRetrievalDate` (+ epoch/strategy/source) onto each article in a
 * ReCiter feature-generator response for ONE person. Mutates `data` in place.
 * Never throws — provenance is a non-critical display enrichment, so a DynamoDB
 * outage simply leaves the field absent and the page renders normally.
 */
export async function attachArticleProvenance(
  personIdentifier: string | undefined,
  data: any
): Promise<void> {
  try {
    if (!personIdentifier || !data || !Array.isArray(data.reCiterArticleFeatures)) return
    const keys = data.reCiterArticleFeatures
      .filter((a: any) => a && a.pmid !== undefined && a.pmid !== null)
      .map((a: any) => ({ personIdentifier, pmid: a.pmid }))
    if (keys.length === 0) return
    const map = await getArticleProvenance(keys)
    for (const a of data.reCiterArticleFeatures) {
      const rec = map[`${personIdentifier}:${a.pmid}`]
      if (rec) {
        a.firstRetrievalDate = rec.firstRetrievalDate
        a.firstRetrievalEpoch = rec.firstRetrievalEpoch
        a.retrievalStrategy = rec.retrievalStrategy
        a.retrievalSource = rec.source
      }
    }
  } catch (e) {
    console.log('ArticleProvenance lookup failed (non-fatal): ' + e)
  }
}
