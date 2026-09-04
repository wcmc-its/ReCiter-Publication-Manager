import { authorshipPriorNames } from "../../../../../controllers/db/authorships.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../config/local'

// POST /api/db/authorships/prior-names — read-only, batched "which byline names has this cwid
// published under on accepted papers" lookup behind the Authorships identity hover card. Same
// app-level backendApiKey gate as every other authorships route (index.ts, lookup.ts,
// authors.ts); this one is read-only and touches no GoldStandard/ExternalArticle/
// AdminFeedbackLog write path, so the list-route gating level is the right one.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "POST") {
        if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await authorshipPriorNames(req, res)
        } else if (req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        res.status(400).send('HTTP Method supported is POST')
    }
}
