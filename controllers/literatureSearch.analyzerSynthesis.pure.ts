// Literature Analyzer, Phase 5 ("Summarize Themes") — the PURE half. Same split as Phase 4's own
// literatureSearch.analyzerThemes.pure.ts (see that file's own header for the full reasoning this
// one inherits): NOTHING HERE CALLS BEDROCK, and nothing here imports anything that does — a
// SEPARATE sibling file, not an extension of literatureSearch.analyzerThemes.pure.ts, because this
// is a different phase's own scoring/ranking/formatting arithmetic, not a Themes mechanism. Both
// controllers/literatureSearch.pure.check.js and a future Summarize Themes UI component can import
// this file with zero network, zero LLM and zero @aws-sdk/client-bedrock-runtime pulled into the
// browser bundle — see literatureSearch.analyzerSynthesis.ts next door, which owns the one Bedrock
// call this phase makes.
//
// PORT PROVENANCE. overallScoreOf() is PLAN-relevance-impact-topical-analysis-2026-08-22.md line
// 179's formula, verbatim. topNByOverallScore() and themeWeight() are direct ports of the pilot's
// top_n_by_overall_score() (run_synthesis.py) and theme_weight() (render_writeup.py) — see those
// files for the ORIGINAL, Python-side arithmetic this ports. yearCounts()/formatYearStrip() port
// the pilot's year_counts_for() (run_synthesis.py) plus PLAN's own "one compact line, no toggle"
// rendering decision (decision 35), which the pilot's own writeup renderers never needed to
// implement themselves (they just joined the dict with no collapsing, because none of the pilot's
// 24 themes ever spanned enough years to need it). notDiscussed() ports the pilot's own
// `sorted(set(supplied_pmids) - cited)` line from run_synthesis.py's main().

// ---------------------------------------------------------------------------
// overallScoreOf() — PLAN line 179: overallScore = ROUND(relevanceScore^1.4 * impactScore^1.2 /
// 1000). Pure arithmetic, no clamping: relevanceScore and impactScore are already 0-100 by the
// time they reach here (Score Relevance and Score Impact both clamp their own outputs), so this
// function trusts its inputs the same way impactScoreOf() trusts a tier rank that is already
// known-valid.
export function overallScoreOf(relevanceScore: number, impactScore: number): number {
    return Math.round(Math.pow(relevanceScore, 1.4) * Math.pow(impactScore, 1.2) / 1000)
}

// ---------------------------------------------------------------------------
// topNByOverallScore() — port of the pilot's top_n_by_overall_score() (run_synthesis.py), which
// sorts DESCENDING by overallScore and slices at TOP_N_PER_THEME (here: the caller-supplied `n`,
// SYNTH_RECORD_CAP in literatureSearch.analyzerSynthesis.ts). Python's sort() is STABLE, so the
// pilot's tie order was whatever order records_by_pmid happened to iterate in — not a real
// contract, just an accident of dict insertion order. THIS PORT MAKES THE TIE ORDER EXPLICIT AND
// DETERMINISTIC instead of inheriting that accident: ties break on ascending pmid (numeric when
// both parse as numbers, so '9' sorts before '10' rather than after it; string compare only as a
// fallback for a non-numeric pmid, which should never happen in practice but must not throw).
// Missing/null overallScore sorts as 0 — same "missing is not zero's evil twin, but it still has
// to sort somewhere" posture impactScoreOf()'s own check takes, applied here to ranking rather
// than scoring.
export function topNByOverallScore<T extends { pmid: string; overallScore?: number | null }>(
    records: T[],
    n: number,
): { kept: T[]; dropped: T[] } {
    const sorted = [...records].sort((a, b) => {
        const sa = a.overallScore ?? 0
        const sb = b.overallScore ?? 0
        if (sb !== sa) return sb - sa
        const na = Number(a.pmid)
        const nb = Number(b.pmid)
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
        return a.pmid < b.pmid ? -1 : a.pmid > b.pmid ? 1 : 0
    })
    return { kept: sorted.slice(0, n), dropped: sorted.slice(n) }
}

// ---------------------------------------------------------------------------
// themeWeight() — port of the pilot's theme_weight() (render_writeup.py): the aggregate SUM of
// overallScore over a theme's primary-assigned pmids, used for Assembly's descending-weight
// section order (decision 41). A pmid missing from the corpus map, or present with a null/missing
// overallScore, contributes 0 — never throws, never skips the theme entirely, per the pilot's own
// comment on this function.
export function themeWeight(
    pmids: string[],
    recordsByPmid: Map<string, { overallScore?: number | null }> | Record<string, { overallScore?: number | null } | undefined>,
): number {
    let total = 0
    for (const pmid of pmids) {
        const rec = recordsByPmid instanceof Map ? recordsByPmid.get(pmid) : recordsByPmid[pmid]
        if (!rec) continue
        total += rec.overallScore || 0
    }
    return total
}

// ---------------------------------------------------------------------------
// yearCounts() — port of the pilot's year_counts_for() (run_synthesis.py): one count per
// publication year across the records actually supplied to a synthesis call (i.e. after
// topNByOverallScore has already cut the list — this counts what the model was actually shown,
// the same "papers by year" the mockup displays beside each theme's prose). A record with no year
// (empty string, null, or missing) buckets under 'unknown' rather than being silently dropped from
// the count — the ticket's own explicit requirement, and consistent with PubRecord.year's own
// "never null/undefined, empty string IS the missing signal" convention (literatureSearch.records.ts).
export function yearCounts(records: { year?: string | null }[]): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const r of records) {
        const y = (r.year && String(r.year).trim()) || 'unknown'
        counts[y] = (counts[y] || 0) + 1
    }
    return counts
}

// THRESHOLD, PICKED AND DOCUMENTED PER THE TICKET'S OWN INSTRUCTION: more than this many DISTINCT
// numeric years triggers collapsing the oldest ones into one bracket, so the strip still holds one
// line. 8 is chosen to match PLAN's own worked example ("2019 ×3 · 2020 ×7 · 2021 ×12 · 2022 ×9 ·
// 2023 ×4" — 5 individual years shown — plus a "1998-2018 ×11 · …" bracket for everything older):
// that example's un-collapsed span is 1998-2023, 26 distinct years, comfortably over this
// threshold, and the 5 recent years it keeps individually match YEAR_STRIP_RECENT_YEARS_KEPT below
// exactly. Tunable; if a real corpus's year strip looks wrong on screen, this is the first number
// to revisit, not the collapsing logic itself.
export const YEAR_STRIP_COLLAPSE_THRESHOLD = 8

// How many of the MOST RECENT distinct years stay individually visible once collapsing kicks in —
// see YEAR_STRIP_COLLAPSE_THRESHOLD's own comment for why 5 matches PLAN's worked example.
export const YEAR_STRIP_RECENT_YEARS_KEPT = 5

// formatYearStrip() — PLAN's decision 35 rendering: "one compact line, no toggle," e.g.
// "2019 ×3 · 2020 ×7 · 2021 ×12 · 2022 ×9 · 2023 ×4", with a long range collapsing the oldest years
// into one bracket ("1998-2018 ×11 · …") once the span would otherwise be too long to hold one
// line. 'unknown' (missing-year records) always renders LAST, as its own segment, never folded into
// a numeric bracket — a record with no year is not the same fact as a record from a known-old year,
// and collapsing the two together would misstate what the bracket counts.
export function formatYearStrip(counts: Record<string, number>): string {
    const numericYears = Object.keys(counts)
        .filter(y => y !== 'unknown' && /^\d+$/.test(y))
        .sort((a, b) => Number(a) - Number(b))

    const segments: string[] = []
    if (numericYears.length > YEAR_STRIP_COLLAPSE_THRESHOLD) {
        const cut = numericYears.length - YEAR_STRIP_RECENT_YEARS_KEPT
        const collapsed = numericYears.slice(0, cut)
        const recent = numericYears.slice(cut)
        const collapsedSum = collapsed.reduce((sum, y) => sum + counts[y], 0)
        segments.push(`${collapsed[0]}-${collapsed[collapsed.length - 1]} ×${collapsedSum}`)
        for (const y of recent) segments.push(`${y} ×${counts[y]}`)
    } else {
        for (const y of numericYears) segments.push(`${y} ×${counts[y]}`)
    }
    if (counts.unknown) segments.push(`unknown ×${counts.unknown}`)

    return segments.join(' · ')
}

// ---------------------------------------------------------------------------
// notDiscussed() — port of the pilot's `sorted(set(supplied_pmids) - cited)` (run_synthesis.py
// main()): every pmid CURRENTLY assigned to a theme that the synthesis prose did not cite. Live,
// not frozen at generation time (PLAN decision 36) — the caller recomputes this against the
// theme's CURRENT assignment set on every render, using the citedPmids a synthesis call returned,
// which is also what makes the Staleness mechanism free (PLAN's "Staleness" section): a cited pmid
// no longer in the current set is what makes a section stale, and this same set difference is the
// live "not individually discussed" list either way. Sorted ascending (plain string sort, matching
// Python's `sorted()` over string pmids in the pilot — NOT a numeric sort) for a deterministic,
// checkable order.
export function notDiscussed(citedPmids: string[] | Set<string>, currentAssignedPmids: string[]): string[] {
    const cited = citedPmids instanceof Set ? citedPmids : new Set(citedPmids)
    return currentAssignedPmids.filter(p => !cited.has(p)).sort()
}
