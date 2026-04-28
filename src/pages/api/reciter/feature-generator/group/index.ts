import type { NextApiRequest, NextApiResponse } from 'next'
import { getPublicationsBulk } from "../../../../../../controllers/featuregeneratorbulk.controller"
import { reciterConfig } from '../../../../../../config/local'

type Error = {
    statusCode: number,
    message: any
}

type Data = {
    statusCode: number,
    reciter: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data | Error>
) {
    if(req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {

        const apiResponse = await getPublicationsBulk(req);
        if(apiResponse.statusCode === 200) {
            res.status(apiResponse.statusCode).send({
                statusCode: apiResponse.statusCode,
                reciter: apiResponse.statusText
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
