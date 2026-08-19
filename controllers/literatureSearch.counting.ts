// Counting layer of Literature Search — the arithmetic over PubMed counts that lets a librarian
// iterate a Mode 1 strategy all afternoon for the price of a few esearch calls. Split out of
// literatureSearch.controller.ts, which is now the re-export barrel and carries the full design
// contract in its header comment.
import { reciterConfig } from '../config/local'
import {
    Line, Db, Concept, Rendering, Strategy, LimitOption, SeedKind, Seed, Dialect, Row, Pico,
    conceptsOf, parseSeeds, DIALECTS, buildLimits, dateLimits, pubTypes, assembleQuery, conceptQuery,
    numberStrategy, RECORD_CAP, MAX_CONCEPTS, MAX_LINES, MAX_TERMS, PICO_FIELDS, picoQuestion,
    picoComplete, NARROW_ABOVE,
} from './literatureSearch.strategy'

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

