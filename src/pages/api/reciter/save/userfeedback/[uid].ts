import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { saveUserFeedback } from "../../../../../../controllers/userfeedback.controller"
import { canCurate } from "../../../../../../controllers/db/authorization.controller"
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
    if(req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
        const { uid } = req.query;

        // Same canCurate gate as goldstandard.ts -- the api-key check above only proves the
        // request came from this app's own server code, not who the curator is. See PM#916.
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
        const allowed = await canCurate(token, uid)
        if (!allowed) {
            res.status(403).send({
                statusCode: 403,
                message: "You do not have permission to curate this person's publications"
            })
            return
        }

        const apiResponse = await saveUserFeedback(req, uid);
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
            message: "HTTP Method supported is POST"
        })
    }
}
