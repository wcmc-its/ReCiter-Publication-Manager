// THE STEP LIST THE ANALYZER PAGE IS DRIVEN BY. Per the plan's decision 17: not one screen with
// internal stages, but five independent top-level steps, each its own checkpoint — a person can
// leave after Synopsize and come back for Score Relevance later without losing anything. Order here
// IS the tab order and the only place that order is declared; nothing downstream re-sorts it.

export type StepId = 'synopsize' | 'score-relevance' | 'score-impact' | 'themes' | 'summarize-themes'

export const STEPS: Array<{ id: StepId; label: string; info: string }> = [
    {
        id: 'synopsize',
        label: 'Synopsize',
        info: 'One model call per batch of records, producing a short plain-language synopsis of each.',
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
        info: 'Clusters the scored corpus into themes.',
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
