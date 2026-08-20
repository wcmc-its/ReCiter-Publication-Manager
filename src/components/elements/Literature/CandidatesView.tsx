// MODES 2 AND 3, THE CANDIDATE SCREEN: the query that was run, the narrowing gate when the yield
// is too big to slice honestly, and the fifty records with the model's flags on them. Presentation
// only — every checkbox here reports upwards, because the tally and the synthesis follow the
// HUMAN's selection and this file must not be able to hold a second opinion about what is ticked.
//
// CorpusTablePanel, at the bottom, is MODE 4's table — reused FILE, not the same component: this
// mode has no checkbox and no synthesize button (it is a report, not a filter — see
// scoreRelevance()'s own "YOUR SCORE IS A SUGGESTION, not a filter"), and a corpus can run into the
// thousands where Modes 2/3 cap at RECORD_CAP, so it needs pagination CandidatesPanel has never
// needed. What IS shared: the row rhythm (.rec/.recBody/.cite/.tag), same as the plan's own "reads
// like a grouped variant of CandidatesView.tsx's row rendering, not a new visual language."
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { RECORD_CAP as CAP } from '../../../../controllers/literatureSearch.strategy'
import type { PubRecord, Screened, Narrowing } from '../../../../controllers/literatureSearch.controller'
import type { DbResult, M4Record, Stage } from './LiteratureSearch.types'
import s from './LiteratureSearch.module.css'

export function QueryCard({ result, gate, retrieved, sortLabel, recounting, copiedQuery, onCopyQuery, onNewSearch, inFlight }: {
    result: DbResult
    gate: boolean
    retrieved: number
    sortLabel: string
    recounting: boolean
    copiedQuery: boolean
    onCopyQuery: () => void
    onNewSearch: () => void
    inFlight: boolean
}) {
    return (
        <>
            {/* THE QUERY, READ-ONLY. The librarian did not write it, so they must be able to
                see it: a synthesis over records retrieved by a query nobody looked at is
                not evidence, it is a vibe. */}
            <div className={`${s.card} ${s.queryCard}`}>
                <div className={s.query}>
                    <code className={s.queryCode}>{result.query}</code>
                    <div className={s.queryActs}>
                        <button
                            className={`${s.btnSecondary} ${copiedQuery ? s.btnSecondaryDone : ''}`}
                            onClick={onCopyQuery}
                            disabled={!result.query}
                        >
                            {copiedQuery ? '✓ Copied' : 'Copy query'}
                        </button>
                        <button className={s.btnSecondary} onClick={onNewSearch} disabled={inFlight}>
                            Edit &amp; re-run
                        </button>
                    </div>
                </div>
                {/* THE RATIO, ALWAYS. "top 50 retrieved by most relevant" next to a yield
                    of 1,391 is the one line that stops a thin slice from being read as the
                    literature — so it is stated whether the slice is thin or not, and the
                    "all N retrieved" case earns its wording by actually being all of them
                    (records.length, what arrived — not hits, what PubMed claims). */}
                <div className={`${s.counts} ${recounting ? s.hitsStale : ''}`}>
                    PubMed <b>{result.hits.toLocaleString()}</b>
                    {gate ? (
                        <> &nbsp;&middot;&nbsp; nothing retrieved yet</>
                    ) : retrieved >= result.hits ? (
                        <> &nbsp;&middot;&nbsp; all {retrieved} retrieved &nbsp;&middot;&nbsp; run {result.runDate}</>
                    ) : (
                        <> &nbsp;&middot;&nbsp; top {retrieved} retrieved by {sortLabel} &nbsp;&middot;&nbsp; run {result.runDate}</>
                    )}
                </div>
            </div>
        </>
    )
}

// ============ THE NARROWING GATE ============
// A big yield is a FINDING, not an error, and it is not a refusal either. The
// old behaviour was both wrong halves at once: hard-refuse above 2,000 (which
// was only ever the retrieval tool's fetch limit, and that limit is gone), and
// below it, silently take the top 50 of 1,391 without a word.
//
// So: no refusal, and no silence. The count comes back with PRICED narrowings
// — each one COUNTED server-side, never estimated, and any that would not
// actually reduce the yield dropped before it ever reached this list, because
// advice that changes nothing is worse than no advice.
//
// It is an in-page card, not a dialog. Nothing here is a decision we are
// entitled to interrupt someone for.
export function NarrowingGate({ result, over, isPico, narrowings, ticked, baseHits, recounting, inFlight, stage, onToggle, onRetrieve }: {
    result: DbResult
    over: boolean
    isPico: boolean
    narrowings: Narrowing[]
    ticked: Record<string, boolean>
    baseHits: number
    recounting: boolean
    inFlight: boolean
    stage: Stage
    onToggle: (n: Narrowing) => void
    onRetrieve: () => void
}) {
    return (
        <div className={`${s.card} ${s.narrowCard}`}>
            {over ? (
                <div className={s.caveat}>
                    <span aria-hidden="true">&#9888;</span>
                    <span>
                        <b>{result.hits.toLocaleString()} records match.</b> {isPico ? 'Clinical question' : 'Issue review'} reads only the
                        top {CAP}, so that is a thin slice of them. Narrow it &mdash; each option below
                        shows what you would be left with.
                    </span>
                </div>
            ) : result.hits === 0 ? (
                <div className={s.recallLine}>
                    <span className={`${s.dot} ${s.dotWarn}`} />
                    <span>
                        <b>Nothing matches now.</b> You have narrowed the search down to nothing &mdash;
                        untick one of the options below.
                    </span>
                </div>
            ) : (
                <div className={s.recallLine}>
                    <span className={s.dot} />
                    <span>
                        <b>{result.hits.toLocaleString()} records.</b> The top {CAP} of that is a
                        defensible slice. Retrieve them.
                    </span>
                </div>
            )}

            {narrowings.length > 0 ? (
                <>
                    <div className={s.narrowList}>
                        {narrowings.map(n => {
                            const on = !!ticked[n.label]
                            return (
                                <label className={`${s.narrow} ${on ? s.narrowOn : ''}`} key={n.label}>
                                    <input
                                        type="checkbox"
                                        className={s.lineCheck}
                                        checked={on}
                                        disabled={inFlight}
                                        onChange={() => onToggle(n)}
                                    />
                                    <span className={s.narrowLabel}>{n.label}</span>
                                    <span className={s.narrowPrice}>
                                        {baseHits.toLocaleString()}
                                        <span className={s.narrowArrow} aria-hidden="true">&rarr;</span>
                                        <b>{n.hits.toLocaleString()}</b>
                                    </span>
                                    <span className={s.narrowWhy}>{n.why}</span>
                                    {/* The block that gets AND-ed in. The librarian did not write
                                        this query and is about to change it, so they have to be able
                                        to see exactly what changes — and the full Boolean above
                                        re-assembles the moment this is ticked. */}
                                    <code className={s.narrowTerms}>{n.terms}</code>
                                </label>
                            )
                        })}
                    </div>

                    <p className={s.help}>
                        Each option was counted on its own against the {baseHits.toLocaleString()}-record
                        query, so those are its numbers alone. Ticking more than one only narrows
                        further &mdash; a combination lands <b>at or below</b> the smallest of them, and
                        the live count below is re-counted against PubMed every time you tick.{' '}
                        <b>It is never an estimate.</b>
                    </p>
                </>
            ) : (
                <p className={s.help}>
                    <b>Nothing we could price would actually narrow this.</b> Every candidate we counted
                    came back at the same yield, so none of them is advice worth taking. Tighten the
                    question or the limits with <b>Edit &amp; re-run</b> &mdash; or take the top {CAP}
                    {' '}anyway, now that you know what it is a slice of.
                </p>
            )}

            <div className={s.narrowFoot}>
                <span className={`${s.counts} ${recounting ? s.hitsStale : ''}`}>
                    Now <b>{result.hits.toLocaleString()}</b> record{result.hits === 1 ? '' : 's'}
                </span>
                {recounting && <span className={s.recounting}>re-counting…</span>}
                <span className={s.spacer} />
                {/* NEVER DISABLED ON THE COUNT. Below the boundary it is an ordinary
                    "Find records"; above it, it says what it is doing and does it
                    anyway. Trapping the librarian behind a number would be the tool
                    overruling the person qualified to make the call. */}
                <button className={s.btn} onClick={onRetrieve} disabled={inFlight}>
                    {stage === 'fetching'
                        ? 'Retrieving…'
                        : over ? `Retrieve the top ${CAP} anyway` : 'Find records'}
                </button>
            </div>
        </div>
    )
}

function RecordRow({ r, f, on, screened, disabled, onToggle }: {
    r: PubRecord
    f: Screened | undefined
    on: boolean
    screened: boolean
    disabled: boolean
    onToggle: () => void
}) {
    const design = r.design || 'Other'
    const strong = design === 'RCT' || design === 'Meta-analysis'
    return (
        // De-emphasis follows the HUMAN's checkbox, not the model's flag —
        // so re-ticking something the AI excluded restores it fully. The
        // AI's reason stays on the row either way: it is evidence about
        // the model's judgment, and hiding it once overruled would hide
        // exactly the thing worth arguing with.
        <div className={`${s.rec} ${on ? '' : s.recOff}`}>
            <input
                type="checkbox"
                className={s.recCheck}
                checked={on}
                disabled={disabled}
                onChange={onToggle}
                aria-label={`Include ${r.authors} — ${r.title.slice(0, 80)}`}
            />
            <div className={s.recBody}>
                <div className={s.cite}>
                    <span className={s.who}>{r.authors} ({r.year})</span>
                    <span className={s.jrnl}>{r.journal}</span>
                    <a
                        className={s.recPmid}
                        href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        PMID {r.pmid}
                    </a>
                </div>
                <div className={s.recTitle}>{r.title}</div>
                <div className={s.meta}>
                    <span className={`${s.tag} ${strong ? s.tagDesign : s.tagOther}`}>{design}</span>
                    {/* NIH percentile — CONTEXT, not a verdict. It does not sort, does not
                        filter, and never reaches the model. Absent on recent papers because
                        it needs citation history, so render NOTHING rather than "N/A": a
                        blank reads as "not yet scored", a zero would read as "ignored". */}
                    {typeof r.nihPercentile === 'number' && (
                        <span
                            className={`${s.tag} ${s.tagCite} ${s.hint}`}
                            tabIndex={0}
                            aria-describedby={`cite-${r.pmid}`}
                        >
                            <span
                                className={s.meter}
                                aria-hidden="true"
                                style={{ ['--pct' as any]: `${Math.max(2, Math.min(100, Math.round(r.nihPercentile)))}%` }}
                            />
                            Cited {Math.round(r.nihPercentile)}th pct
                            <span role="tooltip" id={`cite-${r.pmid}`} className={s.hintBox}>
                                <b>NIH citation percentile (iCite).</b> This paper is cited more often
                                than {Math.round(r.nihPercentile)}% of NIH-funded papers of the same
                                field and year.
                                <br />
                                It is <b>not a measure of study quality</b>, and it did nothing here: it
                                never sorted these records, never filtered them, and never reached the
                                model. Citation counts favour older papers and reviews &mdash; the exact
                                bias this mode removes.
                            </span>
                        </span>
                    )}
                </div>

                {/* NOBODY LOOKED AT THIS ONE, AND IT MUST NOT LOOK LIKE AN ENDORSEMENT.
                    A record the model returned no verdict for fails OPEN — it arrives
                    with include: true, so it is PRE-TICKED and, until this branch
                    existed, was pixel-identical to a record the AI had read and
                    approved. It sat in the "N included" tally, went into the synthesis,
                    and carried an AI endorsement it had never been given. That is the
                    one failure on this page that puts an UNREAD paper in front of a
                    librarian wearing a machine's approval.

                    Fail-open is still right — silently DROPPING an unscreened record
                    would be worse. The bug was that it was invisible. So it keeps its
                    tick and gets the loudest treatment on the row: the warning strip,
                    not the quiet grey reason line an exclusion gets. An exclusion is a
                    judgment; this is the absence of one. */}
                {f && f.screened === false ? (
                    <div className={s.caveat}>
                        <span aria-hidden="true">&#9888;</span>
                        <span>
                            <b>Not screened by the AI.</b> {f.reason} It is ticked because nothing
                            was thrown away &mdash; <b>not because anything approved it.</b>
                        </span>
                    </div>
                ) : f && !f.include && (
                    <div className={`${s.why} ${s.flagline}`}>
                        <b>Excluded:</b> {f.reason}
                    </div>
                )}
                {screened && !f && (
                    <div className={s.help}>
                        The AI returned no verdict for this record &mdash; it is unticked, and
                        the call is yours.
                    </div>
                )}
            </div>
        </div>
    )
}

export function CandidatesPanel({
    records, flags, picked, screened, included, excludedCount, unscreened,
    stage, inFlight, progressPanel, setPicked, onDlRecords, onSynthesize,
}: {
    records: PubRecord[]
    flags: Record<string, Screened>
    picked: Record<string, boolean>
    screened: boolean
    included: PubRecord[]
    excludedCount: number
    unscreened: number
    stage: Stage
    inFlight: boolean
    progressPanel: ReactNode
    setPicked: (fn: (p: Record<string, boolean>) => Record<string, boolean>) => void
    onDlRecords: () => void
    onSynthesize: () => void
}) {
    return (
        <div className={s.card}>
            <div className={s.screenBar}>
                {screened ? (
                    <div className={s.tally}>
                        <b className={s.tallyInc}>{included.length}</b> included &nbsp;&middot;&nbsp;{' '}
                        <b>{excludedCount}</b> excluded
                        {/* "OF THEM" is doing real work: this number is a SUBSET of the
                            included count to its left, not a third bucket beside it. Read
                            as a third bucket the three numbers appear not to add up. */}
                        {unscreened > 0 && (
                            <> &nbsp;&middot;&nbsp; <b>{unscreened}</b> of them never screened</>
                        )}
                    </div>
                ) : (
                    <div className={s.tally}>{records.length} record{records.length === 1 ? '' : 's'}</div>
                )}
                <span className={s.spacer} />
                {/* The records are DATA, so they leave as a spreadsheet: 50 rows with the
                    screening decision, the reason, the design and the link, plus a second
                    sheet carrying the query that produced them. That is what goes into
                    Covidence, or into a filter, or to a co-author. */}
                <button
                    className={s.btnSecondary}
                    onClick={onDlRecords}
                    disabled={!records.length || inFlight}
                >
                    Records (.xlsx)
                </button>
                {/* Gated on the HUMAN's selection, and on nothing else. In particular it is
                    NOT gated on the screening having succeeded: if the model call fails, the
                    records are still on the page and still tickable, and a librarian who has
                    ticked four of them by hand is entitled to synthesize them. */}
                <button
                    className={s.btn}
                    onClick={onSynthesize}
                    disabled={!included.length || inFlight}
                >
                    {stage === 'synthesizing'
                        ? 'Writing the synthesis…'
                        : `Synthesize ${included.length} selected`}
                </button>
            </div>

            {/* The screening wait sits ABOVE the rows it is about to annotate, and the
                rows are already on screen underneath it. 29 seconds of nothing would
                have been 29 seconds of the librarian wondering if it had died. */}
            {(stage === 'screening' || stage === 'synthesizing') && progressPanel}

            <div className={s.rows}>
                {records.map(r => (
                    <RecordRow
                        key={r.pmid}
                        r={r}
                        f={flags[r.pmid]}
                        on={!!picked[r.pmid]}
                        screened={screened}
                        disabled={inFlight}
                        onToggle={() => setPicked(p => ({ ...p, [r.pmid]: !p[r.pmid] }))}
                    />
                ))}

                {!records.length && (
                    <div className={s.empty}>The query returned no records. Widen the question or the limits.</div>
                )}
            </div>

            <p className={s.help}>
                Records the AI excluded stay on this page, de-emphasised, with the reason shown.{' '}
                <b>The flags are suggestions; the checkbox is yours.</b> Re-tick anything it got wrong —
                the count above, and what gets synthesized, follow you and not the model.
            </p>
        </div>
    )
}

// ============ MODE 4 — CORPUS TABLE ============
const PAGE_SIZE = 50

function CorpusRow({ r }: { r: M4Record }) {
    return (
        <div className={s.rec}>
            <div className={s.recBody}>
                <div className={s.cite}>
                    <span className={s.who}>{r.authors} ({r.year})</span>
                    <span className={s.jrnl}>{r.journal}</span>
                    <a className={s.recPmid} href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noopener noreferrer">
                        PMID {r.pmid}
                    </a>
                </div>
                <div className={s.recTitle}>{r.title}</div>
                <div className={s.meta}>
                    <span className={`${s.tag} ${s.tagDesign}`}>{r.design}</span>
                    {r.clusterLabel && <span className={`${s.tag} ${s.tagOther}`}>{r.clusterLabel}</span>}
                    {r.caseSeriesProbable && <span className={`${s.tag} ${s.tagOther}`}>Case series (probable)</span>}
                    {/* THE MEASUREMENT BEFORE THE JUDGMENTS. The percentile is iCite's, not a
                        model's, and it is the only number on this row a reader can go and verify
                        against a public API — so it leads, and it renders as nothing at all when
                        absent rather than as a zero (see withCitationMetrics on why). */}
                    {typeof r.nihPercentile === 'number' && (
                        <span className={`${s.tag} ${s.tagCite}`} title="NIH iCite field- and year-normalised citation percentile">
                            NIH {r.nihPercentile}th pct
                        </span>
                    )}
                    {typeof r.impactScore === 'number' && (
                        <span className={`${s.tag} ${s.tagCite}`} title={r.impactJustification}>
                            Impact {r.impactScore}
                        </span>
                    )}
                    {typeof r.relevanceScore === 'number' && (
                        <span className={`${s.tag} ${s.tagCite}`} title={r.relevanceJustification}>
                            Relevance {r.relevanceScore.toFixed(2)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

// Read-only, paginated, filterable by evidence type and cluster — the "thousands of rows, no
// checkbox" shape the plan's own UI section asks for. Filter/page selection is LOCAL state: unlike
// CandidatesPanel's ticks, nothing else on the page depends on which page or filter is showing, so
// there is nothing here for the orchestrator to hold an opinion about.
export function CorpusTablePanel({ corpus }: { corpus: M4Record[] }) {
    const [evidenceFilter, setEvidenceFilter] = useState('')
    const [clusterFilter, setClusterFilter] = useState('')
    const [page, setPage] = useState(0)

    const evidenceTypes = useMemo(() => [...new Set(corpus.map(r => r.design))].sort(), [corpus])
    const clusterLabels = useMemo(() => [...new Set(corpus.map(r => r.clusterLabel).filter(Boolean))].sort() as string[], [corpus])

    // SORTED, BECAUSE THE UNSORTED ORDER WAS ACTIVELY MISLEADING. This used to render in whatever
    // order fetchCorpus's dedup map happened to produce — year-shard ascending — so the first page a
    // reader saw was the oldest records in the corpus, which on the 2026-08-19 run meant three
    // off-topic 2017 papers above the fold and the corpus's single most-cited paper (a Cochrane
    // review, 268 citations, 99th percentile) buried thousands of rows down.
    //
    // Scored records first, best first; everything else keeps its retrieval order behind them. The
    // key is deliberately the two SHORTLIST axes and not the corpus-wide evidence prior: a reader
    // opening this table wants the papers a model actually read and vouched for at the top, and
    // ranking on the prior would just re-sort the whole corpus by study design, which the evidence
    // filter above already does better and on demand.
    const filtered = useMemo(() => {
        const rank = (r: M4Record) =>
            typeof r.impactScore === 'number' || typeof r.relevanceScore === 'number'
                ? (r.impactScore ?? 0) / 100 + (r.relevanceScore ?? 0)
                : -1
        return corpus
            .filter(r => (!evidenceFilter || r.design === evidenceFilter) && (!clusterFilter || r.clusterLabel === clusterFilter))
            .map((r, i) => ({ r, i, k: rank(r) }))
            // Index as the final tie-break keeps this a STABLE sort across engines — the unscored
            // tail all share k = -1, and without it their order could differ between browsers.
            .sort((a, b) => (b.k - a.k) || (a.i - b.i))
            .map(x => x.r)
    }, [corpus, evidenceFilter, clusterFilter])

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const clampedPage = Math.min(page, pageCount - 1)
    const shown = filtered.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE)

    const onFilter = (fn: () => void) => { fn(); setPage(0) }

    return (
        <div className={s.card}>
            <div className={s.screenBar}>
                <div className={s.tally}>Corpus table ({filtered.length.toLocaleString()} record{filtered.length === 1 ? '' : 's'})</div>
                <span className={s.spacer} />
                <select className={s.input} value={evidenceFilter} onChange={e => onFilter(() => setEvidenceFilter(e.target.value))}>
                    <option value="">All evidence types</option>
                    {evidenceTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className={s.input} value={clusterFilter} onChange={e => onFilter(() => setClusterFilter(e.target.value))}>
                    <option value="">All clusters</option>
                    {clusterLabels.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            <div className={s.rows}>
                {shown.map(r => <CorpusRow key={r.pmid} r={r} />)}
                {!shown.length && <div className={s.empty}>No records match this filter.</div>}
            </div>

            {pageCount > 1 && (
                <div className={s.narrowFoot}>
                    <button className={s.btnSecondary} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={clampedPage === 0}>
                        &larr; Previous
                    </button>
                    <span className={s.counts}>Page {clampedPage + 1} of {pageCount}</span>
                    <button className={s.btnSecondary} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={clampedPage >= pageCount - 1}>
                        Next &rarr;
                    </button>
                </div>
            )}
        </div>
    )
}
