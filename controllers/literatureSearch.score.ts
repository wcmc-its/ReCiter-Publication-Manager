// Mode 4 (bibliometric review) — Phase 6: impact/relevance scoring + justifications. Split out the
// same way clustering (Phase 5) is; the design contract lives in
// Projects/ReCiter-Publication-Manager/literature-search/PLAN-literature-mode4-bibliometric-review.md
// (not in this repo — planning docs live in Projects, code lives here).
//
// TWO SCORES IN THIS FILE, TWO DIFFERENT SOURCES, and the split is the whole design:
//
//   impactScoreOf() is PURE — no network, no LLM. "How strong is this evidence, and how cited is
//   it" is a question PubMed and iCite already answer for free, on every record: the evidence tier
//   (tierOf(), in literatureSearch.records.ts) blended with the NIH percentile. It covers 100% of
//   the corpus at zero marginal cost, which is exactly what a 2,000-record table needs.
//
//   CORRECTION, 2026-08-19 — this comment used to cite ReciterAI's impact.py:score_impact() as
//   precedent for scoring impact deterministically rather than asking a model. That was a
//   misreading, and it is worth recording because it shaped this file. score_impact() IS a model
//   call: one Bedrock request per publication returning a single 0-100 integer, calibrated against
//   ~90 anchor examples in pipeline_enrichment/prompts.py. The iCite numbers are inputs to its
//   PROMPT, not terms in a formula. ReciterAI's actual position is the opposite of the one claimed
//   here: research impact is a judgment, and it pays a model to make it.
//
//   So the ported version now lives in literatureSearch.impact.ts as a THIRD, separate axis, and
//   this function keeps its own job rather than being replaced by it. What survives of the original
//   argument is the part that was always true: this score is free and universal, that one is paid
//   and selective, and neither is a substitute for the other. They are not blended here — see
//   decorateCorpus() in the route, and [[feedback_distinct_axis_scores]]'s rule about not
//   pre-collapsing a multi-axis ranker.
//
//   scoreRelevance() is the one Bedrock call this file makes. "How on-topic is this paper, for
//   THIS review's topic" is not on the record anywhere — it depends on a topic the librarian typed
//   a moment ago, which only reading the title and abstract (a model, or a human) can judge.
//
// preFilterForScoring() sits between the two: it is what makes scoreRelevance() affordable on a
// corpus that can run into the thousands, by deciding — deterministically, for free — which ~200
// records are worth spending a Bedrock call on at all. See its own comment below.
import { PubRecord } from './literatureSearch.records'
import { Cluster } from './literatureSearch.cluster'
import { UsageLog, invoke, renderRecords, LONG_MAX_TOKENS, SCORING_MODEL_ID } from './literatureSearch.llm'
import { RECORD_CAP } from './literatureSearch.strategy'

// ---------------------------------------------------------------------------
// PHASE 6a — impactScoreOf(). PURE, deterministic, NO LLM.

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const round2 = (n: number) => Math.round(n * 100) / 100

// The tier component, keyed by tierOf()'s own `rank` — see the TIERS table in
// literatureSearch.records.ts, which this is deliberately NOT a copy of: that table orders study
// designs by risk of bias, strongest first, for Mode 3's evidence hierarchy. This table scores a
// different axis — how much citation weight a design of this kind tends to carry — and the two
// axes do not agree everywhere.
//
// THE ONE PLACE THEY DISAGREE ON PURPOSE: rank 6 (Case report) scores LOWER than rank 7 (Review),
// even though Case report outranks Review in tierOf()'s own hierarchy. That is not a mistake here
// — a case report is one patient, and a narrative review synthesizes a whole literature and tends
// to be far more cited. Evidence-hierarchy rank answers "how much should this sway a clinical
// decision"; this component answers "how much impact does a paper of this kind tend to carry". Do
// not "fix" this into monotonic agreement with TIERS — it is copied from the design doc's own
// table, not derived from it.
//
// Rank 9 (RETRACTED) is NOT in this table. It is special-cased in impactScoreOf() below, to exactly
// 0, unconditionally — no blend, no partial credit for whatever the original design was.
const TIER_COMPONENT: Record<number, number> = {
    1: 1.00,   // Guideline
    2: 0.90,   // Meta-analysis / Systematic review — both rank 2, see TIERS
    3: 0.75,   // RCT
    4: 0.60,   // Clinical trial
    5: 0.45,   // Observational
    6: 0.20,   // Case report
    7: 0.50,   // Review (narrative) / Editorial / Comment / Letter
    8: 0.30,   // Protocol / Other — both rank 8, see PROTOCOL/OTHER in literatureSearch.records.ts
}

// A component EVERY real tier maps to. This only fires if literatureSearch.records.ts ever adds a
// rank this table has not been updated for — never in normal operation, since every rank tierOf()
// can return today (1-9) is accounted for above or special-cased below.
const FALLBACK_COMPONENT = TIER_COMPONENT[8]

export function impactScoreOf(record: PubRecord): { score: number; justification: string; evidenceBasis: 'percentile' | 'apt' | 'tier-only' } {
    // RETRACTED OVERRIDES EVERYTHING, unconditionally. See RETRACTED in literatureSearch.records.ts
    // for why: PubMed adds "Retracted Publication" ALONGSIDE a paper's original types rather than
    // replacing them, so a retracted RCT is still, truthfully, an RCT — and a blended score would
    // let that original design buy it a nonzero impact number. It must not. The justification is
    // exactly the tier's own phrase, which already says the one thing that matters here.
    if (record.tier.rank === 9) return { score: 0, justification: record.tier.phrase, evidenceBasis: 'tier-only' }

    const tierComponent = TIER_COMPONENT[record.tier.rank] ?? FALLBACK_COMPONENT

    if (typeof record.nihPercentile === 'number') {
        const percentileComponent = record.nihPercentile / 100
        const score = round2(clamp01(0.6 * tierComponent + 0.4 * percentileComponent))
        return {
            score,
            justification: `${record.tier.phrase}; ${record.nihPercentile}th percentile citation impact (iCite)`,
            evidenceBasis: 'percentile',
        }
    }

    // NO PERCENTILE — a 2024-2026 paper has no citation history yet (see withCitationMetrics's own
    // comment), but iCite's apt (Approximate Potential to Translate) is computed from the citing
    // network's STRUCTURE rather than accumulated count, so it is available immediately. Falls back
    // to the same 0.6/0.4 blend on this substitute rather than collapsing to the tier component alone
    // — see PLAN-mode4-relevance-and-impact.md's "fix the recency skew" item.
    if (typeof record.apt === 'number') {
        const aptComponent = clamp01(record.apt)
        const score = round2(clamp01(0.6 * tierComponent + 0.4 * aptComponent))
        return {
            score,
            justification: `${record.tier.phrase}; ${Math.round(record.apt * 100)}% potential-to-translate (iCite, no percentile yet)`,
            evidenceBasis: 'apt',
        }
    }

    return {
        score: round2(tierComponent),
        justification: `${record.tier.phrase}; no iCite percentile or APT yet — recent or unscored`,
        evidenceBasis: 'tier-only',
    }
}

// ---------------------------------------------------------------------------
// PHASE 6b — preFilterForScoring(). PURE, deterministic, NO LLM. Decides WHICH records are worth a
// Bedrock scoring call, out of a corpus that can run into the thousands — scoreRelevance() below
// spends money per record, so something has to pick the ~200 that earn it, and picking them by any
// signal a model would need to look at the abstract for defeats the purpose. Rank and recency are
// already on the record for free; that is enough to choose a defensible shortlist.
export type ScoreBudget = Record<string /* clusterId */, PubRecord[]>

// Exported so the pure check harness can assert the actual constant, never a copied-and-drifted
// "3" of its own — the same reason MAX_CONCEPTS/MAX_LINES/MAX_TERMS are exported from
// literatureSearch.strategy.ts for checkStrategyBounds() to assert against.
export const SCORE_FLOOR = 3

// MISSING PERCENTILE SORTS LAST, NEVER AS ZERO — the same rule impactScoreOf() enforces above, on
// the same signal, for the same reason. A real 0th-percentile paper HAS been scored by iCite and
// genuinely sits at the bottom of its field; a paper with no percentile has not been scored at all
// and could be excellent. Coercing "missing" to 0 would tie it with (and, on the tie-break, often
// beat) a real zero — so the sentinel used for the sort is strictly BELOW the valid 0-100 range,
// never inside it.
const NO_PERCENTILE = -1

// tier.rank ascending (stronger evidence first), then nihPercentile descending (missing sorts
// last, never as 0 — see NO_PERCENTILE), then year descending as the final tie-break.
function rankForScoring(records: PubRecord[]): PubRecord[] {
    return [...records].sort((a, b) => {
        if (a.tier.rank !== b.tier.rank) return a.tier.rank - b.tier.rank
        const aPct = typeof a.nihPercentile === 'number' ? a.nihPercentile : NO_PERCENTILE
        const bPct = typeof b.nihPercentile === 'number' ? b.nihPercentile : NO_PERCENTILE
        if (aPct !== bPct) return bPct - aPct
        return (Number(b.year) || 0) - (Number(a.year) || 0)
    })
}

export function preFilterForScoring(
    clusters: Cluster[],
    byPmid: Map<string, PubRecord>,
    budget = 200,
    seedPmids: Set<string> = new Set(),
): ScoreBudget {
    // THE UNCATEGORIZED BUCKET IS NO LONGER EXCLUDED — see PLAN-mode4-relevance-and-impact.md:
    // "the shortlist should be drawn from the whole corpus." It used to get zero budget on the
    // theory that a fallthrough bucket isn't a topic worth spending Bedrock on, but that meant 35%
    // of a real corpus (819 records) couldn't be scored at all, and recent work skewed heavily into
    // it. It is now just another cluster in `withMembers`, subject to the same floor+share rule as
    // every real one. A cluster whose pmids all fell out of byPmid (should not happen by
    // construction — byPmid is built from the same corpus the clusters were, but this is cheap
    // insurance) still contributes nothing and is dropped below, so the budget math never divides
    // by a cluster with no real members.
    const withMembers = clusters
        .map(c => ({ id: c.id, members: c.pmids.map(p => byPmid.get(p)).filter((r): r is PubRecord => !!r) }))
        .filter(c => c.members.length)

    if (!withMembers.length) return {}

    // Step 1 — every cluster gets its floor first, so a small cluster is never zeroed out by a big
    // one's share. Capped at the cluster's own member count so a 2-record cluster cannot claim 3.
    const floors = new Map(withMembers.map(c => [c.id, Math.min(SCORE_FLOOR, c.members.length)]))
    let floorTotal = [...floors.values()].reduce((a, n) => a + n, 0)

    // ponytail: if the floors alone already exceed the budget, scale every floor down
    // proportionally (never below 1, so the "never zeroed out" promise still holds) rather than the
    // full "proportional allocation + floors, scaled to fit" algorithm the spec describes in the
    // general case. This branch cannot fire at today's ceilings — clusterByMesh() caps at 25
    // clusters, so the worst case is 25 * 3 = 75, well under the 200 default — and is here only so
    // the function never silently blows past its own budget if those ceilings ever move. Upgrade
    // path: if this ever actually fires in production logs, revisit with the fuller algorithm.
    if (floorTotal > budget) {
        const scale = budget / floorTotal
        for (const [id, n] of floors) floors.set(id, Math.max(1, Math.floor(n * scale)))
        floorTotal = [...floors.values()].reduce((a, n) => a + n, 0)
    }

    // Step 2 — whatever budget remains is distributed proportionally to cluster size, then capped
    // at that cluster's own member count (on top of the floor it already has).
    const remaining = Math.max(0, budget - floorTotal)
    const totalMembers = withMembers.reduce((a, c) => a + c.members.length, 0)

    const out: ScoreBudget = {}
    for (const c of withMembers) {
        const floor = floors.get(c.id)!
        const share = totalMembers ? Math.floor(remaining * (c.members.length / totalMembers)) : 0
        const n = Math.min(c.members.length, floor + share)
        if (n) out[c.id] = rankForScoring(c.members).slice(0, n)
    }

    // SEEDED PMIDS ARE FORCED IN, regardless of what the deterministic ranker inside each cluster's
    // slice picked — PLAN-mode4-relevance-and-impact.md: "the librarian gets to see what the tool
    // thinks of the papers they already trust, which is the fastest way to calibrate trust in the
    // rest." This is a deliberate, small exception to "no cluster exceeds its share" — a seed is a
    // handful of records the librarian explicitly named, not the ranker's own allocation.
    if (seedPmids.size) {
        const clusterOf = new Map<string, string>()
        for (const c of withMembers) for (const r of c.members) if (!clusterOf.has(r.pmid)) clusterOf.set(r.pmid, c.id)
        for (const pmid of seedPmids) {
            const clusterId = clusterOf.get(pmid)
            const record = byPmid.get(pmid)
            if (!clusterId || !record) continue   // not in this corpus at all — nothing to force
            out[clusterId] ??= []
            if (!out[clusterId].some(r => r.pmid === pmid)) out[clusterId].push(record)
        }
    }
    return out
}

// ---------------------------------------------------------------------------
// PHASE 6c — scoreRelevance(). The one Bedrock call this file makes.
//
// ONE PASS, NOT SCREEN RECORDS' TWO. screenRecords() is cheap-then-dense on purpose: it screens the
// FULL retrieved corpus (up to RECORD_CAP) with one model call because that corpus was never
// filtered down first. Here the expensive half of that shape — deciding which records are worth a
// model's attention — is already done, deterministically and for free, by preFilterForScoring()
// above. Running a second cheap LLM pass over its ~200-record output before a dense pass would mean
// paying for a filtering step this design does not need: the filtering already happened, off the
// model entirely.

// One first pass plus two re-asks, same number and same reasoning as SCREEN_ATTEMPTS in
// literatureSearch.llm.ts: a model that has dropped the same record twice is telling you something,
// and an unbounded retry loop over a paid call is how a scoring pass quietly costs real money.
const SCORE_ATTEMPTS = 3

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

export async function scoreRelevance(
    topic: string,
    criteria: string | undefined,
    shortlist: PubRecord[],
): Promise<{ scores: Map<string, { score: number; justification: string }>; usage: UsageLog }> {
    const byPmid = new Map(shortlist.map(r => [r.pmid, r]))
    const scores = new Map<string, { score: number; justification: string }>()
    let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }

    let pending = shortlist
    for (let attempt = 1; attempt <= SCORE_ATTEMPTS && pending.length; attempt++) {
        for (const batch of chunk(pending, RECORD_CAP)) {
            try {
                const res = await attemptScoreBatch(topic, criteria, batch, byPmid)
                usage = {
                    inputTokens: usage.inputTokens + res.usage.inputTokens,
                    outputTokens: usage.outputTokens + res.usage.outputTokens,
                }
                for (const [pmid, s] of res.scores) {
                    if (!scores.has(pmid)) scores.set(pmid, s)   // first score wins across attempts
                }
            } catch (err: any) {
                // NEVER THROWN OUT OF THIS FUNCTION — the one deliberate divergence from
                // screenRecords(), which throws on an attempt-1 failure because a screen of nothing
                // is not a screen and the whole page depends on it. A missing relevanceScore is a
                // much smaller consequence: the record still appears in every cluster and every
                // bibliometric stat exactly as before, and only the couple of export columns that
                // show a relevance number go blank for that row. So every batch failure, including
                // the very first one, is caught, logged, and left as a gap — never propagated. The
                // usage it already billed still has to be counted, though: BEDROCK HAS ALREADY
                // BILLED BY THE TIME AN ANSWER IS REJECTED, same reasoning as billed() in
                // literatureSearch.llm.ts.
                usage = {
                    inputTokens: usage.inputTokens + (err?.usage?.inputTokens || 0),
                    outputTokens: usage.outputTokens + (err?.usage?.outputTokens || 0),
                }
                console.error(JSON.stringify({
                    tag: 'literature-relevance-batch-failed', attempt, batchSize: batch.length,
                    error: String(err?.message || err), why: 'these records stay unscored',
                }))
            }
        }

        const before = pending.length
        pending = pending.filter(r => !scores.has(r.pmid))
        if (pending.length && pending.length !== before) {
            console.error(JSON.stringify({
                tag: 'literature-relevance-reask', attempt, asked: before,
                answered: before - pending.length, reasking: pending.length,
            }))
        }
    }

    if (pending.length) {
        console.error(JSON.stringify({
            tag: 'literature-relevance-missing', pmids: pending.map(r => r.pmid),
            why: 'the model returned no score for these records after 3 attempts; they render with no relevanceScore',
        }))
    }

    return { scores, usage }
}

const RELEVANCE_TOOL = {
    name: 'submit_relevance_scores',
    description: 'Return a relevance score and justification for EVERY record supplied.',
    input_schema: {
        type: 'object' as const,
        properties: {
            scores: {
                type: 'array',
                description: 'Exactly one entry per record supplied. Never omit a record.',
                items: {
                    type: 'object',
                    properties: {
                        pmid: { type: 'string', description: 'The PMID, exactly as supplied.' },
                        score: { type: 'number', description: '0 (not about this topic at all) to 1 (squarely on-topic, central to it).' },
                        justification: { type: 'string', description: 'ONE clause, specific to this paper — why it scored where it did.' },
                    },
                    required: ['pmid', 'score', 'justification'],
                },
            },
        },
        required: ['scores'],
    },
}

// Same two forces as SCREEN_PROMPT, in the same tension. This mode is a REPORT, not a filter that
// hides anything — a low score is a sort key and a caption, never a reason a paper disappears — so
// there is no "fail open" instinct to encode. What carries over unchanged is the checkability rule:
// a justification a human cannot verify against the abstract in front of them is worthless, however
// confident it sounds.
const RELEVANCE_PROMPT = `You are scoring how relevant a set of biomedical papers is to a specific review topic, by title and abstract, for a clinician assembling a bibliometric review of the literature.

YOUR SCORE IS A SUGGESTION, not a filter. Every paper you score stays in the report regardless of what you give it — the score sorts and captions a table the clinician reads in full, it does not hide anything.

Rules:
- Return a score for EVERY record. Never skip one, never merge two, never invent a PMID.
- The score is a number from 0 to 1. 0 means the paper is not about this topic at all. 1 means the paper is squarely on-topic — the topic IS what the paper is about, not something it mentions in passing. Use the range between for a paper that touches the topic without being centered on it.
- Judge only on what the title and abstract actually say. Never infer relevance from the journal, the authors, the citation count, or your own knowledge of the field.
- If a record has no abstract, score it from the title alone and say so in the justification — do not guess at what the abstract would have said.
- The justification is ONE CLAUSE, specific to THIS paper, and it must let a human check your score at a glance. Good: "primary RCT of the intervention in the stated population", "mentions the topic only as a secondary outcome", "different intervention entirely — surgical, not pharmacologic, management". NEVER write "relevant to the topic" or "on-topic" — that is the score restated, and it cannot be checked.
- Never state a number that is not written in the abstract you were given.`

// One invoke + parse + unknown-PMID-drop + out-of-range-score-drop over a single batch, the exact
// shape attemptScreenBatch() in literatureSearch.llm.ts uses for the batch the retry loop above
// calls repeatedly. `byPmid` is deliberately the full shortlist (built once in scoreRelevance), not
// just this batch, so a batch stays validated against everything the caller ever supplied.
async function attemptScoreBatch(
    topic: string,
    criteria: string | undefined,
    batch: PubRecord[],
    byPmid: Map<string, PubRecord>,
): Promise<{ scores: Map<string, { score: number; justification: string }>; usage: UsageLog }> {
    const parts = [`Review topic: ${topic}`]
    if (criteria) parts.push(`Inclusion/exclusion criteria: ${criteria}`)
    parts.push(`Score all ${batch.length} records below. Return one score per record.\n\n${renderRecords(batch)}`)

    const { input, usage } = await invoke(RELEVANCE_PROMPT, RELEVANCE_TOOL, parts.join('\n\n'), LONG_MAX_TOKENS, SCORING_MODEL_ID)

    const scores = new Map<string, { score: number; justification: string }>()
    for (const s of (input?.scores || [])) {
        const pmid = String(s?.pmid ?? '').trim()
        if (!byPmid.has(pmid)) {
            // A score on a paper we never sent — the same fabrication risk attemptScreenBatch()
            // guards against, and just as loud, because it means the prompt or the model has drifted.
            console.error(JSON.stringify({ tag: 'literature-relevance-unknown-pmid', pmid }))
            continue
        }
        const raw = Number(s?.score)
        if (!Number.isFinite(raw)) continue   // an unparseable score is the same as no score at all
        const score = clamp01(raw)
        const justification = String(s?.justification ?? '').trim() || 'No justification given.'
        if (!scores.has(pmid)) scores.set(pmid, { score, justification })   // first score wins within this batch's own answer
    }
    return { scores, usage }
}
