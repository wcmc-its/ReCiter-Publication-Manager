// Literature Search — two modes on one page.
//
// MODE 1 ("Search strategy"). The deliverable is THE STRATEGY, not records. There is deliberately
// no candidate list, no screening checkbox, and no synthesis here: for a systematic review those
// belong to Covidence/Rayyan, and pretending otherwise is the failure this design exists to
// prevent. There is also no result cap — an SR search is meant to over-retrieve.
//
// THE STRATEGY IS LIVE. Every atomic term line carries a checkbox and is editable in place;
// changing anything re-counts the yield and re-validates the seeds, with NO model call (see
// the two paths in /api/literature/search). That is the centre of that screen: the librarian
// widens or narrows the search and watches the price in records, and the methods judgment
// stays with the person qualified to make it.
//
// MODE 2 ("Issue review"). A different question — "what does the literature say?", asked by
// someone who wants an answer this afternoon, not a PRISMA appendix. It retrieves the top 50
// records, screens all 50 against the criteria in ONE model call, and drafts a synthesis over
// whatever the human ticked. Three sequential POSTs against the same route, branched by phase.
//
// AND IT NEVER HANDS OVER A SLICE WITHOUT SAYING SO. The top 50 of an 80-hit query is most of
// the literature; the top 50 of a 1,391-hit query is a thin slice of it, and taking that silently
// is the same quiet lie the rest of this page exists to prevent. So the yield decides:
//
//   hits <= CAP          "all N retrieved"   — no slice at all, nothing to warn about. Go.
//   CAP < hits <= 200    "top 50 of N"       — a defensible slice, and the counts line says the ratio.
//   hits > 200           THE NARROWING GATE  — nothing is retrieved yet, and PRICED narrowings are
//                                              offered instead. See the gate, below.
//
// The gate is not a refusal. Every option on it is counted, every option can be ignored, and
// "Retrieve the top 50 anyway" works at any count — a tool that refuses to run is worse than one
// that warns, and the librarian may know exactly what they are doing.
//
// THE INTEGRITY ARGUMENT, and it is the reason Mode 2 is shaped the way it is:
//   AI-excluded records STAY ON THE PAGE, de-emphasised, WITH THE REASON SHOWN. Nothing is
//   hidden and nothing is collapsed. The flags are SUGGESTIONS: they arrive pre-ticked, but
//   THE CHECKBOX IS THE HUMAN'S, and the tally and the "Synthesize N" count follow the human's
//   checkboxes, never the model's flags. A screening tool that quietly drops what the model
//   disliked is a tool that launders a model's opinion into a literature review.
//
// THE CAP IS 50 AND IT IS A PROPERTY OF THE MODE, NOT A SETTING. Mode 2 synthesizes, so the
// abstracts have to fit in one context window; Mode 1 does not, so it has no cap. There is no
// Max dropdown on this page and there should never be one.
//
// The numbering, the query and the exported methods block all come out of ONE object — the
// current selection — via the pure functions in literatureSearch.strategy.ts, which the server
// uses too. If the screen and the count could disagree, Mode 1 would be worthless.
//
// Styling lives in LiteratureSearch.module.css, lifted from the signed-off mockup. No inline
// style objects: the page has a design system now, and it should be edited in one place.

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import {
    Strategy,
    Concept,
    Pico,
    PICO_FIELDS,
    RECORD_CAP as CAP,   // a property of the mode, not a setting
    NARROW_ABOVE,        // the narrowing gate; the server enforces this same number
    numberStrategy,
    picoQuestion,
    picoComplete,
    buildLimits,
    dateLimits,
    pubTypes,
    DIALECTS,
} from '../../../../controllers/literatureSearch.strategy'
import type { Db, Rendering, SeedKind } from '../../../../controllers/literatureSearch.strategy'
// THE CONTRACT, imported rather than re-declared. `import type` is erased at transpile, so this
// costs the client bundle nothing (the controller's AWS SDK import never reaches the browser) —
// but it means the screen cannot quietly disagree with the route about what a record is. A
// second, hand-copied copy of these four shapes is exactly how a UI ends up reading a field the
// server stopped sending.
import type { PubRecord, Screened, Synthesis, Narrowing } from '../../../../controllers/literatureSearch.controller'
import { strategyDoc, synthesisDoc, recordSheets, modelLabel } from '../../../../controllers/literatureExport'
import type { Block, RunFacts } from '../../../../controllers/literatureExport'
import { saveDocx, saveText, saveXlsx, stamp } from './download'
import s from './LiteratureSearch.module.css'

// A KNOWN ITEM, AND IT IS NOT A PMID BY ASSUMPTION. A Scopus-only record — a conference paper, a
// non-MEDLINE journal — has no PMID at all, and those are the records Scopus is here for. So a seed
// is an identifier WITH A KIND, and a DOI is a first-class one.
type Seed = {
    id: string
    kind: SeedKind
    label?: string
    retrieved: boolean
    notInDatabase?: boolean        // this database does not have the paper. Not a strategy bug.
    failingConcepts?: number[]
    failsLimits?: boolean
}

// THE RESULTS COLUMN. One record count per numbered line — how a search history is actually read:
// line 1 finds 40,000, line 2 finds 9,000, and "3 AND 6" collapses to 122. The funnel IS the
// argument, and without it the panel is a wall of Boolean the librarian has to run in their head.
//
// AN UNTICKED LINE HAS NO NUMBER AND THEREFORE NO COUNT, which is right: it was not searched, so
// there is nothing true to say about it. And a MISSING count renders as nothing at all — never as a
// 0. A throttled esearch comes back as a well-formed zero, so "0" is a value we must be able to
// distinguish from "not counted yet", and the em-dash is how.
//
// BUT "NOT COUNTED YET" AND "WE GAVE UP" ARE NOT THE SAME THING, and for a long time this rendered
// them identically: a failed rows fetch left the column empty, so the em-dash quietly changed meaning
// from "coming in a moment" to "never coming", and a librarian sat waiting for a number that had
// already failed. An em-dash that silently stops meaning what it said is the same family of bug as a
// count beside the wrong line — the screen looks calm and it is lying about its own state.
//
// So there are three states, and they look different:
//   pending  — a soft ellipsis. The column is being counted; it takes ~5s and it IS coming.
//   counted  — the number.
//   failed   — an explicit mark, with a Retry beside the panel. Never an em-dash.
type RowState = 'pending' | 'done' | 'failed'

// Long enough for a transient NCBI blip to pass, short enough that a librarian does not notice. The
// retrieval tool has already spent its own seven retries by the time we see a 502, so an instant
// re-fire lands in the same bad moment; a pause is the entire point.
const ROWS_RETRY_MS = 1500

function RowCount({ n, counts, stale, state }: {
    n: number | null; counts: Record<number, number>; stale: boolean; state: RowState
}) {
    if (n === null) return <span className={s.rowCount} />
    const c = counts?.[n]
    if (typeof c === 'number') {
        return <span className={`${s.rowCount} ${stale ? s.hitsStale : ''}`}>{c.toLocaleString()}</span>
    }
    if (state === 'failed') {
        return <span className={`${s.rowCount} ${s.rowFailed}`} title="This line could not be counted. PubMed did not answer.">·&thinsp;·&thinsp;·</span>
    }
    if (state === 'pending') {
        return <span className={`${s.rowCount} ${s.rowPending}`} aria-label="counting">&hellip;</span>
    }
    return <span className={`${s.rowCount} ${stale ? s.hitsStale : ''}`}>&mdash;</span>
}

type DbResult = {
    db: Db
    dbName: string
    concepts: Rendering[]          // THIS database's rendering. The labels are shared; the lines are not.
    limits: string
    unsupportedLimits: string[]    // limits this database cannot express — declared, never dropped
    rowCounts: Record<number, number>   // records per PRESS line — the Results column
    query: string
    hits: number
    runDate: string
    seeds: Seed[]
    records?: PubRecord[]
    sort?: string
    // Mode 2, THE NARROWING GATE. Above NARROW_ABOVE the server retrieves nothing and hands back
    // the strategy, the count, and a set of PRICED narrowings instead. It is a 200, not a 4xx:
    // "too many" is a finding, not an error, and the answer to it is the query — which the
    // librarian therefore has to be able to see.
    //
    // There is no `tooBroad` any more. That flag was the retrieval TOOL's 2,000-record fetch
    // limit leaking into the product as a refusal, and the limit is gone: the tool takes a retmax
    // and will return the top 50 of a 184,043-hit query. So there is no technical reason left to
    // refuse — only an honesty reason to warn, which is what the gate does.
    needsNarrowing?: boolean
    narrowings?: Narrowing[]
}
type Expert = {
    personIdentifier: string
    firstName: string
    lastName: string
    primaryOrganizationalUnit: string | null
    pubs: number
}

// Clinical question is LIVE as of 2026-07-13: InfoSec cleared it, and the PHI surface that worried
// them is gone — the mode takes four structured PICO fields, not a "describe the case" textarea.
// The hazard was removed at the affordance rather than policed by a detector afterwards. (A
// detector remains forbidden: the obvious MRN heuristic, "a 7-10 digit number", fires on every
// 8-digit PMID in the seeds field.)
const MODES = [
    { id: 'search-strategy', label: 'Search strategy', desc: 'Recall · uncapped · produces a strategy, not a synthesis', ready: true },
    { id: 'issue-review', label: 'Issue review', desc: 'Precision · top 50 · narrative synthesis', ready: true },
    { id: 'clinical-question', label: 'Clinical question', desc: 'Precision · top 50 · PICO answer', ready: true },
]

// SCOPUS IS SEARCH-STRATEGY ONLY, and that is principled rather than unfinished. Modes 2 and 3
// order records by an evidence tier derived from PubMed's publication-type indexing, and Scopus has
// no such index — probed live, DOCTYPE(rct) returns 0, because Scopus has no RCT document type. A
// Scopus "clinical answer" would have no evidence hierarchy underneath it, which is the one thing
// Mode 3 is for. Embase remains unavailable: Elsevier does not sell us API access to it.
const DATABASES: Array<{ id: Db; label: string; ready: boolean; srOnly?: boolean; note?: string }> = [
    { id: 'pubmed', label: 'PubMed', ready: true },
    // Embase is DRAFTED, never executed: we have no API for it, so it yields a strategy and no count.
    // That is a real limitation and it is stated on the chip rather than discovered in the export.
    // It is Mode 1 only, for the same reason Scopus is — see the route.
    { id: 'embase', label: 'Embase (Ovid)', ready: true, srOnly: true, note: 'strategy only — we cannot count Embase, so you run it in Ovid' },
    { id: 'scopus', label: 'Scopus', ready: true, srOnly: true, note: 'no controlled vocabulary — supplementary to PubMed, not equivalent' },
]

// Without this control "top 50" is an unranked slice of the yield and the mode's promise is
// false. It is not sugar.
const SORTS = [
    { id: 'relevance', label: 'Most relevant' },
    { id: 'date', label: 'Most recent' },
]

// The measured shape of each wait, so the screen can show a REAL number instead of a barber
// pole. Screening 50 abstracts in one call takes ~29s and the synthesis ~47s: those are long
// enough that a bare spinner reads as "hung", and the honest thing is to say what is happening,
// how long it usually takes, and how long it has actually been.
const STAGES: Record<string, { expect: number }> = {
    fetching: { expect: 3 },
    screening: { expect: 30 },
    synthesizing: { expect: 48 },
}

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

// The synthesis cites inline as [PMID 12345678]. Rendering those as links is the whole point:
// a claim you cannot get back to the abstract for is a claim you cannot check, and unverifiable
// prose is exactly what this feature is supposed to be an antidote to.
function Prose({ text }: { text: string }) {
    const split = (t: string, re: RegExp) => t.split(re).map(p => p.trim()).filter(Boolean)
    // Blank-line paragraphs if the model gave us any; a single newline is a paragraph too if it
    // did not. Getting this wrong renders 700 words as one unbroken wall, which nobody reads —
    // and prose nobody reads is prose nobody verifies.
    let paras = split(text, /\n{2,}/)
    if (paras.length === 1) paras = split(text, /\n/)
    return (
        <div className={s.prose}>
            {paras.map((p, i) => (
                <p key={i}>
                    {p.split(/\[PMID\s*(\d{5,9})\]/g).map((part, j) =>
                        j % 2 === 1 ? (
                            <a
                                key={j}
                                className={s.pmid}
                                href={`https://pubmed.ncbi.nlm.nih.gov/${part}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                PMID {part}
                            </a>
                        ) : (
                            <span key={j}>{part}</span>
                        ),
                    )}
                </p>
            ))}
        </div>
    )
}

export default function LiteratureSearch() {
    const session = useSession().data as any
    const [mode, setMode] = useState('search-strategy')
    const [question, setQuestion] = useState('')
    // Mode 3's question, as four fields. The SERVER assembles them into the sentence that is
    // actually asked (picoQuestion) and hands it back, so what the page displays is provably the
    // question that was put to PubMed rather than one the client retyped.
    const [pico, setPico] = useState<Partial<Pico>>({})
    const [criteria, setCriteria] = useState('')
    const [seeds, setSeeds] = useState('')
    const [dateId, setDateId] = useState('any')
    const [typeId, setTypeId] = useState('any')
    const [sort, setSort] = useState('relevance')
    const [busy, setBusy] = useState(false)

    // The current selection — the one object everything derives from. `result` is what the
    // server last COUNTED; `strategy` is what the librarian currently has ticked. They differ
    // only while a re-count is in flight, and the screen says so rather than showing a number
    // that belongs to a query nobody is looking at any more.
    // ONE STRATEGY AND ONE RESULT PER DATABASE. They are index-parallel, and they share only the
    // concept LABELS — each database's TERMS were generated natively for it, never translated from
    // the other's. Modes 2 and 3 have exactly one database, so for them these arrays have length 1
    // and `strategy` / `result` below are the whole story.
    const [strategies, setStrategies] = useState<Strategy[]>([])
    const [results, setResults] = useState<DbResult[]>([])
    const [dbs, setDbs] = useState<Db[]>(['pubmed'])
    const [recounting, setRecounting] = useState(false)

    // Modes 2 and 3 only ever search one database, so they read the head of each array and nothing
    // in their code has to know the arrays exist.
    const strategy = strategies[0] || null
    const result = results[0] || null

    // ---- Mode 2 ----
    // `phase` is where the librarian is: the form, the candidate list, or the synthesis.
    // `stage` is what the server is doing right now, and it is what the progress line reads.
    const [phase, setPhase] = useState<'form' | 'candidates' | 'synthesis'>('form')
    const [stage, setStage] = useState<'idle' | 'fetching' | 'screening' | 'synthesizing'>('idle')
    const [elapsed, setElapsed] = useState(0)
    const [records, setRecords] = useState<PubRecord[]>([])
    const [flags, setFlags] = useState<Record<string, Screened>>({})
    // THE HUMAN'S CHECKBOXES. Seeded from the model's flags and owned by the human from that
    // moment on. Everything that counts — the tally, the CTA, what gets synthesized — reads
    // from here, and nothing reads the flags.
    const [picked, setPicked] = useState<Record<string, boolean>>({})
    const [synthesis, setSynthesis] = useState<Synthesis | null>(null)
    const [provenance, setProvenance] = useState<{ cwid: string; date: string } | null>(null)

    // WHICH MODEL. The server sends its Bedrock profile id back on every response that spent a model
    // call, because until now the only place it appeared was the pod logs — and a journal asking for
    // an AI declaration wants the tool AND its version, which "AI-assisted" does not give them.
    // It survives a re-count deliberately: a re-count spends no tokens, but the strategy it is
    // re-counting is still the one the model drafted.
    const [model, setModel] = useState('')

    // ---- Mode 2, THE NARROWING GATE ----
    //
    // REUSE, NOT A NEW MACHINE. A narrowing is just a CONCEPT BLOCK that arrives UNTICKED and
    // PRICED — the exact mirror of Mode 1's suggested widening, which already arrives as an
    // unticked line carrying what it costs in records. So there is no modal here, no second count
    // path, and no new state machine: ticking a narrowing appends its block to `strategy` and
    // falls straight through the SAME debounced, model-free re-count the Mode 1 checkboxes use.
    // That is what makes iterating on the gate free, and free iteration is the whole point.
    //
    // `gate` is up while the yield is unretrieved. `baseStrategy` is what the model wrote, before
    // any narrowing; `baseHits` is the count each narrowing was PRICED against. Both are needed
    // because the re-count response carries no narrowings — it is a count, not a search.
    const [gate, setGate] = useState(false)
    const [narrowings, setNarrowings] = useState<Narrowing[]>([])
    const [ticked, setTicked] = useState<Record<string, boolean>>({})
    const [baseStrategy, setBaseStrategy] = useState<Strategy | null>(null)
    const [baseHits, setBaseHits] = useState(0)

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

    const isSR = mode === 'search-strategy'
    const isPico = mode === 'clinical-question'
    const seedList = parseSeeds(seeds)
    const inFlight = busy || stage !== 'idle'
    // The mockup's gate: a question shorter than 8 characters is not a question. Mode 3 has no one
    // question box, so its gate is the required PICO fields instead — P, I and O. Comparison is
    // optional, because plenty of real clinical questions have no comparator and demanding one
    // invites people to invent it.
    const canBuild = (isPico ? picoComplete(pico) : question.trim().length >= 8) && !inFlight

    // The elapsed counter. It exists so a 47-second wait can prove it is still alive.
    useEffect(() => {
        if (stage === 'idle') { setElapsed(0); return }
        setElapsed(0)
        const t0 = Date.now()
        const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000)
        return () => clearInterval(id)
    }, [stage])

    const build = async () => {
        if (!canBuild) return
        setBusy(true)
        setErr('')
        try {
            const res = await fetch('/api/literature/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, criteria, seeds, dateId, typeId, databases: dbs }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErr(data?.message || 'Could not build the strategy.')
                return
            }
            const rs: DbResult[] = data.databases || []
            fresh.current = true                 // these were just counted; don't re-count them
            const sts = rs.map(r => ({ db: r.db, concepts: r.concepts, limits: r.limits }))
            setStrategies(sts)
            setResults(rs)
            setExperts(data.experts)
            setModel(data.model || '')
            // The Results column, behind the yield. See fetchRows().
            sts.forEach((st, di) => fetchRows(st, di))
        } catch {
            setErr('Could not reach the server.')
        } finally {
            setBusy(false)
        }
    }

    // ---- MODE 2, POST 1 of 3: build the query, count it, and EITHER retrieve the top 50 or put
    // the narrowing gate up. ~2.3s for the fetch.
    //
    // The records go on screen the moment they arrive, BEFORE screening starts, because the
    // fetch takes 2s and the screen takes 30 — sitting on a blank page for 32 seconds when 50
    // real citations are already in hand would be a lie of omission about what is going on.
    //
    // `narrowed` carries the escape hatch and the narrowed re-run in ONE argument, because they
    // are the same request: a strategy in the body says "you already wrote this, do not spend a
    // model call re-writing it", and `proceed` says "do not raise the gate again, I have seen the
    // count". The button that sends it is never disabled on the count — see retrieveNow.
    const runIssueReview = async (narrowed?: Strategy) => {
        setErr('')
        setRecords([])
        setFlags({})
        setPicked({})
        setSynthesis(null)
        setProvenance(null)
        setStage('fetching')
        try {
            const res = await fetch('/api/literature/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode, criteria, dateId, typeId, sort,
                    // Mode 3 sends the four fields; the server assembles the question. Mode 2
                    // sends the question. On a narrowed re-run BOTH send the question the server
                    // already handed back, because by then the sentence exists.
                    ...(isPico ? { pico, question } : { question }),
                    ...(narrowed ? { strategy: narrowed, proceed: true } : {}),
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErr(data?.message || 'Could not run the search.')
                setStage('idle')
                return
            }
            const r: DbResult = data.databases[0]
            // Mode 3: adopt the sentence the SERVER assembled from the PICO fields. Everything
            // downstream — the summary bar, the screen call, the synthesis call — then carries the
            // question that was really asked, not one the client reconstructed and hoped matched.
            if (data.question) setQuestion(data.question)
            setResults([r])
            setExperts(data.experts)
            setModel(data.model || '')
            setPhase('candidates')

            // THE GATE. Nothing was retrieved — not because we could not (the retrieval tool takes
            // a retmax now and would happily hand back the top 50 of 184,043), but because 50 out
            // of this many is a thin slice and the librarian is entitled to know that before they
            // read it as if it were the literature.
            if (r.needsNarrowing) {
                const st: Strategy = { db: 'pubmed', concepts: r.concepts, limits: r.limits }
                fresh.current = true          // the server just counted this one; don't re-count it
                setBaseStrategy(st)
                setStrategies([st])
                setNarrowings(r.narrowings || [])
                setBaseHits(r.hits)
                setTicked({})
                setGate(true)
                setStage('idle')
                return
            }

            // Retrieved. DROP THE STRATEGY: nothing in the candidates phase edits it, and leaving
            // it set would let the re-count effect land a record-less result on top of the list.
            setGate(false)
            setStrategies([])

            const recs = r.records || []
            setRecords(recs)

            // A COUNT WITHOUT RECORDS IS NOT AN EMPTY SEARCH. If PubMed says 275 papers match and
            // then hands back none of them, the retrieval was throttled — the count and the fetch
            // are different endpoints, and only one of them failed. Both `countPubmed` and
            // `fetchArticles` already retry once; when even the retry comes back empty, the honest
            // thing is to SAY the retrieval failed. Rendering an empty candidate list under a
            // 275-record count reads as "your search found nothing", which is the exact quiet lie
            // the rest of this page exists to prevent. Seen for real, 2026-07-13.
            if (!recs.length) {
                setStage('idle')
                if (r.hits > 0) {
                    setErr(`PubMed counted ${r.hits.toLocaleString()} records for this query but returned none of them. `
                        + `That is a rate limit, not an empty result — try again in a moment.`)
                }
                return
            }

            // Hand the question DOWN rather than letting screen() read it back out of state — for
            // Mode 3 the state was set two lines ago and has not applied yet. See screen().
            await screen(recs, data.question || question)
        } catch {
            setErr('Could not reach the server.')
            setStage('idle')
        }
    }

    const findRecords = () => { if (canBuild) runIssueReview() }

    // NEVER GATED ON THE COUNT, at any count. The librarian has seen the number and the slice it
    // implies; refusing them the records after that would be a tool substituting its judgment for
    // theirs, which is the failure mode this entire page is built against.
    const retrieveNow = () => { if (strategy && !inFlight) runIssueReview(strategy) }

    // Ticking a narrowing appends its block to the strategy. The re-count effect below picks that
    // up exactly as if a Mode 1 checkbox had moved: one esearch call, no model, no cost — so the
    // number that comes back is COUNTED, never estimated, and the librarian can try every
    // combination they like for free.
    const toggleNarrowing = (n: Narrowing) => {
        const next = { ...ticked, [n.label]: !ticked[n.label] }
        setTicked(next)
        if (!baseStrategy) return
        dirty.current.add(0)
        setStrategies([{
            ...baseStrategy,
            concepts: [
                ...baseStrategy.concepts,
                ...narrowings
                    .filter(x => next[x.label])
                    .map(x => ({ label: x.label, lines: [{ terms: x.terms, on: true }] })),
            ],
        }])
    }

    // ---- MODE 2, POST 2 of 3: screen all 50 in ONE call. ~29s, measured, no drops.
    //
    // The server re-fetches the abstracts by PMID. It never accepts abstract text from this
    // client, and it should not: that would be a client-controlled text-injection surface into
    // a paid model call.
    // `asked` is THREADED, not read from state, and that is not fussiness — it is a bug that has
    // already happened. Mode 3's question is assembled by the SERVER from the PICO fields, so the
    // client learns it from the build response and immediately chains into screening. `question`
    // is React state: the setter has not applied by the time this closure runs, so reading it here
    // sent an EMPTY question and the screen call 400'd — after the build had already been paid for.
    const screen = async (recs: PubRecord[], asked?: string) => {
        const q = asked || question
        setStage('screening')
        try {
            const res = await fetch('/api/literature/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phase: 'screen', mode, question: q, criteria, pmids: recs.map(r => r.pmid) }),
            })
            const data = await res.json()
            if (!res.ok) {
                // The records stay on screen and stay tickable. A screening failure costs the
                // librarian the suggestions, not the search.
                setErr(data?.message || 'Could not screen the records — tick them yourself, or try again.')
                return
            }
            const byPmid: Record<string, Screened> = {}
            const next: Record<string, boolean> = {}
            for (const f of (data.flags || []) as Screened[]) {
                byPmid[f.pmid] = f
                next[f.pmid] = !!f.include        // PRE-TICKED, then it belongs to the human
            }
            setFlags(byPmid)
            setPicked(next)
        } catch {
            setErr('Could not reach the server — tick the records yourself, or try again.')
        } finally {
            setStage('idle')
        }
    }

    // ---- MODE 2, POST 3 of 3: synthesize what the HUMAN ticked. ~47s.
    const synthesize = async () => {
        const pmids = records.filter(r => picked[r.pmid]).map(r => r.pmid)
        if (!pmids.length || inFlight) return
        setErr('')
        setStage('synthesizing')
        try {
            const res = await fetch('/api/literature/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // `mode` is what makes this a PICO ANSWER rather than a narrative survey: it picks
                // the prompt, tier-sorts the records server-side, and returns the evidence floor.
                // Omit it and Mode 3 silently degrades into Mode 2 — same records, wrong deliverable,
                // no error anywhere. (Safe to read `question` from state here, unlike in screen():
                // this one is triggered by a user click, so the render has long since landed.)
                body: JSON.stringify({ phase: 'synthesize', mode, question, pmids }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErr(data?.message || 'Could not write the synthesis.')
                return
            }
            setSynthesis(data.synthesis)
            setProvenance({ cwid: data.cwid, date: data.date })
            setModel(data.model || '')
            setPhase('synthesis')
        } catch {
            setErr('Could not reach the server.')
        } finally {
            setStage('idle')
        }
    }

    // RE-COUNT after a toggle, an edit, or a change of limits. No model — so this is a handful
    // of esearch calls and the librarian can iterate as long as they like. Debounced at 300ms
    // because each run costs 1 count for the yield plus 1 per seed, and unkeyed NCBI allows only
    // 3 requests/second (set PUBMED_API_KEY on the retrieval tool to lift it to 10/s).
    //
    // THE SAME PATH SERVES THE NARROWING GATE. Mode 2 sets `strategy` while the gate is up, and a
    // ticked narrowing is just another concept block on it — so narrowing re-counts through this
    // effect and nothing else, which is why it is free and why there is no second count path to
    // keep in sync.
    //
    // Guarded on `gate`, not merely on `strategy`: a re-count response carries NO records, so if
    // this ever fired once the candidate list was on screen it would silently empty it. Belt and
    // braces — runIssueReview also nulls the strategy the moment records land.
    const fresh = useRef(false)
    const seq = useRef(0)

    // WHICH DATABASES NEED RE-COUNTING. Toggling a line in the Scopus strategy must not spend a
    // PubMed count — each toggle already costs one count for the yield plus one per seed, and
    // unkeyed NCBI allows only 3 requests/second, so re-counting a database nobody touched is how
    // you trip a rate limit on someone else's behalf. An empty set means "everything": that is the
    // limits dropdowns, which sit on every strategy at once.
    const dirty = useRef<Set<number>>(new Set())

    useEffect(() => {
        if (!isSR && !gate) return
        if (!strategies.length) return
        if (fresh.current) { fresh.current = false; dirty.current.clear(); return }

        const targets = dirty.current.size ? Array.from(dirty.current) : strategies.map((_, i) => i)

        const mine = ++seq.current
        const t = setTimeout(async () => {
            // Cleared HERE, not above: the effect re-runs (and this cleanup fires) on every
            // keystroke, and clearing before the debounce settles would lose the record of which
            // database was edited — and fall back to re-counting all of them.
            dirty.current.clear()
            setRecounting(true)
            try {
                const fetched = await Promise.all(targets.map(async di => {
                    const res = await fetch('/api/literature/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        // No seeds in Mode 2: known-item validation is a recall check, and it is
                        // meaningless against a search that is being deliberately narrowed. Sending
                        // them would also spend one count call per seed on every tick, for nothing.
                        body: JSON.stringify({ strategy: strategies[di], seeds: isSR ? seeds : '', dateId, typeId }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data?.message || 'Could not re-count the strategy.')
                    return { di, r: data.databases[0] as DbResult, experts: data.experts }
                }))
                // A slower earlier request must never overwrite a newer count. Silently dropping
                // a stale response is the only correct thing here: the number on screen has to
                // belong to the strategy on screen.
                if (mine !== seq.current) return
                setErr('')
                setResults(rs => {
                    const next = [...rs]
                    fetched.forEach(({ di, r }) => { next[di] = r })
                    return next
                })
                // The expert panel is derived from the MeSH terms in the concept blocks, so a toggle
                // moves it. The route recomputes it for PubMed and sends nothing for Scopus (no
                // controlled vocabulary), so an absent key means "unchanged", not "empty".
                const withExperts = fetched.find(f => f.experts)
                if (withExperts) setExperts(withExperts.experts)
                // Same again: the yield has landed, so now go and fill the column behind it.
                fetched.forEach(({ di }) => fetchRows(strategies[di], di))
            } catch (e: any) {
                if (mine === seq.current) setErr(e?.message || 'Could not reach the server.')
            } finally {
                if (mine === seq.current) setRecounting(false)
            }
        }, 300)

        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [strategies, dateId, typeId, isSR, gate])

    // Keep the limits on the client object in step with the dropdowns, so the line numbering
    // redraws instantly. The server re-derives them from the same ids and the same table —
    // buildLimits() is shared, which is why the two cannot drift.
    // THE RESULTS COLUMN, FETCHED BEHIND THE YIELD.
    //
    // It is 7 count calls and a measured 5.5 seconds — the retrieval tool paces every call at 500ms,
    // because it smooths each pod to 2 req/s so that 4 HPA replicas stay under NCBI's ~10/s keyed
    // quota (shared with the ReCiter engine). Waiting for it before showing the yield would have put
    // five and a half seconds between ticking a checkbox and seeing the number you ticked it for,
    // and that loop — free, instant iteration — is the whole argument for this mode.
    //
    // So the column arrives late, and until it does each row shows an em-dash rather than a zero. A
    // count that has not been made yet is NOT a count of nothing.
    //
    // `rowSeq` is per-database and it is load-bearing: a slow column landing on a strategy that has
    // since been edited would put counts beside lines they do not belong to — a number that is
    // confidently, invisibly wrong, which is worse than no number.
    const rowSeq = useRef<Record<number, number>>({})

    // Per-database: is the column coming, here, or dead? Keyed by database index, like everything else
    // in this file. Never conflated with `recounting`, which is about the YIELD.
    const [rowState, setRowState] = useState<Record<number, RowState>>({})

    const fetchRows = async (st: Strategy, di: number, attempt = 0) => {
        // Nothing to fetch for a database we cannot count. Skipping here rather than round-tripping
        // keeps the em-dashes on screen from the first paint, and does not burn a request to be told
        // what the dialect table already knows.
        if (!DIALECTS[st.db].countable) return

        const mine = attempt === 0
            ? (rowSeq.current[di] = (rowSeq.current[di] || 0) + 1)
            : rowSeq.current[di]
        setRowState(m => ({ ...m, [di]: 'pending' }))

        try {
            const res = await fetch('/api/literature/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phase: 'rows', strategy: st, dateId, typeId }),
            })
            const data = await res.json()
            if (mine !== rowSeq.current[di]) return   // the strategy moved on. Drop it.

            if (!res.ok) {
                // ONE RETRY, AFTER A PAUSE — and then we stop and SAY SO.
                //
                // The 502 we actually see is a transient NCBI blip, and by the time it reaches us the
                // retrieval tool has ALREADY burned its own seven internal retries on it (which is why
                // the failing request takes ~19s). So an immediate re-fire would just fail again, and
                // hammering is the one thing we must not do: the tool owns the rate policy because it
                // knows the pod count and that NCBI's quota is per-KEY, shared with the ReCiter engine.
                // A single attempt after a real pause costs one call and catches a blip that has passed.
                //
                // ponytail: one retry, fixed backoff. Ceiling — a longer outage still fails, and that is
                // correct: it then says "could not count" and offers a button, rather than quietly
                // grinding through an exponential ladder on someone else's rate budget.
                if (attempt === 0 && res.status >= 500) {
                    await new Promise(r => setTimeout(r, ROWS_RETRY_MS))
                    if (mine !== rowSeq.current[di]) return
                    return fetchRows(st, di, 1)
                }
                setRowState(m => ({ ...m, [di]: 'failed' }))
                return
            }
            setResults(rs => rs.map((r, i) => (i === di ? { ...r, rowCounts: data.rowCounts || {} } : r)))
            setRowState(m => ({ ...m, [di]: 'done' }))
        } catch {
            // Never fatal — the column is a reading aid, and the yield, the seeds and the query are the
            // deliverable and are already on screen. But it is not SILENT either: the row cells say
            // "could not count" rather than sitting on an em-dash that reads as "still coming".
            if (mine === rowSeq.current[di]) setRowState(m => ({ ...m, [di]: 'failed' }))
        }
    }

    // Keep each strategy's limits in step with the dropdowns, IN ITS OWN DATABASE'S SYNTAX, so the
    // line numbering redraws instantly. The server re-derives them from the same ids and the same
    // dialect table — buildLimits() is shared, which is why the two cannot drift.
    const liveStrategies: Strategy[] = strategies.map(st => ({
        ...st, limits: buildLimits(st.db, dateId, typeId).terms,
    }))
    const liveStrategy: Strategy | null = liveStrategies[0] || null      // Modes 2 & 3

    // THE COUNT MAP IS KEYED BY PRESS LINE NUMBER, AND THE LINE NUMBERS MOVE.
    //
    // Untick one line of a two-line concept and numberStrategy drops that concept's OR-combine row,
    // so every number below it shifts by TWO. The rows on screen renumber on the same tick; the map
    // does not. Read the old map at the new numbers and each line shows a DIFFERENT line's count —
    // including the final row, the one that IS the search, which then disagrees with the yield above
    // it. `rowSeq` cannot save us here: it orders responses, and nothing is in flight yet.
    //
    // So drop the map the instant the numbering it is keyed to stops existing. RowCount already
    // renders a missing count as an em-dash, which is the honest state: a count not yet made.
    const dropRowCounts = (di?: number) => {
        setResults(rs => rs.map((r, i) => (
            di === undefined || i === di ? { ...r, rowCounts: {} } : r
        )))
        // ...AND SAY THE NEW ONES ARE COMING, from this instant.
        //
        // Dropping the map is only half the truth. The counts are invalidated HERE, on the toggle, but
        // fetchRows does not start until the yield lands ~2.4s later — so the column sat on an em-dash
        // through the debounce and the whole re-count round trip, looking IDLE while a re-count was
        // already in flight. An em-dash means "not counted"; it must not also mean "not counted, but
        // working on it", or a librarian cannot tell a busy column from a finished one.
        //
        // Only for databases we can actually count: Embase never fetches rows, so marking it pending
        // would leave it pulsing for ever, promising a number that is never coming.
        setRowState(m => {
            const next = { ...m }
            strategies.forEach((st, i) => {
                if ((di === undefined || i === di) && DIALECTS[st.db].countable) next[i] = 'pending'
            })
            return next
        })
    }

    const editConcept = (di: number, ci: number, fn: (c: Rendering) => Rendering) => {
        dirty.current.add(di)
        dropRowCounts(di)
        setStrategies(sts => sts.map((st, i) => (
            i === di ? { ...st, concepts: st.concepts.map((c, j) => (j === ci ? fn(c) : c)) } : st
        )))
    }

    // The limits dropdowns sit on EVERY strategy at once, so they rewrite the final row of every
    // database under an unchanged line number — the one mutation that moves no numbers and still
    // invalidates a count. They must also CLEAR `dirty`: it is the record of which database was
    // edited, and a limits change edits all of them. Inheriting a stale set here would re-count one
    // database and leave the other printing its new limit line under a count of the broader query.
    const changeLimits = (fn: () => void) => {
        dirty.current.clear()
        dropRowCounts()
        fn()
    }

    const toggle = (di: number, ci: number, li: number) =>
        editConcept(di, ci, c => ({ ...c, lines: c.lines.map((l, j) => (j === li ? { ...l, on: !l.on } : l)) }))

    const edit = (di: number, ci: number, li: number, terms: string) =>
        editConcept(di, ci, c => ({ ...c, lines: c.lines.map((l, j) => (j === li ? { ...l, terms } : l)) }))

    const addLine = (di: number, ci: number) =>
        editConcept(di, ci, c => ({ ...c, lines: [...c.lines, { terms: '', on: true }] }))

    // Back to the form with the question, the criteria and the limits still in it. That IS the
    // edit-and-re-run path in Mode 2: there is nothing else to edit, because the query was
    // derived from these fields.
    const newSearch = () => {
        setStrategies([])
        setResults([])
        setExperts(null)
        setErr('')
        setPhase('form')
        setRecords([])
        setFlags({})
        setPicked({})
        setSynthesis(null)
        setProvenance(null)
        setGate(false)
        setNarrowings([])
        setTicked({})
        setBaseStrategy(null)
        setBaseHits(0)
    }

    const pickMode = (id: string) => {
        if (id === mode) return
        setMode(id)
        newSearch()
    }

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
        const { rows } = numberStrategy({ db: r.db, concepts: r.concepts, limits: r.limits })
        return [
            `Database: ${DIALECTS[r.db].provenance}`,
            `Date searched: ${r.runDate}`,
            // Null is not zero, and it is not the empty string either. An uncounted database says so
            // in the methods block, because a PRISMA-S appendix reading "Records retrieved: 0" against
            // a working strategy is a fabrication a reader cannot see through.
            r.hits === null
                ? `Records retrieved: not counted — we have no API for ${DIALECTS[r.db].name}. Run this strategy in Ovid to obtain the yield.`
                : `Records retrieved: ${r.hits}`,
            ``,
            `Search strategy:`,
            ...rows
                .filter(row => row.n !== null)   // an unticked line was not searched, so it is not in the methods
                .map(row => {
                    const c = r.rowCounts?.[row.n as number]
                    const line = `${row.n}. ${row.kind === 'term' ? row.line.terms : row.text}`
                    return typeof c === 'number' ? `${line}    ${c.toLocaleString()}` : line
                }),
            ``,
            ...(r.unsupportedLimits?.length
                ? [`Limits NOT applied: ${r.unsupportedLimits.join('; ')} — ${DIALECTS[r.db].name} cannot express this limit, so the count above is not restricted by it.`, ``]
                : []),
            `Full Boolean:`,
            r.query,
            ``,
            r.seeds.length
                ? `Known-item validation: ${r.seeds.filter(x => x.retrieved).length} of ${r.seeds.length} seed records retrieved (${r.seeds.map(x => `${x.kind.toUpperCase()} ${x.id}`).join(', ')}).`
                : `Known-item validation: not performed.`,
        ].join('\n')
    }

    const retrieved = result ? result.seeds.filter(x => x.retrieved).length : 0
    const allFound = result && result.seeds.length > 0 && retrieved === result.seeds.length
    const numbered = liveStrategy ? numberStrategy(liveStrategy) : null
    // Per DATABASE now — a seed can be retrieved by PubMed and missed by Scopus, and that difference
    // is one of the more interesting things this screen can tell a librarian.
    const seedIn = (r: DbResult, id?: string) => r.seeds.find(x => x.id === id)
    const nameOf = (x?: Seed) => (x ? x.label || `${x.kind.toUpperCase()} ${x.id}` : '')

    // THE TALLY FOLLOWS THE HUMAN, NEVER THE FLAGS.
    const included = records.filter(r => picked[r.pmid])
    const excludedCount = records.length - included.length
    const screened = Object.keys(flags).length > 0
    const sortLabel = (SORTS.find(x => x.id === (result?.sort || sort)) || SORTS[0]).label.toLowerCase()

    // The gate's tone and its primary button key off ONE number, and it is the counted one: the
    // re-count above keeps result.hits in step with whatever is ticked. Once it falls to
    // NARROW_ABOVE the warning drops away and the button becomes an ordinary "Find records" —
    // nothing to warn about, so nothing warns.
    const over = !!result && result.hits > NARROW_ABOVE

    const markdown = () => {
        if (!synthesis) return ''
        const cols = ['Study', 'Year', 'Journal', 'Design', 'Intervention']
        return [
            `# ${question}`,
            ``,
            `| ${cols.join(' | ')} |`,
            `| ${cols.map(() => '---').join(' | ')} |`,
            ...synthesis.table.map(r => `| ${r.study} | ${r.year} | ${r.journal} | ${r.design} | ${r.intervention} |`),
            ``,
            synthesis.prose,
            ``,
            provenance
                ? `${included.length} of ${records.length} records screened in by ${provenance.cwid} on ${provenance.date}.`
                : ``,
            `AI-assisted synthesis, drafted by ${model ? `${modelLabel(model)} (${model})` : 'a language model'}, over the records selected above. Verify every claim against the source.`,
        ].join('\n')
    }

    // ---- DOWNLOADS. --------------------------------------------------------------------------
    //
    // Each section carries its own button, because that is where someone is standing when they
    // decide they want it. The FORMAT is chosen per section rather than offered as a menu: a
    // strategy destined for a manuscript appendix wants Word; fifty records destined for Covidence
    // or a filter want a spreadsheet; the query itself wants to be pasted straight back into
    // PubMed, so it wants plain text and nothing else.
    //
    // EVERY ONE OF THEM CARRIES THE QUERY, THE COUNT AND THE DATE. See literatureExport.ts.

    // Built from `result`, NEVER from the live `strategy` — the export must describe the toggled
    // state that produced the count printed beside it.
    // WHO RAN IT. `provenance` is the server's word for it, but it only arrives with the synthesis —
    // so a strategy or a records export taken BEFORE the synthesis would have gone out unattributed,
    // and an export nobody can be traced to is one nobody has to stand behind. The session knows
    // who this is from the moment the page loads.
    const runBy = provenance?.cwid || (session?.data?.username as string | undefined)

    // WHICH MODEL. Carried on the facts so that every builder discloses it without having to be
    // told twice — the synthesis, the strategy appendix and the spreadsheet all read it from here.
    const runFacts = (r: DbResult): RunFacts => ({
        db: r.db,
        query: r.query,
        hits: r.hits,
        // Modes 2/3 only ever pull down a capped, ranked slice, so the export must not print the
        // yield under the word "retrieved". Mode 1 counts and never retrieves — it leaves this unset
        // and keeps its single, correct row.
        retrieved: r.records?.length,
        runDate: r.runDate,
        cwid: runBy,
        limits: r.limits,
        unsupportedLimits: r.unsupportedLimits,
        sort: r.records?.length ? sortLabel : undefined,
        model,
    })

    const docxFailed = () => setErr('Could not build the Word document.')

    // THE FILENAME NAMES THE DATABASE, because the file is downloaded PER DATABASE and the download
    // folder is where provenance goes to die. Every query used to land as `pubmed-query-<date>.txt` —
    // so a Scopus query was saved under PubMed's name, and once Embase (Ovid) shipped there were THREE
    // panels writing one filename, each silently overwriting the last. A librarian ends up with a
    // single file called "pubmed-query" containing an Ovid strategy, and no way to know.
    //
    // `r.db` is right there on the result. Use it.
    const dlStrategy = (r: DbResult) =>
        saveDocx(strategyDoc(r, question, runBy, model), `${stamp(`search-strategy-${r.db}`, r.runDate)}.docx`)
            .catch(docxFailed)

    const dlQuery = (r: DbResult) =>
        saveText(r.query, `${stamp(`${r.db}-query`, r.runDate)}.txt`)

    const dlRecords = (r: DbResult) =>
        saveXlsx(recordSheets(records, flags, picked, runFacts(r)), `${stamp('records', r.runDate)}.xlsx`)
            .catch(() => setErr('Could not build the spreadsheet.'))

    const dlSynthesis = (r: DbResult) => {
        if (!synthesis) return
        saveDocx(
            synthesisDoc(synthesis, runFacts(r), question,
                { pico: isPico, screenedIn: included.length, screenedOf: records.length }),
            `${stamp(isPico ? 'clinical-answer' : 'issue-review', r.runDate)}.docx`,
        ).catch(docxFailed)
    }

    // THE PACKET: the whole run as one Word file plus one spreadsheet, for the co-author who was
    // not in the room, or for a manuscript submission where the search has to travel as a single
    // artifact. Same builders, concatenated — there is no second source of truth.
    const dlPacket = (r: DbResult) => {
        const facts = runFacts(r)
        // EVERY database that was searched, not just the first. A methods appendix that reports one
        // of two searches is not a methods appendix — and the two are separate documents inside the
        // one file precisely because they are separate searches, with separate counts that must
        // never be added together.
        const blocks: Block[] = [
            ...results.flatMap(x => strategyDoc(x, question, runBy, model)),
            ...(synthesis
                ? synthesisDoc(synthesis, facts, question,
                    { pico: isPico, screenedIn: included.length, screenedOf: records.length })
                : []),
        ]
        saveDocx(blocks, `${stamp('literature-search', r.runDate)}.docx`).catch(docxFailed)
        if (records.length) {
            saveXlsx(recordSheets(records, flags, picked, facts), `${stamp('literature-search', r.runDate)}.xlsx`)
                .catch(() => setErr('Could not build the spreadsheet.'))
        }
    }

    // The wait, with a real number on it. `expect` is the MEASURED median, so the bar is an
    // estimate and the seconds counter is the truth — the bar stops at 95% rather than telling
    // the comfortable lie that it is finished.
    const progress = (() => {
        if (stage === 'idle') return null
        const expect = STAGES[stage].expect
        const label =
            stage === 'fetching' ? `Retrieving ${CAP} records…`
                : stage === 'screening' ? `Screening ${records.length} record${records.length === 1 ? '' : 's'}…`
                    : 'Writing the synthesis…'
        const note =
            stage === 'fetching' ? 'Running the query against PubMed.'
                : stage === 'screening' ? `One model call over all ${records.length} abstracts, against your criteria. The suggestions will land on the rows below — usually about 30 seconds.`
                    : `One model call over the ${included.length} record${included.length === 1 ? '' : 's'} you selected. Usually about 45 seconds.`
        return { label, note, pct: Math.min(95, Math.round((elapsed / expect) * 100)) }
    })()

    const progressPanel = progress && (
        <div className={s.progress} aria-live="polite">
            <div className={s.progLine}>
                <b>{progress.label}</b>
                <span className={s.spacer} />
                <span className={s.progElapsed}>{elapsed}s</span>
            </div>
            <div className={s.bar}>
                <span className={s.barFill} style={{ width: `${progress.pct}%` }} />
            </div>
            <p className={s.help}>{progress.note}</p>
        </div>
    )

    // AT WEILL CORNELL — works with no records at all, straight off the query's MeSH. Shown on
    // the strategy, the candidates and the synthesis: the "who here already knows this" question
    // is the one thing this page can answer that PubMed cannot.
    const expertsPanel = experts && experts.experts.length > 0 && (
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
    )

    const showForm = isSR ? !result : phase === 'form'
    const crumb = phase === 'synthesis' ? 'Synthesis' : isSR ? 'Search strategy' : 'Candidates'

    return (
        <div className={s.page}>
            {showForm ? (
                <>
                    <h1 className={s.title}>Literature Search</h1>
                    <p className={s.sub}>
                        {isSR
                            ? 'Build a reproducible search strategy for a systematic review — not a finished answer.'
                            : 'Retrieve, screen and synthesize the top 50 records — an orientation, not a systematic review.'}
                    </p>
                </>
            ) : (
                <div className={s.crumb}>Literature Search &nbsp;&rsaquo;&nbsp; <b>{crumb}</b></div>
            )}

            {/* THE FORM. Collapses to a one-line summary bar once there is a deliverable — on a
                laptop it otherwise sits below the fold, under a form nobody is reading any more.
                "New search" brings it back, with the question still in it. */}
            {showForm ? (
                <div className={s.card}>
                    {/*
                      * The mode is a RETRIEVAL OBJECTIVE, not a template: Search strategy chases
                      * recall and ends in a handoff to Covidence, Issue review chases precision
                      * and ends in a synthesis. Changing it clears the deliverable, because a
                      * strategy and a candidate list are answers to different questions.
                      */}
                    <div className={s.field}>
                        <span className={s.eyebrow}>Mode</span>
                        <div className={s.modes} role="radiogroup" aria-label="Search mode">
                            {MODES.map(m => (
                                <label
                                    key={m.id}
                                    htmlFor={`lit-mode-${m.id}`}
                                    className={`${s.mode} ${mode === m.id ? s.modeSelected : ''} ${m.ready ? '' : s.modeDisabled}`}
                                >
                                    {/* Disabled while a call is in flight: the form is still on screen during
                                        the 2s fetch, and switching modes underneath a request that is about
                                        to land would drop its result into the wrong screen. */}
                                    <input
                                        id={`lit-mode-${m.id}`}
                                        type="radio"
                                        name="lit-mode"
                                        checked={mode === m.id}
                                        disabled={!m.ready || inFlight}
                                        onChange={() => pickMode(m.id)}
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
                            {isSR ? (
                                <>
                                    Search strategy produces a reproducible, peer-reviewable query. Screen and synthesize
                                    the results in Covidence.
                                </>
                            ) : isPico ? (
                                <>
                                    Clinical question answers a PICO question from the top {CAP} records, ordered by
                                    study design &mdash; guidelines and systematic reviews before trials, using
                                    PubMed&rsquo;s own indexing. <b>It tells you how strong that evidence is, including
                                    when it is weak.</b> Verify every claim against the sources.
                                </>
                            ) : (
                                <>
                                    Issue review retrieves the top {CAP} records, flags each one against your criteria and
                                    drafts a synthesis you must verify. <b>It is not a systematic review</b> &mdash; for that,
                                    use Search strategy and hand off to Covidence.
                                </>
                            )}
                        </p>
                    </div>

                    {/*
                      * MODE 3 ASKS FOR FOUR FIELDS, NOT A TEXTAREA, AND THAT IS THE WHOLE PHI
                      * ARGUMENT. A box that says "describe the case" invites a case history; a
                      * field labelled Population, placeheld with "adults with type 2 diabetes and
                      * CKD", teaches that Population is a clinical CLASS. The hazard is designed
                      * out at the affordance instead of being policed by a detector afterwards —
                      * and a detector was ruled out, because the obvious MRN heuristic ("a 7-10
                      * digit number") fires on every 8-digit PMID in the seeds field.
                      *
                      * The placeholders are load-bearing. They are the instruction.
                      */}
                    {isPico ? (
                        <div className={s.field}>
                            <label className={s.eyebrow}>The clinical question</label>
                            <div className={s.pico}>
                                {PICO_FIELDS.map(f => (
                                    <div key={f.id} className={s.picoField}>
                                        <label className={s.picoLabel} htmlFor={`lit-${f.id}`}>
                                            {f.label}
                                            {!f.required && <span className={s.picoOptional}> — optional</span>}
                                        </label>
                                        <input
                                            id={`lit-${f.id}`}
                                            type="text"
                                            className={s.input}
                                            value={pico[f.id] || ''}
                                            onChange={e => setPico(p => ({ ...p, [f.id]: e.target.value }))}
                                            placeholder={f.placeholder}
                                        />
                                    </div>
                                ))}
                            </div>
                            {picoComplete(pico) && (
                                <p className={s.picoEcho}>{picoQuestion(pico as Pico)}</p>
                            )}
                            <p className={s.help}>
                                Population is a clinical class, not a person. Your question is sent to an
                                external AI service &mdash; do not include patient identifiers.
                            </p>
                        </div>
                    ) : (
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
                    )}

                    {/*
                      * Embase and Scopus are visible-but-disabled on purpose. It sets the
                      * expectation, and it keeps the query artifact an ARRAY of per-database
                      * results rather than letting a scalar sneak in.
                      */}
                    <div className={s.field}>
                        <span className={s.eyebrow}>Databases</span>
                        <div className={s.dbRow}>
                            {DATABASES.map(d => {
                                // PubMed is always on and cannot be turned off — it is the only database
                                // every mode can use. Scopus is offered in Search strategy ONLY (Modes 2
                                // and 3 rank on PubMed's publication-type index, which Scopus lacks).
                                const fixed = d.id === 'pubmed'
                                const usable = d.ready && (!d.srOnly || isSR)
                                const on = fixed || (usable && dbs.includes(d.id as Db))
                                return (
                                    <label
                                        key={d.id}
                                        htmlFor={`lit-db-${d.id}`}
                                        className={`${s.db} ${usable || fixed ? '' : s.dbOff}`}
                                        title={d.note || ''}
                                    >
                                        <input
                                            id={`lit-db-${d.id}`}
                                            type="checkbox"
                                            checked={on}
                                            disabled={fixed || !usable}
                                            onChange={() => setDbs(cur => (
                                                cur.includes(d.id as Db)
                                                    ? cur.filter(x => x !== d.id)
                                                    : [...cur, d.id as Db]
                                            ))}
                                        />
                                        {d.label}
                                        {!d.ready && <span className={s.soon}>(soon)</span>}
                                        {d.ready && d.srOnly && !isSR && <span className={s.soon}>(search strategy only)</span>}
                                    </label>
                                )
                            })}
                        </div>
                    </div>

                    {/* THE RECALL CONTRACT. Search-strategy mode only: a known-item check is how you
                        prove a strategy did not silently miss half the literature, and it is
                        meaningless against a top-50 slice, which is not trying to be exhaustive.
                        The seed count is live and turns green once armed — a strategy with no seeds
                        cannot be validated, and the pill is the cheapest possible way to say so
                        before the librarian has spent a model call. */}
                    {isSR && (
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
                    )}

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
                        <p className={s.help}>
                            {isSR
                                ? 'Shapes the query.'
                                : 'Shapes the query — and in this mode it is also what each record is screened against, so the more specific it is, the better the flags.'}
                        </p>
                    </div>

                    {/*
                      * LIMITS ARE DROPDOWNS, NOT PROSE. They used to be a free-text box passed to
                      * the model, which meant the MODEL decided what "2021-2026" meant -- a quiet
                      * hole in the one thing this mode promises. The ids resolve to PubMed syntax
                      * server-side, by a table both ends share.
                      *
                      * SORT is Issue-review only, and it is load-bearing rather than sugar: without
                      * it, "the top 50" is an unranked slice of the yield and the mode's promise is
                      * false. There is deliberately no Max control next to it — see CAP.
                      */}
                    <div className={s.controls}>
                        <div className={s.control}>
                            <label htmlFor="lit-date">Date</label>
                            <select id="lit-date" className={s.input} value={dateId} onChange={e => changeLimits(() => setDateId(e.target.value))}>
                                {dates.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                            </select>
                        </div>
                        <div className={s.control}>
                            <label htmlFor="lit-type">Publication type</label>
                            <select id="lit-type" className={s.input} value={typeId} onChange={e => changeLimits(() => setTypeId(e.target.value))}>
                                {types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                        </div>
                        {!isSR && (
                            <div className={s.control}>
                                <label htmlFor="lit-sort">Rank by</label>
                                <select id="lit-sort" className={s.input} value={sort} onChange={e => setSort(e.target.value)}>
                                    {SORTS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                                </select>
                            </div>
                        )}
                        <span className={s.spacer} />
                        <button className={s.btn} onClick={isSR ? build : findRecords} disabled={!canBuild}>
                            {isSR
                                ? (busy ? 'Building strategy…' : 'Build strategy')
                                : (inFlight ? 'Working…' : 'Find records')}
                        </button>
                    </div>

                    <p className={s.capNote}>
                        {isSR ? (
                            <>
                                <b>No result cap in this mode.</b> A systematic-review search is designed to over-retrieve:
                                a 5,000-record yield is a success, not an error.
                            </>
                        ) : (
                            <>
                                <b>The top {CAP} records, and that is the mode.</b>{' '}
                                {isPico ? 'Clinical question' : 'Issue review'} reads every abstract it
                                screens, so the cap is what fits in one pass &mdash; it is a property of the mode, not a
                                setting you can raise. If the yield runs past {NARROW_ABOVE.toLocaleString()} we will not
                                quietly hand you a slice of it: we will show you the count and offer narrowings, each one
                                priced in records, and you decide.
                            </>
                        )}
                    </p>
                </div>
            ) : (
                <div className={s.summary}>
                    <span className={s.chip}>{isSR ? 'Search strategy' : 'Issue review'}</span>
                    <span className={s.summaryQ}>&ldquo;{question}&rdquo;</span>
                    {!isSR && result && (
                        <span className={`${s.summaryN} ${recounting ? s.hitsStale : ''}`}>
                            {result.hits.toLocaleString()} records
                        </span>
                    )}
                    <button className={s.btnSecondary} onClick={newSearch} disabled={inFlight}>New search</button>
                </div>
            )}

            {/* The wait, before there is anything else to look at. Not gated on `showForm` any
                more: retrieving from the narrowing gate happens with the form already collapsed,
                and that fetch deserves the same progress line as the one from the form. */}
            {stage === 'fetching' && progressPanel}

            {err && <div role="alert" className={s.error}>{err}</div>}

            {/* ============ MODE 1 — THE STRATEGY ============ */}
            {isSR && results.length > 0 && (
                <>
                    {/* ONE PANEL PER DATABASE. They share the concept LABELS and nothing else: each
                        set of terms was written natively for its own database, from the question.
                        Two counts sit side by side, and they are NOT the same search — which is the
                        honest thing to show, and the reason the panels are separate rather than
                        summed. Counts across databases must never be added: the overlap is large
                        and unmeasured until records are deduped. */}
                    {results.map((result, di) => {
                    const live = liveStrategies[di]
                    if (!live) return null
                    const numbered = numberStrategy(live)
                    const retrieved = result.seeds.filter(x => x.retrieved).length
                    const allFound = result.seeds.length > 0 && retrieved === result.seeds.length
                    return (
                    <div key={result.db}>
                    <section className={s.panel} aria-live="polite">
                        <div className={s.panelHead}>
                            <h2 className={s.panelTitle}>{result.dbName}</h2>
                            {/* A DATABASE WE CANNOT COUNT SHOWS NO NUMBER. `hits` is null for Embase
                                (Ovid) — we have no API — and null is NOT zero. Rendering it as "0
                                records" beside a perfectly good strategy would be the most damaging
                                thing on this screen: it reads as "your search found nothing." */}
                            {result.hits === null ? (
                                <span className={s.notCounted}>not counted &mdash; run it in Ovid</span>
                            ) : (
                                <span className={`${s.hits} ${recounting ? s.hitsStale : ''}`}>
                                    {result.hits.toLocaleString()} <span>records</span>
                                </span>
                            )}
                            {recounting && result.hits !== null && <span className={s.recounting}>re-counting…</span>}
                        </div>

                        {/* SCOPUS IS NOT A SECOND PUBMED, AND THE SCREEN SAYS SO. It has no controlled
                            vocabulary — nothing to explode, no MeSH analogue — so this strategy is
                            faithfully the same idea and systematically LESS SENSITIVE than the PubMed
                            one beside it. For a systematic review, where recall is the cardinal
                            virtue, that is a methodological cost no engineering can remove, and a
                            librarian is entitled to read it before they trust the number above. */}
                        {result.db === 'scopus' && (
                            <div className={s.dbNote}>
                                Scopus has <b>no controlled vocabulary</b> — no MeSH, nothing to explode — so every
                                concept below rests on free text alone. It is a <b>supplementary</b> database here,
                                not a PubMed-equivalent one.
                            </div>
                        )}

                        {/* A LIMIT THIS DATABASE CANNOT EXPRESS. Never silently dropped: the count
                            above would then answer a BROADER question than the one asked, sitting
                            next to a PubMed count that answered the narrow one. */}
                        {result.unsupportedLimits?.length > 0 && (
                            <div className={`${s.dbNote} ${s.dbNoteWarn}`}>
                                <b>{result.unsupportedLimits.join('; ')}</b> could not be applied &mdash; {result.dbName} indexes a
                                document type (article, review), not a study design, so it has no way to say this.
                                The count above is <b>not</b> restricted by it.
                            </div>
                        )}

                        <div className={s.lines}>
                            {numbered.rows.map((row, i) => {
                                // A combination line (6 = 4 OR 5) is DERIVED. No checkbox: there is
                                // nothing to decide about it, it recomputes from the lines above.
                                if (row.kind === 'combine') {
                                    return (
                                        <div className={s.line} key={`c${i}`}>
                                            <span className={s.lineGutter} />
                                            <span className={s.lineNum}>{row.n}</span>
                                            <span className={s.combine}>{row.text}</span>
                                            <RowCount n={row.n} counts={result.rowCounts} stale={recounting} state={rowState[di] || 'done'} />
                                        </div>
                                    )
                                }

                                const seed = seedIn(result, row.line.suggestedFor)
                                return (
                                    <div key={`t${row.ci}-${row.li}`}>
                                        <div className={s.line}>
                                            <input
                                                type="checkbox"
                                                className={s.lineCheck}
                                                checked={row.line.on}
                                                onChange={() => toggle(di, row.ci, row.li)}
                                                aria-label={`Include line: ${row.line.terms.slice(0, 60)}`}
                                            />
                                            <span className={s.lineNum}>{row.n ?? '·'}</span>
                                            <LineInput
                                                value={row.line.terms}
                                                on={row.line.on}
                                                onChange={v => edit(di, row.ci, row.li, v)}
                                            />
                                            <RowCount n={row.n} counts={result.rowCounts} stale={recounting} state={rowState[di] || 'done'} />
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

                            {/* THE COLUMN DIED, AND IT SAYS SO. The yield above is still real — it was
                                counted in a different call — so this is not an error banner over the
                                whole panel, which would overstate it. It is a line under the column
                                that failed, offering the one thing that fixes it. */}
                            {rowState[di] === 'failed' && (
                                <div className={s.rowsFailed}>
                                    <span>
                                        The per-line counts could not be fetched &mdash; PubMed did not answer.
                                        The yield above is unaffected.
                                    </span>
                                    <button className={s.linkBtn} onClick={() => fetchRows(liveStrategies[di], di)}>
                                        Retry
                                    </button>
                                </div>
                            )}

                            <div className={s.addLines}>
                                {live.concepts.map((c, ci) => (
                                    <button key={ci} className={s.addLine} onClick={() => addLine(di, ci)}>
                                        + line to {c.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={s.panelFoot}>
                            {/* The QUERY is model-drafted too, not just the prose — so the strategy screen
                                names the model exactly like the synthesis does, and the export says so in
                                its repro header. A PRISMA-S appendix that does not disclose that the
                                strategy was AI-drafted and human-reviewed is incomplete. */}
                            <span>
                                Run {result.runDate}{result.limits ? ` · limits: ${result.limits}` : ' · no limits'}
                                {model ? ` · drafted by ${modelLabel(model)}` : ''}
                            </span>
                            <span className={s.spacer} />
                            <span>Tick, untick or edit any line &mdash; it re-counts for free.</span>
                            {/* The strategy is the deliverable, so it downloads FROM the strategy —
                                not from a menu somewhere else. Word for the appendix, plain text for
                                the query, because a query wants to be pasted back into the database
                                that produced it. Both describe the TOGGLED state, never the draft. */}
                            <div className={s.footBtns}>
                                <button
                                    className={`${s.btnSecondary} ${copied === 'query' ? s.btnSecondaryDone : ''}`}
                                    onClick={() => copy(result.query, 'query')}
                                    disabled={!result.query}
                                >
                                    {copied === 'query' ? '✓ Copied' : 'Copy query'}
                                </button>
                                <button className={s.btnSecondary} onClick={() => dlQuery(result)} disabled={!result.query}>
                                    Query (.txt)
                                </button>
                                <button className={s.btnSecondary} onClick={() => dlStrategy(result)} disabled={recounting || !result.query}>
                                    Word (.docx)
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* KNOWN-ITEM VALIDATION, PER DATABASE. A seed can be retrieved by PubMed and
                        MISSED by Scopus — and that difference is often the most informative thing on
                        this screen, because it is a fact about the databases, not about the query. */}
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
                        {/* A DATABASE WE CANNOT COUNT CANNOT BE SEED-CHECKED EITHER, and it must not
                            borrow PubMed's "add some seeds and re-run" advice — that advice is FALSE
                            here. No number of seeds will ever make Embase testable from this screen;
                            the check moves to Ovid, with the librarian. Saying "recall cannot be
                            verified — add seeds" would send them round a loop that has no exit. */}
                        {result.hits === null ? (
                            <div className={s.recallLine}>
                                <span className={`${s.dot} ${s.dotWarn}`} />
                                <span>
                                    <b>Not checkable from here.</b> A recall check needs a count, and we have no API for{' '}
                                    {result.dbName} &mdash; seeds would change nothing. Run the strategy in Ovid and
                                    look for the papers it must retrieve. Check the Emtree lines while you are there:
                                    run each one on its own, and <b>a heading line that returns 0 is a dead line.</b>
                                </span>
                            </div>
                        ) : result.seeds.length === 0 ? (
                            <div className={s.recallLine}>
                                <span className={`${s.dot} ${s.dotWarn}`} />
                                <span>
                                    No known-item seeds provided &mdash; <b>recall cannot be verified.</b> Add PMIDs
                                    or DOIs of papers this search must retrieve, and re-run, to make this strategy
                                    testable.
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
                                            <div className={s.seed} key={`${x.kind}${x.id}`}>
                                                <span className={`${s.seedMark} ${x.retrieved ? s.seedHit : s.seedMiss}`}>
                                                    {x.retrieved ? '✓' : '✗'}
                                                </span>
                                                {/* Author + year, not a bare PMID: a librarian who named four
                                                    seeds cannot tell which paper missed from an 8-digit number. */}
                                                {x.label && <span className={s.seedName}>{x.label}</span>}
                                                <span className={s.seedId}>{x.kind.toUpperCase()} {x.id}</span>
                                                {!x.retrieved && (
                                                    <span className={s.verdict}>
                                                        {x.notInDatabase ? 'Not in this database' : 'Not retrieved'}
                                                    </span>
                                                )}

                                                {/* The reason is DERIVED by re-counting the seed against each
                                                    block AND the limits, never guessed by the model. A paper can
                                                    fail both at once, so both are reported — naming only the
                                                    block sends a librarian off to widen a search that still
                                                    cannot return it. */}
                                                {!x.retrieved && (
                                                    <span className={s.why}>
                                                        {/* NOT A STRATEGY BUG, AND IT MUST NOT READ AS ONE. The paper
                                                            is not in this database at all, so no widening of any block
                                                            can ever retrieve it. Without this verdict the seed would
                                                            "fail" every block at once and look like a catastrophically
                                                            narrow query — sending a librarian off to fix a search that
                                                            was never broken. It is also a real finding in its own
                                                            right: it is what Scopus's coverage gap LOOKS like. */}
                                                        {x.notInDatabase && (
                                                            <><b>{result.dbName} does not index this paper.</b> No change to the
                                                                strategy can retrieve it &mdash; this is a coverage gap in the
                                                                database, not a fault in the query.</>
                                                        )}
                                                        {!x.notInDatabase && !failing.length && !x.failsLimits && (
                                                            <>Nothing is ticked, so there is no strategy to retrieve it.</>
                                                        )}
                                                        {!x.notInDatabase && failing.length > 0 && (
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
                                                        {!x.notInDatabase && x.failsLimits && (
                                                            <>
                                                                {failing.length > 0 ? <>It also fails your </> : <>It matches every block you have ticked, so your </>}
                                                                <b>limits</b>
                                                                {failing.length > 0
                                                                    ? <>, so widening the {failing.length > 1 ? 'blocks' : 'block'} alone will not bring it back &mdash; change the date range or publication type.</>
                                                                    : <> are what exclude it &mdash; change the date range or publication type.</>}
                                                            </>
                                                        )}
                                                        {/* ONLY PROMISE A SUGGESTED LINE IF ONE ACTUALLY EXISTS. The
                                                            model-written widening is a PubMed move — it works by reading
                                                            the paper's MeSH descriptors, and Scopus has no controlled
                                                            vocabulary to read. So in a Scopus panel there is no unticked
                                                            line waiting, and telling a librarian to go and find one is
                                                            the exact species of confident, plausible falsehood this
                                                            feature exists to prevent. Checked against the STRATEGY, not
                                                            against the database name: if the suggestion is not there, do
                                                            not mention it, whatever produced it. */}
                                                        {!x.notInDatabase && failing.length > 0 && !x.failsLimits && (
                                                            live.concepts.some(c => c.lines.some(l => l.suggestedFor === x.id))
                                                                ? <>Widen {failing.length > 1 ? 'them' : 'it'} to retrieve this paper &mdash; a
                                                                    suggested line is waiting, unticked, in the strategy above.</>
                                                                : <>Widen {failing.length > 1 ? 'them' : 'it'} to retrieve this paper.</>
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

                    </div>
                    )
                    })}


                    {/* Embase used to be a disabled checkbox and a "Coming soon" card here. It is now a
                        real, drafted, uncounted strategy — so the promise is kept and the card is gone.
                        CENTRAL is the one still outstanding, and it says so rather than implying a date. */}
                    <div className={s.pending}>
                        <div className={s.pendingHead}>
                            <span className={s.eyebrow}>CENTRAL</span>
                            <span className={s.expertsCount}>not searched</span>
                        </div>
                        <div className={s.pendingNote}>
                            A Cochrane-compliant search also wants CENTRAL (the Cochrane trials register).
                            It is not searched here.
                        </div>
                    </div>

                    {expertsPanel}

                    <div className={s.actions}>
                        <button
                            className={s.btn}
                            onClick={() => copy(results.map(prismaBlock).join('\n\n'), 'prisma')}
                            disabled={recounting || !result.query}
                        >
                            {copied === 'prisma' ? '✓ Copied — paste into your manuscript' : 'Copy PRISMA-S methods block'}
                        </button>
                        <button
                            className={s.btnSecondary}
                            onClick={() => dlPacket(result)}
                            disabled={recounting || !result.query}
                        >
                            Download everything
                        </button>
                    </div>
                </>
            )}

            {/* ============ MODE 2, SCREEN 3 — CANDIDATES + SCREENING ============ */}
            {!isSR && phase === 'candidates' && result && (
                <>
                    {/* THE QUERY, READ-ONLY. The librarian did not write it, so they must be able to
                        see it: a synthesis over records retrieved by a query nobody looked at is
                        not evidence, it is a vibe. */}
                    <div className={`${s.card} ${s.queryCard}`}>
                        <div className={s.query}>
                            <code className={s.queryCode}>{result.query}</code>
                            <div className={s.queryActs}>
                                <button
                                    className={`${s.btnSecondary} ${copied === 'query' ? s.btnSecondaryDone : ''}`}
                                    onClick={() => copy(result.query, 'query')}
                                    disabled={!result.query}
                                >
                                    {copied === 'query' ? '✓ Copied' : 'Copy query'}
                                </button>
                                <button className={s.btnSecondary} onClick={newSearch} disabled={inFlight}>
                                    Edit &amp; re-run
                                </button>
                            </div>
                        </div>
                        {/* THE RATIO, ALWAYS. "top 50 retrieved by most relevant" next to a yield
                            of 1,391 is the one line that stops a thin slice from being read as the
                            literature — so it is stated whether the slice is thin or not, and the
                            "all N retrieved" case earns its wording by actually being all of them
                            (records.length, what arrived — not hits, what PubMed claims). */}
                        <div className={`${s.counts} ${recounting ? s.hitsStale : ''}`}>
                            PubMed <b>{result.hits.toLocaleString()}</b>
                            {gate ? (
                                <> &nbsp;&middot;&nbsp; nothing retrieved yet</>
                            ) : records.length >= result.hits ? (
                                <> &nbsp;&middot;&nbsp; all {records.length} retrieved &nbsp;&middot;&nbsp; run {result.runDate}</>
                            ) : (
                                <> &nbsp;&middot;&nbsp; top {records.length} retrieved by {sortLabel} &nbsp;&middot;&nbsp; run {result.runDate}</>
                            )}
                        </div>
                    </div>

                    {/* ============ THE NARROWING GATE ============
                        A big yield is a FINDING, not an error, and it is not a refusal either. The
                        old behaviour was both wrong halves at once: hard-refuse above 2,000 (which
                        was only ever the retrieval tool's fetch limit, and that limit is gone), and
                        below it, silently take the top 50 of 1,391 without a word.

                        So: no refusal, and no silence. The count comes back with PRICED narrowings
                        — each one COUNTED server-side, never estimated, and any that would not
                        actually reduce the yield dropped before it ever reached this list, because
                        advice that changes nothing is worse than no advice.

                        It is an in-page card, not a dialog. Nothing here is a decision we are
                        entitled to interrupt someone for. */}
                    {gate ? (
                        <div className={`${s.card} ${s.narrowCard}`}>
                            {over ? (
                                <div className={s.caveat}>
                                    <span aria-hidden="true">&#9888;</span>
                                    <span>
                                        <b>{result.hits.toLocaleString()} records match.</b> {isPico ? 'Clinical question' : 'Issue review'} reads only the
                                        top {CAP}, so that is a thin slice of them. Narrow it &mdash; each option below
                                        shows what you would be left with.
                                    </span>
                                </div>
                            ) : result.hits === 0 ? (
                                <div className={s.recallLine}>
                                    <span className={`${s.dot} ${s.dotWarn}`} />
                                    <span>
                                        <b>Nothing matches now.</b> You have narrowed the search down to nothing &mdash;
                                        untick one of the options below.
                                    </span>
                                </div>
                            ) : (
                                <div className={s.recallLine}>
                                    <span className={s.dot} />
                                    <span>
                                        <b>{result.hits.toLocaleString()} records.</b> The top {CAP} of that is a
                                        defensible slice. Retrieve them.
                                    </span>
                                </div>
                            )}

                            {narrowings.length > 0 ? (
                                <>
                                    <div className={s.narrowList}>
                                        {narrowings.map(n => {
                                            const on = !!ticked[n.label]
                                            return (
                                                <label className={`${s.narrow} ${on ? s.narrowOn : ''}`} key={n.label}>
                                                    <input
                                                        type="checkbox"
                                                        className={s.lineCheck}
                                                        checked={on}
                                                        disabled={inFlight}
                                                        onChange={() => toggleNarrowing(n)}
                                                    />
                                                    <span className={s.narrowLabel}>{n.label}</span>
                                                    <span className={s.narrowPrice}>
                                                        {baseHits.toLocaleString()}
                                                        <span className={s.narrowArrow} aria-hidden="true">&rarr;</span>
                                                        <b>{n.hits.toLocaleString()}</b>
                                                    </span>
                                                    <span className={s.narrowWhy}>{n.why}</span>
                                                    {/* The block that gets AND-ed in. The librarian did not write
                                                        this query and is about to change it, so they have to be able
                                                        to see exactly what changes — and the full Boolean above
                                                        re-assembles the moment this is ticked. */}
                                                    <code className={s.narrowTerms}>{n.terms}</code>
                                                </label>
                                            )
                                        })}
                                    </div>

                                    <p className={s.help}>
                                        Each option was counted on its own against the {baseHits.toLocaleString()}-record
                                        query, so those are its numbers alone. Ticking more than one only narrows
                                        further &mdash; a combination lands <b>at or below</b> the smallest of them, and
                                        the live count below is re-counted against PubMed every time you tick.{' '}
                                        <b>It is never an estimate.</b>
                                    </p>
                                </>
                            ) : (
                                <p className={s.help}>
                                    <b>Nothing we could price would actually narrow this.</b> Every candidate we counted
                                    came back at the same yield, so none of them is advice worth taking. Tighten the
                                    question or the limits with <b>Edit &amp; re-run</b> &mdash; or take the top {CAP}
                                    {' '}anyway, now that you know what it is a slice of.
                                </p>
                            )}

                            <div className={s.narrowFoot}>
                                <span className={`${s.counts} ${recounting ? s.hitsStale : ''}`}>
                                    Now <b>{result.hits.toLocaleString()}</b> record{result.hits === 1 ? '' : 's'}
                                </span>
                                {recounting && <span className={s.recounting}>re-counting…</span>}
                                <span className={s.spacer} />
                                {/* NEVER DISABLED ON THE COUNT. Below the boundary it is an ordinary
                                    "Find records"; above it, it says what it is doing and does it
                                    anyway. Trapping the librarian behind a number would be the tool
                                    overruling the person qualified to make the call. */}
                                <button className={s.btn} onClick={retrieveNow} disabled={inFlight}>
                                    {stage === 'fetching'
                                        ? 'Retrieving…'
                                        : over ? `Retrieve the top ${CAP} anyway` : 'Find records'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={s.card}>
                            <div className={s.screenBar}>
                                {screened ? (
                                    <div className={s.tally}>
                                        <b className={s.tallyInc}>{included.length}</b> included &nbsp;&middot;&nbsp;{' '}
                                        <b>{excludedCount}</b> excluded
                                    </div>
                                ) : (
                                    <div className={s.tally}>{records.length} record{records.length === 1 ? '' : 's'}</div>
                                )}
                                <span className={s.spacer} />
                                {/* The records are DATA, so they leave as a spreadsheet: 50 rows with the
                                    screening decision, the reason, the design and the link, plus a second
                                    sheet carrying the query that produced them. That is what goes into
                                    Covidence, or into a filter, or to a co-author. */}
                                <button
                                    className={s.btnSecondary}
                                    onClick={() => dlRecords(result)}
                                    disabled={!records.length || inFlight}
                                >
                                    Records (.xlsx)
                                </button>
                                {/* Gated on the HUMAN's selection, and on nothing else. In particular it is
                                    NOT gated on the screening having succeeded: if the model call fails, the
                                    records are still on the page and still tickable, and a librarian who has
                                    ticked four of them by hand is entitled to synthesize them. */}
                                <button
                                    className={s.btn}
                                    onClick={synthesize}
                                    disabled={!included.length || inFlight}
                                >
                                    {stage === 'synthesizing'
                                        ? 'Writing the synthesis…'
                                        : `Synthesize ${included.length} selected`}
                                </button>
                            </div>

                            {/* The screening wait sits ABOVE the rows it is about to annotate, and the
                                rows are already on screen underneath it. 29 seconds of nothing would
                                have been 29 seconds of the librarian wondering if it had died. */}
                            {(stage === 'screening' || stage === 'synthesizing') && progressPanel}

                            <div className={s.rows}>
                                {records.map(r => {
                                    const f = flags[r.pmid]
                                    const on = !!picked[r.pmid]
                                    const design = r.design || 'Other'
                                    const strong = design === 'RCT' || design === 'Meta-analysis'
                                    return (
                                        // De-emphasis follows the HUMAN's checkbox, not the model's flag —
                                        // so re-ticking something the AI excluded restores it fully. The
                                        // AI's reason stays on the row either way: it is evidence about
                                        // the model's judgment, and hiding it once overruled would hide
                                        // exactly the thing worth arguing with.
                                        <div className={`${s.rec} ${on ? '' : s.recOff}`} key={r.pmid}>
                                            <input
                                                type="checkbox"
                                                className={s.recCheck}
                                                checked={on}
                                                disabled={inFlight}
                                                onChange={() => setPicked(p => ({ ...p, [r.pmid]: !p[r.pmid] }))}
                                                aria-label={`Include ${r.authors} — ${r.title.slice(0, 80)}`}
                                            />
                                            <div className={s.recBody}>
                                                <div className={s.cite}>
                                                    <span className={s.who}>{r.authors} ({r.year})</span>
                                                    <span className={s.jrnl}>{r.journal}</span>
                                                    <a
                                                        className={s.recPmid}
                                                        href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        PMID {r.pmid}
                                                    </a>
                                                </div>
                                                <div className={s.recTitle}>{r.title}</div>
                                                <div className={s.meta}>
                                                    <span className={`${s.tag} ${strong ? s.tagDesign : s.tagOther}`}>{design}</span>
                                                    {/* NIH percentile — CONTEXT, not a verdict. It does not sort, does not
                                                        filter, and never reaches the model. Absent on recent papers because
                                                        it needs citation history, so render NOTHING rather than "N/A": a
                                                        blank reads as "not yet scored", a zero would read as "ignored". */}
                                                    {typeof r.nihPercentile === 'number' && (
                                                        <span
                                                            className={`${s.tag} ${s.tagCite} ${s.hint}`}
                                                            tabIndex={0}
                                                            aria-describedby={`cite-${r.pmid}`}
                                                        >
                                                            <span
                                                                className={s.meter}
                                                                aria-hidden="true"
                                                                style={{ ['--pct' as any]: `${Math.max(2, Math.min(100, Math.round(r.nihPercentile)))}%` }}
                                                            />
                                                            Cited {Math.round(r.nihPercentile)}th pct
                                                            <span role="tooltip" id={`cite-${r.pmid}`} className={s.hintBox}>
                                                                <b>NIH citation percentile (iCite).</b> This paper is cited more often
                                                                than {Math.round(r.nihPercentile)}% of NIH-funded papers of the same
                                                                field and year.
                                                                <br />
                                                                It is <b>not a measure of study quality</b>, and it did nothing here: it
                                                                never sorted these records, never filtered them, and never reached the
                                                                model. Citation counts favour older papers and reviews &mdash; the exact
                                                                bias this mode removes.
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>

                                                {f && !f.include && (
                                                    <div className={`${s.why} ${s.flagline}`}>
                                                        <b>Excluded:</b> {f.reason}
                                                    </div>
                                                )}
                                                {screened && !f && (
                                                    <div className={s.help}>
                                                        The AI returned no verdict for this record &mdash; it is unticked, and
                                                        the call is yours.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}

                                {!records.length && (
                                    <div className={s.empty}>The query returned no records. Widen the question or the limits.</div>
                                )}
                            </div>

                            <p className={s.help}>
                                Records the AI excluded stay on this page, de-emphasised, with the reason shown.{' '}
                                <b>The flags are suggestions; the checkbox is yours.</b> Re-tick anything it got wrong —
                                the count above, and what gets synthesized, follow you and not the model.
                            </p>
                        </div>
                    )}

                    {expertsPanel}
                </>
            )}

            {/* ============ MODE 2, SCREEN 4 — SYNTHESIS ============ */}
            {!isSR && phase === 'synthesis' && synthesis && (
                <>
                    {/* The model is NAMED, on screen and in every export. A journal asking for an AI
                        declaration wants the tool and its version; "AI-assisted" alone is not one. */}
                    <div className={s.caveat}>
                        <span aria-hidden="true">&#9888;</span>
                        <span>
                            <b>AI-assisted synthesis over the records you selected{model ? `, drafted by ${modelLabel(model)}` : ''}.</b>{' '}
                            Verify it against the sources. Every claim links to the PMID it came from &mdash; if a claim
                            carries no PMID, treat it as unsupported.
                        </span>
                    </div>

                    {/*
                      * THE EVIDENCE FLOOR. Derived server-side from PubMed's publication types —
                      * no inference, no model, and therefore incapable of being wrong.
                      *
                      * It is here because a clinician reading a confident synthesis has no way to
                      * know the whole thing rests on case series. "There is no randomized trial in
                      * this set" is frequently the true answer to the question, and it is the one
                      * sentence on this screen that changes what someone does next.
                      */}
                    {/* THE MODEL CITED A PAPER IT WAS NEVER GIVEN.
                      *
                      * The server has always detected this — and used to console.error it and then
                      * render the fabricated PMID as a clickable PubMed link anyway, straight into a
                      * .docx. A link a reader can click has to be one a reader can check. The prose
                      * is deliberately NOT rewritten (silently deleting the sentence would be a
                      * second fabrication over the first); it is flagged, loudly, above the thing it
                      * contaminates, and the reader decides.
                      */}
                    {synthesis.invented?.length && (
                        <div className={s.invented} role="alert">
                            <span className={s.floorLabel}>Do not trust this summary as written</span>
                            <p className={s.floorText}>
                                The AI cited {synthesis.invented.length === 1 ? 'a paper' : 'papers'} that
                                {synthesis.invented.length === 1 ? ' was' : ' were'} not among the ones you
                                selected: PMID {synthesis.invented.join(', ')}. That citation came from outside
                                this evidence set, so the sentence around it is unsupported. Read the prose
                                before you use any of it, and do not export it as it stands.
                            </p>
                        </div>
                    )}

                    {synthesis.floor && (
                        <div className={s.floor}>
                            <span className={s.floorLabel}>Strength of this evidence</span>
                            <p className={s.floorText}>{synthesis.floor}</p>
                            <p className={s.floorHelp}>
                                Study designs are PubMed&rsquo;s own indexing, not the AI&rsquo;s reading of the
                                abstracts. The table below is ordered by them &mdash; guidelines and systematic
                                reviews first, then randomized trials.
                            </p>
                        </div>
                    )}

                    <div className={`${s.card} ${s.synthCard}`}>
                        <span className={s.eyebrow}>{isPico ? 'The evidence' : 'Summary table'}</span>
                        <div className={s.tblScroll}>
                            <table className={s.sum}>
                                <thead>
                                    <tr>
                                        <th>Study</th>
                                        <th>Year</th>
                                        <th>Journal</th>
                                        <th>Design</th>
                                        <th>Intervention</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {synthesis.table.map(r => (
                                        <tr key={r.pmid}>
                                            <td>{r.study}</td>
                                            <td className={s.num}>{r.year}</td>
                                            <td>{r.journal}</td>
                                            <td>{r.design}</td>
                                            <td>{r.intervention}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className={`${s.card} ${s.synthCard}`}>
                        <span className={s.eyebrow}>{isPico ? 'Answer' : 'Synthesis'}</span>
                        <Prose text={synthesis.prose} />
                    </div>

                    {expertsPanel}

                    <div className={s.provenance}>
                        {provenance && (
                            <span>
                                <b>{included.length}</b> of {records.length} records screened in by <b>{provenance.cwid}</b>{' '}
                                on {provenance.date}.
                            </span>
                        )}
                        <span className={s.spacer} />
                        <button className={s.btnSecondary} onClick={() => setPhase('candidates')}>
                            Back to candidates
                        </button>
                        <button
                            className={`${s.btnSecondary} ${copied === 'md' ? s.btnSecondaryDone : ''}`}
                            onClick={() => copy(markdown(), 'md')}
                        >
                            {copied === 'md' ? '✓ Copied' : 'Copy Markdown'}
                        </button>
                        {/* The answer is PROSE, so it leaves as Word — headings, the evidence table, the
                            caveat, and the query that produced it, all in one file someone can put in
                            front of a co-author. "Everything" adds the records spreadsheet beside it. */}
                        {result && (
                            <>
                                <button className={s.btnSecondary} onClick={() => dlSynthesis(result)}>
                                    {isPico ? 'Answer' : 'Synthesis'} (.docx)
                                </button>
                                <button className={s.btn} onClick={() => dlPacket(result)}>
                                    Download everything
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
