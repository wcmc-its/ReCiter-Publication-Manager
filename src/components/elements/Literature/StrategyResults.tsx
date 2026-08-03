// MODE 1's DELIVERABLE, ON SCREEN. One panel per database, the known-item check underneath each
// one, and the exports that carry them off the page. Everything here is presentational: the page
// owns every piece of state and hands down the values and the handlers, so nothing in this file can
// re-count anything, and the numbers it prints can only ever be the ones the page was showing.
import type { ReactNode } from 'react'
import { numberStrategy } from '../../../../controllers/literatureSearch.strategy'
import type { Strategy } from '../../../../controllers/literatureSearch.strategy'
import { modelLabel } from '../../../../controllers/literatureExport'
import { RowCount, LineInput } from './LiteratureSearch.parts'
import type { DbResult, RowState, Seed } from './LiteratureSearch.types'
import s from './LiteratureSearch.module.css'

// Per DATABASE now — a seed can be retrieved by PubMed and missed by Scopus, and that difference
// is one of the more interesting things this screen can tell a librarian.
const seedIn = (r: DbResult, id?: string) => r.seeds.find(x => x.id === id)
const nameOf = (x?: Seed) => (x ? x.label || `${x.kind.toUpperCase()} ${x.id}` : '')

type Numbered = ReturnType<typeof numberStrategy>

function StrategyPanel({
    result, live, numbered, recounting, rowsState, model, copiedQuery,
    onToggle, onEdit, onAddLine, onRetryRows, onCopyQuery, onDlQuery, onDlStrategy,
}: {
    result: DbResult
    live: Strategy
    numbered: Numbered
    recounting: boolean
    rowsState: RowState
    model: string
    copiedQuery: boolean
    onToggle: (ci: number, li: number) => void
    onEdit: (ci: number, li: number, terms: string) => void
    onAddLine: (ci: number) => void
    onRetryRows: () => void
    onCopyQuery: () => void
    onDlQuery: () => void
    onDlStrategy: () => void
}) {
    return (
        <section className={s.panel} aria-live="polite">
            <div className={s.panelHead}>
                <h2 className={s.panelTitle}>{result.dbName}</h2>
                {/* A DATABASE WE CANNOT COUNT SHOWS NO NUMBER. `hits` is null for Embase
                    (Ovid) — we have no API — and null is NOT zero. Rendering it as "0
                    records" beside a perfectly good strategy would be the most damaging
                    thing on this screen: it reads as "your search found nothing." */}
                {result.hits === null ? (
                    <span className={s.notCounted}>not counted &mdash; run it in Ovid</span>
                ) : (
                    <span className={`${s.hits} ${recounting ? s.hitsStale : ''}`}>
                        {result.hits.toLocaleString()} <span>records</span>
                    </span>
                )}
                {recounting && result.hits !== null && <span className={s.recounting}>re-counting…</span>}
            </div>

            {/* SCOPUS IS NOT A SECOND PUBMED, AND THE SCREEN SAYS SO. It has no controlled
                vocabulary — nothing to explode, no MeSH analogue — so this strategy is
                faithfully the same idea and systematically LESS SENSITIVE than the PubMed
                one beside it. For a systematic review, where recall is the cardinal
                virtue, that is a methodological cost no engineering can remove, and a
                librarian is entitled to read it before they trust the number above. */}
            {result.db === 'scopus' && (
                <div className={s.dbNote}>
                    Scopus has <b>no controlled vocabulary</b> — no MeSH, nothing to explode — so every
                    concept below rests on free text alone. It is a <b>supplementary</b> database here,
                    not a PubMed-equivalent one.
                </div>
            )}

            {/* A LIMIT THIS DATABASE CANNOT EXPRESS. Never silently dropped: the count
                above would then answer a BROADER question than the one asked, sitting
                next to a PubMed count that answered the narrow one. */}
            {result.unsupportedLimits?.length > 0 && (
                <div className={`${s.dbNote} ${s.dbNoteWarn}`}>
                    <b>{result.unsupportedLimits.join('; ')}</b> could not be applied &mdash; {result.dbName} indexes a
                    document type (article, review), not a study design, so it has no way to say this.
                    The count above is <b>not</b> restricted by it.
                </div>
            )}

            {/* THE SEARCH RAN; SOMETHING AFTER IT DID NOT. Seed validation and the suggested
                widenings are extra count calls made once the yield has already landed, and
                NCBI can throttle them on their own. That is NOT a failed database — the
                query is real, the count above it is real, and we were billed for it — so
                this is a quiet note on a working panel and NOT the failure panel above. A
                degraded panel that suppressed its own count would throw away the one thing
                the librarian actually paid for, to report a step that is a courtesy. */}
            {result.degraded && (
                <div className={s.dbNote}>
                    <b>The count is good; part of the check around it is not.</b> {result.degraded}
                </div>
            )}

            <div className={s.lines}>
                {numbered.rows.map((row, i) => {
                    // A combination line (6 = 4 OR 5) is DERIVED. No checkbox: there is
                    // nothing to decide about it, it recomputes from the lines above.
                    if (row.kind === 'combine') {
                        return (
                            <div className={s.line} key={`c${i}`}>
                                <span className={s.lineGutter} />
                                <span className={s.lineNum}>{row.n}</span>
                                <span className={s.combine}>{row.text}</span>
                                <RowCount n={row.n} counts={result.rowCounts} stale={recounting} state={rowsState} />
                            </div>
                        )
                    }

                    const seed = seedIn(result, row.line.suggestedFor)
                    return (
                        <div key={`t${row.ci}-${row.li}`}>
                            <div className={s.line}>
                                <input
                                    type="checkbox"
                                    className={s.lineCheck}
                                    checked={row.line.on}
                                    onChange={() => onToggle(row.ci, row.li)}
                                    aria-label={`Include line: ${row.line.terms.slice(0, 60)}`}
                                />
                                <span className={s.lineNum}>{row.n ?? '·'}</span>
                                <LineInput
                                    value={row.line.terms}
                                    on={row.line.on}
                                    onChange={v => onEdit(row.ci, row.li, v)}
                                />
                                <RowCount n={row.n} counts={result.rowCounts} stale={recounting} state={rowsState} />
                            </div>
                            {/* The model's proposed widening: a LINE, not a paragraph. Verified
                                (it really does retrieve that seed, against the whole strategy)
                                and priced (what ticking it costs in records to screen). That
                                trade is the judgment the librarian is here to make. */}
                            {row.line.suggestedFor && !row.line.on && (
                                <div className={s.suggest}>
                                    Suggested: retrieves {nameOf(seed)}
                                    {typeof row.line.costRecords === 'number' && (
                                        <> &middot; <b>+{row.line.costRecords.toLocaleString()} records</b> to screen</>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}

                {!numbered.rows.some(r => r.kind === 'term' && r.n !== null) && (
                    <div className={s.empty}>Nothing is ticked, so there is no strategy to run.</div>
                )}

                {/* THE COLUMN DIED, AND IT SAYS SO. The yield above is still real — it was
                    counted in a different call — so this is not an error banner over the
                    whole panel, which would overstate it. It is a line under the column
                    that failed, offering the one thing that fixes it. */}
                {rowsState === 'failed' && (
                    <div className={s.rowsFailed}>
                        <span>
                            The per-line counts could not be fetched &mdash; PubMed did not answer.
                            The yield above is unaffected.
                        </span>
                        <button className={s.linkBtn} onClick={onRetryRows}>
                            Retry
                        </button>
                    </div>
                )}

                <div className={s.addLines}>
                    {live.concepts.map((c, ci) => (
                        <button key={ci} className={s.addLine} onClick={() => onAddLine(ci)}>
                            + line to {c.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className={s.panelFoot}>
                {/* The QUERY is model-drafted too, not just the prose — so the strategy screen
                    names the model exactly like the synthesis does, and the export says so in
                    its repro header. A PRISMA-S appendix that does not disclose that the
                    strategy was AI-drafted and human-reviewed is incomplete. */}
                <span>
                    Run {result.runDate}{result.limits ? ` · limits: ${result.limits}` : ' · no limits'}
                    {model ? ` · drafted by ${modelLabel(model)}` : ''}
                </span>
                <span className={s.spacer} />
                <span>Tick, untick or edit any line &mdash; it re-counts for free.</span>
                {/* The strategy is the deliverable, so it downloads FROM the strategy —
                    not from a menu somewhere else. Word for the appendix, plain text for
                    the query, because a query wants to be pasted back into the database
                    that produced it. Both describe the TOGGLED state, never the draft. */}
                <div className={s.footBtns}>
                    <button
                        className={`${s.btnSecondary} ${copiedQuery ? s.btnSecondaryDone : ''}`}
                        onClick={onCopyQuery}
                        disabled={!result.query}
                    >
                        {copiedQuery ? '✓ Copied' : 'Copy query'}
                    </button>
                    <button className={s.btnSecondary} onClick={onDlQuery} disabled={!result.query}>
                        Query (.txt)
                    </button>
                    <button className={s.btnSecondary} onClick={onDlStrategy} disabled={recounting || !result.query}>
                        Word (.docx)
                    </button>
                </div>
            </div>
        </section>
    )
}

// KNOWN-ITEM VALIDATION, PER DATABASE. A seed can be retrieved by PubMed and
// MISSED by Scopus — and that difference is often the most informative thing on
// this screen, because it is a fact about the databases, not about the query.
function SeedValidation({ result, live, numbered, recounting, retrieved, allFound }: {
    result: DbResult
    live: Strategy
    numbered: Numbered
    recounting: boolean
    retrieved: number
    allFound: boolean
}) {
    return (
        <div className={`${s.card} ${s.validation}`}>
            <div className={s.valHead}>
                <span className={s.eyebrow}>Known-item validation</span>
                {result.seeds.length > 0 && (
                    <span className={`${s.valScore} ${allFound ? '' : s.valScoreWarn} ${recounting ? s.hitsStale : ''}`}>
                        {retrieved} of {result.seeds.length} retrieved
                    </span>
                )}
            </div>

            {/* NO SEEDS = NO RECALL CHECK. Saying so is the whole ethic of this feature:
                an unvalidated strategy is a guess, and a guess that stays quiet reads
                exactly like a strategy that passed. */}
            {/* A DATABASE WE CANNOT COUNT CANNOT BE SEED-CHECKED EITHER, and it must not
                borrow PubMed's "add some seeds and re-run" advice — that advice is FALSE
                here. No number of seeds will ever make Embase testable from this screen;
                the check moves to Ovid, with the librarian. Saying "recall cannot be
                verified — add seeds" would send them round a loop that has no exit. */}
            {result.hits === null ? (
                <div className={s.recallLine}>
                    <span className={`${s.dot} ${s.dotWarn}`} />
                    <span>
                        <b>Not checkable from here.</b> A recall check needs a count, and we have no API for{' '}
                        {result.dbName} &mdash; seeds would change nothing. Run the strategy in Ovid and
                        look for the papers it must retrieve. Check the Emtree lines while you are there:
                        run each one on its own, and <b>a heading line that returns 0 is a dead line.</b>
                    </span>
                </div>
            ) : result.seeds.length === 0 ? (
                <div className={s.recallLine}>
                    <span className={`${s.dot} ${s.dotWarn}`} />
                    <span>
                        No known-item seeds provided &mdash; <b>recall cannot be verified.</b> Add PMIDs
                        or DOIs of papers this search must retrieve, and re-run, to make this strategy
                        testable.
                    </span>
                </div>
            ) : (
                <>
                    <div className={s.seeds}>
                        {result.seeds.map(x => {
                            const failing = (x.failingConcepts || [])
                                .map(i => ({ label: result.concepts[i]?.label, lines: numbered.conceptLines[i] || [] }))
                                .filter(f => f.label)
                            return (
                                <div className={s.seed} key={`${x.kind}${x.id}`}>
                                    <span className={`${s.seedMark} ${x.retrieved ? s.seedHit : s.seedMiss}`}>
                                        {x.retrieved ? '✓' : '✗'}
                                    </span>
                                    {/* Author + year, not a bare PMID: a librarian who named four
                                        seeds cannot tell which paper missed from an 8-digit number. */}
                                    {x.label && <span className={s.seedName}>{x.label}</span>}
                                    <span className={s.seedId}>{x.kind.toUpperCase()} {x.id}</span>
                                    {!x.retrieved && (
                                        <span className={s.verdict}>
                                            {x.notInDatabase ? 'Not in this database' : 'Not retrieved'}
                                        </span>
                                    )}

                                    {/* The reason is DERIVED by re-counting the seed against each
                                        block AND the limits, never guessed by the model. A paper can
                                        fail both at once, so both are reported — naming only the
                                        block sends a librarian off to widen a search that still
                                        cannot return it. */}
                                    {!x.retrieved && (
                                        <span className={s.why}>
                                            {/* NOT A STRATEGY BUG, AND IT MUST NOT READ AS ONE. The paper
                                                is not in this database at all, so no widening of any block
                                                can ever retrieve it. Without this verdict the seed would
                                                "fail" every block at once and look like a catastrophically
                                                narrow query — sending a librarian off to fix a search that
                                                was never broken. It is also a real finding in its own
                                                right: it is what Scopus's coverage gap LOOKS like. */}
                                            {x.notInDatabase && (
                                                <><b>{result.dbName} does not index this paper.</b> No change to the
                                                    strategy can retrieve it &mdash; this is a coverage gap in the
                                                    database, not a fault in the query.</>
                                            )}
                                            {!x.notInDatabase && !failing.length && !x.failsLimits && (
                                                <>Nothing is ticked, so there is no strategy to retrieve it.</>
                                            )}
                                            {!x.notInDatabase && failing.length > 0 && (
                                                <>
                                                    Excluded by the{' '}
                                                    {failing.map((f, k) => (
                                                        <span key={k}>
                                                            {k > 0 && ' and '}
                                                            <b>{f.label}</b>
                                                            {f.lines.length > 0 && (f.lines.length > 1
                                                                ? ` (lines ${f.lines[0]}–${f.lines[f.lines.length - 1]})`
                                                                : ` (line ${f.lines[0]})`)}
                                                        </span>
                                                    ))}
                                                    {failing.length > 1 ? ' blocks' : ' block'}.{' '}
                                                </>
                                            )}
                                            {!x.notInDatabase && x.failsLimits && (
                                                <>
                                                    {failing.length > 0 ? <>It also fails your </> : <>It matches every block you have ticked, so your </>}
                                                    <b>limits</b>
                                                    {failing.length > 0
                                                        ? <>, so widening the {failing.length > 1 ? 'blocks' : 'block'} alone will not bring it back &mdash; change the date range or publication type.</>
                                                        : <> are what exclude it &mdash; change the date range or publication type.</>}
                                                </>
                                            )}
                                            {/* ONLY PROMISE A SUGGESTED LINE IF ONE ACTUALLY EXISTS. The
                                                model-written widening is a PubMed move — it works by reading
                                                the paper's MeSH descriptors, and Scopus has no controlled
                                                vocabulary to read. So in a Scopus panel there is no unticked
                                                line waiting, and telling a librarian to go and find one is
                                                the exact species of confident, plausible falsehood this
                                                feature exists to prevent. Checked against the STRATEGY, not
                                                against the database name: if the suggestion is not there, do
                                                not mention it, whatever produced it. */}
                                            {!x.notInDatabase && failing.length > 0 && !x.failsLimits && (
                                                live.concepts.some(c => c.lines.some(l => l.suggestedFor === x.id))
                                                    ? <>Widen {failing.length > 1 ? 'them' : 'it'} to retrieve this paper &mdash; a
                                                        suggested line is waiting, unticked, in the strategy above.</>
                                                    : <>Widen {failing.length > 1 ? 'them' : 'it'} to retrieve this paper.</>
                                            )}
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {allFound ? (
                        <div className={s.recallLine}>
                            <span className={s.dot} />
                            <span>Every known include came back. This strategy is validated against its seeds.</span>
                        </div>
                    ) : (
                        result.seeds.some(x => !x.retrieved && x.failingConcepts?.length) && (
                            <p className={s.help}>
                                A strategy that misses a known include is not yet finished. Widen the failing
                                block &mdash; the yield will grow, and that is the trade.
                            </p>
                        )
                    )}
                </>
            )}
        </div>
    )
}

export function StrategyResults({
    results, liveStrategies, recounting, rowState, model, copied, expertsPanel,
    onToggle, onEdit, onAddLine, onRetryRows, onCopy, onDlQuery, onDlStrategy, onDlPacket, prismaBlock,
}: {
    results: DbResult[]
    liveStrategies: Strategy[]
    recounting: boolean
    rowState: Record<number, RowState>
    model: string
    copied: string
    expertsPanel: ReactNode
    onToggle: (di: number, ci: number, li: number) => void
    onEdit: (di: number, ci: number, li: number, terms: string) => void
    onAddLine: (di: number, ci: number) => void
    onRetryRows: (di: number) => void
    onCopy: (text: string, what: string) => void
    onDlQuery: (r: DbResult) => void
    onDlStrategy: (r: DbResult) => void
    onDlPacket: (r: DbResult) => void
    prismaBlock: () => string
}) {
    // Modes 2 and 3 read the head of the array; so do the whole-run exports at the foot of this
    // screen, and for the same reason — they iterate `results` themselves and only need a run date.
    const result = results[0]
    return (
        <>
            {/* ONE PANEL PER DATABASE. They share the concept LABELS and nothing else: each
                set of terms was written natively for its own database, from the question.
                Two counts sit side by side, and they are NOT the same search — which is the
                honest thing to show, and the reason the panels are separate rather than
                summed. Counts across databases must never be added: the overlap is large
                and unmeasured until records are deduped. */}
            {results.map((result, di) => {
                const live = liveStrategies[di]
                if (!live) return null
                const numbered = numberStrategy(live)
                const retrieved = result.seeds.filter(x => x.retrieved).length
                const allFound = result.seeds.length > 0 && retrieved === result.seeds.length
                return (
                    <div key={result.db}>
                        <StrategyPanel
                            result={result}
                            live={live}
                            numbered={numbered}
                            recounting={recounting}
                            rowsState={rowState[di] || 'done'}
                            model={model}
                            copiedQuery={copied === 'query'}
                            onToggle={(ci, li) => onToggle(di, ci, li)}
                            onEdit={(ci, li, terms) => onEdit(di, ci, li, terms)}
                            onAddLine={ci => onAddLine(di, ci)}
                            onRetryRows={() => onRetryRows(di)}
                            onCopyQuery={() => onCopy(result.query, 'query')}
                            onDlQuery={() => onDlQuery(result)}
                            onDlStrategy={() => onDlStrategy(result)}
                        />

                        <SeedValidation
                            result={result}
                            live={live}
                            numbered={numbered}
                            recounting={recounting}
                            retrieved={retrieved}
                            allFound={allFound}
                        />
                    </div>
                )
            })}


            {/* Embase used to be a disabled checkbox and a "Coming soon" card here. It is now a
                real, drafted, uncounted strategy — so the promise is kept and the card is gone.
                CENTRAL is the one still outstanding, and it says so rather than implying a date. */}
            <div className={s.pending}>
                <div className={s.pendingHead}>
                    <span className={s.eyebrow}>CENTRAL</span>
                    <span className={s.expertsCount}>not searched</span>
                </div>
                <div className={s.pendingNote}>
                    A Cochrane-compliant search also wants CENTRAL (the Cochrane trials register).
                    It is not searched here.
                </div>
            </div>

            {expertsPanel}

            <div className={s.actions}>
                <button
                    className={s.btn}
                    onClick={() => onCopy(prismaBlock(), 'prisma')}
                    disabled={recounting || !result.query}
                >
                    {copied === 'prisma' ? '✓ Copied — paste into your manuscript' : 'Copy PRISMA-S methods block'}
                </button>
                <button
                    className={s.btnSecondary}
                    onClick={() => onDlPacket(result)}
                    disabled={recounting || !result.query}
                >
                    Download everything
                </button>
            </div>
        </>
    )
}
