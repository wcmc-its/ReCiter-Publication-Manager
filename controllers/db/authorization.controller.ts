import models from '../../src/db/sequelize'
import { getCapabilities } from '../../src/utils/constants'
import { isPersonInScope, isProxyFor } from '../../src/utils/scopeResolver'

// Minimal per-person lookup for scope checks -- org unit + person types only, nothing else
// the curate-write path needs.
const findPersonScopeAttributes = async (personIdentifier: string) => {
    const person: any = await models.Person.findOne({
        where: { personIdentifier },
        attributes: ['primaryOrganizationalUnit'],
        raw: true,
    })
    const typeRows: any[] = await models.PersonPersonType.findAll({
        where: { personIdentifier },
        attributes: ['personType'],
        raw: true,
    })
    return {
        orgUnit: person?.primaryOrganizationalUnit ?? null,
        personTypes: typeRows.map((r) => r.personType).filter(Boolean),
    }
}

const safeJsonParse = (value: any, fallback: any) => {
    if (value == null) return fallback
    if (typeof value !== 'string') return value
    try { return JSON.parse(value) } catch { return fallback }
}

/**
 * True if the token's roles allow curating targetUid. Never trust the client for this --
 * call from every curate-write API route before performing the write.
 *
 * Before this, curate-write endpoints (e.g. goldstandard.ts) checked only a shared static
 * API key, never the caller's role/scope -- Curator_Self and Curator_All were just as
 * unenforced server-side as Curator_Scoped is without this. See PM#849.
 */
export const canCurate = async (token: any, targetUid: any): Promise<boolean> => {
    // Reject anything that isn't a plain non-empty string outright. targetUid flows into a
    // Sequelize `where: { personIdentifier }` below -- an array value there means IN(...), not
    // equality, which would let a scope check pass against a different (decoy) person than the
    // one actually acted on downstream. Never let that ambiguity past this point.
    if (typeof targetUid !== 'string' || targetUid.trim().length === 0) return false

    const roles = safeJsonParse(token?.userRoles, [])
    const caps = getCapabilities(roles)

    if (caps.canCurate.all) return true
    if (caps.canCurate.self && caps.canCurate.personIdentifier === targetUid) return true

    // A proxy grant is an independent, person-scoped delegation -- it does not require the
    // grantee to hold any curate-capable role. This matches the shipped admin UI ("Grants
    // curation access to specific people regardless of role or scope above") and is safe
    // because proxy_person_ids is only writable through isAuthorizedAdmin-gated routes: every
    // entry is a deliberate Superuser grant, never user-controlled.
    const proxyPersonIds = safeJsonParse(token?.proxyPersonIds, [])
    if (isProxyFor(proxyPersonIds, targetUid)) return true

    if (caps.canCurate.scoped) {
        const scopeData = safeJsonParse(token?.scopeData, null)
        // isPersonInScope treats a scope with neither dimension set as "no restriction," which
        // is the right default for other callers but wrong here: a Curator_Scoped user who was
        // saved with no scope configured (both fields left empty in the UI) must be denied
        // everyone, not treated as Curator_All. Fail closed instead of delegating to that default.
        const hasScope = scopeData && (
            (Array.isArray(scopeData.personTypes) && scopeData.personTypes.length > 0) ||
            (Array.isArray(scopeData.orgUnits) && scopeData.orgUnits.length > 0)
        )
        if (!hasScope) return false
        const target = await findPersonScopeAttributes(targetUid)
        return isPersonInScope(scopeData, target.orgUnit, target.personTypes)
    }

    return false
}
