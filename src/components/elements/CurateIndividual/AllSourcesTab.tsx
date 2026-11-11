import React, { FunctionComponent, useId, useMemo, useState } from "react"
import styles from "./CurateIndividual.module.css"
import { Button, Dialog } from "../../ui"
import { ExternalArticles } from "./useExternalArticles"
import {
    EXT_SOURCE_NAMES, EXT_SOURCES_IF_PRESENT, ExtSourceName, ExtStatus, ExtWork, countWorks, extStatusOf,
    groupExternalWorks, workHasSource, workHidden, workMatches, storeTargetOf, storeStatusText, StoreIntent,
    provenanceBadges, provenanceBadgeOf, workUnfamiliarAffiliation, autoMergedRows, AutoMerged,
} from "../../../utils/allSources"

// Phase 3a — Curate's single "All sources" tab (replaces the Scopus / OpenAlex / Crossref tabs).
// One row per work across sources (grouped by DOI), a status switch and a source switch, and
// rows acted on this session stay in place with Undo. Reads and writes are the ones the
// per-source tabs made (useExternalArticles): reversible accept / reject via the feedback route,
// and a permanent delete. Layout follows the UI refresh prototype's External tab body.
// With the external record store (EXTERNAL_STORE=mysql, plan 3b-3e) the actions are lifecycle
// steps instead: Reject -> REJECTED, Remove -> REMOVED (both remember the work so an import or
// add of it again is flagged), Accept puts a rejected or removed work back, Undo is the store's
// one-step Undo, and there is no hard delete.
// Plan 3f-3h (3h UI): provenance badges for nightly imports, the unfamiliar-affiliation chip, an
// auto-merged note with "Not the same" (AUTOMERGED -> PENDING, store mode only) and a "Show talks
// and posters" toggle; works the type map hides stay out of Pending unless it is on. All of it is
// inert until the store returns imported rows: today's rows carry no import provenance, flag or
// AUTOMERGED status, and nothing is hidden among Accepted works.

interface FuncProps {
    ext: ExternalArticles,
    fullName: string,
    onOpenScopusAuthorships: () => void,
}

type Done = {
    view: ExtStatus,
    prev: ExtStatus,
    action: 'accepted' | 'removed' | 'rejected' | 'deleted',
    ids: string[],
    // Store mode: the external_record ids the step changed, for Undo.
    recordIds?: number[],
    // Snapshot, so a deleted work still renders its done row.
    work: ExtWork,
}

const doiUrl = 'https://doi.org/'
const pubMedUrl = 'https://pubmed.ncbi.nlm.nih.gov/'

const authorList = (row: any): string[] =>
    Array.isArray(row?.authors) ? row.authors.filter(Boolean).map(String)
        : typeof row?.authors === 'string' && row.authors.trim() ? row.authors.split(/\s*,\s*/) : []

// The byline with the person's name in bold: the first author whose last word is the person's
// surname. Prefers no bold to a wrong one, so an unmatched byline renders plain.
const Byline = ({ row, surname }: { row: any, surname: string }) => {
    const names = authorList(row)
    if (!names.length) return <span className={styles.exAuthors}>No authors listed</span>
    const s = surname.toLowerCase()
    const i = s ? names.findIndex((n) => (n.trim().split(/\s+/).pop() || '').toLowerCase().replace(/[.,]/g, '') === s) : -1
    if (i < 0) return <span className={styles.exAuthors}>{names.join(', ')}</span>
    return (
        <span className={styles.exAuthors}>
            {names.slice(0, i).join(', ')}{i > 0 ? ', ' : ''}<strong>{names[i]}</strong>{i < names.length - 1 ? ', ' : ''}{names.slice(i + 1).join(', ')}
        </span>
    )
}

// A chip with a tooltip that opens on hover or keyboard focus and closes on Escape or blur.
const TipChip = ({ className, label, tip }: { className: string, label: React.ReactNode, tip: React.ReactNode }) => {
    const id = useId()
    const [open, setOpen] = useState(false)
    return (
        <span
            className={`${className} ${styles.exTipHost}`}
            tabIndex={0}
            aria-describedby={id}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) } }}
        >
            {label}
            <span id={id} role="tooltip" className={styles.exTip} data-open={open ? true : undefined}>{tip}</span>
        </span>
    )
}

const KNOWN_AFFILIATION_TIP = 'None of the affiliations on this work match one we know for this person: the institutions and '
    + 'organizational units on their identity, Weill Cornell\'s Scopus and OpenAlex institution ids, or the affiliations '
    + 'on their accepted papers. Earlier work at another institution is often flagged; check it before accepting.'

const STATUS_OPTS: [ExtStatus, string][] = [['PENDING', 'Pending'], ['ACCEPTED', 'Accepted'], ['REJECTED', 'Rejected']]

const AllSourcesTab: FunctionComponent<FuncProps> = ({ ext, fullName, onOpenScopusAuthorships }) => {
    const nameParts = (fullName || '').trim().split(/\s+/).filter(Boolean)
    const short = nameParts[0] || 'this person'
    const surname = (nameParts[nameParts.length - 1] || '').replace(/[.,]/g, '')

    const works = useMemo(() => groupExternalWorks(ext.rows), [ext.rows])
    // Pending leaves out works the type map hides (talks, posters, out of scope), as the tab
    // strip's "N to review" pill does.
    const n = countWorks(works, workHidden)
    const [viewPicked, setViewPicked] = useState<ExtStatus | null>(null)
    const view: ExtStatus = viewPicked || (n.PENDING ? 'PENDING' : 'ACCEPTED')
    const [src, setSrc] = useState<ExtSourceName | 'all'>('all')
    const [q, setQ] = useState('')
    const [here, setHere] = useState<Record<string, Done>>({})
    const [busy, setBusy] = useState<Record<string, boolean>>({})
    const [confirmDelete, setConfirmDelete] = useState<ExtWork | null>(null)
    const [showHidden, setShowHidden] = useState(false)
    const [showMerged, setShowMerged] = useState(false)
    // "Not the same" steps taken this session, by record id, so the item stays in the note with Undo.
    const [split, setSplit] = useState<Record<string, AutoMerged & { busy?: boolean, done?: boolean }>>({})

    const pickView = (v: ExtStatus) => { setViewPicked(v); setHere({}) }

    // A work belongs in the view by its status, or because it was acted on in this view.
    const inView = (w: ExtWork) => (here[w.key] ? here[w.key].view === view : w.status === view)
    // Pending hides the works the type map hides (talks, posters, out of scope) unless the toggle is
    // on; a work acted on this session stays put either way.
    const hiddenPending = works.filter((w) => w.status === 'PENDING' && workHidden(w)).length
    const live = works.filter((w) => inView(w) && (here[w.key] || view !== 'PENDING' || showHidden || !workHidden(w)))
    const gone = Object.values(here).filter((d) => d.view === view && !works.some((w) => w.key === d.work.key)).map((d) => d.work)
    const pool = [...live, ...gone]
    const shown = pool.filter((w) => workHasSource(w, src) && workMatches(w, q))
    const multi = pool.filter((w) => w.sources.length > 1).length
    const srcOpts = (['all', ...EXT_SOURCE_NAMES] as (ExtSourceName | 'all')[])
        .filter((k) => !EXT_SOURCES_IF_PRESENT.includes(k as ExtSourceName) || works.some((w) => w.sources.includes(k as ExtSourceName)))

    const mysql = ext.store === 'mysql'

    const automerged = mysql ? autoMergedRows(ext.rows) : []
    const mergedNow = new Set(automerged.map((m) => String(m.row.id)))
    const mergedList: (AutoMerged & { busy?: boolean, done?: boolean })[] = [
        ...automerged.map((m) => split[String(m.row.id)] || m),
        ...Object.values(split).filter((m) => !mergedNow.has(String(m.row.id))),
    ]
    const notTheSame = (m: AutoMerged) => {
        const id = String(m.row.id)
        setViewPicked(view)
        setSplit((x) => ({ ...x, [id]: { ...m, busy: true } }))
        ext.transition([Number(m.row.id)], 'PENDING').then((ok) => {
            setSplit((x) => { const next = { ...x }; if (ok) next[id] = { ...m, done: true }; else delete next[id]; return next })
        })
    }
    const undoNotTheSame = (m: AutoMerged) => {
        const id = String(m.row.id)
        setSplit((x) => ({ ...x, [id]: { ...m, done: true, busy: true } }))
        ext.undo([Number(m.row.id)]).then((ok) => {
            setSplit((x) => { const next = { ...x }; if (ok) delete next[id]; else next[id] = { ...m, done: true }; return next })
        })
    }

    const actStore = (w: ExtWork, action: Done['action']) => {
        const intent: StoreIntent = action === 'accepted' ? 'accept' : action === 'rejected' ? 'reject' : 'remove'
        const to = action === 'accepted' ? 'ACCEPTED' : action === 'rejected' ? 'REJECTED' : 'REMOVED'
        const rows = w.rows.filter((r) => storeTargetOf(r.status, intent) === to)
        const recordIds = rows.map((r) => Number(r.id))
        if (!recordIds.length) return
        setViewPicked(view)
        setBusy((b) => ({ ...b, [w.key]: true }))
        ext.transition(recordIds, to).then((ok) => {
            if (ok) setHere((h) => ({ ...h, [w.key]: { view, prev: w.status, action, ids: rows.map((r) => r.articleId), recordIds, work: w } }))
        }).finally(() => setBusy((b) => ({ ...b, [w.key]: false })))
    }

    const act = (w: ExtWork, action: Done['action']) => {
        if (mysql) return actStore(w, action)
        const target: 'ACCEPTED' | 'REJECTED' = action === 'accepted' ? 'ACCEPTED' : 'REJECTED'
        const ids = w.rows.filter((r) => extStatusOf(r) !== target).map((r) => r.articleId)
        // Pin the current view: the default view follows the pending count, so acting on the last
        // pending work would flip it to Accepted on refetch, where the work (kept in its Pending
        // done row) is hidden from both views.
        setViewPicked(view)
        setBusy((b) => ({ ...b, [w.key]: true }))
        const write = action === 'deleted'
            ? Promise.all(w.rows.map((r) => ext.remove(r.articleId))).then((oks) => oks.every(Boolean))
            : ext.setFeedback(ids, target)
        write.then((ok) => {
            if (ok) setHere((h) => ({ ...h, [w.key]: { view, prev: w.status, action, ids, work: w } }))
        }).finally(() => setBusy((b) => ({ ...b, [w.key]: false })))
    }

    const undo = (d: Done) => {
        if (mysql && d.recordIds) {
            setBusy((b) => ({ ...b, [d.work.key]: true }))
            ext.undo(d.recordIds).then((ok) => {
                if (ok) setHere((h) => { const next = { ...h }; delete next[d.work.key]; return next })
            }).finally(() => setBusy((b) => ({ ...b, [d.work.key]: false })))
            return
        }
        if (d.prev === 'PENDING') return
        setBusy((b) => ({ ...b, [d.work.key]: true }))
        ext.setFeedback(d.ids, d.prev).then((ok) => {
            if (ok) setHere((h) => { const next = { ...h }; delete next[d.work.key]; return next })
        }).finally(() => setBusy((b) => ({ ...b, [d.work.key]: false })))
    }

    const fromSrc = src === 'all' ? '' : ` from ${src}`
    const plural = (k: number) => (k === 1 ? '' : 's')
    const countNoun = view === 'PENDING' ? `imported work${plural(shown.length)}${fromSrc} waiting for review`
        : view === 'REJECTED' ? `rejected external work${plural(shown.length)}${fromSrc}`
        : `external article${plural(shown.length)}${fromSrc} in ${short}'s record`
    const subText = view === 'PENDING' ? 'Imported works wait here until a curator accepts or rejects them. Name-only matches go to Authorships instead.'
        : view === 'REJECTED' ? `Rejected here, or superseded by a PubMed record. Accept one to put it back in ${short}'s record.`
        : 'Accepted articles from Scopus, OpenAlex, Crossref and ORCID. No PMID, so no score and not part of the gold standard. A work found in several sources shows once, with each source.'
    const emptyTitle = view === 'PENDING' && !q ? 'Nothing waiting for review' : view === 'REJECTED' && !q ? 'No rejected works'
        : works.length ? 'No matches' : 'No external articles yet'
    const emptyBody = works.length ? 'No external articles match this filter.'
        : `When a Scopus, OpenAlex, Crossref or ORCID work for ${short} is accepted in Authorships or added here, it shows up here.`

    const doneText = (d: Done) => d.action === 'accepted' ? `Accepted · now in ${short}'s record`
        : d.action === 'removed' ? `Removed from ${short}'s record`
        : d.action === 'deleted' ? 'Deleted' : 'Rejected'

    return (
        <div className={styles.exPanel}>
            <div className={styles.exHead}>
                <div className={styles.exHeadText}>
                    <span className={styles.exCount}>
                        <strong>{shown.length}</strong> {countNoun}
                        {multi > 0 && <span className={styles.exOverlap}> · {multi} found in more than one source, counted once</span>}
                    </span>
                    <span className={styles.exSub}>{subText}</span>
                </div>
                <div className={styles.exHeadControls}>
                    <div role="radiogroup" aria-label="Status" className={styles.viewSeg}>
                        {STATUS_OPTS.map(([k, label]) => (
                            <button key={k} type="button" role="radio" aria-checked={view === k} onClick={() => pickView(k)}>
                                <strong>{label}</strong><span className={styles.exSegCount}>{n[k]}</span>
                            </button>
                        ))}
                    </div>
                    <div role="radiogroup" aria-label="Source" className={styles.viewSeg}>
                        {srcOpts.map((k) => (
                            <button key={k} type="button" role="radio" aria-checked={src === k} onClick={() => setSrc(k)}>
                                {k === 'all' ? 'All' : k}
                                <span className={styles.exSegCount}>{pool.filter((w) => workHasSource(w, k)).length}</span>
                            </button>
                        ))}
                    </div>
                    <button type="button" className={styles.exLink} onClick={onOpenScopusAuthorships}>
                        Search Scopus by Author ID →
                    </button>
                    <input
                        className={styles.exFilter}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Filter by title, journal, DOI or ID"
                        aria-label="Filter external works"
                    />
                </div>
            </div>

            {view === 'PENDING' && (mergedList.length > 0 || hiddenPending > 0) && (
                <div className={styles.exNotes}>
                    {mergedList.length > 0 && (
                        <div className={styles.exNote}>
                            <div className={styles.exNoteHead}>
                                <span>
                                    {/* Count the listed items, which keep this session's "Not the same" steps (with Undo), so the
                                        head never reads "0 imports" over a list that still shows one. */}
                                    {mergedList.length} import{mergedList.length === 1 ? '' : 's'} matched works already in the record and {mergedList.length === 1 ? 'was' : 'were'} merged
                                </span>
                                <button type="button" className={styles.exLink} aria-expanded={showMerged} onClick={() => setShowMerged((v) => !v)}>
                                    {showMerged ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            {showMerged && (
                                <ul className={styles.exNoteList}>
                                    {mergedList.map((m) => {
                                        const b = provenanceBadgeOf(m.row)
                                        return (
                                            <li key={String(m.row.id)} className={styles.exNoteItem}>
                                                <span className={styles.exNoteText}>
                                                    <strong>{m.row.title || '(untitled)'}</strong>
                                                    {' '}<span className={styles.exNoteSub}>
                                                        {b ? b.label : m.row.sourceType || 'Import'}
                                                        {m.parent ? <> · merged into “{m.parent.title || m.parent.articleId}”</> : null}
                                                    </span>
                                                </span>
                                                {m.done ? (
                                                    <span className={styles.exBy}>
                                                        Moved to Pending{' · '}
                                                        <button type="button" className={styles.exUndo} onClick={() => undoNotTheSame(m)} disabled={!!m.busy}>Undo</button>
                                                    </span>
                                                ) : (
                                                    <Button size="sm" onClick={() => notTheSame(m)} disabled={!!m.busy}
                                                        title="Not the same work: moves this import to Pending as its own work">Not the same</Button>
                                                )}
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </div>
                    )}
                    {hiddenPending > 0 && (
                        <label className={styles.exToggle}>
                            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
                            Show talks and posters ({hiddenPending})
                            <span className={styles.exNoteSub}> · not counted as waiting for review</span>
                        </label>
                    )}
                </div>
            )}

            {ext.loading && !ext.loaded ? (
                <div className={styles.exEmpty}><div className={styles.exEmptyBody}>Loading…</div></div>
            ) : shown.length === 0 ? (
                <div className={styles.exEmpty}>
                    <div className={styles.exEmptyTitle}>{emptyTitle}</div>
                    <div className={styles.exEmptyBody}>{emptyBody}</div>
                </div>
            ) : shown.map((w) => {
                const d = here[w.key]
                const r = d ? d.work.lead : w.lead
                const venue = r.journalOrVenue || r.venue || r.journal
                const date = r.pubDate || r.publicationDate || r.displayDate
                const pmid = w.rows.map((x) => x.pmid).find(Boolean)
                const doi = w.rows.map((x) => x.doi).find(Boolean)
                const superseded = w.rows.map((x) => x.supersededByPmid).find(Boolean)
                const meta: React.ReactNode[] = [venue && <em key="v">{venue}</em>, date, r.publicationType].filter(Boolean)
                const isBusy = !!busy[w.key]
                const badges = provenanceBadges(w)
                const unfamiliar = workUnfamiliarAffiliation(w)
                return (
                    <div key={w.key} className={styles.exRow} data-done={d ? true : undefined}>
                        <div className={styles.exMain}>
                            <span className={styles.exTitle}>{r.title || '(untitled)'}</span>
                            <Byline row={r} surname={surname} />
                            {meta.length > 0 && (
                                <span className={styles.exMeta}>
                                    {meta.map((x, i) => <React.Fragment key={i}>{i ? ' · ' : ''}{x}</React.Fragment>)}
                                </span>
                            )}
                            <div className={styles.exChips}>
                                <span className={styles.exSrcChip}>{w.sources.join(' · ')}</span>
                                {badges.map((b) => <TipChip key={b.key} className={styles.exProvChip} label={b.label} tip={b.tip} />)}
                                {unfamiliar && (
                                    <TipChip className={styles.exAffChip} tip={KNOWN_AFFILIATION_TIP}
                                        label={<span className={styles.exAffText}>Unfamiliar affiliation{unfamiliar.length ? `: ${unfamiliar.join('; ')}` : ''}</span>} />
                                )}
                                {pmid
                                    ? <a className={styles.exPmidChip} href={`${pubMedUrl}${pmid}`} target="_blank" rel="noreferrer">PMID {pmid}</a>
                                    : <span className={styles.exNotPubmed}>Not in PubMed</span>}
                                <span className={styles.exPlainChip}>No authorship score</span>
                                {w.sources.length > 1 && (
                                    <span className={styles.exAlsoChip} title="Same DOI from another source. It counts once; accepting or removing it here applies to every source.">
                                        Found in {w.sources.length} sources · counted once
                                    </span>
                                )}
                                {r.articleId && <span className={styles.exId}>{r.articleId}</span>}
                                {doi && <a href={`${doiUrl}${doi}`} target="_blank" rel="noreferrer">DOI ↗</a>}
                            </div>
                        </div>
                        <div className={styles.exActions}>
                            {d ? (
                                <>
                                    <span className={styles.exDoneText} data-action={d.action}>{doneText(d)}</span>
                                    {d.action !== 'deleted' && (mysql ? !!d.recordIds : d.prev !== 'PENDING') && (
                                        <button type="button" className={styles.exUndo} onClick={() => undo(d)} disabled={isBusy}>Undo</button>
                                    )}
                                </>
                            ) : w.status === 'PENDING' ? (
                                <div className={styles.exBtns}>
                                    <Button size="sm" onClick={() => act(w, 'rejected')} disabled={isBusy}>Reject</Button>
                                    <Button size="sm" variant="primary" onClick={() => act(w, 'accepted')} disabled={isBusy}>Accept</Button>
                                </div>
                            ) : w.status === 'ACCEPTED' ? (
                                <>
                                    <div className={styles.exBtns}>
                                        <Button size="sm" onClick={() => act(w, 'removed')} disabled={isBusy}
                                            title={`Takes this work out of ${short}'s record. Reversible: it moves to Rejected.`}>Remove</Button>
                                    </div>
                                    {r.addedBy && <span className={styles.exBy}>Added by {r.addedBy}</span>}
                                </>
                            ) : mysql ? (
                                <>
                                    {w.rows.some((x) => storeTargetOf(x.status, 'accept')) && (
                                        <div className={styles.exBtns}>
                                            <Button size="sm" onClick={() => act(w, 'accepted')} disabled={isBusy}>Accept</Button>
                                        </div>
                                    )}
                                    <span className={styles.exBy}>{storeStatusText(w.lead)}</span>
                                </>
                            ) : (
                                <>
                                    <div className={styles.exBtns}>
                                        <Button size="sm" onClick={() => act(w, 'accepted')} disabled={isBusy}>Accept</Button>
                                    </div>
                                    <span className={styles.exBy}>
                                        {superseded ? `Superseded by PMID ${superseded}` : 'Rejected'}
                                        {' · '}
                                        <button type="button" className={styles.exUndo} onClick={() => setConfirmDelete(w)} disabled={isBusy}>Delete</button>
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                )
            })}

            <Dialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                title="Delete this record?"
                description={`Permanently deletes the ${confirmDelete ? confirmDelete.sources.join(' and ') : ''} record${confirmDelete && confirmDelete.rows.length > 1 ? 's' : ''} for this work. This can't be undone.`}
                footer={<>
                    <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
                    <Button variant="danger" onClick={() => { const w = confirmDelete; setConfirmDelete(null); if (w) act(w, 'deleted') }}>Delete</Button>
                </>}
            />
        </div>
    )
}

export default AllSourcesTab
