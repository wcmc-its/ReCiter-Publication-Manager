/*
 * The check that CI can actually run — and therefore the only one that is a merge gate.
 *
 *   npm run check:literature:pure
 *
 * NO NETWORK. NO LLM. NO .env.local. NO PubMed tool. It compiles three pure modules and does
 * arithmetic over them, so it runs identically on a bare GitHub-hosted runner with zero secrets and
 * zero repository variables. That is the entire design constraint, and everything else follows.
 *
 * WHY THIS FILE EXISTS BESIDE literatureSearch.check.js, RATHER THAN INSIDE IT.
 *
 * The other check is an INTEGRATION check on purpose — it drives the live PubMed Retrieval Tool on
 * :8083 and live iCite, because a mocked PubMed would have passed while the abstract path was broken.
 * That is the right call and it must not change. But it has two properties that make it unusable as a
 * gate on a pull request:
 *
 *   - A GitHub-hosted runner cannot reach the retrieval tool, so the check cannot run there at all.
 *   - It is FLAKY AGAINST LIVE NCBI — measured at 2 red in 6 consecutive runs on unchanged logic.
 *     A gate that fails twice in six for reasons no commit caused is a gate people learn to re-run
 *     until it is green, which is worse than no gate.
 *
 * So CI ran `tsc` and `next build` and nothing else: it proved the repo COMPILED and asserted nothing
 * about the feature. A green tick over an untested feature is precisely the failure this feature
 * exists to prevent — something that looks considered and checked nothing.
 *
 * WHAT BELONGS IN HERE: any property that is TRUE BY ARITHMETIC. Every assertion below guards a bug
 * that has ALREADY SHIPPED ONCE — a wrong number in front of a librarian, or a document that left the
 * building missing a warning. What does NOT belong: anything that needs a count, a record, or a model.
 * Those stay next door, where they are honest about needing the world.
 */
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
// Compile INSIDE the worktree, for the same reason the other check does: the controller imports
// @aws-sdk/client-bedrock-runtime at module scope, and node resolves node_modules by walking UP from
// the required file — from os.tmpdir() it never reaches the repo. (Nothing here CALLS Bedrock; the
// import just has to resolve.) A subdirectory of the already-gitignored .litcheck/, so this adds no
// new ignore rule and cannot collide with the live check's output.
const OUT = path.join(ROOT, '.litcheck', 'pure')
fs.rmSync(OUT, { recursive: true, force: true })

// THIS CHECK NEVER READS .env.local, AND THAT IS AN ASSERTION IN ITSELF. The moment it needs a
// variable, it stops being runnable on the runner that has none — which is the only runner a pull
// request gets.
execSync(
    `npx tsc controllers/literatureSearch.controller.ts controllers/literatureExport.ts ` +
    `controllers/literatureMarkdown.ts --outDir ${OUT} ` +
    `--module commonjs --target es2020 --esModuleInterop --skipLibCheck --allowJs`,
    { cwd: ROOT, stdio: 'inherit' },
)
const lit = require(path.join(OUT, 'controllers/literatureSearch.controller.js'))
const xp = require(path.join(OUT, 'controllers/literatureExport.js'))
const md = require(path.join(OUT, 'controllers/literatureMarkdown.js'))

// The same shape the model is prompted to emit, and the same one the live check uses: PRESS-style,
// each concept split into its MeSH line and its free-text line, limits held separately.
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

const s = strategy()
const q = lit.assembleQuery(s)

// =======================================================================================
// THE MODEL'S OWN OUTPUT IS HELD TO THE SAME CEILINGS AS THE BROWSER'S.
//
// The route has always bounded what the BROWSER posts back. buildStrategy() bounded nothing, so the
// server would happily build, count and render a strategy it then REFUSED to re-count — a 502 on
// every subsequent toggle, on the rows phase and on Mode 2's escape hatch, against a strategy the
// librarian had already been billed for. The paid-for strategy became read-only.
//
// checkStrategy() is exported for exactly this: it is the half of buildStrategy() that is true
// without an LLM. The comment above it said so and NOTHING EVER ASSERTED IT — so the ceilings could
// be raised, lowered or deleted in silence. They cannot now.

assert.doesNotThrow(() => lit.checkStrategy(s), 'a strategy the route would accept must not be rejected')

const conceptBlock = i => ({ label: `c${i}`, lines: [{ terms: `t${i}[tiab]`, on: true }] })
assert.throws(
    () => lit.checkStrategy({ ...s, concepts: Array.from({ length: lit.MAX_CONCEPTS + 1 }, (_, i) => conceptBlock(i)) }),
    /concept blocks/,
    `${lit.MAX_CONCEPTS + 1} concept blocks is one more than the route can re-count, so it must be REJECTED, not built`,
)
assert.throws(
    () => lit.checkStrategy({
        ...s,
        concepts: [{ label: 'too many lines', lines: Array.from({ length: lit.MAX_LINES + 1 }, (_, i) => ({ terms: `t${i}[tiab]`, on: true })) }],
    }),
    /lines in one concept block/,
    `${lit.MAX_LINES + 1} lines in one block is one more than the route can re-count`,
)
assert.throws(
    () => lit.checkStrategy({
        ...s,
        concepts: [{ label: 'too long', lines: [{ terms: 'x'.repeat(lit.MAX_TERMS + 1), on: true }] }],
    }),
    /too long to be re-counted/,
    'a term line longer than the route accepts must be rejected here too — and NEVER truncated: clipping a line mid-Boolean changes what the search MEANS',
)

// THE EMPTINESS GUARD, AND WHERE IT HAS TO LIVE.
//
// It used to fire on the RAW model answer, ten lines before the `.filter(c => c.lines.length)` that
// can empty it. A model returning `lines: []` therefore produced a strategy with ZERO concepts, which
// is not an error anywhere downstream: assembleQuery() renders it as '' and runStrategy() reports it
// as `hits: 0`. A confident zero, for a search that does not exist, printed beside a PRESS appendix.
//
// So the guard belongs in checkStrategy(), which buildStrategy() calls LAST — after the filter and
// after hoistFilters. Both halves are asserted: the empty strategy really does render as '' (which is
// why it must never reach a count), and checkStrategy really does refuse it.
const modelReturnedNoLines = { db: 'pubmed', limits: s.limits, concepts: [{ label: 'Adults', lines: [] }, { label: 'Depression', lines: [] }] }
const filtered = { ...modelReturnedNoLines, concepts: modelReturnedNoLines.concepts.filter(c => c.lines.length) }
assert.strictEqual(lit.assembleQuery(filtered), '', 'a zero-concept strategy renders as the empty query — the string that would be counted as hits: 0')
assert.throws(() => lit.checkStrategy(filtered), /usable strategy/,
    'a model answer whose concepts all have lines: [] must be REFUSED, not counted as zero')
console.log(`bounds:       checkStrategy rejects >${lit.MAX_CONCEPTS} concepts, >${lit.MAX_LINES} lines, >${lit.MAX_TERMS}-char terms, and the zero-concept strategy`)

// =======================================================================================
// THE RECORDS COLUMN OF THE PRESS APPENDIX — the counts, printed, each on its own line.
//
// A LINE NUMBER DOES NOT NAME A STABLE QUERY. The numbering is DERIVED from the current selection and
// RENUMBERS as the librarian toggles, so `rowCounts` — a map keyed by line number — is only ever valid
// against the numbering it was computed with. That is not hypothetical: a map that renumbered
// underneath its own keys is the P0 this feature has already had once, and it is invisible, because
// every cell still holds a plausible number.
//
// So "a number printed" is NOT the property worth asserting. "Each count landed on ITS OWN line" is.
// The counts below are synthetic and DISTINCT on purpose: with distinct values, a map shifted by one
// line cannot agree with the table by accident — and the shifted case is asserted too, because an
// assertion that cannot fail is not an assertion.
const numbered = lit.numberStrategy(s)
const lines = numbered.rows.filter(r => r.n !== null)
const lastN = lines[lines.length - 1].n
const rc = {}
for (const r of lines) rc[r.n] = 100000 - r.n * 777      // distinct, and >999 so toLocaleString commas are exercised

// The last line IS the whole search, so its count IS the yield printed in the header above it. If
// those two ever disagree, one of the numbers in the appendix is describing a query we did not run.
const hits = rc[lastN]

const recordsOf = counts => {
    const doc = xp.strategyDoc(
        { ...s, query: q, hits, runDate: '2026-07-13', seeds: [], rowCounts: counts },
        'Do probiotics help depression?', 'paa2013', 'us.anthropic.claude-opus-4-8',
    )
    const t = doc.find(b => b.kind === 'table' && b.head[2] === 'Records')
    assert.ok(t, 'the strategy appendix must carry a Records column')
    return t.rows
}

const printed = recordsOf(rc)
assert.strictEqual(printed.length, lines.length,
    'every searched line reaches the appendix — a line the librarian ran and cannot see the yield of is half an appendix')
for (const [n, , records] of printed) {
    assert.strictEqual(records, rc[Number(n)].toLocaleString(),
        `line ${n} must print ITS OWN count (${rc[Number(n)]}), not some other line's`)
}
assert.strictEqual(printed[printed.length - 1][2], hits.toLocaleString(),
    'the last line of the appendix IS the search: its count must equal the yield in the header above it')

// THE TEETH. Hand the exporter a map shifted by one line — exactly what a renumbering bug produces —
// and the loop above must reject it. If this ever stops finding a mismatch, the assertion above has
// gone blind and the appendix can print every count one line out of place and stay green.
const shifted = {}
for (const r of lines) shifted[r.n] = rc[r.n + 1] !== undefined ? rc[r.n + 1] : rc[lines[0].n]
const wrong = recordsOf(shifted).filter(([n, , records]) => records !== rc[Number(n)].toLocaleString())
assert.ok(wrong.length > 0,
    'a rowCounts map shifted by one line MUST fail the per-line assertion above — otherwise that assertion proves nothing')

// An UNTICKED line has no number, so it must carry no count. A count beside a line that was not
// searched is the same class of lie as a methods block describing an un-toggled strategy.
const unticked = { ...s, concepts: s.concepts.map((c, i) => (i === 1 ? { ...c, lines: c.lines.map(l => ({ ...l, on: false })) } : c)) }
const untickedRows = lit.numberStrategy(unticked).rows.filter(r => r.kind === 'term' && r.n === null)
assert.ok(untickedRows.length > 0, 'unticking a concept leaves unnumbered rows')
const blanks = recordsOf({}).filter(([, , records]) => records !== '')
assert.strictEqual(blanks.length, 0, 'no counts means BLANK cells — never a 0. An absent count is absent, not zero.')
console.log(`records col:  ${printed.length} lines, each carrying its own count; a shifted map fails (${wrong.length} cells); last line == yield (${hits.toLocaleString()})`)

// =======================================================================================
// THE DOCUMENTS — asserted through the MARKDOWN renderer, because that is the copy people forward.
//
// The clipboard synthesis used to be a hand-built string in the component, assembled independently of
// the .docx, and it had drifted exactly as far as you would expect: no query, no database, no yield,
// no search date — and it dropped `invented`, the fabricated-citation warning we detect, render on
// screen and stamp into the .docx. The MOST-FORWARDED artifact was the only one with no provenance
// and no warning on it.
//
// It renders the same Block[] now, so it cannot drift again — and this is the assertion that makes
// that true, because until it existed literatureMarkdown.ts was not compiled by anything.

const facts = {
    db: 'pubmed',
    query: q,
    hits: 1391,
    retrieved: 50,
    runDate: '2026-07-13',
    cwid: 'paa2013',
    sort: 'relevance',
    model: 'us.anthropic.claude-opus-4-8',
}
const synthesis = md.markdownDoc(xp.synthesisDoc(
    {
        table: [{ pmid: '37314797', study: 'Nikolova', year: '2023', journal: 'JAMA Psychiatry', design: 'Meta-Analysis', intervention: 'probiotics' }],
        prose: 'Probiotics reduced depressive symptoms (PMID 37314797). This is not established for severe depression (PMID 99999999).',
        invented: ['99999999'],
    },
    facts,
    'Do probiotics help depression?',
    { pico: false, screenedIn: 12, screenedOf: 50 },
))

// THE WARNING TRAVELS WITH THE TEXT, OR THE FILE IS THE CLEAN-LOOKING COPY OF A CONTAMINATED SUMMARY.
assert.ok(/WARNING/.test(synthesis), 'the fabricated-citation warning must appear in the markdown, not only on screen')
assert.ok(synthesis.includes('99999999'), 'the warning must NAME the invented PMID — "some citations may be wrong" is not actionable')
assert.ok(synthesis.indexOf('WARNING') < synthesis.indexOf('## Synthesis'),
    'the warning goes ABOVE the prose: a reader who scrolls past it has already read the contaminated sentence')

// The four facts that make a search reproducible, and the reason literatureExport.ts exists at all.
assert.ok(synthesis.includes('PubMed (via NCBI E-utilities)'), 'the markdown must name the DATABASE — a Scopus strategy pasted into PubMed reproduces nothing')
assert.ok(synthesis.includes('2026-07-13'), 'the markdown must carry the date searched')
assert.ok(synthesis.includes('1391'), 'the markdown must carry the yield')
assert.ok(synthesis.includes('50 — the top 50 of 1391'), 'the markdown must say the 50 is a SLICE of the yield, or a co-author writes 1,391 into a PRISMA flow diagram')
// The query is fenced, and that is load-bearing: a Boolean is made of the characters Markdown treats
// as syntax ([MeSH], *, "..."), so outside a fence what the librarian pastes back into PubMed is no
// longer the query that produced the count above it.
assert.ok(synthesis.includes('```\n' + q + '\n```'), 'the query must survive into the markdown VERBATIM, inside a fence')
assert.ok(/AI-ASSISTED[\s\S]*us\.anthropic\.claude-opus-4-8/.test(synthesis), 'the synthesis must name the model AND its profile id — "AI-assisted" with no version is not a declaration')

// THE PRISMA-S METHODS BLOCK, asserted on the SHARED RENDERER.
//
// At the time of writing, "Copy PRISMA-S" in LiteratureSearch.tsx still hand-builds its own string and
// is being rebuilt onto Block[]. So what is asserted here is the renderer it is moving to — the same
// strategyDoc() the .docx uses — which is the only place the AI-drafted disclosure can come from. The
// moment the button renders blocks, this assertion covers the button; until then it holds the document
// the button is converging on, and the hand-built string in the component is asserted by nothing.
const methods = md.markdownDoc(xp.strategyDoc(
    { ...s, query: q, hits, runDate: '2026-07-13', seeds: [], rowCounts: rc },
    'Do probiotics help depression?', 'paa2013', 'us.anthropic.claude-opus-4-8',
))
assert.ok(/Strategy drafted by[\s\S]*us\.anthropic\.claude-opus-4-8/.test(methods),
    'a PRISMA-S appendix that does not disclose the strategy was AI-drafted and human-reviewed is incomplete — and the QUERY is model-drafted, not just the prose')
assert.ok(methods.includes('reviewed and edited by'), 'the disclosure must name the human review, which is the half that makes it publishable')
assert.ok(methods.includes(hits.toLocaleString()), 'the per-line counts must survive the markdown renderer — the Records column is how a PRESS reviewer reads a strategy')
console.log(`documents:    synthesis markdown carries the invented-PMID warning, the query, the database, the yield and the date; the appendix discloses the model`)

// THE .XLSX MUST NOT CARRY AN AI VERDICT OVER A TRUNCATED SAMPLE.
//
// This is the one assertion in this file that exists because of a MEASUREMENT rather than a code
// reading. docs/RECALL-STUDY.md: the strategy retrieved 72 of 73 known-included studies (99%), and the
// top-50 relevance cut then showed the model ONE of them (1%). So an "AI suggested / Include / Exclude"
// column on a truncated sheet describes a population that is nearly disjoint from the eligible one —
// and this is the file that opens in COVIDENCE, where it is treated as a screening pass.
//
// Guard both directions. A refusal that also fires on a COMPLETE sheet would delete a verdict the model
// really did give over every record it was asked about, which is a different bug with the same shape.
const recs = [{ pmid: '1', title: 't', authors: 'a', year: '2020', journal: 'j', design: 'RCT' }]
const flags = { 1: { include: true, reason: 'an RCT in the right population', screened: true } }
const xlFacts = f => ({ db: 'pubmed', query: q, runDate: '2026-07-13', model: 'us.anthropic.claude-opus-4-8', ...f })

const cutSheets = xp.recordSheets(recs, flags, {}, xlFacts({ hits: 1391, retrieved: 50 }))
assert.ok(!cutSheets[0].head.includes('AI suggested'),
    'a TRUNCATED sheet must not carry an AI verdict column — the top 50 by relevance holds ~1% of the eligible studies (docs/RECALL-STUDY.md)')
assert.ok(!cutSheets[0].head.includes('AI reason'), 'the reason column goes with the verdict it explains')
assert.strictEqual(cutSheets[0].head.length, cutSheets[0].rows[0].length,
    'dropping the columns must drop the CELLS — a head and a row of different lengths silently shifts every value into the wrong column')
const searchSheet = JSON.stringify(cutSheets[1].rows)
assert.ok(/NOT INCLUDED — this is not a screen/.test(searchSheet),
    'the sheet must say IN THE FILE why there is no verdict — Covidence opens it, and that reader never saw our UI')
assert.ok(!/AI suggestions by/.test(searchSheet), 'the sheet must not advertise an AI verdict it does not carry')

const wholeSheets = xp.recordSheets(recs, flags, {}, xlFacts({ hits: 1, retrieved: 1 }))
assert.ok(wholeSheets[0].head.includes('AI suggested'),
    'a COMPLETE sheet keeps its verdict column — the model screened every record there was, and that verdict is real')
assert.ok(JSON.stringify(wholeSheets[0].rows).includes('Include'), 'and the verdict itself survives')
console.log(`exports:      the .xlsx REFUSES its AI verdict column when the sample is truncated, and keeps it when it is not`)

console.log('\nAll pure checks passed. No network, no model, no environment.')
