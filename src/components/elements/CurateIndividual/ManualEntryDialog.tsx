import React, { FunctionComponent, useEffect, useRef, useState } from "react"
import { toast } from "react-toastify"
import styles from "./CurateIndividual.module.css"
import { Button, Dialog } from "../../ui"
import { reciterConfig } from "../../../../config/local"
import {
    MAN_EMPTY, ManualForm, FieldKey, FormErrors, PUB_TYPE_GROUPS, manFieldsFor, splitNames, targetBySurname,
    effectiveRole, prDefaultOf, validateForm, newManualBody, editPatchOf, formFromRecord, lookupKindOf,
    formFromCrossref, formFromOpenAlex,
} from "../../../utils/manualEntry"
import { defaultRole } from "../../../lib/pubTypes"

// Plan 3b-3e, 3d: the manual entry Dialog. Opened from the Add publication dialog ("Enter
// manually", and the search's no-results row) to add a work by hand, and from Edit on an accepted
// manual row in All sources. Only offered with the external record store (EXTERNAL_STORE=mysql);
// the add and edit routes refuse MANUAL records without it.
//   - Look up: a DOI, PMID or ISBN. The person's record is checked first (dupcheck); a PMID, or a
//     DOI PubMed holds, goes to the scored PubMed add flow and never becomes a MANUAL record; a
//     DOI is looked up in Crossref, then OpenAlex; an ISBN in Crossref.
//   - The form: a type from the grouped pills, the type's fields, role and peer review defaults,
//     the person's position in the author list, live duplicate check on blur of title and DOI.
//   - Save: POST /api/db/external/<uid> (sourceType MANUAL; the server mints MANUAL:<uuid>,
//     provenance MANUAL, status ACCEPTED), or PATCH /api/db/external/record/<id> for an edit.
// Layout follows the UI refresh prototype's MANUAL ENTRY dialog.

export type ManualEntryMode =
    | { kind: 'create', query?: string, fromSearch?: boolean }
    | { kind: 'edit', record: any }

interface FuncProps {
    open: boolean,
    onClose: () => void,
    mode: ManualEntryMode,
    uid: string,
    fullName: string,
    // Back to the Add publication dialog (create, opened from it).
    onBackToSearch?: () => void,
    // The record was created or changed; `created` is false for an edit.
    onSaved: (record: any, created: boolean) => void,
    getPmidStatus: (pmid: number) => 'ACCEPTED' | 'REJECTED' | 'PENDING' | null,
    // The scored PubMed add flow for a PMID (search it in the PubMed add view).
    onAddViaPubMed: (pmid: number) => void,
    onOpenSuggested: () => void,
}

const apiHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: reciterConfig.backendApiKey,
}

const post = async (url: string, body: any, method = 'POST') => {
    const r = await fetch(url, { credentials: "same-origin", method, headers: apiHeaders, body: JSON.stringify(body) })
    const json = await r.json().catch(() => ({}))
    return { status: r.status, body: json }
}

type Msg = { tone: 'info' | 'warn', text: string, act?: string, go?: () => void }
type Dup = { level: 'BLOCKED' | 'WARNING', matches: any[] }

const pubMedUrl = 'https://pubmed.ncbi.nlm.nih.gov/'
const doiUrl = 'https://doi.org/'
const PMID_TYPES = new Set(['PMID_IN_GOLD_STANDARD', 'PMID_REJECTED_IN_GOLD_STANDARD', 'PMID_IN_CANDIDATES', 'DOI_MATCH', 'TITLE_YEAR_MATCH'])

const ManualEntryDialog: FunctionComponent<FuncProps> = (props) => {
    const { mode, uid } = props
    const fullName = (props.fullName || '').trim().replace(/\s+/g, ' ')
    const edit = mode.kind === 'edit' ? mode.record : null
    const nameParts = (fullName || '').trim().split(/\s+/).filter(Boolean)
    const short = nameParts[0] || 'this person'
    const surname = nameParts[nameParts.length - 1] || ''

    const [step, setStep] = useState<'id' | 'form'>(edit ? 'form' : 'id')
    // The form was reached from the Look up step (so "← Back" returns to it).
    const [viaId, setViaId] = useState(false)
    const [q, setQ] = useState('')
    const [msg, setMsg] = useState<Msg | null>(null)
    const [f, setF] = useState<ManualForm>(edit ? formFromRecord(edit) : MAN_EMPTY)
    const [from, setFrom] = useState<string>(edit?.fields?.detailsFrom || '')
    const [err, setErr] = useState<FormErrors>({})
    const [dup, setDup] = useState<Dup | null>(null)
    const [busy, setBusy] = useState<'' | 'lookup' | 'save'>('')
    // The person's position follows the author list (surname match) until the curator picks one.
    const [targetPicked, setTargetPicked] = useState<boolean>(!!edit)
    const dupSeq = useRef(0)
    // The duplicate box sits under the fields; bring it into view when it appears.
    const dupRef = useRef<HTMLDivElement>(null)

    const where = (m: any): string => {
        if (PMID_TYPES.has(m.type)) {
            const st = props.getPmidStatus(Number(m.matchedId))
            return st === 'PENDING' ? 'PubMed › Suggested' : st === 'REJECTED' ? 'PubMed › Rejected' : st === 'ACCEPTED' ? 'PubMed › Accepted' : `PMID ${m.matchedId}`
        }
        return 'All sources'
    }

    const fromLookup = (form: ManualForm, source: string, note?: string) => {
        const names = splitNames(form.authors)
        setF({ ...form, target: form.target ?? targetBySurname(names, surname) })
        setTargetPicked(false)
        setFrom(source)
        setErr({})
        setDup(null)
        setStep('form')
        setViaId(true)
        setMsg(note ? { tone: 'info', text: note } : null)
    }

    const toForm = (patch: Partial<ManualForm>, m: Msg | null) => {
        setF({ ...MAN_EMPTY, ...patch })
        setTargetPicked(false)
        setFrom('')
        setErr({})
        setDup(null)
        setStep('form')
        setViaId(true)
        setMsg(m)
    }

    const pmidRoute = (pmid: number, viaDoi: boolean) => {
        const st = props.getPmidStatus(pmid)
        if (st === 'PENDING') {
            setMsg({ tone: 'info', text: `PMID ${pmid} is already a ReCiter suggestion for ${short}. It belongs in PubMed › Suggested, where accepting it also trains ReCiter.`, act: 'Open in Suggested', go: props.onOpenSuggested })
            return
        }
        if (st) { setMsg({ tone: 'info', text: `PMID ${pmid} is already in ${short}'s record (PubMed › ${st === 'ACCEPTED' ? 'Accepted' : 'Rejected'}).` }); return }
        setMsg({
            tone: 'info',
            text: `${viaDoi ? `This DOI is in PubMed as PMID ${pmid}. ` : ''}PubMed articles are added through ReCiter, so they're scored and become part of the gold standard.`,
            act: `Add PMID ${pmid} via PubMed`, go: () => props.onAddViaPubMed(pmid),
        })
    }

    // The record first: an identifier already on the person's record (or among their PubMed
    // candidates) is not entered again.
    const recordHit = async (record: any): Promise<boolean> => {
        const r = await post('/api/db/external/dupcheck', { uid, record })
        if (r.status !== 200 || r.body?.level !== 'BLOCKED') return false
        const m = (r.body.matches || [])[0] || {}
        if (PMID_TYPES.has(m.type) && props.getPmidStatus(Number(m.matchedId)) === 'PENDING') { pmidRoute(Number(m.matchedId), false); return true }
        setMsg({ tone: 'warn', text: `Already in ${short}'s record (${where(m)})${m.title ? `: “${m.title}”` : '.'}` })
        return true
    }

    const lookup = async (raw?: string) => {
        const { kind, value } = lookupKindOf(raw ?? q)
        setMsg(null)
        if (!value) { setMsg({ tone: 'warn', text: 'Enter a DOI, PMID or ISBN, or enter the details by hand.' }); return }
        if (kind === 'pmid') { pmidRoute(Number(value), false); return }
        if (!kind) {
            toForm({ title: value }, { tone: 'info', text: 'That doesn’t look like a DOI, PMID or ISBN. Enter the details below.' })
            return
        }
        setBusy('lookup')
        try {
            if (kind === 'doi') {
                if (await recordHit({ sourceType: 'MANUAL', doi: value })) return
                const pm = await post('/api/reciter/search/pubmed-by-doi', { doi: value }).catch(() => null)
                if (pm && pm.status === 200 && pm.body?.pmid) { pmidRoute(Number(pm.body.pmid), true); return }
                const cr = await post('/api/reciter/search/crossref', { query: value }).catch(() => null)
                const crRow = cr && cr.status === 200 && Array.isArray(cr.body?.results) ? cr.body.results[0] : null
                if (crRow) { const p = formFromCrossref(crRow, { personSurname: surname }); fromLookup(p.form, 'Crossref', p.note); return }
                const oa = await post('/api/reciter/search/openalex', { query: value, source: 'OPENALEX' }).catch(() => null)
                const oaRow = oa && oa.status === 200 && Array.isArray(oa.body?.results) ? oa.body.results[0] : null
                if (oaRow?.pmid) { pmidRoute(Number(oaRow.pmid), true); return }
                if (oaRow) { const p = formFromOpenAlex(oaRow, { personSurname: surname }); fromLookup(p.form, 'OpenAlex', p.note); return }
                toForm({ doi: value }, { tone: 'info', text: 'Nothing found in Crossref or OpenAlex for that DOI. Enter the details below.' })
                return
            }
            // ISBN: Crossref's isbn filter; the book itself is preferred over its chapters.
            const cr = await post('/api/reciter/search/crossref', { query: value }).catch(() => null)
            const rows: any[] = cr && cr.status === 200 && Array.isArray(cr.body?.results) ? cr.body.results : []
            const book = rows.find((r) => /book|monograph/.test(String(r.publicationType || '')) && !/chapter|part|section/.test(String(r.publicationType || ''))) || rows[0]
            if (book) { const p = formFromCrossref(book, { isbn: true, personSurname: surname }); fromLookup({ ...p.form, isbn: p.form.isbn || value }, 'Crossref', p.note); return }
            toForm({ isbn: value, type: 'Book' }, { tone: 'info', text: 'Nothing found in Crossref for that ISBN. Enter the details below.' })
        } finally {
            setBusy('')
        }
    }

    // Open: a query carried over from the Add publication search is looked up (an identifier) or
    // becomes the title (several words), as the prototype's manFromSearch did.
    useEffect(() => {
        if (mode.kind !== 'create') return
        const query = (mode.query || '').trim()
        if (!query) return
        const { kind } = lookupKindOf(query)
        if (kind) { setQ(query); lookup(query) } else if (query.split(/\s+/).length > 3) { toForm({ title: query }, null); setViaId(false) }
        else setQ(query)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Live duplicate check (on blur of the DOI or the title).
    const runDupCheck = async (form: ManualForm): Promise<Dup | null> => {
        const body = newManualBody(form)
        if (!body.title && !body.doi) { setDup(null); return null }
        const seq = ++dupSeq.current
        const r = await post('/api/db/external/dupcheck', { uid, record: body, excludeId: edit ? Number(edit.id) : undefined }).catch(() => null)
        if (seq !== dupSeq.current || !r || r.status !== 200) return null
        const next = r.body.level === 'BLOCKED' || r.body.level === 'WARNING' ? { level: r.body.level, matches: r.body.matches || [] } as Dup : null
        setDup(next)
        return next
    }

    const set = (k: FieldKey, v: any) => {
        setF((cur) => {
            const next = { ...cur, [k]: v }
            if (k === 'authors') {
                const names = splitNames(v)
                if (!targetPicked) next.target = targetBySurname(names, surname)
                else if (next.target && next.target > names.length) next.target = null
            }
            return next
        })
        setErr((e) => ({ ...e, [k]: undefined }))
        if (dup && dup.level === 'WARNING') setDup(null)
    }

    const setType = (t: string) => {
        setF((cur) => ({ ...cur, type: t }))
        setErr({})
        setDup(null)
    }

    const authors = splitNames(f.authors)
    const move = (i: number, d: -1 | 1) => {
        const j = i + d
        if (j < 0 || j >= authors.length) return
        const next = [...authors]
        ;[next[i], next[j]] = [next[j], next[i]]
        const t = f.target === i + 1 ? j + 1 : f.target === j + 1 ? i + 1 : f.target
        setF((cur) => ({ ...cur, authors: next.join('; '), target: t }))
    }

    const save = async (force: boolean) => {
        const errors = validateForm(f)
        if (Object.keys(errors).length) { setErr(errors); setDup(null); return }
        if (dup && dup.level === 'BLOCKED') return
        setBusy('save')
        try {
            if (edit) {
                const d = await runDupCheck(f)
                if (d && (d.level === 'BLOCKED' || !force)) return
                const r = await post(`/api/db/external/record/${encodeURIComponent(String(edit.id))}`, editPatchOf(f, edit), 'PATCH')
                if (r.status !== 200) { toast.error('Could not save: ' + (r.body?.message || `HTTP ${r.status}`)); return }
                toast.success(`Saved changes to “${f.title.trim()}”`)
                props.onSaved(r.body.external, false)
                return
            }
            const r = await post(`/api/db/external/${encodeURIComponent(uid)}${force ? '?force=true' : ''}`, newManualBody(f, { detailsFrom: from || null }))
            if (r.status === 201 || r.status === 200) {
                toast.success(`Added to ${short}'s record: ${f.title.trim()}`)
                props.onSaved(r.body.external, true)
                return
            }
            const payload = r.body?.message
            if (r.status === 409 && payload && (payload.status === 'BLOCKED' || payload.status === 'WARNING')) {
                setDup({ level: payload.status, matches: payload.matches || [] })
                return
            }
            toast.error('Could not add: ' + ((payload && (payload.message || payload)) || `HTTP ${r.status}`))
        } catch (e: any) {
            toast.error('Could not save: ' + (e?.message || e))
        } finally {
            setBusy('')
        }
    }

    const fields = manFieldsFor(f, short)
    const prDef = prDefaultOf(f)

    const chipValue = (key: string): string[] => {
        if (key === 'role') return [effectiveRole(f)]
        if (key === 'pr') return [f.pr || (prDef ? 'Peer-reviewed' : 'Not peer-reviewed')]
        if (key === 'audience') return f.audience.split('; ').filter(Boolean)
        return [String((f as any)[key] || '')]
    }
    const pickChip = (key: string, c: string, multi?: boolean) => {
        if (multi) {
            const sel = chipValue(key)
            set(key as FieldKey, (sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c]).join('; '))
        } else if (key === 'pr') set('pr', (c === 'Peer-reviewed') === prDef ? '' : c)
        else if (key === 'role') set('role', c === defaultRole(f.type) ? '' : c)
        else set(key as FieldKey, c)
    }

    const title = edit ? 'Edit publication' : 'Add publication'
    const desc = edit ? `Manually added to ${fullName}'s record.`
        : `For ${fullName}. For works not in PubMed: books, chapters, conference papers, reports and the like.`
    const fromSearch = mode.kind === 'create' && !!mode.fromSearch

    const field = (s: ReturnType<typeof manFieldsFor>[number]) => {
        const label = s.label + (s.required ? ' *' : '')
        const e = s.key !== 'pr' ? err[s.key] : undefined
        if (s.check) {
            const on = (f as any)[s.key] === 'yes'
            return (
                <button key={s.key} type="button" role="checkbox" aria-checked={on} className={styles.meCheck} data-wide={s.wide || undefined}
                    onClick={() => set(s.key as FieldKey, on ? '' : 'yes')}>
                    <span className={styles.meBox}>{on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}</span>
                    {s.check}
                </button>
            )
        }
        if (s.chips) {
            const sel = chipValue(s.key)
            const note = s.key === 'pr' ? (f.pr ? 'Changed from the default' : `Default for ${f.type === 'Educational Material' ? 'this repository' : 'this type'}`)
                : s.multi ? 'Pick any that apply' : ''
            return (
                <div key={s.key} className={styles.meChips} data-wide={s.wide || undefined}>
                    <span className={styles.meChipsLabel} id={`me-${s.key}`}>{label}{note && <span className={styles.meChipsNote}>{note}</span>}</span>
                    <div className={styles.mePills} role={s.multi ? 'group' : 'radiogroup'} aria-labelledby={`me-${s.key}`}>
                        {s.chips.map((c) => (
                            <button key={c} type="button" role={s.multi ? 'checkbox' : 'radio'} aria-checked={sel.includes(c)} className={styles.meChip}
                                onClick={() => pickChip(s.key, c, s.multi)}>{c}</button>
                        ))}
                    </div>
                    {e && <span className={styles.meErr}>{e}</span>}
                </div>
            )
        }
        const k = s.key as FieldKey
        const onBlur = k === 'doi' || k === 'title' ? () => { runDupCheck(f) } : undefined
        return (
            <label key={k} className={styles.meField} data-wide={s.wide || undefined}>
                {label}
                {k === 'authors' ? (
                    <textarea className={styles.meArea} rows={3} value={f.authors} placeholder={s.hint} aria-invalid={!!e}
                        onChange={(ev) => set('authors', ev.target.value)} />
                ) : (
                    <input className={styles.meInput} value={String((f as any)[k] ?? '')} placeholder={s.hint} aria-invalid={!!e}
                        onChange={(ev) => set(k, ev.target.value)} onBlur={onBlur} />
                )}
                {e && <span className={styles.meErr}>{e}</span>}
            </label>
        )
    }

    // The person's position: a radio per name, in byline order (reorderable), plus "Not listed".
    const picker = authors.length > 0 && (
        <div key="picker" className={styles.meAuthors} role="radiogroup" aria-label={`${short}'s position in the author list`}>
            <span className={styles.meAuthorsHead}>Which one is {short}?<span>Sets the author position in reports.</span></span>
            {authors.map((a, i) => (
                <div key={i + a} className={styles.meAuthor}>
                    <span className={styles.meAuthorNum}>{i + 1}</span>
                    <label>
                        <input type="radio" name="me-target" checked={f.target === i + 1}
                            onChange={() => { setTargetPicked(true); setF((cur) => ({ ...cur, target: i + 1 })) }} />
                        {f.target === i + 1 ? <strong>{a}</strong> : a}
                    </label>
                    <button type="button" className={styles.meOrder} aria-label={`Move ${a} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button type="button" className={styles.meOrder} aria-label={`Move ${a} down`} disabled={i === authors.length - 1} onClick={() => move(i, 1)}>↓</button>
                </div>
            ))}
            <div className={styles.meAuthor}>
                <span className={styles.meAuthorNum} />
                <label>
                    <input type="radio" name="me-target" checked={!f.target}
                        onChange={() => { setTargetPicked(true); setF((cur) => ({ ...cur, target: null })) }} />
                    Not listed / not sure
                </label>
            </div>
        </div>
    )

    useEffect(() => { if (dup) dupRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [dup])

    const dupBox = dup && (
        <div ref={dupRef} className={styles.meDup} data-level={dup.level} role="status">
            <span className={styles.meDupTitle}>{dup.level === 'BLOCKED' ? `Already in ${short}'s record` : 'Possible duplicate'}</span>
            <span className={styles.meDupText}>
                {dup.level === 'BLOCKED' ? 'This work is already on the record, so it can’t be added again.'
                    : `If it's the same work, cancel; otherwise ${edit ? 'save' : 'add'} it anyway.`}
            </span>
            {dup.matches.map((m, i) => {
                const isPmid = PMID_TYPES.has(m.type)
                return (
                    <div key={i} className={styles.meDupMatch}>
                        <strong>{m.title || m.matchedId}</strong>
                        <span>
                            {m.detail}
                            {' · '}
                            {isPmid
                                ? <a href={`${pubMedUrl}${m.matchedId}`} target="_blank" rel="noreferrer">PMID {m.matchedId} ↗</a>
                                : <>{where(m)} · <span>{m.matchedId}</span></>}
                            {!isPmid && m.type === 'DOI_MATCH_EXTERNAL' && f.doi && <> · <a href={`${doiUrl}${f.doi}`} target="_blank" rel="noreferrer">DOI ↗</a></>}
                        </span>
                    </div>
                )
            })}
            {dup.level === 'WARNING' && (
                <button type="button" className={styles.meAnyway} onClick={() => save(true)} disabled={!!busy}>{edit ? 'Save anyway' : 'Add anyway'}</button>
            )}
        </div>
    )

    const footer = (
        <>
            {step === 'form' && !edit && viaId && <Button variant="ghost" onClick={() => { setStep('id'); setMsg(null); setErr({}); setDup(null); setFrom(''); setF(MAN_EMPTY); setTargetPicked(false) }}>← Back</Button>}
            {fromSearch && !(step === 'form' && viaId) && props.onBackToSearch && <Button variant="ghost" onClick={props.onBackToSearch}>← Back to search</Button>}
            <Button onClick={props.onClose}>Cancel</Button>
            {step === 'form' && (
                <Button variant="primary" onClick={() => save(false)} disabled={!!busy || dup?.level === 'BLOCKED'}>
                    {busy === 'save' ? 'Saving…' : edit ? 'Save changes' : `Add to ${short}'s record`}
                </Button>
            )}
        </>
    )

    return (
        <Dialog open={props.open} onClose={props.onClose} width={672} title={title} description={desc} footer={footer}>
            <div className={styles.meBody}>
                {step === 'id' && (
                    <form className={styles.meSection} onSubmit={(e) => { e.preventDefault(); lookup() }}>
                        <label className={styles.meIdLabel} htmlFor="me-id">DOI, PMID or ISBN</label>
                        <div className={styles.meIdRow}>
                            <input id="me-id" className={styles.meIdInput} value={q} autoFocus
                                onChange={(e) => { setQ(e.target.value); setMsg(null) }} placeholder="10.xxxx/… or 12345678 or 978-…" />
                            <Button type="submit" variant="primary" disabled={busy === 'lookup'}>{busy === 'lookup' ? 'Looking up…' : 'Look up'}</Button>
                        </div>
                        <span className={styles.meHint}>Looks in Crossref and OpenAlex, and checks {short}&apos;s record first.</span>
                    </form>
                )}
                {msg && (
                    <div className={styles.meMsg} data-tone={msg.tone} role="status">
                        <span>{msg.text}</span>
                        {msg.act && <button type="button" className={styles.meMsgBtn} onClick={msg.go}>{msg.act}</button>}
                    </div>
                )}
                {step === 'id' && (
                    <button type="button" className={styles.meSkip} onClick={() => { setStep('form'); setViaId(true); setMsg(null); setFrom('') }}>
                        No identifier? Enter the details by hand →
                    </button>
                )}
                {step === 'form' && (
                    <>
                        {from && !edit && <span className={styles.meFrom}>✓ Details from {from}. Check them before saving.</span>}
                        <div className={styles.meSection}>
                            <span className={styles.meSectionLabel} id="me-type">Type</span>
                            {PUB_TYPE_GROUPS.map((g) => (
                                <div key={g.key} className={styles.meFam}>
                                    <span className={styles.meFamLabel}>{g.label}</span>
                                    <div className={styles.mePills} role="radiogroup" aria-label={g.label}>
                                        {g.types.map((t) => (
                                            <button key={t} type="button" role="radio" aria-checked={f.type === t} className={styles.mePill} onClick={() => setType(t)}>{t}</button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {err.type && <span className={styles.meErr}>{err.type}</span>}
                        </div>
                        <div className={styles.meGrid}>
                            {fields.flatMap((s) => (s.key === 'authors' ? [field(s), picker] : [field(s)]))}
                        </div>
                        {dupBox}
                    </>
                )}
            </div>
        </Dialog>
    )
}

export default ManualEntryDialog
