// THE LEAF PARTS OF THE LITERATURE ANALYZER PAGE. Same discipline as LiteratureSearch.parts.tsx
// (see that file's header): narrow explicit props, no page state, module-level declarations so
// React never remounts them mid-render. Two things live here — the step-nav tab row, and the
// reusable 3-state checkpoint screen every one of the five phases will plug into — plus the
// chunked-progress hook the checkpoint screen's RUNNING state reads from.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { STEPS } from './LiteratureAnalyzer.constants'
import type { StepId } from './LiteratureAnalyzer.constants'
import type { CheckpointStatus, ChunkedProgressState } from './LiteratureAnalyzer.types'
import ls from './LiteratureSearch.module.css'
import s from './LiteratureAnalyzer.module.css'

// ---------------------------------------------------------------------------
// STEP TABS — the mockup's "(*) Synopsize (i)  ( ) Score Relevance (i) ..." row. REAL radio inputs,
// same pattern as .mode's card group on the search page (see SearchForm.tsx's ModePicker: a
// role="radiogroup" wrapping <label><input type="radio" .../>...</label> per option) — a horizontal
// tab row rather than a card grid, so it gets its own small stylesheet (LiteratureAnalyzer.module.css)
// instead of stretching .mode's card layout sideways.
//
// THE (i) IS A NATIVE title TOOLTIP, not a built popover. TrendPanel, CandidatesView and SearchForm
// (see their own title={...} usages) already use the browser's own tooltip for exactly this —
// "more context on hover, no extra state" — so this reuses that convention rather than inventing a
// second one for one more info affordance.
export function StepTabs({ current, onSelect }: { current: StepId; onSelect: (id: StepId) => void }) {
    return (
        <div className={s.stepTabs} role="radiogroup" aria-label="Analyzer steps">
            {STEPS.map(step => {
                const active = step.id === current
                return (
                    <label
                        key={step.id}
                        htmlFor={`analyzer-step-${step.id}`}
                        className={`${s.stepTab} ${active ? s.stepTabActive : ''}`}
                    >
                        <input
                            id={`analyzer-step-${step.id}`}
                            type="radio"
                            name="analyzer-step"
                            className={s.stepMark}
                            checked={active}
                            onChange={() => onSelect(step.id)}
                        />
                        <span className={s.stepLabel}>{step.label}</span>
                        <span className={s.stepInfo} title={step.info} aria-label={step.info}>(i)</span>
                    </label>
                )
            })}
        </div>
    )
}

// ---------------------------------------------------------------------------
// CHECKPOINT SCREEN — the reusable 3-state pattern every one of the five phases builds its step on.
// Deliberately knows nothing about Synopsize, relevance, impact, themes, or Bedrock: the caller
// supplies the estimate text, the run function, and the DONE-state result markup as children, and
// this component only ever renders one of three states off `status`.
//
// BEFORE   — the estimate line + one primary button.
// RUNNING  — the live "N of M done" count and elapsed timer, off the chunked-progress hook's own
//            state (reuses .progress/.progLine/.progElapsed/.bar/.barFill verbatim from
//            LiteratureSearch.module.css — same wait vocabulary as Modes 1-4's ProgressPanel, and
//            unlike that panel's estimate-based bar, this one is a REAL percentage: chunked
//            progress always knows exactly how many of M batches have resolved, so there is no
//            95%-cap dishonesty to worry about here).
// DONE     — the actual elapsed/cost figures, then whatever result area the caller renders.
export function CheckpointScreen({
    status,
    estimate,
    actionLabel,
    onRun,
    progressDone,
    progressTotal,
    elapsedSeconds,
    doneSummary,
    children,
    beforeExtra,
    canRun = true,
}: {
    status: CheckpointStatus
    estimate: string
    actionLabel: string
    onRun: () => void
    progressDone?: number
    progressTotal?: number
    elapsedSeconds?: number
    doneSummary?: string
    children?: ReactNode
    // BEFORE-state content ABOVE the estimate line — Phase 0 had nothing here because its one wired
    // step took no input at all (dummy records, no form). Synopsize is the first real step with a
    // BEFORE-state input of its own (the PMID paste box), and it will not be the last: Score
    // Relevance's own before-screen needs a topic/criteria pair (see the mockup). A generic slot
    // here means every later phase reuses this component instead of forking it for one input field.
    beforeExtra?: ReactNode
    // Disables the run button without hiding it — e.g. Synopsize disables this while its PMID input
    // is empty or contains a rejected (non-PMID) line, so a person cannot fire a run the server
    // would just 502 on. Defaults true so every step that has no such precondition (i.e. every
    // placeholder today) is unaffected.
    canRun?: boolean
}) {
    if (status === 'before') {
        return (
            <div className={ls.card}>
                {beforeExtra}
                <p className={ls.help}>{estimate}</p>
                <div>
                    <button className={ls.btn} onClick={onRun} disabled={!canRun}>{actionLabel}</button>
                </div>
            </div>
        )
    }

    if (status === 'running') {
        const done = progressDone ?? 0
        const total = progressTotal ?? 0
        const pct = total > 0 ? Math.round((done / total) * 100) : 0
        return (
            <div className={ls.progress} aria-live="polite">
                <div className={ls.progLine}>
                    <b>{total > 0 ? `${done} of ${total} batches done…` : 'Starting…'}</b>
                    <span className={ls.spacer} />
                    <span className={ls.progElapsed}>{elapsedSeconds ?? 0}s</span>
                </div>
                <div className={ls.bar}>
                    <span className={ls.barFill} style={{ width: `${pct}%` }} />
                </div>
                <p className={ls.help}>One request per batch, run from the browser — see the
                    useChunkedProgress comment above for why there is no server-side progress
                    channel behind this bar.</p>
            </div>
        )
    }

    // status === 'done'
    return (
        <div className={ls.card}>
            {doneSummary && <p className={ls.help}>{doneSummary}</p>}
            {children}
        </div>
    )
}

// ---------------------------------------------------------------------------
// ponytail: client-chained-per-batch progress, no SSE/polling -- revisit with real batching/a
// queue if a step ever needs thousands of tiny requests instead of tens.
//
// THE SAME BOUNDED-WORKER SHAPE AS search.ts's mapLimit() (see that function's own comment), just
// living client-side and reporting itself as it goes: a fixed pool of `concurrency` workers pulls
// the next thunk, and "N of M done" is nothing more than how many of THIS browser's own requests
// have resolved so far. No server-side progress-reporting infrastructure exists or is needed — the
// same pattern PLAN decision 31 already proved for Summarize Themes at per-theme granularity, used
// here at per-batch granularity instead.
//
// `run` takes an array of THUNKS, not started promises — a caller handing over already-fired
// promises would have already spent its own concurrency budget before this hook got a say.
export function useChunkedProgress<R>(concurrency = 4) {
    const [state, setState] = useState<ChunkedProgressState<R>>({
        status: 'before', done: 0, total: 0, results: [], elapsedMs: 0,
    })
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // UNMOUNT SAFETY (carried rough edge, closed here). Before this guard, a run started and then
    // abandoned mid-flight (the person switches tabs before it finishes) kept `worker()` awaiting
    // every remaining thunk and calling `setState` on each resolution regardless — harmless in
    // React's own eyes (a no-op setState on an unmounted component is swallowed, not thrown, since
    // React 18), but still real wasted renders-that-never-happen and a footgun for any future
    // effect that assumes `state` only changes while mounted. `mountedRef` is checked before every
    // setState this hook makes past initial mount; the underlying fetches are NOT aborted — they
    // still run to completion in the background exactly as they did before this fix — only the
    // state updates they'd trigger are suppressed once unmounted. The hook's PUBLIC CONTRACT is
    // unchanged: every call site above still awaits `run()`'s own resolved array of results, live
    // or not.
    const mountedRef = useRef(true)
    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        }
    }, [])

    const run = useCallback(async (thunks: Array<() => Promise<R>>): Promise<R[]> => {
        const total = thunks.length
        const results: R[] = new Array(total)
        const t0 = Date.now()
        if (timerRef.current) clearInterval(timerRef.current)
        if (mountedRef.current) setState({ status: 'running', done: 0, total, results: [], elapsedMs: 0 })
        timerRef.current = setInterval(() => {
            if (!mountedRef.current) return
            setState(s => (s.status === 'running' ? { ...s, elapsedMs: Date.now() - t0 } : s))
        }, 250)

        let next = 0
        let done = 0
        async function worker() {
            while (next < total) {
                const mine = next++
                results[mine] = await thunks[mine]()
                done++
                if (mountedRef.current) setState(s => ({ ...s, done, results: [...results] }))
            }
        }
        await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker))

        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (mountedRef.current) setState(s => ({ ...s, status: 'done', elapsedMs: Date.now() - t0 }))
        return results
    }, [concurrency])

    const reset = useCallback(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (mountedRef.current) setState({ status: 'before', done: 0, total: 0, results: [], elapsedMs: 0 })
    }, [])

    return { state, run, reset }
}
