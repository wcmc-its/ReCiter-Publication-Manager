import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import {
    getExternalArticles,
    addExternalArticle,
    deleteExternalArticle,
    updateExternalArticleDispute,
    notifyDispute,
} from '../../../../../controllers/externalArticle.controller'
import { reciterConfig } from '../../../../../config/local'

// PM#771 — external-source (OpenAlex) manual-add publications for a person.
//   GET    ?uid=<uid>                       -> all external rows (incl suppressed)
//   POST   ?uid=<uid>[&force=true]  body    -> add one (201, or 409 BLOCKED/WARNING)
//   DELETE ?uid=<uid>&articleId=<id>        -> revoke one
//   PATCH  ?uid=<uid>&articleId=<id>  body {action: DISPUTE|RETRACT|RESOLVE, disputeNote?}
//          -> faculty dispute lifecycle (docs/README-other-publications-tab.md)
// Gated on the app backendApiKey, matching every other /api/reciter route on this
// branch. addedBy (curator CWID) is resolved best-effort from the JWT server-side and
// never trusted from the client. (Per-person curation-scope authz is an AAR-line
// feature not present on this branch — see the PR notes.) PATCH's actingUid is
// resolved the same way — see Trust boundary #2 in the README.

type Error = {
    statusCode: number,
    message: any,
}

type Data = {
    statusCode: number,
    external?: any,
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Error | Data>
) {
    const method = req.method || ''
    if (method !== 'GET' && method !== 'POST' && method !== 'DELETE' && method !== 'PATCH') {
        return res.status(400).send({ statusCode: 400, message: 'HTTP Methods supported are GET, POST, DELETE, PATCH' })
    }

    if (req.headers.authorization === undefined) {
        return res.status(400).send({ statusCode: 400, message: 'Authorization header is needed' })
    }
    if (req.headers.authorization !== reciterConfig.backendApiKey) {
        return res.status(401).send({ statusCode: 401, message: 'Authorization header is incorrect' })
    }

    const uidParam = req.query.uid
    const uid = Array.isArray(uidParam) ? uidParam[0] : uidParam
    if (!uid) {
        return res.status(400).send({ statusCode: 400, message: 'uid is required' })
    }

    try {
        if (method === 'GET') {
            const apiResponse = await getExternalArticles(uid)
            if (apiResponse.statusCode === 200) {
                return res.status(200).send({ statusCode: 200, external: apiResponse.statusText })
            }
            return res.status(apiResponse.statusCode || 502).send({ statusCode: apiResponse.statusCode || 502, message: apiResponse.statusText })
        }

        if (method === 'DELETE') {
            const articleIdParam = req.query.articleId
            const articleId = Array.isArray(articleIdParam) ? articleIdParam[0] : articleIdParam
            if (!articleId) {
                return res.status(400).send({ statusCode: 400, message: 'articleId is required for delete' })
            }
            const apiResponse = await deleteExternalArticle(uid, articleId)
            if (apiResponse.statusCode === 200) {
                return res.status(200).send({ statusCode: 200, external: apiResponse.statusText })
            }
            return res.status(apiResponse.statusCode || 502).send({ statusCode: apiResponse.statusCode || 502, message: apiResponse.statusText })
        }

        if (method === 'PATCH') {
            const articleIdParam = req.query.articleId
            const articleId = Array.isArray(articleIdParam) ? articleIdParam[0] : articleIdParam
            if (!articleId) {
                return res.status(400).send({ statusCode: 400, message: 'articleId is required for dispute update' })
            }
            const action = req.body && req.body.action
            if (action !== 'DISPUTE' && action !== 'RETRACT' && action !== 'RESOLVE') {
                return res.status(400).send({ statusCode: 400, message: "action must be one of DISPUTE, RETRACT, RESOLVE" })
            }

            // Never trust a client-supplied actingUid — resolve from the session JWT.
            let actingUid: string | undefined = undefined
            try {
                const token: any = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
                if (token && token.username) actingUid = String(token.username)
            } catch (e) {
                // fall through — actingUid stays undefined, handled below
            }
            if (!actingUid) {
                return res.status(401).send({ statusCode: 401, message: 'Could not resolve the acting user from the session' })
            }

            const disputeNote = typeof req.body?.disputeNote === 'string' ? req.body.disputeNote : undefined
            const apiResponse = await updateExternalArticleDispute(uid, articleId, actingUid, action, disputeNote)
            if (apiResponse.statusCode === 200) {
                // Decision 7 — notify the row's addedBy on DISPUTE only (not on retract/resolve).
                if (action === 'DISPUTE') {
                    const row: any = apiResponse.statusText
                    if (row && row.addedBy) {
                        notifyDispute(row.addedBy, uid, row.title || articleId, actingUid, disputeNote)
                            .catch((e) => console.log('[external-article] notifyDispute failed: ' + e))
                    }
                }
                return res.status(200).send({ statusCode: 200, external: apiResponse.statusText })
            }
            return res.status(apiResponse.statusCode || 502).send({ statusCode: apiResponse.statusCode || 502, message: apiResponse.statusText })
        }

        // POST — resolve the curating user's CWID from the JWT for addedBy.
        let addedBy: string | undefined = undefined
        try {
            const token: any = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
            if (token && token.username) addedBy = String(token.username)
        } catch (e) {
            // Leave addedBy undefined -> ReCiter records it as unknown.
        }

        const force = String(req.query.force) === 'true'
        const apiResponse = await addExternalArticle(uid, req.body, addedBy, force)
        if (apiResponse.statusCode === 201 || apiResponse.statusCode === 200) {
            return res.status(apiResponse.statusCode).send({ statusCode: apiResponse.statusCode, external: apiResponse.statusText })
        }
        // 400 INVALID / 404 uid / 409 BLOCKED|WARNING — pass the payload straight through
        // so the UI can distinguish BLOCKED (no override) from WARNING (retry with force).
        return res.status(apiResponse.statusCode || 502).send({ statusCode: apiResponse.statusCode || 502, message: apiResponse.statusText })
    } catch (err) {
        console.error('[external-article] Unhandled error:', err)
        return res.status(500).send({ statusCode: 500, message: 'Internal server error' })
    }
}
