/*
 * THE QUESTION CHECK — does the strategy survive a question a real person would type?
 *
 *   node controllers/literatureSearch.question.js          (~$2.50)
 *
 * WHY THIS IS THE EXPERIMENT THAT MATTERS NOW.
 *
 * After the recall study and the screen study, the honest shape of Mode 1 is: THE BOOLEAN QUERY IS THE
 * DELIVERABLE. The relevance-ranked 50 is triage and the export says so; the AI screen is good but only
 * ever sees a sliver. The one artifact a librarian will actually rely on is the strategy — and its 99%
 * recall rests on THREE COCHRANE REVIEWS.
 *
 * That is a fragile place to stand, for a reason nobody has said out loud: THE BENCHMARK QUESTIONS WERE
 * WRITTEN BY READING THE REVIEWS. They are careful, complete, PICO-shaped restatements of a question a
 * Cochrane team had already spent months sharpening — clean population, clean comparator, protocol
 * written before the search. That is not what this tool will be given. It will be given a sentence typed
 * in twenty seconds by someone who has not decided what they are asking yet.
 *
 * So: hold EVERYTHING constant — same reviews, same gold PMIDs, same ceiling, same criteria — and change
 * ONLY the question. If recall holds, Mode 1 is ready for a pilot. If it collapses, then the tool's real
 * missing feature is not a better prompt, it is INTERROGATING THE QUESTION BEFORE IT SEARCHES.
 *
 * THE FOUR VARIANTS, degrading toward what people really type:
 *
 *   A  careful     the PICO-shaped question from the recall study. The baseline, and the best case.
 *   B  colloquial  the same question as a busy clinician would say it out loud. Faithful, unstructured.
 *   C  terse       keywords. No sentence, no comparator, no population.
 *   D  terse, and NO INCLUSION CRITERIA. The realistic floor: what the box actually gets on a bad day.
 *
 * B and C are DELIBERATELY FAITHFUL, not strawmen. A degraded question that also asks something
 * DIFFERENT (adding "in children", say) would confound vagueness with a changed question, and we would
 * learn nothing except that a different question retrieves different papers.
 *
 * READ TWO NUMBERS, NOT ONE. Recall is not the only way this fails. A vague question can hold recall and
 * still produce a strategy that yields 200,000 records — technically sensitive, practically unusable, and
 * a librarian would throw it away. So HITS is reported beside recall, and a big yield at high recall is
 * its own kind of failure.
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

// Keyed by review PMID so a re-ordered benchmark file cannot silently mis-pair a question with a gold list.
const VARIANTS = {
    // Intratympanic corticosteroids for sudden sensorineural hearing loss
    '35867413': {
        B: 'Do steroid injections into the ear actually work for sudden hearing loss?',
        C: 'intratympanic steroids sudden sensorineural hearing loss',
    },
    // Toe-brachial index / toe systolic pressure for peripheral arterial disease
    '39474992': {
        B: 'Is toe pressure any good for diagnosing PAD, especially in diabetics?',
        C: 'toe brachial index accuracy peripheral arterial disease',
    },
    // Educational and psychological interventions for atopic eczema
    '39132734': {
        B: 'Does teaching patients about their eczema actually help them manage it?',
        C: 'eczema education psychological intervention',
    },
}

const pct = (n, d) => (d === 0 ? ' n/a' : `${String(Math.round((n / d) * 100)).padStart(3)}%`)
const cost = t => t.inputTokens / 1e6 * 5.50 + t.outputTokens / 1e6 * 27.50

// WHICH COMMIT PRODUCED THIS NUMBER — same reasoning, same wrapper, as literatureSearch.recall.js: the
// strategy prompt is what this experiment is really measuring, so the artifact has to name the commit
// that held it. Wrapped because a tarball is not a git checkout and a $2.50 run must not die at the
// last line over it.
const gitSha = () => {
    try {
        return execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch (e) {
        return null
    }
}

// One [uid] query, not one count per PMID. NCBI's keyed quota is shared with the ReCiter engine.
async function retrieved(query, gold) {
    if (!query) return new Set()
    const uids = gold.map(p => `${p}[uid]`).join(' OR ')
    const found = await lit.fetchRecords(`(${uids}) AND (${query})`, gold.length, 'relevance')
    return new Set(found.map(r => r.pmid))
}

async function run(review, label, question, criteria) {
    let usage = { inputTokens: 0, outputTokens: 0 }
    try {
        // POSITIONAL, AND UNAVOIDABLY SO. buildStrategy() takes seven positional parameters and has no
        // options object, and its signature is NOT this script's to change — the API route and
        // literatureSearch.build.ts call it too, and a benchmark harness must not reshape production
        // code to suit itself. So the arguments are named here instead, because two `undefined`s and an
        // empty string in a row is exactly the call site that breaks in silence when a parameter is
        // inserted in the middle of that list: the run would still complete, and the recall number it
        // printed would be measuring something else.
        //
        //   question    the variant under test — the ONE thing this experiment changes
        //   limits      '' — no date or publication-type limits, same as the recall study
        //   criteria    the review's own eligibility criteria, or '' for variant D
        //   objective   'recall' — Mode 1, not Mode 2's precision prompt
        //   pico        undefined — free-text question, not the Mode 3 structured form
        //   db          'pubmed'
        //   sharedConcepts  undefined — single database, so there is no sibling spine to share
        const built = await lit.buildStrategy(question, '', criteria, 'recall', undefined, 'pubmed', undefined)
        usage = built.usage
        const query = lit.assembleQuery(built.strategy)
        const hits = await lit.countPubmed(query)
        const got = await retrieved(query, review.includedPmids)

        console.log(`\n  ${label}  "${question}"${criteria ? '' : '   [no criteria given]'}`)
        console.log(`     concepts: ${built.strategy.concepts.map(c => c.label).join(' AND ')}`)
        console.log(`     RECALL ${pct(got.size, review.includedPmids.length)}  ${got.size}/${review.includedPmids.length}` +
            `      YIELD ${hits.toLocaleString()} records      $${cost(usage).toFixed(2)}`)
        return {
            label,
            question,
            // The criteria this variant was actually given, because variant D differs from C ONLY in
            // this field and the artifact is unreadable if it does not say which was which.
            criteria,
            hits,
            recall: [got.size, review.includedPmids.length],
            concepts: built.strategy.concepts.length,
            query,
            // THE STRATEGY ITSELF, not just the number it scored. The model SAMPLES: re-running this
            // variant tomorrow produces a different strategy, so the one that earned this recall figure
            // cannot be regenerated — if it is not written down here it is gone, and the number has
            // nothing behind it. And the interesting failure mode of a vague question is not a low
            // score, it is WHICH CONCEPTS the model invented to fill the gap; that is only legible in
            // the blocks themselves, never in a percentage.
            strategy: built.strategy,
        }
    } catch (e) {
        // A REFUSAL IS A RESULT, AND A GOOD ONE. If the model declines to build a strategy from a
        // question too vague to support one, that is the tool behaving correctly — record it as such
        // rather than as a crash, because "it refuses the bad questions" is exactly the property we are
        // hoping to find.
        console.log(`\n  ${label}  "${question}"`)
        console.log(`     REFUSED: ${e.message}`)
        // No strategy and no query to record — there is no artifact when the model declines. `criteria`
        // still goes in, because C and D differ in nothing else and a refusal on one is not a refusal
        // on the other.
        return { label, question, criteria, refused: e.message, recall: [0, review.includedPmids.length] }
    }
}

;(async () => {
    const all = []
    for (const review of BENCH.reviews) {
        const v = VARIANTS[review.pmid]
        console.log(`\n${'='.repeat(90)}\n${review.title}\n  ${review.includedPmids.length} known includes · ceiling ${review.maxRecall}\n${'='.repeat(90)}`)
        const rows = []
        rows.push(await run(review, 'A careful  ', review.question, review.criteria))
        rows.push(await run(review, 'B colloquial', v.B, review.criteria))
        rows.push(await run(review, 'C terse    ', v.C, review.criteria))
        rows.push(await run(review, 'D terse,-crit', v.C, ''))
        all.push({ review: review.title, rows })
    }

    console.log(`\n\n${'#'.repeat(90)}\n# RESULT — recall (and yield) as the question degrades\n${'#'.repeat(90)}\n`)
    const header = ['A careful', 'B colloquial', 'C terse', 'D terse,-crit']
    console.log(`  ${'review'.padEnd(30)}${header.map(h => h.padEnd(15)).join('')}`)
    for (const { review, rows } of all) {
        const cells = rows.map(r => (r.refused ? 'REFUSED' : `${pct(...r.recall).trim()} / ${r.hits.toLocaleString()}`).padEnd(15))
        console.log(`  ${review.slice(0, 28).padEnd(30)}${cells.join('')}`)
    }
    const pooled = header.map((_, i) => all.reduce((a, x) => [a[0] + x.rows[i].recall[0], a[1] + x.rows[i].recall[1]], [0, 0]))
    console.log(`\n  ${'POOLED RECALL'.padEnd(30)}${pooled.map(p => `${pct(...p).trim()} (${p[0]}/${p[1]})`.padEnd(15)).join('')}`)

    const base = pooled[0][0] / pooled[0][1]
    const worst = pooled[3][0] / pooled[3][1]
    console.log(`\n  Careful question: ${Math.round(base * 100)}%.  Worst realistic input: ${Math.round(worst * 100)}%.`)
    console.log(`  ${base - worst < 0.1
        ? 'The strategy builder is ROBUST to how the question is phrased. The question is not the risk.'
        : `Recall falls ${Math.round((base - worst) * 100)} points on a question a real person would type.\n  The tool's missing feature is not a better prompt — it is INTERROGATING THE QUESTION before it searches.`}`)

    // Same metadata block as literatureSearch.recall.js, and for the same reason: a recall figure with
    // no timestamp, no commit and no model id cannot be attached to anything, and two runs a month
    // apart — with a prompt change between them — are indistinguishable in the file. `all` keeps its
    // key so the shape only gains a sibling.
    fs.writeFileSync(path.join(ROOT, '.litquestion-run.json'), JSON.stringify({
        metadata: {
            ranAt: new Date().toISOString(),
            gitSha: gitSha(),
            model: process.env.BEDROCK_MODEL_ID,
            region: process.env.AWS_REGION,
            benchmark: 'controllers/literatureSearch.recall.json',
            // The degraded questions are part of the instrument, not part of the tool, and they live in
            // this file rather than the benchmark — so an artifact that does not carry them cannot be
            // read against a later run whose variants were edited.
            variants: VARIANTS,
        },
        all,
    }, null, 2))
    console.log(`\n  full run (metadata, strategies, queries, yields) -> .litquestion-run.json\n`)
})().catch(e => { console.error(e); process.exit(1) })
