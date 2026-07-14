// The strategy object and the pure functions over it. NO imports — deliberately.
//
// This file exists so the browser and the server share ONE definition of "what query does
// this strategy mean" and "what line number is each term on". The controller cannot be
// imported by the client (it pulls in the Bedrock SDK at module scope), and duplicating the
// numbering in the component would give us two sources of truth for the exact thing Mode 1
// promises: that the strategy you SEE is the strategy that was RUN and the strategy you
// EXPORT. That drift is the failure this whole feature exists to prevent, so the logic lives
// in one place and both sides import it.

export type Line = {
    terms: string
    on: boolean
    // Set on a model-proposed widening for a seed the strategy MISSED. It arrives UNCHECKED,
    // already verified (it really does retrieve that seed) and already priced. Ticking it is
    // the librarian's call, and the price is what makes it a judgment rather than a guess.
    suggestedFor?: string    // seed PMID
    costRecords?: number     // extra records to screen if this ONE line is ticked
}

// ---------------------------------------------------------------------------
// THE SPLIT: WHAT IS AN IDEA, AND WHAT IS ONE DATABASE'S WAY OF SAYING IT.
//
// These two things used to be welded into one object, and a second database is what pulls them
// apart:
//
//   Concept   — DB-NEUTRAL. The intellectual content of one block of the question ("Depression").
//               It is the ONLY thing that ever crosses a database boundary.
//   Rendering — DB-NATIVE. How ONE database expresses that concept. Generated FOR that database,
//               FROM the original question — never translated out of another database's rendering.
//
// SOMEONE WILL LOOK AT A SEARCH WITH TWO RENDERINGS OF THE SAME CONCEPT AND CALL IT A TRANSLATION
// LAYER. IT IS NOT. HOLD THE LINE. There is no MeSH -> Scopus map here and there must never be
// one: Cochrane and PRESS expect a bespoke, separately peer-reviewed strategy per database, and a
// mechanical transliteration is exactly the artifact a librarian rejects at PRESS review. The
// model writes native PubMed, and separately writes native Scopus. They share the LABELS, so a
// human can see that both searches are about the same three ideas — and nothing else.
//
// This also makes the databases' DIFFERENCES visible instead of hiding them, which is the honest
// outcome: Scopus has NO CONTROLLED VOCABULARY, so a PubMed concept block is
// `(exploded MeSH) OR (free-text)` while the Scopus rendering of the same concept has no
// controlled-vocab arm at all. It is faithfully the same idea and systematically less sensitive.
// No amount of engineering removes that, and a librarian will say so.

// A DIALECT IS PLATFORM + DATABASE, NOT DATABASE.
//
// 'embase' here means EMBASE VIA OVID, because that is what WCM has (OvidSP; probed live). Ovid and
// Elsevier's Embase.com are different query languages over the SAME Emtree thesaurus — Elsevier writes
// 'probiotic agent'/exp, Ovid writes `exp probiotic agent/` and rejects the other outright with
// "Invalid subheading: exp". If WCM ever moved Embase to Elsevier, the concepts and the Emtree
// headings survive untouched and only this rendering changes. That is the Concept/Rendering split
// doing exactly the job it exists for.
export type Db = 'pubmed' | 'scopus' | 'embase'

/** DB-NEUTRAL. The only thing shared across databases. */
export type Concept = { label: string }

/** DB-NATIVE. One database's expression of one concept. */
export type Rendering = Concept & {
    lines: Line[]            // atomic term lines only: the MeSH line, the free-text line, …
}

/** One database's whole strategy: its rendering of every concept, plus its own native limits. */
export type Strategy = {
    db: Db
    concepts: Rendering[]
    // Fully tagged and NATIVE TO `db` — "(2021:2026[dp])" in PubMed, "(PUBYEAR > 2020)" in Scopus.
    // Built from the UI's dropdowns via the dialect below, NEVER by the model.
    limits: string
}

/** The neutral spine of a strategy — the labels, and nothing else. */
export const conceptsOf = (s: Strategy): Concept[] => s.concepts.map(c => ({ label: c.label }))

// ---------------------------------------------------------------------------
// THE DIALECT. Everything that differs BY DATABASE lives here and nowhere else, so that adding a
// third database is a table entry rather than a hunt through the codebase for hardcoded `[tiab]`.
//
// LIMITS. The date range and publication type are chosen from fixed tables and resolved to the
// database's own syntax ON THE SERVER, by id. They were once a free-text box passed to the model as
// prose, which meant the MODEL decided what "2021-2026" meant — a quiet hole in the one thing Mode
// 1 promises. A librarian who cannot reproduce the count has nothing.
//
// `terms: null` MEANS THE DATABASE CANNOT EXPRESS THIS LIMIT, and that is not the same as "no
// limit". Scopus has no publication-type index for study design — `DOCTYPE(rct)` returns 0, because
// there is no such document type — so "RCT only" has NO Scopus equivalent. Silently dropping it
// would run an UNLIMITED Scopus search beside a limited PubMed one and print both counts side by
// side as if they answered the same question. So an inexpressible limit is DECLARED (see
// buildLimits) and shown to the librarian. The alternative — faking it with free-text `randomized`
// — is a translation layer wearing a disguise, and it would be a worse lie for looking helpful.

export type LimitOption = { id: string; label: string; terms: string | null }

// A KNOWN ITEM, AND IT IS NOT A PMID.
//
// It was, and that was a bug waiting to be baked in. A PMID only exists for a record MEDLINE
// indexed — so a PMID-keyed seed check can only ever validate the part of a Scopus search that
// PubMed already covers, which is precisely the part Scopus adds nothing to. The records Scopus
// exists FOR — conference papers, European and non-MEDLINE journal content — HAVE NO PMID AT ALL.
// Probed live: a Scopus search for conference papers returns records whose `pubmed-id` is simply
// absent. A librarian must be able to seed one of those, or they can never prove Scopus is earning
// its place in the search.
//
// So a seed is an IDENTIFIER WITH A KIND, and each dialect renders it in its own syntax. Both forms
// verified against both live APIs: PubMed `[uid]` and `[aid]`, Scopus `PMID()` and `DOI()`.
export type SeedKind = 'pmid' | 'doi'
export type Seed = { id: string; kind: SeedKind }

// Digits are a PMID; anything starting `10.` with a slash is a DOI. Anything else is not an
// identifier we can check, and is DROPPED rather than guessed at — a seed we silently mis-parse
// would report a miss against a paper the librarian never named.
export function parseSeeds(raw: string | string[]): Seed[] {
    const tokens = (Array.isArray(raw) ? raw : String(raw || '').split(/[\s,]+/))
        .map(t => String(t || '').trim().replace(/^(doi:|https?:\/\/(dx\.)?doi\.org\/)/i, ''))
        .filter(Boolean)
    const out: Seed[] = []
    for (const t of tokens) {
        if (/^\d+$/.test(t)) out.push({ id: t, kind: 'pmid' })
        else if (/^10\.\S+\/\S+$/.test(t)) out.push({ id: t, kind: 'doi' })
    }
    // Same seed twice is one seed. Two counts for the same paper is two counts for nothing.
    return out.filter((s, i) => out.findIndex(x => x.id === s.id && x.kind === s.kind) === i)
}

export type Dialect = {
    db: Db
    name: string                                     // 'PubMed'
    provenance: string                               // what the export prints under "Database"
    /**
     * CAN WE COUNT THIS DATABASE OURSELVES?
     *
     * false = we have no API for it, so this database yields NO number: no hits, no Results column, no
     * known-item seed check. It is a strategy we DRAFT and the librarian EXECUTES elsewhere. That is a
     * real, declared limitation, and it is the one thing that must never quietly become a zero — an
     * uncounted database renders an em-dash, exactly as an un-run line does.
     */
    countable: boolean
    /** This seed, in this database's identifier syntax. */
    seedQuery: (seed: Seed) => string
    dateLimits: () => LimitOption[]
    pubTypes: () => LimitOption[]
}

const year = () => new Date().getFullYear()

// Functions, not constants: the year has to be read when the search RUNS, not when the module was
// imported, or a pod that stays up over New Year silently searches the wrong window.
export const DIALECTS: Record<Db, Dialect> = {
    pubmed: {
        db: 'pubmed',
        name: 'PubMed',
        provenance: 'PubMed (via NCBI E-utilities)',
        countable: true,
        // [uid] is the correct tag — PubMed normalizes [pmid] -> [UID]. [aid] is the Article
        // Identifier field, which is where PubMed keeps the DOI. Both verified live against a
        // paper with a known PMID *and* a known DOI: each returns exactly 1.
        //
        // THE DOI IS QUOTED, AND THAT IS LOAD-BEARING. A seed ref is never counted standalone — it is
        // always concatenated (`${ref} AND (${query})`) — and a PII-style DOI carries literal
        // parentheses, which PubMed then reads as its own Boolean grouping. Probed live against the
        // Lancet COVID paper (PMID 31986264, DOI 10.1016/S0140-6736(20)30183-5), inside a query that
        // genuinely retrieves it:
        //     31986264[uid] AND (wuhan[tiab])                        -> 1   (control)
        //     10.1016/S0140-6736(20)30183-5[aid] AND (wuhan[tiab])   -> 0   (the parser choked)
        //     "10.1016/S0140-6736(20)30183-5"[aid] AND (wuhan[tiab]) -> 1   (quoted)
        // Unquoted, the seed check calls a retrieved paper a MISS, and the derived diagnosis then
        // blames every concept block and the limits — sending a librarian to fix a search that was
        // never broken. That is a confident wrong answer, which is the one thing this mode cannot do.
        seedQuery: s => (s.kind === 'doi' ? `"${s.id}"[aid]` : `${s.id}[uid]`),
        dateLimits: () => [
            { id: 'any', label: 'Any date', terms: '' },
            { id: '5y', label: `${year() - 5} – ${year()}`, terms: `${year() - 5}:${year()}[dp]` },
            { id: '10y', label: `${year() - 10} – ${year()}`, terms: `${year() - 10}:${year()}[dp]` },
        ],
        pubTypes: () => [
            { id: 'any', label: 'Any type', terms: '' },
            { id: 'rct-ma', label: 'RCT + Meta-analysis', terms: 'Randomized Controlled Trial[pt] OR Meta-Analysis[pt]' },
            { id: 'rct', label: 'RCT only', terms: 'Randomized Controlled Trial[pt]' },
            { id: 'review', label: 'Review', terms: 'Review[pt] OR Systematic Review[pt]' },
        ],
    },
    scopus: {
        db: 'scopus',
        name: 'Scopus',
        provenance: 'Scopus (via the Elsevier Scopus Search API)',
        countable: true,
        // Scopus DOES index the PMIDs of the records it shares with MEDLINE, so a PubMed-shaped
        // seed still works here (probed: PMID(37314797) -> 1, PMID(99999999999) -> 0). But a
        // Scopus-ONLY record has no PMID, and those are the records Scopus is here for — so DOI is
        // the identifier that reaches all of them, and it is the one to prefer for a Scopus seed.
        // Quoted for the same reason as PubMed's: the ref is concatenated into a larger Boolean, and
        // the parens in a PII-style DOI are otherwise Scopus's own grouping operator, closing DOI()
        // early. Scopus accepts a quoted phrase in a field function, so the quoting costs nothing.
        seedQuery: s => (s.kind === 'doi' ? `DOI("${s.id}")` : `PMID(${s.id})`),
        // `PUBYEAR > 2020` is 2021 onwards — the same window as PubMed's `2021:2026[dp]`.
        dateLimits: () => [
            { id: 'any', label: 'Any date', terms: '' },
            { id: '5y', label: `${year() - 5} – ${year()}`, terms: `PUBYEAR > ${year() - 6}` },
            { id: '10y', label: `${year() - 10} – ${year()}`, terms: `PUBYEAR > ${year() - 11}` },
        ],
        pubTypes: () => [
            { id: 'any', label: 'Any type', terms: '' },
            // THE HONEST NULLS. Scopus indexes a DOCUMENT type (article, review, conference paper),
            // not a STUDY DESIGN. There is no RCT document type — probed live, DOCTYPE(rct) is 0 —
            // so these two limits cannot be expressed here at all, and pretending otherwise is the
            // whole trap this table exists to avoid.
            { id: 'rct-ma', label: 'RCT + Meta-analysis', terms: null },
            { id: 'rct', label: 'RCT only', terms: null },
            { id: 'review', label: 'Review', terms: 'DOCTYPE(re)' },
        ],
    },

    // EMBASE, VIA OVID. The database Cochrane requires and the one whose absence a peer reviewer
    // notices. We have NO API for it on any platform — so this dialect DRAFTS a strategy and the
    // librarian RUNS it. It is `countable: false`, and everything follows from that.
    //
    // The syntax below is OVID's, and it was verified in Ovid against live Embase (1974–2026):
    //
    //     exp probiotic agent/ or intestine flora/          ->  209,420
    //     exp depression/                                   ->  833,391
    //     3 and 6  (the whole strategy)                     ->    8,811   (PubMed: ~5,996)
    //     zzzprobioticzzz/                                  ->        0   <- THE CONTROL
    //
    // That last line is why the rest can be trusted: a heading that does not exist returns ZERO rather
    // than silently degrading into a keyword search. So a wrong heading costs SENSITIVITY (its line
    // contributes nothing, and the free-text line beside it still carries the concept) and never
    // produces a wrong number. Ovid also auto-maps an entry term to its preferred heading — probed:
    // `probiotics/` -> 77,017, essentially the same set as `exp probiotic agent/` (77,052) — so a
    // near-miss synonym self-corrects.
    //
    // THE HAZARD THAT REMAINS, and it is why the Emtree line and the free-text line are separate,
    // independently-toggleable rows: a dead heading is INVISIBLE to us, because we cannot count it.
    // The export therefore tells the librarian to run each Emtree line on its own in Ovid — a line
    // that returns 0 is a dead heading. That is the most this can honestly promise without an API.
    embase: {
        db: 'embase',
        name: 'Embase (Ovid)',
        provenance: 'Embase 1974 to present (via Ovid, OvidSP)',
        countable: false,
        // Never called: a seed check needs a count, and there is nothing here to count with. It
        // THROWS rather than returning a plausible-looking guess, because the one thing worse than no
        // seed check is a seed check written in invented syntax. (Ovid does index PMIDs and DOIs; if
        // we ever get an API, verify the field codes against Ovid before writing them here.)
        seedQuery: () => {
            throw new Error('Embase (Ovid) cannot be counted from here, so a seed cannot be checked against it.')
        },
        // THE HONEST NULLS, and there are more of them here than anywhere else. Ovid DOES apply date
        // and publication-type limits — but through its own Limits panel, as a `limit` command against
        // a numbered set, NOT as terms inside the Boolean. Fabricating an in-query date filter would
        // be inventing syntax to make a dropdown feel answered. So every limit is DECLARED as applied
        // in Ovid, and the export says exactly that.
        dateLimits: () => [
            { id: 'any', label: 'Any date', terms: '' },
            { id: '5y', label: `${year() - 5} – ${year()}`, terms: null },
            { id: '10y', label: `${year() - 10} – ${year()}`, terms: null },
        ],
        pubTypes: () => [
            { id: 'any', label: 'Any type', terms: '' },
            { id: 'rct-ma', label: 'RCT + Meta-analysis', terms: null },
            { id: 'rct', label: 'RCT only', terms: null },
            { id: 'review', label: 'Review', terms: null },
        ],
    },
}

/**
 * The limits for one database, PLUS the limits that database cannot express.
 *
 * `unsupported` is the load-bearing half. A caller who ignores it and prints only `terms` has
 * quietly run a broader search than the librarian asked for.
 */
export function buildLimits(db: Db, dateId: string, typeId: string): { terms: string; unsupported: string[] } {
    const d = DIALECTS[db]
    const chosen = [
        d.dateLimits().find(x => x.id === dateId),
        d.pubTypes().find(x => x.id === typeId),
    ]
    const terms = chosen
        .map(x => x?.terms)                  // an unknown id resolves to no limit, never to a guess
        .filter((t): t is string => !!t)
        .map(t => `(${t})`)
        .join(' AND ')
    const unsupported = chosen
        .filter(x => x && x.terms === null)  // null means "this database cannot say this"
        .map(x => x!.label)
    return { terms, unsupported }
}

// Kept for the UI, which renders ONE pair of dropdowns for the whole search. The ids are shared
// across databases on purpose — the librarian picks an INTENT ("RCTs only"), and each dialect then
// says how it expresses that intent, or that it cannot.
export const dateLimits = () => DIALECTS.pubmed.dateLimits()
export const pubTypes = () => DIALECTS.pubmed.pubTypes()

const live = (c: Rendering) => c.lines.filter(l => l.on && l.terms.trim()).map(l => l.terms.trim())

// The Boolean the librarian copies out, and the only thing we ever count.
//
// A concept with nothing ticked DROPS OUT OF THE AND ENTIRELY. It must never emit `3 AND ()`,
// which PubMed would either reject or — far worse — silently reinterpret. This is the one piece
// of real logic in this file and it is what literatureSearch.check.js defends.
//
// DB-NEUTRAL, and it stays that way: OR within a block, AND between blocks, limits appended. That
// Boolean grammar is the same in PubMed and in Scopus — it is the TERMS inside the lines and the
// LIMITS on the end that are native, and both of those arrive already rendered. So this function
// needs no dialect, and if it ever grows a `switch (s.db)` something has gone wrong upstream.
export function assembleQuery(s: Strategy): string {
    const blocks = s.concepts.map(live).filter(t => t.length > 0).map(t => `(${t.join(' OR ')})`)
    if (!blocks.length) return ''
    const body = blocks.join(' AND ')
    return s.limits ? `${body} AND ${s.limits}` : body
}

// The query for one concept on its own — used to derive WHICH block excluded a missed seed.
export function conceptQuery(c: Rendering): string {
    return live(c).join(' OR ')
}

// EVERY ROW CARRIES THE QUERY IT DENOTES.
//
// `text` is what the row SAYS ("3 AND 6"). `query` is what that row WOULD ACTUALLY SEARCH. They are
// not interchangeable, and the distinction is what makes a per-row record count safe: the count is
// run against a query DERIVED FROM THE STRUCTURE, never parsed back out of the label. Reading "3 AND
// 6" and reconstructing a query from it would mean re-deriving, in a second place, the thing this
// function exists to derive once — and the second copy is the one that goes wrong.
export type Row =
    | { kind: 'term'; n: number | null; ci: number; li: number; line: Line; query: string }
    | { kind: 'combine'; n: number; text: string; query: string }

// PRESS line numbering — the form a search strategy is peer-reviewed and published in. Derived,
// never stored: the numbers ARE the current selection, so they cannot describe a query we did
// not run.
//
// ponytail: only ticked lines get a number, so an unticked line shows a blank gutter and the
// numbers renumber as you toggle. The alternative (stable numbers, `5b` suffixes for insertions)
// is more code and buys a number that may refer to a line that was never searched — the exact
// lie this mode exists to prevent. Revisit only if a librarian says renumbering loses their place.
export function numberStrategy(s: Strategy): { rows: Row[]; conceptLines: number[][] } {
    const rows: Row[] = []
    const conceptLines: number[][] = []   // conceptLines[ci] = the numbers this concept occupies
    const refs: number[] = []             // the line each LIVE concept resolves to, for the AND
    const blocks: string[] = []           // each live concept's query, for the AND row
    let n = 0

    s.concepts.forEach((c, ci) => {
        const mine: number[] = []
        c.lines.forEach((line, li) => {
            const num = line.on && line.terms.trim() ? ++n : null
            if (num) mine.push(num)
            rows.push({ kind: 'term', n: num, ci, li, line, query: line.terms.trim() })
        })
        conceptLines.push(mine)

        if (mine.length === 0) return                        // drops out of the AND
        const block = conceptQuery(c)
        blocks.push(`(${block})`)
        if (mine.length === 1) { refs.push(mine[0]); return } // `4 OR` of one thing is noise
        rows.push({ kind: 'combine', n: ++n, text: mine.join(' OR '), query: block })
        refs.push(n)
    })

    if (refs.length === 0) return { rows, conceptLines }

    let base = refs[0]
    if (refs.length > 1) {
        rows.push({ kind: 'combine', n: ++n, text: refs.join(' AND '), query: blocks.join(' AND ') })
        base = n
    }
    // The last row IS the whole search — the same string assembleQuery() produces, so the count
    // beside it is the yield printed at the top of the panel. They cannot disagree.
    if (s.limits) rows.push({ kind: 'combine', n: ++n, text: `${base} AND ${s.limits}`, query: assembleQuery(s) })

    return { rows, conceptLines }
}

// THE TWO NUMBERS BOTH SIDES HAVE TO AGREE ON, and they live here for the same reason the line
// numbering does: the browser needs their VALUES, and a *value* import from the controller would
// drag the Bedrock SDK into the client bundle. This file is pure, so the client can import the
// same constant the server enforces instead of keeping a hand-copied mirror in step.

// The cap. NOT a setting — see the controller header. 50 abstracts is ~40k input tokens, which is
// what a single screening call was measured at; it is also about as many as a human will read.
export const RECORD_CAP = 50

// ---------------------------------------------------------------------------
// PICO — Mode 3's input.
//
// FOUR FIELDS, NOT A TEXTAREA, AND THAT IS THE WHOLE PHI ARGUMENT. A box that says "describe the
// case" invites a case history; a field labelled Population, placeheld with "adults with type 2
// diabetes and CKD", teaches that Population is a CLINICAL CLASS. The hazard is removed at the
// affordance rather than policed by a detector afterwards — and a detector was explicitly ruled
// out, because the obvious MRN heuristic ("a 7-10 digit number") fires on every PMID in the seeds
// field.
//
// Comparison is OPTIONAL. Plenty of real clinical questions have no comparator, and a required C
// field would invite someone to invent one.
export type Pico = { population: string; intervention: string; comparison?: string; outcome: string }

export const PICO_FIELDS: Array<{ id: keyof Pico; label: string; placeholder: string; required: boolean }> = [
    { id: 'population',   label: 'Population',   placeholder: 'adults with type 2 diabetes and CKD', required: true },
    { id: 'intervention', label: 'Intervention', placeholder: 'SGLT2 inhibitor',                     required: true },
    { id: 'comparison',   label: 'Comparison',   placeholder: 'metformin',                           required: false },
    { id: 'outcome',      label: 'Outcome',      placeholder: 'cardiovascular mortality',            required: true },
]

// The question the clinician actually asked, reassembled into one sentence. It is what the model is
// asked to answer and what the run is labelled with — so the client renders THIS, not the four
// boxes, and the reader can see the question that was really put.
export function picoQuestion(p: Pico): string {
    const c = (p.comparison || '').trim()
    return `In ${p.population.trim()}, does ${p.intervention.trim()}` +
        (c ? `, compared with ${c},` : '') +
        ` affect ${p.outcome.trim()}?`
}

export function picoComplete(p: Partial<Pico>): boolean {
    return PICO_FIELDS.filter(f => f.required).every(f => String(p[f.id] || '').trim().length > 0)
}

// THE BAND WHERE THE SLICE STOPS BEING DEFENSIBLE.
//
// Retrieval is ranked by relevance and cut at RECORD_CAP, so what the reader actually gets is
// always "the top 50 of N". Three bands, and only the third one needs a conversation:
//
//   hits <= 50          all N retrieved. There is no slice, so there is nothing to warn about.
//   50 < hits <= 200    the top 50 of N. A defensible slice — retrieve it, and SAY THE RATIO.
//   hits > 200          the 50 is a thin slice of the yield. Do not retrieve yet: price the
//                       narrowings and let the librarian choose (suggestNarrowings, controller).
//
// This REPLACES a hard refusal above 2,000 hits, and that refusal was never ours to make — it was
// the retrieval tool's own fetch limit, and the tool now takes a retmax (see fetchArticles). Both
// halves of the old behaviour were wrong: a yield of 80 needed no ceremony, and a yield of 1,391
// was not an error, it was a thin slice taken SILENTLY.
//
// So this is a gate, never a wall. `proceed` walks straight through it and retrieves the 50 anyway
// (see runReview): the librarian may know exactly what they are doing, and a tool that refuses to
// run is worse than one that warns.
export const NARROW_ABOVE = 200
