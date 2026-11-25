import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { reciterConfig } from '../../../../../config/local'
import { canCurate } from '../../../../../controllers/db/authorization.controller'
import { applyAuthorIdAction, listAuthorIds } from '../../../../../controllers/db/manage-profile/authorIds.controller'
import { effectiveToken } from '../../../../utils/viewAs'
import { AUTHOR_ID_ACTIONS, AUTHOR_ID_TYPES, AuthorIdAction, AuthorIdType, normalizeAuthorId } from '../../../../utils/authorIds'

// GET  /api/db/author-ids/[uid]  -> { available, canEdit, ids }
// POST /api/db/author-ids/[uid]  { action: confirm|reject|undo|add, idType, idValue } -> { row }
//
// The person's Scopus Author IDs and OpenAlex author ids (reciterdb.person_author_id, 3f).
// Under the /api/db/** session gate (src/middleware.ts), so any signed-in user may read, as
// with the Profile sheet. Every write checks canCurate(effectiveToken(token), uid), the same
// gate as the other per-person curation writes (external-article/feedback.ts); the actor
// written to decided_by is the real signed-in user from the JWT, never the client body.
// available=false means the table is not on this reciterdb yet; the card then hides.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(400).send('HTTP Methods supported are GET and POST')
    }
    if (req.headers.authorization === undefined) {
        return res.status(400).send('Authorization header is needed')
    }
    if (req.headers.authorization !== reciterConfig.backendApiKey) {
        return res.status(401).send('Authorization header is incorrect')
    }
    const uid = req.query.uid
    if (typeof uid !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(uid)) {
        return res.status(400).send({ statusCode: 400, message: 'A valid uid is required' })
    }

    let token: any = null
    try {
        token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    } catch (e) {
        // decode failure -> no actor; handled below
    }
    const actor = token?.username ? String(token.username) : ''

    try {
        if (req.method === 'GET') {
            const { available, ids } = await listAuthorIds(uid)
            const canEdit = available && !!token && await canCurate(effectiveToken(token), uid)
            return res.status(200).send({ available, canEdit, ids })
        }

        if (!actor) {
            return res.status(401).send({ statusCode: 401, message: 'Your session has expired. Please sign in again.' })
        }
        if (!(await canCurate(effectiveToken(token), uid))) {
            return res.status(403).send({ statusCode: 403, message: "You do not have permission to curate this person's profile" })
        }
        const { action, idType, idValue } = req.body || {}
        if (!AUTHOR_ID_ACTIONS.includes(action)) {
            return res.status(400).send({ statusCode: 400, message: 'action must be confirm, reject, undo or add' })
        }
        if (!AUTHOR_ID_TYPES.includes(idType)) {
            return res.status(400).send({ statusCode: 400, message: 'idType must be SCOPUS_AUID or OPENALEX_AUTHOR' })
        }
        const value = normalizeAuthorId(idType as AuthorIdType, idValue)
        if (!value) {
            return res.status(400).send({
                statusCode: 400,
                message: idType === 'SCOPUS_AUID' ? 'A Scopus Author ID is digits only' : 'An OpenAlex author id is A followed by digits',
            })
        }
        const result = await applyAuthorIdAction(uid, actor, action as AuthorIdAction, idType as AuthorIdType, value)
        if (result.http === 200 && 'row' in result) {
            return res.status(200).send({ statusCode: 200, row: result.row, changed: result.changed })
        }
        const err = result as { http: number, message: string, conflictUid?: string }
        return res.status(err.http).send({ statusCode: err.http, message: err.message, conflictUid: err.conflictUid })
    } catch (e) {
        console.error('[author-ids] Unhandled error:', e)
        return res.status(500).send({ statusCode: 500, message: 'Internal server error' })
    }
}
