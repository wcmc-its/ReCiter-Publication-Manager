import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../../config/local';
import { fetchUserPersonTypes } from '../../../../../../../controllers/db/manage-users/user.controller';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    if (req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
      await fetchUserPersonTypes(req, res);
    } else if (req.headers.authorization === undefined) {
      res.status(400).send('Authorization header is needed');
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  } else {
    res.status(400).send('HTTP Supported method is GET');
  }
}
