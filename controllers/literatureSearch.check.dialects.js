/*
 * THE CONCEPT / RENDERING SPLIT of the Literature Search check, and the database dialects —
 * PubMed, Scopus and Embase (Ovid).
 *
 * The Embase run is RETURNED rather than parked in a module-level variable. It is asserted in two
 * halves — the dialect facts here, the EXPORT where the renderers are loaded — and a value handed
 * from one named step to the next cannot be read before the step that produces it has run.
 */
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const { ROOT } = require('./literatureSearch.check.harness')

const run = async (lit) => {
    // =======================================================================================
    // THE CONCEPT / RENDERING SPLIT, and the database dialects.
    //
    // The whole point of the split is that a LABEL crosses a database boundary and TERMS never do.
    // Everything below is a rule that, if it broke, would break SILENTLY — a Scopus search running
    // without the limit the librarian asked for, or a seed check that cannot see half of Scopus.

    // A limit one database cannot express is DECLARED, not dropped. Scopus indexes a document type,
    // not a study design — probed live, DOCTYPE(rct) returns 0 — so "RCT only" has NO Scopus
    // equivalent. If this ever starts returning terms, someone has invented a fake RCT filter and
    // the Scopus count is quietly answering a different question from the PubMed one beside it.
    const pmLimits = lit.buildLimits('pubmed', '5y', 'rct')
    assert.ok(pmLimits.terms.includes('[dp]') && pmLimits.terms.includes('Randomized Controlled Trial[pt]'),
        'PubMed expresses both limits natively')
    assert.deepStrictEqual(pmLimits.unsupported, [], 'PubMed can express every limit the UI offers')

    const scLimits = lit.buildLimits('scopus', '5y', 'rct')
    assert.ok(scLimits.terms.includes('PUBYEAR >'), 'Scopus expresses the DATE limit natively')
    assert.ok(!/\[dp\]|\[pt\]/.test(scLimits.terms), 'PubMed field tags must NEVER reach a Scopus query')
    assert.deepStrictEqual(scLimits.unsupported, ['RCT only'],
        'Scopus has no RCT document type, and MUST say so rather than run an unlimited search')
    assert.ok(!/randomi/i.test(scLimits.terms),
        'an inexpressible limit must not be faked with free text — that is a translation layer in disguise')

    // A SEED IS NOT A PMID. A Scopus-only record (a conference paper, a non-MEDLINE journal) has no
    // PMID at all, and those are the records Scopus is FOR — so a PMID-keyed seed check could only
    // ever validate the half of Scopus that PubMed already covers. DOIs must parse and must render
    // in each database's own identifier syntax.
    const mixed = lit.parseSeeds('37314797, 10.1001/jamapsychiatry.2023.1817 not-an-id 37314797')
    assert.deepStrictEqual(mixed, [
        { id: '37314797', kind: 'pmid' },
        { id: '10.1001/jamapsychiatry.2023.1817', kind: 'doi' },
    ], 'PMIDs and DOIs both parse; junk is dropped; duplicates collapse')

    // ...AND THE SCREEN MUST COUNT WITH THIS EXACT FUNCTION. The component used to keep its own
    // PMID-only `parseSeeds` (a `/^\d{5,9}$/` filter), which meant the live "N seeds" pill and the
    // server's validation disagreed in BOTH directions: a pasted DOI counted 0 on screen and 1 on
    // the server, a comma-separated list of 3 counted 1, and the same PMID twice counted 2 on
    // screen and 1 on the server. The pill is the librarian's only pre-flight evidence that their
    // seeds registered, so a shadowing copy is a confident wrong number by construction. There is
    // no runtime seam to assert this through (the .tsx never reaches node), so assert it at the
    // source: the browser imports the shared parser and does not redefine one.
    const tsx = fs.readFileSync(
        path.join(ROOT, 'src/components/elements/Literature/LiteratureSearch.tsx'), 'utf8')
    assert.ok(!/(?:const|function)\s+parseSeeds\b/.test(tsx),
        'LiteratureSearch.tsx must NOT define its own parseSeeds — it shadows the shared one and the seed count stops matching what the server validates')
    assert.ok(/^\s*parseSeeds,\s*$/m.test(tsx),
        'LiteratureSearch.tsx must import parseSeeds from literatureSearch.strategy')

    const [pmSeed, doiSeed] = mixed
    assert.strictEqual(lit.DIALECTS.pubmed.seedQuery(pmSeed), '37314797[uid]')
    assert.strictEqual(lit.DIALECTS.pubmed.seedQuery(doiSeed), '"10.1001/jamapsychiatry.2023.1817"[aid]')
    assert.strictEqual(lit.DIALECTS.scopus.seedQuery(pmSeed), 'PMID(37314797)')
    assert.strictEqual(lit.DIALECTS.scopus.seedQuery(doiSeed), 'DOI("10.1001/jamapsychiatry.2023.1817")')

    // THE DOI IS QUOTED, AND ONLY A LIVE COUNT CAN PROVE IT MATTERS. A PII-style DOI carries literal
    // parentheses, and the seed ref is only ever counted CONCATENATED (`${ref} AND (${query})`) --
    // where those parens become PubMed's own Boolean grouping. Unquoted, a paper the search really
    // does retrieve is reported as a MISS, and the diagnosis then blames every concept block.
    // The control is the same paper by PMID: if that stops returning 1, this fixture rotted rather
    // than the quoting regressing.
    const lancet = { id: '10.1016/S0140-6736(20)30183-5', kind: 'doi' }   // PMID 31986264
    const inQuery = q => lit.countPubmed(`${q} AND (wuhan[tiab])`)
    assert.strictEqual(await inQuery('31986264[uid]'), 1, 'control: the query does retrieve the paper by PMID')
    assert.strictEqual(
        await inQuery(lit.DIALECTS.pubmed.seedQuery(lancet)), 1,
        'a parenthesised DOI seed must survive concatenation -- unquoted it counts 0 and the paper reads as a miss',
    )
    console.log('dialects:     limits native per DB; Scopus DECLARES "RCT only" as inexpressible; seeds are PMID *or* DOI')

    // ---- EMBASE (OVID): the database we DRAFT and never RUN. -------------------------------
    //
    // We have no API for it, so it produces NO NUMBER — and `strict: false` in tsconfig means the
    // compiler will NOT stop anyone turning that null into a zero. These assertions are the only net.
    assert.strictEqual(lit.DIALECTS.embase.countable, false, 'Embase has no API: it cannot be counted')
    assert.strictEqual(lit.DIALECTS.pubmed.countable, true)
    assert.strictEqual(lit.DIALECTS.scopus.countable, true)

    // countIn must THROW rather than fall through to PubMed's counter. A `db === 'scopus' ? a : b`
    // ternary would have counted an Ovid/Emtree query against PubMed and printed the answer next to
    // the Embase strategy — a number about a different database entirely.
    assert.throws(() => lit.countIn('embase'), /cannot be counted/i,
        'counting an uncountable database must throw, never silently use another database s counter')
    assert.throws(() => lit.DIALECTS.embase.seedQuery({ id: '1', kind: 'pmid' }), /cannot be counted/i,
        'a seed check needs a count; inventing Ovid seed syntax we never verified would be worse than none')

    // Ovid applies date/type limits in its OWN Limits panel, not as terms in the Boolean. So every one
    // of them is DECLARED, and NONE is silently dropped into the query.
    const eLimits = lit.buildLimits('embase', '5y', 'rct')
    assert.strictEqual(eLimits.terms, '', 'no limit may be fabricated into an Ovid query')
    assert.deepStrictEqual(eLimits.unsupported.length, 2, 'both limits are DECLARED as applied in Ovid, not dropped')

    // The query is passed through VERBATIM. Ovid syntax must survive assembly untouched: mangle
    // `exp probiotic agent/` and the line does not merely get worse, it does not run at all.
    const ovid = {
        db: 'embase',
        concepts: [
            { label: 'Probiotics', lines: [{ terms: 'exp probiotic agent/ or intestine flora/', on: true }, { terms: 'probiotic*.ti,ab,kw.', on: true }] },
            { label: 'Depression', lines: [{ terms: 'exp depression/', on: true }] },
        ],
        limits: '',
    }
    const oq = lit.assembleQuery(ovid)
    assert.ok(oq.includes('exp probiotic agent/') && oq.includes('probiotic*.ti,ab,kw.'),
        'Ovid syntax must pass through assembleQuery verbatim')
    assert.ok(!oq.includes('[tiab]') && !oq.includes('TITLE-ABS-KEY') && !/\/exp\b/.test(oq),
        'no PubMed, Scopus or Embase.com syntax may leak into an Ovid query')

    // runStrategy makes NO network call for an uncountable database, and returns null — never 0, and
    // never an empty seed list that would read as "none of your known papers came back".
    const eRun = await lit.runStrategy(ovid, lit.parseSeeds('37314797'), eLimits.unsupported)
    assert.strictEqual(eRun.hits, null, 'an uncounted database yields NULL, never 0')
    assert.deepStrictEqual(eRun.rowCounts, {}, 'no Results column without a counter')
    assert.deepStrictEqual(eRun.seeds, [], 'a seed cannot be validated against a database we cannot count')

    // The export half of this lives in the exports section below, where the renderers are loaded.
    const embaseRun = { run: eRun, unsupported: eLimits.unsupported }
    console.log('embase(ovid): countable=false -> hits NULL not 0, no seed check, Ovid syntax passes through verbatim')
    console.log('seed quoting: a PII-style DOI (parens and all) counts 1 inside `AND (...)`, same as its PMID')

    // ---- Live Scopus. Skipped LOUDLY when the tool is not configured. ----------------------
    if (!process.env.RECITER_SCOPUS_API_URL && !process.env.RECITER_API_BASE_URL) {
        console.log('scopus:       SKIPPED — set RECITER_SCOPUS_API_URL to check the Scopus half')
    } else {
        const sc = {
            db: 'scopus',
            concepts: [
                { label: 'Probiotics / microbiome', lines: [{ terms: 'TITLE-ABS-KEY(probiotic* OR synbiotic* OR "gut microbiome")', on: true }] },
                { label: 'Depression', lines: [{ terms: 'TITLE-ABS-KEY(depress* OR "mood disorder")', on: true }] },
            ],
            limits: lit.buildLimits('scopus', '5y', 'any').terms,
        }
        const scQuery = lit.assembleQuery(sc)
        // assembleQuery is DB-NEUTRAL: OR inside a block, AND between blocks, limits appended. If it
        // ever grows a `switch (s.db)`, something has gone wrong upstream.
        assert.ok(scQuery.includes('TITLE-ABS-KEY') && scQuery.includes('PUBYEAR >'),
            'the Scopus query is native Scopus, top-level limit and all')

        const scHits = await lit.countScopus(scQuery)
        assert.ok(Number.isFinite(scHits) && scHits > 0, `expected a positive Scopus yield, got ${scHits}`)

        // Narrowing must NARROW. This is the assertion that would catch a force-wrapped query: nest
        // a top-level limit inside TITLE-ABS-KEY() and Elsevier answers 400, or worse, silently
        // ignores it and this number does not move.
        const scNarrower = await lit.countScopus(`${scQuery} AND DOCTYPE(ar)`)
        assert.ok(scNarrower < scHits, 'a top-level DOCTYPE limit must actually narrow the Scopus count')

        // THE SEED CHECK, IN SCOPUS. Scopus indexes the PMIDs of the records it shares with MEDLINE,
        // which is what lets a librarian seed a Scopus strategy with the PMIDs they already have.
        const scSeeds = await lit.validateSeeds(sc, lit.parseSeeds('37314797 99999999999'))
        const found = scSeeds.find(x => x.id === '37314797')
        const absent = scSeeds.find(x => x.id === '99999999999')
        assert.ok(found && found.retrieved, 'Scopus must retrieve Nikolova 2023 for this strategy')

        // NOT IN THE DATABASE IS NOT A STRATEGY BUG, and it must never be reported as one. Without
        // this verdict a paper Scopus has never indexed "fails" every concept block at once, which
        // reads as a catastrophically narrow query and sends a librarian off to widen a search that
        // was never broken.
        assert.ok(absent && absent.notInDatabase === true,
            'a record Scopus does not index is reported as a COVERAGE gap, not as a failing block')
        assert.ok(!absent.failingConcepts, 'a not-in-database miss must not also blame a concept block')
        console.log(`scopus:       ${scHits} hits -> ${scNarrower} with DOCTYPE(ar); seed PMID 37314797 retrieved; a missing record reads as coverage, not as a bad query`)
    }

    return { embaseRun }
}

module.exports = { run }
