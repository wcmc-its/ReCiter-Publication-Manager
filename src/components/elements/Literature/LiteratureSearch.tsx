// Literature Search — Mode 1 ("Search strategy").
//
// The deliverable on this screen is THE STRATEGY, not records. There is deliberately no
// candidate list, no screening checkbox, and no synthesis here: for a systematic review
// those belong to Covidence/Rayyan, and pretending otherwise is the failure this design
// exists to prevent. There is also no result cap — an SR search is meant to over-retrieve.
//
// THE STRATEGY IS LIVE. Every atomic term line carries a checkbox and is editable in place;
// changing anything re-counts the yield and re-validates the seeds, with NO model call (see
// the two paths in /api/literature/search). That is the centre of this screen: the librarian
// widens or narrows the search and watches the price in records, and the methods judgment
// stays with the person qualified to make it.
//
// The numbering, the query and the exported methods block all come out of ONE object — the
// current selection — via the pure functions in literatureSearch.strategy.ts, which the server
// uses too. If the screen and the count could disagree, Mode 1 would be worthless.
//
// Styling lives in LiteratureSearch.module.css, lifted from the signed-off form mockup. No
// inline style objects: the page has a design system now, and it should be edited in one place.

import { useState, useEffect, useRef, useMemo } from 'react'
import {
    Strategy,
    Concept,
    numberStrategy,
    buildLimits,
    dateLimits,
    pubTypes,
} from '../../../../controllers/literatureSearch.strategy'
import s from './LiteratureSearch.module.css'

type Seed = {
    pmid: string
    label?: string
    retrieved: boolean
    failingConcepts?: number[]
    failsLimits?: boolean
}
type DbResult = {
    db: string
    concepts: Concept[]
    limits: string
    query: string
    hits: number
    runDate: string
    seeds: Seed[]
}
type Expert = {
    personIdentifier: string
    firstName: string
    lastName: string
    primaryOrganizationalUnit: string | null
    pubs: number
}

// Only Search strategy is built. Issue review and Clinical question end in a synthesis over
// retrieved abstracts, so they need the streaming question answered first (and Clinical
// question carries the highest PHI surface -- PICO invites someone to paste a case).
const MODES = [
    { id: 'search-strategy', label: 'Search strategy', desc: 'Recall · uncapped · produces a strategy, not a synthesis', ready: true },
    { id: 'issue-review', label: 'Issue review', desc: 'Precision · top 50 · narrative synthesis', ready: false },
    { id: 'clinical-question', label: 'Clinical question', desc: 'Precision · top 50 · PICO answer', ready: false },
]

const DATABASES = [
    { id: 'pubmed', label: 'PubMed', ready: true },
    { id: 'embase', label: 'Embase', ready: false },
    { id: 'scopus', label: 'Scopus', ready: false },
]

// The mockup's rule: a PMID is 5-9 digits. Used for the live seed counter, and it is the same
// shape the server filters on, so the count on screen is the count that will be validated.
const PMID = /^\d{5,9}$/
const parseSeeds = (raw: string) => raw.split(/\s+/).map(x => x.trim()).filter(x => PMID.test(x))

// A term line: editable in place. No click-to-edit mode, no modal, no separate "Edit & re-run"
// button -- the line IS the input, and every keystroke lands in the same debounced re-count the
// checkboxes use. That retires the free-text re-run and its whole failure mode: there is no
// second copy of the query to get out of sync, and a broken line can only break its own block.
// Auto-grows because a real MeSH line runs to 600 characters and must not be a slot.
function LineInput({ value, on, onChange }: { value: string; on: boolean; onChange: (v: string) => void }) {
    const ref = useRef<HTMLTextAreaElement>(null)
    const grow = () => {
        const el = ref.current
        if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
    }
    useEffect(grow, [value])
    return (
        <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={e => onChange(e.target.value)}
            onInput={grow}
            spellCheck={false}
            className={`${s.lineInput} ${on ? '' : s.lineOff}`}
        />
    )
}

export default function LiteratureSearch() {
    const [question, setQuestion] = useState('')
    const [criteria, setCriteria] = useState('')
    const [seeds, setSeeds] = useState('')
    const [dateId, setDateId] = useState('any')
    const [typeId, setTypeId] = useState('any')
    const [busy, setBusy] = useState(false)

    // The current selection — the one object everything derives from. `result` is what the
    // server last COUNTED; `strategy` is what the librarian currently has ticked. They differ
    // only while a re-count is in flight, and the screen says so rather than showing a number
    // that belongs to a query nobody is looking at any more.
    const [strategy, setStrategy] = useState<Strategy | null>(null)
    const [result, setResult] = useState<DbResult | null>(null)
    const [recounting, setRecounting] = useState(false)

    const [experts, setExperts] = useState<{ experts: Expert[]; total: number } | null>(null)
    // ponytail: inline error state, not a toast. This page's failure paths (403 not-on-the-
    // allowlist, 503 unconfigured, 502 model error) were all routed through toast.error, but
    // no ToastContainer is ever mounted here and the AppLayout fallback is gated on a config
    // key that does not exist -- so every failure rendered as NOTHING and the button just
    // looked dead. An inline div depends on no config and cannot be silently disabled.
    const [err, setErr] = useState('')
    const [copied, setCopied] = useState('')

    const dates = useMemo(dateLimits, [])
    const types = useMemo(pubTypes, [])

    const seedList = parseSeeds(seeds)
    // The mockup's gate: a question shorter than 8 characters is not a question.
    const canBuild = question.trim().length >= 8 && !busy

    const build = async () => {
        if (!canBuild) return
        setBusy(true)
        setErr('')
        try {
            const res = await fetch('/api/literature/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, criteria, seeds, dateId, typeId }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErr(data?.message || 'Could not build the strategy.')
                return
            }
            const r: DbResult = data.databases[0]
            fresh.current = true                 // this strategy was just counted; don't re-count it
            setStrategy({ db: 'pubmed', concepts: r.concepts, limits: r.limits })
            setResult(r)
            setExperts(data.experts)
        } catch {
            setErr('Could not reach the server.')
        } finally {
            setBusy(false)
        }
    }

    // RE-COUNT after a toggle, an edit, or a change of limits. No model — so this is a handful
    // of esearch calls and the librarian can iterate as long as they like. Debounced at 300ms
    // because each run costs 1 count for the yield plus 1 per seed, and unkeyed NCBI allows only
    // 3 requests/second (set PUBMED_API_KEY on the retrieval tool to lift it to 10/s).
    const fresh = useRef(false)
    const seq = useRef(0)

    useEffect(() => {
        if (!strategy) return
        if (fresh.current) { fresh.current = false; return }

        const mine = ++seq.current
        const t = setTimeout(async () => {
            setRecounting(true)
            try {
                const res = await fetch('/api/literature/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ strategy, seeds, dateId, typeId }),
                })
                const data = await res.json()
                // A slower earlier request must never overwrite a newer count. Silently dropping
                // a stale response is the only correct thing here: the number on screen has to
                // belong to the strategy on screen.
                if (mine !== seq.current) return
                if (!res.ok) { setErr(data?.message || 'Could not re-count the strategy.'); return }
                setErr('')
                setResult(data.databases[0])
            } catch {
                if (mine === seq.current) setErr('Could not reach the server.')
            } finally {
                if (mine === seq.current) setRecounting(false)
            }
        }, 300)

        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [strategy, dateId, typeId])

    // Keep the limits on the client object in step with the dropdowns, so the line numbering
    // redraws instantly. The server re-derives them from the same ids and the same table —
    // buildLimits() is shared, which is why the two cannot drift.
    const liveStrategy: Strategy | null = strategy && { ...strategy, limits: buildLimits(dateId, typeId) }

    const editConcept = (ci: number, fn: (c: Concept) => Concept) =>
        setStrategy(st => st && { ...st, concepts: st.concepts.map((c, i) => (i === ci ? fn(c) : c)) })

    const toggle = (ci: number, li: number) =>
        editConcept(ci, c => ({ ...c, lines: c.lines.map((l, j) => (j === li ? { ...l, on: !l.on } : l)) }))

    const edit = (ci: number, li: number, terms: string) =>
        editConcept(ci, c => ({ ...c, lines: c.lines.map((l, j) => (j === li ? { ...l, terms } : l)) }))

    const addLine = (ci: number) =>
        editConcept(ci, c => ({ ...c, lines: [...c.lines, { terms: '', on: true }] }))

    const newSearch = () => { setStrategy(null); setResult(null); setExperts(null); setErr('') }

    // Same reason as the error state above: toast.success was a silent no-op here, so Copy
    // worked but never said so. Confirm on the button itself.
    const copy = (text: string, what: string) => {
        navigator.clipboard.writeText(text).then(
            () => {
                setCopied(what)
                setTimeout(() => setCopied(c => (c === what ? '' : c)), 1800)
            },
            // writeText rejects outside a secure context (plain-http over an IP). Say so rather
            // than looking like a dead button.
            () => setErr('Could not copy to the clipboard.'),
        )
    }

    // The PRISMA-S methods block — what goes in the manuscript.
    //
    // IT IS BUILT FROM `result`, NEVER FROM `strategy`. The exported block must describe the
    // query that produced the count printed beside it. If a librarian unticks two bundles and
    // then pastes a methods block describing the un-toggled strategy, we have broken the single
    // thing this feature exists to guarantee.
    const prismaBlock = (r: DbResult) => {
        const { rows } = numberStrategy({ db: 'pubmed', concepts: r.concepts, limits: r.limits })
        return [
            `Database: PubMed (via NCBI E-utilities)`,
            `Date searched: ${r.runDate}`,
            `Records retrieved: ${r.hits}`,
            ``,
            `Search strategy:`,
            ...rows
                .filter(row => row.n !== null)   // an unticked line was not searched, so it is not in the methods
                .map(row => `${row.n}. ${row.kind === 'term' ? row.line.terms : row.text}`),
            ``,
            `Full Boolean:`,
            r.query,
            ``,
            r.seeds.length
                ? `Known-item validation: ${r.seeds.filter(x => x.retrieved).length} of ${r.seeds.length} seed records retrieved (${r.seeds.map(x => x.pmid).join(', ')}).`
                : `Known-item validation: not performed.`,
        ].join('\n')
    }

    const retrieved = result ? result.seeds.filter(x => x.retrieved).length : 0
    const allFound = result && result.seeds.length > 0 && retrieved === result.seeds.length
    const numbered = liveStrategy ? numberStrategy(liveStrategy) : null
    const seedOf = (pmid?: string) => result?.seeds.find(x => x.pmid === pmid)
    const nameOf = (x?: Seed) => (x ? x.label || `PMID ${x.pmid}` : '')

    return (
        <div className={s.page}>
            {result ? (
                <div className={s.crumb}>Literature Search &nbsp;&rsaquo;&nbsp; <b>Search strategy</b></div>
            ) : (
                <>
                    <h1 className={s.title}>Literature Search</h1>
                    <p className={s.sub}>
                        Build a reproducible search strategy for a systematic review &mdash; not a finished answer.
                    </p>
                </>
            )}

            {/* THE FORM. Collapses to a one-line summary bar once a strategy exists — on a laptop
                the deliverable otherwise sits below the fold, under a form nobody is reading any
                more. "New search" brings it back. */}
            {result ? (
                <div className={s.summary}>
                    <span className={s.chip}>Search strategy</span>
                    <span className={s.summaryQ}>&ldquo;{question}&rdquo;</span>
                    <button className={s.btnSecondary} onClick={newSearch}>New search</button>
                </div>
            ) : (
                <div className={s.card}>
                    {/*
                      * The mode is a RETRIEVAL OBJECTIVE, not a template: Search strategy chases
                      * recall and ends in a handoff, the other two chase precision and end in a
                      * synthesis. Only Search strategy is built. The other two are shown DISABLED
                      * rather than hidden, so the scope of what this page does (and does not yet
                      * do) is legible instead of being a silent omission.
                      */}
                    <div className={s.field}>
                        <span className={s.eyebrow}>Mode</span>
                        <div className={s.modes} role="radiogroup" aria-label="Search mode">
                            {MODES.map(m => (
                                <label
                                    key={m.id}
                                    htmlFor={`lit-mode-${m.id}`}
                                    className={`${s.mode} ${m.ready ? s.modeSelected : s.modeDisabled}`}
                                >
                                    <input
                                        id={`lit-mode-${m.id}`}
                                        type="radio"
                                        name="lit-mode"
                                        checked={m.ready}
                                        disabled={!m.ready}
                                        readOnly
                                    />
                                    <span className={s.modeBody}>
                                        <span className={s.modeTitle}>
                                            {m.label}{!m.ready && <span className={s.soon}> &mdash; soon</span>}
                                        </span>
                                        <span className={s.modeDesc}>{m.desc}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        <p className={s.help}>
                            Search strategy produces a reproducible, peer-reviewable query. Screen and synthesize
                            the results in Covidence.
                        </p>
                    </div>

                    <div className={s.field}>
                        <label className={s.eyebrow} htmlFor="lit-q">What do you want to know?</label>
                        <textarea
                            id="lit-q"
                            className={s.input}
                            rows={2}
                            value={question}
                            onChange={e => setQuestion(e.target.value)}
                            placeholder="Do probiotics reduce symptoms of depression in adults?"
                        />
                        <p className={s.help}>
                            Your question is sent to an external AI service &mdash; do not include patient identifiers.
                        </p>
                    </div>

                    {/*
                      * Embase and Scopus are visible-but-disabled on purpose. It sets the
                      * expectation, and it keeps the query artifact an ARRAY of per-database
                      * results rather than letting a scalar sneak in.
                      */}
                    <div className={s.field}>
                        <span className={s.eyebrow}>Databases</span>
                        <div className={s.dbRow}>
                            {DATABASES.map(d => (
                                <label
                                    key={d.id}
                                    htmlFor={`lit-db-${d.id}`}
                                    className={`${s.db} ${d.ready ? '' : s.dbOff}`}
                                >
                                    <input id={`lit-db-${d.id}`} type="checkbox" checked={d.ready} disabled readOnly />
                                    {d.label}
                                    {!d.ready && <span className={s.soon}>(soon)</span>}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* THE RECALL CONTRACT. The seed count is live and turns green once armed —
                        a strategy with no seeds cannot be validated, and the pill is the cheapest
                        possible way to say so before the librarian has spent a model call. */}
                    <div className={s.requirement}>
                        <div className={s.reqHead}>
                            <label className={s.eyebrow} htmlFor="lit-seeds">Known-item seeds</label>
                            <span className={`${s.seedCount} ${seedList.length ? s.seedCountArmed : ''}`}>
                                {seedList.length === 1 ? '1 seed' : `${seedList.length} seeds`}
                            </span>
                        </div>
                        {/* 5 rows, not 2: the librarian names 3-5 seeds, and at 2 rows the first PMID
                            scrolled out of its own box the moment a fourth was added. */}
                        <textarea
                            id="lit-seeds"
                            className={`${s.input} ${s.mono}`}
                            rows={5}
                            value={seeds}
                            onChange={e => setSeeds(e.target.value)}
                            placeholder="PMIDs, one per line — papers this search MUST retrieve"
                        />
                        <p className={s.help}>
                            We run the strategy and report whether each one came back.{' '}
                            <b>A strategy that misses a known include is broken.</b>
                        </p>
                    </div>

                    <div className={s.requirement}>
                        <label className={s.eyebrow} htmlFor="lit-crit">Inclusion / exclusion criteria &mdash; optional</label>
                        <textarea
                            id="lit-crit"
                            className={s.input}
                            rows={2}
                            value={criteria}
                            onChange={e => setCriteria(e.target.value)}
                            placeholder="e.g. RCTs only; adults; validated depression scales; exclude preclinical"
                        />
                        <p className={s.help}>Shapes the query.</p>
                    </div>

                    {/*
                      * LIMITS ARE DROPDOWNS, NOT PROSE. They used to be a free-text box passed to
                      * the model, which meant the MODEL decided what "2021-2026" meant -- a quiet
                      * hole in the one thing this mode promises. The ids resolve to PubMed syntax
                      * server-side, by a table both ends share.
                      */}
                    <div className={s.controls}>
                        <div className={s.control}>
                            <label htmlFor="lit-date">Date</label>
                            <select id="lit-date" className={s.input} value={dateId} onChange={e => setDateId(e.target.value)}>
                                {dates.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                            </select>
                        </div>
                        <div className={s.control}>
                            <label htmlFor="lit-type">Publication type</label>
                            <select id="lit-type" className={s.input} value={typeId} onChange={e => setTypeId(e.target.value)}>
                                {types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                        </div>
                        <span className={s.spacer} />
                        <button className={s.btn} onClick={build} disabled={!canBuild}>
                            {busy ? 'Building strategy…' : 'Build strategy'}
                        </button>
                    </div>

                    <p className={s.capNote}>
                        <b>No result cap in this mode.</b> A systematic-review search is designed to over-retrieve:
                        a 5,000-record yield is a success, not an error.
                    </p>
                </div>
            )}

            {err && <div role="alert" className={s.error}>{err}</div>}

            {result && liveStrategy && numbered && (
                <>
                    {/* THE DELIVERABLE — PRESS-numbered, line by line, every atomic line toggleable
                        and editable. This is the form a strategy is peer-reviewed in, and it is
                        also the only form a checkbox can sit on. */}
                    <section className={s.panel} aria-live="polite">
                        <div className={s.panelHead}>
                            <h2 className={s.panelTitle}>PubMed</h2>
                            <span className={`${s.hits} ${recounting ? s.hitsStale : ''}`}>
                                {result.hits.toLocaleString()} <span>records</span>
                            </span>
                            {recounting && <span className={s.recounting}>re-counting…</span>}
                        </div>

                        <div className={s.lines}>
                            {numbered.rows.map((row, i) => {
                                // A combination line (6 = 4 OR 5) is DERIVED. No checkbox: there is
                                // nothing to decide about it, it recomputes from the lines above.
                                if (row.kind === 'combine') {
                                    return (
                                        <div className={s.line} key={`c${i}`}>
                                            <span style={{ width: 16, flexShrink: 0 }} />
                                            <span className={s.lineNum}>{row.n}</span>
                                            <span className={s.combine}>{row.text}</span>
                                        </div>
                                    )
                                }

                                const seed = seedOf(row.line.suggestedFor)
                                return (
                                    <div key={`t${row.ci}-${row.li}`}>
                                        <div className={s.line}>
                                            <input
                                                type="checkbox"
                                                className={s.lineCheck}
                                                checked={row.line.on}
                                                onChange={() => toggle(row.ci, row.li)}
                                                aria-label={`Include line: ${row.line.terms.slice(0, 60)}`}
                                            />
                                            <span className={s.lineNum}>{row.n ?? '·'}</span>
                                            <LineInput
                                                value={row.line.terms}
                                                on={row.line.on}
                                                onChange={v => edit(row.ci, row.li, v)}
                                            />
                                        </div>
                                        {/* The model's proposed widening: a LINE, not a paragraph. Verified
                                            (it really does retrieve that seed, against the whole strategy)
                                            and priced (what ticking it costs in records to screen). That
                                            trade is the judgment the librarian is here to make. */}
                                        {row.line.suggestedFor && !row.line.on && (
                                            <div className={s.suggest}>
                                                Suggested: retrieves {nameOf(seed)}
                                                {typeof row.line.costRecords === 'number' && (
                                                    <> &middot; <b>+{row.line.costRecords.toLocaleString()} records</b> to screen</>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}

                            {!numbered.rows.some(r => r.kind === 'term' && r.n !== null) && (
                                <div className={s.empty}>Nothing is ticked, so there is no strategy to run.</div>
                            )}

                            <div className={s.addLines}>
                                {liveStrategy.concepts.map((c, ci) => (
                                    <button key={ci} className={s.addLine} onClick={() => addLine(ci)}>
                                        + line to {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={s.panelFoot}>
                            <span>Run {result.runDate}{result.limits ? ` · limits: ${result.limits}` : ' · no limits'}</span>
                            <span className={s.spacer} />
                            <span>Tick, untick or edit any line &mdash; it re-counts for free.</span>
                            <button
                                className={`${s.btnSecondary} ${copied === 'query' ? s.btnSecondaryDone : ''}`}
                                onClick={() => copy(result.query, 'query')}
                                disabled={!result.query}
                            >
                                {copied === 'query' ? '✓ Copied' : 'Copy query'}
                            </button>
                        </div>
                    </section>

                    {/* A Cochrane-compliant search needs Embase and CENTRAL too. The card says so
                        out loud — and keeps the artifact an array. */}
                    <div className={s.pending}>
                        <div className={s.pendingHead}>
                            <span className={s.eyebrow}>Embase</span>
                            <span className={s.expertsCount}>not searched</span>
                        </div>
                        <div className={s.pendingNote}>
                            A Cochrane-compliant search needs Embase and CENTRAL too. Coming soon.
                        </div>
                    </div>

                    {/* KNOWN-ITEM VALIDATION — the thing that makes an LLM-drafted Boolean defensible. */}
                    <div className={`${s.card} ${s.validation}`}>
                        <div className={s.valHead}>
                            <span className={s.eyebrow}>Known-item validation</span>
                            {result.seeds.length > 0 && (
                                <span className={`${s.valScore} ${allFound ? '' : s.valScoreWarn} ${recounting ? s.hitsStale : ''}`}>
                                    {retrieved} of {result.seeds.length} retrieved
                                </span>
                            )}
                        </div>

                        {/* NO SEEDS = NO RECALL CHECK. Saying so is the whole ethic of this feature:
                            an unvalidated strategy is a guess, and a guess that stays quiet reads
                            exactly like a strategy that passed. */}
                        {result.seeds.length === 0 ? (
                            <div className={s.recallLine}>
                                <span className={`${s.dot} ${s.dotWarn}`} />
                                <span>
                                    No known-item seeds provided &mdash; <b>recall cannot be verified.</b> Add PMIDs
                                    of papers this search must retrieve, and re-run, to make this strategy testable.
                                </span>
                            </div>
                        ) : (
                            <>
                                <div className={s.seeds}>
                                    {result.seeds.map(x => {
                                        const failing = (x.failingConcepts || [])
                                            .map(i => ({ label: result.concepts[i]?.label, lines: numbered.conceptLines[i] || [] }))
                                            .filter(f => f.label)
                                        return (
                                            <div className={s.seed} key={x.pmid}>
                                                <span className={`${s.seedMark} ${x.retrieved ? s.seedHit : s.seedMiss}`}>
                                                    {x.retrieved ? '✓' : '✗'}
                                                </span>
                                                {/* Author + year, not a bare PMID: a librarian who named four
                                                    seeds cannot tell which paper missed from an 8-digit number. */}
                                                {x.label && <span className={s.seedName}>{x.label}</span>}
                                                <span className={s.seedId}>PMID {x.pmid}</span>
                                                {!x.retrieved && <span className={s.verdict}>Not retrieved</span>}

                                                {/* The reason is DERIVED by re-counting the seed against each
                                                    block AND the limits, never guessed by the model. A paper can
                                                    fail both at once, so both are reported — naming only the
                                                    block sends a librarian off to widen a search that still
                                                    cannot return it. */}
                                                {!x.retrieved && (
                                                    <span className={s.why}>
                                                        {!failing.length && !x.failsLimits && (
                                                            <>Nothing is ticked, so there is no strategy to retrieve it.</>
                                                        )}
                                                        {failing.length > 0 && (
                                                            <>
                                                                Excluded by the{' '}
                                                                {failing.map((f, k) => (
                                                                    <span key={k}>
                                                                        {k > 0 && ' and '}
                                                                        <b>{f.label}</b>
                                                                        {f.lines.length > 0 && (f.lines.length > 1
                                                                            ? ` (lines ${f.lines[0]}–${f.lines[f.lines.length - 1]})`
                                                                            : ` (line ${f.lines[0]})`)}
                                                                    </span>
                                                                ))}
                                                                {failing.length > 1 ? ' blocks' : ' block'}.{' '}
                                                            </>
                                                        )}
                                                        {x.failsLimits && (
                                                            <>
                                                                {failing.length > 0 ? <>It also fails your </> : <>It matches every block you have ticked, so your </>}
                                                                <b>limits</b>
                                                                {failing.length > 0
                                                                    ? <>, so widening the {failing.length > 1 ? 'blocks' : 'block'} alone will not bring it back &mdash; change the date range or publication type.</>
                                                                    : <> are what exclude it &mdash; change the date range or publication type.</>}
                                                            </>
                                                        )}
                                                        {failing.length > 0 && !x.failsLimits && (
                                                            <>Widen {failing.length > 1 ? 'them' : 'it'} to retrieve this paper &mdash; a
                                                                suggested line may already be waiting, unticked, in the strategy above.</>
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {allFound ? (
                                    <div className={s.recallLine}>
                                        <span className={s.dot} />
                                        <span>Every known include came back. This strategy is validated against its seeds.</span>
                                    </div>
                                ) : (
                                    result.seeds.some(x => !x.retrieved && x.failingConcepts?.length) && (
                                        <p className={s.help}>
                                            A strategy that misses a known include is not yet finished. Widen the failing
                                            block &mdash; the yield will grow, and that is the trade.
                                        </p>
                                    )
                                )}
                            </>
                        )}
                    </div>

                    {/* AT WEILL CORNELL — works with no records at all, straight off the query's MeSH. */}
                    {experts && experts.experts.length > 0 && (
                        <div className={`${s.card} ${s.experts}`}>
                            <div className={s.expertsHead}>
                                <span className={s.eyebrow}>At Weill Cornell</span>
                                <span className={s.expertsCount}>
                                    top {experts.experts.length} of <b>{experts.total.toLocaleString()}</b> faculty
                                    publishing on these MeSH terms
                                </span>
                            </div>
                            <div className={s.expertsList}>
                                {experts.experts.map(e => (
                                    <div className={s.expert} key={e.personIdentifier}>
                                        <span className={s.expertName}>{e.firstName} {e.lastName}</span>
                                        <span className={`${s.expertDept} ${e.primaryOrganizationalUnit ? '' : s.expertDeptBlank}`}>
                                            {e.primaryOrganizationalUnit || 'department not recorded'}
                                        </span>
                                        <span className={s.expertPubs}>{e.pubs} pubs</span>
                                    </div>
                                ))}
                            </div>
                            <div className={s.expertsFoot}>Ranked by accepted publications.</div>
                        </div>
                    )}

                    <div className={s.actions}>
                        <button
                            className={s.btn}
                            onClick={() => copy(prismaBlock(result), 'prisma')}
                            disabled={recounting || !result.query}
                        >
                            {copied === 'prisma' ? '✓ Copied — paste into your manuscript' : 'Copy PRISMA-S methods block'}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
