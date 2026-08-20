// Mode 4 (bibliometric review) — the .xlsx corpus sheet. Split out of literatureExport.ts
// (barrel), a SIBLING of literatureExport.sheets.ts's recordSheets(), not a modification of it.
import { DIALECTS } from './literatureSearch.strategy'
import { RunFacts, modelDisclosure } from './literatureExport.blocks'
import { Sheet, RecordLike } from './literatureExport.sheets'

// ---------------------------------------------------------------------------
// WHY THIS FILE HAS NO truncated() AND NO "AI screening" REFUSAL ROW — read recordSheets' own
// comment above `truncated()` in literatureExport.sheets.ts first; this is the short version of why
// none of that applies here.
//
// That logic exists because Modes 2/3 rank a query's yield by relevance and RETRIEVE ONLY THE TOP
// 50 — so the sheet in front of a screener can be a near-disjoint sliver of what the strategy
// actually matched (measured: 1% recall on a relevance-ranked top 50, see RECALL-STUDY.md), and an
// "AI suggested Include/Exclude" column on that sliver would misrepresent it as a screen.
//
// Mode 4 never does that. fetchCorpus() (literatureSearch.corpus.ts) shards by year and pulls EVERY
// record each year's query matches, up to RETRIEVAL_THRESHOLD per year — and a year that clears the
// threshold comes back as a reported, attributable shard error (`ok: false`), never a silent
// truncation. So `records` here is always the full corpus (or the full corpus minus a year the
// caller was told, loudly, could not be pulled whole) — never a ranked slice standing in for a much
// bigger yield. There is no cap to disclose and nothing to refuse.
//
// There is also no AI include/exclude verdict ANYWHERE in Mode 4 — this feature is a report, not a
// filter (see scoreRelevance()'s own header comment in literatureSearch.score.ts: "YOUR SCORE IS A
// SUGGESTION, not a filter"). So this sheet carries impact/relevance SCORES, not verdicts, and the
// one disclosure it does owe the reader is different: those scores were computed for a
// representative shortlist of the corpus (preFilterForScoring()'s ~200-record budget), not for
// every row. That disclosure lives on the Search sheet below, in place of recordSheets' "AI
// screening" row.

// A record's impact/relevance fields arrive only for the shortlist preFilterForScoring() (and, for
// relevance, scoreRelevance() actually answering for) picked — every other record in the corpus is
// still a full row here, just with these five columns blank. Cluster membership, by contrast, is
// assigned to every record (clusterByMesh() never drops one — see its own "never silently dropped"
// comment), so clusterLabel is expected to be populated corpus-wide, including 'Uncategorized / no
// dominant MeSH topic' for the fallthrough bucket.
export type ScoredRecordLike = RecordLike & {
    caseSeriesProbable?: boolean
    clusterLabel?: string
    impactScore?: number; impactJustification?: string
    relevanceScore?: number; relevanceJustification?: string
}

export function corpusSheet(
    records: ScoredRecordLike[],
    facts: RunFacts & { fromYear: number; toYear: number },
): Sheet[] {
    return [
        {
            name: 'Records',
            head: [
                'PMID', 'Title', 'Authors', 'Year', 'Journal', 'Evidence type', 'Case series',
                'Cluster', 'Impact score', 'Impact justification', 'Relevance score',
                'Relevance justification', 'Link',
            ],
            // Every row has exactly 13 cells, matching the 13-column head above — no conditional
            // spread here (unlike recordSheets' `cut` branch), because unlike that sheet nothing
            // about THIS sheet's shape ever changes row to row or run to run. A short row would
            // silently shift every later cell one column left for that record alone (see sheets.ts's
            // own comment on this), so every optional value below is padded to '' rather than
            // omitted.
            rows: records.map(r => [
                r.pmid, r.title, r.authors, r.year, r.journal,
                // "Evidence type" is r.design, not a new field — RecordLike.design is ALREADY
                // tierOf()'s own label (see the comment on `design` in literatureSearch.records.ts:
                // "derived — see designOf(). Same string as tier.label"). A second column deriving
                // the same string a different way would be two names for one fact, free to drift.
                r.design,
                // THREE STATES, NOT TWO — same principle recordSheets applies to include/exclude/
                // not-screened. PubMed has no case-series [pt] tag (flagProbableCaseSeries()'s own
                // comment), so the flag is a heuristic, never a verdict: 'Probable' when it fired,
                // blank — never 'No' — when it did not, because the absence of the flag is not the
                // same claim as a checked "confirmed not a case series."
                r.caseSeriesProbable === true ? 'Probable' : '',
                r.clusterLabel ?? '',
                // MISSING IS NOT ZERO, for all four of these — the same rule withCitationMetrics()
                // and recordSheets() already apply to a missing nihPercentile, for the same reason:
                // Number(undefined) coerced to 0 would read as "scored, and scored at rock bottom,"
                // when the truth is "never sent to a scorer at all." A blank cell is the only honest
                // rendering of "not in the shortlist."
                typeof r.impactScore === 'number' ? r.impactScore : '',
                r.impactJustification ?? '',
                typeof r.relevanceScore === 'number' ? r.relevanceScore : '',
                r.relevanceJustification ?? '',
                `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`,
            ]),
        },
        {
            // Same reason recordSheets' Search sheet exists: the reproducibility facts travel WITH
            // the data, in the same file, so a PMID list someone downloads is never later unaccounted
            // for.
            name: 'Search',
            head: ['Field', 'Value'],
            rows: [
                ['Database', DIALECTS[facts.db || 'pubmed'].provenance],
                ['Date searched', facts.runDate],
                ['Year range', `${facts.fromYear}-${facts.toYear}`],
                // RECORDS IN CORPUS IS records.length, NOT facts.hits — deliberately, and unlike
                // recordSheets' Search sheet, which uses facts.hits because Mode 2/3 run ONE query
                // and `hits` is that query's exact count. Mode 4 has no single query: fetchCorpus()
                // runs one query PER YEAR and dedupes the union (a paper straddling a year boundary
                // can match two shards — see fetchCorpus's own comment). Summing each shard's `hits`
                // would DOUBLE-COUNT those duplicates, and a year that tripped RETRIEVAL_THRESHOLD
                // contributes a reported count with zero records behind it. `records.length` is the
                // one number guaranteed to equal the row count of the Records sheet sitting right
                // next to this one — which is the whole point of a sheet that carries its own facts.
                ['Records in corpus', records.length],
                ...(facts.model
                    ? [['Model (query drafting, cluster labeling, relevance scoring, narrative)', modelDisclosure(facts.model)]]
                    : []),
                // THE DISCLOSURE THIS SHEET OWES IN PLACE OF recordSheets' "AI screening" ROW — see
                // this file's header comment for why the two are different claims. This one says
                // plainly that most rows above were never sent to a scorer, so a blank Impact/
                // Relevance cell is not a hidden zero and a populated one is not "every record was
                // judged."
                ['Impact / relevance scoring', 'Computed for a representative shortlist of this '
                    + 'corpus only, not every record — see preFilterForScoring() in '
                    + 'literatureSearch.score.ts. A blank Impact score or Relevance score cell means '
                    + 'that record was not in the shortlist (or, for Relevance, that the model did '
                    + 'not return a score for it); it is not a zero.'],
                // Boolean query goes LAST, same convention as recordSheets and reproHeader — it is
                // the thing a reader scrolls to and copy-pastes, so it sits at the bottom of the
                // list, not buried in the middle of it.
                ['Boolean query', `${facts.query} — this is the base query for ONE year; Mode 4 `
                    + `AND's it with a [dp] date-range term and runs it once for each year from `
                    + `${facts.fromYear} to ${facts.toYear} (see fetchCorpus() in `
                    + `literatureSearch.corpus.ts), then dedupes the union into the corpus above. `
                    + 'There is no single query that reproduces the whole corpus in one PubMed search box.'],
            ] as Array<Array<string | number>>,
        },
    ]
}
