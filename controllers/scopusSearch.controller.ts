// PM#772 — Scopus author-search proxy for the Scopus Authorships tab. Two modes:
//   - authors:   resolve a person's Scopus Author ID from their name + WCM affiliation
//   - documents: list a Scopus Author ID's documents (AU-ID query), or search by keyword/DOI
//
// Server-side only. Routed through the ReCiter Scopus Retrieval Tool's /scopus/search/*
// endpoints (ScopusTool#31) rather than calling api.elsevier.com directly: the tool holds
// the Elsevier API key + inst token, so PM no longer needs them. The tool returns the
// Elsevier search-results JSON verbatim, so the normalization below is unchanged — docs
// are shaped into the external-article POST body so accept flows reuse the #771 pipeline.

import { reciterConfig } from '../config/local'

export function scopusConfigured(): boolean {
    // The Elsevier credentials now live in the Scopus Retrieval Tool; here we only need the
    // tool endpoint to be configured. A missing key in the tool surfaces as a 5xx below.
    return !!(process.env.RECITER_SCOPUS_API_URL || process.env.RECITER_API_BASE_URL)
}

// One Scopus Search entry -> external-article POST body (minus addedBy, set server-side).
function normalizeScopusDoc(entry: any) {
    if (!entry) return null
    const scopusId = String(entry['dc:identifier'] || '').replace(/^SCOPUS_ID:/, '')
    if (!scopusId) return null
    const pmidRaw = entry['pubmed-id']
    const creator = entry['dc:creator']
    return {
        articleId: 'SCOPUS:' + scopusId,
        title: entry['dc:title'] || '',
        doi: entry['prism:doi'] || undefined,
        pmid: pmidRaw ? Number(pmidRaw) : undefined,
        journalOrVenue: entry['prism:publicationName'] || undefined,
        authors: creator ? [creator] : [],   // Scopus search view returns first author only
        pubDate: entry['prism:coverDate'] || undefined,
        publicationType: entry['subtypeDescription'] || undefined,
        sourceType: 'SCOPUS',
        method: 'scopus-authorships-tab',
        rawRecord: JSON.stringify(entry),
    }
}

// Resolve candidate Scopus Author IDs for a person by name (tool scopes to WCM affiliation).
export async function searchScopusAuthors(lastName: string, firstName: string) {
    if (!lastName) return []
    const params = new URLSearchParams({ lastName })
    if (firstName) params.set('firstName', firstName)
    const res = await fetch(`${reciterConfig.reciterScopus.searchAuthorsEndpoint}?${params.toString()}`, {
        headers: { 'User-Agent': 'reciter-pub-manager-server' },
    })
    if (!res.ok) throw new Error(`Scopus author search HTTP ${res.status}`)
    const data: any = await res.json()
    const entries = (data['search-results'] && data['search-results'].entry) || []
    return entries
        .map((e: any) => ({
            authorId: String(e['dc:identifier'] || '').replace(/^AUTHOR_ID:/, ''),
            surname: (e['preferred-name'] || {}).surname,
            givenName: (e['preferred-name'] || {})['given-name'],
            docCount: e['document-count'],
            affiliation: (e['affiliation-current'] || {})['affiliation-name'],
        }))
        .filter((a: any) => a.authorId)
}

// Search Scopus documents by author id, keyword, or doi. Returns the normalized page
// plus the true total so the UI can tell the curator when there is more than we fetched.
export async function searchScopusDocuments(by: string, term: string): Promise<{ results: any[], total: number }> {
    const t = (term || '').trim()
    if (!t) return { results: [], total: 0 }
    const params = new URLSearchParams({ by: by || 'author', term: t })
    const res = await fetch(`${reciterConfig.reciterScopus.searchDocumentsEndpoint}?${params.toString()}`, {
        headers: { 'User-Agent': 'reciter-pub-manager-server' },
    })
    if (!res.ok) throw new Error(`Scopus doc search HTTP ${res.status}`)
    const data: any = await res.json()
    const sr = data['search-results'] || {}
    // Scopus returns a single entry carrying an 'error' field (no dc:identifier) on no match.
    const entries = (sr.entry || []).filter((e: any) => e && e['dc:identifier'])
    return {
        results: entries.map(normalizeScopusDoc).filter(Boolean),
        total: Number(sr['opensearch:totalResults'] || 0),
    }
}
