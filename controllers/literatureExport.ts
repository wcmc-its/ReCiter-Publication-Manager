// Exports — the artifacts that leave this page.
//
// THE ONE RULE: AN EXPORT THAT CANNOT BE RE-RUN IS NOT EVIDENCE.
//
// Every document produced here carries the same five facts, at the top, without exception:
// the database, the exact Boolean query, the date it was run, the number of records it returned,
// and who ran it. That is the difference between a search someone can reproduce and a claim they
// have to take on faith — and reproducibility is the entire reason this feature exists. A synthesis
// pasted into a manuscript without the query behind it is an anecdote with citations.
//
// THE TRAP, and it is the one that would quietly ruin this: the exported strategy must describe the
// TOGGLED state that was ACTUALLY RUN, never the model's original draft. A librarian who unticks
// two term bundles, watches the count fall, and then exports a methods block describing the
// un-toggled strategy has published a query that does not reproduce their own number. So every
// builder below takes its numbers from the RESULT (what the server counted), never from the
// in-progress strategy on screen.
//
// ponytail: RTF, not .docx. Word opens RTF natively with real headings, bold and tables, this repo
// already serves `application/rtf` elsewhere (src/pages/api/db/reports/bibliometric-analysis), and
// it costs ZERO dependencies — a .docx builder is a library and a build step to emit a format Word
// will read either way. Ceiling: RTF has no styles pane and no track-changes; if a journal demands
// a real .docx, add the `docx` package and keep these same block builders.

import { numberStrategy, Concept } from './literatureSearch.strategy'

// ---------------------------------------------------------------------------
// RTF.

// RTF is a 7-bit format. Three characters are syntax and must be escaped, and anything outside
// ASCII has to be spelled as a signed 16-bit code point — an em-dash pasted from a title will
// otherwise arrive in Word as mojibake, and journal titles are full of them.
export function rtfEscape(s: string): string {
    return String(s ?? '')
        .replace(/[\\{}]/g, m => '\\' + m)          // \ { } are RTF syntax
        .replace(/\r?\n/g, '\\line ')
        .replace(/[\u0080-\uFFFF]/g, m => {
            // RTF wants a SIGNED 16-bit integer, so anything above 0x7FFF goes negative.
            const c = m.charCodeAt(0)
            return `\\u${c > 32767 ? c - 65536 : c}?`
        })
}

export type Block =
    | { kind: 'h1'; text: string }
    | { kind: 'h2'; text: string }
    | { kind: 'p'; text: string }
    | { kind: 'small'; text: string }
    | { kind: 'mono'; text: string }                                  // the query — must be copy-pastable
    | { kind: 'table'; head: string[]; rows: string[][] }
    | { kind: 'spacer' }

const TWIPS_PER_INCH = 1440
const PAGE_WIDTH = Math.round(6.5 * TWIPS_PER_INCH)   // Letter, 1" margins

function tableRtf(head: string[], rows: string[][]): string {
    const cols = head.length
    // Even columns. Good enough for an appendix, and it means no column can collapse to nothing.
    const edges = Array.from({ length: cols }, (_, i) => Math.round((PAGE_WIDTH / cols) * (i + 1)))
    const rowRtf = (cells: string[], bold: boolean) =>
        '\\trowd\\trgaph108\\trleft0' +
        edges.map(e => `\\clbrdrb\\brdrs\\brdrw10\\cellx${e}`).join('') +
        cells.map(c => `\\intbl${bold ? '\\b' : ''} ${rtfEscape(c)}${bold ? '\\b0' : ''}\\cell`).join('') +
        '\\row'
    return [rowRtf(head, true), ...rows.map(r => rowRtf(padTo(r, cols), false))].join('\n')
}

// A short row would silently shift every later cell one column left, which reads as corrupted data
// rather than as a missing value.
const padTo = (r: string[], n: number) => Array.from({ length: n }, (_, i) => r[i] ?? '')

export function rtf(blocks: Block[]): string {
    const body = blocks.map(b => {
        switch (b.kind) {
            case 'h1':     return `\\pard\\sa180\\b\\fs32 ${rtfEscape(b.text)}\\b0\\fs22\\par`
            case 'h2':     return `\\pard\\sb240\\sa120\\b\\fs26 ${rtfEscape(b.text)}\\b0\\fs22\\par`
            case 'p':      return `\\pard\\sa120\\fs22 ${rtfEscape(b.text)}\\par`
            case 'small':  return `\\pard\\sa120\\fs18\\i ${rtfEscape(b.text)}\\i0\\fs22\\par`
            case 'mono':   return `\\pard\\sa120\\f1\\fs18 ${rtfEscape(b.text)}\\f0\\fs22\\par`
            case 'table':  return `\\pard\n${tableRtf(b.head, b.rows)}\n\\pard\\sa120\\par`
            case 'spacer': return '\\pard\\par'
        }
    }).join('\n')

    return `{\\rtf1\\ansi\\ansicpg1252\\deff0
{\\fonttbl{\\f0\\fswiss Calibri;}{\\f1\\fmodern Consolas;}}
\\fs22
${body}
}`
}

// ---------------------------------------------------------------------------
// The five facts. Every document opens with these, and this is the only place they are assembled.

export type RunFacts = {
    query: string
    hits: number
    runDate: string
    cwid?: string
    limits?: string
    sort?: string
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
): Block[] {
    // Numbered from the RESULT's concepts — the toggled state that was actually counted. An
    // unticked line was not searched, so it does not appear in the methods.
    const { rows } = numberStrategy({ db: 'pubmed', concepts: r.concepts, limits: r.limits })
    const lines = rows.filter(x => x.n !== null)

    return [
        { kind: 'h1', text: 'PubMed search strategy' },
        { kind: 'p', text: question },
        ...reproHeader({ query: r.query, hits: r.hits, runDate: r.runDate, cwid, limits: r.limits }),

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

        { kind: 'p', text: 'AI-ASSISTED. This text was drafted by a language model over the records listed below, which a human selected. Every claim carries the PMID it came from — verify each one against the source. A claim with no PMID is unsupported.' },

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
            // PMIDs with no query attached is a list someone will later be unable to account for.
            name: 'Search',
            head: ['Field', 'Value'],
            rows: [
                ['Database', 'PubMed (via NCBI E-utilities)'],
                ['Date searched', facts.runDate],
                ['Records retrieved', facts.hits],
                ...(facts.limits ? [['Limits', facts.limits]] : []),
                ...(facts.sort ? [['Ranking', facts.sort]] : []),
                ...(facts.cwid ? [['Searched by', facts.cwid]] : []),
                ['Boolean query', facts.query],
            ] as Array<Array<string | number>>,
        },
    ]
}
