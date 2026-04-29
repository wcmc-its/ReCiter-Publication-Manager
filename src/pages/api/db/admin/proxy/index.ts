import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../config/local';
import { getProxiesForUser, getProxiesForPerson, saveProxiesForUser } from '../../../../../../controllers/db/proxy.controller';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
        if (req.method === 'GET') {
            if (req.query.personIdentifier) {
                return getProxiesForPerson(req, res);
            }
            if (req.query.userID) {
                return getProxiesForUser(req, res);
            }
            return res.status(400).json({ error: 'userID or personIdentifier query param required' });
        }
        if (req.method === 'POST') {
            return saveProxiesForUser(req, res);
        }
        return res.status(405).json({ error: 'Method not allowed' });
    } else if (req.headers.authorization === undefined) {
        res.status(400).send('Authorization header is needed');
    } else {
        res.status(401).send('Authorization header is incorrect');
    }
}
