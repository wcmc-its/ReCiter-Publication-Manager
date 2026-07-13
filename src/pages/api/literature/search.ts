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
    suggestFixes,
    seedRecords,
    fetchByPmids,
    screenRecords,
    synthesize,
    bedrockConfigured,
    RECORD_CAP,
    Strategy,
    Concept,
    Sort,
    UsageLog,
} from '../../../../controllers/literatureSearch.controller'
import { buildLimits } from '../../../../controllers/literatureSearch.strategy'
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
const MAX_CONCEPTS = 12
const MAX_LINES = 25
const MAX_TERMS = 2000

function parseStrategy(raw: any): Strategy {
    if (!raw || !Array.isArray(raw.concepts) || !raw.concepts.length || raw.concepts.length > MAX_CONCEPTS) {
        throw new Error('malformed strategy')
    }
    const concepts: Concept[] = raw.concepts.map((c: any) => {
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
    // Limits are resolved from ids server-side (see buildLimits) and never accepted as text —
    // otherwise a re-count could run a query the build path could not have produced.
    return { db: 'pubmed', concepts, limits: buildLimits(String(raw.dateId ?? ''), String(raw.typeId ?? '')) }
}

// The MeSH descriptors the strategy targets, for the "At Weill Cornell" panel. Pulled
// straight out of the concept blocks the model wrote — the join key is free because
// person_article_keyword is itself keyed on MeSH.
//
// Both quoted and UNQUOTED descriptors are valid PubMed, and the model emits both --
// "Gastrointestinal Microbiome"[MeSH] and Probiotics[MeSH]. An earlier regex here required
// the quotes, so a strategy written in the unquoted style extracted zero MeSH terms and the
// panel silently rendered empty while the strategy itself looked perfect. Split on OR and
// take the descriptor off each [MeSH]-tagged token instead; [tiab] free-text terms are
// skipped because the join key is MeSH.
// NOT EVERY MeSH DESCRIPTOR IS A TOPIC. "Humans"[MeSH] is a FILTER — Mode 2 emits it as its own
// AND-ed block (see hoistFilters), and every clinical paper ever indexed carries it. Harvest it as
// a topic and the "At Weill Cornell" panel stops answering "who here works on probiotics?" and
// starts answering "who here publishes on humans?" — which is everyone, ranked by output. The
// panel would still render, still look plausible, and be worthless. Caught in a live run:
//   WHERE k.keyword IN ('Probiotics', 'Lactobacillus', 'Bifidobacterium', 'Humans')
//
// Same for Animals, Male, Female, Adult, Aged, Adolescent, Child — the MEDLINE "check tags", which
// are applied to nearly every record by definition and are therefore never what the panel means.
const NOT_A_TOPIC = new Set([
    'humans', 'human', 'animals', 'male', 'female',
    'adult', 'adolescent', 'aged', 'child', 'infant', 'middle aged', 'young adult',
])

function meshFromConcepts(concepts: Concept[]): string[] {
    const found = new Set<string>()
    for (const c of concepts) {
        for (const line of c.lines) {
            for (const token of line.terms.split(/\s+OR\s+/i)) {
                const m = token.match(/^\s*\(?\s*"?([^"[\]]+?)"?\s*\[(?:MeSH|majr)/i)
                if (m && !NOT_A_TOPIC.has(m[1].trim().toLowerCase())) found.add(m[1].trim())
            }
        }
    }
    return Array.from(found)
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

    const { mode, phase, question, criteria, seeds, dateId, typeId, sort, pmids, proceed, strategy: edited } = req.body || {}

    const seedPmids: string[] = Array.isArray(seeds)
        ? seeds
        : String(seeds || '').split(/[\s,]+/).filter(Boolean)

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

            const { flags, usage } = await screenRecords(String(question), String(criteria || ''), records)
            logCost('issue-review:screen', cwid, usage, {
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

            const { synthesis, usage } = await synthesize(String(question), records)
            logCost('issue-review:synthesize', cwid, usage, {
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
            })
        } catch (err: any) {
            console.error('[literature] synthesis failed:', err)
            return res.status(502).send({ statusCode: 502, message: err?.message || 'Synthesis failed.' })
        }
    }

    // ---- RE-COUNT. No model, no cost log, no expert panel (none of them changed). -----------
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
            const result = await runStrategy(parseStrategy({ ...edited, dateId, typeId }), seedPmids)
            return res.status(200).send({ statusCode: 200, databases: [result] })
        } catch (err: any) {
            console.error('[literature] recount failed:', err)
            return res.status(502).send({ statusCode: 502, message: err?.message || 'Could not re-count the strategy.' })
        }
    }

    // ---- BUILD + FETCH (Mode 2, phase 1). -----------------------------------------------------
    if (mode === 'issue-review') {
        try {
            const limits = buildLimits(String(dateId ?? ''), String(typeId ?? ''))
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

            if (edited) {
                strategy = parseStrategy({ ...edited, dateId, typeId })
            } else {
                if (!bedrockConfigured()) {
                    return res.status(503).send({ statusCode: 503, message: 'Literature Search is not configured on this environment.' })
                }
                if (!question || !String(question).trim()) {
                    return res.status(400).send({ statusCode: 400, message: 'A question is required.' })
                }
                const built = await buildStrategy(String(question), limits, criteria, 'precision')
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
            logCost('issue-review:build', cwid, usage, {
                hits: result.hits,
                records: result.records.length,
                needsNarrowing: !!result.needsNarrowing,
                narrowings: result.narrowings?.length ?? 0,
                proceed: proceed === true,
                fromEditedStrategy: !!edited,
            })

            return res.status(200).send({ statusCode: 200, databases: [result], experts })
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

    try {
        // The limits are OURS, not the model's: resolved from the two dropdown ids into PubMed
        // syntax by a server-side table. See buildLimits().
        const limits = buildLimits(String(dateId ?? ''), String(typeId ?? ''))

        const { strategy, usage } = await buildStrategy(String(question), limits, criteria)

        // Counts + known-item validation. No records are retrieved, so this is cheap and
        // scales to a 15,000-hit strategy.
        let result = await runStrategy(strategy, seedPmids)

        // Fetch the seed records themselves — one bounded call, never fatal. This buys the
        // author+year label AND the title/MeSH the fix model needs in order to see the paper it
        // is being asked to widen for.
        const records = await seedRecords(result.seeds.map(s => s.pmid))
        result = { ...result, seeds: result.seeds.map(s => ({ ...s, label: records[s.pmid]?.label })) }

        // For anything it missed: ask the model for the terms that would retrieve it, VERIFY
        // that they do, PRICE what they cost, and hand the result back as an unticked line in
        // the block it belongs to. Advice the librarian can inspect and reject, not a paragraph.
        const fixed = await suggestFixes(strategy, result, records)
        result = { ...result, concepts: fixed.strategy.concepts }

        // The expert panel works with no records at all — straight off the query's MeSH.
        let experts = { experts: [], total: 0 }
        try {
            const mesh = meshFromConcepts(strategy.concepts)
            if (mesh.length) experts = await findWcmExperts(mesh, 5) as any
        } catch (e) {
            // The panel is a bonus, not the deliverable. Never fail the strategy over it.
            console.error('[literature] expert panel failed:', e)
        }

        // The build and the fixes are one run from the librarian's point of view, so they are one
        // cost line. Iteration after this call is free anyway — every toggle takes the no-model
        // re-count path above.
        logCost('search-strategy', cwid, {
            inputTokens: usage.inputTokens + fixed.usage.inputTokens,
            outputTokens: usage.outputTokens + fixed.usage.outputTokens,
        }, {
            hits: result.hits,
            seeds: result.seeds.length,
            seedsRetrieved: result.seeds.filter(s => s.retrieved).length,
        })

        return res.status(200).send({ statusCode: 200, databases: [result], experts })
    } catch (err: any) {
        console.error('[literature] strategy failed:', err)
        return res.status(502).send({ statusCode: 502, message: err?.message || 'Strategy build failed.' })
    }
}
