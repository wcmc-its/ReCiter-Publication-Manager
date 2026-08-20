// Mode 4 (bibliometric review) — the MODEL-JUDGED impact score.
//
// THIS IS A PORT, NOT AN INVENTION. The system prompt below is ReciterAI's IMPACT_PROMPT_V2
// (pipeline_enrichment/prompts.py) carried across substantially verbatim, and the user content is
// its build_impact_user_content() (same file). Keeping the wording byte-similar is the point: the
// ~90 calibrated anchors ARE the score. A 72 out of this file and a 72 out of ReciterAI's nightly
// enrichment mean the same thing, so a WCM paper can be compared against a literature-review corpus
// without re-deriving what the number means. Diff this against upstream before editing either.
//
// WHY WE DO NOT JUST CALL ReciterAI. It serves no runtime API — ARCHITECTURE.md:108 says so
// outright; it is batch ETL to DynamoDB and MariaDB. More decisively, every one of its entrypoints
// resolves publications through `FROM analysis_summary_article WHERE pmid IN (...)`, and that table
// holds only ReCiter-accepted, WCM-authored publications. A literature-review corpus is mostly NOT
// WCM-authored, so those PMIDs resolve to zero rows and are silently dropped. The scoring core is
// portable; the plumbing around it is not. So we port the core.
//
// TWO DELIBERATE DIVERGENCES FROM UPSTREAM, both about cost, neither about calibration:
//
//   1. BATCHED, ~50 papers per call, where ReciterAI scores one paper per call. It enriches a daily
//      delta of a few dozen; this scores a shortlist in one interactive request a librarian is
//      waiting on. The anchors live in the SYSTEM prompt, which is identical on every call either
//      way, so what the model is calibrated against does not change with the batch size. This
//      mirrors scoreRelevance() next door, which already proved the shape in this codebase.
//   2. SHORTLIST ONLY, never the full corpus. preFilterForScoring() already picks the ~200 records
//      worth a paid call; a 2,320-record corpus would otherwise mean 2,320 model calls, ~200 of them
//      spent on papers an over-broad strategy should never have retrieved. The rest of the corpus
//      keeps impactScoreOf()'s free deterministic prior (literatureSearch.score.ts) and its real
//      iCite percentile, which is not nothing — it is just not a judgment.
//
// AND THE ONE THING THIS IS NOT: a replacement for impactScoreOf(). They are separate axes and they
// stay separate on the record, per the standing rule that a multi-axis ranker must not pre-collapse
// its axes into one scalar. impactScoreOf() is free, deterministic, and covers 100% of the corpus;
// this is paid, judged, and covers the shortlist. A reader gets to sort on either.
import { PubRecord } from './literatureSearch.records'
import { UsageLog, invoke, LONG_MAX_TOKENS } from './literatureSearch.llm'
import { RECORD_CAP } from './literatureSearch.strategy'

// ReciterAI's own prompt-version marker, carried across so a score can be traced to the wording that
// produced it. Bump this whenever the prompt below is re-synced with upstream.
export const IMPACT_PROMPT_VERSION = 'reciterai-v2'

// Upstream: pipeline_enrichment/prompts.py, IMPACT_PROMPT_V2. The parity constraint and the
// counterfactual check at the end are not decoration — they were added upstream to close a measured
// clinical-vs-basic scoring gap (8.2 → 6.3 points, bias correlation -0.342 → -0.306). Do not trim
// them to shorten the prompt.
const IMPACT_PROMPT = `You are an expert evaluator of biomedical and life-science research impact.

Given a publication, estimate its overall research impact on a 0-100 scale.

**PARITY CONSTRAINT (must follow):**
If two papers have comparable field-normalized influence signals (e.g., similar NIH iCite percentile tier, citation trajectory relative to age, or guideline/policy adoption), they should receive similar impact scores regardless of whether the work is clinical or basic. Do not apply a higher "bar" for clinical research.

Consider:
- **Originality / Novelty** (relative to the knowledge at time of publication)
  - Novelty includes: (a) new biological mechanism, (b) new causal clinical evidence, (c) new scalable care-delivery or implementation strategy, or (d) new population-health intervention with measurable outcomes. All four are equally valid forms of novelty.
- **Methodological Quality / Rigor**
  - For well-powered RCTs, large cohorts, or rigorous quasi-experiments: treat scale + real-world heterogeneity as a strength, not a weakness.
- **Evidence of Influence / Uptake** (guidelines, policy, practice change, platform uptake, downstream trials)
  - If strong influence evidence exists, it can outweigh mechanistic novelty.
- **Practical or Translational Relevance** (potential to improve patient care, inform policy, enable research, or impact technology/industry)
- **Citation Potential** (use current citation count, NIH percentile rank *if available*, publication date, and field's citation half-life)
- **Venue Prestige** (journal impact and reputation; for newer papers, venue prestige carries proportionally more weight)

If a study is primarily basic, computational, or methodological, do not penalize it for lacking direct clinical relevance. Instead emphasize novelty, rigor, reproducibility, and potential influence on research or practice.

**IMPORTANT: Do not systematically score clinical, epidemiological, or population health research lower than basic science.** A landmark cohort study that changes clinical guidelines, a health services study that transforms care delivery, or an implementation science paper that enables widespread adoption of evidence-based practice can be equally impactful as a molecular discovery — they represent different but equally valid forms of scientific contribution.

The highest scores (90+) should be reserved for paradigm-shifting contributions in ANY domain:
- Fundamental biological mechanisms (e.g., DNA structure)
- Transformative clinical evidence (e.g., trials establishing life-saving interventions)
- Population health breakthroughs (e.g., studies that fundamentally change disease prevention or health policy)
- Methodological innovations (e.g., methods enabling entirely new fields of inquiry)

Do not apply field-specific bonuses; score relative to typical impact standards across biomedical research.

Calibrated Examples (anchor points):

LOW TIER (0-30) — Preliminary, underpowered, or incremental work across all domains:
Score 8 — Letter to editor with anecdotal observation
Score 10 — Pilot computational model, single dataset, no external validation
Score 12 — Case report, single patient, regional journal
Score 15 — Preliminary in-vitro study, single cell line, no replication
Score 18 — Preliminary study, n<10, no controls
Score 20 — Animal study, n=6, underpowered, incremental mechanistic finding
Score 22 — Cross-sectional survey, n=200, regional journal, descriptive only
Score 25 — Bioinformatics pipeline, narrow applicability, marginal improvement over existing tools
Score 28 — Case series, n=25, single academic medical center

LOW-MID TIER (31-50) — Solid but incremental contributions:
Score 32 — In-vitro study, established methods, incremental findings
Score 35 — Retrospective chart review, single center, n=100, confirmatory
Score 36 — Cross-sectional clinical study (n=500) with validated measures, practice-informing
Score 38 — Well-conducted animal study replicating known mechanism in new model
Score 40 — Single-center prospective cohort (n=300) identifying clinically relevant associations
Score 42 — Multi-center retrospective study, n=1,000, clear findings, practice-informing
Score 44 — Quality improvement study demonstrating measurable patient outcome improvement
Score 45 — Well-designed animal study demonstrating novel mechanism
Score 46 — Diagnostic accuracy study (n=500+) for clinically important condition
Score 48 — Phase 2 clinical trial, n=80, promising efficacy and safety results
Score 50 — Rigorous qualitative study revealing new insights into patient experience or care delivery
Score 50 — Pilot RCT (n=100-200) with promising clinical efficacy signal

MID-HIGH TIER (51-70) — Strong contributions with clear influence:
Score 52 — Systematic review without meta-analysis, comprehensive, practice-informing
Score 53 — Prospective clinical registry (n=2,000+) establishing real-world treatment patterns
Score 55 — Prospective cohort study (n=5,000) identifying novel risk factors
Score 55 — Well-designed in-vitro study revealing a previously unknown signaling pathway
Score 56 — Comparative effectiveness study (n=10,000+) informing treatment selection in routine care
Score 57 — Health economics study demonstrating cost-effectiveness of clinical intervention
Score 58 — Implementation study demonstrating successful evidence-based practice adoption across multiple sites
Score 59 — Phase 3 RCT (n=300-500) with positive primary endpoint, specialty journal
Score 60 — Cost-effectiveness analysis influencing coverage or formulary decisions
Score 60 — Quality improvement collaborative achieving sustained improvement across 20+ hospitals
Score 61 — Diagnostic validation study establishing clinical utility for decision-making
Score 62 — Health services study identifying systematic disparities with policy implications
Score 62 — Behavioral intervention RCT (n=500) with durable lifestyle modification outcomes
Score 63 — Multicenter observational study (n=5,000+) influencing clinical practice
Score 65 — Machine-learning model achieving state-of-the-art prediction with clinical utility
Score 65 — Multi-site pragmatic trial demonstrating intervention effectiveness in real-world settings
Score 66 — Phase 3 RCT (n=500-1,000) published in high-impact general medical journal
Score 68 — Meta-analysis of RCTs providing definitive effect estimates, incorporated into guidelines
Score 68 — National cohort study (n=50,000+) establishing novel disease-outcome associations
Score 70 — Breakthrough method paper, widely adoptable across fields
Score 70 — Landmark screening trial (e.g., NLST-scale) changing national screening recommendations

HIGH TIER (71-89) — Major contributions changing practice, policy, or scientific understanding:
Score 72 — Large Phase 3 RCT (n=1,000+) changing treatment guidelines
Score 74 — Cluster-randomized trial demonstrating effective health system intervention at scale
Score 75 — High-impact discovery paper (Nature/Science) revealing novel mechanism with broad implications
Score 75 — NEJM clinical trial, n=2,000, definitive results, practice-changing
Score 77 — Large pragmatic trial demonstrating real-world effectiveness, informing policy
Score 78 — Major cohort study (Nurses' Health, Framingham-scale) establishing foundational risk associations
Score 78 — DCCT/UKPDS-scale trial establishing intensive treatment paradigm for chronic disease
Score 80 — Revolutionary technique enabling new research field
Score 82 — First-in-class therapy discovery with clear path to clinical application
Score 84 — Practice-changing diagnostic breakthrough with widespread adoption
Score 85 — Landmark epidemiological study directly changing public health policy or clinical guidelines
Score 86 — Definitive large-scale trial resolving long-standing clinical equipoise (e.g., SPRINT, ALLHAT)
Score 87 — Major pathophysiology discovery with direct therapeutic implications
Score 88 — Implementation framework or quality measures adopted nationally (e.g., RE-AIM, HEDIS-level influence)

EXCEPTIONAL TIER (90-100) — Paradigm-shifting, field-defining contributions (any domain):
Score 90 — First successful gene therapy for inherited disease (ADA-SCID)
Score 90 — Doll and Hill studies establishing smoking-lung cancer causal link
Score 91 — mRNA vaccine platform proof-of-concept enabling COVID-19 response
Score 91 — Framingham Heart Study establishing modern cardiovascular epidemiology
Score 92 — Discovery of HIV as causative agent of AIDS
Score 93 — Original CRISPR-Cas9 genome editing paper (Doudna/Charpentier)
Score 94 — WHI hormone therapy trials overturning decades of clinical practice
Score 96 — First description of PCR amplification technique
Score 97 — Discovery of penicillin's antibiotic properties
Score 98 — Discovery of insulin and successful diabetes treatment
Score 99 — Discovery of DNA double helix structure (Watson/Crick, 1953)

**Before finalizing your score, perform this counterfactual check:**
"If this same influence evidence were attached to a basic-science paper, would I score it higher?"
If yes, raise the score until parity is achieved.

BATCH RULES (this deployment scores several papers per call):
- Return exactly one entry for EVERY paper supplied. Never skip one, never merge two, never invent a PMID.
- Score each paper on its own merits against the anchors above. Do NOT grade on a curve within the batch — a batch that happens to contain ten weak papers must not push any of them upward, and a batch of ten landmarks must not push any of them down.
- The justification is at most 10 words and must name the specific thing that set the score ("guideline-adopted meta-analysis", "single-centre retrospective, n=100"). Never write "high impact" or "moderate impact" — that is the score restated, and it cannot be checked.`

const IMPACT_TOOL = {
    name: 'submit_impact_scores',
    description: 'Return an impact score and justification for EVERY paper supplied.',
    input_schema: {
        type: 'object' as const,
        properties: {
            scores: {
                type: 'array',
                description: 'Exactly one entry per paper supplied. Never omit a paper.',
                items: {
                    type: 'object',
                    properties: {
                        pmid: { type: 'string', description: 'The PMID, exactly as supplied.' },
                        impactScore: { type: 'integer', description: '0-100 integer, calibrated against the anchor examples.' },
                        justification: { type: 'string', description: 'At most 10 words naming what set the score.' },
                    },
                    required: ['pmid', 'impactScore', 'justification'],
                },
            },
        },
        required: ['scores'],
    },
}

export type ImpactJudgment = { score: number; justification: string }

// Upstream: build_impact_user_content(). The ABSENT LINES ARE THE DESIGN — upstream omits the
// citation, percentile and RCR lines entirely when the value is null rather than writing "unknown"
// or 0, so a 2026 paper is scored on title, journal, year and abstract alone. That is the honest
// degradation: a paper iCite has not scored yet has no citation evidence, and telling the model "0
// citations" would be a claim, not an absence. Verified against the live API on the 2026-08-19
// corpus: iCite scores 100% of 2016-2024 and 0% of 2025-26, so roughly a fifth of a decade-wide
// corpus reaches this function with all three lines missing, by design and not by fault.
function renderForImpact(r: PubRecord): string {
    const parts = [`PMID: ${r.pmid}`]
    if (r.title) parts.push(`Title: ${r.title}`)
    parts.push(`Journal: ${r.journal || 'Unknown journal'} (${r.year || 'Unknown year'})`)
    if (typeof r.citationCount === 'number') parts.push(`Citation Count (NIH): ${r.citationCount}`)
    if (typeof r.nihPercentile === 'number') parts.push(`NIH iCite Percentile: ${r.nihPercentile}`)
    if (typeof r.rcr === 'number') parts.push(`Relative Citation Ratio: ${r.rcr.toFixed(2)}`)
    // PubMed's own indexed publication types, which upstream does not have and we do. Cheap, and it
    // is the one signal the anchors lean on hardest ("Phase 3 RCT", "Case series", "Meta-analysis").
    if (r.design) parts.push(`Publication type (PubMed-indexed): ${r.design}`)
    if (r.abstract) {
        const abstract = r.abstract.length > 3000 ? `${r.abstract.slice(0, 3000)}...` : r.abstract
        parts.push(`\nAbstract:\n${abstract}`)
    }
    return parts.join('\n')
}

// Same three-attempt shape, same never-throw contract, and the same first-answer-wins rule as
// scoreRelevance() in literatureSearch.score.ts — see its comments for why a batch failure is
// caught and logged rather than propagated. A missing impact score costs one blank cell; it must
// never cost the run.
const IMPACT_ATTEMPTS = 3

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

export async function scoreImpact(
    shortlist: PubRecord[],
): Promise<{ scores: Map<string, ImpactJudgment>; usage: UsageLog }> {
    const byPmid = new Map(shortlist.map(r => [r.pmid, r]))
    const scores = new Map<string, ImpactJudgment>()
    let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }

    let pending = shortlist
    for (let attempt = 1; attempt <= IMPACT_ATTEMPTS && pending.length; attempt++) {
        for (const batch of chunk(pending, RECORD_CAP)) {
            try {
                const res = await attemptImpactBatch(batch, byPmid)
                usage = {
                    inputTokens: usage.inputTokens + res.usage.inputTokens,
                    outputTokens: usage.outputTokens + res.usage.outputTokens,
                }
                for (const [pmid, s] of res.scores) if (!scores.has(pmid)) scores.set(pmid, s)
            } catch (err: any) {
                // Bedrock has already billed by the time an answer is rejected — count it anyway,
                // same reasoning as billed() in literatureSearch.llm.ts.
                usage = {
                    inputTokens: usage.inputTokens + (err?.usage?.inputTokens || 0),
                    outputTokens: usage.outputTokens + (err?.usage?.outputTokens || 0),
                }
                console.error(JSON.stringify({
                    tag: 'literature-impact-batch-failed', attempt, batchSize: batch.length,
                    error: String(err?.message || err), why: 'these records stay unscored',
                }))
            }
        }

        const before = pending.length
        pending = pending.filter(r => !scores.has(r.pmid))
        if (pending.length && pending.length !== before) {
            console.error(JSON.stringify({
                tag: 'literature-impact-reask', attempt, asked: before,
                answered: before - pending.length, reasking: pending.length,
            }))
        }
    }

    if (pending.length) {
        console.error(JSON.stringify({
            tag: 'literature-impact-missing', pmids: pending.map(r => r.pmid),
            why: 'the model returned no impact score for these records after 3 attempts; they render with none',
        }))
    }

    return { scores, usage }
}

async function attemptImpactBatch(
    batch: PubRecord[],
    byPmid: Map<string, PubRecord>,
): Promise<{ scores: Map<string, ImpactJudgment>; usage: UsageLog }> {
    const userMsg = `Score all ${batch.length} papers below. Return one entry per paper.\n\n`
        + batch.map(renderForImpact).join('\n\n---\n\n')

    const { input, usage } = await invoke(IMPACT_PROMPT, IMPACT_TOOL, userMsg, LONG_MAX_TOKENS)

    const scores = new Map<string, ImpactJudgment>()
    for (const s of (input?.scores || [])) {
        const pmid = String(s?.pmid ?? '').trim()
        if (!byPmid.has(pmid)) {
            console.error(JSON.stringify({ tag: 'literature-impact-unknown-pmid', pmid }))
            continue
        }
        const raw = Number(s?.impactScore)
        if (!Number.isFinite(raw)) continue   // an unparseable score is the same as no score at all
        // Clamped and rounded to an integer, exactly as upstream does at impact.py:162 — the schema
        // asks for an integer 0-100, and a model that answers 87.5 or 105 should still produce a
        // usable number rather than a rejected batch.
        const score = Math.max(0, Math.min(100, Math.round(raw)))
        const justification = String(s?.justification ?? '').trim() || 'No justification given.'
        if (!scores.has(pmid)) scores.set(pmid, { score, justification })
    }
    return { scores, usage }
}
