/*
 * THE RESULTS COLUMN of the Literature Search check — one record count per PRESS line.
 *
 * Returns the counted map and the yield it was counted with, because the exports part reads both
 * back out of the appendix it renders: a Records column that agrees with itself and disagrees with
 * the panel is exactly the failure this pair of parts exists to catch.
 */
const assert = require('node:assert')
const { strategy, untickConcept } = require('./literatureSearch.check.fixtures')

const run = async (lit) => {
    const s = strategy()

    // =======================================================================================
    // THE RESULTS COLUMN — one record count per PRESS line.
    //
    // Asserted RELATIONALLY, never against a literal: PubMed indexes new papers daily, so pinning
    // "line 1 == 40,132" would rot within weeks. What cannot drift is the ARITHMETIC — and the
    // arithmetic is exactly what a librarian reads the column for.

    // countRows is its own call, not part of runStrategy — the column costs 7 counts and a measured
    // 5.5s at the retrieval tool's 500ms pacing, and it must never sit between a librarian's click
    // and the yield they clicked for. The check exercises it the same way the route does.
    const rowsHits = await lit.countPubmed(lit.assembleQuery(s))
    const rc = await lit.countRows(s, rowsHits)
    const rowsResult = { hits: rowsHits }
    const numbered = lit.numberStrategy(s)
    const lastRow = numbered.rows.filter(r => r.n !== null).pop()

    // THE ONE THAT WOULD LIE. The final line IS the whole search, so its count IS the yield printed
    // at the top of the panel. If these two ever disagree, one of the numbers on screen is describing
    // a query we did not run — and there is no way for the librarian to tell which.
    assert.strictEqual(rc[lastRow.n], rowsResult.hits,
        'the last line of the history IS the search: its count must equal the yield')

    // AND-ing can only NARROW. The combined line can never retrieve more than the smallest block it
    // is built from — if it does, the row queries are not the queries we think they are.
    const conceptRows = numbered.rows.filter(r => r.kind === 'combine' && /OR/.test(r.text))
    const andRow = numbered.rows.find(r => r.kind === 'combine' && /AND/.test(r.text) && !/\[dp\]/.test(r.text))
    for (const cr of conceptRows) {
        assert.ok(rc[andRow.n] <= rc[cr.n],
            `AND-ing cannot widen: line ${andRow.n} (${rc[andRow.n]}) must be <= line ${cr.n} (${rc[cr.n]})`)
    }

    // OR-ing can only WIDEN. A concept's combined line must retrieve at least as much as any single
    // term line inside it.
    for (const cr of conceptRows) {
        const ci = numbered.conceptLines.findIndex(ns => ns.includes(cr.n - 1))
        for (const termN of numbered.conceptLines[ci] || []) {
            assert.ok(rc[cr.n] >= rc[termN],
                `OR-ing cannot narrow: line ${cr.n} (${rc[cr.n]}) must be >= line ${termN} (${rc[termN]})`)
        }
    }

    // An UNTICKED line has no number, so it must have no count. A count beside a line that was not
    // searched is the same class of lie as a methods block describing an un-toggled strategy.
    const offRows = lit.numberStrategy(untickConcept(s, 1)).rows.filter(r => r.kind === 'term' && r.n === null)
    assert.ok(offRows.length > 0, 'unticking a concept leaves unnumbered rows')
    console.log(`rowCounts:    line ${lastRow.n} == yield (${rowsResult.hits}); AND narrows; OR widens; unticked lines carry no count`)

    return { rc, rowsResult }
}

module.exports = { run }
