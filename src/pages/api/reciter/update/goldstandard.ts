import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { updateGoldStandard } from "../../../../../controllers/goldstandard.controller"
import { reciterConfig } from '../../../../../config/local'
import { checkCurationScope } from '../../../../utils/checkCurationScope'
import models from '../../../../db/sequelize'

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
        const targetUid = req.body?.uid
        if (targetUid) {
            const scopeCheck = await checkCurationScope(req, targetUid);
            if (!scopeCheck.allowed) {
                return res.status(scopeCheck.status!).send({ statusCode: scopeCheck.status!, message: scopeCheck.message })
            }
        }

        // Phase 34: resolve the curating user's admin_users.userID from the JWT so
        // ReCiter can record who performed the action (FeedbackLog.curatedBy).
        // Mirrors the Authorships path's resolveCurator: fall back to an AdminUser
        // lookup by CWID (token.username) when the JWT lacks databaseUser.userID,
        // so the classic Curate path resolves the curator as reliably as AAR.
        let curatedBy: number | undefined = undefined;
        try {
            const token: any = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
            let userID = token?.databaseUser?.userID;
            if ((userID === undefined || userID === null) && token?.username) {
                const au: any = await models.AdminUser.findOne({
                    where: { personIdentifier: token.username }, attributes: ['userID'],
                });
                userID = au?.userID;
            }
            if (userID !== undefined && userID !== null && !Number.isNaN(Number(userID))) {
                curatedBy = Number(userID);
            }
        } catch (e) {
            // Leave curatedBy undefined -> ReCiter defaults to 0 (unknown).
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
