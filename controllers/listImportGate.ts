// "Import a list": the request guard both routes share. Kept apart from listImport.controller so
// that file loads without the database layer (the local replay script compiles it alone).
import type { NextApiRequest, NextApiResponse } from 'next'
import { apiKeyOk, sessionOf } from './db/external.controller'
import { canCurate } from './db/authorization.controller'
import { listImportEnabled } from './listImport.controller'

// Both routes: POST only, the flag (404 when off, so the dialog hides the choice), the
// backendApiKey, and a session that may curate this uid. The /api/db session gate in middleware
// runs first; the per-uid check stops a signed-in user from running imports for anyone else.
// GET answers 200 when the feature is on (the dialog's probe) and does nothing else.
export async function gate(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
    if (!listImportEnabled()) { res.status(404).send({ statusCode: 404, message: 'Not found' }); return null }
    if (req.method === 'GET') { res.status(200).send({ statusCode: 200, enabled: true }); return null }
    if (req.method !== 'POST') { res.status(400).send({ statusCode: 400, message: 'HTTP Method supported is POST' }); return null }
    if (!apiKeyOk(req, res)) return null
    const uid = req.body?.uid
    if (typeof uid !== 'string' || !uid.trim()) { res.status(400).send({ statusCode: 400, message: 'uid is required' }); return null }
    const s = await sessionOf(req)
    if (!s.actor) { res.status(401).send({ statusCode: 401, message: 'Your session has expired. Please sign in again.' }); return null }
    if (!(await canCurate(s.eff, uid))) { res.status(403).send({ statusCode: 403, message: "You do not have permission to curate this person's publications" }); return null }
    return uid
}
