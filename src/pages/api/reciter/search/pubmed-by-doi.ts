import type { NextApiRequest, NextApiResponse } from 'next'
import { findPubmedByDoi } from '../../../../../controllers/pubmedLookup.controller'
import { reciterConfig } from '../../../../../config/local'

type Resp = {
    statusCode: number,
    pmid?: number | null,
    message?: any,
}

// PM#771 — POST { doi } -> { pmid } (null if the DOI is not in PubMed). Used to steer
// external adds to the scored PubMed path when the work is actually PubMed-indexed.
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Resp>
) {
    if (req.method === "POST") {
        if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            const doi = req.body && req.body.doi
            if (!doi) {
                res.status(400).send({ statusCode: 400, message: "doi is required" })
                return
            }
            try {
                const pmid = await findPubmedByDoi(String(doi))
                res.status(200).send({ statusCode: 200, pmid })
            } catch (err: any) {
                res.status(502).send({ statusCode: 502, message: "PubMed lookup failed" })
            }
        } else if (req.headers.authorization === undefined) {
            res.status(400).send({ statusCode: 400, message: "Authorization header is needed" })
        } else {
            res.status(401).send({ statusCode: 401, message: "Authorization header is incorrect" })
        }
    } else {
        res.status(400).send({ statusCode: 400, message: "HTTP Method supported is POST" })
    }
}
