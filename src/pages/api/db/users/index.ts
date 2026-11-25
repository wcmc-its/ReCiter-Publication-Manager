import { findAll } from "../../../../../controllers/db/person.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { Person } from '../../../../db/models/Person'
import { reciterConfig } from '../../../../../config/local'
import { effectiveToken } from '../../../../utils/viewAs'
import { getCapabilities } from '../../../../utils/constants'
import { inScopeFlagScope } from '../../../../utils/scopeResolver'

const safeJsonParse = (value: any, fallback: any) => {
    if (value == null) return fallback
    if (typeof value !== 'string') return value
    try { return JSON.parse(value) } catch { return fallback }
}

// The scope to flag rows against (see findAll's `inScope`), from the session token -- under
// View as, the target's. Best-effort: with no readable token the rows carry no flag, as before.
const viewerScopeFor = async (req: NextApiRequest) => {
    try {
        const token: any = effectiveToken(await getToken({ req, secret: process.env.NEXTAUTH_SECRET }))
        if (!token) return null
        const caps = getCapabilities(safeJsonParse(token.userRoles, []))
        return inScopeFlagScope(caps.canCurate.all, safeJsonParse(token.scopeData, null))
    } catch (e) {
        return null
    }
}

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<Person | string>) {
    if (req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await findAll(req, res, await viewerScopeFor(req))
        } else if(req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
        // Default this to a bad request for now
        res.status(400).send('HTTP Method supported is POST')
    }
}
