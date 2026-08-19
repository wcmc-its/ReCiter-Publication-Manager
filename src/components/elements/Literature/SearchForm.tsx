// THE FORM, IN THE PIECES IT IS ACTUALLY MADE OF. Each part below takes a handful of explicit
// props and owns no state — the page still holds every value and every setter, and still composes
// these in order, so the shape of the form is readable in one place and each field is reviewable
// on its own.
//
// It is deliberately NOT one <SearchForm> component. The whole form reads twenty-nine different
// values off the page; a single component for it would take twenty-nine props, which is not an
// abstraction, it is the same coupling with a longer call site.
import {
    Pico,
    PICO_FIELDS,
    RECORD_CAP as CAP,   // a property of the mode, not a setting
    NARROW_ABOVE,        // the narrowing gate; the server enforces this same number
    picoQuestion,
    picoComplete,
} from '../../../../controllers/literatureSearch.strategy'
import type { Db, LimitOption } from '../../../../controllers/literatureSearch.strategy'
import { DATABASES, MODES, SORTS } from './LiteratureSearch.constants'
import s from './LiteratureSearch.module.css'

export function ModePicker({ mode, isSR, isPico, inFlight, onPick }: {
    mode: string; isSR: boolean; isPico: boolean; inFlight: boolean; onPick: (id: string) => void
}) {
    return (
        <>
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
                                onChange={() => onPick(m.id)}
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
        </>
    )
}

export function QuestionFields({ isPico, pico, setPico, question, setQuestion }: {
    isPico: boolean
    pico: Partial<Pico>
    setPico: (fn: (p: Partial<Pico>) => Partial<Pico>) => void
    question: string
    setQuestion: (v: string) => void
}) {
    return (
        <>
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
        </>
    )
}

export function DatabasePicker({ isSR, dbs, setDbs }: {
    isSR: boolean; dbs: Db[]; setDbs: (fn: (cur: Db[]) => Db[]) => void
}) {
    return (
        <>
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
        </>
    )
}

export function SeedsField({ seeds, setSeeds, count }: {
    seeds: string; setSeeds: (v: string) => void; count: number
}) {
    return (
        <div className={s.requirement}>
            <div className={s.reqHead}>
                <label className={s.eyebrow} htmlFor="lit-seeds">Known-item seeds</label>
                <span className={`${s.seedCount} ${count ? s.seedCountArmed : ''}`}>
                    {count === 1 ? '1 seed' : `${count} seeds`}
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
                placeholder="PMIDs or DOIs, one per line — papers this search MUST retrieve"
            />
            <p className={s.help}>
                We run the strategy and report whether each one came back.{' '}
                <b>A strategy that misses a known include is broken.</b>
            </p>
        </div>
    )
}

export function CriteriaField({ isSR, criteria, setCriteria }: {
    isSR: boolean; criteria: string; setCriteria: (v: string) => void
}) {
    return (
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
    )
}

export function LimitsRow({
    isSR, dates, types, dateId, typeId, sort, busy, inFlight, canBuild, onDate, onType, onSort, onRun,
}: {
    isSR: boolean
    dates: LimitOption[]
    types: LimitOption[]
    dateId: string
    typeId: string
    sort: string
    busy: boolean
    inFlight: boolean
    canBuild: boolean
    onDate: (v: string) => void
    onType: (v: string) => void
    onSort: (v: string) => void
    onRun: () => void
}) {
    return (
        <>
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
                    <select id="lit-date" className={s.input} value={dateId} onChange={e => onDate(e.target.value)}>
                        {dates.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                </div>
                <div className={s.control}>
                    <label htmlFor="lit-type">Publication type</label>
                    <select id="lit-type" className={s.input} value={typeId} onChange={e => onType(e.target.value)}>
                        {types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                </div>
                {!isSR && (
                    <div className={s.control}>
                        <label htmlFor="lit-sort">Rank by</label>
                        <select id="lit-sort" className={s.input} value={sort} onChange={e => onSort(e.target.value)}>
                            {SORTS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                    </div>
                )}
                <span className={s.spacer} />
                <button className={s.btn} onClick={onRun} disabled={!canBuild}>
                    {isSR
                        ? (busy ? 'Building strategy…' : 'Build strategy')
                        : (inFlight ? 'Working…' : 'Find records')}
                </button>
            </div>
        </>
    )
}

export function CapNote({ isSR, isPico }: { isSR: boolean; isPico: boolean }) {
    return (
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
    )
}
