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
} from '../../../../controllers/literatureSearch.controller'
import {
    buildLimits, picoQuestion, picoComplete, parseSeeds, DIALECTS,
    MAX_CONCEPTS, MAX_LINES, MAX_TERMS,
    Pico, Db, Seed, Rendering,
} from '../../../../controllers/literatureSearch.strategy'
import { findWcmExperts } from '../../../../controllers/db/wcmExperts.controller'
import { isAllowlisted } from '../../../../controllers/literatureAllowlist'

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


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).send({ statusCode: 405, message: 'POST only' })
    }

    // 1. Real session auth.
    let cwid = ''
    try {
        const token: any = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
        if (!token?.username) {
            return res.status(401).send({ statusCode: 401, message: 'Sign in to use Literature Search.' })
        }
        cwid = String(token.username).toLowerCase()
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

    const { mode, phase, question, criteria, seeds, dateId, typeId, sort, pmids, proceed, pico, databases, strategy: edited } = req.body || {}

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

    // ---- SCREEN (Mode 2, phase 2). ------------------------------------------------------------
    if (phase === 'screen') {
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

    // ---- SYNTHESIZE (Mode 2, phase 3). ---------------------------------------------------------
    if (phase === 'synthesize') {
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

    // ---- BUILD + FETCH (Modes 2 AND 3, phase 1). ----------------------------------------------
    //
    // Mode 3 shares this branch on purpose. Its phase 1 IS Mode 2's phase 1 — same precision
    // strategy, same count-before-fetch, same narrowing gate, same escape hatch, same expert
    // panel. The ONLY differences are that the question arrives as four PICO fields, and that the
    // divergence proper happens at synthesis. Forking 60 lines to change two would just be two
    // copies of the narrowing gate to keep in step.
    if (mode === 'issue-review' || mode === 'clinical-question') {
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
                const built = await buildStrategy(
                    asked, limits, criteria, 'precision',
                    isPico ? (pico as Pico) : undefined,
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

    // ---- BUILD (Mode 1). ----------------------------------------------------------------------
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
        const survived = results.filter(r => !r.failed)

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
            failed: results.filter(r => r.failed).map(r => r.db).join(' '),
            degraded: survived.filter(r => r.degraded).map(r => r.db).join(' '),
            seeds: seedList.length,
            seedsRetrieved: survived.map(r => `${r.db}:${r.seeds.filter((s: any) => s.retrieved).length}`).join(' '),
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
