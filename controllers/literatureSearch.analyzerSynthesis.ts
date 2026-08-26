// Literature Analyzer, Phase 5 backend ("Summarize Themes") — one Bedrock call per theme, writing
// a short grounded narrative over that theme's primary-assigned records (top SYNTH_RECORD_CAP by
// overallScore, no abstract). Same two-file split as Phase 4 ("Themes"): this file owns the one
// model call; literatureSearch.analyzerSynthesis.pure.ts next door owns the scoring/ranking/
// formatting arithmetic and has zero Bedrock imports.
//
// THIS IS A PORT, NOT AN INVENTION — same discipline literatureSearch.impact.ts's own header
// states for its port. SYSTEM_PROMPT below (GROUNDING_RULES + LENGTH_RULE + TREND_RULE + the style
// line) is ~/Dropbox/Projects/ReCiter-Publication-Manager/literature-search/
// topical-analysis-pilot-2026-08-24/run_synthesis.py's own SYSTEM_PROMPT, carried across
// VERBATIM, together with its render_records() and build_user_message() shapes. Diff this against
// that upstream file before editing.
//
// PROVENANCE OF THE GROUNDING RULES THEMSELVES (the pilot's own file header states this, carried
// forward here so it isn't lost a layer down): rules 1-3's never-invent-a-number and
// section-isolation SPIRIT come from this codebase's own SYNTH_RULES_HEAD / RULE_5_CLUSTER
// (literatureSearch.llm.ts / literatureSearch.narrative.ts) — but their WORDING is adapted, by the
// pilot, to name the fields this phase actually supplies (synopsis / relevanceExplanation /
// impactJustification) rather than "the abstract", since this phase never sees one. Rule 6 is the
// pilot's own tested addition, not present in SYNTH_RULES_HEAD at all. What is ported here is the
// PILOT'S text — already adapted — not a fresh re-adaptation of SYNTH_RULES_HEAD.
//
// HONEST TEST STATUS, per PLAN-relevance-impact-topical-analysis-2026-08-22.md's Step C section
// (2026-08-25 retest, "F7 retest"): this exact prompt (grounding rule 6 added) run JOINTLY with a
// per-theme record cap of 15 raised sentence-count (3-8) compliance from 12/24 themes (50.0%) to
// 17/24 (70.8%) — a real, disclosed +20.8-point improvement, but the PLAN's own target of >=20/24
// was NOT MET. Contamination held at 0/24 both times. The two changes (rule 6, cap 15) were tested
// TOGETHER; their individual contributions are not separable from this one retest alone. See
// SYNTH_RECORD_CAP's own comment below for what that means for the record cap specifically.
//
// SAME INFRASTRUCTURE DIVERGENCE AS SYNOPSIZE/RELEVANCE/IMPACT/THEMES (see those files' own
// headers): the pilot invoked Bedrock directly and read a plain-text completion; this uses the
// codebase's forced-tool-call invoke() convention instead (CLUSTER_SYNTH_TOOL's own pattern in
// literatureSearch.narrative.ts — one required string field, 'paragraph'), so a malformed answer
// fails the same predictable way every other model call in this app does.
import { UsageLog, invoke, LONG_MAX_TOKENS, stripScaffolding } from './literatureSearch.llm'

// Bump whenever SYSTEM_PROMPT below is re-synced against run_synthesis.py, same convention as
// SYNOPSIS_PROMPT_VERSION / RELEVANCE_PROMPT_VERSION / IMPACT_PROMPT_VERSION / THEMES_PROMPT_VERSION
// next door in their own files.
export const SYNTHESIS_PROMPT_VERSION = 'pilot-2026-08-24-f7retest-17of24'

// SYNTH_RECORD_CAP = 15, NOT the design bullet's 20-30 range (PLAN Step C's first bullet, still
// unedited as the "design default" as of this port). This ships the TESTED pair instead:
// the F7 retest measured 17/24 sentence-count compliance (up from 12/24) with grounding rule 6
// AND a per-theme record cap of 15 applied JOINTLY — the 20-30 range was NEVER TESTED and has no
// measurement behind it at all. Shipping 15 ships what was actually measured; shipping 20-30 would
// ship the untested design default over data that says something narrower already helped. The
// >=20/24 target was NOT MET at 17/24 — this is a real, disclosed PARTIAL improvement, not a fix,
// and the cap is tunable if a future retest isolates its own contribution from rule 6's.
export const SYNTH_RECORD_CAP = 15

// --- GROUNDING_RULES, LENGTH_RULE, TREND_RULE, SYSTEM_PROMPT ------------------------------------
// Ported VERBATIM from run_synthesis.py — see this file's header. Do not reword; if the upstream
// pilot's own text changes, re-diff and re-port rather than hand-editing this copy out of sync.
const GROUNDING_RULES = `THESE RULES ARE ABSOLUTE. They are the reason this tool exists:
1. EVERY claim cites the paper it came from, inline, as [PMID 12345678]. A sentence that
   makes a claim and carries no PMID is a sentence you may not write. Cite multiple PMIDs
   when several papers support the same point.
2. NEVER state a number that is not written in the synopsis, relevance explanation, or
   impact justification you were given for that paper. No effect sizes, no risk ratios, no
   confidence intervals, no p values, no sample sizes, no percentages -- unless that exact
   figure appears in the material you were given for that paper, in which case state it and
   cite it. If the material does not report a number, SAY that it does not. Do not estimate
   it, pool it, average it, or infer it from the direction of the findings.
3. NEVER mention a paper you were not given, and never a PMID that is not in the list
   supplied. You have no other sources.
4. Where the papers disagree, say so plainly and cite both sides. Do not resolve a
   disagreement the evidence does not resolve, and do not smooth it into a consensus.
5. This section is ONE SECTION of a larger bibliometric review. It covers ONLY the theme
   named below. Do not generalize beyond it, and do not compare it to other themes -- you
   have not been shown their papers and cannot know what they say.
6. Not every supplied paper needs an inline citation -- papers you don't cite are listed
   automatically under "not individually discussed."`

const LENGTH_RULE = "Length: 3-8 sentences, scaled by the theme's record count and aggregate weight "
    + "(\"a 10-paper theme -> ~4 sentences, a 40-paper high-weight theme -> ~8\")."

const TREND_RULE = "If you note an apparent change in research volume or interest over time, hedge it "
    + "explicitly ('appears to have increased,' not 'has increased'), and do not read a "
    + "recent-year thinning as declining interest on its own -- very recent publications are "
    + "still working through citation and indexing lag independent of their actual reception."

export const SYNTHESIS_SYSTEM_PROMPT = "You are writing one section of a bibliometric literature review: a short narrative "
    + "synthesis of the papers in ONE theme. You are given a synopsis, relevance "
    + "explanation, and impact justification for each paper -- no abstract.\n\n"
    + `${GROUNDING_RULES}\n\n`
    + `${LENGTH_RULE}\n\n`
    + `${TREND_RULE}\n\n`
    + "Style: plain clinical prose, no headings, no bullet points, no markdown, no bold. "
    + "Write for a clinician who will check your citations."

// CLUSTER_SYNTH_TOOL's own pattern (literatureSearch.narrative.ts) — a single required 'paragraph'
// string field, forcing the shape the pilot's freeform completion never needed to declare.
const THEME_SYNTH_TOOL = {
    name: 'submit_theme_synthesis',
    description: 'Return a short narrative synthesis of the supplied papers for ONE theme of a larger bibliometric review.',
    input_schema: {
        type: 'object' as const,
        properties: {
            paragraph: {
                type: 'string',
                description: 'The narrative synthesis for this theme only. Every claim cites its source inline as [PMID 12345678]. 3-8 sentences of plain clinical prose, no headings, no markdown, no bold.',
            },
        },
        required: ['paragraph'],
    },
}

export type ThemeSynthesisRecord = {
    pmid: string
    title: string
    synopsis: string
    relevanceExplanation: string
    impactJustification: string
}

export type ThemeInput = { id: string; label: string; description: string }

export type ThemeSynthesis = {
    paragraph: string
    citedPmids: string[]
    // The model's own contamination, carried ON THE WIRE — same rule ClusterNarrative.invented
    // follows in literatureSearch.narrative.ts, for the same reason: a detection nobody sees is
    // not a detection. The client persists citedPmids per section (whether or not `invented` is
    // present) for the Staleness diff — see PLAN's own "Staleness" section.
    invented?: string[]
}

// Port of the pilot's render_records() (run_synthesis.py) — per-record content is EXACTLY
// [PMID nnn] title / SYNOPSIS / RELEVANCE / IMPACT, no abstract. Field order and labels are
// verbatim; do not reorder or rename.
function renderSynthesisRecords(records: ThemeSynthesisRecord[]): string {
    return records.map(r =>
        `[PMID ${r.pmid}] ${r.title}\n`
        + `SYNOPSIS: ${r.synopsis}\n`
        + `RELEVANCE: ${r.relevanceExplanation}\n`
        + `IMPACT: ${r.impactJustification}`,
    ).join('\n\n')
}

// Port of the pilot's build_user_message() (run_synthesis.py). NOTE WHAT IS DELIBERATELY ABSENT:
// `topic` never appears in this message, even though it is a parameter of synthesizeTheme() below
// (kept for signature parity with synthesizeCluster() and for the caller's own logging/attribution
// needs) — the pilot's TESTED user message never mentions the review topic at all, only the theme's
// own label/description and its records, and porting FAITHFULLY means not adding a line the tested
// configuration never had.
function buildSynthesisUserMessage(theme: ThemeInput, records: ThemeSynthesisRecord[]): string {
    return `Theme: ${theme.label}\n`
        + `Theme description: ${theme.description || ''}\n\n`
        + `The ${records.length} papers selected for this theme:\n\n`
        + `${renderSynthesisRecords(records)}\n\n`
        + `Write the synthesis now.`
}

// 3-attempt, first-usable-wins retry — the mockup's own failed-card copy ("malformed after 3
// retries") names this exact budget. Unlike classifyThemesBatch()'s batch-shaped retry (where a
// partial answer is recoverable per-record across attempts), this call has ONE field to fill:
// the first attempt that returns a non-empty paragraph wins outright, and nothing about a later
// attempt could improve on an already-usable answer.
const SYNTHESIS_ATTEMPTS = 3

// One invoke() per call, over the records the CALLER already ranked and capped (topNByOverallScore
// in literatureSearch.analyzerSynthesis.pure.ts, applied by the route before this function ever
// runs) — this function does no ranking of its own, same contract synthesizeCluster() already has
// with its own shortlist. `topic` is accepted but not used in the composed prompt — see
// buildSynthesisUserMessage()'s own comment for why. No modelId override is passed to invoke(): the
// environment default (BEDROCK_MODEL_ID) is used, same as synthesizeCluster() — Phase 5 is the one
// step in this feature's model table deliberately left on the pricier default model rather than
// pinned to SCORING_MODEL_ID (Sonnet 5), per PLAN's own model-selection reasoning.
export async function synthesizeTheme(
    topic: string,
    theme: ThemeInput,
    records: ThemeSynthesisRecord[],
): Promise<{ synthesis: ThemeSynthesis; usage: UsageLog }> {
    void topic   // see buildSynthesisUserMessage()'s comment — accepted for signature/logging parity only

    const byPmid = new Map(records.map(r => [r.pmid, r]))
    const userMessage = buildSynthesisUserMessage(theme, records)

    let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }
    let paragraph = ''
    for (let attempt = 1; attempt <= SYNTHESIS_ATTEMPTS && !paragraph; attempt++) {
        try {
            // LONG_MAX_TOKENS — same ceiling synthesizeCluster() uses, and for the same reason: a
            // paragraph cut off mid-sentence is exactly the failure invoke() already refuses on
            // (its own max_tokens check), and the ceiling costs nothing on calls that never reach it.
            const { input, usage: u } = await invoke(SYNTHESIS_SYSTEM_PROMPT, THEME_SYNTH_TOOL, userMessage, LONG_MAX_TOKENS)
            usage = { inputTokens: usage.inputTokens + u.inputTokens, outputTokens: usage.outputTokens + u.outputTokens }

            const candidate = stripScaffolding(String(input?.paragraph ?? '').trim(), `theme:${theme.id}`)
            if (candidate) { paragraph = candidate; break }

            console.error(JSON.stringify({
                tag: 'literature-synthesis-empty', themeId: theme.id, attempt,
                why: attempt < SYNTHESIS_ATTEMPTS ? 'empty paragraph, retrying' : 'empty paragraph, aborting after 3 attempts',
            }))
        } catch (err: any) {
            // Bedrock has already billed by the time an answer is rejected — carry the spend
            // forward across attempts, same convention as scoreAnalyzerRelevance()/discoverThemes().
            usage = {
                inputTokens: usage.inputTokens + (err?.usage?.inputTokens || 0),
                outputTokens: usage.outputTokens + (err?.usage?.outputTokens || 0),
            }
            console.error(JSON.stringify({
                tag: 'literature-synthesis-failed', themeId: theme.id, attempt,
                error: String(err?.message || err),
                why: attempt < SYNTHESIS_ATTEMPTS ? 'retrying' : 'aborting after 3 attempts',
            }))
        }
    }

    // EMPTY/BLANK AFTER RETRIES IS A FAILURE, and it carries the billed usage on its way out —
    // same billed()-style convention every other call in this feature follows (see
    // literatureSearch.llm.ts's own billed() comment, and discoverThemes()/extendThemes()'s
    // Object.assign(new Error(...), { usage }) throws): the route's catch block folds err.usage
    // into its running total before it logs, so a refused answer is never logged as a free run.
    if (!paragraph) {
        throw Object.assign(
            new Error(`Theme synthesis failed after ${SYNTHESIS_ATTEMPTS} attempts: the model did not return a usable synthesis`),
            { usage },
        )
    }

    // Contamination check — IDENTICAL MECHANISM to synthesizeCluster() (literatureSearch.narrative.ts):
    // regex out every [PMID \d+], compare against the records ACTUALLY SUPPLIED to this call (this
    // theme's capped shortlist, not the whole corpus), and anything outside that set is
    // contamination. The prose is NEVER rewritten to remove it — silently editing the model's own
    // output would be a second fabrication laid over the first — it is only ever reported, loudly,
    // and returned to the caller so the client can show it and persist citedPmids for the
    // Staleness diff.
    const cited = new Set((paragraph.match(/\[PMID\s+(\d+)\]/gi) || [])
        .map(m => (m.match(/\d+/) || [''])[0]).filter(Boolean))
    const invented = Array.from(cited).filter(p => !byPmid.has(p))
    if (invented.length) {
        console.error(JSON.stringify({
            tag: 'literature-synthesis-bad-citation', themeId: theme.id, pmids: invented,
            why: 'the theme synthesis cites PMIDs that were not among the records supplied for this theme',
        }))
    }

    return {
        synthesis: {
            paragraph,
            citedPmids: Array.from(cited).filter(p => byPmid.has(p)),
            ...(invented.length ? { invented } : {}),
        },
        usage,
    }
}
