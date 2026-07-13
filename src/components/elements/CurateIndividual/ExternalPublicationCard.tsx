import React, { FunctionComponent } from "react"
import styles from './ExternalPublicationCard.module.css'
import CheckIcon from '@mui/icons-material/Check'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

// PM#771 — a source-badged external publication row. Deliberately NO authorship
// score tile (external pubs are not scored by ReCiter). Two modes:
//   'preview' — a search result, with an Add affordance + 409 BLOCKED / WARNING UI.
//               If the work is in PubMed (PMID from OpenAlex, or found via DOI lookup)
//               we steer the curator to the scored PubMed path instead of adding an
//               unscored external record.
//   'list'    — an already-added external pub, with a Delete (= revoke) affordance
const doiUrl = 'https://doi.org/'
const pubMedUrl = 'https://www.ncbi.nlm.nih.gov/pubmed/'

const SOURCE_LABELS: Record<string, string> = {
    OPENALEX: 'OpenAlex',
    SCOPUS: 'Scopus',
    WOS: 'Web of Science',
}

// The source id lives in the `SOURCE:<id>` prefix of articleId. Turn it into an outbound
// link where we can build a stable URL: OpenAlex works always resolve; Scopus only when
// the id is a 2-s2.0 EID. Otherwise leave it as plain text.
const idLinkFor = (articleId?: string): string | undefined => {
    if (!articleId) return undefined
    const idx = articleId.indexOf(':')
    if (idx < 0) return undefined
    const src = articleId.slice(0, idx)
    const id = articleId.slice(idx + 1)
    if (!id) return undefined
    if (src === 'OPENALEX') return `https://openalex.org/${id}`
    if (src === 'SCOPUS' && /^2-s2\.0-/.test(id)) {
        return `https://www.scopus.com/record/display.uri?eid=${encodeURIComponent(id)}&origin=resultslist`
    }
    return undefined
}

export type AddState = {
    status: 'idle' | 'adding' | 'checking' | 'blocked' | 'warning' | 'inPubmed' | 'added',
    message?: string,
    matches?: Array<{ type?: string, matchedId?: string, detail?: string }>,
    pmid?: number,
}

interface FuncProps {
    item: any,
    mode: 'preview' | 'list',
    addState?: AddState,
    onAdd?: (item: any) => void,
    onAddAnyway?: (item: any) => void,
    onAddViaPubMed?: (pmid: number, item: any) => void,
    // Current status of a PMID in this person's record, for annotating search results.
    recordStatusOf?: (pmid: number) => 'ACCEPTED' | 'REJECTED' | 'PENDING' | null,
    // Dismiss a suggestion (Scopus Authorships feed only); local, not GoldStandard.
    onReject?: (item: any) => void,
    onDelete?: (articleId: string) => void,
}

// Map the server's duplicate match type(s) to a state-specific, actionable headline.
function blockedHeadline(matches?: Array<{ type?: string }>): string {
    const types = (matches || []).map((m) => m.type)
    if (types.includes('PMID_IN_GOLD_STANDARD')) return 'Already accepted for this person.'
    if (types.includes('PMID_REJECTED_IN_GOLD_STANDARD')) return 'Previously rejected for this person.'
    if (types.includes('PMID_IN_CANDIDATES')) return 'Already a pending suggestion — review it in the Suggested tab.'
    if (types.some((t) => t === 'ALREADY_ADDED' || t === 'PMID_MATCH_EXTERNAL' || t === 'DOI_MATCH_EXTERNAL')) {
        return 'Already added as an external publication.'
    }
    if (types.includes('DOI_MATCH')) return "A publication with this DOI is already in the person's record."
    return "This publication is already in the person's record."
}

const ExternalPublicationCard: FunctionComponent<FuncProps> = (props) => {
    const { item, mode, addState } = props

    const sourceType: string = item.sourceType || 'OPENALEX'
    const sourceLabel = SOURCE_LABELS[sourceType] || sourceType

    // Authors can be a string[] (preview/normalized) or a comma-joined string (list row).
    let authorsText = ''
    if (Array.isArray(item.authors)) {
        authorsText = item.authors.filter(Boolean).join(', ')
    } else if (typeof item.authors === 'string') {
        authorsText = item.authors
    }

    const venue = item.journalOrVenue || item.venue || item.journal
    const date = item.pubDate || item.publicationDate || item.displayDate
    const pubType = item.publicationType
    const doi = item.doi
    const pmid = item.pmid
    const suppressed = mode === 'list' && !!item.suppressed
    const status = addState?.status || 'idle'

    // The work is in PubMed if OpenAlex gave us a PMID, or a DOI lookup found one.
    // In that case steer to the scored PubMed path rather than an unscored external add.
    const pubmedPmid: number | undefined = mode === 'preview'
        ? (item.pmid || (status === 'inPubmed' ? addState?.pmid : undefined))
        : undefined

    // Is this PMID already in the person's record (accepted / rejected / pending)?
    const recStatus = (pubmedPmid && props.recordStatusOf) ? props.recordStatusOf(pubmedPmid) : null

    return (
        <div className={`${styles.card} ${suppressed ? styles.cardSuppressed : ''}`}>
            <div className={styles.main}>
                <div className={styles.headerRow}>
                    <span className={styles.sourceBadge}>{sourceLabel}</span>
                    <span className={styles.noScoreBadge}>No authorship score</span>
                    {suppressed && (
                        <span className={styles.suppressedTag}>
                            Superseded{item.supersededByPmid ? ` by PMID ${item.supersededByPmid}` : ''}
                        </span>
                    )}
                </div>

                <div className={styles.title}>{item.title || '(untitled)'}</div>

                <div className={styles.authors}>
                    {authorsText ? authorsText : 'No authors listed'}
                </div>

                <div className={styles.meta}>
                    {venue && <span className={styles.venue}>{venue}</span>}
                    {date && <span>{date}</span>}
                    {pubType && <span className={styles.typeBadge}>{pubType}</span>}
                </div>

                <div className={styles.links}>
                    {doi && <span><a href={`${doiUrl}${doi}`} target="_blank" rel="noreferrer">DOI &#8599;</a></span>}
                    {pmid && <span>PMID: <a href={`${pubMedUrl}${pmid}`} target="_blank" rel="noreferrer">{pmid}</a></span>}
                    {item.articleId && (
                        <span>ID: {idLinkFor(item.articleId)
                            ? <a href={idLinkFor(item.articleId)} target="_blank" rel="noreferrer">{item.articleId} &#8599;</a>
                            : item.articleId}</span>
                    )}
                </div>

                {/* Already in this person's record — inform, no add */}
                {mode === 'preview' && pubmedPmid && recStatus && status !== 'added' && (
                    recStatus === 'ACCEPTED' ? (
                        <div className={styles.acceptedBox}>
                            <strong>Already accepted for this person</strong> (PMID {pubmedPmid}). Nothing to add.
                        </div>
                    ) : recStatus === 'REJECTED' ? (
                        <div className={styles.blockedBox}>
                            <strong>Previously rejected for this person</strong> (PMID {pubmedPmid}).
                        </div>
                    ) : (
                        <div className={styles.warningBox}>
                            <strong>Already a pending suggestion</strong> (PMID {pubmedPmid}) — review it in the Suggested tab.
                        </div>
                    )
                )}

                {/* In PubMed but NOT yet in the record — steer to the scored PubMed path */}
                {mode === 'preview' && pubmedPmid && !recStatus && status !== 'added' && (
                    <div className={styles.pubmedBox}>
                        <div className={styles.pubmedTitle}>This work is in PubMed (PMID {pubmedPmid}).</div>
                        <div>Add it via PubMed so it counts as scored evidence for this person, instead of as an unscored external record.</div>
                    </div>
                )}

                {/* 409 BLOCKED — no override affordance, state-specific explanation */}
                {mode === 'preview' && status === 'blocked' && (
                    <div className={styles.blockedBox}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Cannot add — {blockedHeadline(addState?.matches)}</div>
                        {addState?.message && <div>{addState.message}</div>}
                        {addState?.matches?.map((m, i) => (
                            <div key={i} className={styles.matchRow}>
                                {m.type}{m.matchedId ? ` — ${m.matchedId}` : ''}{m.detail ? `: ${m.detail}` : ''}
                            </div>
                        ))}
                    </div>
                )}

                {/* 409 WARNING — suspected duplicate side-by-side, explicit Add anyway */}
                {mode === 'preview' && status === 'warning' && (
                    <div className={styles.warningBox}>
                        <div className={styles.warningTitle}>Possible duplicate</div>
                        <div>{addState?.message}</div>
                        {addState?.matches?.map((m, i) => (
                            <div key={i} className={styles.matchRow}>
                                {m.type}{m.matchedId ? ` — ${m.matchedId}` : ''}{m.detail ? `: ${m.detail}` : ''}
                            </div>
                        ))}
                        <div className={styles.warningActions}>
                            <button
                                className={styles.btnAnyway}
                                onClick={() => props.onAddAnyway && props.onAddAnyway(item)}
                            >
                                Add anyway
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.actions}>
                {mode === 'preview' && status === 'added' && (
                    <span className={styles.addedTag}>Added &#10003;</span>
                )}
                {mode === 'preview' && status !== 'added' && pubmedPmid && recStatus && (
                    <span className={styles.recordTag}>
                        {recStatus === 'ACCEPTED' ? 'Accepted' : recStatus === 'REJECTED' ? 'Rejected' : 'Pending'}
                    </span>
                )}
                {mode === 'preview' && status !== 'added' && pubmedPmid && !recStatus && (
                    <button
                        className={styles.btnPubmed}
                        onClick={() => props.onAddViaPubMed && props.onAddViaPubMed(pubmedPmid, item)}
                    >
                        Add via PubMed &#8594;
                    </button>
                )}
                {mode === 'preview' && status !== 'added' && !pubmedPmid && (
                    <button
                        className={styles.btnAdd}
                        disabled={status === 'adding' || status === 'checking' || status === 'blocked' || status === 'warning'}
                        onClick={() => props.onAdd && props.onAdd(item)}
                    >
                        <CheckIcon style={{ fontSize: 14 }} /> {status === 'adding' ? 'Adding…' : status === 'checking' ? 'Checking…' : 'Add'}
                    </button>
                )}
                {mode === 'preview' && props.onReject && status !== 'added' && (
                    <button
                        className={styles.btnReject}
                        onClick={() => props.onReject && props.onReject(item)}
                    >
                        Reject
                    </button>
                )}
                {mode === 'list' && (
                    <button
                        className={styles.btnDelete}
                        onClick={() => props.onDelete && props.onDelete(item.articleId)}
                    >
                        <DeleteOutlineIcon style={{ fontSize: 15 }} /> Delete
                    </button>
                )}
            </div>
        </div>
    )
}

export default ExternalPublicationCard
