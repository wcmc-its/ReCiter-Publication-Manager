/*
 * MODE 3 of the Literature Search check — "Clinical question": the evidence hierarchy.
 *
 * Almost all of it is pure, which is the point — the ranking is derived from PubMed's publication
 * types rather than from a model's read of the abstract, and that is exactly why it can be tested
 * at all. The one live assertion at the end proves the derivation still lands on a real record.
 */
const assert = require('node:assert')

const run = async (lit) => {
    // =======================================================================================
    // MODE 3 — "Clinical question". The evidence hierarchy IS the product, so it is the thing
    // most worth pinning. Still no LLM: the ranking is derived from PubMed's publication types,
    // which is exactly why it can be tested at all.

    // ---- Pure: the tiers. -------------------------------------------------------------------
    // THE INVERSION THIS FIXED, PINNED SO IT CANNOT COME BACK. Before Mode 3, `systematic review`
    // and `review` were ONE bucket tested AFTER RCT — so a systematic review sorted BELOW an RCT,
    // and a narrative review sorted EQUAL to a systematic one. Harmless when the design was just a
    // chip. Fatal when the ORDER IS THE ANSWER.
    const sr = lit.tierOf(['Systematic Review', 'Review', 'Journal Article'])
    const rct = lit.tierOf(['Randomized Controlled Trial', 'Journal Article'])
    const narrative = lit.tierOf(['Review', 'Journal Article'])
    assert.ok(sr.rank < rct.rank, 'a systematic review must outrank a randomized trial')
    assert.ok(rct.rank < narrative.rank, 'a randomized trial must outrank a narrative review')
    assert.strictEqual(sr.label, 'Systematic review')
    assert.strictEqual(narrative.label, 'Review')

    // The guideline tier did not exist at all before Mode 3 — and the spec's one substantive
    // sentence about this mode is "Guidelines and SRs before primary trials".
    const guide = lit.tierOf(['Practice Guideline', 'Journal Article'])
    assert.strictEqual(guide.rank, 1, 'a practice guideline is the top of the hierarchy')
    assert.ok(guide.rank < sr.rank, 'guidelines come before systematic reviews')

    // Still honest at the bottom: PubMed tags many real observational studies as nothing but
    // "Journal Article", and inventing a design for them would be the exact lie we are avoiding.
    assert.strictEqual(lit.tierOf(['Journal Article']).label, 'Other')

    // THE TWO TYPES THAT OVERRIDE EVERY OTHER TYPE ON THE RECORD.
    //
    // PubMed ADDS "Retracted Publication" alongside the original types rather than replacing them, so
    // a retracted trial still carries "Randomized Controlled Trial" — and first-match-wins used to
    // find the RCT, rank it 3, and sort a withdrawn paper to the TOP of a clinical answer. Not a
    // wrong number: a retracted one, led with as the strongest evidence available.
    const mkTier = (pmid, types) => ({ pmid, tier: lit.tierOf(types), types })
    const retracted = lit.tierOf(['Randomized Controlled Trial', 'Retracted Publication', 'Journal Article'])
    assert.strictEqual(retracted.label, 'RETRACTED', 'a retracted trial is NOT an RCT, whatever else PubMed tags it')
    assert.ok(retracted.rank > lit.tierOf(['Journal Article']).rank,
        'a retracted paper must sort BELOW an unclassified one — it can never lead the evidence')
    assert.strictEqual(lit.byTier([mkTier('1', ['Randomized Controlled Trial', 'Retracted Publication']), mkTier('2', ['Case Reports'])])[0].pmid, '2',
        'a case report outranks a retracted trial')

    // "Clinical Trial Protocol" startsWith "clinical trial", so it matched the rank-4 interventional
    // tier — letting a paper that reports NO RESULTS set the evidence floor.
    const protocol = lit.tierOf(['Clinical Trial Protocol', 'Journal Article'])
    assert.strictEqual(protocol.label, 'Protocol', 'a protocol is not a trial: it reports no results')
    assert.ok(protocol.rank > lit.tierOf(['Clinical Trial']).rank, 'a protocol must never outrank a completed trial')
    console.log('tiers:        a RETRACTED trial sorts below everything; a PROTOCOL is not a clinical trial')

    // ---- Pure: the sort is STABLE. ----------------------------------------------------------
    // Within a tier, PubMed's relevance order must survive: we are re-ordering by DESIGN, not
    // re-scoring by relevance. If this ever becomes unstable, the top of each tier silently
    // becomes arbitrary.
    const mk = (pmid, types) => ({ pmid, tier: lit.tierOf(types), types })
    const sorted = lit.byTier([
        mk('1', ['Journal Article']),
        mk('2', ['Randomized Controlled Trial']),
        mk('3', ['Practice Guideline']),
        mk('4', ['Randomized Controlled Trial']),   // same tier as 2, and AFTER it in relevance
        mk('5', ['Meta-Analysis']),
    ])
    assert.deepStrictEqual(
        sorted.map(r => r.pmid), ['3', '5', '2', '4', '1'],
        'guideline, then meta-analysis, then the two RCTs IN THEIR ORIGINAL ORDER, then the rest',
    )

    // ---- Pure: the evidence floor. ----------------------------------------------------------
    // The sentence that changes what a clinician does next, and it is arithmetic, not inference.
    // It must name what is ABSENT — "there is no randomized trial here" is the whole point.
    const weak = lit.evidenceFloor([mk('1', ['Case Reports']), mk('2', ['Journal Article'])])
    assert.ok(/case report/i.test(weak), 'the floor names the strongest design actually present')
    assert.ok(/no randomized trial/i.test(weak), 'the floor says the RCT is missing')
    assert.ok(/no clinical guideline/i.test(weak), 'the floor says the guideline is missing')
    const strong = lit.evidenceFloor([mk('1', ['Practice Guideline']), mk('2', ['Randomized Controlled Trial']),
        mk('3', ['Meta-Analysis'])])
    assert.ok(!/no /i.test(strong), 'nothing is missing, so the floor claims nothing is missing')
    assert.ok(/guideline/i.test(strong), strong)

    // ---- Pure: PICO. ------------------------------------------------------------------------
    // The four fields become ONE sentence, server-side. The client never composes it.
    assert.strictEqual(
        lit.picoQuestion({ population: 'adults with T2DM', intervention: 'SGLT2 inhibitors', comparison: 'metformin', outcome: 'CV mortality' }),
        'In adults with T2DM, does SGLT2 inhibitors, compared with metformin, affect CV mortality?',
    )
    // Comparison is OPTIONAL — plenty of real clinical questions have no comparator, and requiring
    // one invites the asker to invent it.
    assert.strictEqual(
        lit.picoQuestion({ population: 'adults with T2DM', intervention: 'SGLT2 inhibitors', outcome: 'CV mortality' }),
        'In adults with T2DM, does SGLT2 inhibitors affect CV mortality?',
    )
    assert.ok(!lit.picoComplete({ population: 'x', intervention: 'y' }), 'Outcome is required')
    assert.ok(lit.picoComplete({ population: 'x', intervention: 'y', outcome: 'z' }), 'Comparison is not')

    // ---- LIVE: the guideline tier against a REAL PubMed record. -----------------------------
    // The pure tests above prove the ordering. This proves the DERIVATION still lands on real
    // data — that PubMed's guideline records really do arrive carrying a publication type we
    // recognise, through the retrieval tool's parser, in the shape toRecord() expects. A tier
    // table that is right about strings and wrong about records would pass everything above.
    const guidelines = await lit.fetchRecords('"Practice Guideline"[pt] AND depression[majr]', 3, 'relevance')
    assert.ok(guidelines.length, 'PubMed returned no practice guidelines for a query that must have them')
    const g = guidelines[0]
    assert.strictEqual(g.tier.rank, 1,
        `a Practice Guideline[pt] record must land in tier 1, got "${g.design}" from types ${JSON.stringify(g.types)}`)
    assert.ok(g.types.length, 'the RAW publication types must survive onto the record — the tier claim is only auditable if they do')
    console.log(`guideline:    PMID ${g.pmid} -> tier ${g.tier.rank} (${g.design}) from ${JSON.stringify(g.types)}`)
}

module.exports = { run }
