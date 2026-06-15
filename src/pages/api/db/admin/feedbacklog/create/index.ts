import { createFeedbackLog } from "../../../../../../../controllers/db/admin.feedbacklog.controller"
import type { NextApiRequest, NextApiResponse } from 'next'
import { getToken } from 'next-auth/jwt'
import { AdminFeedbackLog } from '../../../../../../db/models/AdminFeedbackLog'
import { reciterConfig } from '../../../../../../../config/local'
import { getEffectiveIdentity } from '../../../../../../utils/impersonation'
import { findAdminUser } from '../../../../../../../controllers/db/admin.users.controller'

/**
 * Resolve the REAL superuser's numeric userID for audit attribution.
 *
 * This is a same-origin browser fetch, so the next-auth cookie AND the
 * pm_impersonation cookie ride along on `req` even though the route also gates
 * on the shared backendApiKey header. When a live overlay exists, the client
 * sends the TARGET's userID (the overlay flips session.data.databaseUser.userID
 * to the target). The one thing the client cannot know is the REAL superuser, so
 * we resolve it server-side from the overlay and stamp impersonatedByUserID.
 *
 * Fully backward compatible: no cookie / server-to-server call → token is null →
 * impersonatedByUserID stays null and the existing flow is untouched.
 */
async function resolveImpersonatedByUserID(req: NextApiRequest): Promise<number | null> {
    try {
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        if (!token) return null;
        const eff = getEffectiveIdentity(token, req);
        if (!eff.impersonating || !eff.realPersonIdentifier) return null;
        const realUser = await findAdminUser(['personIdentifier'], [eff.realPersonIdentifier]);
        if (!realUser) return null;
        const plain: any = realUser.get({ plain: true });
        return plain?.userID ?? null;
    } catch (e) {
        console.log(e);
        return null;
    }
}

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<AdminFeedbackLog | string>) {
    if (req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            // Stamp the REAL superuser for "logged to you" honesty. userID stays
            // the EFFECTIVE target when they have a PM account; otherwise it falls
            // back to the real superuser (see below).
            const impersonatedByUserID = await resolveImpersonatedByUserID(req);
            req.body.impersonatedByUserID = impersonatedByUserID;
            // Acting as a target with no PM account (no userID): attribute the audit
            // row's userID to the real superuser who performed it, so the row is still
            // written and discoverable in userID-keyed queries. impersonatedByUserID
            // already flags it as an act-as write. With no actor at all (not
            // impersonating), preserve the prior "don't log anonymous writes" behavior.
            if ((req.body.userID === undefined || req.body.userID === null) && impersonatedByUserID) {
                req.body.userID = impersonatedByUserID;
            }
            if (req.body.userID === undefined || req.body.userID === null) {
                res.status(200).send('No user to attribute; feedback log not recorded');
                return;
            }
            await createFeedbackLog(req, res)
        } else if(req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
        
    } else {
        // Default this to a bad request for now
        res.status(400).send('HTTP Supported method is POST')
    }
}