/*
 * Runnable check for the non-trivial logic behind Literature Search Mode 1:
 * assembleQuery, numberStrategy, countPubmed, and the DERIVED failing-block diagnosis.
 *
 *   npm run check:literature
 *
 * This is an INTEGRATION check on purpose: it drives the live ReCiter PubMed Retrieval
 * Tool, because the thing worth protecting is that our counts and our seed logic agree
 * with real PubMed. A mocked version would pass while the feature was broken.
 *
 * Needs .env.local (for RECITER_PUBMED_API_URL / RECITER_API_BASE_URL). Needs no
 * BEDROCK_MODEL_ID — everything here is downstream of the model, which is the point:
 * Mode 1's verifiable half does not depend on the LLM, and neither does a librarian
 * iterating the strategy.
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

    fs.rmSync(OUT, { recursive: true, force: true })
    console.log('\nOK - assembleQuery, numberStrategy, the empty-concept rule, and the derived miss-diagnosis all pass')
})().catch(e => {
    fs.rmSync(OUT, { recursive: true, force: true })
    console.error('\nFAILED:', e.message)
    process.exit(1)
})
