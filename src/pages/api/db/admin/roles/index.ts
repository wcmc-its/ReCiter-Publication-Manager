import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../../config/local'
import { listAllRolesWithPermissions } from '../../../../../../controllers/db/admin/roles.controller'

export default async function handler(req: NextApiRequest,
    res: NextApiResponse) {
    if (req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await listAllRolesWithPermissions(req, res)
        } else if(req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        res.status(400).send('HTTP Supported method is GET')
    }
}
