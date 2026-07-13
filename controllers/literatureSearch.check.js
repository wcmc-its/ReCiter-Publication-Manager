/*
 * Runnable check for the non-trivial logic in literatureSearch.controller.ts:
 * assembleQuery, countPubmed, and the DERIVED failing-concept diagnosis in validateSeeds.
 *
 *   npm run check:literature
 *
 * This is an INTEGRATION check on purpose: it drives the live ReCiter PubMed Retrieval
 * Tool, because the thing worth protecting is that our counts and our seed logic agree
 * with real PubMed. A mocked version would pass while the feature was broken.
 *
 * Needs .env.local (for RECITER_PUBMED_API_URL / RECITER_API_BASE_URL). Needs no
 * ANTHROPIC_API_KEY — everything here is downstream of the model, which is the point:
 * Mode 1's verifiable half does not depend on the LLM.
 *
 * NOTE ON ASSERTIONS: we deliberately do NOT assert an exact yield. PubMed indexes new
 * papers, so the count drifts; asserting `hits === 122` would rot within weeks. The seed
 * behaviour, by contrast, is stable — these are four fixed historical papers.
 */
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
// Compile INSIDE the worktree, not os.tmpdir(). The controller now imports
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

// A strategy shaped exactly as the model is prompted to emit one: fully-tagged concept
// blocks, limits held separately. Fully-tagged is load-bearing — PubMed's automatic term
// mapping rewrites untagged terms, which would make the count irreproducible.
const strategy = {
    db: 'pubmed',
    concepts: [
        { label: 'Probiotics / microbiome', terms: '"Gastrointestinal Microbiome"[MeSH] OR "Probiotics"[MeSH] OR probiotic*[tiab]' },
        { label: 'Depression', terms: '"Depression"[MeSH] OR "Depressive Disorder"[MeSH] OR depress*[tiab]' },
    ],
    limits: '(2021:2026[dp]) AND (Randomized Controlled Trial[pt])',
}

;(async () => {
    const q = lit.assembleQuery(strategy)
    assert.ok(q.includes('AND'), 'concepts are AND-ed')
    assert.ok(q.endsWith(strategy.limits), 'limits are appended, not folded into a concept')

    const hits = await lit.countPubmed(q)
    assert.ok(Number.isFinite(hits) && hits > 0, `expected a positive yield, got ${hits}`)
    console.log(`yield: ${hits}`)

    const seeds = await lit.validateSeeds(strategy, [
        '37314797', // Nikolova 2023  JAMA Psychiatry    -> in the set
        '35654766', // Schaub   2022  Transl Psychiatry  -> in the set
        '34875345', // Tian     2022  Brain Behav Immun  -> in the set
        '27793434', // Sarkar   2016  Trends Neurosci    -> MISS
    ])

    for (const s of seeds) {
        const why = s.retrieved ? '' : (s.failsLimitsOnly ? '  <- LIMITS' : `  <- fails: ${s.failingConcepts.join(', ')}`)
        console.log(`  ${s.retrieved ? 'HIT ' : 'MISS'}  PMID ${s.pmid}${why}`)
    }

    assert.strictEqual(seeds.filter(s => s.retrieved).length, 3, 'three seeds must be retrieved')

    // The load-bearing assertion. Sarkar 2016 CLEARS the probiotics block (it is
    // MeSH-indexed under Probiotics) but FAILS the depression block: PubMed indexes it
    // under Emotions, and its abstract never says "depression". A model asked to guess
    // the reason would most likely have blamed the 2021-2026 date range -- and been
    // wrong. Deriving the reason rather than guessing it is what makes the miss
    // trustworthy, so it is what this check defends.
    const miss = seeds.find(s => s.pmid === '27793434')
    assert.ok(miss && !miss.retrieved, 'Sarkar 2016 must miss this strategy')
    assert.deepStrictEqual(miss.failingConcepts, ['Depression'], 'miss must be attributed to the Depression block')
    assert.strictEqual(miss.failsLimitsOnly, false, 'this is not a limits-only miss')

    fs.rmSync(OUT, { recursive: true, force: true })
    console.log('\nOK - assembleQuery, countPubmed, and the derived miss-diagnosis all pass')
})().catch(e => {
    fs.rmSync(OUT, { recursive: true, force: true })
    console.error('\nFAILED:', e.message)
    process.exit(1)
})
