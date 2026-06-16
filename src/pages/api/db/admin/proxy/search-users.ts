import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../config/local';
import { searchUsersWithCurationRoles } from '../../../../../../controllers/db/proxy.controller';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
        if (req.method === 'GET') {
            return searchUsersWithCurationRoles(req, res);
        }
        return res.status(405).send('HTTP Supported method is GET');
    } else if (req.headers.authorization === undefined) {
        res.status(400).send('Authorization header is needed');
    } else {
        res.status(401).send('Authorization header is incorrect');
    }
}
