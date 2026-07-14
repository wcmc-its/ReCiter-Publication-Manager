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

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
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
const DEEP = 1000
async function ranksOf(query, gold) {
    const deep = await lit.fetchRecords(query, DEEP, 'relevance')
    const order = deep.map(r => r.pmid)
    return new Map(gold.map(p => [p, order.indexOf(p) < 0 ? null : order.indexOf(p) + 1]))
}

async function run(review) {
    const gold = review.includedPmids
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

    console.log(`\n  1. STRATEGY RECALL   ${pct(retrieved.size, gold.length)}   ${retrieved.size}/${gold.length} known includes retrieved by the query`)
    console.log(`  3. CAP LOSS          ${pct(cappedOut.length, retrieved.size)}   ${cappedOut.length}/${retrieved.size} retrieved but never shown (top-${lit.RECORD_CAP} of ${hits.toLocaleString()})`)
    console.log(`  2. SCREEN RECALL     ${pct(kept.length, reachedModel.length)}   ${kept.length}/${reachedModel.length} of those reaching the model were KEPT`)
    console.log(`     -> ${binned.length} known-good ${binned.length === 1 ? 'study was' : 'studies were'} EXCLUDED by the AI screen`)
    if (unscreened.length) console.log(`     -> ${unscreened.length} reached the model but came back with NO VERDICT (failed open)`)

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
        console.log(`\n  WHERE THEY RANK (of ${hits.toLocaleString()}, by PubMed relevance):`)
        console.log(`     best ${ranked[0]}  ·  median ${med}  ·  worst ${ranked[ranked.length - 1]}${beyond ? `  ·  ${beyond} rank below ${DEEP}` : ''}`)
        for (const cap of [50, 100, 200, 500, 1000]) {
            const n = ranked.filter(r => r <= cap).length
            console.log(`     a cap of ${String(cap).padStart(4)} would show the model ${String(n).padStart(2)}/${retrieved.size} (${pct(n, retrieved.size).trim()})`)
        }
    }

    const cost = (t) => t.inputTokens / 1e6 * 5.50 + t.outputTokens / 1e6 * 27.50
    console.log(`\n  cost: $${(cost(build) + cost(screen)).toFixed(2)}`)

    return {
        title: review.title,
        gold: gold.length,
        hits,
        query,
        strategyRecall: [retrieved.size, gold.length],
        capLoss: [cappedOut.length, retrieved.size],
        screenRecall: [kept.length, reachedModel.length],
        endToEnd: [kept.length, gold.length],
        binned,
        unscreened: unscreened.length,
        ranks: Object.fromEntries(rank),
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
    const artifact = path.join(ROOT, '.litrecall-run.json')
    fs.writeFileSync(artifact, JSON.stringify({ model: process.env.BEDROCK_MODEL_ID, reviews: out }, null, 2))
    console.log(`  full run (queries, ranks, verdicts) -> ${artifact}\n`)
})().catch(e => { console.error(e); process.exit(1) })
