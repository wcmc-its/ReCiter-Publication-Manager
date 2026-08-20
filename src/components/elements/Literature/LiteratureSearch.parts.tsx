// THE LEAF PARTS OF THE LITERATURE SEARCH PAGE. Every component here takes narrow, explicit props
// and holds no page state, which is exactly why they are here: they can be read, and reviewed,
// without holding the rest of the screen in your head. They are module-level declarations on
// purpose — a component defined inside another component is a NEW type on every render, so React
// unmounts and remounts it, and LineInput would lose the caret mid-word.
import { useEffect, useRef } from 'react'
import { DIALECTS, RECORD_CAP as CAP } from '../../../../controllers/literatureSearch.strategy'
import { M4_STEPS, STAGES } from './LiteratureSearch.constants'
import type { DbFailure, DbResult, ExpertList, M4Stage, RowState, Stage } from './LiteratureSearch.types'
import s from './LiteratureSearch.module.css'

export function RowCount({ n, counts, stale, state }: {
    n: number | null; counts: Record<number, number>; stale: boolean; state: RowState
}) {
    if (n === null) return <span className={s.rowCount} />
    const c = counts?.[n]
    if (typeof c === 'number') {
        return <span className={`${s.rowCount} ${stale ? s.hitsStale : ''}`}>{c.toLocaleString()}</span>
    }
    if (state === 'failed') {
        return <span className={`${s.rowCount} ${s.rowFailed}`} title="This line could not be counted. PubMed did not answer.">·&thinsp;·&thinsp;·</span>
    }
    if (state === 'pending') {
        return <span className={`${s.rowCount} ${s.rowPending}`} aria-label="counting">&hellip;</span>
    }
    return <span className={`${s.rowCount} ${stale ? s.hitsStale : ''}`}>&mdash;</span>
}

// A term line: editable in place. No click-to-edit mode, no modal, no separate "Edit & re-run"
// button -- the line IS the input, and every keystroke lands in the same debounced re-count the
// checkboxes use. That retires the free-text re-run and its whole failure mode: there is no
// second copy of the query to get out of sync, and a broken line can only break its own block.
// Auto-grows because a real MeSH line runs to 600 characters and must not be a slot.
export function LineInput({ value, on, onChange }: { value: string; on: boolean; onChange: (v: string) => void }) {
    const ref = useRef<HTMLTextAreaElement>(null)
    const grow = () => {
        const el = ref.current
        if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
    }
    useEffect(grow, [value])
    return (
        <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={e => onChange(e.target.value)}
            onInput={grow}
            spellCheck={false}
            className={`${s.lineInput} ${on ? '' : s.lineOff}`}
        />
    )
}

// The synthesis cites inline as [PMID 12345678]. Rendering those as links is the whole point:
// a claim you cannot get back to the abstract for is a claim you cannot check, and unverifiable
// prose is exactly what this feature is supposed to be an antidote to.
export function Prose({ text }: { text: string }) {
    const split = (t: string, re: RegExp) => t.split(re).map(p => p.trim()).filter(Boolean)
    // Blank-line paragraphs if the model gave us any; a single newline is a paragraph too if it
    // did not. Getting this wrong renders 700 words as one unbroken wall, which nobody reads —
    // and prose nobody reads is prose nobody verifies.
    let paras = split(text, /\n{2,}/)
    if (paras.length === 1) paras = split(text, /\n/)
    return (
        <div className={s.prose}>
            {paras.map((p, i) => (
                <p key={i}>
                    {p.split(/\[PMID\s*(\d{5,9})\]/g).map((part, j) =>
                        j % 2 === 1 ? (
                            <a
                                key={j}
                                className={s.pmid}
                                href={`https://pubmed.ncbi.nlm.nih.gov/${part}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                PMID {part}
                            </a>
                        ) : (
                            <span key={j}>{part}</span>
                        ),
                    )}
                </p>
            ))}
        </div>
    )
}

// The wait, with a real number on it. `expect` is the MEASURED median, so the bar is an
// estimate and the seconds counter is the truth — the bar stops at 95% rather than telling
// the comfortable lie that it is finished.
export function ProgressPanel({ stage, elapsed, records, included }: {
    stage: Stage; elapsed: number; records: number; included: number
}) {
    if (stage === 'idle') return null
    const expect = STAGES[stage].expect
    const label =
        stage === 'fetching' ? `Retrieving ${CAP} records…`
            : stage === 'screening' ? `Screening ${records} record${records === 1 ? '' : 's'}…`
                : 'Writing the synthesis…'
    const note =
        stage === 'fetching' ? 'Running the query against PubMed.'
            : stage === 'screening' ? `One model call over all ${records} abstracts, against your criteria. The suggestions will land on the rows below — usually about 30 seconds.`
                : `One model call over the ${included} record${included === 1 ? '' : 's'} you selected. Usually about 45 seconds.`
    const pct = Math.min(95, Math.round((elapsed / expect) * 100))
    return (
        <div className={s.progress} aria-live="polite">
            <div className={s.progLine}>
                <b>{label}</b>
                <span className={s.spacer} />
                <span className={s.progElapsed}>{elapsed}s</span>
            </div>
            <div className={s.bar}>
                <span className={s.barFill} style={{ width: `${pct}%` }} />
            </div>
            <p className={s.help}>{note}</p>
        </div>
    )
}

// MODE 4's PROGRESS SCREEN — a step list (done/running/pending), not a single spinner. Unlike
// ProgressPanel, there is no measured `expect` seconds per step: a decade-scale retrieval's
// wall-clock depends on how many years clear PubMed's per-year cap, which is not a fixed median the
// way a 50-record screen call is (see M4_STEPS' own comment). So each step gets a state, not a bar.
export function M4ProgressPanel({ stage }: { stage: M4Stage }) {
    if (stage === 'idle') return null
    const order = M4_STEPS.map(x => x.stage)
    const at = order.indexOf(stage)
    return (
        <div className={s.progress} aria-live="polite">
            {M4_STEPS.map((step, i) => {
                const state = i < at ? 'done' : i === at ? 'running' : 'pending'
                return (
                    <div className={s.progLine} key={step.stage}>
                        <span className={s.m4StepMark} data-state={state} aria-hidden="true">
                            {state === 'done' ? '✓' : state === 'running' ? '…' : ''}
                        </span>
                        <b className={state === 'pending' ? s.m4StepPending : ''}>{step.label}</b>
                    </div>
                )
            })}
            <p className={s.help}>
                This can take several minutes — it&rsquo;s pulling and classifying a decade of records,
                not a single query.
            </p>
        </div>
    )
}

// AT WEILL CORNELL — works with no records at all, straight off the query's MeSH. Shown on
// the strategy, the candidates and the synthesis: the "who here already knows this" question
// is the one thing this page can answer that PubMed cannot.
export function ExpertsPanel({ experts }: { experts: ExpertList }) {
    return (
        <div className={`${s.card} ${s.experts}`}>
            <div className={s.expertsHead}>
                <span className={s.eyebrow}>At Weill Cornell</span>
                <span className={s.expertsCount}>
                    top {experts.experts.length} of <b>{experts.total.toLocaleString()}</b> faculty
                    publishing on these MeSH terms
                </span>
            </div>
            <div className={s.expertsList}>
                {experts.experts.map(e => (
                    <div className={s.expert} key={e.personIdentifier}>
                        <span className={s.expertName}>{e.firstName} {e.lastName}</span>
                        <span className={`${s.expertDept} ${e.primaryOrganizationalUnit ? '' : s.expertDeptBlank}`}>
                            {e.primaryOrganizationalUnit || 'department not recorded'}
                        </span>
                        <span className={s.expertPubs}>{e.pubs} pubs</span>
                    </div>
                ))}
            </div>
            <div className={s.expertsFoot}>Ranked by accepted publications.</div>
        </div>
    )
}

export function PageHead({ showForm, isSR, isM4, crumb }: { showForm: boolean; isSR: boolean; isM4: boolean; crumb: string }) {
    if (!showForm) {
        return <div className={s.crumb}>Literature Search &nbsp;&rsaquo;&nbsp; <b>{crumb}</b></div>
    }
    return (
        <>
            <h1 className={s.title}>Literature Search</h1>
            <p className={s.sub}>
                {isM4
                    ? 'Pull, classify and cluster a decade of the corpus into a narrative bibliometric review — trends, keyword clusters, and a cited section per cluster.'
                    : isSR
                        ? 'Build a reproducible search strategy for a systematic review — not a finished answer.'
                        : 'Retrieve, screen and synthesize the top 50 records — an orientation, not a systematic review.'}
            </p>
        </>
    )
}

// What the form collapses to once there is a deliverable. It keeps the question on screen, because
// a count with no question beside it is a number nobody can check.
export function SummaryBar({ isSR, isM4, question, result, corpusSize, recounting, inFlight, onNewSearch }: {
    isSR: boolean
    isM4: boolean
    question: string
    result: DbResult | null
    corpusSize?: number
    recounting: boolean
    inFlight: boolean
    onNewSearch: () => void
}) {
    return (
        <div className={s.summary}>
            <span className={s.chip}>{isM4 ? 'Bibliometric review' : isSR ? 'Search strategy' : 'Issue review'}</span>
            <span className={s.summaryQ}>&ldquo;{question}&rdquo;</span>
            {isM4 && typeof corpusSize === 'number' && (
                <span className={s.summaryN}>{corpusSize.toLocaleString()} records</span>
            )}
            {!isSR && !isM4 && result && (
                <span className={`${s.summaryN} ${recounting ? s.hitsStale : ''}`}>
                    {result.hits.toLocaleString()} records
                </span>
            )}
            <button className={s.btnSecondary} onClick={onNewSearch} disabled={inFlight}>New search</button>
        </div>
    )
}

export function FailedDatabases({ failures }: { failures: DbFailure[] }) {
    return (
        <>
            {/* ============ A DATABASE THAT FAILED ============
                One database dying no longer takes the whole run with it — so it has to be SAID, and
                said as a failure. The three things it must never look like, because each of them is a
                number a librarian would act on:

                  a panel with an empty strategy   — reads as "this database has nothing to say"
                  a count of 0                     — reads as "this database found nothing"
                  Embase's "not counted"           — reads as "drafted, run it yourself in Ovid",
                                                     which is a TRUE statement about Embase and a
                                                     false one about a database whose tool was down

                So: no count element at all, no line numbers, no seeds, and the word FAILED. It sits
                outside the `results.length > 0` block on purpose — if every database failed there are
                no panels to hang it under, and that is exactly when it matters most.

                It is also absent from every export: `results` holds the searches that ran, the
                exports iterate `results`, and this database is not in it. A methods appendix that
                lists a database we never searched is a fabrication with a citation on it. */}
            {failures.map(f => (
                <section className={s.panel} key={`failed-${f.db}`} aria-live="polite">
                    <div className={s.panelHead}>
                        <h2 className={s.panelTitle}>{DIALECTS[f.db].name}</h2>
                    </div>
                    <div className={`${s.dbNote} ${s.dbNoteWarn}`}>
                        <b>This database was not searched — the search failed.</b> It has no strategy, no
                        count and no records here, and <b>this is not a result of zero</b>: we do not know what
                        {' '}{DIALECTS[f.db].name} would have returned. Nothing below or above includes it, and it
                        does not appear in any download. Try again, or run the other databases without it.
                        {/* The server's own words, verbatim. "Could not reach the Scopus tool" is the
                            difference between waiting five minutes and telling someone the pod is down. */}
                        {f.error && <p className={s.help}>{f.error}</p>}
                    </div>
                </section>
            ))}
        </>
    )
}
