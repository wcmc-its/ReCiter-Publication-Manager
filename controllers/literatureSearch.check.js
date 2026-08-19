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
 * WHICH IS WHY IT IS NOT THE MERGE GATE, AND CANNOT BECOME ONE. It needs a PubMed tool on :8083 that
 * no GitHub-hosted runner can reach, and it is flaky against live NCBI (2 red in 6 consecutive runs
 * on unchanged logic). The gate is its pure sibling — literatureSearch.pure.check.js, no network, no
 * env — which is what CI runs on every push. Anything you assert here that does NOT need the world
 * belongs over there, or it only ever runs on the laptop of whoever remembered.
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
 *
 * AND IT STAYS PLAIN JS, deliberately. `node controllers/literatureSearch.check.js` runs with no
 * build step, no ts-node, no transpile of its own — the only compile in the whole harness is the
 * one it performs on the modules UNDER TEST. Rewritten in TypeScript, the safety net would need the
 * toolchain to be working before it could tell you the toolchain had broken, and the first thing
 * anyone does with a check that will not start is stop running it.
 *
 * THIS FILE IS THE ENTRY POINT AND THE RUNNING ORDER; the assertions live in the siblings named
 * below, the fixtures in .fixtures.js and the plumbing in .harness.js. The order is not cosmetic:
 * Mode 1 counts the fixture and hands the yield to Mode 2, the row counts are what the exports
 * appendix is checked against, and the Embase run is asserted in the dialects part and exported in
 * the exports part.
 */
const {
    cleanOutDir, compileLiterature, loadEnvLocal, requireCompiled,
} = require('./literatureSearch.check.harness')
const mode1 = require('./literatureSearch.check.mode1')
const mode2 = require('./literatureSearch.check.mode2')
const mode3 = require('./literatureSearch.check.mode3')
const rowCounts = require('./literatureSearch.check.rowCounts')
const dialects = require('./literatureSearch.check.dialects')
const exportsCheck = require('./literatureSearch.check.exports')

cleanOutDir()
loadEnvLocal()
compileLiterature([
    'controllers/literatureSearch.controller.ts',
    'controllers/literatureExport.ts',
    'controllers/literatureDocx.ts',
])
const lit = requireCompiled('controllers/literatureSearch.controller.js')

;(async () => {
    const { q, hits } = await mode1.run(lit)
    await mode2.run(lit, { hits })
    await mode3.run(lit)
    const { rc, rowsResult } = await rowCounts.run(lit)
    // Embase (Ovid) is asserted in two halves: the pure/dialect facts where the dialects are checked, and
    // the EXPORT in the exports section, where the renderers are loaded. This carries the run between them.
    const { embaseRun } = await dialects.run(lit)
    await exportsCheck.run({ q, rc, rowsResult, embaseRun })

    cleanOutDir()
    console.log('\nOK - Mode 1 (assembleQuery, numberStrategy, the empty-concept rule, the derived miss-diagnosis)'
        + '\n     Mode 2 (the design derivation, the structured-abstract join, the 50-cap, count-before-fetch,'
        + '\n             the three bands, the priced narrowings, and the escape hatch)'
        + '\n     Mode 3 (the tier order incl. the SR-below-RCT inversion, the guideline tier against a real'
        + '\n             PubMed record, the stable sort, the evidence floor, and PICO)')
})().catch(e => {
    cleanOutDir()
    console.error('\nFAILED:', e.message)
    process.exit(1)
})
