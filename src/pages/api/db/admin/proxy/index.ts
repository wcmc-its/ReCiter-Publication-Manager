import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../config/local';
import sequelize from '../../../../../db/db';
import models from '../../../../../db/sequelize';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.headers.authorization !== reciterConfig.backendApiKey) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'GET') {
        // List proxies by personIdentifier: GET /api/db/admin/proxy?personIdentifier=abc123
        const personIdentifierQuery = req.query.personIdentifier as string;
        if (personIdentifierQuery) {
            try {
                const proxies = await models.AdminUsersProxy.findAll({
                    where: { personIdentifier: personIdentifierQuery },
                    attributes: ['id', 'userID'],
                    raw: true,
                });
                const userIds = proxies.map((p: any) => p.userID);
                let users: any[] = [];
                if (userIds.length > 0) {
                    users = await models.AdminUser.findAll({
                        where: { userID: userIds },
                        attributes: ['userID', 'personIdentifier', 'nameFirst', 'nameMiddle', 'nameLast'],
                        raw: true,
                    });
                }
                return res.status(200).json(users);
            } catch (error) {
                console.log('[PROXY] Error listing proxies by personIdentifier:', error);
                return res.status(500).json({ error: 'Failed to list proxies by personIdentifier' });
            }
        }

        // List proxies for a user: GET /api/db/admin/proxy?userID=123
        const { userID } = req.query;
        if (!userID) return res.status(400).json({ error: 'userID or personIdentifier required' });

        try {
            const proxies = await models.AdminUsersProxy.findAll({
                where: { userID: Number(userID) },
                attributes: ['id', 'personIdentifier'],
                raw: true,
            });

            // Enrich with person names from person table
            const personIds = proxies.map((p: any) => p.personIdentifier);
            let persons: any[] = [];
            if (personIds.length > 0) {
                persons = await models.Person.findAll({
                    where: { personIdentifier: personIds },
                    attributes: ['personIdentifier', 'firstName', 'middleName', 'lastName', 'primaryOrganizationalUnit'],
                    raw: true,
                });
            }

            const enriched = proxies.map((p: any) => {
                const person = persons.find((pr: any) => pr.personIdentifier === p.personIdentifier);
                return {
                    ...p,
                    firstName: person?.firstName || '',
                    middleName: person?.middleName || '',
                    lastName: person?.lastName || '',
                    primaryOrganizationalUnit: person?.primaryOrganizationalUnit || '',
                };
            });

            return res.status(200).json(enriched);
        } catch (error) {
            console.log('[PROXY] Error listing proxy assignments:', error);
            return res.status(500).json({ error: 'Failed to list proxy assignments' });
        }
    }

    if (req.method === 'POST') {
        // Save proxy assignments (replace-all pattern): POST body { userID, personIdentifiers: string[] }
        const { userID, personIdentifiers } = req.body;
        if (!userID) return res.status(400).json({ error: 'userID required' });

        const t = await sequelize.transaction();
        try {
            // Delete existing proxy assignments for this user
            await models.AdminUsersProxy.destroy({
                where: { userID },
                transaction: t,
            });

            // Insert new assignments
            if (personIdentifiers && personIdentifiers.length > 0) {
                await models.AdminUsersProxy.bulkCreate(
                    personIdentifiers.map((pid: string) => ({
                        userID,
                        personIdentifier: pid,
                    })),
                    { transaction: t }
                );
            }

            await t.commit();
            return res.status(200).json({ success: true });
        } catch (error) {
            await t.rollback();
            console.log('[PROXY] Error saving proxy assignments:', error);
            return res.status(500).json({ error: 'Failed to save proxy assignments' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
