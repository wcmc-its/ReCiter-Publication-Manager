// Literature Search — Mode 1 ("Search strategy").
//
// The deliverable on this screen is THE STRATEGY, not records. There is deliberately no
// candidate list, no screening checkbox, and no synthesis here: for a systematic review
// those belong to Covidence/Rayyan, and pretending otherwise is the failure this design
// exists to prevent. There is also no result cap — an SR search is meant to over-retrieve.
//
// Styling uses the calm tokens from styles/globals.css. No new visual vocabulary.

import { useState } from 'react'
import { toast } from 'react-toastify'

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

const card: React.CSSProperties = {
    background: 'var(--color-surface, #fff)',
    border: '0.5px solid #e8e2d9',
    borderRadius: 'var(--radius-md, 6px)',
    padding: '20px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
}
const sec: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#8a94a6',
}
const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

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

    const copy = (text: string, what: string) => {
        navigator.clipboard.writeText(text)
        toast.success(`${what} copied`)
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '24px 28px 40px' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
                Literature Search
            </h1>

            <div style={card}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={sec} htmlFor="lit-q">What do you want to know?</label>
                    <textarea
                        id="lit-q"
                        rows={2}
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        placeholder="Do probiotics reduce symptoms of depression in adults?"
                        style={{ font: 'inherit', padding: '10px 12px', border: '0.5px solid #e8e2d9', borderRadius: 5, resize: 'vertical' }}
                    />
                    <div style={{ fontSize: 12, color: '#8a94a6' }}>
                        Produces a reproducible, peer-reviewable search strategy. Screen and synthesize it in Covidence.
                        Your question is sent to an external AI service &mdash; do not include patient identifiers.
                    </div>
                </div>

                <div style={{ borderLeft: '2px solid rgba(37,99,168,0.1)', paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={sec} htmlFor="lit-seeds">Known-item seeds</label>
                    <textarea
                        id="lit-seeds"
                        rows={2}
                        value={seeds}
                        onChange={e => setSeeds(e.target.value)}
                        placeholder="PMIDs, one per line &mdash; papers this search MUST retrieve"
                        style={{ font: 'inherit', fontFamily: mono, fontSize: 13, padding: '10px 12px', border: '0.5px solid #e8e2d9', borderRadius: 5, resize: 'vertical' }}
                    />
                    <div style={{ fontSize: 12, color: '#8a94a6' }}>
                        We run the strategy and report whether each one came back. A strategy that misses a known
                        include is broken.
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={sec} htmlFor="lit-crit">Inclusion / exclusion criteria &mdash; optional</label>
                    <textarea
                        id="lit-crit"
                        rows={2}
                        value={criteria}
                        onChange={e => setCriteria(e.target.value)}
                        placeholder="e.g. RCTs only; adults; validated depression scales"
                        style={{ font: 'inherit', padding: '10px 12px', border: '0.5px solid #e8e2d9', borderRadius: 5, resize: 'vertical' }}
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
                            style={{ font: 'inherit', padding: '7px 10px', border: '0.5px solid #e8e2d9', borderRadius: 5 }}
                        />
                    </div>
                    <button
                        onClick={run}
                        disabled={busy || !question.trim()}
                        style={{
                            font: 'inherit', fontSize: 13, fontWeight: 600,
                            background: busy ? '#5a6478' : '#1a2133',
                            color: '#fff', border: 0, borderRadius: 6, padding: '8px 16px',
                            cursor: busy || !question.trim() ? 'default' : 'pointer',
                            opacity: !question.trim() ? 0.5 : 1,
                        }}
                    >
                        {busy ? 'Building strategy…' : 'Build strategy'}
                    </button>
                </div>

                <div style={{ fontSize: 12, color: '#8a94a6' }}>
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
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '11px 16px', background: '#faf8f5', borderBottom: '0.5px solid #e8e2d9' }}>
                            <span style={{ ...sec, color: '#1a2133' }}>PubMed</span>
                            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                {result.hits.toLocaleString()} <span style={{ fontWeight: 400, color: '#5a6478' }}>records</span>
                            </span>
                        </div>

                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2, overflowX: 'auto' }}>
                            {result.concepts.map((c, i) => (
                                <div key={i} style={{ display: 'flex', gap: 12, fontFamily: mono, fontSize: 12.5, lineHeight: 1.7, whiteSpace: 'nowrap' }}>
                                    <span style={{ color: '#8a94a6', minWidth: 16, textAlign: 'right' }}>{i + 1}</span>
                                    <span>{c.terms}</span>
                                </div>
                            ))}
                            {result.limits && (
                                <div style={{ display: 'flex', gap: 12, fontFamily: mono, fontSize: 12.5, lineHeight: 1.7, whiteSpace: 'nowrap' }}>
                                    <span style={{ color: '#8a94a6', minWidth: 16, textAlign: 'right' }}>{result.concepts.length + 1}</span>
                                    <span style={{ color: '#5a6478' }}>
                                        {result.concepts.map((_, i) => i + 1).join(' AND ')} AND {result.limits}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 16px', borderTop: '1px solid #f0ece5', fontSize: 12, color: '#8a94a6' }}>
                            <span>Run {result.runDate}{result.limits ? ` · limits: ${result.limits}` : ''}</span>
                            <span style={{ flex: 1 }} />
                            <button
                                onClick={() => copy(result.query, 'Boolean query')}
                                style={{ font: 'inherit', fontSize: 12, fontWeight: 600, background: 'rgba(37,99,168,0.1)', color: '#2563a8', border: 0, borderRadius: 6, padding: '5px 11px', cursor: 'pointer' }}
                            >
                                Copy query
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
                                    <div key={s.pmid} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid #f0ece5', flexWrap: 'wrap', fontSize: 13 }}>
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
                                            <span style={{ flexBasis: '100%', marginLeft: 26, marginTop: 5, fontSize: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 4, padding: '6px 10px' }}>
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
                                    <div key={e.personIdentifier} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '9px 0', borderBottom: '1px solid #f0ece5' }}>
                                        <span style={{ fontWeight: 600, fontSize: 13, color: '#2563a8' }}>
                                            {e.firstName} {e.lastName}
                                        </span>
                                        <span style={{ fontSize: 12, color: e.primaryOrganizationalUnit ? '#5a6478' : '#8a94a6', fontStyle: e.primaryOrganizationalUnit ? 'normal' : 'italic' }}>
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
                            style={{ font: 'inherit', fontSize: 13, fontWeight: 600, background: '#1a2133', color: '#fff', border: 0, borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}
                        >
                            Copy PRISMA-S methods block
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
