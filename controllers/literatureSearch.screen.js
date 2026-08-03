/*
 * THE SCREEN CHECK — does the AI screen recognise an includable study when it actually sees one?
 *
 *   node controllers/literatureSearch.screen.js          (needs .litrecall-run.json — run the recall check first)
 *
 * Writes .litscreen-run.json: the metadata of the run, both stages, and every verdict it threw away.
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
 * A real batch is ~3% eligible (25 includes in an 818-hit search). A model shown a pile of
 * obviously-relevant papers may well be more generous than one panning for four good studies in fifty —
 * so an ENRICHED batch can FLATTER the screen, and a good number from stage A alone would be a number
 * we are entitled to distrust.
 *
 *   STAGE A (enriched)   EVERY gold study the strategy retrieved, padded with distractors to 50. That
 *                        is 36-60% eligible depending on the review, NOT a fixed half: the gold count
 *                        is whatever the strategy found (18, 25 or 30 here) and the batch is always 50.
 *                        Deliberately not trimmed to a round prevalence — trimming would DISCARD gold
 *                        studies, and the question this stage asks is whether it can recognise an
 *                        eligible study at all, which is best asked of all of them. Each stage LOGS its
 *                        realised prevalence so no reader has to reconstruct it from these numbers.
 *   STAGE B (leaner)     3 gold + 47 distractors = 6% eligible. Note that 6% is still about TWICE the
 *                        ~3% of a real search, so this stage is not "realistic" — it is merely leaner
 *                        than A, and it errs in the model's favour, not against it.
 *                        Runs ONLY if A passes — if the model cannot spot these studies when a third to
 *                        two thirds of the page is made of them, no leaner design is going to rescue
 *                        it, and we stop. "Passes" means the POOLED recall clears the floor AND every
 *                        single review does: three reviews from three domains are not three samples of
 *                        one population, and a pooled number lets two good domains carry a bad one.
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
const assert = require('assert')
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
// literatureExport.ts is compiled alongside the controller because the ONE thing this script asserts
// (rather than measures) lives there: that a verdict survives into the .xlsx. It is a pure module —
// no network, no model — so adding it costs a compile and nothing else.
execSync(
    `npx tsc controllers/literatureSearch.controller.ts controllers/literatureExport.ts --outDir ${OUT} ` +
    `--module commonjs --target es2020 --esModuleInterop --skipLibCheck --allowJs`,
    { cwd: ROOT, stdio: 'inherit' },
)
const lit = require(path.join(OUT, 'controllers/literatureSearch.controller.js'))
const xp = require(path.join(OUT, 'controllers/literatureExport.js'))

const BENCH = JSON.parse(fs.readFileSync(path.join(__dirname, 'literatureSearch.recall.json'), 'utf8'))
const RUN = JSON.parse(fs.readFileSync(path.join(ROOT, '.litrecall-run.json'), 'utf8'))
const CAP = lit.RECORD_CAP

const pct = (n, d) => (d === 0 ? ' n/a' : `${String(Math.round((n / d) * 100)).padStart(3)}%`)
const cost = t => t.inputTokens / 1e6 * 5.50 + t.outputTokens / 1e6 * 27.50

// THE STOP THRESHOLD, NAMED ONCE, because it is now applied in two places — pooled and per review —
// and two copies of a threshold is how they come to disagree.
const STOP_BELOW = 0.9

// WHICH COMMIT PRODUCED THIS NUMBER — same reasoning, same wrapper, as literatureSearch.recall.js: a
// recall figure means nothing without the prompt and ceilings that were live when it was measured, and
// a run that costs money must not die at the last line because the checkout is not a git checkout.
const gitSha = () => {
    try {
        return execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch (e) {
        return null
    }
}

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
    // WHICH gold studies get tested is a sampling decision, and it used to be made by PubMed. A plain
    // .slice() takes them in the order fetchByPmids() happened to return, and that order is arbitrary,
    // undocumented and free to change — so stage B would test three different studies on Tuesday than
    // it did on Monday, and the two runs would not be comparable even though nothing in the tool
    // changed. Sorting by PMID fixes the sample. It TRADES REPRESENTATIVENESS FOR REPRODUCIBILITY on
    // purpose, and the bias it buys is a real one worth naming: PMIDs are issued in rough chronological
    // order, so "the first three by PMID" is "the three oldest", and older papers have older abstracts.
    // That is the lesser harm — a biased measurement can be argued with, an irreproducible one cannot.
    const gold = [...goldRecs].sort((a, b) => Number(a.pmid) - Number(b.pmid)).slice(0, nGold)
    const pad = distractors.slice(0, CAP - gold.length)
    const batch = interleave(gold, pad)
    const goldSet = new Set(gold.map(r => r.pmid))

    const { flags, usage } = await lit.screenRecords(review.question, review.criteria, batch)
    const verdict = new Map(flags.map(f => [f.pmid, f]))

    const binned = gold.filter(r => verdict.get(r.pmid) && verdict.get(r.pmid).include === false)
    const kept = gold.filter(r => verdict.get(r.pmid) && verdict.get(r.pmid).include === true)
    const unscreened = gold.filter(r => !verdict.get(r.pmid) || verdict.get(r.pmid).screened === false)
    // Same three-way split as literatureSearch.recall.js, and for the same reason: an EXCLUSION is a
    // judgement error, a NO VERDICT is a completeness error that re-asking repairs, and a missing flag
    // object is a contract error. One "not kept" number hides which of the three is happening, and they
    // do not have the same fix. KEPT / EXCLUDED / NO FLAG partition the gold denominator; NO VERDICT
    // does not — those fail OPEN and are counted inside KEPT, so KEPT is an upper bound.
    const noFlag = gold.filter(r => !verdict.get(r.pmid))
    const endorsed = kept.filter(r => verdict.get(r.pmid).screened !== false)
    const distIncluded = batch.filter(r => !goldSet.has(r.pmid) && verdict.get(r.pmid)?.include === true)

    console.log(`\n  ${label}  ${gold.length} known-included + ${pad.length} retrieved-but-excluded = ${batch.length} records`)
    // THE REALISED PREVALENCE, PRINTED, because it is not the number the stage is named after. Stage A
    // takes every gold study the strategy retrieved, so its prevalence is whatever that count divided
    // by 50 comes to — 36% to 60% across these three reviews, never a tidy "half".
    console.log(`     PREVALENCE      ${pct(gold.length, batch.length)}   ${gold.length}/${batch.length} of this batch is eligible`)
    console.log(`     SCREEN RECALL   ${pct(kept.length, gold.length)}   ${kept.length}/${gold.length} known-included studies KEPT`)
    console.log(`     -> KEPT ${kept.length}  ·  EXCLUDED ${binned.length}  ·  NO VERDICT ${unscreened.length} (fails open, counted inside KEPT)`
        + `  ·  NO FLAG AT ALL ${noFlag.length}`)
    console.log(`     -> of the ${kept.length} kept, ${endorsed.length} carry an include the model actually gave`)
    // THE DISTRACTOR NUMBER IS NOT A FALSE-POSITIVE RATE AND MUST NOT BE READ AS ONE. A "distractor"
    // here is only "retrieved by this strategy and not on the review's included list" — which sweeps up
    // the review's own protocol, its secondary and follow-up reports, and studies it excluded at FULL
    // TEXT for reasons no title/abstract screen could ever see. Some of those are genuinely eligible on
    // the evidence the model was shown, so an "include" on them is not necessarily an error, and the
    // fixture carries no field that would let us tell which is which. The number is printed for shape
    // only — if it were 47/47 something is badly wrong — and it is NOT a precision score.
    console.log(`     (of the ${pad.length} distractors it kept ${distIncluded.length} — see above: NOT a precision score)`)

    if (binned.length) {
        console.log(`\n     THE STUDIES IT THREW AWAY — every one was INCLUDED by the published review:`)
        for (const r of binned) {
            console.log(`       ${r.pmid}  ${(r.title || '(no title)').slice(0, 78)}`)
            console.log(`               "${verdict.get(r.pmid).reason}"`)
        }
    }

    // THE VERDICT HAS TO SURVIVE THE EXPORT, NOT JUST THE FUNCTION CALL.
    //
    // Everything above measures screenRecords() in isolation, and that is not where the harm is. The
    // verdict that can hurt someone is the one that reaches the .xlsx and opens in COVIDENCE, where it
    // is read as a screening pass by someone who never saw our UI. recordSheets() withholds the column
    // when the sheet is truncated, so the surviving surface is exactly the case this batch IS: every
    // record screened, hits === retrieved, a COMPLETE screen, column shipped with full authority.
    //
    // So assert that the verdicts just measured are the verdicts that leave the building — same PMIDs,
    // same three states, no shift, no silent drop. recordSheets() is pure, so this costs no call.
    const cell = f => (f.screened === false ? 'Not screened' : f.include ? 'Include' : 'Exclude')
    const sheet = xp.recordSheets(
        batch,
        Object.fromEntries(flags.map(f => [f.pmid, f])),
        {},
        {
            db: 'pubmed',
            query: '(screen benchmark — literatureSearch.screen.js)',
            runDate: new Date().toISOString().slice(0, 10),
            model: process.env.BEDROCK_MODEL_ID,
            // hits === retrieved is what makes this a complete screen rather than a truncated sample.
            hits: batch.length,
            retrieved: batch.length,
        },
    )[0]
    const col = sheet.head.indexOf('AI suggested')
    const exported = new Map(sheet.rows.map(r => [r[0], r[col]]))
    assert.deepStrictEqual(
        batch.map(r => exported.get(r.pmid)),
        batch.map(r => cell(verdict.get(r.pmid))),
        'a COMPLETE screen must carry every verdict into the .xlsx "AI suggested" column, unshifted — '
        + 'that file opens in Covidence and is read there as a screening pass',
    )

    // WHAT THIS COST COVERS: the Bedrock tokens of THIS screen call, including the re-asks
    // screenRecords() makes internally (it sums their usage into the same object, and a failed re-ask's
    // billed usage too). WHAT IT DOES NOT COVER: the strategy build, which the recall run already paid
    // for; the fetchByPmids and fetchRecords calls that assembled this batch; and the other stage. It
    // is the price of the screen, not the price of the experiment.
    console.log(`     cost: $${cost(usage).toFixed(2)}`)
    return {
        title: review.title,
        pmid: review.pmid,
        stage: label,
        kept: kept.length,
        gold: gold.length,
        batch: batch.length,
        excluded: binned.length,
        noVerdict: unscreened.length,
        noFlag: noFlag.length,
        endorsed: endorsed.length,
        distractors: pad.length,
        distractorsKept: distIncluded.length,
        cost: cost(usage),
        binned: binned.map(r => r.pmid),
    }
}

// THIS RUN COSTS MONEY AND, UNTIL NOW, LEFT NOTHING BEHIND. Every number it produced lived in a
// terminal scrollback and died there, which means a claim about the screen's recall could not be
// checked against the run that produced it — and the recall study next door writes an artifact for
// exactly that reason. Same metadata block as literatureSearch.recall.js, plus the metadata of the
// recall run this one is BUILT ON: the gold sets and the distractor pool both come out of
// .litrecall-run.json, so a screen number measured against a stale recall run is a screen number
// measured against a different strategy.
//
// NOTE FOR WHOEVER LANDS THIS: .gitignore lists .litrecall-run.json and .litquestion-run.json by name
// and has no wildcard, so `.litscreen-run.json` needs a line adding beside them or it shows up as an
// untracked file after every run.
function writeArtifact(A, B) {
    const artifact = path.join(ROOT, '.litscreen-run.json')
    fs.writeFileSync(artifact, JSON.stringify({
        metadata: {
            ranAt: new Date().toISOString(),
            gitSha: gitSha(),
            model: process.env.BEDROCK_MODEL_ID,
            region: process.env.AWS_REGION,
            recordCap: CAP,
            stopBelow: STOP_BELOW,
            benchmark: 'controllers/literatureSearch.recall.json',
            // Which recall run supplied the gold sets and the distractor pool. Without it the two
            // artifacts cannot be lined up and neither can be trusted to describe the same code.
            builtOn: { file: '.litrecall-run.json', metadata: RUN.metadata || null },
        },
        stageA: A,
        stageB: B,
    }, null, 2))
    console.log(`  full run (per-stage, per-review, verdicts thrown away) -> ${artifact}\n`)
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
    // PER REVIEW, NOT ONLY POOLED. The three reviews are a drug RCT question, a diagnostic-accuracy
    // question and a behavioural one — they are not three samples of one population, and pooling them
    // lets two good domains carry a bad one. A screen that works on drug trials and fails on
    // behavioural interventions is a screen that fails, and the pooled number can read 92% while
    // saying so.
    console.log(`\n  STAGE A PER REVIEW:`)
    for (const r of A) {
        console.log(`     ${r.title.slice(0, 46).padEnd(48)} ${pct(r.kept, r.gold)}  (${r.kept}/${r.gold} kept, ${pct(r.gold, r.batch).trim()} eligible)`)
    }
    console.log(`  STAGE A POOLED:  ${pct(...sumA)}  (${sumA[0]}/${sumA[1]} kept)`)

    // THE STOP RULE, stated before the number is known so it cannot be rationalised after it.
    // If the model cannot hold on to these studies when a third to two thirds of the page is made of
    // them, no leaner prevalence is going to save it, and stage B would only be paying to watch it fail
    // again.
    //
    // IT FIRES ON EITHER THE POOLED NUMBER OR ANY SINGLE REVIEW. The pooled form alone was a rule that
    // could be passed by a tool nobody should ship: two reviews at 100% and one at 70% pools to 90% and
    // reads as a pass, while the librarian who happens to ask the third kind of question is handed a
    // screen that throws away three studies in ten. A per-domain floor is the only version of this rule
    // that means what it says.
    const belowA = A.filter(r => r.gold && r.kept / r.gold < STOP_BELOW)
    if (sumA[0] / sumA[1] < STOP_BELOW || belowA.length) {
        const why = sumA[0] / sumA[1] < STOP_BELOW
            ? `pooled stage A recall is ${pct(...sumA).trim()}`
            : `pooled stage A recall passed, but ${belowA.length} review${belowA.length === 1 ? '' : 's'} did not`
        console.log(`\n  STOPPING — ${why}, and the floor is ${Math.round(STOP_BELOW * 100)}%.`)
        for (const r of belowA) console.log(`     BELOW FLOOR: ${r.title} — ${pct(r.kept, r.gold)} (${r.kept}/${r.gold})`)
        console.log(`  A leaner prevalence can only be HARDER, so stage B cannot rescue this and there is`)
        console.log(`  nothing to learn by paying for it.`)
        console.log(`  The AI screen does not reliably recognise an includable study${belowA.length ? ' on every kind of question' : ''}.`)
        console.log(`  It should not ship a verdict column ANYWHERE, truncated or not.\n`)
        writeArtifact(A, [])
        return
    }

    console.log(`\n\n${'#'.repeat(78)}\n# STAGE B — LEANER PREVALENCE. Was stage A flattering it?\n${'#'.repeat(78)}`)
    console.log(`# Stage A ran at ${pct(sumA[1], A.reduce((n, r) => n + r.batch, 0)).trim()} eligible pooled (36-60% per review). Stage B runs at 3 of 50 = 6%.`)
    console.log(`# 6% is still about TWICE the ~3% of a real search, so stage B is LEANER, not realistic —`)
    console.log(`# it errs in the model's favour. Same studies, same criteria, thinner on the page.`)
    const B = []
    for (const p of prepared) {
        console.log(`\n${'='.repeat(78)}\n${p.review.title}\n${'='.repeat(78)}`)
        B.push(await stage('STAGE B', p.review, p.goldRecs, p.distractors, 3))
    }
    const sumB = B.reduce((a, r) => [a[0] + r.kept, a[1] + r.gold], [0, 0])
    const prev = rows => pct(rows.reduce((n, r) => n + r.gold, 0), rows.reduce((n, r) => n + r.batch, 0)).trim()

    console.log(`\n\n${'#'.repeat(78)}\n# RESULT\n${'#'.repeat(78)}\n`)
    // Both prevalences are the REALISED ones, computed from the batches that were actually screened,
    // not the round numbers the stages are named after.
    console.log(`  STAGE A  enriched (${prev(A)} eligible, pooled)   ${pct(...sumA)}   ${sumA[0]}/${sumA[1]} kept`)
    console.log(`  STAGE B  leaner   (${prev(B)} eligible, pooled)   ${pct(...sumB)}   ${sumB[0]}/${sumB[1]} kept`)
    console.log(`\n  PER REVIEW — the number the pooled row can hide:`)
    for (const r of A) {
        const b = B.find(x => x.pmid === r.pmid)
        console.log(`     ${r.title.slice(0, 42).padEnd(44)} A ${pct(r.kept, r.gold)} (${r.kept}/${r.gold})   B ${pct(b.kept, b.gold)} (${b.kept}/${b.gold})`)
    }
    const drop = (sumA[0] / sumA[1]) - (sumB[0] / sumB[1])
    console.log(`\n  ${drop > 0.1
        ? `Stage A WAS flattering it: recall falls ${Math.round(drop * 100)} points at ${prev(B)} eligible.\n  Believe stage B — and note stage B is itself about twice as generous as a real search.`
        : `Stage B holds up — the enriched batch was not flattering it. Neither stage reaches the ~3%\n  prevalence of a real search, so this is an upper bound on both counts.`}`)
    const dead = [...A, ...B].flatMap(r => r.binned)
    console.log(`\n  ${dead.length ? `${dead.length} known-included ${dead.length === 1 ? 'study was' : 'studies were'} thrown away across both stages: ${[...new Set(dead)].join(', ')}` : 'The screen threw away NOTHING in either stage.'}`)
    console.log(`\n  N is 3 reviews. Still a smoke alarm, not a thermometer.\n`)
    writeArtifact(A, B)
})().catch(e => { console.error(e); process.exit(1) })
