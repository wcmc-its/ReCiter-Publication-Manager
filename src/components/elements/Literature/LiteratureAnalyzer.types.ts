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
