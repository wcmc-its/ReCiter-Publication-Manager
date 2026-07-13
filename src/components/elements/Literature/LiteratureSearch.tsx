// Literature Search — Mode 1 ("Search strategy").
//
// The deliverable on this screen is THE STRATEGY, not records. There is deliberately no
// candidate list, no screening checkbox, and no synthesis here: for a systematic review
// those belong to Covidence/Rayyan, and pretending otherwise is the failure this design
// exists to prevent. There is also no result cap — an SR search is meant to over-retrieve.
//
// Styling uses the calm tokens from styles/globals.css. No new visual vocabulary.

import { useState } from 'react'

type Concept = { label: string; terms: string }
type Seed = {
    pmid: string
    retrieved: boolean
    failingConcepts?: string[]
    failsLimitsOnly?: boolean
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

const card: React.CSSProperties = {
    background: 'var(--color-surface, #fff)',
    border: '0.5px solid #e8e2d9',
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
const hint: React.CSSProperties = {
    fontSize: 13,
    lineHeight: 1.5,
    color: MUTED,
}
const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

// Only Search strategy is built. Issue review and Clinical question end in a synthesis over
// retrieved abstracts, so they need the streaming question answered first (and Clinical
// question carries the highest PHI surface -- PICO invites someone to paste a case).
const MODES = [
    { id: 'search-strategy', label: 'Search strategy', hint: 'recall · no cap · ends in a handoff', ready: true },
    { id: 'issue-review', label: 'Issue review', hint: 'precision · 50 · ends in a synthesis', ready: false },
    { id: 'clinical-question', label: 'Clinical question', hint: 'precision · 50 · ends in an answer', ready: false },
]

const DATABASES = [
    { id: 'pubmed', label: 'PubMed', ready: true },
    { id: 'embase', label: 'Embase', ready: false },
    { id: 'scopus', label: 'Scopus', ready: false },
]

export default function LiteratureSearch() {
    const [question, setQuestion] = useState('')
    const [criteria, setCriteria] = useState('')
    const [seeds, setSeeds] = useState('')
    const [filters, setFilters] = useState('')
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState<DbResult | null>(null)
    const [experts, setExperts] = useState<{ experts: Expert[]; total: number } | null>(null)
    // ponytail: inline error state, not a toast. This page's failure paths (403 not-on-the-
    // allowlist, 503 unconfigured, 502 model error) were all routed through toast.error, but
    // no ToastContainer is ever mounted here and the AppLayout fallback is gated on a config
    // key that does not exist -- so every failure rendered as NOTHING and the button just
    // looked dead. An inline div depends on no config and cannot be silently disabled.
    const [err, setErr] = useState('')
    const [copied, setCopied] = useState('')

    const run = async () => {
        if (!question.trim() || busy) return
        setBusy(true)
        setErr('')
        try {
            const res = await fetch('/api/literature/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, criteria, filters, seeds }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErr(data?.message || 'Could not build the strategy.')
                return
            }
            setResult(data.databases[0])
            setExperts(data.experts)
        } catch {
            setErr('Could not reach the server.')
        } finally {
            setBusy(false)
        }
    }

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

    // The PRISMA-S methods block — what goes in the manuscript. This, not a record export,
    // is what reproducibility actually requires.
    const prismaBlock = (r: DbResult) => {
        const lines = r.concepts.map((c, i) => `${i + 1}. ${c.label}: ${c.terms}`)
        return [
            `Database: PubMed (via NCBI E-utilities)`,
            `Date searched: ${r.runDate}`,
            `Records retrieved: ${r.hits}`,
            r.limits ? `Limits: ${r.limits}` : `Limits: none`,
            ``,
            `Search strategy:`,
            ...lines,
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '28px 32px 48px' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
                Literature Search
            </h1>

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
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                        {MODES.map(m => (
                            <label
                                key={m.id}
                                htmlFor={`lit-mode-${m.id}`}
                                style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 7,
                                    cursor: m.ready ? 'pointer' : 'not-allowed',
                                    opacity: m.ready ? 1 : 0.45,
                                }}
                            >
                                <input
                                    id={`lit-mode-${m.id}`}
                                    type="radio"
                                    name="lit-mode"
                                    checked={m.ready}
                                    disabled={!m.ready}
                                    readOnly
                                    style={{ marginTop: 2, accentColor: '#2563a8' }}
                                />
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <span style={{ fontSize: 13, fontWeight: m.ready ? 600 : 400 }}>
                                        {m.label}{!m.ready && <span style={{ fontWeight: 400, color: MUTED }}> — soon</span>}
                                    </span>
                                    <span style={{ fontSize: 12, lineHeight: 1.4, color: MUTED }}>{m.hint}</span>
                                </span>
                            </label>
                        ))}
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
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: d.ready ? 1 : 0.45, cursor: d.ready ? 'default' : 'not-allowed' }}
                        >
                            <input
                                id={`lit-db-${d.id}`}
                                type="checkbox"
                                checked={d.ready}
                                disabled
                                readOnly
                                style={{ accentColor: '#2563a8' }}
                            />
                            {d.label}
                            {!d.ready && <span style={{ color: MUTED }}>(soon)</span>}
                        </label>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={sec} htmlFor="lit-q">What do you want to know?</label>
                    <textarea
                        id="lit-q"
                        rows={2}
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        placeholder="Do probiotics reduce symptoms of depression in adults?"
                        style={{ font: 'inherit', padding: '12px', border: '0.5px solid #e8e2d9', borderRadius: 5, resize: 'vertical' }}
                    />
                    <div style={hint}>
                        Produces a reproducible, peer-reviewable search strategy. Screen and synthesize it in Covidence.
                        Your question is sent to an external AI service &mdash; do not include patient identifiers.
                    </div>
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
                        style={{ font: 'inherit', fontFamily: mono, fontSize: 13, padding: '12px', border: '0.5px solid #e8e2d9', borderRadius: 5, resize: 'vertical' }}
                    />
                    <div style={hint}>
                        We run the strategy and report whether each one came back. A strategy that misses a known
                        include is broken.
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={sec} htmlFor="lit-crit">Inclusion / exclusion criteria &mdash; optional</label>
                    <textarea
                        id="lit-crit"
                        rows={2}
                        value={criteria}
                        onChange={e => setCriteria(e.target.value)}
                        placeholder="e.g. RCTs only; adults; validated depression scales"
                        style={{ font: 'inherit', padding: '12px', border: '0.5px solid #e8e2d9', borderRadius: 5, resize: 'vertical' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 220 }}>
                        <label style={{ fontSize: 12, color: '#5a6478' }} htmlFor="lit-filters">Limits &mdash; optional</label>
                        <input
                            id="lit-filters"
                            type="text"
                            value={filters}
                            onChange={e => setFilters(e.target.value)}
                            placeholder="e.g. 2021-2026, RCTs and meta-analyses only"
                            style={{ font: 'inherit', padding: '8px 12px', border: '0.5px solid #e8e2d9', borderRadius: 5 }}
                        />
                    </div>
                    <button
                        onClick={run}
                        disabled={busy || !question.trim()}
                        style={{
                            font: 'inherit', fontSize: 13, fontWeight: 600,
                            background: busy ? '#5a6478' : '#1a2133',
                            color: '#fff', border: 0, borderRadius: 6, padding: '10px 20px',
                            cursor: busy || !question.trim() ? 'default' : 'pointer',
                            opacity: !question.trim() ? 0.5 : 1,
                        }}
                    >
                        {busy ? 'Building strategy…' : 'Build strategy'}
                    </button>
                </div>

                <div style={hint}>
                    No result cap: a systematic-review search is designed to over-retrieve. A yield in the
                    thousands is a success, not an error.
                </div>

                {err && (
                    <div role="alert" style={{ fontSize: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 4, padding: '8px 12px' }}>
                        {err}
                    </div>
                )}
            </div>

            {result && (
                <>
                    {/* THE DELIVERABLE — numbered concept blocks, the form strategies are peer-reviewed in. */}
                    <div style={{ border: '0.5px solid #e8e2d9', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '12px 16px', background: '#faf8f5', borderBottom: '0.5px solid #e8e2d9' }}>
                            <span style={{ ...sec, color: INK }}>PubMed</span>
                            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                {result.hits.toLocaleString()} <span style={{ fontWeight: 400, color: '#5a6478' }}>records</span>
                            </span>
                        </div>

                        {/*
                          * WRAP, do not scroll. A concept block is routinely 600+ characters; on
                          * one nowrap line it rendered ~4,500px wide inside a ~980px card, so the
                          * strategy — the entire deliverable of this mode — was unreadable past
                          * its first few terms. Horizontal scrolling is not a real answer either:
                          * a PRESS reviewer reads the Boolean, they do not drag it. Wrapping on
                          * the OR boundaries keeps each numbered block intact and legible.
                          */}
                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {result.concepts.map((c, i) => (
                                <div key={i} style={{ display: 'flex', gap: 12, fontFamily: mono, fontSize: 12.5, lineHeight: 1.7 }}>
                                    <span style={{ color: MUTED, minWidth: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                                    <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minWidth: 0 }}>{c.terms}</span>
                                </div>
                            ))}
                            {result.limits && (
                                <div style={{ display: 'flex', gap: 12, fontFamily: mono, fontSize: 12.5, lineHeight: 1.7 }}>
                                    <span style={{ color: MUTED, minWidth: 16, textAlign: 'right', flexShrink: 0 }}>{result.concepts.length + 1}</span>
                                    <span style={{ color: MUTED, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minWidth: 0 }}>
                                        {result.concepts.map((_, i) => i + 1).join(' AND ')} AND {result.limits}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px', borderTop: '1px solid #f0ece5', fontSize: 12, color: MUTED }}>
                            <span>Run {result.runDate}{result.limits ? ` · limits: ${result.limits}` : ''}</span>
                            <span style={{ flex: 1 }} />
                            <button
                                onClick={() => copy(result.query, 'Boolean query')}
                                aria-live="polite"
                                style={{ font: 'inherit', fontSize: 12, fontWeight: 600, background: copied === 'Boolean query' ? '#dcfce7' : 'rgba(37,99,168,0.1)', color: copied === 'Boolean query' ? '#166534' : '#2563a8', border: 0, borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}
                            >
                                {copied === 'Boolean query' ? '✓ Copied' : 'Copy query'}
                            </button>
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
                                    color: allFound ? '#5a6478' : '#991b1b',
                                }}>
                                    {retrieved} of {result.seeds.length} retrieved
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {result.seeds.map(s => (
                                    <div key={s.pmid} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0ece5', flexWrap: 'wrap', fontSize: 13 }}>
                                        <span style={{ width: 16, fontWeight: 600, textAlign: 'center', color: s.retrieved ? '#166534' : '#991b1b' }}>
                                            {s.retrieved ? '✓' : '✗'}
                                        </span>
                                        <span style={{ fontFamily: mono, fontSize: 12, color: '#5a6478', fontVariantNumeric: 'tabular-nums' }}>
                                            PMID {s.pmid}
                                        </span>
                                        {!s.retrieved && (
                                            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#991b1b' }}>
                                                Not retrieved
                                            </span>
                                        )}
                                        {/* The reason is DERIVED by re-counting the seed against each block, never
                                            guessed by the model. A hallucinated reason would be worse than none. */}
                                        {!s.retrieved && (
                                            <span style={{ flexBasis: '100%', marginLeft: 26, marginTop: 5, fontSize: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 4, padding: '8px 12px' }}>
                                                {s.failsLimitsOnly
                                                    ? <>It matches every concept block, so your <b>limits</b> are what exclude it. Check the date range and publication type.</>
                                                    : <>Excluded by the <b>{(s.failingConcepts || []).join(' and ')}</b> block{(s.failingConcepts?.length || 0) > 1 ? 's' : ''}. Widen {(s.failingConcepts?.length || 0) > 1 ? 'those concepts' : 'that concept'} to retrieve it.</>}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {!allFound && (
                                <div style={{ fontSize: 12, color: '#5a6478' }}>
                                    A strategy that misses a known include is not yet finished. Widen the failing
                                    concept and re-run &mdash; the yield will grow, and that is the trade.
                                </div>
                            )}
                        </div>
                    )}

                    {/* AT WEILL CORNELL — works with no records at all, straight off the query's MeSH. */}
                    {experts && experts.experts.length > 0 && (
                        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '14px 20px', background: '#faf8f5', borderBottom: '0.5px solid #e8e2d9' }}>
                                <span style={sec}>At Weill Cornell</span>
                                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#5a6478' }}>
                                    top {experts.experts.length} of <b>{experts.total.toLocaleString()}</b> faculty publishing on these MeSH terms
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 20px 8px' }}>
                                {experts.experts.map(e => (
                                    <div key={e.personIdentifier} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '8px 0', borderBottom: '1px solid #f0ece5' }}>
                                        <span style={{ fontWeight: 600, fontSize: 13, color: '#2563a8' }}>
                                            {e.firstName} {e.lastName}
                                        </span>
                                        <span style={{ fontSize: 12, color: MUTED, fontStyle: e.primaryOrganizationalUnit ? 'normal' : 'italic' }}>
                                            {e.primaryOrganizationalUnit || 'department not recorded'}
                                        </span>
                                        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#5a6478', fontVariantNumeric: 'tabular-nums' }}>
                                            {e.pubs} pubs
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ flex: 1 }} />
                        <button
                            onClick={() => copy(prismaBlock(result), 'PRISMA-S methods block')}
                            aria-live="polite"
                            style={{ font: 'inherit', fontSize: 13, fontWeight: 600, background: copied === 'PRISMA-S methods block' ? '#166534' : '#1a2133', color: '#fff', border: 0, borderRadius: 6, padding: '10px 20px', cursor: 'pointer' }}
                        >
                            {copied === 'PRISMA-S methods block' ? '✓ Copied — paste into your manuscript' : 'Copy PRISMA-S methods block'}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
