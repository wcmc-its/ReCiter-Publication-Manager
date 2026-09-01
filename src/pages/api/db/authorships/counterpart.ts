import { authorshipCounterpart } from "../../../../../controllers/db/authorships.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../config/local'

// POST /api/db/authorships/counterpart — read-only Scopus-vs-PubMed comparison for the
// PubMed-twin panel (matched_pmid). Same app-level backendApiKey gate as every other
// authorships route (action.ts, lookup.ts, selectable.ts, index.ts) — this one is read-only
// (no GoldStandard/ExternalArticle/AdminFeedbackLog write, no curator-identity resolution),
// so it uses lookup.ts's gating level, not action.ts's stronger one.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "POST") {
        if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await authorshipCounterpart(req, res)
        } else if (req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        res.status(400).send('HTTP Method supported is POST')
    }
}
