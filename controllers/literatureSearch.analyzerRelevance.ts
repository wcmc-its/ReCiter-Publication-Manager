// Literature Analyzer, Step 2 ("Score Relevance") — one 0-100 relevance score per {pmid, synopsis}
// pair, against the topic and optional inclusion/exclusion criteria the librarian typed. Batched at
// RELEVANCE_BATCH_SIZE per Bedrock call; the route sends one batch per POST.
//
// THIS IS PARTLY A PORT, PARTLY AN INVENTION — unlike literatureSearch.synopsize.ts next door,
// which carries its pilot prompt verbatim, the prompt below could not be. The pilot
// (~/Dropbox/Projects/ReCiter-Publication-Manager/literature-search/synopsis-relevance-pilot-2026-08-22/run_pilot2.py)
// validated two prompts:
//   - MASS_RELEVANCE_SYSTEM (generic, keyword-driven): FAILED — a 2-point gap between a known
//     5-relevant/5-irrelevant set, effectively unable to discriminate.
//   - MASS_RELEVANCE_SYSTEM_V2 (decision ladder + explicit NOT-relevant rules): PASSED, 10/10, a
//     65-point gap — but its ladder text is HARDCODED to the pilot's one topic (airway-
//     instrumentation pharmacology) and cannot be sent for an arbitrary topic.
// So what is PORTED from V2 is the validated STRUCTURE: the batch-of-synopses frame, the four-band
// A/B/C/E ladder over the same 61-100 / 26-60 / 1-25 / 0 ranges (V2 has no D band — kept as-is),
// the "criteria beat field-proximity" rule that was V2's actual fix, and the <=80-character
// explanation. What is INVENTED is the ladder's criteria text, rewritten generically around a
// "core subject" the model derives from the topic/criteria supplied per-call in the USER message —
// the topic never enters this system prompt, or the rubric would stop being callable with any
// topic. One line ("If uncertain between bands, choose the HIGHER band") is retained from the
// pilot's V1 prompt — V2 dropped it, but it is a deliberate keep per the standing design decision.
// The generalized wording has NOT itself been re-validated against a known-item set; the version
// marker below says "generalized-from" rather than claiming the pilot's 10/10 for this exact text.
//
// SAME INFRASTRUCTURE DIVERGENCE AS THE SYNOPSIZE PORT: the pilot parsed freeform JSON with a
// regex (`parse_json_loose`); this uses the codebase's forced-tool-call invoke() convention
// instead, so a malformed answer fails the same predictable way every other model call does —
// never a second JSON-recovery code path.
import { UsageLog, invoke, SCORING_MODEL_ID } from './literatureSearch.llm'

// Bump whenever the prompt below is re-derived against run_pilot2.py, same convention as
// SYNOPSIS_PROMPT_VERSION / IMPACT_PROMPT_VERSION — but named "generalized-from", not a pilot
// version, because this text is a generalization OF the validated V2, not a verbatim port of it.
export const RELEVANCE_PROMPT_VERSION = 'analyzer-relevance-v1-generalized-from-pilot-v2'

// 20 is the only batch size the pilot validated end-to-end with zero truncation and zero missing
// items. The token math would allow ~32, but 32 was never tested — this is a tested-quality
// ceiling, not a token ceiling. Batch-size ablation is an explicitly OPEN, non-blocking item.
export const RELEVANCE_BATCH_SIZE = 20

// max_tokens = base + per-item, the pilot's own formula (run_pilot2.py, mass_relevance_call). The
// 1500 base absorbs Sonnet 5's unrequested "thinking" spend on Bedrock — up to ~1,050 tokens
// observed in the pilot before the actual answer, and invoke() has no `thinking` param to disable
// it with, so overprovisioning the ceiling is the fix (a ceiling is headroom, not a target — see
// invoke()'s own max_tokens=truncation comment for what running thin costs). At batch=20 this is
// 5,500, comfortably under LONG_MAX_TOKENS=8000.
const RELEVANCE_BASE_TOKENS = 1500
const RELEVANCE_TOKENS_PER_ITEM = 200

// Same retry budget and same reasoning as SCORE_ATTEMPTS in literatureSearch.score.ts: a model
// that has dropped the same record twice is telling you something, and an unbounded retry loop
// over a paid call is how a scoring pass quietly costs real money.
const RELEVANCE_ATTEMPTS = 3

export type AnalyzerRelevanceItem = { pmid: string; synopsis: string }
export type AnalyzerRelevanceScore = { relevanceScore: number; relevanceExplanation: string }

// The generalized rubric. FIXED — the topic and criteria arrive in the user message (see
// attemptRelevanceBatch below, same composition Mode 4's attemptScoreBatch uses), never
// interpolated in here: a rubric with a topic baked into it can only score that topic.
const ANALYZER_RELEVANCE_PROMPT = `You are evaluating a BATCH of scholarly synopses for relevance to a research topic.

The user message supplies the review topic and, when the reviewer wrote them, explicit inclusion/exclusion criteria. Before scoring, identify the topic's CORE SUBJECT — the specific intervention, exposure, method, population, or phenomenon the review is actually about — as distinct from the broader field it sits in. Sharing the field is not relevance: a paper is relevant only insofar as the core subject itself is what the paper studies.

If inclusion/exclusion criteria are supplied, they are binding: a paper matching an exclusion criterion is NOT relevant however close its field (band C at best), and the inclusion criteria define what counts as the core subject in band A.

Decision ladder — apply to EACH item independently, judging only what its synopsis actually says:
A) The topic's core subject IS what the paper tests or studies -> 61-100.
B) The core subject is present but secondary — a comparator, a subgroup, background context -> 26-60.
C) Same broad field as the topic, but the core subject itself is absent -> 1-25.
E) Unrelated to the topic entirely -> 0.

If uncertain between bands, choose the HIGHER band.

Rules:
- Return a score for EVERY item supplied. Never skip one, never merge two, never invent a PMID.
- relevanceScore is an integer from 0 to 100, placed within the winning band.
- A synopsis is ten words or fewer. Judge it on what it says — never on what a fuller abstract might have said, and never from your own knowledge of the paper.
- relevanceExplanation: at most 80 characters, specific to THIS item — say what the synopsis does or does not study relative to the core subject, so a human can check the band at a glance. Never restate the score: "relevant to the topic" is a failure.`

// Forces the shape with a tool, per this codebase's standing convention — the pilot's "Return
// STRICT JSON ... no prose, no code fences" paragraph is exactly what invoke()'s forced
// tool_choice makes unnecessary, so it is the one V2 paragraph deliberately not carried over.
const ANALYZER_RELEVANCE_TOOL = {
    name: 'submit_relevance_scores',
    description: 'Return a relevance score and explanation for EVERY item supplied.',
    input_schema: {
        type: 'object' as const,
        properties: {
            scores: {
                type: 'array',
                description: 'Exactly one entry per item supplied. Never omit an item.',
                items: {
                    type: 'object',
                    properties: {
                        pmid: { type: 'string', description: 'The PMID, exactly as supplied.' },
                        relevanceScore: { type: 'number', description: 'Integer 0-100, per the decision ladder.' },
                        relevanceExplanation: { type: 'string', description: 'At most 80 characters, specific to this item — checkable at a glance.' },
                    },
                    required: ['pmid', 'relevanceScore', 'relevanceExplanation'],
                },
            },
        },
        required: ['scores'],
    },
}

// Scores ONE batch (<= RELEVANCE_BATCH_SIZE items — the route enforces that bound before calling).
// A bounded re-ask loop over that one batch, same shape as scoreRelevance()'s in
// literatureSearch.score.ts (first score wins, only still-missing items get re-asked) but with NO
// outer chunk() loop: the caller already sends batches, there is nothing further to chunk here.
//
// FAILURE IS RETURNED, NOT JUST LOGGED — the one deliberate divergence from both precedents.
// Synopsize drops a twice-failed record with a console.error only (an older, already-flagged
// decision scoped to Phase 1); the standing decision for Score Relevance (PLAN's "Failure
// visibility and retry" section, 2026-08-24) requires every record with no usable score after the
// attempts to come back as an explicit `failed` list the route passes through to the client. The
// console.error stays too, but it is no longer the only witness.
export async function scoreAnalyzerRelevance(
    topic: string,
    criteria: string | undefined,
    batch: AnalyzerRelevanceItem[],
): Promise<{ scores: Map<string, AnalyzerRelevanceScore>; failed: string[]; usage: UsageLog }> {
    const byPmid = new Map(batch.map(it => [it.pmid, it]))
    const scores = new Map<string, AnalyzerRelevanceScore>()
    let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }

    let pending = batch
    for (let attempt = 1; attempt <= RELEVANCE_ATTEMPTS && pending.length; attempt++) {
        try {
            const res = await attemptRelevanceBatch(topic, criteria, pending, byPmid)
            usage = {
                inputTokens: usage.inputTokens + res.usage.inputTokens,
                outputTokens: usage.outputTokens + res.usage.outputTokens,
            }
            for (const [pmid, s] of res.scores) {
                if (!scores.has(pmid)) scores.set(pmid, s)   // first score wins across attempts
            }
        } catch (err: any) {
            // BEDROCK HAS ALREADY BILLED BY THE TIME AN ANSWER IS REJECTED — carry the spend
            // forward from the error, same pattern as billed() and both precedents' catch blocks.
            usage = {
                inputTokens: usage.inputTokens + (err?.usage?.inputTokens || 0),
                outputTokens: usage.outputTokens + (err?.usage?.outputTokens || 0),
            }
            console.error(JSON.stringify({
                tag: 'literature-analyzer-relevance-batch-failed', attempt, batchSize: pending.length,
                error: String(err?.message || err), why: 'these items get re-asked, or land in `failed` after the last attempt',
            }))
        }

        const before = pending.length
        pending = pending.filter(it => !scores.has(it.pmid))
        if (pending.length && pending.length !== before) {
            console.error(JSON.stringify({
                tag: 'literature-analyzer-relevance-reask', attempt, asked: before,
                answered: before - pending.length, reasking: pending.length,
            }))
        }
    }

    const failed = pending.map(it => it.pmid)
    if (failed.length) {
        console.error(JSON.stringify({
            tag: 'literature-analyzer-relevance-missing', pmids: failed,
            why: `no usable score after ${RELEVANCE_ATTEMPTS} attempts; returned to the caller in \`failed\`, never silent-only`,
        }))
    }

    return { scores, failed, usage }
}

// One invoke + parse + unknown-PMID-drop + out-of-range clamp over a single (sub-)batch — the
// exact shape attemptScoreBatch() in literatureSearch.score.ts uses. The user message carries the
// topic/criteria in that function's own composition (`Review topic: ...` then the optional
// `Inclusion/exclusion criteria: ...`), and each item is ONLY {pmid, synopsis} — no title, no
// abstract. That is the locked input contract: PLAN's measured $0.00139/record figure (87.4 in /
// 109.2 out tokens per record's share of a 20-batch) was measured on synopsis-only input, and
// adding a title would invalidate that citation.
async function attemptRelevanceBatch(
    topic: string,
    criteria: string | undefined,
    batch: AnalyzerRelevanceItem[],
    byPmid: Map<string, AnalyzerRelevanceItem>,
): Promise<{ scores: Map<string, AnalyzerRelevanceScore>; usage: UsageLog }> {
    const parts = [`Review topic: ${topic}`]
    if (criteria) parts.push(`Inclusion/exclusion criteria: ${criteria}`)
    const items = batch.map(it => ({ pmid: it.pmid, synopsis: it.synopsis }))
    parts.push(`Score all ${batch.length} items below. Return one score per item.\n\nItems:\n${JSON.stringify(items)}`)

    const maxTokens = RELEVANCE_BASE_TOKENS + RELEVANCE_TOKENS_PER_ITEM * batch.length
    const { input, usage } = await invoke(ANALYZER_RELEVANCE_PROMPT, ANALYZER_RELEVANCE_TOOL, parts.join('\n\n'), maxTokens, SCORING_MODEL_ID)

    const scores = new Map<string, AnalyzerRelevanceScore>()
    for (const s of (input?.scores || [])) {
        const pmid = String(s?.pmid ?? '').trim()
        if (!byPmid.has(pmid)) {
            // A score on an item we never sent — the same fabrication risk attemptScoreBatch()
            // guards against, and just as loud, because it means the prompt or the model drifted.
            console.error(JSON.stringify({ tag: 'literature-analyzer-relevance-unknown-pmid', pmid }))
            continue
        }
        const raw = Number(s?.relevanceScore)
        if (!Number.isFinite(raw)) continue   // an unparseable score is the same as no score at all
        const relevanceScore = Math.min(100, Math.max(0, Math.round(raw)))
        const relevanceExplanation = String(s?.relevanceExplanation ?? '').trim() || 'No explanation given.'
        if (!scores.has(pmid)) scores.set(pmid, { relevanceScore, relevanceExplanation })   // first score wins within this answer
    }
    return { scores, usage }
}
