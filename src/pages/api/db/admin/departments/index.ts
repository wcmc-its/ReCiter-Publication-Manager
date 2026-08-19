import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../../config/local'
import { listAllAdminDepartments } from '../../../../../../controllers/db/manage-users/user.controller'
import { isAuthorizedAdmin } from '../../../../../../controllers/db/adminAuth.controller'
import { AdminDepartment } from '../../../../../db/models/AdminDepartment'

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<AdminDepartment | string>) {
    if (req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            if (!(await isAuthorizedAdmin(req))) {
                res.status(403).send("Forbidden")
                return
            }
            await listAllAdminDepartments(req, res)
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