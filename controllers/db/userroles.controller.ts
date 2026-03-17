import sequelize from "../../src/db/db";


/**
 * Helper to retrieve scope data (person types + org units) for a given userID.
 * Only called when the user has the Curator_Scoped role.
 */
async function getScopeDataForUser(userID: number) {
    const personTypesResult: any = await sequelize.query(
        "SELECT personType FROM admin_users_person_types WHERE userID = :userID",
        { replacements: { userID }, raw: true }
    );
    const departmentsResult: any = await sequelize.query(
        "SELECT ad.departmentLabel FROM admin_users_departments aud " +
        "INNER JOIN admin_departments ad ON aud.departmentID = ad.departmentID " +
        "WHERE aud.userID = :userID",
        { replacements: { userID }, raw: true }
    );

    return {
        personTypes: personTypesResult[0]?.length > 0
            ? personTypesResult[0].map((r: any) => r.personType)
            : null,
        orgUnits: departmentsResult[0]?.length > 0
            ? departmentsResult[0].map((r: any) => r.departmentLabel)
            : null,
    };
}


/**
 * Helper to retrieve proxy person IDs for a given userID.
 * Returns an array of personIdentifier strings that the user is a proxy for.
 */
async function getProxyDataForUser(userID: number) {
    const result: any = await sequelize.query(
        "SELECT personIdentifier FROM admin_users_proxy WHERE userID = :userID",
        { replacements: { userID }, raw: true }
    );
    return result[0]?.length > 0
        ? result[0].map((r: any) => r.personIdentifier)
        : [];
}


export const findUserPermissions = async (attrValue: string, attrType: string) => {

    let userRolesList = [];
    try {
        if (attrType === "email") {
            userRolesList = await sequelize.query(
                "SELECT au.personIdentifier, roleLabel FROM admin_users as au INNER JOIN admin_users_roles as aur " +
                "ON au.userID = aur.userID INNER JOIN admin_roles ar ON aur.roleID = ar.roleID     WHERE     au.email = :email",
                {
                    replacements: { email: attrValue },
                    nest: true,
                    raw: true
                }
            );
        } else {
            userRolesList = await sequelize.query(
                "SELECT au.personIdentifier, roleLabel FROM admin_users as au INNER JOIN admin_users_roles as aur " +
                "ON au.userID = aur.userID INNER JOIN admin_roles ar ON aur.roleID = ar.roleID     WHERE     au.personIdentifier = :personIdentifier",
                {
                    replacements: { personIdentifier: attrValue },
                    nest: true,
                    raw: true
                }
            );
        }

        // Retrieve userID once for scope and proxy lookups
        const hasScoped = userRolesList.some((r: any) => r.roleLabel === 'Curator_Scoped');
        const hasCurationRole = userRolesList.some((r: any) =>
            ['Curator_Scoped', 'Curator_All', 'Curator_Self'].includes(r.roleLabel)
        );

        let scopeData = null;
        let proxyPersonIds: string[] = [];
        let userID: number | undefined;

        if (hasScoped || hasCurationRole) {
            // Get user's userID for scope and proxy lookups
            const userIdQuery = attrType === "email"
                ? "SELECT userID FROM admin_users WHERE email = :value"
                : "SELECT userID FROM admin_users WHERE personIdentifier = :value";

            const userIdResult: any = await sequelize.query(userIdQuery, {
                replacements: { value: attrValue },
                raw: true,
            });
            userID = userIdResult[0]?.[0]?.userID;
        }

        if (hasScoped && userID) {
            scopeData = await getScopeDataForUser(userID);
        }

        // Get proxy data for any user with a curation role
        if (hasCurationRole && userID) {
            proxyPersonIds = await getProxyDataForUser(userID);
        }

        return JSON.stringify({ roles: userRolesList, scopeData, proxyPersonIds });
    } catch (e) {
        console.log(e)
    }
};
