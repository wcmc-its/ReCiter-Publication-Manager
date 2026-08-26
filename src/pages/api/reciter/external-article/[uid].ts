import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import {
    getExternalArticles,
    addExternalArticle,
    deleteExternalArticle,
    recordExternalArticleFeedback,
} from '../../../../../controllers/externalArticle.controller'
import { canCurate } from '../../../../../controllers/db/authorization.controller'
import { notifyExternalArticleDisputed } from '../../../../../controllers/db/notifications/externalArticleDispute.controller'
import { getCapabilities } from '../../../../utils/constants'
import { reciterConfig } from '../../../../../config/local'

// PM#771 — external-source (OpenAlex) manual-add publications for a person.
//   GET    ?uid=<uid>                       -> all external rows (incl suppressed)
//   POST   ?uid=<uid>[&force=true]  body    -> add one (201, or 409 BLOCKED/WARNING)
//   DELETE ?uid=<uid>&articleId=<id>        -> revoke one
//   PATCH  ?uid=<uid>  body {articleId, action, note?} -> faculty dispute (REJECTED)
//          or retract (ACCEPTED) via the Java FeedbackLog endpoint
// Gated on the app backendApiKey, matching every other /api/reciter route on this
// branch. addedBy (curator CWID) is resolved best-effort from the JWT server-side and
// never trusted from the client. (Per-person curation-scope authz is an AAR-line
// feature not present on this branch — see the PR notes.) PATCH is stricter: it is a
// write faculty reach from the unguarded /app page, so it requires a session and passes
// canCurate (Curator_Self may only act on their own uid) before anything happens.

const parseRoles = (value: any): any[] => {
    if (Array.isArray(value)) return value
    if (typeof value !== 'string') return []
    try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : []
    } catch (e) {
        return []
    }
}

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
            // Faculty dispute ("This isn't mine" -> REJECTED) / retract (-> ACCEPTED).
            // actorPersonIdentifier is stamped from the JWT server-side — the same trust
            // boundary as POST's addedBy and goldstandard.ts's curatedBy. Never from the body.
            let token: any = null
            try {
                token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
            } catch (e) {
                token = null
            }
            const actor = token && token.username ? String(token.username) : undefined
            if (!actor) {
                return res.status(401).send({ statusCode: 401, message: 'A signed-in session is required' })
            }

            // Same server-side gate as goldstandard.ts (PM#849): the static backendApiKey
            // above only proves the request came through this app, not who is behind it.
            // canCurate lets Curator_All/Scoped act per role and Curator_Self act only on
            // their own uid — which is exactly the faculty-dispute ownership rule.
            const allowed = await canCurate(token, uid)
            if (!allowed) {
                return res.status(403).send({
                    statusCode: 403,
                    message: "You do not have permission to update this person's publications",
                })
            }

            const { articleId, action, note } = req.body || {}
            if (!articleId || typeof articleId !== 'string') {
                return res.status(400).send({ statusCode: 400, message: 'articleId is required' })
            }
            if (action !== 'REJECTED' && action !== 'ACCEPTED') {
                return res.status(400).send({ statusCode: 400, message: 'action must be REJECTED (dispute) or ACCEPTED (retract)' })
            }
            const noteText = typeof note === 'string' && note.trim() ? note.trim() : undefined

            // Snapshot the live row BEFORE the write: addedBy for the Decision-7
            // notification, and the pre-write suppressed state so only the first
            // REJECTED transition notifies — a repeat dispute of an already-suppressed
            // row must not email the curator again. Best-effort: a failed read just
            // means no notification, never a failed dispute.
            let preRow: any = undefined
            if (action === 'REJECTED') {
                try {
                    const live = await getExternalArticles(uid)
                    preRow = live.statusCode === 200 && Array.isArray(live.statusText)
                        ? (live.statusText as any[]).find((r: any) => r?.articleId === articleId)
                        : undefined
                } catch (e) {
                    console.error('[external-article] pre-write row lookup failed (dispute proceeds, notification skipped):', e)
                }
            }

            const apiResponse = await recordExternalArticleFeedback(uid, articleId, action, actor, noteText)
            // Mirrors logScopusFeedback's status handling, but fails loud in both cases:
            // here the FeedbackLog write IS the action, so an unknown uid (404 with an
            // INVALID body) or an unrouted Java endpoint (bare 404, e.g. not yet deployed)
            // must surface as a failure — never a silent success.
            if (apiResponse.statusCode !== 200) {
                const uidUnknown = apiResponse.statusCode === 404 && (apiResponse.statusText as any)?.status === 'INVALID'
                const status = uidUnknown ? 404 : 502
                const message = uidUnknown
                    ? `${uid} is not known to ReCiter — feedback was not recorded`
                    : `Feedback write failed (${apiResponse.statusCode})`
                return res.status(status).send({ statusCode: status, message })
            }

            // Decision 7 — a dispute (REJECTED) by a non-curator notifies the curator who
            // added the row. Best-effort: a notification failure never fails the dispute.
            if (action === 'REJECTED') {
                try {
                    const caps = getCapabilities(parseRoles(token.userRoles))
                    const isCurator = !!(caps.canCurate.all || caps.canCurate.scoped)
                    if (isCurator) {
                        // Curator declines are routine queue work, not disputes — no email.
                    } else if (!preRow) {
                        console.log(`[external-article] dispute notification skipped — no live row for ${articleId}`)
                    } else if (preRow.suppressed) {
                        console.log(`[external-article] dispute notification skipped — ${articleId} was already suppressed (repeat dispute)`)
                    } else {
                        // addedBy comes from the server-side row, never the client body.
                        const addedBy = preRow.addedBy ? String(preRow.addedBy) : undefined
                        if (!addedBy) {
                            console.log(`[external-article] dispute notification skipped — ${articleId} has no addedBy`)
                        } else if (addedBy === actor) {
                            console.log(`[external-article] dispute notification skipped — ${articleId} was added by the disputing user`)
                        } else {
                            await notifyExternalArticleDisputed({
                                uid,
                                articleId,
                                title: preRow.title,
                                actorPersonIdentifier: actor,
                                addedBy,
                                note: noteText,
                            })
                        }
                    }
                } catch (e) {
                    console.error('[external-article] dispute notification failed (the dispute itself succeeded):', e)
                }
            }

            return res.status(200).send({ statusCode: 200, external: apiResponse.statusText })
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
