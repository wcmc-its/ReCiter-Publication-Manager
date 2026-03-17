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
        // Find admin users with curation roles who match the search query
        const users = await models.AdminUser.findAll({
            where: {
                [Op.or]: [
                    { nameFirst: { [Op.like]: `%${query}%` } },
                    { nameLast: { [Op.like]: `%${query}%` } },
                    { personIdentifier: { [Op.like]: `%${query}%` } },
                ],
                status: 1,
            },
            include: [{
                model: models.AdminUsersRole,
                as: 'adminUsersRoles',
                required: true,
                attributes: ['roleID'],
                include: [{
                    model: models.AdminRole,
                    as: 'role',
                    where: {
                        roleLabel: {
                            [Op.in]: ['Curator_All', 'Curator_Scoped', 'Curator_Self'],
                        },
                    },
                    attributes: ['roleLabel'],
                }],
            }],
            attributes: ['userID', 'personIdentifier', 'nameFirst', 'nameMiddle', 'nameLast'],
            limit: 20,
        });

        return res.status(200).json(users);
    } catch (error) {
        console.log('[PROXY] Error searching users:', error);
        return res.status(500).json({ error: 'Failed to search users' });
    }
}
