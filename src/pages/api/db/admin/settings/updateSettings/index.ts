import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../../../config/local'
import { isAuthorizedAdmin } from '../../../../../../../controllers/db/adminAuth.controller'
import { updateAdminSettings } from '../../../../../../../controllers/db/admin.settings.controller'
import { AdminSettings } from '../../../../../../db/models/AdminSettings'


export default async function handler(req: NextApiRequest,
    res: NextApiResponse<AdminSettings | string>) {
    if (req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            // The api key is public and middleware only proves a session; these settings include
            // the default roles every SAML login is granted, so only an admin may change them.
            if (!(await isAuthorizedAdmin(req))) {
                res.status(403).send("Forbidden")
                return
            }
            await updateAdminSettings(req, res)
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

