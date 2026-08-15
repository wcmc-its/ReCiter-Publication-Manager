// Mode 4 (bibliometric review) — Phases 2-4. Split out the same way counting/records/llm already
// are; the design contract lives in
// Projects/ReCiter-Publication-Manager/literature-search/PLAN-literature-mode4-bibliometric-review.md
// (not in this repo — planning docs live in Projects, code lives here). Phase 1 (strategy) is Mode
// 1's buildStrategy(), reused verbatim, no new code. Phases 5-8 (clustering, scoring, synthesis,
// export) are not built yet.
//
// PubMed only. Scopus/Embase corpus retrieval is explicitly out of scope for v1 (Scopus has no
// MeSH — the clustering half of this feature needs it — and Embase is Ovid-only, no API), so this
// file never takes a `db` parameter the way strategy.ts's Dialect table does.
import { Strategy, assembleQuery } from './literatureSearch.strategy'
import { PubRecord, fetchRecords } from './literatureSearch.records'
import { countPubmed } from './literatureSearch.counting'

// ---------------------------------------------------------------------------
// PHASE 2 — full-corpus retrieval, sharded by year.
//
// The PubMed retrieval tool refuses any query over 2,000 hits outright (its own
// RETRIEVAL_THRESHOLD — see ReCiter-PubMed-Retrieval-Tool). A 10-year pull on a real subfield
// will very likely clear that in aggregate, so this shards by publication year and calls
// countPubmed/fetchRecords once per year. Year-sharding is free here: it is exactly the axis the
// trend analysis (Phase 4) needs anyway, so the shard IS the unit the stats are computed over.
//
// Mirrors the tool's own cap so a hot year gets a clear, attributable error instead of a bare
// fetch failure. If the tool's threshold ever changes, this stops being the source of truth for
// it (the tool's own throw still is) and just becomes a slightly stale early warning.
export const RETRIEVAL_THRESHOLD = 2000

export type YearShard =
    | { year: number; hits: number; ok: true; records: PubRecord[] }
    // hits > RETRIEVAL_THRESHOLD: a year too hot to pull whole. Sub-sharding a hot year by
    // evidence type is the handoff's decision 4 — deliberately DEFERRED (recommended: build it
    // only if a real pilot year actually trips this), so a hot year is reported, not silently
    // dropped or silently truncated. A caller sees exactly which year(s) need a human call.
    | { year: number; hits: number; ok: false; error: string }

export type Corpus = {
    records: PubRecord[]            // deduped, full corpus
    shards: YearShard[]             // one entry per year, in order — the trend axis for Phase 4
    duplicates: number              // PMIDs seen in more than one shard (MEDLINE entry-date vs.
                                     // print-date can straddle a year boundary)
}

// A transient fetch failure on ONE year must not lose the other nine — retry the shard a few
// times before giving up on it, same instinct as the tool's own esearch retry, just one layer up
// (a shard-level failure here is a whole year, not one esearch call).
async function fetchShard(query: string, cap: number, attempts = 3): Promise<PubRecord[]> {
    let lastErr: unknown
    for (let i = 0; i < attempts; i++) {
        try {
            return await fetchRecords(query, cap, 'date')
        } catch (e) {
            lastErr = e
            if (i < attempts - 1) await new Promise(r => setTimeout(r, 500 * (i + 1)))
        }
    }
    throw lastErr
}

export async function fetchCorpus(strategy: Strategy, fromYear: number, toYear: number): Promise<Corpus> {
    const base = assembleQuery(strategy)
    const shards: YearShard[] = []

    for (let y = fromYear; y <= toYear; y++) {
        const query = `${base} AND ${y}:${y}[dp]`
        const hits = await countPubmed(query)

        if (hits === 0) {
            shards.push({ year: y, hits: 0, ok: true, records: [] })
            continue
        }
        if (hits > RETRIEVAL_THRESHOLD) {
            shards.push({
                year: y, hits, ok: false,
                error: `${hits.toLocaleString()} hits in ${y} alone exceeds the ${RETRIEVAL_THRESHOLD}-record `
                    + 'retrieval threshold. Not sub-sharded automatically (deferred by design — see decision 4 '
                    + 'in the Mode 4 handoff); narrow the strategy for this year or sub-shard by evidence type.',
            })
            continue
        }
        const records = await fetchShard(query, hits)
        shards.push({ year: y, hits, ok: true, records })
    }

    // Dedup by PMID, first shard seen wins. A paper straddling a year boundary (MEDLINE entry
    // date vs. print date disagree) can legitimately match two `[dp]` shards.
    const byPmid = new Map<string, PubRecord>()
    let seen = 0
    for (const s of shards) {
        if (!s.ok) continue
        for (const r of s.records) {
            seen++
            if (!byPmid.has(r.pmid)) byPmid.set(r.pmid, r)
        }
    }

    return { records: [...byPmid.values()], shards, duplicates: seen - byPmid.size }
}

// ---------------------------------------------------------------------------
// PHASE 3 — evidence-type filtering. Extends tierOf(), never replaces it: every record already
// carries `.tier`, computed at fetch time from PubMed's own [pt] list, same as Mode 3. Nothing
// here asks a model to classify study design.

const CASE_REPORT = 'Case report' // tierOf()'s own label — see literatureSearch.records.ts TIERS

export const excludeCaseReports = (records: PubRecord[]): PubRecord[] =>
    records.filter(r => r.tier.label !== CASE_REPORT)

// THE HONEST GAP tierOf() ALREADY DOCUMENTS: PubMed has no [pt] tag for "case series" at all, so
// it cannot be derived the way Case Report/RCT/Meta-analysis can. This is a best-effort MeSH/text
// heuristic, not a claim — every record it flags stays in the corpus, unexcluded, and the caller
// is expected to render the flag as "probable, unverified" (the plan's recommended option: coarse
// and honest beats inventing a clean tier that would misrepresent PubMed's own indexing).
//
// Signal: a record indexed only as "Other" (i.e. tierOf found no recognised study-design [pt] —
// most commonly bare "Journal Article") AND either a MeSH heading associated with retrospective
// case description, or title language a case-series title conventionally uses ("a case series
// of...", "N cases of...", "our experience with...").
const CASE_SERIES_MESH = /retrospective studies|case-control studies/i
const CASE_SERIES_TITLE = /\bcase series\b|\b\d+\s+(patients|cases)\b|\bour experience\b/i

export const flagProbableCaseSeries = (records: PubRecord[]): PubRecord[] =>
    records.map(r => {
        if (r.tier.label !== 'Other') return r
        const meshHit = r.mesh.some(m => CASE_SERIES_MESH.test(m))
        const titleHit = CASE_SERIES_TITLE.test(r.title)
        return meshHit || titleHit ? { ...r, caseSeriesProbable: true } : r
    })

// ---------------------------------------------------------------------------
// PHASE 4 — bibliometric statistics. Pure aggregation over whatever corpus it is handed — no LLM,
// no network, no ranking, so the recall-collapse trap the rest of this feature is built around
// (RECALL-STUDY.md) does not apply here. Every record in `records` counts once, in every stat.

export type YearCount = { year: string; count: number }
export type EvidenceMixByYear = Record<string, Record<string, number>>  // year -> tier.label -> count
export type JournalCount = { journal: string; count: number }
export type PercentilePoint = { year: string; median: number | null; n: number; scored: number }

export function publicationsPerYear(records: PubRecord[]): YearCount[] {
    const counts = new Map<string, number>()
    for (const r of records) counts.set(r.year, (counts.get(r.year) || 0) + 1)
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, count]) => ({ year, count }))
}

export function evidenceMixByYear(records: PubRecord[]): EvidenceMixByYear {
    const out: EvidenceMixByYear = {}
    for (const r of records) {
        out[r.year] ??= {}
        out[r.year][r.tier.label] = (out[r.year][r.tier.label] || 0) + 1
    }
    return out
}

export function journalDistribution(records: PubRecord[], top = 20): JournalCount[] {
    const counts = new Map<string, number>()
    for (const r of records) {
        const j = r.journal || '(no journal recorded)'
        counts.set(j, (counts.get(j) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([journal, count]) => ({ journal, count }))
}

// iCite's nih_percentile is ROUTINELY ABSENT for recent papers (see withCitationMetrics's own
// comment) — that is correct, not broken, so `scored` (records with a real percentile) is
// reported alongside `n` (records that year, total) rather than silently averaging over a
// shrinking, recency-biased denominator.
export function percentileTrend(records: PubRecord[]): PercentilePoint[] {
    const byYear = new Map<string, number[]>()
    const totalByYear = new Map<string, number>()
    for (const r of records) {
        totalByYear.set(r.year, (totalByYear.get(r.year) || 0) + 1)
        if (typeof r.nihPercentile === 'number') {
            if (!byYear.has(r.year)) byYear.set(r.year, [])
            byYear.get(r.year)!.push(r.nihPercentile)
        }
    }
    const median = (xs: number[]) => {
        const s = [...xs].sort((a, b) => a - b)
        const mid = Math.floor(s.length / 2)
        return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
    }
    return [...totalByYear.keys()].sort().map(year => {
        const scored = byYear.get(year) || []
        return { year, median: scored.length ? median(scored) : null, n: totalByYear.get(year)!, scored: scored.length }
    })
}
