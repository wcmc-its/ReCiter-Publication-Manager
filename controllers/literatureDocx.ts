// The Word renderer. A SECOND renderer over the same `Block[]` the documents are built from in
// literatureExport.ts — the documents themselves do not change, and nothing here decides what a
// document says. If you find yourself wanting to add a fact in this file, it belongs in
// literatureExport.ts instead, where the check can see it.
//
// It replaced an RTF renderer. RTF cost zero dependencies and Word opens it, but the file says
// .rtf, and a journal submission portal that rejects .rtf rejects the whole appendix — which is
// the one moment this feature exists for. So: a real .docx.
//
// ponytail: ONE renderer, not two. Keeping RTF "as well" would have meant two half-maintained
// mappings of the same Block[], and the one nobody exercises is the one that silently rots.
//
// This module is loaded ONLY from inside a click (see download.ts). It is deliberately NOT
// imported by literatureExport.ts, so `docx` never reaches the page bundle and the pure builders
// stay pure — `npm run check:literature` compiles and requires them with no dependency at all.

import {
    Document, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, WidthType, BorderStyle,
} from 'docx'
import type { Block } from './literatureExport'

// A short row would silently shift every later cell one column left, which reads as corrupted data
// rather than as a missing value.
const padTo = (r: string[], n: number) => Array.from({ length: n }, (_, i) => r[i] ?? '')

const cell = (text: string, bold: boolean) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 20 })] })],
    // Even columns. Good enough for an appendix, and it means no column can collapse to nothing.
    width: { size: 100, type: WidthType.PERCENTAGE },
})

const table = (head: string[], rows: string[][]) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
        new TableRow({ children: head.map(h => cell(h, true)), tableHeader: true }),
        ...rows.map(r => new TableRow({ children: padTo(r, head.length).map(c => cell(c, false)) })),
    ],
    borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
})

// A PARAGRAPH BREAK IS NOT A NEWLINE, IN WORD.
//
// OOXML has no concept of a line break inside <w:t> — a raw \n there is whitespace, and Word renders
// it as a space. So `new TextRun(prose)` collapsed the model's 3-5 paragraph answer (bottom line,
// then the supporting evidence, then what it does not establish — the structure both synth prompts
// ask for, and the structure the on-screen <Prose> component splits on) into ONE grey slab of text.
// The screen showed the shape; the .docx, which is the artifact that actually leaves the building,
// did not.
//
// Split on blank lines, falling back to single newlines, exactly as <Prose> does — one Paragraph
// each, so Word gets real paragraph marks.
function paragraphs(text: string): Paragraph[] {
    const parts = String(text ?? '').split(/\n{2,}/)
    const split = parts.length > 1 ? parts : String(text ?? '').split(/\n/)
    const kept = split.map(t => t.trim()).filter(Boolean)
    return (kept.length ? kept : ['']).map(t => new Paragraph({ children: [new TextRun(t)], spacing: { after: 120 } }))
}

function render(b: Block): Array<Paragraph | Table> {
    switch (b.kind) {
        case 'h1':
            return [new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_1, spacing: { after: 180 } })]
        case 'h2':
            return [new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } })]
        case 'p':
            return paragraphs(b.text)
        case 'small':
            return [new Paragraph({ children: [new TextRun({ text: b.text, italics: true, size: 18 })], spacing: { after: 120 } })]
        // The query. It has to survive copy-paste back into PubMed, so it is monospaced and never
        // wrapped in anything that could reflow it — including by the paragraph splitter above.
        case 'mono':
            return [new Paragraph({ children: [new TextRun({ text: b.text, font: 'Consolas', size: 18 })], spacing: { after: 120 } })]
        case 'table':
            return [table(b.head, b.rows)]
        case 'spacer':
            return [new Paragraph({ text: '' })]
    }
}

export function docxDoc(blocks: Block[]): Document {
    return new Document({
        styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
        // Word will not lay a table out flush against the next paragraph without something between
        // them, so every table gets a trailing empty paragraph.
        sections: [{ children: blocks.flatMap(b => (b.kind === 'table' ? [...render(b), new Paragraph({ text: '' })] : render(b))) }],
    })
}
