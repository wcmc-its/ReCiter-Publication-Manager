// Shared, dependency-free helpers for the curate page's external-publication search:
// the Add tab (TabAddExternalPublication, Scopus by default with an OpenAlex fallback) and
// the Scopus Authorships tab (TabScopusAuthorships). Kept free of imports so the unit tests
// in tests/ can load this file directly with `node --test`.

export type AddSource = 'SCOPUS' | 'OPENALEX' | 'CROSSREF'

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

// Deep link: /curate/<uid>?add=external&doi=<doi>[&source=openalex|crossref]
//        or: /curate/<uid>?add=pubmed&pmid=<pmid> (the PubMed Add tab, that PMID searched)
//   open       — add=external was given; the curate page opens the Add tab.
//   doi        — the validated bare DOI, or undefined (absent or invalid).
//   invalidDoi — a doi parameter was present but is not a DOI or doi.org URL. The value itself
//                is never returned, so it can never be echoed back into the page.
//   source     — OPENALEX for source=openalex, CROSSREF for source=crossref, otherwise SCOPUS.
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
    const rawSource = (firstParam(q.source) || '').trim().toLowerCase()
    const source: AddSource = rawSource === 'openalex' ? 'OPENALEX' : rawSource === 'crossref' ? 'CROSSREF' : 'SCOPUS'
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

// PM#1060 — Crossref as an external-article source. Publishers register DOIs in Crossref first
// (OpenAlex lags it by days to weeks), so a DOI neither Scopus nor OpenAlex holds is searched
// there. A Crossref paper's article id is "CROSSREF:" + the DOI lowercased, and it stays a
// CROSSREF: record for good (it is never migrated to OPENALEX:); the duplicate check catches a
// later add of the same DOI from another source.

// reciterdb external_article.article_id is VARCHAR(96); ReCiter rejects a longer CROSSREF id.
export const MAX_EXTERNAL_ARTICLE_ID_LENGTH = 96

const stripTags = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const firstOf = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v)

// Crossref date-parts ([[2026, 10, 30]], [[2026, 10]] or [[2026]]) as YYYY-MM-DD, YYYY-MM or YYYY.
export function crossrefPubDate(dateParts: unknown): string | undefined {
    const parts = Array.isArray(dateParts) && Array.isArray(dateParts[0]) ? dateParts[0] : null
    if (!parts || !Number(parts[0])) return undefined
    const pad = (n: unknown) => String(Number(n)).padStart(2, '0')
    return [String(Number(parts[0]))].concat(parts.slice(1, 3).filter((n: unknown) => Number(n)).map(pad)).join('-')
}

// Crossref's whole-book types. A book-chapter is not one: its container title (the book) is its venue.
const BOOK_TYPES = new Set(['book', 'edited-book', 'monograph', 'reference-book', 'book-set'])
export const isBookType = (type: unknown): boolean => typeof type === 'string' && BOOK_TYPES.has(type)

// Return the ISBN-13 (digits only) when the whole input is an ISBN-10 or ISBN-13, with or without
// hyphens/spaces and an optional "ISBN" label, else null. Check digits are verified, so a 10- or
// 13-digit number that is not an ISBN stays a keyword search. Crossref's isbn filter matches
// only the bare ISBN-13 form, so an ISBN-10 is converted.
export function normalizeIsbnInput(raw: unknown): string | null {
    if (typeof raw !== 'string') return null
    const s = raw.trim().replace(/^isbn(?:-1[03])?:?\s*/i, '').replace(/[-\s]/g, '').toUpperCase()
    if (/^\d{9}[\dX]$/.test(s)) {
        const sum = s.split('').reduce((acc, c, i) => acc + (c === 'X' ? 10 : Number(c)) * (10 - i), 0)
        if (sum % 11 !== 0) return null
        const body = '978' + s.slice(0, 9)
        return body + isbn13CheckDigit(body)
    }
    if (/^97[89]\d{10}$/.test(s)) return isbn13CheckDigit(s.slice(0, 12)) === s[12] ? s : null
    return null
}

function isbn13CheckDigit(first12: string): string {
    const sum = first12.split('').reduce((acc, c, i) => acc + Number(c) * (i % 2 ? 3 : 1), 0)
    return String((10 - (sum % 10)) % 10)
}

// Map one Crossref work (a /works/{doi} `message`, or one of a keyword search's `items`) to the
// external-article POST body (minus addedBy, set server-side), or null when it has no DOI or
// title. An id over the 96-char cap gets `notAddable` (the reason) and the card shows no Add.
export function crossrefExternalArticleFrom(work: any): Record<string, any> | null {
    if (!work || !work.DOI) return null
    const title = stripTags(firstOf(work.title))
    if (!title) return null
    const doi = String(work.DOI).trim()
    const articleId = 'CROSSREF:' + doi.toLowerCase()
    const authors = (Array.isArray(work.author) ? work.author : [])
        .map((a: any) => a && (a.name || [a.given, a.family].filter(Boolean).join(' ')))
        .filter(Boolean)
    // The reference list can run to thousands of entries; it is not needed to describe the work.
    const { reference: _reference, ...record } = work
    const row: Record<string, any> = {
        articleId,
        title,
        doi,
        // A book has no container title; its publisher is the closest thing to a venue.
        journalOrVenue: stripTags(firstOf(work['container-title'])) || (isBookType(work.type) ? stripTags(work.publisher) : '') || undefined,
        authors,
        pubDate: crossrefPubDate((work.issued || work.published || {})['date-parts']),
        publicationType: work.type || undefined,
        sourceType: 'CROSSREF',
        method: 'dropdown-search',
        rawRecord: JSON.stringify(record),
    }
    if (articleId.length > MAX_EXTERNAL_ARTICLE_ID_LENGTH) {
        row.notAddable = `This DOI is too long to store as a Crossref record (the id would be ${articleId.length} characters; the limit is ${MAX_EXTERNAL_ARTICLE_ID_LENGTH}).`
    }
    return row
}

// What the Add tab shows after an empty OpenAlex DOI search, given the status of the
// /api/reciter/search/crossref call (0 for a network failure) and how many rows it returned.
//   - 2xx with rows: Crossref's results, with a note saying why Crossref was searched.
//   - 2xx with no rows (Crossref does not hold the DOI either): the "No results" empty state.
//   - Anything else: the empty state stands, with a note that Crossref could not be checked.
export type CrossrefOutcome = { kind: 'results', note: string } | { kind: 'none', note?: string }

export function decideCrossrefOutcome(args: { status: number, resultCount: number }): CrossrefOutcome {
    const { status, resultCount } = args
    if (status >= 200 && status < 300) {
        return resultCount > 0 ? { kind: 'results', note: 'OpenAlex has no record of this DOI, so Crossref was searched instead.' } : { kind: 'none' }
    }
    return { kind: 'none', note: 'Crossref could not be checked for this DOI right now.' }
}

// Crossref's /works path takes the DOI percent-encoded but with its "/" kept.
export const crossrefWorkPath = (doi: string): string => '/works/' + encodeURIComponent(doi).replace(/%2F/gi, '/')

// Phase 3a — the curate page's single Add publication dialog. Where a query goes, given the
// source the curator picked in the dialog:
//   - a PMID (digits, or "PMID: 123") always goes to the scored PubMed flow;
//   - a DOI goes to the external add path: the picked source, or Scopus (with its OpenAlex then
//     Crossref fallback) when PubMed was picked, since PubMed is not searched by DOI here;
//   - an ISBN goes to Crossref (the external add path sends one there from any source);
//   - anything else (title words, author) goes to the picked source.
export type AddDialogSource = 'PUBMED' | AddSource
export type AddRoute =
    | { kind: 'pubmed', query: string }
    | { kind: 'external', source: AddSource, query: string }

const PMID_QUERY = /^(?:pmid\s*:?\s*)?([1-9]\d{0,8})$/i

export function routeAddQuery(raw: unknown, picked: AddDialogSource): AddRoute | null {
    const q = typeof raw === 'string' ? raw.trim() : ''
    if (!q) return null
    const pmid = PMID_QUERY.exec(q)
    if (pmid) return { kind: 'pubmed', query: pmid[1] }
    if (normalizeDoiInput(q) !== null) return { kind: 'external', source: picked === 'PUBMED' ? 'SCOPUS' : picked, query: q }
    if (picked === 'PUBMED' && normalizeIsbnInput(q) !== null) return { kind: 'external', source: 'CROSSREF', query: q }
    return picked === 'PUBMED' ? { kind: 'pubmed', query: q } : { kind: 'external', source: picked, query: q }
}
