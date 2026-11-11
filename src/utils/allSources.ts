// Phase 3a — Curate's single "All sources" tab over today's ExternalArticle rows: one row per
// work across Scopus, OpenAlex, Crossref and ORCID, a status switch (Pending / Accepted /
// Rejected) and a source switch. Its only import is the dependency-free src/lib/pubTypes.ts, so
// tests/allSources.test.mjs can load it with `node --test`.
//
// Today's rows carry no lifecycle status: a row is Accepted unless `suppressed` (curator reject,
// or superseded by a PubMed record). With the external record store (EXTERNAL_STORE=mysql, plan
// 3b-3e) every row carries a `status`, which wins. Plan 3f-3h (3h data model) adds: the ORCID
// source, the 3b states (an AUTOMERGED or MERGED row sits under the record it was merged into),
// and Pending counts that leave out works the type map hides (talks, posters, out of scope).

import { mapSourceType } from '../lib/pubTypes'

export type ExtStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'
export type ExtSourceName = 'Scopus' | 'OpenAlex' | 'Crossref' | 'ORCID' | 'Manual'
export const EXT_SOURCE_NAMES: ExtSourceName[] = ['Scopus', 'OpenAlex', 'Crossref', 'ORCID', 'Manual']
// Sources the source switch offers only when a work has them (the rest are always offered).
export const EXT_SOURCES_IF_PRESENT: ExtSourceName[] = ['ORCID', 'Manual']

// The status switch a row sits under. The 3b states that are not a curator's live decision all
// read as Rejected: REMOVED (taken out of the record), SUPERSEDED (a PubMed twin was accepted),
// MERGED and AUTOMERGED (the same work as another record). An AUTOMERGED or MERGED row whose
// record is in the list is grouped under that record instead (groupExternalWorks), so it never
// sets a work's status. A row with no status (today's ExternalArticle) falls back to suppressed.
const NOT_LIVE_STATUSES = ['REMOVED', 'SUPERSEDED', 'MERGED', 'AUTOMERGED']
export function extStatusOf(row: any): ExtStatus {
    const s = String(row?.status || '').toUpperCase()
    if (s === 'PENDING' || s === 'ACCEPTED' || s === 'REJECTED') return s
    if (NOT_LIVE_STATUSES.includes(s)) return 'REJECTED'
    return row?.suppressed ? 'REJECTED' : 'ACCEPTED'
}

// sourceType, else the SOURCE: prefix of articleId. Anything unrecognised (WOS, MANUAL, none) is
// Manual, the catch-all the old per-source tabs used.
export function extSourceOf(row: any): ExtSourceName {
    const id = String(row?.articleId || '')
    const st = String(row?.sourceType || (id.includes(':') ? id.slice(0, id.indexOf(':')) : '')).toUpperCase()
    return st === 'SCOPUS' ? 'Scopus' : st === 'OPENALEX' ? 'OpenAlex' : st === 'CROSSREF' ? 'Crossref'
        : st === 'ORCID' ? 'ORCID' : 'Manual'
}

export const normDoi = (x: unknown): string =>
    String(x ?? '').trim().toLowerCase().replace(/^https?:\/\/(?:dx\.|www\.)?doi\.org\//, '').replace(/^doi:\s*/, '')

export type ExtWork = {
    key: string,
    // Every row of the work: its own rows plus the rows merged into them.
    rows: any[],
    // Rows merged into another row of this work (AUTOMERGED / MERGED with mergedIntoId), for the
    // provenance badges; they never set the work's status or lead.
    attached: any[],
    // Distinct sources holding this work (attached rows included), in EXT_SOURCE_NAMES order.
    sources: ExtSourceName[],
    status: ExtStatus,
    // The row shown for the work: one in the work's status, preferring one with authors.
    lead: any,
}

const hasAuthors = (row: any): boolean =>
    (Array.isArray(row?.authors) && row.authors.some(Boolean)) ||
    (typeof row?.authors === 'string' && row.authors.trim().length > 0)

const MERGE_CHILD_STATUSES = ['MERGED', 'AUTOMERGED']
const recordIdOf = (row: any): string | null => (row?.id == null || row.id === '' ? null : String(row.id))

// The row a merged row sits under: follows mergedIntoId through the list to a row that is not
// itself merged into one in the list. null when the row is not merged into a listed row. A cycle
// (bad data) resolves to its member with the lowest id, so its rows still form one work.
function mergeParentOf(row: any, byId: Map<string, any>): any | null {
    const path: any[] = [row]
    let cur = row
    for (;;) {
        if (!MERGE_CHILD_STATUSES.includes(String(cur?.status || '').toUpperCase())) break
        const into = cur?.mergedIntoId == null ? null : byId.get(String(cur.mergedIntoId))
        if (!into) break
        const at = path.indexOf(into)
        if (at >= 0) {
            cur = path.slice(at).reduce((a, b) => (Number(recordIdOf(b)) < Number(recordIdOf(a)) ? b : a))
            break
        }
        path.push(into)
        cur = into
    }
    return cur === row ? null : cur
}

// One work per record: a row merged into another listed row (AUTOMERGED / MERGED, by
// mergedIntoId) joins that row's work even without a DOI; the rest group by DOI (case and
// doi.org prefix ignored), and a row without a DOI is its own work. Group order follows the
// first row of each group, so the list keeps the API's order.
export function groupExternalWorks(rows: any[]): ExtWork[] {
    const list = rows || []
    const byId = new Map<string, any>()
    for (const row of list) { const id = recordIdOf(row); if (id != null && !byId.has(id)) byId.set(id, row) }
    const ownKey = (row: any): string => {
        const doi = normDoi(row?.doi)
        return doi ? `doi:${doi}` : `id:${row?.articleId || ''}`
    }
    const byKey = new Map<string, any[]>()
    const parentOf = new Map<any, any>()
    for (const row of list) {
        const parent = mergeParentOf(row, byId)
        if (parent) parentOf.set(row, parent)
        const key = ownKey(parent || row)
        const g = byKey.get(key)
        if (g) g.push(row)
        else byKey.set(key, [row])
    }
    return [...byKey.entries()].map(([key, g]) => {
        const attached = g.filter((r) => parentOf.has(r))
        const own = g.filter((r) => !parentOf.has(r))
        const base = own.length ? own : g
        const statuses = base.map(extStatusOf)
        const status: ExtStatus = statuses.includes('PENDING') ? 'PENDING' : statuses.includes('ACCEPTED') ? 'ACCEPTED' : 'REJECTED'
        const inStatus = base.filter((r) => extStatusOf(r) === status)
        const lead = inStatus.find(hasAuthors) || inStatus[0]
        const present = new Set(g.map(extSourceOf))
        return { key, rows: g, attached, sources: EXT_SOURCE_NAMES.filter((s) => present.has(s)), status, lead }
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

// Whether the type map hides this work (pubTypes.ts mapSourceType: talks and posters, out of
// scope types such as patents and peer reviews, errata and retractions). A row with a curator's
// pubType, a Manual row, or one with no source type is not hidden; a work is hidden only when
// every one of its own rows is.
export function rowHidden(row: any): boolean {
    if (row?.pubType) return false
    const source = extSourceOf(row)
    const t = row?.publicationType ?? row?.sourcePubType
    if (source === 'Manual' || t == null || String(t).trim() === '') return false
    return mapSourceType(source, String(t)).hidden
}
export function workHidden(work: ExtWork): boolean {
    const own = work.rows.filter((r) => !work.attached.includes(r))
    const base = own.length ? own : work.rows
    return base.length > 0 && base.every(rowHidden)
}

// Works per status. With `hidden`, a Pending work it matches is left out of the Pending count
// (and so out of the "N to review" pill); Accepted and Rejected counts are unchanged.
export function countWorks(works: ExtWork[], hidden?: (w: ExtWork) => boolean): Record<ExtStatus, number> {
    const n: Record<ExtStatus, number> = { PENDING: 0, ACCEPTED: 0, REJECTED: 0 }
    for (const w of works) {
        if (w.status === 'PENDING' && hidden && hidden(w)) continue
        n[w.status]++
    }
    return n
}

// EXTERNAL_STORE=mysql (plan 3b-3e, 3c): the curator's three actions as lifecycle targets, per
// row status. null = the action does not apply to a row in that status (it is left alone, or the
// button is not offered). Accept on a REJECTED / REMOVED row puts the work back (the store's
// re-accept, which clears its rejection memory); a SUPERSEDED or MERGED row follows its PubMed
// twin or kept record and is not the curator's to accept here.
export type StoreIntent = 'accept' | 'reject' | 'remove'
export type StoreTarget = 'ACCEPTED' | 'REJECTED' | 'REMOVED'
export function storeTargetOf(status: unknown, intent: StoreIntent): StoreTarget | null {
    const s = String(status || '').toUpperCase()
    if (intent === 'accept') return s === 'PENDING' || s === 'REJECTED' || s === 'REMOVED' ? 'ACCEPTED' : null
    if (intent === 'reject') return s === 'PENDING' ? 'REJECTED' : null
    return s === 'ACCEPTED' ? 'REMOVED' : null
}

// Why a store row sits in the Rejected view, for the row's status line.
export function storeStatusText(row: any): string {
    const s = String(row?.status || '').toUpperCase()
    if (s === 'SUPERSEDED') return row?.supersededByPmid ? `Superseded by PMID ${row.supersededByPmid}` : 'Superseded by a PubMed record'
    if (s === 'MERGED' || s === 'AUTOMERGED') return row?.mergedIntoPmid ? `Same work as PMID ${row.mergedIntoPmid}` : 'Same work as another record'
    if (s === 'REMOVED') return row?.statusBy ? `Removed by ${row.statusBy}` : 'Removed'
    return row?.statusBy ? `Rejected by ${row.statusBy}` : 'Rejected'
}
