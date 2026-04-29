import type { NextApiRequest } from 'next'
import { getToken } from 'next-auth/jwt'
import { getCapabilities } from './constants'
import { isPersonInScope, isProxyFor, ScopeData } from './scopeResolver'
import models from '../db/sequelize'

interface ScopeCheckResult {
  allowed: boolean
  status?: number
  message?: string
}

/**
 * Check whether the authenticated user is allowed to curate for the given person.
 *
 * Bypass order:
 *  1. Superuser / Curator_All (canCurate.all) — always allowed
 *  2. Curator_Self curating own profile — allowed
 *  3. Proxy holder (target in proxyPersonIds) — allowed
 *  4. Curator_Scoped — allowed if person is within scope (org unit + person types)
 *  5. Otherwise — 403
 *
 * Returns { allowed: true } or { allowed: false, status, message }.
 */
export async function checkCurationScope(
  req: NextApiRequest,
  targetUid: string
): Promise<ScopeCheckResult> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    return { allowed: false, status: 401, message: 'Not authenticated' }
  }

  const roles = token.userRoles ? JSON.parse(token.userRoles as string) : []
  const caps = getCapabilities(roles)

  // 1. Superuser / Curator_All — unrestricted
  if (caps.canCurate.all) {
    return { allowed: true }
  }

  // 2. Curator_Self curating own profile
  if (caps.canCurate.self && caps.canCurate.personIdentifier === targetUid) {
    return { allowed: true }
  }

  // 3. Proxy holder
  const proxyPersonIds: string[] = token.proxyPersonIds
    ? JSON.parse(token.proxyPersonIds as string)
    : []
  if (isProxyFor(proxyPersonIds, targetUid)) {
    return { allowed: true }
  }

  // 4. Scoped curator — check against person's org unit and person types
  if (caps.canCurate.scoped) {
    const scopeData: ScopeData = token.scopeData
      ? JSON.parse(token.scopeData as string)
      : null

    const person = await models.Person.findOne({
      where: { personIdentifier: targetUid },
      attributes: ['primaryOrganizationalUnit'],
      raw: true,
    })

    const personTypes = await models.PersonPersonType.findAll({
      where: { personIdentifier: targetUid },
      attributes: ['personType'],
      raw: true,
    })

    const orgUnit = person?.primaryOrganizationalUnit || null
    const types = personTypes.map((pt: any) => pt.personType).filter(Boolean)

    if (isPersonInScope(scopeData, orgUnit, types)) {
      return { allowed: true }
    }
  }

  return { allowed: false, status: 403, message: 'You do not have permission to curate this person' }
}
