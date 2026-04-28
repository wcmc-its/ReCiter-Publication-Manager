import { findAllInstitutions } from "../../../../../../controllers/db/person.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { Person } from '../../../../../db/models/Person'
import { reciterConfig } from '../../../../../../config/local'

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<Person | string>) {
    if (req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await findAllInstitutions(req, res)
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