import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveCitations } from '../../../../../controllers/listImport.controller'
import { gate } from '../../../../../controllers/listImportGate'
import { sanitizeCitations } from '../../../../lib/listImport'

// "Import a list" step 3 (plan 2026-11-20-import-a-list-plan.md).
//   POST /api/db/import/resolve {uid, items}   at most 10 citations -> {results}; writes nothing
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const uid = await gate(req, res)
    if (!uid) return
    const raw = req.body?.items
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 10) {
        return res.status(400).send({ statusCode: 400, message: 'items must be a list of 1 to 10 citations' })
    }
    // Same shape check as extract; the titles' own text is the source here, so nothing is "invented".
    const { items } = sanitizeCitations(raw, raw.map((r: any) => (r && typeof r.title === 'string' ? r.title : '')).join('\n'))
    try {
        const results = await resolveCitations(items)
        console.log(`[import/resolve] uid=${uid} items=${items.length} matched=${results.filter((r) => r.match).length} errors=${results.filter((r) => r.error).length}`)
        return res.status(200).send({ statusCode: 200, results })
    } catch (err: any) {
        console.error(`[import/resolve] uid=${uid} failed: ${err?.message || err}`)
        return res.status(502).send({ statusCode: 502, message: 'Lookup failed. Try again in a minute.' })
    }
}
