import React, { FunctionComponent, useEffect, useRef, useState } from "react"
import { toast } from "react-toastify"
import styles from "./CurateIndividual.module.css"
import { Button, Dialog } from "../../ui"
import { reciterConfig } from "../../../../config/local"
import {
    Citation, Group, GROUP_LABEL, MAX_ITEMS, MAX_PASTE_CHARS, RecordExt, RecordPub, Resolved, Row,
    chunkText, dedupePaste, groupAgainstRecord, knownInRecord, parseStructured, sanitizeCitations, timeLeft,
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
// A long step's live view: a bar, counts, time left and the latest results, so a 10-minute run
// visibly moves. guessMs is the expected wall-clock per unit until real timings come in.
type Seen = { title: string, what: string, bad?: boolean }
type Prog = { label: string, unit: string, done: number, total: number, start: number, guessMs: number, counts: string, note: string, recent: Seen[] }
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const clock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const seenOf = (r: Resolved): Seen => ({
    title: r.title,
    what: r.error ? `lookup failed: ${r.error}` : r.match?.pmid ? `found, PMID ${r.match.pmid}` : r.match ? 'found, not in PubMed' : 'not found',
    bad: !!r.error,
})

const ImportListDialog: FunctionComponent<FuncProps> = (props) => {
    const short = (props.fullName || '').trim().split(/\s+/)[0] || 'this person'
    const [step, setStep] = useState<Step>('paste')
    const [text, setText] = useState('')
    const [note, setNote] = useState('')
    const [progress, setProgress] = useState('')
    const [prog, setProg] = useState<Prog | null>(null)
    // Re-render once a second while working, so the elapsed time and time left keep moving.
    const [, setTick] = useState(0)
    useEffect(() => {
        if (step !== 'working') return
        const t = setInterval(() => setTick((n) => n + 1), 1000)
        return () => clearInterval(t)
    }, [step])
    const say = (msg: string) => { setProg(null); setProgress(msg) }
    const [rows, setRows] = useState<Row[]>([])
    const [checked, setChecked] = useState<Record<number, boolean>>({})
    const [stats, setStats] = useState({ dropped: 0, deduped: 0 })
    const [outcome, setOutcome] = useState<Outcome | null>(null)
    const cancelled = useRef(false)
    // Set while Add is writing: there is no Cancel then, and a second Add is ignored.
    const saving = useRef(false)

    // keep: rows whose checkbox the person already set (Retry re-groups only the failed rows).
    const regroup = (resolved: Resolved[], keep?: Set<number>) => {
        const next = groupAgainstRecord(resolved, props.pubs, props.exts)
        setRows(next)
        setChecked((prev) => Object.fromEntries(next.map((r, i) => [i, keep?.has(i) && r.checkable ? !!prev[i] : r.checkedByDefault])))
    }

    // Two batches of 10 in flight; each batch is serial on the server. A batch with failed lookups
    // (Crossref or OpenAlex refusing) pauses both workers, 5 s doubling to 60 s, easing off after
    // clean batches. Lookups that still failed are retried once at the end, after a pause.
    const resolveAll = async (items: Citation[], label: string): Promise<Resolved[]> => {
        const out: Resolved[] = new Array(items.length)
        let pauseUntil = 0, backoff = 0
        const p: Prog = { label, unit: 'looked up', done: 0, total: items.length, start: Date.now(), guessMs: 800, counts: '', note: '', recent: [] }
        const show = () => {
            const got = out.filter(Boolean)
            const found = got.filter((x) => x.match).length, failed = got.filter((x) => x.error).length
            p.counts = `${found} found · ${got.length - found - failed} not found${failed ? ` · ${failed} failed` : ''}`
            setProg({ ...p })
        }
        const pass = async (idx: number[]) => {
            let next = 0
            const worker = async () => {
                while (next < idx.length && !cancelled.current) {
                    const wait = pauseUntil - Date.now()
                    if (wait > 0) {
                        p.note = `The lookup services are busy; pausing ${Math.ceil(wait / 1000)} s.`
                        show()
                        await sleep(wait)
                        continue
                    }
                    const slice = idx.slice(next, next + 10); next += 10
                    const batch = slice.map((i) => items[i])
                    const r = await post('/api/db/import/resolve', { uid: props.uid, items: batch }).catch(() => ({ status: 0, body: {} as any }))
                    const res: Resolved[] = r.status === 200 && Array.isArray(r.body.results) && r.body.results.length === batch.length ? r.body.results
                        : batch.map((c) => ({ ...c, score: 0, match: null, error: r.body?.message || `HTTP ${r.status || 'network error'}` }))
                    res.forEach((x, k) => { out[slice[k]] = x })
                    if (res.some((x) => x.error)) { backoff = Math.min(backoff ? backoff * 2 : 5000, 60000); pauseUntil = Date.now() + backoff }
                    else { backoff = backoff > 5000 ? backoff / 2 : 0; p.note = '' }
                    p.done += batch.length
                    p.recent = [...res.map(seenOf), ...p.recent].slice(0, 6)
                    show()
                }
            }
            await Promise.all([worker(), worker()])
        }
        show()
        await pass(items.map((_, i) => i))
        const failed = out.map((x, i) => (x?.error ? i : -1)).filter((i) => i >= 0)
        if (failed.length && !cancelled.current) {
            Object.assign(p, { label: `Retrying ${failed.length} lookup${failed.length === 1 ? '' : 's'} that failed`, done: 0, total: failed.length, start: Date.now(), note: 'Pausing so the lookup services recover…' })
            show()
            await sleep(Math.max(10000, backoff))
            p.note = ''; pauseUntil = 0; backoff = 0
            await pass(failed)
        }
        return out
    }

    const run = async () => {
        setNote('')
        if (!text.trim()) { setNote('Paste a list, or choose a file.'); return }
        if (text.length > MAX_PASTE_CHARS) { setNote(`That is more than ${MAX_PASTE_CHARS.toLocaleString()} characters. Split the list and import it in parts.`); return }
        cancelled.current = false
        setStep('working')
        let items: Citation[] = [], dropped = 0
        // A BibTeX / RIS / CSV export is parsed here, whole: chunking would cut its records apart.
        const parsed = parseStructured(text)
        if (parsed) ({ items, dropped } = sanitizeCitations(parsed, text))
        const chunks = parsed ? [] : chunkText(text)
        // Three parts in flight (a part takes ~40 s); a failed part is retried once, then skipped
        // and named, so one bad part no longer throws away the rest of a long paste.
        const got: Citation[][] = [], failed: number[] = []
        let next = 0, done = 0, lastError = ''
        const worker = async () => {
            while (next < chunks.length && !cancelled.current) {
                const i = next++
                let r = { status: 0, body: {} as any }
                for (let attempt = 0; attempt < 2 && r.status !== 200 && !cancelled.current; attempt++) {
                    r = await post('/api/db/import/extract', { uid: props.uid, text: chunks[i] }).catch(() => ({ status: 0, body: {} as any }))
                    // 4xx (session, permission, size) will not change on a retry.
                    if (r.status >= 400 && r.status < 500) break
                }
                if (r.status === 200) { got[i] = r.body.items || []; dropped += Number(r.body.dropped) || 0 }
                else { failed.push(i + 1); lastError = r.body?.message || `HTTP ${r.status || 'network error'}` }
                p.done++
                p.counts = `${got.filter(Boolean).reduce((n, g) => n + g.length, 0)} publications so far${failed.length ? ` · ${failed.length} part${failed.length === 1 ? '' : 's'} failed` : ''}`
                p.recent = [{ title: `Part ${i + 1}`, what: r.status === 200 ? `${(r.body.items || []).length} publications` : `could not be read (${lastError})`, bad: r.status !== 200 }, ...p.recent].slice(0, 6)
                setProg({ ...p })
            }
        }
        // A part takes ~40 s on its own; three run at once.
        const p: Prog = { label: 'Step 1 of 2: reading the list', unit: 'parts read', done: 0, total: chunks.length, start: Date.now(), guessMs: 40000 / Math.min(3, chunks.length || 1), counts: '', note: '', recent: [] }
        if (chunks.length) setProg({ ...p }); else say('Reading the file…')
        await Promise.all([worker(), worker(), worker()])
        if (cancelled.current) return
        if (chunks.length && failed.length === chunks.length) {
            setStep('paste')
            setNote(lastError.startsWith('HTTP') ? `Could not read the list (${lastError}).` : lastError)
            return
        }
        items = items.concat(...got.filter(Boolean))
        if (failed.length) toast.warning(`Part${failed.length === 1 ? '' : 's'} ${failed.sort((a, b) => a - b).join(', ')} of ${chunks.length} could not be read (${lastError}); publications in ${failed.length === 1 ? 'it' : 'them'} are missing from the list below.`)
        const d = dedupePaste(items)
        const capped = d.items.slice(0, MAX_ITEMS)
        setStats({ dropped, deduped: d.deduped })
        if (!capped.length) { setStep('paste'); setNote('No publications were found in that text.'); return }
        if (d.items.length > MAX_ITEMS) toast.info(`Only the first ${MAX_ITEMS} publications are imported; import the rest separately.`)
        // Works the record already holds need no lookup (most of a long profile).
        const known = capped.map((c) => knownInRecord(c, props.pubs, props.exts))
        const nKnown = known.filter(Boolean).length
        const looked = await resolveAll(capped.filter((_, i) => !known[i]),
            `Step 2 of 2: looking up ${capped.length - nKnown} publications${nKnown ? ` (${nKnown} already in the profile need no lookup)` : ''}`)
        if (cancelled.current) return
        let k = 0
        regroup(capped.map((c, i) => (known[i] ? { ...c, score: 0, match: null } : looked[k++])))
        setStep('review')
    }

    const retryErrors = async () => {
        const idx = rows.map((r, i) => (r.group === 'error' ? i : -1)).filter((i) => i >= 0)
        if (!idx.length) return
        cancelled.current = false
        setStep('working')
        const again = await resolveAll(idx.map((i) => rows[i]), `Retrying ${idx.length} lookup${idx.length === 1 ? '' : 's'}`)
        if (cancelled.current) return
        const merged: Resolved[] = rows.slice()
        idx.forEach((i, k) => { merged[i] = again[k] })
        const retried = new Set(idx)
        regroup(merged, new Set(rows.map((_, i) => i).filter((i) => !retried.has(i))))
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
        if (saving.current) return
        saving.current = true
        const sel = rows.filter((r, i) => checked[i] && r.checkable)
        const pmids = Array.from(new Set(sel.filter((r) => ACCEPTS.includes(r.group) && r.pmid).map((r) => Number(r.pmid))))
        const exts = sel.filter((r) => r.group === 'external' && r.match?.record)
        setStep('working')
        const out: Outcome = { accepted: 0, added: 0, already: 0, warn: [], failed: [] }
        if (pmids.length) {
            say(`Accepting ${pmids.length} PubMed publication${pmids.length === 1 ? '' : 's'}…`)
            try {
                const r = await props.onAcceptPmids(pmids)
                out.accepted = r.ok.length
                r.failed.forEach((f) => out.failed.push(`PMID ${f.pmid}: ${f.message}`))
            } catch (e: any) {
                out.failed.push(`PubMed accept: ${e?.message || e}`)
            }
        }
        const p: Prog = { label: 'Adding publications not in PubMed', unit: 'added', done: 0, total: exts.length, start: Date.now(), guessMs: 1500, counts: '', note: '', recent: [] }
        for (let i = 0; i < exts.length; i++) {
            const r = exts[i]
            p.done = i
            setProg({ ...p })
            const res = await post(`/api/db/external/${encodeURIComponent(props.uid)}`, r.match!.record).catch(() => ({ status: 0, body: {} as any }))
            if (res.status === 200 || res.status === 201) out.added++
            else if (res.status === 409 && (res.body?.message || {}).status === 'WARNING') out.warn.push(r.match!.title)
            else if (res.status === 409) out.already++
            else out.failed.push(`${r.match!.title}: ${(res.body?.message && (res.body.message.message || res.body.message)) || `HTTP ${res.status}`}`)
            p.recent = [{ title: r.match!.title, what: res.status === 200 || res.status === 201 ? 'added' : res.status === 409 ? 'already there' : 'failed', bad: res.status !== 200 && res.status !== 201 && res.status !== 409 }, ...p.recent].slice(0, 6)
        }
        if (exts.length) props.onAdded()
        saving.current = false
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
        saving.current
            ? <Button disabled>Saving…</Button>
            : <Button onClick={() => { cancelled.current = true; setStep(rows.length ? 'review' : 'paste') }}>Cancel</Button>
    ) : step === 'done' ? (
        <Button variant="primary" onClick={props.onClose}>Done</Button>
    ) : (
        <>
            <Button onClick={props.onClose}>Cancel</Button>
            <Button variant="primary" onClick={run}>Find publications</Button>
        </>
    )

    return (
        <Dialog open={props.open} width={900}
            // A long run lives only in this dialog: Esc or a backdrop click must not throw it away
            // while it works (Cancel stops it). ponytail: no resume after a reload; add sessionStorage if asked.
            onClose={step === 'working' ? () => undefined : props.onClose} title="Import a list"
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
            {step === 'working' && (prog ? (
                <div className={styles.ilProgress}>
                    <div role="status" aria-live="polite"><b>{prog.label}</b></div>
                    <progress className={styles.ilBar} max={prog.total || 1} value={prog.done} />
                    <div>{prog.done} of {prog.total} {prog.unit}{prog.counts && ` · ${prog.counts}`}</div>
                    <div className={styles.ilMuted}>{clock(Date.now() - prog.start)} elapsed{timeLeft(prog, Date.now()) && ` · ${timeLeft(prog, Date.now())}`}</div>
                    {prog.note && <div className={styles.ilAsk}>{prog.note}</div>}
                    {prog.recent.length > 0 && (
                        <ul className={styles.ilRecent} aria-label="Latest">
                            {prog.recent.map((r, i) => <li key={i} className={r.bad ? styles.ilAsk : undefined}><span>{r.title}</span> · {r.what}</li>)}
                        </ul>
                    )}
                </div>
            ) : <div className={styles.ilProgress} role="status" aria-live="polite">{progress}</div>)}
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
