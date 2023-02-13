import sequelize from "../../src/db/db";


export const findUserPermissions = async (uid: string, type: string) => {

    let userRolesList: any = [];
    try {
        if (type === "cwid") {
            userRolesList = await sequelize.query(
                "SELECT au.personIdentifier, roleLabel FROM admin_users as au INNER JOIN admin_users_roles as aur " +
                "ON au.userID = aur.userID INNER JOIN admin_roles ar ON aur.roleID = ar.roleID     WHERE     au.personIdentifier = :uId",
                {
                    replacements: { uId: uid },
                    nest: true,
                    raw: true
                }
            );
            return JSON.stringify(userRolesList);
        } else {
            userRolesList = await sequelize.query(
                "SELECT au.personIdentifier, roleLabel FROM admin_users as au INNER JOIN admin_users_roles as aur " +
                "ON au.userID = aur.userID INNER JOIN admin_roles ar ON aur.roleID = ar.roleID     WHERE     au.email = :uId",
                {
                    replacements: { uId: uid },
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











