import type { NextApiRequest, NextApiResponse } from 'next'
import { getPublications } from "../../../../../controllers/featuregenerator.controller"
import { reciterConfig } from '../../../../../config/local'

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

        const apiResponse = await getPublications(uid, req);

        // CHANGED: apiResponse.statusCode could previously be `undefined` (e.g. when
        // getPublications' internal .catch() caught a plain JS error without a `.status`
        // property). Passing `undefined` into res.status() crashes the process with
        // ERR_HTTP_INVALID_STATUS_CODE. This normalizes it to a guaranteed numeric value,
        // defaulting to 500, as a defensive second layer even after the upstream fix.
        const statusCode = typeof apiResponse.statusCode === 'number' ? apiResponse.statusCode : 500;

        if(statusCode === 200) {
            res.status(statusCode).send({
                statusCode,
                reciter: apiResponse.statusText.reciterData,
                reciterPending: apiResponse.statusText.reciterPendingData
            })
        } else {
            res.status(statusCode).send({
                statusCode,
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