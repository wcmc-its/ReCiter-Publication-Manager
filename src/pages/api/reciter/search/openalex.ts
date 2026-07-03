import type { NextApiRequest, NextApiResponse } from 'next'
import { searchOpenAlex } from '../../../../../controllers/openalex.controller'
import { reciterConfig } from '../../../../../config/local'

type Error = {
    statusCode: number,
    message: any,
}

type Data = {
    statusCode: number,
    results: any,
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Error | Data>
) {
    if (req.method === "POST") {
        if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            const apiResponse = await searchOpenAlex(req)
            if (apiResponse.statusCode === 200) {
                res.status(200).send({
                    statusCode: 200,
                    results: apiResponse.statusText,
                })
            } else {
                res.status(apiResponse.statusCode || 502).send({
                    statusCode: apiResponse.statusCode || 502,
                    message: apiResponse.statusText,
                })
            }
        } else if (req.headers.authorization === undefined) {
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
            message: "HTTP Method supported is POST"
        })
    }
}
