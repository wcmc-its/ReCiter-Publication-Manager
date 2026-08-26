// Literature Analyzer, Step 3 ("Score Impact") — orchestration only. Every qualifying record
// (however many cleared Phase 2's relevance floor) gets impactScoreOf()'s free deterministic
// score unconditionally; a `paid` request additionally spends one scoreImpact() Bedrock call on
// the same records and, where it answers, that judged score wins. NO NEW SCORING LOGIC LIVES
// HERE — both scorers are already built and already validated (literatureSearch.score.ts's
// PHASE 6a, literatureSearch.impact.ts). This file's whole job is: re-fetch, re-enrich, run one
// or both, resolve to exactly one impactScore per record, and never lose a failure silently.
//
// NEVER TRUSTS CLIENT-ECHOED DATA. The caller sends PMIDs only — same discipline as Mode 2/3's
// screen/synthesize and Mode 4's handleM4Score in search.ts, all of which re-fetch abstracts
// server-side rather than accept them from the browser. Neither impactScoreOf() nor scoreImpact()
// can do anything useful with the {pmid, title, synopsis, relevanceScore, relevanceExplanation}
// shape Phase 2 hands the client (LiteratureAnalyzer.tsx's RelevanceRecord): both need a full
// PubRecord — tier, abstract, journal, year, and (for impactScoreOf specifically)
// nihPercentile/citationCount/rcr/apt from iCite, none of which that shape carries.
import { PubRecord, fetchByPmids, withCitationMetrics } from './literatureSearch.records'
import { impactScoreOf } from './literatureSearch.score'
import { scoreImpact } from './literatureSearch.impact'
import { UsageLog } from './literatureSearch.llm'
import { RETRIEVAL_THRESHOLD } from './literatureSearch.corpus'

export type AnalyzerImpactRow = {
    pmid: string
    impactScore: number
    impactJustification: string
    // 'paid' only when scoreImpact() actually returned a score for this pmid on THIS request;
    // 'floor' otherwise — either the request was not paid at all, or it was paid but this record
    // is one of the ones scoreImpact() could not score even after its own internal 3-attempt
    // retry (see `failed` on the returned object). Never absent, never both: decision 11
    // guarantees every record resolves to exactly one impactScore.
    impactSource: 'paid' | 'floor'
    nihPercentile?: number
    citationCount?: number
    rcr?: number
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

// fetchByPmids() builds ONE `pmid[uid] OR pmid[uid] OR ...` query and sends it to the PubMed
// retrieval tool in a single call — fine for Mode 2/3's top-50 and Mode 4's ~200-record shortlist,
// but this feature's free floor is explicitly UNCAPPED (the relevance floor is the only gate), so
// a real run can hand this thousands of PMIDs. The tool itself refuses any query matching more
// than RETRIEVAL_THRESHOLD (2,000) hits outright — see literatureSearch.corpus.ts's own comment,
// which is where fetchCorpus() hits the identical ceiling and shards by year for the same reason.
// A UID-OR query for N distinct real PMIDs returns exactly N hits, so N > RETRIEVAL_THRESHOLD
// would trip that refusal here too. Sharded the same way, sequentially (not concurrent — this
// codebase is deliberately gentle with NCBI elsewhere, see fetchArticles's pacing comments), and
// merged before enrichment. withCitationMetrics() below already batches iCite calls internally at
// 150 PMIDs (ICITE_BATCH in literatureSearch.records.ts) and needs no equivalent change.
async function fetchAllByPmids(pmids: string[]): Promise<PubRecord[]> {
    if (pmids.length <= RETRIEVAL_THRESHOLD) return fetchByPmids(pmids)
    const out: PubRecord[] = []
    for (const batch of chunk(pmids, RETRIEVAL_THRESHOLD)) out.push(...await fetchByPmids(batch))
    return out
}

export async function scoreAnalyzerImpact(
    pmids: string[],
    paid: boolean,
): Promise<{ records: AnalyzerImpactRow[]; failed: string[]; usage: UsageLog }> {
    // RE-FETCHED AND RE-ENRICHED, exactly the withCitationMetrics(await fetchByPmids(...)) shape
    // handleM4Score already established in search.ts (~line 964) for this same reason: fetchByPmids
    // alone carries no iCite fields, so without this wrap impactScoreOf() would see
    // nihPercentile/citationCount/rcr/apt as always-absent and every record would silently fall
    // back to its weakest ('tier-only') evidence basis.
    const records = await withCitationMetrics(await fetchAllByPmids(pmids))

    // THE FREE FLOOR — unconditional, for every record that resolved, regardless of `paid`. Pure,
    // deterministic, never null (impactScoreOf()'s own contract).
    const floor = new Map(records.map(r => [r.pmid, impactScoreOf(r)]))

    let paidScores = new Map<string, { score: number; justification: string }>()
    let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }
    if (paid) {
        const res = await scoreImpact(records)
        paidScores = res.scores
        usage = res.usage
    }

    // FAILED = asked for a paid score and did not get one, even after scoreImpact()'s own internal
    // 3-attempt retry (that retry is free here: this function calls it once per already-bounded
    // batch and gets the retry behaviour along with it — see this file's header). Diffing the
    // returned Map against what was sent is what makes a paid miss visible to the client instead
    // of only implied by its absence; scoreImpact() itself only console.errors internally.
    const failed: string[] = paid ? records.filter(r => !paidScores.has(r.pmid)).map(r => r.pmid) : []

    const out: AnalyzerImpactRow[] = records.map(r => {
        const f = floor.get(r.pmid)!
        const p = paidScores.get(r.pmid)
        return {
            pmid: r.pmid,
            // SCALE FIX: impactScoreOf() (the floor) returns 0-1 (round2(clamp01(...)),
            // literatureSearch.score.ts); scoreImpact() (the paid pass) returns a 0-100 integer
            // (its own tool schema). Both land in this ONE impactScore field — without normalizing
            // the floor onto the same 0-100 scale, every paid score would outrank every floor score
            // regardless of actual merit (sort, export, and any future overallScore computation all
            // read this field numerically). Caught during Phase 3's post-workflow review, before
            // the frontend (already built against this contract, unmodified) ever saw a live value.
            impactScore: p ? p.score : Math.round(f.score * 100),
            impactJustification: p ? p.justification : f.justification,
            impactSource: p ? 'paid' : 'floor',
            nihPercentile: r.nihPercentile,
            citationCount: r.citationCount,
            rcr: r.rcr,
        }
    })

    return { records: out, failed, usage }
}
