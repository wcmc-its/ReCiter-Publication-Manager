import sequelize from "../../src/db/db";


export const findUserPermissions = async (attrValue: string, attrType: string) => {

    let userRolesList = [];
    try {
        if (attrType === "email") {
            userRolesList = await sequelize.query(
                "SELECT au.personIdentifier, roleLabel,aur.roleID FROM admin_users as au INNER JOIN admin_users_roles as aur " +
                "ON au.userID = aur.userID INNER JOIN admin_roles ar ON aur.roleID = ar.roleID     WHERE     au.email = :email",
                {
                    replacements: { email: attrValue },
                    nest: true,
                    raw: true
                }
            );
            return JSON.stringify(userRolesList);
        } else {
            userRolesList = await sequelize.query(
                "SELECT au.personIdentifier, roleLabel,aur.roleID FROM admin_users as au INNER JOIN admin_users_roles as aur " +
                "ON au.userID = aur.userID INNER JOIN admin_roles ar ON aur.roleID = ar.roleID     WHERE     au.personIdentifier = :personIdentifier",
                {
                    replacements: { personIdentifier: attrValue },
                    nest: true,
                    raw: true
                }
            );
            return JSON.stringify(userRolesList);
        }
    } catch (e) {
        console.log(e)
    }
};











