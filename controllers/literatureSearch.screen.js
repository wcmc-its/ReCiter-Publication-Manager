/*
 * THE SCREEN CHECK — does the AI screen recognise an includable study when it actually sees one?
 *
 *   node controllers/literatureSearch.screen.js          (needs .litrecall-run.json — run the recall check first)
 *
 * WHY THIS IS A SEPARATE EXPERIMENT FROM literatureSearch.recall.js.
 *
 * The recall check measured the whole pipeline and found the screen INNOCENT BY STARVATION: the top-50
 * relevance cut handed the model one eligible study across three reviews, it kept that one, and nothing
 * about its judgement was tested. The screen's false-negative rate — the thing the handoff was actually
 * afraid of — is still unmeasured.
 *
 * It still matters, and after the export refusal it matters in EXACTLY ONE PLACE. `recordSheets()` now
 * withholds the "AI suggested" column whenever the sheet is truncated. So the only surviving surface
 * where an AI verdict leaves the building is the UNTRUNCATED search: a tight query, every record
 * screened, a complete sheet, and the column shipped with full authority into Covidence. That case has
 * never been measured. This measures it.
 *
 * THE DESIGN. Take the reviews' known-included studies, pad each to a full 50-record batch with records
 * THE SAME STRATEGY RETRIEVED BUT THE REVIEW EXCLUDED, and hand that batch straight to screenRecords()
 * with the review's own criteria. One call per review — the exact 50-record shape the code is built for.
 * (Do NOT chunk to go bigger: the controller is emphatic, and right, that chunking screens each batch
 * blind to the others, which is how the same paper is excluded in batch 1 and included in batch 3.)
 *
 * THE TRAP, AND IT IS WHY THIS RUNS IN TWO STAGES.
 *
 * That batch is ~50% eligible. A real one is ~3% (25 includes in an 818-hit search). A model shown a
 * pile of obviously-relevant papers may well be more generous than one panning for four good studies in
 * fifty — so an ENRICHED batch can FLATTER the screen, and a good number from stage A alone would be a
 * number we are entitled to distrust.
 *
 *   STAGE A (enriched)   gold + distractors to 50. Asks: can it recognise an eligible study at all?
 *   STAGE B (realistic)  3 gold + 47 distractors, at a prevalence a librarian would actually hit.
 *                        Runs ONLY if A passes — if the model cannot spot these studies when half the
 *                        page is made of them, no fairer design is going to rescue it, and we stop.
 *
 * WHAT A DISTRACTOR IS, AND ISN'T. It is a record the strategy retrieved that the review did not
 * include. Most are genuinely ineligible; a few will be the review's own protocol, a secondary report,
 * or a study it excluded on full text for a reason no title/abstract screen could see. So the
 * distractor side is NOISY BY CONSTRUCTION and a "wrong" include on one is not necessarily wrong. That
 * asymmetry is fine and it is deliberate: we are measuring RECALL — what the model throws away — and
 * the gold side is clean. Do not read the include rate on distractors as a precision score.
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, '.litrecall')

// .env.local is gitignored, so a CI checkout has no such file — read it only if it exists, else the
// same names arrive as real environment variables. When it exists it wins over a stale shell export.
const envFile = path.join(ROOT, '.env.local')
if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
        if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
}

fs.rmSync(OUT, { recursive: true, force: true })
execSync(
    `npx tsc controllers/literatureSearch.controller.ts --outDir ${OUT} ` +
    `--module commonjs --target es2020 --esModuleInterop --skipLibCheck --allowJs`,
    { cwd: ROOT, stdio: 'inherit' },
)
const lit = require(path.join(OUT, 'controllers/literatureSearch.controller.js'))

const BENCH = JSON.parse(fs.readFileSync(path.join(__dirname, 'literatureSearch.recall.json'), 'utf8'))
const RUN = JSON.parse(fs.readFileSync(path.join(ROOT, '.litrecall-run.json'), 'utf8'))
const CAP = lit.RECORD_CAP

const pct = (n, d) => (d === 0 ? ' n/a' : `${String(Math.round((n / d) * 100)).padStart(3)}%`)
const cost = t => t.inputTokens / 1e6 * 5.50 + t.outputTokens / 1e6 * 27.50

// Spread the gold through the batch instead of stacking it at the top. A model that sees 25 eligible
// papers in a row and then 25 duds can learn the shape of the page rather than judge the papers, and we
// would be measuring the layout. Deterministic — no Math.random, so a re-run is comparable.
function interleave(gold, distractors) {
    const out = []
    const step = (gold.length + distractors.length) / gold.length
    let gi = 0, di = 0
    for (let i = 0; i < gold.length + distractors.length; i++) {
        if (gi < gold.length && i >= Math.floor(gi * step)) out.push(gold[gi++])
        else if (di < distractors.length) out.push(distractors[di++])
        else if (gi < gold.length) out.push(gold[gi++])
    }
    return out
}

async function stage(label, review, goldRecs, distractors, nGold) {
    const gold = goldRecs.slice(0, nGold)
    const pad = distractors.slice(0, CAP - gold.length)
    const batch = interleave(gold, pad)
    const goldSet = new Set(gold.map(r => r.pmid))

    const { flags, usage } = await lit.screenRecords(review.question, review.criteria, batch)
    const verdict = new Map(flags.map(f => [f.pmid, f]))

    const binned = gold.filter(r => verdict.get(r.pmid) && verdict.get(r.pmid).include === false)
    const kept = gold.filter(r => verdict.get(r.pmid) && verdict.get(r.pmid).include === true)
    const unscreened = gold.filter(r => !verdict.get(r.pmid) || verdict.get(r.pmid).screened === false)
    const distIncluded = batch.filter(r => !goldSet.has(r.pmid) && verdict.get(r.pmid)?.include === true)

    console.log(`\n  ${label}  ${gold.length} known-included + ${pad.length} retrieved-but-excluded = ${batch.length} records`)
    console.log(`     SCREEN RECALL   ${pct(kept.length, gold.length)}   ${kept.length}/${gold.length} known-included studies KEPT`)
    console.log(`     -> ${binned.length} thrown away${unscreened.length ? `, ${unscreened.length} never screened (failed open)` : ''}`)
    console.log(`     (of the ${pad.length} distractors it kept ${distIncluded.length} — NOT a precision score, see header)`)

    if (binned.length) {
        console.log(`\n     THE STUDIES IT THREW AWAY — every one was INCLUDED by the published review:`)
        for (const r of binned) {
            console.log(`       ${r.pmid}  ${(r.title || '(no title)').slice(0, 78)}`)
            console.log(`               "${verdict.get(r.pmid).reason}"`)
        }
    }
    console.log(`     cost: $${cost(usage).toFixed(2)}`)
    return { kept: kept.length, gold: gold.length, binned: binned.map(r => r.pmid) }
}

;(async () => {
    const prepared = []
    for (const review of BENCH.reviews) {
        const run = RUN.reviews.find(r => r.title === review.title)
        // The gold studies THIS STRATEGY ACTUALLY RETRIEVED. A study the query never found is the
        // ranker's problem, not the screen's, and charging it to the screen would be the same
        // misattribution the recall study exists to avoid.
        const goldPmids = Object.keys(run.ranks)
        const goldRecs = await lit.fetchByPmids(goldPmids)
        // Distractors from the same query, relevance-ordered — literally the records a librarian on a
        // tight search would be shown alongside the eligible ones.
        const pool = await lit.fetchRecords(run.query, 200, 'relevance')
        const goldSet = new Set(goldPmids)
        prepared.push({ review, goldRecs, distractors: pool.filter(r => !goldSet.has(r.pmid)) })
    }

    console.log(`\n${'#'.repeat(78)}\n# STAGE A — ENRICHED. Can it recognise an eligible study at all?\n${'#'.repeat(78)}`)
    const A = []
    for (const p of prepared) {
        console.log(`\n${'='.repeat(78)}\n${p.review.title}\n${'='.repeat(78)}`)
        A.push(await stage('STAGE A', p.review, p.goldRecs, p.distractors, Math.min(p.goldRecs.length, CAP - 5)))
    }
    const sumA = A.reduce((a, r) => [a[0] + r.kept, a[1] + r.gold], [0, 0])
    console.log(`\n  STAGE A POOLED:  ${pct(...sumA)}  (${sumA[0]}/${sumA[1]} kept)`)

    // THE STOP RULE, stated before the number is known so it cannot be rationalised after it.
    // If the model cannot hold on to these studies when half the page is made of them, no fairer
    // prevalence is going to save it, and stage B would only be paying to watch it fail again.
    if (sumA[0] / sumA[1] < 0.9) {
        console.log(`\n  Stage A recall is below 90%. STOPPING — a realistic prevalence can only be HARDER,`)
        console.log(`  so stage B cannot rescue this and there is nothing to learn by paying for it.`)
        console.log(`  The AI screen does not reliably recognise an includable study. It should not ship a`)
        console.log(`  verdict column ANYWHERE, truncated or not.\n`)
        return
    }

    console.log(`\n\n${'#'.repeat(78)}\n# STAGE B — REALISTIC PREVALENCE. Was stage A flattering it?\n${'#'.repeat(78)}`)
    console.log(`# Stage A ran at ~50% eligible. A real search is ~3%. Same studies, same criteria,`)
    console.log(`# now buried in the ratio a librarian would actually meet.`)
    const B = []
    for (const p of prepared) {
        console.log(`\n${'='.repeat(78)}\n${p.review.title}\n${'='.repeat(78)}`)
        B.push(await stage('STAGE B', p.review, p.goldRecs, p.distractors, 3))
    }
    const sumB = B.reduce((a, r) => [a[0] + r.kept, a[1] + r.gold], [0, 0])

    console.log(`\n\n${'#'.repeat(78)}\n# RESULT\n${'#'.repeat(78)}\n`)
    console.log(`  STAGE A  enriched (~50% eligible)     ${pct(...sumA)}   ${sumA[0]}/${sumA[1]} kept`)
    console.log(`  STAGE B  realistic (~6% eligible)     ${pct(...sumB)}   ${sumB[0]}/${sumB[1]} kept`)
    const drop = (sumA[0] / sumA[1]) - (sumB[0] / sumB[1])
    console.log(`\n  ${drop > 0.1
        ? `Stage A WAS flattering it: recall falls ${Math.round(drop * 100)} points at a realistic prevalence.\n  Believe stage B.`
        : `Stage B holds up — the enriched batch was not flattering it.`}`)
    const dead = [...A, ...B].flatMap(r => r.binned)
    console.log(`\n  ${dead.length ? `${dead.length} known-included ${dead.length === 1 ? 'study was' : 'studies were'} thrown away across both stages: ${[...new Set(dead)].join(', ')}` : 'The screen threw away NOTHING in either stage.'}`)
    console.log(`\n  N is 3 reviews. Still a smoke alarm, not a thermometer.\n`)
})().catch(e => { console.error(e); process.exit(1) })
