// No session here means the sign-in itself was refused (an institution or Cornell NetID that has
// no access, see src/utils/samlIdentity.ts), so "no roles assigned" would be the wrong story.
export const noAccessMessage = (status: string, userRoles: unknown): string | null => {
    if (status === "loading") return null;
    if (status !== "authenticated")
        return "You signed in, but this account doesn't have access to ReCiter Publication Manager. If you think it should, please contact a system administrator.";
    let roles: unknown = userRoles;
    if (typeof roles === "string") { try { roles = roles ? JSON.parse(roles) : null } catch { roles = null } }
    if (!Array.isArray(roles) || roles.length === 0)
        return "You have successfully authenticated, but you don't have any roles assigned. Please contact a system administrator";
    return "Sorry, you don't have access to the system. Please, contact your administrator.";
};
