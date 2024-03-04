import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../../../config/local'
import { saveNotifications } from '../../../../../../../controllers/db/notifications/notifications.controller'
import { resetProfileORCID } from '../../../../../../../controllers/db/manage-profile/manageProfile.controller'
import { AdminOrcid } from '../../../../../../db/models/AdminOrcid'

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<AdminOrcid | string>) {
    if (req.method === "DELETE") {
        if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await resetProfileORCID(req, res)
        } else if (req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        // Default this to a bad request for now
        res.status(400).send('HTTP Supported method is GET')
    }
}