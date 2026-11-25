import type { NextApiRequest, NextApiResponse } from 'next'
import { getPublications } from "../../../../../controllers/featuregenerator.controller"
import { reciterConfig } from '../../../../../config/local'
import { cornellReciterStatus } from '../../../../lib/cornellReciter'
import { CORNELL_RECITER_MIN_PUBMED } from '../../../../utils/cornellOnly'
import { cwidParam } from '../../../../utils/canonicalCwid'

type Error = {
    statusCode: number,
    message: any
}

type Data = {
    statusCode: number,
    reciter: string,
    reciterPending: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data | Error>
) {
    if(req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
        // Canonical uid (trimmed, lowercase): the run writes ReCiter's Analysis under it.
        const uid = cwidParam(req.query.uid);
        if (!uid) {
            res.status(400).send({ statusCode: 400, message: `Not a valid uid: ${JSON.stringify(req.query.uid)}` })
            return
        }

        // Cornell-only people aren't run through ReCiter until they have enough accepted PubMed
        // papers (src/utils/cornellOnly.ts): a run retrieves and scores them with the WCM models
        // and leaves an Analysis that makes them ordinary scored people. /curate already checks
        // first; this covers a direct call. A failed Cornell lookup lets the call through (the
        // old behavior) so a reciterdb hiccup can't take /curate down for everyone.
        if((await cornellReciterStatus(uid).catch((e) => { console.log(e); return null }))?.blocked) {
            res.status(409).send({
                statusCode: 409,
                message: `Cornell Ithaca people are run through ReCiter once they have ${CORNELL_RECITER_MIN_PUBMED} accepted PubMed papers`
            })
            return
        }

        const apiResponse = await getPublications(uid, req);
        if(apiResponse.statusCode === 200) {
            res.status(apiResponse.statusCode).send({
                statusCode: apiResponse.statusCode,
                reciter: apiResponse.statusText.reciterData,
                reciterPending: apiResponse.statusText.reciterPendingData
            })
        } else {
            res.status(apiResponse.statusCode).send({
                statusCode: apiResponse.statusCode,
                message: apiResponse.statusText
            })
        }
        } else if(req.headers.authorization === undefined) {
            res.status(400).send({
            statusCode: 400,
            message: "Authorization header is needed"
            })
        } else {
            res.status(401).send({
            statusCode: 401,
            message: "Authorization header is incorrect"
            })
        }
    } else {
        res.status(400).send({
            statusCode: 400,
            message: "HTTP Method supported is GET"
        })
    }
}
