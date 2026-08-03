/*
 * MODE 2 of the Literature Search check — "Issue review": records, not counts.
 *
 * Takes Mode 1's yield rather than counting the fixture again. The narrowings are PRICED against
 * that number, so counting a second time would compare two searches run seconds apart and hand the
 * difference to the narrowing to explain.
 */
const assert = require('node:assert')
const { strategy } = require('./literatureSearch.check.fixtures')

const run = async (lit, { hits }) => {
    const s = strategy()

    // =======================================================================================
    // MODE 2 — "Issue review". Records, not counts. Still no LLM: everything below is either
    // pure or a PubMed fetch, and the two things it defends are the two that silently produce
    // a page that looks perfect and is worthless.

    // ---- Pure: the design chip. -------------------------------------------------------------
    // Derived from PubMed's OWN publication types, never from the model's read of the abstract —
    // the chip is a claim about the evidence hierarchy, and PubMed's indexers already made it.
    assert.strictEqual(lit.designOf(['Randomized Controlled Trial', 'Journal Article']), 'RCT')
    assert.strictEqual(lit.designOf(['Journal Article', 'Review', "Research Support, Non-U.S. Gov't"]), 'Review')
    assert.strictEqual(lit.designOf(['Observational Study']), 'Observational')
    assert.strictEqual(lit.designOf(['Journal Article']), 'Other', 'a bare Journal Article is "Other", not a guess')
    assert.strictEqual(lit.designOf([]), 'Other')
    // The types OVERLAP, so the order is the evidence hierarchy and the strongest true label wins.
    // A meta-analysis is ALSO tagged Systematic Review and Review; showing it as "Review" would
    // demote the strongest evidence on the page.
    assert.strictEqual(
        lit.designOf(['Meta-Analysis', 'Systematic Review', 'Review', 'Journal Article']), 'Meta-analysis',
        'meta-analysis outranks the Review tags PubMed also puts on it',
    )
    // Qualified variants are real ("Randomized Controlled Trial, Veterinary"), and the tags arrive
    // in PubMed's own casing.
    assert.strictEqual(lit.designOf(['randomized controlled trial, veterinary']), 'RCT')

    // ---- Pure: the structured-abstract join. ------------------------------------------------
    // PubMed abstracts arrive in SEGMENTS. Keeping the labels is what lets a model tell a stated
    // RESULT from a stated OBJECTIVE — the exact distinction the synthesis prompt polices.
    assert.strictEqual(
        lit.joinAbstract([
            { abstractTextLabel: 'OBJECTIVE', abstractText: 'To test X.' },
            { abstractTextLabel: 'METHODS', abstractText: 'An RCT.' },
        ]),
        'OBJECTIVE: To test X.\nMETHODS: An RCT.',
        'the segments are joined with their labels kept',
    )
    // An unlabelled abstract is one segment and must NOT acquire a label out of thin air.
    assert.strictEqual(lit.joinAbstract([{ abstractText: 'One flat paragraph.' }]), 'One flat paragraph.')
    assert.strictEqual(lit.joinAbstract(undefined), '', 'a record with no abstract joins to empty, never to a crash')
    // THE TRAP, pinned. The field is `abstractText` — camelCase — while its siblings on `article`
    // are lowercase. The obvious guess parses cleanly, throws nothing, and yields an empty string:
    // 50 records screened on their titles alone, which reads plausible and is worthless.
    assert.strictEqual(lit.joinAbstract([{ abstracttext: 'wrong casing' }]), '', 'the lowercase guess yields NOTHING')

    // ---- Pure: the self-cancelling filter. ---------------------------------------------------
    // Lines within a block are OR-ed. So "Humans"[MeSH] OR-ed into a study-design block is
    // satisfied by every human paper ever indexed, and the design filter silently becomes a no-op.
    // The model did exactly this in a live run; 31 of 50 retrieved records came back reviews.
    {
        const bad = {
            db: 'pubmed',
            limits: '(2021:2026[dp])',
            concepts: [
                { label: 'Probiotics', lines: [{ terms: 'Probiotics[MeSH] OR probiotic[tiab]', on: true }] },
                { label: 'Study design', lines: [{ terms: 'Randomized Controlled Trial[pt] OR Humans[MeSH] OR placebo[tiab]', on: true }] },
            ],
        }
        const fixed = lit.hoistFilters(bad)
        const design = fixed.concepts.find(c => c.label === 'Study design')
        assert.ok(!/Humans/i.test(design.lines[0].terms), 'Humans is pulled OUT of the design block')
        assert.ok(/Randomized Controlled Trial\[pt\]/.test(design.lines[0].terms), 'the real design terms survive')
        const humans = fixed.concepts.find(c => c.label === 'Humans')
        assert.ok(humans, 'Humans gets its OWN block, so that it is AND-ed rather than OR-ed')
        // The whole point: it must now AND, i.e. actually restrict.
        assert.ok(lit.assembleQuery(fixed).includes(') AND (Humans[MeSH])'), 'and the AND is real in the emitted query')

        // A filter already alone in its own block is left exactly as it is — no churn.
        const good = {
            db: 'pubmed', limits: '',
            concepts: [{ label: 'Humans', lines: [{ terms: 'Humans[MeSH]', on: true }] }],
        }
        assert.deepStrictEqual(lit.hoistFilters(good), good, 'a correct strategy passes through untouched')
    }

    // ---- Live iCite: a MISSING percentile must never render as a real one. -------------------
    // Number(null) === 0, and 0 is finite. So a finiteness check on the COERCED value cannot tell
    // "iCite has not scored this yet" from "bottom of its field", and the first cut of this shipped
    // 14 of 50 records — every recent trial in the set — as a confident "NIH 0th pct".
    // 37314797 (2023) has a real percentile; 41667154 (2026) is too new to have one.
    {
        const scored = await lit.withCitationMetrics([
            { pmid: '37314797', title: '', journal: '', year: '2023', authors: '', design: 'RCT', abstract: '', mesh: [] },
            { pmid: '41667154', title: '', journal: '', year: '2026', authors: '', design: 'RCT', abstract: '', mesh: [] },
        ])
        const [old_, recent] = scored
        assert.strictEqual(typeof old_.nihPercentile, 'number', 'a scored paper carries its percentile')
        assert.ok(old_.nihPercentile > 50, 'and it is the real value, not a placeholder')
        assert.strictEqual(recent.nihPercentile, undefined,
            'an UNSCORED paper carries NO percentile — not 0, which would read as "bottom of its field"')
        // The records themselves must survive regardless: this is a garnish, never the deliverable.
        assert.strictEqual(scored.length, 2, 'iCite never drops a record')
    }

    // ---- Pure: PubMed markup. It is NOT just italics, and it is not only in titles. -----------
    // Rendered raw, this put "Psychobiotic <i>Lactobacillus plantarum</i> JYLP-326" on the screen
    // in a live run. In an ABSTRACT the same tags never reach the DOM — they just get billed into
    // the context window, 50 abstracts at a time.
    assert.strictEqual(
        lit.plainText('Psychobiotic <i>Lactobacillus plantarum</i> JYLP-326 relieves anxiety'),
        'Psychobiotic Lactobacillus plantarum JYLP-326 relieves anxiety',
        'italics are stripped, not printed',
    )
    assert.strictEqual(lit.plainText('CO<sub>2</sub> and <sup>13</sup>C and <b>bold</b>'), 'CO2 and 13C and bold',
        'sub/sup/bold too — the strip is generic, not an allowlist of the tags we happened to meet')
    assert.strictEqual(lit.plainText('Bacteroides &amp; Bifidobacterium'), 'Bacteroides & Bifidobacterium',
        'named entities are decoded')
    assert.strictEqual(lit.plainText('SMD &#x2212;0.44'), 'SMD −0.44',
        'numeric entities decode — an effect size must not reach the model as "&#x2212;0.44"')
    // &amp; is decoded LAST, or "&amp;lt;" double-decodes into a real "<" and re-opens the hole.
    assert.strictEqual(lit.plainText('a &amp;lt; b'), 'a &lt; b', 'no double-decoding into live markup')
    assert.strictEqual(lit.plainText(undefined), '', 'a missing title is empty, never a crash')
    // The markup strip runs on abstracts too — this is the token bug, not the render bug.
    assert.strictEqual(
        lit.joinAbstract([{ abstractTextLabel: 'RESULTS', abstractText: '<i>L. plantarum</i> reduced HAMD (p&lt;0.05).' }]),
        'RESULTS: L. plantarum reduced HAMD (p<0.05).',
        'abstracts are cleaned as well as titles',
    )

    // ---- Live PubMed: the record parse. -----------------------------------------------------
    const recs = await lit.fetchRecords('37314797[uid] OR 35654766[uid] OR 34875345[uid] OR 27793434[uid]', 4)
    assert.strictEqual(recs.length, 4, 'four PMIDs, four records')

    // THE ASSERTION THIS WHOLE SECTION EXISTS FOR. If the abstract path ever drifts, this fails
    // here rather than in a synthesis that quietly summarizes nothing but titles.
    for (const r of recs) {
        assert.ok(r.abstract.length > 200, `PMID ${r.pmid} came back with no abstract — check the camelCase path`)
        assert.ok(['RCT', 'Meta-analysis', 'Review', 'Observational', 'Other'].includes(r.design))
        console.log(`  ${r.pmid}  ${r.design.padEnd(13)} ${r.authors} — ${r.journal} ${r.year} (${r.abstract.length} chars)`)
    }

    const nikolova = recs.find(r => r.pmid === '37314797')
    assert.strictEqual(nikolova.design, 'RCT', 'PubMed tags Nikolova 2023 a Randomized Controlled Trial')
    assert.strictEqual(nikolova.authors, 'Nikolova et al.', 'first author + et al., because there are four of them')
    assert.strictEqual(nikolova.year, '2023')
    assert.strictEqual(nikolova.journal, 'JAMA Psychiatry', 'the ISO abbreviation, not the lowercased MEDLINE title')
    assert.ok(nikolova.mesh.includes('Humans'), 'the MeSH descriptors come through')
    // It is a JAMA structured abstract: eight labelled segments. The labels must survive the join.
    assert.ok(nikolova.abstract.startsWith('IMPORTANCE: '), 'the first segment keeps its label')
    assert.ok(nikolova.abstract.includes('\nRESULTS: '), 'every segment keeps its label, on its own line')

    // Schaub 2022 is a real unlabelled abstract — the join must not invent a label for it.
    const schaub = recs.find(r => r.pmid === '35654766')
    assert.ok(!/^[A-Z][A-Z ,]+:/.test(schaub.abstract), 'an unlabelled abstract stays unlabelled')

    const sarkar = recs.find(r => r.pmid === '27793434')
    assert.strictEqual(sarkar.design, 'Review', 'Sarkar 2016 is tagged Review, not RCT')

    // ---- Live PubMed: the cap, and the count-before-fetch rule. ------------------------------
    // The cap is a property of the mode, not a setting, and it is enforced HERE rather than
    // trusted to the retrieval tool's retmax: it bounds what enters the context window, so it
    // cannot depend on the far side of an HTTP call honouring a field.
    const capped = await lit.fetchRecords(lit.assembleQuery(s), 5)
    assert.strictEqual(capped.length, 5, 'the cap is enforced on our side of the wire')

    // THE THREE BANDS. Retrieval is always "the top 50 of N", so the only question is whether the
    // slice is honest: <= 50 is no slice at all, <= 200 is a defensible one, above that the 50 is a
    // thin slice of the yield and the librarian gets priced narrowings instead of a silent top-50.
    //
    // WHICH BAND THIS FIXTURE LANDS IN IS PUBMED'S BUSINESS — it indexes new papers every night —
    // so what is asserted is the RULE, not the number. Asserting `hits < 200` here would rot.
    const review = await lit.runReview(s, 'relevance')
    assert.strictEqual(
        !!review.needsNarrowing, review.hits > lit.NARROW_ABOVE,
        'the narrowing panel is offered exactly when the top 50 would be a thin slice',
    )
    if (review.needsNarrowing) {
        assert.strictEqual(review.records.length, 0, 'a gated search retrieves nothing until it is asked to')
    } else {
        assert.strictEqual(review.records.length, Math.min(review.hits, lit.RECORD_CAP), 'up to 50 records, never more')
    }
    assert.strictEqual(review.seeds.length, 0, 'Mode 2 has no known-item seeds, but keeps the shape')
    console.log(`issue review: ${review.hits} hits -> ${review.records.length} records fetched`)

    // A BROAD search is NOT AN ERROR, and it is NOT REFUSED. The old behaviour — a hard refusal
    // above 2,000 hits — was never ours to impose: it was the retrieval tool's fetch limit, and the
    // tool now takes a retmax. What is left is an honesty problem, not a technical one, so the
    // broad search comes back with the strategy, the count, and the PRICE of each way out of it.
    const broadStrategy = { ...s, concepts: [s.concepts[0]], limits: '' }
    const broad = await lit.runReview(broadStrategy, 'relevance')
    assert.ok(broad.hits > lit.NARROW_ABOVE, `expected a huge yield, got ${broad.hits}`)
    assert.strictEqual(broad.needsNarrowing, true, 'above the band the top 50 is a thin slice, and it says so')
    assert.strictEqual(broad.records.length, 0, 'and it retrieves nothing until the librarian has seen the price')
    assert.ok(broad.query.length > 0, 'the strategy still comes back — it is what the librarian narrows')
    assert.ok(broad.narrowings.length > 0, 'and it comes back with narrowings, priced')
    console.log(`narrowing:    ${broad.hits} records match — the top 50 is a thin slice. Priced ways out:`)
    for (const n of broad.narrowings) {
        // EVERY published narrowing REALLY NARROWS, and the number is COUNTED, never estimated.
        assert.ok(Number.isFinite(n.hits), `${n.label} must carry a counted yield`)
        assert.ok(n.hits < broad.hits, `${n.label} must actually reduce the count (${broad.hits} -> ${n.hits})`)
        assert.ok(n.terms.includes('['), `${n.label} must be fully tagged — an untagged block is irreproducible`)
        assert.ok(!/\bAND\b|\(/.test(n.terms), `${n.label} is a BLOCK, not a query — the client ANDs it in`)
        console.log(`  [ ] ${n.label.padEnd(24)} ${broad.hits} -> ${n.hits}   ${n.why}`)
    }

    // THE ESCAPE HATCH. `proceed` skips the gate at ANY count and retrieves the top 50 anyway. A
    // librarian may know exactly what they are doing, and a tool that refuses to run is worse than
    // one that warns.
    //
    // This is also the assertion that the deleted refusal was safe to delete: the retrieval tool
    // takes a retmax and returns the top 50 of a query in the hundreds of thousands. If that ever
    // stops being true, it fails HERE and not in front of a librarian.
    const anyway = await lit.runReview(broadStrategy, 'relevance', true)
    assert.ok(!anyway.needsNarrowing, 'proceed walks through the gate')
    assert.strictEqual(anyway.records.length, lit.RECORD_CAP, `the top 50 of ${anyway.hits} come back regardless`)
    console.log(`proceed:      ${anyway.hits} hits -> ${anyway.records.length} records (the top 50, retrieved anyway)`)

    // ---- Live PubMed: suggestNarrowings — the mirror of the suggested widening. ---------------
    // Same contract as suggestFixes, pointing the other way: a candidate is PRICED against live
    // PubMed, and one whose number we cannot stand behind is DROPPED rather than published.
    //
    // SKIPPED WHEN THE QUERY ALREADY HAS IT. The fixture is already limited to 2021-2026 RCTs, so
    // both the RCT block and the 5-year window are already in the assembled query — offering either
    // would price it at a delta of zero, which is noise dressed up as advice.
    const onFixture = await lit.suggestNarrowings(s, hits)
    const labels = onFixture.map(n => n.label)
    assert.ok(!labels.includes('Randomized trials only'), 'the RCT limit is already in this query')
    assert.ok(!labels.includes('Last 5 years'), 'a date limit is already set — the dropdown owns that decision')
    for (const n of onFixture) {
        assert.ok(n.hits < hits, `${n.label} must actually reduce the count (${hits} -> ${n.hits})`)
    }

    // A NARROWING THAT DOES NOT REDUCE THE COUNT IS DROPPED — the assertion this section exists for,
    // and the exact mirror of suggestFixes refusing to publish a widening that does not retrieve the
    // seed. Useless advice with a number on it is worse than no advice: it is a checkbox that costs
    // a click and buys nothing, next to two that are real.
    //
    // This strategy is ALREADY restricted to controlled clinical trials — but the words "Randomized
    // Controlled Trial[pt]" do not appear in it, so the candidate survives the textual skip. It is
    // offered, it is priced against live PubMed, and the price comes back IDENTICAL: every record in
    // the base already satisfies (RCT[pt] OR CCT[pt]), so the block excludes nothing. Set theory,
    // not a coincidence of this month's index — which is why this assertion cannot rot.
    const cct = { ...s, limits: '(2021:2026[dp]) AND (Controlled Clinical Trial[pt])' }
    const cctHits = await lit.countPubmed(lit.assembleQuery(cct))
    assert.ok(cctHits > 0, `the controlled-trial fixture must find something, got ${cctHits}`)
    const onCct = await lit.suggestNarrowings(cct, cctHits)
    assert.ok(
        !onCct.some(n => n.label === 'Randomized trials only'),
        'a narrowing that leaves the count unchanged is DROPPED, never shown as a no-op with a price on it',
    )
    console.log(`dropped:      "Randomized trials only" prices at ${cctHits} -> ${cctHits} on a trials-only query, so it is not offered`)
}

module.exports = { run }
