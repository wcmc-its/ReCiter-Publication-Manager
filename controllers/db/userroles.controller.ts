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











