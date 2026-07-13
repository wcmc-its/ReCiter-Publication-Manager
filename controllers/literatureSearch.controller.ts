// Literature Search — Mode 1 ("Search strategy").
//
// The deliverable is the SEARCH STRATEGY, not records. For a systematic review the
// strategy is the librarian's intellectual output: PRESS-peer-reviewed, published as
// the PRISMA-S appendix, and the thing that makes the review reproducible. Records,
// screening, and synthesis belong to Covidence/Rayyan. We hand off; we do not compete.
//
// Consequences, all of which make this file small:
//   - We never retrieve a record here, only COUNT. So this calls
//     /pubmed/query-number-pubmed-articles/ and never /pubmed/query-complex/.
//     It therefore scales to a 15,000-hit strategy for free, needs no streaming, and
//     sidesteps the 100-slice in pubmed.controller.ts entirely.
//   - There is no result cap. An SR search is DESIGNED to over-retrieve.
//
// Counts are exactly reproducible against the PubMed web UI. Verified 2026-07-12:
// a fully-tagged strategy returned 2,302 both ways, and 122 both ways with an RCT
// filter. PubMed's automatic term mapping only rewrites UNTAGGED terms, and the
// strategies we emit are fully tagged by construction.

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { reciterConfig } from '../config/local'

export type Concept = {
    label: string   // e.g. "Probiotics / microbiome"
    terms: string   // e.g. ("Probiotics"[MeSH] OR probiotic*[tiab])
}

export type Strategy = {
    db: 'pubmed'
    concepts: Concept[]
    limits: string  // e.g. (2021:2026[dp]) AND (Randomized Controlled Trial[pt]) — may be ''
}

export type SeedResult = {
    pmid: string
    retrieved: boolean
    // On a miss: the concept labels the seed fails. DERIVED by re-counting the seed
    // against each concept, never guessed by the model — a hallucinated reason for a
    // miss would be worse than no reason at all.
    failingConcepts?: string[]
    failsLimitsOnly?: boolean
}

// Assemble the numbered concept blocks into the Boolean the librarian copies out.
export function assembleQuery(s: Strategy): string {
    const body = s.concepts.map(c => `(${c.terms})`).join(' AND ')
    return s.limits ? `${body} AND ${s.limits}` : body
}

// The one PubMed call this mode makes. Bare POST to the Retrieval Tool, which owns the
// PUBMED_API_KEY and the backoff (PRs #796-800) — modelled on pubmedLookup.controller.ts.
export async function countPubmed(query: string): Promise<number> {
    const res = await fetch(reciterConfig.reciterPubmed.searchPubmedCountEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'reciter-pub-manager-server',
        },
        body: JSON.stringify({ 'strategy-query': query }),
    })
    if (!res.ok) throw new Error(`pubmed retrieval tool HTTP ${res.status}`)
    const body = await res.text()
    // The tool returns a bare integer for this route. Guard anyway: a non-numeric body
    // means the tool changed shape, and silently coercing it to 0 would read as
    // "your strategy found nothing" — the most dangerous possible lie in this feature.
    const n = Number(body.trim())
    if (!Number.isFinite(n)) throw new Error(`unexpected count payload: ${body.slice(0, 80)}`)
    return n
}

// Known-item validation. The librarian names papers the search MUST retrieve; a strategy
// that misses a known include is broken and has to be widened. This is what makes an
// LLM-drafted Boolean defensible rather than merely plausible.
//
// `<pmid>[uid] AND (strategy)` -> expect 1. Verified against live PubMed 2026-07-12:
// [uid] is the correct tag (PubMed normalizes [pmid] -> [UID]).
//
// Costs one count call per seed, and never downloads a record — so validating against a
// 15,000-hit strategy costs the same as against a 12-hit one.
export async function validateSeeds(s: Strategy, pmids: string[]): Promise<SeedResult[]> {
    const query = assembleQuery(s)
    const out: SeedResult[] = []

    for (const raw of pmids) {
        const pmid = raw.trim()
        if (!/^\d+$/.test(pmid)) continue

        const hit = await countPubmed(`${pmid}[uid] AND (${query})`)
        if (hit === 1) {
            out.push({ pmid, retrieved: true })
            continue
        }

        // MISS. Work out WHICH concept block excluded it by re-counting the seed against
        // each block on its own. Deterministic: the blocks that return 0 are the culprits.
        // If every block passes, the limits (date / publication type) are what excluded it.
        const failing: string[] = []
        for (const c of s.concepts) {
            const inBlock = await countPubmed(`${pmid}[uid] AND (${c.terms})`)
            if (inBlock === 0) failing.push(c.label)
        }
        out.push({
            pmid,
            retrieved: false,
            failingConcepts: failing,
            failsLimitsOnly: failing.length === 0,
        })
    }
    return out
}

// What Mode 1 hands back. Note the array — a second database is an extra element, not a
// reshape (see the multi-database seams in the spec). PubMed-only in phase 1.
export type StrategyResult = {
    db: string
    concepts: Concept[]
    limits: string
    query: string
    hits: number
    runDate: string
    seeds: SeedResult[]
}

export async function runStrategy(s: Strategy, seedPmids: string[]): Promise<StrategyResult> {
    const query = assembleQuery(s)
    const hits = await countPubmed(query)
    const seeds = await validateSeeds(s, seedPmids)
    return {
        db: s.db,
        concepts: s.concepts,
        limits: s.limits,
        query,
        hits,
        runDate: new Date().toISOString().slice(0, 10),
        seeds,
    }
}

// ---------------------------------------------------------------------------
// The LLM call — the repo's first.
//
// ponytail: InvokeModel, not ConverseCommand. Bedrock's InvokeModel passes the native
// Anthropic Messages body straight through, so SYSTEM_PROMPT, STRATEGY_TOOL and the forced
// tool_choice below survive VERBATIM and the response parse is unchanged. Converse would
// force all three to be rewritten into toolConfig/toolSpec/inputSchema.json and re-key usage
// as inputTokens/outputTokens — churn for zero gain on one non-streaming call.
//
// No API key anywhere: credentials come from the default AWS chain (SSO/profile locally,
// IRSA on EKS), per the standing rule against hardcoded keys. modelId is a COMMAND
// PARAMETER, never a body field — putting it in the body is the classic porting mistake.

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' })

export function bedrockConfigured(): boolean {
    return !!process.env.BEDROCK_MODEL_ID
}

// Mode 1's retrieval objective is RECALL, and that is the opposite of what a model will
// do unprompted. Left alone it writes a tight, precise query — exactly wrong for an SR,
// where a 5,000-hit yield is a success and a missed study is the cardinal sin.
//
// The "fully tagged" rule is load-bearing, not stylistic: PubMed's automatic term mapping
// silently rewrites UNTAGGED terms, so an untagged query returns a count the librarian
// cannot reproduce. Tagged strategies passed through verbatim in live testing and matched
// the PubMed web UI exactly. Reproducibility is Mode 1's entire promise; it lives here.
const SYSTEM_PROMPT = `You are a medical reference librarian drafting a database search strategy for a systematic review.

Your objective is RECALL (sensitivity), not precision. This is the opposite of a normal search:
- A yield in the thousands is SUCCESS, not a problem. Do not try to keep the result set small.
- Missing a relevant study is the cardinal sin. Retrieving irrelevant ones is fine — a human screens them later.
- For each concept, OR together the exploded MeSH descriptors AND generous free-text synonyms, spelling variants, and truncations.

Every term MUST carry an explicit PubMed field tag — [MeSH], [tiab], [dp], [pt]. Never emit a bare untagged word: PubMed's automatic term mapping rewrites untagged terms, which makes the hit count irreproducible, and reproducibility is the whole point of this deliverable.

Structure the search as separate CONCEPT BLOCKS, one per idea in the question (typically 2-4). They will be AND-ed together. Put date and publication-type restrictions in "limits", never inside a concept block.

Do not use relevance ranking, sort orders, or result caps. Return the strategy only.`

// Force the shape with a tool rather than parsing prose. The model must call this.
const STRATEGY_TOOL = {
    name: 'submit_strategy',
    description: 'Return the finished PubMed search strategy as numbered concept blocks.',
    input_schema: {
        type: 'object' as const,
        properties: {
            concepts: {
                type: 'array',
                description: 'One entry per concept in the question. AND-ed together.',
                items: {
                    type: 'object',
                    properties: {
                        label: { type: 'string', description: 'Short human name, e.g. "Probiotics / microbiome"' },
                        terms: { type: 'string', description: 'The OR-ed, fully tagged terms for this concept. No surrounding parentheses.' },
                    },
                    required: ['label', 'terms'],
                },
            },
            limits: {
                type: 'string',
                description: 'Date and publication-type limits, fully tagged, e.g. "(2021:2026[dp]) AND (Randomized Controlled Trial[pt])". Empty string if none.',
            },
        },
        required: ['concepts', 'limits'],
    },
}

export type UsageLog = { inputTokens: number; outputTokens: number }

export async function buildStrategy(
    question: string,
    criteria?: string,
    filters?: string,
): Promise<{ strategy: Strategy; usage: UsageLog }> {
    const modelId = process.env.BEDROCK_MODEL_ID
    if (!modelId) throw new Error('BEDROCK_MODEL_ID is not configured')

    const parts = [`Research question: ${question}`]
    if (criteria) parts.push(`Inclusion/exclusion criteria: ${criteria}`)
    if (filters) parts.push(`Requested limits: ${filters}`)

    const res = await bedrock.send(new InvokeModelCommand({
        modelId,                                    // command parameter, NOT a body field
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',    // replaces `model` + the version header
            max_tokens: 2000,
            system: SYSTEM_PROMPT,                      // verbatim: the field-tag rule is load-bearing
            tools: [STRATEGY_TOOL],
            tool_choice: { type: 'tool', name: 'submit_strategy' },
            messages: [{ role: 'user', content: parts.join('\n\n') }],
        }),
    }))

    // The SDK throws on non-2xx (ValidationException / AccessDeniedException / Throttling),
    // so there is no !res.ok branch to keep; search.ts's try/catch turns a throw into a 502.
    const data: any = JSON.parse(new TextDecoder().decode(res.body))
    const block = (data.content || []).find((c: any) => c.type === 'tool_use')
    if (!block?.input?.concepts?.length) {
        throw new Error('model did not return a strategy')
    }

    return {
        strategy: {
            db: 'pubmed',
            concepts: block.input.concepts,
            limits: block.input.limits || '',
        },
        usage: {
            inputTokens: data.usage?.input_tokens ?? 0,
            outputTokens: data.usage?.output_tokens ?? 0,
        },
    }
}
