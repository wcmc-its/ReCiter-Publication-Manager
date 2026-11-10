// Phase 3a — Curate's single "All sources" tab over today's ExternalArticle rows: one row per
// work across Scopus, OpenAlex and Crossref, a status switch (Pending / Accepted / Rejected) and
// a source switch. Dependency-free so tests/allSources.test.mjs can load it with `node --test`.
//
// Today's rows carry no lifecycle status: a row is Accepted unless `suppressed` (curator reject,
// or superseded by a PubMed record). A `status` field, when the 3b schema adds one, wins, so the
// Pending view and the "N to review" pill light up without another UI change.

export type ExtStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'
export type ExtSourceName = 'Scopus' | 'OpenAlex' | 'Crossref' | 'Manual'
export const EXT_SOURCE_NAMES: ExtSourceName[] = ['Scopus', 'OpenAlex', 'Crossref', 'Manual']

export function extStatusOf(row: any): ExtStatus {
    const s = String(row?.status || '').toUpperCase()
    if (s === 'PENDING' || s === 'ACCEPTED' || s === 'REJECTED') return s
    return row?.suppressed ? 'REJECTED' : 'ACCEPTED'
}

// sourceType, else the SOURCE: prefix of articleId. Anything unrecognised is Manual (no
// sourceType === 'MANUAL' row exists yet; this is the catch-all the old per-source tabs used).
export function extSourceOf(row: any): ExtSourceName {
    const id = String(row?.articleId || '')
    const st = String(row?.sourceType || (id.includes(':') ? id.slice(0, id.indexOf(':')) : '')).toUpperCase()
    return st === 'SCOPUS' ? 'Scopus' : st === 'OPENALEX' ? 'OpenAlex' : st === 'CROSSREF' ? 'Crossref' : 'Manual'
}

export const normDoi = (x: unknown): string =>
    String(x ?? '').trim().toLowerCase().replace(/^https?:\/\/(?:dx\.|www\.)?doi\.org\//, '').replace(/^doi:\s*/, '')

export type ExtWork = {
    key: string,
    rows: any[],
    // Distinct sources holding this work, in EXT_SOURCE_NAMES order.
    sources: ExtSourceName[],
    status: ExtStatus,
    // The row shown for the work: one in the work's status, preferring one with authors.
    lead: any,
}

const hasAuthors = (row: any): boolean =>
    (Array.isArray(row?.authors) && row.authors.some(Boolean)) ||
    (typeof row?.authors === 'string' && row.authors.trim().length > 0)

// One work per DOI (case and doi.org prefix ignored); a row without a DOI is its own work.
// Group order follows the first row of each group, so the list keeps the API's order.
export function groupExternalWorks(rows: any[]): ExtWork[] {
    const byKey = new Map<string, any[]>()
    for (const row of rows || []) {
        const doi = normDoi(row?.doi)
        const key = doi ? `doi:${doi}` : `id:${row?.articleId || ''}`
        const list = byKey.get(key)
        if (list) list.push(row)
        else byKey.set(key, [row])
    }
    return [...byKey.entries()].map(([key, g]) => {
        const statuses = g.map(extStatusOf)
        const status: ExtStatus = statuses.includes('PENDING') ? 'PENDING' : statuses.includes('ACCEPTED') ? 'ACCEPTED' : 'REJECTED'
        const inStatus = g.filter((r) => extStatusOf(r) === status)
        const lead = inStatus.find(hasAuthors) || inStatus[0]
        const present = new Set(g.map(extSourceOf))
        return { key, rows: g, sources: EXT_SOURCE_NAMES.filter((s) => present.has(s)), status, lead }
    })
}

const authorsText = (row: any): string =>
    Array.isArray(row?.authors) ? row.authors.filter(Boolean).join(', ') : typeof row?.authors === 'string' ? row.authors : ''

// Filter-box match: title, venue, DOI, PMID, source id or author, case-insensitive.
export function workMatches(work: ExtWork, query: string): boolean {
    const q = (query || '').trim().toLowerCase()
    if (!q) return true
    return work.rows.some((r) => [
        r.title, r.journalOrVenue, r.venue, r.journal, r.doi, r.pmid, r.articleId, authorsText(r),
    ].some((v) => v != null && String(v).toLowerCase().includes(q)))
}

export const workHasSource = (work: ExtWork, source: ExtSourceName | 'all'): boolean =>
    source === 'all' || work.sources.includes(source)

export function countWorks(works: ExtWork[]): Record<ExtStatus, number> {
    const n: Record<ExtStatus, number> = { PENDING: 0, ACCEPTED: 0, REJECTED: 0 }
    for (const w of works) n[w.status]++
    return n
}
