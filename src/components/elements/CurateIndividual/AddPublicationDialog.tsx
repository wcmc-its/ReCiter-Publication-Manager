import React, { FunctionComponent, useState } from "react"
import styles from "./CurateIndividual.module.css"
import { Button, Dialog } from "../../ui"
import TabAddExternalPublication from "./TabAddExternalPublication"
import { AddDialogSource, AddSource, routeAddQuery } from "../../../utils/externalAddSearch"

// Phase 3a — one Add publication dialog in place of the Add publication dropdown. The curator
// picks a source and searches; the query is routed (routeAddQuery):
//   - a PMID, or any PubMed search, goes to the scored PubMed flow (the PubMed add view under
//     the tabs, searched with this query and year range), and the dialog closes;
//   - a DOI or other query for Scopus / OpenAlex / Crossref runs the existing external add
//     search (#1060–#1062) inside the dialog, with its add, "Add anyway" and "Add via PubMed".
// Layout follows the UI refresh prototype's Add publication dialog.

export type AddDialogInitial = { query?: string, source?: AddSource, autoSearch?: boolean, invalidDoi?: boolean }

interface FuncProps {
    open: boolean,
    onClose: () => void,
    fullName: string,
    personIdentifier: string,
    initial?: AddDialogInitial | null,
    onPubMedSearch: (query: string, from: string, to: string) => void,
    onAddViaPubMed: (pmid: number, item: any) => void,
    onAcceptPmid: (pmid: number, item: any) => Promise<any>,
    getPmidStatus: (pmid: number) => 'ACCEPTED' | 'REJECTED' | 'PENDING' | null,
    findRecordPmid: (doc: { doi?: string; articleId?: string }) => number | null,
    onOpenScopusAuthorships: () => void,
}

const SOURCES: [AddDialogSource, string][] = [['PUBMED', 'PubMed'], ['SCOPUS', 'Scopus'], ['OPENALEX', 'OpenAlex'], ['CROSSREF', 'Crossref']]
const NAME: Record<AddDialogSource, string> = { PUBMED: 'PubMed', SCOPUS: 'Scopus', OPENALEX: 'OpenAlex', CROSSREF: 'Crossref' }
const YEAR = /^\d{4}$/

const AddPublicationDialog: FunctionComponent<FuncProps> = (props) => {
    const { initial } = props
    const [src, setSrc] = useState<AddDialogSource>(initial?.source || (initial?.query ? 'SCOPUS' : 'PUBMED'))
    const [query, setQuery] = useState(initial?.query || '')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [note, setNote] = useState(initial?.invalidDoi ? "The link's DOI was not recognised, so nothing was searched. Enter a title or DOI." : '')
    // The external search shown in the dialog; the nonce remounts it so each search runs fresh.
    const [run, setRun] = useState<{ source: AddSource, query: string, nonce: number } | null>(
        initial?.autoSearch && initial.query ? { source: initial.source || 'SCOPUS', query: initial.query, nonce: 0 } : null,
    )

    const reset = () => { setQuery(''); setFrom(''); setTo(''); setNote(''); setRun(null) }

    const search = (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        setNote('')
        const route = routeAddQuery(query, src)
        if (!route) {
            if (src === 'PUBMED' && (from || to)) {
                // Year range alone is a valid PubMed search, as in the PubMed add view.
            } else {
                setNote(src === 'PUBMED' ? 'Enter an author, title words or a PMID.' : 'Enter a title, DOI or ISBN.')
                return
            }
        }
        if (!route || route.kind === 'pubmed') {
            if ((from && !YEAR.test(from)) || (to && !YEAR.test(to))) { setNote('Years are four digits, e.g. 2019.'); return }
            if (from && to && from > to) { setNote('The From year is after the To year.'); return }
            props.onPubMedSearch(route ? route.query : '', from, to)
            return
        }
        if (route.source !== src) setSrc(route.source)
        if (src === 'PUBMED') setNote(`PubMed isn't searched by DOI or ISBN here, so ${NAME[route.source]} was searched.`)
        setRun((prev) => ({ source: route.source, query: route.query, nonce: (prev?.nonce || 0) + 1 }))
    }

    const srcNote = src === 'PUBMED'
        ? 'Search PubMed by author, title, or PMID. Results are scored by ReCiter.'
        : `For articles not in PubMed. Search ${NAME[src]} by keyword, DOI or ISBN.${src === 'SCOPUS' ? ' A DOI Scopus does not hold is tried in OpenAlex, then Crossref.' : src === 'OPENALEX' ? ' A DOI OpenAlex does not hold is tried in Crossref.' : ''}`
    const placeholder = src === 'PUBMED' ? 'Author (Bales M), title words, or PMID' : 'Keyword, DOI (10.xxxx/…) or ISBN'

    return (
        <Dialog
            open={props.open}
            onClose={props.onClose}
            width={780}
            title="Add publication"
            description={`for ${props.fullName || props.personIdentifier} · added articles are saved as accepted`}
            footer={<Button onClick={props.onClose}>Done</Button>}
        >
            <div className={styles.apRow}>
                <div role="radiogroup" aria-label="Source" className={styles.viewSeg}>
                    {SOURCES.map(([k, label]) => (
                        <button key={k} type="button" role="radio" aria-checked={src === k}
                            onClick={() => { setSrc(k); setRun(null); setNote('') }}>{label}</button>
                    ))}
                </div>
                <span className={styles.apNote}>{srcNote}</span>
            </div>
            <form className={styles.apSearch} onSubmit={search}>
                <input
                    className={styles.apInput}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                    aria-label="Search query"
                    autoFocus
                />
                {src === 'PUBMED' && (
                    <>
                        <label className={styles.apYear}>From<input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Year" inputMode="numeric" /></label>
                        <label className={styles.apYear}>To<input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Year" inputMode="numeric" /></label>
                    </>
                )}
                <Button type="submit" variant="primary">Search {NAME[src]}</Button>
                <Button type="button" variant="ghost" onClick={reset}>Reset</Button>
            </form>
            {src === 'SCOPUS' && (
                <div className={styles.apHint}>
                    Know the person&apos;s Scopus Author ID?{' '}
                    <button type="button" className={styles.exLink} onClick={props.onOpenScopusAuthorships}>Search Scopus by Author ID →</button>
                </div>
            )}
            {note && <div className={styles.apWarn} role="status">{note}</div>}
            {run && (
                <div className={styles.apResults}>
                    <TabAddExternalPublication
                        key={run.nonce}
                        embedded
                        personIdentifier={props.personIdentifier}
                        onAddViaPubMed={props.onAddViaPubMed}
                        onAcceptPmid={props.onAcceptPmid}
                        getPmidStatus={props.getPmidStatus}
                        findRecordPmid={props.findRecordPmid}
                        initialQuery={run.query}
                        initialSource={run.source}
                        autoSearch
                    />
                </div>
            )}
        </Dialog>
    )
}

export default AddPublicationDialog
