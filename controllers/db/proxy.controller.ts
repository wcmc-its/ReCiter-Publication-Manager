import type { NextApiRequest, NextApiResponse } from 'next';
import { Op, Sequelize, QueryTypes } from 'sequelize';
import models from '../../src/db/sequelize';
import sequelize from '../../src/db/db';

/**
 * Helper: parse a JSON column value that may come back as a string or array
 * depending on MySQL/MariaDB driver behavior.
 */
function parseJsonColumn(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

/**
 * GET /api/db/admin/proxy?userID=N
 * Returns enriched proxy person list for a given admin user.
 */
export const getProxiesForUser = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        const userID = Number(req.query.userID);
        if (!userID || isNaN(userID)) {
            return res.status(400).json({ error: 'Valid userID query param required' });
        }

        const user = await models.AdminUser.findOne({
            where: { userID },
            attributes: ['proxy_person_ids'],
            raw: true
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const personIds = parseJsonColumn(user.proxy_person_ids);
        if (personIds.length === 0) {
            return res.status(200).json([]);
        }

        // Batch-query person table for enriched data
        const persons = await models.Person.findAll({
            where: {
                personIdentifier: { [Op.in]: personIds }
            },
            attributes: ['personIdentifier', 'firstName', 'middleName', 'lastName', 'primaryOrganizationalUnit'],
            raw: true
        });

        return res.status(200).json(persons);
    } catch (error) {
        console.log('[PROXY] Error in getProxiesForUser:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/db/admin/proxy?personIdentifier=X
 * Reverse lookup: find all admin users who have this person in their proxy list.
 */
export const getProxiesForPerson = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        const personIdentifier = req.query.personIdentifier as string;
        if (!personIdentifier) {
            return res.status(400).json({ error: 'personIdentifier query param required' });
        }

        const users = await sequelize.query(
            'SELECT userID, personIdentifier, nameFirst, nameMiddle, nameLast FROM admin_users WHERE JSON_CONTAINS(proxy_person_ids, ?)',
            {
                replacements: [JSON.stringify(personIdentifier)],
                type: QueryTypes.SELECT
            }
        );

        return res.status(200).json(users);
    } catch (error) {
        console.log('[PROXY] Error in getProxiesForPerson:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/db/admin/proxy
 * Save/replace the entire proxy_person_ids array for a given user.
 * Body: { userID: number, personIdentifiers: string[] }
 */
export const saveProxiesForUser = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        const { userID, personIdentifiers } = req.body;

        if (!userID) {
            return res.status(400).json({ error: 'userID is required' });
        }

        // Validate user exists
        const user = await models.AdminUser.findOne({ where: { userID } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await models.AdminUser.update(
            { proxy_person_ids: personIdentifiers && personIdentifiers.length > 0 ? personIdentifiers : null },
            { where: { userID } }
        );

        return res.status(200).json({ success: true });
    } catch (error) {
        console.log('[PROXY] Error in saveProxiesForUser:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /api/db/admin/proxy/grant
 * Grant or revoke proxy for a specific person across multiple users.
 * Body: { personIdentifier: string, userIds: number[] }
 *
 * This is the inverse of saveProxiesForUser: instead of setting all proxies for one user,
 * it sets which users can proxy for one person.
 */
export const grantProxyForPerson = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        const { personIdentifier, userIds } = req.body;

        if (!personIdentifier) {
            return res.status(400).json({ error: 'personIdentifier is required' });
        }
        if (!Array.isArray(userIds)) {
            return res.status(400).json({ error: 'userIds must be an array' });
        }

        // Step 1: Find all users who currently have this personIdentifier in proxy_person_ids
        const currentProxiers: any[] = await sequelize.query(
            'SELECT userID, proxy_person_ids FROM admin_users WHERE JSON_CONTAINS(proxy_person_ids, ?)',
            {
                replacements: [JSON.stringify(personIdentifier)],
                type: QueryTypes.SELECT
            }
        );

        const currentUserIds = currentProxiers.map((u: any) => u.userID);
        const newUserIds = userIds.map(Number);

        // Step 2: Remove personIdentifier from users no longer in the list
        const toRemove = currentUserIds.filter((id: number) => !newUserIds.includes(id));
        for (const uid of toRemove) {
            const row = currentProxiers.find((u: any) => u.userID === uid);
            const currentArr = parseJsonColumn(row.proxy_person_ids);
            const newArr = currentArr.filter((pid: string) => pid !== personIdentifier);
            await models.AdminUser.update(
                { proxy_person_ids: newArr.length > 0 ? newArr : null },
                { where: { userID: uid } }
            );
        }

        // Step 3: Add personIdentifier to users newly in the list
        const toAdd = newUserIds.filter((id: number) => !currentUserIds.includes(id));
        for (const uid of toAdd) {
            const user = await models.AdminUser.findOne({
                where: { userID: uid },
                attributes: ['proxy_person_ids'],
                raw: true
            });
            if (user) {
                const currentArr = parseJsonColumn(user.proxy_person_ids);
                if (!currentArr.includes(personIdentifier)) {
                    currentArr.push(personIdentifier);
                }
                await models.AdminUser.update(
                    { proxy_person_ids: currentArr },
                    { where: { userID: uid } }
                );
            }
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.log('[PROXY] Error in grantProxyForPerson:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/db/admin/proxy/search-persons?q=
 * Search person table for proxy assignment autocomplete.
 */
export const searchPersons = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        const q = (req.query.q as string || '').trim();
        if (q.length < 2) {
            return res.status(200).json([]);
        }

        const persons = await models.Person.findAll({
            where: {
                [Op.or]: [
                    { firstName: { [Op.like]: `%${q}%` } },
                    { lastName: { [Op.like]: `%${q}%` } },
                    { personIdentifier: { [Op.like]: `%${q}%` } }
                ]
            },
            attributes: ['personIdentifier', 'firstName', 'middleName', 'lastName', 'primaryOrganizationalUnit'],
            limit: 20,
            raw: true
        });

        return res.status(200).json(persons);
    } catch (error) {
        console.log('[PROXY] Error in searchPersons:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /api/db/admin/proxy/search-users?q=
 * Search admin users who have curation roles (for GrantProxyModal).
 */
// Define association with unique alias to avoid conflicts
models.AdminUser.hasMany(models.AdminUsersRole, {
    as: 'proxySearchRoles',
    constraints: false,
    foreignKey: 'userID'
});
models.AdminUsersRole.belongsTo(models.AdminRole, {
    as: 'proxySearchRole',
    constraints: false,
    foreignKey: 'roleID'
});

export const searchUsersWithCurationRoles = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        const q = (req.query.q as string || '').trim();
        if (q.length < 2) {
            return res.status(200).json([]);
        }

        const users = await models.AdminUser.findAll({
            attributes: ['userID', 'personIdentifier', 'nameFirst', 'nameMiddle', 'nameLast'],
            include: [{
                model: models.AdminUsersRole,
                as: 'proxySearchRoles',
                required: true,
                on: {
                    col: Sequelize.where(
                        Sequelize.col('AdminUser.userID'),
                        '=',
                        Sequelize.col('proxySearchRoles.userID')
                    )
                },
                attributes: [],
                include: [{
                    model: models.AdminRole,
                    as: 'proxySearchRole',
                    required: true,
                    where: {
                        roleLabel: {
                            [Op.in]: ['Curator_All', 'Curator_Scoped', 'Curator_Self', 'Superuser']
                        }
                    },
                    attributes: []
                }]
            }],
            where: {
                [Op.or]: [
                    { nameFirst: { [Op.like]: `%${q}%` } },
                    { nameLast: { [Op.like]: `%${q}%` } },
                    { personIdentifier: { [Op.like]: `%${q}%` } }
                ]
            },
            limit: 20,
            subQuery: false,
            group: ['AdminUser.userID'],
            raw: true
        });

        return res.status(200).json(users);
    } catch (error) {
        console.log('[PROXY] Error in searchUsersWithCurationRoles:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
