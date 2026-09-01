import React, { FunctionComponent, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { reciterConfig } from "../../../../config/local"
import ExternalPublicationCard, { AddState } from "./ExternalPublicationCard"
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper"

// PM#772 — Scopus Authorships tab. A high-level Scopus search (by Author ID, keyword,
// or DOI) surfacing documents not already in the person's record (matched by PMID, or,
// for a doc with no PMID of its own, by DOI / Scopus document ID against the person's
// record — see findRecordPmid in ReciterTabs.tsx). On open it resolves the person's
// Scopus Author ID from their name and runs the author-id search, but the curator can
// switch to a keyword or DOI search. Accept routing is handled by ExternalPublicationCard:
// a doc with a PMID (or one a DOI lookup finds in PubMed) is steered to the scored PubMed
// path; a Scopus-native doc is added as an ExternalArticle (method=scopus-authorships-tab).
// Reject = local dismissal, never GoldStandard.

interface FuncProps {
    personIdentifier: string,
    fullName: string,
    onAddViaPubMed: (pmid: number, item: any) => void,
    getPmidStatus: (pmid: number) => 'ACCEPTED' | 'REJECTED' | 'PENDING' | null,
    findRecordPmid: (doc: { doi?: string; articleId?: string }) => number | null,
}

const apiHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: reciterConfig.backendApiKey,
}

const wrap: React.CSSProperties = { padding: "8px 0 24px" }
const panel: React.CSSProperties = {
    display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
    background: "#f7f8fa", border: "1px solid #e3e8ef", borderRadius: 8, padding: "12px 14px", marginBottom: 16,
}
const selectStyle: React.CSSProperties = {
    height: 36, borderRadius: 6, border: "1px solid #cbd3e0", padding: "0 10px", fontSize: 13, background: "#fff", color: "#1f2733", maxWidth: "100%",
}
const inputStyle: React.CSSProperties = {
    flex: 1, minWidth: 200, height: 36, borderRadius: 6, border: "1px solid #cbd3e0", padding: "0 12px", fontSize: 13,
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
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#55607a" }
const noteStyle: React.CSSProperties = {
    fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a",
    borderRadius: 6, padding: "8px 10px", marginBottom: 10,
}
const summaryStyle: React.CSSProperties = { ...labelStyle, cursor: "pointer", padding: "6px 0" }

const PLACEHOLDER: Record<string, string> = {
    author: "Scopus Author ID (e.g. 12797673000)",
    keyword: "Title, abstract or keyword terms",
    doi: "10.xxxx/…",
}

function splitName(fullName: string) {
    const parts = (fullName || "").trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return { firstName: "", lastName: "" }
    return { firstName: parts[0], lastName: parts[parts.length - 1] }
}

const dismissKey = (uid: string) => `pm772_dismissed_${uid}`
function loadDismissed(uid: string): Set<string> {
    try { return new Set(JSON.parse(window.localStorage.getItem(dismissKey(uid)) || "[]")) } catch (e) { return new Set() }
}
function saveDismissed(uid: string, set: Set<string>) {
    try { window.localStorage.setItem(dismissKey(uid), JSON.stringify(Array.from(set))) } catch (e) { /* ignore */ }
}

const TabScopusAuthorships: FunctionComponent<FuncProps> = (props) => {
    const uid = props.personIdentifier

    const [resolving, setResolving] = useState<boolean>(true)
    const [candidates, setCandidates] = useState<any[]>([])
    const [searchBy, setSearchBy] = useState<string>("author")
    const [term, setTerm] = useState<string>("")

    const [loadingDocs, setLoadingDocs] = useState<boolean>(false)
    const [docs, setDocs] = useState<any[]>([])
    const [total, setTotal] = useState<number>(0)
    const [capped, setCapped] = useState<boolean>(false)
    const [partial, setPartial] = useState<boolean>(false)
    const [searched, setSearched] = useState<boolean>(false)
    const [addStates, setAddStates] = useState<Record<string, AddState>>({})
    const [dismissed, setDismissed] = useState<Set<string>>(new Set())
    // Non-suppressed ExternalArticle articleIds already on this person's record — a doc
    // added through this tab (or TabAddExternalPublication) minutes earlier has no PMID
    // to match on, so getPmidStatus alone can't recognise it; fetched the same way
    // SourceArticleTab.tsx:96-116 does. Suppressed (revoked) rows are deliberately left
    // OUT of this set: a curator removed them, so offering Add again is correct.
    const [externalIds, setExternalIds] = useState<Set<string>>(new Set())

    const setAddState = (articleId: string, next: AddState) => {
        setAddStates(prev => ({ ...prev, [articleId]: next }))
    }

    // Same fetch SourceArticleTab.tsx:96-116 uses. Run on tab open and again after every
    // search completes, so a doc added via this tab (or TabAddExternalPublication)
    // moments earlier is recognised even though it has no PMID of its own to match on.
    const fetchExternalIds = () => {
        if (!uid) return
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
                setExternalIds(new Set(rows.filter((row: any) => !row.suppressed).map((row: any) => row.articleId)))
            })
            .catch(() => setExternalIds(new Set())) // degrade to today's behaviour, never an error state
    }

    const runSearch = (byArg?: string, termArg?: string) => {
        const by = byArg || searchBy
        const t = (termArg !== undefined ? termArg : term).trim()
        if (!t) {
            toast.error("Enter a search term.", { position: "top-right", autoClose: 2000, theme: "colored" })
            return
        }
        setLoadingDocs(true); setSearched(true); setDocs([]); setTotal(0); setCapped(false); setPartial(false); setAddStates({})
        fetch(`/api/reciter/search/scopus`, {
            credentials: "same-origin", method: "POST", headers: apiHeaders,
            body: JSON.stringify({ mode: "documents", by, term: t }),
        })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}))
                if (!r.ok) throw new Error(r.status === 503
                    ? "Scopus is not configured on this server."
                    : (body && body.message) || `Scopus search failed (HTTP ${r.status})`)
                return body
            })
            .then((body) => {
                // A doc with no pubmed-id may still be the same paper as one already in the
                // person's record (same DOI, or same Scopus document ID) — enrich it with that
                // record's PMID so it partitions into inRecord below exactly like a PMID-bearing
                // doc, instead of always surfacing as "needs review".
                const results = Array.isArray(body.results) ? body.results : []
                setDocs(results.map((d: any) => d.pmid ? d : { ...d, pmid: props.findRecordPmid(d) ?? undefined }))
                setTotal(Number(body.total || 0))
                setCapped(!!body.capped)
                setPartial(!!body.partial)
                fetchExternalIds()
            })
            .catch((e) => toast.error((e && e.message) || "Scopus search failed.", { position: "top-right", autoClose: 3000, theme: "colored" }))
            .finally(() => setLoadingDocs(false))
    }

    // On open: resolve the person's Scopus Author ID from their name, then auto-run
    // the author-id search. Curator can switch to keyword / DOI afterwards.
    useEffect(() => {
        setDismissed(loadDismissed(uid))
        fetchExternalIds()
        const { firstName, lastName } = splitName(props.fullName)
        if (!lastName) { setResolving(false); return }
        setResolving(true)
        fetch(`/api/reciter/search/scopus`, {
            credentials: "same-origin", method: "POST", headers: apiHeaders,
            body: JSON.stringify({ mode: "authors", lastName, firstName }),
        })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}))
                if (!r.ok) throw new Error((body && body.message) || `HTTP ${r.status}`)
                return body
            })
            .then((body) => {
                const list = Array.isArray(body.authors) ? body.authors : []
                setCandidates(list)
                if (list.length) {
                    setSearchBy("author")
                    setTerm(list[0].authorId)
                    runSearch("author", list[0].authorId)
                }
            })
            .catch(() => { /* leave empty; manual search available */ })
            .finally(() => setResolving(false))
    }, [uid, props.fullName])

    const checkPubmedByDoi = async (doiVal: string): Promise<number | null> => {
        const r = await fetch(`/api/reciter/search/pubmed-by-doi`, {
            credentials: "same-origin", method: "POST", headers: apiHeaders,
            body: JSON.stringify({ doi: doiVal }),
        })
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error((body && body.message) || `HTTP ${r.status}`)
        return (body && body.pmid) != null ? Number(body.pmid) : null
    }

    // Accept a Scopus-native suggestion -> external-article POST. In-PubMed docs never
    // reach here: the card renders "Add via PubMed →" (onAddViaPubMed) for them.
    // ponytail: mirrors TabAddExternalPublication.doAdd; extract a shared hook if a
    // third source appears.
    const doAdd = async (item: any, force: boolean) => {
        if (!uid) { toast.error("Person is still loading — try again in a moment.", { position: "top-right", autoClose: 2500, theme: "colored" }); return }
        const articleId = item.articleId
        if (!force && !item.pmid && item.doi) {
            setAddState(articleId, { status: "checking" })
            try {
                const found = await checkPubmedByDoi(item.doi)
                if (found) { setAddState(articleId, { status: "inPubmed", pmid: found }); return }
            } catch (e) { /* fail-open */ }
        }
        setAddState(articleId, { status: "adding" })
        let url = `/api/reciter/external-article/${encodeURIComponent(uid)}`
        if (force) url += `?force=true`
        fetch(url, {
            credentials: "same-origin", method: "POST", headers: apiHeaders,
            body: JSON.stringify(item),
        })
            .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
            .then(({ status, body }) => {
                if (status === 201 || status === 200) {
                    setAddState(articleId, { status: "added" })
                    // Keep a re-search (no refetch of the ExternalArticle list) from
                    // re-offering this doc as addable.
                    setExternalIds((prev) => new Set(prev).add(articleId))
                    toast.success("Accepted as an external publication.", { position: "top-right", autoClose: 2000, theme: "colored" })
                    return
                }
                if (status === 409) {
                    const payload = (body && body.message) || {}
                    setAddState(articleId, { status: payload.status === "WARNING" ? "warning" : "blocked", message: payload.message, matches: payload.matches })
                    return
                }
                const payload = (body && body.message) || {}
                const msg = payload.message || (typeof payload === "string" ? payload : `HTTP ${status}`)
                setAddState(articleId, { status: "idle" })
                toast.error("Could not accept: " + msg, { position: "top-right", autoClose: 3000, theme: "colored" })
            })
            .catch((err) => {
                setAddState(articleId, { status: "idle" })
                toast.error("Could not accept: " + (err.message || err), { position: "top-right", autoClose: 3000, theme: "colored" })
            })
    }

    const doReject = (item: any) => {
        if (!uid) return
        const next = new Set(dismissed)
        next.add(item.articleId)
        setDismissed(next)
        saveDismissed(uid, next)
    }

    // Seed addState 'added' for any fetched doc that is already a non-suppressed
    // ExternalArticle on this person's record, so its card renders "Added ✓" with no
    // Add/Reject buttons instead of offering Add again (rharrington / SCOPUS:0028963338).
    // Runs whenever docs or externalIds change, independent of fetch ordering.
    useEffect(() => {
        if (externalIds.size === 0 || docs.length === 0) return
        setAddStates((prev) => {
            let changed = false
            const next = { ...prev }
            docs.forEach((d) => {
                if (externalIds.has(d.articleId) && next[d.articleId]?.status !== 'added') {
                    next[d.articleId] = { status: 'added' }
                    changed = true
                }
            })
            return changed ? next : prev
        })
    }, [docs, externalIds])

    // needsReview = fetched docs not dismissed and not already in the person's record —
    // by PMID (or, for docs enriched above, by DOI / Scopus document ID), or as a
    // non-suppressed ExternalArticle already on record (externalIds).
    const inExternalRecord = (d: any) => externalIds.has(d.articleId)
    const needsReview = docs.filter((d) => !dismissed.has(d.articleId) && !(d.pmid && props.getPmidStatus(d.pmid)) && !inExternalRecord(d))
    // inRecord = fetched, not dismissed, already in the person's record — collapsed below,
    // not part of the count that needs attention.
    const inRecord = docs.filter((d) => !dismissed.has(d.articleId) && ((d.pmid && props.getPmidStatus(d.pmid)) || inExternalRecord(d)))
    const dismissedCount = docs.filter((d) => dismissed.has(d.articleId)).length

    return (
        <div style={wrap}>
            <p style={helpText}>
                Search Scopus for documents attributed to this person. Accept a PubMed-indexed item to add it as
                scored evidence; accept a Scopus-only item to add it as an external publication. Reject to dismiss
                it (kept out of the feed, not written to the gold standard).
            </p>

            {/* High-level Scopus search: by Author ID, Keyword, or DOI */}
            <form style={panel} onSubmit={(e) => { e.preventDefault(); runSearch() }}>
                <span style={labelStyle}>Search Scopus by</span>
                <select
                    style={selectStyle}
                    value={searchBy}
                    onChange={(e) => {
                        const by = e.target.value
                        setSearchBy(by)
                        setTerm(by === "author" && candidates[0] ? candidates[0].authorId : "")
                    }}
                >
                    <option value="author">Author ID</option>
                    <option value="keyword">Keyword</option>
                    <option value="doi">DOI</option>
                </select>
                {searchBy === "author" && candidates.length > 1 && (
                    <select style={selectStyle} value={term} onChange={(e) => setTerm(e.target.value)}>
                        {candidates.map((c) => (
                            <option key={c.authorId} value={c.authorId}>
                                {c.surname}, {c.givenName} — AU-ID {c.authorId}{c.docCount ? ` · ${c.docCount} docs` : ""}
                            </option>
                        ))}
                    </select>
                )}
                <input
                    type="text"
                    style={inputStyle}
                    placeholder={PLACEHOLDER[searchBy]}
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                />
                <button type="submit" style={searchBtn} disabled={loadingDocs}>
                    {loadingDocs ? "Searching…" : "Search Scopus"}
                </button>
            </form>
            {resolving && <div style={emptyText}>Resolving Scopus author…</div>}

            {/* Results */}
            <div style={sectionLabel}>
                Scopus results{!loadingDocs && searched ? ` (${needsReview.length})` : ""}
            </div>
            {loadingDocs ? (
                <div style={emptyText}>Searching Scopus… large author profiles take a few seconds (up to 5 pages)</div>
            ) : !searched ? (
                <div style={emptyText}>Run a search to see Scopus documents.</div>
            ) : docs.length === 0 ? (
                <div style={emptyText}>No Scopus documents matched.</div>
            ) : (
                <>
                    {(capped || partial) && (
                        <div style={noteStyle}>
                            {partial
                                ? `Scopus stopped responding after ${docs.length} of ${total.toLocaleString()}; try again.`
                                : `Showing the first ${docs.length} of ${total.toLocaleString()} Scopus documents (newest first) — refine your search to see the rest.`}
                        </div>
                    )}
                    {needsReview.length === 0 ? (
                        <div style={emptyText}>
                            All {docs.length} fetched result(s) are already in the record or dismissed.
                        </div>
                    ) : (
                        needsReview.map((item) => (
                            <ExternalPublicationCard
                                key={item.articleId}
                                item={item}
                                mode="preview"
                                addState={addStates[item.articleId]}
                                onAdd={(it) => doAdd(it, false)}
                                onAddAnyway={(it) => doAdd(it, true)}
                                onAddViaPubMed={(pmid, it) => props.onAddViaPubMed(pmid, it)}
                                recordStatusOf={props.getPmidStatus}
                                onReject={(it) => doReject(it)}
                            />
                        ))
                    )}
                    {inRecord.length > 0 && (
                        <details>
                            <summary style={summaryStyle}>{inRecord.length} already in this person&apos;s record ▸</summary>
                            {inRecord.map((item) => (
                                <ExternalPublicationCard
                                    key={item.articleId}
                                    item={item}
                                    mode="preview"
                                    addState={addStates[item.articleId]}
                                    onAdd={(it) => doAdd(it, false)}
                                    onAddAnyway={(it) => doAdd(it, true)}
                                    onAddViaPubMed={(pmid, it) => props.onAddViaPubMed(pmid, it)}
                                    recordStatusOf={props.getPmidStatus}
                                    onReject={(it) => doReject(it)}
                                />
                            ))}
                        </details>
                    )}
                    {dismissedCount > 0 && (
                        <div style={emptyText}>{dismissedCount} result(s) dismissed this session.</div>
                    )}
                </>
            )}

            <ToastContainerWrapper />
        </div>
    )
}

export default TabScopusAuthorships
