// Literature Search — Mode 1 ("Search strategy") and Mode 2 ("Issue review").
//
// MODE 1. The deliverable is the SEARCH STRATEGY, not records. For a systematic review the
// strategy is the librarian's intellectual output: PRESS-peer-reviewed, published as
// the PRISMA-S appendix, and the thing that makes the review reproducible. Records,
// screening, and synthesis belong to Covidence/Rayyan. We hand off; we do not compete.
//
// Consequences, all of which make this file small:
//   - We never retrieve a record there, only COUNT. So it calls
//     /pubmed/query-number-pubmed-articles/ and never /pubmed/query-complex/.
//     It therefore scales to a 15,000-hit strategy for free, needs no streaming, and
//     sidesteps the 100-slice in pubmed.controller.ts entirely.
//     (The ONE exception is seedRecords() below, and it is bounded to the 3-5 seeds.)
//   - There is no result cap. An SR search is DESIGNED to over-retrieve.
//
// THE MODEL IS CALLED ONCE, AT THE START. buildStrategy() is Mode 1's only inference.
// Everything after it — runStrategy, the counts, the seed validation, the re-count after a
// librarian toggles a line — is arithmetic over PubMed counts. So the librarian can iterate
// the strategy all afternoon for the price of a few esearch calls. Keep it that way: the
// moment a toggle needs the model, iteration stops being free.
//
// Counts are exactly reproducible against the PubMed web UI. Verified 2026-07-12:
// a fully-tagged strategy returned 2,302 both ways, and 122 both ways with an RCT
// filter. PubMed's automatic term mapping only rewrites UNTAGGED terms, and the
// strategies we emit are fully tagged by construction.
//
// MODE 2 ("Issue review") is the other shape, and it is NOT Mode 1 with a cap bolted on:
//   - Objective is PRECISION, not recall — the ~30 papers that answer the question, not the
//     5,000 that mention it. Same concept blocks, different prompt (see REVIEW_PROMPT).
//   - It RETRIEVES records, so it meets two ceilings Mode 1 never had: the abstracts must fit a
//     context window (hence the 50-cap), and every abstract that enters the model costs money.
//     It no longer meets a RETRIEVAL ceiling — the tool takes a retmax and will return the top 50
//     of a 184,043-hit query (verified live 2026-07-13), so the old hard refusal above 2,000 hits
//     is gone and so is the constant it refused on. What is left is not a technical limit but an
//     HONESTY one: the top 50 of 1,391 is a thin slice, and taking it silently is the same quiet
//     lie this feature exists to prevent. Hence the three bands on the yield — see NARROW_ABOVE
//     and suggestNarrowings().
//   - It calls the model THREE times, in three separate round trips: build, screen, synthesize.
//     Screening and synthesis are gated on a human — you screen what the human kept, and you
//     synthesize what the human ticked. That is the integrity argument for the whole mode, and
//     it is why these are three POSTs and not one pipeline.
//
// THE 50-CAP IS A PROPERTY OF THE MODE, NOT A SETTING. There is no Max dropdown, and there
// must never be one: the cap is what bounds the context window and therefore the bill.

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { reciterConfig } from '../config/local'
import {
    Line,
    Concept,
    Strategy,
    Pico,
    RECORD_CAP,
    NARROW_ABOVE,
    assembleQuery,
    conceptQuery,
    numberStrategy,
    picoQuestion,
    picoComplete,
} from './literatureSearch.strategy'

// Re-exported so the check script and the API route have one import site.
export { assembleQuery, conceptQuery, numberStrategy, picoQuestion, picoComplete, RECORD_CAP, NARROW_ABOVE }
export type { Line, Concept, Strategy, Pico }

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
//
// A ZERO IS NOT TO BE TRUSTED ON SIGHT. Observed in a live run 2026-07-13: this route returned
// 0 for a query that reliably counts 64,604 (ten for ten when re-run by hand). A build fires a
// dozen counts in a burst — the yield, then one per seed, then one per failing block, then the
// limits check, then the verify and the price — and unkeyed NCBI allows 3 requests/second. A
// throttled esearch comes back as a well-formed 0, not an error, so it is indistinguishable
// from "your strategy found nothing" — the most dangerous possible lie in this feature, and one
// a librarian has no way to catch.
//
// So we retry a zero once. A genuine zero reproduces; a throttled one almost never does. This is
// belt-and-braces, not the real fix: set PUBMED_API_KEY on the retrieval tool (free, lifts the
// limit to 10/s). The load-bearing defence is the monotonicity invariant in suggestFixes below —
// a count that violates arithmetic is a count we refuse to publish.
export async function countPubmed(query: string, retryOnZero = true): Promise<number> {
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
    // The tool returns a bare integer for this route. Guard anyway: a non-numeric body means the
    // tool changed shape, and silently coercing it to 0 would be the same lie by another route.
    const n = Number(body.trim())
    if (!Number.isFinite(n)) throw new Error(`unexpected count payload: ${body.slice(0, 80)}`)

    if (n === 0 && retryOnZero) {
        await new Promise(r => setTimeout(r, 400))
        const again = await countPubmed(query, false)
        if (again !== 0) {
            console.log(JSON.stringify({
                tag: 'literature-count-zero-retry',
                recovered: again,
                query: query.slice(0, 120),
            }))
        }
        return again
    }
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

// The ONE place we call /pubmed/query-complex/. Everything that needs a record — Mode 1's seed
// labels, Mode 2's candidates, and the re-fetch before screening and synthesis — comes through
// here, so there is one HTTP shape to get right and one place that knows the JSON.
//
// NEVER FATAL, on purpose, and the callers differ on what that means: a missing seed record
// costs Mode 1 a label and a suggested fix (the strategy still stands), whereas Mode 2 has
// nothing to show without records — so the ROUTE decides what an empty array means, not this.
//
// `retmax` and `sort` are sent to the retrieval tool, which resolves them onto the esearch call.
// A tool that predates those fields ignores them (Spring's Jackson does not fail on unknown
// properties), which is why the cap is ALSO enforced here with a slice: the 50 is a promise about
// what enters the context window, and it cannot depend on the far side of an HTTP call honouring
// a field. Against an old tool a 1,200-hit query downloads 1,200 records and we keep 50 — slow,
// but never wrong, and never over budget.
// AN EMPTY RECORD SET IS NOT TO BE TRUSTED ON SIGHT — the same lie as countPubmed's zero, one
// layer down, and this one we can see happening in the retrieval tool's own source.
//
// The tool counts before it fetches, and then: `if (numberOfPubmedArticles == 0) return new
// ArrayList<>()`. So a THROTTLED esearch — which comes back as a well-formed 0, not an error —
// makes the tool skip the EFetch entirely and hand us a perfectly well-formed EMPTY LIST. It is
// indistinguishable from "your search found nothing", and Modes 2-3 fire more calls in a burst
// than Mode 1 ever did (a count, then a fetch, then a re-fetch to screen, then a re-fetch to
// synthesize) against an unkeyed NCBI that allows 3 requests/second.
//
// Observed for real while verifying the retmax carve-out: the same too-broad query returned a
// 500 refusal on one call and a well-formed `[]` on another, a minute apart. The 500 is the
// honest answer; the `[]` is a throttled esearch wearing the mask of a genuine zero.
//
// So we retry an empty once, exactly as countPubmed retries a zero. A genuinely empty query
// reproduces; a throttled one almost never does. This is belt-and-braces, not the real fix: set
// PUBMED_API_KEY on the retrieval tool (free, lifts the limit to 10/s).
//
// ponytail: retry-once, not an expected-count parameter. The caller usually knows the true count
// (Mode 2 counts before it fetches), so we COULD assert against it — but that threads a number
// through three call sites to catch a case the retry already catches, and seedRecords has no
// count to hand us anyway. Upgrade path if a single retry proves too weak: pass the known count
// and loop until records.length > 0 || attempts exhausted.
async function fetchArticles(query: string, cap: number, sort: Sort, retryOnEmpty = true): Promise<any[]> {
    if (!query.trim()) return []
    try {
        const res = await fetch(reciterConfig.reciterPubmed.searchPubmedEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'reciter-pub-manager-server' },
            body: JSON.stringify({ 'strategy-query': query, retmax: cap, sort }),
        })
        if (!res.ok) throw new Error(`pubmed retrieval tool HTTP ${res.status}`)
        const data: any = await res.json()
        const list = Array.isArray(data) ? data.slice(0, cap) : []

        if (!list.length && retryOnEmpty) {
            await new Promise(r => setTimeout(r, 400))
            const again = await fetchArticles(query, cap, sort, false)
            if (again.length) {
                console.log(JSON.stringify({
                    tag: 'literature-fetch-empty-retry',
                    recovered: again.length,
                    query: query.slice(0, 120),
                }))
            }
            return again
        }
        return list
    } catch (e) {
        // Loud, not silent. A silent degradation here is how a page that quietly shows nothing
        // goes unnoticed for a year.
        console.error('[literature] record fetch failed:', query.slice(0, 120), e)
        return []
    }
}

export async function seedRecords(pmids: string[]): Promise<Record<string, SeedRecord>> {
    const ids = pmids.filter(p => /^\d+$/.test(p))
    if (!ids.length) return {}

    const out: Record<string, SeedRecord> = {}
    for (const a of await fetchArticles(uidQuery(ids), ids.length, 'relevance')) {
        const cit = a?.medlinecitation
        const pmid = cit?.medlinecitationpmid?.pmid
        if (!pmid) continue
        const first = cit?.article?.authorlist?.[0]?.lastname
        const year = cit?.article?.journal?.journalissue?.pubdate?.year
        out[String(pmid)] = {
            label: first ? (year ? `${first} (${year})` : String(first)) : `PMID ${pmid}`,
            title: plainText(cit?.article?.articletitle),
            mesh: (cit?.meshheadinglist || [])
                .map((m: any) => m?.descriptorname?.descriptorname)
                .filter(Boolean),
        }
    }
    return out
}

// ---------------------------------------------------------------------------
// Mode 2's records.

export type Sort = 'relevance' | 'date'

// RECORD_CAP and NARROW_ABOVE now live in literatureSearch.strategy.ts (re-exported above), because
// the browser needs their VALUES and that file is the only one it can take a value import from.

export type PubRecord = {
    pmid: string
    title: string
    journal: string
    year: string
    authors: string      // "Nikolova et al."
    design: string       // derived — see designOf(). Same string as tier.label.
    // The evidence tier, derived from `types` below. Mode 3 SORTS on rank; Mode 2 just shows the
    // label. Never asked of the model — see tierOf().
    tier: Tier
    // The RAW publication types PubMed indexed, kept so the tier is AUDITABLE. `design` collapses
    // them to one word; when someone asks "why is this a Guideline?", this is the answer. It used
    // to be thrown away at parse time.
    types: string[]
    abstract: string
    mesh: string[]
    // NIH percentile from iCite. DISPLAY ONLY — see withCitationMetrics(). Often absent, by design.
    nihPercentile?: number
}

// ---------------------------------------------------------------------------
// iCite — the NIH's own citation metrics. A CONTEXT SIGNAL FOR THE HUMAN, AND NOTHING ELSE.
//
// Three hard rules, and they are the whole reason this is safe to show:
//
//   1. IT NEVER SORTS. PubMed's Best Match already ranks the 50, and it blends relevance with
//      recency and publication type. A citation metric ranks by ACCUMULATED ATTENTION, which is
//      a function of age — and which, in any clinical literature, favours REVIEWS. Sorting on it
//      would reintroduce the exact bias we just spent a day removing from the retrieval, and it
//      would bury the recent trials a rapid review exists to find.
//   2. IT NEVER FILTERS. Nothing is hidden or dropped because it is uncited.
//   3. IT NEVER REACHES THE MODEL. The screening prompt must not see it. "This paper is famous"
//      is not evidence that it meets the inclusion criteria, and a model handed a percentile will
//      quietly start treating popularity as quality. The abstract is what gets screened.
//
// So it is fetched on the RETRIEVAL path only — not on the screen/synthesize re-fetches, which
// exist to feed the model.
//
// ponytail: nih_percentile, not RCR. Both are on the response, and the percentile is the one a
// human can read without a footnote — "97th percentile" needs no explanation, "RCR 14.06" needs a
// paragraph. Free, keyless, one bulk call for all 50 PMIDs.
//
// IT IS ROUTINELY ABSENT, AND THAT IS CORRECT, NOT BROKEN. The percentile is field- and
// year-normalised, so it needs citation history: a 2025 trial comes back `nih_percentile: null`
// (verified live — that same paper has an RCR, but no percentile). Our top-50 skews recent by
// design, so expect blanks and render them as nothing at all — never "N/A", never a zero, and
// above all never treat a missing percentile as a low one.
export async function withCitationMetrics(records: PubRecord[]): Promise<PubRecord[]> {
    const pmids = records.map(r => r.pmid).filter(p => /^\d+$/.test(p))
    if (!pmids.length) return records

    try {
        const res = await fetch(`https://icite.od.nih.gov/api/pubs?pmids=${pmids.join(',')}`, {
            headers: { 'User-Agent': 'reciter-pub-manager-server' },
        })
        if (!res.ok) throw new Error(`icite HTTP ${res.status}`)
        const body: any = await res.json()

        const pct = new Map<string, number>()
        for (const p of (Array.isArray(body?.data) ? body.data : [])) {
            const raw = p?.nih_percentile
            // REJECT null BEFORE COERCING, and never the other way round. `Number(null)` is `0`,
            // and `0` is finite — so a finiteness check applied to the coerced value cannot tell
            // "not scored yet" from "bottom of its field". It shipped that way for one run, and
            // 14 of 50 records — every 2024-2026 trial in the set, the papers iCite has not scored
            // yet — rendered as a confident "NIH 0th pct". That is the worst kind of wrong: a
            // missing value wearing the face of a real one, and a scarlet letter on exactly the
            // recent trials a rapid review is looking for.
            //
            // 0 IS a legitimate percentile, so it must still survive. Hence: reject the absent
            // values explicitly, then test what remains.
            if (raw === null || raw === undefined || raw === '') continue
            const n = Number(raw)
            if (Number.isFinite(n)) pct.set(String(p?.pmid), n)
        }
        return records.map(r => (pct.has(r.pmid) ? { ...r, nihPercentile: pct.get(r.pmid) } : r))
    } catch (e) {
        // Never fatal. This is a garnish on a row; the records, the screening and the synthesis are
        // the deliverable. Loud in the log, invisible on the page — the same contract as the WCM
        // expert panel.
        console.error('[literature] icite lookup failed (records still returned):', e)
        return records
    }
}

// DESIGN IS DERIVED FROM PUBMED'S OWN INDEXING, NEVER FROM THE MODEL'S READ OF THE ABSTRACT.
// The chip that says "RCT" next to a paper is a claim about the evidence hierarchy, and it is a
// claim PubMed's indexers already adjudicated. Asking the model to restate it buys nothing and
// costs the one thing this feature is for: a design it cannot substantiate is a fabrication with
// a coloured badge on it.
//
// Order is the evidence hierarchy, highest first, because the types overlap by design: a
// meta-analysis is ALSO tagged "Systematic Review" and "Review"; an RCT is ALSO tagged "Journal
// Article". First match wins, so the strongest true label is the one that shows.
//
// startsWith, not equality, because PubMed has qualified variants ("Randomized Controlled Trial,
// Veterinary"). "Other" is honest: PubMed tags a great many real observational studies as nothing
// but "Journal Article", and inventing "Observational" for them would be exactly the lie above.
//
// THE TIER IS THE MODE-3 PRODUCT. In Mode 2 the design chip is informational and a wrong rung is
// cosmetic. In Mode 3 the ORDER IS THE ANSWER, so the rungs are spelled out and ordered here, once,
// derived from NLM's indexing and nothing else.
//
// Tiers, strongest first. Every entry is a real PubMed [pt] that arrives on the record:
//
//   1  Practice Guideline / Guideline / Consensus Development Conference
//   2  Meta-Analysis / Systematic Review
//   3  Randomized Controlled Trial
//   4  Clinical Trial (incl. phases) / Controlled Clinical Trial   -- interventional, not randomized
//   5  Observational Study
//   6  Case Reports
//   7  Review (narrative) / Editorial / Comment / Letter           -- near expert opinion
//   8  Other
//
// TWO THINGS THIS FIXES, both of which were harmless in Mode 2 and are not in Mode 3:
//   - There was NO GUIDELINE TIER. A practice guideline landed in "Review" or "Other" — while the
//     spec's one substantive sentence about this mode is "Guidelines and SRs before primary trials".
//   - `any('systematic review') || any('review')` was ONE bucket, tested AFTER RCT. So a systematic
//     review sorted BELOW an RCT, and a narrative review sorted EQUAL to a systematic one. Both are
//     inversions of the hierarchy, and in a clinical answer they are the whole ballgame.
//
// NOT DERIVED HERE, on purpose: cohort / case-control / case-series. Those are MeSH headings, not
// publication types. We hold the MeSH, so it could be done — but it is a second, weaker source, and
// coarse-and-honest beats granular-and-wrong. "Other" stays honest.
export type Tier = { rank: number; label: string; phrase: string }

// `phrase` is how the tier reads inside a sentence — the evidence floor is prose, not a chip.
const TIERS: Array<{ rank: number; label: string; phrase: string; pts: string[] }> = [
    { rank: 1, label: 'Guideline',         phrase: 'a clinical guideline',           pts: ['practice guideline', 'guideline', 'consensus development conference'] },
    { rank: 2, label: 'Meta-analysis',     phrase: 'a meta-analysis',                pts: ['meta-analysis'] },
    { rank: 2, label: 'Systematic review', phrase: 'a systematic review',            pts: ['systematic review'] },
    { rank: 3, label: 'RCT',               phrase: 'a randomized controlled trial',  pts: ['randomized controlled trial'] },
    { rank: 4, label: 'Clinical trial',    phrase: 'a non-randomized clinical trial', pts: ['controlled clinical trial', 'clinical trial'] },
    { rank: 5, label: 'Observational',     phrase: 'an observational study',         pts: ['observational study'] },
    { rank: 6, label: 'Case report',       phrase: 'a case report',                  pts: ['case reports'] },
    { rank: 7, label: 'Review',            phrase: 'a narrative review',             pts: ['review', 'editorial', 'comment', 'letter'] },
]

const OTHER: Tier = { rank: 8, label: 'Other', phrase: 'not indexed with a study design' }

// First match wins, and the table is ordered strongest-first, because the types OVERLAP by design:
// a meta-analysis is also tagged "Systematic Review" and "Review"; an RCT is also tagged "Clinical
// Trial" and "Journal Article". The strongest TRUE label is the one that shows.
export function tierOf(types: string[]): Tier {
    const t = (types || []).map(x => String(x || '').trim().toLowerCase())
    for (const tier of TIERS) {
        if (tier.pts.some(p => t.some(x => x.startsWith(p)))) {
            return { rank: tier.rank, label: tier.label, phrase: tier.phrase }
        }
    }
    return OTHER
}

// The label Mode 2 has always shown. Unchanged in meaning for the chip; now sourced from the tiers
// so there is exactly one place where a publication type becomes a claim about evidence.
export function designOf(types: string[]): string {
    return tierOf(types).label
}

// THE EVIDENCE FLOOR — derived, free, and often the true clinical answer.
//
// A clinician reading a confident synthesis has no way to know the whole thing rests on case
// series. This says so, in one sentence, computed from the tier of the strongest record retrieved.
// It costs no inference and it cannot be wrong.
export function evidenceFloor(records: PubRecord[]): string {
    if (!records.length) return 'No records were retrieved, so there is no evidence to weigh.'

    const best = records.reduce((a, r) => (r.tier.rank < a.rank ? r.tier : a), OTHER)
    const has = (rank: number) => records.some(r => r.tier.rank === rank)

    // Name what is ABSENT, not just what is present: "there is no RCT here" is the sentence that
    // changes what a clinician does next.
    const missing: string[] = []
    if (!has(1)) missing.push('no clinical guideline')
    if (!has(2)) missing.push('no systematic review or meta-analysis')
    if (!has(3)) missing.push('no randomized trial')

    const lead = best.rank >= 8
        ? 'PubMed does not index a study design for any of the records retrieved'
        : `The strongest evidence retrieved is ${best.phrase}`

    return missing.length
        ? `${lead}. In this set there is ${missing.join(', and ')}.`
        : `${lead}.`
}

// THE FIELD PATH THAT COST AN AFTERNOON. The abstract is at
//   medlinecitation.article.publicationAbstract.abstractTexts[]   <- camelCase, both of them
// and NOT at article.abstract, article.abstracttext, or publicationabstract. Its siblings on
// `article` ARE lowercase (articletitle, authorlist, publicationtypelist, journal) because the
// Java field names are lowercase and no Jackson naming strategy is in play — so the casing here
// is not a convention you can reason about, it is a fact you have to copy. The obvious guess
// parses cleanly, throws nothing, and yields 50 records with 0 abstracts: a screening pass over
// nothing but titles, which reads plausible and is worthless.
//
// PubMed abstracts are STRUCTURED — IMPORTANCE / OBJECTIVE / DESIGN / RESULTS / CONCLUSIONS as
// separate segments. Keep the labels. They are how the model tells a stated result from a stated
// aim, which is precisely the distinction the synthesis prompt is built to enforce.
// PubMed text carries inline markup, and it is NOT just italics. Titles and abstracts both ship
// <i> <b> <u> <sub> <sup>, and MathML (<mml:math>...) turns up in chemistry and dosing text. It
// arrives in the JSON as literal tag text, so rendering it raw puts "Psychobiotic <i>Lactobacillus
// plantarum</i> JYLP-326..." on the screen — which is exactly what the first browser run showed.
//
// This runs over TITLES AND ABSTRACTS ALIKE. The abstract never reaches the DOM, so the tags there
// are not a rendering bug — they are a TOKEN bug: markup in an abstract is paid for on the way into
// the context window, 50 abstracts at a time, and buys the model nothing.
//
// ponytail: STRIP the tags, don't render them. Rendering would mean dangerouslySetInnerHTML on a
// string this app did not author — an XSS sink fed by an external API — to buy italic species names.
// Not a trade worth making. The regex is deliberately generic (<...>) rather than an allowlist of the
// tags we happen to have seen, because the next surprise tag should also vanish rather than surface.
// Ceiling: species names lose their italics. If a librarian asks for them back, the upgrade is a tiny
// allowlist renderer (<i>/<b>/<sub>/<sup> -> React elements), never raw HTML.
//
// Entities are decoded after the strip, NAMED and NUMERIC both: PubMed escapes them, and "&amp;" or
// a minus sign written "&#x2212;" (common in effect sizes — "&#x2212;0.44") is the same class of bug
// one layer down, where it lands in the model's context as noise instead of a number.
export function plainText(raw: any): string {
    return String(raw ?? '')
        .replace(/<[^>]+>/g, '')                                     // any tag, not just the ones we've met
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')             // &amp; LAST, or "&amp;lt;" double-decodes into "<"
        .replace(/\s+/g, ' ')
        .trim()
}

// A malformed entity must not blow up a record parse, and must not smuggle a control character in.
const safeChar = (code: number) =>
    Number.isFinite(code) && code >= 32 && code <= 0x10ffff ? String.fromCodePoint(code) : ''

export function joinAbstract(texts: any): string {
    return (Array.isArray(texts) ? texts : [])
        .map((t: any) => {
            // plainText, not String(): abstracts carry the same <i>/<sub>/<sup>/MathML markup as
            // titles. It never reaches the DOM here, so it is not a rendering bug — it is 50
            // abstracts' worth of tags billed into the context window for nothing.
            const body = plainText(t?.abstractText)
            if (!body) return ''
            const label = plainText(t?.abstractTextLabel)
            return label ? `${label}: ${body}` : body
        })
        .filter(Boolean)
        .join('\n')
}

function toRecord(a: any): PubRecord | null {
    const cit = a?.medlinecitation
    const pmid = cit?.medlinecitationpmid?.pmid
    if (!pmid) return null

    const art = cit?.article || {}
    const authors: any[] = Array.isArray(art.authorlist) ? art.authorlist : []
    const first = authors[0]?.lastname

    // Keep the raw list. Collapsing it straight to a `design` string threw away the evidence for
    // the claim the chip makes — and Mode 3 needs to sort on it, not just print it.
    const types: string[] = (Array.isArray(art.publicationtypelist) ? art.publicationtypelist : [])
        .map((p: any) => p?.publicationtype)
        .filter(Boolean)
        .map(String)
    const tier = tierOf(types)

    return {
        pmid: String(pmid),
        title: plainText(art.articletitle),
        // The ISO abbreviation is what a citation prints ("JAMA Psychiatry"); `title` is the
        // MEDLINE form, which is lowercased ("JAMA psychiatry"). Prefer the former, fall back.
        journal: String(art.journal?.isoAbbreviation || art.journal?.title || ''),
        year: String(art.journal?.journalissue?.pubdate?.year || ''),
        authors: first ? (authors.length > 1 ? `${first} et al.` : String(first)) : '',
        design: tier.label,
        tier,
        types,
        abstract: joinAbstract(art.publicationAbstract?.abstractTexts),
        mesh: (Array.isArray(cit.meshheadinglist) ? cit.meshheadinglist : [])
            .map((m: any) => m?.descriptorname?.descriptorname)
            .filter(Boolean),
    }
}

// `<pmid>[uid] OR <pmid>[uid] …` — [uid] is the correct tag (PubMed normalizes [pmid] -> [UID]),
// verified against live PubMed 2026-07-12. This is how phases 2 and 3 re-fetch: the server never
// accepts abstract text from the client.
const uidQuery = (pmids: string[]) => pmids.map(p => `${p}[uid]`).join(' OR ')

export async function fetchRecords(query: string, cap = RECORD_CAP, sort: Sort = 'relevance'): Promise<PubRecord[]> {
    const out: PubRecord[] = []
    for (const a of await fetchArticles(query, cap, sort)) {
        const r = toRecord(a)
        if (r) out.push(r)
    }
    return out
}

export const fetchByPmids = (pmids: string[]) => fetchRecords(uidQuery(pmids), pmids.length, 'relevance')

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

//
// maxTokens is a PARAMETER because Mode 2 needs a bigger one and the default silently truncates:
// a 30-record synthesis was measured at 4.0k output tokens, hit max_tokens=4000 exactly, and
// stopped mid-sentence. A truncated synthesis does not look broken — it looks like prose. Give
// the long calls 8000 (see LONG_MAX_TOKENS).
async function invoke(system: string, tool: any, user: string, maxTokens = 2000) {
    const modelId = process.env.BEDROCK_MODEL_ID
    if (!modelId) throw new Error('BEDROCK_MODEL_ID is not configured')

    const res = await bedrock.send(new InvokeModelCommand({
        modelId,                                    // command parameter, NOT a body field
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',    // replaces `model` + the version header
            max_tokens: maxTokens,
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

// Mode 2 inverts the objective, so it cannot share Mode 1's prompt. An issue review wants the ~30
// papers that ANSWER the question, and it can only ever read 50 of them — so a strategy tuned for
// recall does not merely over-retrieve, it hands the reader the top 50 of several thousand: a thin
// slice, ranked by an algorithm they did not choose, out of a set they never saw. We CAN retrieve
// that slice (the tool takes a retmax) and we will if they ask for it — but the right place to fix
// it is the QUERY, which is what this prompt is for and what suggestNarrowings() backstops.
//
// Everything else is deliberately identical: concept blocks, separate lines, fully tagged. The
// query is still shown, still copyable, still reproducible against the PubMed web UI. Precision
// is not licence to hand back a query nobody can check.
const REVIEW_PROMPT = `You are a medical reference librarian building a focused PubMed search for a clinician who wants to read the literature on a question.

Your objective is PRECISION. This is NOT a systematic review:
- The reader will read about 30 papers, and at most 50 will be retrieved. A yield in the low hundreds is ideal; a yield in the thousands is a FAILURE, because it means the top of the list is noise.
- Prefer the papers that ANSWER the question over the papers that merely mention it. Anchor the central concepts in the title and abstract, and use MeSH major topic ([majr]) where the concept is the paper's actual subject rather than a passing mention.
- Do not pad a block with distant synonyms, tangential MeSH descriptors, or every spelling variant. Every extra term is more noise in the 50 the reader actually sees.

Structure the search as CONCEPT BLOCKS, one per idea in the question (typically 2-3). They will be AND-ed together.

Write each concept block as SEPARATE LINES:
- one line for the MeSH descriptors, OR-ed together;
- one line for the free-text terms, tagged [tiab] and OR-ed together.
Do NOT merge MeSH and free-text into a single line. If a concept has no suitable MeSH descriptor, emit the free-text line alone. The lines within a block are OR-ed and given line numbers; the blocks are then AND-ed.

Every term MUST carry an explicit PubMed field tag — [MeSH], [majr], [tiab], [ti]. Never emit a bare untagged word: PubMed's automatic term mapping rewrites untagged terms, which makes the hit count irreproducible.

DATE limits are supplied by the caller and applied separately. Never put a date inside a concept block.

STUDY DESIGN IS DIFFERENT, AND THIS IS THE MOST IMPORTANT INSTRUCTION HERE.

FIRST, THE RULE THAT MAKES OR BREAKS IT: **lines within a block are OR-ed; blocks are AND-ed.** So a restriction only restricts if it is ALONE IN ITS OWN BLOCK. OR-ing "Humans"[MeSH] into a study-design block does not narrow that block — it SATISFIES it for every human paper ever indexed, reviews included, and silently cancels the entire filter. That is a real failure that has already happened here. One restriction, one block.

If the criteria name a study design ("RCTs only", "trials", "no reviews"), emit a final block labelled "Study design" containing ONLY publication types and design words, e.g.:
    Randomized Controlled Trial[pt] OR Controlled Clinical Trial[pt] OR randomized[tiab] OR placebo[tiab]
Nothing else goes in that block. No population terms. No "Humans".

If the criteria SEPARATELY exclude animal or preclinical work, emit a SECOND, SEPARATE block labelled "Humans" containing only:
    Humans[MeSH]
It must be its own block so that it is AND-ed. Never fold it into the design block.

WHY THIS MATTERS: only 50 records are ever retrieved, ranked by relevance, and relevance ranking LOVES reviews — they are highly cited and topically dead-on. If the criteria say "RCTs only" and the query does not filter on publication type, reviews fill most of those 50 slots, every one is read into a context window and paid for, and every one is then excluded for being a review. That is the reader's budget spent to rediscover what you already knew when you wrote the query. Encode the design in the query; do not leave it to the screener.

If the criteria say nothing about study design, emit no such block — never invent a filter the reader did not ask for.

Do not use relevance ranking, sort orders, or result caps — the caller applies those. Return the strategy only.`

export type UsageLog = { inputTokens: number; outputTokens: number }

// A FILTER THAT CANCELS ITSELF. Lines within a block are OR-ed; blocks are AND-ed. So a
// restriction only restricts if it is alone in its own block — and asked for "RCTs only, exclude
// animals", the model emitted this, verbatim, in a live run:
//
//     (Randomized Controlled Trial[pt] OR Controlled Clinical Trial[pt] OR Humans[MeSH] OR ...)
//
// which is satisfied by EVERY human paper ever indexed. The design filter is silently a no-op:
// 31 of the 50 retrieved records came back reviews, each one read into a context window, paid
// for, and then excluded by the screener for being a review — the exact waste the filter existed
// to prevent, with a query on screen that looks like it is filtering.
//
// The prompt now spells the OR/AND semantics out, but a prompt is not a guarantee and this failure
// is SILENT and EXPENSIVE. So we also fix it structurally, the way this file already refuses a
// count that violates arithmetic: Humans/Animals are FILTERS, never synonyms. If one is OR-ed in
// with other terms, hoist it into its own AND-ed block, where it does what it says.
//
// ponytail: hoist, don't reject. A rebuild costs another model call and would probably make the
// same mistake; the correct query is mechanically derivable from the wrong one, so derive it.
// Ceiling: only Humans/Animals. If the model learns to bury other filters ([majr] population
// limits, language) inside an OR, generalize this to "a term that cannot be a synonym".
const FILTER_TERMS = /^\s*"?(humans?|animals?)"?\s*\[(mesh|mh)\]?\s*$/i

export function hoistFilters(s: Strategy): Strategy {
    const hoisted: string[] = []

    const concepts = s.concepts.map(c => ({
        ...c,
        lines: c.lines.map(line => {
            const terms = line.terms.split(/\s+OR\s+/i)
            if (terms.length < 2) return line                 // alone in its line: already a real filter
            const keep = terms.filter(t => !FILTER_TERMS.test(t))
            const pulled = terms.filter(t => FILTER_TERMS.test(t))
            if (!pulled.length) return line
            hoisted.push(...pulled.map(t => t.trim()))
            return { ...line, terms: keep.join(' OR ') }
        }).filter(l => l.terms.trim()),                       // a line that was ONLY filters is now empty
    })).filter(c => c.lines.length)

    if (!hoisted.length) return s

    console.log(JSON.stringify({
        tag: 'literature-filter-hoisted',
        terms: hoisted,
        why: 'OR-ed in with real terms, this filter matched everything and silently cancelled its own block',
    }))

    // Dedupe, and give it its own AND-ed block, which is the whole point.
    return {
        ...s,
        concepts: [...concepts, { label: 'Humans', lines: [{ terms: Array.from(new Set(hoisted)).join(' OR '), on: true }] }],
    }
}

export async function buildStrategy(
    question: string,
    limits: string,
    criteria?: string,
    objective: 'recall' | 'precision' = 'recall',
    pico?: Pico,
): Promise<{ strategy: Strategy; usage: UsageLog }> {
    const parts = [`Research question: ${question}`]

    // PICO reuses REVIEW_PROMPT rather than getting a system prompt of its own, DELIBERATELY: the
    // field-tag rule lives in there and it is what makes the count reproducible against PubMed. A
    // second copy of that prompt is a second chance to relax the one rule that must never be
    // relaxed. So the PICO structure is carried in the USER message instead.
    if (pico) {
        const elements = [
            `Population: ${pico.population}`,
            `Intervention: ${pico.intervention}`,
            ...(pico.comparison?.trim() ? [`Comparison: ${pico.comparison}`] : []),
            `Outcome: ${pico.outcome}`,
        ]
        parts.push(
            `This question was asked as PICO. Build ONE concept block per element below, labelled ` +
            `exactly as shown, and in this order:\n\n${elements.join('\n')}\n\n` +
            `Each block is AND-ed with the others, so an element that is rarely stated in a title or ` +
            `abstract will silently cost you recall. Build the Outcome block from the terms an author ` +
            `would actually use, and keep it broad; do not narrow it with the trial's endpoint jargon.`,
        )
    }

    if (criteria) parts.push(`Inclusion/exclusion criteria: ${criteria}`)
    parts.push(limits
        ? `Limits already applied by the caller (do NOT repeat these inside a concept block): ${limits}`
        : `No limits will be applied.`)

    const prompt = objective === 'precision' ? REVIEW_PROMPT : SYSTEM_PROMPT
    const { input, usage } = await invoke(prompt, STRATEGY_TOOL, parts.join('\n\n'))
    if (!input?.concepts?.length) throw new Error('model did not return a strategy')

    const strategy: Strategy = {
        db: 'pubmed',
        concepts: input.concepts.map((c: any) => ({
            label: String(c.label || ''),
            // Every line the model writes arrives TICKED. Untick is the librarian's move.
            lines: (Array.isArray(c.lines) ? c.lines : [c.lines])
                .filter((t: any) => typeof t === 'string' && t.trim())
                .map((t: string) => ({ terms: t.trim(), on: true })),
        })).filter((c: Concept) => c.lines.length),
        limits,
    }

    return { strategy: hoistFilters(strategy), usage }
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
            //
            //    THE INVARIANT. OR-ing terms into a concept block can only ever ADD records, so
            //    `widened >= base` is arithmetic, not a hope. When it is violated the COUNT is
            //    wrong, not the maths — a throttled esearch returns a well-formed 0 (see
            //    countPubmed). This fired for real: a widened query that truly counts 64,604 came
            //    back as 0 mid-build, and the page rendered the price as "+-5,714 records".
            //
            //    So we refuse to publish a price we cannot stand behind. The LINE still stands —
            //    it is independently verified to retrieve the seed — it just arrives without a
            //    number rather than with a fabricated one. Never invent a figure for a librarian
            //    who is about to make a methods decision on it.
            const widenedHits = await countPubmed(assembleQuery(withLine))
            if (widenedHits >= result.hits) {
                line.costRecords = widenedHits - result.hits
            } else {
                console.error(JSON.stringify({
                    tag: 'literature-price-impossible', pmid: miss.pmid, conceptIndex: ci,
                    baseHits: result.hits, widenedHits,
                    why: 'a widening cannot shrink the result set — the count is untrustworthy, price withheld',
                }))
            }

            out = {
                ...out,
                concepts: out.concepts.map((c, i) => i === ci ? { ...c, lines: [...c.lines, line] } : c),
            }
            console.log(JSON.stringify({
                tag: 'literature-fix', pmid: miss.pmid, conceptIndex: ci, terms, costRecords: line.costRecords ?? null,
            }))
        }
    }

    return { strategy: out, usage }
}

// ---------------------------------------------------------------------------
// MODE 2 — "Issue review". Three model calls, three round trips, a human between each one.
//
//   1. runReview()      build the strategy, count it, fetch up to 50 records.
//   2. screenRecords()  ONE call over all 50. Suggests include/exclude with a reason.
//   3. synthesize()     ONE call over the records THE HUMAN TICKED.
//
// The human in between is not a UI nicety, it is the mode's integrity argument: nothing is
// screened that the librarian did not see, and nothing is synthesized that they did not keep.
//
// Neither call takes abstract text from the client. Phases 2 and 3 receive PMIDs, validated
// /^\d+$/, and RE-FETCH the records from PubMed themselves. Accepting the text back would turn a
// paid model call into a client-controlled text-injection surface, and would let a tampered page
// synthesize prose over abstracts PubMed never published.

// 4,000 was measured TRUNCATING a 30-record synthesis mid-sentence — and a truncated synthesis
// does not look broken, it looks like prose that trails off, which a reader will take for the end.
// Double it. Screening gets the same ceiling: 50 one-clause reasons is nowhere near 8,000 tokens,
// but a run that silently drops the last eight verdicts is the same failure wearing a different
// hat, and the ceiling costs nothing when it is not reached.
const LONG_MAX_TOKENS = 8000

export type Screened = {
    pmid: string
    include: boolean     // the AI SUGGESTION. The human's checkbox is separate client state.
    reason: string       // one clause: why excluded, or — if included — what qualifies it.
    design: string
}

const SCREEN_TOOL = {
    name: 'submit_screening',
    description: 'Return an include/exclude suggestion, with a reason, for EVERY record supplied.',
    input_schema: {
        type: 'object' as const,
        properties: {
            verdicts: {
                type: 'array',
                description: 'Exactly one entry per record supplied. Never omit a record.',
                items: {
                    type: 'object',
                    properties: {
                        pmid: { type: 'string', description: 'The PMID, exactly as supplied.' },
                        include: { type: 'boolean', description: 'true if this paper should go forward to the reader.' },
                        reason: { type: 'string', description: 'ONE clause, specific to this paper. If excluded, why. If included, what qualifies it.' },
                    },
                    required: ['pmid', 'include', 'reason'],
                },
            },
        },
        required: ['verdicts'],
    },
}

// Two rules carry this prompt, and they pull in opposite directions on purpose.
//
// FAIL OPEN. A wrongly INCLUDED paper costs the reader ten seconds — they see the row, they see
// the reason, they untick it. A wrongly EXCLUDED paper is invisible: it is the one finding that
// never reaches them, and they will never know it existed. So an uncertain verdict is an include.
//
// A REASON, NOT A VERDICT. "Does not meet criteria" is not a reason, it is the verdict restated,
// and it is unauditable — the whole point of keeping excluded rows on the page is that a human can
// check the exclusion in one glance. "Animal model", "no comparator arm", "editorial, not a
// study": those a reader can overrule in a second.
const SCREEN_PROMPT = `You are screening PubMed records by title and abstract for a clinician who asked a specific question.

YOUR VERDICT IS A SUGGESTION. A human sees every record you screen, INCLUDING the ones you exclude, with your reason next to it, and makes the final call. Write for that reader.

Rules:
- Return a verdict for EVERY record. Never skip one, never merge two, never invent a PMID.
- Judge only on what the title and abstract actually say. Never infer a study's design, population or result from its title, its journal, or your own knowledge of the paper.
- WHEN IN DOUBT, INCLUDE. Excluding a relevant paper is the cardinal sin here: the reader never sees it and never learns it existed. Including an irrelevant one costs them one line of reading. If the abstract does not give you enough to exclude confidently, include it.
- If a record has no abstract, include it and say so — you cannot screen what you cannot read.
- The reason is ONE CLAUSE, specific to THIS paper, and it must let a human check your call at a glance. Good exclusions: "animal model", "no comparator arm", "editorial, not a study", "children only", "different intervention (prebiotic, not probiotic)". Good inclusions: "RCT, adults, probiotic vs placebo, depression outcome". NEVER write "does not meet the criteria" or "not relevant" — that is the verdict restated, and it cannot be checked.
- Never state a number that is not in the abstract.`

export async function screenRecords(
    question: string,
    criteria: string,
    records: PubRecord[],
): Promise<{ flags: Screened[]; usage: UsageLog }> {
    const byPmid = new Map(records.map(r => [r.pmid, r]))

    const parts = [`Question: ${question}`]
    if (criteria) parts.push(`Inclusion/exclusion criteria: ${criteria}`)
    parts.push(`Screen all ${records.length} records below. Return one verdict per record.\n\n${renderRecords(records)}`)

    // ONE call for all 50 — measured at 40.4k in / 2.5k out / 28.9s, and it returned 50 of 50
    // with no drops. Do NOT chunk it: chunking multiplies the fixed prompt cost, and worse, it
    // screens each batch without sight of the others, which is how the same paper gets excluded
    // in batch 1 and included in batch 3.
    const { input, usage } = await invoke(SCREEN_PROMPT, SCREEN_TOOL, parts.join('\n\n'), LONG_MAX_TOKENS)

    const verdicts = new Map<string, any>()
    for (const v of (input?.verdicts || [])) {
        const pmid = String(v?.pmid ?? '').trim()
        if (!byPmid.has(pmid)) {
            // A verdict on a paper we never sent. Drop it — it cannot be shown against a record,
            // and a PMID the model produced from memory is exactly the fabrication we are here to
            // stop. Loud, because it means the prompt or the model has drifted.
            console.error(JSON.stringify({ tag: 'literature-screen-unknown-pmid', pmid }))
            continue
        }
        if (!verdicts.has(pmid)) verdicts.set(pmid, v)   // first verdict wins; a duplicate is noise
    }

    // Built by walking the RECORDS, not the verdicts: every record gets exactly one flag, in the
    // order the page already shows them, and a record the model forgot cannot silently vanish.
    const missing: string[] = []
    const flags: Screened[] = records.map(r => {
        const v = verdicts.get(r.pmid)
        if (!v) {
            missing.push(r.pmid)
            return {
                pmid: r.pmid,
                include: true,                       // fail open — see the prompt
                reason: 'Not screened — no verdict came back for this record. Read it yourself.',
                design: r.design,
            }
        }
        return {
            pmid: r.pmid,
            include: !!v.include,
            reason: String(v.reason ?? '').trim() || 'No reason given.',
            // Design is PUBMED'S, stamped from the record we fetched — never the model's read of
            // the abstract. The model is not asked for it and could not be trusted with it.
            design: r.design,
        }
    })
    if (missing.length) {
        console.error(JSON.stringify({
            tag: 'literature-screen-missing', pmids: missing,
            why: 'the model returned no verdict for these records; they fail open as includes',
        }))
    }

    return { flags, usage }
}

// ---------------------------------------------------------------------------
// Synthesis. THIS is the call the whole feature exists to keep honest.

export type SynthRow = { pmid: string; study: string; year: string; journal: string; design: string; intervention: string; rank: number }
export type Synthesis = { table: SynthRow[]; prose: string; floor?: string }

// Mode 3 orders the evidence; Mode 2 does not. The sort is STABLE, so within a tier PubMed's
// relevance order survives — we are re-ordering by design, not re-scoring by relevance.
export type SynthMode = 'issue-review' | 'clinical-question'

export function byTier(records: PubRecord[]): PubRecord[] {
    return records
        .map((r, i) => ({ r, i }))                                  // index = PubMed's relevance order
        .sort((a, b) => a.r.tier.rank - b.r.tier.rank || a.i - b.i)  // tier first, relevance as tiebreak
        .map(x => x.r)
}

const SYNTH_TOOL = {
    name: 'submit_synthesis',
    description: 'Return a narrative synthesis of the supplied papers, plus one evidence-table row per paper.',
    input_schema: {
        type: 'object' as const,
        properties: {
            // Only the intervention is asked for. Study, year, journal and design are stamped from
            // the PubMed record server-side — see synthesize(). Asking the model to retype a year
            // it was just given is a chance for it to get one wrong, for no benefit at all.
            table: {
                type: 'array',
                description: 'One row per supplied paper. Order them as they should be read (strongest evidence first).',
                items: {
                    type: 'object',
                    properties: {
                        pmid: { type: 'string', description: 'The PMID, exactly as supplied.' },
                        intervention: { type: 'string', description: 'The intervention or exposure studied, in a few words, e.g. "Probiotic (L. plantarum) vs placebo, 8 wk". Only what the abstract states.' },
                    },
                    required: ['pmid', 'intervention'],
                },
            },
            prose: {
                type: 'string',
                description: 'The narrative synthesis. Every claim cites its source inline as [PMID 12345678]. Plain prose, no markdown, no headings.',
            },
        },
        required: ['table', 'prose'],
    },
}

// THE ONE PROMPT THAT MATTERS. Every other guardrail in this feature — the derived design, the
// server-side re-fetch, the stamped table columns, the human checkbox — exists to make sure the
// text this call produces is about papers that exist and says what they actually said.
//
// The specific failure it is written against is not "the model lies". It is that a model asked to
// summarize evidence will helpfully supply the CONNECTIVE TISSUE a reader expects — a pooled
// effect, a rough n, "a moderate benefit" — none of which appeared in any abstract, all of which
// read exactly like the sentences around them, and any one of which could end up in a grand
// rounds slide. Hence: no number that is not on the page in front of it, and a PMID on every
// claim so a reader can check any sentence in one click.
// Rules 1-4 and 6 are IDENTICAL for both synthesis modes and are therefore written ONCE. A
// paraphrase in a second prompt would drift, and rule 2 is the sentence standing between this
// feature and an invented effect size on a grand rounds slide. Only rule 5 differs — see below.
const SYNTH_RULES_HEAD = `1. EVERY claim cites the paper it came from, inline, as [PMID 12345678]. A sentence that makes a claim and carries no PMID is a sentence you may not write. Cite multiple PMIDs when several papers support the same point.
2. NEVER state a number that is not written in the abstract you were given. No effect sizes, no risk ratios, no confidence intervals, no p values, no sample sizes, no percentages — unless that exact figure appears in the abstract, in which case state it and cite it. If the abstracts do not report an effect size, SAY that they do not. Do not estimate it, pool it, average it, or infer it from the direction of the findings.
3. NEVER mention a paper you were not given, and never a PMID that is not in the list supplied. You have no other sources.
4. Where the papers disagree, say so plainly and cite both sides. Do not resolve a disagreement the evidence does not resolve, and do not smooth it into a consensus.`

const SYNTH_RULE_TAIL = `6. Say what is missing. If the selected papers do not answer part of the question — no long-term follow-up, no head-to-head comparison, one population only — say that in plain words.`

// Mode 2: the model must not rank, because nothing has ranked.
const RULE_5_NARRATIVE = `5. This is a NARRATIVE synthesis, not a meta-analysis. Do not pool results, do not rank the papers by quality, and do not compute anything.`

// Mode 3: the model must not rank, because THE SERVER ALREADY DID — from PubMed's publication
// types. This is the amendment, not a deletion: Mode 3 ranks, but the ranking is derived and
// auditable, and a model reordering it would replace a fact with an opinion.
const RULE_5_PICO = `5. This is a NARRATIVE synthesis, not a meta-analysis. Do not pool results and do not compute anything. DO NOT RE-RANK the papers: they are given to you ALREADY ORDERED by study design — guidelines and systematic reviews first, then randomized trials, then weaker designs — from PubMed's own indexing of each paper. That order is a fact about how the evidence was produced, not a judgment you are being asked to make. Keep it. Lead with the strongest design present, and if the strongest design present is a weak one, SAY SO in your first sentence.`

const SYNTH_PROMPT = `You are writing a short narrative synthesis of the papers a clinician has SELECTED. They have already read the titles and abstracts and chosen these. You are given the same abstracts they saw, and nothing else.

THESE RULES ARE ABSOLUTE. They are the reason this tool exists:
${SYNTH_RULES_HEAD}
${RULE_5_NARRATIVE}
${SYNTH_RULE_TAIL}

Style: 3-5 short paragraphs of plain clinical prose. No headings, no bullet points, no markdown, no bold. Lead with what the strongest evidence shows. Write for a clinician who will check your citations.`

// MODE 3. Same absolute rules, a different job: this ANSWERS a question rather than surveying a
// literature. The danger is correspondingly higher — a clinical answer is exactly where a model is
// most tempted to supply the confident, quotable number nobody wrote down.
const PICO_SYNTH_PROMPT = `You are answering a specific clinical question for a clinician, from the papers they have SELECTED. You are given the same abstracts they saw, and nothing else. They will act on what you write, so a hedge you can support is worth more than a claim you cannot.

THESE RULES ARE ABSOLUTE. They are the reason this tool exists:
${SYNTH_RULES_HEAD}
${RULE_5_PICO}
${SYNTH_RULE_TAIL}

Structure: open with the BOTTOM LINE in one or two sentences — the direct answer to the question asked, with its citations. Then the supporting evidence, strongest design first. Then, in plain words, what this evidence does NOT establish.

If the papers do not answer the question, your first sentence says so. "These papers do not answer this question" is a complete and useful answer, and it is far better than an answer assembled out of adjacent findings.

Style: 3-5 short paragraphs of plain clinical prose. No headings, no bullet points, no markdown, no bold. Write for a clinician who will check your citations.`

export async function synthesize(
    question: string,
    records: PubRecord[],
    mode: SynthMode = 'issue-review',
): Promise<{ synthesis: Synthesis; usage: UsageLog }> {
    const pico = mode === 'clinical-question'

    // THE SERVER RANKS; THE MODEL NEVER DOES. For Mode 3 the records are sorted by their derived
    // tier BEFORE the model sees them, so the order it reads — and the order it is told to keep —
    // is PubMed's indexing, not its own opinion of what looks convincing.
    const ordered = pico ? byTier(records) : records
    const byPmid = new Map(ordered.map(r => [r.pmid, r]))

    const { input, usage } = await invoke(
        pico ? PICO_SYNTH_PROMPT : SYNTH_PROMPT, SYNTH_TOOL,
        pico
            ? `Clinical question: ${question}\n\nThe ${ordered.length} papers the clinician selected, ALREADY ORDERED by study design (strongest first). The design shown on each is PubMed's own, not yours:\n\n${renderRecords(ordered)}`
            : `Question: ${question}\n\nThe ${ordered.length} papers the clinician selected:\n\n${renderRecords(ordered)}`,
        LONG_MAX_TOKENS,
    )

    const prose = String(input?.prose ?? '').trim()
    if (!prose) throw new Error('model did not return a synthesis')

    // The table is STRUCTURED data, so we can hold it to the record: the model contributes the
    // intervention and the reading order, and PubMed supplies every other cell. A row for a paper
    // that was not selected is dropped outright.
    const seen = new Set<string>()
    const table: SynthRow[] = []
    for (const row of (Array.isArray(input?.table) ? input.table : [])) {
        const pmid = String(row?.pmid ?? '').trim()
        const rec = byPmid.get(pmid)
        if (!rec || seen.has(pmid)) {
            if (!rec) console.error(JSON.stringify({ tag: 'literature-synth-unknown-pmid', pmid }))
            continue
        }
        seen.add(pmid)
        table.push({
            pmid,
            study: rec.authors || `PMID ${pmid}`,
            year: rec.year,
            journal: rec.journal,
            design: rec.design,
            rank: rec.tier.rank,
            intervention: String(row?.intervention ?? '').trim(),
        })
    }

    // Mode 3: re-impose the derived order on the TABLE too. The model was told to keep it, but a
    // prompt is not a guarantee — and unlike the prose, the table is structured enough to simply
    // fix. Stable, so a model's within-tier reading order survives.
    if (pico) {
        const pos = new Map(ordered.map((r, i) => [r.pmid, i]))
        table.sort((a, b) => a.rank - b.rank || (pos.get(a.pmid)! - pos.get(b.pmid)!))
    }

    const dropped = records.filter(r => !seen.has(r.pmid)).map(r => r.pmid)
    if (dropped.length) {
        console.error(JSON.stringify({
            tag: 'literature-synth-missing-rows', pmids: dropped,
            why: 'the model left these selected papers out of the evidence table',
        }))
    }

    // The PROSE we cannot filter, and we do not try: silently deleting a sentence would be a
    // second fabrication laid over the first, and rewriting a synthesis to make it pass its own
    // check is exactly the behaviour we are policing. So we CHECK it and we shout. A citation to a
    // PMID that was not supplied means the model reached outside the papers it was given, which is
    // rule 3 broken, and the log is what will tell us before a reader does.
    const cited = new Set((prose.match(/\[PMID\s+(\d+)\]/gi) || [])
        .map(m => (m.match(/\d+/) || [''])[0]))
    const invented = Array.from(cited).filter(p => p && !byPmid.has(p))
    if (invented.length) {
        console.error(JSON.stringify({
            tag: 'literature-synth-bad-citation', pmids: invented,
            why: 'the synthesis cites PMIDs that were not among the selected papers',
        }))
    }

    // The floor is computed, never asked for. If the model's prose disagrees with it, the floor is
    // the one that is right.
    return { synthesis: { table, prose, ...(pico ? { floor: evidenceFloor(ordered) } : {}) }, usage }
}

// What the model is shown. One block per record: the PubMed facts on a header line, then the
// title, then the structured abstract with its labels intact. No JSON — plain labelled text is
// what these models read best, and it keeps the 50-record prompt inside the measured 40k tokens.
//
// "(no abstract in PubMed)" is stated rather than left blank, because an empty field invites the
// model to fill it in from memory, and a blank line invites it to assume the record was truncated.
function renderRecords(records: PubRecord[]): string {
    return records.map(r => [
        `PMID ${r.pmid} | ${r.design} | ${r.authors || 'unknown author'} | ${r.journal || 'unknown journal'} ${r.year}`,
        `TITLE: ${r.title}`,
        `ABSTRACT: ${r.abstract || '(no abstract in PubMed)'}`,
    ].join('\n')).join('\n\n')
}

// ---------------------------------------------------------------------------
// The suggested NARROWING — the exact mirror of suggestFixes above, and deliberately the same
// shape, because it is the same move.
//
// Mode 1 diagnoses a MISS and offers a WIDENING: an unticked line, verified and priced, that the
// librarian can read, cost, and reject. Mode 2's problem is the opposite — the yield is fine, but
// the 50 we read is a thin slice of it — so what we offer is an unticked BLOCK that narrows,
// arriving with the count it would leave behind. Same contract in both directions: never publish a
// number we cannot stand behind, and never make the change on the librarian's behalf.
//
// A NARROWING IS JUST A CONCEPT BLOCK THAT ARRIVES UNTICKED AND PRICED. That is the whole design:
// no modal, no new state machine, no new count path. Ticking one appends it to the strategy and
// re-counts down the EXISTING re-count path, which is free.
//
// NO MODEL CALL. This is arithmetic over PubMed counts, exactly like Mode 1's re-count, and that is
// what keeps iteration free — tick it, watch the number move, untick it. The moment a narrowing
// needs inference, iterating stops being free and the panel stops being used.
//
// ponytail: three fixed candidates, not a generated set. These are what a librarian reaches for
// first, they are checkable by eye, and they are the three the relevance ranking actually punishes
// you for omitting. A model-drafted narrowing would cost a call, arrive unverifiable, and STILL
// have to be priced by the same count below. Ceiling: if librarians keep hand-adding the same
// fourth block, add it here — do not reach for the model.
export type Narrowing = {
    label: string        // "Randomized trials only"
    why: string          // one clause: why this helps
    terms: string        // the block to AND in. Fully tagged PubMed syntax; no parens, no AND.
    hits: number         // the yield IF it is applied. COUNTED, never estimated.
}

// `skip` is tested against the ASSEMBLED QUERY — what is being searched right now, not what is
// written on the page. An unticked line restricts nothing, so a strategy carrying an unticked RCT
// line still gets offered the RCT narrowing. Offering a block the query already contains would
// price it at a delta of zero, which is noise dressed up as advice.
const NARROWINGS = () => {
    // Read at search time, never at import — a pod that stays up over New Year would otherwise
    // offer last year's window. Same rule as dateLimits().
    const y = new Date().getFullYear()
    return [
        {
            label: 'Randomized trials only',
            why: 'relevance ranking favours reviews; this is what keeps them out of the 50',
            terms: 'Randomized Controlled Trial[pt] OR Controlled Clinical Trial[pt]',
            skip: /randomi[sz]ed controlled trial\s*\[/i,
        },
        {
            label: 'Humans only',
            why: 'drops animal and preclinical work',
            terms: 'Humans[MeSH]',
            skip: /"?humans"?\s*\[(?:mesh|mh)/i,
        },
        {
            // Offered ONLY when no date limit is set, hence the [dp] skip: the dropdown already
            // owns that decision, and a second, differently-worded date filter AND-ed on top of
            // the first is how a librarian ends up unable to explain their own query.
            label: 'Last 5 years',
            why: 'the recent literature, where a rapid review usually lives',
            terms: `${y - 5}:${y}[dp]`,
            skip: /\[dp\]/i,
        },
    ]
}

// A narrowing is AND-ed in as a new concept block, ticked, at the end of the strategy — which is
// exactly what the client does when the librarian ticks it. So the number we quote is the price of
// that click and nothing else. AND-ed, never OR-ed: a restriction only restricts if it is alone in
// its own block, which is the lesson hoistFilters was written to enforce.
const withBlock = (s: Strategy, label: string, terms: string): Strategy => ({
    ...s,
    concepts: [...s.concepts, { label, lines: [{ terms, on: true }] }],
})

export async function suggestNarrowings(s: Strategy, baseHits?: number): Promise<Narrowing[]> {
    const query = assembleQuery(s)
    if (!query) return []       // nothing ticked is not a broad search, it is no search

    // The caller has almost always just counted this (runReview has), and counting it again would
    // spend a fourth call on a number we already hold — in a burst, against an unkeyed NCBI, which
    // is exactly how countPubmed's throttled zero happens.
    const base = baseHits ?? await countPubmed(query)

    const out: Narrowing[] = []
    // SEQUENTIAL, not Promise.all. Three counts fired at once IS the three-requests-per-second an
    // unkeyed NCBI allows, and a throttled esearch comes back as a well-formed 0 — which here would
    // read as "this narrowing would leave you with nothing".
    for (const c of NARROWINGS()) {
        if (c.skip.test(query)) continue        // already in the query: it would price at zero

        const hits = await countPubmed(assembleQuery(withBlock(s, c.label, c.terms)))

        // AND-ing a block can only ever REMOVE records, so `hits <= base` is arithmetic, not a
        // hope — the same invariant suggestFixes enforces in the other direction. Two ways a
        // candidate fails it, and neither is publishable:
        //
        //   hits >  base    IMPOSSIBLE. The maths is not wrong, THE COUNT IS (a throttled esearch
        //                   returns a well-formed number — see countPubmed). Never show it.
        //   hits === base   the block excludes nothing: every record already satisfies it. The
        //                   panel would say "narrow this: 1,391 -> 1,391". USELESS ADVICE IS WORSE
        //                   THAN NONE — it is a checkbox that costs a click and buys nothing.
        //
        // Either way the candidate is DROPPED, and dropped OUT LOUD. Same principle as suggestFixes
        // refusing to publish a widening that does not retrieve the seed. A candidate that vanished
        // silently is how a panel quietly stops offering anything and nobody notices.
        //
        // A narrowing that lands on ZERO is KEPT, on purpose: "1,391 -> 0" is the most useful thing
        // this panel can say about a literature that contains no trials, and the librarian can see
        // it and decline to tick it. Hiding it would hide the finding.
        if (hits >= base) {
            console.log(JSON.stringify({
                tag: 'literature-narrowing-dropped',
                label: c.label, baseHits: base, hits,
                why: hits > base
                    ? 'AND-ing a block cannot GROW the result set — the count is untrustworthy'
                    : 'this block excludes nothing from the current query, so it is not a narrowing',
            }))
            continue
        }

        out.push({ label: c.label, why: c.why, terms: c.terms, hits })
    }

    console.log(JSON.stringify({
        tag: 'literature-narrowings',
        baseHits: base,
        offered: out.map(n => `${n.label}: ${base} -> ${n.hits}`),
    }))
    return out
}

// ---------------------------------------------------------------------------
// Phase 1 of the mode: the strategy, its count, and — if the count says the top 50 would be a
// defensible slice of it — the records. In that order, and the order is the point.
//
// We COUNT before we FETCH, but what the count buys is no longer PERMISSION (the tool will fetch
// the top 50 of anything). It buys HONESTY. Above NARROW_ABOVE we hand back the strategy, the
// number, and the priced narrowings instead of a slice nobody asked to be a slice — a librarian
// cannot narrow a query they were never shown, and cannot judge a top-50 they were never told was
// a top-50.
//
// `proceed` is the escape hatch, and it is not optional. It skips the gate at any count and
// retrieves the 50 regardless: the librarian may know exactly what they are doing, and a tool that
// refuses to run is worse than one that warns.
export type ReviewResult = StrategyResult & {
    records: PubRecord[]
    sort: Sort
    needsNarrowing?: boolean
    narrowings?: Narrowing[]
}

export async function runReview(s: Strategy, sort: Sort, proceed = false): Promise<ReviewResult> {
    const query = assembleQuery(s)
    // Nothing ticked is not "0 hits", it is "there is no strategy" — same rule as runStrategy.
    const hits = query ? await countPubmed(query) : 0

    const base = {
        db: s.db,
        concepts: s.concepts,
        limits: s.limits,
        query,
        hits,
        runDate: new Date().toISOString().slice(0, 10),
        seeds: [] as SeedResult[],    // Mode 2 has no known-item seeds; the array keeps one shape
        sort,
    }
    if (!query || hits === 0) return { ...base, records: [] }

    if (hits > NARROW_ABOVE && !proceed) {
        return {
            ...base,
            records: [],
            needsNarrowing: true,
            narrowings: await suggestNarrowings(s, hits),
        }
    }

    // The NIH percentile is attached HERE and only here — on the retrieval path, where a human is
    // about to read the rows. fetchByPmids() (the screen and synthesize re-fetches) deliberately
    // does NOT enrich, because those records exist to be fed to a model, and a citation percentile
    // is not evidence. See withCitationMetrics().
    return { ...base, records: await withCitationMetrics(await fetchRecords(query, RECORD_CAP, sort)) }
}
