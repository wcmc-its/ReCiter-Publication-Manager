// Literature Analyzer — Phase 2: a REAL Score Relevance step, on top of Phase 1's Synopsize.
//
// FIVE INDEPENDENT TOP-LEVEL STEPS (plan decision 17), not one screen with internal stages: a
// person can run Synopsize, leave, and come back for Score Relevance later without losing
// anything (within this browser session — see synopsisResult's own comment below for the one
// accepted limitation that carries). This file owns the current-step state, the tab row, AND now
// the one piece of cross-step state a later step needs (Synopsize's finished synopses); every
// step's actual scoring/theming logic still lives in its own component. Genuinely separate from
// LiteratureSearch.tsx's Modes 1-4 — see this feature's own controller-free, page-free footprint —
// not grown onto that 74KB file.
//
//   LiteratureAnalyzer.constants.ts   the five steps, in tab order
//   LiteratureAnalyzer.types.ts       CheckpointStatus, ChunkedProgressState
//   LiteratureAnalyzer.parts.tsx      StepTabs, CheckpointScreen, useChunkedProgress
//   LiteratureAnalyzer.module.css     the step-tab row + loss-count disclosures — everything else
//                                     reuses LiteratureSearch.module.css's existing classes
//
// SYNOPSIZE (Phase 1): a PMID paste box (SeedsField, reused verbatim per decision 18), a cost/time
// estimate computed from the pilot-measured $/record rate, real chunked HTTP requests against
// POST /api/literature/search {mode:'literature-analyzer', phase:'synopsize'}, a done screen with
// decision 30's two loss-count disclosures, and now (Phase 2) its own [Export] CSV button — the
// small gap Phase 1 shipped without, closed here since this file was already being touched.
//
// SCORE RELEVANCE (Phase 2, new): same CheckpointScreen/useChunkedProgress shape as Synopsize, a
// topic + optional criteria form, batched POSTs against phase:'score-relevance' (backend built and
// committed in the previous ticket — see controllers/literatureSearch.analyzerRelevance.ts), a
// failed-records disclosure with decision 29's [Retry these N] button, a relevance-floor slider
// with a live "N of M qualify" count, its own [Export] CSV button, and a "Continue to Score
// Impact →" button that stores the qualifying set and switches tabs. Score Impact, Themes, and
// Summarize Themes remain later phases' jobs.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ANALYZER_PMID_CAP, STEPS, WIRED_STEP } from './LiteratureAnalyzer.constants'
import type { StepId } from './LiteratureAnalyzer.constants'
import { CheckpointScreen, StepTabs, useChunkedProgress } from './LiteratureAnalyzer.parts'
import { SeedsField } from './SearchForm'
import { parseSeeds } from '../../../../controllers/literatureSearch.strategy'
import { saveText, stamp } from './download'
import ls from './LiteratureSearch.module.css'
import s from './LiteratureAnalyzer.module.css'

// ---------------------------------------------------------------------------
// PMID-ONLY VALIDATION (decision 18). Reuses parseSeeds — the EXACT function LiteratureSearch.tsx's
// own SeedsField call site uses to turn this same textarea shape's raw string into identifiers
// (`const seedList = parseSeeds(seeds)`) — rather than writing a second PMID splitter. What differs
// from that call site: parseSeeds SILENTLY DROPS a token that is neither PMID- nor DOI-shaped (a
// deliberate choice there — an unparseable known-item seed just isn't checked). Synopsize's
// contract is PMID-only (decision 14), so a DOI or garbage token here must not be silently
// accepted into a PMID-only pipeline — it is surfaced as a validation error instead. This computes
// that by diffing parseSeeds' own tokenization against what it actually classified as a PMID; it is
// not a second parser, it is one extra pass over parseSeeds' own output.
function validatePmidInput(raw: string): { pmids: string[]; invalid: string[] } {
    const seeds = parseSeeds(raw)
    const pmids = Array.from(new Set(seeds.filter(x => x.kind === 'pmid').map(x => x.id)))
    const pmidSet = new Set(pmids)
    const tokens = String(raw || '').split(/[\s,]+/).map(t => t.trim()).filter(Boolean)
    const invalid = Array.from(new Set(tokens.filter(t => {
        const stripped = t.replace(/^(doi:|https?:\/\/(dx\.)?doi\.org\/)/i, '')
        return !pmidSet.has(stripped)
    })))
    return { pmids, invalid }
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

// ---------------------------------------------------------------------------
// THE MEASURED RATE THIS ESTIMATE IS BUILT FROM. $0.00089/record is the 2026-08-22
// synopsis-relevance pilot's own measured average (624.7 input / 37.5 output tokens/record, Haiku
// 4.5) — see literatureSearch.synopsize.ts's header for the full citation and why it stays real
// only as long as this stays one call per record. Cited in PLAN's Models section.
const MEASURED_COST_PER_RECORD = 0.00089

// FIRST-CUT DEFAULTS, both flagged the same way the server-side concurrency choice is
// (literatureSearch.synopsize.ts's SYNOPSIZE_CONCURRENCY comment) — decision 23's route-concurrency
// question is explicitly still open, and neither number below has production signal behind it yet.
//
// ANALYZER_BATCH_SIZE: PMIDs per POST. 20 keeps a single request's Bedrock fan-out (bounded to 6
// concurrent calls server-side) finishing in roughly the time this screen's own rough guess names,
// without so many batches that the progress bar barely moves between updates on a small input.
const ANALYZER_BATCH_SIZE = 20
// CLIENT_BATCH_CONCURRENCY: how many of those POSTs this browser tab keeps in flight at once. 3
// batches * the server's 6-wide Bedrock pool is 18 concurrent model calls at worst — reasonable for
// a pilot with no other traffic on the account, not a tuned ceiling.
const CLIENT_BATCH_CONCURRENCY = 3
// A LABELED GUESS, NOT A MEASUREMENT. This route has made no real Bedrock calls before this phase,
// so there is no timing data to compute a real estimate from (unlike the dollar figure above, which
// IS real). 10-20s/batch is a rough band for a 20-record batch at Haiku's typical latency and
// max_tokens=150; the UI says so rather than pretending to a precision nobody has measured.
const ROUGH_SECONDS_PER_BATCH: readonly [number, number] = [10, 20]

type Synopsis = { pmid: string; title: string; synopsis: string }
type SynopsizeBatchResponse = {
    synopses: Synopsis[]
    notFetched: string[]
    noAbstract: string[]
    // Set only when the HTTP call itself failed (network error, 502, etc.) — distinct from
    // notFetched/noAbstract, which are well-formed answers describing PubMed's own gaps. Never
    // thrown from the thunk (see fetchSynopsizeBatch's caller): useChunkedProgress's `run` has no
    // built-in error state (see CheckpointStatus's own comment — a failed run just falls back to
    // BEFORE), so a batch that failed outright is folded into a normal, empty-ish result instead.
    error?: string
}

async function fetchSynopsizeBatch(pmids: string[]): Promise<SynopsizeBatchResponse> {
    const res = await fetch('/api/literature/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'literature-analyzer', phase: 'synopsize', pmids }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || 'Synopsize failed for this batch.')
    return {
        synopses: Array.isArray(data.synopses) ? data.synopses : [],
        notFetched: Array.isArray(data.notFetched) ? data.notFetched : [],
        noAbstract: Array.isArray(data.noAbstract) ? data.noAbstract : [],
    }
}

// ---------------------------------------------------------------------------
// CSV, HAND-BUILT (decision 20 — every step exports its own artifact). No CSV builder exists
// elsewhere in this Literature folder to match — LiteratureSearch.downloads.ts's exports are all
// .docx/.xlsx, built with the docx/exceljs dependencies already on the page — and adding a
// dependency for two small CSVs is not worth it (MUST NOT list). Standard RFC 4180 quoting: a cell
// is only wrapped in quotes when it actually contains a comma, a quote, or a newline, and an
// embedded quote is doubled — the minimum that keeps a title with a comma in it from splitting a
// column in Excel. `\r\n` row endings, same convention Excel expects.
function csvCell(v: string | number): string {
    const str = String(v ?? '')
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}
function toCsv(headers: string[], rows: (string | number)[][]): string {
    return [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
}
// No `provenance`/`runDate` reaches this page today (Phase 0/1 built no server round-trip that
// returns one, unlike LiteratureSearch.tsx's DownloadContext) — today's date is the honest
// fallback, same one m4RunFacts() in LiteratureSearch.downloads.ts falls back to when its own
// provenance is absent.
function today(): string {
    return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// SCORE RELEVANCE (Phase 2). Same batch-POST shape Synopsize's own fetchSynopsizeBatch uses, one
// call against phase:'score-relevance' — see controllers/literatureSearch.analyzerRelevance.ts
// (the previous ticket, already committed) for the request/response contract this mirrors exactly:
// { question, criteria, synopses: [{pmid, synopsis}] } in, { scores: [{pmid, relevanceScore,
// relevanceExplanation}], failed: string[] } out.

// Score Relevance batches to the SAME limit the server enforces (RELEVANCE_BATCH_SIZE in
// controllers/literatureSearch.analyzerRelevance.ts) — duplicated here rather than imported,
// because that controller pulls in @aws-sdk/client-bedrock-runtime and server-only config through
// literatureSearch.llm.ts, which must never reach the browser bundle. Same reasoning
// ANALYZER_PMID_CAP's own comment gives for living in constants.ts (no server imports) instead of
// search.ts.
const RELEVANCE_BATCH_SIZE = 20

// $0.00139/record measured rate — see controllers/literatureSearch.analyzerRelevance.ts's own
// citation (PLAN's measured 87.4 in / 109.2 out tokens per record's share of a 20-batch,
// SCORING_MODEL_ID) — same "pilot-measured, honestly labeled" discipline as
// MEASURED_COST_PER_RECORD above, cited the same way.
const MEASURED_COST_PER_RECORD_RELEVANCE = 0.00139

// FIRST-CUT DEFAULTS, flagged the same way CLIENT_BATCH_CONCURRENCY is above — decision 23's
// route-concurrency question is still open, neither number below has production signal behind it.
//
// RELEVANCE_CLIENT_CONCURRENCY: kept at 3, same as Synopsize's — but a Score Relevance batch is a
// single Sonnet 5 call over up to 20 synopses at once (RELEVANCE_BASE_TOKENS=1500 + 200/item, per
// the controller's own comment), not Synopsize's one-record-per-call Haiku shape, so 3 in flight is
// already a heavier concurrent load per worker than Synopsize's 3 — not raised further on a first
// cut with zero timing data.
const RELEVANCE_CLIENT_CONCURRENCY = 3
// A LABELED GUESS, NOT A MEASUREMENT — no real timing data exists yet for this route either (same
// caveat as ROUGH_SECONDS_PER_BATCH above). Wider band than Synopsize's, and shifted higher: a
// 20-item batched Sonnet 5 call is doing far more per request than Synopsize's single-record Haiku
// call.
const ROUGH_SECONDS_PER_RELEVANCE_BATCH: readonly [number, number] = [20, 45]

// The mockup's default — see CheckpointScreen usage below for the live "N of M qualify" recompute.
const DEFAULT_RELEVANCE_FLOOR = 60

type RelevanceScore = { pmid: string; relevanceScore: number; relevanceExplanation: string }
type RelevanceBatchResponse = {
    scores: RelevanceScore[]
    // Both PER-RECORD scoring failures the backend reports explicitly (its own `failed` list — see
    // the controller's header for why that step, unlike Synopsize, never drops a record silently)
    // AND pmids from a batch that failed outright (network/502 — see the `.catch` at the call site)
    // land here, in the SAME list: from this screen's point of view both are "no score yet, worth
    // retrying," and decision 29's retry button acts on exactly that list.
    failed: string[]
    error?: string
}
// What Score Relevance hands the next step (Score Impact) once a person continues past it — the
// synopsis fields carried along so a later phase does not have to re-join against Synopsize's
// output a second time.
type RelevanceRecord = {
    pmid: string; title: string; synopsis: string
    relevanceScore: number; relevanceExplanation: string
}

async function fetchRelevanceBatch(
    topic: string,
    criteria: string,
    batch: Array<{ pmid: string; synopsis: string }>,
): Promise<RelevanceBatchResponse> {
    const res = await fetch('/api/literature/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'literature-analyzer', phase: 'score-relevance',
            question: topic, criteria: criteria || undefined, synopses: batch,
        }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || 'Relevance scoring failed for this batch.')
    return {
        scores: Array.isArray(data.scores) ? data.scores : [],
        failed: Array.isArray(data.failed) ? data.failed : [],
    }
}

// ---------------------------------------------------------------------------
// SCORE IMPACT (Phase 3). SHAPE IS DIFFERENT FROM SYNOPSIZE/SCORE RELEVANCE'S UNIFORM
// before/running/done — see controllers/literatureSearch.analyzerImpact.ts (the previous ticket,
// already committed) for the request/response contract this mirrors: { impactPmids, paid } in,
// { records: [{pmid, impactScore, impactJustification, impactSource, nihPercentile, citationCount,
// rcr}], failed } out.
//
//   FREE FLOOR (paid:false) — costs nothing, so it is not gated behind a run button at all: it
//   fires automatically on arrival (see ScoreImpactStep's mount effect), full qualifying pmid list
//   in one request, no size cap (matches the backend's own uncapped parseImpactPmids for
//   paid:false).
//   PAID UPGRADE (paid:true) — opt-in (None / Top 200 / All), batched client-side, and run
//   SEQUENTIALLY — a genuine, deliberate difference from Score Relevance's concurrent batching, not
//   an oversight to "fix" by copying RELEVANCE_CLIENT_CONCURRENCY's pattern: this scoring call
//   already runs sequentially server-side today (literatureSearch.impact.ts's scoreImpact()), so the
//   client-side shape matches rather than pretending a concurrency this route does not have.
type ImpactRow = {
    pmid: string
    impactScore: number
    impactJustification: string
    impactSource: 'paid' | 'floor'
    nihPercentile?: number
    citationCount?: number
    rcr?: number
}
type ImpactBatchResponse = {
    records: ImpactRow[]
    failed: string[]
    error?: string
}
// What Score Impact hands the next step (Themes) once a person continues past it — every qualifying
// record plus its resolved impact fields, same lift-up pattern RelevanceRecord's own comment
// describes for Score Relevance's output.
type ImpactRecord = RelevanceRecord & ImpactRow

async function fetchImpactBatch(pmids: string[], paid: boolean): Promise<ImpactBatchResponse> {
    const res = await fetch('/api/literature/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'literature-analyzer', phase: 'score-impact', impactPmids: pmids, paid }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || 'Impact scoring failed for this batch.')
    return {
        records: Array.isArray(data.records) ? data.records : [],
        failed: Array.isArray(data.failed) ? data.failed : [],
    }
}

// RECORD_CAP (50), duplicated here rather than imported — same reasoning RELEVANCE_BATCH_SIZE's own
// comment gives above: the real constant lives in literatureSearch.strategy.ts, which pulls in
// server-only imports (through literatureSearch.llm.ts) that must never reach the browser bundle.
// This is also exactly what scoreImpact() batches at internally (literatureSearch.impact.ts), so a
// client batch of this size becomes exactly one Bedrock call server-side, no mismatch either way.
const IMPACT_BATCH_SIZE = 50

// $0.0072/record — PLAN's own measured rate (PLAN-relevance-impact-topical-analysis-2026-08-22.md,
// "Models, cost, and time"; corrected 2026-08-23 from an earlier wrong-model $0.011/record figure),
// cited the same "PLAN's measured $X/record figure" way controllers/literatureSearch.analyzerRelevance.ts
// cites its own rate — same pilot-measured, honestly-labeled discipline as every other estimate on
// this page.
const IMPACT_RATE_PER_RECORD = 0.0072

// A LABELED GUESS on the per-batch seconds, same as every other route's timing figure on this page —
// but unlike those, the SHAPE here (linear in batch count) is not a guess: batches genuinely run one
// at a time (useChunkedProgress(1) below), matching how scoreImpact() already runs server-side.
const ROUGH_SECONDS_PER_IMPACT_BATCH: readonly [number, number] = [40, 80]

// PLAN decision 32 — above this estimated dollar figure for the CHOSEN scope, the run button asks a
// second time, naming the real number, before firing. No hard ceiling above it (PLAN's own
// reasoning: the relevance floor already bounds the qualifying set, and this is a judgment call
// worth surfacing, not walling off).
const IMPACT_COST_CONFIRM_THRESHOLD = 25

type UpgradeScope = 'none' | 'top200' | 'all'

// ---------------------------------------------------------------------------
// ONE EXPANDABLE LOSS SECTION (decision 30). The count is always visible in <summary>, even
// collapsed — see LiteratureAnalyzer.module.css's own comment for why this is a native <details>
// rather than built disclosure state.
//
// `onRetry` (decision 29, Score Relevance only): an optional button next to the count, for a loss
// category that is actually re-askable — Synopsize's two disclosures (not fetched / no abstract)
// are PubMed facts, not worth re-asking; Score Relevance's failed-scoring list is a model call that
// may just succeed on a second try, so it is the one caller that passes this prop.
function LossSection({ label, pmids, onRetry }: { label: string; pmids: string[]; onRetry?: () => void }) {
    if (!pmids.length) return <p className={ls.help}>{label}: 0.</p>
    return (
        <details className={s.lossDetails}>
            <summary className={s.lossSummary}>
                <b>{pmids.length}</b> {label} <span className={ls.help}>— click to view</span>
                {onRetry && (
                    // stopPropagation, not just preventDefault: a click that reaches <summary> at
                    // all toggles the <details> open/closed as its native activation behavior — the
                    // button must never let the click bubble there, or "Retry" also collapses the list.
                    <button
                        type="button"
                        className={`${ls.btnSecondary} ${s.lossRetryBtn}`}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); onRetry() }}
                    >
                        Retry these {pmids.length}
                    </button>
                )}
            </summary>
            <p className={`${ls.help} ${s.lossList}`}>{pmids.join(', ')}</p>
        </details>
    )
}

// `onDone` fires ONCE per completed run, with the flat synopses array — the lift-up that lets
// ScoreRelevanceStep read this step's output (see the effect below and this file's own header).
// `onContinue` is the "Continue to Score Relevance →" button's handler — just a tab switch, owned
// by the parent (LiteratureAnalyzer) the same way StepTabs' onSelect is.
function SynopsizeStep({ onDone, onContinue }: { onDone: (synopses: Synopsis[]) => void; onContinue: () => void }) {
    const [pmidsRaw, setPmidsRaw] = useState('')
    const [formErr, setFormErr] = useState('')
    const { state, run, reset } = useChunkedProgress<SynopsizeBatchResponse>(CLIENT_BATCH_CONCURRENCY)

    const { pmids, invalid } = useMemo(() => validatePmidInput(pmidsRaw), [pmidsRaw])
    const batches = useMemo(() => chunk(pmids, ANALYZER_BATCH_SIZE), [pmids])
    // THE SAME CAP THE SERVER ENFORCES (search.ts's ANALYZER_PMID_CAP, imported from
    // LiteratureAnalyzer.constants.ts so there is only one literal). Checked BEFORE any batching or
    // running starts — without this, a paste far over the cap still gets chunked into
    // ANALYZER_BATCH_SIZE-sized batches and every batch still fires as a real, separately-billed
    // request; the server only ever sees and rejects the FIRST one over the line, after the other
    // ~N/20 have already gone out and been paid for.
    const overCap = pmids.length > ANALYZER_PMID_CAP

    const cost = pmids.length * MEASURED_COST_PER_RECORD
    const [loSecPerBatch, hiSecPerBatch] = ROUGH_SECONDS_PER_BATCH
    const loSeconds = batches.length * loSecPerBatch
    const hiSeconds = batches.length * hiSecPerBatch

    const estimate = pmids.length
        ? `${pmids.length.toLocaleString()} PMID${pmids.length === 1 ? '' : 's'} · `
            + `${batches.length} batch${batches.length === 1 ? '' : 'es'} of up to ${ANALYZER_BATCH_SIZE} · `
            + `est. $${cost.toFixed(2)} (pilot-measured $${MEASURED_COST_PER_RECORD}/record) · `
            + `~${loSeconds}-${hiSeconds}s (ROUGH GUESS — no real timing data exists yet for this route)`
        : 'Paste PMIDs above to see a cost/time estimate.'

    const runSynopsize = () => {
        setFormErr('')
        if (!pmids.length) { setFormErr('Paste at least one PMID.'); return }
        if (invalid.length) {
            setFormErr(`Not a PMID — fix or remove: ${invalid.slice(0, 15).join(', ')}${invalid.length > 15 ? ', …' : ''}`)
            return
        }
        if (overCap) {
            setFormErr(`Too many PMIDs — at most ${ANALYZER_PMID_CAP} per run (${pmids.length.toLocaleString()} pasted).`)
            return
        }
        void run(batches.map(batch => () => fetchSynopsizeBatch(batch).catch((e: any) => ({
            synopses: [], notFetched: [], noAbstract: [],
            error: e?.message || 'Batch failed.',
        }))))
    }

    const flatSynopses = state.results.flatMap(r => r?.synopses || [])
    const allNotFetched = Array.from(new Set(state.results.flatMap(r => r?.notFetched || [])))
    const allNoAbstract = Array.from(new Set(state.results.flatMap(r => r?.noAbstract || [])))
    const batchFailures = state.results.filter(r => r?.error)
    const elapsedSeconds = Math.round(state.elapsedMs / 1000)

    // THE LIFT-UP. Fires once per completed run — guarded on state.status alone (not on
    // flatSynopses, which is a fresh array literal every render and would re-fire this on every
    // render while done, not just the one transition into it) — see this file's header for why
    // ScoreRelevanceStep needs this rather than reading SynopsizeStep's own local state.
    useEffect(() => {
        if (state.status === 'done') onDone(flatSynopses)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.status])

    const exportSynopses = () => {
        const csv = toCsv(['PMID', 'Title', 'Synopsis'], flatSynopses.map(r => [r.pmid, r.title, r.synopsis]))
        saveText(csv, `${stamp('literature-synopses', today())}.csv`)
    }

    const doneSummary = `${pmids.length.toLocaleString()} PMID${pmids.length === 1 ? '' : 's'} pasted — `
        + `${flatSynopses.length.toLocaleString()} synopsized in ${elapsedSeconds}s`
        + (batchFailures.length
            ? ` · ${batchFailures.length} batch${batchFailures.length === 1 ? '' : 'es'} failed outright (network/server error) — Run again to retry`
            : '')

    return (
        <CheckpointScreen
            status={state.status}
            estimate={estimate}
            actionLabel="Synopsize records in this corpus"
            onRun={runSynopsize}
            canRun={pmids.length > 0 && invalid.length === 0 && !overCap}
            progressDone={state.done}
            progressTotal={state.total}
            elapsedSeconds={elapsedSeconds}
            doneSummary={doneSummary}
            beforeExtra={
                <>
                    <SeedsField
                        seeds={pmidsRaw}
                        setSeeds={setPmidsRaw}
                        count={pmids.length}
                        label="PMIDs to synopsize"
                        caption={<>Each one gets fetched from PubMed and sent for a plain-language
                            synopsis. <b>At most {ANALYZER_PMID_CAP} per run</b> — this route spends
                            real money on every PMID.</>}
                    />
                    <p className={ls.help}>
                        PMIDs only — separate with commas, spaces, or new lines, any mix. A pasted DOI
                        or other non-PMID line is rejected, not silently accepted. Papers with no
                        abstract available are left out after fetching.
                    </p>
                    {(formErr || invalid.length > 0 || overCap) && (
                        <div role="alert" className={ls.error}>
                            {formErr
                                || (invalid.length > 0 && `Not a PMID — fix or remove: ${invalid.slice(0, 15).join(', ')}${invalid.length > 15 ? ', …' : ''}`)
                                || `Too many PMIDs — at most ${ANALYZER_PMID_CAP} per run (${pmids.length.toLocaleString()} pasted).`}
                        </div>
                    )}
                </>
            }
        >
            <div className={s.lossRow}>
                <LossSection label="could not be fetched from PubMed" pmids={allNotFetched} />
                <LossSection label="had no abstract (excluded)" pmids={allNoAbstract} />
            </div>
            <div className={ls.lines}>
                {flatSynopses.map(r => (
                    <div className={ls.line} key={r.pmid}>
                        <div className={ls.field}>
                            <b>{r.title || `PMID ${r.pmid}`}</b> <span className={ls.help}>PMID {r.pmid}</span>
                            <p className={ls.help}>{r.synopsis}</p>
                        </div>
                    </div>
                ))}
            </div>
            <div className={ls.actions}>
                <button className={ls.btnSecondary} onClick={reset}>Run again</button>
                <button className={ls.btnSecondary} onClick={exportSynopses} disabled={!flatSynopses.length}>Export</button>
                <button className={ls.btn} onClick={onContinue} disabled={!flatSynopses.length}>Continue to Score Relevance →</button>
            </div>
        </CheckpointScreen>
    )
}

// ---------------------------------------------------------------------------
// SCORE RELEVANCE (Phase 2). Same CheckpointScreen/useChunkedProgress shape as SynopsizeStep, over
// a different input: `synopses` is Synopsize's OWN finished output, lifted through the parent (see
// this file's header) rather than re-fetched or re-derived here.
//
// `synopses` empty is a REAL, CURRENTLY-ACCEPTED product limitation, not a bug: this page persists
// nothing across a reload (out of scope per this ticket), so a person who refreshes or never ran
// Synopsize this session has nothing to score. The early return below says so plainly instead of
// rendering a topic form over zero records.
function ScoreRelevanceStep({ synopses, onContinue }: {
    synopses: Synopsis[]
    onContinue: (qualifying: RelevanceRecord[]) => void
}) {
    const [topic, setTopic] = useState('')
    const [criteria, setCriteria] = useState('')
    const [formErr, setFormErr] = useState('')
    const [floor, setFloor] = useState(DEFAULT_RELEVANCE_FLOOR)
    const [scores, setScores] = useState<Map<string, RelevanceScore>>(new Map())
    const [failed, setFailed] = useState<string[]>([])
    // WHICH PMIDS THE CURRENTLY-RESOLVING (or just-resolved) run actually asked for — the FIRST run
    // asks for every synopsis; a retry (decision 29) asks for only the still-failed subset. The
    // merge effect below reads this to know which pmids to reconcile against `scores`/`failed`,
    // rather than assuming a run is always "everything".
    const runTargets = useRef<string[]>([])
    const { state, run, reset } = useChunkedProgress<RelevanceBatchResponse>(RELEVANCE_CLIENT_CONCURRENCY)

    // EVERY HOOK ABOVE THIS LINE RUNS UNCONDITIONALLY, EVERY RENDER — the empty-synopses early
    // return lives further down, AFTER the last hook, on purpose: this component only ever mounts
    // fresh per tab switch (see LiteratureAnalyzer's ternary below), so `synopses` cannot actually
    // flip from empty to non-empty mid-mount today, but hooks must never be conditional regardless
    // of what happens to be true right now.
    const synopsisByPmid = useMemo(() => new Map(synopses.map(x => [x.pmid, x])), [synopses])
    const batches = useMemo(() => chunk(synopses, RELEVANCE_BATCH_SIZE), [synopses])

    const cost = synopses.length * MEASURED_COST_PER_RECORD_RELEVANCE
    const [loSecPerBatch, hiSecPerBatch] = ROUGH_SECONDS_PER_RELEVANCE_BATCH
    const loSeconds = batches.length * loSecPerBatch
    const hiSeconds = batches.length * hiSecPerBatch

    const estimate = `${synopses.length.toLocaleString()} ${synopses.length === 1 ? 'synopsis' : 'synopses'} carried forward · `
        + `${batches.length} batch${batches.length === 1 ? '' : 'es'} of up to ${RELEVANCE_BATCH_SIZE} · `
        + `est. $${cost.toFixed(2)} (pilot-measured $${MEASURED_COST_PER_RECORD_RELEVANCE}/record) · `
        + `~${loSeconds}-${hiSeconds}s (ROUGH GUESS — no real timing data exists yet for this route)`

    const fire = (items: Array<{ pmid: string; synopsis: string }>) => {
        runTargets.current = items.map(it => it.pmid)
        void run(chunk(items, RELEVANCE_BATCH_SIZE).map(batch => () => (
            fetchRelevanceBatch(topic.trim(), criteria.trim(), batch).catch((e: any) => ({
                scores: [], failed: batch.map(it => it.pmid), error: e?.message || 'Batch failed.',
            }))
        )))
    }

    const runScoring = () => {
        setFormErr('')
        if (!topic.trim()) { setFormErr('A review topic is required.'); return }
        setScores(new Map())
        setFailed([])
        fire(synopses.map(x => ({ pmid: x.pmid, synopsis: x.synopsis })))
    }

    // decision 29 — retries ONLY the still-failed pmids, not the whole corpus, so a mostly-good run
    // never re-spends on records that already scored.
    const retryFailed = () => {
        if (!failed.length) return
        fire(failed.map(pmid => ({ pmid, synopsis: synopsisByPmid.get(pmid)?.synopsis || '' })))
    }

    // THE MERGE. Fires once per completed run (initial or retry) — reconciles `scores`/`failed`
    // against exactly the pmids THIS run targeted (runTargets.current), so a retry's successes
    // move from `failed` into `scores` and a retry's repeat failures stay in `failed`, without
    // touching any pmid this run never asked about.
    useEffect(() => {
        if (state.status !== 'done') return
        const targets = runTargets.current
        const got = new Map<string, RelevanceScore>()
        for (const r of state.results) for (const sc of (r?.scores || [])) got.set(sc.pmid, sc)
        if (got.size) {
            setScores(prev => {
                const next = new Map(prev)
                for (const [pmid, sc] of got) next.set(pmid, sc)
                return next
            })
        }
        setFailed(prev => {
            const untouched = prev.filter(p => !targets.includes(p))
            const stillFailing = targets.filter(p => !got.has(p))
            return Array.from(new Set([...untouched, ...stillFailing]))
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.status])

    const scoredRows = useMemo(() => Array.from(scores.entries())
        .map(([pmid, sc]) => ({
            pmid, ...sc,
            title: synopsisByPmid.get(pmid)?.title || '',
            synopsis: synopsisByPmid.get(pmid)?.synopsis || '',
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore), [scores, synopsisByPmid])

    const qualifying = useMemo(() => scoredRows.filter(r => r.relevanceScore >= floor), [scoredRows, floor])

    const elapsedSeconds = Math.round(state.elapsedMs / 1000)
    const doneSummary = `${synopses.length.toLocaleString()} ${synopses.length === 1 ? 'synopsis' : 'synopses'} carried forward — `
        + `${scores.size.toLocaleString()} scored, ${failed.length.toLocaleString()} failed, in ${elapsedSeconds}s`

    const exportScores = () => {
        const csv = toCsv(
            ['PMID', 'Title', 'Relevance Score', 'Explanation', `Qualifies (floor ${floor})`],
            scoredRows.map(r => [r.pmid, r.title, r.relevanceScore, r.relevanceExplanation, r.relevanceScore >= floor ? 'yes' : 'no']),
        )
        saveText(csv, `${stamp('relevance-scores', today())}.csv`)
    }

    // A REAL, CURRENTLY-ACCEPTED PRODUCT LIMITATION, not a bug: this page persists nothing across a
    // reload (out of scope per this ticket), so a person who refreshes or never ran Synopsize this
    // session has nothing to score. Say so plainly instead of rendering a topic form over zero
    // records.
    if (!synopses.length) {
        return (
            <div className={ls.card}>
                <p className={s.placeholder}>
                    Score Relevance reads the synopses Synopsize just produced, and none are
                    available this session yet. Run Synopsize first, then come back to this tab.
                </p>
            </div>
        )
    }

    return (
        <CheckpointScreen
            status={state.status}
            estimate={estimate}
            actionLabel="Score relevance for this corpus"
            onRun={runScoring}
            canRun={!!topic.trim()}
            progressDone={state.done}
            progressTotal={state.total}
            elapsedSeconds={elapsedSeconds}
            doneSummary={doneSummary}
            beforeExtra={
                <>
                    <div className={ls.field}>
                        <label className={ls.eyebrow} htmlFor="relevance-topic">Review topic</label>
                        <textarea
                            id="relevance-topic"
                            className={ls.input}
                            rows={2}
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            placeholder="e.g. Do probiotics reduce symptoms of depression in adults?"
                        />
                        <p className={ls.help}>
                            Sent to an external AI service alongside each synopsis — do not include
                            patient identifiers.
                        </p>
                    </div>
                    <div className={ls.field}>
                        <label className={ls.eyebrow} htmlFor="relevance-criteria">Inclusion / exclusion criteria — optional</label>
                        <textarea
                            id="relevance-criteria"
                            className={ls.input}
                            rows={2}
                            value={criteria}
                            onChange={e => setCriteria(e.target.value)}
                            placeholder="e.g. RCTs only; adults; exclude preclinical"
                        />
                        <p className={ls.help}>
                            Binding: a record matching an exclusion criterion scores low regardless
                            of how close its field is to the topic.
                        </p>
                    </div>
                    {formErr && <div role="alert" className={ls.error}>{formErr}</div>}
                </>
            }
        >
            <div className={s.lossRow}>
                <LossSection label="failed scoring" pmids={failed} onRetry={failed.length ? retryFailed : undefined} />
            </div>

            <div className={s.floorRow}>
                <label className={ls.eyebrow} htmlFor="relevance-floor">Relevance floor</label>
                <input
                    id="relevance-floor"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={floor}
                    onChange={e => setFloor(Number(e.target.value))}
                    className={s.floorSlider}
                />
                <span className={s.floorValue}>{floor}</span>
                <span className={ls.help}><b>{qualifying.length}</b> of <b>{scoredRows.length}</b> qualify</span>
            </div>

            <div className={ls.lines}>
                {scoredRows.map(r => (
                    <div className={ls.line} key={r.pmid}>
                        <div className={ls.field}>
                            <b>{r.title || `PMID ${r.pmid}`}</b>{' '}
                            <span className={ls.help}>
                                PMID {r.pmid} · score {r.relevanceScore}
                                {r.relevanceScore < floor ? ' (below floor)' : ''}
                            </span>
                            <p className={ls.help}>{r.relevanceExplanation}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className={ls.actions}>
                <button className={ls.btnSecondary} onClick={() => { reset(); setScores(new Map()); setFailed([]) }}>Run again</button>
                <button className={ls.btnSecondary} onClick={exportScores} disabled={!scoredRows.length}>Export</button>
                <button className={ls.btn} onClick={() => onContinue(qualifying)} disabled={!qualifying.length}>Continue to Score Impact →</button>
            </div>
        </CheckpointScreen>
    )
}

// ---------------------------------------------------------------------------
// SCORE IMPACT (Phase 3). NOT the uniform before/running/done shape SynopsizeStep/ScoreRelevanceStep
// share — the free floor pass runs automatically on arrival (see the mount effect below) and is
// never gated behind CheckpointScreen's own run button; only the PAID upgrade goes through that
// button/progress cycle. `qualifying` is Score Relevance's own carried-forward set — already sorted
// relevance-descending (see ScoreRelevanceStep's own scoredRows sort), which is what makes "Top 200
// by relevance" a plain array slice here rather than a second sort.
function ScoreImpactStep({ qualifying, onContinue }: {
    qualifying: RelevanceRecord[]
    onContinue: (records: ImpactRecord[]) => void
}) {
    const qualifyingPmids = useMemo(() => qualifying.map(r => r.pmid), [qualifying])
    const qualifyingKey = qualifyingPmids.join(',')

    // THE FREE FLOOR — CONTEXT: automatic, not gated behind a button. Fires once per arrival, keyed
    // on the qualifying pmid list (a stable signal) rather than a bare mount-effect, plus a fired-ref
    // guard — same "guard on a stable signal, not a fresh array reference" discipline
    // SynopsizeStep's onDone-lift effect uses (guarded on state.status alone, not on the fresh
    // flatSynopses array literal it reads).
    const firedFloorFor = useRef<string | null>(null)
    const [floorStatus, setFloorStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
    const [floorRows, setFloorRows] = useState<Map<string, ImpactRow>>(new Map())
    const [floorErr, setFloorErr] = useState('')

    useEffect(() => {
        if (!qualifyingPmids.length) return
        if (firedFloorFor.current === qualifyingKey) return
        firedFloorFor.current = qualifyingKey
        setFloorStatus('loading')
        setFloorErr('')
        fetchImpactBatch(qualifyingPmids, false)
            .then(res => {
                setFloorRows(new Map(res.records.map(r => [r.pmid, r])))
                setFloorStatus('done')
            })
            .catch((e: any) => {
                setFloorErr(e?.message || 'Could not load the free impact floor.')
                setFloorStatus('error')
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qualifyingKey])

    // THE PAID PASS — SEQUENTIAL. concurrency=1, literal (not a named RELEVANCE_CLIENT_CONCURRENCY-
    // style constant) — CONTEXT: a deliberate difference from Score Relevance, not an oversight.
    const paidRun = useChunkedProgress<ImpactBatchResponse>(1)
    const [upgrade, setUpgrade] = useState<UpgradeScope>('none')
    const [paidRows, setPaidRows] = useState<Map<string, ImpactRow>>(new Map())
    const [failedPaid, setFailedPaid] = useState<string[]>([])
    // Every pmid EVER included in a paid:true request (initial run or retry) — the complement of
    // this set against `qualifying` is the second, non-retryable disclosure: records simply never
    // scoped for the paid upgrade at all (chose "None" or "Top 200"), distinct from a genuine
    // scoring failure. A retry re-sends a pmid already in this set, so it never shrinks.
    const [scopeSent, setScopeSent] = useState<Set<string>>(new Set())
    // "None" needs no batching and no network call at all — the free floor above is already instant
    // either way — so it is tracked separately from paidRun's own status rather than run through
    // useChunkedProgress with zero thunks just to reach a 'done' state.
    const [noneScopeDone, setNoneScopeDone] = useState(false)
    const runTargets = useRef<string[]>([])

    const fire = (pmids: string[]) => {
        runTargets.current = pmids
        setScopeSent(prev => {
            const next = new Set(prev)
            pmids.forEach(p => next.add(p))
            return next
        })
        void paidRun.run(chunk(pmids, IMPACT_BATCH_SIZE).map(batch => () => (
            fetchImpactBatch(batch, true).catch((e: any) => ({
                records: [], failed: batch, error: e?.message || 'Batch failed.',
            }))
        )))
    }

    // THE MERGE — same shape as ScoreRelevanceStep's own merge effect: reconciles paidRows/failedPaid
    // against exactly the pmids THIS run targeted, so a retry's successes leave `failedPaid` without
    // touching any pmid this run never asked about. Each returned row already carries impactSource
    // 'paid'|'floor' from the backend's own resolution rule, so paidRows already resolves a
    // genuinely-failed pmid to its floor score too — `failedPaid` is purely the retry-affordance
    // list, not a second source of truth for the score itself.
    useEffect(() => {
        if (paidRun.state.status !== 'done') return
        const targets = runTargets.current
        const got = new Map<string, ImpactRow>()
        for (const r of paidRun.state.results) for (const row of (r?.records || [])) got.set(row.pmid, row)
        if (got.size) {
            setPaidRows(prev => {
                const next = new Map(prev)
                for (const [pmid, row] of got) next.set(pmid, row)
                return next
            })
        }
        const failedThisRun = new Set<string>()
        for (const r of paidRun.state.results) for (const p of (r?.failed || [])) failedThisRun.add(p)
        setFailedPaid(prev => {
            const untouched = prev.filter(p => !targets.includes(p))
            return Array.from(new Set([...untouched, ...Array.from(failedThisRun)]))
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paidRun.state.status])

    const scopePmids = upgrade === 'none' ? [] : upgrade === 'top200' ? qualifyingPmids.slice(0, 200) : qualifyingPmids
    const cost = scopePmids.length * IMPACT_RATE_PER_RECORD
    const batches = chunk(scopePmids, IMPACT_BATCH_SIZE)
    const [loSecPerBatch, hiSecPerBatch] = ROUGH_SECONDS_PER_IMPACT_BATCH
    const loSeconds = batches.length * loSecPerBatch
    const hiSeconds = batches.length * hiSecPerBatch

    const estimate = upgrade === 'none'
        ? 'No paid upgrade selected — click through to the free floor scores below, no wait either way.'
        : `${scopePmids.length.toLocaleString()} record${scopePmids.length === 1 ? '' : 's'} · `
            + `${batches.length} batch${batches.length === 1 ? '' : 'es'} of up to ${IMPACT_BATCH_SIZE} · `
            + `est. $${cost.toFixed(2)} (PLAN's measured $${IMPACT_RATE_PER_RECORD}/record) · `
            + `~${loSeconds}-${hiSeconds}s, run sequentially one batch at a time (ROUGH GUESS on the `
            + `per-batch seconds — but genuinely sequential, matching how this scoring call already `
            + `runs elsewhere in the app, not a "no data yet" hedge)`
            + (cost > IMPACT_COST_CONFIRM_THRESHOLD ? ` · above $${IMPACT_COST_CONFIRM_THRESHOLD}, running asks you to confirm the dollar figure once more` : '')

    const runImpact = () => {
        if (upgrade === 'none') { setNoneScopeDone(true); return }
        // PLAN decision 32 — a second, explicit confirmation naming the real dollar figure above the
        // threshold. A plain window.confirm is the right amount of engineering for one dollar-figure
        // gate (no modal/dialog component exists elsewhere in this codebase to reuse, and MUST NOT
        // add a new dependency for it).
        if (cost > IMPACT_COST_CONFIRM_THRESHOLD) {
            const ok = window.confirm(`This run is estimated at $${cost.toFixed(2)}. Run it?`)
            if (!ok) return
        }
        fire(scopePmids)
    }

    // decision 29 — retries ONLY the still-failed pmids, not the whole scope.
    const retryFailedPaid = () => {
        if (!failedPaid.length) return
        fire(failedPaid)
    }

    const runAgain = () => {
        paidRun.reset()
        setNoneScopeDone(false)
        setPaidRows(new Map())
        setFailedPaid([])
        setScopeSent(new Set())
    }

    // The status CheckpointScreen renders off — 'none' completes without ever touching paidRun (see
    // runImpact above), so it is tracked separately (noneScopeDone) rather than forced through the
    // hook just to reach a 'done' state.
    const screenStatus = noneScopeDone ? 'done' : paidRun.state.status

    const resolvedRows = useMemo(() => {
        const rows: Array<RelevanceRecord & ImpactRow> = []
        for (const r of qualifying) {
            const impact = paidRows.get(r.pmid) || floorRows.get(r.pmid)
            if (impact) rows.push({ ...r, ...impact })
        }
        return rows.sort((a, b) => b.impactScore - a.impactScore)
    }, [qualifying, floorRows, paidRows])

    const paidCount = resolvedRows.filter(r => r.impactSource === 'paid').length
    const floorOnlyCount = resolvedRows.length - paidCount
    const notScopedForPaid = qualifying.filter(r => !scopeSent.has(r.pmid)).map(r => r.pmid)

    const elapsedSeconds = noneScopeDone ? 0 : Math.round(paidRun.state.elapsedMs / 1000)
    const doneSummary = `${resolvedRows.length.toLocaleString()} of ${qualifying.length.toLocaleString()} qualifying `
        + `record${qualifying.length === 1 ? '' : 's'} carry a resolved impact score — ${paidCount.toLocaleString()} `
        + `paid, ${floorOnlyCount.toLocaleString()} floor-only`
        + (elapsedSeconds ? ` (paid pass ${elapsedSeconds}s)` : '')

    const exportImpact = () => {
        const csv = toCsv(
            ['PMID', 'Title', 'Relevance Score', 'Impact Score', 'Impact Source', 'Impact Justification', 'NIH Percentile', 'Citation Count', 'RCR'],
            resolvedRows.map(r => [
                r.pmid, r.title, r.relevanceScore, r.impactScore, r.impactSource, r.impactJustification,
                r.nihPercentile ?? '', r.citationCount ?? '', r.rcr ?? '',
            ]),
        )
        saveText(csv, `${stamp('impact-scores', today())}.csv`)
    }

    // A REAL, CURRENTLY-ACCEPTED PRODUCT LIMITATION, same as ScoreRelevanceStep's own empty-state
    // comment — this page persists nothing across a reload.
    if (!qualifying.length) {
        return (
            <div className={ls.card}>
                <p className={s.placeholder}>
                    Score Impact reads the qualifying set Score Relevance just produced, and none are
                    available this session yet. Run Score Relevance first, then come back to this tab.
                </p>
            </div>
        )
    }

    if (floorStatus === 'loading' || floorStatus === 'idle') {
        return (
            <div className={ls.card}>
                <p className={ls.help}>
                    Loading the free impact floor for {qualifying.length.toLocaleString()} qualifying
                    record{qualifying.length === 1 ? '' : 's'} — instant, no extra step or cost…
                </p>
            </div>
        )
    }

    if (floorStatus === 'error') {
        return (
            <div className={ls.card}>
                <div role="alert" className={ls.error}>{floorErr}</div>
                <button className={ls.btnSecondary} onClick={() => { firedFloorFor.current = null; setFloorStatus('idle') }}>Retry</button>
            </div>
        )
    }

    return (
        <CheckpointScreen
            status={screenStatus}
            estimate={estimate}
            actionLabel="Score impact"
            onRun={runImpact}
            canRun
            progressDone={paidRun.state.done}
            progressTotal={paidRun.state.total}
            elapsedSeconds={elapsedSeconds}
            doneSummary={doneSummary}
            beforeExtra={
                <>
                    <p className={ls.help}>
                        <b>{floorRows.size.toLocaleString()}</b> of <b>{qualifying.length.toLocaleString()}</b>{' '}
                        qualifying record{qualifying.length === 1 ? '' : 's'} loaded a free impact score
                        automatically — no extra step or cost.
                    </p>
                    <div className={ls.field}>
                        <label className={ls.eyebrow}>
                            Upgrade — pay for a model-judged score too?{' '}
                            <span
                                className={s.stepInfo}
                                title="The free estimate from citation data is always there as a floor, for every qualifying paper. This adds a second, model-judged opinion on top for however many you choose to pay for — the ranked list uses whichever one a paper actually has. Time estimate assumes batches run one at a time, matching how this scoring call already works elsewhere in the app — not a guess, the app's own scoring functions are sequential today."
                                aria-label="upgrade info"
                            >(i)</span>
                        </label>
                        <div role="radiogroup" aria-label="Paid upgrade scope" className={s.upgradeRow}>
                            <label className={s.upgradeChoice}>
                                <input type="radio" name="impact-upgrade" checked={upgrade === 'none'} onChange={() => setUpgrade('none')} />
                                None
                            </label>
                            <label className={s.upgradeChoice}>
                                <input type="radio" name="impact-upgrade" checked={upgrade === 'top200'} onChange={() => setUpgrade('top200')} />
                                Top {Math.min(200, qualifying.length)} by relevance
                            </label>
                            <label className={s.upgradeChoice}>
                                <input type="radio" name="impact-upgrade" checked={upgrade === 'all'} onChange={() => setUpgrade('all')} />
                                All {qualifying.length.toLocaleString()}
                            </label>
                        </div>
                    </div>
                </>
            }
        >
            <div className={s.lossRow}>
                <LossSection
                    label="failed the paid pass — carry the free floor score"
                    pmids={failedPaid}
                    onRetry={failedPaid.length ? retryFailedPaid : undefined}
                />
                {notScopedForPaid.length > 0 && (
                    <p className={ls.help}>
                        <b>{notScopedForPaid.length.toLocaleString()}</b> of {qualifying.length.toLocaleString()} were
                        not scoped for the paid upgrade (you chose {upgrade === 'top200' ? `Top ${Math.min(200, qualifying.length)}` : 'None'}) — they
                        carry the free citation-based floor, not the AI-judged score. Re-run the paid pass above if
                        you want them upgraded.
                    </p>
                )}
            </div>

            <div className={ls.lines}>
                {resolvedRows.map(r => (
                    <div className={ls.line} key={r.pmid}>
                        <div className={ls.field}>
                            <b>{r.title || `PMID ${r.pmid}`}</b>{' '}
                            <span className={ls.help}>
                                PMID {r.pmid} · impact {r.impactScore} ({r.impactSource === 'paid' ? 'paid' : 'floor'})
                            </span>
                            <p className={ls.help}>{r.impactJustification}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className={ls.actions}>
                <button className={ls.btnSecondary} onClick={runAgain}>Run again</button>
                <button className={ls.btnSecondary} onClick={exportImpact} disabled={!resolvedRows.length}>Export</button>
                <button
                    className={ls.btn}
                    onClick={() => onContinue(resolvedRows as ImpactRecord[])}
                    disabled={!resolvedRows.length}
                >
                    Continue with these {resolvedRows.length.toLocaleString()} →
                </button>
            </div>
        </CheckpointScreen>
    )
}

function PlaceholderStep({ label, note }: { label: string; note?: string }) {
    return (
        <div className={ls.card}>
            <p className={s.placeholder}>{label} — built in a later phase.{note ? ` ${note}` : ''}</p>
        </div>
    )
}

export default function LiteratureAnalyzer() {
    const [current, setCurrent] = useState<StepId>(WIRED_STEP)
    // LIFTED STATE (this file's header): the one place Synopsize's finished output and Score
    // Relevance's qualifying set live once their own steps are done, so a later-selected tab can
    // read what an earlier one produced. Neither survives a reload — see ScoreRelevanceStep's own
    // empty-state comment for why that is accepted, not a bug to fix here.
    const [synopsisResult, setSynopsisResult] = useState<Synopsis[]>([])
    const [qualifyingRelevance, setQualifyingRelevance] = useState<RelevanceRecord[]>([])
    const [qualifyingImpact, setQualifyingImpact] = useState<ImpactRecord[]>([])
    const step = STEPS.find(x => x.id === current)!

    return (
        <div className={ls.page}>
            <h1 className={ls.title}>Literature Analyzer</h1>
            <p className={ls.sub}>
                Five independent steps over a retrieved corpus — synopsize, score, theme, and
                summarize. Each step is its own checkpoint: run it, review it, come back later.
            </p>

            <StepTabs current={current} onSelect={setCurrent} />

            {current === 'synopsize' ? (
                <SynopsizeStep
                    onDone={setSynopsisResult}
                    onContinue={() => setCurrent('score-relevance')}
                />
            ) : current === 'score-relevance' ? (
                <ScoreRelevanceStep
                    synopses={synopsisResult}
                    onContinue={qualifying => {
                        setQualifyingRelevance(qualifying)
                        setCurrent('score-impact')
                    }}
                />
            ) : current === 'score-impact' ? (
                <ScoreImpactStep
                    qualifying={qualifyingRelevance}
                    onContinue={records => {
                        setQualifyingImpact(records)
                        setCurrent('themes')
                    }}
                />
            ) : (
                <PlaceholderStep label={step.label} />
            )}
        </div>
    )
}
