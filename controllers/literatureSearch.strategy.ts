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

export type Concept = {
    label: string            // e.g. "Depression"
    lines: Line[]            // atomic term lines only: MeSH line, free-text line, …
}

export type Strategy = {
    db: 'pubmed'
    concepts: Concept[]
    // Fully tagged, e.g. "(2021:2026[dp]) AND (Randomized Controlled Trial[pt])". Built from
    // the UI's dropdowns, NEVER by the model — see the note on LIMITS in the controller.
    limits: string
}

// LIMITS. The date range and publication type are chosen from these fixed tables and resolved
// to PubMed syntax ON THE SERVER, by id. They used to be a free-text box passed to the model as
// prose, which meant the MODEL decided what "2021-2026" meant — a quiet hole in the one thing
// Mode 1 promises. A librarian who cannot reproduce the count has nothing.
//
// Functions, not constants: the year has to be read when the search runs, not when the module
// was imported, or a pod that stays up over New Year silently searches the wrong window.
export const dateLimits = () => {
    const y = new Date().getFullYear()
    return [
        { id: 'any', label: 'Any date', terms: '' },
        { id: '5y', label: `${y - 5} – ${y}`, terms: `${y - 5}:${y}[dp]` },
        { id: '10y', label: `${y - 10} – ${y}`, terms: `${y - 10}:${y}[dp]` },
    ]
}

export const pubTypes = () => [
    { id: 'any', label: 'Any type', terms: '' },
    { id: 'rct-ma', label: 'RCT + Meta-analysis', terms: 'Randomized Controlled Trial[pt] OR Meta-Analysis[pt]' },
    { id: 'rct', label: 'RCT only', terms: 'Randomized Controlled Trial[pt]' },
    { id: 'review', label: 'Review', terms: 'Review[pt] OR Systematic Review[pt]' },
]

export function buildLimits(dateId: string, typeId: string): string {
    const terms = [
        dateLimits().find(d => d.id === dateId)?.terms,
        pubTypes().find(t => t.id === typeId)?.terms,
    ].filter(Boolean)                        // an unknown id resolves to no limit, never to a guess
    return terms.map(t => `(${t})`).join(' AND ')
}

const live = (c: Concept) => c.lines.filter(l => l.on && l.terms.trim()).map(l => l.terms.trim())

// The Boolean the librarian copies out, and the only thing we ever count.
//
// A concept with nothing ticked DROPS OUT OF THE AND ENTIRELY. It must never emit `3 AND ()`,
// which PubMed would either reject or — far worse — silently reinterpret. This is the one piece
// of real logic in this file and it is what literatureSearch.check.js defends.
export function assembleQuery(s: Strategy): string {
    const blocks = s.concepts.map(live).filter(t => t.length > 0).map(t => `(${t.join(' OR ')})`)
    if (!blocks.length) return ''
    const body = blocks.join(' AND ')
    return s.limits ? `${body} AND ${s.limits}` : body
}

// The query for one concept on its own — used to derive WHICH block excluded a missed seed.
export function conceptQuery(c: Concept): string {
    return live(c).join(' OR ')
}

export type Row =
    | { kind: 'term'; n: number | null; ci: number; li: number; line: Line }
    | { kind: 'combine'; n: number; text: string }

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
    let n = 0

    s.concepts.forEach((c, ci) => {
        const mine: number[] = []
        c.lines.forEach((line, li) => {
            const num = line.on && line.terms.trim() ? ++n : null
            if (num) mine.push(num)
            rows.push({ kind: 'term', n: num, ci, li, line })
        })
        conceptLines.push(mine)

        if (mine.length === 0) return                        // drops out of the AND
        if (mine.length === 1) { refs.push(mine[0]); return } // `4 OR` of one thing is noise
        rows.push({ kind: 'combine', n: ++n, text: mine.join(' OR ') })
        refs.push(n)
    })

    if (refs.length === 0) return { rows, conceptLines }

    let base = refs[0]
    if (refs.length > 1) {
        rows.push({ kind: 'combine', n: ++n, text: refs.join(' AND ') })
        base = n
    }
    if (s.limits) rows.push({ kind: 'combine', n: ++n, text: `${base} AND ${s.limits}` })

    return { rows, conceptLines }
}
