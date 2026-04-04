import type { NextApiRequest, NextApiResponse } from 'next'
import { updateGoldStandard } from "../../../../../controllers/goldstandard.controller"
import { reciterConfig } from '../../../../../config/local'
import { checkCurationScope } from '../../../../utils/checkCurationScope'

type Error = {
    statusCode: number,
    message: any,
}

type Data = {
    statusCode: number,
    goldStandard: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Error | Data>
) {
    if(req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
        const targetUid = req.body?.uid
        if (targetUid) {
            const scopeCheck = await checkCurationScope(req, targetUid);
            if (!scopeCheck.allowed) {
                return res.status(scopeCheck.status!).send({ statusCode: scopeCheck.status!, message: scopeCheck.message })
            }
        }

        const apiResponse = await updateGoldStandard(req);
        if(apiResponse.statusCode === 200) {
            res.status(apiResponse.statusCode).send({
                statusCode: apiResponse.statusCode,
                goldStandard: apiResponse.statusText
            })
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
