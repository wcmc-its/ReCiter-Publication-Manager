/*
 * MODE 1 of the Literature Search check — the strategy itself: assembleQuery, numberStrategy, the
 * empty-concept rule, and the DERIVED failing-block diagnosis against live PubMed.
 *
 * Run by literatureSearch.check.js, which is where the header explaining this whole harness lives.
 * It returns the assembled query and its yield because Mode 2 prices its narrowings against that
 * same number, and the exports appendix has to agree with it.
 */
const assert = require('node:assert')
const { strategy, untickConcept } = require('./literatureSearch.check.fixtures')

// ---- Pure: assembleQuery + numberStrategy. No network. --------------------------------
const checkAssembleQueryPure = (lit) => {
    const s = strategy()

    const q = lit.assembleQuery(s)
    assert.ok(q.includes(' AND '), 'concepts are AND-ed')
    assert.ok(q.includes(' OR '), 'the lines within a concept are OR-ed')
    assert.ok(q.endsWith(s.limits), 'limits are appended, not folded into a concept')

    // THE ONE THAT MATTERS. A concept with nothing ticked must DROP OUT OF THE AND entirely.
    // If it instead emitted `(...) AND ()`, PubMed would either reject the query or — far worse —
    // silently reinterpret it, and the librarian would be handed a count for a search they never
    // ran. Every checkbox on the page rests on this being right.
    const dropped = lit.assembleQuery(untickConcept(s, 1))
    assert.ok(!/\(\s*\)/.test(dropped), 'an unticked concept must never emit an empty ()')
    assert.ok(!dropped.includes('depress'), 'the unticked concept is gone from the query')
    assert.strictEqual(
        dropped,
        `("Gastrointestinal Microbiome"[MeSH] OR "Probiotics"[MeSH] OR probiotic*[tiab] OR synbiotic*[tiab]) AND ${s.limits}`,
        'one live concept: no stray AND, no stray parens',
    )

    // Nothing ticked at all is not "0 hits" — it is "there is no strategy". Empty string, so
    // runStrategy refuses to count it rather than reporting a confident, meaningless zero.
    assert.strictEqual(lit.assembleQuery(untickConcept(untickConcept(s, 0), 1)), '', 'no live concepts -> no query')

    return { s, q }
}

// PRESS numbering is DERIVED from the selection, so it can never describe a line that was
// not searched: 1,2 = probiotics lines, 3 = 1 OR 2, 4,5 = depression, 6 = 4 OR 5,
// 7 = 3 AND 6, 8 = 7 AND limits.
const checkNumberStrategyPure = (lit, s) => {
    const { rows, conceptLines } = lit.numberStrategy(s)
    assert.deepStrictEqual(conceptLines, [[1, 2], [4, 5]], 'each concept occupies its own numbered lines')
    assert.deepStrictEqual(
        rows.filter(r => r.kind === 'combine').map(r => `${r.n}: ${r.text}`),
        ['3: 1 OR 2', '6: 4 OR 5', '7: 3 AND 6', `8: 7 AND ${s.limits}`],
        'the combination lines recompute from the ticked lines',
    )
    // Untick one line and the numbering closes up behind it — the numbers ARE the current
    // selection. The free-text probiotics line goes; a single-line concept needs no OR row, so
    // probiotics now resolves straight to line 1.
    const oneOff = {
        ...s,
        concepts: s.concepts.map((c, i) => i === 0 ? { ...c, lines: [c.lines[0], { ...c.lines[1], on: false }] } : c),
    }
    assert.deepStrictEqual(
        lit.numberStrategy(oneOff).rows.filter(r => r.kind === 'combine').map(r => `${r.n}: ${r.text}`),
        ['4: 2 OR 3', '5: 1 AND 4', `6: 5 AND ${s.limits}`],
        'unticking a line renumbers, and a single-line concept emits no OR row',
    )
    // ...and THAT is why a rowCounts map cannot outlive the selection it was counted for. The map is
    // keyed by line number, and a line number does not name a stable query: here, number 4 means
    // "Depression"[MeSH] before the untick and "2 OR 3" after it. Read the old map at the new numbers
    // and every row shows some other row's count -- silently, and including the final row, the one
    // that IS the search. The UI must therefore DROP the map on any edit (dropRowCounts), not grey it
    // out. This asserts the hazard rather than the fix, because the fix lives in React and this file
    // cannot render: if a number ever stops being re-keyed by an untick, this goes red and the
    // invalidation can be revisited.
    const numberedQuery = st => new Map(lit.numberStrategy(st).rows.filter(r => r.n !== null).map(r => [r.n, r.query]))
    const before = numberedQuery(s)
    const after = numberedQuery(oneOff)
    const collision = [...after].filter(([n, q]) => before.has(n) && before.get(n) !== q)
    assert.ok(
        collision.length > 0,
        'unticking a line RE-KEYS the rows: a count map from the previous selection must be dropped, never re-read',
    )
    assert.notStrictEqual(
        before.get(Math.max(...before.keys())),
        after.get(Math.max(...after.keys())),
        'even the final row -- the whole search -- changes its number, so a stale map mislabels the yield line itself',
    )
}

// ---- Live PubMed. ---------------------------------------------------------------------
const checkDerivedMissDiagnosisLive = async (lit, s, q) => {
    const hits = await lit.countPubmed(q)
    assert.ok(Number.isFinite(hits) && hits > 0, `expected a positive yield, got ${hits}`)
    console.log(`yield: ${hits}`)

    // A seed is an IDENTIFIER WITH A KIND, never a bare PMID — a Scopus-only record has no PMID at
    // all. parseSeeds is what the route and the browser both use, so it is what is checked.
    const seedList = lit.parseSeeds([
        '37314797', // Nikolova 2023  JAMA Psychiatry    -> in the set
        '35654766', // Schaub   2022  Transl Psychiatry  -> in the set
        '34875345', // Tian     2022  Brain Behav Immun  -> in the set
        '27793434', // Sarkar   2016  Trends Neurosci    -> MISS
    ])
    assert.strictEqual(seedList.length, 4, 'four PMIDs parse out of the seeds box')
    assert.ok(seedList.every(x => x.kind === 'pmid'), 'digits are PMIDs')

    const seeds = await lit.validateSeeds(s, seedList)

    for (const x of seeds) {
        const why = x.retrieved
            ? ''
            : `  <- fails: ${[...x.failingConcepts.map(i => s.concepts[i].label), ...(x.failsLimits ? ['LIMITS'] : [])].join(', ')}`
        console.log(`  ${x.retrieved ? 'HIT ' : 'MISS'}  ${x.kind.toUpperCase()} ${x.id}${why}`)
    }

    assert.strictEqual(seeds.filter(x => x.retrieved).length, 3, 'three seeds must be retrieved')

    // Sarkar 2016 CLEARS the probiotics block (it is MeSH-indexed under Probiotics) but FAILS
    // the depression block: PubMed indexes it under Emotions, and its abstract never says
    // "depression". A model asked to GUESS the reason would most likely have blamed the
    // 2021-2026 date range. Deriving the reason rather than guessing it is what makes the miss
    // trustworthy, so it is what this check defends.
    const miss = seeds.find(x => x.id === '27793434')
    assert.ok(miss && !miss.retrieved, 'Sarkar 2016 must miss this strategy')
    assert.deepStrictEqual(miss.failingConcepts, [1], 'the miss is attributed to the Depression block (index 1)')

    // AND IT ALSO FAILS THE LIMITS — it is a 2016 review, and we asked for 2021-2026 RCTs. Both
    // causes are reported, independently, because reporting only the block sends a librarian off
    // to widen a search that STILL cannot return the paper. This exact hole shipped once: the
    // suggested "Emotions" line was verified against the block alone, so the page promised
    // "retrieves Sarkar (2016)", charged +531 records to screen, and did not retrieve it.
    assert.strictEqual(miss.failsLimits, true, 'Sarkar 2016 also fails the 2021-2026 RCT limits')

    // So the honest end-to-end check: widening the Depression block does NOT bring it back while
    // those limits stand. This is the assertion that would have caught the false promise.
    const widenedDepression = {
        ...s,
        concepts: s.concepts.map((c, i) => i === 1
            ? { ...c, lines: [...c.lines, { terms: '"Emotions"[MeSH] OR mood[tiab]', on: true }] }
            : c),
    }
    assert.strictEqual(
        await lit.countPubmed(`27793434[uid] AND (${lit.assembleQuery(widenedDepression)})`), 0,
        'widening the block alone must NOT retrieve a seed the limits exclude',
    )
    // Drop the limits as well and it finally comes back — proving the limits were the second,
    // independent cause rather than a red herring.
    assert.strictEqual(
        await lit.countPubmed(`27793434[uid] AND (${lit.assembleQuery({ ...widenedDepression, limits: '' })})`), 1,
        'widening the block AND dropping the limits retrieves it',
    )

    return { hits, widenedDepression }
}

const checkMonotonicityInvariantLive = async (lit, s, hits, widenedDepression) => {
    // The toggle arithmetic the whole feature rests on: dropping an AND-ed block can only widen
    // the search. This is what a librarian sees when they untick the block that was killing their
    // seeds, and it is why the checkboxes are safe to hand over.
    const widened = await lit.countPubmed(lit.assembleQuery(untickConcept(s, 1)))
    assert.ok(widened > hits, `unticking a concept must widen the search (${hits} -> ${widened})`)
    console.log(`untick the Depression block: ${hits} -> ${widened} records`)

    // THE MONOTONICITY INVARIANT, and the assertion that would have caught a real bug.
    //
    // OR-ing terms INTO a block can only ADD records. `widened >= base` is arithmetic. When it is
    // violated, the maths is not wrong — THE COUNT IS. A throttled esearch comes back as a
    // well-formed 0 rather than an error (unkeyed NCBI is 3 req/s and a build fires a dozen
    // counts), and on 2026-07-13 that produced a suggested widening priced at "+-5,714 records":
    // countPubmed returned 0 for a query that reliably counts 64,604.
    //
    // suggestFixes now refuses to publish a price that violates this, and countPubmed retries a
    // zero once. This is the check that keeps both honest.
    const widenedBlockHits = await lit.countPubmed(lit.assembleQuery(widenedDepression))
    assert.ok(
        widenedBlockHits >= hits,
        `widening a block cannot SHRINK the search — the count is untrustworthy (${hits} -> ${widenedBlockHits})`,
    )
    console.log(`widen the Depression block:  ${hits} -> ${widenedBlockHits} records (+${widenedBlockHits - hits})`)
}

const run = async (lit) => {
    const { s, q } = checkAssembleQueryPure(lit)
    checkNumberStrategyPure(lit, s)
    const { hits, widenedDepression } = await checkDerivedMissDiagnosisLive(lit, s, q)
    await checkMonotonicityInvariantLive(lit, s, hits, widenedDepression)

    return { q, hits }
}

module.exports = { run }
