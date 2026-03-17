import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../config/local';
import { getPersonWithTypes } from '../../../../../controllers/db/person.controller';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.headers.authorization !== reciterConfig.backendApiKey) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const uid = req.query.uid as string;
    if (!uid) return res.status(400).json({ error: 'uid required' });

    const person = await getPersonWithTypes(uid);
    if (!person) return res.status(404).json({ error: 'Person not found' });

    res.json(person);
}
