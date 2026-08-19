// Mode 1's deliverable: the PRISMA-S strategy appendix. Split out of literatureExport.ts (barrel).
import { numberStrategy, DIALECTS, Rendering, Db, SeedKind } from './literatureSearch.strategy'
import { Block, RunFacts, reproHeader } from './literatureExport.blocks'

// ---------------------------------------------------------------------------
// The documents.

export type SeedLike = {
    id: string
    kind: SeedKind             // a Scopus-only record has NO PMID — see Seed. Never assume one.
    retrieved: boolean
    label?: string
    missReason?: string
}

// Mode 1's deliverable, and the reason the whole feature exists: the PRISMA-S appendix.
export function strategyDoc(
    r: {
        db?: Db; concepts: Rendering[]; limits: string; unsupportedLimits?: string[]
        query: string; hits: number | null; runDate: string; seeds: SeedLike[]
        rowCounts?: Record<number, number>
    },
    question: string,
    cwid?: string,
    model?: string,
): Block[] {
    const dialect = DIALECTS[r.db || 'pubmed']
    // Numbered from the RESULT's concepts — the toggled state that was actually counted. An
    // unticked line was not searched, so it does not appear in the methods.
    const { rows } = numberStrategy({ db: r.db || 'pubmed', concepts: r.concepts, limits: r.limits })
    const lines = rows.filter(x => x.n !== null)

    return [
        { kind: 'h1', text: `${dialect.name} search strategy` },
        { kind: 'p', text: question },
        ...reproHeader({
            db: r.db, query: r.query, hits: r.hits, runDate: r.runDate, cwid,
            limits: r.limits, unsupportedLimits: r.unsupportedLimits, model,
        }),

        { kind: 'h2', text: 'Search strategy, line by line' },
        { kind: 'small', text: 'Numbered as published search strategies are peer-reviewed (PRESS): each line is searched, and the combining lines show how the blocks were AND-ed and OR-ed together. The record count for each line is the count that line returned on the date above.' },

        // THE ONE THING THIS EXPORT CAN DO THAT WE CANNOT.
        //
        // We have no API for Ovid, so we cannot count a line — which means a HALLUCINATED EMTREE
        // HEADING IS INVISIBLE TO US. It retrieves 0 in Ovid, silently, with no error, and its line
        // just quietly contributes nothing to its block. (Verified in Ovid: `zzzprobioticzzz/` -> 0,
        // no fallback to a keyword search — which is also why a wrong heading can never produce a
        // wrong NUMBER, only a thinner search.)
        //
        // The librarian, standing in front of Ovid, CAN check it — in seconds — but only if someone
        // tells them to. So the document tells them. That sentence is the entire difference between a
        // silent failure and a caught one, and it costs one paragraph.
        ...(dialect.countable ? [] : [
            { kind: 'p' as const, text:
                `HOW TO RUN THIS, AND HOW TO CHECK IT. This strategy was drafted for Ovid and has NOT been executed — `
                + `we have no API for ${dialect.name}, so no line below carries a count. Paste the lines into Ovid's `
                + `Advanced Search in order, with "Map Term to Subject Heading" UNTICKED so that each line runs exactly `
                + `as written; Ovid will number them 1..n as you go, matching the numbering below.` },
            { kind: 'p' as const, text:
                `Then check the Emtree lines. Run each subject-heading line ON ITS OWN. A heading that does not exist `
                + `returns ZERO in Ovid without raising an error, so a heading line that comes back 0 is a dead line — `
                + `it contributed nothing, and the free-text line beside it carried that concept alone. Ovid's Term `
                + `Finder will give you the correct Emtree preferred term. This check cannot be automated from our side, `
                + `and it is the one thing a reviewer of this strategy should not skip.` },
        ]),
        // THE RESULTS COLUMN GOES IN THE APPENDIX TOO. A PRESS reviewer reads a strategy BY its
        // per-line yields — that is how you see which block is doing the work and which one is dead
        // weight. An appendix with the lines but not the numbers is half an appendix.
        { kind: 'table', head: ['#', 'Search line', 'Records'], rows: lines.map(x => [
            String(x.n),
            x.kind === 'term' ? (x as any).line.terms : (x as any).text,
            // Never a 0 for "not counted" — see RowCount in the UI. An absent count is absent.
            typeof r.rowCounts?.[x.n as number] === 'number'
                ? r.rowCounts![x.n as number].toLocaleString()
                : '',
        ]) },

        { kind: 'h2', text: 'Known-item validation' },
        ...(r.seeds.length
            ? [
                { kind: 'p' as const, text: `${r.seeds.filter(s => s.retrieved).length} of ${r.seeds.length} seed records were retrieved by this strategy. A strategy that misses a paper it is known to need is broken, whatever its yield.` },
                { kind: 'table' as const, head: ['Identifier', 'Paper', 'Retrieved?', 'If missed, why'], rows: r.seeds.map(s => [
                    `${s.kind.toUpperCase()} ${s.id}`, s.label || '', s.retrieved ? 'Yes' : 'NO',
                    s.retrieved ? '' : (s.missReason || ''),
                ]) },
            ]
            : [{ kind: 'p' as const, text: 'Not performed. No known-item seeds were supplied, so the recall of this strategy has not been verified.' }]),
    ]
}
