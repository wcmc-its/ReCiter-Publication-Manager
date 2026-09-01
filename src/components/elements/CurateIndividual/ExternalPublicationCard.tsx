import React, { FunctionComponent, useEffect, useRef, useState } from "react"
import { useSelector } from "react-redux"
import { RootStateOrAny } from "../../../types/redux"
import styles from './ExternalPublicationCard.module.css'
// Curation-history popover: reuse Publication.tsx's styling (evidenceBtn, curationWrap,
// curationLogPopover, clog* rows) rather than duplicating it here.
import pubStyles from '../Publication/Publication.module.css'
import CheckIcon from '@mui/icons-material/Check'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

// PM#771 — a source-badged external publication row. Deliberately NO authorship
// score tile (external pubs are not scored by ReCiter). Two modes:
//   'preview' — a search result, with an Add affordance + 409 BLOCKED / WARNING UI.
//               If the work is in PubMed (PMID from OpenAlex, or found via DOI lookup)
//               we steer the curator to the scored PubMed path instead of adding an
//               unscored external record.
//   'list'    — an already-added external pub, with a Delete (= revoke) affordance, plus
//               (curate per-source tabs, Option C Phase 1) a reversible Reject / Accept
//               (un-reject) affordance driven by the parent's suppressed state
const doiUrl = 'https://doi.org/'
const pubMedUrl = 'https://www.ncbi.nlm.nih.gov/pubmed/'

// Inline styling for the list-mode Reject note textarea, shown only once Reject is
// clicked (see the inline note/confirm/cancel cluster in the actions section below).
const rejectNoteInputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    border: '1px solid #cbd3e0',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 12,
    fontFamily: 'inherit',
    color: '#384152',
    resize: 'vertical',
    boxSizing: 'border-box',
}

// Curation-history entry date — mirrors Publication.tsx's formatClogDate (seconds
// included so rapid same-session actions stay distinguishable).
const formatClogDate = (timestamp: string | number | Date): string => {
    const d = new Date(timestamp)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
    })
}

// The feedbacklog redux slice normalizes rows with a `modifyTimestamp` ISO string
// derived from the raw `createTimestamp` (epoch seconds) — prefer it, fall back to
// converting createTimestamp directly if it's ever absent.
const dateForEntry = (entry: any): string => {
    if (entry.modifyTimestamp) return formatClogDate(entry.modifyTimestamp)
    const epochSec = Number(entry.createTimestamp) || 0
    return epochSec ? formatClogDate(epochSec * 1000) : ''
}

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
    // 'accepted' = this PMID-bearing doc was accepted directly from this card
    // (onAcceptPmid), distinct from 'added' (a Scopus-native doc added as an unscored
    // ExternalArticle).
    status: 'idle' | 'adding' | 'checking' | 'blocked' | 'warning' | 'inPubmed' | 'added' | 'accepted',
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
    // preview mode, PMID-bearing doc not yet in the record — direct "Add" (bypasses the
    // PubMed Add tab entirely). Same accept as onAddViaPubMed's tab, without leaving
    // the current tab.
    onAcceptPmid?: (pmid: number, item: any) => void,
    // Current status of a PMID in this person's record, for annotating search results.
    recordStatusOf?: (pmid: number) => 'ACCEPTED' | 'REJECTED' | 'PENDING' | null,
    // preview mode: dismiss a suggestion (Scopus Authorships feed only); local, not
    // persisted, `note` is always undefined here. list mode: reject an already-added row
    // (persists via the feedback route, reversible with onAccept); `note` carries the
    // optional reject-reason text from the list-mode note field below.
    onReject?: (item: any, note?: string) => void,
    // list mode only — un-reject a suppressed row (persists via the feedback route).
    onAccept?: (item: any) => void,
    onDelete?: (articleId: string) => void,
    // Curate per-source tabs (Option C Phase 1) — the source tab already names the
    // source, so its cards drop the redundant badge.
    hideSourceBadge?: boolean,
    // list mode only — the signed-in curator's CWID, threaded down from ReciterTabs'
    // useSession(). Gates the Delete button to the row's own adder (item.addedBy).
    viewerCwid?: string,
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
    // list-mode Reject note — optional, threaded through onReject on click. Preview-mode
    // onReject (TabAddExternalPublication / TabScopusAuthorships dismiss) doesn't use this.
    const [rejectNote, setRejectNote] = useState('')
    // list mode only — the note textarea is hidden until Reject is clicked, then the
    // action cluster switches to [note input] [Confirm reject] [Cancel].
    const [rejectMode, setRejectMode] = useState(false)
    const [showHistory, setShowHistory] = useState(false)
    const historyRef = useRef<HTMLSpanElement>(null)

    // Curation history — same FeedbackLog rows Publication.tsx's History popover reads,
    // bucketed by articleId; for external rows that's the full "SOURCE:id" string (see
    // recordExternalArticleFeedback), which is exactly item.articleId here.
    const feedbacklog = useSelector((state: RootStateOrAny) => state.feedbacklog)
    const entries: any[] = (item.articleId && feedbacklog && feedbacklog[item.articleId]) || []

    // Close the history popover on outside click or Escape, same as Publication.tsx.
    useEffect(() => {
        if (!showHistory) return
        const handleClickOutside = (e: MouseEvent) => {
            if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
                setShowHistory(false)
            }
        }
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowHistory(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [showHistory])

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
                    {!props.hideSourceBadge && <span className={styles.sourceBadge}>{sourceLabel}</span>}
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

                {/* In PubMed but NOT yet in the record — direct Add, or steer to the scored
                    PubMed path (same accept, from the Add tab instead of this card) */}
                {mode === 'preview' && pubmedPmid && !recStatus && status !== 'added' && status !== 'accepted' && (
                    <div className={styles.pubmedBox}>
                        <div className={styles.pubmedTitle}>This work is in PubMed (PMID {pubmedPmid}).</div>
                        <div>Add it to count as scored evidence for this person, instead of as an unscored external record.</div>
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
                {/* Direct-accept take priority over the plain record tag below, same as
                    'added' does — by the time doAcceptPmid resolves, recordStatusOf
                    already reports ACCEPTED too (updatePublicationAssertion ran first). */}
                {mode === 'preview' && status === 'accepted' && (
                    <span className={styles.addedTag}>Accepted &#10003;</span>
                )}
                {mode === 'preview' && status !== 'added' && status !== 'accepted' && pubmedPmid && recStatus && (
                    <span className={styles.recordTag}>
                        {recStatus === 'ACCEPTED' ? 'Accepted' : recStatus === 'REJECTED' ? 'Rejected' : 'Pending'}
                    </span>
                )}
                {mode === 'preview' && status === 'adding' && pubmedPmid && !recStatus && (
                    <button className={styles.btnAdd} disabled>
                        Adding&#8230;
                    </button>
                )}
                {mode === 'preview' && status !== 'added' && status !== 'accepted' && status !== 'adding' && pubmedPmid && !recStatus && (
                    <div className={styles.pubmedActions}>
                        <button
                            className={styles.btnAdd}
                            onClick={() => props.onAcceptPmid && props.onAcceptPmid(pubmedPmid, item)}
                        >
                            <CheckIcon style={{ fontSize: 14 }} /> Add
                        </button>
                        <button
                            className={styles.btnPubmedSecondary}
                            onClick={() => props.onAddViaPubMed && props.onAddViaPubMed(pubmedPmid, item)}
                        >
                            Add via PubMed &#8594;
                        </button>
                    </div>
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
                {mode === 'preview' && props.onReject && status !== 'added' && status !== 'accepted' && (
                    <button
                        className={styles.btnReject}
                        onClick={() => props.onReject && props.onReject(item)}
                    >
                        Reject
                    </button>
                )}
                {/* list mode — one right-aligned row: History (if any), then either
                    Reject/Accept or the inline reject-note flow, then Delete. */}
                {mode === 'list' && !rejectMode && (
                    <div className={styles.listActionsRow}>
                        {entries.length > 0 && (
                            <span className={pubStyles.curationWrap} ref={historyRef}>
                                <button
                                    className={pubStyles.evidenceBtn}
                                    onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory) }}
                                >
                                    History
                                </button>
                                {showHistory && (
                                    <div className={pubStyles.curationLogPopover}>
                                        <div className={pubStyles.clogHead}>Curation history</div>
                                        {entries.map((entry, i) => {
                                            const action = entry.feedback === 'ACCEPTED' ? 'accepted' : entry.feedback === 'REJECTED' ? 'rejected' : 'undone'
                                            const verb = entry.feedback === 'ACCEPTED' ? 'Accepted' : entry.feedback === 'REJECTED' ? 'Rejected' : 'Suggested'
                                            const who = entry.curatorName || entry.actorPersonIdentifier || 'Unknown'
                                            return (
                                                <div className={pubStyles.clogEntry} key={entry.feedbackID || i}>
                                                    <div className={pubStyles.clogAction}>
                                                        <div className={`${pubStyles.clogDot} ${action === 'accepted' ? pubStyles.clogDotAccepted : action === 'rejected' ? pubStyles.clogDotRejected : pubStyles.clogDotUndone}`} />
                                                        <span className={`${pubStyles.clogVerb} ${action === 'accepted' ? pubStyles.clogVerbAccepted : action === 'rejected' ? pubStyles.clogVerbRejected : pubStyles.clogVerbUndone}`}>{verb}</span>
                                                        <span className={pubStyles.clogWho}>{who}</span>
                                                    </div>
                                                    <span className={pubStyles.clogDate}>{dateForEntry(entry)}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </span>
                        )}
                        {!suppressed && props.onReject && (
                            <button
                                className={styles.btnReject}
                                onClick={() => setRejectMode(true)}
                            >
                                Reject
                            </button>
                        )}
                        {suppressed && props.onAccept && (
                            <button
                                className={styles.btnAdd}
                                onClick={() => props.onAccept && props.onAccept(item)}
                            >
                                <CheckIcon style={{ fontSize: 14 }} /> Accept
                            </button>
                        )}
                        {!!props.viewerCwid && item.addedBy === props.viewerCwid && (
                            <button
                                className={styles.btnDelete}
                                onClick={() => props.onDelete && props.onDelete(item.articleId)}
                            >
                                <DeleteOutlineIcon style={{ fontSize: 15 }} /> Delete
                            </button>
                        )}
                    </div>
                )}
                {mode === 'list' && rejectMode && (
                    <div className={styles.rejectInline}>
                        <textarea
                            style={rejectNoteInputStyle}
                            placeholder="Optional note for this rejection…"
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            rows={2}
                            autoFocus
                        />
                        <div className={styles.rejectInlineActions}>
                            <button
                                className={styles.btnRejectConfirm}
                                onClick={() => {
                                    props.onReject && props.onReject(item, rejectNote.trim() || undefined)
                                    setRejectMode(false)
                                    setRejectNote('')
                                }}
                            >
                                Confirm reject
                            </button>
                            <button
                                className={styles.btnCancel}
                                onClick={() => { setRejectMode(false); setRejectNote('') }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ExternalPublicationCard
