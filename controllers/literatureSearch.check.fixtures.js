/*
 * The fixtures every part of the Literature Search check searches with.
 *
 * A FACTORY, NOT A CONSTANT, and that is the whole reason this file exists. Each part builds its
 * own copy, so no part can hand the next one a strategy the assertions above it quietly edited —
 * and a check whose fixture drifts between sections reports on a search nobody ran.
 */

// A strategy shaped exactly as the model is prompted to emit one: PRESS-style, each concept
// split into its MeSH line and its free-text line, limits held separately. Two things here are
// load-bearing. Fully tagged: PubMed's automatic term mapping rewrites untagged terms, which
// would make the count irreproducible. Separate lines: a checkbox has to have a line to sit on.
const strategy = () => ({
    db: 'pubmed',
    concepts: [
        {
            label: 'Probiotics / microbiome',
            lines: [
                { terms: '"Gastrointestinal Microbiome"[MeSH] OR "Probiotics"[MeSH]', on: true },
                { terms: 'probiotic*[tiab] OR synbiotic*[tiab]', on: true },
            ],
        },
        {
            label: 'Depression',
            lines: [
                { terms: '"Depression"[MeSH] OR "Depressive Disorder"[MeSH]', on: true },
                { terms: 'depress*[tiab]', on: true },
            ],
        },
    ],
    limits: '(2021:2026[dp]) AND (Randomized Controlled Trial[pt])',
})

// Untick every line of one concept — what a librarian does to the "Adults" block that was
// silently killing their seeds.
const untickConcept = (s, ci) => ({
    ...s,
    concepts: s.concepts.map((c, i) =>
        i === ci ? { ...c, lines: c.lines.map(l => ({ ...l, on: false })) } : c),
})

module.exports = { strategy, untickConcept }
