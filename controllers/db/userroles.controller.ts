import sequelize from "../../src/db/db";

/**
 * Retrieves user roles, scope data, and proxy person IDs for a given user.
 * Returns a composite JSON string: { roles, scopeData, proxyPersonIds }
 *
 * @param attrValue - The user identifier value (CWID or email)
 * @param attrType - The type of identifier: "email" or "cwid"/"personIdentifier"
 */
export const findUserPermissions = async (attrValue: string, attrType: string) => {
    let userRolesList = [];

    // Handle both MySQL (parsed objects) and MariaDB (string) JSON column returns
    const parseJson = (val: any) => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'string') {
            try { return JSON.parse(val); }
            catch { return null; }
        }
        return val;
    };

    try {
        // Build WHERE clause based on attrType
        const whereCondition = attrType === "email"
            ? "au.email = :value"
            : "au.personIdentifier = :value";

        // Query roles via JOIN through admin_users_roles and admin_roles
        userRolesList = await sequelize.query(
            `SELECT DISTINCT au.personIdentifier, roleLabel, aur.roleID ` +
            `FROM admin_users au ` +
            `INNER JOIN admin_users_roles aur ON au.userID = aur.userID ` +
            `INNER JOIN admin_roles ar ON aur.roleID = ar.roleID ` +
            `WHERE ${whereCondition}`,
            {
                replacements: { value: attrValue },
                nest: true,
                raw: true
            }
        );

        // D-05: Always query scope + proxy for every user
        // D-07: Read from JSON columns on admin_users directly
        let scopeData = null;
        let proxyPersonIds: string[] = [];

        const scopeWhereCondition = attrType === "email"
            ? "email = :value"
            : "personIdentifier = :value";

        const scopeResult: any = await sequelize.query(
            `SELECT scope_person_types, scope_org_units, proxy_person_ids ` +
            `FROM admin_users WHERE ${scopeWhereCondition} LIMIT 1`,
            {
                replacements: { value: attrValue },
                raw: true,
            }
        );

        if (scopeResult[0]?.[0]) {
            const row = scopeResult[0][0];
            const personTypes = parseJson(row.scope_person_types);
            const orgUnits = parseJson(row.scope_org_units);
            const proxyIds = parseJson(row.proxy_person_ids);

            // D-06: Build scopeData only if either personTypes or orgUnits is non-null
            if (personTypes || orgUnits) {
                scopeData = { personTypes: personTypes || null, orgUnits: orgUnits || null };
            }
            proxyPersonIds = proxyIds || [];
        }

        // D-06: null scopeData and empty proxyPersonIds for users without assignments
        return JSON.stringify({ roles: userRolesList, scopeData, proxyPersonIds });
    } catch (e) {
        console.error('[AUTH] findUserPermissions error:', e);
        // Safe fallback so login still works even if scope/proxy queries fail
        return JSON.stringify({ roles: [], scopeData: null, proxyPersonIds: [] });
    }
};
