// THE TABLES THE PAGE IS DRIVEN BY. Each one carries its reasoning with it, because in every case
// the interesting thing is not the value but why that value and not another — which mode is ready,
// which database can be counted, how long a stage actually takes when measured.
import type { Db } from '../../../../controllers/literatureSearch.strategy'

// Long enough for a transient NCBI blip to pass, short enough that a librarian does not notice. The
// retrieval tool has already spent its own seven retries by the time we see a 502, so an instant
// re-fire lands in the same bad moment; a pause is the entire point.
export const ROWS_RETRY_MS = 1500

// Clinical question is LIVE as of 2026-07-13: InfoSec cleared it, and the PHI surface that worried
// them is gone — the mode takes four structured PICO fields, not a "describe the case" textarea.
// The hazard was removed at the affordance rather than policed by a detector afterwards. (A
// detector remains forbidden: the obvious MRN heuristic, "a 7-10 digit number", fires on every
// 8-digit PMID in the seeds field.)
export const MODES = [
    { id: 'search-strategy', label: 'Search strategy', desc: 'Recall · uncapped · produces a strategy, not a synthesis', ready: true },
    { id: 'issue-review', label: 'Issue review', desc: 'Precision · top 50 · narrative synthesis', ready: true },
    { id: 'clinical-question', label: 'Clinical question', desc: 'Precision · top 50 · PICO answer', ready: true },
    { id: 'bibliometric-review', label: 'Bibliometric review', desc: 'Recall · full corpus (10y) · trends, clusters, narrative review', ready: true },
]

// SCOPUS IS SEARCH-STRATEGY ONLY, and that is principled rather than unfinished. Modes 2 and 3
// order records by an evidence tier derived from PubMed's publication-type indexing, and Scopus has
// no such index — probed live, DOCTYPE(rct) returns 0, because Scopus has no RCT document type. A
// Scopus "clinical answer" would have no evidence hierarchy underneath it, which is the one thing
// Mode 3 is for. Embase remains unavailable: Elsevier does not sell us API access to it.
export const DATABASES: Array<{ id: Db; label: string; ready: boolean; srOnly?: boolean; note?: string }> = [
    { id: 'pubmed', label: 'PubMed', ready: true },
    // Embase is DRAFTED, never executed: we have no API for it, so it yields a strategy and no count.
    // That is a real limitation and it is stated on the chip rather than discovered in the export.
    // It is Mode 1 only, for the same reason Scopus is — see the route.
    { id: 'embase', label: 'Embase (Ovid)', ready: true, srOnly: true, note: 'strategy only — we cannot count Embase, so you run it in Ovid' },
    { id: 'scopus', label: 'Scopus', ready: true, srOnly: true, note: 'no controlled vocabulary — supplementary to PubMed, not equivalent' },
]

// Without this control "top 50" is an unranked slice of the yield and the mode's promise is
// false. It is not sugar.
export const SORTS = [
    { id: 'relevance', label: 'Most relevant' },
    { id: 'date', label: 'Most recent' },
]

// The measured shape of each wait, so the screen can show a REAL number instead of a barber
// pole. Screening 50 abstracts in one call takes ~29s and the synthesis ~47s: those are long
// enough that a bare spinner reads as "hung", and the honest thing is to say what is happening,
// how long it usually takes, and how long it has actually been.
export const STAGES: Record<string, { expect: number }> = {
    fetching: { expect: 3 },
    screening: { expect: 30 },
    synthesizing: { expect: 48 },
}

// MODE 4's checklist, replacing Modes 1-3's "Publication type" dropdown for this mode only (see
// SearchForm.tsx's DatabasePicker for the checkbox-row pattern this copies). `tierLabel` is the
// EXACT string tierOf() returns (literatureSearch.records.ts's TIERS table) — the server resolves
// keep/drop by that label, never by `id`, so the two must never drift. `caseSeries` is not a real
// tier — see excludeCaseSeries()'s own comment — so it carries no `tierLabel` and the client sends
// it back as a separate boolean, not folded into the tier list.
export const EVIDENCE_TIERS: Array<{ id: string; label: string; tierLabel?: string; defaultOn: boolean }> = [
    { id: 'rct', label: 'Randomized controlled trial', tierLabel: 'RCT', defaultOn: true },
    { id: 'clinical-trial', label: 'Clinical trial (all phases)', tierLabel: 'Clinical trial', defaultOn: true },
    { id: 'meta-analysis', label: 'Meta-analysis', tierLabel: 'Meta-analysis', defaultOn: true },
    { id: 'systematic-review', label: 'Systematic review', tierLabel: 'Systematic review', defaultOn: true },
    { id: 'observational', label: 'Observational study', tierLabel: 'Observational', defaultOn: true },
    { id: 'case-series', label: 'Case series (probable — see note)', defaultOn: true },
    { id: 'case-reports', label: 'Case reports', tierLabel: 'Case report', defaultOn: false },
]

// The four real network round trips (see search.ts's handleM4* quartet) mapped onto the mockup's
// six-row step list — "Strategy validated" / "Retrieving corpus" / "Classifying evidence type"
// collapse into one step because all three finish together in ONE blocking POST (deterministic-
// or-one-model-call, no per-shard progress without SSE — see the plan's own "no SSE" call). No
// `expect` seconds here the way STAGES has them: a decade-scale retrieval's wall-clock depends on
// how many years clear PubMed's per-year cap, not a fixed median the way a 50-record screen call is.
export const M4_STEPS: Array<{ stage: string; label: string }> = [
    { stage: 'retrieving', label: 'Validating strategy & retrieving corpus' },
    { stage: 'clustering', label: 'Clustering keywords' },
    { stage: 'scoring', label: 'Scoring impact & relevance' },
    { stage: 'synthesizing', label: 'Synthesizing narrative review' },
]

export const CASE_SERIES_NOTE_COPY =
    "Case series can't be cleanly tagged in PubMed; papers matching this are marked \"probable,\" not confirmed."
