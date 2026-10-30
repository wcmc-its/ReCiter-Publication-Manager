// Shared, dependency-free helpers for the curate page's external-publication search:
// the Add tab (TabAddExternalPublication, Scopus by default with an OpenAlex fallback) and
// the Scopus Authorships tab (TabScopusAuthorships). Kept free of imports so the unit tests
// in tests/ can load this file directly with `node --test`.

export type AddSource = 'SCOPUS' | 'OPENALEX'

// Longest DOI we will accept from a query or a link. Real DOIs are well under this; the cap
// only stops a pathological link parameter from being carried into a search.
const MAX_DOI_LENGTH = 300

// Crossref's DOI pattern, widened to the SICI-era characters (<>[]#+) that real Wiley/Elsevier
// DOIs carry. Quotes, backticks, backslashes, whitespace and control characters are refused.
const DOI_PATTERN = /^10\.\d{4,9}\/[-._;()/:<>[\]#+A-Za-z0-9]+$/

// The prefixes a DOI is commonly written with. Only doi.org (with or without dx./www.) counts
// as a URL form; any other host is not a DOI.
const DOI_URL_PREFIX = /^https?:\/\/(?:dx\.|www\.)?doi\.org\//i
const DOI_SCHEME_PREFIX = /^doi:\s*/i

// Return the bare DOI ("10.xxxx/...") when the whole input is a DOI, a doi.org URL, or a
// "doi:" form, else null. Trailing sentence punctuation (".", ",", ";") is dropped, as when a
// DOI is pasted from running text. Case is preserved (Scopus and OpenAlex match DOIs
// case-insensitively).
export function normalizeDoiInput(raw: unknown): string | null {
    if (typeof raw !== 'string') return null
    let s = raw.trim()
    if (!s || s.length > MAX_DOI_LENGTH + 40) return null
    if (DOI_URL_PREFIX.test(s)) {
        s = s.replace(DOI_URL_PREFIX, '')
        // doi.org URLs are sometimes percent-encoded (10.1000%2Fxyz).
        if (s.includes('%')) {
            try { s = decodeURIComponent(s) } catch (e) { return null }
        }
    } else if (DOI_SCHEME_PREFIX.test(s)) {
        s = s.replace(DOI_SCHEME_PREFIX, '')
    }
    s = s.replace(/[.,;]+$/, '')
    if (!s || s.length > MAX_DOI_LENGTH) return null
    return DOI_PATTERN.test(s) ? s : null
}

export function looksLikeDoi(query: unknown): boolean {
    return normalizeDoiInput(query) !== null
}

// Which Scopus document search a free-text Add-tab query runs: a DOI-looking query searches
// by DOI (with the bare DOI as the term), anything else by keyword.
export function scopusSearchFor(query: string): { by: 'doi' | 'keyword', term: string } {
    const doi = normalizeDoiInput(query)
    return doi ? { by: 'doi', term: doi } : { by: 'keyword', term: (query || '').trim() }
}

// What the Add tab does after a Scopus search. `status` is the HTTP status of the
// /api/reciter/search/scopus call (0 for a network failure).
//   - 503 (Scopus not configured), 502 (Scopus unavailable), any other 5xx or a network
//     failure: run the same query against OpenAlex and say why.
//   - 2xx with no results for a DOI search: Scopus does not hold that DOI, so try OpenAlex.
//   - 2xx with no results for a keyword search: no fallback; the empty state says so.
//   - Other 4xx (e.g. a bad API key): an error, not a fallback; OpenAlex would fail the same way.
export type ScopusOutcome =
    | { kind: 'results' }
    | { kind: 'empty' }
    | { kind: 'fallback', note: string }
    | { kind: 'error', message: string }

export function decideScopusOutcome(args: { status: number, resultCount: number, by: 'doi' | 'keyword' }): ScopusOutcome {
    const { status, resultCount, by } = args
    if (status >= 200 && status < 300) {
        if (resultCount > 0) return { kind: 'results' }
        if (by === 'doi') return { kind: 'fallback', note: 'Scopus has no record of this DOI, so OpenAlex was searched instead.' }
        return { kind: 'empty' }
    }
    if (status === 503) return { kind: 'fallback', note: 'Scopus is not configured on this server, so OpenAlex was searched instead.' }
    if (status === 0 || status >= 500) return { kind: 'fallback', note: 'Scopus search is unavailable right now, so OpenAlex was searched instead.' }
    return { kind: 'error', message: `Scopus search failed (HTTP ${status}).` }
}

// The Scopus tab's result mapping, shared so a Scopus result looks the same on either tab: a
// doc with no PMID of its own may be the same paper as one already in the person's record
// (same DOI, or same Scopus document ID), so carry that record's PMID onto it.
export function enrichScopusResults<T extends { pmid?: number, doi?: string, articleId?: string }>(
    results: T[],
    findRecordPmid: (doc: { doi?: string, articleId?: string }) => number | null,
): T[] {
    return (Array.isArray(results) ? results : []).map((d) => d.pmid ? d : { ...d, pmid: findRecordPmid(d) ?? undefined })
}

// Mark every fetched doc that is already a non-suppressed ExternalArticle on the record as
// 'added', so its card shows "Added" instead of offering Add again. Returns `prev` unchanged
// (same object) when nothing changes, so it is safe inside a setState updater.
export function seedAddedStates<S extends { status: string }>(
    prev: Record<string, S>,
    docs: Array<{ articleId: string }>,
    externalIds: Set<string>,
): Record<string, S> {
    if (externalIds.size === 0 || docs.length === 0) return prev
    let changed = false
    const next = { ...prev }
    docs.forEach((d) => {
        if (externalIds.has(d.articleId) && next[d.articleId]?.status !== 'added') {
            next[d.articleId] = { status: 'added' } as S
            changed = true
        }
    })
    return changed ? next : prev
}

// Deep link: /curate/<uid>?add=external&doi=<doi>[&source=openalex]
//        or: /curate/<uid>?add=pubmed&pmid=<pmid> (the PubMed Add tab, that PMID searched)
//   open       — add=external was given; the curate page opens the Add tab.
//   doi        — the validated bare DOI, or undefined (absent or invalid).
//   invalidDoi — a doi parameter was present but is not a DOI or doi.org URL. The value itself
//                is never returned, so it can never be echoed back into the page.
//   source     — OPENALEX only for source=openalex, otherwise SCOPUS.
//   pmid       — add=pubmed only, a positive integer PMID; without one the link stays closed.
export type AddDeepLink = { open: boolean, doi?: string, invalidDoi: boolean, source: AddSource, pmid?: number }

const firstParam = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v
    if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
    return undefined
}

export function parseAddDeepLink(query: Record<string, unknown> | null | undefined): AddDeepLink {
    const q = query || {}
    const add = firstParam(q.add)
    const open = (add || '').trim().toLowerCase() === 'external'
    const source: AddSource = (firstParam(q.source) || '').trim().toLowerCase() === 'openalex' ? 'OPENALEX' : 'SCOPUS'
    if ((add || '').trim().toLowerCase() === 'pubmed') {
        const raw = (firstParam(q.pmid) || '').trim()
        const pmid = /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : undefined
        return pmid ? { open: true, pmid, invalidDoi: false, source } : { open: false, invalidDoi: false, source }
    }
    if (!open) return { open: false, invalidDoi: false, source }
    const rawDoi = firstParam(q.doi)
    if (rawDoi === undefined || rawDoi.trim() === '') return { open, invalidDoi: false, source }
    const doi = normalizeDoiInput(rawDoi)
    return doi ? { open, doi, invalidDoi: false, source } : { open, invalidDoi: true, source }
}

// The deep-link parameters, so the curate page can drop them from the URL once applied (a
// later remount of the tabs, e.g. after Refresh Suggestions, must not re-open the Add tab).
export const ADD_DEEP_LINK_PARAMS = ['add', 'doi', 'source', 'pmid']
