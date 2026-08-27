import React, { FunctionComponent, useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "react-toastify"
import { reciterConfig } from "../../../../config/local"
import ExternalPublicationCard from "./ExternalPublicationCard"
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper"

// Curate per-source tabs (Option C), Phase 1. Browses the external (non-PubMed) rows
// already on this person's record for ONE source, with an Accepted/Rejected segmented
// filter and reversible Reject / Accept (un-reject) actions against the live Java
// PATCH /reciter/external-article/feedback. Filtering is client-side over the same list
// TabAddExternalPublication already fetches — no new list endpoint.
//
// Distinct from TabAddExternalPublication (the search + add flow, still reachable from
// the "+ Add publication" menu) and from TabScopusAuthorships / the "ScopusAuth" tab
// (the AAR authorship-suggestion queue — a different data source entirely; do not
// conflate the two "Scopus" surfaces).

export type SourceKind = 'SCOPUS' | 'OPENALEX' | 'MANUAL'

interface FuncProps {
    uid: string,
    source: SourceKind,
    // Signed-in curator's CWID (from ReciterTabs' useSession()), threaded down to gate
    // ExternalPublicationCard's Delete button to the row's own adder.
    viewerCwid?: string,
}

const apiHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: reciterConfig.backendApiKey,
}

const wrap: React.CSSProperties = { padding: "8px 0 24px" }
const segmentBar: React.CSSProperties = { display: "flex", gap: 8, marginBottom: 14 }
const segmentBtn: React.CSSProperties = {
    border: "1px solid #cbd3e0", background: "#fff", color: "#55607a", fontSize: 12.5,
    fontWeight: 600, padding: "6px 14px", borderRadius: 999, cursor: "pointer",
}
const segmentBtnActive: React.CSSProperties = { ...segmentBtn, background: "#1f4e79", borderColor: "#1f4e79", color: "#fff" }
const emptyText: React.CSSProperties = { fontSize: 13, color: "#8a94a6", padding: "8px 0" }

// No sourceType === 'MANUAL' row exists in prod yet — every current add flow (OpenAlex
// search, Scopus search) stamps a real sourceType. "Manual" is therefore the catch-all
// for anything that ISN'T a recognized API-search source, so it also future-proofs
// WoS/WorldCat/typed-in adds that would otherwise have no tab at all.
// ponytail: revisit this split once a real manual-entry (no-sourceType) add path ships.
const matchesSource = (row: any, source: SourceKind): boolean => {
    const st = row.sourceType || ''
    if (source === 'SCOPUS') return st === 'SCOPUS'
    if (source === 'OPENALEX') return st === 'OPENALEX'
    return st !== 'SCOPUS' && st !== 'OPENALEX'
}

// AAR-accepted Scopus rows use articleId "SCOPUS:<numeric external_id>" (see
// scopusExternalPayload in controllers/db/authorships.controller.ts). Rows accepted
// before that function started sending `authors` (commit 4b4c1cbb) carry no authors key
// at all on their ExternalArticle payload — this tab backfills a display byline for those
// via the batched /api/db/authorships/authors lookup below, keyed by this numeric id.
const SCOPUS_NUMERIC_ID = /^SCOPUS:(\d+)$/

const hasAuthors = (row: any): boolean => (
    (Array.isArray(row.authors) && row.authors.some(Boolean)) ||
    (typeof row.authors === 'string' && row.authors.trim().length > 0)
)

// Mirrors AuthorshipsTabs' formatAuthorsJson — same authors_json ([{given,surname}, ...])
// shape produced by the AAR pipeline — parsed here to a name array so
// ExternalPublicationCard's existing string[]-or-string authors rendering needs no changes.
const authorsFromJson = (json?: string | null): string[] => {
    if (!json) return []
    try {
        const parsed = JSON.parse(json)
        if (!Array.isArray(parsed)) return []
        return parsed
            .map((a: any) => {
                const given = (a?.given || '').trim()
                const surname = (a?.surname || '').trim()
                if (given && surname) return `${given} ${surname}`
                return given || surname || ''
            })
            .filter(Boolean)
    } catch {
        return []
    }
}

const SourceArticleTab: FunctionComponent<FuncProps> = ({ uid, source, viewerCwid }) => {
    const [segment, setSegment] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED')
    const [externalList, setExternalList] = useState<any[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    // external_id -> parsed display names, for Scopus rows hydrated via the batched
    // authors lookup below. Kept separate from externalList so a later full refetch
    // (e.g. after Accept/Reject) doesn't require re-fetching rows already resolved here.
    const [authorsCache, setAuthorsCache] = useState<Record<string, string[]>>({})

    const fetchExternalList = useCallback(() => {
        if (!uid) return
        setLoading(true)
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
            .catch(() => setExternalList([]))
            .finally(() => setLoading(false))
    }, [uid])

    useEffect(() => {
        fetchExternalList()
    }, [fetchExternalList])

    const sourceRows = useMemo(
        () => externalList.filter((row) => matchesSource(row, source)),
        [externalList, source],
    )
    const visibleRows = sourceRows.filter((row) => (segment === 'REJECTED' ? !!row.suppressed : !row.suppressed))
    const acceptedCount = sourceRows.filter((r) => !r.suppressed).length
    const rejectedCount = sourceRows.filter((r) => !!r.suppressed).length

    // Batched authors_json backfill (Scopus tab only) — collect rows missing authors,
    // fetch once for every not-yet-attempted external_id, cache by id so a later refetch
    // of externalList (segment change persists via feedback route -> fetchExternalList)
    // doesn't re-request ids already resolved (or already known empty).
    useEffect(() => {
        if (source !== 'SCOPUS') return
        const ids = new Set<string>()
        sourceRows.forEach((row) => {
            if (hasAuthors(row)) return
            const m = SCOPUS_NUMERIC_ID.exec(row.articleId || '')
            if (m && !(m[1] in authorsCache)) ids.add(m[1])
        })
        if (ids.size === 0) return
        const externalIds = [...ids]
        fetch(`/api/db/authorships/authors`, {
            credentials: "same-origin", method: "POST", headers: apiHeaders,
            body: JSON.stringify({ externalIds }),
        })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}))
                if (!r.ok) throw new Error((body && body.message) || `HTTP ${r.status}`)
                return body
            })
            .then((body) => {
                const authorsJsonById = body.authors || {}
                setAuthorsCache((prev) => {
                    const next = { ...prev }
                    externalIds.forEach((id) => { next[id] = authorsFromJson(authorsJsonById[id]) })
                    return next
                })
            })
            .catch(() => {
                // Best-effort hydration — leave "No authors listed", but still mark these
                // ids attempted so a failed lookup doesn't refire on every unrelated change.
                setAuthorsCache((prev) => {
                    const next = { ...prev }
                    externalIds.forEach((id) => { if (!(id in next)) next[id] = [] })
                    return next
                })
            })
    }, [sourceRows, source, authorsCache])

    // Merge hydrated authors into a row for display, without mutating externalList.
    const withHydratedAuthors = (row: any) => {
        if (hasAuthors(row)) return row
        const m = SCOPUS_NUMERIC_ID.exec(row.articleId || '')
        const names = m ? authorsCache[m[1]] : undefined
        return names && names.length ? { ...row, authors: names } : row
    }

    // Optimistic: flip suppressed locally so the row moves segments immediately, persist
    // via the feedback route, then reconcile with a refetch. Reject is reversible via
    // Accept. `note` is optional and Reject-only (see ExternalPublicationCard's list-mode
    // note field) — the server route + Java PATCH already forward it, this just supplies it.
    const sendFeedback = (articleId: string, action: 'ACCEPTED' | 'REJECTED', note?: string) => {
        setExternalList((prev) => prev.map((r) => (
            r.articleId === articleId ? { ...r, suppressed: action === 'REJECTED' } : r
        )))
        fetch(`/api/db/external-article/feedback`, {
            credentials: "same-origin", method: "POST", headers: apiHeaders,
            body: JSON.stringify({ uid, articleId, action, ...(note ? { note } : {}) }),
        })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}))
                if (!r.ok) throw new Error((body && body.message) || `HTTP ${r.status}`)
                toast.success(action === 'REJECTED' ? "Publication rejected." : "Publication accepted.", { position: "top-right", autoClose: 2000, theme: "colored" })
            })
            .catch((err) => {
                toast.error("Could not update: " + (err.message || err), { position: "top-right", autoClose: 3000, theme: "colored" })
                // Revert the optimistic flip on failure.
                setExternalList((prev) => prev.map((r) => (
                    r.articleId === articleId ? { ...r, suppressed: action !== 'REJECTED' } : r
                )))
            })
            .finally(() => fetchExternalList())
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

    // No sourceType === 'MANUAL' row exists in prod yet (see matchesSource above) — the
    // Accepted/Rejected segmented view has nothing to segment, so skip both the pills and
    // the segment-specific empty copy for this tab.
    const isManual = source === 'MANUAL'

    return (
        <div style={wrap}>
            {!isManual && (
                <div style={segmentBar}>
                    <button
                        style={segment === 'ACCEPTED' ? segmentBtnActive : segmentBtn}
                        onClick={() => setSegment('ACCEPTED')}
                    >
                        Accepted ({acceptedCount})
                    </button>
                    <button
                        style={segment === 'REJECTED' ? segmentBtnActive : segmentBtn}
                        onClick={() => setSegment('REJECTED')}
                    >
                        Rejected ({rejectedCount})
                    </button>
                </div>
            )}

            {loading ? (
                <div style={emptyText}>Loading…</div>
            ) : isManual ? (
                <div style={emptyText}>Manual publication entry is coming soon.</div>
            ) : visibleRows.length === 0 ? (
                <div style={emptyText}>
                    {segment === 'ACCEPTED' ? 'No accepted publications from this source.' : 'No rejected publications from this source.'}
                </div>
            ) : (
                visibleRows.map((row) => (
                    <ExternalPublicationCard
                        key={row.articleId}
                        item={withHydratedAuthors(row)}
                        mode="list"
                        hideSourceBadge
                        viewerCwid={viewerCwid}
                        onDelete={doDelete}
                        onReject={!row.suppressed ? (_item, note) => sendFeedback(row.articleId, 'REJECTED', note) : undefined}
                        onAccept={row.suppressed ? () => sendFeedback(row.articleId, 'ACCEPTED') : undefined}
                    />
                ))
            )}

            <ToastContainerWrapper />
        </div>
    )
}

export default SourceArticleTab
