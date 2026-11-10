import React, { FunctionComponent, useMemo, useState } from "react"
import styles from "./CurateIndividual.module.css"
import { Button, Dialog } from "../../ui"
import { ExternalArticles } from "./useExternalArticles"
import {
    EXT_SOURCE_NAMES, ExtSourceName, ExtStatus, ExtWork, countWorks, extStatusOf, groupExternalWorks,
    workHasSource, workMatches,
} from "../../../utils/allSources"

// Phase 3a — Curate's single "All sources" tab (replaces the Scopus / OpenAlex / Crossref tabs).
// One row per work across sources (grouped by DOI), a status switch and a source switch, and
// rows acted on this session stay in place with Undo. Reads and writes are the ones the
// per-source tabs made (useExternalArticles): reversible accept / reject via the feedback route,
// and a permanent delete. Layout follows the UI refresh prototype's External tab body.

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

const STATUS_OPTS: [ExtStatus, string][] = [['PENDING', 'Pending'], ['ACCEPTED', 'Accepted'], ['REJECTED', 'Rejected']]

const AllSourcesTab: FunctionComponent<FuncProps> = ({ ext, fullName, onOpenScopusAuthorships }) => {
    const nameParts = (fullName || '').trim().split(/\s+/).filter(Boolean)
    const short = nameParts[0] || 'this person'
    const surname = (nameParts[nameParts.length - 1] || '').replace(/[.,]/g, '')

    const works = useMemo(() => groupExternalWorks(ext.rows), [ext.rows])
    const n = countWorks(works)
    const [viewPicked, setViewPicked] = useState<ExtStatus | null>(null)
    const view: ExtStatus = viewPicked || (n.PENDING ? 'PENDING' : 'ACCEPTED')
    const [src, setSrc] = useState<ExtSourceName | 'all'>('all')
    const [q, setQ] = useState('')
    const [here, setHere] = useState<Record<string, Done>>({})
    const [busy, setBusy] = useState<Record<string, boolean>>({})
    const [confirmDelete, setConfirmDelete] = useState<ExtWork | null>(null)

    const pickView = (v: ExtStatus) => { setViewPicked(v); setHere({}) }

    // A work belongs in the view by its status, or because it was acted on in this view.
    const inView = (w: ExtWork) => (here[w.key] ? here[w.key].view === view : w.status === view)
    const live = works.filter(inView)
    const gone = Object.values(here).filter((d) => d.view === view && !works.some((w) => w.key === d.work.key)).map((d) => d.work)
    const pool = [...live, ...gone]
    const shown = pool.filter((w) => workHasSource(w, src) && workMatches(w, q))
    const multi = pool.filter((w) => w.sources.length > 1).length
    const srcOpts = (['all', ...EXT_SOURCE_NAMES] as (ExtSourceName | 'all')[])
        .filter((k) => k !== 'Manual' || works.some((w) => w.sources.includes('Manual')))

    const act = (w: ExtWork, action: Done['action']) => {
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
        : 'Accepted articles from Scopus, OpenAlex and Crossref. No PMID, so no score and not part of the gold standard. A work found in several sources shows once, with each source.'
    const emptyTitle = view === 'PENDING' && !q ? 'Nothing waiting for review' : view === 'REJECTED' && !q ? 'No rejected works'
        : works.length ? 'No matches' : 'No external articles yet'
    const emptyBody = works.length ? 'No external articles match this filter.'
        : `When a Scopus, OpenAlex or Crossref work for ${short} is accepted in Authorships or added here, it shows up here.`

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
                                    {d.action !== 'deleted' && d.prev !== 'PENDING' && (
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
