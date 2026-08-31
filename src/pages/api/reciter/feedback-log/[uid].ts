import type { NextApiRequest, NextApiResponse } from 'next'
import { getFeedbackLog } from "../../../../../controllers/feedbacklog.controller"
import { findAdminUserNamesByIds } from "../../../../../controllers/db/manage-users/user.controller"
import { resolveActorNames } from "../../../../../controllers/db/manage-users/actorName.controller"
import { reciterConfig } from '../../../../../config/local'

/**
 * GET /api/reciter/feedback-log/[uid]
 *
 * Returns the curation audit history for a person, proxied from ReCiter's
 * /reciter/feedback-log/{uid}. Gated on the backend api-key header — the same
 * rule the goldstandard save route uses on this branch.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        return res.status(400).send({ statusCode: 400, message: "HTTP Method supported is GET" })
    }
    if (req.headers.authorization === undefined) {
        return res.status(400).send({ statusCode: 400, message: "Authorization header is needed" })
    }
    if (req.headers.authorization !== reciterConfig.backendApiKey) {
        return res.status(401).send({ statusCode: 401, message: "Authorization header is incorrect" })
    }

    const { uid } = req.query
    const targetUid = Array.isArray(uid) ? uid[0] : uid
    if (!targetUid) {
        return res.status(400).send({ statusCode: 400, message: "uid is required" })
    }

    try {
        const apiResponse = await getFeedbackLog(targetUid)
        if (apiResponse.statusCode === 200) {
            const data = apiResponse.data
            // Resolve curatedBy (admin_users.userID) -> display name for the UI. Rows from
            // the external/Scopus/manual-article lane hardcode curatedBy=0 but always carry
            // actorPersonIdentifier (a cwid) instead, so fall back to resolving that -- and
            // if even that comes up nameless, show the raw cwid rather than "Unknown".
            if (Array.isArray(data)) {
                const ids: number[] = Array.from(
                    new Set(data.map((e: any) => Number(e.curatedBy)).filter((n: number) => Number.isInteger(n) && n > 0))
                )
                const nameMap = await findAdminUserNamesByIds(ids)

                const unresolvedActorCwids: string[] = Array.from(new Set(
                    data
                        .filter((e: any) => {
                            const cb = Number(e.curatedBy)
                            return !(Number.isInteger(cb) && cb > 0 && nameMap[cb])
                        })
                        .map((e: any) => e.actorPersonIdentifier)
                        .filter((c: any) => typeof c === 'string' && c.trim())
                ))
                const actorNameMap = await resolveActorNames(unresolvedActorCwids)

                data.forEach((e: any) => {
                    const cb = Number(e.curatedBy)
                    if (Number.isInteger(cb) && cb > 0 && nameMap[cb]) {
                        e.curatorName = nameMap[cb]
                        return
                    }
                    const actorCwid = typeof e.actorPersonIdentifier === 'string' ? e.actorPersonIdentifier.trim() : ''
                    e.curatorName = actorCwid ? (actorNameMap[actorCwid] || actorCwid) : null
                })
            }
            return res.status(200).send(data)
        }
        return res.status(apiResponse.statusCode || 500).send({
            statusCode: apiResponse.statusCode || 500,
            message: apiResponse.statusText
        })
    } catch (err) {
        console.error('[feedback-log] Unhandled error:', err)
        return res.status(500).send({ statusCode: 500, message: 'Internal server error' })
    }
}
