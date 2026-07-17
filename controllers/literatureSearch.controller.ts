// Literature Search — Mode 1 ("Search strategy") and Mode 2 ("Issue review").
//
// MODE 1. The deliverable is the SEARCH STRATEGY, not records. For a systematic review the
// strategy is the librarian's intellectual output: PRESS-peer-reviewed, published as
// the PRISMA-S appendix, and the thing that makes the review reproducible. Records,
// screening, and synthesis belong to Covidence/Rayyan. We hand off; we do not compete.
//
// Consequences, all of which make this file small:
//   - We never retrieve a record there, only COUNT. So it calls
//     /pubmed/query-number-pubmed-articles/ and never /pubmed/query-complex/.
//     It therefore scales to a 15,000-hit strategy for free, needs no streaming, and
//     sidesteps the 100-slice in pubmed.controller.ts entirely.
//     (The ONE exception is seedRecords() below, and it is bounded to the 3-5 seeds.)
//   - There is no result cap. An SR search is DESIGNED to over-retrieve.
//
// THE MODEL IS CALLED ONCE, AT THE START. buildStrategy() is Mode 1's only inference.
// Everything after it — runStrategy, the counts, the seed validation, the re-count after a
// librarian toggles a line — is arithmetic over PubMed counts. So the librarian can iterate
// the strategy all afternoon for the price of a few esearch calls. Keep it that way: the
// moment a toggle needs the model, iteration stops being free.
//
// Counts are exactly reproducible against the PubMed web UI. Verified 2026-07-12:
// a fully-tagged strategy returned 2,302 both ways, and 122 both ways with an RCT
// filter. PubMed's automatic term mapping only rewrites UNTAGGED terms, and the
// strategies we emit are fully tagged by construction.
//
// MODE 2 ("Issue review") is the other shape, and it is NOT Mode 1 with a cap bolted on:
//   - Objective is PRECISION, not recall — the ~30 papers that answer the question, not the
//     5,000 that mention it. Same concept blocks, different prompt (see REVIEW_PROMPT).
//   - It RETRIEVES records, so it meets two ceilings Mode 1 never had: the abstracts must fit a
//     context window (hence the 50-cap), and every abstract that enters the model costs money.
//     It no longer meets a RETRIEVAL ceiling — the tool takes a retmax and will return the top 50
//     of a 184,043-hit query (verified live 2026-07-13), so the old hard refusal above 2,000 hits
//     is gone and so is the constant it refused on. What is left is not a technical limit but an
//     HONESTY one: the top 50 of 1,391 is a thin slice, and taking it silently is the same quiet
//     lie this feature exists to prevent. Hence the three bands on the yield — see NARROW_ABOVE
//     and suggestNarrowings().
//   - It calls the model THREE times, in three separate round trips: build, screen, synthesize.
//     Screening and synthesis are gated on a human — you screen what the human kept, and you
//     synthesize what the human ticked. That is the integrity argument for the whole mode, and
//     it is why these are three POSTs and not one pipeline.
//
// THE 50-CAP IS A PROPERTY OF THE MODE, NOT A SETTING. There is no Max dropdown, and there
// must never be one: the cap is what bounds the context window and therefore the bill.


// This file is now the BARREL. The implementation lives in four focused modules, split by concern
// so no single file is 2,000+ lines: strategy (query assembly + types), counting (arithmetic over
// PubMed counts), records (fetch/shape/evidence tiers), llm (every Bedrock call). Consumers — the
// API route and the check harnesses — import from here, so the split changed no call site.
export * from './literatureSearch.strategy'
export * from './literatureSearch.counting'
export * from './literatureSearch.records'
export * from './literatureSearch.llm'
