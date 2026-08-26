// THE SHAPES THE LITERATURE ANALYZER PAGE READS. Split out from LiteratureAnalyzer.parts.tsx the
// same way LiteratureSearch.types.ts is split from LiteratureSearch.parts.tsx (see that file's own
// header) — what a result IS, not what the screen DOES with it.

// A checkpoint screen has exactly three states, never more: nothing has been asked for yet, a run
// is in flight, or a run has landed. There is no "error" state here on purpose — a failed run in
// Phase 0's one wired-up step just falls back to BEFORE (see LiteratureAnalyzer.tsx's runSynopsize),
// the same "the button just looks live again" recovery CheckpointScreen's caller is expected to do
// in every later phase too.
export type CheckpointStatus = 'before' | 'running' | 'done'

// WHAT useChunkedProgress TRACKS, per run. `results` fills in as thunks resolve — not only once
// everything is done — so a caller that wants to render partial results while a later phase's step
// is still chewing through its batches can.
export type ChunkedProgressState<R> = {
    status: CheckpointStatus
    done: number
    total: number
    results: R[]
    elapsedMs: number
}

// ---------------------------------------------------------------------------
// SUMMARIZE THEMES (Phase 5) — one record from the corpus's working set, joined back together
// specifically for synthesis: title/synopsis/relevanceExplanation/impactJustification (what a
// theme's synthesis call needs to say something), `overallScore` (PLAN's relevanceScore^1.4 *
// impactScore^1.2 / 1000 formula, computed client-side via overallScoreOf() — imported, never
// reimplemented) for ranking/weighting, and `year` (threaded all the way from Synopsize's own
// response) for the year-count strip. Built once, in ThemesStep, from whichever of its two working-
// set sources (path a: Score Impact's qualifyingImpact; path b: an uploaded CSV) is actually in
// play — see LiteratureAnalyzer.tsx's own buildSynthesisSource() for how each path fills in
// `relevanceScore` (never itself sent onward — only its role in `overallScore` survives) since
// ThemesStep's own ThemeActivity shape deliberately drops the numeric relevance score (Discovery/
// Classification only ever need the explanation text, not the number — see ThemeActivity's own
// comment), so Phase 5 needs a second, parallel join rather than reusing that type outright.
export type SynthesisSourceRecord = {
    pmid: string
    title: string
    synopsis: string
    relevanceExplanation: string
    impactJustification: string
    overallScore: number
    year: string
}
