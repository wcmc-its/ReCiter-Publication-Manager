import type { NextApiRequest, NextApiResponse } from 'next'
import { cornellReciterStatus } from '../../../../../lib/cornellReciter'
import { reciterConfig } from '../../../../../../config/local'
import type { ReciterRunStatus } from '../../../../../utils/cornellOnly'

// GET /api/db/users/cornell-only/<uid> -> { cornellOnly, reciterEligible, blocked } (see
// src/utils/cornellOnly.ts). /curate/<uid> asks this before it fetches anything: a blocked person
// (Cornell-only, fewer than CORNELL_RECITER_MIN_PUBMED accepted PubMed papers) gets the page built
// from the stores and never reaches the feature-generator call. The lookups fail open inside
// reciterRunStatus, so this answers 200 whenever the request itself is good.
export default async function handler(req: NextApiRequest,
    res: NextApiResponse<ReciterRunStatus | string>) {
    if (req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            try {
                res.status(200).send(await cornellReciterStatus(String(req.query.uid || '')))
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
