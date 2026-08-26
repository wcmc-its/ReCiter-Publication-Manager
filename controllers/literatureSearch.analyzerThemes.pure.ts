// Literature Analyzer, Phase 4 ("Themes") — the PURE half. Every function in this file is a direct
// TS port of a mechanism the pilot at ~/Dropbox/Projects/ReCiter-Publication-Manager/
// literature-search/topical-analysis-pilot-2026-08-24/{run_discovery,run_classification}.py already
// validated against a live 1,168-record corpus, plus the CSV shapes this feature's UI needs. NOTHING
// HERE CALLS BEDROCK OR PUBMED, and nothing here imports anything that does (compare
// literatureSearch.analyzerThemes.ts next door, which owns every model call) — that is the whole
// reason this is a SEPARATE file: controllers/literatureSearch.pure.check.js needs to compile and
// exercise this logic with zero network, zero LLM and zero .env.local, and a future Themes UI
// component needs to import the SAME logic (CSV round-trip, the validation report) into the browser
// bundle without pulling in @aws-sdk/client-bedrock-runtime through literatureSearch.llm.ts. This is
// exactly the split literatureSearch.strategy.ts already has (LiteratureAnalyzer.tsx imports
// parseSeeds from it directly, bypassing the controller barrel) — same pattern, new file.

// ---------------------------------------------------------------------------
// Shared constants. MIN_CLUSTER_SIZE / CONFIDENCE_FLOOR / TIE_EPSILON are ReciterAI's own
// thresholds, carried across via the pilot (its own header cites discover_min_cluster_size=3,
// config/thresholds.json, and its own CONFIDENCE_FLOOR/TIE_EPSILON constants) — never re-derived.
export const MIN_CLUSTER_SIZE = 3
export const CONFIDENCE_FLOOR = 0.3
export const TIE_EPSILON = 0.001

export type Theme = {
    id: string
    label: string
    description: string
    seed_pmids: string[]
    coverage_estimate?: number
}

// ---------------------------------------------------------------------------
// TOOL-ANSWER UNWRAP. Live-verified failure (dev server, 2026-08-26, two consecutive discoverThemes
// attempts): this codebase's invoke() forces a tool call (see literatureSearch.analyzerThemes.ts's
// own header on that divergence from the pilot's freeform json.loads), but DISCOVERY_SYSTEM_PROMPT /
// DISCOVERY_EXTENSION_PROMPT / ASSIGNMENT_SYSTEM_PROMPT are BYTE-FOR-BYTE ports of prompts written
// for that freeform path -- each has its own "OUTPUT FORMAT -- return ONLY a JSON object" section.
// Under tool forcing, Sonnet sometimes obeys that section literally: it builds the JSON object the
// prose describes and stuffs the WHOLE THING, serialized, into the one tool-input field the OUTPUT
// FORMAT names first (`res.input` came back as `{"subtopics": "<the entire pilot-format object,
// JSON-encoded>"}`, decoding to `{"subtopics":[...],"uncovered":[...],"total_activities":4,
// "coverage_pct":0.75}`) -- instead of populating the tool's fields directly. `Array.isArray` on
// that string is false, so the existing shape check aborted the whole call after
// DISCOVERY_ATTEMPTS, having already billed both attempts.
//
// unwrapToolInput recovers the answer without touching the ported prompt text (the standing rule
// against editing it beyond the two named word-drops stays -- the fix is a short addendum at each
// call site plus this reader, never a rewrite of OUTPUT FORMAT prose). It tries, in order:
//   (a) `input[arrayField]` is already an array -- the correct shape -- return `input` unchanged.
//   (b) `input[arrayField]` is a string -- JSON.parse it. If that yields an array, return `input`
//       with the field replaced by the parsed array. If it yields an object whose OWN
//       `[arrayField]` is an array, return THAT object instead -- it is the whole pilot-format
//       answer (sibling fields like `uncovered`/`total_activities`/`coverage_pct` included), and
//       its values are preferred over anything already sitting beside the string in `input`.
//   (c) `input` itself is a string (the model wrapped nothing in tool fields at all) -- parse it and
//       return the parsed object if its `[arrayField]` is an array.
//   Anything else -- unparseable JSON, a shape matching none of the above -- returns null. Never
//   throws: null is exactly the "unusable" signal the existing one-retry-then-abort callers already
//   check for.
export function unwrapToolInput(input: any, arrayField: string): any | null {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
        const field = input[arrayField]
        if (Array.isArray(field)) return input
        if (typeof field === 'string') {
            let parsed: any
            try { parsed = JSON.parse(field) } catch { return null }
            if (Array.isArray(parsed)) return { ...input, [arrayField]: parsed }
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed[arrayField])) return parsed
            return null
        }
        return null
    }
    if (typeof input === 'string') {
        let parsed: any
        try { parsed = JSON.parse(input) } catch { return null }
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed[arrayField])) return parsed
        return null
    }
    return null
}

// ---------------------------------------------------------------------------
// Port of ReciterAI's _validate_and_clean_clusters, via the pilot's validate_and_clean_clusters
// (run_discovery.py): drop any cluster with fewer than MIN_CLUSTER_SIZE seed_pmids, moving its
// pmids into "uncovered" rather than discarding them — an activity that almost formed a cluster is
// not evidence of nothing, it is evidence the model tried and the corpus did not support it at that
// size.
export function validateAndCleanClusters(
    subtopics: any[],
    minSize: number = MIN_CLUSTER_SIZE,
): { kept: Theme[]; bumpedToUncovered: string[] } {
    const kept: Theme[] = []
    const bumpedToUncovered: string[] = []
    for (const cluster of subtopics || []) {
        if (!cluster || typeof cluster !== 'object') continue
        const seeds = (Array.isArray(cluster.seed_pmids) ? cluster.seed_pmids : []).map((p: any) => String(p))
        if (seeds.length < minSize) {
            bumpedToUncovered.push(...seeds)
            continue
        }
        kept.push({
            id: String(cluster.id ?? ''),
            label: String(cluster.label ?? ''),
            description: String(cluster.description ?? ''),
            seed_pmids: seeds,
            ...(typeof cluster.coverage_estimate === 'number' ? { coverage_estimate: cluster.coverage_estimate } : {}),
        })
    }
    return { kept, bumpedToUncovered }
}

// Port of the pilot's compute_coverage: the UNION fraction, not a sum of per-cluster estimates — a
// pmid that seeds two clusters must not be double-counted, per DISCOVERY_SYSTEM_PROMPT rule 8
// ("coverage_pct is the union fraction"). Recomputed independently here rather than trusting the
// model's own self-reported coverage_pct, exactly as the pilot does (it never reads
// parsed1.get("coverage_pct")).
export function computeCoverage(themes: Theme[], totalCount: number): number {
    if (!totalCount) return 0
    const union = new Set<string>()
    for (const t of themes) for (const p of t.seed_pmids) union.add(p)
    return union.size / totalCount
}

// ---------------------------------------------------------------------------
// Port of the pilot's _hard_range_prompt (run_discovery.py) — decision 37's tested fix for the
// soft-preference addendum that FAILED (both A/B pilot variants asked for ~12 themes and got back
// 24, because DISCOVERY_SYSTEM_PROMPT's own "8 to 25" rule dominates an appended preference on top
// of it). Rewrites BOTH the prose lead-in AND the RULES item 1 of the ported DISCOVERY_SYSTEM_PROMPT
// to the caller's computed [low, high] range, and — this is the load-bearing half of the port, not
// decoration — throws loudly if either exact substring is not found verbatim in the prompt handed
// in. A silent no-op here would leave the un-narrowed 8-25 range in force with nothing on the page
// or in a log to say so, which is exactly the failure this function exists to prevent: re-derive the
// fix against whatever ReciterAI's source now says, don't let it drift quietly.
export function hardRangePrompt(basePrompt: string, low: number, high: number): string {
    const proseOld = 'cluster these activities into 8 to 25 coherent thematic subtopics'
    const proseNew = `cluster these activities into ${low} to ${high} coherent thematic subtopics`
    if (!basePrompt.includes(proseOld)) {
        throw new Error(
            `hardRangePrompt: expected prose substring not found verbatim in the source prompt -- ` +
            `it has drifted from ReciterAI's DISCOVERY_SYSTEM_PROMPT, re-derive the fix: ${JSON.stringify(proseOld)}`,
        )
    }
    // .split(old).join(new) rather than .replace(old, new): JS's String.replace(string, string)
    // only replaces the FIRST match, but Python's str.replace(old, new) — what the ported pilot
    // function actually calls — replaces ALL of them. Only one occurrence is expected in practice,
    // but matching Python's own replace-all semantics is the honest port.
    let out = basePrompt.split(proseOld).join(proseNew)

    const ruleOld = '1. Produce between 8 and 25 subtopics. Do not go below 8 or above 25.'
    const ruleNew = `1. Produce between ${low} and ${high} subtopics. Do not go below ${low} or above ${high}.`
    if (!out.includes(ruleOld)) {
        throw new Error(
            `hardRangePrompt: expected RULES item 1 substring not found verbatim in the source prompt -- ` +
            `it has drifted from ReciterAI's DISCOVERY_SYSTEM_PROMPT, re-derive the fix: ${JSON.stringify(ruleOld)}`,
        )
    }
    out = out.split(ruleOld).join(ruleNew)

    return out
}

// ---------------------------------------------------------------------------
// Port of the pilot's filter_valid_assignments (run_classification.py) — itself a port of
// ReciterAI's _filter_valid_assignments: keep only assignments whose subtopic_id is one of the
// THEMES ACTUALLY IN THIS REQUEST (never trust a model-invented id) and whose confidence parses as
// a finite number clearing `floor`; dedup by subtopic_id, keeping the MAX confidence seen for that
// id (a model that names the same subtopic twice in one answer should not silently overwrite a
// higher confidence with a lower one).
export function filterValidAssignments(
    rawAssignments: any,
    validIds: Set<string>,
    floor: number = CONFIDENCE_FLOOR,
): Map<string, number> {
    const kept = new Map<string, number>()
    for (const item of (Array.isArray(rawAssignments) ? rawAssignments : [])) {
        if (!item || typeof item !== 'object') continue
        const sid = item.subtopic_id
        if (typeof sid !== 'string' || !validIds.has(sid)) continue
        const conf = Number(item.confidence)
        if (!Number.isFinite(conf)) continue
        if (conf < floor) continue
        const prior = kept.get(sid)
        if (prior === undefined || conf > prior) kept.set(sid, conf)
    }
    return kept
}

// ---------------------------------------------------------------------------
// Port of the pilot's resolve_primary (run_classification.py, itself a port of ReciterAI's
// _resolve_primary_on_tie with ONE substituted tiebreak — see that function's own comment: the
// pilot uses "higher AGGREGATE confidence across the corpus for that theme" where ReciterAI uses a
// Pass-1 seed-count proxy, per this ticket's own spec). A tie is anything within TIE_EPSILON of the
// top confidence, not just an exact float match — two independently-sampled confidences that both
// mean "very sure" should not resolve on 15th-decimal noise.
export function resolvePrimary(
    confidences: Map<string, number> | Record<string, number>,
    aggregateConfidenceByTheme: Map<string, number> | Record<string, number>,
): string | null {
    const entries: [string, number][] = confidences instanceof Map
        ? Array.from(confidences.entries())
        : Object.entries(confidences)
    if (!entries.length) return null

    const aggOf = (id: string): number => aggregateConfidenceByTheme instanceof Map
        ? (aggregateConfidenceByTheme.get(id) ?? 0)
        : (aggregateConfidenceByTheme[id] ?? 0)

    // Sorted by descending confidence, ascending id — matches the pilot's own
    // `sorted(confidences.items(), key=lambda kv: (-kv[1], kv[0]))`.
    const sorted = [...entries].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    const [topId, topConf] = sorted[0]
    if (sorted.length === 1) return topId

    const [, secondConf] = sorted[1]
    if (Math.abs(topConf - secondConf) > TIE_EPSILON) return topId

    // A genuine tie: every contender within TIE_EPSILON of the top confidence, re-sorted by higher
    // aggregate confidence first, then ascending alphabetical id — the pilot's own two-step
    // tiebreak, unchanged.
    const contenders = sorted.filter(([, conf]) => Math.abs(conf - topConf) <= TIE_EPSILON).map(([id]) => id)
    contenders.sort((a, b) => aggOf(b) - aggOf(a) || (a < b ? -1 : a > b ? 1 : 0))
    return contenders[0]
}

export type RawBatchResult = { raw_assignments: any }

export type ResolvedRow = {
    pmid: string
    title: string
    primaryTheme: string
    secondaryThemes: string[]
    confidences: Record<string, number>
    uncovered: boolean
}

// Port of the pilot's resolve_records (run_classification.py): from raw per-pmid model answers,
// produce the filtered confidence map, the corpus-wide aggregate (for resolvePrimary's tiebreak),
// and the resolved row for every pmid — primary, secondary (everything else, ranked by confidence,
// highest first), and the uncovered flag for a pmid that cleared no theme's floor at all.
//
// `title` IS ADDED here beyond the pilot's own write_csv column set (pmid/primaryTheme/
// secondaryThemes/confidences/uncovered only) — this ticket's CSV contract calls for it explicitly
// so a downloaded/re-uploaded assignments CSV is self-describing without a second join against the
// working set. `titleByPmid` defaults every row to '' when no title is supplied for that pmid.
export function resolveRecords(
    rawResultsByPmid: Record<string, RawBatchResult>,
    themes: Theme[],
    titleByPmid: Record<string, string> = {},
): Record<string, ResolvedRow> {
    const validIds = new Set(themes.map(t => t.id))

    const aggregate: Record<string, number> = {}
    const filteredByPmid = new Map<string, Map<string, number>>()
    for (const [pmid, entry] of Object.entries(rawResultsByPmid || {})) {
        const filtered = filterValidAssignments(entry?.raw_assignments, validIds)
        filteredByPmid.set(pmid, filtered)
        for (const [sid, conf] of filtered) aggregate[sid] = (aggregate[sid] || 0) + conf
    }

    const rows: Record<string, ResolvedRow> = {}
    for (const [pmid, filtered] of filteredByPmid) {
        const title = titleByPmid[pmid] || ''
        if (filtered.size === 0) {
            rows[pmid] = { pmid, title, primaryTheme: '', secondaryThemes: [], confidences: {}, uncovered: true }
            continue
        }
        const primary = resolvePrimary(filtered, aggregate)!
        const secondary = Array.from(filtered.keys())
            .filter(sid => sid !== primary)
            .sort((a, b) => filtered.get(b)! - filtered.get(a)!)
        rows[pmid] = {
            pmid, title, primaryTheme: primary, secondaryThemes: secondary,
            confidences: Object.fromEntries(filtered), uncovered: false,
        }
    }
    return rows
}

// ---------------------------------------------------------------------------
// RFC 4180 CSV — MIRRORS csvCell/toCsv from LiteratureAnalyzer.tsx exactly (same quoting rule: a
// cell is only quoted when it actually contains a comma, a quote, or a newline; an embedded quote
// is doubled; \r\n row endings). Duplicated rather than imported for the same reason
// RELEVANCE_BATCH_SIZE is duplicated in that file instead of imported from here: this module has no
// server-only imports and is meant to be importable from either side, so nothing stops the eventual
// Themes UI from importing THESE functions directly instead of hand-copying them a third time — but
// today, before that UI exists, matching the existing convention byte-for-byte is what keeps a CSV
// downloaded from Score Impact and one downloaded from Themes opening identically in Excel.
function csvCell(v: string | number | boolean): string {
    const str = String(v ?? '')
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function toCsv(headers: string[], rows: (string | number | boolean)[][]): string {
    return [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
}

// A general-purpose RFC 4180 reader — the half csvCell/toCsv's write-only convention never needed
// until this ticket, because nothing before Themes ever had to READ BACK a CSV it wrote (Synopsize
// and Score Relevance/Impact's exports are one-way artifacts). Handles quoted fields with embedded
// commas, quotes (doubled) and newlines, and both \r\n and bare \n line endings.
export function parseCsvRows(text: string): string[][] {
    const rows: string[][] = []
    let row: string[] = []
    let field = ''
    let inQuotes = false
    let i = 0
    const n = text.length
    while (i < n) {
        const c = text[i]
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i += 2; continue }
                inQuotes = false; i += 1; continue
            }
            field += c; i += 1; continue
        }
        if (c === '"') { inQuotes = true; i += 1; continue }
        if (c === ',') { row.push(field); field = ''; i += 1; continue }
        if (c === '\r' || c === '\n') {
            if (c === '\r' && text[i + 1] === '\n') i += 1
            row.push(field); field = ''
            rows.push(row); row = []
            i += 1
            continue
        }
        field += c; i += 1
    }
    // The final field/row has no trailing newline to close it — flush what is left, unless the
    // file ended exactly on a row boundary (field empty and no cells started).
    if (field.length || row.length) { row.push(field); rows.push(row) }
    return rows
}

const ASSIGNMENTS_CSV_COLUMNS = ['pmid', 'title', 'primaryTheme', 'secondaryThemes', 'confidences', 'uncovered'] as const

// secondaryThemes and confidences are JSON-ENCODED IN THEIR CELLS, per the pilot's own write_csv
// (`json.dumps(row["secondaryThemes"])`, `json.dumps(row["confidences"])`) — a nested array/object
// has no natural flat-CSV representation, and JSON-in-a-quoted-cell is exactly what RFC 4180
// quoting exists to carry (a `"` inside the JSON is doubled by csvCell like any other embedded
// quote).
export function assignmentsToCsv(rows: ResolvedRow[]): string {
    return toCsv(
        [...ASSIGNMENTS_CSV_COLUMNS],
        rows.map(r => [
            r.pmid, r.title, r.primaryTheme,
            JSON.stringify(r.secondaryThemes), JSON.stringify(r.confidences),
            r.uncovered,
        ]),
    )
}

// The round-trip partner of assignmentsToCsv — column lookup BY NAME (not position), so a re-upload
// with columns reordered by a spreadsheet program still parses correctly. Malformed
// secondaryThemes/confidences JSON in a hand-edited cell fails soft (empty array/object) rather
// than throwing and discarding the whole file over one bad cell — the librarian editing this file
// is fixing OTHER rows, and one corrupted cell should not cost them the rest of their edits.
export function assignmentsFromCsv(text: string): ResolvedRow[] {
    const raw = parseCsvRows(text)
    if (!raw.length) return []
    const header = raw[0]
    const col = (name: string) => header.indexOf(name)
    const pmidI = col('pmid'), titleI = col('title'), primaryI = col('primaryTheme')
    const secI = col('secondaryThemes'), confI = col('confidences'), uncoveredI = col('uncovered')

    const out: ResolvedRow[] = []
    for (const r of raw.slice(1)) {
        if (!r.length || (r.length === 1 && r[0].trim() === '')) continue
        let secondaryThemes: string[] = []
        let confidences: Record<string, number> = {}
        try { secondaryThemes = JSON.parse(r[secI] ?? '[]') } catch { secondaryThemes = [] }
        try { confidences = JSON.parse(r[confI] ?? '{}') } catch { confidences = {} }
        out.push({
            pmid: (r[pmidI] ?? '').trim(),
            title: r[titleI] ?? '',
            primaryTheme: r[primaryI] ?? '',
            secondaryThemes: Array.isArray(secondaryThemes) ? secondaryThemes : [],
            confidences: confidences && typeof confidences === 'object' ? confidences : {},
            uncovered: String(r[uncoveredI]).trim().toLowerCase() === 'true',
        })
    }
    return out
}

// ---------------------------------------------------------------------------
// WORKING-SET CSV UPLOAD — decision 34's validation report. The schema accepted is the Score
// Impact export's own columns (LiteratureAnalyzer.tsx's exportImpact(): 'PMID', 'Title',
// 'Relevance Score', 'Impact Score', 'Impact Source', 'Impact Justification', 'NIH Percentile',
// 'Citation Count', 'RCR') — columns are matched BY NAME, case/punctuation-insensitively, not by
// position, so a spreadsheet program's column reordering or a hand-added 'Synopsis' column (decision
// 34's "fixing the file offline and re-uploading" path) both still parse.
//
// THE REAL FINDING, worth flagging rather than papering over: the Score Impact export AS SHIPPED
// carries no Synopsis column at all (see LiteratureAnalyzer.tsx's exportImpact — it exports PMID,
// Title, Relevance Score, Impact Score, Impact Source, Impact Justification, NIH Percentile,
// Citation Count, RCR; the Score Relevance export carries Explanation, not Synopsis, either). So a
// straight re-upload of a real Score Impact export lands every single row in the "missing synopsis"
// bucket below — that is not a bug in this parser, it is an honest report of what that CSV actually
// contains, and decision 34's own two remedies (route it through Synopsize's pipeline again, or
// hand-add a Synopsis column offline) are exactly the response the report is designed to prompt.
export type WorkingSetRow = {
    pmid: string
    title: string
    synopsis: string
    relevanceScore?: number
    relevanceExplanation?: string
    impactScore?: number
    impactJustification?: string
    // OPTIONAL — Phase 5 backend's own requirement (Summarize Themes' year-count strip needs a
    // publication year per record). Absent when the uploaded CSV carries no 'Year' column at all
    // (every working set before this ticket), in which case the caller treats the record as
    // 'unknown' the same way literatureSearch.analyzerSynthesis.pure.ts's yearCounts() already
    // does for a missing/empty year — this parser does not itself default the string, it simply
    // leaves the field off. Adding this column is NOT one of the four existing validation
    // classes below (loadedAsIs / missingSynopsis / missingImpactScoreOnly / malformedOrDuplicate)
    // and must never become one: a missing Year column is not a data-quality problem the way a
    // missing synopsis or impact score is, it is simply older data that predates this field.
    year?: string
}

export type WorkingSetValidationReport = {
    loadedAsIs: number
    // Missing synopsis (impactScore's presence does not change this bucket — synopsis is the field
    // Discovery/Classification cannot function without at all).
    missingSynopsis: string[]
    // Synopsis present, impactScore absent or unparseable — auto-fillable downstream by the free
    // impactScoreOf() floor (decision 34), which is why this is its own bucket rather than folded
    // into "missing synopsis".
    missingImpactScoreOnly: string[]
    // Bad/duplicate pmid — counted and LISTED, never silently dropped (decision 34 explicitly
    // diverges from parseSeeds' silent token-drop here).
    malformedOrDuplicate: string[]
}

function normalizeHeaderName(h: string): string {
    return h.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

const WORKING_SET_HEADER_ALIASES: Record<string, keyof WorkingSetRow> = {
    pmid: 'pmid',
    title: 'title',
    synopsis: 'synopsis',
    relevancescore: 'relevanceScore',
    relevanceexplanation: 'relevanceExplanation',
    impactscore: 'impactScore',
    impactjustification: 'impactJustification',
    // OPTIONAL — see WorkingSetRow.year's own comment. Absent from every working-set CSV that
    // predates this ticket, and that absence must change nothing about the four validation
    // classes below: a file with no 'Year' column parses exactly as it always has, just without
    // ever setting this field.
    year: 'year',
}

export function parseWorkingSetCsv(text: string): { rows: WorkingSetRow[]; report: WorkingSetValidationReport } {
    const report: WorkingSetValidationReport = {
        loadedAsIs: 0, missingSynopsis: [], missingImpactScoreOnly: [], malformedOrDuplicate: [],
    }
    const raw = parseCsvRows(text)
    if (!raw.length) return { rows: [], report }

    const header = raw[0]
    const colIndex: Partial<Record<keyof WorkingSetRow, number>> = {}
    header.forEach((h, i) => {
        const mapped = WORKING_SET_HEADER_ALIASES[normalizeHeaderName(h)]
        if (mapped && colIndex[mapped] === undefined) colIndex[mapped] = i
    })

    const cell = (r: string[], key: keyof WorkingSetRow): string => {
        const i = colIndex[key]
        return i === undefined ? '' : (r[i] ?? '')
    }

    const seenPmids = new Set<string>()
    const rows: WorkingSetRow[] = []

    for (const r of raw.slice(1)) {
        if (!r.length || (r.length === 1 && r[0].trim() === '')) continue

        const rawPmid = cell(r, 'pmid').trim()
        if (!/^\d+$/.test(rawPmid) || seenPmids.has(rawPmid)) {
            report.malformedOrDuplicate.push(rawPmid || '(blank pmid)')
            continue
        }
        seenPmids.add(rawPmid)

        const synopsis = cell(r, 'synopsis').trim()
        const impactScoreRaw = cell(r, 'impactScore').trim()
        const impactScoreNum = Number(impactScoreRaw)
        const hasImpactScore = impactScoreRaw !== '' && Number.isFinite(impactScoreNum)
        const relevanceScoreRaw = cell(r, 'relevanceScore').trim()
        const relevanceScoreNum = Number(relevanceScoreRaw)

        rows.push({
            pmid: rawPmid,
            title: cell(r, 'title'),
            synopsis,
            ...(relevanceScoreRaw !== '' && Number.isFinite(relevanceScoreNum) ? { relevanceScore: relevanceScoreNum } : {}),
            ...(cell(r, 'relevanceExplanation') ? { relevanceExplanation: cell(r, 'relevanceExplanation') } : {}),
            ...(hasImpactScore ? { impactScore: impactScoreNum } : {}),
            ...(cell(r, 'impactJustification') ? { impactJustification: cell(r, 'impactJustification') } : {}),
            // Optional — present only when the CSV actually carried a 'Year' column with a
            // non-blank value for this row. Never affects loadedAsIs/missingSynopsis/
            // missingImpactScoreOnly/malformedOrDuplicate below, which are computed the same way
            // regardless of whether this field is set.
            ...(cell(r, 'year').trim() ? { year: cell(r, 'year').trim() } : {}),
        })

        if (!synopsis) {
            report.missingSynopsis.push(rawPmid)
        } else if (!hasImpactScore) {
            report.missingImpactScoreOnly.push(rawPmid)
        } else {
            report.loadedAsIs += 1
        }
    }

    return { rows, report }
}
