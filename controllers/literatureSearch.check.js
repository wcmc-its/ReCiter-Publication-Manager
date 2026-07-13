/*
 * Runnable check for the non-trivial logic behind Literature Search.
 *
 *   Mode 1: assembleQuery, numberStrategy, countPubmed, the DERIVED failing-block diagnosis.
 *   Mode 2: the design derivation, the structured-abstract join, the 50-cap, the count-before-fetch
 *           rule, the three bands on the yield, the PRICED narrowings above NARROW_ABOVE — every
 *           one of them counted, and any that does not narrow dropped — and the escape hatch that
 *           retrieves the top 50 anyway.
 *
 *   npm run check:literature
 *
 * This is an INTEGRATION check on purpose: it drives the live ReCiter PubMed Retrieval
 * Tool, because the thing worth protecting is that our counts, our seed logic and our
 * RECORD PARSING agree with real PubMed. A mocked version would pass while the feature was
 * broken — and in the case of the abstract path, a mocked version is precisely what would have
 * let "50 records, 0 abstracts" through.
 *
 * NO LLM. Needs .env.local (for RECITER_PUBMED_API_URL / RECITER_API_BASE_URL), needs no
 * BEDROCK_MODEL_ID, and NEVER calls Bedrock — everything asserted here is either pure or
 * downstream of the model, which is the point: the verifiable half of both modes does not
 * depend on inference. KEEP IT THAT WAY. A check that costs $0.49 to run is a check nobody runs.
 *
 * NOTE ON ASSERTIONS: we deliberately do NOT assert an exact yield. PubMed indexes new
 * papers, so the count drifts; asserting `hits === 122` would rot within weeks. What is
 * asserted instead is RELATIONAL (dropping an AND-ed block can only widen the search) and
 * BEHAVIOURAL (these four fixed historical papers hit or miss for a derivable reason).
 */
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
// Compile INSIDE the worktree, not os.tmpdir(). The controller imports
// @aws-sdk/client-bedrock-runtime at module scope, and node resolves node_modules by walking
// UP from the required file — from /var/folders/... it never reaches the repo and the require
// dies with MODULE_NOT_FOUND. (The check still makes no model call; the import just has to
// resolve.) .litcheck/ is gitignored.
const OUT = path.join(ROOT, '.litcheck')
fs.rmSync(OUT, { recursive: true, force: true })

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

execSync(
    `npx tsc controllers/literatureSearch.controller.ts --outDir ${OUT} ` +
    `--module commonjs --target es2020 --esModuleInterop --skipLibCheck --allowJs`,
    { cwd: ROOT, stdio: 'inherit' },
)
const lit = require(path.join(OUT, 'controllers/literatureSearch.controller.js'))

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

;(async () => {
    // ---- Pure: assembleQuery + numberStrategy. No network. --------------------------------
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

    // PRESS numbering is DERIVED from the selection, so it can never describe a line that was
    // not searched: 1,2 = probiotics lines, 3 = 1 OR 2, 4,5 = depression, 6 = 4 OR 5,
    // 7 = 3 AND 6, 8 = 7 AND limits.
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

    // ---- Live PubMed. ---------------------------------------------------------------------
    const hits = await lit.countPubmed(q)
    assert.ok(Number.isFinite(hits) && hits > 0, `expected a positive yield, got ${hits}`)
    console.log(`yield: ${hits}`)

    const seeds = await lit.validateSeeds(s, [
        '37314797', // Nikolova 2023  JAMA Psychiatry    -> in the set
        '35654766', // Schaub   2022  Transl Psychiatry  -> in the set
        '34875345', // Tian     2022  Brain Behav Immun  -> in the set
        '27793434', // Sarkar   2016  Trends Neurosci    -> MISS
    ])

    for (const x of seeds) {
        const why = x.retrieved
            ? ''
            : `  <- fails: ${[...x.failingConcepts.map(i => s.concepts[i].label), ...(x.failsLimits ? ['LIMITS'] : [])].join(', ')}`
        console.log(`  ${x.retrieved ? 'HIT ' : 'MISS'}  PMID ${x.pmid}${why}`)
    }

    assert.strictEqual(seeds.filter(x => x.retrieved).length, 3, 'three seeds must be retrieved')

    // Sarkar 2016 CLEARS the probiotics block (it is MeSH-indexed under Probiotics) but FAILS
    // the depression block: PubMed indexes it under Emotions, and its abstract never says
    // "depression". A model asked to GUESS the reason would most likely have blamed the
    // 2021-2026 date range. Deriving the reason rather than guessing it is what makes the miss
    // trustworthy, so it is what this check defends.
    const miss = seeds.find(x => x.pmid === '27793434')
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

    fs.rmSync(OUT, { recursive: true, force: true })
    console.log('\nOK - Mode 1 (assembleQuery, numberStrategy, the empty-concept rule, the derived miss-diagnosis)'
        + '\n     Mode 2 (the design derivation, the structured-abstract join, the 50-cap, count-before-fetch,'
        + '\n             the three bands, the priced narrowings, and the escape hatch)'
        + '\n     Mode 3 (the tier order incl. the SR-below-RCT inversion, the guideline tier against a real'
        + '\n             PubMed record, the stable sort, the evidence floor, and PICO)')
})().catch(e => {
    fs.rmSync(OUT, { recursive: true, force: true })
    console.error('\nFAILED:', e.message)
    process.exit(1)
})
