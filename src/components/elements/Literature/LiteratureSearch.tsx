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
//
// WHERE THE PIECES LIVE. This file is the page: it holds ALL the state, every fetch, and the order
// the screens appear in. Nothing below it holds state, which is the point — a panel that cannot
// hold an opinion cannot hold one that disagrees with the count. The rest is next door:
//
//   LiteratureSearch.types.ts       what a result, a failure and a seed ARE
//   LiteratureSearch.constants.ts   the modes, the databases, the sorts, the measured stage times
//   LiteratureSearch.parts.tsx      the leaves: RowCount, LineInput, Prose, the progress bar
//   LiteratureSearch.downloads.ts   which documents leave the page, and what each one must say
//   SearchForm.tsx                  the form, in the fields it is made of
//   StrategyResults.tsx             Mode 1: one panel per database, plus the known-item check
//   CandidatesView.tsx              Modes 2 and 3: the query, the narrowing gate, the 50 records
//   SynthesisView.tsx               Modes 2 and 3: the answer, and the ways it leaves

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import {
    Strategy,
    Pico,
    NARROW_ABOVE,        // the narrowing gate; the server enforces this same number
    picoComplete,
    buildLimits,
    dateLimits,
    pubTypes,
    parseSeeds,
    DIALECTS,
    // THE BOUNDS ARE THE SERVER'S, AND THE BROWSER IS WHERE THEY HAVE TO BE ENFORCED. The route
    // rejects an over-size strategy with a 502 "malformed strategy" — but by then the librarian has
    // already built it, and the strategy on screen is READ-ONLY under an error that explains
    // nothing. Imported rather than re-typed: a second copy of these numbers that drifts low refuses
    // a strategy the server would have taken, and one that drifts high is the 502 all over again.
    MAX_CONCEPTS,
    MAX_LINES,
    MAX_TERMS,
} from '../../../../controllers/literatureSearch.strategy'
import type { Db, Rendering } from '../../../../controllers/literatureSearch.strategy'
// THE CONTRACT, imported rather than re-declared. `import type` is erased at transpile, so this
// costs the client bundle nothing (the controller's AWS SDK import never reaches the browser) —
// but it means the screen cannot quietly disagree with the route about what a record is. A
// second, hand-copied copy of these four shapes is exactly how a UI ends up reading a field the
// server stopped sending.
import type { PubRecord, Screened, Synthesis, Narrowing } from '../../../../controllers/literatureSearch.controller'
import { EVIDENCE_TIERS, ROWS_RETRY_MS, SORTS } from './LiteratureSearch.constants'
import { isFailure } from './LiteratureSearch.types'
import type { Cluster, CorpusStats, DbFailure, DbResult, Expert, M4Record, M4Stage, NarrativeReview, RowState } from './LiteratureSearch.types'
import { ExpertsPanel, FailedDatabases, M4ProgressPanel, PageHead, ProgressPanel, SummaryBar } from './LiteratureSearch.parts'
import { makeDownloads } from './LiteratureSearch.downloads'
import { CapNote, CriteriaField, DatabasePicker, EvidenceTierPicker, LimitsRow, ModePicker, QuestionFields, SeedsField } from './SearchForm'
import { StrategyResults } from './StrategyResults'
import { CandidatesPanel, CorpusTablePanel, NarrowingGate, QueryCard } from './CandidatesView'
import { SynthesisView } from './SynthesisView'
import { TrendPanel } from './TrendPanel'
import { ClusterBrowser } from './ClusterBrowser'
import { NarrativeReviewView } from './NarrativeReviewView'
import s from './LiteratureSearch.module.css'

// Fully self-contained: nothing else in the page reads or writes `copied`, and `copy` needs
// only a place to report an error. Extracted verbatim — same clipboard call, same 1.8s
// auto-clear, same rejection path (writeText rejects outside a secure context).
function useClipboardCopy(onError: (msg: string) => void) {
    const [copied, setCopied] = useState('')
    const copy = (text: string, what: string) => {
        navigator.clipboard.writeText(text).then(
            () => {
                setCopied(what)
                setTimeout(() => setCopied(c => (c === what ? '' : c)), 1800)
            },
            () => onError('Could not copy to the clipboard.'),
        )
    }
    return { copied, copy }
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
    // THE FAILURES, HELD SEPARATELY FROM THE SEARCHES. They are lifted out of the response array
    // rather than left in it, so `results` and `strategies` stay dense and index-parallel — every
    // `di` in this file (rowSeq, rowState, dirty, fetchRows) is an index into those two arrays, and
    // a hole in one of them would put a count against the wrong database. It also means the exports,
    // which all iterate `results`, CANNOT print a failed database as a searched one: it is not there.
    const [failures, setFailures] = useState<DbFailure[]>([])
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

    // ---- Mode 4 ("Bibliometric review") ----
    //
    // THREE SCREENS, not Mode 2's four — form, progress (the step list), results (the four tabs).
    // `m4Stage` is what the server is doing right now, the same relationship `stage` has to `phase`
    // above, just against M4_STEPS' four names instead of STAGES' three.
    const [m4Phase, setM4Phase] = useState<'form' | 'progress' | 'results'>('form')
    const [m4Stage, setM4Stage] = useState<M4Stage>('idle')
    const [m4Tab, setM4Tab] = useState<'overview' | 'clusters' | 'narrative' | 'corpus'>('overview')
    // Metadata-only until the final phase lands — see search.ts's file-level comment above
    // handleM4Retrieve for why abstract text never enters this state at all. Replaced wholesale by
    // the decorated version (clusterLabel/impactScore/relevanceScore) once handleM4Synthesize
    // returns; nothing merges the two by hand.
    const [m4Corpus, setM4Corpus] = useState<M4Record[]>([])
    const [m4Clusters, setM4Clusters] = useState<Cluster[]>([])
    const [m4Stats, setM4Stats] = useState<CorpusStats | null>(null)
    const [m4Narrative, setM4Narrative] = useState<NarrativeReview | null>(null)
    const [m4Query, setM4Query] = useState('')
    const [m4FromYear, setM4FromYear] = useState(0)
    const [m4ToYear, setM4ToYear] = useState(0)
    const [m4Seeds, setM4Seeds] = useState<{ total: number; retrieved: number } | null>(null)
    const [m4HotYears, setM4HotYears] = useState<Array<{ year: number; hits: number; error: string }>>([])
    const [m4Narrowing, setM4Narrowing] = useState<string[]>([])
    // Keyed by EVIDENCE_TIERS' own `id` — the checklist's concern, not the server's. An id absent
    // from this map reads as its own `defaultOn`, so a fresh Mode 4 form needs no pre-population.
    const [m4EvidenceChecked, setM4EvidenceChecked] = useState<Record<string, boolean>>({})

    const [experts, setExperts] = useState<{ experts: Expert[]; total: number } | null>(null)
    // ponytail: inline error state, not a toast. This page's failure paths (403 not-on-the-
    // allowlist, 503 unconfigured, 502 model error) were all routed through toast.error, but
    // no ToastContainer is ever mounted here and the AppLayout fallback is gated on a config
    // key that does not exist -- so every failure rendered as NOTHING and the button just
    // looked dead. An inline div depends on no config and cannot be silently disabled.
    const [err, setErr] = useState('')
    const { copied, copy } = useClipboardCopy(setErr)

    const dates = useMemo(dateLimits, [])
    const types = useMemo(pubTypes, [])

    const isSR = mode === 'search-strategy'
    const isPico = mode === 'clinical-question'
    const isM4 = mode === 'bibliometric-review'
    const seedList = parseSeeds(seeds)
    const inFlight = busy || stage !== 'idle' || m4Stage !== 'idle'
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
            // A DATABASE THAT DIED IS NOT A DATABASE THAT FOUND NOTHING, and it must not travel with
            // the ones that worked. Split it out here, at the boundary, so nothing downstream — no
            // panel, no export, no count — ever has to remember to check.
            const all: Array<DbResult | DbFailure> = data.databases || []
            const rs = all.filter(x => !isFailure(x)) as DbResult[]
            setFailures(all.filter(isFailure))
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
    // The up-front reset, pulled out of runIssueReview so the fetch/validate/branch logic below
    // isn't sharing a function body with six unrelated setState calls.
    const resetCandidateState = () => {
        setErr('')
        setRecords([])
        setFlags({})
        setPicked({})
        setSynthesis(null)
        setProvenance(null)
    }

    // THE GATE. Nothing was retrieved — not because we could not (the retrieval tool takes a
    // retmax now and would happily hand back the top 50 of 184,043), but because 50 out of this
    // many is a thin slice and the librarian is entitled to know that before they read it as if
    // it were the literature. Pulled out of runIssueReview as its own named business rule.
    const enterNarrowingGate = (r: DbResult) => {
        const st: Strategy = { db: 'pubmed', concepts: r.concepts, limits: r.limits }
        fresh.current = true          // the server just counted this one; don't re-count it
        setBaseStrategy(st)
        setStrategies([st])
        setNarrowings(r.narrowings || [])
        setBaseHits(r.hits)
        setTicked({})
        setGate(true)
        setStage('idle')
    }

    // A COUNT WITHOUT RECORDS IS NOT AN EMPTY SEARCH. If PubMed says 275 papers match and then
    // hands back none of them, the retrieval was throttled — the count and the fetch are
    // different endpoints, and only one of them failed. Both `countPubmed` and `fetchArticles`
    // already retry once; when even the retry comes back empty, the honest thing is to SAY the
    // retrieval failed. Rendering an empty candidate list under a 275-record count reads as "your
    // search found nothing", which is the exact quiet lie the rest of this page exists to
    // prevent. Seen for real, 2026-07-13. Pure — no state, so it's the one part of this business
    // rule that's testable without a fetch mock.
    const describeEmptyRetrieval = (hits: number): string | null => (
        hits > 0
            ? `PubMed counted ${hits.toLocaleString()} records for this query but returned none of them. `
                + `That is a rate limit, not an empty result — try again in a moment.`
            : null
    )

    const runIssueReview = async (narrowed?: Strategy) => {
        // The OTHER caller that clears `strategies` — and the one where a surviving stale re-count
        // does its damage silently, by wiping the error this function is about to set. See
        // cancelRecount().
        cancelRecount()
        resetCandidateState()
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
            // A FAILED DATABASE NOW ARRIVES AS A 200. The build loop no longer throws the run away
            // when a database dies — it hands the failure back in the results array — and Modes 2/3
            // search exactly one database, so "one failed" and "all failed" are the same event here.
            // Without this the failure object falls straight through as a DbResult and the candidates
            // screen renders `undefined` hits and an empty record list under them: a search that died
            // wearing the face of one that found nothing. There is no failure PANEL in these modes and
            // there should not be — the librarian is still standing on the form, so the error belongs
            // where they are looking.
            const r = data.databases?.[0] as DbResult | DbFailure | undefined
            if (!r || isFailure(r)) {
                // The server's own words when it has them — "Could not reach the PubMed tool" is the
                // difference between retrying for ten minutes and knowing the pod is down.
                setErr((r && isFailure(r) && r.error) || 'Could not run the search.')
                setStage('idle')
                return
            }
            // Mode 3: adopt the sentence the SERVER assembled from the PICO fields. Everything
            // downstream — the summary bar, the screen call, the synthesis call — then carries the
            // question that was really asked, not one the client reconstructed and hoped matched.
            if (data.question) setQuestion(data.question)
            setResults([r])
            setExperts(data.experts)
            setModel(data.model || '')
            setPhase('candidates')

            if (r.needsNarrowing) {
                enterNarrowingGate(r)
                return
            }

            // Retrieved. DROP THE STRATEGY: nothing in the candidates phase edits it, and leaving
            // it set would let the re-count effect land a record-less result on top of the list.
            setGate(false)
            setStrategies([])

            const recs = r.records || []
            setRecords(recs)

            if (!recs.length) {
                setStage('idle')
                const msg = describeEmptyRetrieval(r.hits)
                if (msg) setErr(msg)
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
        if (!baseStrategy) return
        const next = { ...ticked, [n.label]: !ticked[n.label] }
        // A narrowing is an EXTRA concept block, so ticking enough of them walks the strategy past
        // MAX_CONCEPTS — and the re-count it triggers is the very same call that would then 502.
        // The gate would go read-only at the exact moment the librarian was using it as intended.
        const concepts = [
            ...baseStrategy.concepts,
            ...narrowings
                .filter(x => next[x.label])
                .map(x => ({ label: x.label, lines: [{ terms: x.terms, on: true }] })),
        ]
        if (concepts.length > MAX_CONCEPTS) {
            setErr(`A strategy can hold at most ${MAX_CONCEPTS} concept blocks, and this one is full. `
                + `Untick another narrowing before adding this one.`)
            return
        }
        setTicked(next)
        dirty.current.add(0)
        setStrategies([{ ...baseStrategy, concepts }])
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

    // ---- MODE 4, FOUR SEQUENTIAL POSTS, AUTOMATED (no human gate between them — see search.ts's
    // handleM4* file-level comment for why four, not the mockup's six visual steps). Each function
    // below THREADS its own results into the next call's arguments rather than reading them back out
    // of state, same discipline `screen()`'s own comment documents for Mode 3's question: state
    // setters have not applied yet when the next call in the same tick would need them.
    const resetM4State = () => {
        setM4Phase('form')
        setM4Stage('idle')
        setM4Tab('overview')
        setM4Corpus([])
        setM4Clusters([])
        setM4Stats(null)
        setM4Narrative(null)
        setM4Query('')
        setM4FromYear(0)
        setM4ToYear(0)
        setM4Seeds(null)
        setM4HotYears([])
        setM4Narrowing([])
    }

    const runM4Synthesize = async (corpus: M4Record[], clusters: Cluster[], scores: any[], impact: any[], fromYear: number, toYear: number) => {
        setM4Stage('synthesizing')
        try {
            const res = await fetch('/api/literature/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // `seeds` must ride every M4 phase POST, not just retrieve: the server re-derives
                // the scoring shortlist from seedList each phase, and an absent seeds field makes
                // seed-forcing silently no-op (seeds only got scored when tier rank admitted them).
                body: JSON.stringify({ mode, phase: 'm4-synthesize', question, seeds, corpus, clusters, scores, impact, fromYear, toYear }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErr(data?.message || 'Could not write the narrative review.')
                setM4Phase('form')
                setM4Stage('idle')
                return
            }
            setModel(data.model || '')
            setM4Narrative(data.narrative)
            setM4Corpus(data.corpus || corpus)   // now decorated: clusterLabel/impactScore/relevanceScore
            setProvenance({ cwid: data.cwid, date: data.date })
            setM4Phase('results')
        } catch {
            setErr('Could not reach the server.')
            setM4Phase('form')
        } finally {
            setM4Stage('idle')
        }
    }

    const runM4Score = async (corpus: M4Record[], clusters: Cluster[], fromYear: number, toYear: number) => {
        setM4Stage('scoring')
        try {
            const res = await fetch('/api/literature/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, phase: 'm4-score', question, criteria, seeds, corpus, clusters }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErr(data?.message || 'Could not score the corpus.')
                setM4Phase('form')
                setM4Stage('idle')
                return
            }
            await runM4Synthesize(corpus, clusters, data.scores || [], data.impact || [], fromYear, toYear)
        } catch {
            setErr('Could not reach the server.')
            setM4Phase('form')
            setM4Stage('idle')
        }
    }

    const runM4Cluster = async (corpus: M4Record[], fromYear: number, toYear: number) => {
        setM4Stage('clustering')
        try {
            const res = await fetch('/api/literature/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, phase: 'm4-cluster', corpus }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErr(data?.message || 'Could not cluster the corpus.')
                setM4Phase('form')
                setM4Stage('idle')
                return
            }
            setM4Clusters(data.clusters || [])
            await runM4Score(corpus, data.clusters || [], fromYear, toYear)
        } catch {
            setErr('Could not reach the server.')
            setM4Phase('form')
            setM4Stage('idle')
        }
    }

    // POST 1 of 4: strategy build + full-corpus retrieval + evidence classification + Phase 4
    // stats. Dominated by PubMed retrieval time — a decade at a few hundred records/year is
    // minutes, not the ~2s a single Mode 1 count call takes.
    const runM4Retrieve = async () => {
        if (!canBuild) return
        setErr('')
        resetM4State()
        setM4Phase('progress')
        setM4Stage('retrieving')
        try {
            const evidenceTiers = EVIDENCE_TIERS
                .filter(t => t.tierLabel && (m4EvidenceChecked[t.id] ?? t.defaultOn))
                .map(t => t.tierLabel)
            const caseSeries = m4EvidenceChecked['case-series'] ?? true
            const res = await fetch('/api/literature/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, question, criteria, seeds, dateId, evidenceTiers, caseSeries }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErr(data?.message || 'Could not build the corpus.')
                setM4Phase('form')
                setM4Stage('idle')
                return
            }
            setModel(data.model || '')
            setM4Query(data.query || '')
            setM4FromYear(data.fromYear || 0)
            setM4ToYear(data.toYear || 0)
            setM4Corpus(data.corpus || [])
            setM4Stats(data.corpusStats || null)
            setM4Seeds(data.seeds || null)
            setM4HotYears(data.hotYears || [])
            setM4Narrowing(data.narrowing || [])
            await runM4Cluster(data.corpus || [], data.fromYear, data.toYear)
        } catch {
            setErr('Could not reach the server.')
            setM4Phase('form')
            setM4Stage('idle')
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

    // The network part of a recount, pulled out of the effect below so the effect body reads as
    // debounce -> fetch -> apply, instead of the fetch itself being one paragraph buried in the
    // middle of debounce/merge/expert-panel/fetchRows-trigger logic. Same request shape, same
    // per-line comment about why Mode 2 sends no seeds.
    const recountStrategies = async (
        targets: number[], sts: Strategy[], dateId: string, typeId: string,
    ): Promise<PromiseSettledResult<{ di: number; r: DbResult; experts?: { experts: Expert[]; total: number } }>[]> =>
        Promise.allSettled(targets.map(async di => {
            const res = await fetch('/api/literature/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // No seeds in Mode 2: known-item validation is a recall check, and it is
                // meaningless against a search that is being deliberately narrowed. Sending
                // them would also spend one count call per seed on every tick, for nothing.
                body: JSON.stringify({ strategy: sts[di], seeds: isSR ? seeds : '', dateId, typeId }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.message || 'Could not re-count the strategy.')
            return { di, r: data.databases[0] as DbResult, experts: data.experts }
        }))

    useEffect(() => {
        if (!isSR && !gate) return
        if (!strategies.length) return
        if (fresh.current) { fresh.current = false; dirty.current.clear(); return }

        const targets = dirty.current.size ? Array.from(dirty.current) : strategies.map((_, i) => i)

        const t = setTimeout(async () => {
            // Cleared HERE, not above: the effect re-runs (and this cleanup fires) on every
            // keystroke, and clearing before the debounce settles would lose the record of which
            // database was edited — and fall back to re-counting all of them.
            dirty.current.clear()
            // THE BUMP BELONGS TO THE REQUEST, NOT TO THE EFFECT RUN.
            //
            // It used to sit in the effect body, 300ms before the request it names was issued — so
            // every keystroke bumped it, and the cleanup then cancelled the timeout that would have
            // issued that request. A bump with no request behind it has no `finally` to match it, and
            // the LAST such bump wins: `mine === seq.current` was then never true again, `recounting`
            // stayed true for the rest of the session, and every export button on the page stayed
            // disabled until a reload. A bump that exists only for a request actually issued always
            // has a matching `finally`.
            //
            // The stale-response drop is unchanged, and this is why: requests are numbered in the
            // order they are ISSUED, which is the order their timeouts fire. So a slow request issued
            // first still holds a lower `mine` than the fast one issued after it, and when it finally
            // lands `mine !== seq.current` and it is dropped — exactly as before. All that changed is
            // that a request nobody made no longer takes a number.
            const mine = ++seq.current
            setRecounting(true)
            try {
                const settled = await recountStrategies(targets, strategies, dateId, typeId)
                // A slower earlier request must never overwrite a newer count. Silently dropping
                // a stale response is the only correct thing here: the number on screen has to
                // belong to the strategy on screen.
                if (mine !== seq.current) return

                const fetched = settled
                    .filter((x): x is PromiseFulfilledResult<{ di: number; r: DbResult; experts?: { experts: Expert[]; total: number } }> => x.status === 'fulfilled')
                    .map(x => x.value)
                // allSettled, not all: one database's transient failure must never discard another
                // database's already-successful recount (Promise.all's fail-fast semantics used to
                // do exactly that — a Scopus 5xx would silently strand a PubMed count that had
                // already come back correct). The failed target goes back into `dirty` so the next
                // debounce cycle retries just that one, rather than leaving it stuck on a stale
                // pre-edit count with nothing on screen to say so.
                const failedTargets = targets.filter((_, i) => settled[i].status === 'rejected')
                const firstFailure = settled.find((x): x is PromiseRejectedResult => x.status === 'rejected')

                setErr(firstFailure ? (firstFailure.reason?.message || 'Could not re-count the strategy.') : '')
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
                //
                // MODE 1 ONLY. This effect deliberately also serves Modes 2 and 3 (a ticked narrowing
                // re-counts through it), and those modes NEVER render the Results column — there is no
                // RowCount anywhere outside the `isSR` panel. So an unguarded call here spent a full
                // per-line sweep — 7 count calls, a measured 5.5s — on a map no JSX ever reads, on
                // every tick of the narrowing gate. NCBI's quota is per-KEY and we share ours with the
                // ReCiter engine, so that waste came out of the nightly ETL's budget, not ours. The
                // guard suppresses the CALLS: spending them and discarding the answer is the bug.
                if (isSR) fetched.forEach(({ di }) => fetchRows(strategies[di], di))
                failedTargets.forEach(di => dirty.current.add(di))
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
        // Bump the per-database generation counter for anything being invalidated here, so an
        // in-flight fetchRows() call that resolves AFTER this edit finds itself stale
        // (mine !== rowSeq.current[di]) and drops its answer instead of writing pre-edit counts
        // over a row that has since moved on. Mirrors what cancelRecount() already does for a
        // full reset — this is the same guarantee, scoped to one database instead of all of them.
        strategies.forEach((st, i) => {
            if (di === undefined || i === di) rowSeq.current[i] = (rowSeq.current[i] || 0) + 1
        })
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

    // THE BOUNDS, AT THE KEYSTROKE — because the alternative is a 502 on someone else's click.
    //
    // The route refuses an over-size strategy with "malformed strategy", and it refuses it on the
    // NEXT re-count: the librarian types a long line, then ticks an unrelated checkbox, and THAT is
    // what appears to break. The strategy is then read-only under an error that explains none of it,
    // and every export is disabled behind `recounting`. Neither ceiling is theoretical — a Cochrane
    // drug hedge runs to ~1,500 characters of OR-ed synonyms, so one paste of a longer one clears
    // MAX_TERMS, and "+ line to" is a button that can be clicked twenty-six times.
    //
    // A REFUSAL, NEVER A TRUNCATION. Clipping a 2,400-character paste to 2,000 would hand back a
    // strategy that runs, counts, and is quietly missing 400 characters of synonyms — a search
    // narrowed by us, silently, which is worse than the 502 and worse than doing nothing.
    const edit = (di: number, ci: number, li: number, terms: string) => {
        if (terms.length > MAX_TERMS) {
            setErr(`That line is ${terms.length.toLocaleString()} characters, and the longest line we can re-count `
                + `is ${MAX_TERMS.toLocaleString()}. It has been left as it was — nothing was cut. Split the terms `
                + `across two lines in the same block: lines within a block are OR-ed, so the search is identical.`)
            return
        }
        editConcept(di, ci, c => ({ ...c, lines: c.lines.map((l, j) => (j === li ? { ...l, terms } : l)) }))
    }

    const addLine = (di: number, ci: number) => {
        if ((strategies[di]?.concepts[ci]?.lines.length || 0) >= MAX_LINES) {
            setErr(`A concept block holds at most ${MAX_LINES} lines and this one is full. Untick a line you are `
                + `not using, or add the terms to an existing line — lines within a block are OR-ed, so it makes `
                + `no difference to the search.`)
            return
        }
        editConcept(di, ci, c => ({ ...c, lines: [...c.lines, { terms: '', on: true }] }))
    }

    // CANCEL WHAT IS IN FLIGHT BEFORE CLEARING WHAT IT WOULD LAND ON.
    //
    // Every caller that empties `strategies` must come through here first, and there are two of them:
    // newSearch() and runIssueReview(). Emptying `strategies` trips the re-count effect's
    // `if (!strategies.length) return` — so the effect never reaches the code that would have
    // invalidated an outstanding response, and that response then passes its own
    // `mine === seq.current` guard and lands on a search nobody is looking at any more. In
    // newSearch() it wrote its count back into the array we had just cleared, bringing a dead
    // strategy's form back on screen. In runIssueReview() it is worse and quieter: the stale response
    // reaches the unconditional `setErr('')` and ERASES A RETRIEVAL ERROR the librarian needed to
    // see — "PubMed counted 275 records and returned none of them" blinks out, and the empty
    // candidate list beneath it reads as an honest zero.
    //
    // Each `rowSeq` key is BUMPED, never reset. A fresh `{}` looks equivalent and is not: the next
    // search's first fetchRows would compute `mine = (undefined || 0) + 1 = 1` and collide with a
    // still-in-flight `mine = 1` from this one, which lands, matches, and hangs a dead search's
    // per-line counts beside the new search's lines. Monotonic is the whole guarantee.
    const cancelRecount = () => {
        seq.current++
        Object.keys(rowSeq.current).forEach(k => { rowSeq.current[Number(k)]++ })
        dirty.current.clear()
        // Nothing is in flight any more, so nothing is coming to turn these off — and `recounting`
        // left true disables every export for the rest of the session.
        setRecounting(false)
        setRowState({})
    }

    // Back to the form with the question, the criteria and the limits still in it. That IS the
    // edit-and-re-run path in Mode 2: there is nothing else to edit, because the query was
    // derived from these fields.
    const newSearch = () => {
        cancelRecount()
        setStrategies([])
        setResults([])
        setFailures([])
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
        resetM4State()
    }

    const pickMode = (id: string) => {
        if (id === mode) return
        setMode(id)
        // MODE 4's WHOLE PREMISE IS "THE LAST 10 YEARS" — the same dropdown Modes 1-3 default to
        // "Any date", nudged just this once on entry, exactly the plan's own SearchForm bullet.
        // One-directional on purpose: leaving Mode 4 does not reset it back, matching how dateId
        // already survives every OTHER mode switch on this page.
        if (id === 'bibliometric-review') setDateId('10y')
        newSearch()
    }

    // THE TALLY FOLLOWS THE HUMAN, NEVER THE FLAGS.
    const included = records.filter(r => picked[r.pmid])
    const excludedCount = records.length - included.length
    const screened = Object.keys(flags).length > 0
    // ...AND IT SAYS HOW MANY OF THE INCLUDED ONES NOBODY READ. A fail-open record is pre-ticked, so
    // it lands inside `included` and makes the headline number say "31 included" when the AI only
    // ever looked at 24 of them. The tick stays (dropping it silently would be the worse bug), but
    // the number beside it stops being able to hide behind it.
    //
    // IT COUNTS `included`, NOT `records`, AND THAT IS THE WHOLE POINT OF IT. Counted over all the
    // records it is a number about the SEARCH; the two beside it are numbers about the PILE. So a
    // librarian who read the warning strips and unticked all seven unscreened records still saw
    // "24 included · 26 excluded · 7 never screened" — three numbers that no longer add up, telling
    // them seven unread papers were still in the stack they were about to synthesize when in fact
    // none were. The tally answers one question, and every number in it has to answer that same
    // question: what is in the pile RIGHT NOW.
    const unscreened = included.filter(r => flags[r.pmid]?.screened === false).length
    const sortLabel = (SORTS.find(x => x.id === (result?.sort || sort)) || SORTS[0]).label.toLowerCase()

    // The gate's tone and its primary button key off ONE number, and it is the counted one: the
    // re-count above keeps result.hits in step with whatever is ticked. Once it falls to
    // NARROW_ABOVE the warning drops away and the button becomes an ordinary "Find records" —
    // nothing to warn about, so nothing warns.
    const over = !!result && result.hits > NARROW_ABOVE

    // The documents this run can leave as, built in LiteratureSearch.downloads.ts. Rebuilt on every
    // render from the values above, exactly as the closures were when they lived here: a builder
    // that could read a stale `included` would export a different set from the one on screen.
    const {
        dlStrategy, dlQuery, dlRecords, dlSynthesis, markdown, prismaBlock, dlPacket,
        dlCorpus, dlBibliometricDoc, m4Markdown,
    } = makeDownloads({
        results, records, flags, picked, synthesis, included,
        question, model, isPico, sortLabel, provenance, session, setErr,
        m4Corpus, m4Clusters, m4Narrative, m4Stats, m4Query, m4FromYear, m4ToYear, m4Narrowing,
    })

    // The wait. ProgressPanel draws nothing while the stage is idle, so the two guards below are
    // about WHERE it appears — above the form, or above the rows it is annotating — and not about
    // whether there is anything to say.
    const progressPanel = (
        <ProgressPanel stage={stage} elapsed={elapsed} records={records.length} included={included.length} />
    )

    // AT WEILL CORNELL — works with no records at all, straight off the query's MeSH. Shown on
    // the strategy, the candidates and the synthesis: the "who here already knows this" question
    // is the one thing this page can answer that PubMed cannot.
    const expertsPanel = experts && experts.experts.length > 0 && (
        <ExpertsPanel experts={experts} />
    )

    const showForm = isM4 ? m4Phase === 'form' : isSR ? !result : phase === 'form'
    const crumb = isM4
        ? (m4Phase === 'progress' ? 'Building the review' : m4Tab === 'overview' ? 'Overview' : m4Tab === 'clusters' ? 'Clusters' : m4Tab === 'narrative' ? 'Narrative review' : 'Corpus table')
        : phase === 'synthesis' ? 'Synthesis' : isSR ? 'Search strategy' : 'Candidates'

    return (
        <div className={s.page}>
            <PageHead showForm={showForm} isSR={isSR} isM4={isM4} crumb={crumb} />

            {/* THE FORM. Collapses to a one-line summary bar once there is a deliverable — on a
                laptop it otherwise sits below the fold, under a form nobody is reading any more.
                "New search" brings it back, with the question still in it. */}
            {showForm ? (
                <div className={s.card}>
                    <ModePicker mode={mode} isSR={isSR} isPico={isPico} isM4={isM4} inFlight={inFlight} onPick={pickMode} />

                    <QuestionFields isPico={isPico} pico={pico} setPico={setPico}
                        question={question} setQuestion={setQuestion} />

                    <DatabasePicker isSR={isSR} dbs={dbs} setDbs={setDbs} />

                    {/* THE RECALL CONTRACT. Search-strategy and bibliometric-review modes only: a
                        known-item check is how you prove a strategy did not silently miss half the
                        literature, and it is meaningless against a top-50 slice, which is not
                        trying to be exhaustive. The seed count is live and turns green once armed —
                        a strategy with no seeds cannot be validated, and the pill is the cheapest
                        possible way to say so before the librarian has spent a model call. */}
                    {(isSR || isM4) && <SeedsField seeds={seeds} setSeeds={setSeeds} count={seedList.length} />}

                    <CriteriaField isSR={isSR} criteria={criteria} setCriteria={setCriteria} />

                    {/* MODE 4 ONLY — replaces LimitsRow's Publication type dropdown (see
                        EvidenceTierPicker's own comment for why this mode needs a checklist, not
                        one dropdown value, to express "RCT/meta-analysis/... in, case reports
                        out"). */}
                    {isM4 && <EvidenceTierPicker checked={m4EvidenceChecked} setChecked={setM4EvidenceChecked} />}

                    <LimitsRow
                        isSR={isSR} isM4={isM4} dates={dates} types={types} dateId={dateId} typeId={typeId} sort={sort}
                        busy={busy} inFlight={inFlight} canBuild={canBuild}
                        onDate={v => changeLimits(() => setDateId(v))}
                        onType={v => changeLimits(() => setTypeId(v))}
                        onSort={setSort}
                        onRun={isSR ? build : isM4 ? runM4Retrieve : findRecords}
                    />

                    <CapNote isSR={isSR} isM4={isM4} isPico={isPico} />
                </div>
            ) : (
                <SummaryBar isSR={isSR} isM4={isM4} question={question} result={result}
                    corpusSize={isM4 ? m4Corpus.length : undefined}
                    recounting={recounting} inFlight={inFlight} onNewSearch={newSearch} />
            )}

            {/* The wait, before there is anything else to look at. Not gated on `showForm` any
                more: retrieving from the narrowing gate happens with the form already collapsed,
                and that fetch deserves the same progress line as the one from the form. */}
            {!isM4 && stage === 'fetching' && progressPanel}
            {isM4 && m4Phase === 'progress' && <M4ProgressPanel stage={m4Stage} />}

            {err && <div role="alert" className={s.error}>{err}</div>}

            <FailedDatabases failures={failures} />

            {/* ============ MODE 1 — THE STRATEGY ============ */}
            {!isM4 && isSR && results.length > 0 && (
                <StrategyResults
                    results={results} liveStrategies={liveStrategies} recounting={recounting}
                    rowState={rowState} model={model} copied={copied} expertsPanel={expertsPanel}
                    onToggle={toggle} onEdit={edit} onAddLine={addLine} onCopy={copy}
                    onRetryRows={di => fetchRows(liveStrategies[di], di)}
                    onDlQuery={dlQuery} onDlStrategy={dlStrategy} onDlPacket={dlPacket}
                    prismaBlock={prismaBlock}
                />
            )}

            {/* ============ MODE 2, SCREEN 3 — CANDIDATES + SCREENING ============ */}
            {!isM4 && !isSR && phase === 'candidates' && result && (
                <>
                    <QueryCard
                        result={result} gate={gate} retrieved={records.length} sortLabel={sortLabel}
                        recounting={recounting} inFlight={inFlight} copiedQuery={copied === 'query'}
                        onCopyQuery={() => copy(result.query, 'query')} onNewSearch={newSearch}
                    />

                    {gate ? (
                        <NarrowingGate
                            result={result} over={over} isPico={isPico} narrowings={narrowings}
                            ticked={ticked} baseHits={baseHits} recounting={recounting}
                            inFlight={inFlight} stage={stage}
                            onToggle={toggleNarrowing} onRetrieve={retrieveNow}
                        />
                    ) : (
                        <CandidatesPanel
                            records={records} flags={flags} picked={picked} setPicked={setPicked}
                            screened={screened} included={included} excludedCount={excludedCount}
                            unscreened={unscreened} stage={stage} inFlight={inFlight}
                            progressPanel={progressPanel}
                            onDlRecords={() => dlRecords(result)} onSynthesize={synthesize}
                        />
                    )}

                    {expertsPanel}
                </>
            )}

            {/* ============ MODE 2, SCREEN 4 — SYNTHESIS ============ */}
            {!isM4 && !isSR && phase === 'synthesis' && synthesis && (
                <SynthesisView
                    synthesis={synthesis} result={result} model={model} isPico={isPico}
                    included={included.length} total={records.length} provenance={provenance}
                    copiedMarkdown={copied === 'md'} expertsPanel={expertsPanel}
                    onBack={() => setPhase('candidates')}
                    onCopyMarkdown={r => copy(markdown(r), 'md')}
                    onDlSynthesis={dlSynthesis} onDlPacket={dlPacket}
                />
            )}

            {/* ============ MODE 4 — RESULTS: four tabs on one run ============ */}
            {isM4 && m4Phase === 'results' && m4Stats && (
                <>
                    <div className={s.m4Tabs} role="tablist" aria-label="Bibliometric review sections">
                        {(['overview', 'clusters', 'narrative', 'corpus'] as const).map(t => (
                            <button
                                key={t}
                                role="tab"
                                aria-selected={m4Tab === t}
                                className={`${s.m4Tab} ${m4Tab === t ? s.m4TabActive : ''}`}
                                onClick={() => setM4Tab(t)}
                            >
                                {t === 'overview' ? 'Overview' : t === 'clusters' ? 'Clusters' : t === 'narrative' ? 'Narrative review' : 'Corpus table'}
                            </button>
                        ))}
                    </div>

                    {m4HotYears.length > 0 && (
                        <div className={s.caveat}>
                            <span aria-hidden="true">&#9888;</span>
                            <span>
                                <b>{m4HotYears.length} year{m4HotYears.length === 1 ? '' : 's'} could not be pulled whole.</b>{' '}
                                {m4HotYears.map(y => `${y.year} (${y.hits.toLocaleString()} hits)`).join(', ')} exceeded the
                                per-year retrieval cap and {m4HotYears.length === 1 ? 'is' : 'are'} excluded from this
                                corpus. Narrow the question or a librarian can sub-shard that year by evidence type.
                            </span>
                        </div>
                    )}
                    {m4Seeds && m4Seeds.total > 0 && m4Seeds.retrieved < m4Seeds.total && (
                        <div className={s.caveat}>
                            <span aria-hidden="true">&#9888;</span>
                            <span>
                                <b>{m4Seeds.retrieved} of {m4Seeds.total} known-item seeds retrieved.</b> A strategy
                                that misses a known include is broken — check the missing ones by hand.
                            </span>
                        </div>
                    )}
                    {m4Narrowing.length > 0 && (
                        <div className={s.caveat}>
                            <span aria-hidden="true">&#9888;</span>
                            <span>
                                <b>Search narrowed automatically:</b> the corpus was too large to score in full, so
                                the lowest-value free-text lines were dropped one at a time, each checked against
                                your seeds before being kept.
                                <ul>
                                    {m4Narrowing.map((line, i) => <li key={i}>{line}</li>)}
                                </ul>
                            </span>
                        </div>
                    )}

                    {m4Tab === 'overview' && (
                        <>
                            <TrendPanel stats={m4Stats} />
                            <ClusterBrowser clusters={m4Clusters} corpus={m4Corpus} limit={5} onViewAll={() => setM4Tab('clusters')} />
                        </>
                    )}
                    {m4Tab === 'clusters' && <ClusterBrowser clusters={m4Clusters} corpus={m4Corpus} />}
                    {m4Tab === 'narrative' && m4Narrative && (
                        <NarrativeReviewView narrative={m4Narrative} model={model} expertsPanel={expertsPanel} />
                    )}
                    {m4Tab === 'corpus' && <CorpusTablePanel corpus={m4Corpus} />}

                    <div className={s.provenance}>
                        {provenance && (
                            <span><b>{m4Corpus.length.toLocaleString()}</b> records, run by <b>{provenance.cwid}</b> on {provenance.date}.</span>
                        )}
                        <span className={s.spacer} />
                        <button className={`${s.btnSecondary} ${copied === 'md' ? s.btnSecondaryDone : ''}`} onClick={() => copy(m4Markdown(), 'md')}>
                            {copied === 'md' ? '✓ Copied' : 'Copy Markdown'}
                        </button>
                        <button className={s.btnSecondary} onClick={dlBibliometricDoc}>Export narrative (.docx)</button>
                        <button className={s.btn} onClick={dlCorpus}>Export corpus (.xlsx)</button>
                    </div>
                </>
            )}
        </div>
    )
}
