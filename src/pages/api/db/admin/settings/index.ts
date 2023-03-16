import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../../config/local'
import { listAdminSettings } from '../../../../../../controllers/db/admin.settings.controller'
import { AdminSettings } from '../../../../../db/models/AdminSettings'


export default async function handler(req: NextApiRequest,
    res: NextApiResponse<AdminSettings | string>) {
    if (req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await listAdminSettings(req, res)
        } else if(req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
        
    } else {
        // Default this to a bad request for now
        res.status(400).send('HTTP Supported method is POST')
    }
}