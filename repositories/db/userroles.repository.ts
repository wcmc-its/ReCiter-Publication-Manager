import sequelize from "../../src/db/db";

// Data access for a user's roles. The WHERE is fixed; only the replacements (personIdentifier, email)
// vary, and they are always bound parameters — never interpolated — so this stays injection-safe.
// A user is matched by (personIdentifier AND email), or by an email that is unique across admin_users.
export function queryUserPermissions(replacements: Record<string, any>) {
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

    return sequelize.query(
        // scope_person_types/scope_org_units/proxy_person_ids are per-admin_users-row, so they
        // repeat identically across a user's role rows here -- callers (nextauth jwt callback)
        // read them off the first row. See PM#849.
        `SELECT DISTINCT au.personIdentifier, roleLabel, aur.roleID, ` +
        `au.scope_person_types, au.scope_org_units, au.proxy_person_ids ` +
        `FROM admin_users as au INNER JOIN admin_users_roles as aur ` +
        `ON au.userID = aur.userID INNER JOIN admin_roles ar ON aur.roleID = ar.roleID  WHERE  ${whereClause} `,
        {
            replacements,
            nest: true,
            raw: true
        }
    );
}
