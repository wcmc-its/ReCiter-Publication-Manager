// Literature Analyzer — Phase 1: a REAL Synopsize step.
//
// FIVE INDEPENDENT TOP-LEVEL STEPS (plan decision 17), not one screen with internal stages: a
// person can run Synopsize, leave, and come back for Score Relevance later without losing
// anything. This file owns only the current-step state and the tab row; every step's actual logic
// is its own later phase's job. Genuinely separate from LiteratureSearch.tsx's Modes 1-4 — see this
// feature's own controller-free, page-free footprint — not grown onto that 74KB file.
//
//   LiteratureAnalyzer.constants.ts   the five steps, in tab order
//   LiteratureAnalyzer.types.ts       CheckpointStatus, ChunkedProgressState
//   LiteratureAnalyzer.parts.tsx      StepTabs, CheckpointScreen, useChunkedProgress
//   LiteratureAnalyzer.module.css     the step-tab row + loss-count disclosures — everything else
//                                     reuses LiteratureSearch.module.css's existing classes
//
// SYNOPSIZE IS NOW WIRED FOR REAL: a PMID paste box (SeedsField, reused verbatim per decision 18),
// a cost/time estimate computed from the pilot-measured $/record rate, real chunked HTTP requests
// against POST /api/literature/search {mode:'literature-analyzer', phase:'synopsize'}, and a done
// screen with decision 30's two loss-count disclosures. FOUR OF THE FIVE TABS ARE STILL INERT
// PLACEHOLDERS — Score Relevance, Score Impact, Themes, Summarize Themes are later phases' jobs.
import { useMemo, useState } from 'react'
import { STEPS, WIRED_STEP } from './LiteratureAnalyzer.constants'
import type { StepId } from './LiteratureAnalyzer.constants'
import { CheckpointScreen, StepTabs, useChunkedProgress } from './LiteratureAnalyzer.parts'
import { SeedsField } from './SearchForm'
import { parseSeeds } from '../../../../controllers/literatureSearch.strategy'
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
// ONE EXPANDABLE LOSS SECTION (decision 30). The count is always visible in <summary>, even
// collapsed — see LiteratureAnalyzer.module.css's own comment for why this is a native <details>
// rather than built disclosure state.
function LossSection({ label, pmids }: { label: string; pmids: string[] }) {
    if (!pmids.length) return <p className={ls.help}>{label}: 0.</p>
    return (
        <details className={s.lossDetails}>
            <summary className={s.lossSummary}><b>{pmids.length}</b> {label} <span className={ls.help}>— click to view</span></summary>
            <p className={`${ls.help} ${s.lossList}`}>{pmids.join(', ')}</p>
        </details>
    )
}

function SynopsizeStep() {
    const [pmidsRaw, setPmidsRaw] = useState('')
    const [formErr, setFormErr] = useState('')
    const { state, run, reset } = useChunkedProgress<SynopsizeBatchResponse>(CLIENT_BATCH_CONCURRENCY)

    const { pmids, invalid } = useMemo(() => validatePmidInput(pmidsRaw), [pmidsRaw])
    const batches = useMemo(() => chunk(pmids, ANALYZER_BATCH_SIZE), [pmids])

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
            canRun={pmids.length > 0 && invalid.length === 0}
            progressDone={state.done}
            progressTotal={state.total}
            elapsedSeconds={elapsedSeconds}
            doneSummary={doneSummary}
            beforeExtra={
                <>
                    <SeedsField seeds={pmidsRaw} setSeeds={setPmidsRaw} count={pmids.length} />
                    <p className={ls.help}>
                        PMIDs only — separate with commas, spaces, or new lines, any mix. A pasted DOI
                        or other non-PMID line is rejected, not silently accepted. Papers with no
                        abstract available are left out after fetching.
                    </p>
                    {(formErr || invalid.length > 0) && (
                        <div role="alert" className={ls.error}>
                            {formErr || `Not a PMID — fix or remove: ${invalid.slice(0, 15).join(', ')}${invalid.length > 15 ? ', …' : ''}`}
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
            </div>
        </CheckpointScreen>
    )
}

function PlaceholderStep({ label }: { label: string }) {
    return (
        <div className={ls.card}>
            <p className={s.placeholder}>{label} — built in a later phase.</p>
        </div>
    )
}

export default function LiteratureAnalyzer() {
    const [current, setCurrent] = useState<StepId>(WIRED_STEP)
    const step = STEPS.find(x => x.id === current)!

    return (
        <div className={ls.page}>
            <h1 className={ls.title}>Literature Analyzer</h1>
            <p className={ls.sub}>
                Five independent steps over a retrieved corpus — synopsize, score, theme, and
                summarize. Each step is its own checkpoint: run it, review it, come back later.
            </p>

            <StepTabs current={current} onSelect={setCurrent} />

            {current === WIRED_STEP
                ? <SynopsizeStep />
                : <PlaceholderStep label={step.label} />}
        </div>
    )
}
