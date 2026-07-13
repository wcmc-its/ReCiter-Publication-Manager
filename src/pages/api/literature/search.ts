// POST /api/literature/search — Mode 1 ("Search strategy").
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
    bedrockConfigured,
} from '../../../../controllers/literatureSearch.controller'
import { findWcmExperts } from '../../../../controllers/db/wcmExperts.controller'

function allowlist(): string[] {
    return (process.env.LITERATURE_SEARCH_CWIDS || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
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
function meshFromConcepts(concepts: { terms: string }[]): string[] {
    const found = new Set<string>()
    for (const c of concepts) {
        for (const token of c.terms.split(/\s+OR\s+/i)) {
            const m = token.match(/^\s*\(?\s*"?([^"[\]]+?)"?\s*\[MeSH/i)
            if (m) found.add(m[1].trim())
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

    // 2. Pilot allowlist.
    const allowed = allowlist()
    if (allowed.length === 0 || !allowed.includes(cwid)) {
        return res.status(403).send({
            statusCode: 403,
            message: 'Literature Search is in a limited pilot. Contact the ReCiter team for access.',
        })
    }

    if (!bedrockConfigured()) {
        return res.status(503).send({ statusCode: 503, message: 'Literature Search is not configured on this environment.' })
    }

    const { question, criteria, filters, seeds } = req.body || {}
    if (!question || !String(question).trim()) {
        return res.status(400).send({ statusCode: 400, message: 'A research question is required.' })
    }

    const seedPmids: string[] = Array.isArray(seeds)
        ? seeds
        : String(seeds || '').split(/[\s,]+/).filter(Boolean)

    try {
        const { strategy, usage } = await buildStrategy(String(question), criteria, filters)

        // Counts + known-item validation. No records are retrieved, so this is cheap and
        // scales to a 15,000-hit strategy.
        const result = await runStrategy(strategy, seedPmids)

        // The expert panel works with no records at all — straight off the query's MeSH.
        let experts = { experts: [], total: 0 }
        try {
            const mesh = meshFromConcepts(strategy.concepts)
            if (mesh.length) experts = await findWcmExperts(mesh, 5) as any
        } catch (e) {
            // The panel is a bonus, not the deliverable. Never fail the strategy over it.
            console.error('[literature] expert panel failed:', e)
        }

        // Cost visibility. One structured line per call; grep the pod logs. NOTE: the
        // question text is deliberately NOT logged — see the data-handling section of the
        // spec. Never show this figure to the librarian: query iteration is the behaviour
        // we want, and a running meter teaches them to ration it.
        //
        // ponytail: env-driven rates, not a constant. Bedrock's per-Mtok price is a function
        // of BEDROCK_MODEL_ID and region, so a baked-in number silently becomes a lie the
        // moment the model changes. The 5/25 default is Anthropic's FIRST-PARTY list price
        // for Opus 4.8 and is NOT a verified Bedrock rate — set these two vars from the AWS
        // pricing page for the profile actually in use before anyone trusts estUsd.
        const inRate = Number(process.env.BEDROCK_USD_PER_MTOK_IN || 5)
        const outRate = Number(process.env.BEDROCK_USD_PER_MTOK_OUT || 25)
        const cost = (usage.inputTokens / 1e6) * inRate + (usage.outputTokens / 1e6) * outRate
        console.log(JSON.stringify({
            tag: 'literature-search',
            mode: 'search-strategy',
            model: process.env.BEDROCK_MODEL_ID,    // so estUsd can be reconciled to a rate later
            cwid,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            estUsd: Number(cost.toFixed(4)),
            hits: result.hits,
            seeds: result.seeds.length,
            seedsRetrieved: result.seeds.filter(s => s.retrieved).length,
        }))

        return res.status(200).send({ statusCode: 200, databases: [result], experts })
    } catch (err: any) {
        console.error('[literature] strategy failed:', err)
        return res.status(502).send({ statusCode: 502, message: err?.message || 'Strategy build failed.' })
    }
}
