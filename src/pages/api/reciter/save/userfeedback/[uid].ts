import type { NextApiRequest, NextApiResponse } from 'next'
import { saveUserFeedback } from "../../../../../../controllers/userfeedback.controller"
import { reciterConfig } from '../../../../../../config/local'
import { getToken } from 'next-auth/jwt'
import { getCapabilities } from '../../../../../utils/constants'
import { isPersonInScope, isProxyFor } from '../../../../../utils/scopeResolver'
import { getPersonWithTypes } from '../../../../../../controllers/db/person.controller'

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

        // Scope enforcement for Curator_Scoped
        const token = await getToken({ req, secret: reciterConfig.tokenSecret });
        if (token && token.userRoles) {
            const roles = JSON.parse(token.userRoles as string);
            const caps = getCapabilities(roles);

            if (caps.canCurate.scoped && !caps.canCurate.all) {
                // Proxy override -- skip scope check if user has proxy access
                const proxyPersonIds = token.proxyPersonIds ? JSON.parse(token.proxyPersonIds as string) : [];
                if (!isProxyFor(proxyPersonIds, uid as string)) {
                    // Not a proxy -- enforce scope check
                    const scopeData = token.scopeData ? JSON.parse(token.scopeData as string) : null;
                    if (scopeData) {
                        const personData = await getPersonWithTypes(uid as string);
                        if (!personData) {
                            console.log('[AUTH] DENY: Person not found for scope check:', uid);
                            return res.status(404).json({ statusCode: 404, message: 'Person not found' });
                        }
                        const inScope = isPersonInScope(scopeData, personData.primaryOrganizationalUnit, personData.personTypes);
                        if (!inScope) {
                            console.log('[AUTH] DENY: Scoped curator', token.username, 'tried to save feedback for', uid, '-- not in scope');
                            return res.status(403).json({ statusCode: 403, message: 'Person not in curation scope' });
                        }
                    }
                }
                // If isProxyFor returned true, we skip scope check entirely (proxy access grants curation rights)
            }
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
