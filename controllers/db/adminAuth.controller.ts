import type { NextApiRequest } from 'next'
import { getToken } from 'next-auth/jwt'
import { getCapabilities } from '../../src/utils/constants'

const safeJsonParse = (value: any, fallback: any) => {
    if (value == null) return fallback
    if (typeof value !== 'string') return value
    try { return JSON.parse(value) } catch { return fallback }
}

/**
 * True if the request carries a valid, signed session belonging to a user whose role grants
 * canManageUsers (Superuser only).
 *
 * The `backendApiKey` header these admin routes also check is `NEXT_PUBLIC_RECITER_BACKEND_API_KEY`
 * -- a NEXT_PUBLIC_ env var, which Next.js inlines into the client JS bundle at build time. It is
 * not a secret; it identifies "a request from this app's frontend," not "a request from an
 * authorized admin." Nothing else gated these routes, so anyone who reads it out of the served JS
 * could call them directly with no session at all -- including the route that assigns roles, which
 * made it a full authentication bypass to Superuser. This is the actual authorization check.
 */
export const isAuthorizedAdmin = async (req: NextApiRequest): Promise<boolean> => {
    const token: any = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return false
    const roles = safeJsonParse(token.userRoles, [])
    return getCapabilities(roles).canManageUsers === true
}
