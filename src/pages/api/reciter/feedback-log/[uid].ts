import type { NextApiRequest, NextApiResponse } from 'next'
import { getFeedbackLog } from "../../../../../controllers/feedbacklog.controller"
import { findAdminUserNamesByIds } from "../../../../../controllers/db/manage-users/user.controller"
import { reciterConfig } from '../../../../../config/local'
import { checkCurationScope } from '../../../../utils/checkCurationScope'

/**
 * GET /api/reciter/feedback-log/[uid]
 *
 * Returns the curation audit history for a person, proxied from ReCiter's
 * /reciter/feedback-log/{uid}. Requires the backend api-key header and gates
 * visibility by curate access (a user can only see history for people they may
 * curate — same rule as the goldstandard save route).
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
        const scopeCheck = await checkCurationScope(req, targetUid)
        if (!scopeCheck.allowed) {
            return res.status(scopeCheck.status!).send({ statusCode: scopeCheck.status!, message: scopeCheck.message })
        }

        const apiResponse = await getFeedbackLog(targetUid)
        if (apiResponse.statusCode === 200) {
            const data = apiResponse.data
            // Resolve curatedBy (admin_users.userID) -> display name for the UI.
            if (Array.isArray(data)) {
                const ids: number[] = Array.from(
                    new Set(data.map((e: any) => e.curatedBy).filter((n: any) => Number.isInteger(n) && n > 0))
                )
                const nameMap = await findAdminUserNamesByIds(ids)
                data.forEach((e: any) => {
                    e.curatorName = (e.curatedBy && nameMap[e.curatedBy]) ? nameMap[e.curatedBy] : null
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
