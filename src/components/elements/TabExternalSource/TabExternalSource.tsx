import React, { FunctionComponent } from "react"
import { useSelector } from "react-redux"
import ExternalPublicationCard from "../CurateIndividual/ExternalPublicationCard"

// Option C (docs/README-other-publications-tab.md) — one parameterized tab component
// per live source (Scopus, OpenAlex — Manual Add stays a deferred placeholder), all
// reading the single otherPublicationsData redux slice App.js already fetches. Faculty
// self-service is read-only for now: reject/feedback actions land later via the
// FeedbackLog-based Java endpoint; Delete stays the curator's action in
// TabAddExternalPublication.tsx.

interface FuncProps {
    uid: string,
    source: 'SCOPUS' | 'OPENALEX',
}

const wrap: React.CSSProperties = { padding: "8px 0 24px" }
const helpText: React.CSSProperties = { fontSize: 12.5, color: "#8a94a6", marginBottom: 12 }
const emptyText: React.CSSProperties = { fontSize: 13, color: "#8a94a6", padding: "8px 0" }

// A row belongs on this tab unless it's suppressed (a duplicate of an accepted
// PubMed record, per the supersede rule).
const visibleFor = (rows: any[], source: string) => rows.filter((row) =>
    row.sourceType === source && !row.suppressed
)

const TabExternalSource: FunctionComponent<FuncProps> = (props) => {
    const { source } = props
    const otherPublicationsData = useSelector((state: any) => state.otherPublicationsData)
    const otherPublicationsFetching = useSelector((state: any) => state.otherPublicationsFetching)

    const rows = visibleFor(otherPublicationsData || [], source)

    const sourceLabel = source === 'SCOPUS' ? 'Scopus' : 'OpenAlex'

    return (
        <div style={wrap}>
            <p style={helpText}>
                Publications added from {sourceLabel}. These are not scored by ReCiter.
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
                    />
                ))
            )}
        </div>
    )
}

export default TabExternalSource
