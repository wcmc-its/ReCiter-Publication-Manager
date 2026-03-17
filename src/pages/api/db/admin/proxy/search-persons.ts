import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../config/local';
import { Op } from 'sequelize';
import models from '../../../../../db/sequelize';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.headers.authorization !== reciterConfig.backendApiKey) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const query = (req.query.q as string || '').trim();
    if (query.length < 2) {
        return res.status(200).json([]);
    }

    try {
        const persons = await models.Person.findAll({
            where: {
                [Op.or]: [
                    { firstName: { [Op.like]: `%${query}%` } },
                    { lastName: { [Op.like]: `%${query}%` } },
                    { personIdentifier: { [Op.like]: `%${query}%` } },
                ],
            },
            attributes: ['personIdentifier', 'firstName', 'middleName', 'lastName', 'primaryOrganizationalUnit'],
            limit: 20,
            raw: true,
        });

        return res.status(200).json(persons);
    } catch (error) {
        console.log('[PROXY] Error searching persons:', error);
        return res.status(500).json({ error: 'Failed to search persons' });
    }
}
