import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveCitations } from '../../../../../controllers/listImport.controller'
import { gate, refuse } from '../../../../../controllers/listImportGate'
import { sanitizeCitations } from '../../../../lib/listImport'

// "Import a list" step 3 (plan 2026-11-20-import-a-list-plan.md).
//   POST /api/db/import/resolve {uid, items}   at most 10 citations -> {results}; writes nothing
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const uid = await gate(req, res)
    if (!uid) return
    const raw = req.body?.items
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 10) {
        return refuse(res, req, 400, 'items must be a list of 1 to 10 citations')
    }
    // Same shape check as extract; the titles' own text is the source here, so nothing is "invented".
    const { items } = sanitizeCitations(raw, raw.map((r: any) => (r && typeof r.title === 'string' ? r.title : '')).join('\n'))
    try {
        const t0 = Date.now()
        const results = await resolveCitations(items)
        // Why lookups failed, counted (never the titles): "Crossref HTTP 429 x3".
        const why: Record<string, number> = {}
        results.forEach((r) => { if (r.error) why[r.error] = (why[r.error] || 0) + 1 })
        const reasons = Object.entries(why).map(([e, n]) => `${e} x${n}`).join(', ')
        console.log(`[import/resolve] uid=${uid} items=${items.length} matched=${results.filter((r) => r.match).length} errors=${results.filter((r) => r.error).length} ms=${Date.now() - t0}${reasons ? ` reasons=${reasons}` : ''}`)
        return res.status(200).send({ statusCode: 200, results })
    } catch (err: any) {
        console.error(`[import/resolve] uid=${uid} failed: ${err?.message || err}`)
        return res.status(502).send({ statusCode: 502, message: 'Lookup failed. Try again in a minute.' })
    }
}
