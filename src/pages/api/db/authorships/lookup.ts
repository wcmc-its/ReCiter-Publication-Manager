import { authorshipLookupCwid } from "../../../../../controllers/db/authorships.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../config/local'

// POST /api/db/authorships/lookup — read-only cwid lookup behind the bulk-assign confirm
// dialog (B-8). Same app-level backendApiKey gate as every other authorships route (action.ts,
// selectable.ts, index.ts) — this one is read-only (no GoldStandard/ExternalArticle/
// AdminFeedbackLog write), so the list-route gating level is the right one; it needs nothing
// stronger than authorshipSelectable's own POST+backendApiKey.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "POST") {
        if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await authorshipLookupCwid(req, res)
        } else if (req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        res.status(400).send('HTTP Method supported is POST')
    }
}
