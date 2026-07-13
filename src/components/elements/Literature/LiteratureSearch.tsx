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
// Styling uses the calm tokens from styles/globals.css. No new visual vocabulary.

import { useState, useEffect, useRef, useMemo } from 'react'
import {
    Strategy,
    Concept,
    numberStrategy,
    buildLimits,
    dateLimits,
    pubTypes,
} from '../../../../controllers/literatureSearch.strategy'

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

// CONTRAST. The calm palette's hint gray #8a94a6 measures 3.06:1 on white -- it fails WCAG AA
// for body text (4.5:1) and, at 11-12px, fails the large-text exception too. Every helper line
// on this page used it, INCLUDING the "do not include patient identifiers" warning, which made
// the one line that most needs reading the least legible thing on the screen. Descriptive text
// now uses the muted token #5a6478 (5.95:1, passes AA). Nothing on this page uses #8a94a6 for
// text any more -- notably NOT the concept-block line numbers, which look decorative but are
// how a PRESS peer reviewer cites the strategy ("line 3 AND line 6"). They are content.
//
// NOTE: #8a94a6 is the house hint color app-wide (see STYLEGUIDE), so it fails AA on /curate and
// /authorships too. Fixing it properly is a one-token change in globals.css -- not this page's
// call to make unilaterally.
const INK = '#1a2133'      // 16.0:1
const MUTED = '#5a6478'    //  5.95:1 -- AA for body
const ACCENT = '#2563a8'
const BORDER = '#e8e2d9'
const DIVIDER = '#f0ece5'
const SUBTLE = '#faf8f5'
const DANGER_BG = '#fee2e2'
const DANGER = '#991b1b'

const card: React.CSSProperties = {
    background: 'var(--color-surface, #fff)',
    border: `0.5px solid ${BORDER}`,
    borderRadius: 'var(--radius-md, 6px)',
    padding: '24px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
}
// The uppercase/600/tracked treatment is what marks these as section labels -- the color is not
// doing that work, so darkening it costs nothing and buys legibility.
const sec: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: MUTED,
}
// Helper text is CONTENT, not chrome: it carries the PHI warning and the known-item rationale.
// 13px/1.5 at AA contrast, rather than 12px of the faintest gray in the palette.
const hint: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, color: MUTED }
const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
const input: React.CSSProperties = {
    font: 'inherit', padding: '10px 12px', border: `0.5px solid ${BORDER}`, borderRadius: 5, resize: 'vertical',
}
const btnSoft: React.CSSProperties = {
    font: 'inherit', fontSize: 12, fontWeight: 600, background: 'rgba(37,99,168,0.1)', color: ACCENT,
    border: 0, borderRadius: 6, padding: '8px 14px', cursor: 'pointer',
}

// Only Search strategy is built. Issue review and Clinical question end in a synthesis over
// retrieved abstracts, so they need the streaming question answered first (and Clinical
// question carries the highest PHI surface -- PICO invites someone to paste a case).
const MODES = [
    { id: 'search-strategy', label: 'Search strategy', hint: 'Recall · uncapped · produces a strategy, not a synthesis', ready: true },
    { id: 'issue-review', label: 'Issue review', hint: 'Precision · top 50 · narrative synthesis', ready: false },
    { id: 'clinical-question', label: 'Clinical question', hint: 'Precision · top 50 · PICO answer', ready: false },
]

const DATABASES = [
    { id: 'pubmed', label: 'PubMed', ready: true },
    { id: 'embase', label: 'Embase', ready: false },
    { id: 'scopus', label: 'Scopus', ready: false },
]

// A term line: editable in place. No click-to-edit mode, no modal, no separate "Edit & re-run"
// button -- the line IS the input, and every keystroke lands in the same debounced re-count the
// checkboxes use. That retires the mockup's free-text re-run and its whole failure mode: there
// is no second copy of the query to get out of sync, and a broken line can only break its own
// block. Auto-grows because a real MeSH line runs to 600 characters and must not be a slot.
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
            style={{
                flex: 1, minWidth: 0, font: 'inherit', fontFamily: mono, fontSize: 12.5, lineHeight: 1.7,
                color: on ? INK : MUTED, background: 'transparent', border: 0, borderRadius: 3,
                padding: '0 4px', margin: '0 -4px', resize: 'none', overflow: 'hidden',
                outlineOffset: 2,
            }}
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

    const build = async () => {
        if (!question.trim() || busy) return
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
                // A slower earlier request must never overwrite a newer count. Silently
                // dropping a stale response is the only correct thing here: the number on
                // screen has to belong to the strategy on screen.
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
    // buildLimits() is shared, which is why the two can't drift.
    const liveStrategy: Strategy | null = strategy && { ...strategy, limits: buildLimits(dateId, typeId) }

    const editConcept = (ci: number, fn: (c: Concept) => Concept) =>
        setStrategy(s => s && { ...s, concepts: s.concepts.map((c, i) => (i === ci ? fn(c) : c)) })

    const toggle = (ci: number, li: number) =>
        editConcept(ci, c => ({ ...c, lines: c.lines.map((l, j) => (j === li ? { ...l, on: !l.on } : l)) }))

    const edit = (ci: number, li: number, terms: string) =>
        editConcept(ci, c => ({ ...c, lines: c.lines.map((l, j) => (j === li ? { ...l, terms } : l)) }))

    const addLine = (ci: number) =>
        editConcept(ci, c => ({ ...c, lines: [...c.lines, { terms: '', on: true }] }))

    const newSearch = () => { setStrategy(null); setResult(null); setExperts(null); setErr('') }

    // Same reason as the error state above: toast.success was a silent no-op here, so Copy
    // worked but never said so. Confirm on the button itself -- nothing to mount, nothing to
    // configure, and the feedback lands where the user is already looking.
    const copy = (text: string, what: string) => {
        navigator.clipboard.writeText(text).then(
            () => {
                setCopied(what)
                setTimeout(() => setCopied(c => (c === what ? '' : c)), 1800)
            },
            // writeText rejects outside a secure context (plain-http over an IP). Say so
            // rather than looking like a dead button.
            () => setErr('Could not copy to the clipboard.'),
        )
    }

    // The PRISMA-S methods block — what goes in the manuscript. This, not a record export, is
    // what reproducibility actually requires.
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
                ? `Known-item validation: ${r.seeds.filter(s => s.retrieved).length} of ${r.seeds.length} seed records retrieved (${r.seeds.map(s => s.pmid).join(', ')}).`
                : `Known-item validation: not performed.`,
        ].join('\n')
    }

    const retrieved = result ? result.seeds.filter(s => s.retrieved).length : 0
    const allFound = result && result.seeds.length > 0 && retrieved === result.seeds.length
    const numbered = liveStrategy ? numberStrategy(liveStrategy) : null
    const seedOf = (pmid?: string) => result?.seeds.find(s => s.pmid === pmid)
    const nameOf = (s?: Seed) => (s ? s.label || `PMID ${s.pmid}` : '')

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '28px 32px 48px' }}>
            {result ? (
                <div style={{ fontSize: 12, color: MUTED }}>
                    Literature Search &nbsp;&rsaquo;&nbsp; <b style={{ color: INK }}>Search strategy</b>
                </div>
            ) : (
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
                    Literature Search
                </h1>
            )}

            {/* THE FORM. Collapses to a one-line summary bar once a strategy exists — on a laptop
                the deliverable otherwise sits below the fold, under a form nobody is reading any
                more. "New search" brings it back. */}
            {result ? (
                <div style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                        Search strategy
                    </span>
                    <span style={{ flex: 1, minWidth: 160, fontSize: 13, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        &ldquo;{question}&rdquo;
                    </span>
                    <button
                        onClick={newSearch}
                        style={{ font: 'inherit', fontSize: 12, background: 'transparent', color: MUTED, border: `0.5px solid ${BORDER}`, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                    >
                        New search
                    </button>
                </div>
            ) : (
                <div style={card}>
                    {/*
                      * The mode is a RETRIEVAL OBJECTIVE, not a template: Search strategy chases
                      * recall and ends in a handoff, the other two chase precision and end in a
                      * synthesis. Only Search strategy is built. The other two are shown DISABLED
                      * rather than hidden, so the scope of what this page does (and does not yet
                      * do) is legible instead of being a silent omission. No branching behind
                      * them -- there is nothing to branch to yet.
                      */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={sec}>Mode</span>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {MODES.map(m => (
                                <label
                                    key={m.id}
                                    htmlFor={`lit-mode-${m.id}`}
                                    style={{
                                        flex: '1 1 180px', display: 'flex', alignItems: 'flex-start', gap: 9,
                                        padding: '12px 14px', borderRadius: 6,
                                        border: `0.5px solid ${m.ready ? ACCENT : BORDER}`,
                                        background: m.ready ? 'rgba(37,99,168,0.1)' : 'transparent',
                                        cursor: m.ready ? 'pointer' : 'not-allowed',
                                        opacity: m.ready ? 1 : 0.55,
                                    }}
                                >
                                    <input
                                        id={`lit-mode-${m.id}`}
                                        type="radio"
                                        name="lit-mode"
                                        checked={m.ready}
                                        disabled={!m.ready}
                                        readOnly
                                        style={{ marginTop: 2, accentColor: ACCENT }}
                                    />
                                    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                                            {m.label}{!m.ready && <span style={{ fontWeight: 400, color: MUTED }}> — soon</span>}
                                        </span>
                                        <span style={{ fontSize: 12, lineHeight: 1.4, color: MUTED }}>{m.hint}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div style={hint}>
                            Search strategy produces a reproducible, peer-reviewable query. Screen and synthesize it
                            in Covidence.
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={sec} htmlFor="lit-q">What do you want to know?</label>
                        <textarea
                            id="lit-q"
                            rows={2}
                            value={question}
                            onChange={e => setQuestion(e.target.value)}
                            placeholder="Do probiotics reduce symptoms of depression in adults?"
                            style={input}
                        />
                        <div style={hint}>
                            Your question is sent to an external AI service &mdash; do not include patient identifiers.
                        </div>
                    </div>

                    {/*
                      * Embase and Scopus are visible-but-disabled on purpose. It sets the
                      * expectation, and it keeps the query artifact an ARRAY of per-database
                      * results rather than letting a scalar sneak in -- adding a database should
                      * push an element, not change every consumer.
                      */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, flexWrap: 'wrap' }}>
                        <span style={sec}>Databases</span>
                        {DATABASES.map(d => (
                            <label
                                key={d.id}
                                htmlFor={`lit-db-${d.id}`}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: d.ready ? 1 : 0.5, cursor: 'not-allowed' }}
                            >
                                <input id={`lit-db-${d.id}`} type="checkbox" checked={d.ready} disabled readOnly style={{ accentColor: ACCENT }} />
                                {d.label}
                                {!d.ready && <span style={{ color: MUTED }}>(soon)</span>}
                            </label>
                        ))}
                    </div>

                    <div style={{ borderLeft: '2px solid rgba(37,99,168,0.1)', paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={sec} htmlFor="lit-seeds">Known-item seeds</label>
                        {/* 5 rows, not 2: the librarian names 3-5 seeds, and at 2 rows the first PMID
                            scrolled out of its own box the moment a fourth was added. */}
                        <textarea
                            id="lit-seeds"
                            rows={5}
                            value={seeds}
                            onChange={e => setSeeds(e.target.value)}
                            placeholder="PMIDs, one per line &mdash; papers this search MUST retrieve"
                            style={{ ...input, fontFamily: mono, fontSize: 13 }}
                        />
                        <div style={hint}>
                            We run the strategy and report whether each one came back. A strategy that misses a known
                            include is broken.
                        </div>
                    </div>

                    <div style={{ borderLeft: '2px solid rgba(37,99,168,0.1)', paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={sec} htmlFor="lit-crit">Inclusion / exclusion criteria &mdash; optional</label>
                        <textarea
                            id="lit-crit"
                            rows={2}
                            value={criteria}
                            onChange={e => setCriteria(e.target.value)}
                            placeholder="e.g. RCTs only; adults; validated depression scales; exclude preclinical"
                            style={input}
                        />
                        <div style={hint}>Shapes the query.</div>
                    </div>

                    {/*
                      * LIMITS ARE DROPDOWNS, NOT PROSE. They used to be a free-text box passed to
                      * the model, which meant the MODEL decided what "2021-2026" meant -- a quiet
                      * hole in the one thing this mode promises. The ids resolve to PubMed syntax
                      * server-side, by a table both ends share.
                      */}
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <label style={{ fontSize: 12, color: MUTED }} htmlFor="lit-date">Date</label>
                            <select id="lit-date" value={dateId} onChange={e => setDateId(e.target.value)}
                                style={{ font: 'inherit', fontSize: 13, padding: '7px 10px', border: `0.5px solid ${BORDER}`, borderRadius: 5, background: '#fff' }}>
                                {dates.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <label style={{ fontSize: 12, color: MUTED }} htmlFor="lit-type">Publication type</label>
                            <select id="lit-type" value={typeId} onChange={e => setTypeId(e.target.value)}
                                style={{ font: 'inherit', fontSize: 13, padding: '7px 10px', border: `0.5px solid ${BORDER}`, borderRadius: 5, background: '#fff' }}>
                                {types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                        </div>
                        <span style={{ flex: 1 }} />
                        <button
                            onClick={build}
                            disabled={busy || !question.trim()}
                            style={{
                                font: 'inherit', fontSize: 13, fontWeight: 600,
                                background: busy ? MUTED : INK,
                                color: '#fff', border: 0, borderRadius: 6, padding: '10px 20px',
                                cursor: busy || !question.trim() ? 'default' : 'pointer',
                                opacity: !question.trim() ? 0.5 : 1,
                            }}
                        >
                            {busy ? 'Building strategy…' : 'Build strategy'}
                        </button>
                    </div>

                    <div style={hint}>
                        <b>No result cap in this mode.</b> A systematic-review search is designed to over-retrieve:
                        a 5,000-record yield is a success, not an error.
                    </div>
                </div>
            )}

            {err && (
                <div role="alert" style={{ fontSize: 13, background: DANGER_BG, color: DANGER, borderRadius: 4, padding: '10px 14px' }}>
                    {err}
                </div>
            )}

            {result && liveStrategy && numbered && (
                <>
                    {/* THE DELIVERABLE — PRESS-numbered, line by line, every atomic line toggleable
                        and editable. This is the form a strategy is peer-reviewed in, and it is
                        also the only form a checkbox can sit on. */}
                    <div style={{ border: `0.5px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '12px 16px', background: SUBTLE, borderBottom: `0.5px solid ${BORDER}` }}>
                            <span style={{ ...sec, color: INK }}>PubMed</span>
                            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', opacity: recounting ? 0.45 : 1 }}>
                                {result.hits.toLocaleString()} <span style={{ fontWeight: 400, color: MUTED }}>records</span>
                            </span>
                            {recounting && <span style={{ fontSize: 12, color: MUTED }} aria-live="polite">re-counting…</span>}
                        </div>

                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {numbered.rows.map((row, i) => {
                                // A combination line (6 = 4 OR 5) is DERIVED. It has no checkbox because
                                // there is nothing to decide about it: it recomputes from the lines above.
                                if (row.kind === 'combine') {
                                    return (
                                        <div key={`c${i}`} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontFamily: mono, fontSize: 12.5, lineHeight: 1.7, color: MUTED }}>
                                            <span style={{ width: 18 }} />
                                            <span style={{ minWidth: 20, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{row.n}</span>
                                            <span style={{ padding: '0 4px' }}>{row.text}</span>
                                        </div>
                                    )
                                }

                                const seed = seedOf(row.line.suggestedFor)
                                return (
                                    <div key={`t${row.ci}-${row.li}`} style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                                            <input
                                                type="checkbox"
                                                checked={row.line.on}
                                                onChange={() => toggle(row.ci, row.li)}
                                                aria-label={`Include line: ${row.line.terms.slice(0, 60)}`}
                                                style={{ width: 18, accentColor: ACCENT, cursor: 'pointer', alignSelf: 'center' }}
                                            />
                                            <span style={{ minWidth: 20, textAlign: 'right', flexShrink: 0, fontFamily: mono, fontSize: 12.5, lineHeight: 1.7, color: MUTED, fontVariantNumeric: 'tabular-nums', userSelect: 'none' }}>
                                                {row.n ?? '·'}
                                            </span>
                                            <LineInput
                                                value={row.line.terms}
                                                on={row.line.on}
                                                onChange={v => edit(row.ci, row.li, v)}
                                            />
                                        </div>
                                        {/* The model's proposed widening: a LINE, not a paragraph. Verified
                                            (it really does retrieve that seed) and priced (what ticking it
                                            costs in records to screen). That trade is the judgment the
                                            librarian is here to make, and now it is one click. */}
                                        {row.line.suggestedFor && !row.line.on && (
                                            <div style={{ marginLeft: 46, marginBottom: 4, fontSize: 12, color: ACCENT }}>
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
                                <div style={{ fontSize: 13, color: DANGER, padding: '8px 0' }}>
                                    Nothing is ticked, so there is no strategy to run.
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                                <span style={{ width: 18 }} />
                                {liveStrategy.concepts.map((c, ci) => (
                                    <button
                                        key={ci}
                                        onClick={() => addLine(ci)}
                                        style={{ font: 'inherit', fontSize: 12, background: 'transparent', color: ACCENT, border: 0, padding: 0, cursor: 'pointer' }}
                                    >
                                        + line to {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px', borderTop: `1px solid ${DIVIDER}`, fontSize: 12, color: MUTED }}>
                            <span>Run {result.runDate}{result.limits ? ` · limits: ${result.limits}` : ' · no limits'}</span>
                            <span style={{ flex: 1 }} />
                            <span style={{ fontSize: 12 }}>Tick, untick or edit any line &mdash; it re-counts for free.</span>
                            <button
                                onClick={() => copy(result.query, 'Boolean query')}
                                aria-live="polite"
                                disabled={!result.query}
                                style={{ ...btnSoft, background: copied === 'Boolean query' ? '#dcfce7' : 'rgba(37,99,168,0.1)', color: copied === 'Boolean query' ? '#166534' : ACCENT }}
                            >
                                {copied === 'Boolean query' ? '✓ Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>

                    {/* A Cochrane-compliant search needs Embase and CENTRAL too. The card is here to
                        say so out loud — and to keep the artifact an array. */}
                    <div style={{ border: `0.5px dashed ${BORDER}`, borderRadius: 6, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                            <span style={{ ...sec }}>Embase</span>
                            <span style={{ marginLeft: 'auto', fontSize: 12, color: MUTED }}>not searched</span>
                        </div>
                        <div style={{ fontSize: 13, color: MUTED }}>
                            A Cochrane-compliant search needs Embase and CENTRAL too. Coming soon.
                        </div>
                    </div>

                    {/* KNOWN-ITEM VALIDATION — the thing that makes an LLM-drafted Boolean defensible. */}
                    {result.seeds.length > 0 && (
                        <div style={card}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                                <span style={sec}>Known-item validation</span>
                                <span style={{
                                    marginLeft: 'auto', fontSize: 12, fontVariantNumeric: 'tabular-nums',
                                    fontWeight: allFound ? 400 : 600,
                                    color: allFound ? MUTED : DANGER,
                                    opacity: recounting ? 0.45 : 1,
                                }}>
                                    {retrieved} of {result.seeds.length} retrieved
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {result.seeds.map(s => {
                                    const failing = (s.failingConcepts || [])
                                        .map(i => ({ label: result.concepts[i]?.label, lines: numbered.conceptLines[i] || [] }))
                                        .filter(f => f.label)
                                    return (
                                        <div key={s.pmid} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: `1px solid ${DIVIDER}`, flexWrap: 'wrap', fontSize: 13 }}>
                                            <span style={{ width: 16, fontWeight: 600, textAlign: 'center', color: s.retrieved ? '#166534' : DANGER }}>
                                                {s.retrieved ? '✓' : '✗'}
                                            </span>
                                            {/* Author + year, not a bare PMID: a librarian who named four seeds
                                                cannot tell which paper missed from an 8-digit number. */}
                                            {s.label && <span style={{ fontWeight: 600 }}>{s.label}</span>}
                                            <span style={{ fontFamily: mono, fontSize: 12, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                                                PMID {s.pmid}
                                            </span>
                                            {!s.retrieved && (
                                                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: DANGER }}>
                                                    Not retrieved
                                                </span>
                                            )}
                                            {/* The reason is DERIVED by re-counting the seed against each block, never
                                                guessed by the model. A hallucinated reason would be worse than none. */}
                                            {/* A paper can fail a block AND the limits at once, so both are
                                                reported. Naming only the block would send a librarian off to
                                                widen a search that still cannot return the paper. */}
                                            {!s.retrieved && (
                                                <span style={{ flexBasis: '100%', marginLeft: 26, marginTop: 5, fontSize: 12, lineHeight: 1.5, background: DANGER_BG, color: DANGER, borderRadius: 4, padding: '8px 12px' }}>
                                                    {!failing.length && !s.failsLimits && (
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
                                                    {s.failsLimits && (
                                                        <>
                                                            {failing.length > 0 && <>It also fails your </>}
                                                            {failing.length === 0 && <>It matches every block you have ticked, so your </>}
                                                            <b>limits</b>
                                                            {failing.length > 0
                                                                ? <>, so widening the {failing.length > 1 ? 'blocks' : 'block'} alone will not bring it back &mdash; change the date range or publication type above.</>
                                                                : <> are what exclude it &mdash; change the date range or publication type above.</>}
                                                        </>
                                                    )}
                                                    {failing.length > 0 && !s.failsLimits && (
                                                        <>Widen {failing.length > 1 ? 'them' : 'it'} to retrieve this paper &mdash; a
                                                            suggested line may already be waiting, unticked, in the strategy above.</>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Only advise widening when a BLOCK is actually the problem. Telling a
                                librarian to widen a block when the limits are what exclude the paper
                                sends them to spend records on a search that still cannot return it. */}
                            {!allFound && result.seeds.some(s => !s.retrieved && s.failingConcepts?.length) && (
                                <div style={hint}>
                                    A strategy that misses a known include is not yet finished. Widen the failing
                                    block &mdash; the yield will grow, and that is the trade.
                                </div>
                            )}
                        </div>
                    )}

                    {/* AT WEILL CORNELL — works with no records at all, straight off the query's MeSH. */}
                    {experts && experts.experts.length > 0 && (
                        <div style={{ ...card, padding: 0, overflow: 'hidden', gap: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '14px 20px', background: SUBTLE, borderBottom: `0.5px solid ${BORDER}` }}>
                                <span style={sec}>At Weill Cornell</span>
                                <span style={{ marginLeft: 'auto', fontSize: 12, color: MUTED }}>
                                    top {experts.experts.length} of <b>{experts.total.toLocaleString()}</b> faculty publishing on these MeSH terms
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 20px 8px' }}>
                                {experts.experts.map(e => (
                                    <div key={e.personIdentifier} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '9px 0', borderBottom: `1px solid ${DIVIDER}` }}>
                                        <span style={{ fontWeight: 600, fontSize: 13, color: ACCENT }}>
                                            {e.firstName} {e.lastName}
                                        </span>
                                        <span style={{ fontSize: 12, color: MUTED, fontStyle: e.primaryOrganizationalUnit ? 'normal' : 'italic' }}>
                                            {e.primaryOrganizationalUnit || 'department not recorded'}
                                        </span>
                                        <span style={{ marginLeft: 'auto', fontSize: 12, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
                                            {e.pubs} pubs
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ padding: '10px 20px 14px', fontSize: 12, color: MUTED, background: SUBTLE, borderTop: `0.5px solid ${BORDER}` }}>
                                Ranked by accepted publications.
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ flex: 1 }} />
                        <button
                            onClick={() => copy(prismaBlock(result), 'PRISMA-S methods block')}
                            aria-live="polite"
                            disabled={recounting || !result.query}
                            style={{
                                font: 'inherit', fontSize: 13, fontWeight: 600,
                                background: copied === 'PRISMA-S methods block' ? '#166534' : INK,
                                color: '#fff', border: 0, borderRadius: 6, padding: '10px 20px',
                                cursor: recounting ? 'default' : 'pointer', opacity: recounting ? 0.5 : 1,
                            }}
                        >
                            {copied === 'PRISMA-S methods block' ? '✓ Copied — paste into your manuscript' : 'Copy PRISMA-S methods block'}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
