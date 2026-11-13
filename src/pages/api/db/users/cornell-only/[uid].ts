import type { NextApiRequest, NextApiResponse } from 'next'
import { isCornellOnlyUid } from '../../../../../../controllers/db/person.controller'
import { reciterConfig } from '../../../../../../config/local'

// GET /api/db/users/cornell-only/<uid> -> { cornellOnly: boolean }. /curate/<uid> asks this before
// it fetches anything, so a Cornell-only person never reaches the feature-generator call.
export default async function handler(req: NextApiRequest,
    res: NextApiResponse<{ cornellOnly: boolean } | string>) {
    if (req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            try {
                res.status(200).send({ cornellOnly: await isCornellOnlyUid(String(req.query.uid || '')) })
            } catch (e) {
                console.log(e)
                res.status(500).send('Cornell-only lookup failed')
            }
        } else if(req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        res.status(400).send('HTTP Method supported is GET')
    }
}
