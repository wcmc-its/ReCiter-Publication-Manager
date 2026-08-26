// Literature Analyzer, Step 1 ("Synopsize") — one short, plain-language synopsis per record.
//
// THIS IS A PORT, NOT AN INVENTION. The prompt below is `SYNOPSIS_SYSTEM` from
// ~/Dropbox/Projects/ReCiter-Publication-Manager/literature-search/synopsis-relevance-pilot-2026-08-22/run_pilot2.py
// — the 2026-08-22 SYNOPSIS-RELEVANCE pilot, a DIFFERENT run than the later topical-analysis pilot
// this session also has on file — carried across VERBATIM. Same convention IMPACT_PROMPT_V2 uses
// next door in literatureSearch.impact.ts: keeping the wording byte-similar is the point, because
// the wording IS the measurement. That pilot's own numbers — $0.00089/record, 624.7 input / 37.5
// output tokens average — are cited in PLAN's Models section and are FROM THIS EXACT CALL SHAPE:
// Haiku 4.5, ONE call per record (never batched), max_tokens=100, this system prompt, this
// user-message template. Batch it, reword it, or swap models and that citation stops being true —
// see synopsize() below for why the concurrency knob is the only thing allowed to move.
//
// THE PILOT'S OWN "v3" COMMENT ("word-count framing") is not decoration. The pilot separately
// measured that CHARACTER-count instructions ("40-95 characters") do not work on Haiku 4.5 (0/100
// in spec, avg 207 chars observed) while WORD-count instructions ("AT MOST 10 WORDS") do (72/100 in
// spec, avg 88 chars observed). Do not "simplify" this back to a character limit.
//
// ONE DELIBERATE DIVERGENCE FROM THE PILOT SCRIPT, AND IT IS ABOUT INFRASTRUCTURE, NOT WORDING: the
// pilot invoked Bedrock directly with boto3 and parsed a freeform text response with a regex
// (`parse_json_loose`). This ports the WORDING into this codebase's existing forced-tool-call
// convention instead — the same `invoke()` + tool-schema shape STRATEGY_TOOL, SCREEN_TOOL and
// IMPACT_TOOL already use (literatureSearch.llm.ts) — so a malformed answer fails the same
// predictable way every other model call in this app does, rather than adding a second
// JSON-recovery code path for one route. The prompt text, model, token ceiling and
// one-call-per-record shape are unchanged from the pilot.
import { PubRecord } from './literatureSearch.records'
import { UsageLog, invoke } from './literatureSearch.llm'

// The pilot's own prompt-version marker — bump this whenever the wording below is re-synced
// against run_pilot2.py, same as IMPACT_PROMPT_VERSION does for the impact port.
export const SYNOPSIS_PROMPT_VERSION = 'pilot-2026-08-22-v3'

// Haiku 4.5 — the model the pilot's $0.00089/record figure was measured against
// (run_pilot2.py's own `HAIKU_MODEL`). NOT `SCORING_MODEL_ID` (Sonnet 5, literatureSearch.llm.ts) —
// that constant is Mode 4's relevance/impact judgment, a different job on a different model, and
// reusing it here would silently double the per-record cost this step was built to be cheap at.
export const SYNOPSIS_MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'

// Upstream: run_pilot2.py, SYNOPSIS_SYSTEM (the "v3: word-count framing" version — see the file
// header for why word-count, not character-count). Verbatim.
const SYNOPSIS_PROMPT = `You write publication synopses of AT MOST 10 WORDS. Not 12, not 15 -- 10 words or fewer.

Example synopsis (9 words): "Ciprofol matches propofol efficacy with fewer injection-site reactions."

Rules:
- Maximum 10 words. Fewer is fine. More is a failure.
- One finding only, telegraphic style, drop articles (a/the) where possible.
- Return a JSON object: {"synopsis": "..."}`

// Forces the shape with a tool, per this codebase's standing convention (see the file header) —
// the pilot's own `parse_json_loose` regex-recovery is exactly what invoke()'s forced tool_choice
// makes unnecessary.
const SYNOPSIS_TOOL = {
    name: 'submit_synopsis',
    description: 'Return a single publication synopsis of at most 10 words.',
    input_schema: {
        type: 'object' as const,
        properties: {
            synopsis: { type: 'string', description: 'At most 10 words. One finding, telegraphic style.' },
        },
        required: ['synopsis'],
    },
}

// 150, not the pilot's 100 — the pilot called Bedrock with a plain text completion, where every
// token is prose; the forced-tool shape here spends a handful of output tokens on the tool_use
// envelope before the "synopsis" field itself, which is not billed prose (see invoke()'s own
// max_tokens=truncation comment for why running that thin is what turns a cut-off answer into a
// thrown error). This does not change what the model is asked to produce, so it does not touch the
// pilot's measured cost — the ceiling is headroom, not a target.
const SYNOPSIS_MAX_TOKENS = 150

// `year` ADDED (Phase 5 backend, decision: Summarize Themes' year-count strip needs a publication
// year per record, which nothing upstream of Synopsize otherwise carries into the Analyzer's own
// state chain). PubRecord.year is already a string, never null/undefined (see that type's own
// comment) — defaulted to '' here only for the case where synopsize() is ever called with a
// record fetchByPmids() did not itself produce, which should not happen in practice but must not
// throw. This is the BACKEND touch point only — threading `year` through the client's own working-
// set state (so it survives into Score Relevance/Impact/Themes and reaches Summarize Themes at
// all) is the follow-on frontend ticket's job, the same four-touch-points pattern Mode 4's own
// round-trip fields already hit (see PR #874's own note on that).
export type SynopsisResult = { pmid: string; title: string; synopsis: string; year: string }

// One first pass plus one retry. Cheaper than the batch-call retry budgets elsewhere in this file
// (IMPACT_ATTEMPTS/SCREEN_ATTEMPTS = 3) because a failure here costs one record, not a whole batch —
// see synopsize()'s own comment on what happens to a record that still has nothing after this.
const SYNOPSIS_ATTEMPTS = 2

async function synopsizeOne(record: PubRecord): Promise<{ pmid: string; synopsis: string; usage: UsageLog }> {
    const userMsg = `Title: ${record.title}\n\nAbstract: ${record.abstract}\n\nReturn JSON only.`
    let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }

    for (let attempt = 1; attempt <= SYNOPSIS_ATTEMPTS; attempt++) {
        try {
            const { input, usage: u } = await invoke(SYNOPSIS_PROMPT, SYNOPSIS_TOOL, userMsg, SYNOPSIS_MAX_TOKENS, SYNOPSIS_MODEL_ID)
            usage = { inputTokens: usage.inputTokens + u.inputTokens, outputTokens: usage.outputTokens + u.outputTokens }
            const synopsis = String(input?.synopsis ?? '').trim()
            if (synopsis) return { pmid: record.pmid, synopsis, usage }
            // A well-formed tool call with an empty string is still not a synopsis — decision 1
            // requires one, non-null, so an empty answer is treated the same as a thrown one and
            // gets the retry below.
        } catch (err: any) {
            // Bedrock has already billed by the time an answer is rejected — carry the spend
            // forward exactly as billed() does for the batch-shaped calls next door.
            usage = {
                inputTokens: usage.inputTokens + (err?.usage?.inputTokens || 0),
                outputTokens: usage.outputTokens + (err?.usage?.outputTokens || 0),
            }
        }
    }

    console.error(JSON.stringify({
        tag: 'literature-synopsize-failed', pmid: record.pmid,
        why: `no usable synopsis after ${SYNOPSIS_ATTEMPTS} attempts; this record is dropped from the results, not disclosed as a separate loss category (decision 30 names exactly two: not-fetched and no-abstract)`,
    }))
    return { pmid: record.pmid, synopsis: '', usage }
}

// A small bounded-concurrency map, the same shape as search.ts's own mapLimit() (see that
// function's comment for why a hand-rolled worker pool beats a dependency at a handful of call
// sites) — kept local rather than imported, because controllers/ does not reach into
// src/pages/api/, same direction every other file in this module respects.
//
// ponytail: SYNOPSIZE_CONCURRENCY = 6 is a FIRST-CUT DEFAULT, not a tuned number. Decision 23 is
// explicitly still open on route concurrency; the pilot's own ThreadPoolExecutor ran at
// max_workers=8 against Bedrock directly with no other traffic on the account, which is not the
// same question as "how many of THIS route's calls should be in flight on a shared production
// account at once." 6 sits in the 4-10 band this ticket asked for. Revisit with real load signal.
const SYNOPSIZE_CONCURRENCY = 6

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length)
    let i = 0
    async function worker() {
        while (i < items.length) {
            const mine = i++
            out[mine] = await fn(items[mine])
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
    return out
}

export async function synopsize(records: PubRecord[]): Promise<{
    synopses: SynopsisResult[]
    usage: UsageLog
    // LOSS (b) of decision 30's two disclosures: fetched from PubMed, but PubMed had no abstract.
    // PubRecord.abstract is typed `string`, never null/undefined, so an empty string IS the
    // "no abstract" signal — see the PubRecord type's own comment.
    //
    // THIS IS WHERE DECISION 14 IS ENFORCED: a record with no abstract is EXCLUDED here, before it
    // ever reaches the model, never synopsized from the title alone. That is a deliberate departure
    // from Mode 4's title-only fallback (see that mode's own record handling) — Synopsize makes no
    // such allowance.
    //
    // LOSS (a) — PMIDs that never fetched from PubMed AT ALL — is NOT computed in here. This
    // function only ever sees `records`, which is already the post-fetch, already-found set
    // fetchByPmids() returned; it has no way to know what was asked for and never came back. That
    // diff has to happen at the call site, which is why the route (handleAnalyzerSynopsize in
    // search.ts) computes it against the PMIDs it originally parsed from the request body.
    noAbstract: string[]
}> {
    const withAbstract = records.filter(r => r.abstract)
    const noAbstract = records.filter(r => !r.abstract).map(r => r.pmid)

    const results = await mapLimit(withAbstract, SYNOPSIZE_CONCURRENCY, synopsizeOne)

    let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }
    const synopses: SynopsisResult[] = []
    const byPmid = new Map(withAbstract.map(r => [r.pmid, r]))
    for (const r of results) {
        usage = { inputTokens: usage.inputTokens + r.usage.inputTokens, outputTokens: usage.outputTokens + r.usage.outputTokens }
        if (!r.synopsis) continue   // decision 1: synopsis required, non-null — no entry rather than a blank one
        const rec = byPmid.get(r.pmid)
        synopses.push({ pmid: r.pmid, title: rec?.title || '', synopsis: r.synopsis, year: rec?.year || '' })
    }

    return { synopses, usage, noAbstract }
}
