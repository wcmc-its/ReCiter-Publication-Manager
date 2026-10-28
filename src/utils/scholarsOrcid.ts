// Scholars is the ORCID authority for active scholars: SPS rewrites reciterdb.scholar_active
// (cwid, has_confirmed_orcid, refreshed_at) every night. For those people /manageprofile shows
// the iD read-only and the save/reset routes refuse. Everyone else keeps the editable field.

export const SCHOLARS_ACTIVE_MAX_AGE_HOURS = 48

// hasConfirmedOrcid is null when the cwid isn't in the table; ageHours is null when the
// table is empty.
export type ScholarsActiveRow = { hasConfirmedOrcid: number | boolean | null, ageHours: number | null }

// 'scholar': Scholars owns the iD (read-only here). 'not_scholar': a fresh table without this
// cwid, so PM owns it and copies saves into Identity. 'unknown': no row, a stale or empty
// table (SPS export stopped, or PM dev's reciterdb) — keep the editable field but write only
// admin_orcid, which SPS reads as a queue candidate, never as the on-file iD.
export const scholarsStatus = (row: ScholarsActiveRow | undefined | null): 'scholar' | 'not_scholar' | 'unknown' => {
    if (!row || row.ageHours === null || row.ageHours >= SCHOLARS_ACTIVE_MAX_AGE_HOURS) return 'unknown'
    return row.hasConfirmedOrcid === null ? 'not_scholar' : 'scholar'
}

export const scholarsChangeUrl = (cwid: string, base?: string): string =>
    `${(base || 'https://scholars.weill.cornell.edu').replace(/\/+$/, '')}/edit/orcid-queue?q=${encodeURIComponent(cwid.toLowerCase())}`

// People without a Scholars record: PM is the only place their ORCID is set, so a save or
// remove here is copied into their ReCiter Identity record (the IC keeps an existing
// Identity iD across its rebuild). Returns the record to POST back, or null for no write.
// Remove only clears the iD PM itself saved; a different value there is another writer's.
export const identityOrcidUpdate = <T extends { orcid?: string | null }>(
    identity: T | null,
    op: { save: string } | { remove: string | null },
): T | null => {
    if (!identity) return null
    const held = typeof identity.orcid === 'string' ? identity.orcid.trim() : null
    if ('save' in op) return held === op.save ? null : { ...identity, orcid: op.save }
    return op.remove && held === op.remove ? { ...identity, orcid: null } : null
}
