import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import {
    getExternalArticles,
    addExternalArticle,
    deleteExternalArticle,
} from '../../../../../controllers/externalArticle.controller'
import { canCurate } from '../../../../../controllers/db/authorization.controller'
import { reciterConfig } from '../../../../../config/local'
import { effectiveToken } from '../../../../../src/utils/viewAs'

// PM#771 — external-source (OpenAlex) manual-add publications for a person.
//   GET    ?uid=<uid>                       -> all external rows (incl suppressed)
//   POST   ?uid=<uid>[&force=true]  body    -> add one (201, or 409 BLOCKED/WARNING)
//   DELETE ?uid=<uid>&articleId=<id>        -> revoke one
// Gated on the app backendApiKey, matching every other /api/reciter route on this
// branch. addedBy (curator CWID) is resolved best-effort from the JWT server-side and
// never trusted from the client. POST and DELETE take the same canCurate gate as the
// PubMed curate writes (goldstandard.ts, save/userfeedback): whoever may accept or reject
// PubMed suggestions for a person may add or remove that person's external records, not
// only the curator who added a given row. GET stays ungated beyond the api key, like the
// PubMed read routes (feature-generator, feedback-log).

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
    if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') {
        return res.status(400).send({ statusCode: 400, message: 'HTTP Methods supported are GET, POST, DELETE' })
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
        let token: any = null
        if (method !== 'GET') {
            try {
                token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
            } catch (e) {
                // Unreadable token -> canCurate denies below.
            }
            const allowed = await canCurate(effectiveToken(token), uid)
            if (!allowed) {
                return res.status(403).send({
                    statusCode: 403,
                    message: "You do not have permission to curate this person's publications"
                })
            }
        }

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

        // POST — resolve the curating user's CWID from the JWT for addedBy.
        // Left undefined when the token has no username -> ReCiter records it as unknown.
        let addedBy: string | undefined = undefined
        if (token && token.username) addedBy = String(token.username)

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
