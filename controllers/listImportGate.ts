// "Import a list": the request guard both routes share. Kept apart from listImport.controller so
// that file loads without the database layer (the local replay script compiles it alone).
import type { NextApiRequest, NextApiResponse } from 'next'
import { apiKeyOk, sessionOf } from './db/external.controller'
import { canCurate } from './db/authorization.controller'
import { listImportEnabled } from './listImport.controller'
import { canonicalCwid } from '../src/utils/canonicalCwid'

// Both routes: POST only, the flag (404 when off, so the dialog hides the choice), the
// backendApiKey, and a session that may curate this uid. The /api/db session gate in middleware
// runs first; the per-uid check stops a signed-in user from running imports for anyone else.
// GET answers 200 when the feature is on (the dialog's probe) and does nothing else.
// Every refusal is logged (status, reason, uid; never the text): silent 4xxs hid the few2001
// failure on 11-23. GET probes and the flag-off 404 stay quiet; they are routine.
export function refuse(res: NextApiResponse, req: NextApiRequest, status: number, message: string): null {
    console.log(`[import/refused] ${req.url} uid=${typeof req.body?.uid === 'string' ? req.body.uid.slice(0, 32) : '-'} status=${status} ${message}`)
    res.status(status).send({ statusCode: status, message })
    return null
}

export async function gate(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
    if (!listImportEnabled()) { res.status(404).send({ statusCode: 404, message: 'Not found' }); return null }
    if (req.method === 'GET') { res.status(200).send({ statusCode: 200, enabled: true }); return null }
    if (req.method !== 'POST') return refuse(res, req, 400, 'HTTP Method supported is POST')
    if (!apiKeyOk(req, res)) { console.log(`[import/refused] ${req.url} status=${res.statusCode} api key`); return null }
    const uid = req.body?.uid
    if (typeof uid !== 'string' || !uid.trim()) return refuse(res, req, 400, 'uid is required')
    const s = await sessionOf(req)
    if (!s.actor) return refuse(res, req, 401, 'Your session has expired. Please sign in again.')
    if (!(await canCurate(s.eff, uid))) return refuse(res, req, 403, "You do not have permission to curate this person's publications")
    // One spelling of the uid (#1162); the write routes the dialog then calls canonicalize too.
    return canonicalCwid(uid)
}
