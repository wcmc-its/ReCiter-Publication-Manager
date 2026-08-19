// Modes 2 and 3: the issue-review / clinical-question synthesis document. Split out of
// literatureExport.ts (barrel).
import { Block, RunFacts, reproHeader, modelDisclosure } from './literatureExport.blocks'

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
