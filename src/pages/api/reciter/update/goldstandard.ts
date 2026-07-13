import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { updateGoldStandard } from "../../../../../controllers/goldstandard.controller"
import { reciterConfig } from '../../../../../config/local'

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
        try {
        // Resolve the curating user (admin_users.userID) from the JWT and stamp it on the
        // goldstandard write, so ReCiter records who curated instead of falling back to 0
        // ("Unknown" in the History panel). Never trusted from the client. Best-effort:
        // if the token is missing/unreadable we send nothing and ReCiter defaults to 0.
        let curatedBy = 0
        try {
            const token: any = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
            const userID = Number(token?.databaseUser?.userID)
            if (Number.isInteger(userID) && userID > 0) curatedBy = userID
        } catch (e) {
            console.warn('[goldstandard] could not resolve curatedBy from JWT; recording as unknown')
        }

        const apiResponse = await updateGoldStandard(req, curatedBy);
        if(apiResponse.statusCode === 200) {
            res.status(apiResponse.statusCode).send({
                statusCode: apiResponse.statusCode,
                goldStandard: apiResponse.statusText
            })
        } else{
            res.status(apiResponse.statusCode || 500).send({
                statusCode: apiResponse.statusCode || 500,
                message: apiResponse.statusText
            })
        }
        } catch (err) {
            console.error('[goldstandard] Unhandled error:', err)
            res.status(500).send({ statusCode: 500, message: 'Internal server error' })
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
