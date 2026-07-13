import { authorshipAction } from "../../../../../controllers/db/authorships.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../config/local'

// POST /api/db/authorships/action — single-row curator action
// (accept/reject/assign/snooze/dismiss/reopen). App-level gate via backendApiKey; the
// controller additionally resolves the curator identity from the next-auth JWT (middleware
// does not cover /api). PubMed rows write GoldStandard; Scopus rows write ExternalArticle.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "POST") {
        if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await authorshipAction(req, res)
        } else if (req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        res.status(400).send('HTTP Method supported is POST')
    }
}
