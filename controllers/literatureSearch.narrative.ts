// Mode 4 (bibliometric review) — Phase 7: narrative synthesis, restructured for a whole corpus. Split
// out the same way clustering (Phase 5) and scoring (Phase 6) are; the design contract lives in
// Projects/ReCiter-Publication-Manager/literature-search/PLAN-literature-mode4-bibliometric-review.md
// (not in this repo — planning docs live in Projects, code lives here).
//
// TWO FUNCTIONS, TWO DIFFERENT SHAPES, and the split is the whole design, the same instinct
// impactScoreOf() / scoreRelevance() and clusterByMesh() / labelClusters() already apply:
//
//   synthesizeCluster() is the one Bedrock call this file makes. It writes ONE cited paragraph
//   over a small shortlist of records for a SINGLE cluster — the same job synthesize() does for
//   Mode 2, reusing its own canonical rules (SYNTH_RULES_HEAD) rather than a paraphrased copy.
//
//   assembleNarrativeReview() is PURE — no network, no LLM, no further model call of any kind.
//   See its own comment below for why that is deliberate, not merely convenient.
import { PubRecord } from './literatureSearch.records'
import { Cluster } from './literatureSearch.cluster'
import { UsageLog, invoke, renderRecords, LONG_MAX_TOKENS, SYNTH_RULES_HEAD, stripScaffolding } from './literatureSearch.llm'
import { YearCount, EvidenceMixByYear } from './literatureSearch.corpus'

// ---------------------------------------------------------------------------
// PHASE 7a — synthesizeCluster(). The one Bedrock call this file makes.

export type ClusterNarrative = {
    clusterId: string
    label: string
    paragraph: string
    citedPmids: string[]
    // The model's own contamination, carried ON THE WIRE — same rule Synthesis.invented follows
    // in literatureSearch.llm.ts, and for the same reason: a detection nobody sees is not a
    // detection.
    invented?: string[]
}

const CLUSTER_SYNTH_TOOL = {
    name: 'submit_cluster_synthesis',
    description: 'Return a narrative paragraph synthesizing the supplied papers for ONE cluster of a larger bibliometric review.',
    input_schema: {
        type: 'object' as const,
        properties: {
            paragraph: {
                type: 'string',
                description: 'The narrative synthesis for this cluster only. Every claim cites its source inline as [PMID 12345678]. Plain prose, one paragraph, no headings, no markdown.',
            },
        },
        required: ['paragraph'],
    },
}

// Rule 5 is the only rule that differs from Mode 2's synthesize() — see RULE_5_NARRATIVE and
// RULE_5_PICO in literatureSearch.llm.ts for the sibling amendments this one belongs beside. This
// job's version exists because a cluster paragraph is read as ONE SECTION of a document the model
// never sees in full: it has no idea what the other clusters say, and nothing stops it reaching for
// a comparison ("unlike the surgical-management cluster...") that sounds plausible and is entirely
// invented, since it was never shown that cluster's papers.
const RULE_5_CLUSTER = `5. This paragraph is ONE SECTION of a larger bibliometric review. It covers ONLY the cluster named below. Do not generalize beyond it, and do not compare it to other clusters — you have not been shown their papers and cannot know what they say.`

const CLUSTER_SYNTH_PROMPT = `You are writing one section of a bibliometric literature review: a narrative paragraph synthesizing the papers in ONE topic cluster. You are given the same abstracts a clinician would read, and nothing else.

THESE RULES ARE ABSOLUTE. They are the reason this tool exists:
${SYNTH_RULES_HEAD}
${RULE_5_CLUSTER}

Style: ONE paragraph of plain clinical prose. No headings, no bullet points, no markdown, no bold. Write for a clinician who will check your citations.`

// ONE CALL PER CLUSTER, unlike labelClusters()'s one-call-for-all-clusters. The two are not the same
// shape: labelClusters() reads a few MeSH terms per cluster (cheap, and every cluster benefits from
// being named consistently against the others), while this reads up to a dozen full abstracts per
// cluster — batching clusters together here would mean either every cluster's shortlist competing
// for the SAME context window (the lost-in-the-middle risk SCREEN_ATTEMPTS exists to fight, now
// spread across paragraphs instead of records) or one call per cluster anyway, just with worse
// isolation between them. The caller (not this function) is expected to fire these in whatever
// concurrency it can afford; nothing here assumes it is called once.
//
// `records` is ALREADY the shortlist for this one cluster — typically ~8-12 records the caller
// picked by ranking impactScore + relevanceScore (Phase 6). This function does no ranking of its
// own; it synthesizes over exactly what it is given, the same contract synthesize() has with the
// records a human already ticked.
export async function synthesizeCluster(
    topic: string,
    cluster: Cluster,
    records: PubRecord[],
): Promise<{ narrative: ClusterNarrative; usage: UsageLog }> {
    const byPmid = new Map(records.map(r => [r.pmid, r]))

    // LONG_MAX_TOKENS, the same ceiling synthesize() uses for a full 3-5 paragraph, up-to-50-record
    // document — generous for a single paragraph over ~12 records, but a paragraph cut off mid-
    // sentence is exactly the failure invoke() already refuses on (its own max_tokens check), and the
    // ceiling costs nothing on the calls that never reach it.
    const { input, usage } = await invoke(
        CLUSTER_SYNTH_PROMPT,
        CLUSTER_SYNTH_TOOL,
        `Review topic: ${topic}\n\nCluster: ${cluster.label}\n\nThe ${records.length} papers selected for this cluster:\n\n${renderRecords(records)}`,
        LONG_MAX_TOKENS,
    )

    const paragraph = stripScaffolding(String(input?.paragraph ?? '').trim(), `cluster:${cluster.id}`)
    if (!paragraph) throw new Error('model did not return a synthesis')

    // Same detection synthesize() runs on its prose: regex out every [PMID \d+], compare against
    // the records ACTUALLY SUPPLIED to this call (this cluster's shortlist, not the whole corpus),
    // and anything outside that set is contamination. The prose is never rewritten to remove it —
    // silently editing the model's own output would be a second fabrication laid over the first —
    // it is only ever reported, loudly, so a reader (and the export builder) can see it.
    const cited = new Set((paragraph.match(/\[PMID\s+(\d+)\]/gi) || [])
        .map(m => (m.match(/\d+/) || [''])[0]).filter(Boolean))
    const invented = Array.from(cited).filter(p => !byPmid.has(p))
    if (invented.length) {
        console.error(JSON.stringify({
            tag: 'literature-narrative-bad-citation', clusterId: cluster.id, pmids: invented,
            why: 'the cluster synthesis cites PMIDs that were not among the records supplied for this cluster',
        }))
    }

    return {
        narrative: {
            clusterId: cluster.id,
            label: cluster.label,
            paragraph,
            citedPmids: Array.from(cited).filter(p => byPmid.has(p)),
            ...(invented.length ? { invented } : {}),
        },
        usage,
    }
}

// ---------------------------------------------------------------------------
// PHASE 7b — assembleNarrativeReview(). PURE, deterministic. NO further Bedrock call to "stitch"
// the per-cluster paragraphs and the corpus-wide trend stats into one whole-review narrative.
//
// THIS IS A DELIBERATE DEVIATION from an earlier draft of the design doc, which proposed exactly
// that: one more LLM call, handed every cluster's finished paragraph plus publicationsPerYear and
// evidenceMixByYear, asked to write the connective introduction and stitch it all into a review.
//
// SYNTH_RULES_HEAD rule 2 — "never state a number that is not written in the abstract you were
// given" — exists specifically because a model asked to summarize evidence will supply the
// CONNECTIVE TISSUE a reader expects: a pooled trend, a rough sense of "growing interest", a claim
// that one cluster's evidence is stronger than another's. None of that appears in any single
// abstract, all of it reads exactly like the sentences around it, and a "stitch these cluster
// paragraphs and these corpus-wide stats into one narrative" prompt is EXACTLY the shape of request
// that invites an overarching trend claim no single cited paper grounds — the model would be
// synthesizing across sources (the per-cluster paragraphs, the stats) that are not abstracts and
// carry no PMID to cite, so rule 1 (every claim cites a PMID) and rule 2 both stop applying to the
// one part of the document that would need them most: the INTRO, which is read first and trusted
// most.
//
// Deterministic assembly cannot invent anything — every number in the intro below is arithmetic
// over corpusStats, full stop — so it is the safer choice for a whole-review intro in particular,
// even though it costs a Bedrock call less than the design doc's earlier draft. Cheaper AND safer
// is not usually the trade-off; here it is.
const HIGHER_TIER_LABELS = new Set(['RCT', 'Meta-analysis', 'Systematic review'])

// One-sentence disclosure, present only when the caller says the corpus actually carries a
// probable-case-series flag — see flagProbableCaseSeries() in literatureSearch.corpus.ts, whose own
// comment states the same honest gap this note discloses to the reader.
const CASE_SERIES_NOTE = "Case series can't be cleanly tagged in PubMed; papers matching a probable-case-series heuristic are marked as such, not confirmed."

export function assembleNarrativeReview(
    topic: string,
    corpusStats: {
        publicationsPerYear: YearCount[]
        evidenceMixByYear: EvidenceMixByYear
        totalRecords: number
        fromYear: number
        toYear: number
    },
    clusters: Cluster[],
    clusterNarratives: ClusterNarrative[],
    hasCaseSeriesFlags: boolean,
): { intro: string; sections: ClusterNarrative[]; caseSeriesNote?: string } {
    const realClusters = clusters.filter(c => !c.isUncategorized)

    // The evidence-mix headline: sum evidenceMixByYear across every year, into exactly the three
    // buckets the intro reports. `mixTotal` is its OWN denominator — deliberately not assumed equal
    // to corpusStats.totalRecords, which may count a different pool (e.g. before/after an exclusion
    // this file has no visibility into). Never divide by a number this function did not itself sum.
    let higherTier = 0, observational = 0, otherDesign = 0, mixTotal = 0
    for (const yearCounts of Object.values(corpusStats.evidenceMixByYear)) {
        for (const [label, n] of Object.entries(yearCounts)) {
            mixTotal += n
            if (HIGHER_TIER_LABELS.has(label)) higherTier += n
            else if (label === 'Observational') observational += n
            else otherDesign += n
        }
    }
    // No evidenceMixByYear data is not "0% everything" — that would read as three arithmetic-
    // looking percentages that do not actually describe anything. Say nothing about the mix rather
    // than publish a headline with no records behind it.
    // THE REMAINDER IS SUBTRACTED, NOT ROUNDED. Rounding all three independently produced
    // "17% ... 6% ... 78%" on the 2026-08-19 run — 101% in a document whose whole claim is that its
    // numbers are checkable. Two are rounded and the third is whatever is left, so the three always
    // sum to exactly 100.
    //
    // "Clinical trial" (non-randomized) genuinely is not RCT/meta-analysis/systematic-review
    // evidence, so it stays out of the first bucket — but it is also not a guideline or a case
    // report, and the old wording filed it under those. The third bucket is now named for what it
    // actually holds rather than listed as if it were exhaustive.
    const higherPct = pct(higherTier, mixTotal)
    const obsPct = pct(observational, mixTotal)
    const mixSentence = mixTotal
        ? ` Of the evidence indexed by year, ${higherPct}% is RCT, meta-analysis or `
        + `systematic-review evidence; ${obsPct}% is observational; the `
        + `remaining ${100 - higherPct - obsPct}% is other designs — non-randomized clinical trials, `
        + `guidelines, narrative reviews, case reports and records PubMed has not indexed with a study design.`
        : ''

    // Optional trend note: mean of the first half of publicationsPerYear vs. the second half.
    // Simple, no forecasting — see the function's own header comment for why nothing fancier
    // belongs here. Skipped outright below two years of data (nothing to compare) or when both
    // halves are empty (nothing happened either way).
    const trendSentence = trendNote(corpusStats.publicationsPerYear)

    // clusterNarratives filtered to real clusters (a narrative for the uncategorized bucket, or for
    // any id that is no longer a real cluster, is simply absent from `sizeById` and drops out here),
    // ordered by that cluster's own size descending — the plan's own mockup ("Keyword clusters ...
    // sort: size"). Cluster id is the tie-break, for a deterministic order when two clusters land on
    // the same size, the same instinct clusterByMesh()'s own seed walk applies.
    const sizeById = new Map(realClusters.map(c => [c.id, c.pmids.length]))
    const sections = clusterNarratives
        .filter(n => sizeById.has(n.clusterId))
        .sort((a, b) => (sizeById.get(b.clusterId)! - sizeById.get(a.clusterId)!) || a.clusterId.localeCompare(b.clusterId))

    // A MISSING SECTION IS DISCLOSED, NOT JUST OMITTED. The caller may decline to write a narrative
    // for a cluster that scored below its relevance floor (see handleM4Synthesize) — which is the
    // point, since paying a model to write "this cluster is not relevant" is what this replaced. But
    // a reader looking at a roster of 18 clusters and finding 13 write-ups must be told why, or the
    // five missing ones look like a failure. Derived from the two counts this function already
    // holds, so nothing new has to be threaded through to say it.
    const unwritten = realClusters.length - sections.length
    const skipSentence = unwritten > 0
        ? ` ${unwritten} cluster${unwritten === 1 ? '' : 's'} scored too far off-topic for a written `
        + `summary and ${unwritten === 1 ? 'is' : 'are'} listed in the cluster table without one; `
        + `${unwritten === 1 ? 'its' : 'their'} papers remain in every count and in the corpus table.`
        : ''

    const intro = `This review covers ${corpusStats.totalRecords.toLocaleString()} records published `
        + `between ${corpusStats.fromYear} and ${corpusStats.toYear}, organized into `
        + `${realClusters.length} topic cluster${realClusters.length === 1 ? '' : 's'}.`
        + mixSentence
        + trendSentence
        + skipSentence

    return {
        intro,
        sections,
        ...(hasCaseSeriesFlags ? { caseSeriesNote: CASE_SERIES_NOTE } : {}),
    }
}

const pct = (n: number, total: number): number => Math.round((n / total) * 100)

function trendNote(years: YearCount[]): string {
    if (years.length < 2) return ''

    const mid = Math.floor(years.length / 2)
    const mean = (xs: YearCount[]) => xs.reduce((a, y) => a + y.count, 0) / xs.length
    const firstMean = mean(years.slice(0, mid))
    const secondMean = mean(years.slice(mid))
    if (firstMean === 0 && secondMean === 0) return ''

    const round1 = (n: number) => Math.round(n * 10) / 10
    // A 10% band counts as "held roughly steady" rather than forcing every small wobble into "rose"
    // or "declined" — the same coarse-and-honest posture flagProbableCaseSeries() takes on a fuzzier
    // signal. firstMean === 0 with a nonzero secondMean is an unambiguous rise (any growth from
    // nothing), handled by the Infinity ratio falling into the "increased" branch below.
    const ratio = firstMean === 0 ? Infinity : secondMean / firstMean
    const direction = ratio > 1.1 ? 'increased' : ratio < 0.9 ? 'declined' : 'held roughly steady'

    return ` Yearly publication volume ${direction} across the window — a mean of ${round1(firstMean)} `
        + `per year in the earlier half of the range versus ${round1(secondMean)} in the later half.`
}
