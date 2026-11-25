import { authorshipsAuthorsByExternalId } from "../../../../../controllers/db/authorships.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../config/local'

// POST /api/db/authorships/authors — batched authors_json lookup for the Curate
// per-source "Scopus" tab (SourceArticleTab), used to backfill a display byline on
// already-accepted rows whose ExternalArticle payload predates the authors field on
// scopusExternalPayload(). Same app-level backendApiKey gate as sibling authorships
// routes (action.ts, index.ts).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "POST") {
        if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await authorshipsAuthorsByExternalId(req, res)
        } else if (req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        res.status(400).send('HTTP Method supported is POST')
    }
}
