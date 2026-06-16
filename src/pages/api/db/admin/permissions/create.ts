import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../../config/local'
import { createPermission } from '../../../../../../controllers/db/admin/permissions.controller'

export default async function handler(req: NextApiRequest,
    res: NextApiResponse) {
    if (req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await createPermission(req, res)
        } else if(req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        res.status(400).send('HTTP Supported method is POST')
    }
}
