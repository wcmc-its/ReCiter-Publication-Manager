import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../config/local';
import sequelize from '../../../../../db/db';
import models from '../../../../../db/sequelize';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.headers.authorization !== reciterConfig.backendApiKey) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Grant proxy: { personIdentifier: string, userIds: number[] }
    // This replaces ALL proxy assignments for a given personIdentifier
    const { personIdentifier, userIds } = req.body;
    if (!personIdentifier) return res.status(400).json({ error: 'personIdentifier required' });

    const t = await sequelize.transaction();
    try {
        // Delete existing proxy assignments for this person
        await models.AdminUsersProxy.destroy({
            where: { personIdentifier },
            transaction: t,
        });

        // Insert new assignments
        if (userIds && userIds.length > 0) {
            await models.AdminUsersProxy.bulkCreate(
                userIds.map((uid: number) => ({
                    userID: uid,
                    personIdentifier,
                })),
                { transaction: t }
            );
        }

        await t.commit();
        return res.status(200).json({ success: true });
    } catch (error) {
        await t.rollback();
        console.log('[PROXY] Error granting proxy access:', error);
        return res.status(500).json({ error: 'Failed to grant proxy access' });
    }
}
