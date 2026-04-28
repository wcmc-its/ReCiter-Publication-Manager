import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../../config/local'
import { listAllAdminRoles } from '../../../../../../controllers/db/manage-users/user.controller'
import { AdminRole } from '../../../../../db/models/AdminRole'

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<AdminRole | string>) {
    if (req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await listAllAdminRoles (req, res)
        } else if(req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
        
    } else {
        // Default this to a bad request for now
        res.status(400).send('HTTP Supported method is GET')
    }
}