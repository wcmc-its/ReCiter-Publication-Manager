// Literature Analyzer — Phase 0: the shared shell.
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
//   LiteratureAnalyzer.module.css     the step-tab row only — everything else reuses
//                                     LiteratureSearch.module.css's existing classes
//
// FOUR OF THE FIVE TABS ARE INERT PLACEHOLDERS in this phase. Synopsize is the one wired to
// CheckpointScreen — with DUMMY data, never a real model call (see runSynopsize below) — as the
// vertical proof that the before/running/done pattern actually works before four more phases build
// their real steps on top of it.
import { useState } from 'react'
import { STEPS, WIRED_STEP } from './LiteratureAnalyzer.constants'
import type { StepId } from './LiteratureAnalyzer.constants'
import { CheckpointScreen, StepTabs, useChunkedProgress } from './LiteratureAnalyzer.parts'
import ls from './LiteratureSearch.module.css'
import s from './LiteratureAnalyzer.module.css'

// ---------------------------------------------------------------------------
// DUMMY DATA ONLY — Phase 0 has no Synopsize endpoint yet (no API route exists for this feature at
// all; see this repo's CI/route inventory). This stands in for what a real batch call will return:
// a short synopsis per record. Seven "records" split into batches of 3, matching the pattern the
// real step will use against RECORD_CAP-sized chunks (see literatureSearch.score.ts's chunk()).
type FakeRecord = { pmid: string; title: string }
const FAKE_RECORDS: FakeRecord[] = [
    { pmid: '31234567', title: 'Effect of early mobilization on ICU length of stay' },
    { pmid: '32234511', title: 'Remote patient monitoring in heart failure: a randomized trial' },
    { pmid: '33234498', title: 'Machine learning triage in the emergency department' },
    { pmid: '34234412', title: 'Telehealth follow-up after ambulatory surgery' },
    { pmid: '35234377', title: 'Nurse-led discharge planning and 30-day readmission' },
    { pmid: '36234355', title: 'Wearable sensors for post-operative recovery tracking' },
    { pmid: '37234301', title: 'Shared decision-making tools in primary care' },
]
const FAKE_BATCH_SIZE = 3

type FakeSynopsis = { pmid: string; title: string; synopsis: string }

// One batch, "synopsized" client-side after a short delay — standing in for what will be one POST
// per batch once a real Synopsize route exists. Never a network call.
function fakeSynopsizeBatch(batch: FakeRecord[]): Promise<FakeSynopsis[]> {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(batch.map(r => ({
                ...r,
                synopsis: `Dummy synopsis of "${r.title}" — stands in for the real model output a later phase will produce.`,
            })))
        }, 900 + Math.random() * 700)
    })
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

function SynopsizeStep() {
    const { state, run, reset } = useChunkedProgress<FakeSynopsis[]>(2)
    const batches = chunk(FAKE_RECORDS, FAKE_BATCH_SIZE)

    const runSynopsize = () => {
        // DUMMY RUN: no API call. Each thunk resolves client-side after a short delay so the
        // RUNNING state's "N of M batches done" count and elapsed timer are actually live and
        // clickable, not just described. A real Synopsize step swaps fakeSynopsizeBatch() for a
        // fetch() to this feature's (not-yet-built) batch endpoint and nothing else here changes.
        void run(batches.map(batch => () => fakeSynopsizeBatch(batch)))
    }

    // state.results is index-aligned with `batches` (results[i] fills in once batch i resolves) —
    // .filter(Boolean) drops the still-pending holes. This runs on every render regardless of
    // `status`, because CheckpointScreen's `children` prop is ordinary JSX and gets evaluated
    // whether or not the RUNNING/DONE branch that uses it is the one currently rendering.
    const flat = state.results.flat().filter((r): r is FakeSynopsis => Boolean(r))
    const elapsedSeconds = Math.round(state.elapsedMs / 1000)

    return (
        <CheckpointScreen
            status={state.status}
            estimate={`${FAKE_RECORDS.length} records · ${batches.length} batches of up to ${FAKE_BATCH_SIZE} · est. ~${batches.length}s · DUMMY DATA (Phase 0 shell — no real Synopsize call exists yet)`}
            actionLabel="Run Synopsize"
            onRun={runSynopsize}
            progressDone={state.done}
            progressTotal={state.total}
            elapsedSeconds={elapsedSeconds}
            doneSummary={`${flat.length} of ${FAKE_RECORDS.length} records synopsized in ${elapsedSeconds}s · $0.00 (dummy — no model call was made)`}
        >
            <div className={ls.lines}>
                {flat.map(r => (
                    <div className={ls.line} key={r.pmid}>
                        <div className={ls.field}>
                            <b>{r.title}</b> <span className={ls.help}>PMID {r.pmid}</span>
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
