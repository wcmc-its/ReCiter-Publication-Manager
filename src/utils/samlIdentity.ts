// Decide whose login a SAML assertion is, from its attributes alone.
//
// The WCM login proxy brokers more than WCM: once ITS enables Cornell University (NetID) for
// this SP (REQ0321532), a Cornell Ithaca person can complete a login here too. A NetID is a
// short alphanumeric string, so it can equal a WCM CWID. The old code keyed every login on
// `CWID || uid`; a Cornell assertion carrying `uid` = its NetID would have signed that person in
// as the WCM user who owns the same string. The ePPN scope is what tells the two apart:
//
//   no ePPN                -> WCM, unchanged (CWID, then uid), as before this file existed
//   ePPN @med.cornell.edu  -> WCM, unchanged
//   ePPN @qatar-med.cornell.edu -> WCM, unchanged: WCM-Qatar signs in through its own Entra tenant,
//                             which sends the Qatar UPN as ePPN (ED itself stores @med.cornell.edu)
//   ePPN @cornell.edu      -> Cornell: the key is the FULL ePPN (netid@cornell.edu), never the
//                             NetID alone and never CWID/uid. Refused unless CORNELL_LOGIN=on.
//   any other scope        -> refused (HSS, MSK, NYP, ... are not enabled for this app)
//
// A Cornell key contains '@', so it fails isValidCwid and can never be written anywhere a CWID
// is expected; Cornell sessions are admitted only against an admin_users row an administrator
// created under that exact key (see findPartnerAdminUser).

export const EPPN_ATTRIBUTES = ['urn:oid:1.3.6.1.4.1.5923.1.1.1.6', 'eduPersonPrincipalName']
export const WCM_EPPN_SCOPES = ['med.cornell.edu', 'qatar-med.cornell.edu']
export const CORNELL_EPPN_SCOPE = 'cornell.edu'
// Cornell NetIDs are letters and digits only (e.g. abc123).
const NETID = /^[a-z0-9]{2,16}$/

type Attrs = Record<string, unknown>

export type SamlIdentity =
    | { kind: 'wcm'; personIdentifier: string | undefined; email: string | undefined; firstName: string; lastName: string }
    | { kind: 'cornell'; personIdentifier: string; email: string | undefined; firstName: string; lastName: string }
    | { kind: 'refused'; reason: 'cornell_login_off' | 'bad_netid' | 'untrusted_scope' }

function first(attrs: Attrs, ...names: string[]): string | undefined {
    for (const name of names) {
        const v = attrs[name]
        const s = Array.isArray(v) ? v[0] : v
        if (typeof s === 'string' && s.trim() !== '') return s.trim()
    }
    return undefined
}

export function cornellLoginEnabled(env: Record<string, string | undefined> = process.env): boolean {
    return (env.CORNELL_LOGIN || '').trim().toLowerCase() === 'on'
}

export function classifySamlAttributes(attrs: Attrs | null | undefined, opts: { cornellLogin: boolean }): SamlIdentity {
    const a: Attrs = attrs || {}
    const firstName = first(a, 'urn:oid:2.5.4.42') || ''
    const lastName = first(a, 'urn:oid:2.5.4.4') || ''
    const eppn = first(a, ...EPPN_ATTRIBUTES)?.toLowerCase()
    const scope = eppn && eppn.includes('@') ? eppn.slice(eppn.lastIndexOf('@') + 1) : undefined

    if (!eppn || (scope && WCM_EPPN_SCOPES.includes(scope))) {
        return {
            kind: 'wcm',
            personIdentifier: first(a, 'CWID', 'uid'),
            email: first(a, 'user.email', 'email', 'userPrincipalName'),
            firstName,
            lastName,
        }
    }
    if (scope === CORNELL_EPPN_SCOPE) {
        if (!opts.cornellLogin) return { kind: 'refused', reason: 'cornell_login_off' }
        const netid = eppn.slice(0, eppn.lastIndexOf('@'))
        if (!NETID.test(netid)) return { kind: 'refused', reason: 'bad_netid' }
        return {
            kind: 'cornell',
            personIdentifier: `${netid}@${CORNELL_EPPN_SCOPE}`,
            email: first(a, 'urn:oid:0.9.2342.19200300.100.1.3', 'mail', 'user.email', 'email'),
            firstName,
            lastName,
        }
    }
    return { kind: 'refused', reason: 'untrusted_scope' }
}
