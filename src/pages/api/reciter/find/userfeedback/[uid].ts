import type { NextApiRequest, NextApiResponse } from 'next'
import { findUserFeedback } from "../../../../../../controllers/userfeedback.controller"
import { reciterConfig } from '../../../../../../config/local'

type Error = {
    statusCode: number,
    message: any
}

type Data = {
    statusCode: number,
    userFeedback: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data | Error>
) {
    if(req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
        const { uid } = req.query;

        const apiResponse = await findUserFeedback(uid);
        if(apiResponse.statusCode === 200) {
            res.status(apiResponse.statusCode).send({
                statusCode: apiResponse.statusCode,
                userFeedback: apiResponse.statusText
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
