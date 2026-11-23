import type { NextApiRequest, NextApiResponse } from 'next'
import { extractCitations } from '../../../../../controllers/listImport.controller'
import { gate, refuse } from '../../../../../controllers/listImportGate'
import { CHUNK_CHARS } from '../../../../lib/listImport'

// "Import a list" step 2 (plan 2026-11-20-import-a-list-plan.md).
//   GET  /api/db/import/extract                 200 when LIST_IMPORT=on (the dialog's probe), else 404
//   POST /api/db/import/extract {uid, text}     one chunk (the client splits the paste) -> {items, dropped, via}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const uid = await gate(req, res)
    if (!uid) return
    const text = req.body?.text
    if (typeof text !== 'string' || !text.trim()) return refuse(res, req, 400, 'text is required')
    // The client sends chunks of CHUNK_CHARS split on line boundaries; allow some slack.
    if (text.length > CHUNK_CHARS * 2) return refuse(res, req, 413, 'Send the text in smaller pieces.')
    try {
        const out = await extractCitations(text)
        console.log(`[import/extract] uid=${uid} chars=${text.length} via=${out.via} items=${out.items.length} dropped=${out.dropped}`)
        return res.status(200).send({ statusCode: 200, ...out })
    } catch (err: any) {
        console.error(`[import/extract] uid=${uid} failed: ${err?.name || ''} ${err?.message || err}`)
        return res.status(502).send({ statusCode: 502, message: 'Could not read the list right now. Try again in a minute.' })
    }
}
