/*
 * THE RECALL CHECK — the one measurement this feature has never had.
 *
 *   node controllers/literatureSearch.recall.js
 *
 * Every other check in this repo asserts that a number we PRINT is the number PubMed HAS. None of
 * them can tell you the only thing a librarian actually needs to know: does this tool find the
 * papers, and does it then throw them away again?
 *
 * That question is invisible by construction. A wrong INCLUDE costs a reader ten seconds — they see
 * the row, they read the reason, they untick it. A wrong EXCLUDE renders as a considered judgement
 * ("Exclude — not an RCT"), leaves no artifact, trips no guard, appears in no log, and is never
 * counted. The librarian moves on. The study is simply gone, and the .xlsx that carries that verdict
 * goes into Covidence, where it is treated as a screening pass.
 *
 * So: take published systematic reviews whose INCLUDED STUDIES ARE ALREADY KNOWN, put their question
 * through Mode 1, and count what we lose. The reviews and their gold-standard PMIDs live in
 * literatureSearch.recall.json beside this file.
 *
 * THREE NUMBERS, and the middle one is the one nobody has ever looked at:
 *
 *   1. STRATEGY RECALL   of the review's known includes, how many does our query retrieve AT ALL?
 *                        This is the ceiling. Nothing downstream can recover a paper missed here.
 *
 *   2. SCREEN RECALL     of the ones that reached the model, how many did it KEEP?
 *                        The invisible one. Every point lost here is a paper the tool found, showed
 *                        to a model, and silently binned.
 *
 *   3. CAP LOSS          how many known includes the strategy retrieved but the top-50 relevance cut
 *                        never showed the model in the first place.
 *                        Not a bug — a DESIGN CONSEQUENCE, and the number that says whether a
 *                        50-of-N sample may honestly be called a screen. It is reported separately
 *                        because blaming the model for these would be blaming it for a paper it was
 *                        never shown.
 *
 * WHY THIS IS NOT IN `npm run check:literature`: that check is free, needs no LLM, and therefore gets
 * run. This one calls Bedrock and costs real money (~$0.40/review), so it is a deliberate, separate,
 * human-invoked act. Keep it that way — a check that costs a dollar to run is a check nobody runs.
 *
 * WHAT THIS IS NOT: a benchmark to tune against. N is tiny, the gold lists have a documented ceiling
 * (see `caveats` — some included studies are not PubMed-indexed AT ALL and no PubMed strategy could
 * ever retrieve them), and three reviews cannot speak for a literature. It is a smoke alarm, not a
 * thermometer. It exists to tell a librarian whether this tool is safe to point at a real review.
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
// Same reason as the check: the controller imports @aws-sdk/client-bedrock-runtime at module scope,
// and node resolves node_modules by walking UP from the required file. Compile inside the worktree
// or the require dies with MODULE_NOT_FOUND. .litcheck/ is gitignored.
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

if (!lit.bedrockConfigured()) {
    console.error('BEDROCK_MODEL_ID / AWS_REGION are not set in .env.local. This check needs a real model.')
    process.exit(1)
}

const BENCHMARKS = JSON.parse(fs.readFileSync(path.join(__dirname, 'literatureSearch.recall.json'), 'utf8'))

const pct = (n, d) => (d === 0 ? '  n/a' : `${String(Math.round((n / d) * 100)).padStart(3)}%`)

// WHICH COMMIT PRODUCED THIS NUMBER. A recall figure is only meaningful against the prompt, the
// ceilings and the ranking code that were live when it was measured — change the strategy prompt and
// the same artifact is now a record of something else. Wrapped because a tarball, a vendored copy or
// a Docker context is not a git checkout, and a measurement that costs a dollar must not die at the
// last line because it could not find out what commit it is. A null SHA is a worse artifact than a
// real one, and both are better than no artifact.
const gitSha = () => {
    try {
        return execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch (e) {
        return null
    }
}

// A single [uid] query, not one count per PMID. The naive form of this check costs one NCBI call per
// known include (40 reviews x 30 studies = 1,200 calls) and NCBI's keyed quota IS SHARED WITH THE
// RECITER ENGINE — a recall check that throttles the nightly ETL is not a check, it is an outage. So
// OR the whole gold list into one query, AND it against the strategy, and read back the survivors.
// One call, and the answer is exact rather than a count we have to trust.
async function retrievedBy(query, gold) {
    const uids = gold.map(p => `${p}[uid]`).join(' OR ')
    const found = await lit.fetchRecords(`(${uids}) AND (${query})`, gold.length, 'relevance')
    return new Set(found.map(r => r.pmid))
}

// WHERE DOES A KNOWN-GOOD STUDY ACTUALLY RANK?
//
// The first run of this check returned a flat ZERO — not one of 72 retrieved known-includes appeared
// in the top 50. A zero that round invites the obvious reply, "then just raise the cap", so this
// answers it with a number instead of an argument: pull a deep relevance-ordered slice and report
// where the known-good studies actually LAND. If they sit at rank 900 of 3,168, no cap a human would
// tolerate reaches them and the ranking itself is the wrong instrument. One call, no model.
//
// A NULL RANK IS NOT A RANK OF INFINITY, AND IT IS NOT ONE FACT — it is the ABSENCE of the study from
// the first DEEP records of this query, and it cannot tell these three apart:
//
//   - the study ranks DEEP+1 or worse but the query does retrieve it;
//   - the query never retrieved it at all (a strategy miss, already counted separately above);
//   - the deep fetch came back short of DEEP for a reason of its own (a tool cap, a truncated page).
//
// Raising DEEP moves that boundary, it does not remove it, so DEEP stays where it is and the LABELS
// below say what was actually measured — "appears in the first 1000" — instead of implying a rank
// over the whole yield that we never computed.
const DEEP = 1000
async function ranksOf(query, gold) {
    const deep = await lit.fetchRecords(query, DEEP, 'relevance')
    const order = deep.map(r => r.pmid)
    return new Map(gold.map(p => [p, order.indexOf(p) < 0 ? null : order.indexOf(p) + 1]))
}

async function run(review) {
    const gold = review.includedPmids

    // A DUPLICATE PMID IN A GOLD LIST DEFLATES EVERY RECALL NUMBER IN THIS FILE, SILENTLY. `retrieved`
    // is a Set and de-duplicates; `gold.length` does not, so the same study counted twice adds one to
    // the denominator and nothing to the numerator, and the tool reads worse for a reason that is in
    // the fixture. THROW rather than de-duplicate: a repeated PMID means the included-studies list was
    // parsed wrong (the ref-list slice caught a secondary report, say), and quietly repairing it here
    // would hide the one mistake that invalidates every number downstream.
    const dupes = [...new Set(gold.filter((p, i) => gold.indexOf(p) !== i))]
    if (dupes.length) {
        throw new Error(`"${review.title}": includedPmids contains duplicate PMID(s) — ${dupes.join(', ')}. `
            + `A gold list with repeats deflates recall against a denominator that is wrong. Fix the benchmark.`)
    }

    console.log(`\n${'='.repeat(78)}\n${review.title}\n  PMID ${review.pmid} — ${gold.length} known includes\n  Q: ${review.question}\n${'='.repeat(78)}`)

    // Mode 1, exactly as the route drives it: no limits, recall objective, PubMed.
    const { strategy, usage: build } = await lit.buildStrategy(review.question, '', review.criteria || '', 'recall', undefined, 'pubmed', undefined)
    const query = lit.assembleQuery(strategy)
    const hits = await lit.countPubmed(query)
    console.log(`\n  strategy: ${strategy.concepts.length} concepts, ${hits.toLocaleString()} hits`)
    console.log(`  ${strategy.concepts.map(c => c.label).join(' AND ')}`)

    // (1) STRATEGY RECALL — the ceiling.
    const retrieved = await retrievedBy(query, gold)
    const missedByStrategy = gold.filter(p => !retrieved.has(p))

    // The top 50 by relevance: precisely what the librarian is shown and what the model screens.
    const top = await lit.fetchRecords(query, lit.RECORD_CAP, 'relevance')
    const shown = new Set(top.map(r => r.pmid))

    // (3) CAP LOSS — retrieved by the query, but never shown to the model. Kept apart from the
    // screen's own errors on purpose: the model cannot exclude what it was never handed.
    const cappedOut = [...retrieved].filter(p => !shown.has(p))
    const reachedModel = [...retrieved].filter(p => shown.has(p))

    // (2) SCREEN RECALL — the invisible one.
    const { flags, usage: screen } = await lit.screenRecords(review.question, review.criteria || '', top)
    const verdict = new Map(flags.map(f => [f.pmid, f]))
    const binned = reachedModel.filter(p => verdict.get(p) && verdict.get(p).include === false)
    const kept = reachedModel.filter(p => verdict.get(p) && verdict.get(p).include === true)
    // A gold study the model never returned a verdict for. It fails OPEN, so it is not LOST — but it
    // is also not endorsed, and `screened: false` is the only thing that says so.
    const unscreened = reachedModel.filter(p => !verdict.get(p) || verdict.get(p).screened === false)

    // ONE MINUS SCREEN RECALL IS NOT ONE FAILURE, IT IS THREE, AND THEY HAVE THREE DIFFERENT FIXES.
    // A study the model READ AND EXCLUDED is a judgement error — that is a prompt or a model problem.
    // A study that came back with NO VERDICT is a completeness error — lost-in-the-middle, and it is
    // REPAIRABLE by re-asking, which is what screenRecords() already does. A study that came back with
    // no flag object AT ALL would be a harness or contract error — screenRecords() builds one flag per
    // record it was handed, so this bucket should always be zero and it is reported precisely so that
    // a non-zero one cannot hide inside "not kept". Pooling the three tells a reader the screen is bad
    // without telling them which thing to go and fix.
    const noFlag = reachedModel.filter(p => !verdict.get(p))
    // The disjoint half of KEPT: an include the model actually GAVE, as opposed to one the fail-open
    // default handed out on its behalf.
    const endorsed = kept.filter(p => verdict.get(p).screened !== false)

    console.log(`\n  1. STRATEGY RECALL   ${pct(retrieved.size, gold.length)}   ${retrieved.size}/${gold.length} known includes retrieved by the query`)
    console.log(`  3. CAP LOSS          ${pct(cappedOut.length, retrieved.size)}   ${cappedOut.length}/${retrieved.size} retrieved but never shown (top-${lit.RECORD_CAP} of ${hits.toLocaleString()})`)
    console.log(`  2. SCREEN RECALL     ${pct(kept.length, reachedModel.length)}   ${kept.length}/${reachedModel.length} of those reaching the model were KEPT`)
    console.log(`     -> ${binned.length} known-good ${binned.length === 1 ? 'study was' : 'studies were'} EXCLUDED by the AI screen`)
    // The breakdown, against the SAME denominator as the percentage above it so the columns can be
    // read together. KEPT / EXCLUDED / NO FLAG partition that denominator; NO VERDICT does NOT — those
    // records fail open, so they are already counted inside KEPT, and that is stated rather than left
    // for the reader to derive from a sum that does not add up.
    console.log(`     of the ${reachedModel.length} that reached the model:  KEPT ${kept.length} ${pct(kept.length, reachedModel.length).trim()}`
        + `  ·  EXCLUDED ${binned.length} ${pct(binned.length, reachedModel.length).trim()}`
        + `  ·  NO VERDICT ${unscreened.length} ${pct(unscreened.length, reachedModel.length).trim()}`
        + `  ·  NO FLAG AT ALL ${noFlag.length} ${pct(noFlag.length, reachedModel.length).trim()}`)
    console.log(`       (NO VERDICT fails OPEN and is therefore counted inside KEPT as well: of the ${kept.length} kept, `
        + `${endorsed.length} carry an include the model actually gave. KEPT is an UPPER bound.)`)

    // END TO END: of everything the review included, what survives to the librarian's screen ticked?
    console.log(`\n  END TO END           ${pct(kept.length, gold.length)}   ${kept.length}/${gold.length} known includes survive question -> strategy -> cap -> screen`)

    // NAME THE DEAD. A percentage is arguable; a PMID with a title and the model's own words is not,
    // and the exclusion reasons are the only place the failure mode is legible to a human.
    if (binned.length) {
        console.log(`\n  THE AI SCREEN THREW THESE AWAY. Each one is a paper the review's authors INCLUDED:`)
        for (const p of binned) {
            const r = top.find(x => x.pmid === p)
            console.log(`    ${p}  ${(r && r.title ? r.title : '(no title)').slice(0, 82)}`)
            console.log(`            reason given: "${verdict.get(p).reason}"`)
        }
    }
    if (missedByStrategy.length) {
        console.log(`\n  the strategy never retrieved these ${missedByStrategy.length}: ${missedByStrategy.join(', ')}`)
        if (review.caveats) console.log(`    (ceiling: ${review.caveats})`)
    }

    // WOULD A BIGGER CAP SAVE IT? The question every reader will ask on seeing the cap loss.
    const rank = await ranksOf(query, [...retrieved])
    const ranked = [...retrieved].map(p => rank.get(p)).filter(Boolean).sort((a, b) => a - b)
    const beyond = retrieved.size - ranked.length
    if (ranked.length) {
        const med = ranked[Math.floor(ranked.length / 2)]
        // Every number on these lines is a position WITHIN THE FIRST 1000 records this query returns,
        // not a rank over the whole yield — the deep slice is all we fetched, and the label says so.
        console.log(`\n  WHERE THEY RANK WITHIN THE FIRST ${DEEP} (the query yields ${hits.toLocaleString()}; ranked by PubMed relevance):`)
        console.log(`     ${ranked.length}/${retrieved.size} retrieved known-includes appear in the first ${DEEP}` +
            `${beyond ? `; the other ${beyond} do NOT (see the note on DEEP — that is not the same as "unranked")` : ''}`)
        console.log(`     of those ${ranked.length}:  best ${ranked[0]}  ·  median ${med}  ·  worst ${ranked[ranked.length - 1]}`)
        for (const cap of [50, 100, 200, 500, 1000]) {
            const n = ranked.filter(r => r <= cap).length
            console.log(`     a cap of ${String(cap).padStart(4)} would show the model ${String(n).padStart(2)}/${retrieved.size} (${pct(n, retrieved.size).trim()})`)
        }
    }

    const cost = (t) => t.inputTokens / 1e6 * 5.50 + t.outputTokens / 1e6 * 27.50
    console.log(`\n  cost: $${(cost(build) + cost(screen)).toFixed(2)}`)

    return {
        title: review.title,
        pmid: review.pmid,
        gold: gold.length,
        hits,
        query,
        // The STRATEGY, not only the query string it assembles to. Re-running is a paid Bedrock call
        // and the model samples, so the strategy that produced these numbers cannot be regenerated —
        // if it is not in the artifact it is gone, and the recall figure has nothing behind it.
        strategy,
        // The criteria the screen was actually given. The same question with different criteria is a
        // different experiment, and this is the field that says which one was run.
        criteria: review.criteria || '',
        strategyRecall: [retrieved.size, gold.length],
        capLoss: [cappedOut.length, retrieved.size],
        screenRecall: [kept.length, reachedModel.length],
        endToEnd: [kept.length, gold.length],
        binned,
        unscreened: unscreened.length,
        // The same breakdown the console prints, so a reader of the JSON is not left to infer which of
        // the three failures produced the screen-recall number.
        screenOutcomes: {
            reachedModel: reachedModel.length,
            kept: kept.length,
            excluded: binned.length,
            noVerdict: unscreened.length,
            noFlag: noFlag.length,
            endorsed: endorsed.length,
        },
        ranks: Object.fromEntries(rank),
        // What a null in `ranks` means. Without this the file cannot be read correctly six months
        // later: null is "not in the first 1000 of this query", never "unranked" and never "missing".
        rankDepth: DEEP,
    }
}

;(async () => {
    const out = []
    // SERIAL, not parallel. The tool owns the NCBI rate policy and we do not get to reinterpret it
    // from a test harness — see the standing rule about never parallelising RPM's count calls.
    for (const review of BENCHMARKS.reviews) out.push(await run(review))

    console.log(`\n\n${'#'.repeat(78)}\n# SUMMARY\n${'#'.repeat(78)}\n`)
    const sum = (f) => out.reduce((a, r) => [a[0] + f(r)[0], a[1] + f(r)[1]], [0, 0])
    for (const r of out) {
        console.log(`  ${r.title.slice(0, 46).padEnd(48)} strategy ${pct(...r.strategyRecall)}  screen ${pct(...r.screenRecall)}  e2e ${pct(...r.endToEnd)}`)
    }
    const S = sum(r => r.strategyRecall), C = sum(r => r.screenRecall), E = sum(r => r.endToEnd)
    console.log(`\n  ${'POOLED'.padEnd(48)} strategy ${pct(...S)}  screen ${pct(...C)}  e2e ${pct(...E)}`)
    console.log(`\n  ${S[0]}/${S[1]} known includes retrieved. Of the ones the model saw, it kept ${C[0]}/${C[1]}.`)

    // The pooled breakdown, because "it kept C[0] of C[1]" is one figure covering three different
    // failures with three different fixes — and the pooled row is exactly where that gets forgotten.
    const O = out.reduce((a, r) => ({
        excluded: a.excluded + r.screenOutcomes.excluded,
        noVerdict: a.noVerdict + r.screenOutcomes.noVerdict,
        noFlag: a.noFlag + r.screenOutcomes.noFlag,
        endorsed: a.endorsed + r.screenOutcomes.endorsed,
    }), { excluded: 0, noVerdict: 0, noFlag: 0, endorsed: 0 })
    console.log(`  of those ${C[1]}:  KEPT ${C[0]}  ·  EXCLUDED ${O.excluded}  ·  NO VERDICT ${O.noVerdict} (fails open, counted inside KEPT)  ·  NO FLAG AT ALL ${O.noFlag}`)
    console.log(`  ${O.endorsed} of the ${C[0]} kept carry an include the model actually gave.`)

    const dead = out.flatMap(r => r.binned)
    if (dead.length) {
        console.log(`\n  ${dead.length} PUBLISHED-REVIEW-INCLUDED ${dead.length === 1 ? 'STUDY WAS' : 'STUDIES WERE'} EXCLUDED BY THE AI SCREEN.`)
        console.log(`  Those exclusions are invisible in the product. A librarian would never know.`)
    } else {
        console.log(`\n  The AI screen excluded NO known-good study in this run.`)
    }
    console.log(`\n  N is ${out.length} reviews. This is a smoke alarm, not a thermometer.\n`)

    // The run costs a dollar and a Bedrock round-trip. Nobody should have to pay it again just to
    // re-read the result, or to check whether a number in a summary was really measured.
    //
    // AND THE NUMBERS ARE NOT ENOUGH ON THEIR OWN. A recall figure with no timestamp, no commit and no
    // model id is a number nobody can attach to anything: two runs a month apart are indistinguishable
    // in the file, and a prompt change between them is invisible. So the artifact opens with a
    // METADATA block naming the run — when, which commit, which model, which ceilings, which benchmark
    // — and the per-review results move under `reviews`. That key is deliberately unchanged:
    // literatureSearch.screen.js reads `RUN.reviews[].query` and `RUN.reviews[].ranks` out of this
    // file, and a rename here would break the next experiment rather than this one.
    const artifact = path.join(ROOT, '.litrecall-run.json')
    fs.writeFileSync(artifact, JSON.stringify({
        metadata: {
            ranAt: new Date().toISOString(),
            gitSha: gitSha(),
            model: process.env.BEDROCK_MODEL_ID,
            region: process.env.AWS_REGION,
            // The two ceilings that decide what the numbers can even mean: the cap is what the model
            // was shown, the rank depth is how far we looked for the rest.
            recordCap: lit.RECORD_CAP,
            rankDepth: DEEP,
            benchmark: 'controllers/literatureSearch.recall.json',
            reviews: BENCHMARKS.reviews.map(r => ({
                pmid: r.pmid,
                title: r.title,
                gold: r.includedPmids.length,
                // The documented indexing ceiling. Judging the strategy against 100% instead of this
                // is the single easiest way to misread the whole artifact.
                maxRecall: r.maxRecall,
                criteria: r.criteria || '',
            })),
        },
        reviews: out,
    }, null, 2))
    console.log(`  full run (metadata, queries, strategies, ranks, verdicts) -> ${artifact}\n`)
})().catch(e => { console.error(e); process.exit(1) })
