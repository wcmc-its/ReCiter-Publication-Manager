import type { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { reciterConfig } from '../../../../../../config/local';
import { isAuthorizedAdmin } from '../../../../../../controllers/db/adminAuth.controller';
import { resolveViewAsTarget } from '../../../../../../src/utils/viewAsServer';

// GET ?cwid= -- looks up a "View as" candidate so the modal can show a confirm dialog with
// the target's name/roles and a clear error before the user commits. Advisory only: jwt()
// re-validates everything server-side regardless when the overlay is actually started --
// never trust the client.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
        if (!(await isAuthorizedAdmin(req))) {
            return res.status(403).send('Forbidden');
        }
        if (req.method !== 'GET') {
            return res.status(405).send('HTTP Supported method is GET');
        }

        const cwid = typeof req.query.cwid === 'string' ? req.query.cwid.trim() : '';
        if (!cwid) {
            return res.status(400).send({ reason: 'missing_cwid' });
        }

        const token: any = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        if (cwid === token?.username) {
            return res.status(400).send({ reason: 'self' });
        }

        const result = await resolveViewAsTarget(cwid);
        if (!result.ok) {
            const status = result.reason === 'target_is_superuser' ? 403 : 404;
            return res.status(status).send({ reason: result.reason });
        }

        return res.status(200).send({
            personIdentifier: result.target.personIdentifier,
            name: result.target.name,
            roleLabels: result.target.roleLabels,
        });
    } else if (req.headers.authorization === undefined) {
        res.status(400).send('Authorization header is needed');
    } else {
        res.status(401).send('Authorization header is incorrect');
    }
}
