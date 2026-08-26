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
// Themes (Phase 4) — the PURE half only (see that file's own header for why it is a separate
// module from controllers/literatureSearch.analyzerThemes.ts): resolveRecords/assignmentsToCsv/
// parseWorkingSetCsv are IMPORTED, never reimplemented (this ticket's own MUST NOT) — the whole
// point of that split is that a browser component can pull this file in without dragging
// @aws-sdk/client-bedrock-runtime along through literatureSearch.llm.ts.
import {
    resolveRecords, assignmentsToCsv, parseWorkingSetCsv,
} from '../../../../controllers/literatureSearch.analyzerThemes.pure'
import type {
    Theme, ResolvedRow, WorkingSetRow, WorkingSetValidationReport,
} from '../../../../controllers/literatureSearch.analyzerThemes.pure'
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
function SynopsizeStep({ onDone, onContinue, initialPmids }: {
    onDone: (synopses: Synopsis[]) => void
    onContinue: () => void
    // Themes' CSV validation report "Score these N first" (decision 34) lands here: those pmids,
    // pre-filled into the paste box. Read ONLY at mount — this component unmounts whenever the
    // tab switches away (see LiteratureAnalyzer's own ternary; no `key` forces a remount within
    // the SAME tab), so a fresh mount on switching back into 'synopsize' is exactly when this
    // needs to take effect, and a plain useState initializer is enough — no effect/ref needed.
    initialPmids?: string[]
}) {
    const [pmidsRaw, setPmidsRaw] = useState(initialPmids && initialPmids.length ? initialPmids.join('\n') : '')
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
    // Themes (Phase 4) needs the review topic/criteria too — the mockup's own Themes screens carry
    // no topic field of their own (Discovery/Classification use whatever topic scored relevance),
    // so this step is where that pair has to be lifted from. Added alongside `qualifying` rather
    // than a separate onDone-style callback, since it only ever matters at the same "continue past
    // this step" moment qualifying already fires on.
    onContinue: (qualifying: RelevanceRecord[], topic: string, criteria: string) => void
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
                <button className={ls.btn} onClick={() => onContinue(qualifying, topic.trim(), criteria.trim())} disabled={!qualifying.length}>Continue to Score Impact →</button>
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

// ---------------------------------------------------------------------------
// THEMES (Phase 4). Discovery (one call over the whole working set) + Classification (batched
// CLASSIFY_BATCH_SIZE, concurrency 3) + a client-driven single extension pass on a coverage
// shortfall (decision 38) — see controllers/literatureSearch.analyzerThemes.ts's own header for
// the full backend contract this mirrors, and its point 4 in particular for why the coverage
// check/extension DECISION belongs here, on the client, and not in that route.

// Discovery/Classification's own input shape (PLAN Step A field-list variant A) — carried on
// ImpactRecord already for path (a) (Score Impact's "Continue with these N"), or parsed off an
// uploaded CSV for path (b). Declared locally, same "own request/response types, not imported from
// the server module" discipline every earlier step on this page already follows (RelevanceRecord,
// ImpactRow, etc.) — literatureSearch.analyzerThemes.ts's own DiscoveryActivity/ClassifyActivity
// types are not reused here for exactly the reason its own header gives: that file pulls in
// @aws-sdk/client-bedrock-runtime through literatureSearch.llm.ts, which must never reach the
// browser bundle (a `import type` would erase at compile time and be safe, but keeping this page's
// own local-type convention consistent end to end is simpler than explaining two different rules).
type ThemeActivity = {
    pmid: string; title: string; synopsis: string
    relevanceExplanation: string; impactScore: number; impactJustification: string
}
type ClassifyActivityLite = { pmid: string; title: string; synopsis: string }
// The ALREADY-SERVER-FILTERED shape classify-themes hands back (filterValidAssignments already ran
// inside classifyThemesBatch() by the time this reaches the client — see that function's own
// comment) — a map, not the raw {subtopic_id, confidence}[] array resolveRecords' own
// RawBatchResult type expects. See buildRawResultsEntry() below for the (harmless) reconstruction.
type ThemesBatchAssignment = { pmid: string; confidences: Record<string, number> }

// CLASSIFY_BATCH_SIZE = 10, duplicated from controllers/literatureSearch.analyzerThemes.ts — same
// import-boundary reasoning RELEVANCE_BATCH_SIZE/IMPACT_BATCH_SIZE's own comments give above (that
// module pulls in @aws-sdk/client-bedrock-runtime through literatureSearch.llm.ts). This is a USER
// decision overriding PLAN decision 40's own locked-in batch-20 — see that constant's own comment
// for the two measured points (batch 20 and single-call) 10 sits between, itself unmeasured; if
// this number ever moves, move it there first and duplicate the new value here.
const CLASSIFY_BATCH_SIZE = 10
// Same "kept at 3, first-cut default, no production signal yet" caveat as RELEVANCE_CLIENT_CONCURRENCY
// above — decision 23's route-concurrency question is still open. Explicitly NOT Score Impact's
// sequential 1 (this ticket's own instruction): a batched Sonnet call over up to 10 synopses is
// closer to Score Relevance's shape than Score Impact's, so it gets Score Relevance's concurrency.
const CLASSIFY_CLIENT_CONCURRENCY = 3

// DISCOVERY_MIN/MAX/DEFAULT_TARGET and THEME_COUNT_TOLERANCE, duplicated from
// controllers/literatureSearch.analyzerThemes.ts — same reasoning as CLASSIFY_BATCH_SIZE above.
// THEME_COUNT_TOLERANCE is decision 37's hard-range ± — the input's own caption recomputes
// target±2 live off whatever the person has typed, not a fixed band.
const THEME_COUNT_MIN = 2
const THEME_COUNT_MAX = 50
const THEME_COUNT_DEFAULT = 12
const THEME_COUNT_TOLERANCE = 2
// Decision 33's cold-start floor (ReciterAI's own `min_activities = 30`) — warn-and-allow, not
// refuse; see the below-floor branch in ThemesStep's before-screen.
const THEME_COLD_START_FLOOR = 30
// extend-themes' own default cap when the caller sends none (extendThemes()'s own
// EXTENSION_CAP_DEFAULT) — duplicated here so the client's call always sends an explicit number
// rather than relying on the server's fallback silently, same "be explicit across the wire"
// instinct as every other phase on this page.
const EXTENSION_CAP_DEFAULT = 15
// Decision 38 — 95% coverage target, measured AFTER Classification (never at Discovery time — see
// this file's header and computeCoverage's own comment in the pure module for why Discovery's own
// coveragePct is not used for this check at all).
const COVERAGE_TARGET = 0.95
const MIN_UNCOVERED_FOR_EXTENSION = 3
// A generous sanity ceiling against a client bug or a hostile CSV, duplicated from
// src/pages/api/literature/search.ts's own THEMES_DISCOVERY_SANITY_CAP — checked HERE, before any
// request fires, same "the client enforces the same bound the server does, before spending
// anything" discipline ANALYZER_PMID_CAP's own comment describes for Synopsize.
const THEMES_DISCOVERY_SANITY_CAP = 4000

// MEASURED, per the ticket's own decided figures — Discovery's $0.578 total on a 1,168-record pilot
// run (2026-08-24), scaled linearly per record; Classification's $0.0017/record, MEASURED AT BATCH
// 20 (the pilot's own tested rate) — this build classifies in batches of CLASSIFY_BATCH_SIZE (10),
// a later, unmeasured user decision, so the (i) copy below says plainly that actuals may run
// somewhat higher than this figure rather than repeating the mockup's own "batched-20 locked in"
// line (which is no longer true at batch 10).
const DISCOVERY_MEASURED_TOTAL_USD = 0.578
const DISCOVERY_MEASURED_RECORDS = 1168
const CLASSIFY_MEASURED_USD_PER_RECORD_AT_BATCH20 = 0.0017

// LABELED GUESSES, same "no real timing data exists yet for this route" discipline as every other
// ROUGH_SECONDS_* constant on this page. Discovery is one call regardless of corpus size, so this
// stays flat (the pilot's own measured "~2-3 min" for its 1,168-record run) rather than a per-record
// scale nobody has evidence for.
const ROUGH_SECONDS_DISCOVERY: readonly [number, number] = [120, 180]
const ROUGH_SECONDS_PER_CLASSIFY_BATCH: readonly [number, number] = [15, 30]

const DEFAULT_VISIBLE_THEMES = 5
const DEFAULT_VISIBLE_IN_THEME = 3
// Not a real theme id — the "Move to…" dropdown's own option for "leave/send to Didn't fit a
// theme", and the pmid the request bundles as one used in the discovered themes screens.
const UNCOVERED_SENTINEL = '__uncovered__'

function clamp(n: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, n))
}

// "0:01:40" — minutes:seconds, no hours (matches the mockup's own "Elapsed 0:01:40" — this route
// has never run long enough to need an hours place, and adding one for a case that has not
// happened yet is not worth the extra branch).
function formatElapsed(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const m = Math.floor(totalSeconds / 60)
    const sec = totalSeconds % 60
    return `${m}:${String(sec).padStart(2, '0')}`
}

async function fetchDiscoverThemes(
    topic: string, criteria: string, targetThemeCount: number, activities: ThemeActivity[],
): Promise<{ themes: Theme[]; uncovered: string[]; coveragePct: number }> {
    const res = await fetch('/api/literature/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'literature-analyzer', phase: 'discover-themes',
            question: topic, criteria: criteria || undefined, targetThemeCount, activities,
        }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || 'Theme discovery failed.')
    return {
        themes: Array.isArray(data.themes) ? data.themes : [],
        uncovered: Array.isArray(data.uncovered) ? data.uncovered : [],
        coveragePct: Number(data.coveragePct) || 0,
    }
}

async function fetchClassifyBatch(
    topic: string, criteria: string, themes: Theme[], batch: ClassifyActivityLite[],
): Promise<{ assignments: ThemesBatchAssignment[]; failed: string[] }> {
    const res = await fetch('/api/literature/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'literature-analyzer', phase: 'classify-themes',
            question: topic, criteria: criteria || undefined, themes, batch,
        }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || 'Theme classification failed for this batch.')
    return {
        assignments: Array.isArray(data.assignments) ? data.assignments : [],
        failed: Array.isArray(data.failed) ? data.failed : [],
    }
}

async function fetchExtendThemes(
    topic: string, criteria: string, themes: Theme[], uncoveredActivities: ThemeActivity[],
    extensionCap: number, currentCoveragePct: number,
): Promise<{ newThemes: Theme[]; stillUncovered: string[] }> {
    const res = await fetch('/api/literature/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'literature-analyzer', phase: 'extend-themes',
            question: topic, criteria: criteria || undefined, themes, uncoveredActivities,
            extensionCap, currentCoveragePct,
        }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || 'Theme extension failed.')
    return {
        newThemes: Array.isArray(data.newThemes) ? data.newThemes : [],
        stillUncovered: Array.isArray(data.stillUncovered) ? data.stillUncovered : [],
    }
}

// Reconstructs resolveRecords' own RawBatchResult shape from classify-themes' already-filtered
// `confidences` map — filterValidAssignments runs a second, harmless time inside resolveRecords
// (every entry is already a valid id above the floor, so nothing changes) rather than this
// component re-deriving the primary/secondary/aggregate logic itself, which is exactly the
// reimplementation this ticket's MUST NOT forbids.
function rawAssignmentsEntry(confidences: Record<string, number>): { raw_assignments: any } {
    return { raw_assignments: Object.entries(confidences).map(([subtopic_id, confidence]) => ({ subtopic_id, confidence })) }
}

function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(new Error('Could not read that file.'))
        reader.readAsText(file)
    })
}

// One bucket of decision 34's validation report — same <details>/onRetry-in-<summary> shape as
// LossSection above, generalized to a caller-supplied action label (Score Relevance's own
// LossSection is Retry-only; this report has one action-bearing bucket and two view-only ones) and
// an optional static note (the malformed bucket's "(not loaded — fix and re-upload to include)").
function ValidationBucket({ label, pmids, action, note }: {
    label: string
    pmids: string[]
    action?: { label: string; onClick: () => void }
    note?: string
}) {
    if (!pmids.length) return null
    return (
        <details className={s.lossDetails}>
            <summary className={s.lossSummary}>
                <b>{pmids.length}</b> {label} <span className={ls.help}>— click to view</span>
                {action && (
                    <button
                        type="button"
                        className={`${ls.btnSecondary} ${s.lossRetryBtn}`}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); action.onClick() }}
                    >
                        {action.label}
                    </button>
                )}
                {note && <span className={ls.help}> ({note})</span>}
            </summary>
            <p className={`${ls.help} ${s.lossList}`}>{pmids.join(', ')}</p>
        </details>
    )
}

type PipelineStage = 'before' | 'discover' | 'classify' | 'extend' | 'reclassify' | 'done' | 'error'
type PipelineErr = { stage: 'discover' | 'extend'; message: string }
// Snapshot taken right before an extend-themes call fires — what a "Retry" (after an extend
// failure) or "View results without extension" needs to either re-attempt the same call or accept
// the pre-extension results as final, without re-deriving them.
type PendingExtension = { themes: Theme[]; uncoveredActivities: ThemeActivity[]; coverage: number; failed: string[] }

// `qualifyingImpact` empty is the SAME real, accepted, this-session-only limitation
// ScoreRelevanceStep/ScoreImpactStep's own empty-state comments describe — but Themes' own empty
// state is not a dead end the way theirs are: decision 2026-08-23 gives it a second entry path (a
// CSV upload) precisely so a person resuming a session, or starting from someone else's export, is
// not forced back through Synopsize/Score Relevance/Score Impact just to reach this step. Path (a)
// (`qualifyingImpact` non-empty) skips this screen entirely — see `workingSet` below.
function ThemesStep({ qualifyingImpact, reviewTopic, reviewCriteria, writeUpExists, onScoreThese, onGoToScoreImpact, onSummarize }: {
    qualifyingImpact: ImpactRecord[]
    reviewTopic: string
    reviewCriteria: string
    // Phase 5 ("Summarize Themes") is not built yet — this is always false today. Wired so
    // Rediscover's confirm-if-a-write-up-exists guard (mockup, 2026-08-24) is dormant rather than
    // absent: once Phase 5 lands and starts setting its own write-up state to non-null, this prop
    // starts doing something without Rediscover's own code changing at all.
    writeUpExists: boolean
    onScoreThese: (pmids: string[]) => void
    onGoToScoreImpact: () => void
    onSummarize: (themes: Theme[], assignmentRows: ResolvedRow[]) => void
}) {
    // ---- Path (b): CSV upload. ----
    const [csvFileName, setCsvFileName] = useState('')
    const [csvRows, setCsvRows] = useState<WorkingSetRow[]>([])
    const [csvReport, setCsvReport] = useState<WorkingSetValidationReport | null>(null)
    const [uploadErr, setUploadErr] = useState('')
    const [dragOver, setDragOver] = useState(false)
    const [csvWorkingSet, setCsvWorkingSet] = useState<ThemeActivity[] | null>(null)
    const [csvContinuing, setCsvContinuing] = useState(false)
    const [csvContinueErr, setCsvContinueErr] = useState('')

    // ---- The checkpoint's own input. ----
    const [targetThemeCount, setTargetThemeCount] = useState(THEME_COUNT_DEFAULT)

    // ---- The pipeline. ----
    const [stage, setStage] = useState<PipelineStage>('before')
    const [pipelineErr, setPipelineErr] = useState<PipelineErr | null>(null)
    const [themes, setThemes] = useState<Theme[]>([])
    const [resolvedRows, setResolvedRows] = useState<Record<string, ResolvedRow>>({})
    const [failedClassifyPmids, setFailedClassifyPmids] = useState<string[]>([])
    const [retryingFailed, setRetryingFailed] = useState(false)
    const [finalCoverage, setFinalCoverage] = useState(0)
    const [pipelineElapsedMs, setPipelineElapsedMs] = useState(0)

    // Mutable accumulators a running pipeline needs across several awaited stages — kept in refs,
    // not state, because nothing renders off them directly (resolvedRows/themes/etc. above are what
    // renders; these are working storage for the orchestration functions below).
    const rawByPmidRef = useRef<Record<string, { raw_assignments: any }>>({})
    const workingSetRef = useRef<ThemeActivity[]>([])
    const pipelineStartRef = useRef(0)
    const pendingExtensionRef = useRef<PendingExtension | null>(null)

    const discoverRun = useChunkedProgress<{ themes: Theme[]; uncovered: string[]; coveragePct: number; error?: string }>(1)
    const classifyRun = useChunkedProgress<{ assignments: ThemesBatchAssignment[]; failed: string[]; error?: string }>(CLASSIFY_CLIENT_CONCURRENCY)
    const extendRun = useChunkedProgress<{ newThemes: Theme[]; stillUncovered: string[]; error?: string }>(1)
    const reclassifyRun = useChunkedProgress<{ assignments: ThemesBatchAssignment[]; failed: string[]; error?: string }>(CLASSIFY_CLIENT_CONCURRENCY)

    // ---- Discovered / Theme-opened view state. ----
    const [openedThemeId, setOpenedThemeId] = useState<string | null>(null)
    const [showAllThemes, setShowAllThemes] = useState(false)
    const [searchWithin, setSearchWithin] = useState('')
    const [showAllInTheme, setShowAllInTheme] = useState(false)

    // THE WORKING SET. `csvWorkingSet` (once "Continue with N →" has run) wins if present;
    // otherwise path (a)'s `qualifyingImpact`, mapped straight across (same field names Score
    // Impact already produces) — this is what makes path (a) "skip straight past the empty state":
    // if a person arrived here with a qualifying set already in hand, `workingSet.length` is
    // already non-zero on the very first render.
    const workingSet: ThemeActivity[] = csvWorkingSet ?? (qualifyingImpact.length
        ? qualifyingImpact.map(r => ({
            pmid: r.pmid, title: r.title, synopsis: r.synopsis,
            relevanceExplanation: r.relevanceExplanation,
            impactScore: r.impactScore, impactJustification: r.impactJustification,
        }))
        : [])

    const belowFloor = workingSet.length > 0 && workingSet.length < THEME_COLD_START_FLOOR
    const overSanityCap = workingSet.length > THEMES_DISCOVERY_SANITY_CAP
    const rangeLow = clamp(targetThemeCount - THEME_COUNT_TOLERANCE, THEME_COUNT_MIN, THEME_COUNT_MAX)
    const rangeHigh = clamp(targetThemeCount + THEME_COUNT_TOLERANCE, THEME_COUNT_MIN, THEME_COUNT_MAX)

    const discoveryCost = (DISCOVERY_MEASURED_TOTAL_USD / DISCOVERY_MEASURED_RECORDS) * workingSet.length
    const classifyBatchCount = Math.ceil(workingSet.length / CLASSIFY_BATCH_SIZE)
    const classifyCost = workingSet.length * CLASSIFY_MEASURED_USD_PER_RECORD_AT_BATCH20
    const [loDisc, hiDisc] = ROUGH_SECONDS_DISCOVERY
    const [loClassBatch, hiClassBatch] = ROUGH_SECONDS_PER_CLASSIFY_BATCH
    const loClassify = classifyBatchCount * loClassBatch
    const hiClassify = classifyBatchCount * hiClassBatch

    const estimateText = `Discovery ~$${discoveryCost.toFixed(2)} (measured, 2026-08-24 pilot, `
        + `scaled to this corpus size), ~${loDisc}-${hiDisc}s. Classification ~$${classifyCost.toFixed(2)} `
        + `(${classifyBatchCount} batch${classifyBatchCount === 1 ? '' : 'es'} of up to ${CLASSIFY_BATCH_SIZE}), `
        + `~${loClassify}-${hiClassify}s.`
    const estimateInfo = `Discovery's estimate is measured ($${DISCOVERY_MEASURED_TOTAL_USD}, `
        + `2026-08-24 pilot run, ${DISCOVERY_MEASURED_RECORDS.toLocaleString()} records — scaled `
        + `linearly to your working set here). Classification's $${CLASSIFY_MEASURED_USD_PER_RECORD_AT_BATCH20}`
        + `/record is measured too, but at batch 20 — this build classifies in batches of `
        + `${CLASSIFY_BATCH_SIZE} instead (a later, unmeasured product decision), so actuals may run `
        + `somewhat higher than this figure.`

    // ---- CSV upload. ----
    function handleFiles(files: FileList | null) {
        const file = files && files[0]
        if (!file) return
        setUploadErr('')
        setCsvFileName(file.name)
        readFileAsText(file)
            .then(text => {
                const { rows, report } = parseWorkingSetCsv(text)
                setCsvRows(rows)
                setCsvReport(report)
            })
            .catch((e: any) => setUploadErr(e?.message || 'Could not read that file.'))
    }

    function resetCsv() {
        setCsvFileName('')
        setCsvRows([])
        setCsvReport(null)
        setCsvContinueErr('')
    }

    // decision 34's Continue: everything except the missing-synopsis rows (no auto-fill exists for
    // a missing synopsis) and the already-excluded malformed rows (parseWorkingSetCsv never put
    // those in `rows` to begin with). Rows missing ONLY an impact score get the free floor — one
    // score-impact, paid:false call, reusing fetchImpactBatch (Score Impact's own fetcher, above)
    // rather than a second implementation of that request.
    async function continueWithCsv() {
        if (!csvReport) return
        setCsvContinueErr('')
        setCsvContinuing(true)
        try {
            const missingSynopsisSet = new Set(csvReport.missingSynopsis)
            const usable = csvRows.filter(r => !missingSynopsisSet.has(r.pmid))
            const needsFloor = usable.filter(r => r.impactScore === undefined).map(r => r.pmid)
            let floorByPmid = new Map<string, ImpactRow>()
            if (needsFloor.length) {
                const res = await fetchImpactBatch(needsFloor, false)
                floorByPmid = new Map(res.records.map(row => [row.pmid, row]))
            }
            const activities: ThemeActivity[] = usable.map(r => {
                const floor = floorByPmid.get(r.pmid)
                return {
                    pmid: r.pmid,
                    title: r.title,
                    synopsis: r.synopsis,
                    relevanceExplanation: r.relevanceExplanation || '',
                    impactScore: r.impactScore ?? floor?.impactScore ?? 0,
                    impactJustification: r.impactJustification || floor?.impactJustification || '',
                }
            })
            setCsvWorkingSet(activities)
        } catch (e: any) {
            setCsvContinueErr(e?.message || 'Could not fill in the missing impact scores — try again.')
        } finally {
            setCsvContinuing(false)
        }
    }

    // ---- Coverage + resolution, from whatever is in rawByPmidRef right now. Decision 38: coverage
    // is measured from RESOLVED rows, post-classification — never Discovery's own coveragePct (see
    // this file's header). A pmid still in `failedClassifyPmids` (never resolved at all) counts
    // against coverage the same way an uncovered one does — an honest lower figure until its batch
    // is retried, not a number that quietly excludes what has not been tried yet.
    function recompute(themesNow: Theme[]) {
        const titleByPmid = Object.fromEntries(workingSetRef.current.map(w => [w.pmid, w.title]))
        const resolved = resolveRecords(rawByPmidRef.current, themesNow, titleByPmid)
        const total = workingSetRef.current.length
        const coveredCount = Object.values(resolved).filter(r => !r.uncovered).length
        const coverage = total ? coveredCount / total : 0
        const uncoveredPmids = Object.values(resolved).filter(r => r.uncovered).map(r => r.pmid)
        return { resolved, coverage, uncoveredPmids }
    }

    async function finishPipeline(finalThemes: Theme[], resolved: Record<string, ResolvedRow>, failed: string[], coverage: number) {
        setThemes(finalThemes)
        setResolvedRows(resolved)
        setFailedClassifyPmids(failed)
        setFinalCoverage(coverage)
        setPipelineElapsedMs(Date.now() - pipelineStartRef.current)
        setStage('done')
    }

    // The single extension pass (decision 38) — reclassifies ONLY the previously-uncovered records,
    // against the FULL extended theme list (old + new). Callable both from the main pipeline and
    // from the error screen's "Retry" after an extend-themes failure (pendingExtensionRef carries
    // exactly the inputs needed either way).
    async function runExtensionAndReclassify(themesSoFar: Theme[], uncoveredActivities: ThemeActivity[], coverageSoFar: number, failedSoFar: string[]) {
        pendingExtensionRef.current = { themes: themesSoFar, uncoveredActivities, coverage: coverageSoFar, failed: failedSoFar }
        setStage('extend')
        setPipelineErr(null)
        let extendResult: { newThemes: Theme[]; stillUncovered: string[] }
        try {
            const [r] = await extendRun.run([() => fetchExtendThemes(
                reviewTopic, reviewCriteria, themesSoFar, uncoveredActivities, EXTENSION_CAP_DEFAULT, coverageSoFar,
            ).catch((e: any) => ({ newThemes: [], stillUncovered: uncoveredActivities.map(a => a.pmid), error: e?.message || 'Theme extension failed.' }))])
            if (r.error) throw new Error(r.error)
            extendResult = r
        } catch (e: any) {
            setPipelineErr({ stage: 'extend', message: e?.message || 'Theme extension failed.' })
            setStage('error')
            return
        }

        const mergedThemes = [...themesSoFar, ...extendResult.newThemes]
        setStage('reclassify')
        const reBatches = chunk(uncoveredActivities.map((a): ClassifyActivityLite => ({ pmid: a.pmid, title: a.title, synopsis: a.synopsis })), CLASSIFY_BATCH_SIZE)
        const reResults = await reclassifyRun.run(reBatches.map(batch => () => (
            fetchClassifyBatch(reviewTopic, reviewCriteria, mergedThemes, batch).catch((e: any) => ({
                assignments: [], failed: batch.map(b => b.pmid), error: e?.message || 'Batch failed.',
            }))
        )))
        const failedNow = new Set(failedSoFar)
        for (const r of reResults) {
            for (const a of r.assignments) rawByPmidRef.current[a.pmid] = rawAssignmentsEntry(a.confidences)
            for (const f of r.failed) failedNow.add(f)
        }
        const { resolved, coverage } = recompute(mergedThemes)
        await finishPipeline(mergedThemes, resolved, Array.from(failedNow), coverage)
    }

    // THE MAIN RUN. Discovery (one call) → Classification (every record, batched) → measure
    // coverage → maybe one extension round (decision 38) → done. A Discovery failure is retryable
    // right here (re-runs the whole thing — nothing downstream of it exists yet to preserve).
    async function runPipeline() {
        setPipelineErr(null)
        pipelineStartRef.current = Date.now()
        rawByPmidRef.current = {}
        workingSetRef.current = workingSet
        setFailedClassifyPmids([])
        setOpenedThemeId(null)
        setShowAllThemes(false)

        setStage('discover')
        let discoverResult: { themes: Theme[]; uncovered: string[]; coveragePct: number }
        try {
            const [r] = await discoverRun.run([() => fetchDiscoverThemes(reviewTopic, reviewCriteria, targetThemeCount, workingSet)
                .catch((e: any) => ({ themes: [], uncovered: [], coveragePct: 0, error: e?.message || 'Theme discovery failed.' }))])
            if (r.error) throw new Error(r.error)
            discoverResult = r
        } catch (e: any) {
            setPipelineErr({ stage: 'discover', message: e?.message || 'Theme discovery failed.' })
            setStage('error')
            return
        }

        const themesFromDiscovery = discoverResult.themes
        setStage('classify')
        const batches = chunk(workingSet, CLASSIFY_BATCH_SIZE)
        const classifyResults = await classifyRun.run(batches.map(batch => () => (
            fetchClassifyBatch(reviewTopic, reviewCriteria, themesFromDiscovery, batch.map((w): ClassifyActivityLite => ({ pmid: w.pmid, title: w.title, synopsis: w.synopsis })))
                .catch((e: any) => ({ assignments: [], failed: batch.map(w => w.pmid), error: e?.message || 'Batch failed.' }))
        )))
        const failed = new Set<string>()
        for (const r of classifyResults) {
            for (const a of r.assignments) rawByPmidRef.current[a.pmid] = rawAssignmentsEntry(a.confidences)
            for (const f of r.failed) failed.add(f)
        }

        const { resolved, coverage, uncoveredPmids } = recompute(themesFromDiscovery)

        if (coverage < COVERAGE_TARGET && uncoveredPmids.length >= MIN_UNCOVERED_FOR_EXTENSION) {
            const uncoveredSet = new Set(uncoveredPmids)
            const uncoveredActivities = workingSet.filter(w => uncoveredSet.has(w.pmid))
            await runExtensionAndReclassify(themesFromDiscovery, uncoveredActivities, coverage, Array.from(failed))
            return
        }

        await finishPipeline(themesFromDiscovery, resolved, Array.from(failed), coverage)
    }

    function retryPipelineError() {
        if (!pipelineErr) return
        if (pipelineErr.stage === 'discover') { void runPipeline(); return }
        if (pipelineErr.stage === 'extend' && pendingExtensionRef.current) {
            const { themes: t, uncoveredActivities, coverage, failed } = pendingExtensionRef.current
            void runExtensionAndReclassify(t, uncoveredActivities, coverage, failed)
        }
    }

    // Accepts the pre-extension results as final rather than retrying extend-themes again — the
    // coverage gap is already an accepted outcome per decision 38 ("one round max"), so a person who
    // does not want to wait on a second extend attempt is not stuck.
    function skipExtensionAndFinish() {
        if (!pendingExtensionRef.current) return
        const { themes: t, coverage, failed } = pendingExtensionRef.current
        const { resolved } = recompute(t)
        void finishPipeline(t, resolved, failed, coverage)
    }

    // decision 29's own retry shape, one more time: re-sends ONLY the still-failed subset, against
    // the CURRENT (possibly extended) theme list.
    async function retryFailedClassify() {
        if (!failedClassifyPmids.length) return
        setRetryingFailed(true)
        try {
            const targets = new Set(failedClassifyPmids)
            const activities = workingSetRef.current.filter(w => targets.has(w.pmid))
            const batches = chunk(activities.map((w): ClassifyActivityLite => ({ pmid: w.pmid, title: w.title, synopsis: w.synopsis })), CLASSIFY_BATCH_SIZE)
            const results = await classifyRun.run(batches.map(batch => () => (
                fetchClassifyBatch(reviewTopic, reviewCriteria, themes, batch).catch((e: any) => ({
                    assignments: [], failed: batch.map(b => b.pmid), error: e?.message || 'Batch failed.',
                }))
            )))
            const stillFailed = new Set<string>()
            for (const r of results) {
                for (const a of r.assignments) rawByPmidRef.current[a.pmid] = rawAssignmentsEntry(a.confidences)
                for (const f of r.failed) stillFailed.add(f)
            }
            const { resolved, coverage } = recompute(themes)
            setResolvedRows(resolved)
            setFinalCoverage(coverage)
            setFailedClassifyPmids(Array.from(stillFailed))
        } finally {
            setRetryingFailed(false)
        }
    }

    // Rediscover (mockup, 2026-08-24): confirms first ONLY if a write-up already exists (dormant
    // today — see writeUpExists' own comment above), then re-runs the whole pipeline at whatever
    // target count is currently in the input. window.confirm, not a new dialog component (MUST
    // NOT) — same precedent as Score Impact's own cost-confirm above. window.confirm only ever
    // offers OK/Cancel, not the mockup's own "[Rediscover anyway]"/"[Cancel]" button labels — a
    // native-dialog limitation, not a rewording choice.
    function handleRediscover() {
        if (writeUpExists) {
            const ok = window.confirm(`This replaces your current ${themes.length} themes. Your existing write-up won't match the new ones.`)
            if (!ok) return
        }
        void runPipeline()
    }

    function moveAssignment(pmid: string, targetId: string) {
        setResolvedRows(prev => {
            const row = prev[pmid]
            if (!row) return prev
            const uncovered = targetId === UNCOVERED_SENTINEL
            return { ...prev, [pmid]: { ...row, primaryTheme: uncovered ? '' : targetId, uncovered } }
        })
    }

    function exportAssignments() {
        const csv = assignmentsToCsv(Object.values(resolvedRows))
        saveText(csv, `${stamp('theme-assignments', today())}.csv`)
    }

    const themeCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const t of themes) counts[t.id] = 0
        for (const r of Object.values(resolvedRows)) {
            if (!r.uncovered && counts[r.primaryTheme] !== undefined) counts[r.primaryTheme] += 1
        }
        return counts
    }, [themes, resolvedRows])
    const sortedThemes = useMemo(
        () => [...themes].sort((a, b) => (themeCounts[b.id] || 0) - (themeCounts[a.id] || 0)),
        [themes, themeCounts],
    )
    const uncoveredCount = useMemo(() => Object.values(resolvedRows).filter(r => r.uncovered).length, [resolvedRows])

    // =========================================================================================
    // RENDER. Every hook above this line runs unconditionally, every render (ScoreRelevanceStep/
    // ScoreImpactStep's own convention) — every early return below it.

    // ---- Theme, opened — takes over whichever screen would otherwise show once a theme (or the
    // "Didn't fit" pseudo-theme) is opened. Only reachable from the Discovered view, so `stage` is
    // always 'done' here in practice, but this check runs unconditionally regardless of stage.
    if (openedThemeId !== null) {
        const isUncovered = openedThemeId === UNCOVERED_SENTINEL
        const theme = isUncovered ? null : themes.find(t => t.id === openedThemeId) || null
        const rowsInTheme = Object.values(resolvedRows).filter(r => (isUncovered ? r.uncovered : r.primaryTheme === openedThemeId))
        const needle = searchWithin.trim().toLowerCase()
        const filtered = needle ? rowsInTheme.filter(r => r.title.toLowerCase().includes(needle)) : rowsInTheme
        const visibleRows = showAllInTheme ? filtered : filtered.slice(0, DEFAULT_VISIBLE_IN_THEME)
        const hiddenInTheme = filtered.length - visibleRows.length

        return (
            <div className={ls.card}>
                <button type="button" className={s.backLink} onClick={() => { setOpenedThemeId(null); setSearchWithin(''); setShowAllInTheme(false) }}>
                    ← Back to Themes
                </button>
                <div className={s.themeOpenedHead}>
                    <h2 className={s.themeOpenedTitle}>{isUncovered ? "Didn't fit a theme" : theme?.label}</h2>
                    <span className={ls.help}>{rowsInTheme.length.toLocaleString()} paper{rowsInTheme.length === 1 ? '' : 's'}</span>
                </div>
                {!isUncovered && theme?.description && <p className={ls.help}>{theme.description}</p>}

                <input
                    type="search"
                    className={ls.input}
                    placeholder="Search within this theme…"
                    value={searchWithin}
                    onChange={e => setSearchWithin(e.target.value)}
                    aria-label="Search within this theme"
                />

                <div className={ls.lines}>
                    {visibleRows.map(r => (
                        <div className={ls.line} key={r.pmid}>
                            <div className={ls.field}>
                                <b>{r.title || `PMID ${r.pmid}`}</b> <span className={ls.help}>PMID {r.pmid}</span>
                            </div>
                            <select
                                className={`${ls.input} ${s.moveToSelect}`}
                                value={r.uncovered ? UNCOVERED_SENTINEL : r.primaryTheme}
                                onChange={e => moveAssignment(r.pmid, e.target.value)}
                                aria-label={`Move ${r.title || r.pmid} to…`}
                            >
                                {themes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                <option value={UNCOVERED_SENTINEL}>Didn&apos;t fit a theme</option>
                            </select>
                        </div>
                    ))}
                </div>
                {hiddenInTheme > 0 && (
                    <button type="button" className={ls.btnSecondary} onClick={() => setShowAllInTheme(true)}>
                        … {hiddenInTheme.toLocaleString()} more — Show all
                    </button>
                )}

                <p className={ls.help}>
                    Moving a paper here updates its assignment immediately. If a write-up already
                    exists, any section quoting a paper you just moved out will show as out of date
                    — see Summarize Themes.
                </p>
            </div>
        )
    }

    // ---- No working set yet (decision 2026-08-23's two entry paths; path (a) already skipped this
    // via `workingSet` above). Exposed whenever qualifyingImpact is empty, exactly per this ticket's
    // own instruction, regardless of whether a CSV could still be uploaded from here.
    if (!workingSet.length) {
        if (csvReport) {
            const totalFileRows = csvRows.length + csvReport.malformedOrDuplicate.length
            const continueCount = csvReport.loadedAsIs + csvReport.missingImpactScoreOnly.length
            return (
                <div className={ls.card}>
                    <p className={ls.help}>
                        {csvFileName}: {csvReport.loadedAsIs.toLocaleString()} of {totalFileRows.toLocaleString()} rows loaded as-is.{' '}
                        <span
                            className={s.stepInfo}
                            title="Every row this upload couldn't use as-is is listed here, never silently dropped. Rows missing a synopsis or impact score can be scored right now through this tool's own pipeline, or you can fix the file yourself and upload it again — there's no in-page editor for individual cells. A missing impact score alone is filled automatically from the free citation-based floor, at no cost; a missing synopsis always needs the pipeline or a hand edit."
                            aria-label="validation report info"
                        >(i)</span>
                    </p>

                    <ValidationBucket
                        label="rows missing synopsis or impact score"
                        pmids={csvReport.missingSynopsis}
                        action={csvReport.missingSynopsis.length
                            ? { label: `Score these ${csvReport.missingSynopsis.length} first`, onClick: () => onScoreThese(csvReport.missingSynopsis) }
                            : undefined}
                    />
                    <ValidationBucket
                        label="rows missing impact score only — filled with the free floor, no cost"
                        pmids={csvReport.missingImpactScoreOnly}
                    />
                    <ValidationBucket
                        label="rows malformed (bad or duplicate pmid)"
                        pmids={csvReport.malformedOrDuplicate}
                        note="not loaded — fix and re-upload to include"
                    />

                    {csvContinueErr && <div role="alert" className={ls.error}>{csvContinueErr}</div>}

                    <div className={ls.actions}>
                        <button className={ls.btnSecondary} onClick={resetCsv}>Fix file and re-upload</button>
                        <button className={ls.btn} onClick={() => void continueWithCsv()} disabled={!continueCount || csvContinuing}>
                            {csvContinuing ? 'Loading…' : `Continue with ${continueCount.toLocaleString()} →`}
                        </button>
                    </div>
                </div>
            )
        }
        return (
            <div className={ls.card}>
                <p className={ls.help}>
                    No working set yet. Score a corpus first and click Continue, or upload a ranked
                    CSV exported from Score Impact.
                </p>
                <div
                    className={`${s.dropzone} ${dragOver ? s.dropzoneOver : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
                >
                    <span className={ls.help}>Drop a Score Impact CSV export here, or</span>
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        className={s.fileInput}
                        onChange={e => handleFiles(e.target.files)}
                        aria-label="Choose a Score Impact CSV export"
                    />
                </div>
                {uploadErr && <div role="alert" className={ls.error}>{uploadErr}</div>}
                <p className={ls.help} style={{ textAlign: 'center' }}>— or —</p>
                <div style={{ textAlign: 'center' }}>
                    <button className={ls.btnSecondary} onClick={onGoToScoreImpact}>Go to Score Impact →</button>
                </div>
            </div>
        )
    }

    // ---- Pipeline error (Discovery or Extension) — retryable, not a silent drop.
    if (stage === 'error') {
        return (
            <div className={ls.card}>
                <div role="alert" className={ls.error}>{pipelineErr?.message}</div>
                <div className={ls.actions}>
                    <button className={ls.btnSecondary} onClick={retryPipelineError}>Retry</button>
                    {pipelineErr?.stage === 'extend' && (
                        <button className={ls.btnSecondary} onClick={skipExtensionAndFinish}>View results without extension</button>
                    )}
                </div>
            </div>
        )
    }

    // ---- Discovering — one indeterminate call, no batch count to show (mockup's own screen).
    if (stage === 'discover') {
        return (
            <div className={ls.progress} aria-live="polite">
                <div className={ls.progLine}>
                    <b>Finding themes across {workingSet.length.toLocaleString()} papers… Elapsed {formatElapsed(discoverRun.state.elapsedMs)}.</b>
                </div>
                <p className={ls.help}>Then: classifying each paper into a theme.</p>
            </div>
        )
    }

    // ---- Classifying / Re-classifying — real batch progress (useChunkedProgress already knows
    // exactly how many of the batches have resolved).
    if (stage === 'classify' || stage === 'reclassify') {
        const run = stage === 'classify' ? classifyRun : reclassifyRun
        const done = run.state.done
        const total = run.state.total
        const pct = total > 0 ? Math.round((done / total) * 100) : 0
        return (
            <div className={ls.progress} aria-live="polite">
                <div className={ls.progLine}>
                    <b>{total > 0 ? `${done} of ${total} batches classified…` : 'Starting…'}</b>
                    <span className={ls.spacer} />
                    <span className={ls.progElapsed}>{formatElapsed(run.state.elapsedMs)}</span>
                </div>
                <div className={ls.bar}><span className={ls.barFill} style={{ width: `${pct}%` }} /></div>
                <p className={ls.help}>
                    {stage === 'classify'
                        ? `Classifying each paper into one of ${themes.length} themes, ${CLASSIFY_BATCH_SIZE} at a time.`
                        : 'Re-classifying the previously uncovered papers against the extended theme list.'}
                </p>
            </div>
        )
    }

    // ---- Extending — the coverage-shortfall follow-up pass (decision 38), same indeterminate
    // single-call shape as Discovery.
    if (stage === 'extend') {
        return (
            <div className={ls.progress} aria-live="polite">
                <div className={ls.progLine}>
                    <b>Looking for more themes to cover the uncovered papers… Elapsed {formatElapsed(extendRun.state.elapsedMs)}.</b>
                </div>
                <p className={ls.help}>Then: re-classifying those papers against the extended theme list.</p>
            </div>
        )
    }

    // ---- About to discover (the checkpoint the mockup added specifically so a cost/time estimate
    // has somewhere to be shown before Discovery runs).
    if (stage === 'before') {
        return (
            <div className={ls.card}>
                <p className={ls.help}>Working set loaded: {workingSet.length.toLocaleString()} papers.</p>

                <div className={ls.field}>
                    <label className={ls.eyebrow} htmlFor="theme-count">Target theme count</label>
                    <input
                        id="theme-count"
                        type="number"
                        className={`${ls.input} ${s.themeCountInput}`}
                        min={THEME_COUNT_MIN}
                        max={THEME_COUNT_MAX}
                        value={targetThemeCount}
                        onChange={e => { if (e.target.value !== '') setTargetThemeCount(clamp(Math.round(Number(e.target.value)), THEME_COUNT_MIN, THEME_COUNT_MAX)) }}
                    />
                    <p className={ls.help}>(the prompt enforces {rangeLow}-{rangeHigh})</p>
                </div>

                {belowFloor ? (
                    <div className={s.warnBox}>
                        <p className={ls.help}>
                            (!) Theme discovery is unreliable below about {THEME_COLD_START_FLOOR} papers;
                            the system this design borrows from refuses to run under that floor. You can
                            run anyway — expect few, thin themes (groups of fewer than 3 papers are
                            dropped).{' '}
                            <span
                                className={s.stepInfo}
                                title="ReciterAI's own theme discovery (the system this tool's Discovery step is based on) won't run under 30 papers at all — clustering that thin isn't reliable. This tool has a person reviewing the result instead of running unattended, so it warns and lets you decide rather than blocking outright."
                                aria-label="cold-start floor info"
                            >(i)</span>
                        </p>
                    </div>
                ) : (
                    <p className={ls.help}>
                        Estimated: {estimateText}{' '}
                        <span className={s.stepInfo} title={estimateInfo} aria-label="cost/time estimate info">(i)</span>
                    </p>
                )}

                {overSanityCap && (
                    <div role="alert" className={ls.error}>
                        Too many records for one Discovery call — at most {THEMES_DISCOVERY_SANITY_CAP.toLocaleString()} ({workingSet.length.toLocaleString()} loaded). Narrow the working set and try again.
                    </div>
                )}

                <div>
                    <button className={ls.btn} onClick={() => void runPipeline()} disabled={overSanityCap}>Discover themes →</button>
                </div>
            </div>
        )
    }

    // ---- Discovered (stage === 'done').
    const visibleThemes = showAllThemes ? sortedThemes : sortedThemes.slice(0, DEFAULT_VISIBLE_THEMES)
    const hiddenThemeCount = sortedThemes.length - visibleThemes.length
    const totalCost = discoveryCost + classifyCost

    return (
        <div className={ls.card}>
            <p className={ls.help}>
                We found {themes.length} theme{themes.length === 1 ? '' : 's'} in your{' '}
                {workingSetRef.current.length.toLocaleString()} papers. Open a theme to see everything
                in it, or move a paper out of it from there. Nothing gets written up until you&apos;re
                happy with this.
            </p>
            <p className={ls.help}>
                Estimated: ${totalCost.toFixed(2)} (Discovery + Classification, from measured
                per-record rates — not a true actual, since this route reports token usage server-side
                only) · {formatElapsed(pipelineElapsedMs)} elapsed.
            </p>
            <p className={ls.help}>
                <b>{Math.round(finalCoverage * 100)}%</b> coverage{' '}
                <span
                    className={s.stepInfo}
                    title="The share of your working set that landed in a theme. The rest is the “Didn't fit a theme” group below — not lost, not an error, just not clustered."
                    aria-label="coverage info"
                >(i)</span>
            </p>

            <div className={s.lossRow}>
                <LossSection
                    label="failed classification after retries"
                    pmids={failedClassifyPmids}
                    onRetry={failedClassifyPmids.length && !retryingFailed ? retryFailedClassify : undefined}
                />
            </div>

            <div className={s.themeGrid}>
                {visibleThemes.map(t => (
                    <div className={s.themeCard} key={t.id}>
                        <div className={s.themeCardLabel}>{t.label}</div>
                        <div className={s.themeCardCount}>{(themeCounts[t.id] || 0).toLocaleString()} paper{(themeCounts[t.id] || 0) === 1 ? '' : 's'}</div>
                        <button className={ls.btnSecondary} onClick={() => setOpenedThemeId(t.id)}>Open</button>
                    </div>
                ))}
                {hiddenThemeCount > 0 && !showAllThemes && (
                    <div className={s.themeCard}>
                        <div className={s.themeCardLabel}>… {hiddenThemeCount} more theme{hiddenThemeCount === 1 ? '' : 's'}</div>
                        <button className={ls.btnSecondary} onClick={() => setShowAllThemes(true)}>Show all</button>
                    </div>
                )}
            </div>

            <div className={s.themeGrid}>
                <div className={s.themeCard}>
                    <div className={s.themeCardLabel}>Didn&apos;t fit a theme</div>
                    <div className={s.themeCardCount}>{uncoveredCount.toLocaleString()} paper{uncoveredCount === 1 ? '' : 's'}</div>
                    <button className={ls.btnSecondary} onClick={() => setOpenedThemeId(UNCOVERED_SENTINEL)}>Open</button>
                </div>
                <div className={s.rediscoverBox}>
                    <p className={ls.help}>Want more, smaller themes, or fewer, broader ones?</p>
                    <div className={s.rediscoverRow}>
                        <input
                            type="number"
                            className={`${ls.input} ${s.themeCountInput}`}
                            min={THEME_COUNT_MIN}
                            max={THEME_COUNT_MAX}
                            value={targetThemeCount}
                            onChange={e => { if (e.target.value !== '') setTargetThemeCount(clamp(Math.round(Number(e.target.value)), THEME_COUNT_MIN, THEME_COUNT_MAX)) }}
                            aria-label="Target theme count for rediscovery"
                        />
                        <button className={ls.btnSecondary} onClick={handleRediscover}>Rediscover themes</button>
                    </div>
                </div>
            </div>
            <p className={ls.help}>
                A normal outcome, not an error — these just didn&apos;t cluster clearly. Review and move
                them into a theme by hand if you want; leaving them here is fine too.
            </p>

            <div className={ls.actions}>
                <button className={ls.btnSecondary} onClick={exportAssignments}>Export</button>
                <button className={ls.btn} onClick={() => onSummarize(themes, Object.values(resolvedRows))}>Summarize these themes →</button>
            </div>
        </div>
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
    // Themes' CSV validation report's "Score these N first" (decision 34) lands PMIDs here and
    // switches to 'synopsize' — SynopsizeStep reads this once, at mount, as its own comment above
    // describes.
    const [pendingSynopsizePmids, setPendingSynopsizePmids] = useState<string[]>([])
    // Lifted alongside qualifyingRelevance below — Themes' Discovery/Classification calls need the
    // same review topic/criteria Score Relevance already collected (see ScoreRelevanceStep's own
    // onContinue comment); the mockup's own Themes screens carry no topic field of their own.
    const [reviewTopic, setReviewTopic] = useState('')
    const [reviewCriteria, setReviewCriteria] = useState('')
    const [qualifyingRelevance, setQualifyingRelevance] = useState<RelevanceRecord[]>([])
    const [qualifyingImpact, setQualifyingImpact] = useState<ImpactRecord[]>([])
    // Phase 5 ("Summarize Themes") handoff — stored here so that step, once built, has {themes,
    // assignmentRows} to read without Themes needing to know anything about how Phase 5 renders it.
    // `writeUp` stays null for the entirety of this ticket (Phase 5 does not exist yet); it exists
    // purely as the dormant guard Rediscover's confirm checks — see ThemesStep's own writeUpExists
    // comment.
    const [themesHandoff, setThemesHandoff] = useState<{ themes: Theme[]; assignmentRows: ResolvedRow[] } | null>(null)
    const [writeUp] = useState<unknown | null>(null)
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
                    initialPmids={pendingSynopsizePmids}
                    onDone={setSynopsisResult}
                    onContinue={() => setCurrent('score-relevance')}
                />
            ) : current === 'score-relevance' ? (
                <ScoreRelevanceStep
                    synopses={synopsisResult}
                    onContinue={(qualifying, topic, criteria) => {
                        setQualifyingRelevance(qualifying)
                        setReviewTopic(topic)
                        setReviewCriteria(criteria)
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
            ) : current === 'themes' ? (
                <ThemesStep
                    qualifyingImpact={qualifyingImpact}
                    reviewTopic={reviewTopic}
                    reviewCriteria={reviewCriteria}
                    writeUpExists={writeUp !== null}
                    onScoreThese={pmids => {
                        setPendingSynopsizePmids(pmids)
                        setCurrent('synopsize')
                    }}
                    onGoToScoreImpact={() => setCurrent('score-impact')}
                    onSummarize={(themes, assignmentRows) => {
                        setThemesHandoff({ themes, assignmentRows })
                        setCurrent('summarize-themes')
                    }}
                />
            ) : (
                <PlaceholderStep label={step.label} />
            )}
        </div>
    )
}
