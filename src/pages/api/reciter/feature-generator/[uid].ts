import type { NextApiRequest, NextApiResponse } from 'next'
import { getPublications } from "../../../../../controllers/featuregenerator.controller"
import { reciterConfig } from '../../../../../config/local'
import { isCornellOnlyUid } from '../../../../../controllers/db/person.controller'

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
        const { uid } = req.query;

        // Cornell-only people are never run through ReCiter: this call would retrieve and score
        // them with the WCM models. /curate already checks first; this covers a direct call. A
        // failed lookup lets the call through (the old behavior) so a reciterdb hiccup can't take
        // /curate down for everyone.
        if(await isCornellOnlyUid(String(uid)).catch((e) => { console.log(e); return false })) {
            res.status(409).send({
                statusCode: 409,
                message: "Cornell Ithaca people aren't run through ReCiter"
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
