// Exports — the artifacts that leave this page.
//
// THE ONE RULE: AN EXPORT THAT CANNOT BE RE-RUN IS NOT EVIDENCE.
//
// Every document produced here carries the same facts, at the top, without exception: the database,
// the exact Boolean query, the date it was run, the number of records it returned, who ran it, and
// which model drafted it. That is the difference between a search someone can reproduce and a claim
// they have to take on faith — and reproducibility is the entire reason this feature exists. A
// synthesis pasted into a manuscript without the query behind it is an anecdote with citations.
//
// THE TRAP, and it is the one that would quietly ruin this: the exported strategy must describe the
// TOGGLED state that was ACTUALLY RUN, never the model's original draft. A librarian who unticks
// two term bundles, watches the count fall, and then exports a methods block describing the
// un-toggled strategy has published a query that does not reproduce their own number. So every
// builder below takes its numbers from the RESULT (what the server counted), never from the
// in-progress strategy on screen.
//
// This file is FORMAT-AGNOSTIC and PURE. It emits `Block[]`; the renderers live elsewhere —
// literatureDocx.ts turns blocks into a .docx and download.ts turns Sheets into an .xlsx, both
// loaded only from inside a click. Keeping the documents here and the file formats there is what
// lets `npm run check:literature` assert what a document SAYS with no dependency and no model call.

import { numberStrategy, Concept } from './literatureSearch.strategy'

export type Block =
    | { kind: 'h1'; text: string }
    | { kind: 'h2'; text: string }
    | { kind: 'p'; text: string }
    | { kind: 'small'; text: string }
    | { kind: 'mono'; text: string }                                  // the query — must be copy-pastable
    | { kind: 'table'; head: string[]; rows: string[][] }
    | { kind: 'spacer' }

// ---------------------------------------------------------------------------
// WHICH MODEL WROTE THIS.
//
// Journals increasingly require an AI declaration to name the tool AND ITS VERSION. "AI-assisted",
// with no model named, is not a declaration. So every document carries both halves:
//
//   the PRETTY name — what a reader understands.
//   the PROFILE ID  — what makes the run reproducible. The id, not the name, pins the weights, and
//                     the id is what the pod logs and the Bedrock bill agree on. Never drop it for
//                     being ugly.
//
// It is not a secret: BEDROCK_MODEL_ID is already on every log line this feature emits.
//
// ponytail: derived from the id, not a lookup table. A table of model names goes stale the day AWS
// ships the next one, and a stale pretty name sitting next to a correct id is worse than no pretty
// name at all. Ceiling: it reads the `family-version` id shape (claude-opus-4-8); an id it cannot
// parse falls through to the raw id — which is the half that had to be right anyway.
export function modelLabel(id: string): string {
    const m = String(id || '').match(/^(?:[a-z]+\.)?anthropic\.claude-([a-z]+)-([\d-]+)/i)
    if (!m) return String(id || '')
    return `Claude ${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2].replace(/-/g, '.')}, via AWS Bedrock`
}

const modelDisclosure = (id: string) => `${modelLabel(id)} (${id})`

// ---------------------------------------------------------------------------
// The facts. Every document opens with these, and this is the only place they are assembled.

export type RunFacts = {
    query: string
    hits: number
    runDate: string
    cwid?: string
    limits?: string
    sort?: string
    model?: string        // the Bedrock profile id, verbatim
}

export function reproHeader(f: RunFacts): Block[] {
    return [
        { kind: 'h2', text: 'How to reproduce this search' },
        { kind: 'table', head: ['Field', 'Value'], rows: [
            ['Database', 'PubMed (via NCBI E-utilities)'],
            ['Date searched', f.runDate],
            ['Records retrieved', String(f.hits)],
            ...(f.limits ? [['Limits', f.limits]] : []),
            ...(f.sort ? [['Ranking', f.sort]] : []),
            ...(f.cwid ? [['Searched by', f.cwid]] : []),
            // THE DISCLOSURE PEOPLE FORGET. The QUERY is model-drafted too, not just the prose — so
            // it belongs in the STRATEGY export, not only in the synthesis. A PRISMA-S appendix that
            // does not say the strategy was AI-drafted and human-reviewed is incomplete, and this
            // header is the only thing in a strategy export that could ever say it.
            ...(f.model
                ? [['Strategy drafted by', `${modelDisclosure(f.model)}, then reviewed and edited by the person named above`]]
                : []),
        ] },
        { kind: 'p', text: 'Full Boolean query — paste this into PubMed to reproduce the count above:' },
        { kind: 'mono', text: f.query },
    ]
}

// ---------------------------------------------------------------------------
// The documents.

export type SeedLike = { pmid: string; retrieved: boolean; label?: string; missReason?: string }

// Mode 1's deliverable, and the reason the whole feature exists: the PRISMA-S appendix.
export function strategyDoc(
    r: { concepts: Concept[]; limits: string; query: string; hits: number; runDate: string; seeds: SeedLike[] },
    question: string,
    cwid?: string,
    model?: string,
): Block[] {
    // Numbered from the RESULT's concepts — the toggled state that was actually counted. An
    // unticked line was not searched, so it does not appear in the methods.
    const { rows } = numberStrategy({ db: 'pubmed', concepts: r.concepts, limits: r.limits })
    const lines = rows.filter(x => x.n !== null)

    return [
        { kind: 'h1', text: 'PubMed search strategy' },
        { kind: 'p', text: question },
        ...reproHeader({ query: r.query, hits: r.hits, runDate: r.runDate, cwid, limits: r.limits, model }),

        { kind: 'h2', text: 'Search strategy, line by line' },
        { kind: 'small', text: 'Numbered as published search strategies are peer-reviewed (PRESS): each line is searched, and the combining lines show how the blocks were AND-ed and OR-ed together.' },
        { kind: 'table', head: ['#', 'Search line'], rows: lines.map(x => [
            String(x.n),
            x.kind === 'term' ? (x as any).line.terms : (x as any).text,
        ]) },

        { kind: 'h2', text: 'Known-item validation' },
        ...(r.seeds.length
            ? [
                { kind: 'p' as const, text: `${r.seeds.filter(s => s.retrieved).length} of ${r.seeds.length} seed records were retrieved by this strategy. A strategy that misses a paper it is known to need is broken, whatever its yield.` },
                { kind: 'table' as const, head: ['PMID', 'Paper', 'Retrieved?', 'If missed, why'], rows: r.seeds.map(s => [
                    s.pmid, s.label || '', s.retrieved ? 'Yes' : 'NO', s.retrieved ? '' : (s.missReason || ''),
                ]) },
            ]
            : [{ kind: 'p' as const, text: 'Not performed. No known-item seeds were supplied, so the recall of this strategy has not been verified.' }]),
    ]
}

export type SynthLike = {
    table: Array<{ pmid: string; study: string; year: string; journal: string; design: string; intervention: string }>
    prose: string
    floor?: string
}

// Modes 2 and 3. `floor` is present only for Mode 3 — and when it is, it goes FIRST, above the
// answer, because the strength of the evidence governs how the answer should be read.
export function synthesisDoc(
    syn: SynthLike,
    facts: RunFacts,
    question: string,
    opts: { pico: boolean; screenedIn: number; screenedOf: number },
): Block[] {
    return [
        { kind: 'h1', text: opts.pico ? 'Clinical question' : 'Issue review' },
        { kind: 'p', text: question },

        { kind: 'p', text:
            `AI-ASSISTED. This text was drafted by ${facts.model ? modelDisclosure(facts.model) : 'a language model'} `
            + 'over the records listed below, which a human selected. Every claim carries the PMID it came from — '
            + 'verify each one against the source. A claim with no PMID is unsupported.' },

        ...(syn.floor ? [
            { kind: 'h2' as const, text: 'Strength of this evidence' },
            { kind: 'p' as const, text: syn.floor },
            { kind: 'small' as const, text: "Study designs are PubMed's own indexing, not the model's reading of the abstracts. The evidence table is ordered by them." },
        ] : []),

        { kind: 'h2', text: opts.pico ? 'Answer' : 'Synthesis' },
        { kind: 'p', text: syn.prose },

        { kind: 'h2', text: 'Evidence' },
        { kind: 'table', head: ['Study', 'Year', 'Journal', 'Design', 'Intervention', 'PMID'], rows:
            syn.table.map(t => [t.study, t.year, t.journal, t.design, t.intervention, t.pmid]) },
        { kind: 'small', text: 'No effect sizes are reported unless the figure appears verbatim in the abstract and is cited. Pooled or estimated effects are not produced: this is a narrative synthesis, not a meta-analysis.' },

        ...reproHeader(facts),
        { kind: 'p', text: `${opts.screenedIn} of ${opts.screenedOf} retrieved records were selected for synthesis${facts.cwid ? ` by ${facts.cwid}` : ''} on ${facts.runDate}.` },
    ]
}

// ---------------------------------------------------------------------------
// Spreadsheets. Shape only — exceljs turns these into a workbook in the client, where it is
// dynamically imported so the 600KB library costs nothing until someone actually clicks Download.

export type Sheet = { name: string; head: string[]; rows: Array<Array<string | number>> }

export type RecordLike = {
    pmid: string; title: string; authors: string; year: string; journal: string
    design: string; tier?: { rank: number }; nihPercentile?: number
}

export function recordSheets(
    records: RecordLike[],
    flags: Record<string, { include: boolean; reason: string }>,
    picked: Record<string, boolean>,
    facts: RunFacts,
): Sheet[] {
    return [
        {
            name: 'Records',
            head: ['PMID', 'Title', 'Authors', 'Year', 'Journal', 'Design', 'Evidence rank',
                'NIH percentile', 'Selected by human', 'AI suggested', 'AI reason', 'Link'],
            rows: records.map(r => [
                r.pmid, r.title, r.authors, r.year, r.journal, r.design,
                r.tier?.rank ?? '',
                // A null percentile is NOT a zero. Never coerce it — Number(null) === 0, and a
                // confident "0th percentile" on a brand-new trial is a scarlet letter we invented.
                typeof r.nihPercentile === 'number' ? r.nihPercentile : '',
                picked[r.pmid] ? 'Yes' : 'No',
                flags[r.pmid] ? (flags[r.pmid].include ? 'Include' : 'Exclude') : '',
                flags[r.pmid]?.reason || '',
                `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`,
            ]),
        },
        {
            // The reproducibility facts travel WITH the data, in the same file. A spreadsheet of
            // PMIDs with no query attached is a list someone will later be unable to account for —
            // and the "AI suggested" column above is a model's opinion, so the sheet has to name
            // the model that held it.
            name: 'Search',
            head: ['Field', 'Value'],
            rows: [
                ['Database', 'PubMed (via NCBI E-utilities)'],
                ['Date searched', facts.runDate],
                ['Records retrieved', facts.hits],
                ...(facts.limits ? [['Limits', facts.limits]] : []),
                ...(facts.sort ? [['Ranking', facts.sort]] : []),
                ...(facts.cwid ? [['Searched by', facts.cwid]] : []),
                ...(facts.model ? [['Strategy drafted by', modelDisclosure(facts.model)]] : []),
                ...(facts.model ? [['AI suggestions by', modelDisclosure(facts.model)]] : []),
                ['Boolean query', facts.query],
            ] as Array<Array<string | number>>,
        },
    ]
}
