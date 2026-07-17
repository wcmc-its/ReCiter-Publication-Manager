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

//
// This file is now the BARREL. The builders live in four focused modules, split by concern so no
// single file is 400+ lines: blocks (Block type, repro header, model label), strategyDoc (the
// PRISMA-S appendix), synthesisDoc (issue-review / clinical-question), sheets (the .xlsx). The
// renderers and consumers import from here, so the split changed no call site.
export * from './literatureExport.blocks'
export * from './literatureExport.strategyDoc'
export * from './literatureExport.synthesisDoc'
export * from './literatureExport.sheets'
