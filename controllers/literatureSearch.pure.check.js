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
 * So CI ran `tsc` and `next build` and nothing else — a green tick that proved the repo COMPILED and
 * asserted nothing about the feature. That is precisely the failure this feature exists to prevent:
 * something that looks considered and checked nothing.
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

// =======================================================================================
// THE MODEL'S OWN OUTPUT IS HELD TO THE SAME CEILINGS AS THE BROWSER'S.
//
// The route has always bounded what the BROWSER posts back. buildStrategy() bounded nothing, so the
// server would happily build, count and render a strategy it then REFUSED to re-count: a 502 on every
// subsequent toggle, on the rows phase and on Mode 2's escape hatch, leaving the strategy the
// librarian had just been billed for read-only.
//
// checkStrategy() is exported for exactly this: it is the half of buildStrategy() that is true
// without an LLM. The comment above it said so and NOTHING EVER ASSERTED IT — so the ceilings could
// be raised, lowered or deleted in silence. They cannot now.
//
// THE EMPTINESS GUARD, AND WHERE IT HAS TO LIVE.
//
// It used to fire on the RAW model answer, ten lines before the `.filter(c => c.lines.length)` that
// can empty it. A model returning `lines: []` therefore produced a strategy with ZERO concepts, which
// is not an error anywhere downstream: assembleQuery() renders it as '' and runStrategy() reports it
// as `hits: 0`. A confident zero, for a search that does not exist, printed beside a PRESS appendix.
//
// So the guard belongs in checkStrategy(), which buildStrategy() calls LAST — after the filter and
// after hoistFilters. Both halves are asserted: the empty strategy really does render as '', and
// checkStrategy really does refuse it.
const checkStrategyBounds = (lit) => {
    const s = strategy()
    const q = lit.assembleQuery(s)

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
    console.log(`bounds:       checkStrategy rejects >${lit.MAX_CONCEPTS} concepts, >${lit.MAX_LINES} lines, >${lit.MAX_TERMS}-char terms, and the zero-concept strategy`)

    const modelReturnedNoLines = { db: 'pubmed', limits: s.limits, concepts: [{ label: 'Adults', lines: [] }, { label: 'Depression', lines: [] }] }
    const filtered = { ...modelReturnedNoLines, concepts: modelReturnedNoLines.concepts.filter(c => c.lines.length) }
    assert.strictEqual(lit.assembleQuery(filtered), '', 'a zero-concept strategy renders as the empty query — the string that would be counted as hits: 0')
    assert.throws(() => lit.checkStrategy(filtered), /usable strategy/,
        'a model answer whose concepts all have lines: [] must be REFUSED, not counted as zero')

    return { s, q }
}

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
// line cannot agree with the table by accident. (THE TEETH, below, asserts the shifted case.)
const checkRecordsColumnRendering = (lit, xp, s, q) => {
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

    return { hits, rc }
}

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
const checkMarkdownDocuments = (xp, md, s, q, hits, rc) => {
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
    // strategyDoc() the .docx uses, and the only place the AI-drafted disclosure can come from. The moment
    // the button renders blocks this assertion covers the button; until then the hand-built string in the
    // component is asserted by nothing.
    const methods = md.markdownDoc(xp.strategyDoc(
        { ...s, query: q, hits, runDate: '2026-07-13', seeds: [], rowCounts: rc },
        'Do probiotics help depression?', 'paa2013', 'us.anthropic.claude-opus-4-8',
    ))
    assert.ok(/Strategy drafted by[\s\S]*us\.anthropic\.claude-opus-4-8/.test(methods),
        'a PRISMA-S appendix that does not disclose the strategy was AI-drafted and human-reviewed is incomplete — and the QUERY is model-drafted, not just the prose')
    assert.ok(methods.includes('reviewed and edited by'), 'the disclosure must name the human review, which is the half that makes it publishable')
    assert.ok(methods.includes(hits.toLocaleString()), 'the per-line counts must survive the markdown renderer — the Records column is how a PRESS reviewer reads a strategy')
    console.log(`documents:    synthesis markdown carries the invented-PMID warning, the query, the database, the yield and the date; the appendix discloses the model`)
}

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
const checkXlsxTruncationGuard = (xp, q) => {
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
}

// =======================================================================================
// MODE 4, PHASES 2-3 — THE NARROWING LADDER: freeTextCandidates() and narrowForBudget(), both in
// literatureSearch.corpus.ts. freeTextCandidates() is fully pure. narrowForBudget() is async and
// takes its PubMed calls through an injected LadderDeps (count/checkSeeds) for exactly this
// reason — see that type's own comment — so this check supplies small fake deps, closing over
// plain conditionals instead of hitting the network, and asserts the ladder's actual LOGIC: it
// narrows when it safely can, and it NEVER disables a line a seed depends on.
const ladderConcept = (label, lines) => ({ label, lines })

// freeTextCandidates(): Concept A carries a MeSH line, a live [tiab] line, AND an OFF [tiab]
// line — so both guards get exercised (MeSH is never a candidate; an OFF line is never a
// candidate even though its terms match [tiab]). Concept B carries ONLY a [tiab] line, on, no
// MeSH — its sole live line must never be offered, because dropping it would empty Concept B's
// block entirely (assembleQuery() drops an empty concept out of the AND, which BROADENS the
// search — the opposite of narrowing it, and exactly the guard this function exists to enforce).
const twoConceptStrategy = () => ({
    db: 'pubmed',
    concepts: [
        ladderConcept('ConceptA', [
            { terms: '"Some MeSH Term"[MeSH]', on: true },
            { terms: 'freetextA[tiab]', on: true },
            { terms: 'offterm[tiab]', on: false },
        ]),
        ladderConcept('ConceptB', [
            { terms: 'freetextB[tiab]', on: true },
        ]),
    ],
    limits: '(2021:2026[dp])',
})

// A ONE-CANDIDATE fixture for narrowForBudget() below: a single concept with a MeSH line and
// exactly one droppable [tiab] line, so there is only ever one line the ladder could try — the
// two scenarios differ only in whether the fake checkSeeds allows dropping it.
const oneCandidateStrategy = () => ({
    db: 'pubmed',
    concepts: [
        ladderConcept('OnlyConcept', [
            { terms: '"Term"[MeSH]', on: true },
            { terms: 'droppable[tiab]', on: true },
        ]),
    ],
    limits: '(2021:2026[dp])',
})

const checkNarrowingLadder = async (lit) => {
    // --- freeTextCandidates() ---------------------------------------------------------------
    const twoConcept = twoConceptStrategy()
    const candidates = lit.freeTextCandidates(twoConcept)

    assert.strictEqual(candidates.length, 1,
        `exactly one line in this fixture is safe to drop — got ${candidates.length} (${JSON.stringify(candidates.map(c => c.line.terms))})`)
    assert.strictEqual(candidates[0].line.terms, 'freetextA[tiab]', "Concept A's live [tiab] line must be the one candidate offered")
    assert.ok(!candidates.some(c => /\[MeSH\]/.test(c.line.terms)), 'a MeSH line must never be offered as a droppable free-text candidate')
    assert.ok(!candidates.some(c => c.line.terms === 'offterm[tiab]'), 'an OFF line must never be offered, even though its terms match [tiab]')
    assert.ok(!candidates.some(c => c.line.terms === 'freetextB[tiab]'),
        "Concept B's sole live line must never be offered — dropping it would empty Concept B's block entirely, which is exactly the guard freeTextCandidates() exists to enforce")

    // --- narrowForBudget() ------------------------------------------------------------------
    const seeds = [{ id: 'seed-1', kind: 'pmid' }]
    const threshold = 1000
    const fromYear = 2021, toYear = 2026

    // Scenario (a): dropping the line shrinks the count (5000 -> 800: nonzero, and strictly less
    // than the pre-drop total — the exact arithmetic narrowForBudget() itself checks before it
    // will ever act on a count), and checkSeeds says the seed is STILL retrieved without the
    // line. The ladder must drop it.
    const acceptDeps = {
        count: async (query) => {
            if (query === 'droppable[tiab]') return 500          // the candidate's own yield (ranking only)
            if (query.includes('droppable[tiab]')) return 5000   // the span query, line still present
            return 800                                            // the span query, line dropped
        },
        checkSeeds: async (_s, seedsArg) => seedsArg.map(sd => ({ ...sd, retrieved: true })),
    }
    const accepted = await lit.narrowForBudget(oneCandidateStrategy(), seeds, fromYear, toYear, threshold, acceptDeps)

    assert.strictEqual(accepted.dropped.length, 1, 'the one droppable line must be dropped when it shrinks the count and no seed depends on it')
    assert.strictEqual(accepted.dropped[0].dropped, 'droppable[tiab]', 'the dropped step must name the actual line text that was turned off')
    const acceptedLine = accepted.strategy.concepts[0].lines.find(l => l.terms === 'droppable[tiab]')
    assert.strictEqual(acceptedLine.on, false,
        "the returned strategy must carry the dropped line's on: false — the ladder's decision must be visible in the strategy it hands back, not just in the dropped[] log")
    assert.strictEqual(accepted.count, 800, 'the returned count must be the post-drop count, not the pre-drop one')

    // Scenario (b): IDENTICAL count arithmetic (so a count-side rejection cannot explain the
    // difference), but checkSeeds now reports the seed is LOST once this specific line is
    // dropped — simulating "this seed depends on that line". This is the load-bearing assertion
    // PLAN-mode4-relevance-and-impact.md calls out by name: "the ladder never disables a line
    // while a seed depends on it."
    const rejectDeps = {
        count: acceptDeps.count,
        checkSeeds: async (candidateStrategy, seedsArg) => {
            const lineStillOn = candidateStrategy.concepts.some(c => c.lines.some(l => l.terms === 'droppable[tiab]' && l.on))
            return seedsArg.map(sd => ({ ...sd, retrieved: lineStillOn }))
        },
    }
    const rejected = await lit.narrowForBudget(oneCandidateStrategy(), seeds, fromYear, toYear, threshold, rejectDeps)

    assert.strictEqual(rejected.dropped.length, 0, 'a line a seed depends on must NEVER be dropped, even though the count arithmetic alone would have accepted it')
    assert.deepStrictEqual(rejected.strategy, oneCandidateStrategy(), 'when nothing is dropped, the returned strategy must be unchanged from the input')
    assert.strictEqual(rejected.count, 5000, 'when nothing is dropped, the returned count must be the ORIGINAL (pre-drop) count, never one the ladder considered and rejected')

    console.log(`ladder:       freeTextCandidates offers 1 of ${twoConcept.concepts.flatMap(c => c.lines).length} lines (MeSH/off/sole-live-line excluded); narrowForBudget drops when the count shrinks and the seed survives (dropped=1, count=800), refuses when the seed would be lost (dropped=${rejected.dropped.length}, count=${rejected.count})`)
}

// =======================================================================================
// MODE 4, PHASE 5 — clusterByMesh(). PURE, deterministic, NO LLM (labelClusters(), the one
// Bedrock call in literatureSearch.cluster.ts, is out of scope for this file by the same rule
// everything else here follows: it needs the world).
//
// A minimal PubRecord-shaped fixture — clusterByMesh() only ever reads .pmid and .mesh, so that
// is all a record needs here, the same minimalism checkXlsxTruncationGuard already uses for its
// own record fixtures.
const meshRec = (pmid, mesh) => ({ pmid, title: `Study ${pmid}`, mesh })

// THE STOPLIST TRAP THIS FIXTURE IS SHAPED AROUND. In real PubMed data "Humans" and "Adult" are
// the MOST common MeSH terms on the page, by a wide margin — every clinical paper about people
// carries them. So the fixture below puts "Humans" on ALL 20 records and "Adult" on 14 of them,
// deliberately making both terms MORE frequent than either real topic. If MESH_STOPLIST ever
// stopped being applied before the frequency count, "Humans" (freq 20) would out-rank both real
// seeds and swallow the entire corpus into one meaningless cluster — a bug that would look
// completely plausible on screen (a cluster IS formed, it just isn't about anything) and would
// never be caught by eyeballing a demo corpus too small for "Humans" to visibly dominate.
const checkClusterByMesh = (lit) => {
    const diabetes = Array.from({ length: 8 }, (_, i) =>
        meshRec(`d${i + 1}`, ['Diabetes Mellitus, Type 2', 'Humans', 'Adult']))
    const hypertension = Array.from({ length: 6 }, (_, i) =>
        meshRec(`h${i + 1}`, ['Hypertension', 'Humans', 'Adult']))
    // Stoplist-only: no real topic term at all, so these MUST fall through to 'uncategorized' —
    // there is no seed they could ever match.
    const adminOnly = [meshRec('u1', ['Humans', 'Female']), meshRec('u2', ['Humans', 'Female'])]
    // One-off real terms: each appears on exactly one record, so freq (1) never clears the
    // threshold (3 at this corpus size) and none of them may become its own cluster either —
    // a corpus is not obligated to have a topic for every paper in it.
    const rareTerms = ['Rare Condition A', 'Rare Condition B', 'Rare Condition C', 'Rare Condition D']
    const oneOffs = rareTerms.map((t, i) => meshRec(`r${i + 1}`, [t, 'Humans']))

    const records = [...diabetes, ...hypertension, ...adminOnly, ...oneOffs]   // 20 total

    const result = lit.clusterByMesh(records)
    const real = result.clusters.filter(c => !c.isUncategorized)
    const uncategorized = result.clusters.find(c => c.isUncategorized)

    assert.strictEqual(real.length, 2, 'exactly two real topics were built into this fixture (Diabetes, Hypertension) — a different count means the seed/threshold logic drifted')
    const diabetesCluster = real.find(c => c.meshTerms[0] === 'Diabetes Mellitus, Type 2')
    const hypertensionCluster = real.find(c => c.meshTerms[0] === 'Hypertension')
    assert.ok(diabetesCluster && hypertensionCluster, 'both real seed terms must each head their own cluster')
    assert.strictEqual(diabetesCluster.pmids.length, 8, 'the Diabetes cluster must claim exactly its 8 members, no more, no fewer')
    assert.strictEqual(hypertensionCluster.pmids.length, 6, 'the Hypertension cluster must claim exactly its 6 members')

    // THE STOPLIST ASSERTION ITSELF: neither real cluster's seed (meshTerms[0], set by
    // topMeshTerms()) is an administrative checktag — if MESH_STOPLIST filtering broke, "Humans"
    // (freq 20, the single most common raw term in this fixture) would out-rank both real seeds
    // and this assertion is what would catch it.
    for (const c of real) {
        assert.ok(!['Humans', 'Adult', 'Female'].includes(c.meshTerms[0]),
            `a cluster's seed term must never be an administrative checktag — got "${c.meshTerms[0]}" for cluster "${c.id}"`)
    }

    assert.ok(uncategorized, 'the stoplist-only and one-off records must land somewhere — an uncategorized bucket is required by this fixture')
    assert.strictEqual(uncategorized.pmids.length, 6, 'uncategorized must hold exactly the 2 stoplist-only + 4 one-off records this fixture built for it')

    // NOTHING THAT GOES IN MAY SILENTLY VANISH — the same invariant checkRecordsColumnRendering
    // and checkXlsxTruncationGuard already police, one layer down: every pmid handed to
    // clusterByMesh() must come back in EXACTLY ONE cluster's pmids — never dropped, never
    // counted twice across two clusters.
    const allOutputPmids = result.clusters.flatMap(c => c.pmids)
    assert.strictEqual(allOutputPmids.length, records.length,
        `every input record must appear exactly once across all clusters — got ${allOutputPmids.length} pmids total for ${records.length} input records (a mismatch means a record was dropped or double-counted)`)
    assert.deepStrictEqual([...allOutputPmids].sort(), records.map(r => r.pmid).sort(),
        'the SET of pmids across all clusters must equal the set of input pmids exactly — not just the same count')

    // DETERMINISM. Same input, same output, byte for byte — a librarian re-running the same
    // corpus (or the UI re-rendering after an unrelated state change) must never see the topic
    // clusters reshuffle underneath them.
    const again = lit.clusterByMesh(records)
    assert.deepStrictEqual(again, result, 'clusterByMesh() must be a pure function of its input — the same corpus must produce byte-identical clusters on a second call')

    console.log(`cluster:      ${real.length} real clusters (Diabetes=${diabetesCluster.pmids.length}, Hypertension=${hypertensionCluster.pmids.length}), uncategorized=${uncategorized.pmids.length}, no drops, no stoplist seed, deterministic`)
}

// =======================================================================================
// MODE 4, PHASE 6a — preFilterForScoring(). PURE, deterministic, NO LLM. Decides which records
// in each cluster are worth a Bedrock relevance-scoring call, under a caller-supplied budget.
//
// A minimal PubRecord-shaped fixture again: preFilterForScoring() (via rankForScoring()) only
// ever reads .pmid, .tier.rank, .nihPercentile and .year.
const scoreRec = (pmid, tierRank, opts = {}) => ({
    pmid,
    tier: { rank: tierRank, label: `tier${tierRank}`, phrase: `tier ${tierRank} phrase` },
    year: opts.year ?? '2020',
    ...(typeof opts.pct === 'number' ? { nihPercentile: opts.pct } : {}),
})

const checkPreFilterForScoring = (lit) => {
    // A big cluster (100 members) and a small one (4 members), plus a 4-member cluster built
    // specifically to test the missing-vs-zero-percentile ranking rule, plus an uncategorized
    // bucket (50 members) that must now ALSO get a share of the budget — see the assertion below.
    // budget=20 is chosen (not the 200 default) so every number below is small enough to
    // hand-verify by arithmetic, the same posture this whole file takes.
    const big = Array.from({ length: 100 }, (_, i) => scoreRec(`big-${i + 1}`, 5))
    const small = Array.from({ length: 4 }, (_, i) => scoreRec(`small-${i + 1}`, 5))
    const rankRecords = [
        scoreRec('rt-1', 5, { pct: 80 }),
        scoreRec('rt-2', 5, { pct: 50 }),
        scoreRec('rt-3', 5, { pct: 0 }),      // a REAL zero — scored by iCite, genuinely at the bottom
        scoreRec('rt-4', 5, {}),              // MISSING — never scored at all, could be excellent
    ]
    const uncat = Array.from({ length: 50 }, (_, i) => scoreRec(`uncat-${i + 1}`, 5))

    const clusters = [
        { id: 'big', label: 'Big', meshTerms: [], pmids: big.map(r => r.pmid) },
        { id: 'small', label: 'Small', meshTerms: [], pmids: small.map(r => r.pmid) },
        { id: 'ranktest', label: 'RankTest', meshTerms: [], pmids: rankRecords.map(r => r.pmid) },
        { id: 'uncat', label: 'Uncategorized', meshTerms: [], pmids: uncat.map(r => r.pmid), isUncategorized: true },
    ]
    const byPmid = new Map([...big, ...small, ...rankRecords, ...uncat].map(r => [r.pmid, r]))

    const budget = 20
    const result = lit.preFilterForScoring(clusters, byPmid, budget)

    // THE UNCATEGORIZED CLUSTER NOW GETS BUDGET TOO — REVERSED FROM THIS FUNCTION'S ORIGINAL
    // DESIGN, which special-cased isUncategorized out entirely. PLAN-mode4-relevance-and-impact.md:
    // "the shortlist should be drawn from the whole corpus" — a genuinely on-topic paper that
    // happened to land in the fallthrough bucket (no seed MeSH term claimed it) must still be
    // eligible for a relevance/impact call, so it gets the same SCORE_FLOOR every real cluster does.
    assert.ok(result.uncat && result.uncat.length >= lit.SCORE_FLOOR,
        `the uncategorized cluster must now receive at least its floor of ${lit.SCORE_FLOOR} scoring slots, like any other cluster — got ${result.uncat ? result.uncat.length : 'undefined'}`)

    // THE FLOOR IS RESPECTED FOR A SMALL CLUSTER. At this budget, a purely proportional split
    // (4 members out of 158 total real-cluster members, now that uncategorized counts too) would
    // round DOWN TO ZERO for "small" — it is the floor, not the proportional share, that
    // guarantees it SCORE_FLOOR records rather than none at all.
    assert.strictEqual(result.small.length, lit.SCORE_FLOOR,
        `a 4-record cluster must still get its floor of ${lit.SCORE_FLOOR} records scored even though its proportional share of a ${budget}-record budget rounds to zero — a small cluster must never be zeroed out by a big one's share`)

    // THE TOTAL SELECTED NEVER EXCEEDS THE BUDGET — across every real cluster, not per-cluster.
    const total = Object.values(result).reduce((a, arr) => a + arr.length, 0)
    assert.ok(total <= budget, `preFilterForScoring must never hand back more records than the ${budget}-record budget it was given — got ${total}`)
    // The exact arithmetic this fixture now works out to, with FOUR clusters sharing the floor
    // (big/small/ranktest/uncat) instead of three: floors 3+3+3+3=12, then the remaining budget
    // (20-12=8) split proportionally by member count across all four (100:4:4:50, total 158):
    //   big:      floor(8 * 100/158) = 5  ->  3+5 = 8
    //   small:    floor(8 *   4/158) = 0  ->  3+0 = 3
    //   ranktest: floor(8 *   4/158) = 0  ->  3+0 = 3
    //   uncat:    floor(8 *  50/158) = 2  ->  3+2 = 5
    // total = 8+3+3+5 = 19. An exact check, not just an upper bound, so a change to the allocation
    // formula that stays under budget but silently shortchanges every cluster still gets caught.
    assert.strictEqual(total, 19,
        `expected exactly 19 records selected for this fixture's floors-then-proportional-share arithmetic (now over FOUR clusters, including uncategorized), got ${total} — the allocation formula changed`)

    // A RECORD WITH nihPercentile: 0 MUST NOT BE CONFUSED WITH A RECORD THAT HAS NO PERCENTILE
    // AT ALL. Same tier, same year — the only difference is 0 (real, scored, genuinely at the
    // bottom of its field) versus missing (never scored, could be anything). With a floor of 3
    // out of 4 candidates, exactly one gets cut — and it must be the missing one, never the real
    // zero, because coercing "missing" into looking like a real 0 would let an unscored record
    // silently outrank (or wrongly tie with) one iCite actually looked at.
    const rankedSelection = result.ranktest.map(r => r.pmid)
    assert.ok(rankedSelection.includes('rt-3'), 'a record with a REAL nihPercentile: 0 must be kept over a same-tier record with no percentile at all — 0 is scored data, missing is not')
    assert.ok(!rankedSelection.includes('rt-4'), 'the record with a missing nihPercentile must be the one cut when the cluster exceeds its floor, never a record with a real (even if low) percentile in its place')

    console.log(`prefilter:    small cluster floor=${result.small.length}, uncategorized floor=${result.uncat.length}, total selected=${total}/${budget}, real-0 kept over missing-percentile`)

    // Handed to checkPreFilterForScoringSeeds() so its "seed-forcing changes nothing with no
    // seeds" assertion reuses this EXACT fixture and its hand-worked total, rather than a second,
    // possibly-drifted copy of the same arithmetic.
    return { clusters, byPmid, budget, total }
}

// =======================================================================================
// MODE 4, PHASE 6a — preFilterForScoring()'s SEED-FORCING. PLAN-mode4-relevance-and-impact.md:
// "the librarian gets to see what the tool thinks of the papers they already trust, which is the
// fastest way to calibrate trust in the rest." Split out from checkPreFilterForScoring above
// because it needs its own purpose-built fixture: one where the ordinary floor+share ranking
// would NEVER pick the seed on its own, so forcing it in is the only way it can appear.
const checkPreFilterForScoringSeeds = (lit, mainFixture) => {
    // A single cluster of 10 members. Nine of them beat the tenth on EVERY criterion
    // rankForScoring() sorts by (tier rank ascending, then nihPercentile descending, missing
    // sorting last): tier 3 with real percentiles 90 down to 10. The tenth — the seed — is built
    // to lose on both axes at once: tier 8 (worse than every other member's tier 3) AND no
    // percentile at all (sorts below even a real 0). rankForScoring() must therefore place it
    // dead last, at index 9 of 10.
    const ranked = Array.from({ length: 9 }, (_, i) => scoreRec(`hi-${i + 1}`, 3, { pct: 90 - i * 10 }))
    const seedRec = scoreRec('seed-lowest', 8, {})
    const members = [...ranked, seedRec]
    const clusters = [{ id: 'seedtest', label: 'SeedTest', meshTerms: [], pmids: members.map(r => r.pmid) }]
    const byPmid = new Map(members.map(r => [r.pmid, r]))

    // budget == SCORE_FLOOR, and this is the only cluster, so the floor consumes the entire
    // budget (remaining = 0) — the ordinary slice is exactly rankForScoring()'s top 3, and the
    // seed, sorted last, cannot be among them. Asserted first as a sanity check on the fixture
    // itself: if this ever fails, the fixture is not testing what it claims to.
    const budget = lit.SCORE_FLOOR
    const withoutSeed = lit.preFilterForScoring(clusters, byPmid, budget)
    assert.ok(!withoutSeed.seedtest.some(r => r.pmid === 'seed-lowest'),
        'fixture sanity check: WITHOUT seed-forcing, the ordinary floor+share ranking must NOT have picked the worst-ranked seed record')

    // THE SEED-FORCING ITSELF: same clusters, same budget, only a seedPmids Set added — and the
    // seed pmid must now be present despite not making the ordinary cut.
    const withSeed = lit.preFilterForScoring(clusters, byPmid, budget, new Set(['seed-lowest']))
    assert.ok(withSeed.seedtest.some(r => r.pmid === 'seed-lowest'),
        'a named seed pmid must be present in the shortlist even though the ordinary floor+share ranking would have cut it')

    // SEED-FORCING IS A STRICT ADDITION, NEVER A BEHAVIOR CHANGE, WHEN THERE ARE NO SEEDS. Rerun
    // the MAIN fixture from checkPreFilterForScoring — big/small/ranktest/uncategorized, budget
    // 20 — once with the 4th argument omitted entirely and once with an explicit empty Set, and
    // both must total the exact same 19 records that fixture's own hand-worked arithmetic produces.
    const { clusters: mainClusters, byPmid: mainByPmid, budget: mainBudget, total: mainTotal } = mainFixture
    const totalOf = r => Object.values(r).reduce((a, arr) => a + arr.length, 0)
    const omitted = lit.preFilterForScoring(mainClusters, mainByPmid, mainBudget)
    const emptySet = lit.preFilterForScoring(mainClusters, mainByPmid, mainBudget, new Set())
    assert.strictEqual(totalOf(omitted), mainTotal,
        'omitting seedPmids entirely must reproduce the exact same total as before seed-forcing existed — seed-forcing must never change behavior when there is nothing to force')
    assert.strictEqual(totalOf(emptySet), mainTotal,
        'an explicit empty Set must behave IDENTICALLY to omitting the argument — seed-forcing is strictly additive, never a silent behavior change when there are zero seeds')

    console.log(`prefilter seeds: worst-ranked seed excluded without forcing, included with forcing (seedtest=${withSeed.seedtest.length}); omitted/empty seedPmids both reproduce the unforced total (${mainTotal})`)
}

// =======================================================================================
// MODE 4, PHASE 6a — impactScoreOf(). PURE, deterministic, NO LLM. See the file's own header
// comment for the two-score design (this one is free arithmetic over tier + iCite; the other,
// scoreRelevance(), is the one Bedrock call and is out of scope here).
const checkStripScaffolding = (lit) => {
    // THIS SHIPPED. The 2026-08-19 bibliometric run put a literal `</parameter>` at the end of one
    // cluster's paragraph and a literal `</invoke>` in the paragraph after it, straight into
    // word/document.xml — the model closing tags it had opened in its own head, XML-escaped by the
    // docx writer and rendered to the reader as visible garbage mid-document.
    const leaked = 'Taken together, these four papers provide no direct evidence [PMID 39201735].</parameter>\n</invoke>'
    const cleaned = lit.stripScaffolding(leaked, 'check')
    assert.ok(!/<\/?(parameter|invoke)>/.test(cleaned),
        `tool-call scaffolding must not survive into exported prose — got ${JSON.stringify(cleaned)}`)
    assert.ok(cleaned.includes('[PMID 39201735]'),
        'stripping scaffolding must not take the surrounding prose or its citation with it')

    // THE REGRESSION THAT WOULD BE WORSE THAN THE BUG. Biomedical prose is FULL of angle brackets
    // that are data, not markup — every p-value and every threshold in a clinical corpus. A
    // stripper written as "remove anything in angle brackets" would silently rewrite findings, which
    // is a far worse failure than the visible garbage it was meant to fix. So: real statistics must
    // pass through byte-identical.
    const stats = 'Mortality fell (p<0.001) and the TOF ratio was <0.9 in 30% of patients, RR 0.60, 95% CI 0.49<x<0.74.'
    assert.strictEqual(lit.stripScaffolding(stats, 'check'), stats,
        'prose containing p<0.001 and <0.9 must pass through UNCHANGED — the stripper removes tool-call vocabulary, never arbitrary angle-bracketed text')

    // A clean paragraph must be returned as the very same value, not a rebuilt copy — the strip
    // path is the exception, not the default.
    const clean = 'Sugammadex reversed blockade faster than neostigmine [PMID 28806470].'
    assert.strictEqual(lit.stripScaffolding(clean, 'check'), clean, 'untouched prose must pass through unchanged')

    // The regex is module-level and GLOBAL, so its lastIndex persists between calls. If the test
    // that guards the fast path failed to reset it, the SECOND call on identical input would
    // disagree with the first — the classic global-regex bug, and exactly the kind of thing that
    // shows up as "it only leaks every other cluster".
    assert.strictEqual(lit.stripScaffolding(leaked, 'check'), cleaned,
        'stripScaffolding must be idempotent across calls — a global regex whose lastIndex is not reset would leak on alternating invocations')

    console.log(`scaffolding:  </parameter> and </invoke> stripped, p<0.001 and <0.9 preserved, stable across repeat calls`)
}

const checkImpactScoreOf = (lit) => {
    // RETRACTION OVERRIDES EVERYTHING — a RETRACTED record scores exactly 0 no matter how high
    // its citation percentile is. This mirrors tierOf()'s own override in literatureSearch.records.ts:
    // PubMed adds "Retracted Publication" ALONGSIDE a paper's original types rather than replacing
    // them, so a retracted RCT with a sky-high percentile must not buy back any impact score at all.
    const retracted = scoreRec('ret-1', 9, { pct: 99 })
    retracted.tier.label = 'RETRACTED'
    retracted.tier.phrase = 'a RETRACTED publication, which must not be relied on'
    const retractedResult = lit.impactScoreOf(retracted)
    assert.strictEqual(retractedResult.score, 0, 'a RETRACTED record must score exactly 0 regardless of a high nihPercentile — retraction overrides everything, no blend, no partial credit')
    assert.strictEqual(retractedResult.justification, retracted.tier.phrase, "the RETRACTED record's justification must be the tier's own phrase — the one thing that matters here")
    // EVERY RETURNED OBJECT NOW CARRIES evidenceBasis. The RETRACTED short-circuit is the very
    // first branch in impactScoreOf() and reports 'tier-only' — the same label the ordinary
    // no-percentile-no-apt path reports below — because retraction is decided off the tier alone,
    // even though this record DOES carry a (99th) percentile that is never consulted.
    assert.strictEqual(retractedResult.evidenceBasis, 'tier-only', "a RETRACTED record's evidenceBasis must be 'tier-only' — its percentile is never consulted")

    // TIER ORDERING SURVIVES WHEN PERCENTILE IS ABSENT. A rank-2 (Meta-analysis) record with no
    // percentile must still score higher than a rank-5 (Observational) record with no
    // percentile — the tier component alone must preserve the hierarchy, not collapse to a tie
    // just because neither record has been cited yet.
    const metaNoPct = scoreRec('meta-1', 2)
    const obsNoPct = scoreRec('obs-1', 5)
    const metaResult = lit.impactScoreOf(metaNoPct)
    const obsResult = lit.impactScoreOf(obsNoPct)
    const metaScore = metaResult.score
    const obsScore = obsResult.score
    assert.ok(metaScore > obsScore, `a rank-2 (Meta-analysis) record with no percentile (scored ${metaScore}) must score HIGHER than a rank-5 (Observational) record with no percentile (scored ${obsScore}) — tier ordering must survive when percentile is absent`)
    assert.strictEqual(metaResult.evidenceBasis, 'tier-only', 'a record with no nihPercentile and no apt must report evidenceBasis "tier-only"')
    assert.strictEqual(obsResult.evidenceBasis, 'tier-only', 'same for the Observational record — neither has a percentile or an apt to fall back on')

    // MISSING NEVER SILENTLY BECOMES A 0. Two otherwise-identical rank-5 records: one has a
    // GENUINE nihPercentile of 0 (iCite scored it and it sits at the bottom of its field), the
    // other has no percentile at all (never scored — could be excellent, could be terrible, it
    // is simply unknown). If a missing percentile were ever coerced to 0 in the blend, these two
    // scores would come out IDENTICAL — so the assertion is exactly that they must differ.
    const zeroPct = scoreRec('zero-1', 5, { pct: 0 })
    const missingPct = scoreRec('missing-1', 5)
    const zeroResult = lit.impactScoreOf(zeroPct)
    const missingResult = lit.impactScoreOf(missingPct)
    const zeroScore = zeroResult.score
    const missingScore = missingResult.score
    assert.notStrictEqual(zeroScore, missingScore,
        `a record with a genuine nihPercentile: 0 (scored ${zeroScore}) must score differently from an otherwise-identical record with NO percentile at all (scored ${missingScore}) — if missing silently became 0 in the blend these would be equal, and that would brand every unscored recent paper with the same number as the worst-cited paper in the corpus`)
    // And the missing-percentile score specifically must equal the tier component ALONE — never
    // a blend with a phantom 0.
    assert.strictEqual(missingScore, 0.45, 'a rank-5 record with no percentile must score exactly its tier component (0.45) — the tier alone, never blended with a percentile it does not have')
    // evidenceBasis is the field that makes the distinction above CHECKABLE rather than inferred
    // from the number: a real percentile (even 0) reports 'percentile'; nothing at all reports
    // 'tier-only'.
    assert.strictEqual(zeroResult.evidenceBasis, 'percentile', 'a record with a real nihPercentile (even 0) must report evidenceBasis "percentile"')
    assert.strictEqual(missingResult.evidenceBasis, 'tier-only', 'a record with neither a percentile nor an apt must report evidenceBasis "tier-only"')

    // A THIRD SOURCE: iCite's apt (Approximate Potential to Translate) — the fallback for a
    // record with NO nihPercentile yet but WITH an apt, e.g. a 2025-26 paper too new for a
    // citation-based percentile but not too new for iCite's structural signal (see
    // literatureSearch.score.ts's own comment on impactScoreOf()'s apt branch). scoreRec() does
    // not set apt (opts.pct is the only optional field it wires up), so it is added here directly
    // rather than teaching the shared fixture builder a shape only this one case needs.
    const aptOnly = { ...scoreRec('apt-1', 5), apt: 0.8 }
    const aptResult = lit.impactScoreOf(aptOnly)
    const aptScore = aptResult.score
    assert.strictEqual(aptResult.evidenceBasis, 'apt', 'a record with an apt value and no nihPercentile must report evidenceBasis "apt"')
    // MISSING MUST NOT SILENTLY LOOK LIKE A KNOWN VALUE — the same principle the zero-vs-missing
    // percentile assertion already tests one layer up, applied here to apt vs. nothing: an
    // apt-based score must not collapse to the tier-only score just because the path is a
    // fallback rather than the ordinary percentile branch.
    assert.notStrictEqual(aptScore, missingScore,
        `an apt-based score (${aptScore}) must differ from the tier-only score (${missingScore}) — an apt value is real iCite signal and must move the number, not get silently dropped`)
    // THE EXACT ARITHMETIC: impactScoreOf() runs apt through the SAME 0.6/0.4 blend it uses for a
    // real percentile, with apt (0.8) standing in for percentile/100 — so a rank-5 record with
    // apt: 0.8 must score exactly round2(clamp01(0.6 * 0.45 + 0.4 * 0.8)) = 0.59. An exact check,
    // not a range, so a change to the apt blend weight or the tier component table still gets
    // caught even if it happens to leave the score on the correct side of missingScore.
    assert.strictEqual(aptScore, 0.59, `a rank-5 record with apt: 0.8 and no percentile must score exactly 0.59 (round2(clamp01(0.6*0.45 + 0.4*0.8))) — got ${aptScore}`)

    console.log(`impact:       RETRACTED=${retractedResult.score}/${retractedResult.evidenceBasis}, Meta(no pct)=${metaScore} > Obs(no pct)=${obsScore} (both tier-only), zero-pct=${zeroScore}/${zeroResult.evidenceBasis} != missing-pct=${missingScore}/${missingResult.evidenceBasis}, apt-only=${aptScore}/${aptResult.evidenceBasis}`)
}

// =======================================================================================
// MODE 4, PHASE 7b — assembleNarrativeReview(). PURE, deterministic, NO further Bedrock call —
// see this function's own header comment in literatureSearch.narrative.ts for why the whole-
// review intro is assembled by arithmetic rather than one more model call that would invent the
// connective tissue between clusters.
const checkAssembleNarrativeReview = (lit) => {
    const clusters = [
        { id: 'c-small', label: 'Small topic', meshTerms: [], pmids: ['s1', 's2', 's3'] },                                             // size 3
        { id: 'c-big', label: 'Big topic', meshTerms: [], pmids: Array.from({ length: 10 }, (_, i) => `b${i + 1}`) },                  // size 10
        { id: 'c-mid', label: 'Mid topic', meshTerms: [], pmids: Array.from({ length: 6 }, (_, i) => `m${i + 1}`) },                   // size 6
        { id: 'uncat', label: 'Uncategorized', meshTerms: [], pmids: ['u1', 'u2', 'u3', 'u4'], isUncategorized: true },
    ]
    const clusterNarratives = [
        { clusterId: 'c-small', label: 'Small topic', paragraph: 'Small topic prose [PMID s1].', citedPmids: ['s1'] },
        { clusterId: 'c-big', label: 'Big topic', paragraph: 'Big topic prose [PMID b1].', citedPmids: ['b1'] },
        { clusterId: 'c-mid', label: 'Mid topic', paragraph: 'Mid topic prose [PMID m1].', citedPmids: ['m1'] },
        // Included ON PURPOSE, exactly as the task requires: a narrative for the uncategorized
        // bucket exists in the input, and the assertion below is that it must never reach
        // `sections` — assembleNarrativeReview() filters sections against REAL clusters only.
        { clusterId: 'uncat', label: 'Uncategorized', paragraph: 'This must never appear in the output.', citedPmids: [] },
    ]
    const corpusStats = {
        publicationsPerYear: [{ year: '2020', count: 5 }, { year: '2021', count: 8 }],
        evidenceMixByYear: { '2020': { RCT: 3, Observational: 2 }, '2021': { RCT: 5, Review: 3 } },
        totalRecords: 23,
        fromYear: 2020,
        toYear: 2021,
        // Both years above are COMPLETE relative to this — the exclusion assertions further down
        // use their own stats, where the partial year is actually present.
        currentYear: 2022,
    }

    const withFlags = lit.assembleNarrativeReview('Do probiotics help depression?', corpusStats, clusters, clusterNarratives, true)
    const withoutFlags = lit.assembleNarrativeReview('Do probiotics help depression?', corpusStats, clusters, clusterNarratives, false)

    // SECTIONS SORTED BY CLUSTER SIZE DESCENDING — the plan's own mockup instruction, restated
    // as arithmetic: c-big (10) before c-mid (6) before c-small (3).
    assert.deepStrictEqual(withFlags.sections.map(s => s.clusterId), ['c-big', 'c-mid', 'c-small'],
        'narrative sections must be ordered by their cluster size descending — a reader expects the biggest topic first, not build order or alphabetical order')

    // THE UNCATEGORIZED NARRATIVE NEVER APPEARS IN sections, even though this fixture deliberately
    // supplied one for it — the fallthrough bucket gets a roster row (in bibliometricDoc's cluster
    // table) but never a written section, because 'Uncategorized / no dominant MeSH topic' is not
    // a topic a narrative paragraph can honestly be about.
    assert.strictEqual(withFlags.sections.find(s => s.clusterId === 'uncat'), undefined,
        'a narrative supplied for the isUncategorized cluster must never appear in `sections`, even when the caller included one in its input')

    // caseSeriesNote PRESENT IFF hasCaseSeriesFlags WAS TRUE — both branches asserted, because a
    // note that shows up regardless of the flag is exactly as wrong as one that never shows up.
    assert.ok(typeof withFlags.caseSeriesNote === 'string' && withFlags.caseSeriesNote.length > 0,
        'hasCaseSeriesFlags: true must produce a non-empty caseSeriesNote — the reader needs to be told case series are heuristically flagged, not confirmed')
    assert.strictEqual(withoutFlags.caseSeriesNote, undefined,
        'hasCaseSeriesFlags: false must produce NO caseSeriesNote — a disclosure that applies whether or not the corpus actually has any flagged records is not a disclosure, it is boilerplate')

    // THE PARTIAL CURRENT YEAR NEVER ENTERS THE TREND MEANS. A corpus pulled in August holds eight
    // months of the current year, and folding that count into the later-half mean reads every
    // mid-year run as a publication cliff — a decline that is really a calendar. The per-year
    // tables keep the partial year — a count is not a mean — so the assertion is on the intro's
    // comparison sentence alone. The fixture is built so
    // the leak would FLIP the verdict, not just nudge a decimal: four complete years at a steady 5
    // read "held roughly steady"; let the 1-record partial 2022 into the later half and the mean
    // drops to 3.67, through the 10% dead band, and the sentence claims a decline.
    const partialStats = {
        ...corpusStats,
        publicationsPerYear: [
            { year: '2018', count: 5 }, { year: '2019', count: 5 },
            { year: '2020', count: 5 }, { year: '2021', count: 5 },
            { year: '2022', count: 1 },   // the partial current year — 1 record SO FAR, not a collapse
        ],
        toYear: 2022,
        currentYear: 2022,
    }
    const partial = lit.assembleNarrativeReview('Do probiotics help depression?', partialStats, clusters, clusterNarratives, false)
    assert.ok(partial.intro.includes('held roughly steady') && !partial.intro.includes('declined'),
        `a steady 5/year over the complete years must read "held roughly steady" — a "declined" here means the partial current year leaked into the later-half mean. Intro was: ${partial.intro}`)
    assert.ok(partial.intro.includes('2018–2021'),
        `the trend sentence must name the window it actually measured (2018–2021), not the corpus window that includes the partial year. Intro was: ${partial.intro}`)
    assert.ok(partial.intro.includes('2022 is excluded'),
        `when a partial current year was dropped from the comparison, the sentence must disclose the exclusion. Intro was: ${partial.intro}`)

    // AND NO FALSE DISCLAIMER THE OTHER WAY: the base fixture's years are all complete, so its
    // intro must not claim an exclusion that never happened.
    assert.ok(!withFlags.intro.includes('excluded'),
        `a corpus whose window ended before the current year excluded nothing, and its intro must not say otherwise. Intro was: ${withFlags.intro}`)

    // FEWER THAN TWO COMPLETE YEARS = NO TREND SENTENCE AT ALL — one complete year plus a partial
    // one is nothing to compare, and half a comparison is worse than none.
    const oneComplete = lit.assembleNarrativeReview('Do probiotics help depression?',
        { ...corpusStats, currentYear: 2021 }, clusters, clusterNarratives, false)
    assert.ok(!oneComplete.intro.includes('Yearly publication volume'),
        `with only one complete year (2020) and a partial 2021, no trend sentence belongs in the intro. Intro was: ${oneComplete.intro}`)

    console.log(`narrative:    sections ordered [${withFlags.sections.map(s => s.clusterId).join(', ')}], uncategorized excluded, caseSeriesNote present=${!!withFlags.caseSeriesNote}/absent=${withoutFlags.caseSeriesNote === undefined}, partial-year excluded from trend means`)
}

// =======================================================================================
// MODE 4, PHASE 8 — corpusSheet(). PURE, deterministic — this is a renderer, not a network call
// or a model call, the same status literatureExport.ts's other builders have.
const checkCorpusSheet = (xp) => {
    const scored = {
        pmid: '1', title: 'Probiotics and depression', authors: 'Nikolova et al.', year: '2023',
        journal: 'JAMA Psychiatry', design: 'RCT', caseSeriesProbable: true, clusterLabel: 'Probiotics / microbiome',
        nihPercentile: 80,
        evidenceScore: 0.77, evidenceJustification: 'a randomized controlled trial; 80th percentile citation impact (iCite)',
        impactScore: 66, impactJustification: 'phase 3 RCT, high-impact general medical journal',
        relevanceScore: 0.9, relevanceJustification: 'primary RCT of the intervention in the stated population',
    }
    // Never sent to a scorer at all — preFilterForScoring()'s shortlist did not include it. No
    // cluster label either, and no case-series flag: caseSeriesProbable is simply absent, the
    // same "never screened" shape a real un-shortlisted record has.
    const unscored = { pmid: '2', title: 'An unrelated paper', authors: 'Someone et al.', year: '2021', journal: 'J Misc', design: 'Observational' }
    // caseSeriesProbable EXPLICITLY false — must render exactly like "absent", never a checked
    // "No", because false here just means the heuristic did not fire, not that a human confirmed
    // this is not a case series.
    const explicitlyNotCaseSeries = { pmid: '3', title: 'A case report', authors: 'Third et al.', year: '2019', journal: 'J Case', design: 'Case report', caseSeriesProbable: false }

    const facts = { db: 'pubmed', query: 'probiotic*[tiab] AND depress*[tiab]', hits: 500, runDate: '2026-07-13', model: 'us.anthropic.claude-opus-4-8', fromYear: 2019, toYear: 2023 }
    const sheets = xp.corpusSheet([scored, unscored, explicitlyNotCaseSeries], facts)
    const recordsSheet = sheets.find(s => s.name === 'Records')
    assert.ok(recordsSheet, 'corpusSheet must produce a Records sheet')

    // EVERY ROW HAS EXACTLY AS MANY CELLS AS THE HEAD — the exact same invariant, and the exact
    // same reason, as checkXlsxTruncationGuard's assertion on recordSheets(): a short row silently
    // shifts every later value into the wrong column, for that record alone.
    recordsSheet.rows.forEach((row, i) => {
        assert.strictEqual(row.length, recordsSheet.head.length,
            `row ${i} (pmid ${row[0]}) must have exactly ${recordsSheet.head.length} cells to match the head — a short row silently shifts every later cell into the wrong column for that record alone`)
    })

    const col = name => recordsSheet.head.indexOf(name)
    const rowFor = pmid => recordsSheet.rows.find(r => r[0] === pmid)

    // AN UNSCORED RECORD'S IMPACT/RELEVANCE CELLS ARE EMPTY STRING, NEVER 0 AND NEVER "N/A" —
    // Number(undefined) coerced to 0 would read as "scored, and scored at rock bottom," when the
    // truth is "never sent to a scorer at all."
    const unscoredRow = rowFor('2')
    for (const field of ['Impact score (0-100)', 'Impact justification', 'Relevance score', 'Relevance justification', 'NIH percentile']) {
        assert.ok(col(field) !== -1, `the Records sheet must have a "${field}" column — this list and corpusSheet's own head must not drift apart`)
        assert.strictEqual(unscoredRow[col(field)], '', `an unscored record's "${field}" cell must be the empty string, not 0 and not "N/A" — a blank cell is the only honest rendering of "not in the shortlist"`)
    }

    // THE THREE AXES ARE THREE COLUMNS, AND NONE OF THEM IS THE SAME NUMBER AS ANOTHER. The whole
    // point of the 2026-08-19 rework: "Impact score" had become a pure restatement of "Evidence
    // type" (0.30 = Other, 0.75 = RCT, ...) because the iCite percentile it was supposed to blend
    // never arrived, so a reader saw a confident two-decimal number that carried no information the
    // column two positions to its left did not already carry. A model-judged 0-100 impact and a
    // deterministic evidence prior must never collapse back into one column.
    for (const field of ['Evidence score', 'Impact score (0-100)', 'Relevance score', 'NIH percentile']) {
        assert.ok(col(field) !== -1, `"${field}" must be its own column — the three scoring axes stay distinct, never pre-blended into one composite`)
    }
    const scoredRow = rowFor('1')
    assert.notStrictEqual(scoredRow[col('Evidence score')], scoredRow[col('Impact score (0-100)')],
        'the deterministic evidence prior and the model-judged impact score must be distinct values on a scored row — if these are ever equal, one of them has silently become a copy of the other')

    // A caseSeriesProbable: true RECORD'S CASE SERIES CELL IS NON-EMPTY; AN UNSET (OR EXPLICITLY
    // FALSE) ONE'S CELL IS EMPTY STRING — NEVER A CHECKED "No". Three states, not two: the flag is
    // a heuristic, never a confirmed verdict, so its absence must not be printed as a negative claim.
    assert.strictEqual(rowFor('1')[col('Case series')], 'Probable', 'a caseSeriesProbable: true record must show a non-empty Case series cell')
    assert.strictEqual(rowFor('2')[col('Case series')], '', 'a record with no caseSeriesProbable field at all must show an empty Case series cell')
    assert.strictEqual(rowFor('3')[col('Case series')], '', 'a caseSeriesProbable: false record must ALSO show an empty Case series cell, never a checked "No" — false only means the heuristic did not fire, not that a human confirmed it is not a case series')

    console.log(`corpusSheet:  ${recordsSheet.rows.length} rows all match the ${recordsSheet.head.length}-column head; unscored cells blank; case-series is Probable/blank never No`)
}

// =======================================================================================
// MODE 4, PHASE 8 — bibliometricDoc(). PURE, deterministic.
const checkBibliometricDoc = (xp) => {
    // "Umbrella review" appears NOWHERE in TIERS (literatureSearch.records.ts) — it is a made-up
    // label chosen specifically so that a HARDCODED tier-label list (e.g. one lazily copied from
    // TIERS instead of derived from the fixture itself) would silently drop this column. If this
    // assertion ever stops catching that, the fixture has stopped doing its job.
    const evidenceMixByYear = {
        '2020': { 'Umbrella review': 2, RCT: 3 },
        '2021': { RCT: 4, Guideline: 1 },
    }
    const percentileTrend = [
        { year: '2020', median: 42, n: 10, scored: 8 },
        // A year with zero scored records: no median to report. Must render as an EMPTY cell,
        // never "N/A" and never 0 — same rule impactScoreOf() applies to a missing percentile,
        // one layer up.
        { year: '2021', median: null, n: 5, scored: 0 },
    ]
    const clusters = [
        { id: 'a', label: 'Cluster A', pmids: ['x1', 'x2', 'x3'] },
        { id: 'b', label: 'Cluster B', pmids: ['y1', 'y2'] },
    ]
    const narrative = {
        intro: 'This is the corpus-wide intro.',
        sections: [
            // Carries an invented PMID — the model cited something outside the shortlist it was
            // actually given for this cluster (see synthesizeCluster()'s own comment).
            { label: 'Cluster A', paragraph: 'Cluster A prose [PMID 111].', invented: ['999999'] },
            // No invented PMID — must get NO warning block.
            { label: 'Cluster B', paragraph: 'Cluster B prose [PMID 222].' },
        ],
    }
    const facts = { db: 'pubmed', query: 'q', hits: 100, runDate: '2026-07-13', model: 'us.anthropic.claude-opus-4-8', fromYear: 2020, toYear: 2021 }
    const stats = {
        publicationsPerYear: [{ year: '2020', count: 5 }, { year: '2021', count: 9 }],
        evidenceMixByYear,
        journalDistribution: [{ journal: 'J1', count: 5 }],
        percentileTrend,
    }

    const blocks = xp.bibliometricDoc('Do X help Y?', facts, stats, clusters, narrative)
    const h2Index = text => blocks.findIndex(b => b.kind === 'h2' && b.text === text)

    // THE EVIDENCE-MIX COLUMNS ARE THE UNION OF TIER LABELS ACTUALLY PRESENT, NOT A HARDCODED
    // LIST — "Umbrella review" is not a real TIERS label, so if this table's columns came from an
    // imported TIERS list rather than from `evidenceMixByYear` itself, this column would silently
    // vanish and this assertion would fail.
    const mixIdx = h2Index('Evidence-type mix by year')
    assert.ok(mixIdx !== -1, 'bibliometricDoc must have an "Evidence-type mix by year" section')
    const mixTable = blocks[mixIdx + 1]
    assert.strictEqual(mixTable.kind, 'table', 'the evidence-mix section must be immediately followed by its table')
    assert.deepStrictEqual(mixTable.head, ['Year', 'Guideline', 'RCT', 'Umbrella review'],
        `the evidence-mix table's columns must be exactly the union of tier labels present in the data (sorted), including "Umbrella review" which is not a real TIERS label — got ${JSON.stringify(mixTable.head)}. If this ever passes with "Umbrella review" missing, the column list has been hardcoded against TIERS instead of derived from the fixture.`)

    // A NULL PERCENTILE-TREND MEDIAN RENDERS AS AN EMPTY CELL, NOT "N/A" AND NOT 0.
    const trendIdx = h2Index('Citation percentile trend (iCite)')
    const trendTable = blocks[trendIdx + 1]
    const row2021 = trendTable.rows.find(r => r[0] === '2021')
    const row2020 = trendTable.rows.find(r => r[0] === '2020')
    assert.strictEqual(row2021[1], '', 'a year with zero scored records (median: null) must render its median cell as the empty string, not "N/A" and not 0')
    assert.strictEqual(row2020[1], '42', 'a year with a real median must still print it — this is the control for the assertion above')

    // A CLUSTER NARRATIVE WITH AN invented PMID PRODUCES A WARNING BLOCK IN THE ACTUAL Block[] —
    // asserted on its presence, not eyeballed.
    const clusterAParaIdx = blocks.findIndex(b => b.kind === 'p' && b.text === 'Cluster A prose [PMID 111].')
    assert.ok(clusterAParaIdx !== -1, "Cluster A's paragraph must appear in the document")
    const warningIndices = blocks.reduce((acc, b, i) => (b.kind === 'h2' && /^WARNING/.test(b.text) ? [...acc, i] : acc), [])
    assert.strictEqual(warningIndices.length, 1,
        `exactly one WARNING block is expected — Cluster A cited an invented PMID and Cluster B did not — got ${warningIndices.length}`)
    assert.strictEqual(warningIndices[0], clusterAParaIdx + 1,
        "the WARNING must sit directly after the paragraph it corrects (paragraph-then-warning, per bibliometricDoc's own comment), not before it and not after Cluster B's section")
    assert.ok(blocks[warningIndices[0] + 1].text.includes('999999'),
        'the WARNING body must NAME the invented PMID — "some citations may be wrong" is not actionable')

    console.log(`bibliometricDoc: evidence-mix columns=[${mixTable.head.slice(1).join(', ')}] (derived, not hardcoded); null median -> empty cell; 1 WARNING block, correctly placed and naming PMID 999999`)
}

// An async IIFE, not a bare top-level await: this file runs as plain CommonJS (no "type":
// "module" in package.json), and only checkNarrowingLadder needs to await anything — it is the
// only function here exercising an (fake-dep-injected) async production function. Every failure
// still fails the process the same way a thrown assertion always has: caught below, printed, and
// exited non-zero, so this stays a real CI gate rather than a check whose async half can go quiet.
;(async () => {
    const { s, q } = checkStrategyBounds(lit)
    const { hits, rc } = checkRecordsColumnRendering(lit, xp, s, q)
    checkMarkdownDocuments(xp, md, s, q, hits, rc)
    checkXlsxTruncationGuard(xp, q)
    await checkNarrowingLadder(lit)
    checkClusterByMesh(lit)
    const pf = checkPreFilterForScoring(lit)
    checkPreFilterForScoringSeeds(lit, pf)
    checkStripScaffolding(lit)
    checkImpactScoreOf(lit)
    checkAssembleNarrativeReview(lit)
    checkCorpusSheet(xp)
    checkBibliometricDoc(xp)

    console.log('\nAll pure checks passed. No network, no model, no environment.')
})().catch(err => {
    console.error(err)
    process.exit(1)
})
