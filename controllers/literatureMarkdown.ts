// The Markdown renderer. A THIRD renderer over the same `Block[]` as literatureDocx.ts, and it
// exists for the same reason that one does: nothing here decides what a document SAYS. If you find
// yourself wanting to add a fact in this file, it belongs in literatureExport.ts instead, where
// `npm run check:literature` can see it.
//
// It replaced the two hand-built strings in LiteratureSearch.tsx — the clipboard synthesis and the
// clipboard PRISMA-S methods block — and those strings are why this file exists at all. Both were
// assembled independently of the documents, so both quietly drifted away from them. The synthesis
// carried no query, no database, no yield and no search date, and it OMITTED the fabricated-citation
// warning that we detect, render on screen, and stamp into the .docx. The methods block — the thing
// a librarian pastes into a PUBLISHED manuscript — omitted that the strategy had been drafted by a
// model at all, which is the single disclosure that block exists to make.
//
// So the two most consequential artifacts on the page, the ones that get pasted into an email, a
// protocol and a manuscript, were the only two with no provenance and no warning on them. They now
// render the same blocks as the .docx: a fact added to a document arrives here automatically, and
// there is no hand-built format left on this page to drift.
//
// Unlike literatureDocx.ts this module has NO dependencies, so it is imported statically and costs
// the page bundle nothing worth deferring.

import type { Block } from './literatureExport'

// A short row would shift every later cell one column left, which reads as corrupted data rather
// than as a missing value. Same guard, same reason, as the .docx renderer.
const padTo = (r: string[], n: number) => Array.from({ length: n }, (_, i) => r[i] ?? '')

// A pipe inside a cell ENDS the cell, and a newline inside a cell ends the ROW — GFM tables have no
// escape for the second one. Either turns the evidence table into a table with the wrong number of
// columns, which renders as garbage rather than as an error.
const cell = (v: string) => String(v ?? '').replace(/\|/g, '\\|').replace(/\s*\n+\s*/g, ' ').trim()

// A BLANK LINE IS A PARAGRAPH BREAK; A SINGLE NEWLINE IS NOT.
//
// Markdown joins consecutive lines into one paragraph, so the model's 3-5 paragraph answer — bottom
// line, then the supporting evidence, then what it does not establish — collapses into one slab
// wherever this gets pasted. The screen (<Prose>) and the .docx both split on blank lines and fall
// back to single newlines; do the same here so all three show the same shape.
function paragraphs(text: string): string {
    const parts = String(text ?? '').split(/\n{2,}/)
    const split = parts.length > 1 ? parts : String(text ?? '').split(/\n/)
    return split.map(t => t.trim()).filter(Boolean).join('\n\n')
}

function render(b: Block): string {
    switch (b.kind) {
        case 'h1':
            return `# ${b.text}`
        case 'h2':
            return `## ${b.text}`
        case 'p':
            return paragraphs(b.text)
        case 'small':
            return `*${paragraphs(b.text)}*`
        // The query. A Boolean query is made of exactly the characters Markdown treats as syntax —
        // [MeSH Terms], *, _, "..." — so outside a fenced block it is silently reformatted, and what
        // the librarian pastes back into PubMed is no longer the query that produced the count above
        // it. A fence is the only thing that makes it come out the way it went in.
        case 'mono':
            return '```\n' + String(b.text ?? '') + '\n```'
        case 'table':
            return [
                `| ${b.head.map(cell).join(' | ')} |`,
                `| ${b.head.map(() => '---').join(' | ')} |`,
                ...b.rows.map(r => `| ${padTo(r, b.head.length).map(cell).join(' | ')} |`),
            ].join('\n')
        case 'spacer':
            return ''
    }
    // A BLOCK KIND NOBODY RENDERED, AND THE COMPILER IS WHAT CATCHES IT.
    //
    // `strict` is off in this tsconfig, so a switch that misses a kind returns `undefined` and
    // compiles perfectly clean — and markdownDoc's .filter(Boolean) then drops that block on the
    // floor without a word. Add an eighth kind to Block (a list of fabricated PMIDs, say), wire it
    // into the .docx, and it would simply not be in the Markdown: silently absent from the artifact
    // people forward, which is the exact failure this whole file was written to end.
    //
    // Assigning to `never` is the one exhaustiveness check that still fails the build with strict
    // off — the new kind is not assignable to `never`, so the build breaks here rather than the
    // document quietly losing a paragraph. The throw is unreachable by construction.
    const unhandled: never = b
    throw new Error(`literatureMarkdown: no renderer for block kind ${JSON.stringify(unhandled)}`)
}

export function markdownDoc(blocks: Block[]): string {
    return blocks.map(render).filter(Boolean).join('\n\n').trim() + '\n'
}
