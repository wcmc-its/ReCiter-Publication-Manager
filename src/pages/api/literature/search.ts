// POST /api/literature/search — Modes 1 ("Search strategy") and 2 ("Issue review").
//
// FIVE PATHS, ONE ROUTE, branched on `phase` and `mode`:
//
//   MODE 1
//   - no `strategy` in the body  -> BUILD. Calls the model once, counts, validates the seeds,
//     and proposes a verified+priced widening for anything it missed.
//   - a `strategy` in the body   -> RE-COUNT. The librarian ticked, unticked or edited a line.
//     Calls NO model: runStrategy() is assembleQuery -> countPubmed -> validateSeeds, and
//     nothing else. So iterating a strategy costs one count for the yield plus one per seed —
//     a librarian can work on it all afternoon for free, which is the entire point of the
//     checkboxes.
//
//   MODE 2 — three POSTs, because there is a human between each pair of them.
//   - mode:'issue-review'  -> BUILD + FETCH. Precision strategy, count, then up to 50 records —
//     UNLESS the count says the 50 would be a thin slice of the yield (NARROW_ABOVE), in which case
//     it comes back with priced narrowings and no records, for the librarian to choose from. Two
//     ways in, and they differ by ONE field:
//       * no `strategy`                    -> the model drafts one. The only model call in phase 1.
//       * `strategy` + `proceed: true`     -> NO MODEL. Runs the strategy the librarian is looking
//         at, skips the gate, and retrieves the top 50 whatever the count. That is the escape
//         hatch: "retrieve the top 50 anyway", and it must ALWAYS work. A tool that refuses to run
//         is worse than one that warns. (A `strategy` WITHOUT `proceed` is a re-count — see below.
//         `proceed` is the discriminator, and it has to be, because both paths post a strategy.)
//   - phase:'screen'       -> SCREEN the records, one model call over all 50.
//   - phase:'synthesize'   -> SYNTHESIZE the records the human ticked.
//     Phases 2 and 3 take PMIDs and RE-FETCH the abstracts server-side. They never accept record
//     text from the browser: that would be a client-controlled text-injection surface into a paid
//     model call, and it would let a tampered page produce a synthesis of abstracts PubMed never
//     published — while the page still showed the real PMIDs next to it.
//
// THREE PLAIN POSTS, NO STREAMING. The long call (synthesis, measured 47s) blocks, and that is
// fine: the ALB idle timeout is a live-verified 500s. SSE/InvokeModelWithResponseStream was
// considered and rejected — it buys a progress bar and costs a state machine on both sides.
//
// ponytail: a branch, not five routes. The paths differ by a handful of lines each; separate
// endpoints would have duplicated the session auth below — the only auth of its kind in RPM —
// five times, and every copy is a chance to forget it on a route that spends money.
//
// AUTH IS DIFFERENT HERE, DELIBERATELY. Every other API route in this repo compares
// req.headers.authorization to reciterConfig.backendApiKey, which resolves to
// NEXT_PUBLIC_RECITER_BACKEND_API_KEY — a value compiled into the browser bundle. That is
// a shape check, not authentication. It is survivable for reads against our own DB; it is
// NOT survivable for a route that spends institutional money on every call.
//
// There was no route to copy: as of this commit, zero API routes in RPM gate on the
// session. (Two call getToken(), but only to resolve a CWID for attribution — neither
// rejects a missing token.) So this is the first, and it does two things nothing else does:
//   1. Requires a valid next-auth session (getToken), 401 without one.
//   2. Requires the CWID to be in LITERATURE_SEARCH_CWIDS.
//
// ponytail: an env allowlist rather than a new admin_role row. A real role costs a schema
// change in three places (prod reciterDB, dev reciterDB, ReCiterDB repo) plus middleware
// and Manage Users wiring — too much ceremony for a 2-3 person pilot. Ceiling: membership
// changes need a deploy. Promote to a proper Librarian role when this graduates.
// Do NOT fall back to Reporter_All: that is a broad population, and this route spends a budget.

import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import {
    buildStrategy,
    runStrategy,
    runReview,
    fetchByPmids,
    screenRecords,
    synthesize,
    bedrockConfigured,
    buildSearchStrategy,
    meshFromConcepts,
    RECORD_CAP,
    countRows,
    countIn,
    assembleQuery,
    Strategy,
    Sort,
    UsageLog,
    withTimeout,
    MODEL_TIMEOUT_MS,
    wasSearched,
    hasFailed,
    // ---- Mode 4 (bibliometric review), Phases 1-8. See the four handleM4* functions below for
    // how these compose — the phase split there mirrors this import list, one group per phase.
    PubRecord,
    fetchCorpus,
    excludeCaseReports,
    flagProbableCaseSeries,
    excludeCaseSeries,
    filterByEvidenceTiers,
    yearRangeFor,
    publicationsPerYear,
    evidenceMixByYear,
    journalDistribution,
    percentileTrend,
    Cluster,
    clusterByMesh,
    labelClusters,
    impactScoreOf,
    preFilterForScoring,
    scoreRelevance,
    scoreImpact,
    ClusterNarrative,
    synthesizeCluster,
    assembleNarrativeReview,
} from '../../../../controllers/literatureSearch.controller'
import {
    buildLimits, picoQuestion, picoComplete, parseSeeds, DIALECTS,
    MAX_CONCEPTS, MAX_LINES, MAX_TERMS,
    Pico, Db, Seed, Rendering,
} from '../../../../controllers/literatureSearch.strategy'
import { findWcmExperts } from '../../../../services/db/wcmExperts.service'
import { isAllowlisted } from '../../../../controllers/literatureAllowlist'

// Next's default request-body limit (1mb) is fine for Modes 1-3 — a 50-record PMID list or an
// edited strategy is a few KB. Mode 4's corpus echo (see the file-level comment above
// handleM4Retrieve) is metadata for a decade-scale corpus, a few thousand records without
// abstracts — comfortably under this raised limit, nowhere near the default.
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } }

// Usage visibility. One structured line per model call; grep the pod logs.
//
// NOTE: the question text is deliberately NOT logged — see the data-handling section of the spec.
//
// THIS DELIBERATELY LOGS NO DOLLAR FIGURE, and that is the whole design. A token count is a
// DURABLE fact about what we did; a price is a VOLATILE fact owned by AWS, which changes without
// telling us. Bake the volatile one into the log and a rate change silently rots every past line.
// Log the durable one and any dollar question can be answered later, at whatever the rate turns
// out to be — which is exactly what saved us here: this route logged `5/25` per Mtok for months,
// the real us-east-1 rate for a `us.` profile was 5.50/27.50, and every figure it had ever emitted
// was 10% light. It was recoverable ONLY because `model` and the token counts were on the line.
//
// So: totals come from Cost Explorer filtered to Bedrock — authoritative, self-updating, and
// structurally incapable of being 10% wrong. What Cost Explorer CANNOT tell you is "Mode 2 costs
// ~16x Mode 1", because it has never heard of a cwid or a mode. That is what these lines are for.
// To answer it, multiply the tokens below by the rate of the day:
//
//   aws pricing get-products --region us-east-1 --service-code AmazonBedrockFoundationModels \
//     --filters 'Type=TERM_MATCH,Field=regionCode,Value=us-east-1'
//   # servicename == "Claude Opus 4.8 (Amazon Bedrock Edition)"; a `us.` profile bills the
//   # "Regional CRIS" tier, NOT "Global" — the two differ by 10%.
//
// Never show a cost to the librarian either way: iteration is the behaviour we want, and a running
// meter teaches them to ration it.
function logCost(mode: string, cwid: string, usage: UsageLog, extra: Record<string, any> = {}) {
    console.log(JSON.stringify({
        tag: 'literature-search',
        mode,
        model: process.env.BEDROCK_MODEL_ID,    // the rate is a function of THIS — so price it later
        cwid,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        ...extra,
    }))
}

// The PMIDs the browser sends back on phases 2 and 3. They go straight into a PubMed query, so
// they are validated to digits — and they are capped at RECORD_CAP, because the cap is what bounds
// the context window and therefore the bill. A page that asks us to screen 500 records is not a
// page we wrote.
function parsePmids(raw: any): string[] {
    const ids = (Array.isArray(raw) ? raw : [])
        .map((p: any) => String(p ?? '').trim())
        .filter((p: string) => /^\d+$/.test(p))
    if (!ids.length) throw new Error('No records were selected.')
    if (ids.length > RECORD_CAP) throw new Error(`At most ${RECORD_CAP} records can be processed at once.`)
    return Array.from(new Set(ids))
}

// The re-count path takes a strategy straight from the browser and puts its text into a PubMed
// query, so it is a trust boundary and gets a real guard. The bounds are not paranoia about the
// librarian: each toggle costs 1 + N count calls, so a strategy with 200 lines in it would turn
// one keystroke into a burst that trips NCBI's rate limit for everyone on the pod.
//
// The bounds themselves live in literatureSearch.strategy.ts, next to RECORD_CAP, because the
// MODEL's output has to be held to the same ones. It was not: buildStrategy() applied none of them,
// so the server would happily build, count and render a strategy it then REFUSED to re-count — a
// paid-for strategy that 502s on the first checkbox. One definition, both ends.
function parseStrategy(raw: any): Strategy {
    if (!raw || !Array.isArray(raw.concepts) || !raw.concepts.length || raw.concepts.length > MAX_CONCEPTS) {
        throw new Error('malformed strategy')
    }
    const concepts: Rendering[] = raw.concepts.map((c: any) => {
        if (!Array.isArray(c?.lines) || c.lines.length > MAX_LINES) throw new Error('malformed strategy')
        return {
            label: String(c.label ?? '').slice(0, 120),
            lines: c.lines.map((l: any) => {
                const terms = String(l?.terms ?? '')
                if (terms.length > MAX_TERMS) throw new Error('a strategy line is too long')
                return {
                    terms,
                    on: !!l?.on,
                    ...(l?.suggestedFor ? { suggestedFor: String(l.suggestedFor).slice(0, 20) } : {}),
                    ...(Number.isFinite(l?.costRecords) ? { costRecords: Number(l.costRecords) } : {}),
                }
            }),
        }
    })
    // WHICH DATABASE the posted strategy belongs to. Resolved to a known Db, never trusted as text:
    // an unknown value falls back to PubMed rather than reaching a dialect lookup that is not there.
    const db: Db = raw?.db === 'scopus' ? 'scopus' : 'pubmed'
    // Limits are resolved from ids server-side (see buildLimits) and never accepted as text —
    // otherwise a re-count could run a query the build path could not have produced. They are
    // resolved in THIS database's syntax, so a Scopus re-count cannot end up carrying PubMed limits.
    return { db, concepts, limits: buildLimits(db, String(raw.dateId ?? ''), String(raw.typeId ?? '')).terms }
}


// The shared shape every extracted workflow function receives: the fields the handler destructures
// from req.body, plus seedList — parsed and bounds-checked once in the shared prefix below, because
// two of the six workflows (RE-COUNT and BUILD) need it and it must never be parsed twice.
type SearchBody = {
    mode: any
    phase: any
    question: any
    criteria: any
    seeds: any
    dateId: any
    typeId: any
    sort: any
    pmids: any
    proceed: any
    pico: any
    databases: any
    edited: any
    seedList: Seed[]
    // ---- Mode 4 only. `corpus`/`clusters`/`scores` are ECHOED BACK by the client between phases
    // — see the handleM4* functions below for why that is safe (never abstract text, always
    // re-fetched by PMID before a Bedrock call touches it) and bounded (parseM4Corpus).
    evidenceTiers: any
    caseSeries: any
    corpus: any
    clusters: any
    scores: any
    // Echoed back on every POST after the first, from POST 1's own response — so Phase 4's
    // recomputed stats and the final assembleNarrativeReview() call describe the SAME window the
    // corpus was actually pulled for, not a guessed default. See handleM4Synthesize's fallback for
    // what happens if either arrives malformed: the same 10-years-ending-now default yearRangeFor()
    // itself would have picked for a 'not sent' dateId.
    fromYear: any
    toYear: any
}

// ---- SCREEN (Mode 2, phase 2). -----------------------------------------------------------------
async function handleScreen(req: NextApiRequest, res: NextApiResponse, cwid: string, body: SearchBody) {
    const { question, criteria, pmids, mode } = body
    if (!bedrockConfigured()) {
        return res.status(503).send({ statusCode: 503, message: 'Literature Search is not configured on this environment.' })
    }
    if (!question || !String(question).trim()) {
        return res.status(400).send({ statusCode: 400, message: 'A question is required.' })
    }
    try {
        const ids = parsePmids(pmids)
        // RE-FETCHED, never taken from the client. If PubMed will not give us the records back
        // there is nothing honest to screen, so this one IS fatal — unlike Mode 1's seed
        // records, where a miss costs a label and the strategy still stands.
        const records = await fetchByPmids(ids)
        if (!records.length) throw new Error('Could not re-fetch these records from PubMed.')

        // Screening is screening in both modes — an abstract either meets the criteria or it
        // does not, and the mode does not change that. Only the cost label differs.
        const { flags, usage } = await screenRecords(String(question), String(criteria || ''), records)
        logCost(`${mode === 'clinical-question' ? 'clinical-question' : 'issue-review'}:screen`, cwid, usage, {
            records: records.length,
            included: flags.filter(f => f.include).length,
        })
        return res.status(200).send({ statusCode: 200, flags })
    } catch (err: any) {
        console.error('[literature] screening failed:', err)
        return res.status(502).send({ statusCode: 502, message: err?.message || 'Screening failed.' })
    }
}

// ---- SYNTHESIZE (Mode 2, phase 3). -------------------------------------------------------------
async function handleSynthesize(req: NextApiRequest, res: NextApiResponse, cwid: string, body: SearchBody) {
    const { question, pmids, mode } = body
    if (!bedrockConfigured()) {
        return res.status(503).send({ statusCode: 503, message: 'Literature Search is not configured on this environment.' })
    }
    if (!question || !String(question).trim()) {
        return res.status(400).send({ statusCode: 400, message: 'A question is required.' })
    }
    try {
        const ids = parsePmids(pmids)
        const records = await fetchByPmids(ids)
        if (!records.length) throw new Error('Could not re-fetch these records from PubMed.')

        // THIS is where Mode 3 diverges: a PICO answer instead of a survey, over records the
        // server has ordered by their derived evidence tier. The model never ranks.
        const synthMode = mode === 'clinical-question' ? 'clinical-question' : 'issue-review'
        const { synthesis, usage } = await synthesize(String(question), records, synthMode)
        logCost(`${synthMode}:synthesize`, cwid, usage, {
            records: records.length,
            tableRows: synthesis.table.length,
        })
        // cwid + date are returned so the page can stamp the synthesis with who ran it and
        // when. An AI-assisted paragraph that ends up pasted into a document needs to say
        // where it came from, and the client cannot be trusted to know the server's date.
        return res.status(200).send({
            statusCode: 200,
            synthesis,
            cwid,
            date: new Date().toISOString().slice(0, 10),
            model: process.env.BEDROCK_MODEL_ID,
        })
    } catch (err: any) {
        console.error('[literature] synthesis failed:', err)
        return res.status(502).send({ statusCode: 502, message: err?.message || 'Synthesis failed.' })
    }
}

// ---- THE RESULTS COLUMN. A record count per PRESS line, fetched on its own. --------------------
async function handleRows(req: NextApiRequest, res: NextApiResponse, cwid: string, body: SearchBody) {
    const { edited, dateId, typeId } = body
    try {
        const s = parseStrategy({ ...edited, dateId, typeId })
        // An uncountable database has no Results column, and asking for one is not an error — it is
        // a question with an empty answer. `countIn` would THROW here (deliberately), and a 502 on
        // a column nobody can fill would put an error banner over a strategy that is perfectly
        // fine. An empty map renders as em-dashes, which is exactly what "not counted" looks like.
        if (!DIALECTS[s.db].countable) {
            return res.status(200).send({ statusCode: 200, db: s.db, hits: null, rowCounts: {} })
        }
        const query = assembleQuery(s)
        if (!query) return res.status(200).send({ statusCode: 200, rowCounts: {} })
        const hits = await countIn(s.db)(query)
        const rowCounts = await countRows(s, hits)
        return res.status(200).send({ statusCode: 200, db: s.db, hits, rowCounts })
    } catch (err: any) {
        console.error('[literature] row counts failed:', err)
        return res.status(502).send({ statusCode: 502, message: err?.message || 'Could not count the lines.' })
    }
}

// ---- RE-COUNT. No model and no cost log — but the EXPERT PANEL does change. See the dispatch ---
// ---- condition in handler() below for the full rationale, including why `!proceed` guards it. --
async function handleRecount(req: NextApiRequest, res: NextApiResponse, cwid: string, body: SearchBody) {
    const { edited, dateId, typeId, seedList } = body
    try {
        const recounted = parseStrategy({ ...edited, dateId, typeId })
        const { unsupported } = buildLimits(recounted.db, String(dateId ?? ''), String(typeId ?? ''))
        const result = await runStrategy(recounted, seedList, unsupported)

        let experts
        if (recounted.db === 'pubmed') {
            const mesh = meshFromConcepts(recounted.concepts)
            experts = mesh.length ? await findWcmExperts(mesh, 5) as any : { experts: [], total: 0 }
        }
        return res.status(200).send({ statusCode: 200, databases: [result], ...(experts ? { experts } : {}) })
    } catch (err: any) {
        console.error('[literature] recount failed:', err)
        return res.status(502).send({ statusCode: 502, message: err?.message || 'Could not re-count the strategy.' })
    }
}

// ---- BUILD + FETCH (Modes 2 AND 3, phase 1). See the dispatch condition in handler() below for --
// ---- why Mode 3 shares this branch instead of forking. ------------------------------------------
async function handleIssueReviewOrClinicalQuestion(req: NextApiRequest, res: NextApiResponse, cwid: string, body: SearchBody) {
    const { mode, dateId, typeId, sort, question, criteria, pico, edited, proceed } = body
    const isPico = mode === 'clinical-question'
    try {
        // Modes 2 and 3 are PUBMED ONLY — they order records by an evidence tier derived from
        // PubMed's publication-type indexing, which Scopus does not have.
        const { terms: limits } = buildLimits('pubmed', String(dateId ?? ''), String(typeId ?? ''))
        // An unknown sort resolves to relevance, never to a guess — same rule as buildLimits.
        // Relevance is the default because it is what makes a 50-cap defensible: the top 50 of
        // a 300-hit precision search by PubMed's Best Match is a reading list; the newest 50
        // is an accident of the calendar.
        const order: Sort = sort === 'date' ? 'date' : 'relevance'

        // TWO WAYS IN, and only one of them spends money.
        //
        // A fresh question BUILDS a strategy — PRECISION, not recall, a different prompt,
        // deliberately (see REVIEW_PROMPT). "Retrieve the top 50 anyway" posts the strategy the
        // librarian is ALREADY LOOKING AT — narrowings ticked, lines edited — and that path
        // calls NO MODEL: the strategy exists, and re-drafting it would spend a call to throw
        // the librarian's own edits away and probably hand back a different query than the one
        // on their screen. The strategy is re-parsed and its limits re-resolved server-side
        // (parseStrategy), so this is not a trust hole: it is the same guard the re-count uses.
        let strategy: Strategy
        let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }

        // Mode 3's question is ASSEMBLED SERVER-SIDE from the PICO fields, never taken as prose
        // from the client — so the sentence the model is asked to answer is provably the one
        // built from the four boxes the clinician filled in.
        let asked = String(question || '')
        if (isPico && !edited) {
            if (!picoComplete(pico || {})) {
                return res.status(400).send({
                    statusCode: 400,
                    message: 'Population, Intervention and Outcome are required. Comparison is optional.',
                })
            }
            asked = picoQuestion(pico as Pico)
        }

        if (edited) {
            strategy = parseStrategy({ ...edited, dateId, typeId })
        } else {
            if (!bedrockConfigured()) {
                return res.status(503).send({ statusCode: 503, message: 'Literature Search is not configured on this environment.' })
            }
            if (!asked.trim()) {
                return res.status(400).send({ statusCode: 400, message: 'A question is required.' })
            }
            // ON A CLOCK, like every other model call — see MODEL_TIMEOUT_MS. A Bedrock invoke
            // that never answers would otherwise hold this handler open until the ALB gave up
            // 500 seconds later, occupying a Next worker the whole time and telling the
            // librarian nothing. A rejection here lands in the catch below and comes back as the
            // 502 that path already returns.
            const built = await withTimeout(
                buildStrategy(
                    asked, limits, criteria, 'precision',
                    isPico ? (pico as Pico) : undefined,
                ),
                MODEL_TIMEOUT_MS,
                'The search strategy build',
            )
            strategy = built.strategy
            usage = built.usage
        }

        // Count first, fetch second — but the count no longer decides whether we CAN fetch (the
        // retrieval tool takes a retmax), it decides whether we SHOULD do so silently. Above
        // NARROW_ABOVE, runReview hands back the strategy, the number, and priced narrowings
        // instead of a top-50 nobody was told was a top-50. A 200, not a 4xx: it is not an
        // error, it is a draft. `proceed` walks through the gate and always retrieves.
        const result = await runReview(strategy, order, proceed === true)

        let experts = { experts: [], total: 0 }
        try {
            const mesh = meshFromConcepts(strategy.concepts)
            if (mesh.length) experts = await findWcmExperts(mesh, 5) as any
        } catch (e) {
            // The panel is a bonus, not the deliverable. Never fail the search over it.
            console.error('[literature] expert panel failed:', e)
        }

        // Logged even when no model was called, and the zeros are the POINT: they are the proof
        // that narrowing, re-running and taking the top 50 anyway cost nothing. If this line
        // ever shows tokens on a `proceed` run, someone has put the model back in the loop.
        logCost(`${isPico ? 'clinical-question' : 'issue-review'}:build`, cwid, usage, {
            hits: result.hits,
            records: result.records.length,
            needsNarrowing: !!result.needsNarrowing,
            narrowings: result.narrowings?.length ?? 0,
            proceed: proceed === true,
            fromEditedStrategy: !!edited,
        })

        // `question` goes back for Mode 3 so the page shows the sentence that was actually put
        // to PubMed -- assembled from the four fields by the server, not retyped by the client.
        return res.status(200).send({
            statusCode: 200,
            databases: [result],
            experts,
            model: process.env.BEDROCK_MODEL_ID,
            ...(isPico && asked ? { question: asked } : {}),
        })
    } catch (err: any) {
        console.error('[literature] issue review failed:', err)
        return res.status(502).send({ statusCode: 502, message: err?.message || 'Search failed.' })
    }
}

// ---- BUILD (Mode 1). ----------------------------------------------------------------------------
async function handleBuildStrategy(req: NextApiRequest, res: NextApiResponse, cwid: string, body: SearchBody) {
    const { question, criteria, seedList, dateId, typeId, databases } = body
    if (!bedrockConfigured()) {
        return res.status(503).send({ statusCode: 503, message: 'Literature Search is not configured on this environment.' })
    }
    if (!question || !String(question).trim()) {
        return res.status(400).send({ statusCode: 400, message: 'A research question is required.' })
    }

    // HOISTED ABOVE THE try, BECAUSE THE TOKENS ARE SPENT WHETHER OR NOT THE REQUEST SUCCEEDS.
    // Declared inside it, as it was, a throw carried the running total out of scope and put the call
    // beyond logCost's reach: the money was gone and so was the only record that it had ever been
    // spent. Bedrock bills for the call that preceded a throw exactly as it bills for one that
    // returned, and an unlogged call is one nobody can attribute to a mode or a cwid afterwards.
    // const, not let: buildSearchStrategy mutates this object's fields in place rather than the route
    // reassigning it, so the spend is visible here whether the build returns or throws.
    const usage: UsageLog = { inputTokens: 0, outputTokens: 0 }

    try {
        // WHICH DATABASES. PubMed is always in — it is the only one every mode can use — and the others
        // join it when ticked. Mode 1 ONLY, and that restriction is principled rather than unfinished:
        // Modes 2 and 3 order records by their evidence tier, which is derived from PubMed's
        // publication-type indexing. Scopus HAS NO SUCH INDEX (probed: DOCTYPE(rct) returns 0 — there
        // is no RCT document type), and Embase we cannot even retrieve from. A "clinical answer" out of
        // either would have no evidence hierarchy underneath it, which is the one thing Mode 3 is for.
        //
        // DERIVED FROM THE DIALECT TABLE, NOT FROM A HARDCODED LIST. This line used to read
        // `databases.includes('scopus') ? ['scopus'] : []`, so when the browser started sending
        // 'embase' the server SILENTLY DROPPED IT and returned a PubMed-only result to a librarian who
        // had ticked two databases — no error, no mention, just a missing panel. A third database is a
        // table entry, and this is one of the places that has to mean it.
        const asked = Array.isArray(databases) ? databases.map(String) : []
        const extras = (Object.keys(DIALECTS) as Db[]).filter(db => db !== 'pubmed' && asked.includes(db))
        const dbs: Db[] = ['pubmed', ...extras]

        // One strategy per requested database, sharing only the concept labels as a spine (PubMed
        // first, its labels becoming the shared spine every later database is drafted against). The
        // multi-database orchestration — build, count, seed check, priced fixes, per-database failure
        // isolation and cost accumulation — lives in buildSearchStrategy. `usage` is passed and
        // MUTATED IN PLACE, not returned, so the hoisted accumulator above still carries the spend if
        // an unforeseen throw escapes the loop.
        const { results, pubmedStrategy } = await buildSearchStrategy({
            question: String(question),
            criteria,
            seedList,
            dbs,
            dateId: String(dateId ?? ''),
            typeId: String(typeId ?? ''),
            usage,
        })

        // The expert panel works with no records at all — straight off the query's MeSH, so it is
        // PubMed's strategy that feeds it. Scopus has no controlled vocabulary and therefore no
        // MeSH to harvest; asking it for one would return nothing, not something.
        let experts = { experts: [], total: 0 }
        try {
            const mesh = meshFromConcepts(pubmedStrategy?.concepts || [])
            if (mesh.length) experts = await findWcmExperts(mesh, 5) as any
        } catch (e) {
            // The panel is a bonus, not the deliverable. Never fail the strategy over it.
            console.error('[literature] expert panel failed:', e)
        }

        // A FAILED DATABASE HAS NO hits AND NO seeds, so the two maps below read the survivors only —
        // `r.seeds.filter(...)` on a failure would throw INSIDE the cost log, which is the one place a
        // throw must never reach: it would land in the catch below, whose whole job is to log the cost.
        //
        // `wasSearched` rather than `r => !r.failed` so that rule is enforced by the COMPILER and not
        // by this comment: a DbPanel is a union, and only a type predicate narrows it to the half
        // that actually has the fields below on it.
        const survived = results.filter(wasSearched)

        // The build and the fixes are one run from the librarian's point of view, so they are one
        // cost line. Iteration after this call is free anyway — every toggle takes the no-model
        // re-count path above, in either database.
        //
        // A FAILURE IS EXACTLY WHEN THE SPEND MOST NEEDS A LINE HERE: a database that got as far as a
        // drafted strategy and then failed on its count has already been billed for an Opus call, and
        // so has one whose fixes threw. Both fold their tokens back into `usage` in their catch blocks,
        // and both are named below, so the log can tell a cheap failure from an expensive one.
        logCost('search-strategy', cwid, usage, {
            dbs,
            hits: survived.map(r => `${r.db}:${r.hits}`).join(' '),
            failed: results.filter(hasFailed).map(r => r.db).join(' '),
            degraded: survived.filter(r => r.degraded).map(r => r.db).join(' '),
            seeds: seedList.length,
            seedsRetrieved: survived.map(r => `${r.db}:${r.seeds.filter(s => s.retrieved).length}`).join(' '),
        })

        // A DATABASE FAILING IS A PANEL, NOT A STATUS CODE — and that holds even when every database
        // fails. This used to return a 502 in the all-failed case, with the per-database errors mashed
        // into one joined string, and the client bails on `!res.ok` before it ever sets its failure
        // state: the failure panels, which exist for exactly this case, never mounted and the page told
        // the librarian nothing at all. A 200 carrying the failures lets it say WHICH database broke and
        // WHY, one panel each — which is the answer they can act on.
        //
        // Nothing in an all-failed 200 can be mistaken for a successful search: a failed entry carries
        // no `hits` and no `concepts`, so there is no count to render and no strategy to export. The 502
        // stays where it belongs — a route-level failure (bad input, no Bedrock, an unforeseen throw),
        // where there is nothing per-database to say.
        return res.status(200).send({ statusCode: 200, databases: results, experts, model: process.env.BEDROCK_MODEL_ID })
    } catch (err: any) {
        console.error('[literature] strategy failed:', err)
        // Per-database failures never arrive here — they are panels, not throws. What is left is the
        // unforeseen, and it still gets a cost line: see the hoist of `usage` above.
        logCost('search-strategy', cwid, usage, { dbs: [], failed: 'all' })
        return res.status(502).send({ statusCode: 502, message: err?.message || 'Strategy build failed.' })
    }
}

// ==================================================================================================
// MODE 4 ("Bibliometric review"). FOUR SEQUENTIAL BLOCKING POSTS, not five human-gated ones like
// Mode 2 — the plan's "retrieve → classify → cluster → score → synthesize" step list maps onto four
// network round trips because the first three of those six visual steps (strategy validation,
// retrieval, evidence classification) are all deterministic-or-one-model-call and naturally finish
// together; splitting them into separate POSTs would buy no real progress granularity, only extra
// round trips. No SSE — see the plan's own "reach for SSE only if real usage shows the step list
// feels stuck" and Mode 2/3's precedent: a blocking POST per named phase was already enough there.
//
// THE CORPUS IS ECHOED, NOT RE-FETCHED, BETWEEN PHASES — the one real departure from Mode 2/3's
// "never trust record text from the client" rule, and it is narrower than it looks:
//   - What round-trips is METADATA ONLY (pmid, title, authors, journal, year, mesh, tier,
//     nihPercentile, caseSeriesProbable) — `abstract` is stripped before the corpus ever leaves the
//     server (parseM4Corpus forces it back to '' even if a tampered payload smuggled one in) and is
//     never sent to the browser at all in this mode. A corpus of 2,000-4,000 records with full
//     abstracts would also blow well past a sane request-body limit on every later phase.
//   - The two calls that actually spend Bedrock on this data — scoreRelevance() and
//     synthesizeCluster() — NEVER read the echoed metadata as their input text. Both re-fetch the
//     real abstracts server-side by PMID (fetchByPmids, same call Mode 2/3's screen/synthesize
//     phases already use) for exactly the shortlist preFilterForScoring() picked. So the one thing
//     that must never come from the client — the text a paid model call reads — still never does.
//   - labelClusters() DOES read client-echoed data (each cluster's MeSH terms), but MeSH terms are
//     short, controlled-vocabulary-shaped strings with none of the injection surface free-text
//     abstract content has, and the worst case of a tampered one is a mislabeled cluster, not a
//     fabricated citation or a hijacked prompt. Same bounded-trust posture parseStrategy() already
//     takes on a re-counted query's term lines.
// parseM4Corpus/parseM4Clusters/parseM4Scores below are the guards: bounded size, coerced types,
// abstract forcibly blanked — the same posture parseStrategy/parsePmids already take on this route.

const MAX_M4_RECORDS = 20000   // well above any real decade-scale corpus (the plan's own ballpark
                                 // tops out around 5,000-6,000) — a defensive ceiling, not a design cap.

function s(v: any, max: number): string {
    return String(v ?? '').slice(0, max)
}

// Metadata-only PubRecord, coerced field by field — never trust the shape of an echoed array.
// `abstract` is ALWAYS '', regardless of what arrived: this mode never lets abstract text complete
// a round trip through the browser (see the file-level comment above).
function parseM4Corpus(raw: any): PubRecord[] {
    if (!Array.isArray(raw)) throw new Error('malformed corpus')
    if (raw.length > MAX_M4_RECORDS) throw new Error('corpus is larger than this route will process')
    return raw.map((r: any): PubRecord => ({
        pmid: s(r?.pmid, 20),
        title: s(r?.title, 500),
        journal: s(r?.journal, 300),
        year: s(r?.year, 8),
        authors: s(r?.authors, 200),
        design: s(r?.design, 40),
        tier: { rank: Number(r?.tier?.rank) || 8, label: s(r?.tier?.label, 40), phrase: s(r?.tier?.phrase, 120) },
        types: Array.isArray(r?.types) ? r.types.slice(0, 20).map((t: any) => s(t, 60)) : [],
        abstract: '',
        mesh: Array.isArray(r?.mesh) ? r.mesh.slice(0, 40).map((m: any) => s(m, 120)) : [],
        ...(Number.isFinite(r?.nihPercentile) ? { nihPercentile: Number(r.nihPercentile) } : {}),
        ...(r?.caseSeriesProbable === true ? { caseSeriesProbable: true } : {}),
    }))
}

function parseM4Clusters(raw: any): Cluster[] {
    if (!Array.isArray(raw)) throw new Error('malformed clusters')
    return raw.map((c: any): Cluster => ({
        id: s(c?.id, 60),
        label: s(c?.label, 200),
        meshTerms: Array.isArray(c?.meshTerms) ? c.meshTerms.slice(0, 10).map((m: any) => s(m, 120)) : [],
        pmids: Array.isArray(c?.pmids) ? c.pmids.slice(0, MAX_M4_RECORDS).map((p: any) => s(p, 20)) : [],
        ...(c?.isUncategorized === true ? { isUncategorized: true } : {}),
    }))
}

function parseM4Scores(raw: any): Map<string, { score: number; justification: string }> {
    const out = new Map<string, { score: number; justification: string }>()
    if (!Array.isArray(raw)) return out
    for (const x of raw) {
        const pmid = s(x?.pmid, 20)
        const score = Number(x?.score)
        if (pmid && Number.isFinite(score)) {
            out.set(pmid, { score: Math.min(1, Math.max(0, score)), justification: s(x?.justification, 400) })
        }
    }
    return out
}

// The model-judged impact axis, on the same metadata round-trip as the relevance scores above.
// Clamped and rounded on the way back IN as well as on the way out, for the same reason every other
// parseM4* function re-validates: this value has been through the client, and a value that has left
// the server is an input again when it returns, whatever it was when it left.
function parseM4Impact(raw: any): Map<string, { score: number; justification: string }> {
    const out = new Map<string, { score: number; justification: string }>()
    if (!Array.isArray(raw)) return out
    for (const x of raw) {
        const pmid = s(x?.pmid, 20)
        const score = Number(x?.score)
        if (pmid && Number.isFinite(score)) {
            out.set(pmid, {
                score: Math.max(0, Math.min(100, Math.round(score))),
                justification: s(x?.justification, 400),
            })
        }
    }
    return out
}

// The six real evidence tiers the SearchForm checklist controls (see EVIDENCE_TIERS in
// LiteratureSearch.constants.ts — that file owns the id/label/default the checkboxes render, this
// is just the label set filterByEvidenceTiers() needs to resolve "everything except what got
// unticked"). Guideline/Review/Other/Protocol/RETRACTED are not on the checklist and are always
// kept — the plan's own mockup lists seven rows, not eleven, and Phase 4's evidence-mix chart needs
// the full tier range to stay meaningful (see filterByEvidenceTiers()'s own comment).
const CHECKLIST_TIERS = ['RCT', 'Clinical trial', 'Meta-analysis', 'Systematic review', 'Observational', 'Case report']
const ALWAYS_KEPT_TIERS = ['Guideline', 'Review', 'Other', 'Protocol', 'RETRACTED']

function resolveKeepTiers(evidenceTiers: any): Set<string> {
    const checked = new Set((Array.isArray(evidenceTiers) ? evidenceTiers : []).map((t: any) => String(t)))
    return new Set([...ALWAYS_KEPT_TIERS, ...CHECKLIST_TIERS.filter(t => checked.has(t))])
}

// impactScoreOf() is PURE and free, so it runs over the WHOLE corpus, not just the scored
// shortlist — the Corpus table's Impact column would otherwise be blank for the ~90% of records
// preFilterForScoring() never picked, for no reason: nothing about computing it costs a Bedrock
// call. relevanceScore stays sparse on purpose (see corpusSheet.ts's own "blank = not in the
// shortlist" contract) — it is the one column this function does NOT fill in for every row.
function decorateCorpus(
    corpus: PubRecord[], clusters: Cluster[],
    scores: Map<string, { score: number; justification: string }>,
    impactJudged: Map<string, { score: number; justification: string }> = new Map(),
) {
    const clusterLabelByPmid = new Map<string, string>()
    for (const c of clusters) for (const p of c.pmids) clusterLabelByPmid.set(p, c.label)

    return corpus.map(r => {
        const prior = impactScoreOf(r)
        const rel = scores.get(r.pmid)
        const judged = impactJudged.get(r.pmid)
        return {
            ...r,
            clusterLabel: clusterLabelByPmid.get(r.pmid) ?? '',
            // THREE AXES, KEPT APART ON THE ROW. `evidenceScore` is the free deterministic prior
            // (evidence tier blended with the iCite percentile) and covers 100% of the corpus;
            // `impactScore` is the model's ReciterAI-calibrated 0-100 judgment and covers only the
            // shortlist; `relevanceScore` is topic fit, same shortlist. None is derived from
            // another and none is blended into a composite here — a composite is a query-time
            // decision the table makes when a reader picks a sort, not a number baked into the row.
            evidenceScore: prior.score,
            evidenceJustification: prior.justification,
            ...(judged ? { impactScore: judged.score, impactJustification: judged.justification } : {}),
            ...(rel ? { relevanceScore: rel.score, relevanceJustification: rel.justification } : {}),
        }
    })
}

// A small bounded-concurrency map — synthesizeCluster() is one call PER CLUSTER (see its own "the
// caller is expected to fire these in whatever concurrency it can afford" comment), and a real
// corpus can produce 15-25 of them. Firing them one at a time (the probe script's own choice, for
// simplicity there) would put several minutes between "Scoring" finishing and the narrative
// landing; firing all of them at once risks tripping Bedrock's own per-account concurrency limit.
// ponytail: a fixed concurrency of 4, not a tuned/adaptive pool — no library for this at four call
// sites in the repo, and four Opus calls in flight at once is a reasonable default with no
// production signal yet to tune it against.
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length)
    let i = 0
    async function worker() {
        while (i < items.length) {
            const mine = i++
            out[mine] = await fn(items[mine])
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
    return out
}

// ---- MODE 4, POST 1 of 4: build the recall strategy, pull the full corpus (sharded by year),
// classify evidence type, compute Phase 4 stats. Dominated by PubMed retrieval time — a decade at
// a few hundred records/year is a few minutes, not the ~2s Mode 1's single count call takes.
async function handleM4Retrieve(req: NextApiRequest, res: NextApiResponse, cwid: string, body: SearchBody) {
    const { question, criteria, dateId, evidenceTiers, caseSeries, seedList } = body
    if (!bedrockConfigured()) {
        return res.status(503).send({ statusCode: 503, message: 'Literature Search is not configured on this environment.' })
    }
    if (!question || !String(question).trim()) {
        return res.status(400).send({ statusCode: 400, message: 'A research question is required.' })
    }
    const usage: UsageLog = { inputTokens: 0, outputTokens: 0 }
    try {
        // Empty limits, deliberately: Mode 4's date bound is applied per-year inside fetchCorpus()
        // (the `[dp]` shard clause), not baked into the strategy the way Modes 1-3's dateId is —
        // this mode has no "Any date" that means anything to a per-year shard loop. See
        // yearRangeFor()'s own comment.
        const built = await withTimeout(
            buildStrategy(String(question), '', criteria, 'recall', undefined, 'pubmed', undefined),
            MODEL_TIMEOUT_MS,
            'The search strategy build',
        )
        usage.inputTokens += built.usage.inputTokens
        usage.outputTokens += built.usage.outputTokens

        const { fromYear, toYear } = yearRangeFor(String(dateId ?? ''))
        const corpus = await fetchCorpus(built.strategy, fromYear, toYear)

        const keepTiers = resolveKeepTiers(evidenceTiers)
        let records = filterByEvidenceTiers(corpus.records, keepTiers)
        // Case Reports is the one tier this mode drops by a DIFFERENT rule than the checklist's own
        // keep-set (it is the plan's hardcoded Phase 3 default, unticked and off by default) — but a
        // librarian who explicitly re-ticks it on the checklist gets it back, via keepTiers already
        // including 'Case report'. excludeCaseReports() only runs when it is NOT already kept above.
        if (!keepTiers.has('Case report')) records = excludeCaseReports(records)
        records = flagProbableCaseSeriesOrExclude(records, caseSeries !== false)

        // KNOWN-ITEM SEEDS. PMID-kind only — Mode 4 retrieves from PubMed alone, and a DOI seed
        // (meaningful for Scopus, which has no PMID index) has nothing to check here. Aggregate
        // count only, matching the mockup's single step-list line ("4 of 4 known-item seeds
        // retrieved") rather than Mode 1's per-seed panel, which this mode has no screen for.
        const pmidSeeds = seedList.filter(sd => sd.kind === 'pmid')
        const corpusPmids = new Set(records.map(r => r.pmid))
        const seedsRetrieved = pmidSeeds.filter(sd => corpusPmids.has(sd.id)).length

        const hotYears = corpus.shards.filter((sh): sh is Extract<typeof sh, { ok: false }> => !sh.ok)

        logCost('bibliometric-review:retrieve', cwid, usage, {
            fromYear, toYear, corpusSize: records.length, hotYears: hotYears.length,
            seeds: pmidSeeds.length, seedsRetrieved,
        })

        return res.status(200).send({
            statusCode: 200,
            model: process.env.BEDROCK_MODEL_ID,
            // The BASE query, one year's worth — see corpusSheet.ts's own "Boolean query" row for
            // why this mode has no single query the way Modes 1-3 do. Carried in state and threaded
            // into every export's RunFacts, same field name, so the export builders need no
            // Mode-4-specific branch to find it.
            // corpus.query, NOT assembleQuery(built.strategy) — fetchCorpus appends the humans
            // filter, so re-deriving here would print a query that does not reproduce the count
            // printed beside it.
            query: corpus.query,
            fromYear, toYear,
            corpus: records,
            hotYears: hotYears.map(sh => ({ year: sh.year, hits: sh.hits, error: sh.error })),
            corpusStats: {
                publicationsPerYear: publicationsPerYear(records),
                evidenceMixByYear: evidenceMixByYear(records),
                journalDistribution: journalDistribution(records),
                percentileTrend: percentileTrend(records),
                totalRecords: records.length, fromYear, toYear,
            },
            seeds: { total: pmidSeeds.length, retrieved: seedsRetrieved },
        })
    } catch (err: any) {
        console.error('[literature] bibliometric retrieve failed:', err)
        logCost('bibliometric-review:retrieve', cwid, usage, { failed: true })
        return res.status(502).send({ statusCode: 502, message: err?.message || 'Could not build the corpus.' })
    }
}

// Case-series disclosure is a FLAG on records already kept, not a tier — see excludeCaseSeries()'s
// own comment. `keep` here is the checklist's "Case series (probable)" box: on (default) flags and
// keeps them, off drops them from the corpus entirely.
function flagProbableCaseSeriesOrExclude(records: PubRecord[], keep: boolean): PubRecord[] {
    const flagged = flagProbableCaseSeries(records)
    return keep ? flagged : excludeCaseSeries(flagged)
}

// ---- MODE 4, POST 2 of 4: cluster the corpus by MeSH co-occurrence, then name each cluster in
// ONE Bedrock call. Fast — clusterByMesh() is pure, labelClusters() is a single short call.
async function handleM4Cluster(req: NextApiRequest, res: NextApiResponse, cwid: string, body: SearchBody) {
    if (!bedrockConfigured()) {
        return res.status(503).send({ statusCode: 503, message: 'Literature Search is not configured on this environment.' })
    }
    try {
        const corpus = parseM4Corpus(body.corpus)
        const { clusters: raw } = clusterByMesh(corpus)
        const { clusters, usage } = await labelClusters(raw)
        logCost('bibliometric-review:cluster', cwid, usage, { corpusSize: corpus.length, clusters: clusters.length })
        return res.status(200).send({ statusCode: 200, clusters })
    } catch (err: any) {
        console.error('[literature] bibliometric cluster failed:', err)
        return res.status(502).send({ statusCode: 502, message: err?.message || 'Could not cluster the corpus.' })
    }
}

// ---- MODE 4, POST 3 of 4: pick a ~200-record, per-cluster-allocated scoring shortlist (free), then
// score it for topical relevance (the one Bedrock call this phase makes) — see
// preFilterForScoring()'s own comment for why the budget is capped and allocated by cluster rather
// than a flat corpus-wide cut.
async function handleM4Score(req: NextApiRequest, res: NextApiResponse, cwid: string, body: SearchBody) {
    const { question, criteria } = body
    if (!bedrockConfigured()) {
        return res.status(503).send({ statusCode: 503, message: 'Literature Search is not configured on this environment.' })
    }
    try {
        const corpus = parseM4Corpus(body.corpus)
        const clusters = parseM4Clusters(body.clusters)
        const byPmid = new Map(corpus.map(r => [r.pmid, r]))
        const budget = preFilterForScoring(clusters, byPmid, 200)
        const shortlistPmids = Object.values(budget).flat().map(r => r.pmid)

        // RE-FETCHED, never taken from the echoed corpus — the metadata round-trip never carries an
        // abstract (parseM4Corpus forces it blank), so scoring the actual text means going back to
        // PubMed for it, same discipline Mode 2/3's screen/synthesize phases already apply.
        const withAbstracts = shortlistPmids.length ? await fetchByPmids(shortlistPmids) : []

        // TWO INDEPENDENT AXES, SCORED CONCURRENTLY. Relevance answers "is this paper about the
        // topic the librarian typed"; impact answers "how strong a paper is it, on its own terms".
        // Neither reads the other's answer, so there is no reason to pay for them serially — a
        // shortlist of 200 is 4 batches each way, and running them in sequence would put the second
        // set of round-trips on the clock a librarian is already waiting through.
        //
        // Both are Promise.all-safe because neither ever rejects: each catches its own batch
        // failures and returns whatever it managed to score (see scoreRelevance's own comment on
        // why a scoring gap must never propagate). A rejection here would lose BOTH axes.
        const [rel, imp] = await Promise.all([
            scoreRelevance(String(question || ''), criteria, withAbstracts),
            scoreImpact(withAbstracts),
        ])
        const { scores, usage } = rel

        const totalUsage = {
            inputTokens: usage.inputTokens + imp.usage.inputTokens,
            outputTokens: usage.outputTokens + imp.usage.outputTokens,
        }
        logCost('bibliometric-review:score', cwid, totalUsage, {
            shortlist: shortlistPmids.length, scored: scores.size, impactScored: imp.scores.size,
        })
        return res.status(200).send({
            statusCode: 200,
            scores: Array.from(scores, ([pmid, v]) => ({ pmid, ...v })),
            impact: Array.from(imp.scores, ([pmid, v]) => ({ pmid, ...v })),
        })
    } catch (err: any) {
        console.error('[literature] bibliometric score failed:', err)
        return res.status(502).send({ statusCode: 502, message: err?.message || 'Could not score the corpus.' })
    }
}

// ---- MODE 4, POST 4 of 4: one synthesis paragraph per real cluster (bounded concurrency), then
// the deterministic whole-review assembly — no further Bedrock call, see
// assembleNarrativeReview()'s own comment for why that stitch step was deliberately dropped.
async function handleM4Synthesize(req: NextApiRequest, res: NextApiResponse, cwid: string, body: SearchBody) {
    const { question } = body
    if (!bedrockConfigured()) {
        return res.status(503).send({ statusCode: 503, message: 'Literature Search is not configured on this environment.' })
    }
    try {
        const corpus = parseM4Corpus(body.corpus)
        const clusters = parseM4Clusters(body.clusters)
        const scores = parseM4Scores(body.scores)
        const impactJudged = parseM4Impact((body as any).impact)
        const byPmid = new Map(corpus.map(r => [r.pmid, r]))
        const topic = String(question || '')

        // The SAME shortlist logic Phase 6 used to decide who got scored, re-derived rather than
        // trusted from the client — it is pure and cheap, and re-deriving it here means a tampered
        // `clusters`/`corpus` payload can shrink or reorder the candidate pool but cannot forge a
        // synthesis shortlist the deterministic rules would not themselves have picked.
        const budget = preFilterForScoring(clusters, byPmid, 200)

        // A CLUSTER THAT IS NOT ABOUT THE TOPIC DOES NOT GET A PAID PARAGRAPH. On the 2026-08-19
        // run every one of the 18 real clusters got a full 8,000-token call, and at least five of
        // the resulting sections consisted entirely of a courteous explanation that the cluster was
        // irrelevant — "the cluster is therefore not informative for the stated review question and
        // is summarized here only for completeness". The largest of those, 155 papers of androgen-
        // receptor biology, was pulled in by an over-broad MeSH term and had nothing to do with the
        // question. We paid a model to tell us so, at length, in the deliverable.
        //
        // The gate is the relevance score that was ALREADY computed for this cluster's shortlist, so
        // it costs nothing new. It is a MEAN over the scored members rather than a max, because one
        // on-topic paper in a cluster of androgen pharmacology does not make the cluster on-topic —
        // which is exactly the shape of the failure being fixed.
        //
        // A cluster with no scored members at all is NOT gated out: that means preFilterForScoring
        // gave it no budget, which is a statement about the cluster's size, not its relevance, and
        // silently dropping it would hide a real topic rather than a spurious one.
        const NARRATIVE_RELEVANCE_FLOOR = 0.25
        const meanRelevance = (c: Cluster) => {
            const scored = c.pmids.map(p => scores.get(p)?.score).filter((n): n is number => typeof n === 'number')
            return scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null
        }

        const realClusters = clusters.filter(c => !c.isUncategorized)
        const skipped: Array<{ id: string; label: string; meanRelevance: number }> = []
        const perCluster = realClusters.flatMap(c => {
            const mean = meanRelevance(c)
            if (mean !== null && mean < NARRATIVE_RELEVANCE_FLOOR) {
                skipped.push({ id: c.id, label: c.label, meanRelevance: Math.round(mean * 100) / 100 })
                return []
            }
            const candidates = (budget[c.id] || [])
                .map(r => ({ r, rank: impactScoreOf(r).score + (scores.get(r.pmid)?.score || 0) }))
                .sort((a, b) => b.rank - a.rank)
            return [{ cluster: c, top: candidates.slice(0, 10).map(x => x.r.pmid) }]
        })

        // NEVER SILENTLY. A cluster that was dropped still appears in the cluster roster, the corpus
        // table and every bibliometric count — only its paid narrative section is skipped — but a
        // reader must be able to find out that a section they might have expected is missing, and
        // why. Logged here; disclosed to the reader by assembleNarrativeReview's own intro.
        if (skipped.length) {
            console.error(JSON.stringify({
                tag: 'literature-narrative-skipped-offtopic', floor: NARRATIVE_RELEVANCE_FLOOR, skipped,
                why: 'these clusters scored below the relevance floor; no narrative section was written for them',
            }))
        }

        // ONE BATCHED RE-FETCH for every cluster's shortlist at once, not one fetchByPmids() call
        // per cluster — the same "batch, don't loop" instinct labelClusters() already applies to
        // naming, just moved to the abstract re-fetch instead of the Bedrock call.
        const allPmids = Array.from(new Set(perCluster.flatMap(x => x.top)))
        const withAbstracts = allPmids.length ? await fetchByPmids(allPmids) : []
        const abstractByPmid = new Map(withAbstracts.map(r => [r.pmid, r]))

        let usage: UsageLog = { inputTokens: 0, outputTokens: 0 }
        const narratives: ClusterNarrative[] = (await mapLimit(perCluster, 4, async ({ cluster, top }) => {
            const records = top.map(p => abstractByPmid.get(p)).filter((r): r is PubRecord => !!r)
            if (!records.length) return null
            const { narrative, usage: u } = await synthesizeCluster(topic, cluster, records)
            usage = { inputTokens: usage.inputTokens + u.inputTokens, outputTokens: usage.outputTokens + u.outputTokens }
            return narrative
        })).filter((n): n is ClusterNarrative => !!n)

        const hasCaseSeriesFlags = corpus.some(r => r.caseSeriesProbable)
        const narrative = assembleNarrativeReview(
            topic,
            {
                publicationsPerYear: publicationsPerYear(corpus),
                evidenceMixByYear: evidenceMixByYear(corpus),
                totalRecords: corpus.length,
                fromYear: Number(body.fromYear) || new Date().getFullYear() - 10,
                toYear: Number(body.toYear) || new Date().getFullYear(),
            },
            clusters, narratives, hasCaseSeriesFlags,
        )

        logCost('bibliometric-review:synthesize', cwid, usage, { clusters: narratives.length })
        return res.status(200).send({
            statusCode: 200,
            model: process.env.BEDROCK_MODEL_ID,
            narrative,
            corpus: decorateCorpus(corpus, clusters, scores, impactJudged),
            cwid,
            date: new Date().toISOString().slice(0, 10),
        })
    } catch (err: any) {
        console.error('[literature] bibliometric synthesize failed:', err)
        return res.status(502).send({ statusCode: 502, message: err?.message || 'Could not write the narrative review.' })
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).send({ statusCode: 405, message: 'POST only' })
    }

    // 1. Real session auth.
    //
    // NO `any` ON THE TOKEN, and least of all here. getToken() returns `JWT | null`, and JWT is an
    // index-signature type — every claim on it is `unknown`, because next-auth cannot know what our
    // callbacks put there. Casting to `any` does not recover the knowledge, it only stops the
    // compiler from asking for it, at the one boundary in this route where a wrong assumption is an
    // authentication decision made on a value nobody checked.
    //
    // So the shape is VALIDATED rather than assumed: `username` has to actually be a non-empty
    // string before it becomes a cwid. A claim that arrives as a number, an object or an array is
    // not a username we recognise, and the honest answer to one is the same 401 as no token at all.
    let cwid = ''
    try {
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
        const username = token?.username
        if (typeof username !== 'string' || !username) {
            return res.status(401).send({ statusCode: 401, message: 'Sign in to use Literature Search.' })
        }
        cwid = username.toLowerCase()
    } catch {
        return res.status(401).send({ statusCode: 401, message: 'Sign in to use Literature Search.' })
    }

    // 2. Pilot allowlist. It applies to the re-count path too: that path spends no model tokens,
    //    but it still queries PubMed on our shared NCBI key.
    //
    //    THIS IS THE GATE. The sidebar hides the link from anyone this would reject, but the
    //    sidebar is cosmetic — /literature is still reachable by URL, and this is what stops it.
    if (!isAllowlisted(cwid)) {
        return res.status(403).send({
            statusCode: 403,
            message: 'Literature Search is in a limited pilot. Contact the ReCiter team for access.',
        })
    }

    const {
        mode, phase, question, criteria, seeds, dateId, typeId, sort, pmids, proceed, pico, databases,
        strategy: edited,
        // Mode 4 only.
        evidenceTiers, caseSeries, corpus, clusters, scores, fromYear, toYear,
    } = req.body || {}

    // A seed is an identifier WITH A KIND (PMID or DOI), never a bare PMID — a Scopus-only record
    // has no PMID at all, and a PMID-keyed seed check could only ever validate the half of Scopus
    // that PubMed already covers. See parseSeeds.
    //
    // AND IT IS BOUNDED, because a seed is the most expensive character a librarian can type. Each
    // one costs several count calls to validate, and each one the strategy MISSES costs a Bedrock
    // Opus call to diagnose. Paste the 60-PMID "known includes" list from a previous review and a
    // single POST becomes ~300 sequential PubMed counts (paced at 500ms = minutes) plus one Opus
    // invocation per miss. Nothing upstream capped it: not the textarea, not parseSeeds.
    //
    // The whole design is built around "the 3-5 seeds a librarian already knows should come back", so
    // a bound of 10 costs a real user nothing and turns an unbounded paid fan-out into a 400.
    const MAX_SEEDS = 10
    const seedList: Seed[] = parseSeeds(seeds)
    if (seedList.length > MAX_SEEDS) {
        return res.status(400).send({
            statusCode: 400,
            message: `At most ${MAX_SEEDS} known-item seeds. A seed check is a recall spot-check, not a screening pass — pick the few papers that must come back.`,
        })
    }

    const body: SearchBody = {
        mode, phase, question, criteria, seeds, dateId, typeId, sort, pmids, proceed, pico, databases, edited, seedList,
        evidenceTiers, caseSeries, corpus, clusters, scores, fromYear, toYear,
    }

    // ---- SCREEN (Mode 2, phase 2). ------------------------------------------------------------
    if (phase === 'screen') {
        return handleScreen(req, res, cwid, body)
    }

    // ---- SYNTHESIZE (Mode 2, phase 3). ---------------------------------------------------------
    if (phase === 'synthesize') {
        return handleSynthesize(req, res, cwid, body)
    }

    // ---- MODE 4 ("Bibliometric review"), all four phases. Gated on `mode` as well as `phase` —
    // belt and braces, since these four phase strings are unique to this mode and nothing else on
    // this route could ever send one, but a route this dense is worth being explicit in.
    if (mode === 'bibliometric-review' && phase === 'm4-cluster') {
        return handleM4Cluster(req, res, cwid, body)
    }
    if (mode === 'bibliometric-review' && phase === 'm4-score') {
        return handleM4Score(req, res, cwid, body)
    }
    if (mode === 'bibliometric-review' && phase === 'm4-synthesize') {
        return handleM4Synthesize(req, res, cwid, body)
    }
    if (mode === 'bibliometric-review' && !phase) {
        return handleM4Retrieve(req, res, cwid, body)
    }

    // ---- THE RESULTS COLUMN. A record count per PRESS line, fetched on its own. ---------------
    //
    // Its own request because it is SLOW and the yield is not: 7 rows is 7 count calls, and the
    // retrieval tool paces every call at 500ms (each pod is smoothed to 2/s so 4 replicas stay under
    // NCBI's ~10/s keyed quota). Measured at 5.5s. Folding that into the re-count would have put five
    // and a half seconds between ticking a checkbox and seeing the number you ticked it for — and
    // that loop, free and instant, is the entire argument for Mode 1.
    //
    // So: the yield comes back in one call as it always did, and the column fills in behind it. No
    // model, no cost, and it takes the same strategy guard as every other path.
    if (phase === 'rows') {
        return handleRows(req, res, cwid, body)
    }

    // ---- RE-COUNT. No model and no cost log — but the EXPERT PANEL does change, and used not to.
    //
    // The old comment here said "none of them changed", and it was wrong about the panel:
    // meshFromConcepts() reads `line.terms` straight out of the concept blocks, and a toggle or an
    // edit is precisely a change to those blocks. So unticking both MeSH lines in the Depression
    // block re-counted the yield, renumbered the lines — and left "top 5 of 430 faculty publishing on
    // these MeSH terms" on screen, answering a strategy that no longer existed. A stale count with a
    // confident caption is the same sin as a wrong one.
    //
    // Recomputed only for PubMed: the panel is derived from MeSH, and Scopus has no controlled
    // vocabulary, so a Scopus toggle returns no `experts` key at all and the client leaves the panel
    // exactly as it was rather than blanking it.
    //
    // This is the path a toggle takes, in BOTH modes: untick a line, tick a suggested widening,
    // tick a priced narrowing — all of them post the strategy and get back a count. That is what
    // makes iterating free, and it is why a narrowing is a concept block and not a new endpoint.
    //
    // `!proceed` is what keeps this branch from swallowing the escape hatch. Mode 2's "retrieve the
    // top 50 anyway" ALSO posts a strategy, and it must reach the issue-review branch below and
    // come back with RECORDS. A re-count that quietly returned zero records to a librarian who
    // pressed Retrieve would look exactly like a search that found nothing.
    if (edited && !proceed) {
        return handleRecount(req, res, cwid, body)
    }

    // ---- BUILD + FETCH (Modes 2 AND 3, phase 1). ----------------------------------------------
    //
    // Mode 3 shares this branch on purpose. Its phase 1 IS Mode 2's phase 1 — same precision
    // strategy, same count-before-fetch, same narrowing gate, same escape hatch, same expert
    // panel. The ONLY differences are that the question arrives as four PICO fields, and that the
    // divergence proper happens at synthesis. Forking 60 lines to change two would just be two
    // copies of the narrowing gate to keep in step.
    if (mode === 'issue-review' || mode === 'clinical-question') {
        return handleIssueReviewOrClinicalQuestion(req, res, cwid, body)
    }

    // ---- BUILD (Mode 1). ----------------------------------------------------------------------
    return handleBuildStrategy(req, res, cwid, body)
}
