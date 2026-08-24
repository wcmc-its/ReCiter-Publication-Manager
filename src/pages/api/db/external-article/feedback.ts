import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { recordExternalArticleFeedback } from '../../../../../controllers/externalArticle.controller'
import { reciterConfig } from '../../../../../config/local'

// POST /api/db/external-article/feedback — curate per-source tabs (Option C, Phase 1):
// Accept / Reject / un-reject an already-added external (non-PubMed) publication. Same
// gate as authorships/action.ts (app-level backendApiKey), then resolves the curator
// identity from the next-auth JWT server-side — never trusted from the client body, same
// as the addedBy handling in external-article/[uid].ts. Proxies to the live Java
// PATCH /reciter/external-article/feedback, which sets suppressed=true on REJECTED /
// clears it on ACCEPTED and logs to FeedbackLog.
//
// Lives under /api/db/** so it inherits PR #893's session gate once that merges; until
// then the backendApiKey + JWT-actor pattern is the gate, same as every other /api/db
// route today.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(400).send('HTTP Method supported is POST')
    }
    if (req.headers.authorization === undefined) {
        return res.status(400).send('Authorization header is needed')
    }
    if (req.headers.authorization !== reciterConfig.backendApiKey) {
        return res.status(401).send('Authorization header is incorrect')
    }

    const { uid, articleId, action, note } = req.body || {}
    if (!uid || !articleId || !action) {
        return res.status(400).send({ statusCode: 400, message: 'uid, articleId, and action are required' })
    }
    if (action !== 'ACCEPTED' && action !== 'REJECTED' && action !== 'PENDING') {
        return res.status(400).send({ statusCode: 400, message: 'action must be ACCEPTED, REJECTED, or PENDING' })
    }

    // Resolve the curating user's CWID from the JWT — never trust a client-supplied actor.
    let actorPersonIdentifier: string | undefined = undefined
    try {
        const token: any = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
        if (token && token.username) actorPersonIdentifier = String(token.username)
    } catch (e) {
        // Leave actorPersonIdentifier undefined -> ReCiter records it as unknown.
    }

    try {
        const apiResponse = await recordExternalArticleFeedback(uid, articleId, action, actorPersonIdentifier, note)
        if (apiResponse.statusCode === 200) {
            return res.status(200).send({ statusCode: 200, external: apiResponse.statusText })
        }
        return res.status(apiResponse.statusCode || 502).send({ statusCode: apiResponse.statusCode || 502, message: apiResponse.statusText })
    } catch (err) {
        console.error('[external-article/feedback] Unhandled error:', err)
        return res.status(500).send({ statusCode: 500, message: 'Internal server error' })
    }
}
