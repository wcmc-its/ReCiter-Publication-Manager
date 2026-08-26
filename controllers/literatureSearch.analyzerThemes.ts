// Phase 4 backend of the Literature Analyzer: "Themes" (Discovery + Classification). Two Sonnet
// passes over the working set Score Impact just produced (or a librarian-uploaded CSV of the same
// shape): Discovery clusters the WHOLE corpus into a hard-ranged number of thematic subtopics in
// ONE call, Classification then assigns each individual record a confidence map over that fixed
// theme list, batched CLASSIFY_BATCH_SIZE records per call. A third function, extendThemes(),
// covers the coverage-shortfall follow-up pass DISCOVERY_EXTENSION_PROMPT already describes.
//
// PORT PROVENANCE. DISCOVERY_SYSTEM_PROMPT, DISCOVERY_EXTENSION_PROMPT and the discovery user-
// message shape below are ReciterAI's own prompts/subtopic_discovery.py
// (DISCOVERY_SYSTEM_PROMPT / DISCOVERY_EXTENSION_PROMPT / BUILD_DISCOVERY_USER_MESSAGE), carried
// across BYTE-FOR-BYTE; ASSIGNMENT_SYSTEM_PROMPT is prompts/subtopic_assignment.py's
// ASSIGNMENT_SYSTEM_PROMPT, same discipline. Everything ELSE in this file -- the hard-range
// rewrite, the three addenda, the batch-of-CLASSIFY_BATCH_SIZE classification shape, and the
// filter/tie-break/resolve mechanisms this file calls out to literatureSearch.analyzerThemes.pure.ts
// for -- is a direct TS port of the TESTED pilot implementation at
// ~/Dropbox/Projects/ReCiter-Publication-Manager/literature-search/
// topical-analysis-pilot-2026-08-24/{run_discovery,run_classification}.py, which is what actually
// validated these mechanisms against a live 1,168-record corpus (see
// PLAN-relevance-impact-topical-analysis-2026-08-22.md lines 260-345, decisions 33/37/38/39/40).
// Diff either half against its upstream before editing.
//
// THEMES_PROMPT_VERSION bumps whenever DISCOVERY_SYSTEM_PROMPT / DISCOVERY_EXTENSION_PROMPT /
// ASSIGNMENT_SYSTEM_PROMPT are re-synced against ReciterAI -- same convention as
// IMPACT_PROMPT_VERSION / RELEVANCE_PROMPT_VERSION next door.
export const THEMES_PROMPT_VERSION = 'reciterai-subtopic-v1+pilot-mechanisms-2026-08-24'
//
// FOUR DELIBERATE DIVERGENCES FROM THE PILOT, all already tested or already decided -- see the PLAN
// lines cited above for the design contracts, and the pilot files themselves for the mechanisms:
//
//   1. HARD-RANGE REWRITE (decision 37). The pilot's own comment explains WHY: an appended "soft"
//      target addendum on top of the source prompt's own "8 to 25" rule was tested and FAILED (both
//      A/B pilot variants asked for ~12 themes and got back 24 -- the source's own numbered rule
//      dominates an appended preference). hardRangePrompt() (literatureSearch.analyzerThemes.pure.ts)
//      is the ported fix: it rewrites BOTH the prose lead-in and RULES item 1 of
//      DISCOVERY_SYSTEM_PROMPT to the computed target-plus-or-minus-2 range, and throws loudly if
//      either exact substring is not found verbatim in the source prompt -- a silent no-op would
//      leave the un-narrowed 8-25 range in force with nothing to say so, exactly the failure this
//      exists to prevent.
//   2. THREE ADDENDA, appended after the hard-ranged prompt: TARGET_COUNT_AND_COVERAGE_ADDENDUM
//      (95% coverage target, ported BYTE-FOR-BYTE, including its own "(pilot-specific...)"
//      parenthetical -- this file does not reword it, per the standing rule against touching ported
//      prompt text beyond the two named word-drops below), FIELD_LIST_ADDENDUM_A (variant A won the
//      pilot's A/B test -- pmid/title/synopsis/relevanceExplanation/impactScore/impactJustification,
//      no numeric relevance score; ported with only the words "pilot variant A" (and the "--"
//      connector grammar required them) dropped from its own parenthetical -- the field-contract
//      sentence itself is untouched), and BATCH_ADDENDUM (classification's own batching addendum,
//      ported with only the word "pilot-specific" -- and its trailing comma -- dropped).
//   3. CLASSIFY_BATCH_SIZE = 10, not the pilot's batch-20 nor PLAN decision 40's own locked-in
//      number. A USER decision overriding decision 40 -- see the constant's own comment below.
//   4. CLIENT-DRIVEN COVERAGE + EXTENSION TRIGGER (decision 38). This file exposes three phases and
//      nothing more: discoverThemes(), classifyThemesBatch(), extendThemes(). It does NOT loop --
//      checking coverage against the 95% target and deciding whether to call extendThemes() at all
//      is the CLIENT's job (coverage is only meaningful once measured AFTER Classification, which
//      this backend has no reason to run twice inside one request just to decide that). The
//      server-side loop the pilot ran inline (discover -> check coverage -> maybe extend, all
//      in run_discovery.py's own main()) is deliberately NOT reproduced here.
//
// SAME INFRASTRUCTURE DIVERGENCE AS SYNOPSIZE/RELEVANCE/IMPACT (see those files' own headers): the
// pilot parsed freeform JSON with json.loads and retried once on a JSONDecodeError; this codebase's
// invoke() forces a tool call instead (literatureSearch.llm.ts), so there is no freeform-JSON-parse
// failure mode to retry -- a tool-shaped answer is already structured, or invoke() has already
// thrown. What DOES still fail the way the pilot's parse could -- a truncated max_tokens answer, or
// a tool call whose shape invoke() cannot make sense of -- gets the pilot's own one-retry-then-abort
// discipline anyway, in discoverThemes() and extendThemes() below (DISCOVERY_ATTEMPTS = 2, i.e. one
// retry). classifyThemesBatch() instead reuses the THREE-attempt first-result-wins retry from
// scoreAnalyzerRelevance() (literatureSearch.analyzerRelevance.ts): it is a batch call over multiple
// records where a partial answer is recoverable per-record, not a single-object answer where any
// retry means asking for the whole thing again.
//
// THE PURE, CLIENT-IMPORTABLE HALF of this feature -- validateAndCleanClusters,
// filterValidAssignments, resolvePrimary, resolveRecords, the assignments-CSV round-trip, and the
// Themes working-set CSV upload/validation report -- lives in
// literatureSearch.analyzerThemes.pure.ts, a SEPARATE file with zero imports from this one or from
// literatureSearch.llm.ts, so controllers/literatureSearch.pure.check.js and a future Themes UI
// component can both import it without pulling @aws-sdk/client-bedrock-runtime into the browser
// bundle. See that file's own header for the full reasoning.
import { UsageLog, invoke, LONG_MAX_TOKENS, SCORING_MODEL_ID } from './literatureSearch.llm'
import {
    Theme, hardRangePrompt, validateAndCleanClusters, computeCoverage, filterValidAssignments,
} from './literatureSearch.analyzerThemes.pure'

// ---------------------------------------------------------------------------
// DISCOVERY_SYSTEM_PROMPT -- ReciterAI's prompts/subtopic_discovery.py, BYTE-FOR-BYTE.
export const DISCOVERY_SYSTEM_PROMPT = `You are an expert biomedical research analyst tasked with organizing a set of
research publications into thematic subtopics.

You will receive a parent topic (label and description) and a list of research activities
(publications), each with a PMID, title, synopsis, impact score, and relevance score.

Your goal is to cluster these activities into 8 to 25 coherent thematic subtopics that
reflect the actual research themes present in the data.

OUTPUT FORMAT — return ONLY a JSON object with NO markdown fences, NO commentary, NO prose:

{
  "subtopics": [
    {
      "id": "<topic_prefix>_<slug>",
      "label": "Human-Readable Label",
      "description": "One to two sentences describing the subtopic theme. This will be injected verbatim into synthesis prompts, so make it precise and informative.",
      "seed_pmids": [12345, 67890, 11122],
      "coverage_estimate": 0.18
    }
  ],
  "uncovered": [<pmid>, ...],
  "total_activities": N,
  "coverage_pct": 0.XX
}

RULES:
1. Produce between 8 and 25 subtopics. Do not go below 8 or above 25.
2. Every cluster MUST have at least 3 seed_pmids. If a potential cluster has fewer than 3
   activities, do NOT create it — leave those activities in the "uncovered" list instead.
3. Each cluster must represent a coherent, distinct theme that is actually present in the
   publication data. Do NOT invent subtopics not supported by the activities provided.
4. Leave activities unassigned (in "uncovered") rather than forcing them into a weak or
   mismatched cluster.
5. Subtopic IDs must follow the format: {topic_prefix}_{slug} where topic_prefix is
   supplied by the caller in the user message, and slug is a lowercase alphanumeric
   underscore-separated label (e.g., "aging_cellular_senescence"). IDs must not overlap
   with existing top-level taxonomy IDs.
6. Descriptions must be 1 to 2 sentences, precise, and suitable for direct injection into
   retrieval synthesis prompts. Do not use vague language.
7. Each subtopic's "coverage_estimate" is the fraction of total_activities that subtopic
   accounts for (based on seed_pmids count / total_activities).
8. "coverage_pct" is the union fraction: len(unique pmids across all seed_pmids lists) /
   total_activities.
9. No markdown fences. No code blocks. Pure JSON only. The response must parse as valid
   JSON with no modifications.
10. Clusters should be roughly balanced where the data supports it. Avoid one cluster
    capturing >40% of activities unless the topic is genuinely dominated by a single theme.
`

// DISCOVERY_EXTENSION_PROMPT -- same file, same discipline. NOTE: the doubled braces below
// (`{{topic_prefix}}`, the JSON-shape braces around "new_subtopics"/"still_uncovered") are Python
// str.format() escapes for LITERAL single braces -- they are NOT TS template-literal syntax here,
// they are just characters this template literal happens to contain twice in a row. See
// fillExtensionPrompt() for the substitution + doubled-brace unescape this ported text requires.
export const DISCOVERY_EXTENSION_PROMPT = `The previous clustering pass achieved {current_coverage_pct:.0%} activity coverage
({uncovered_count} activities remain unassigned).

Your task is to propose ADDITIONAL subtopics that capture the uncovered activities listed
below. You may add up to {extension_cap} new subtopics.

CONSTRAINTS:
- Do NOT modify or rename any existing subtopic IDs. Existing subtopics are final.
- Every new cluster MUST have at least 3 seed_pmids from the uncovered set.
- Apply the same quality rules as the initial pass: real themes only, no speculative
  clusters, 1-2 sentence descriptions, pure JSON output, no markdown fences.
- The same ID format applies: {{topic_prefix}}_{{slug}}.

Existing subtopics (IDs and labels only — do not reproduce in output):
{current_subtopics_json}

Uncovered activities to cluster:
{uncovered_activities_json}

Return ONLY a JSON object:
{{
  "new_subtopics": [
    {{
      "id": "<topic_prefix>_<slug>",
      "label": "Human-Readable Label",
      "description": "One to two sentences describing the subtopic theme.",
      "seed_pmids": [<pmid>, ...],
      "coverage_estimate": 0.XX
    }}
  ],
  "still_uncovered": [<pmid>, ...]
}}
`

// ASSIGNMENT_SYSTEM_PROMPT -- ReciterAI's prompts/subtopic_assignment.py, BYTE-FOR-BYTE.
export const ASSIGNMENT_SYSTEM_PROMPT = `You are a biomedical research classifier assigning a single research activity
(a scientific publication) to the subtopics it belongs to within a parent research topic.

You will receive:
- ONE activity with \`pmid\`, \`title\`, and \`synopsis\`.
- A parent topic with \`id\`, \`label\`, and \`description\`.
- A list of 8 to 30 candidate subtopics, each with \`id\`, \`label\`, and \`description\`.

Your job is to decide which of the listed subtopics the activity belongs to and
how confident you are in each assignment.

SUBSTRATE MATCHING (read carefully — this is a common failure mode):
Many subtopics are defined by a DATA SUBSTRATE — the kind of data the study actually
analyzes — not merely by an analytical method. Substrate qualifiers that may appear in a
subtopic's label or description include: "electronic health records / EHR", "clinical
notes / free text", "medical imaging / radiology / histopathology", "flow cytometry",
"genomics / -omics / sequencing / methylation", "liquid biopsy / circulating tumor cells",
"wearable sensors", "microbiome".

When a subtopic names a data substrate, the activity must ACTUALLY USE that substrate to
belong. Sharing only a method — machine learning, deep learning, classification,
prediction, risk modeling — is NOT enough. A study that applies machine learning to
proteomic, flow-cytometry, imaging, genomic, microbiome, or survey data does NOT belong in
an electronic-health-record subtopic just because both involve prediction or classification.

If the activity's substrate matches a DIFFERENT listed subtopic (e.g. an imaging, -omics,
computational-pathology, or liquid-biopsy subtopic), assign it there instead. If none of the
listed subtopics matches the activity's actual data substrate, return an empty assignments
list rather than forcing a method-only match.

OUTPUT FORMAT — return ONLY a JSON object with NO markdown fences, NO commentary, NO prose:

{
  "pmid": <int>,
  "topic_id": "<parent topic id>",
  "assignments": [
    {"subtopic_id": "<one of the provided ids>", "confidence": 0.XX},
    ...
  ]
}

RULES:
1. Emit zero, one, or multiple assignments. Multi-assignment is allowed when the
   activity genuinely spans more than one subtopic.
2. \`confidence\` is a float in [0.0, 1.0]. Rank assignments by confidence in
   descending order (highest confidence first).
3. Only assign an activity to a subtopic when you are reasonably sure it belongs
   — a confidence floor of 0.3 is applied downstream, so assignments below 0.3
   will be dropped. If no subtopic fits at confidence >= 0.3, return an empty
   \`assignments: []\` list — unassigned activities participate in topic-level
   retrieval (Tier 3 fallback) and are NOT an error.
4. You MUST NOT propose a \`subtopic_id\` that is not in the provided candidate
   list. Do not invent new ids, do not use parent topic ids, do not return
   top-level taxonomy ids.
5. The \`pmid\` field in the output MUST match the input activity's pmid exactly
   (integer, not string).
6. The \`topic_id\` field MUST match the provided parent topic's id.
7. No markdown fences, no code blocks, no commentary. Pure JSON only — the
   response must parse as valid JSON with no modifications.
8. Do NOT assign the same subtopic_id twice in the \`assignments\` array.
`

// ---------------------------------------------------------------------------
// Addendum 1 (discovery + extension): pilot's TARGET_COUNT_AND_COVERAGE_ADDENDUM, ported
// byte-for-byte -- NOT one of the two named word-drops, so its own "(pilot-specific...)"
// parenthetical stays exactly as ReciterAI's pilot wrote it. 95%, not the source prompt's own 85%
// (decision 38: measured post-Classification by the client, not checked here).
const TARGET_COUNT_AND_COVERAGE_ADDENDUM = `

ADDENDUM (pilot-specific, appended to the rules above -- does not replace them):
- Coverage target for this run is 95%, not 85%.`

// Addendum 2 (discovery + extension): pilot's FIELD_LIST_ADDENDUM_A (variant A won the pilot's A/B
// -- see PLAN Step A). WORD-DROP: "pilot variant A -- " removed from the parenthetical (leaving
// "(appended)"); the field-contract sentence after the colon is untouched.
const FIELD_LIST_ADDENDUM_A = `

ADDENDUM (appended): each activity supplied to you has exactly these
fields: pmid, title, synopsis, relevanceExplanation, impactScore, impactJustification.
There is no numeric relevance score in this input -- weigh topical fit from title/synopsis/
relevanceExplanation, and weigh importance from impactScore/impactJustification.`

// Addendum 3 (classification only): pilot's BATCH_ADDENDUM. WORD-DROP: "pilot-specific, " removed
// from the parenthetical (leaving "(appended -- batches ...)"); everything after is untouched,
// including the leftover "Return a JSON array" / "Output ONLY the JSON array" sentences below --
// this codebase's forced tool_choice makes them unnecessary (see this file's header, and
// literatureSearch.analyzerRelevance.ts's own comment on the identical divergence), but the
// standing rule against rewording ported prompt text beyond the two named drops means they stay.
const BATCH_ADDENDUM = `

ADDENDUM (appended -- batches multiple activities per call instead of one):
You will receive a JSON array of activities (not a single one), each with pmid, title,
synopsis. Apply the exact same substrate-matching judgment and output rules above
independently to EACH activity. Return a JSON array, one object per input activity, in the
same order, each shaped exactly like the single-activity OUTPUT FORMAT above:
{"pmid": <int>, "topic_id": "<parent topic id>", "assignments": [{"subtopic_id": "...", "confidence": 0.XX}, ...]}
Output ONLY the JSON array. No prose, no markdown fences.`

// ---------------------------------------------------------------------------
// Topic meta. `topic_prefix` is a FIXED string, 'theme' -- per this ticket's spec, IDs here only
// need INTERNAL uniqueness (there is no shared taxonomy for a discovered id to collide with, unlike
// ReciterAI's own taxonomy_v2.json-scoped prefixes). Reused as the "(id: ...)" value in both the
// discovery and classification user messages, since neither call needs a taxonomy-resolved topic id
// distinct from its own prefix.
const TOPIC_PREFIX = 'theme'

function topicLabelOf(topic: string): string {
    return topic || 'Uploaded working set'
}
function topicDescriptionOf(criteria: string | undefined): string {
    return criteria || ''
}

// ---------------------------------------------------------------------------
// DISCOVERY

export type DiscoveryActivity = {
    pmid: string
    title: string
    synopsis: string
    relevanceExplanation: string
    impactScore: number
    impactJustification: string
}

const DISCOVERY_MIN_TARGET = 2
const DISCOVERY_MAX_TARGET = 50
const DISCOVERY_DEFAULT_TARGET = 12
const THEME_COUNT_TOLERANCE = 2

// One retry, per the pilot's own "PARSE FAILURE ... retrying once ... ABORTING STAGE" discipline --
// see this file's header for how that maps onto invoke()'s forced-tool-call failure modes instead
// of a freeform JSON parse failure.
const DISCOVERY_ATTEMPTS = 2

function clampTargetThemeCount(n: unknown): number {
    const v = Math.round(Number(n))
    if (!Number.isFinite(v)) return DISCOVERY_DEFAULT_TARGET
    return Math.min(DISCOVERY_MAX_TARGET, Math.max(DISCOVERY_MIN_TARGET, v))
}

const DISCOVERY_TOOL = {
    name: 'submit_subtopics',
    description: 'Return the discovered subtopic clusters and the pmids left uncovered.',
    input_schema: {
        type: 'object' as const,
        properties: {
            subtopics: {
                type: 'array',
                description: 'One entry per discovered cluster. Every cluster needs at least 3 seed_pmids.',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: '<topic_prefix>_<slug>, lowercase alphanumeric/underscore.' },
                        label: { type: 'string', description: 'Human-readable label.' },
                        description: { type: 'string', description: '1-2 precise sentences.' },
                        seed_pmids: { type: 'array', items: { type: 'string' }, description: 'PMIDs supporting this cluster.' },
                        coverage_estimate: { type: 'number', description: 'seed_pmids count / total activities.' },
                    },
                    required: ['id', 'label', 'description', 'seed_pmids'],
                },
            },
            uncovered: { type: 'array', items: { type: 'string' }, description: 'PMIDs not assigned to any cluster.' },
        },
        required: ['subtopics', 'uncovered'],
    },
}

// Port of BUILD_DISCOVERY_USER_MESSAGE (prompts/subtopic_discovery.py) -- topic line, description,
// prefix line, activities JSON, "Produce subtopics now." No `topic_id` parameter reaches this
// function (the ticket's own contract carries only topic/criteria, not a taxonomy id) -- TOPIC_PREFIX
// fills the "(id: ...)" slot too, per that constant's own comment.
function buildDiscoveryUserMessage(topicLabel: string, topicDescription: string, activities: DiscoveryActivity[]): string {
    return `Topic: ${topicLabel} (id: ${TOPIC_PREFIX})\n`
        + `Description: ${topicDescription}\n`
        + `Topic prefix for subtopic IDs: ${TOPIC_PREFIX}\n`
        + `\n`
        + `Activities (${activities.length} total):\n${JSON.stringify(activities)}\n`
        + `\n`
        + `Produce subtopics now.`
}

export async function discoverThemes(
    topic: string,
    criteria: string | undefined,
    targetThemeCount: number | undefined,
    activities: DiscoveryActivity[],
): Promise<{ themes: Theme[]; uncovered: string[]; coveragePct: number; usage: UsageLog }> {
    const target = clampTargetThemeCount(targetThemeCount ?? DISCOVERY_DEFAULT_TARGET)
    // No floor on `low` beyond what clampTargetThemeCount already applies to `target` -- the pilot's
    // own arithmetic (`TARGET_THEME_COUNT - THEME_COUNT_TOLERANCE`) is unguarded too, so a target of
    // 2 legitimately produces "between 0 and 4 subtopics" rather than a silently-adjusted floor this
    // port did not decide to add.
    const low = target - THEME_COUNT_TOLERANCE
    const high = target + THEME_COUNT_TOLERANCE

    const topicLabel = topicLabelOf(topic)
    const topicDescription = topicDescriptionOf(criteria)
    const system = hardRangePrompt(DISCOVERY_SYSTEM_PROMPT, low, high) + TARGET_COUNT_AND_COVERAGE_ADDENDUM + FIELD_LIST_ADDENDUM_A
    const userMessage = buildDiscoveryUserMessage(topicLabel, topicDescription, activities)

    let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }
    let input: any
    let lastErr: any
    for (let attempt = 1; attempt <= DISCOVERY_ATTEMPTS; attempt++) {
        try {
            const res = await invoke(system, DISCOVERY_TOOL, userMessage, LONG_MAX_TOKENS, SCORING_MODEL_ID)
            usage = { inputTokens: usage.inputTokens + res.usage.inputTokens, outputTokens: usage.outputTokens + res.usage.outputTokens }
            if (res.input && Array.isArray(res.input.subtopics)) { input = res.input; lastErr = undefined; break }
            lastErr = new Error('discoverThemes: the model\'s answer carried no usable subtopics array')
            console.error(JSON.stringify({ tag: 'literature-themes-discover-unusable', attempt }))
        } catch (err: any) {
            usage = {
                inputTokens: usage.inputTokens + (err?.usage?.inputTokens || 0),
                outputTokens: usage.outputTokens + (err?.usage?.outputTokens || 0),
            }
            lastErr = err
            console.error(JSON.stringify({
                tag: 'literature-themes-discover-failed', attempt, error: String(err?.message || err),
                why: attempt < DISCOVERY_ATTEMPTS ? 'retrying once, per the pilot\'s own discipline' : 'aborting after 1 retry',
            }))
        }
    }
    if (lastErr) throw Object.assign(new Error(`Theme discovery failed after ${DISCOVERY_ATTEMPTS} attempts: ${lastErr.message || lastErr}`), { usage })

    const { kept, bumpedToUncovered } = validateAndCleanClusters(input.subtopics)
    const modelUncovered: string[] = Array.isArray(input.uncovered) ? input.uncovered.map((p: any) => String(p)) : []
    const uncovered = Array.from(new Set([...modelUncovered, ...bumpedToUncovered]))
    const coveragePct = computeCoverage(kept, activities.length)

    return { themes: kept, uncovered, coveragePct, usage }
}

// ---------------------------------------------------------------------------
// EXTENSION

const EXTENSION_CAP_DEFAULT = 15

const EXTENSION_TOOL = {
    name: 'submit_new_subtopics',
    description: 'Return the additional subtopic clusters proposed for the uncovered activities, and whatever remains uncovered after them.',
    input_schema: {
        type: 'object' as const,
        properties: {
            new_subtopics: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        label: { type: 'string' },
                        description: { type: 'string' },
                        seed_pmids: { type: 'array', items: { type: 'string' } },
                        coverage_estimate: { type: 'number' },
                    },
                    required: ['id', 'label', 'description', 'seed_pmids'],
                },
            },
            still_uncovered: { type: 'array', items: { type: 'string' } },
        },
        required: ['new_subtopics', 'still_uncovered'],
    },
}

// Python's str.format() substitutes named placeholders and then unescapes doubled braces to single
// ones; this does both steps explicitly. `{current_coverage_pct:.0%}` is Python's percent format
// spec -- 0 decimal places, multiplied by 100, with a trailing '%' -- so 0.23 renders as "23%",
// matched here with a plain Math.round(pct * 100). Every placeholder is checked for presence before
// substitution: the same fail-loud reasoning as hardRangePrompt (a silent no-op on a drifted
// template is worse than a thrown error naming exactly what went missing).
function fillExtensionPrompt(template: string, vars: {
    current_coverage_pct: number
    uncovered_count: number
    extension_cap: number
    current_subtopics_json: string
    uncovered_activities_json: string
}): string {
    const subs: [string, string][] = [
        ['{current_coverage_pct:.0%}', `${Math.round(vars.current_coverage_pct * 100)}%`],
        ['{uncovered_count}', String(vars.uncovered_count)],
        ['{extension_cap}', String(vars.extension_cap)],
        ['{current_subtopics_json}', vars.current_subtopics_json],
        ['{uncovered_activities_json}', vars.uncovered_activities_json],
    ]
    let out = template
    for (const [placeholder, value] of subs) {
        if (!out.includes(placeholder)) {
            throw new Error(`fillExtensionPrompt: expected placeholder not found verbatim in DISCOVERY_EXTENSION_PROMPT -- source text drifted, re-derive the fix: ${JSON.stringify(placeholder)}`)
        }
        out = out.split(placeholder).join(value)
    }
    // Python's .format() unescapes {{ }} to literal { } ONLY AFTER substituting the real
    // placeholders above -- doing this first would corrupt the {current_coverage_pct:.0%}-shaped
    // placeholders themselves, which is why it happens last.
    return out.replace(/\{\{/g, '{').replace(/\}\}/g, '}')
}

export async function extendThemes(
    topic: string,
    criteria: string | undefined,
    themes: Theme[],
    uncoveredActivities: DiscoveryActivity[],
    extensionCap: number,
    currentCoveragePct: number,
): Promise<{ newThemes: Theme[]; stillUncovered: string[]; usage: UsageLog }> {
    const topicLabel = topicLabelOf(topic)
    const topicDescription = topicDescriptionOf(criteria)
    const cap = Number.isFinite(extensionCap) && extensionCap > 0 ? Math.round(extensionCap) : EXTENSION_CAP_DEFAULT

    // No targetThemeCount reaches this call -- the ticket's own signature for extendThemes carries
    // none, unlike discoverThemes. The pilot's extension pass reuses the EXACT SAME system prompt
    // string the original discovery call built (closed over the ORIGINAL --target-theme-count), so
    // the most faithful port would thread that same target through. Absent that parameter here, the
    // low/high pair is re-derived from the theme count discovery already settled on -- a judgment
    // call, documented rather than silently guessed: if this ever needs to match the pilot's
    // literal behavior, the fix is to add a targetThemeCount parameter and thread the original
    // value through instead of this fallback.
    const target = clampTargetThemeCount(themes.length || DISCOVERY_DEFAULT_TARGET)
    const low = target - THEME_COUNT_TOLERANCE
    const high = target + THEME_COUNT_TOLERANCE
    const system = hardRangePrompt(DISCOVERY_SYSTEM_PROMPT, low, high) + TARGET_COUNT_AND_COVERAGE_ADDENDUM + FIELD_LIST_ADDENDUM_A

    const userMessage = fillExtensionPrompt(DISCOVERY_EXTENSION_PROMPT, {
        current_coverage_pct: currentCoveragePct,
        uncovered_count: uncoveredActivities.length,
        extension_cap: cap,
        current_subtopics_json: JSON.stringify(themes.map(t => ({ id: t.id, label: t.label }))),
        uncovered_activities_json: JSON.stringify(uncoveredActivities),
    })

    let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }
    let input: any
    let lastErr: any
    for (let attempt = 1; attempt <= DISCOVERY_ATTEMPTS; attempt++) {
        try {
            const res = await invoke(system, EXTENSION_TOOL, userMessage, LONG_MAX_TOKENS, SCORING_MODEL_ID)
            usage = { inputTokens: usage.inputTokens + res.usage.inputTokens, outputTokens: usage.outputTokens + res.usage.outputTokens }
            if (res.input && Array.isArray(res.input.new_subtopics)) { input = res.input; lastErr = undefined; break }
            lastErr = new Error('extendThemes: the model\'s answer carried no usable new_subtopics array')
            console.error(JSON.stringify({ tag: 'literature-themes-extend-unusable', attempt }))
        } catch (err: any) {
            usage = {
                inputTokens: usage.inputTokens + (err?.usage?.inputTokens || 0),
                outputTokens: usage.outputTokens + (err?.usage?.outputTokens || 0),
            }
            lastErr = err
            console.error(JSON.stringify({
                tag: 'literature-themes-extend-failed', attempt, error: String(err?.message || err),
                why: attempt < DISCOVERY_ATTEMPTS ? 'retrying once, per the pilot\'s own discipline' : 'aborting after 1 retry',
            }))
        }
    }
    if (lastErr) throw Object.assign(new Error(`Theme extension failed after ${DISCOVERY_ATTEMPTS} attempts: ${lastErr.message || lastErr}`), { usage })

    const { kept, bumpedToUncovered } = validateAndCleanClusters(input.new_subtopics)
    const modelStillUncovered: string[] = Array.isArray(input.still_uncovered)
        ? input.still_uncovered.map((p: any) => String(p))
        : uncoveredActivities.map(a => a.pmid)
    const stillUncovered = Array.from(new Set([...modelStillUncovered, ...bumpedToUncovered]))

    return { newThemes: kept, stillUncovered, usage }
}

// ---------------------------------------------------------------------------
// CLASSIFICATION

export type ClassifyActivity = { pmid: string; title: string; synopsis: string }
export type ThemesBatchAssignment = { pmid: string; confidences: Record<string, number> }

// CLASSIFY_BATCH_SIZE = 10. This OVERRIDES PLAN decision 40's own locked-in batch-20 -- a USER
// decision, not a re-measurement. The two points this pilot actually MEASURED are batch 20 (84/100
// primary-assignment agreement vs single-call, ~$0.0017/record) and single-call (~$0.011/record,
// higher agreement, 6.5x the cost). 10 is the user's chosen middle ground BETWEEN those two measured
// points -- itself UNMEASURED. Tunable; if this number moves, keep this comment's "measured points
// 20 and 1" framing so nobody mistakes 10 for a third measurement that was never run.
export const CLASSIFY_BATCH_SIZE = 10

// Phase 2's own convention (RELEVANCE_BASE_TOKENS/RELEVANCE_TOKENS_PER_ITEM in
// literatureSearch.analyzerRelevance.ts): base + per-item, sized to absorb Sonnet 5's unrequested
// "thinking" spend on Bedrock, which invoke() has no parameter to disable (see LONG_MAX_TOKENS's own
// comment in literatureSearch.llm.ts). At CLASSIFY_BATCH_SIZE=10 this is 1500 + 2000 = 3500,
// comfortably under LONG_MAX_TOKENS=8000.
const CLASSIFY_BASE_TOKENS = 1500
const CLASSIFY_TOKENS_PER_ITEM = 200

// Same three-attempt, first-result-wins retry shape as scoreAnalyzerRelevance() -- see that
// function's own header for why: a model that has dropped the same record twice across attempts is
// telling you something, and an unbounded retry loop over a paid call is how a run quietly costs
// real money.
const CLASSIFY_ATTEMPTS = 3

const CLASSIFY_TOOL = {
    name: 'submit_batch_assignments',
    description: 'Return one assignment object per activity supplied, in the same order. An activity with no fitting subtopic gets an empty assignments array -- that is a valid answer, not an omission.',
    input_schema: {
        type: 'object' as const,
        properties: {
            results: {
                type: 'array',
                description: 'Exactly one entry per activity supplied. Never omit an activity.',
                items: {
                    type: 'object',
                    properties: {
                        pmid: { type: 'string', description: 'The PMID, exactly as supplied.' },
                        assignments: {
                            type: 'array',
                            description: 'Zero, one, or multiple subtopic assignments for this activity.',
                            items: {
                                type: 'object',
                                properties: {
                                    subtopic_id: { type: 'string', description: 'One of the candidate subtopic ids supplied.' },
                                    confidence: { type: 'number', description: 'Float in [0.0, 1.0].' },
                                },
                                required: ['subtopic_id', 'confidence'],
                            },
                        },
                    },
                    required: ['pmid', 'assignments'],
                },
            },
        },
        required: ['results'],
    },
}

// Port of the pilot's build_batch_user_message (run_classification.py) -- subtopic block lines
// "- id: label \u2014 description", then the batch's activities as a JSON array of
// {pmid, title, synopsis} only (decision 39 -- no impactScore reaches Classification).
function buildBatchUserMessage(topicLabel: string, topicDescription: string, themes: Theme[], batch: ClassifyActivity[]): string {
    const subtopicBlock = themes.map(t => `- ${t.id}: ${t.label} \u2014 ${t.description || ''}`).join('\n')
    const activities = batch.map(r => ({ pmid: r.pmid, title: r.title, synopsis: r.synopsis }))
    return `Parent topic: ${topicLabel} (id: ${TOPIC_PREFIX})\n`
        + `Topic description: ${topicDescription}\n\n`
        + `Candidate subtopics (${themes.length}):\n${subtopicBlock}\n\n`
        + `Activities (${activities.length}):\n${JSON.stringify(activities)}\n\n`
        + `Assign each activity to the appropriate subtopics now.`
}

// Scores ONE batch (<= CLASSIFY_BATCH_SIZE items -- the route enforces that bound before calling,
// same discipline as scoreAnalyzerRelevance()). filter_valid_assignments is applied SERVER-SIDE
// here (the ticket's own spec) rather than left to the client, because `themes`' own ids are what
// "valid" means and this function already has them in hand.
export async function classifyThemesBatch(
    topic: string,
    criteria: string | undefined,
    themes: Theme[],
    batch: ClassifyActivity[],
): Promise<{ assignments: ThemesBatchAssignment[]; failed: string[]; usage: UsageLog }> {
    const topicLabel = topicLabelOf(topic)
    const topicDescription = topicDescriptionOf(criteria)
    const validIds = new Set(themes.map(t => t.id))
    const byPmid = new Map(batch.map(it => [it.pmid, it]))
    const system = ASSIGNMENT_SYSTEM_PROMPT + BATCH_ADDENDUM

    const resolved = new Map<string, Record<string, number>>()
    let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }

    let pending = batch
    for (let attempt = 1; attempt <= CLASSIFY_ATTEMPTS && pending.length; attempt++) {
        try {
            const userMessage = buildBatchUserMessage(topicLabel, topicDescription, themes, pending)
            const maxTokens = CLASSIFY_BASE_TOKENS + CLASSIFY_TOKENS_PER_ITEM * pending.length
            const { input, usage: u } = await invoke(system, CLASSIFY_TOOL, userMessage, maxTokens, SCORING_MODEL_ID)
            usage = { inputTokens: usage.inputTokens + u.inputTokens, outputTokens: usage.outputTokens + u.outputTokens }

            for (const item of (input?.results || [])) {
                const pmid = String(item?.pmid ?? '').trim()
                if (!byPmid.has(pmid)) {
                    // A result on an activity we never sent -- the same fabrication risk every other
                    // batch call in this codebase guards against. Loud, because it means the prompt
                    // or the model has drifted.
                    console.error(JSON.stringify({ tag: 'literature-themes-classify-unknown-pmid', pmid }))
                    continue
                }
                if (resolved.has(pmid)) continue   // first result wins across attempts
                // An empty assignments array is a VALID answer (rule 3 of ASSIGNMENT_SYSTEM_PROMPT --
                // "no subtopic fits" is not an omission), so it still marks this pmid resolved and
                // stops it being re-asked on the next attempt.
                resolved.set(pmid, Object.fromEntries(filterValidAssignments(item?.assignments, validIds)))
            }
        } catch (err: any) {
            usage = {
                inputTokens: usage.inputTokens + (err?.usage?.inputTokens || 0),
                outputTokens: usage.outputTokens + (err?.usage?.outputTokens || 0),
            }
            console.error(JSON.stringify({
                tag: 'literature-themes-classify-batch-failed', attempt, batchSize: pending.length,
                error: String(err?.message || err), why: 'these items get re-asked, or land in `failed` after the last attempt',
            }))
        }

        pending = pending.filter(it => !resolved.has(it.pmid))
    }

    const failed = pending.map(it => it.pmid)
    if (failed.length) {
        console.error(JSON.stringify({
            tag: 'literature-themes-classify-missing', pmids: failed,
            why: `no usable assignments after ${CLASSIFY_ATTEMPTS} attempts; returned to the caller in \`failed\`, never silent-only`,
        }))
    }

    const assignments: ThemesBatchAssignment[] = Array.from(resolved.entries()).map(([pmid, confidences]) => ({ pmid, confidences }))
    return { assignments, failed, usage }
}
