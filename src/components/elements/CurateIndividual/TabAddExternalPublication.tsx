import React, { FunctionComponent, useCallback, useEffect, useRef, useState } from "react"
import { toast } from "react-toastify"
import { reciterConfig } from "../../../../config/local"
import ExternalPublicationCard, { AddState } from "./ExternalPublicationCard"
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper"
import {
    AddSource, decideScopusOutcome, enrichScopusResults, scopusSearchFor, seedAddedStates,
} from "../../../utils/externalAddSearch"

// PM#771 — add publications from an external source (Scopus by default, or OpenAlex) to a person's
// record. Self-contained (AAR-tab precedent): local state + fetch, no redux. OpenAlex
// search is proxied server-side; adds go through the ReCiter external-article API
// (admin-key proxied) which enforces the BLOCKED (no override) / WARNING (Add anyway)
// duplicate rules. Added pubs are listed here, visually separate from scored PubMed
// suggestions, with a Delete (= revoke) affordance.
//
// Scopus is the default source (curated author lists and affiliations). Its search is the
// Scopus Authorships tab's document search (/api/reciter/search/scopus, by DOI when the query
// is a DOI, else by keyword) with the same result mapping, so a Scopus doc added here is the
// same POST body that tab sends. A DOI Scopus does not hold, or a Scopus outage (502/503),
// falls back to OpenAlex with an inline note. Search messages are inline text, not toasts:
// toast.* is a no-op in PM (the toast container never mounts).

interface FuncProps {
    personIdentifier: string,
    // Steer an in-PubMed work to the scored PubMed add path (switches to the PubMed tab).
    onAddViaPubMed: (pmid: number, item: any) => void,
    // Accept a PMID for this person without leaving the tab — a real gold-standard write, the
    // same one the PubMed Add tab makes. Required, not optional: the card renders its primary
    // "Add" button off pubmedPmid alone, so a tab that omits this ships a dead button.
    onAcceptPmid: (pmid: number, item: any) => Promise<any>,
    // Current status of a PMID in this person's record, to annotate search results.
    getPmidStatus: (pmid: number) => 'ACCEPTED' | 'REJECTED' | 'PENDING' | null,
    // Signed-in curator's CWID, from useSession(). Gates the Delete button to the row's
    // own adder (item.addedBy) on ExternalPublicationCard.
    viewerCwid?: string,
    // Match a PMID-less search result to an article already in this person's record by DOI
    // or Scopus document ID (ReciterTabs.findRecordPmid) — the Scopus tab's result mapping.
    findRecordPmid: (doc: { doi?: string; articleId?: string }) => number | null,
    // Deep link (/curate/<uid>?add=external&doi=<doi>[&source=openalex]); read on mount only.
    initialQuery?: string,
    initialSource?: AddSource,
    autoSearch?: boolean,
    // The link carried a doi parameter that is not a DOI. Its value is never passed down.
    deepLinkInvalidDoi?: boolean,
}

const apiHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: reciterConfig.backendApiKey,
}

const wrap: React.CSSProperties = { padding: "8px 0 24px" }
const searchPanel: React.CSSProperties = {
    display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
    background: "#f7f8fa", border: "1px solid #e3e8ef", borderRadius: 8, padding: "12px 14px", marginBottom: 16,
}
const inputStyle: React.CSSProperties = {
    flex: 1, minWidth: 220, height: 36, borderRadius: 6, border: "1px solid #cbd3e0", padding: "0 12px", fontSize: 13,
}
const searchBtn: React.CSSProperties = {
    height: 36, border: "none", background: "#1f4e79", color: "#fff", fontSize: 13, fontWeight: 600,
    padding: "0 18px", borderRadius: 6, cursor: "pointer",
}
const sectionLabel: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
    color: "#8a94a6", margin: "18px 0 8px",
}
const helpText: React.CSSProperties = { fontSize: 12.5, color: "#8a94a6", marginBottom: 8 }
const emptyText: React.CSSProperties = { fontSize: 13, color: "#8a94a6", padding: "8px 0" }
const selectStyle: React.CSSProperties = {
    height: 36, borderRadius: 6, border: "1px solid #cbd3e0", padding: "0 10px", fontSize: 13, background: "#fff", color: "#1f2733",
}
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#55607a" }
const noteStyle: React.CSSProperties = {
    fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a",
    borderRadius: 6, padding: "8px 10px", marginBottom: 10,
}
const errorStyle: React.CSSProperties = {
    fontSize: 12.5, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca",
    borderRadius: 6, padding: "8px 10px", marginBottom: 10,
}

const SOURCE_NAME: Record<AddSource, string> = { SCOPUS: "Scopus", OPENALEX: "OpenAlex" }

const TabAddExternalPublication: FunctionComponent<FuncProps> = (props) => {
    const uid = props.personIdentifier

    const [source, setSource] = useState<AddSource>(props.initialSource || "SCOPUS")
    const [query, setQuery] = useState<string>(props.initialQuery || "")
    const [searching, setSearching] = useState<boolean>(false)
    // The source being searched right now / the source the shown results came from — they
    // differ from `source` after a fallback to OpenAlex.
    const [searchingSource, setSearchingSource] = useState<AddSource>(source)
    const [resultSource, setResultSource] = useState<AddSource | null>(null)
    const [searched, setSearched] = useState<boolean>(false)
    const [results, setResults] = useState<any[]>([])
    const [scopusTotal, setScopusTotal] = useState<number>(0)
    const [addStates, setAddStates] = useState<Record<string, AddState>>({})
    const [note, setNote] = useState<string>("")
    const [errorMsg, setErrorMsg] = useState<string>("")
    // Only the latest search may write results: a slow Scopus answer must not overwrite a
    // newer search the curator has since run.
    const searchSeq = useRef(0)

    const [externalList, setExternalList] = useState<any[]>([])
    const [loadingList, setLoadingList] = useState<boolean>(false)

    const setAddState = (articleId: string, next: AddState) => {
        setAddStates(prev => ({ ...prev, [articleId]: next }))
    }

    const fetchExternalList = useCallback(() => {
        if (!uid) return
        setLoadingList(true)
        fetch(`/api/reciter/external-article/${encodeURIComponent(uid)}`, {
            credentials: "same-origin", method: "GET", headers: apiHeaders,
        })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}))
                if (!r.ok) throw new Error((body && body.message) || `HTTP ${r.status}`)
                return body
            })
            .then((body) => {
                const rows = Array.isArray(body.external) ? body.external : []
                setExternalList(rows)
            })
            .catch(() => {
                setExternalList([])
            })
            .finally(() => setLoadingList(false))
    }, [uid])

    useEffect(() => {
        fetchExternalList()
    }, [fetchExternalList])

    const searchOpenAlex = (q: string, seq: number): Promise<void> => {
        setSearchingSource("OPENALEX")
        return fetch(`/api/reciter/search/openalex`, {
            credentials: "same-origin", method: "POST", headers: apiHeaders,
            body: JSON.stringify({ query: q, source: "OPENALEX" }),
        })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}))
                if (!r.ok) throw new Error((body && body.message && body.message.message) || (body && body.message) || `HTTP ${r.status}`)
                return body
            })
            .then((body) => {
                if (seq !== searchSeq.current) return
                setResults(Array.isArray(body.results) ? body.results : [])
                setResultSource("OPENALEX")
            })
            .catch((err) => {
                if (seq !== searchSeq.current) return
                setErrorMsg("OpenAlex search failed: " + (err.message || err))
            })
    }

    const searchScopus = async (q: string, seq: number): Promise<void> => {
        setSearchingSource("SCOPUS")
        const { by, term } = scopusSearchFor(q)
        let status = 0
        let body: any = {}
        try {
            const r = await fetch(`/api/reciter/search/scopus`, {
                credentials: "same-origin", method: "POST", headers: apiHeaders,
                body: JSON.stringify({ mode: "documents", by, term }),
            })
            status = r.status
            body = await r.json().catch(() => ({}))
        } catch (e) { status = 0 } // network failure: treated like a Scopus outage
        if (seq !== searchSeq.current) return
        const found = status >= 200 && status < 300 && Array.isArray(body.results) ? body.results : []
        const outcome = decideScopusOutcome({ status, resultCount: found.length, by })
        if (outcome.kind === "results" || outcome.kind === "empty") {
            setResults(enrichScopusResults(found, props.findRecordPmid))
            setScopusTotal(Number(body.total || 0))
            setResultSource("SCOPUS")
        } else if (outcome.kind === "fallback") {
            setNote(outcome.note)
            await searchOpenAlex(q, seq)
        } else {
            setErrorMsg(outcome.message)
        }
    }

    const runSearch = (e?: React.FormEvent, queryArg?: string, sourceArg?: AddSource) => {
        if (e) e.preventDefault()
        const q = (queryArg !== undefined ? queryArg : query).trim()
        const src = sourceArg || source
        setNote("")
        setErrorMsg("")
        if (!q) {
            setErrorMsg("Enter a title or DOI to search.")
            return
        }
        const seq = ++searchSeq.current
        setSearching(true)
        setSearched(true)
        setResults([])
        setResultSource(null)
        setScopusTotal(0)
        setAddStates({})
        const run = src === "SCOPUS" ? searchScopus(q, seq) : searchOpenAlex(q, seq)
        run.finally(() => { if (seq === searchSeq.current) setSearching(false) })
    }

    // Deep link: fill the query and run the search once, on open.
    useEffect(() => {
        if (props.autoSearch && props.initialQuery) runSearch(undefined, props.initialQuery, props.initialSource || "SCOPUS")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Already added: a result that is already a non-suppressed ExternalArticle on this record
    // shows "Added" instead of offering Add again (same rule as the Scopus tab).
    useEffect(() => {
        const ids = new Set<string>(externalList.filter((row) => !row.suppressed).map((row) => row.articleId))
        setAddStates((prev) => seedAddedStates(prev, results, ids))
    }, [results, externalList])

    // Ask PubMed whether a DOI is indexed there (returns the PMID, or null).
    const checkPubmedByDoi = async (doiVal: string): Promise<number | null> => {
        const r = await fetch(`/api/reciter/search/pubmed-by-doi`, {
            credentials: "same-origin", method: "POST", headers: apiHeaders,
            body: JSON.stringify({ doi: doiVal }),
        })
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error((body && body.message) || `HTTP ${r.status}`)
        return (body && body.pmid) != null ? Number(body.pmid) : null
    }

    // Direct-accept: the card's primary "Add" for an in-PubMed work. Mirrors
    // TabScopusAuthorships.doAcceptPmid on the shared addStates map. Before this existed the
    // button rendered here and silently did nothing, because the tab passed no onAcceptPmid.
    const doAcceptPmid = (pmid: number, item: any) => {
        const articleId = item.articleId
        setAddState(articleId, { status: "adding" })
        return props.onAcceptPmid(pmid, item)
            .then(() => { setAddState(articleId, { status: "accepted" }) })
            .catch((err: any) => {
                setAddState(articleId, { status: "idle" })
                toast.error("Could not accept: " + (err.message || err), { position: "top-right", autoClose: 3000, theme: "colored" })
            })
    }

    const doAdd = async (item: any, force: boolean) => {
        if (!uid) { toast.error("Person is still loading — try again in a moment.", { position: "top-right", autoClose: 2500, theme: "colored" }); return }
        const articleId = item.articleId
        // If the work is in PubMed, steer to the scored PubMed path instead of adding an
        // unscored external record. OpenAlex's PMID is best-effort, so for no-PMID results
        // we confirm by DOI. Fail-open: a lookup error still allows the external add.
        if (!force && !item.pmid && item.doi) {
            setAddState(articleId, { status: "checking" })
            try {
                const found = await checkPubmedByDoi(item.doi)
                if (found) {
                    setAddState(articleId, { status: "inPubmed", pmid: found })
                    return
                }
            } catch (e) { /* fail-open: fall through to the external add */ }
        }
        setAddState(articleId, { status: "adding" })
        let url = `/api/reciter/external-article/${encodeURIComponent(uid)}`
        if (force) url += `?force=true`
        fetch(url, {
            credentials: "same-origin", method: "POST", headers: apiHeaders,
            body: JSON.stringify(item),
        })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}))
                return { status: r.status, body }
            })
            .then(({ status, body }) => {
                if (status === 201 || status === 200) {
                    setAddState(articleId, { status: "added" })
                    toast.success("Publication added.", { position: "top-right", autoClose: 2000, theme: "colored" })
                    fetchExternalList()
                    return
                }
                if (status === 409) {
                    // body.message = { status: BLOCKED|WARNING, message, matches }
                    const payload = (body && body.message) || {}
                    const kind = payload.status
                    if (kind === "WARNING") {
                        setAddState(articleId, { status: "warning", message: payload.message, matches: payload.matches })
                    } else {
                        setAddState(articleId, { status: "blocked", message: payload.message, matches: payload.matches })
                    }
                    return
                }
                // 400 INVALID / 404 / other
                const payload = (body && body.message) || {}
                const msg = payload.message || (typeof payload === "string" ? payload : `HTTP ${status}`)
                setAddState(articleId, { status: "idle" })
                toast.error("Could not add: " + msg, { position: "top-right", autoClose: 3000, theme: "colored" })
            })
            .catch((err) => {
                setAddState(articleId, { status: "idle" })
                toast.error("Could not add: " + (err.message || err), { position: "top-right", autoClose: 3000, theme: "colored" })
            })
    }

    const doDelete = (articleId: string) => {
        fetch(`/api/reciter/external-article/${encodeURIComponent(uid)}?articleId=${encodeURIComponent(articleId)}`, {
            credentials: "same-origin", method: "DELETE", headers: apiHeaders,
        })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}))
                if (!r.ok) throw new Error((body && body.message) || `HTTP ${r.status}`)
                return body
            })
            .then(() => {
                toast.success("Publication removed.", { position: "top-right", autoClose: 2000, theme: "colored" })
                fetchExternalList()
            })
            .catch((err) => {
                toast.error("Could not remove: " + (err.message || err), { position: "top-right", autoClose: 3000, theme: "colored" })
            })
    }

    // Suppressed rows (superseded by a PubMed record) are hidden by default.
    const visibleExternal = externalList.filter((row) => !row.suppressed)

    return (
        <div style={wrap}>
            <p style={helpText}>
                Add a publication from an external source when it is not indexed in PubMed. Scopus is searched
                first; a DOI Scopus does not have is looked up in OpenAlex. External publications are not scored
                by ReCiter and are listed separately below.
            </p>

            {props.deepLinkInvalidDoi && (
                <div style={noteStyle} role="status">
                    The link&apos;s DOI was not recognised, so nothing was searched. Enter a title or DOI below.
                </div>
            )}

            <form style={searchPanel} onSubmit={runSearch}>
                <span style={labelStyle}>Search</span>
                <select
                    style={selectStyle}
                    value={source}
                    onChange={(e) => setSource(e.target.value as AddSource)}
                    aria-label="Search source"
                >
                    <option value="SCOPUS">Scopus</option>
                    <option value="OPENALEX">OpenAlex</option>
                </select>
                <input
                    type="text"
                    style={inputStyle}
                    placeholder="Search by title or DOI…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" style={searchBtn} disabled={searching}>
                    {searching ? "Searching…" : `Search ${SOURCE_NAME[source]}`}
                </button>
            </form>

            {errorMsg && <div style={errorStyle} role="alert">{errorMsg}</div>}
            {note && <div style={noteStyle} role="status">{note}</div>}

            {/* Search results */}
            {(searching || searched) && !errorMsg && (
                <>
                    <div style={sectionLabel}>
                        Search results{!searching && resultSource ? ` from ${SOURCE_NAME[resultSource]}` : ""}
                    </div>
                    {searching ? (
                        <div style={emptyText}>Searching {SOURCE_NAME[searchingSource]}…</div>
                    ) : results.length === 0 ? (
                        <div style={emptyText}>
                            {resultSource ? `No results found in ${SOURCE_NAME[resultSource]}.` : "No results."}
                        </div>
                    ) : (
                        <>
                        {resultSource === "SCOPUS" && scopusTotal > results.length && (
                            <div style={noteStyle}>
                                Showing the first {results.length} of {scopusTotal.toLocaleString()} Scopus documents — refine your search to see the rest.
                            </div>
                        )}
                        {results.map((item) => (
                            <ExternalPublicationCard
                                key={item.articleId}
                                item={item}
                                mode="preview"
                                addState={addStates[item.articleId]}
                                onAdd={(it) => doAdd(it, false)}
                                onAddAnyway={(it) => doAdd(it, true)}
                                onAcceptPmid={(pmid, it) => doAcceptPmid(pmid, it)}
                                onAddViaPubMed={(pmid, it) => props.onAddViaPubMed(pmid, it)}
                                recordStatusOf={props.getPmidStatus}
                            />
                        ))}
                        </>
                    )}
                </>
            )}

            {/* Already-added external publications */}
            <div style={sectionLabel}>External publications on this record</div>
            {loadingList ? (
                <div style={emptyText}>Loading…</div>
            ) : visibleExternal.length === 0 ? (
                <div style={emptyText}>No external publications have been added.</div>
            ) : (
                visibleExternal.map((row) => (
                    <ExternalPublicationCard
                        key={row.articleId}
                        item={row}
                        mode="list"
                        onDelete={doDelete}
                        viewerCwid={props.viewerCwid}
                    />
                ))
            )}

            <ToastContainerWrapper />
        </div>
    )
}

export default TabAddExternalPublication
