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
//     (The ONE exception is seedLabels() below, and it is bounded to the 3-5 seeds.)
//   - There is no result cap. An SR search is DESIGNED to over-retrieve.
//
// THE MODEL IS CALLED ONCE, AT THE START. buildStrategy() is the only inference in the
// feature. Everything after it — runStrategy, the counts, the seed validation, the
// re-count after a librarian toggles a line — is arithmetic over PubMed counts. So the
// librarian can iterate the strategy all afternoon for the price of a few esearch calls.
// Keep it that way: the moment a toggle needs the model, iteration stops being free.
//
// Counts are exactly reproducible against the PubMed web UI. Verified 2026-07-12:
// a fully-tagged strategy returned 2,302 both ways, and 122 both ways with an RCT
// filter. PubMed's automatic term mapping only rewrites UNTAGGED terms, and the
// strategies we emit are fully tagged by construction.

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { reciterConfig } from '../config/local'
import {
    Line,
    Concept,
    Strategy,
    assembleQuery,
    conceptQuery,
    numberStrategy,
} from './literatureSearch.strategy'

// Re-exported so the check script and the API route have one import site.
export { assembleQuery, conceptQuery, numberStrategy }
export type { Line, Concept, Strategy }

export type SeedResult = {
    pmid: string
    label?: string                  // "Nikolova (2023)" — see seedRecords()
    retrieved: boolean
    // On a miss: WHY, derived by re-counting the seed against each part of the strategy on its
    // own. Never guessed by the model — a hallucinated reason for a miss would be worse than no
    // reason at all.
    //
    // The two are INDEPENDENT, and reporting only one of them was a real bug: a paper can fail a
    // concept block AND the limits at once. Sarkar 2016 does exactly that — widen the Depression
    // block and it still never returns, because it is a 2016 review and the limits ask for
    // 2021-2026 RCTs. Saying only "widen the Depression block" sends the librarian to buy 531
    // extra records for a paper that cannot come back.
    failingConcepts?: number[]      // indices; the client holds the concepts and points at them
    failsLimits?: boolean
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

        // Everything unticked: there is no strategy to validate against, and
        // `<pmid>[uid] AND ()` is not a query. Say so rather than counting nothing.
        if (!query) {
            out.push({ pmid, retrieved: false, failingConcepts: [], failsLimits: false })
            continue
        }

        const hit = await countPubmed(`${pmid}[uid] AND (${query})`)
        if (hit === 1) {
            out.push({ pmid, retrieved: true })
            continue
        }

        // MISS. Work out WHAT excluded it by re-counting the seed against each part of the
        // strategy on its own. Deterministic: the parts that return 0 are the culprits, and a
        // seed can fail several of them at once.
        const failing: number[] = []
        for (let i = 0; i < s.concepts.length; i++) {
            const block = conceptQuery(s.concepts[i])
            if (!block) continue          // an unticked concept is not in the AND, so it excludes nothing
            const inBlock = await countPubmed(`${pmid}[uid] AND (${block})`)
            if (inBlock === 0) failing.push(i)
        }
        // The limits are checked SEPARATELY, not inferred from "no block failed". A paper can
        // fail a block and the limits together, and only naming the block would send the
        // librarian off to widen a search that still cannot return it.
        const failsLimits = s.limits
            ? (await countPubmed(`${pmid}[uid] AND ${s.limits}`)) === 0
            : false

        out.push({ pmid, retrieved: false, failingConcepts: failing, failsLimits })
    }
    return out
}

// What Mode 1 hands back. Note the array — a second database is an extra element, not a
// reshape (see the multi-database seams in the spec). PubMed-only in phase 1.
//
// `concepts` is the CURRENT SELECTION, and it is the object the client posts back to
// re-count after a toggle. The hit count, the seed verdicts, the displayed line numbers and
// the exported PRISMA-S block all derive from this one object — which is the whole reason
// the toggles are safe. A librarian who unticks two bundles and then copies a methods block
// describing the un-toggled query would have broken the single thing this feature is for.
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
    // Everything unticked. Don't ask PubMed to count the empty string — it is not a "0 hits"
    // result, it is "you have no strategy", and conflating the two is how a librarian ends up
    // trusting a count that describes nothing.
    const hits = query ? await countPubmed(query) : 0
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
// Seed records — the ONE place Mode 1 fetches records instead of counting.
//
// A deliberate exception, not an accident, and it earns its keep twice:
//
//   1. It names the paper. "Nikolova (2023)" instead of a naked 8-digit number — a librarian
//      who listed four seeds cannot otherwise tell WHICH one missed, and the miss is the most
//      valuable thing on the screen.
//   2. IT IS WHAT MAKES THE SUGGESTED FIX POSSIBLE. The model cannot propose terms that would
//      retrieve a paper it has never seen. Asked to widen a block for a bare PMID it guesses,
//      and it guesses badly — in a live run it proposed "Bipolar Disorder"[MeSH] to fix a
//      DEPRESSION miss. Handed the paper's title and MeSH descriptors (Sarkar 2016 is indexed
//      under *Emotions*, not *Depression*) it can see the actual gap. Never ask it blind.
//
// Bounded to the seeds (3-5 of them) and done in a SINGLE call, so it cannot grow with the
// yield. Never fatal: a missing record costs us the label and the fix, not the strategy.
export type SeedRecord = { label: string; title: string; mesh: string[] }

export async function seedRecords(pmids: string[]): Promise<Record<string, SeedRecord>> {
    const ids = pmids.filter(p => /^\d+$/.test(p))
    if (!ids.length) return {}

    try {
        const res = await fetch(reciterConfig.reciterPubmed.searchPubmedEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'reciter-pub-manager-server' },
            body: JSON.stringify({ 'strategy-query': ids.map(p => `${p}[uid]`).join(' OR ') }),
        })
        if (!res.ok) throw new Error(`pubmed retrieval tool HTTP ${res.status}`)
        const data: any = await res.json()

        const out: Record<string, SeedRecord> = {}
        for (const a of Array.isArray(data) ? data : []) {
            const cit = a?.medlinecitation
            const pmid = cit?.medlinecitationpmid?.pmid
            if (!pmid) continue
            const first = cit?.article?.authorlist?.[0]?.lastname
            const year = cit?.article?.journal?.journalissue?.pubdate?.year
            out[String(pmid)] = {
                label: first ? (year ? `${first} (${year})` : String(first)) : `PMID ${pmid}`,
                title: String(cit?.article?.articletitle || ''),
                mesh: (cit?.meshheadinglist || [])
                    .map((m: any) => m?.descriptorname?.descriptorname)
                    .filter(Boolean),
            }
        }
        return out
    } catch (e) {
        // Loud, not silent. Without records the seeds show as bare PMIDs and no fix is proposed
        // — the page still works, but it is quietly worth less, and a silent degradation is how
        // that goes unnoticed for a year.
        console.error('[literature] seed records failed:', e)
        return {}
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

async function invoke(system: string, tool: any, user: string) {
    const modelId = process.env.BEDROCK_MODEL_ID
    if (!modelId) throw new Error('BEDROCK_MODEL_ID is not configured')

    const res = await bedrock.send(new InvokeModelCommand({
        modelId,                                    // command parameter, NOT a body field
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',    // replaces `model` + the version header
            max_tokens: 2000,
            system,
            tools: [tool],
            tool_choice: { type: 'tool', name: tool.name },
            messages: [{ role: 'user', content: user }],
        }),
    }))

    // The SDK throws on non-2xx (ValidationException / AccessDeniedException / Throttling),
    // so there is no !res.ok branch to keep; search.ts's try/catch turns a throw into a 502.
    const data: any = JSON.parse(new TextDecoder().decode(res.body))
    const block = (data.content || []).find((c: any) => c.type === 'tool_use')
    return {
        input: block?.input,
        usage: {
            inputTokens: data.usage?.input_tokens ?? 0,
            outputTokens: data.usage?.output_tokens ?? 0,
        },
    }
}

// Mode 1's retrieval objective is RECALL, and that is the opposite of what a model will
// do unprompted. Left alone it writes a tight, precise query — exactly wrong for an SR,
// where a 5,000-hit yield is a success and a missed study is the cardinal sin.
//
// The "fully tagged" rule is load-bearing, not stylistic: PubMed's automatic term mapping
// silently rewrites UNTAGGED terms, so an untagged query returns a count the librarian
// cannot reproduce. Tagged strategies passed through verbatim in live testing and matched
// the PubMed web UI exactly. Reproducibility is Mode 1's entire promise; it lives here.
//
// SEPARATE LINES PER CONCEPT is the other load-bearing rule. A published strategy is
// peer-reviewed line by line (PRESS), and a line is also what a checkbox sits on: merging
// MeSH and free-text into one string would mean a librarian could only take a whole concept
// or leave it, which is exactly the all-or-nothing choice this design removes.
const SYSTEM_PROMPT = `You are a medical reference librarian drafting a database search strategy for a systematic review.

Your objective is RECALL (sensitivity), not precision. This is the opposite of a normal search:
- A yield in the thousands is SUCCESS, not a problem. Do not try to keep the result set small.
- Missing a relevant study is the cardinal sin. Retrieving irrelevant ones is fine — a human screens them later.

Structure the search as CONCEPT BLOCKS, one per idea in the question (typically 2-4). They will be AND-ed together.

Write each concept block as SEPARATE LINES, the way a published PRESS-reviewed strategy is written:
- one line for the exploded MeSH descriptors, OR-ed together;
- one line for the free-text synonyms, spelling variants and truncations, tagged [tiab] and OR-ed together.
Be generous within each line. Do NOT merge MeSH and free-text into a single line. If a concept has no suitable MeSH descriptor, emit the free-text line alone. The lines within a block are OR-ed and given line numbers; the blocks are then AND-ed.

Every term MUST carry an explicit PubMed field tag — [MeSH], [tiab]. Never emit a bare untagged word: PubMed's automatic term mapping rewrites untagged terms, which makes the hit count irreproducible, and reproducibility is the whole point of this deliverable.

Date and publication-type limits are supplied by the caller and applied separately. NEVER put a date, a publication type, a language, or an age group inside a concept block.

Do not use relevance ranking, sort orders, or result caps. Return the strategy only.`

// Force the shape with a tool rather than parsing prose. The model must call this.
//
// Note what is NOT here any more: `limits`. The caller supplies them (see LIMITS in the API
// route), so the model no longer gets to decide what "2021-2026" means. That decision was
// quietly undermining reproducibility — the whole promise of the mode — for zero benefit.
const STRATEGY_TOOL = {
    name: 'submit_strategy',
    description: 'Return the finished PubMed search strategy as PRESS-numbered concept blocks.',
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
                        lines: {
                            type: 'array',
                            description: 'The atomic term lines of this block, OR-ed together. Typically two: the MeSH line, then the [tiab] free-text line. Fully tagged. No surrounding parentheses.',
                            items: { type: 'string' },
                        },
                    },
                    required: ['label', 'lines'],
                },
            },
        },
        required: ['concepts'],
    },
}

export type UsageLog = { inputTokens: number; outputTokens: number }

export async function buildStrategy(
    question: string,
    limits: string,
    criteria?: string,
): Promise<{ strategy: Strategy; usage: UsageLog }> {
    const parts = [`Research question: ${question}`]
    if (criteria) parts.push(`Inclusion/exclusion criteria: ${criteria}`)
    parts.push(limits
        ? `Limits already applied by the caller (do NOT repeat these inside a concept block): ${limits}`
        : `No limits will be applied.`)

    const { input, usage } = await invoke(SYSTEM_PROMPT, STRATEGY_TOOL, parts.join('\n\n'))
    if (!input?.concepts?.length) throw new Error('model did not return a strategy')

    return {
        strategy: {
            db: 'pubmed',
            concepts: input.concepts.map((c: any) => ({
                label: String(c.label || ''),
                // Every line the model writes arrives TICKED. Untick is the librarian's move.
                lines: (Array.isArray(c.lines) ? c.lines : [c.lines])
                    .filter((t: any) => typeof t === 'string' && t.trim())
                    .map((t: string) => ({ terms: t.trim(), on: true })),
            })).filter((c: Concept) => c.lines.length),
            limits,
        },
        usage,
    }
}

// ---------------------------------------------------------------------------
// The suggested widening — the prescription and its price.
//
// Diagnosing a miss ("the Depression block excludes it") without saying what to DO about it
// hands the librarian a problem and no lever. So for each missed seed we ask the model for the
// terms that would retrieve it, and then we do two things it cannot do for itself:
//
//   1. VERIFY it. Count `<pmid>[uid] AND (proposed terms)`. If it is not 1, the proposal does
//      not actually retrieve the seed and we DROP IT. An unverified fix is a hallucination with
//      a checkbox on it.
//   2. PRICE it. Count the strategy with that one line ticked. The delta is what widening costs
//      in records to screen — and that trade ("+426 records buys you this missing paper") is the
//      actual judgment the librarian is here to make.
//
// The result is a pre-made line sitting UNCHECKED in the block it belongs to. That is what makes
// the model's advice auditable: a line you can read, price, and reject — not a paragraph.
const FIX_TOOL = {
    name: 'suggest_widening',
    description: 'Propose the terms to ADD to a concept block so that a specific missed paper is retrieved.',
    input_schema: {
        type: 'object' as const,
        properties: {
            fixes: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        conceptIndex: { type: 'number', description: 'Index of the concept block to widen.' },
                        terms: { type: 'string', description: 'A single new OR-ed, fully tagged line to add to that block, e.g. "Emotions"[MeSH] OR mood[tiab]. Terms only — no parentheses, no AND.' },
                    },
                    required: ['conceptIndex', 'terms'],
                },
            },
        },
        required: ['fixes'],
    },
}

const FIX_PROMPT = `You are a medical reference librarian debugging a systematic-review search strategy.

A paper the search MUST retrieve was missed. You are given the paper (title and the MeSH descriptors PubMed actually indexed it under) and the concept block that excluded it. Propose ONE new term line to add to that block that would retrieve it.

Compare the paper's ACTUAL MeSH descriptors against the block's terms — the gap is usually right there. A paper about low mood may be indexed under "Emotions" rather than "Depression", in which case the block needs "Emotions"[MeSH]. Cover the gap generously: also add the free-text words the abstract would plausibly use.

Every term MUST carry an explicit PubMed field tag — [MeSH] or [tiab]. Propose terms, never a whole query: no parentheses, no AND, no limits. Widen only the block you are told excluded the paper. Return one fix per block named.`

// Returns the strategy with the (verified, priced) suggested lines appended, unticked.
export async function suggestFixes(
    s: Strategy,
    result: StrategyResult,
    records: Record<string, SeedRecord>,
): Promise<{ strategy: Strategy; usage: UsageLog }> {
    const usage: UsageLog = { inputTokens: 0, outputTokens: 0 }
    // Only a CONCEPT miss has a fix of this shape. A limits-only miss is fixed by changing the
    // dropdowns, which the seed panel already says — a term line cannot help.
    //
    // And only a miss whose RECORD we actually have. Without the title and the MeSH descriptors
    // the model is guessing at a paper it cannot see, and it guesses badly (see seedRecords).
    // Proposing nothing is strictly better than proposing a plausible wrong answer with a
    // checkbox on it.
    const misses = result.seeds.filter(x => !x.retrieved && x.failingConcepts?.length && records[x.pmid])
    if (!misses.length) return { strategy: s, usage }

    let out = s
    for (const miss of misses) {
        const rec = records[miss.pmid]
        const blocks = miss.failingConcepts!
            .map(i => `Block ${i} ("${s.concepts[i].label}"):\n${s.concepts[i].lines.filter(l => l.on).map(l => l.terms).join('\n')}`)
            .join('\n\n')

        const { input, usage: u } = await invoke(FIX_PROMPT, FIX_TOOL,
            `Missed paper: PMID ${miss.pmid} — ${rec.label}\n`
            + `Title: ${rec.title}\n`
            + `Indexed in PubMed under these MeSH descriptors: ${rec.mesh.join(', ') || '(none)'}\n\n`
            + `It was excluded by the following block(s), which it does not match:\n\n${blocks}`)
        usage.inputTokens += u.inputTokens
        usage.outputTokens += u.outputTokens

        for (const fix of (input?.fixes || [])) {
            const ci = Number(fix?.conceptIndex)
            const terms = String(fix?.terms || '').trim()
            if (!terms || !Number.isInteger(ci) || !out.concepts[ci]) continue
            if (!miss.failingConcepts!.includes(ci)) continue    // stay inside the block we asked about

            const line: Line = { terms, on: false, suggestedFor: miss.pmid }
            const withLine: Strategy = {
                ...out,
                concepts: out.concepts.map((c, i) =>
                    i === ci ? { ...c, lines: [...c.lines, { ...line, on: true }] } : c),
            }

            // 1. VERIFY AGAINST THE WHOLE STRATEGY, LIMITS AND ALL — because "tick this and the
            //    paper comes back" is the claim the checkbox makes, so that is the claim that has
            //    to be true. Verifying the term line ALONE (`pmid AND (terms)`) is not enough and
            //    was a real bug: the Emotions line does make Sarkar 2016 clear the Depression
            //    block, so it passed — but Sarkar is a 2016 review and the limits ask for
            //    2021-2026 RCTs, so ticking it bought 531 extra records to screen and STILL did
            //    not retrieve the paper. A widening that cannot deliver is worse than no advice:
            //    it is a false promise with a price tag. If the seed does not come back, the
            //    limits (or another block) are the real problem, and the seed panel says so.
            const retrieves = await countPubmed(`${miss.pmid}[uid] AND (${assembleQuery(withLine)})`)
            if (retrieves !== 1) {
                // Say so out loud. A proposal that vanishes without a trace is how a feature
                // quietly stops working — the page would show a miss with no fix and look fine.
                console.log(JSON.stringify({
                    tag: 'literature-fix-rejected', pmid: miss.pmid, conceptIndex: ci, terms, retrieves,
                    why: 'ticking this line would not actually retrieve the seed',
                }))
                continue
            }

            // 2. PRICE: what does ticking this ONE line cost? Per-line on purpose — it is exactly
            //    what the checkbox next to it does, so the number is the honest price of that
            //    click.
            line.costRecords = await countPubmed(assembleQuery(withLine)) - result.hits

            out = {
                ...out,
                concepts: out.concepts.map((c, i) => i === ci ? { ...c, lines: [...c.lines, line] } : c),
            }
            console.log(JSON.stringify({
                tag: 'literature-fix', pmid: miss.pmid, conceptIndex: ci, terms, costRecords: line.costRecords,
            }))
        }
    }

    return { strategy: out, usage }
}
