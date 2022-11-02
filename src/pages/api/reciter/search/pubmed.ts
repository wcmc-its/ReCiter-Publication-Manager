import type { NextApiRequest, NextApiResponse } from 'next'
import { searchPubmed } from "../../../../../controllers/pubmed.controller"
import { reciterConfig } from '../../../../../config/local'

type Error = {
    statusCode: number,
    message: any,
}

type Data = {
    statusCode: number,
    reciter: any,
    resultMode: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Error | Data>
) {
    if(req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
        const apiResponse = await searchPubmed(req);
        if(apiResponse.statusCode === 200) {
            let resultMode = ''
            let data = apiResponse.statusText
            if(data && Array.isArray(data)) {
                if (data.length >= 1000) {
                    resultMode = 'LARGE_RESULTS'
                } else {
                    resultMode = 'VALID_RESULTS'
                }
                if (data.length == 0) {
                    resultMode = 'EMPTY'
                }
                res.status(apiResponse.statusCode).send({
                    statusCode: apiResponse.statusCode,
                    reciter: data,
                    resultMode: resultMode
                });
            }
            else if(data.status === 500)
            {
                res.status(500).send({
                    statusCode: 500,
                    reciter: data,
                    resultMode: resultMode
                })
            }
            
        } else{
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
            message: "HTTP Method supported is POST"
        })
    }
}
