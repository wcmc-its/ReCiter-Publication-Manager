import { authorshipOrcidRecord } from "../../../../../controllers/db/authorships.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../config/local'

// POST /api/db/authorships/orcid-record {id} — read-only public ORCID record behind one queue
// row's byline iD. Same backendApiKey gate (and next-auth middleware gate) as prior-names.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "POST") {
        if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await authorshipOrcidRecord(req, res)
        } else if (req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        res.status(400).send('HTTP Method supported is POST')
    }
}
