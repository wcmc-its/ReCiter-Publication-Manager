// THE STEP LIST THE ANALYZER PAGE IS DRIVEN BY. Per the plan's decision 17: not one screen with
// internal stages, but five independent top-level steps, each its own checkpoint — a person can
// leave after Synopsize and come back for Score Relevance later without losing anything. Order here
// IS the tab order and the only place that order is declared; nothing downstream re-sorts it.

export type StepId = 'synopsize' | 'score-relevance' | 'score-impact' | 'themes' | 'summarize-themes'

// THE SAME NUMBER THE SERVER ENFORCES (src/pages/api/literature/search.ts), imported there from
// here rather than duplicated as a second literal. Every other model-calling path in that route
// bounds its input somewhere upstream of the Bedrock call — Mode 1/2's RECORD_CAP (50 records,
// fetched), Mode 4's preFilterForScoring budget (200 records, scored) — but the Analyzer has no
// strategy, no count-before-fetch gate, nothing standing between a pasted PMID list and a real
// bill. 200 anchors to preFilterForScoring's own 200-record scoring budget (literatureSearch.score.ts)
// — there is no other existing precedent in this codebase that fits better — and it is a DELIBERATE
// PHASE-1 SAFETY DEFAULT, not a tuned or final product number. Revisit once real usage exists.
//
// Defined HERE, not in search.ts, so the client (LiteratureAnalyzer.tsx) can enforce it BEFORE any
// batching starts, without importing an API route module (which would pull next-auth/server-only
// code into the browser bundle) — this file has no such imports, so it is safe for both sides.
export const ANALYZER_PMID_CAP = 200

export const STEPS: Array<{ id: StepId; label: string; info: string }> = [
    {
        id: 'synopsize',
        label: 'Synopsize',
        info: 'One model call per record, producing a short plain-language synopsis of each.',
    },
    {
        id: 'score-relevance',
        label: 'Score Relevance',
        info: 'Rates how relevant each record is to the review question, batch by batch.',
    },
    {
        id: 'score-impact',
        label: 'Score Impact',
        info: "Rates each record's likely impact, batch by batch.",
    },
    {
        id: 'themes',
        label: 'Themes',
        // Mockup's own "(i) button copy: Themes tab" (MOCKUPS-relevance-impact-topical-analysis
        // -2026-08-22.md, "Theme, opened" section) — markdown bold stripped and the "see the
        // asymmetry note above" aside dropped, since a native title tooltip has no "above" to point
        // to; the field-contract sentence itself is unchanged.
        info: "What this does: groups your ranked papers into research themes and assigns each "
            + "paper to one. In: your ranked working set — synopsis, impact score (a number), and "
            + "relevance's stated reason (text, not a number). Out: a theme list, each paper "
            + "assigned to a primary theme (or left 'didn't fit'), editable.",
    },
    {
        id: 'summarize-themes',
        label: 'Summarize Themes',
        info: 'Writes a narrative summary per theme, one model call per theme.',
    },
]

// Phase 0 wires exactly one step to the checkpoint-screen pattern, with dummy data, as the vertical
// proof that the pattern works — see LiteratureAnalyzer.tsx. Every other step is a placeholder until
// its own phase lands.
export const WIRED_STEP: StepId = 'synopsize'
