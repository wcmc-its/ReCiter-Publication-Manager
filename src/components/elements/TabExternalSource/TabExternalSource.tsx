import React, { FunctionComponent } from "react"
import { useSelector, useDispatch } from "react-redux"
import { toast } from "react-toastify"
import { reciterConfig } from "../../../../config/local"
import { otherPublicationsFetchData } from "../../../redux/actions/actions"
import ExternalPublicationCard from "../CurateIndividual/ExternalPublicationCard"
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper"

// Option C (docs/README-other-publications-tab.md) — one parameterized tab component
// per live source (Scopus, OpenAlex — Manual Add stays a deferred placeholder), all
// reading the single otherPublicationsData redux slice App.js already fetches. Faculty
// self-service only: dispute ("This isn't mine") / undo, never Delete or Resolve —
// those are the curator's actions in TabAddExternalPublication.tsx.

interface FuncProps {
    uid: string,
    source: 'SCOPUS' | 'OPENALEX',
}

const apiHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: reciterConfig.backendApiKey,
}

const wrap: React.CSSProperties = { padding: "8px 0 24px" }
const helpText: React.CSSProperties = { fontSize: 12.5, color: "#8a94a6", marginBottom: 12 }
const emptyText: React.CSSProperties = { fontSize: 13, color: "#8a94a6", padding: "8px 0" }

// A row belongs on this tab unless it's a real duplicate of an accepted PubMed record
// (supersede-suppressed). A disputed-but-unresolved row still renders, in its disputed
// visual state (Faculty tab wiring, README) — that's the one case where suppressed and
// visible are both true.
const visibleFor = (rows: any[], source: string) => rows.filter((row) =>
    row.sourceType === source && !(row.suppressed && row.supersededByPmid != null)
)

// Disputed rows sink to the bottom of their own tab; stable otherwise.
const sortForDisplay = (rows: any[]) => {
    const disputedOf = (row: any) => (row.suppressed && row.disputedBy != null && row.supersededByPmid == null) ? 1 : 0
    return [...rows].sort((a, b) => disputedOf(a) - disputedOf(b))
}

const TabExternalSource: FunctionComponent<FuncProps> = (props) => {
    const { uid, source } = props
    const dispatch = useDispatch()
    const otherPublicationsData = useSelector((state: any) => state.otherPublicationsData)
    const otherPublicationsFetching = useSelector((state: any) => state.otherPublicationsFetching)

    const rows = sortForDisplay(visibleFor(otherPublicationsData || [], source))

    const patchDispute = (articleId: string, action: 'DISPUTE' | 'RETRACT', disputeNote?: string) => {
        fetch(`/api/reciter/external-article/${encodeURIComponent(uid)}?articleId=${encodeURIComponent(articleId)}`, {
            credentials: "same-origin", method: "PATCH", headers: apiHeaders,
            body: JSON.stringify(disputeNote ? { action, disputeNote } : { action }),
        })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}))
                if (!r.ok) throw new Error((body && body.message) || `HTTP ${r.status}`)
                return body
            })
            .then(() => {
                toast.success(action === 'DISPUTE' ? "Marked as disputed." : "Dispute undone.", {
                    position: "top-right", autoClose: 2000, theme: "colored",
                })
                dispatch(otherPublicationsFetchData(uid))
            })
            .catch((err) => {
                toast.error("Could not update: " + (err.message || err), { position: "top-right", autoClose: 3000, theme: "colored" })
            })
    }

    const sourceLabel = source === 'SCOPUS' ? 'Scopus' : 'OpenAlex'

    return (
        <div style={wrap}>
            <p style={helpText}>
                Publications added from {sourceLabel}. These are not scored by ReCiter. If one isn&rsquo;t
                yours, dispute it and a curator will review.
            </p>
            {otherPublicationsFetching ? (
                <div style={emptyText}>Loading…</div>
            ) : rows.length === 0 ? (
                <div style={emptyText}>No {sourceLabel} publications on this record.</div>
            ) : (
                rows.map((row) => (
                    <ExternalPublicationCard
                        key={row.articleId}
                        item={row}
                        mode="list"
                        hideSourceBadge
                        onDispute={(articleId, note) => patchDispute(articleId, 'DISPUTE', note)}
                        onUndoDispute={(articleId) => patchDispute(articleId, 'RETRACT')}
                    />
                ))
            )}
            <ToastContainerWrapper />
        </div>
    )
}

export default TabExternalSource
