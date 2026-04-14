import sequelize from "../../src/db/db";
//import { QueryTypes } from 'sequelize';

export const findUserPermissions = async (attrTypes: string[], attrValues: string[]) => {

    if (!Array.isArray(attrTypes) || !Array.isArray(attrValues)) {
        throw new Error('Both attrTypes and attrValues must be arrays');
    }

    if (attrTypes.length !== attrValues.length) {
        throw new Error('attrTypes and attrValues must be the same length');
    }
    
    const allowedFields = ['email', 'personIdentifier'];
    const replacements: Record<string, any> = {};
    let userRolesList = []

    let whereClause = [];
    
    let personIdentifier = null;
    let email = null;

    attrTypes.forEach((field, index) => {
        const value = attrValues[index]??'';
        if (!allowedFields.includes(field)) return;

        if (field === 'personIdentifier') {
            personIdentifier = value;
            replacements.personIdentifier = value;
        }

        if (field === 'email') {
            email = value;
            replacements.email = value;
        }
    });
// Build condition blocks
    whereClause.push(`
        (au.personIdentifier = :personIdentifier AND au.email = :email)
        OR
        (
        au.email = :email
        AND au.email IS NOT NULL AND au.email <> ''
        AND au.email IN (
            SELECT email
            FROM admin_users
            WHERE email IS NOT NULL AND email <> ''
            GROUP BY email
            HAVING COUNT(*) = 1
        )
        )
    `);

    userRolesList = await sequelize.query(
        `SELECT DISTINCT au.personIdentifier, roleLabel,aur.roleID FROM admin_users as au INNER JOIN admin_users_roles as aur ` +
                    `ON au.userID = aur.userID INNER JOIN admin_roles ar ON aur.roleID = ar.roleID  WHERE  ${whereClause} `,
        {
        replacements,
        nest: true,
        raw:true
        //type: QueryTypes.SELECT,
        }
    );
    return JSON.stringify(userRolesList) ;

};

export const findUserPermissionsEnriched = async (
  attrTypes: string[],
  attrValues: string[]
): Promise<{ permissions: string[]; permissionResources: any[] }> => {

    if (!Array.isArray(attrTypes) || !Array.isArray(attrValues)) {
        throw new Error('Both attrTypes and attrValues must be arrays');
    }

    if (attrTypes.length !== attrValues.length) {
        throw new Error('attrTypes and attrValues must be the same length');
    }

    const allowedFields = ['email', 'personIdentifier'];
    const replacements: Record<string, any> = {};

    let personIdentifier = null;
    let email = null;

    attrTypes.forEach((field, index) => {
        const value = attrValues[index] ?? '';
        if (!allowedFields.includes(field)) return;

        if (field === 'personIdentifier') {
            personIdentifier = value;
            replacements.personIdentifier = value;
        }

        if (field === 'email') {
            email = value;
            replacements.email = value;
        }
    });

    // Build WHERE clause (identical to findUserPermissions)
    const whereClause = `
        (au.personIdentifier = :personIdentifier AND au.email = :email)
        OR
        (
        au.email = :email
        AND au.email IS NOT NULL AND au.email <> ''
        AND au.email IN (
            SELECT email
            FROM admin_users
            WHERE email IS NOT NULL AND email <> ''
            GROUP BY email
            HAVING COUNT(*) = 1
        )
        )
    `;

    // Query 1: Resolve distinct permission keys via 4-table JOIN
    const permRows: any[] = await sequelize.query(
        `SELECT DISTINCT p.permissionKey
         FROM admin_users au
         INNER JOIN admin_users_roles aur ON au.userID = aur.userID
         INNER JOIN admin_role_permissions arp ON aur.roleID = arp.roleID
         INNER JOIN admin_permissions p ON arp.permissionID = p.permissionID
         WHERE ${whereClause}`,
        {
            replacements,
            raw: true,
            nest: true
        }
    );

    const permissions: string[] = permRows.map((r: any) => r.permissionKey);

    // Query 2: Fetch permission resources (only if user has permissions)
    let permissionResources: any[] = [];
    if (permissions.length > 0) {
        permissionResources = await sequelize.query(
            `SELECT pr.resourceType, pr.resourceKey, pr.displayOrder,
                    pr.icon, pr.label, pr.route, p.permissionKey
             FROM admin_permission_resources pr
             INNER JOIN admin_permissions p ON pr.permissionID = p.permissionID
             WHERE p.permissionKey IN (:permKeys)
             ORDER BY pr.displayOrder ASC`,
            {
                replacements: { permKeys: permissions },
                raw: true,
                nest: true
            }
        );
    }

    return { permissions, permissionResources };
};









