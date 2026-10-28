// Scholars is the ORCID authority for active scholars: SPS rewrites reciterdb.scholar_active
// (cwid, has_confirmed_orcid, refreshed_at) every night. For those people /manageprofile shows
// the iD read-only and the save/reset routes refuse. Everyone else keeps the editable field.

export const SCHOLARS_ACTIVE_MAX_AGE_HOURS = 48

export type ScholarsActiveRow = { hasConfirmedOrcid: number | boolean, ageHours: number | null }

// True when PM must defer to Scholars. No row (not an active scholar) or a stale table
// (SPS export stopped) keeps the editable field: failing open is safe, since SPS reads
// admin_orcid saves as queue candidates, never as the on-file iD.
export const scholarsManagesOrcid = (row: ScholarsActiveRow | undefined | null): boolean =>
    !!row && row.ageHours !== null && row.ageHours < SCHOLARS_ACTIVE_MAX_AGE_HOURS

// Superusers and Curator_All go to the librarian ORCID queue; everyone else to the
// scholar's own identifiers editor.
export const scholarsChangeUrl = (cwid: string, librarian: boolean, base?: string): string => {
    const root = (base || 'https://scholars.weill.cornell.edu').replace(/\/+$/, '')
    const id = encodeURIComponent(cwid.toLowerCase())
    return librarian ? `${root}/edit/orcid-queue?q=${id}` : `${root}/edit/scholar/${id}?attr=identifiers-profiles`
}
