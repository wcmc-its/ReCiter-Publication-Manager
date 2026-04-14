import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../../config/local'
import { updatePermission, deletePermission } from '../../../../../../controllers/db/admin/permissions.controller'

export default async function handler(req: NextApiRequest,
    res: NextApiResponse) {
    if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
        if (req.method === "PUT") {
            await updatePermission(req, res)
        } else if (req.method === "DELETE") {
            await deletePermission(req, res)
        } else {
            res.status(400).send('HTTP Supported methods are PUT, DELETE')
        }
    } else if (req.headers.authorization === undefined) {
        res.status(400).send("Authorization header is needed")
    } else {
        res.status(401).send("Authorization header is incorrect")
    }
}
