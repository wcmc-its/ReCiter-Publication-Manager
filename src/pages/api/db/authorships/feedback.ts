import { feedbackCreate, feedbackStatus } from "../../../../../controllers/db/authorshipFeedback.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../config/local'

// GET/POST /api/db/authorships/feedback — "Report a problem". App-level gate via backendApiKey as
// on every other authorships route; the controller additionally requires the REAL signed-in user
// to be a reviewer listed in AUTHORSHIP_FEEDBACK_CWIDS.
// 2mb: the report carries the card's snapshot, and Next's 1mb default answers 413 before the handler.
export const config = { api: { bodyParser: { sizeLimit: '2mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "GET" || req.method === "POST") {
        if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await (req.method === "GET" ? feedbackStatus(req, res) : feedbackCreate(req, res))
        } else if (req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        res.status(400).send('HTTP Methods supported are GET and POST')
    }
}
