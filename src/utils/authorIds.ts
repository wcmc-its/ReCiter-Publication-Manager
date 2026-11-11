// Author profile ids (3f): each person's Scopus Author IDs and OpenAlex author ids, held in
// reciterdb.person_author_id (ReCiterDB setup/table_person_author_id_import_harvest_v3.8.sql).
// The reciterdb nightly (update/authorIdSuggestions.py) writes SUGGESTED rows, plus CONFIRMED
// rows with method AUTO for the strong band. Curators confirm, reject or add ids on Manage
// Profile. The nightly never touches a row whose status is CONFIRMED or REJECTED or whose
// method is CURATOR, so every curator decision is written with method CURATOR.
//
// Pure helpers only (no DB, no React): shared by the API route, the card and node --test.

export type AuthorIdType = 'SCOPUS_AUID' | 'OPENALEX_AUTHOR'
export type AuthorIdStatus = 'SUGGESTED' | 'CONFIRMED' | 'REJECTED'
export type AuthorIdMethod = 'PUB_VOTE' | 'ORCID_LOOKUP' | 'AUTO' | 'CURATOR'
export type AuthorIdAction = 'confirm' | 'reject' | 'undo' | 'add'

export const AUTHOR_ID_TYPES: AuthorIdType[] = ['SCOPUS_AUID', 'OPENALEX_AUTHOR']
export const AUTHOR_ID_ACTIONS: AuthorIdAction[] = ['confirm', 'reject', 'undo', 'add']

export const AUTHOR_ID_TYPE_LABEL: Record<AuthorIdType, string> = {
    SCOPUS_AUID: 'Scopus',
    OPENALEX_AUTHOR: 'OpenAlex',
}

export type AuthorIdRow = {
    idType: AuthorIdType
    idValue: string
    status: AuthorIdStatus
    method: AuthorIdMethod
    votes: number
    resolvable: number
    share: number | null
    pmids: number[]
    competing: Record<string, number>
    orcidLookup: boolean
    conflictUid: string | null
    decidedBy: string | null
    decidedAt: string | null
}

// Accepts the bare id or a pasted profile URL and returns the stored form, or null.
//   Scopus:   digits (Scopus author ids are 10-11 digits today; 5-20 allowed),
//             or a URL carrying authorId=<digits>.
//   OpenAlex: A + digits, any case, or https://openalex.org/A… / …/authors/A….
export const normalizeAuthorId = (idType: AuthorIdType, raw: unknown): string | null => {
    if (typeof raw !== 'string') return null
    const s = raw.trim()
    if (!s || s.length > 200) return null
    if (idType === 'SCOPUS_AUID') {
        const fromUrl = s.match(/[?&]authorId=(\d+)/i)
        const v = fromUrl ? fromUrl[1] : s
        return /^\d{5,20}$/.test(v) ? v : null
    }
    if (idType === 'OPENALEX_AUTHOR') {
        const m = s.match(/^(?:https?:\/\/)?(?:api\.)?(?:openalex\.org\/)?(?:authors\/)?([aA]\d{4,20})\/?$/)
        return m ? 'A' + m[1].slice(1) : null
    }
    return null
}

export const authorIdUrl = (idType: AuthorIdType, idValue: string): string =>
    idType === 'SCOPUS_AUID'
        ? `https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(idValue)}`
        : `https://openalex.org/authors/${encodeURIComponent(idValue)}`

export const authorIdStatusLabel = (r: Pick<AuthorIdRow, 'status' | 'method'>): string =>
    r.status === 'CONFIRMED' ? (r.method === 'AUTO' ? 'Confirmed (auto)' : 'Confirmed')
        : r.status === 'REJECTED' ? 'Rejected' : 'Suggested'

// "on 27 of 29 accepted papers with an author id". resolvable counts the papers (newest 50
// accepted) whose target-author slot resolved to any id of this type.
export const authorIdEvidenceLine = (r: Pick<AuthorIdRow, 'votes' | 'resolvable' | 'orcidLookup' | 'method'>): string | null => {
    const parts: string[] = []
    if (r.votes > 0) parts.push(`on ${r.votes} of ${r.resolvable} accepted paper${r.resolvable === 1 ? '' : 's'} with an author id`)
    if (r.orcidLookup) parts.push('matches the ORCID iD')
    if (!parts.length && r.method === 'CURATOR') return 'added by a curator'
    return parts.length ? parts.join('; ') : null
}

// MariaDB returns JSON columns as text from a raw query; MySQL may return them parsed.
export const parseEvidence = (value: unknown): { pmids: number[], competing: Record<string, number>, orcidLookup: boolean } => {
    let v: any = value
    if (typeof v === 'string') {
        try { v = JSON.parse(v) } catch { v = null }
    }
    const pmids = Array.isArray(v?.pmids) ? v.pmids.map(Number).filter((n: number) => Number.isFinite(n) && n > 0) : []
    const competing: Record<string, number> = {}
    if (v?.competing && typeof v.competing === 'object' && !Array.isArray(v.competing)) {
        for (const [k, n] of Object.entries(v.competing)) if (Number.isFinite(Number(n))) competing[k] = Number(n)
    }
    return { pmids, competing, orcidLookup: v?.orcid_lookup === true }
}

const STATUS_ORDER: Record<AuthorIdStatus, number> = { CONFIRMED: 0, SUGGESTED: 1, REJECTED: 2 }

export const sortAuthorIds = <T extends Pick<AuthorIdRow, 'idType' | 'status' | 'votes' | 'idValue'>>(rows: T[]): T[] =>
    [...rows].sort((a, b) =>
        AUTHOR_ID_TYPES.indexOf(a.idType) - AUTHOR_ID_TYPES.indexOf(b.idType)
        || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        || b.votes - a.votes
        || a.idValue.localeCompare(b.idValue))

// The write a curator action makes to one (uid, idType, idValue) row.
//   existing:      the row as stored, or null.
//   confirmedBy:   another uid holding this id as CONFIRMED, if any (blocks confirm/add: 409).
// Returns one of:
//   { kind: 'update', status, method }   decided_by/decided_at are set to the actor (cleared for undo)
//   { kind: 'insert', status, method }   a curator-added id
//   { kind: 'delete' }                   undo of a curator-added id with no nightly evidence
//   { kind: 'noop' }
//   { kind: 'error', http, message, conflictUid? }
export type AuthorIdPlan =
    | { kind: 'update' | 'insert', status: AuthorIdStatus, method: AuthorIdMethod, decided: boolean }
    | { kind: 'delete' }
    | { kind: 'noop' }
    | { kind: 'error', http: number, message: string, conflictUid?: string }

export const planAuthorIdAction = (
    action: AuthorIdAction,
    existing: Pick<AuthorIdRow, 'status' | 'method' | 'votes' | 'orcidLookup'> | null,
    confirmedBy: string | null,
): AuthorIdPlan => {
    const conflict = (): AuthorIdPlan => ({
        kind: 'error', http: 409, conflictUid: confirmedBy as string,
        message: `This id is already confirmed for ${confirmedBy}. Reject it there first.`,
    })
    switch (action) {
        case 'add':
            if (existing?.status === 'CONFIRMED') return { kind: 'noop' }
            if (confirmedBy) return conflict()
            return existing
                ? { kind: 'update', status: 'CONFIRMED', method: 'CURATOR', decided: true }
                : { kind: 'insert', status: 'CONFIRMED', method: 'CURATOR', decided: true }
        case 'confirm':
            if (!existing) return { kind: 'error', http: 404, message: 'No such id for this person' }
            if (existing.status === 'CONFIRMED') return { kind: 'noop' }
            if (confirmedBy) return conflict()
            return { kind: 'update', status: 'CONFIRMED', method: 'CURATOR', decided: true }
        case 'reject':
            if (!existing) return { kind: 'error', http: 404, message: 'No such id for this person' }
            if (existing.status === 'REJECTED') return { kind: 'noop' }
            return { kind: 'update', status: 'REJECTED', method: 'CURATOR', decided: true }
        case 'undo':
            // Back to Suggested, handing the row back to the nightly with the method it would
            // have written. A curator-added id with no nightly evidence is removed instead.
            if (!existing) return { kind: 'noop' }
            if (existing.status === 'SUGGESTED' && existing.method !== 'CURATOR') return { kind: 'noop' }
            if (existing.votes > 0) return { kind: 'update', status: 'SUGGESTED', method: 'PUB_VOTE', decided: false }
            if (existing.orcidLookup) return { kind: 'update', status: 'SUGGESTED', method: 'ORCID_LOOKUP', decided: false }
            return { kind: 'delete' }
        default:
            return { kind: 'error', http: 400, message: 'Unknown action' }
    }
}

// The action that puts a row back the way it was before `action`, for the toast's Undo.
// null = nothing to undo (the row did not exist and nothing was written).
export const reverseAction = (prev: Pick<AuthorIdRow, 'status'> | null): AuthorIdAction =>
    !prev || prev.status === 'SUGGESTED' ? 'undo' : prev.status === 'CONFIRMED' ? 'confirm' : 'reject'

// Whether the row offers a persistent Undo (a curator decision) and how it is labelled.
export const rowUndoLabel = (r: Pick<AuthorIdRow, 'status' | 'method' | 'votes' | 'orcidLookup'>): string | null => {
    if (r.method !== 'CURATOR') return null
    if (r.votes > 0 || r.orcidLookup) return 'Undo'
    return 'Remove'
}
