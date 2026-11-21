import React, { FunctionComponent, useRef, useState } from "react"
import { toast } from "react-toastify"
import styles from "./CurateIndividual.module.css"
import { Button, Dialog } from "../../ui"
import { reciterConfig } from "../../../../config/local"
import {
    Citation, Group, GROUP_LABEL, MAX_ITEMS, MAX_PASTE_CHARS, RecordExt, RecordPub, Resolved, Row,
    chunkText, dedupePaste, groupAgainstRecord,
} from "../../../lib/listImport"

// "Import a list" (plan 2026-11-20-import-a-list-plan.md). Paste a publication list (Google
// Scholar, ResearchGate, Academia.edu, a CV) or drop a BibTeX / RIS / CSV export; PM reads it,
// finds each work, and shows one review table. Nothing is written until Add: checked PubMed works
// are accepted in one gold-standard write (onAcceptPmids), the rest go through the external add
// route, one at a time.

interface FuncProps {
    open: boolean,
    onClose: () => void,
    uid: string,
    fullName: string,
    pubs: RecordPub[],
    exts: RecordExt[],
    onAcceptPmids: (pmids: number[]) => Promise<{ ok: number[], failed: { pmid: number, message: string }[] }>,
    onAdded: () => void,
}

type Step = 'paste' | 'working' | 'review' | 'done'
type Outcome = { accepted: number, added: number, already: number, warn: string[], failed: string[] }

const apiHeaders = { Accept: "application/json", "Content-Type": "application/json", Authorization: reciterConfig.backendApiKey }
const post = async (url: string, body: any) => {
    const r = await fetch(url, { credentials: "same-origin", method: "POST", headers: apiHeaders, body: JSON.stringify(body) })
    return { status: r.status, body: await r.json().catch(() => ({})) }
}

// Display order: the actionable groups first, the ones needing nothing last.
const ORDER: Group[] = ['suggestion', 'pubmed_new', 'external', 'rejected', 'not_found', 'error', 'in_profile']
const ACCEPTS: Group[] = ['suggestion', 'pubmed_new', 'rejected']

const linkOf = (r: Row): { href: string, label: string } | null => {
    if (r.pmid) return { href: `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`, label: `PMID ${r.pmid}` }
    const m = r.match
    if (m?.doi) return { href: `https://doi.org/${m.doi}`, label: 'DOI' }
    if (m?.articleId?.startsWith('OPENALEX:')) return { href: `https://openalex.org/${m.articleId.slice(9)}`, label: 'OpenAlex' }
    return null
}

const ImportListDialog: FunctionComponent<FuncProps> = (props) => {
    const short = (props.fullName || '').trim().split(/\s+/)[0] || 'this person'
    const [step, setStep] = useState<Step>('paste')
    const [text, setText] = useState('')
    const [note, setNote] = useState('')
    const [progress, setProgress] = useState('')
    const [rows, setRows] = useState<Row[]>([])
    const [checked, setChecked] = useState<Record<number, boolean>>({})
    const [stats, setStats] = useState({ dropped: 0, deduped: 0 })
    const [outcome, setOutcome] = useState<Outcome | null>(null)
    const cancelled = useRef(false)

    const regroup = (resolved: Resolved[]) => {
        const next = groupAgainstRecord(resolved, props.pubs, props.exts)
        setRows(next)
        setChecked(Object.fromEntries(next.map((r, i) => [i, r.checkedByDefault])))
    }

    const resolveAll = async (items: Citation[]): Promise<Resolved[]> => {
        const out: Resolved[] = []
        for (let i = 0; i < items.length && !cancelled.current; i += 10) {
            setProgress(`Matching ${Math.min(i + 10, items.length)} of ${items.length}…`)
            const batch = items.slice(i, i + 10)
            const r = await post('/api/db/import/resolve', { uid: props.uid, items: batch }).catch(() => ({ status: 0, body: {} as any }))
            if (r.status === 200 && Array.isArray(r.body.results)) out.push(...r.body.results)
            else out.push(...batch.map((c) => ({ ...c, score: 0, match: null, error: r.body?.message || `HTTP ${r.status || 'network error'}` })))
        }
        return out
    }

    const run = async () => {
        setNote('')
        if (!text.trim()) { setNote('Paste a list, or choose a file.'); return }
        if (text.length > MAX_PASTE_CHARS) { setNote(`That is more than ${MAX_PASTE_CHARS.toLocaleString()} characters. Split the list and import it in parts.`); return }
        cancelled.current = false
        setStep('working')
        const chunks = chunkText(text)
        let items: Citation[] = [], dropped = 0
        for (let i = 0; i < chunks.length && !cancelled.current; i++) {
            setProgress(chunks.length > 1 ? `Reading part ${i + 1} of ${chunks.length}…` : 'Reading the list…')
            const r = await post('/api/db/import/extract', { uid: props.uid, text: chunks[i] }).catch(() => ({ status: 0, body: {} as any }))
            if (r.status !== 200) {
                setStep('paste')
                setNote(r.body?.message || `Could not read the list (HTTP ${r.status || 'network error'}).`)
                return
            }
            items = items.concat(r.body.items || [])
            dropped += Number(r.body.dropped) || 0
        }
        if (cancelled.current) return
        const d = dedupePaste(items)
        const capped = d.items.slice(0, MAX_ITEMS)
        setStats({ dropped, deduped: d.deduped })
        if (!capped.length) { setStep('paste'); setNote('No publications were found in that text.'); return }
        if (d.items.length > MAX_ITEMS) toast.info(`Only the first ${MAX_ITEMS} publications are imported; import the rest separately.`)
        const resolved = await resolveAll(capped)
        if (cancelled.current) return
        regroup(resolved)
        setStep('review')
    }

    const retryErrors = async () => {
        const idx = rows.map((r, i) => (r.group === 'error' ? i : -1)).filter((i) => i >= 0)
        if (!idx.length) return
        cancelled.current = false
        setStep('working')
        const again = await resolveAll(idx.map((i) => rows[i]))
        const merged: Resolved[] = rows.slice()
        idx.forEach((i, k) => { merged[i] = again[k] })
        regroup(merged)
        setStep('review')
    }

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files && e.target.files[0]
        if (!f) return
        if (f.size > MAX_PASTE_CHARS * 2) { setNote('That file is too large. Export fewer publications at a time.'); return }
        setText(await f.text())
        setNote('')
    }

    const add = async () => {
        const sel = rows.filter((r, i) => checked[i] && r.checkable)
        const pmids = Array.from(new Set(sel.filter((r) => ACCEPTS.includes(r.group) && r.pmid).map((r) => Number(r.pmid))))
        const exts = sel.filter((r) => r.group === 'external' && r.match?.record)
        setStep('working')
        const out: Outcome = { accepted: 0, added: 0, already: 0, warn: [], failed: [] }
        if (pmids.length) {
            setProgress(`Accepting ${pmids.length} PubMed publication${pmids.length === 1 ? '' : 's'}…`)
            try {
                const r = await props.onAcceptPmids(pmids)
                out.accepted = r.ok.length
                r.failed.forEach((f) => out.failed.push(`PMID ${f.pmid}: ${f.message}`))
            } catch (e: any) {
                out.failed.push(`PubMed accept: ${e?.message || e}`)
            }
        }
        for (let i = 0; i < exts.length; i++) {
            const r = exts[i]
            setProgress(`Adding ${i + 1} of ${exts.length} publications not in PubMed…`)
            const res = await post(`/api/db/external/${encodeURIComponent(props.uid)}`, r.match!.record).catch(() => ({ status: 0, body: {} as any }))
            if (res.status === 200 || res.status === 201) out.added++
            else if (res.status === 409 && (res.body?.message || {}).status === 'WARNING') out.warn.push(r.match!.title)
            else if (res.status === 409) out.already++
            else out.failed.push(`${r.match!.title}: ${(res.body?.message && (res.body.message.message || res.body.message)) || `HTTP ${res.status}`}`)
        }
        if (exts.length) props.onAdded()
        setOutcome(out)
        setStep('done')
        const total = out.accepted + out.added
        if (total) toast.success(`Added ${total} publication${total === 1 ? '' : 's'} to ${short}'s profile.`)
    }

    const notFound = rows.filter((r) => r.group === 'not_found')
    const copyNotFound = () => {
        navigator.clipboard?.writeText(notFound.map((r) => [r.title, r.venue, r.year].filter(Boolean).join('. ')).join('\n'))
            .then(() => toast.success('Copied.'), () => toast.error('Could not copy.'))
    }

    const nChecked = rows.filter((r, i) => checked[i] && r.checkable).length
    const counts = ORDER.map((g) => [g, rows.filter((r) => r.group === g).length] as [Group, number]).filter(([, n]) => n)

    const renderRow = (r: Row, i: number) => {
        const link = linkOf(r)
        const differs = r.match && r.match.title && r.score < 0.999
        return (
            <tr key={i} className={styles.ilRow}>
                <td className={styles.ilCheck}>
                    {r.checkable && (
                        <input type="checkbox" checked={!!checked[i]} aria-label={`Add “${r.title}”`}
                            onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))} />
                    )}
                </td>
                <td>
                    <div className={styles.ilTitle}>{r.title}</div>
                    {r.possible && r.match && <div className={styles.ilAsk}>We found “{r.match.title}”. Is this it?</div>}
                    {!r.possible && differs && <div className={styles.ilMuted}>Matched: {r.match!.title}</div>}
                    {(r.note || r.error) && <div className={styles.ilMuted}>{r.note || `Lookup failed: ${r.error}`}</div>}
                </td>
                <td className={styles.ilYear}>{r.match?.year || r.year || ''}</td>
                <td className={styles.ilLink}>{link && <a href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>}</td>
            </tr>
        )
    }

    const footer = step === 'review' ? (
        <>
            <Button onClick={() => { setStep('paste'); setRows([]) }}>Back</Button>
            <Button variant="primary" disabled={!nChecked} onClick={add}>Add {nChecked} selected</Button>
        </>
    ) : step === 'working' ? (
        <Button onClick={() => { cancelled.current = true; setStep('paste') }}>Cancel</Button>
    ) : step === 'done' ? (
        <Button variant="primary" onClick={props.onClose}>Done</Button>
    ) : (
        <>
            <Button onClick={props.onClose}>Cancel</Button>
            <Button variant="primary" onClick={run}>Find publications</Button>
        </>
    )

    return (
        <Dialog open={props.open} onClose={props.onClose} width={900} title="Import a list"
            description={`for ${props.fullName || props.uid} · nothing is saved until you click Add`} footer={footer}>
            {step === 'paste' && (
                <div className={styles.meBody}>
                    <label className={styles.meIdLabel} htmlFor="il-text">Paste a publication list</label>
                    <textarea id="il-text" className={`${styles.meInput} ${styles.meArea} ${styles.ilArea}`} rows={12} value={text}
                        onChange={(e) => setText(e.target.value)} autoFocus
                        placeholder="From Google Scholar, ResearchGate, Academia.edu or a CV: select all on the page, copy, and paste here." />
                    <div className={styles.ilFileRow}>
                        <label className={styles.apManualBtn}>
                            Choose a file…
                            <input type="file" accept=".bib,.ris,.csv,.txt,text/plain" onChange={onFile} hidden />
                        </label>
                        <span className={styles.meHint}>BibTeX, RIS or CSV exports work too.</span>
                    </div>
                    <details className={styles.ilHow}>
                        <summary>How to copy from Google Scholar</summary>
                        <p>On the profile, the cleanest route is the profile owner&apos;s own export: tick the box above the list, then Export → BibTeX, and choose that file here.</p>
                        <p>Otherwise click <b>Show more</b> at the bottom of the list until it stops growing, then select all (⌘A or Ctrl+A), copy, and paste here.</p>
                    </details>
                    {note && <div className={styles.apWarn} role="status">{note}</div>}
                </div>
            )}
            {step === 'working' && <div className={styles.ilProgress} role="status" aria-live="polite">{progress}</div>}
            {step === 'review' && (
                <div className={styles.meBody}>
                    <div className={styles.ilCounts} role="status">
                        {counts.map(([g, n]) => <span key={g} className={styles.ilCount}>{GROUP_LABEL[g]} <b>{n}</b></span>)}
                        {stats.deduped > 0 && <span className={styles.ilMuted}>{stats.deduped} repeated in the paste</span>}
                        {stats.dropped > 0 && <span className={styles.ilMuted}>{stats.dropped} skipped (not readable)</span>}
                    </div>
                    {rows.some((r) => r.group === 'error') && (
                        <div className={styles.apWarn}>Some lookups failed. <button type="button" className={styles.meMsgBtn} onClick={retryErrors}>Retry</button></div>
                    )}
                    <div className={styles.ilScroll}>
                        {ORDER.map((g) => {
                            const idx = rows.map((r, i) => (r.group === g ? i : -1)).filter((i) => i >= 0)
                            if (!idx.length) return null
                            const table = (
                                <table className={styles.ilTable}><tbody>{idx.map((i) => renderRow(rows[i], i))}</tbody></table>
                            )
                            return g === 'in_profile' ? (
                                <details key={g} className={styles.ilGroup}>
                                    <summary className={styles.ilGroupHead}>{GROUP_LABEL[g]} ({idx.length})</summary>
                                    {table}
                                </details>
                            ) : (
                                <section key={g} className={styles.ilGroup}>
                                    <h3 className={styles.ilGroupHead}>{GROUP_LABEL[g]} ({idx.length})
                                        {g === 'suggestion' && <span className={styles.ilMuted}> · accepting also trains ReCiter</span>}
                                        {g === 'external' && <span className={styles.ilMuted}> · added to All sources</span>}
                                    </h3>
                                    {g === 'not_found' && <button type="button" className={styles.meMsgBtn} onClick={copyNotFound}>Copy this list</button>}
                                    {table}
                                </section>
                            )
                        })}
                    </div>
                </div>
            )}
            {step === 'done' && outcome && (
                <div className={styles.meBody} role="status">
                    <p>Added <b>{outcome.accepted}</b> PubMed publication{outcome.accepted === 1 ? '' : 's'} and <b>{outcome.added}</b> other{outcome.added === 1 ? '' : 's'}.
                        {outcome.already > 0 && ` ${outcome.already} were already there.`}</p>
                    {outcome.warn.length > 0 && (
                        <div className={styles.apWarn}>Possible duplicates, not added (add them from All sources if they are different works): {outcome.warn.join('; ')}</div>
                    )}
                    {outcome.failed.length > 0 && <div className={styles.apWarn}>Not added: {outcome.failed.join('; ')}</div>}
                    {notFound.length > 0 && (
                        <p>{notFound.length} weren&apos;t found. <button type="button" className={styles.meMsgBtn} onClick={copyNotFound}>Copy the list</button></p>
                    )}
                </div>
            )}
        </Dialog>
    )
}

export default ImportListDialog
