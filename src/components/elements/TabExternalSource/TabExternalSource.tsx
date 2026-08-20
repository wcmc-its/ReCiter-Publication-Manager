import React, { FunctionComponent, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useSession } from "next-auth/react"
import ExternalPublicationCard from "../CurateIndividual/ExternalPublicationCard"
import { otherPublicationsFetchData } from "../../../redux/actions/actions"
import { reciterConfig } from "../../../../config/local"

// Option C (docs/README-other-publications-tab.md) — one parameterized tab component
// per live source (Scopus, OpenAlex — Manual Add stays a deferred placeholder), all
// reading the single otherPublicationsData redux slice App.js already fetches. Faculty
// dispute actions ("This isn't mine" -> REJECTED, Undo -> ACCEPTED) go through the PM
// PATCH route, which stamps the actor from the session server-side; Delete stays the
// curator's action in TabAddExternalPublication.tsx.

interface FuncProps {
    uid: string,
    source: 'SCOPUS' | 'OPENALEX',
}

const wrap: React.CSSProperties = { padding: "8px 0 24px" }
const helpText: React.CSSProperties = { fontSize: 12.5, color: "#8a94a6", marginBottom: 12 }
const emptyText: React.CSSProperties = { fontSize: 13, color: "#8a94a6", padding: "8px 0" }
const errorText: React.CSSProperties = { fontSize: 12.5, color: "#b31b1b", marginBottom: 10 }

// Disputed = suppressed with no superseding PMID (the Java PATCH clears
// supersededByPmid on REJECTED, so the two suppression causes never mix).
const isDisputed = (row: any) => !!row.suppressed && row.supersededByPmid == null

// A row belongs on this tab unless it's superseded (suppressed as a duplicate of an
// accepted PubMed record). A dispute-suppressed row still renders — in the disputed
// state, so the faculty member can undo it (Decision 5/6).
const visibleFor = (rows: any[], source: string) => rows.filter((row) =>
    row.sourceType === source && !(row.suppressed && row.supersededByPmid != null)
)

const TabExternalSource: FunctionComponent<FuncProps> = (props) => {
    const { uid, source } = props
    const dispatch = useDispatch()
    const { data: session } = useSession() as any
    const viewerUid = session?.data?.username ? String(session.data.username) : undefined

    const otherPublicationsData = useSelector((state: any) => state.otherPublicationsData)
    const otherPublicationsFetching = useSelector((state: any) => state.otherPublicationsFetching)

    const [busyId, setBusyId] = useState<string | null>(null)
    const [error, setError] = useState<string>("")

    // Dispute (REJECTED) / retract (ACCEPTED) via the PM PATCH route. The actor is
    // resolved from the session server-side — nothing identity-bearing leaves here.
    // On success the slice is refetched (there is no per-row OTHERPUBS update method);
    // on failure the error surfaces in the tab — never a silent success.
    const sendFeedback = (articleId: string, action: 'REJECTED' | 'ACCEPTED', note?: string) => {
        setBusyId(articleId)
        setError("")
        fetch('/api/reciter/external-article/' + uid, {
            credentials: "same-origin",
            method: 'PATCH',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': reciterConfig.backendApiKey,
            },
            body: JSON.stringify(note ? { articleId, action, note } : { articleId, action }),
        })
            .then(async (response) => {
                if (response.status !== 200) {
                    let message = ''
                    try {
                        const body = await response.json()
                        if (typeof body?.message === 'string') message = body.message
                    } catch (e) { /* no readable body */ }
                    throw new Error(message || `Request failed (${response.status})`)
                }
                dispatch(otherPublicationsFetchData(uid))
            })
            .catch((err: any) => {
                const detail = err?.message ? ` — ${err.message}` : ''
                setError(action === 'REJECTED'
                    ? `Could not record the dispute${detail}. Please try again.`
                    : `Could not undo the dispute${detail}. Please try again.`)
            })
            .finally(() => setBusyId(null))
    }

    // Disputed rows sink below active rows in the same tab, stable otherwise — they
    // never move to another tab or list (mockup's sortForDisplay).
    const rows = visibleFor(otherPublicationsData || [], source)
        .sort((a, b) => (isDisputed(a) ? 1 : 0) - (isDisputed(b) ? 1 : 0))

    const sourceLabel = source === 'SCOPUS' ? 'Scopus' : 'OpenAlex'

    return (
        <div style={wrap}>
            <p style={helpText}>
                Publications added from {sourceLabel}. These are not scored by ReCiter.
            </p>
            {error && <div style={errorText}>{error}</div>}
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
                        viewerUid={viewerUid}
                        disputeBusy={busyId === row.articleId}
                        onDispute={(articleId, note) => sendFeedback(articleId, 'REJECTED', note)}
                        onRetractDispute={(articleId) => sendFeedback(articleId, 'ACCEPTED')}
                    />
                ))
            )}
        </div>
    )
}

export default TabExternalSource
