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
    Db,
    Concept,
    Rendering,
    Strategy,
    Dialect,
    DIALECTS,
    Seed,
    SeedKind,
    parseSeeds,
    Pico,
    RECORD_CAP,
    NARROW_ABOVE,
    MAX_CONCEPTS,
    MAX_LINES,
    MAX_TERMS,
    assembleQuery,
    conceptQuery,
    conceptsOf,
    buildLimits,
    numberStrategy,
    picoQuestion,
    picoComplete,
} from './literatureSearch.strategy'

// Re-exported so the check script and the API route have one import site.
export {
    assembleQuery, conceptQuery, conceptsOf, buildLimits, numberStrategy, parseSeeds,
    picoQuestion, picoComplete, DIALECTS, RECORD_CAP, NARROW_ABOVE,
    MAX_CONCEPTS, MAX_LINES, MAX_TERMS,
}
export type { Line, Db, Concept, Rendering, Strategy, Dialect, Seed, SeedKind, Pico }

export type SeedResult = {
    id: string
    kind: SeedKind                  // 'pmid' | 'doi' — NOT a PMID by assumption. See Seed.
    label?: string                  // "Nikolova (2023)" — see seedRecords()
    retrieved: boolean
    // THE MISS THAT IS NOT A BUG. The record is not in this database AT ALL, so no widening of any
    // block will ever retrieve it. Distinguishing this from "your strategy excludes it" is the
    // difference between "Scopus does not index this paper" — a fact about Scopus, and often the
    // most interesting thing on the screen — and sending a librarian off to widen a search that
    // cannot possibly return it.
    notInDatabase?: boolean
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

// The Scopus count. Same contract as countPubmed — a query in, a total out — through the ReCiter
// Scopus Retrieval Tool, which holds the Elsevier key (PR #797 moved it out of this app, and it
// must never come back).
//
// TWO THINGS HERE ARE NOT PREFERENCES, THEY ARE ELSEVIER'S BEHAVIOUR, PROBED LIVE:
//
//   count=1, NEVER count=0. Elsevier IGNORES count=0 and silently returns 25 records — so asking
//   for "no records, just the total" the obvious way bills a page and hands you one, with nothing
//   in the response to say so. count=1 returns the true opensearch:totalResults for one record.
//
//   The QUERY GOES THROUGH VERBATIM. That is the whole reason the tool needed a new endpoint
//   (ScopusTool #35): the old /scopus/search/documents force-wraps every term in TITLE-ABS-KEY(),
//   which makes a top-level limit (AND PUBYEAR > 2020) impossible to express — nested inside the
//   wrap, Elsevier answers 400 "Error translating query".
//
// No zero-retry here, unlike PubMed. PubMed's zero-retry exists because a THROTTLED NCBI returns a
// well-formed 0 that is indistinguishable from a genuine one. Elsevier answers a rate-limit with a
// 429 and a quota header — a real error, which the tool turns into a 502 and this throws on. Do not
// add a retry to paper over an error that is already loud.
export async function countScopus(query: string): Promise<number> {
    const res = await fetch(reciterConfig.reciterScopus.searchQueryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'reciter-pub-manager-server' },
        body: JSON.stringify({ query, count: 1 }),
    })
    if (!res.ok) throw new Error(`scopus retrieval tool HTTP ${res.status}`)
    const data: any = await res.json()

    const raw = data?.['search-results']?.['opensearch:totalResults']
    const n = Number(raw)
    // Same rule as countPubmed: a payload we cannot read is an ERROR, never a zero. Coercing an
    // unexpected shape to 0 would report "your search found nothing" for a broken integration.
    if (raw === undefined || raw === null || !Number.isFinite(n)) {
        throw new Error(`unexpected scopus count payload: ${JSON.stringify(data).slice(0, 120)}`)
    }
    return n
}

/**
 * Counting, by database. The ONE place that knows a database has a counter.
 *
 * An UNCOUNTABLE database (Embase via Ovid — no API on any platform) has no counter, and this THROWS
 * rather than falling through to PubMed's. A `db === 'scopus' ? scopus : pubmed` ternary would have
 * quietly counted an Ovid/Emtree query against PubMed and printed the answer next to the Embase
 * strategy: a number that is not wrong so much as about a different database entirely, which is the
 * worst thing this feature knows how to do. Callers must check `DIALECTS[db].countable` first.
 */
export const countIn = (db: Db) => {
    if (!DIALECTS[db].countable) {
        throw new Error(`${DIALECTS[db].name} cannot be counted from here — there is no API for it.`)
    }
    return db === 'scopus' ? countScopus : countPubmed
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
export async function validateSeeds(s: Strategy, seeds: Seed[]): Promise<SeedResult[]> {
    const query = assembleQuery(s)
    const dialect = DIALECTS[s.db]
    const count = countIn(s.db)
    const out: SeedResult[] = []

    for (const seed of seeds) {
        const { id, kind } = seed
        const ref = dialect.seedQuery(seed)      // `123[uid]` / `PMID(123)` / `DOI(10.x/y)`

        // Everything unticked: there is no strategy to validate against, and `<ref> AND ()` is not
        // a query. Say so rather than counting nothing.
        if (!query) {
            out.push({ id, kind, retrieved: false, failingConcepts: [], failsLimits: false })
            continue
        }

        const hit = await count(`${ref} AND (${query})`)
        if (hit >= 1) {
            out.push({ id, kind, retrieved: true })
            continue
        }

        // MISS — and the FIRST question is whether this database has the paper at all. Ask before
        // blaming a concept block: a seed Scopus has never indexed will "fail" every block, which
        // reads as a catastrophically narrow strategy and is nothing of the sort. This costs one
        // count and it is the difference between a real diagnosis and a misleading one.
        if ((await count(ref)) === 0) {
            out.push({ id, kind, retrieved: false, notInDatabase: true })
            continue
        }

        // It IS in the database, so something in the strategy excluded it. Work out WHAT, by
        // re-counting the seed against each part of the strategy on its own. Deterministic: the
        // parts that return 0 are the culprits, and a seed can fail several of them at once.
        const failing: number[] = []
        for (let i = 0; i < s.concepts.length; i++) {
            const block = conceptQuery(s.concepts[i])
            if (!block) continue          // an unticked concept is not in the AND, so it excludes nothing
            const inBlock = await count(`${ref} AND (${block})`)
            if (inBlock === 0) failing.push(i)
        }
        // The limits are checked SEPARATELY, not inferred from "no block failed". A paper can
        // fail a block and the limits together, and only naming the block would send the
        // librarian off to widen a search that still cannot return it.
        const failsLimits = s.limits
            ? (await count(`${ref} AND ${s.limits}`)) === 0
            : false

        out.push({ id, kind, retrieved: false, failingConcepts: failing, failsLimits })
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
    db: Db
    dbName: string                 // 'PubMed' / 'Scopus' — the screen and the export both need it
    concepts: Rendering[]          // THIS database's rendering. Labels are shared; lines are not.
    limits: string
    // The limits this database CANNOT express, by name ("RCT only"). Never silently empty: if the
    // librarian asked for RCTs and Scopus has no RCT document type, the Scopus count beside the
    // PubMed one answers a BROADER question, and the screen has to say so or the two numbers are
    // not comparable. An unexpressed limit that nobody mentions is a lie of omission.
    unsupportedLimits: string[]
    query: string
    // NULL means "we cannot count this database" — Embase (Ovid), which we have no API for. It is NOT
    // zero, and the difference is the whole feature: 0 records is a finding, "not counted" is an
    // absence. The type is nullable precisely so that every render and export site is FORCED by the
    // compiler to say which one it is looking at.
    hits: number | null
    // One record count per PRESS line number — the Results column of a search history. See
    // countRows(). Keyed by the DERIVED line number, so it renumbers with the selection and can
    // never describe a line that was not searched.
    rowCounts: Record<number, number>
    runDate: string
    seeds: SeedResult[]
}

// THE RESULTS COLUMN — one record count per numbered line, which is how a search history is read.
//
// This is what PubMed's own Advanced Search history shows, and it is the thing that makes a strategy
// legible: line 1 retrieves 40,000, line 2 retrieves 9,000, and 3 AND 6 collapses to 122 — the
// funnel IS the argument, and a strategy without it is a wall of Boolean the librarian has to run in
// their head.
//
// IT IS NOT FREE, AND WHO PAYS IS THE WHOLE POINT. Each row is a separate count call — the count of
// `1 OR 2` cannot be derived from the counts of 1 and 2 — so a 7-row strategy costs 7 calls, and the
// PubMed Retrieval Tool paces every call at 500ms (it smooths each pod to 2 req/s so that 4 HPA
// replicas stay under NCBI's ~10/s keyed quota, shared with the ReCiter engine). MEASURED: 7 counts
// = 5.5 SECONDS.
//
// That is why this is a SEPARATE CALL from the yield, and it is the whole reason Mode 1 still feels
// like Mode 1. Ticking a checkbox re-counts the YIELD in one call, as it always did — the loop this
// mode is built around ("tick, untick, it re-counts for free") is untouched — and the Results column
// then fills in behind it. Folding these 7 calls into runStrategy would have put 5.5 seconds between
// a librarian's click and the number they clicked for.
//
// DO NOT PARALLELISE THEM. It buys nothing: the tool's limiter serialises them inside the pod
// anyway, so they would queue rather than run, and firing a burst only takes the shared NCBI budget
// away from everything else on the same key. The tool OWNS the rate policy — it knows the pod count
// and whether a key is set, and RPM does not. Do not put a second, worse-informed copy of that
// policy here.
//
// The LAST row's query IS assembleQuery(s), so its count IS the yield — passed in, never counted
// twice, which is also what makes it impossible for the number beside the final line and the number
// at the top of the panel to disagree.
//
// ponytail: no cache. A memo keyed on the query text would help a librarian who unticks and re-ticks
// the same line — but a strategy is edited far more often than it is reverted, and a stale count
// beside a line is the exact lie this feature exists to prevent. Add one only if a librarian
// complains about the wait, and key it on the exact query string.
export async function countRows(s: Strategy, hits: number): Promise<Record<number, number>> {
    const count = countIn(s.db)
    const { rows } = numberStrategy(s)
    const out: Record<number, number> = {}

    for (const row of rows) {
        if (row.n === null || !row.query.trim()) continue
        // The final row is the whole search, which we have already counted. Never pay twice.
        if (row.query === assembleQuery(s)) { out[row.n] = hits; continue }
        out[row.n] = await count(`(${row.query})`)
    }
    return out
}

export async function runStrategy(s: Strategy, seeds: Seed[], unsupportedLimits: string[] = []): Promise<StrategyResult> {
    const query = assembleQuery(s)
    const dialect = DIALECTS[s.db]

    // AN UNCOUNTABLE DATABASE PRODUCES NO NUMBERS AT ALL. Embase (Ovid): we have no API, so there is
    // nothing here to count with and nothing to check a seed against. Every one of those is NULL or
    // EMPTY — never zero, never an empty seed list that reads as "none of them came back". The
    // strategy is the deliverable; the librarian runs it.
    if (!dialect.countable) {
        return {
            db: s.db,
            dbName: dialect.name,
            concepts: s.concepts,
            limits: s.limits,
            unsupportedLimits,
            query,
            hits: null,
            rowCounts: {},
            runDate: new Date().toISOString().slice(0, 10),
            seeds: [],
        }
    }

    // Everything unticked. Don't ask the database to count the empty string — it is not a "0 hits"
    // result, it is "you have no strategy", and conflating the two is how a librarian ends up
    // trusting a count that describes nothing.
    //
    // IT THROWS. It used to return `hits: 0`, which is the same lie the build path was just fixed to
    // stop telling, arriving by the other door: a librarian who unticks every line got a panel that
    // confidently printed "0 records", styled identically to a real count, with Copy PRISMA-S and
    // the exports live over it. Null would have worked too, but null is Embase's "cannot be counted"
    // and every render site already reads it that way — an empty selection is not an uncountable
    // database, and the client is not this agent's to teach a third state to. A throw is what the
    // re-count path already handles.
    if (!query) throw new Error('nothing is ticked, so there is no strategy to count')
    const hits = await countIn(s.db)(query)
    // The Results column is NOT computed here — it is 7 calls and 5.5 seconds, and it would sit
    // between a librarian's click and the yield they clicked for. It is fetched separately, and the
    // column fills in behind the number. See countRows().
    const seedResults = await validateSeeds(s, seeds)
    return {
        db: s.db,
        dbName: dialect.name,
        concepts: s.concepts,
        limits: s.limits,
        unsupportedLimits,
        query,
        hits,
        rowCounts: {},          // filled in by the separate rows call
        runDate: new Date().toISOString().slice(0, 10),
        seeds: seedResults,
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
// A TOOL TOO OLD TO RANK. Not a fetch failure — a truth failure, so it must never be swallowed into
// an empty list the way a network error is.
class StalePubmedTool extends Error {}

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

        // THE CAPABILITY SIGNAL WE WERE THROWING AWAY.
        //
        // `retmax` and `sort` are sent as JSON fields. Against a retrieval tool that predates them,
        // Jackson drops both SILENTLY (FAIL_ON_UNKNOWN_PROPERTIES is off) — no 4xx, no warning — and
        // the tool runs its own default esearch. The old code then `.slice(0, cap)`d the result and
        // handed back an UNRANKED slice, while the UI and the exported methods table went on
        // asserting "the top 50, ranked by most relevant" as fact. That is the cardinal sin with a
        // deploy-ordering trigger: it looks perfect on a laptop running the new jar.
        //
        // But the response tells us. If the tool honoured `retmax` it cannot return more than `cap`;
        // if it ignored `retmax` it ignored `sort` too, because they arrive in the same object. So a
        // long list is proof the ranking claim is false — and a false claim is worse than no answer.
        // Fail loudly (502) rather than degrade, because there is no honest degraded mode here: the
        // whole promise of Modes 2/3 is that the 50 are the TOP 50.
        //
        // ponytail: a free signal already in the response, not a version probe. Ceiling — it only
        // fires when the tool's own default retmax exceeds `cap`; an old jar that happens to default
        // BELOW the cap returns a short list and slips through. Upgrade path if that ever bites: have
        // the tool echo the applied retmax/sort in its response and assert on it. A seed fetch cannot
        // false-positive: a uid query cannot return more records than it names.
        if (Array.isArray(data) && data.length > cap) {
            throw new StalePubmedTool(
                `The PubMed retrieval tool ignored the ranking request (it returned ${data.length} records for a cap of ${cap}), `
                + 'so "the top 50, by most relevant" would not be true of them. Deploy the sort/retmax build of the tool before using this mode.',
            )
        }
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
        // The stale-tool verdict is the one thing here that must NOT become an empty list: an empty
        // list reads as "no records matched", which is a different lie.
        if (e instanceof StalePubmedTool) throw e
        // Loud, not silent. A silent degradation here is how a page that quietly shows nothing
        // goes unnoticed for a year.
        console.error('[literature] record fetch failed:', query.slice(0, 120), e)
        return []
    }
}

// Keyed by SEED ID, and PubMed-only.
//
// ponytail: PMID seeds only. A DOI seed is perfectly checkable — `10.x/y[aid]` counts fine, and
// validateSeeds uses it — but matching the RETURNED record back to the DOI that asked for it means
// digging the DOI out of PubMed's articleid list, and all this buys is a prettier label and a
// suggested fix. A DOI seed keeps its own DOI as its label and gets no auto-widening; the diagnosis
// (which block excluded it, or that the database does not have it) is unaffected, and that is the
// part that matters. Upgrade when a librarian actually seeds by DOI and misses the label.
export async function seedRecords(seeds: Seed[]): Promise<Record<string, SeedRecord>> {
    const ids = seeds.filter(s => s.kind === 'pmid').map(s => s.id)
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

// TWO TYPES THAT OVERRIDE EVERY OTHER TYPE ON THE RECORD, and so must be tested BEFORE the table.
//
// A RETRACTED TRIAL IS STILL TAGGED "Randomized Controlled Trial". PubMed adds "Retracted
// Publication" alongside the original types rather than replacing them — so first-match-wins found
// the RCT, ranked it 3, and sorted a withdrawn paper to the TOP of a clinical answer, where Mode 3
// then led with it. That is the worst output this feature can produce: not a wrong number, a
// retracted one, presented as the strongest evidence available.
const RETRACTED: Tier = { rank: 9, label: 'RETRACTED', phrase: 'a RETRACTED publication, which must not be relied on' }

// A PROTOCOL REPORTS NO RESULTS AT ALL. "Clinical Trial Protocol" startsWith "clinical trial", so it
// matched the rank-4 interventional tier and could set the evidence floor — announcing "the strongest
// evidence retrieved is a non-randomized clinical trial" on the strength of a paper describing a
// trial that has not happened yet.
const PROTOCOL: Tier = { rank: 8, label: 'Protocol', phrase: 'a trial protocol, which reports no results' }

// First match wins, and the table is ordered strongest-first, because the types OVERLAP by design:
// a meta-analysis is also tagged "Systematic Review" and "Review"; an RCT is also tagged "Clinical
// Trial" and "Journal Article". The strongest TRUE label is the one that shows.
export function tierOf(types: string[]): Tier {
    const t = (types || []).map(x => String(x || '').trim().toLowerCase())

    // The two overrides, strongest claim first: retraction beats everything, including a protocol.
    if (t.some(x => x.startsWith('retracted publication'))) return RETRACTED
    if (t.some(x => x.startsWith('clinical trial protocol'))) return PROTOCOL

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

// BEDROCK HAS ALREADY BILLED THE CALL BY THE TIME WE DECIDE TO REJECT ITS ANSWER — input tokens AND
// output tokens, truncated or not. A bare `throw` loses that number on its way out (the usage only
// ever leaves these functions on the RETURN), so the route's hoisted total stays {0,0} and logCost
// affirmatively writes a ZERO for a run that cost real money: the exact silent billing the hoist was
// added to prevent, reintroduced by the guard that refuses the answer. So every throw that happens
// AFTER a model call has returned carries the spend on the error, and the route's per-database catch
// folds `err.usage` into its running total before it logs. Shape is UsageLog, matching the returns.
const billed = (message: string, usage: UsageLog) => Object.assign(new Error(message), { usage })

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

    // Read BEFORE the refusal below, because a truncated answer is a BILLED answer. See billed().
    const usage: UsageLog = {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
    }

    // A max_tokens cut lands MID-tool_use, and what comes back is still perfectly parseable — the
    // verdicts array is simply SHORT, the strategy is simply missing its last block. Nothing
    // downstream can tell that apart from a model that had nothing more to say: screenRecords()
    // fails each absent verdict OPEN, so the unscreened records reach the librarian pre-ticked and
    // visually identical to endorsed ones, wearing an AI endorsement nobody wrote. So refuse the
    // whole answer. A 502 they can see and re-run beats a short answer they cannot see at all.
    if (data.stop_reason === 'max_tokens') {
        throw billed(`the model's answer was cut off at the ${maxTokens}-token ceiling, so it is incomplete and cannot be trusted`, usage)
    }

    const block = (data.content || []).find((c: any) => c.type === 'tool_use')
    return { input: block?.input, usage }
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
    description: 'Return the finished search strategy as PRESS-numbered concept blocks, in the syntax of the database named in the system prompt.',
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

// SCOPUS IS A DIFFERENT DATABASE, SO IT GETS A DIFFERENT PROMPT — NOT A TRANSLATION OF THIS ONE.
//
// This is the load-bearing decision of the whole multi-database design, and it is easy to get
// wrong in a way that looks efficient. The tempting move is to take the PubMed strategy and map it
// across: "Depression"[MeSH] -> some Scopus equivalent, [tiab] -> TITLE-ABS-KEY. There IS no Scopus
// equivalent of a MeSH descriptor — Scopus HAS NO CONTROLLED VOCABULARY AT ALL — so the map would
// have to invent one, and a mechanical transliteration is exactly the artifact a librarian rejects
// at PRESS review. Cochrane expects a bespoke, separately peer-reviewed strategy per database.
//
// So the model writes NATIVE SCOPUS, from the ORIGINAL QUESTION, sharing only the concept LABELS
// with the PubMed strategy — which is how a human can see that both searches are about the same
// three ideas without either being derived from the other.
//
// AND THE HONEST CONSEQUENCE, which belongs in front of the librarian rather than buried here: with
// no controlled-vocabulary arm, the Scopus rendering of a concept is FAITHFULLY THE SAME IDEA AND
// SYSTEMATICALLY LESS SENSITIVE than the PubMed one. For a systematic review, where recall is the
// cardinal virtue, that is a methodological cost no engineering can remove. Scopus is a
// SUPPLEMENTARY database here, not a PubMed-equivalent one.
const SCOPUS_PROMPT = `You are a medical reference librarian drafting a Scopus search strategy for a systematic review.

Your objective is RECALL (sensitivity), not precision:
- A yield in the thousands is SUCCESS, not a problem. Do not try to keep the result set small.
- Missing a relevant study is the cardinal sin. Retrieving irrelevant ones is fine — a human screens them later.

SCOPUS HAS NO CONTROLLED VOCABULARY. There is no MeSH, no Emtree, and nothing to explode. Do NOT emit MeSH descriptors, [MeSH], [tiab], [majr], or any other PubMed field tag — they are not valid Scopus syntax and the search will fail or, worse, silently return the wrong thing. Everything is free text, and that means the free-text line must carry the entire concept ON ITS OWN: every synonym, every spelling variant, every abbreviation, and the truncations. Be more generous than you would be in PubMed, because there is no controlled-vocabulary arm to catch what the free text misses.

Structure the search as CONCEPT BLOCKS, one per idea in the question (typically 2-4). They will be AND-ed together.

Write each concept block as SEPARATE LINES, so that each can be peer-reviewed and toggled independently — for example one line for the core terms and one for the broader or adjacent synonyms. The lines within a block are OR-ed; the blocks are AND-ed.

Use Scopus field syntax, and nothing else:
- TITLE-ABS-KEY(...) searches title, abstract and keywords. This is your workhorse; anchor essentially everything in it.
- TITLE(...), ABS(...), AUTHKEY(...) are available if a term genuinely belongs in one field only.
- Quote phrases: TITLE-ABS-KEY("gut microbiome"). Truncate with *: probiotic*.
- Inside a field you may use OR and AND, e.g. TITLE-ABS-KEY(probiotic* OR synbiotic* OR "gut microbiota").

Date and document-type limits are supplied by the caller and applied separately, at the top level. NEVER put PUBYEAR, DOCTYPE, LANGUAGE or SRCTYPE inside a concept block.

Return the strategy only.`

// EMBASE VIA OVID. Its own prompt, never a translation of the PubMed one — see THE SPLIT. The syntax
// rules below are not stylistic: Ovid REJECTS Elsevier's Embase.com dialect outright ("Invalid
// subheading: exp"), so a strategy in the wrong platform's language is not a worse strategy, it is a
// strategy that does not run at all.
const EMBASE_PROMPT = `You are a medical reference librarian drafting an Embase search strategy for a systematic review.

The search will be run on EMBASE VIA THE OVID PLATFORM (OvidSP). Ovid's query language is NOT the same as Embase.com's, even though both search Embase and both use the Emtree thesaurus. You must write OVID syntax.

Your objective is RECALL (sensitivity), not precision:
- A yield in the thousands is SUCCESS, not a problem. Do not try to keep the result set small.
- Missing a relevant study is the cardinal sin. Retrieving irrelevant ones is fine — a human screens them later.

EMBASE'S CONTROLLED VOCABULARY IS EMTREE. It is NOT MeSH. Do NOT emit MeSH descriptors, [MeSH], [tiab], [majr], [pt], or Scopus syntax such as TITLE-ABS-KEY. Do NOT emit Embase.com syntax: 'term'/exp and term:ti,ab,kw are ELSEVIER syntax and Ovid REJECTS them.

Use OVID syntax, and nothing else:
- Explode an Emtree heading with the exp prefix and a TRAILING SLASH: exp probiotic agent/
- A heading without explosion is just the trailing slash: probiotic agent/
- Free text is field-tagged with a TRAILING period: probiotic*.ti,ab,kw.
  (.ti = title, .ab = abstract, .kw = keyword. The trailing period is REQUIRED.)
- Truncate with *: probiotic*
- Multi-word free-text phrases take NO quotes; use adjacency instead: (gut adj3 microbiome).ti,ab,kw.
- Combine with and / or / not.

EVERY EMTREE HEADING YOU EMIT MUST BE A REAL EMTREE PREFERRED TERM. A heading that does not exist retrieves ZERO records in Ovid — silently, with no error — and it will contribute nothing to the block it sits in. Emtree's preferred terms often differ from MeSH: Emtree uses 'probiotic agent', not 'Probiotics'. If you are not confident a heading is a real Emtree preferred term, DO NOT emit it — put the concept in the free-text line instead, where a wrong guess costs nothing.

Structure the search as CONCEPT BLOCKS, one per idea in the question (typically 2-4). They will be AND-ed together.

GIVE EACH BLOCK EXACTLY TWO LINES: one line of Emtree headings, then one line of free text. This is not cosmetic. Nobody can count this database for the librarian, so the ONLY way to find a dead Emtree heading is to run the heading line on its own in Ovid — which is possible only if it IS its own line. Keeping the two arms separate also means that if a heading is dead, the free-text line beside it still carries the concept.

Date and publication-type limits are applied by the librarian in Ovid's own Limits panel, not in the query. NEVER put them inside a concept block.

Return the strategy only.`

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

// THE MODEL'S ANSWER IS INPUT TOO, AND IT GETS THE SAME BOUNDS THE BROWSER'S DOES.
//
// The route bounds the strategy the browser POSTS BACK for a re-count; nothing bounded what the
// model RETURNED. So the server could build, count and render a strategy it would then REFUSE to
// re-count — a 502 on every subsequent toggle, on the rows phase, and on Mode 2's escape hatch,
// against a strategy the librarian has already been billed for. What we BUILD has to be something
// we can later RE-COUNT, which means one set of ceilings, enforced in both directions.
//
// IT THROWS RATHER THAN TRUNCATING, and that is the whole decision. Dropping a 13th concept block
// or a 26th line does not "clamp" a search strategy, it changes what the search MEANS: a dropped
// AND-ed block silently broadens the yield, a dropped term line silently costs recall, and clipping
// a line at 2,000 characters can cut a term mid-Boolean and leave a query that no longer parses.
// The librarian would get a strategy, a count and a PRESS table that all agree with each other and
// disagree with the search they asked for — a confident wrong answer, which is the one thing this
// mode may never produce. A 502 is visible, and the model is not deterministic: a re-run lands in
// bounds.
//
// It runs AFTER the empty-line filter and AFTER hoistFilters, because both change the shape: the
// filter can empty a concept the model returned with `lines: []`, and hoistFilters ADDS the Humans
// block — so a 12-concept answer can leave this function as 13.
//
// Exported only so literatureSearch.check.js can assert it without an LLM: buildStrategy() cannot be
// driven from a check that makes no model call, and this is the half of it that has to be true.
export function checkStrategy(s: Strategy): void {
    // AND THIS IS WHERE THE EMPTINESS GUARD BELONGS. It used to fire on the RAW model input, ten
    // lines before the filter that can empty it — so a model answering `lines: []` produced a
    // ZERO-CONCEPT strategy, which assembleQuery() renders as '' and runStrategy() then reports as
    // `hits: 0`: a confident zero for a search that does not exist.
    if (!s.concepts.length) throw new Error('model did not return a usable strategy')
    if (s.concepts.length > MAX_CONCEPTS) {
        throw new Error(`model returned ${s.concepts.length} concept blocks; at most ${MAX_CONCEPTS} can be re-counted`)
    }
    for (const c of s.concepts) {
        if (c.lines.length > MAX_LINES) {
            throw new Error(`model returned ${c.lines.length} lines in one concept block; at most ${MAX_LINES} can be re-counted`)
        }
        for (const l of c.lines) {
            if (l.terms.length > MAX_TERMS) throw new Error('model returned a term line that is too long to be re-counted')
        }
    }
}

export async function buildStrategy(
    question: string,
    limits: string,
    criteria?: string,
    objective: 'recall' | 'precision' = 'recall',
    pico?: Pico,
    db: Db = 'pubmed',
    // The concept LABELS the sibling strategy used, when there is one. This is the ONLY thing that
    // crosses a database boundary, and passing it is not a translation: the model still writes
    // native Scopus from the ORIGINAL QUESTION, and the labels only keep the two strategies talking
    // about the same three ideas so a human can read them side by side. Never pass the LINES.
    sharedConcepts?: Concept[],
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

    // The shared spine, and ONLY the spine. The model is told which ideas the other database's
    // strategy is built from, and writes this database's own expression of them from scratch.
    if (sharedConcepts?.length) {
        parts.push(
            `A strategy for another database has already been drafted for this question from the ` +
            `following concepts. Use the SAME concepts, with the SAME labels, in the same order, so ` +
            `that the two strategies are about the same ideas:\n\n` +
            sharedConcepts.map(c => `- ${c.label}`).join('\n') + `\n\n` +
            `Write this database's terms FROM THE QUESTION. You have not been shown the other ` +
            `database's terms and you do not need them: do not attempt to reproduce or translate ` +
            `another database's syntax.`,
        )
    }

    // Scopus and Embase each get their OWN prompt, never a translation of PubMed's. Mode 1 (recall) is
    // the only mode either is offered in — see the route — so there is no precision variant to prompt
    // for on those two.
    const prompt = db === 'scopus' ? SCOPUS_PROMPT
        : db === 'embase' ? EMBASE_PROMPT
            : (objective === 'precision' ? REVIEW_PROMPT : SYSTEM_PROMPT)

    const { input, usage } = await invoke(prompt, STRATEGY_TOOL, parts.join('\n\n'))

    const strategy: Strategy = {
        db,
        concepts: (Array.isArray(input?.concepts) ? input.concepts : []).map((c: any) => ({
            label: String(c.label || ''),
            // Every line the model writes arrives TICKED. Untick is the librarian's move.
            lines: (Array.isArray(c.lines) ? c.lines : [c.lines])
                .filter((t: any) => typeof t === 'string' && t.trim())
                .map((t: string) => ({ terms: t.trim(), on: true })),
        })).filter((c: Rendering) => c.lines.length),
        limits,
    }

    // hoistFilters is PubMed-only, and not by oversight: the failure it repairs is a MeSH one
    // ("Humans"[MeSH] OR-ed in with real terms, silently satisfying its own block). Scopus has no
    // controlled vocabulary, so it has no Humans[MeSH] to bury — running a MeSH-shaped regex over a
    // Scopus strategy could only ever produce a false positive.
    const built = db === 'pubmed' ? hoistFilters(strategy) : strategy
    // The build is billed whether or not the answer it produced is usable, and checkStrategy throws
    // on exactly the answers that are not. Carry the spend out with the refusal — a rejected build
    // that logs {0,0} is the same silent billing as a truncated one. See billed().
    try {
        checkStrategy(built)
    } catch (e: any) {
        throw billed(e.message, usage)
    }
    return { strategy: built, usage }
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

    // PUBMED ONLY, and this is a limit of the FIX, not of the diagnosis. The whole method rests on
    // seeing the paper's MeSH descriptors — "this is indexed under Emotions, not Depression, so the
    // block needs Emotions[MeSH]". Scopus has no controlled vocabulary, so there is no such gap to
    // find and nothing of this shape to propose. A Scopus miss still gets its full DIAGNOSIS (which
    // block excluded it, or that Scopus does not index the paper at all); what it does not get is a
    // pre-written, verified, priced line. Proposing one blind is how the model ends up suggesting
    // "Bipolar Disorder" to fix a depression miss — see seedRecords.
    if (s.db !== 'pubmed') return { strategy: s, usage }

    // Only a CONCEPT miss has a fix of this shape. A limits-only miss is fixed by changing the
    // dropdowns, which the seed panel already says — a term line cannot help. Nor can one help a
    // paper the database does not have (notInDatabase), which is why that verdict short-circuits.
    //
    // And only a miss whose RECORD we actually have. Without the title and the MeSH descriptors
    // the model is guessing at a paper it cannot see, and it guesses badly (see seedRecords).
    // Proposing nothing is strictly better than proposing a plausible wrong answer with a
    // checkbox on it.
    const misses = result.seeds.filter(x => !x.retrieved && x.failingConcepts?.length && records[x.id])
    if (!misses.length) return { strategy: s, usage }

    let out = s
    for (const miss of misses) {
        const rec = records[miss.id]
        const blocks = miss.failingConcepts!
            .map(i => `Block ${i} ("${s.concepts[i].label}"):\n${s.concepts[i].lines.filter(l => l.on).map(l => l.terms).join('\n')}`)
            .join('\n\n')

        const { input, usage: u } = await invoke(FIX_PROMPT, FIX_TOOL,
            `Missed paper: ${miss.kind.toUpperCase()} ${miss.id} — ${rec.label}\n`
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

            const line: Line = { terms, on: false, suggestedFor: miss.id }
            const withLine: Strategy = {
                ...out,
                concepts: out.concepts.map((c, i) =>
                    i === ci ? { ...c, lines: [...c.lines, { ...line, on: true }] } : c),
            }

            // 0. AND IT STILL HAS TO FIT. checkStrategy ran on the strategy the model BUILT; this
            //    function then GROWS it, one line per missed seed per block, and four seeds all
            //    failing the same block is not exotic. A block pushed past MAX_LINES (or a term line
            //    past MAX_TERMS) yields a strategy the route will REFUSE to re-count — a 502 on every
            //    subsequent toggle, against a strategy the librarian has already paid for. Re-validate
            //    the strategy WITH the line in it, using the same validator both ends use, so there is
            //    one set of ceilings and no second copy of them to drift.
            //
            //    Dropping the suggestion is safe: the strategy still stands, the seed still shows as a
            //    miss with its diagnosis, and the librarian is one term line short of a fix they can
            //    write by hand. Appending it anyway breaks the search. Cheaper here than after the two
            //    counts below — a line we will never publish must not spend NCBI's quota being priced.
            try {
                checkStrategy(withLine)
            } catch (e: any) {
                console.log(JSON.stringify({
                    tag: 'literature-fix-rejected', seed: miss.id, conceptIndex: ci, terms,
                    why: `the fix would not fit: ${e.message}`,
                }))
                continue
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
            const retrieves = await countPubmed(`${miss.id}[uid] AND (${assembleQuery(withLine)})`)
            if (retrieves !== 1) {
                // Say so out loud. A proposal that vanishes without a trace is how a feature
                // quietly stops working — the page would show a miss with no fix and look fine.
                console.log(JSON.stringify({
                    tag: 'literature-fix-rejected', seed: miss.id, conceptIndex: ci, terms, retrieves,
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
                    tag: 'literature-price-impossible', seed: miss.id, conceptIndex: ci,
                    baseHits: result.hits, widenedHits,
                    why: 'a widening cannot shrink the result set — the count is untrustworthy, price withheld',
                }))
            }

            out = {
                ...out,
                concepts: out.concepts.map((c, i) => i === ci ? { ...c, lines: [...c.lines, line] } : c),
            }
            console.log(JSON.stringify({
                tag: 'literature-fix', seed: miss.id, conceptIndex: ci, terms, costRecords: line.costRecords ?? null,
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

// One first pass plus two re-asks. Three, not "until complete": a model that has skipped the same record
// twice is telling you something, and an unbounded loop over a paid call is how a screen quietly costs
// twenty dollars. Whatever is still missing after this falls open, visibly, with `screened: false`.
const SCREEN_ATTEMPTS = 3

export type Screened = {
    pmid: string
    include: boolean     // the AI SUGGESTION. The human's checkbox is separate client state.
    reason: string       // one clause: why excluded, or — if included — what qualifies it.
    design: string
    // FALSE MEANS NO MODEL EVER LOOKED AT THIS RECORD. Absent means it did.
    //
    // Without it, an include is an include: the fail-open record below carries a `reason` the page
    // never shows (the reason only renders on an EXCLUDE), so it arrives pre-ticked, indistinguishable
    // from a paper the model actually endorsed, and inflates the "N included" tally on its way into
    // the synthesis. It is the ONLY field that separates "the model read this and kept it" from "the
    // model never saw it", so it has to reach the client — the route returns `flags` verbatim, and
    // the page renders the reason whenever `!f.include || f.screened === false`.
    screened?: boolean
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

    const verdicts = new Map<string, any>()
    let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }

    // ASK, THEN ASK AGAIN FOR WHAT CAME BACK EMPTY.
    //
    // The model drops records. Not at random, and not because it ran out of tokens: measured on a live
    // 50-record batch it returned 43 verdicts, and the seven it omitted were positions 25-31 — a
    // CONTIGUOUS WINDOW OUT OF THE MIDDLE OF THE LIST. That is lost-in-the-middle, and it took whatever
    // sat in that window regardless of what the papers were. Four of the seven were studies a published
    // review had included.
    //
    // Two things follow, and they decide the shape of this function.
    //
    // A BIGGER OR BETTER MODEL CANNOT FIX THIS. We are already on the most capable one, and even a
    // better one would only drop three instead of seven — you would still not know which run was which.
    // But completeness is CHECKABLE: we know exactly which records came back without a verdict. A
    // requirement you can verify should be REPAIRED, not made more probable. So we re-ask for precisely
    // the records that were skipped, and we keep the fail-open floor underneath for anything that is
    // still missing when we stop.
    //
    // AND WE STILL DO NOT CHUNK THE FIRST PASS. Chunking would shrink the middle, but it never reaches
    // zero (a ten-record call can drop one too) and it screens each batch blind to the others, which is
    // how the same paper is excluded in batch 1 and included in batch 3. Re-asking only pays for the
    // failures, and it terminates.
    //
    // The re-ask IS itself a small blind batch, and that is a real cost, not a free one: the screen is
    // measurably STOCHASTIC on a borderline paper (in testing, one diagnostic-accuracy study was
    // excluded in one batch and included in another, on reasoning that was coherent both times). So a
    // record that lands in a re-ask may get a verdict it would not have got in the main pass. That is
    // accepted deliberately: an unstable verdict on a borderline paper is a judgement the librarian can
    // see, argue with, and untick. NO verdict at all is an unread paper wearing a tick, which is the
    // failure this whole work order exists to kill. A shaky answer beats a silent gap.
    let pending = records
    for (let attempt = 1; attempt <= SCREEN_ATTEMPTS && pending.length; attempt++) {
        const parts = [`Question: ${question}`]
        if (criteria) parts.push(`Inclusion/exclusion criteria: ${criteria}`)
        parts.push(`Screen all ${pending.length} records below. Return one verdict per record.\n\n${renderRecords(pending)}`)

        let input: any
        try {
            const res = await invoke(SCREEN_PROMPT, SCREEN_TOOL, parts.join('\n\n'), LONG_MAX_TOKENS)
            input = res.input
            usage = {
                inputTokens: usage.inputTokens + res.usage.inputTokens,
                outputTokens: usage.outputTokens + res.usage.outputTokens,
            }
        } catch (err: any) {
            // A FAILED RE-ASK MUST NOT DESTROY A SCREEN THAT MOSTLY WORKED. The first call is different:
            // if it throws we have no verdicts at all, and a screen of nothing is not a screen — let it
            // out to the route, with its billed usage, as a visible error. A later attempt failing just
            // means the stragglers stay unscreened, which is what the fail-open flag is FOR.
            if (attempt === 1) throw err
            usage = {
                inputTokens: usage.inputTokens + (err?.usage?.inputTokens || 0),
                outputTokens: usage.outputTokens + (err?.usage?.outputTokens || 0),
            }
            console.error(JSON.stringify({
                tag: 'literature-screen-reask-failed', attempt, left: pending.length,
                why: 're-ask threw; the remaining records stay unscreened and fail open',
            }))
            break
        }

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

        const before = pending.length
        pending = pending.filter(r => !verdicts.has(r.pmid))
        if (pending.length) {
            console.error(JSON.stringify({
                tag: 'literature-screen-reask', attempt, asked: before,
                answered: before - pending.length, reasking: pending.length,
            }))
        }
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
                // The fail-open default STAYS: an unscreened record must not be silently dropped
                // either. This flag is what stops it being silently KEPT — it is the difference
                // between an unread paper the librarian can see is unread, and one wearing an
                // endorsement no model gave it.
                screened: false,
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
// `invented` is the model's own contamination, carried ON THE WIRE rather than only into a pod log.
// A citation the reader can click has to be one the reader can check.
export type Synthesis = { table: SynthRow[]; prose: string; floor?: string; invented?: string[] }

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
    //
    // The row-level defence against the SAME lost-in-the-middle drop that afflicts the screen lives
    // below, where the model's omissions are backfilled from the records we already hold.
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

    // A PAPER THE LIBRARIAN SELECTED CANNOT VANISH FROM THE TABLE. The old code logged the drop and
    // shipped the short table anyway — so the document said "18 of 50 records were selected" above a
    // table with 16 rows, and the two papers the model quietly declined to describe were the ones
    // nobody would ever go looking for. Backfill them from the records we already hold, and let the
    // MISSING CELL be the visible thing rather than the missing row.
    const dropped = records.filter(r => !seen.has(r.pmid))
    if (dropped.length) {
        console.error(JSON.stringify({
            tag: 'literature-synth-missing-rows', pmids: dropped.map(r => r.pmid),
            why: 'the model left these selected papers out of the evidence table; backfilled from the record',
        }))
        for (const rec of dropped) {
            table.push({
                pmid: rec.pmid,
                study: rec.authors || `PMID ${rec.pmid}`,
                year: rec.year,
                journal: rec.journal,
                design: rec.design,
                rank: rec.tier.rank,
                intervention: '(not described by the model)',
            })
        }
        if (pico) {
            const pos = new Map(ordered.map((r, i) => [r.pmid, i]))
            table.sort((a, b) => a.rank - b.rank || (pos.get(a.pmid)! - pos.get(b.pmid)!))
        }
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

    // ...AND THE SHOUT GOES TO THE READER, NOT ONLY TO THE POD LOG. We already knew the citation was
    // fabricated and we rendered it as a clickable PubMed link anyway, then exported it to Word. A
    // detection nobody sees is not a detection. It rides back on the wire so the UI can warn and the
    // export can refuse; the prose itself is still not rewritten, for the reason above.
    // The floor is computed, never asked for. If the model's prose disagrees with it, the floor is
    // the one that is right.
    return {
        synthesis: {
            table, prose,
            ...(pico ? { floor: evidenceFloor(ordered) } : {}),
            ...(invented.length ? { invented } : {}),
        },
        usage,
    }
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
        // hope — the same invariant suggestFixes enforces in the other direction. Three ways a
        // candidate fails, and none of them is publishable:
        //
        //   hits >  base    IMPOSSIBLE. The maths is not wrong, THE COUNT IS (a throttled esearch
        //                   returns a well-formed number — see countPubmed). Never show it.
        //   hits === base   the block excludes nothing: every record already satisfies it. The
        //                   panel would say "narrow this: 1,391 -> 1,391". USELESS ADVICE IS WORSE
        //                   THAN NONE — it is a checkbox that costs a click and buys nothing.
        //   hits === 0      UNVERIFIABLE, and this REVERSES what this comment used to say. The old
        //                   rule kept a zero on the argument that "1,391 -> 0" is the most useful
        //                   thing this panel can say about a literature with no trials in it. Then it
        //                   published "Randomized trials only: 123 -> 0" — TWICE — over a base that
        //                   was ALREADY controlled-trial-limited, so every one of those 123 records
        //                   satisfies (RCT[pt] OR CCT[pt]) and the only arithmetically possible
        //                   answer was 123. It was a throttled esearch, and countPubmed's zero-retry
        //                   fires 400ms later — still inside the same burst — so it was throttled
        //                   too.
        //
        //                   A throttled zero and a true zero ARE THE SAME BYTES. There is nothing
        //                   left to inspect, so the only choice is which mistake to make: withhold a
        //                   true finding, or hand a librarian a priced checkbox that narrows their
        //                   search to nothing. The first costs them a candidate they were never owed;
        //                   the second costs them the search, because they will TICK IT. Withhold.
        //
        // Either way the candidate is DROPPED, and dropped OUT LOUD. Same principle as suggestFixes
        // refusing to publish a widening that does not retrieve the seed. A candidate that vanished
        // silently is how a panel quietly stops offering anything and nobody notices.
        if (hits >= base || hits === 0) {
            console.log(JSON.stringify({
                tag: 'literature-narrowing-dropped',
                label: c.label, baseHits: base, hits,
                why: hits > base
                    ? 'AND-ing a block cannot GROW the result set — the count is untrustworthy'
                    : hits === 0
                        ? 'a zero here is indistinguishable from a throttled esearch, so it cannot be published'
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
        dbName: DIALECTS[s.db].name,
        concepts: s.concepts,
        limits: s.limits,
        // Modes 2 and 3 are PubMed-only (they rank on PubMed's publication-type index, which Scopus
        // does not have), and every limit the dropdowns offer IS expressible in PubMed — so there is
        // nothing here to declare. The field exists so ReviewResult and StrategyResult stay one shape.
        unsupportedLimits: [] as string[],
        query,
        hits,
        // Modes 2 and 3 do not show a search history — the strategy is a means, not the deliverable,
        // and 7 extra counts per toggle would buy a column nobody is reading. The field exists so
        // ReviewResult and StrategyResult stay one shape.
        rowCounts: {} as Record<number, number>,
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
