// Rules for Cornell NetID accounts (plan: Projects/ReCiter-Publication-Manager/plans/
// 2026-11-22-cornell-self-curation-and-reports.md). Pure, so the decisions are unit-tested; the
// database side lives in controllers/db/admin.users.controller.ts (provisionPartnerAdminUser).
//
// A Cornell session key is `netid@cornell.edu` (src/utils/samlIdentity.ts). "Own record" is the
// separate `person` row keyed by the bare NetID, reached through the proxy grant
// (admin_users.proxy_person_ids = [netid]) that canCurate and the middleware already honor.
// Same value as CORNELL_ITHACA_PERSON_TYPE in ./cornellOnly; repeated so node --test can load
// this file without a bundler (extensionless imports don't resolve there).
const CORNELL_ITHACA_PERSON_TYPE = 'cornell-ithaca'

const KEY = /^([a-z0-9]{2,16})@cornell\.edu$/

export const PARTNER_ROLE = 'Reporter_All'

/** The bare NetID of a Cornell session key, or null if `key` is not exactly one. */
export function netidFromPartnerKey(key: unknown): string | null {
    if (typeof key !== 'string') return null
    const m = KEY.exec(key)
    return m ? m[1] : null
}

export type PartnerDecision =
    | { ok: true; netid: string; create: boolean; setProxy: boolean }
    | { ok: false; reason: 'bad_key' | 'not_on_roster' | 'disabled' | 'key_mismatch' }

/**
 * Whether a Cornell login may proceed, re-checked on EVERY login (not just the first):
 *  - the key must be a well-formed `netid@cornell.edu`;
 *  - a `person` row keyed by the NetID must carry the cornell-ithaca person type. A NetID that is
 *    also (or only) a WCM CWID without that type is refused, never handed that WCM record;
 *  - an existing account with status 0 has been disabled by an administrator;
 *  - an existing row must hold exactly this key (MySQL compares case-insensitively).
 * The proxy grant is server-owned: reset to [netid] whenever it differs.
 */
export function decidePartnerLogin(
    key: unknown,
    personTypes: string[] | null,
    existing: { personIdentifier?: string | null; status?: number | null; proxy_person_ids?: unknown } | null,
): PartnerDecision {
    const netid = netidFromPartnerKey(key)
    if (!netid) return { ok: false, reason: 'bad_key' }
    if (!personTypes || !personTypes.includes(CORNELL_ITHACA_PERSON_TYPE)) return { ok: false, reason: 'not_on_roster' }
    if (!existing) return { ok: true, netid, create: true, setProxy: true }
    if ((existing.personIdentifier || '').toLowerCase() !== key) return { ok: false, reason: 'key_mismatch' }
    if (existing.status === 0) return { ok: false, reason: 'disabled' }
    return { ok: true, netid, create: false, setProxy: !sameProxy(existing.proxy_person_ids, netid) }
}

function sameProxy(value: unknown, netid: string): boolean {
    let v = value
    if (typeof v === 'string') { try { v = JSON.parse(v) } catch { return false } }
    return Array.isArray(v) && v.length === 1 && v[0] === netid
}

/**
 * The actor ID to send to ReCiter's external-article API (EXTERNAL_STORE=reciter). ReCiter
 * canonicalizes it as a CWID and rejects a `@` key, and the bare NetID must never stand in for
 * it (it can equal a WCM CWID). So a Cornell session sends no actor: fine where ReCiter treats
 * it as optional (add), refused by the caller where it is required (feedback).
 */
export function reciterActor(username: unknown): string | undefined {
    if (typeof username !== 'string' || username === '') return undefined
    return netidFromPartnerKey(username) ? undefined : username
}

export const PARTNER_EXTERNAL_FEEDBACK_MESSAGE =
    'Accepting or rejecting Scopus and other non-PubMed articles is not available for Cornell NetID accounts yet.'
