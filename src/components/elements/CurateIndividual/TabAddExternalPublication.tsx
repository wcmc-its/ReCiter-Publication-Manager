import React, { FunctionComponent, useCallback, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { reciterConfig } from "../../../../config/local"
import ExternalPublicationCard, { AddState } from "./ExternalPublicationCard"
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper"

// PM#771 — add publications from an external source (OpenAlex in v1) to a person's
// record. Self-contained (AAR-tab precedent): local state + fetch, no redux. OpenAlex
// search is proxied server-side; adds go through the ReCiter external-article API
// (admin-key proxied) which enforces the BLOCKED (no override) / WARNING (Add anyway)
// duplicate rules. Added pubs are listed here, visually separate from scored PubMed
// suggestions, with a Delete (= revoke) affordance.

interface FuncProps {
    personIdentifier: string,
    // Steer an in-PubMed work to the scored PubMed add path (switches to the PubMed tab).
    onAddViaPubMed: (pmid: number, item: any) => void,
    // Current status of a PMID in this person's record, to annotate search results.
    getPmidStatus: (pmid: number) => 'ACCEPTED' | 'REJECTED' | 'PENDING' | null,
    // Signed-in curator's CWID, from useSession(). Gates the Delete button to the row's
    // own adder (item.addedBy) on ExternalPublicationCard.
    viewerCwid?: string,
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

const TabAddExternalPublication: FunctionComponent<FuncProps> = (props) => {
    const uid = props.personIdentifier

    const source = "OPENALEX" // v1: OpenAlex only. Scopus/WoS join the tab-bar Add menu later.
    const [query, setQuery] = useState<string>("")
    const [searching, setSearching] = useState<boolean>(false)
    const [results, setResults] = useState<any[]>([])
    const [addStates, setAddStates] = useState<Record<string, AddState>>({})

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

    const runSearch = (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        const q = query.trim()
        if (!q) {
            toast.error("Enter a title or DOI to search.", { position: "top-right", autoClose: 2000, theme: "colored" })
            return
        }
        setSearching(true)
        setResults([])
        setAddStates({})
        fetch(`/api/reciter/search/openalex`, {
            credentials: "same-origin", method: "POST", headers: apiHeaders,
            body: JSON.stringify({ query: q, source }),
        })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}))
                if (!r.ok) throw new Error((body && body.message && body.message.message) || (body && body.message) || `HTTP ${r.status}`)
                return body
            })
            .then((body) => {
                const rows = Array.isArray(body.results) ? body.results : []
                setResults(rows)
                if (rows.length === 0) {
                    toast.info("No results found in OpenAlex.", { position: "top-right", autoClose: 2000 })
                }
            })
            .catch((err) => {
                toast.error("OpenAlex search failed: " + (err.message || err), { position: "top-right", autoClose: 3000, theme: "colored" })
            })
            .finally(() => setSearching(false))
    }

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
                Add a publication from an external source when it is not indexed in PubMed. External
                publications are not scored by ReCiter and are listed separately below.
            </p>

            {/* Search OpenAlex (source is chosen from the tab-bar "+ Add publication" menu) */}
            <form style={searchPanel} onSubmit={runSearch}>
                <input
                    type="text"
                    style={inputStyle}
                    placeholder="Search by title or DOI…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" style={searchBtn} disabled={searching}>
                    {searching ? "Searching…" : "Search OpenAlex"}
                </button>
            </form>

            {/* Search results */}
            {(searching || results.length > 0) && (
                <>
                    <div style={sectionLabel}>Search results</div>
                    {searching ? (
                        <div style={emptyText}>Searching OpenAlex…</div>
                    ) : (
                        results.map((item) => (
                            <ExternalPublicationCard
                                key={item.articleId}
                                item={item}
                                mode="preview"
                                addState={addStates[item.articleId]}
                                onAdd={(it) => doAdd(it, false)}
                                onAddAnyway={(it) => doAdd(it, true)}
                                onAddViaPubMed={(pmid, it) => props.onAddViaPubMed(pmid, it)}
                                recordStatusOf={props.getPmidStatus}
                            />
                        ))
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
