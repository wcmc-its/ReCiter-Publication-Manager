import type { NextApiRequest, NextApiResponse } from 'next'
import { updateGoldStandard } from "../../../../../controllers/goldstandard.controller"
import { reciterConfig } from '../../../../../config/local'
import { getToken } from 'next-auth/jwt'
import { getCapabilities } from '../../../../utils/constants'
import { isPersonInScope, isProxyFor } from '../../../../utils/scopeResolver'
import { getPersonWithTypes } from '../../../../../controllers/db/person.controller'

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

        // Scope enforcement for Curator_Scoped
        const token = await getToken({ req, secret: reciterConfig.tokenSecret });
        if (token && token.userRoles) {
            const roles = JSON.parse(token.userRoles as string);
            const caps = getCapabilities(roles);

            if (caps.canCurate.scoped && !caps.canCurate.all) {
                const targetUid = req.body?.uid || req.body?.personIdentifier;
                // Proxy override -- skip scope check if user has proxy access
                const proxyPersonIds = token.proxyPersonIds ? JSON.parse(token.proxyPersonIds as string) : [];
                if (targetUid && !isProxyFor(proxyPersonIds, targetUid)) {
                    // Not a proxy -- enforce scope check
                    const scopeData = token.scopeData ? JSON.parse(token.scopeData as string) : null;
                    if (scopeData) {
                        const personData = await getPersonWithTypes(targetUid);
                        if (personData) {
                            const inScope = isPersonInScope(scopeData, personData.primaryOrganizationalUnit, personData.personTypes);
                            if (!inScope) {
                                console.log('[AUTH] DENY: Scoped curator', token.username, 'tried to update gold standard for', targetUid, '-- not in scope');
                                return res.status(403).json({ statusCode: 403, message: 'Person not in curation scope' });
                            }
                        }
                    }
                }
                // If isProxyFor returned true, we skip scope check entirely (proxy access grants curation rights)
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
