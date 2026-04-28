import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../../../config/local'
import { authorFilter } from '../../../../../../../controllers/db/reports/filter.controller'
import { Person } from '../../../../../../db/models/Person'

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<Person | string>) {
    if (req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await authorFilter(req, res)
        } else if(req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        // Default this to a bad request for now
        res.status(400).send('HTTP Method supported is GET')
    }
}