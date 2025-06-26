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
    const conditions: string[] = [];
    const replacements: Record<string, any> = {};
    let userRolesList = []

    attrTypes.forEach((field, i) => {
        const value = attrValues[i];
        if (!allowedFields.includes(field)) return;
        if (value == null || value =='') return; // skip if null or undefined

        const key = `val${i}`;
        conditions.push(`${field} = :${key}`);
        replacements[key] = attrValues[i];
    });

    const whereClause = conditions.join(' OR ');

    userRolesList = await sequelize.query(
        `SELECT au.personIdentifier, roleLabel,aur.roleID FROM admin_users as au INNER JOIN admin_users_roles as aur ` +
                    `ON au.userID = aur.userID INNER JOIN admin_roles ar ON aur.roleID = ar.roleID  WHERE  ${whereClause} LIMIT 1`,
        {
        replacements,
        nest: true,
        raw:true
        //type: QueryTypes.SELECT,
        }
    );
    return JSON.stringify(userRolesList) ;
   
};











