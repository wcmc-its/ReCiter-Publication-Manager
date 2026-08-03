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
        `SELECT DISTINCT au.personIdentifier, roleLabel,aur.roleID FROM admin_users as au INNER JOIN admin_users_roles as aur ` +
        `ON au.userID = aur.userID INNER JOIN admin_roles ar ON aur.roleID = ar.roleID  WHERE  ${whereClause} `,
        {
            replacements,
            nest: true,
            raw: true
        }
    );
}
