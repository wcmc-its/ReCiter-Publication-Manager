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

import { numberStrategy, DIALECTS, Rendering, Db, SeedKind } from './literatureSearch.strategy'

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
    // WHICH DATABASE. Not decoration: the document says "paste this into X to reproduce the count",
    // and a Scopus strategy pasted into PubMed reproduces nothing. Defaults to PubMed for the two
    // modes that only have one.
    db?: Db
    query: string
    // NULL = this database has no count because we have no API for it (Embase via Ovid). Never zero.
    hits: number | null
    // HOW MANY RECORDS WERE ACTUALLY PULLED DOWN. Modes 2 and 3 retrieve a CAPPED, ranked slice — 50
    // of however many the query yields — so `hits` and "retrieved" are two different numbers there,
    // and only Mode 1 (which counts and never retrieves) may conflate them. Left undefined by Mode 1.
    retrieved?: number
    runDate: string
    cwid?: string
    limits?: string
    sort?: string
    model?: string             // the Bedrock profile id, verbatim
    unsupportedLimits?: string[]
}

export function reproHeader(f: RunFacts): Block[] {
    const dialect = DIALECTS[f.db || 'pubmed']
    return [
        { kind: 'h2', text: 'How to reproduce this search' },
        { kind: 'table', head: ['Field', 'Value'], rows: [
            ['Database', dialect.provenance],
            ['Date searched', f.runDate],
            // TWO NUMBERS, NEVER ONE. In Modes 2/3 the query yields thousands and we retrieve the top
            // 50 — so a single "Records retrieved: 1391" row is how a co-author writes "Records
            // screened: 1,391" into a PRISMA flow diagram when the true figure is 50, twenty-seven
            // times smaller. The cap and the ranking were declared on screen and in NO export. They
            // are now in the methods, where the reader building the flow diagram actually looks.
            // AN UNCOUNTED DATABASE STATES THAT IT IS UNCOUNTED. `hits` is null for Embase (Ovid) —
            // no API — and `String(null)` is the word "null", while `Number(null)` is 0. Both are
            // fabrications in a methods table. The strategy is real and was drafted; it was never RUN,
            // and the document has to be the thing that says so, because the reader was not in the
            // room. THIS IS THE PRISMA-S APPENDIX: a yield printed here is a yield someone will cite.
            ...(f.hits === null
                ? [['Records identified by the query', `Not counted — we have no API for ${dialect.name}. This strategy was DRAFTED, not executed: run it in Ovid to obtain the yield.`]]
                : [['Records identified by the query', String(f.hits)]]),
            ...(f.hits !== null && f.retrieved !== undefined && f.retrieved < f.hits
                ? [['Records retrieved and screened', `${f.retrieved} — the top ${f.retrieved} of ${f.hits}, ranked by ${f.sort || 'relevance'}. The rest were not retrieved.`]]
                : f.hits !== null && f.retrieved !== undefined
                    ? [['Records retrieved and screened', String(f.retrieved)]]
                    : []),
            ...(f.limits ? [['Limits', f.limits]] : []),
            // A LIMIT THIS DATABASE COULD NOT EXPRESS. It goes in the METHODS, not just on the
            // screen, because the count above answers a BROADER question than the librarian asked —
            // and a reader comparing it with the PubMed count has no way to know that unless the
            // document says so. Scopus has no RCT document type, so "RCT only" lands here.
            //
            // Ovid is a DIFFERENT case and gets a different sentence: Ovid can express these limits
            // perfectly well — just in its own Limits panel, against a numbered set, rather than as
            // terms inside the Boolean. Telling a librarian "Ovid cannot express this" would be false,
            // and would send them looking for a workaround to a problem that does not exist.
            ...(f.unsupportedLimits?.length
                ? [['Limits NOT applied', dialect.countable
                    ? `${f.unsupportedLimits.join('; ')} — ${dialect.name} cannot express this limit, so the count above is not restricted by it`
                    : `${f.unsupportedLimits.join('; ')} — apply these in Ovid's own Limits panel after running the strategy. They are not part of the query text above.`]]
                : []),
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
        { kind: 'p', text: `Full Boolean query — paste this into ${dialect.name} to reproduce the count above:` },
        { kind: 'mono', text: f.query },
    ]
}

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

export type SynthLike = {
    table: Array<{ pmid: string; study: string; year: string; journal: string; design: string; intervention: string }>
    prose: string
    floor?: string
    // PMIDs the model cited that were never in the evidence set. Optional on the type, mandatory in
    // the document the moment it is non-empty — see synthesisDoc.
    invented?: string[]
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

        // A FABRICATED CITATION TRAVELS. This document is the artifact that leaves the building — it
        // gets mailed to a co-author, pasted into a protocol, cited. The server detects a PMID the
        // model was never given; if that detection stays on the screen the librarian saw and does not
        // ride along in the file, then the file is the clean-looking copy of a contaminated summary.
        // So the warning goes ABOVE the prose, in the document, every time.
        ...(syn.invented?.length ? [
            { kind: 'h2' as const, text: 'WARNING — this synthesis cites papers that were not in the evidence set' },
            { kind: 'p' as const, text:
                `The model cited PMID ${syn.invented.join(', ')}, which ${syn.invented.length === 1 ? 'was' : 'were'} not among the records selected for this synthesis. `
                + 'The citation came from outside the evidence set, so the claim it supports is unverified and the sentence around it must not be relied on. '
                + 'The prose below is reproduced UNEDITED — it has deliberately not been rewritten to hide this — and it must be read against the sources before any of it is used.' },
        ] : []),

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
                ['Database', DIALECTS[facts.db || 'pubmed'].provenance],
                ['Date searched', facts.runDate],
                // Same two numbers as the .docx methods table, and for the same reason: this sheet
                // sits next to a Records sheet holding exactly `retrieved` rows.
                ['Records identified by the query', facts.hits],
                ...(facts.retrieved !== undefined
                    ? [['Records retrieved and screened', facts.retrieved]]
                    : []),
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
