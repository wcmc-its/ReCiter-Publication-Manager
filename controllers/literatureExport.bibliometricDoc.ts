// Mode 4 (bibliometric review) — the review document. Split out of literatureExport.ts (barrel), a
// SIBLING of literatureExport.synthesisDoc.ts: same AI-ASSISTED disclosure convention, same
// reproHeader() usage, same disclaimer-at-the-end style. What differs is the shape underneath it —
// this document has no single evidence table, it has SIX (five stat tables plus the cluster
// roster), because a bibliometric review's job is to characterize a whole corpus, not answer one
// question over a hand-picked subset the way Modes 2/3 do.
import { Block, RunFacts, reproHeader, modelDisclosure } from './literatureExport.blocks'

export type BibliometricStats = {
    publicationsPerYear: Array<{ year: string; count: number }>
    evidenceMixByYear: Record<string, Record<string, number>>
    journalDistribution: Array<{ journal: string; count: number }>
    percentileTrend: Array<{ year: string; median: number | null; n: number; scored: number }>
}

export function bibliometricDoc(
    topic: string,
    facts: RunFacts & { fromYear: number; toYear: number },
    stats: BibliometricStats,
    clusters: Array<{ id: string; label: string; pmids: string[]; isUncategorized?: boolean }>,
    narrative: { intro: string; sections: Array<{ label: string; paragraph: string; invented?: string[] }>; caseSeriesNote?: string },
): Block[] {
    return [
        { kind: 'h1', text: `Bibliometric review: ${topic}` },

        // AI-ASSISTED — same convention synthesisDoc.ts opens with, adapted for what actually
        // happened here. THE CAVEAT THAT MATTERS MOST: unlike Mode 2/3's synthesize(), which reads
        // every record a human selected, the narrative sections below were each written over a
        // representative SHORTLIST of a cluster's papers (preFilterForScoring()'s deterministic
        // pre-filter, then whatever synthesizeCluster() was actually given) — never a full-corpus
        // read. A reader who treats a cluster paragraph as "this model read all N papers in this
        // cluster" is trusting a claim this document never makes.
        { kind: 'p', text:
            `AI-ASSISTED. This document's narrative sections (below) were drafted by ${facts.model ? modelDisclosure(facts.model) : 'a language model'}, `
            + 'one topic cluster at a time, over a representative shortlist of that cluster\'s papers selected by a deterministic pre-filter — '
            + 'this is NOT a full-corpus AI read. Every claim carries its own PMID — verify each one against the source before relying on it. '
            + 'A claim with no PMID is unsupported.' },

        // Placed here, not buried after every cluster section — the plan's own instruction, and the
        // obvious one: a reader who has already scrolled past six tables and every cluster's prose
        // is not the reader who needs to be told "case series can't be cleanly tagged in PubMed"
        // before reading the case-flagged rows in those tables and sections.
        ...(narrative.caseSeriesNote ? [{ kind: 'small' as const, text: narrative.caseSeriesNote }] : []),

        { kind: 'h2', text: 'Overview' },
        { kind: 'p', text: narrative.intro },

        { kind: 'h2', text: 'Publications per year' },
        { kind: 'table', head: ['Year', 'Count'], rows:
            stats.publicationsPerYear.map(y => [y.year, String(y.count)]) },

        { kind: 'h2', text: 'Evidence-type mix by year' },
        ...evidenceMixTable(stats.evidenceMixByYear),

        { kind: 'h2', text: 'Journal distribution (top 20)' },
        { kind: 'table', head: ['Journal', 'Count'], rows:
            stats.journalDistribution.map(j => [j.journal, String(j.count)]) },

        // A TABLE WITH NOTHING IN IT IS WORSE THAN NO TABLE. If not one record in the corpus carries
        // an iCite percentile, this used to print a full-height table of blank medians with
        // "Scored: 0" on every row — eleven rows of nothing, under a heading promising a trend,
        // which reads as "iCite scored these papers at nothing" rather than "we have no data". The
        // screen already got this right (TrendPanel renders a one-line explanation instead); the
        // document did not. Same rule, both surfaces now.
        //
        // The threshold is "any year scored at all", not "every year": a decade-wide corpus whose
        // recent years are legitimately unscored (iCite needs citation history — see
        // withCitationMetrics) still has a real trend across the years that ARE scored, and the
        // per-row `Scored` column is what discloses which those are.
        ...(stats.percentileTrend.some(p => p.scored > 0) ? [
            { kind: 'h2' as const, text: 'Citation percentile trend (iCite)' },
            { kind: 'table' as const, head: ['Year', 'Median percentile', 'N', 'Scored'], rows:
                // A null median is NOT "N/A" and NOT 0 — same rule impactScoreOf()/percentileTrend()
                // itself already applies to a missing nihPercentile: a year with zero scored records has
                // no median to report, and printing one would be arithmetic over an empty set.
                stats.percentileTrend.map(p => [p.year, p.median === null ? '' : String(p.median), String(p.n), String(p.scored)]) },
        ] : [
            { kind: 'h2' as const, text: 'Citation percentile trend (iCite)' },
            { kind: 'p' as const, text: 'No record in this corpus carries an NIH iCite percentile yet, so there is no citation trend to report. iCite needs citation history to score a paper, so this is expected for a corpus of very recent work and does not mean these papers were scored poorly.' },
        ]),

        { kind: 'h2', text: 'Keyword clusters' },
        ...clusterTable(clusters),

        // One section per cluster the model actually wrote a paragraph for, in the order
        // assembleNarrativeReview() already decided (size descending, cluster id as the tie-break —
        // see that function's own comment). Nothing here re-sorts narrative.sections.
        ...narrative.sections.flatMap(section => ([
            { kind: 'h2' as const, text: section.label },
            { kind: 'p' as const, text: section.paragraph },
            // A FABRICATED CITATION TRAVELS — same reasoning as synthesisDoc.ts's own warning, reused
            // per-cluster here because a fabricated citation is exactly as serious whichever section
            // of the document it turns up in. The one wording change: this paragraph is printed
            // ABOVE its warning (task order is paragraph-then-warning, not warning-then-paragraph the
            // way synthesisDoc.ts opens with it), so the pointer reads "above", not "below".
            ...(section.invented?.length ? [
                { kind: 'h2' as const, text: 'WARNING — this synthesis cites papers that were not in the evidence set' },
                { kind: 'p' as const, text:
                    `The model cited PMID ${section.invented.join(', ')}, which ${section.invented.length === 1 ? 'was' : 'were'} not among the records selected for this cluster's synthesis. `
                    + 'The citation came from outside the evidence set, so the claim it supports is unverified and the sentence around it must not be relied on. '
                    + 'The paragraph above is reproduced UNEDITED — it has deliberately not been rewritten to hide this — and it must be read against the sources before any of it is used.' },
            ] : []),
        ])),

        ...reproHeader(facts),

        { kind: 'p', text:
            'Verify every claim against its cited source before relying on this draft; this is a scoping/bibliometric review, not a systematic review, '
            + 'and does not include risk-of-bias or GRADE assessment.' },
    ]
}

// ---------------------------------------------------------------------------
// Evidence-type mix by year, flattened into a table. The COLUMN SET IS DERIVED, not hardcoded — it
// is the union of every tier.label that actually appears anywhere in evidenceMixByYear. A fixed
// list here (e.g. copied from TIERS in literatureSearch.records.ts) would silently disagree with
// tierOf() the moment that table's labels change, and the disagreement would be invisible: it would
// not throw, it would just quietly drop a column and undercount every year that used the new label.
function evidenceMixTable(mix: Record<string, Record<string, number>>): Block[] {
    const years = Object.keys(mix).sort()

    const labels = new Set<string>()
    for (const yearCounts of Object.values(mix)) {
        for (const label of Object.keys(yearCounts)) labels.add(label)
    }
    // Alphabetical, for a deterministic column order — this file has no access to TIERS' rank
    // ordering (and importing it would be exactly the hardcoded-list coupling this function exists
    // to avoid), so there is no more meaningful order available than the labels' own names.
    const tierLabels = [...labels].sort()

    // Every record carries exactly one tier.label (tierOf() always returns one — see
    // literatureSearch.records.ts), so a label absent from a given year is a genuine count of zero
    // for that year, not a missing value. Unlike a missing nihPercentile or an unscored record, '0'
    // here is not a fabrication — it is the correct arithmetic answer to "how many of these ran that
    // year."
    return [{
        kind: 'table',
        head: ['Year', ...tierLabels],
        rows: years.map(year => [year, ...tierLabels.map(label => String(mix[year][label] || 0))]),
    }]
}

// Keyword-cluster roster: real clusters first, biggest first (same size-desc, id-tiebreak order
// assembleNarrativeReview() uses for its own sections, so the table above a cluster's prose and the
// order the prose appears in agree), then — if the corpus had any — ONE row for the uncategorized
// bucket at the bottom, with its real count. Never omitted: a reader adding this column up must land
// on the corpus total, not a total that quietly excludes whatever no seed MeSH term claimed.
function clusterTable(clusters: Array<{ id: string; label: string; pmids: string[]; isUncategorized?: boolean }>): Block[] {
    const real = clusters
        .filter(c => !c.isUncategorized)
        .sort((a, b) => b.pmids.length - a.pmids.length || a.id.localeCompare(b.id))
    const uncategorized = clusters.find(c => c.isUncategorized)

    const rows = real.map(c => [c.label, String(c.pmids.length)])
    if (uncategorized) rows.push([uncategorized.label, String(uncategorized.pmids.length)])

    return [{ kind: 'table', head: ['Cluster', 'Papers'], rows }]
}
